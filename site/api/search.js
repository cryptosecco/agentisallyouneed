import { HELP, MAX_QUERY, renderResults, search } from '../lib/search.js';
import { LIMIT, limiter } from '../lib/limit.js';

// Edge, with one default export: the Node runtime on Vercel answers only seven methods,
// and the QUERY method (RFC 10008) is not one of them.
export const config = { runtime: 'edge' };

const ALLOW = 'GET, HEAD, QUERY, OPTIONS';
const HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'cache-control': 'public, max-age=300, s-maxage=86400',
  'access-control-allow-origin': '*',
  'accept-query': 'text/plain, application/json',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex',
  'content-signal': 'search=yes, ai-input=yes, ai-train=yes',
  'link': '</llms.txt>; rel="describedby"; type="text/markdown", </llms-full.txt>; rel="describedby"; type="text/plain"',
};

const allow = limiter();

function tooMany(seconds, headers = HEADERS) {
  return new Response(`# Too many requests\n\nThis address allows ${LIMIT} requests a minute from one client. Try again in ${seconds} seconds.\n\nThe whole site in one file: https://agentisallyouneed.dev/llms-full.txt\n`, {
    status: 429,
    headers: { ...headers, 'retry-after': String(seconds), 'cache-control': 'no-store' },
  });
}

async function queryOf(request) {
  // A + in the address is a space; some proxies pass it on as %2B.
  if (request.method !== 'QUERY') return (new URL(request.url).searchParams.get('q') || '').replace(/\+/g, ' ');
  const text = (await request.text()).slice(0, 4 * MAX_QUERY);
  if (/json/i.test(request.headers.get('content-type') || '') || text.trim().startsWith('{')) {
    try { const body = JSON.parse(text); return typeof body.q === 'string' ? body.q : ''; } catch { return ''; }
  }
  return text;
}

export default async function handler(request) {
  const method = request.method;
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: ALLOW, 'access-control-allow-origin': '*', 'access-control-allow-methods': ALLOW, 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
  }
  if (!['GET', 'HEAD', 'QUERY'].includes(method)) {
    return new Response(HELP, { status: 405, headers: { ...HEADERS, allow: ALLOW, 'cache-control': 'no-store' } });
  }
  const wait = await allow(request);
  if (wait) return tooMany(wait);
  const q = (await queryOf(request)).trim().slice(0, MAX_QUERY);
  const status = q ? 200 : 400;
  const body = q ? renderResults(q, search(q)) : HELP;
  return new Response(method === 'HEAD' ? null : body, { status, headers: status === 200 ? HEADERS : { ...HEADERS, 'cache-control': 'public, max-age=300' } });
}
