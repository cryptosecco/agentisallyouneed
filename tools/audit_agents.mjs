// What an agent sees on the site: node tools/audit_agents.mjs [base URL]
// Crawler user agents send HEAD only, which the visit counter never counts, so the
// audit does not add made-up GPTBot or ClaudeBot visits to the public numbers.
// The contents are read once, with a user agent that says what it is.

const BASE = (process.argv[2] || 'https://agentisallyouneed.dev').replace(/\/$/, '');
// For a protected preview: AUDIT_COOKIE='_vercel_jwt=...' (from a share link). Never committed.
const COOKIE = process.env.AUDIT_COOKIE || '';
const SELF = 'agentisallyouneed-audit/1.0 (the maintainer\'s own check; https://agentisallyouneed.dev/AGENTS.md)';
const CRAWLERS = {
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)',
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Google-Extended': 'Mozilla/5.0 (compatible; Google-Extended)',
};
const PATHS = ['/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/index.md', '/manifesto.md', '/AGENTS.md', '/index.json', '/.well-known/search?q=sign'];

const rows = [];
const say = (ok, what, detail = '') => rows.push(`${ok === null ? '·' : ok ? '✓' : '✗'} ${what}${detail ? ` · ${detail}` : ''}`);

async function hit(path, { ua = SELF, method = 'GET', accept, body, type } = {}) {
  const headers = { 'user-agent': ua };
  if (COOKIE) headers.cookie = COOKIE;
  if (accept) headers.accept = accept;
  if (type) headers['content-type'] = type;
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const ttfb = performance.now() - t0;
    const text = method === 'HEAD' ? '' : await res.text();
    return { status: res.status, type: res.headers.get('content-type') || '', headers: res.headers, text, ttfb: Math.round(ttfb), ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { status: 0, type: '', headers: new Headers(), text: '', ttfb: 0, ms: 0, error: e.message };
  }
}

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => (tag.match(new RegExp(`${name}="([^"]*)"`, 'i')) || [])[1];
const types = (node, out = new Set()) => {
  if (Array.isArray(node)) node.forEach((n) => types(n, out));
  else if (node && typeof node === 'object') {
    if (node['@type']) [].concat(node['@type']).forEach((t) => out.add(t));
    Object.values(node).forEach((v) => types(v, out));
  }
  return out;
};

console.log(`# What an agent sees: ${BASE}\n`);

// 1. Access for the crawlers named in the task, by HEAD.
for (const [name, ua] of Object.entries(CRAWLERS)) {
  const out = [];
  for (const p of PATHS) {
    const r = await hit(p, { ua, method: 'HEAD' });
    out.push(`${p} ${r.status}`);
  }
  const bad = out.filter((o) => !/ 200$/.test(o));
  say(bad.length === 0, `${name} can fetch the main paths`, bad.length ? bad.join(', ') : `${out.length} paths, all 200`);
}

// 2. robots.txt
const robots = await hit('/robots.txt');
if (robots.status === 200) {
  const groups = robots.text.split(/\n\s*\n/);
  for (const name of Object.keys(CRAWLERS)) {
    const g = groups.find((b) => new RegExp(`^User-agent:\\s*${name}\\s*$`, 'mi').test(b)) || groups.find((b) => /^User-agent:\s*\*\s*$/mi.test(b));
    const blocked = g && /^Disallow:\s*\/\s*$/mi.test(g);
    say(!!g && !blocked, `robots.txt lets ${name} in`, g ? (new RegExp(`User-agent:\\s*${name}`, 'i').test(g) ? 'named group' : 'through *') : 'no group');
  }
  say(/^Sitemap:\s*\S+/mi.test(robots.text), 'robots.txt names the sitemap');
} else say(false, 'robots.txt', `status ${robots.status}`);

