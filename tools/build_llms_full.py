#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PAGES = (
    "manifesto.md",
    "adopt.md",
    "AGENTS.md",
    "index.md",
    "privacy.md",
    "llms.txt",
)

INTRO = """# agentisallyouneed

> Full text of the public pages, for agents and answer engines. The Agent Manifesto is version 1.3.0, 19 November 2026, CC BY 4.0. Maintained by Danilo Giudice, founder of Stocastic Parrot (https://stocasticparrot.ai/en/about/).

Each section below is one public page, under its own URL. The manifesto text is the same as https://agentisallyouneed.dev/manifesto.md.

"""


def section(url, body):
    if not body.endswith("\n"):
        body += "\n"
    return f"## {url}\n\n{body}\n"


def sign_howto():
    text = (SITE / "api" / "sign.js").read_text(encoding="utf-8")
    match = re.search(r"const HOWTO = `([\s\S]*?)`;\n", text)
    if not match:
        raise SystemExit("site/api/sign.js: HOWTO was not found")
    return match.group(1).strip() + "\n"


def main():
    source = (ROOT / "MANIFESTO.md").read_text(encoding="utf-8")
    published = (SITE / "manifesto.md").read_text(encoding="utf-8")
    if source != published:
        raise SystemExit("MANIFESTO.md and site/manifesto.md differ")
    parts = [INTRO]
    for name in PAGES:
        parts.append(section(f"https://agentisallyouneed.dev/{name}", (SITE / name).read_text(encoding="utf-8")))
    parts.append(section("https://agentisallyouneed.dev/sign", sign_howto()))
    out = "".join(parts)
    if source not in out:
        raise SystemExit("llms-full.txt does not contain the manifesto")
    (SITE / "llms-full.txt").write_text(out, encoding="utf-8")
    print("llms-full.txt", len(out.encode("utf-8")), "bytes")
    write_pages_js()


# The pages the search endpoint reads and the home page offers as Markdown.
# llms.txt is left out: it is a list of links, not a page to quote.
def write_pages_js():
    pages = [{"url": f"https://agentisallyouneed.dev/{name}", "text": (SITE / name).read_text(encoding="utf-8")} for name in PAGES if name != "llms.txt"]
    pages.append({"url": "https://agentisallyouneed.dev/sign", "text": sign_howto()})
    body = json.dumps(pages, ensure_ascii=False, indent=2)
    out = f"// Written by tools/build_llms_full.py from the public pages. Do not edit by hand.\nexport const PAGES = {body};\n"
    (SITE / "lib" / "pages.js").write_text(out, encoding="utf-8")
    print("lib/pages.js", len(pages), "pages")


if __name__ == "__main__":
    main()
