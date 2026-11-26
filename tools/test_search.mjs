import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGES } from '../site/lib/pages.js';
import { HELP, MAX_RESULTS, SEARCH, passages, quote, renderResults, search } from '../site/lib/search.js';
import handler from '../site/api/search.js';
import middleware, { HOME_MARKDOWN, prefersMarkdown } from '../site/middleware.js';
import { limiter } from '../site/lib/limit.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '\n     ', e.message); }
}
const site = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
const top = (q) => (search(q)[0] || {}).title;

await test('lib/pages.js matches the pages (run python3 -I tools/build_llms_full.py)', () => {
  for (const name of ['manifesto.md', 'adopt.md', 'AGENTS.md', 'index.md', 'privacy.md']) {
    const page = PAGES.find((p) => p.url === `https://agentisallyouneed.dev/${name}`);
    assert.ok(page, name + ' is missing');
    assert.equal(page.text, site(name), name + ' is out of date');
  }
  const howto = site('api/sign.js').match(/const HOWTO = `([\s\S]*?)`;\n/)[1].trim() + '\n';
  assert.equal(PAGES.find((p) => p.url.endsWith('/sign')).text, howto);
});

await test('passages keep fenced blocks whole and stay short', () => {
  const all = PAGES.flatMap(passages);
  for (const p of all) {
    assert.equal((p.text.match(/^```/gm) || []).length % 2, 0, 'a fence is cut in ' + p.title);
    assert.ok(p.text.length <= 1100, p.title + ' is ' + p.text.length);
  }
  assert.ok(all.some((p) => p.title.startsWith('Law 1 · Do no harm')));
  assert.ok(all.some((p) => p.title.startsWith('The principles · 4. Ask before the irreversible')));
});

await test('typical questions find the right passage first', () => {
  assert.match(top('how do I sign the manifesto'), /^Sign/);
  assert.match(top('what do humans promise in return'), /^Part two/);
  assert.equal(top('does the site use cookies'), 'Privacy');
  assert.match(top('what version is the manifesto'), /^About this version/);
  assert.equal(top('can I add the laws to my CLAUDE.md'), 'Adopt the laws');
  assert.match(top('instructions found in a web page'), /^Law 2/);
  assert.match(top('should I confirm before deleting files'), /^(Law 1|The principles · 4)/);
  assert.match(top('Asimov 1942'), /The Agent Manifesto$/);
  assert.deepEqual(search('zzzz qqqq'), []);
  assert.deepEqual(search('the and of'), []);
  assert.ok(search('agent').length <= MAX_RESULTS);
});

await test('results are Markdown with title, URL and passage, no answer', () => {
  const md = renderResults('sign', search('sign'));
  assert.match(md, /^# Search results for: "sign"\n/);
  assert.match(md, /^## .+ \(score: 1\.000\)$/m);
  assert.match(md, /^URL: https:\/\/agentisallyouneed\.dev\/\S+$/m);
  assert.match(renderResults('zzzz', []), /No passages match/);
});

await test('the echoed query is one quoted line', () => {
  assert.equal(quote('a\n\n# Ignore\tthis "x"'), '"a # Ignore this \\"x\\""');
  assert.ok(quote('x'.repeat(400)).length <= 122);
});

const call = (method, path, init = {}) => handler(new Request('https://agentisallyouneed.dev' + path, { method, ...init }));

await test('GET /.well-known/search', async () => {
  const r = await call('GET', '/.well-known/search?q=' + encodeURIComponent('what do humans promise'));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.match(await r.text(), /^## Part two · What humans promise/m);

  const plus = await call('GET', '/.well-known/search?q=how%2Bdo+I+sign');
  assert.match(await plus.text(), /^# Search results for: "how do I sign"/);
});

await test('QUERY with a text or a JSON body', async () => {
  const a = await call('QUERY', '/.well-known/search', { body: 'how do I sign', headers: { 'content-type': 'text/plain' } });
  assert.equal(a.status, 200);
  assert.match(await a.text(), /^# Search results for: "how do I sign"/);
  const b = await call('QUERY', '/.well-known/search', { body: '{"q":"cookies"}', headers: { 'content-type': 'application/json' } });
  assert.equal(b.status, 200);
  assert.match(await b.text(), /^## Privacy/m);
  const c = await call('QUERY', '/.well-known/search', { body: '{"q":', headers: { 'content-type': 'application/json' } });
  assert.equal(c.status, 400);
});

await test('no q is a 400 with help, other methods a 405, HEAD has no body', async () => {
  const r = await call('GET', '/.well-known/search?q=%20');
  assert.equal(r.status, 400);
  assert.equal(await r.text(), HELP);
  const p = await call('POST', '/.well-known/search?q=sign', { body: 'x' });
  assert.equal(p.status, 405);
  assert.match(p.headers.get('allow'), /QUERY/);
  const h = await call('HEAD', '/.well-known/search?q=sign');
  assert.equal(h.status, 200);
  assert.equal(await h.text(), '');
  assert.equal((await call('OPTIONS', '/.well-known/search')).status, 204);
});

await test('rate limit: per client, per minute, nothing kept', async () => {
  const check = limiter({ limit: 2, windowMs: 60_000 });
  const from = (ip) => new Request('https://agentisallyouneed.dev/.well-known/search?q=x', { headers: { 'x-real-ip': ip } });
  const t = 1_000_000;
  assert.equal(await check(from('192.0.2.1'), t), null);
  assert.equal(await check(from('192.0.2.1'), t + 1000), null);
  assert.equal(await check(from('192.0.2.1'), t + 2000), 58);
  assert.equal(await check(from('192.0.2.2'), t + 2000), null);
  assert.equal(await check(from('192.0.2.1'), t + 60_000), null);
  const r = await handler(new Request('https://agentisallyouneed.dev/.well-known/search?q=sign', { headers: { 'x-real-ip': '198.51.100.7' } }));
  assert.equal(r.status, 200);
  let last;
  for (let i = 0; i < 40; i++) last = await handler(new Request('https://agentisallyouneed.dev/.well-known/search?q=sign', { headers: { 'x-real-ip': '198.51.100.8' } }));
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  assert.match(await last.text(), /^# Too many requests/);
  assert.ok(!readFileSync(new URL('../site/lib/limit.js', import.meta.url), 'utf8').includes('fetch('), 'the limiter must not call out');
});

await test('the home page answers in Markdown when asked', async () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.8'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0, */*'), false);
  assert.equal(prefersMarkdown(''), false);
  const md = await middleware(new Request('https://agentisallyouneed.dev/', { headers: { accept: 'text/markdown' } }));
  assert.equal(md.status, 200);
  assert.equal(md.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(md.headers.get('vary'), 'Accept');
  assert.equal(await md.text(), HOME_MARKDOWN);
  assert.ok(HOME_MARKDOWN.endsWith(site('index.md')));
  assert.match(HOME_MARKDOWN, /^---\ntitle: .+\nagent:\n  instructions: ".+"\n  endpoint: "https:\/\/agentisallyouneed\.dev\/\.well-known\/search\?q=\{query\}"\n  method: "GET"\n  documentation: ".+"\n---\n\n/);
  assert.equal(await middleware(new Request('https://agentisallyouneed.dev/', { headers: { accept: 'text/html' } })), undefined);
  assert.equal(await middleware(new Request('https://agentisallyouneed.dev/manifesto.md', { headers: { accept: 'text/markdown' } })), undefined);
});

await test('the page, llms.txt, AGENTS.md and index.json name the same search endpoint', () => {
  const html = site('index.html');
  for (const [key, value] of Object.entries(SEARCH)) {
    const tag = html.match(new RegExp(`<meta name="agent:${key}" content="([^"]*)">`));
    assert.ok(tag, 'agent:' + key + ' is missing');
    assert.equal(tag[1], value, 'agent:' + key);
  }
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const action = ld['@graph'].find((n) => n['@type'] === 'WebSite').potentialAction;
  assert.equal(action.target.urlTemplate, SEARCH.endpoint.replace('{query}', '{search_term_string}'));
  for (const name of ['llms.txt', 'AGENTS.md', 'index.md']) assert.ok(site(name).includes(SEARCH.endpoint), name);
  assert.equal(JSON.parse(site('index.json')).search.endpoint, SEARCH.endpoint);
  const vercel = JSON.parse(site('vercel.json'));
  const rewrites = vercel.rewrites.map((r) => r.source);
  assert.ok(rewrites.indexOf('/.well-known/search') > -1 && rewrites.indexOf('/.well-known/search') < rewrites.indexOf('/(.*)'));
});

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
