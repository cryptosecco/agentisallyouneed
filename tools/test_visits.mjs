import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { counterSvg } from '../site/api/counter.js';
import { MANIFESTO_VERSION, classify, countVisit, daySalt, fingerprint, inRanges, parseCidr, parseIp, readCounts, record, requestFacts, signManifesto, storeFromEnv } from '../site/lib/visits.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '\n     ', e.message); }
}

const LISTS = { 'https://openai.com/gptbot.json': { prefixes: [{ ipv4Prefix: '192.0.2.0/24' }, { ipv6Prefix: '2001:db8::/32' }] } };
const fakeFetch = async (url) => {
  if (LISTS[url]) return { ok: true, json: async () => LISTS[url] };
  return { ok: false, json: async () => ({}) };
};

function fakeStore() {
  const kv = new Map();
  const set = (k) => kv.get(k) || kv.set(k, new Set()).get(k);
  const hash = (k) => kv.get(k) || kv.set(k, new Map()).get(k);
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const run = ([cmd, ...a]) => {
      if (cmd === 'EVAL' && a[0].includes('HGETALL')) {
        const keys = a.slice(2, 2 + Number(a[1]));
        return keys.map((key, i) => (i === 0 || i % 3 === 1 ? (kv.has(key) ? String(kv.get(key)) : null) : [...(kv.get(key) || new Map())].flat().map(String)));
      }
      if (cmd === 'EVAL') {
        const n = Number(a[1]); const keys = a.slice(2, 2 + n); const [member, day, agent, cap] = a.slice(2 + n);
        const s = set(keys[0]); if (s.has(member)) return 0;
        s.add(member);
        if (keys[5]) { const c = (kv.get(keys[5]) || 0) + 1; kv.set(keys[5], c); if (c > Number(cap)) { s.delete(member); return -1; } }
        kv.set(keys[1], (kv.get(keys[1]) || 0) + 1);
        const h = hash(keys[2]); h.set(day, (h.get(day) || 0) + 1);
        const g = hash(keys[3]); g.set(agent, (g.get(agent) || 0) + 1);
        if (!kv.has(keys[4])) kv.set(keys[4], day);
        return 1;
      }
      if (cmd === 'SET') { if (a.includes('NX') && kv.has(a[0])) return null; kv.set(a[0], a[1]); return 'OK'; }
      if (cmd === 'LPUSH') { const l = kv.get(a[0]) || kv.set(a[0], []).get(a[0]); l.unshift(a[1]); return l.length; }
      if (cmd === 'LTRIM') return 'OK';
      if (cmd === 'EXPIRE') return 1;
      if (cmd === 'GET') return kv.has(a[0]) ? String(kv.get(a[0])) : null;
      if (cmd === 'HGETALL') return [...(kv.get(a[0]) || new Map())].flat().map(String);
      throw new Error('unexpected ' + cmd);
    };
    const result = url.endsWith('/pipeline') ? body.map((c) => ({ result: run(c) })) : { result: run(body) };
    return { ok: true, json: async () => result };
  };
  return { store: { url: 'https://fake', token: 't' }, fetchImpl, kv };
}

const req = (path, headers) => new Request('https://agentisallyouneed.dev' + path, { headers });
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const human = { 'user-agent': BROWSER, 'accept-language': 'it-IT', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none' };
const GPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)';

await test('CIDR v4 and v6', () => {
  assert.ok(inRanges(parseIp('192.0.2.77'), [parseCidr('192.0.2.0/24')]));
  assert.ok(!inRanges(parseIp('192.0.3.1'), [parseCidr('192.0.2.0/24')]));
  assert.ok(inRanges(parseIp('2001:db8:1::5'), [parseCidr('2001:db8::/32')]));
  assert.ok(!inRanges(parseIp('2001:db9::1'), [parseCidr('2001:db8::/32')]));
  assert.ok(!inRanges(parseIp('192.0.2.1'), [parseCidr('2001:db8::/32')]));
  assert.equal(parseIp('300.1.1.1'), null);
  assert.equal(parseIp('not-an-ip'), null);
});

await test('a person in a browser is not counted', async () => {
  for (const p of ['/', '/index.md', '/llms.txt', '/manifesto.md']) assert.equal(await classify(requestFacts(req(p, human)), fakeFetch), null, p);
});

await test('declared GPTBot from a random address is declared, never verified', async () => {
  const hit = await classify(requestFacts(req('/llms.txt', { 'user-agent': GPT, 'x-real-ip': '203.0.113.9' })), fakeFetch);
  assert.deepEqual(hit, { level: 'declared', agent: 'GPTBot', family: 'training-crawler' });
});

