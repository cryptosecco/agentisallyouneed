import { VERSIONS, handleBody } from '../lib/mcp.js';
import { LIMIT, limiter } from '../lib/limit.js';

// The MCP server at /mcp. Not counted at /visits/count.json: the middleware does not run here.
// Any Origin is accepted: the server is public, read-only and holds no session or secret.
export const config = { runtime: 'edge' };

const MAX_BODY = 64 * 1024;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-max-age': '86400',
};
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex',
};
const allow = limiter();

const json = (status, body, extra = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const rpcError = (status, code, message, extra) => json(status, { jsonrpc: '2.0', id: null, error: { code, message } }, extra);

const HELP = `# MCP server: agentisallyouneed

Read-only, no sign-in. Streamable HTTP: send JSON-RPC with POST to https://agentisallyouneed.dev/mcp
Tools: search (passages of the public pages) and get_page (one page whole).
Card: https://agentisallyouneed.dev/.well-known/mcp/server-card.json
`;

export default async function handler(request) {
  const method = request.method;
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (method !== 'POST') {
    return new Response(method === 'HEAD' ? null : HELP, { status: 405, headers: { ...HEADERS, 'content-type': 'text/markdown; charset=utf-8', allow: 'POST, OPTIONS' } });
  }
  const wait = await allow(request);
  if (wait) return rpcError(429, -32000, `Too many requests: ${LIMIT} a minute from one client. Try again in ${wait} seconds.`, { 'retry-after': String(wait) });
  const version = request.headers.get('mcp-protocol-version');
  if (version && !VERSIONS.includes(version)) return rpcError(400, -32600, `Unsupported MCP-Protocol-Version: ${version.slice(0, 20)}. Supported: ${VERSIONS.join(', ')}`);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return rpcError(413, -32600, 'Request too large');
  const out = handleBody(raw);
  if (out === null) return new Response(null, { status: 202, headers: HEADERS });
  // A message that could not be read at all is a 400; everything else is a JSON-RPC answer.
  return json(!Array.isArray(out) && out.error && out.id === null ? 400 : 200, out);
}
