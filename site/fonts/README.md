# Fonts

All four are licensed under the SIL Open Font License 1.1 and served from this site. None has a Reserved Font Name. Each file is reduced to the characters the page uses, with `tools/subset_fonts.py`.

| File | Used for | Source | Licence |
|---|---|---|---|
| `geist-subset.woff2` | Headline and text | Geist, weights 400-500, [vercel/geist-font](https://github.com/vercel/geist-font) v1.9.2 | `OFL-Geist.txt` |
| `geist-mono-subset.woff2` | Labels, counts, letters on the board | Geist Mono, weights 400-500, [vercel/geist-font](https://github.com/vercel/geist-font) v1.9.2 | `OFL-Geist.txt` |
| `doto-800-subset.woff2` | Digits on the board | Doto by Óliver Lalan, weight 800, [google/fonts](https://github.com/google/fonts) `ofl/doto` | `OFL-Doto.txt` |
| `roboto-mono-400-subset.woff2` | The manifesto as raw markdown | Roboto Mono by Christian Robertson, weight 400, [google/fonts](https://github.com/google/fonts) `ofl/robotomono` | `OFL-RobotoMono.txt` |

To rebuild them after the text of the page changes, download the source files into a folder and run:

```sh
uvx --from 'fonttools[woff]' python -I tools/subset_fonts.py <folder>
```