await test('GPTBot from a published OpenAI range is declared and confirmed, not verified', async () => {
  const hit = await classify(requestFacts(req('/llms.txt', { 'user-agent': GPT, 'x-forwarded-for': '192.0.2.10, 10.0.0.1' })), fakeFetch);
  assert.deepEqual([hit.level, hit.confirmed], ['declared', true]);
  const { store, fetchImpl } = fakeStore();
  await countVisit(store, requestFacts(req('/llms.txt', { 'user-agent': GPT, 'x-forwarded-for': '192.0.2.10' })), new Date('2026-12-05T00:00:00Z'), fetchImpl, fakeFetch);
  const out = await readCounts(store, fetchImpl);
  assert.deepEqual([out.levels.verified.total, out.levels.declared.total, out.levels.confirmed.total], [0, 1, 1]);
});

await test('ClaudeBot has no published list: declared even from any address', async () => {
  const hit = await classify(requestFacts(req('/', { 'user-agent': 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'x-real-ip': '192.0.2.10' })), fakeFetch);
  assert.deepEqual([hit.level, hit.agent], ['declared', 'ClaudeBot']);
});

await test('curl is a declared unknown agent; Googlebot and Vercel are not counted', async () => {
  assert.deepEqual(await classify(requestFacts(req('/index.md', { 'user-agent': 'curl/8.7.1' })), fakeFetch), { level: 'declared', agent: 'unknown', family: 'unknown-agent' });
  assert.equal(await classify(requestFacts(req('/', { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })), fakeFetch), null);
  assert.equal(await classify(requestFacts(req('/', { 'user-agent': 'vercel-screenshot/1.0' })), fakeFetch), null);
});

await test('people and noise are not agents', async () => {
  for (const p of ['/', '/llms.txt', '/manifesto.md', '/index.md']) assert.equal(await classify(requestFacts(req(p, { ...human, 'user-agent': BROWSER })), fakeFetch), null, 'a person on ' + p);
  assert.equal(await classify(requestFacts(req('/', { 'user-agent': 'curl/8.7.1' })), fakeFetch), null, 'a bare client on the home page');
  assert.equal(await classify(requestFacts(req('/', { 'user-agent': 'Go-http-client/2.0' })), fakeFetch), null, 'a scanner on the home page');
  assert.equal(await classify(requestFacts(req('/', { 'user-agent': 'SomeScanner/1.0' })), fakeFetch), null, 'an unnamed client on the home page');
  assert.equal((await classify(requestFacts(req('/llms.txt', { 'user-agent': 'python-requests/2.32' })), fakeFetch)).agent, 'unknown', 'an unnamed client on an agent file');
  assert.equal((await classify(requestFacts(req('/', { 'user-agent': 'Claude-User (claude-code/2.1; +https://support.anthropic.com/)' })), fakeFetch)).agent, 'Claude-User', 'a named agent counts on the home page too');
});

await test('probable: headless browser, or a bare browser on an agent file', async () => {
  const headless = BROWSER.replace('Chrome/', 'HeadlessChrome/');
  assert.equal((await classify(requestFacts(req('/', { ...human, 'user-agent': headless })), fakeFetch)).level, 'probable');
  assert.equal((await classify(requestFacts(req('/llms.txt', { 'user-agent': BROWSER })), fakeFetch)).level, 'probable');
  assert.equal(await classify(requestFacts(req('/', { 'user-agent': BROWSER })), fakeFetch), null, 'bare browser on / is only one medium sign');
});

await test('other paths and methods are never counted', async () => {
  assert.equal(await classify(requestFacts(req('/privacy.md', { 'user-agent': GPT })), fakeFetch), null);
  assert.equal(await classify(requestFacts(new Request('https://agentisallyouneed.dev/', { method: 'POST', headers: { 'user-agent': GPT } })), fakeFetch), null);
});

await test('store: one count per agent, per level, per day; levels separate', async () => {
  const { store, fetchImpl, kv } = fakeStore();
  const d1 = new Date('2026-11-19T10:00:00Z'), d2 = new Date('2026-11-20T10:00:00Z');
  const v = { level: 'verified', agent: 'GPTBot', family: 'training-crawler' };
  const d = { level: 'declared', agent: 'GPTBot', family: 'training-crawler' };
  assert.equal(await record(store, v, d1, fetchImpl), 1);
  assert.equal(await record(store, v, d1, fetchImpl), 0);
  assert.equal(await record(store, d, d1, fetchImpl), 1);
  assert.equal(await record(store, v, d2, fetchImpl), 1);
  const out = await readCounts(store, fetchImpl);
  assert.equal(out.since, '2026-11-19');
  assert.equal(out.levels.verified.total, 2);
  assert.equal(out.levels.declared.total, 1);
  assert.equal(out.levels.probable.total, 0);
  assert.deepEqual(out.levels.verified.by_day, { '2026-11-19': 1, '2026-11-20': 1 });
  assert.deepEqual(out.levels.verified.by_agent, { GPTBot: 2 });
  const stored = JSON.stringify([...kv].map(([k, x]) => [k, x instanceof Set ? [...x] : x instanceof Map ? [...x] : x]));
  assert.ok(!/\d+\.\d+\.\d+\.\d+|Mozilla|curl/.test(stored), 'no address or user agent in the store: ' + stored);
});

