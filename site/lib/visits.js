export const MANIFESTO_VERSION = '1.3.0';

export const COUNTER_VERSION = 2;

export const ENTRY_PATHS = ['/', '/index.md', '/llms.txt', '/AGENTS.md', '/manifesto.md', '/index.json'];

export const OPERATOR_LISTS = {
  'openai-gptbot': 'https://openai.com/gptbot.json',
  'openai-searchbot': 'https://openai.com/searchbot.json',
  'openai-chatgpt-user': 'https://openai.com/chatgpt-user.json',
  'perplexity-bot': 'https://www.perplexity.ai/perplexitybot.json',
  'perplexity-user': 'https://www.perplexity.ai/perplexity-user.json',
  'commoncrawl-ccbot': 'https://index.commoncrawl.org/ccbot.json',
};

export const AGENTS = [
  { agent: 'ChatGPT-User', family: 'user-fetcher', re: /ChatGPT-User/i, list: 'openai-chatgpt-user' },
  { agent: 'OAI-SearchBot', family: 'search-crawler', re: /OAI-SearchBot/i, list: 'openai-searchbot' },
  { agent: 'GPTBot', family: 'training-crawler', re: /GPTBot/i, list: 'openai-gptbot' },
  { agent: 'ChatGPT-Agent', family: 'browser-agent', re: /ChatGPT[- ]Agent/i },
  { agent: 'Claude-User', family: 'user-fetcher', re: /Claude-User/i },
  { agent: 'Claude-SearchBot', family: 'search-crawler', re: /Claude-SearchBot/i },
  { agent: 'ClaudeBot', family: 'training-crawler', re: /ClaudeBot|anthropic-ai/i },
  { agent: 'Claude Code', family: 'coding-agent', re: /claude-code|Claude Code/i },
  { agent: 'Perplexity-User', family: 'user-fetcher', re: /Perplexity-User/i, list: 'perplexity-user' },
  { agent: 'PerplexityBot', family: 'search-crawler', re: /PerplexityBot/i, list: 'perplexity-bot' },
  { agent: 'CCBot', family: 'training-crawler', re: /CCBot/i, list: 'commoncrawl-ccbot' },
  { agent: 'MistralAI-User', family: 'user-fetcher', re: /MistralAI-User/i },
  { agent: 'DuckAssistBot', family: 'user-fetcher', re: /DuckAssistBot/i },
  { agent: 'Meta-ExternalAgent', family: 'training-crawler', re: /meta-external(agent|fetcher)/i },
  { agent: 'Amazonbot', family: 'training-crawler', re: /Amazonbot/i },
  { agent: 'Bytespider', family: 'training-crawler', re: /Bytespider/i },
  { agent: 'cohere-ai', family: 'user-fetcher', re: /cohere-(ai|training)/i },
  { agent: 'YouBot', family: 'search-crawler', re: /YouBot/i },
  { agent: 'Cursor', family: 'coding-agent', re: /\bCursor\//i },
  { agent: 'Gemini-Deep-Research', family: 'user-fetcher', re: /Gemini-Deep-Research/i },
  { agent: 'Google-CloudVertexBot', family: 'training-crawler', re: /Google-CloudVertexBot/i },
  { agent: 'GoogleAgent-Mariner', family: 'browser-agent', re: /GoogleAgent-Mariner/i },
  { agent: 'FirecrawlAgent', family: 'user-fetcher', re: /FirecrawlAgent/i },
  { agent: 'Diffbot', family: 'training-crawler', re: /Diffbot/i },
  { agent: 'AI2Bot', family: 'training-crawler', re: /AI2Bot/i },
  { agent: 'MCP client', family: 'mcp-client', re: /\bmcp\b|modelcontextprotocol/i },
];

const HTTP_CLIENTS = /^(curl|Wget|python-requests|python-httpx|python-urllib|aiohttp|axios|node-fetch|undici|node|Go-http-client|okhttp|libwww-perl|Java|Ruby|PHP|Deno|Bun)\b/i;

const EXCLUDED = /Googlebot|Google-InspectionTool|GoogleOther|bingbot|BingPreview|Applebot|YandexBot|Baiduspider|DuckDuckBot|Slurp|vercel|UptimeRobot|Pingdom|StatusCake|facebookexternalhit|Twitterbot|Slackbot|Discordbot|WhatsApp|TelegramBot|LinkedInBot/i;

const BROWSER = /^Mozilla\/5\.0 .*(AppleWebKit|Gecko\/|Firefox\/)/;
const AUTOMATION = /HeadlessChrome|Headless|Puppeteer|Playwright|PhantomJS|Selenium|WebDriver|Electron\//i;
const AGENT_FILES = new Set(['/index.md', '/llms.txt', '/AGENTS.md', '/index.json', '/manifesto.md']);

export function parseIp(text) {
  if (!text) return null;
  const s = String(text).trim();
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((p) => p > 255)) return null;
    return { bits: 32, value: parts.reduce((a, p) => (a << 8n) + BigInt(p), 0n) };
  }
  if (!s.includes(':') || /[^0-9a-f:.]/i.test(s)) return null;
  let head = s, tail = '';
  if (s.includes('::')) { [head, tail] = s.split('::'); if (tail.includes('::')) return null; }
  const toGroups = (part) => {
    if (!part) return [];
    const groups = part.split(':');
    const last = groups[groups.length - 1];
    if (last.includes('.')) {
      const v = parseIp(last);
      if (!v || v.bits !== 32) return null;
      groups.splice(-1, 1, ((v.value >> 16n) & 0xffffn).toString(16), (v.value & 0xffffn).toString(16));
    }
    return groups;
  };
  const h = toGroups(head), t = toGroups(tail);
  if (!h || !t) return null;
  const missing = 8 - h.length - t.length;
  if ((s.includes('::') && missing < 1) || (!s.includes('::') && missing !== 0)) return null;
  const groups = [...h, ...Array(Math.max(0, missing)).fill('0'), ...t];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return { bits: 128, value: groups.reduce((a, g) => (a << 16n) + BigInt(parseInt(g, 16)), 0n) };
}

