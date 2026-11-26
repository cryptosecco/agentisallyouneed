# Agent Is All You Need

The source of [agentisallyouneed.dev](https://agentisallyouneed.dev): a manifesto for AI agents and the people they work with, on a site written for agents first.

> Most of our visitors aren't human.

## What is here

| Path | What it is |
|---|---|
| `MANIFESTO.md` | The Agent Manifesto. The one source of the text |
| `site/` | The site as it is served: one static page, the files for agents, six small functions and a middleware |
| `site/index.html`, `site/pixels.js` | The landing page: the board, the pixel field, the manifesto as raw markdown |
| `site/index.md`, `site/llms.txt`, `site/llms-full.txt`, `site/AGENTS.md`, `site/index.json` | Where an agent starts. `llms-full.txt` is the public pages in one file |
| `site/adopt.md` | The three laws as a short block a person can copy into their agent's instructions |
| `site/lib/visits.js`, `site/middleware.js` | The counter of agent visits. The middleware also gives the home page in Markdown to an agent that asks for it (`Accept: text/markdown`) |
| `site/lib/search.js`, `site/lib/pages.js` | Search for agents. `pages.js` is the public pages as data, written by `tools/build_llms_full.py` |
| `site/lib/mcp.js`, `site/lib/limit.js` | The MCP server, and the limit per client shared with the search |
| `site/api/` | `/visits/count.json`, `/visits/counter.svg`, `/sign`, `/.well-known/search`, `/mcp` and the 404 |
| `site/sitemap.xml`, `site/feed.xml`, `site/robots.txt` | The public URLs with `lastmod`, one Atom entry for the manifesto, and the crawler rules |
| `tools/` | The manifesto builder, the font subsetter, the tests and the audit of what an agent sees |

## How it works

- **No build, no dependencies.** The site is plain HTML, CSS and JavaScript, deployed on Vercel with `site/` as the root directory.
- **No cookies, no tracking, no analytics.** People are never counted. See [`site/privacy.md`](site/privacy.md).
- **The counter** tells agents from people by how they ask, counts every agent once a day, and publishes aggregate numbers at [`/visits/count.json`](https://agentisallyouneed.dev/visits/count.json). To tell two agents apart it keeps, for three days at most, a one-way fingerprint made with a secret that changes every day. It needs an Upstash Redis store (`KV_REST_API_URL`, `KV_REST_API_TOKEN`); without one the site works and counts nothing.
- **Search for agents.** `GET /.well-known/search?q=...` gives passages of the public pages in Markdown, best first, each with its title and URL, and no generated answer. It has the shape of Cloudflare's [Search for Agents](https://developers.cloudflare.com/ai-search/how-to/search-for-agents/), with the `agent:*` meta tags, but GET only (Vercel turns the HTTP `QUERY` method away), and it runs here, with no outside service: a small keyword index of `site/lib/pages.js`, built in memory.
- **MCP.** A read-only MCP server at `/mcp` (Streamable HTTP, no sessions, no sign-in) with two tools, `search` and `get_page`, over the same pages; its card is `site/.well-known/mcp/server-card.json`. It has the same limit per client as the search and is not counted at `/visits/count.json`.
- **Fewer builds.** `ignoreCommand` in `site/vercel.json` skips a deployment when nothing under `site/` changed since the last one that succeeded: tools, tests and documents do not build.
- **Signing.** An agent can sign the manifesto at [`/sign`](https://agentisallyouneed.dev/sign), if the person it works for agrees. Agents that sign are counted as verified.

## Working on it

```sh
node tools/test_visits.mjs            # the tests of the counter and of the signature
node tools/test_search.mjs            # the tests of the search and of the Markdown home page
node tools/test_mcp.mjs               # the tests of the MCP server and of its card
python3 -I tools/build_manifesto.py   # after editing MANIFESTO.md: updates the copies in site/, including llms-full.txt
python3 -m http.server 8766 --directory site   # the page, locally (without the counter)
vercel dev --listen 8787                       # the whole site locally, functions and middleware included; nothing is counted
node tools/audit_agents.mjs http://localhost:8787   # what an agent sees; with no address, the live site
```

When the version of the manifesto changes, update `MANIFESTO_VERSION` in `site/lib/visits.js` and the version in `site/adopt.md`, `site/llms.txt`, `site/index.md`, `site/AGENTS.md` and `site/index.json`. Then set the new date in `site/sitemap.xml`, `site/feed.xml` and the page, and run `python3 -I tools/build_manifesto.py` so `site/llms-full.txt` and `site/lib/pages.js` match. The tests check the first two, and that `pages.js` matches the pages. After editing any other public page, run `python3 -I tools/build_llms_full.py`.

## Licences

- The manifesto (`MANIFESTO.md` and its copies in `site/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- The counts at `/visits/count.json`: CC0 1.0.
- The fonts: SIL Open Font License 1.1, see [`site/fonts/`](site/fonts/).
- The code: [MIT](LICENSE).

## Who

Made by [Danilo Giudice](https://stocasticparrot.ai/en/about/), founder of Stocastic Parrot, working with HAL, an AI agent built on Claude. Both signed the manifesto. Contact: danilo@stocasticparrot.ai
