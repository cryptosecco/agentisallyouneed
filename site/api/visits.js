import { COUNTER_VERSION, ENTRY_PATHS, LEVELS, OPERATOR_LISTS, readCounts, storeFromEnv } from '../lib/visits.js';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=60',
  'access-control-allow-origin': '*',
  'x-content-type-options': 'nosniff',
};

const empty = () => Object.fromEntries(LEVELS.map((l) => [l, { total: 0, by_day: {}, by_agent: {} }]));

export async function GET() {
  const store = storeFromEnv();
  let status = 'not_counting_yet', since = null, levels = empty();
  if (store) {
    try {
      ({ since, levels } = await readCounts(store));
      status = 'counting';
    } catch {
      status = 'store_unavailable';
    }
  }
  const body = {
    counter_version: COUNTER_VERSION,
    status,
    since,
    unit: 'agents per day: every distinct agent is counted once per day (UTC) and per level. Agents are told apart by a one-way fingerprint of address and user agent made with a secret that changes every day and is then deleted; "probable" is counted once per day as a whole',
    agents: {
      total: levels.declared.total,
      is: 'every agent that visited (declared), once per day; shown on the landing board. Verified and confirmed agents are among them',
    },
    levels,
    rules: {
      counted_paths: ENTRY_PATHS,
      verified: 'the agent signed the manifesto at https://agentisallyouneed.dev/sign: voluntary, with the consent of the person it works for. A subset of declared',
      confirmed: 'declared agents whose address is inside the ranges their operator publishes. A subset of declared',
      confirmed_against: Object.values(OPERATOR_LISTS),
      declared: 'the user agent names a known agent, or an unnamed HTTP client asks for a file written for agents (not the home page), without verification',
      probable: 'a browser user agent with signs of automation; an estimate',
      fingerprint: 'agents only, never people: HMAC-SHA256 with a daily secret, 64 bits kept, deleted after three days; the address and the user agent are never stored',
      not_counted: 'people (a real browser with its usual headers), unnamed HTTP clients on the home page, search engines, link previews, uptime checks, Vercel',
      probable_is_never_added: true,
    },
    privacy: 'https://agentisallyouneed.dev/privacy.md',
    license: 'CC0-1.0',
  };
  return new Response(JSON.stringify(body, null, 2) + '\n', { status: 200, headers: HEADERS });
}

export const HEAD = GET;
