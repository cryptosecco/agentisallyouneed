#!/usr/bin/env python3
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "MANIFESTO.md"
SITE = ROOT / "site"
SHEET = re.compile(r'(<pre class="sheet__md">).*?(</pre>)', re.S)


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    (SITE / "manifesto.md").write_text(text, encoding="utf-8")
    page_path = SITE / "index.html"
    page, count = SHEET.subn(lambda m: m.group(1) + html.escape(text, quote=False) + m.group(2), page_path.read_text(encoding="utf-8"))
    if count != 1:
        raise SystemExit("site/index.html: the manifesto block was not found")
    page_path.write_text(page, encoding="utf-8")
    version = re.search(r"^version: (.+)$", text, re.M)
    print("manifesto", version.group(1) if version else "?", "written to site/manifesto.md and site/index.html")


if __name__ == "__main__":
    main()
