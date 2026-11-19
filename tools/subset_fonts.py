#!/usr/bin/env python3
import html
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "site" / "index.html"
OUT = ROOT / "site" / "fonts"

ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
CSS_EXTRA = "·"
COUNTER = "0123456789,.~ "
SHEET = re.compile(r'<section class="sheet".*?</section>', re.S)
USAGE = "usage: uvx --from 'fonttools[woff]' python -I tools/subset_fonts.py <folder with the source fonts>"


def text_of(fragment: str) -> str:
    fragment = re.sub(r"<script.*?</script>", " ", fragment, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment))


def page_text() -> str:
    body = PAGE.read_text(encoding="utf-8").split("<body>", 1)[1]
    return text_of(SHEET.sub(" ", body))


def sheet_text() -> str:
    match = SHEET.search(PAGE.read_text(encoding="utf-8"))
    return text_of(match.group(0)) if match else ""


def build(src: Path, dst: Path, text: str, axes: dict) -> None:
    if not src.exists():
        print(f"skip {dst.relative_to(ROOT)}: {src.name} not in the source folder")
        return
    font = TTFont(str(src), lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "case"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text="".join(sorted(set(text) - {"\n", "\t"})))
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, axes)
    font.flavor = "woff2"
    font.save(str(dst))
    missing = [c for c in sorted(set(text) - {"\n", "\t"}) if ord(c) not in font.getBestCmap()]
    print(f"{dst.relative_to(ROOT)}  {dst.stat().st_size:,} bytes  missing: {missing or 'none'}")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(USAGE)
    src = Path(sys.argv[1])
    text = page_text() + ASCII + CSS_EXTRA
    build(src / "Geist[wght].ttf", OUT / "geist-subset.woff2", text, {"wght": (400, 500)})
    build(src / "GeistMono[wght].ttf", OUT / "geist-mono-subset.woff2", text, {"wght": (400, 500)})
    build(src / "Doto[ROND,wght].ttf", OUT / "doto-800-subset.woff2", COUNTER, {"ROND": 0, "wght": 800})
    build(src / "RobotoMono[wght].ttf", OUT / "roboto-mono-400-subset.woff2", sheet_text() + ASCII, {"wght": 400})


if __name__ == "__main__":
    main()
