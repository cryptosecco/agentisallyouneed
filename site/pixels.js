(() => {
  'use strict';

  const root = document.documentElement;
  const css = (name, el) => getComputedStyle(el || root).getPropertyValue(name).trim();

  if (new URLSearchParams(location.search).get('grid') === '1') {
    root.classList.add('show-grid');
    const label = document.querySelector('.grid-overlay p');
    const row = document.querySelector('.page .row');
    const describe = () => {
      if (!label || !row) return;
      const cs = getComputedStyle(row);
      const tracks = cs.gridTemplateColumns.split(' ');
      label.textContent = `${tracks.length} col × ${tracks[0]} · gutter ${cs.columnGap} · margin ${cs.marginLeft} · unit ${css('--u')} · cell ${css('--cell')}`;
    };
    describe();
    window.addEventListener('resize', describe);
  }

  const canvas = document.getElementById('pixels');
  const hero = document.querySelector('.page');
  const onSheet = (el) => !!(el && el.closest && el.closest('.sheet'));
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const PLAIN = 0, CLEAR = 1;
  const TOP = 2;
  const FAINT = 0.12;
  const CURSOR_MIN = 0.35;
  let fadeFrom = 0.5;

  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');

  let W = 0, H = 0, dpr = 1, cell = 12, cols = 0, rows = 0, gap = 1;
  let kind, level, due, isActive;
  let active = [];
  let pal = null;
  let raf = 0;
  let last = null;
  let motion = !reduceMQ.matches;

  function hex(c) { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }

  function readPalette() {
    const rest = hex(css('--px-rest') || '#f2f2f2'), on = hex(css('--px-on') || '#d2d2d2');
    pal = {
      gap: css('--px-gap') || '#f7f7f7',
      [PLAIN]: [mix(rest, on, 0), mix(rest, on, 0.5), mix(rest, on, 1)],
      [CLEAR]: [mix(rest, on, 0)],
    };
  }

  function layout() {
    W = root.clientWidth || window.innerWidth;
    H = hero ? hero.offsetHeight : window.innerHeight;
    fadeFrom = (parseFloat(css('--fade-from')) || 50) / 100;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cell = parseFloat(css('--cell')) || 12;
    gap = 1;
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const n = cols * rows;
    kind = new Uint8Array(n); level = new Uint8Array(n); due = new Float64Array(n); isActive = new Uint8Array(n);
    active = [];
  }

  function markClear() {
    for (const el of document.querySelectorAll('[data-clear]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const c0 = Math.max(0, Math.floor(r.left / cell) - 1), c1 = Math.min(cols - 1, Math.ceil(r.right / cell));
      const top = r.top + window.scrollY, bottom = r.bottom + window.scrollY;
      const r0 = Math.max(0, Math.floor(top / cell) - 1), r1 = Math.min(rows - 1, Math.ceil(bottom / cell));
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) kind[y * cols + x] = CLEAR;
    }
  }

  function paint(i) {
    const c = i % cols, r = (i / cols) | 0;
    const x0 = Math.round(c * cell * dpr), y0 = Math.round(r * cell * dpr);
    const x1 = Math.round((c + 1) * cell * dpr) - Math.max(1, Math.round(gap * dpr));
    const y1 = Math.round((r + 1) * cell * dpr) - Math.max(1, Math.round(gap * dpr));
    ctx.fillStyle = pal[kind[i]][level[i]];
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  function paintAll() {
    ctx.fillStyle = pal.gap; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < cols * rows; i++) paint(i);
  }

  function fadeAt(y) {
    const s = Math.min(1, Math.max(0, (y / H - fadeFrom) / (1 - fadeFrom)));
    return 1 - s * s * (3 - 2 * s);
  }

  function light(i, now) {
    if (kind[i] === CLEAR) return;
    if (fadeAt((((i / cols) | 0) + 0.5) * cell) < FAINT) return;
    level[i] = TOP;
    due[i] = now + 140 + Math.random() * 260;
    paint(i);
    if (!isActive[i]) { isActive[i] = 1; active.push(i); }
  }

  function brush(x, y) {
    if (!motion || !pal) return;
    y += window.scrollY;
    if (y >= H + cell * 4) { last = null; return; }
    if (!last) { last = { x, y }; return; }
    const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const now = performance.now();
    const R = cell * (W <= 640 ? 3 : 3.5);
    const steps = Math.min(16, Math.ceil(dist / cell));
    for (let s = 1; s <= steps; s++) {
      const px = last.x + (dx * s) / steps, py = last.y + (dy * s) / steps;
      const c0 = Math.max(0, Math.floor((px - R) / cell)), c1 = Math.min(cols - 1, Math.floor((px + R) / cell));
      const r0 = Math.max(0, Math.floor((py - R) / cell)), r1 = Math.min(rows - 1, Math.floor((py + R) / cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const d = Math.hypot((c + 0.5) * cell - px, (r + 0.5) * cell - py) / R;
          if (d < 1 && Math.random() < (0.55 * (1 - d) + 0.1) / steps * 2) light(r * cols + c, now);
        }
      }
    }
    last = { x, y };
    start();
  }

  function frame(now) {
    raf = 0;
    const keep = [];
    for (const i of active) {
      if (now >= due[i]) {
        level[i]--;
        paint(i);
        if (level[i] === 0) { isActive[i] = 0; continue; }
        due[i] = now + 220 + Math.random() * 380;
      }
      keep.push(i);
    }
    active = keep;
    if (active.length) start();
  }
  function start() { if (!raf && motion) raf = requestAnimationFrame(frame); }

  function build() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    readPalette(); layout(); markClear(); paintAll(); measureBoard();
    last = null;
  }

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const DIGITS = '0123456789';
  const flaps = Array.from(document.querySelectorAll('.flap')).map((el) => ({
    el, final: el.textContent, busy: false, rect: null, until: 0,
    glyphs: el.closest('[data-ticker]') ? DIGITS : GLYPHS,
  }));
  const randomGlyph = (set) => set[(Math.random() * set.length) | 0];

  function flip(f, delay) {
    if (f.busy || !motion) return;
    f.busy = true;
    let left = 3 + ((Math.random() * 5) | 0);
    const beat = 45;
    const step = () => {
      f.el.classList.add('flip-a');
      setTimeout(() => {
        f.el.textContent = left > 0 ? randomGlyph(f.glyphs) : f.final;
        f.el.classList.replace('flip-a', 'flip-b');
        setTimeout(() => {
          f.el.classList.remove('flip-b');
          if (left-- > 0) setTimeout(step, 20 + Math.random() * 30);
          else { f.busy = false; f.until = performance.now() + 1500; }
        }, beat);
      }, beat);
    };
    setTimeout(step, delay);
  }
  const shown = () => flaps.filter((f) => f.el.offsetParent !== null);
  function flipAll() { const list = shown(), step = Math.min(55, 1600 / Math.max(1, list.length)); list.forEach((f, k) => flip(f, k * step + Math.random() * 120)); }
  function flipSome() {
    const list = shown(); if (!list.length) return;
    const start = (Math.random() * list.length) | 0, n = 3 + ((Math.random() * 4) | 0);
    for (let k = 0; k < n; k++) flip(list[(start + k) % list.length], k * 70);
  }
  function measureBoard() { for (const f of flaps) f.rect = f.el.offsetParent !== null ? f.el.getBoundingClientRect() : null; }
  function hoverBoard(x, y) {
    if (!motion) return;
    const now = performance.now();
    for (const f of flaps) {
      const r = f.rect;
      if (r && !f.busy && now > f.until && x >= r.left && x < r.right && y >= r.top && y < r.bottom) flip(f, 0);
    }
  }
  let idleFlips = 0;
  function scheduleIdleFlips() {
    clearTimeout(idleFlips);
    if (!motion) return;
    idleFlips = setTimeout(() => { if (!document.hidden) flipSome(); scheduleIdleFlips(); }, 9000 + Math.random() * 9000);
  }
  function settleBoard() { for (const f of flaps) { f.el.textContent = f.final; f.el.classList.remove('flip-a', 'flip-b'); } }

  const byEl = new Map(flaps.map((f) => [f.el, f]));
  const tickers = Array.from(document.querySelectorAll('[data-ticker]'));
  const tickerText = document.querySelector('[data-ticker-text]');
  const fmt = (n) => n.toLocaleString('en-US');
  function setTicker(value) {
    for (const t of tickers) {
      const tiles = Array.from(t.querySelectorAll('.flap'));
      const text = fmt(value).padStart(tiles.length, ' ').slice(-tiles.length);
      tiles.forEach((el, k) => {
        const f = byEl.get(el), c = text[k] === ' ' ? '' : text[k];
        if (!f || f.final === c) return;
        f.final = c;
        if (motion) { f.until = 0; flip(f, k * 60); } else el.textContent = c;
      });
      t.dataset.ticker = String(value);
    }
    if (tickerText) tickerText.textContent = `${fmt(value)} agents since launch`;
  }

  let block = null, idleTimer = 0, pointer = null;
  function placeBlock(cx, cy) {
    const sy = window.scrollY;
    const x = Math.floor(cx / cell) * cell, yc = Math.floor((cy + sy) / cell) * cell;
    const a = fadeAt(yc + cell / 2);
    const faded = a < CURSOR_MIN;
    root.classList.toggle('cursor-faded', faded);
    if (faded) return false;
    block.style.opacity = a < 0.995 ? a.toFixed(3) : '';
    block.style.transform = `translate(${x}px, ${yc - sy}px)`;
    return true;
  }
  function moveBlock(e) {
    if (!block) return;
    if (e.pointerType === 'touch' || onSheet(e.target) || (e.target && e.target.closest && e.target.closest('a'))) { block.classList.remove('is-visible'); return; }
    if (!placeBlock(e.clientX, e.clientY)) { block.classList.remove('is-visible'); return; }
    block.classList.add('is-visible', 'is-moving');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => block && block.classList.remove('is-moving'), 600);
  }
  function setupCursor() {
    if (fineMQ.matches && !block) {
      block = document.createElement('div');
      block.className = 'cursor-block';
      block.setAttribute('aria-hidden', 'true');
      document.body.appendChild(block);
      root.classList.add('block-cursor');
    } else if (!fineMQ.matches && block) {
      block.remove(); block = null;
      root.classList.remove('block-cursor');
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY };
    moveBlock(e);
    if (e.pointerType !== 'touch' && !onSheet(e.target)) { brush(e.clientX, e.clientY); hoverBoard(e.clientX, e.clientY); }
    else if (onSheet(e.target)) last = null;
  }, { passive: true });
  window.addEventListener('scroll', () => {
    last = null;
    if (!block || !pointer) return;
    const el = document.elementFromPoint(pointer.x, pointer.y);
    if (onSheet(el) || (el && el.closest && el.closest('a')) || !placeBlock(pointer.x, pointer.y)) block.classList.remove('is-visible');
  }, { passive: true });
  document.addEventListener('mouseleave', () => { last = null; if (block) block.classList.remove('is-visible'); });
  window.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) last = { x: t.clientX, y: t.clientY + window.scrollY }; }, { passive: true });
  window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t && !onSheet(e.target)) { brush(t.clientX, t.clientY); hoverBoard(t.clientX, t.clientY); } }, { passive: true });
  window.addEventListener('touchend', () => { last = null; }, { passive: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 150); });
  reduceMQ.addEventListener('change', () => { motion = !reduceMQ.matches; if (!motion) settleBoard(); build(); scheduleIdleFlips(); });
  window.addEventListener('scroll', measureBoard, { passive: true });
  fineMQ.addEventListener('change', setupCursor);

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => null) : Promise.resolve();
  ready.then(() => { build(); setupCursor(); if (motion) { flipAll(); scheduleIdleFlips(); } loadCount(); setInterval(() => { if (document.visibilityState === 'visible') loadCount(); }, 60000); });

  function loadCount() {
    if (!tickers.length || !window.fetch) return;
    fetch('/visits/count.json', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const lv = data && data.levels;
        if (!lv || !lv.verified || !lv.declared) return;
        const n = lv.declared.total;
        const row = document.querySelector('[data-levels]');
        if (row) row.innerHTML = ['verified', 'declared', 'probable'].map((l) => `<span>${l} ${fmt(Number(lv[l] && lv[l].total) || 0)}</span>`).join('');
        if (Number.isInteger(n) && n >= 0 && n !== Number(tickers[0].dataset.ticker)) setTimeout(() => setTicker(n), motion ? 1800 : 0);
      })
      .catch(() => {});
  }
})();
