import { readCounts, storeFromEnv } from '../lib/visits.js';

const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00000', '00100', '01000'],
};
const TILE_W = 44, TILE_H = 52, GAP = 8, DOT = 4, PITCH = 5;

export function counterSvg(n) {
  const text = Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');
  const width = text.length * TILE_W + (text.length - 1) * GAP;
  let body = '';
  [...text].forEach((ch, k) => {
    const x = k * (TILE_W + GAP);
    body += `<rect x="${x}" width="${TILE_W}" height="${TILE_H}" fill="#2b2b2b"/>`;
    const ox = x + (TILE_W - (5 * PITCH - 1)) / 2, oy = (TILE_H - (7 * PITCH - 1)) / 2;
    (GLYPHS[ch] || []).forEach((row, r) => [...row].forEach((bit, c) => {
      if (bit === '1') body += `<rect x="${ox + c * PITCH}" y="${oy + r * PITCH}" width="${DOT}" height="${DOT}" fill="#f7f7f7"/>`;
    }));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${TILE_H}" width="${width}" height="${TILE_H}" shape-rendering="crispEdges" role="img" aria-label="${text} agents since launch">${body}</svg>\n`;
}

export async function GET() {
  let n = 0;
  const store = storeFromEnv();
  if (store) { try { n = (await readCounts(store)).levels.declared.total; } catch { n = 0; } }
  return new Response(counterSvg(n), {
    status: 200,
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=60', 'x-content-type-options': 'nosniff' },
  });
}

export const HEAD = GET;