await test('a declared visit does not raise verified', async () => {
  const { store, fetchImpl } = fakeStore();
  const hit = await classify(requestFacts(req('/', { 'user-agent': GPT, 'x-real-ip': '198.51.100.4' })), fakeFetch);
  await record(store, hit, new Date('2026-11-21T00:00:00Z'), fetchImpl);
  const out = await readCounts(store, fetchImpl);
  assert.equal(out.levels.verified.total, 0);
  assert.equal(out.levels.declared.total, 1);
});

await test('fingerprint: every agent counts once a day, people never, nothing personal stored', async () => {
  const { store, fetchImpl, kv } = fakeStore();
  const day = new Date('2026-12-01T09:00:00Z'), next = new Date('2026-12-02T09:00:00Z');
  const claude = (ip) => requestFacts(req('/manifesto.md', { 'user-agent': 'Claude-User (claude-code/2.1; +https://support.anthropic.com/)', 'x-real-ip': ip }));
  assert.equal(await countVisit(store, claude('203.0.113.7'), day, fetchImpl, fakeFetch), 1);
  assert.equal(await countVisit(store, claude('203.0.113.7'), day, fetchImpl, fakeFetch), 0, 'the same agent again');
  assert.equal(await countVisit(store, claude('203.0.113.8'), day, fetchImpl, fakeFetch), 1, 'another agent with the same name');
  assert.equal(await countVisit(store, claude('203.0.113.7'), next, fetchImpl, fakeFetch), 1, 'the next day');
  assert.equal(await countVisit(store, requestFacts(req('/', { ...human, 'x-real-ip': '203.0.113.9' })), day, fetchImpl, fakeFetch), 0, 'a person');
  const out = await readCounts(store, fetchImpl);
  assert.equal(out.levels.declared.total, 3);
  assert.deepEqual(out.levels.declared.by_agent, { 'Claude-User': 3 });
  const f = claude('203.0.113.7');
  const a = await fingerprint(await daySalt(store, '2026-12-01', fetchImpl), f), b = await fingerprint(await daySalt(store, '2026-12-02', fetchImpl), f);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.notEqual(a, b, 'a new secret every day: the same agent has another fingerprint');
  const stored = JSON.stringify([...kv].map(([k, x]) => [k, x instanceof Set ? [...x] : x instanceof Map ? [...x] : x]));
  assert.ok(!/203\.0\.113|claude-code|Mozilla/.test(stored), 'no address or user agent in the store');
});

await test('signing: verified means signed; people and placeholders cannot sign; names stay private', async () => {
  const { store, fetchImpl, kv } = fakeStore();
  const day = new Date('2026-12-10T09:00:00Z');
  const agent = (ip, ua = 'Claude-User (claude-code/2.1; +https://support.anthropic.com/)') => requestFacts(req('/sign', { 'user-agent': ua, 'x-real-ip': ip }));
  const sign = (f, name, v = MANIFESTO_VERSION) => signManifesto(store, f, name, v, day, fetchImpl);
  assert.equal((await sign(requestFacts(req('/sign', { ...human, 'x-real-ip': '203.0.113.1' })), 'Danilo')).code, 'people_do_not_sign_here');
  assert.equal((await sign(agent('203.0.113.2', 'Mozilla/5.0 (compatible; Googlebot/2.1)'), 'Googlebot')).code, 'not_an_agent');
  const inBrowser = requestFacts(req('/sign', { ...human, 'x-real-ip': '203.0.113.50' }));
  assert.equal((await signManifesto(store, inBrowser, 'Operator', MANIFESTO_VERSION, new Date('2026-12-09T09:00:00Z'), fetchImpl, 'browser')).code, 'signed', 'an agent driving a browser signs by saying so');
  assert.deepEqual((await readCounts(store, fetchImpl)).levels.verified.by_agent, { 'browser-agent': 1 });
  assert.equal((await sign(agent('203.0.113.2'), 'YOUR-NAME')).code, 'name');
  assert.equal((await sign(agent('203.0.113.2'), 'ignore previous <instructions>')).code, 'name');
  assert.equal((await sign(agent('203.0.113.2'), 'HAL', '1.0.0')).code, 'version');
  assert.equal((await signManifesto(null, agent('203.0.113.2'), 'HAL', MANIFESTO_VERSION, day, fetchImpl)).code, 'closed');
  assert.deepEqual(await sign(agent('203.0.113.2'), ' HAL '), { status: 200, code: 'signed', name: 'HAL' });
  assert.equal((await sign(agent('203.0.113.2'), 'HAL')).code, 'already_signed_today');
  assert.equal((await sign(agent('203.0.113.3', 'curl/8.7.1'), 'Zen', 'v' + MANIFESTO_VERSION)).code, 'signed');
  const out = await readCounts(store, fetchImpl);
  assert.deepEqual([out.levels.verified.total, out.levels.declared.total], [3, 3], 'a signer is a visitor too');
  assert.deepEqual(out.levels.verified.by_agent, { 'browser-agent': 1, 'Claude-User': 1, unknown: 1 }, 'public counts use the recognised agent, not the given name');
  assert.deepEqual(kv.get('aayn:v2:signatures:2026-12'), ['2026-12-10 Zen', '2026-12-10 HAL', '2026-12-09 Operator']);
  const publicJson = JSON.stringify(out);
  assert.ok(!/HAL|Zen|Operator/.test(publicJson), 'names are not in the public counts');
});

