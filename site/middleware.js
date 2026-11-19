import { countVisit, requestFacts, storeFromEnv } from './lib/visits.js';

export const config = {
  matcher: ['/', '/index.md', '/llms.txt', '/AGENTS.md', '/manifesto.md', '/index.json'],
};

export default function middleware(request, context) {
  const store = storeFromEnv();
  if (!store || !context || typeof context.waitUntil !== 'function') return;
  const facts = requestFacts(request);
  context.waitUntil(
    countVisit(store, facts).catch(() => 0),
  );
}