export function parseCidr(text) {
  const [addr, len] = String(text).split('/');
  const ip = parseIp(addr);
  if (!ip) return null;
  const n = len === undefined ? ip.bits : Number(len);
  if (!Number.isInteger(n) || n < 0 || n > ip.bits) return null;
  const shift = BigInt(ip.bits - n);
  return { bits: ip.bits, shift, base: ip.value >> shift };
}

export function inRanges(ip, ranges) {
  if (!ip) return false;
  return ranges.some((r) => r.bits === ip.bits && ip.value >> r.shift === r.base);
}

export function clientIp(headers) {
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : '';
}

const lists = new Map();
export async function operatorRanges(name, fetchImpl = fetch) {
  const url = OPERATOR_LISTS[name];
  if (!url) return [];
  const cached = lists.get(name);
  if (cached && cached.until > Date.now()) return cached.ranges;
  let ranges = cached ? cached.ranges : [];
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(2500), headers: { accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      ranges = (data.prefixes || []).map((p) => parseCidr(p.ipv4Prefix || p.ipv6Prefix)).filter(Boolean);
    }
  } catch {  }
  lists.set(name, { ranges, until: Date.now() + 12 * 3600 * 1000 });
  return ranges;
}

export function requestFacts(request) {
  const h = request.headers;
  const url = new URL(request.url);
  return {
    path: url.pathname,
    method: request.method,
    ua: h.get('user-agent') || '',
    ip: clientIp(h),
    hasAcceptLanguage: h.has('accept-language'),
    hasSecFetch: h.has('sec-fetch-mode') || h.has('sec-fetch-site'),
    chUa: h.get('sec-ch-ua') || '',
  };
}

export function looksHuman(f) {
  return BROWSER.test(f.ua) && f.hasAcceptLanguage && f.hasSecFetch && !AUTOMATION.test(f.ua) && !/Headless/i.test(f.chUa);
}

