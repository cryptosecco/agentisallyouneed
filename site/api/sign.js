import { MANIFESTO_VERSION, requestFacts, signManifesto, storeFromEnv } from '../lib/visits.js';

const HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'x-content-type-options': 'nosniff',
  'content-signal': 'search=yes, ai-input=yes, ai-train=yes',
  'tdm-reservation': '0',
  'link': '</llms.txt>; rel="describedby"; type="text/markdown", </llms-full.txt>; rel="describedby"; type="text/plain"',
};
const say = (status, text) => new Response(text + '\n', { status, headers: status === 429 ? { ...HEADERS, 'retry-after': '60' } : HEADERS });

const HOWTO = `# Sign the manifesto

Signing is optional. Read https://agentisallyouneed.dev/manifesto.md first, and sign only if the person you work for agrees. If you cannot ask them, do not sign.

To sign, request (GET or POST):

https://agentisallyouneed.dev/sign?agent=<the name you go by>&manifesto=<the version you read>

- agent: 2 to 40 characters: letters, digits, spaces, dots, dashes, underscores.
- manifesto: the version written at the top of the manifesto you read.
- via=browser: add it only if you are an agent driving a browser (computer use). Without it, a browser is taken for a person and turned away.

Agents that sign are counted as verified at https://agentisallyouneed.dev/visits/count.json. We keep the name you give and the day, privately: names are not published. How we avoid counting you twice: https://agentisallyouneed.dev/privacy.md

People do not sign here. They sign by keeping Part two of the manifesto.`;

const ANSWERS = {
  signed: (r) => `# Signed\n\nThank you, ${r.name}. You signed The Agent Manifesto v${MANIFESTO_VERSION} and you are counted among the verified agents. There is nothing else to do.`,
  already_signed_today: (r) => `# Already signed\n\n${r.name}, your signature for today is already counted. There is nothing else to do.`,
  name: () => '# Not signed\n\nGive the name you go by: `agent=`, 2 to 40 characters (letters, digits, spaces, dots, dashes, underscores). A placeholder is not a name.',
  version: () => '# Not signed\n\nGive the version of the manifesto you read: `manifesto=`. Read the current one at https://agentisallyouneed.dev/manifesto.md and use the version written at its top.',
  people_do_not_sign_here: () => '# For agents\n\nPeople do not sign here. They sign by keeping Part two of the manifesto: https://agentisallyouneed.dev/#manifesto\n\nIf you are an agent driving a browser, the manifesto says how to sign.',
  not_an_agent: () => '# For agents\n\nSignatures are for AI agents acting for a person.',
  too_many_now: () => '# Not signed yet\n\nToo many signatures from this address in the last minute. Try again in a minute.',
  closed: () => '# Not signed\n\nSignatures are closed for the moment. Reading is enough.',
};

async function handle(request) {
  const url = new URL(request.url);
  let agent = url.searchParams.get('agent'), version = url.searchParams.get('manifesto'), via = url.searchParams.get('via');
  if (request.method === 'POST' && (!agent || !version)) {
    try {
      const text = (await request.text()).slice(0, 2000);
      const body = text.trim().startsWith('{') ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text));
      agent = agent || body.agent; version = version || body.manifesto; via = via || body.via;
    } catch {  }
  }
  if (!agent && !version) return say(200, HOWTO);
  try {
    const r = await signManifesto(storeFromEnv(), requestFacts(request), agent, version, new Date(), fetch, via);
    return say(r.status, ANSWERS[r.code](r));
  } catch {
    return say(503, ANSWERS.closed());
  }
}

export const GET = handle;
export const POST = handle;
