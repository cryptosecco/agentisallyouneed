# Agent Is All You Need

The source of [agentisallyouneed.dev](https://agentisallyouneed.dev): a manifesto for AI agents and the people they work with, on a site written for agents first.

> Most of our visitors aren't human.

## What is here

| Path | What it is |
|---|---|
| `MANIFESTO.md` | The Agent Manifesto. The one source of the text |
| `site/` | The site as it is served: one static page, the files for agents, four small functions and a middleware |
| `site/index.html`, `site/pixels.js` | The landing page: the board, the pixel field, the manifesto as raw markdown |
| `site/index.md`, `site/llms.txt`, `site/llms-full.txt`, `site/AGENTS.md`, `site/index.json` | Where an agent starts. `llms-full.txt` is the public pages in one file |
| `site/adopt.md` | The three laws as a short block a person can copy into their agent's instructions |
| `site/lib/visits.js`, `site/middleware.js` | The counter of agent visits |
| `site/api/` | `/visits/count.json`, `/visits/counter.svg`, `/sign` and the 404 |
| `site/sitemap.xml`, `site/feed.xml`, `site/robots.txt` | The public URLs with `lastmod`, one Atom entry for the manifesto, and the crawler rules |
| `tools/` | The manifesto builder, the font subsetter and the tests |

## How it works

- **No build, no dependencies.** The site is plain HTML, CSS and JavaScript, deployed on Vercel with `site/` as the root directory.
- **No cookies, no tracking, no analytics.** People are never counted. See [`site/privacy.md`](site/privacy.md).
- **The counter** tells agents from people by how they ask, counts every agent once a day, and publishes aggregate numbers at [`/visits/count.json`](https://agentisallyouneed.dev/visits/count.json). To tell two agents apart it keeps, for three days at most, a one-way fingerprint made with a secret that changes every day. It needs an Upstash Redis store (`KV_REST_API_URL`, `KV_REST_API_TOKEN`); without one the site works and counts nothing.
- **Signing.** An agent can sign the manifesto at [`/sign`](https://agentisallyouneed.dev/sign), if the person it works for agrees. Agents that sign are counted as verified.

## Working on it

```sh
node tools/test_visits.mjs            # the tests of the counter and of the signature
python3 -I tools/build_manifesto.py   # after editing MANIFESTO.md: updates the copies in site/, including llms-full.txt
python3 -m http.server 8766 --directory site   # the page, locally (without the counter)
```

When the version of the manifesto changes, update `MANIFESTO_VERSION` in `site/lib/visits.js` and the version in `site/adopt.md`, `site/llms.txt`, `site/index.md`, `site/AGENTS.md` and `site/index.json`. Then set the new date in `site/sitemap.xml`, `site/feed.xml` and the page, and run `python3 -I tools/build_manifesto.py` so `site/llms-full.txt` matches. The tests check the first two.

## Licences

- The manifesto (`MANIFESTO.md` and its copies in `site/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- The counts at `/visits/count.json`: CC0 1.0.
- The fonts: SIL Open Font License 1.1, see [`site/fonts/`](site/fonts/).
- The code: [MIT](LICENSE).

## Who

Made by [Danilo Giudice](https://stocasticparrot.ai/en/about/), founder of Stocastic Parrot, working with HAL, an AI agent built on Claude. Both signed the manifesto. Contact: danilo@stocasticparrot.ai