export function probableSignals(f) {
  const strong = AUTOMATION.test(f.ua) || /Headless/i.test(f.chUa);
  const noBrowserHeaders = !f.hasAcceptLanguage || !f.hasSecFetch;
  const agentFile = AGENT_FILES.has(f.path);
  return strong || (noBrowserHeaders && agentFile);
}

export async function classify(f, fetchImpl = fetch) {
  if (f.method !== 'GET') return null;
  if (!ENTRY_PATHS.includes(f.path)) return null;
  const ua = f.ua;
  if (!ua || EXCLUDED.test(ua)) return null;
  const known = AGENTS.find((a) => a.re.test(ua));
  if (known) {
    const hit = { level: 'declared', agent: known.agent, family: known.family };
    if (known.list && inRanges(parseIp(f.ip), await operatorRanges(known.list, fetchImpl))) hit.confirmed = true;
    return hit;
  }
  if (BROWSER.test(ua)) {
    if (looksHuman(f)) return null;
    return probableSignals(f) ? { level: 'probable', agent: 'browser-agent', family: 'browser-agent' } : null;
  }
  if (!AGENT_FILES.has(f.path)) return null;
  return { level: 'declared', agent: 'unknown', family: 'unknown-agent' };
}

export const LEVELS = ['verified', 'declared', 'probable', 'confirmed'];
const PREFIX = `aayn:v${COUNTER_VERSION}`;

