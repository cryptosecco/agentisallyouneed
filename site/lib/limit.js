// How often one client may call the search or the MCP server: LIMIT calls a minute.
// Best effort and free: it is counted inside each running instance, not across regions.
// The client is known by a one-way code of its address, made with a random secret that
// lives only in memory. Nothing is written anywhere, and every code is dropped each minute.
import { clientIp } from './visits.js';

export const LIMIT = 30;
export const WINDOW_MS = 60_000;
const MAX_CLIENTS = 10_000;

export function limiter({ limit = LIMIT, windowMs = WINDOW_MS } = {}) {
  const secret = crypto.getRandomValues(new Uint8Array(16));
  let start = 0, hits = new Map();
  const code = async (ip) => {
    const data = new Uint8Array([...secret, ...new TextEncoder().encode(ip)]);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  // null when the call may go ahead, otherwise the seconds to wait.
  return async function check(request, now = Date.now()) {
    if (now - start >= windowMs || hits.size >= MAX_CLIENTS) { hits = new Map(); start = now; }
    const key = await code(clientIp(request.headers) || 'unknown');
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    return n <= limit ? null : Math.max(1, Math.ceil((start + windowMs - now) / 1000));
  };
}
