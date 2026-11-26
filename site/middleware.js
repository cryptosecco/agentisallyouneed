import { countVisit, requestFacts, storeFromEnv } from './lib/visits.js';
import { PAGES } from './lib/pages.js';
import { SEARCH } from './lib/search.js';

export const config = {
  matcher: ['/', '/index.md', '/llms.txt', '/llms-full.txt', '/AGENTS.md', '/manifesto.md', '/index.json'],
};

// The weight the Accept header gives a type: its q, 0 when nothing matches. A range that
// names the type exactly wins a tie over text/* and */*.
function quality(accept, type) {
  let best = 0;
  for (const part of accept.split(',')) {
    const [range, ...params] = part.trim().split(';').map((s) => s.trim());
    if (range !== type && range !== 'text/*' && range !== '*/*') continue;
    const q = params.find((p) => p.startsWith('q='));
    const value = q ? Math.max(0, Math.min(1, Number(q.slice(2)) || 0)) : 1;
    if (value === 0 && range === type) return 0;
    best = Math.max(best, value + (range === type ? 0.0001 : 0));
  }
  return best;
}

// Markdown only when it is asked for by name and liked at least as much as HTML.
export function prefersMarkdown(accept) {
  const a = String(accept || '').toLowerCase();
  if (!a.includes('text/markdown')) return false;
  const md = quality(a, 'text/markdown');
  return md > 0 && md >= quality(a, 'text/html');
}

const INDEX = PAGES.find((p) => p.url.endsWith('/index.md')).text;
const FRONT = `---
title: "Agent Is All You Need"
agent:
  instructions: ${JSON.stringify(SEARCH.instructions)}
  endpoint: ${JSON.stringify(SEARCH.endpoint)}
  method: ${JSON.stringify(SEARCH.method)}
  documentation: ${JSON.stringify(SEARCH.documentation)}
---

`;
export const HOME_MARKDOWN = FRONT + INDEX;

function markdownHome(method) {
  return new Response(method === 'HEAD' ? null : HOME_MARKDOWN, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'vary': 'Accept',
      'cache-control': 'public, max-age=300, must-revalidate',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
      'content-signal': 'search=yes, ai-input=yes, ai-train=yes',
      'tdm-reservation': '0',
      'link': '</llms.txt>; rel="describedby"; type="text/markdown", </llms-full.txt>; rel="describedby"; type="text/plain", </manifesto.md>; rel="alternate"; type="text/markdown"',
    },
  });
}

export default function middleware(request, context) {
  const store = storeFromEnv();
  if (store && context && typeof context.waitUntil === 'function') {
    context.waitUntil(countVisit(store, requestFacts(request)).catch(() => 0));
  }
  const { pathname } = new URL(request.url);
  if (pathname === '/' && (request.method === 'GET' || request.method === 'HEAD') && prefersMarkdown(request.headers.get('accept'))) {
    return markdownHome(request.method);
  }
}
