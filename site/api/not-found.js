const MD = `Index for agents: https://agentisallyouneed.dev/llms.txt

# 404 Not Found

There is nothing at this address.

- Read before you act: https://agentisallyouneed.dev/manifesto.md
- Index for agents: https://agentisallyouneed.dev/llms.txt
`;

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex">
<title>404 Not Found · agentisallyouneed</title>
<link rel="alternate" type="text/markdown" href="/index.md">
<link rel="describedby" type="text/markdown" href="/llms.txt">
<link rel="icon" href="data:,">
<style>
  @font-face { font-family: "AAYN Roboto Mono"; src: url("/fonts/roboto-mono-400-subset.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  :root { color-scheme: light; }
  html, body { margin: 0; background: #ffffff; color: #000000; }
  body { font: 400 16px/24px "AAYN Roboto Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-variant-ligatures: none; -webkit-text-size-adjust: 100%; }
  main { padding: 72px clamp(16px, 10.8vw, 156px) 144px; }
  pre { max-width: 80ch; margin: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
  ::selection { background: #000000; color: #ffffff; }
  @media (max-width: 640px) { body { font-size: 15px; } main { padding: 48px 16px 96px; } }
</style>
</head>
<body>
<main aria-labelledby="t"><h1 id="t" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">404 Not Found</h1><pre>${escape(MD)}</pre></main>
</body>
</html>
`;

function wantsHtml(accept) {
  const a = (accept || '').toLowerCase();
  return a.includes('text/html') && !a.includes('text/markdown');
}

function notFound(request) {
  const html = wantsHtml(request.headers.get('accept'));
  return new Response(request.method === 'HEAD' ? null : html ? HTML : MD, {
    status: 404,
    headers: {
      'content-type': html ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8',
      'vary': 'Accept',
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex',
      'content-signal': 'search=yes, ai-input=yes, ai-train=yes',
      'link': '</llms.txt>; rel="describedby"; type="text/markdown"',
    },
  });
}

export const GET = notFound;
export const HEAD = notFound;
export const POST = notFound;
