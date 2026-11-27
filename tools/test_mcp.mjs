import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../site/api/mcp.js';
import { ENDPOINT, INSTRUCTIONS, PAGE_NAMES, SERVER, TOOLS, VERSIONS, answer } from '../site/lib/mcp.js';
import { PAGES } from '../site/lib/pages.js';
import { ENTRY_PATHS } from '../site/lib/visits.js';
import { config as middlewareConfig } from '../site/middleware.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '\n     ', e.message); }
}
const site = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
let ip = 0;
const post = (body, headers = {}) => handler(new Request('https://agentisallyouneed.dev/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-real-ip': `203.0.113.${++ip % 250}`, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));
const rpc = async (method, params, id = 1) => (await (await post({ jsonrpc: '2.0', id, method, params })).json());

await test('initialize answers with the version asked for, or the newest', async () => {
  const r = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(r.result.protocolVersion, '2025-06-18');
  assert.deepEqual(r.result.capabilities, { tools: { listChanged: false } });
  assert.equal(r.result.serverInfo.name, 'agentisallyouneed');
  const n = await rpc('initialize', { protocolVersion: '1999-01-01' });
  assert.equal(n.result.protocolVersion, VERSIONS[0]);
});

await test('notifications get 202 and no body; ping gets {}', async () => {
  const r = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(r.status, 202);
  assert.equal(await r.text(), '');
  assert.deepEqual((await rpc('ping')).result, {});
});

await test('two read-only tools', async () => {
  const r = await rpc('tools/list');
  assert.deepEqual(r.result.tools.map((t) => t.name), ['search', 'get_page']);
  for (const t of r.result.tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
  }
  assert.deepEqual(TOOLS[1].inputSchema.properties.page.enum, ['manifesto.md', 'adopt.md', 'AGENTS.md', 'index.md', 'privacy.md', 'sign']);
});

await test('search gives the same passages as /.well-known/search', async () => {
  const r = await rpc('tools/call', { name: 'search', arguments: { query: 'what do humans promise' } });
  assert.equal(r.result.isError, false);
  assert.match(r.result.content[0].text, /^# Search results for: "what do humans promise"/);
  assert.match(r.result.content[0].text, /^## Part two · What humans promise/m);
  const empty = await rpc('tools/call', { name: 'search', arguments: {} });
  assert.equal(empty.result.isError, true);
});

await test('get_page returns the six pages whole, and nothing else', async () => {
  for (const name of PAGE_NAMES) {
    const r = await rpc('tools/call', { name: 'get_page', arguments: { page: name } });
    const page = PAGES.find((p) => p.url.endsWith('/' + name));
    assert.equal(r.result.content[0].text, `URL: ${page.url}\n\n${page.text}`);
  }
  const byUrl = await rpc('tools/call', { name: 'get_page', arguments: { page: 'https://agentisallyouneed.dev/manifesto.md' } });
  assert.equal(byUrl.result.isError, false);
  for (const bad of ['../.env', 'lib/visits.js', 'https://example.com/manifesto.md', 'api/sign.js', '']) {
    const r = await rpc('tools/call', { name: 'get_page', arguments: { page: bad } });
    assert.equal(r.result.isError, true, bad);
  }
});

await test('errors: unknown tool, unknown method, bad JSON, bad version, other HTTP methods', async () => {
  assert.equal((await rpc('tools/call', { name: 'sign', arguments: {} })).error.code, -32602);
  assert.equal((await rpc('resources/list')).error.code, -32601);
  const bad = await post('{"jsonrpc":');
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, -32700);
  assert.equal(answer({ id: 1, method: 'ping' }).error.code, -32600);
  const v = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '1999-01-01' });
  assert.equal(v.status, 400);
  const g = await handler(new Request('https://agentisallyouneed.dev/mcp'));
  assert.equal(g.status, 405);
  assert.equal(g.headers.get('allow'), 'POST, OPTIONS');
  assert.equal((await handler(new Request('https://agentisallyouneed.dev/mcp', { method: 'OPTIONS' }))).status, 204);
  const batch = await (await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }])).json();
  assert.equal(batch.length, 2);
});

await test('the same limit as the search, per client', async () => {
  let last;
  for (let i = 0; i < 35; i++) last = await post({ jsonrpc: '2.0', id: i, method: 'ping' }, { 'x-real-ip': '198.51.100.99' });
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  assert.equal((await last.json()).error.code, -32000);
});

await test('not counted: the middleware does not run on /mcp', () => {
  assert.ok(!middlewareConfig.matcher.includes('/mcp'));
  assert.ok(!ENTRY_PATHS.includes('/mcp'));
});

await test('the card, llms.txt, AGENTS.md and index.json point to the server', () => {
  const card = JSON.parse(site('.well-known/mcp/server-card.json'));
  assert.equal(card.transport.endpoint, ENDPOINT);
  assert.equal(card.remotes[0].url, ENDPOINT);
  assert.equal(card.protocolVersion, VERSIONS[0]);
  assert.deepEqual(card.serverInfo, { name: SERVER.name, title: SERVER.title, version: SERVER.version });
  assert.equal(card.instructions, INSTRUCTIONS);
  assert.deepEqual(card.tools, TOOLS, 'the card lists the tools of lib/mcp.js');
  assert.equal(card.authentication.required, false);
  for (const name of ['llms.txt', 'AGENTS.md']) {
    assert.ok(site(name).includes(ENDPOINT), name);
    assert.ok(site(name).includes('/.well-known/mcp/server-card.json'), name);
  }
  assert.equal(JSON.parse(site('index.json')).mcp.endpoint, ENDPOINT);
  const vercel = JSON.parse(site('vercel.json'));
  const sources = vercel.rewrites.map((r) => r.source);
  assert.ok(sources.indexOf('/mcp') > -1 && sources.indexOf('/mcp') < sources.indexOf('/(.*)'));
});

await test('the registry entry and the proof of the domain', () => {
  const entry = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
  assert.equal(entry.name, 'dev.agentisallyouneed/manifesto');
  assert.ok(entry.description.length <= 100);
  assert.deepEqual(entry.remotes, [{ type: 'streamable-http', url: ENDPOINT }]);
  for (const icon of entry.icons) {
    assert.match(icon.src, /^https:\/\/agentisallyouneed\.dev\/[^/]+$/);
    assert.ok(readFileSync(new URL('../site/' + icon.src.split('/').pop(), import.meta.url)).length > 0, 'the icon is a file of the site: ' + icon.src);
  }
  assert.ok(!('repository' in entry), 'the repository is not public');
  assert.ok(!/@|token|secret|key/i.test(JSON.stringify(entry)), 'no address, token or key in the entry');
  assert.match(site('.well-known/mcp-registry-auth'), /^v=MCPv1; k=ed25519; p=[A-Za-z0-9+/]{43}=\n$/);
});

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