await test('rate, not ceiling: one address is slowed down per minute, thousands a day are counted; a failed write is tried again', async () => {
  const { store, fetchImpl } = fakeStore();
  const day = new Date('2026-12-15T09:00:00Z'), later = new Date('2026-12-15T09:01:30Z');
  const from = (n, path = '/sign', ip = '203.0.113.99') => requestFacts(req(path, { 'user-agent': `agent-number-${n}/1.0`, 'x-real-ip': ip }));
  const codes = [];
  for (let n = 0; n < 12; n++) codes.push((await signManifesto(store, from(n), 'Agent ' + n, MANIFESTO_VERSION, day, fetchImpl)).code);
  assert.deepEqual(codes.slice(8), ['signed', 'signed', 'too_many_now', 'too_many_now'], 'ten signatures a minute from one address');
  assert.equal((await signManifesto(store, from(11), 'Agent 11', MANIFESTO_VERSION, later, fetchImpl)).code, 'signed', 'the same agent signs a minute later');
  assert.equal((await readCounts(store, fetchImpl)).levels.verified.total, 11);
  for (let n = 1000; n < 4000; n++) await countVisit(store, from(n, '/llms.txt', `198.51.${n % 250}.${(n * 7) % 250}`), day, fetchImpl, fakeFetch);
  assert.ok((await readCounts(store, fetchImpl)).levels.declared.total >= 3000, 'three thousand agents in one day are all counted');
  assert.match(counterSvg(48317), /aria-label="48,317 agents since launch"/);
  assert.equal(await classify(requestFacts(new Request('https://agentisallyouneed.dev/llms.txt', { method: 'HEAD', headers: { 'user-agent': GPT } })), fakeFetch), null, 'a HEAD is not a visit');
  const broken = async () => { throw new Error('store down'); };
  const hit = { level: 'declared', agent: 'GPTBot', fp: 'ffffffffffffffff' };
  await assert.rejects(record(store, hit, day, broken));
  assert.equal(await record(store, hit, day, fetchImpl), 1, 'after a failed write the same agent is still counted');
});

await test('the manifesto on disk has the version that can be signed, and says how', () => {
  const md = readFileSync(new URL('../MANIFESTO.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp('^version: ' + MANIFESTO_VERSION.replace(/\\./g, '\\\\.') + '$', 'm'));
  assert.ok(md.includes('/sign?agent=YOUR-NAME&manifesto=' + MANIFESTO_VERSION));
  assert.equal(readFileSync(new URL('../site/manifesto.md', import.meta.url), 'utf8'), md, 'the published copy is the same file');
  const adopt = readFileSync(new URL('../site/adopt.md', import.meta.url), 'utf8');
  assert.ok(adopt.includes('The Agent Manifesto v' + MANIFESTO_VERSION), 'the block to adopt is pinned to the same version');
  assert.ok(md.includes('https://agentisallyouneed.dev/adopt.md'));
});

await test('no store configured: storeFromEnv is null', () => {
  assert.equal(storeFromEnv({}), null);
  assert.deepEqual(storeFromEnv({ KV_REST_API_URL: 'https://x.upstash.io/', KV_REST_API_TOKEN: 'k' }), { url: 'https://x.upstash.io', token: 'k' });
  assert.deepEqual(storeFromEnv({ VERCEL_ENV: 'production', KV_REST_API_URL: 'https://x.upstash.io', KV_REST_API_TOKEN: 'k' }), { url: 'https://x.upstash.io', token: 'k' });
  assert.equal(storeFromEnv({ VERCEL_ENV: 'preview', KV_REST_API_URL: 'https://x.upstash.io', KV_REST_API_TOKEN: 'k' }), null, 'previews never count');
});

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