// 3. sitemap: every URL answers
const sitemap = await hit('/sitemap.xml');
const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmods = (sitemap.text.match(/<lastmod>/g) || []).length;
let dead = [];
for (const loc of locs) {
  const path = loc.replace(/^https?:\/\/[^/]+/, '') || '/';
  const r = await hit(path, { method: 'HEAD' });
  if (r.status !== 200) dead.push(`${path} ${r.status}`);
}
say(sitemap.status === 200 && locs.length > 0 && dead.length === 0, 'sitemap.xml lists URLs that answer', `${locs.length} URLs, ${lastmods} with lastmod${dead.length ? `, failing: ${dead.join(', ')}` : ''}`);

// 4. The HTML page without JavaScript
const home = await hit('/', { accept: 'text/html' });
const head = (home.text.match(/<head>([\s\S]*?)<\/head>/i) || [])[1] || '';
const words = strip(home.text.replace(/<head>[\s\S]*?<\/head>/i, '')).split(' ').length;
say(home.status === 200, 'home page HTML', `${home.status}, ${home.text.length} bytes, ${words} words readable without JavaScript, TTFB ${home.ttfb} ms`);
say(home.text.includes('Law 1 · Do no harm'), 'the manifesto text is in the HTML, no JavaScript needed');
const tags = [...head.matchAll(/<(meta|link)\b[^>]*>/gi)].map((m) => m[0]);
const meta = (n) => tags.find((t) => /^<meta/i.test(t) && (attr(t, 'name') === n || attr(t, 'property') === n));
const links = (rel) => tags.filter((t) => /^<link/i.test(t) && (attr(t, 'rel') || '').split(/\s+/).includes(rel));
say(!!meta('description'), 'meta description');
say(links('canonical').length === 1, 'link rel=canonical', attr(links('canonical')[0] || '', 'href'));
say(links('alternate').some((t) => attr(t, 'hreflang')), 'hreflang', links('alternate').filter((t) => attr(t, 'hreflang')).map((t) => attr(t, 'hreflang')).join(', '));
const mdAlt = links('alternate').filter((t) => attr(t, 'type') === 'text/markdown').map((t) => attr(t, 'href'));
say(mdAlt.length > 0, 'link rel=alternate type=text/markdown', mdAlt.join(', '));
say(!!meta('og:title') && !!meta('og:image'), 'Open Graph');
const agentMeta = ['agent:instructions', 'agent:endpoint', 'agent:method', 'agent:documentation'].filter((n) => meta(n));
say(agentMeta.length === 4, 'search discovery meta tags (agent:*)', agentMeta.length ? `${agentMeta.length}/4: ${attr(meta('agent:endpoint') || '', 'content') || ''}` : 'none');
const blocks = [...home.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
let ld = [];
try { ld = blocks.map((b) => JSON.parse(b)); say(blocks.length > 0, 'JSON-LD parses', [...types(ld)].join(', ')); } catch (e) { say(false, 'JSON-LD parses', e.message); }
const all = JSON.stringify(ld);
say(/"SearchAction"/.test(all), 'WebSite has a SearchAction', (all.match(/"urlTemplate":\s*"([^"]+)"/) || [])[1] || '');
say(/"(Article|TechArticle)"/.test(all) && /"datePublished"/.test(all) && /"author"/.test(all), 'Article with author and dates');
say(/"Organization"/.test(all), 'Organization');

// 5. Markdown: content negotiation and the .md files
const neg = await hit('/', { accept: 'text/markdown' });
say(neg.status === 200 && neg.type.startsWith('text/markdown'), 'GET / with Accept: text/markdown gives Markdown', `${neg.status} ${neg.type}${(neg.headers.get('vary') || '').match(/accept/i) ? ', Vary: Accept' : ''}`);
const homeVary = (home.headers.get('vary') || '');
say(/accept/i.test(homeVary), 'the HTML answer says Vary: Accept', homeVary || 'no Vary');
for (const p of ['/index.md', '/manifesto.md', '/AGENTS.md', '/adopt.md', '/privacy.md']) {
  const r = await hit(p);
  say(r.status === 200 && r.type.startsWith('text/markdown'), `${p}`, `${r.status} ${r.type}, ${r.text.length} bytes, TTFB ${r.ttfb} ms`);
}

// 6. llms.txt and llms-full.txt
const llms = await hit('/llms.txt');
const llmsLinks = [...llms.text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
dead = [];
for (const u of llmsLinks) {
  const path = u.replace(/^https?:\/\/[^/]+/, '') || '/';
  if (!/^https?:\/\/agentisallyouneed\.dev/.test(u)) continue;
  const r = await hit(path, { method: 'HEAD' });
  if (r.status !== 200) dead.push(`${path} ${r.status}`);
}
say(llms.status === 200 && /^# /.test(llms.text), 'llms.txt', `${llms.status}, ${llmsLinks.length} links${dead.length ? `, failing: ${dead.join(', ')}` : ', all answer'}`);
say(/well-known\/search/.test(llms.text), 'llms.txt points to the search endpoint');
const full = await hit('/llms-full.txt');
say(full.status === 200 && full.text.includes('Law 1 · Do no harm'), 'llms-full.txt', `${full.status}, ${full.text.length} bytes`);

// 7. Search for agents
const s = await hit('/.well-known/search?q=' + encodeURIComponent('how do I sign the manifesto'));
say(s.status === 200 && s.type.startsWith('text/markdown') && /^# Search results for:/m.test(s.text), 'GET /.well-known/search?q=', `${s.status} ${s.type || '-'}, ${s.text.length} bytes, TTFB ${s.ttfb} ms`);
if (s.status === 200) say(/https:\/\/agentisallyouneed\.dev\/\S+/.test(s.text), 'results carry a URL', (s.text.match(/^## .+$/m) || [''])[0]);
const empty = await hit('/.well-known/search');
say(empty.status === 400, 'search without q is a 400 with help', `${empty.status}`);

// 8. MCP: the card and the server
const card = await hit('/.well-known/mcp/server-card.json');
let cardJson = null;
try { cardJson = JSON.parse(card.text); } catch {}
say(card.status === 200 && !!cardJson && /json/.test(card.type), 'MCP server card at /.well-known/mcp/server-card.json', cardJson ? `${cardJson.transport?.type} ${cardJson.transport?.endpoint}` : `${card.status}`);
const rpc = (body) => hit('/mcp', { method: 'POST', body: JSON.stringify(body), type: 'application/json', accept: 'application/json, text/event-stream' });
const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'audit', version: '1' } } });
let initJson = null;
try { initJson = JSON.parse(init.text); } catch {}
say(init.status === 200 && !!initJson?.result?.protocolVersion, 'MCP initialize', `${init.status}${initJson?.result ? `, ${initJson.result.protocolVersion}, ${initJson.result.serverInfo?.name}` : ''}, TTFB ${init.ttfb} ms`);
const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
let names = [];
try { names = JSON.parse(list.text).result.tools.map((t) => t.name); } catch {}
say(names.includes('search') && names.includes('get_page'), 'MCP tools/list', names.join(', ') || `${list.status}`);
const call = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search', arguments: { query: 'how do I sign' } } });
let callText = '';
try { callText = JSON.parse(call.text).result.content[0].text; } catch {}
say(/^# Search results for:/.test(callText), 'MCP tools/call search', (callText.match(/^## .+$/m) || [`${call.status}`])[0]);

// 9. Answer times
const times = [];
for (const p of ['/', '/llms.txt', '/manifesto.md', '/robots.txt']) times.push(`${p} ${(await hit(p)).ttfb} ms`);
say(null, 'TTFB', times.join(', '));

console.log(rows.join('\n'));
const failed = rows.filter((r) => r.startsWith('✗')).length;
const passed = rows.filter((r) => r.startsWith("✓")).length;
console.log(`\n${passed} checks pass, ${failed} fail.`);