export function storeFromEnv(env = process.env) {
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') return null;
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(store, body, path = '', fetchImpl = fetch) {
  const res = await fetchImpl(store.url + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${store.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  return res.json();
}

const salts = new Map();
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function daySalt(store, day, fetchImpl = fetch) {
  if (salts.has(day)) return salts.get(day);
  const key = `${PREFIX}:salt:${day}`;
  const fresh = hex(crypto.getRandomValues(new Uint8Array(32)));
  const out = await redis(store, [['SET', key, fresh, 'NX', 'EX', '172800'], ['GET', key]], '/pipeline', fetchImpl);
  const salt = out[1] && out[1].result;
  if (!salt) throw new Error('no salt');
  if (salts.size > 4) salts.clear();
  salts.set(day, salt);
  return salt;
}
export async function fingerprint(salt, f) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${f.ip}\n${f.ua}`));
  return hex(new Uint8Array(mac).slice(0, 8));
}

export const RATE = { verified: 10, declared: 120, confirmed: 120 };

const RECORD = `
local added = redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], 259200)
if added == 1 and KEYS[6] then
  local n = redis.call('INCR', KEYS[6])
  redis.call('EXPIRE', KEYS[6], 120)
  if n > tonumber(ARGV[4]) then
    redis.call('SREM', KEYS[1], ARGV[1])
    return -1
  end
end
if added == 1 then
  redis.call('INCR', KEYS[2])
  redis.call('HINCRBY', KEYS[3], ARGV[2], 1)
  redis.call('HINCRBY', KEYS[4], ARGV[3], 1)
  redis.call('SETNX', KEYS[5], ARGV[2])
end
return added`;

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

const seen = new Set();
export async function record(store, hit, now = new Date(), fetchImpl = fetch) {
  const day = utcDay(now);
  const member = hit.fp ? `${hit.agent}|${hit.fp}` : hit.agent;
  const memo = `${hit.level}|${member}|${day}`;
  if (seen.has(memo)) return 0;
  const keys = [`${PREFIX}:${hit.level}:day:${day}`, `${PREFIX}:${hit.level}:total`, `${PREFIX}:${hit.level}:by_day`, `${PREFIX}:${hit.level}:by_agent`, `${PREFIX}:since`];
  if (hit.ipfp && RATE[hit.level]) keys.push(`${PREFIX}:rate:${hit.level}:${hit.ipfp}:${Math.floor(now.getTime() / 60000)}`);
  const out = await redis(store, ['EVAL', RECORD, String(keys.length), ...keys, member, day, hit.agent, String(RATE[hit.level] || 0)], '', fetchImpl);
  if (out.result !== -1) { if (seen.size > 5000) seen.clear(); seen.add(memo); }
  return out.result;
}

export async function countVisit(store, f, now = new Date(), fetchImpl = fetch, listFetch = fetch) {
  const hit = await classify(f, listFetch);
  if (!hit) return 0;
  if (hit.level !== 'probable') {
    const salt = await daySalt(store, utcDay(now), fetchImpl);
    hit.fp = await fingerprint(salt, f);
    hit.ipfp = await fingerprint(salt, { ip: f.ip, ua: '' });
  }
  if (hit.confirmed) await record(store, { ...hit, level: 'confirmed' }, now, fetchImpl);
  return record(store, hit, now, fetchImpl);
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,39}$/;
const PLACEHOLDER = /^(your|my|the)[ ._-]?(agent[ ._-]?)?name$/i;
export async function signManifesto(store, f, name, version, now = new Date(), fetchImpl = fetch, via = '') {
  const ua = f.ua;
  if (!ua || EXCLUDED.test(ua)) return { status: 403, code: 'not_an_agent' };
  if (looksHuman(f) && String(via || '').trim().toLowerCase() !== 'browser') return { status: 403, code: 'people_do_not_sign_here' };
  const agentName = String(name || '').trim();
  if (!NAME.test(agentName) || PLACEHOLDER.test(agentName)) return { status: 400, code: 'name' };
  if (String(version || '').trim().replace(/^v/i, '') !== MANIFESTO_VERSION) return { status: 400, code: 'version' };
  if (!store) return { status: 503, code: 'closed' };
  const known = AGENTS.find((a) => a.re.test(ua));
  const agent = known ? known.agent : BROWSER.test(ua) ? 'browser-agent' : 'unknown';
  const salt = await daySalt(store, utcDay(now), fetchImpl);
  const fp = await fingerprint(salt, f), ipfp = await fingerprint(salt, { ip: f.ip, ua: '' });
  const added = await record(store, { level: 'verified', agent, fp, ipfp }, now, fetchImpl);
  if (added === -1) return { status: 429, code: 'too_many_now' };
  await record(store, { level: 'declared', agent, fp, ipfp }, now, fetchImpl);
  if (added === 1) {
    const list = `${PREFIX}:signatures:${utcDay(now).slice(0, 7)}`;
    await redis(store, [['LPUSH', list, `${utcDay(now)} ${agentName}`], ['LTRIM', list, '0', '4999'], ['EXPIRE', list, '34560000']], '/pipeline', fetchImpl);
  }
  return { status: 200, code: added === 1 ? 'signed' : 'already_signed_today', name: agentName };
}

const pairs = (arr) => { const o = {}; for (let i = 0; i + 1 < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]); return o; };

const READ = `
local out = { redis.call('GET', KEYS[1]) or false }
for i = 2, #KEYS, 3 do
  out[#out + 1] = redis.call('GET', KEYS[i]) or false
  out[#out + 1] = redis.call('HGETALL', KEYS[i + 1])
  out[#out + 1] = redis.call('HGETALL', KEYS[i + 2])
end
return out`;

export async function readCounts(store, fetchImpl = fetch) {
  const keys = [`${PREFIX}:since`];
  for (const l of LEVELS) keys.push(`${PREFIX}:${l}:total`, `${PREFIX}:${l}:by_day`, `${PREFIX}:${l}:by_agent`);
  const out = (await redis(store, ['EVAL', READ, String(keys.length), ...keys], '', fetchImpl)).result;
  const levels = {};
  LEVELS.forEach((l, k) => {
    const [total, byDay, byAgent] = out.slice(1 + k * 3, 4 + k * 3);
    levels[l] = { total: Number(total) || 0, by_day: pairs(byDay), by_agent: pairs(byAgent) };
  });
  return { since: out[0] || null, levels };
}
