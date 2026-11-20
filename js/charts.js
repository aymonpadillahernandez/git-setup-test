// Hand-rolled SVG charts: a trend line with a scrubbing crosshair, weekly columns,
// sparklines and activity rings. Charts are declared in view HTML as
// <div data-chart="id"> and drawn at the container's real width by hydrateCharts().

import { esc } from './format.js';

const registry = new Map();
let nextId = 0;

/** Register a chart spec and return the placeholder HTML. */
export function chartSlot(spec, { label = '' } = {}) {
  const id = `c${nextId++}`;
  registry.set(id, spec);
  // Old views are gone from the DOM; keep the registry from growing forever.
  if (registry.size > 60) registry.delete(registry.keys().next().value);
  return `<div class="chart" data-chart="${id}" role="img" aria-label="${esc(label)}"></div>`;
}

const resizeObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      const w = Math.round(entry.contentRect.width);
      if (w && w !== Number(el.dataset.drawnWidth)) draw(el);
    }
  })
  : null;

const observed = new Set();

export function hydrateCharts(root = document) {
  for (const el of observed) {
    if (!el.isConnected) { resizeObserver?.unobserve(el); observed.delete(el); }
  }
  root.querySelectorAll('[data-chart]').forEach((el) => {
    draw(el);
    resizeObserver?.observe(el);
    observed.add(el);
  });
}

function draw(el) {
  const spec = registry.get(el.dataset.chart);
  if (!spec) return;
  const width = el.clientWidth;
  if (!width) return;
  el.dataset.drawnWidth = String(width);
  if (spec.type === 'line') drawLine(el, spec, width);
  else if (spec.type === 'columns') drawColumns(el, spec, width);
}

// ---- Scales -------------------------------------------------------------------

export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d; max += d;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const err = raw / mag;
  const step = (err >= 7.07 ? 10 : err >= 3.16 ? 5 : err >= 1.41 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const svgNS = 'http://www.w3.org/2000/svg';

function tooltipEl(el) {
  let tip = el.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('aria-hidden', 'true');
    el.appendChild(tip);
  }
  return tip;
}

function showTip(el, tip, x, lines) {
  tip.replaceChildren();
  const v = document.createElement('div');
  v.className = 'tip-value';
  v.textContent = lines[0];
  tip.appendChild(v);
  if (lines[1]) {
    const s = document.createElement('div');
    s.className = 'tip-sub';
    s.textContent = lines[1];
    tip.appendChild(s);
  }
  tip.classList.add('show');
  const w = tip.offsetWidth;
  const left = Math.max(0, Math.min(el.clientWidth - w, x - w / 2));
  tip.style.transform = `translateX(${left}px)`;
}

// ---- Line ---------------------------------------------------------------------
// spec: { type: 'line', points: [{ x, y, tip: [value, sub] }], fmtY, fmtX, endLabel, height }

function drawLine(el, spec, width) {
  const pts = spec.points;
  const height = spec.height || 210;
  const pad = { t: spec.compact ? 24 : 34, r: 44, b: 26, l: 4 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;

  let x0 = Math.min(...pts.map((p) => p.x));
  let x1 = Math.max(...pts.map((p) => p.x));
  if (x0 === x1) { x0 -= 3.5 * 864e5; x1 += 3.5 * 864e5; }
  const ys = pts.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 3);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const sx = (x) => pad.l + ((x - x0) / (x1 - x0)) * plotW;
  const sy = (y) => pad.t + plotH - ((y - y0) / (y1 - y0 || 1)) * plotH;

  const xy = pts.map((p) => [sx(p.x), sy(p.y)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const base = pad.t + plotH;
  const area = xy.length > 1 ? `${line}L${xy[xy.length - 1][0].toFixed(1)},${base}L${xy[0][0].toFixed(1)},${base}Z` : '';

  // X labels: up to 4 evenly spaced data points.
  const xIdx = pts.length <= 4 ? pts.map((_, i) => i)
    : [...new Set([0, Math.round((pts.length - 1) / 3), Math.round((2 * (pts.length - 1)) / 3), pts.length - 1])];

  const showDots = pts.length <= 16;
  const last = xy[xy.length - 1];

  el.innerHTML = `<svg width="${width}" height="${height}" class="chart-svg" style="touch-action:pan-y">
    <g class="grid">${ticks.map((t) => `<line x1="${pad.l}" x2="${pad.l + plotW}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}"/>`).join('')}</g>
    <g class="axis-y">${ticks.map((t) => `<text x="${width - 2}" y="${(sy(t) + 4).toFixed(1)}" text-anchor="end">${esc(spec.fmtY(t))}</text>`).join('')}</g>
    <g class="axis-x">${xIdx.map((i, k) => `<text x="${xy[i][0].toFixed(1)}" y="${height - 6}" text-anchor="${k === 0 && xIdx.length > 1 ? 'start' : i === pts.length - 1 && xIdx.length > 1 ? 'end' : 'middle'}">${esc(spec.fmtX(pts[i].x))}</text>`).join('')}</g>
    ${area ? `<path class="area" d="${area}"/>` : ''}
    <path class="line" d="${line}"/>
    ${showDots ? xy.slice(0, -1).map(([x, y]) => `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`).join('') : ''}
    <circle class="dot end" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5"/>
    ${spec.endLabel ? `<text class="end-label" x="${Math.min(last[0], pad.l + plotW).toFixed(1)}" y="${(last[1] - 12).toFixed(1)}" text-anchor="${last[0] > plotW - 30 ? 'end' : 'middle'}">${esc(spec.endLabel)}</text>` : ''}
    <line class="crosshair" y1="${pad.t - 6}" y2="${base}" x1="0" x2="0" visibility="hidden"/>
    <circle class="dot focus" r="5.5" visibility="hidden"/>
    <rect class="hit" x="0" y="0" width="${width}" height="${height}" fill="transparent"/>
  </svg>`;

  const svg = el.querySelector('svg');
  const cross = svg.querySelector('.crosshair');
  const focus = svg.querySelector('.focus');
  const tip = tooltipEl(el);
  let hideTimer;
  let current = -1;

  const show = (i) => {
    current = i;
    const [x, y] = xy[i];
    cross.setAttribute('x1', x); cross.setAttribute('x2', x);
    cross.setAttribute('visibility', 'visible');
    focus.setAttribute('cx', x); focus.setAttribute('cy', y);
    focus.setAttribute('visibility', 'visible');
    showTip(el, tip, x, pts[i].tip);
  };
  const hide = () => {
    current = -1;
    cross.setAttribute('visibility', 'hidden');
    focus.setAttribute('visibility', 'hidden');
    tip.classList.remove('show');
  };
  const nearest = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i][0] - x) < Math.abs(xy[best][0] - x)) best = i;
    return best;
  };
  svg.addEventListener('pointerdown', (e) => { clearTimeout(hideTimer); show(nearest(e.clientX)); });
  svg.addEventListener('pointermove', (e) => { clearTimeout(hideTimer); show(nearest(e.clientX)); });
  svg.addEventListener('pointerleave', () => { hideTimer = setTimeout(hide, 1600); });
  svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') hideTimer = setTimeout(hide, 2200); });
  svg.addEventListener('pointercancel', () => { hideTimer = setTimeout(hide, 1200); });

  el.tabIndex = 0;
  el.onkeydown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const start = current < 0 ? xy.length - 1 : current + (e.key === 'ArrowRight' ? 1 : -1);
      show(Math.max(0, Math.min(xy.length - 1, start)));
    }
  };
  el.onfocus = () => show(xy.length - 1);
  el.onblur = hide;
}

// ---- Columns ------------------------------------------------------------------
// spec: { type: 'columns', bars: [{ label, value, tip: [value, sub], highlight }], fmtY, valueLabel, height }

function roundedTopRect(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function drawColumns(el, spec, width) {
  const bars = spec.bars;
  const height = spec.height || 170;
  const pad = { t: 24, r: 40, b: 24, l: 0 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const max = Math.max(...bars.map((b) => b.value), 0);
  const ticks = max > 0 ? niceTicks(0, max, 2) : [0, 1];
  const top = ticks[ticks.length - 1];
  const slot = plotW / bars.length;
  const bw = Math.min(24, slot * 0.62);
  const sy = (v) => pad.t + plotH - (v / top) * plotH;
  // Thin the x labels so they never collide; always keep the latest bar's label.
  const labelStep = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(plotW / 52))));

  const rects = bars.map((b, i) => {
    const x = pad.l + i * slot + (slot - bw) / 2;
    const y = sy(b.value);
    return { x, y, h: pad.t + plotH - y, cx: pad.l + i * slot + slot / 2 };
  });

  el.innerHTML = `<svg width="${width}" height="${height}" class="chart-svg">
    <g class="grid">${ticks.map((t) => `<line x1="${pad.l}" x2="${pad.l + plotW}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}"/>`).join('')}</g>
    <g class="axis-y">${ticks.map((t) => `<text x="${width - 2}" y="${(sy(t) + 4).toFixed(1)}" text-anchor="end">${esc(spec.fmtY(t))}</text>`).join('')}</g>
    ${rects.map((r, i) => `<path class="bar ${bars[i].highlight ? 'hl' : ''}" data-i="${i}" d="${roundedTopRect(r.x, r.y, bw, r.h, 4)}"/>`).join('')}
    <g class="axis-x">${bars.map((b, i) => ((bars.length - 1 - i) % labelStep) ? '' : `<text x="${rects[i].cx.toFixed(1)}" y="${height - 6}" text-anchor="middle">${esc(b.label)}</text>`).join('')}</g>
    ${spec.valueLabel ? (() => { const i = bars.length - 1; const r = rects[i]; return bars[i].value > 0 ? `<text class="end-label" x="${r.cx.toFixed(1)}" y="${(r.y - 7).toFixed(1)}" text-anchor="${i === bars.length - 1 ? 'end' : 'middle'}" dx="${i === bars.length - 1 ? bw / 2 : 0}">${esc(spec.valueLabel)}</text>` : ''; })() : ''}
    ${rects.map((r, i) => `<rect class="hit" data-i="${i}" x="${(pad.l + i * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${height}" fill="transparent"/>`).join('')}
  </svg>`;

  const svg = el.querySelector('svg');
  const tip = tooltipEl(el);
  let hideTimer;
  const show = (i) => {
    svg.querySelectorAll('.bar').forEach((b) => b.classList.toggle('active', Number(b.dataset.i) === i));
    showTip(el, tip, rects[i].cx, bars[i].tip);
  };
  const hide = () => {
    svg.querySelectorAll('.bar.active').forEach((b) => b.classList.remove('active'));
    tip.classList.remove('show');
  };
  svg.addEventListener('pointerover', (e) => {
    const t = e.target.closest('.hit');
    if (t) { clearTimeout(hideTimer); show(Number(t.dataset.i)); }
  });
  svg.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.hit');
    if (t) { clearTimeout(hideTimer); show(Number(t.dataset.i)); }
  });
  svg.addEventListener('pointerleave', () => { hideTimer = setTimeout(hide, 1200); });
  svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') hideTimer = setTimeout(hide, 2200); });
}

// ---- Static marks (pure strings) -------------------------------------------------------

/** Tiny trend line: de-emphasis gray with the latest point in the accent. */
export function sparkline(values, { width = 64, height = 26 } = {}) {
  if (!values.length) return '';
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const sx = (i) => values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2);
  const sy = (v) => max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const lx = sx(values.length - 1);
  const ly = sy(values[values.length - 1]);
  return `<svg class="spark" width="${width}" height="${height}" aria-hidden="true">
    <path d="${d}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5"/></svg>`;
}

/** Concentric progress rings. rings: [{ value 0..1, cls }], outermost first. */
export function rings(list, { size = 112, stroke = 13, gap = 3 } = {}) {
  const c = size / 2;
  const parts = list.map((ring, i) => {
    const r = c - stroke / 2 - i * (stroke + gap);
    const circ = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, ring.value));
    const dash = v * circ;
    return `<circle class="ring-track ${ring.cls}" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"/>
      ${v > 0 ? `<circle class="ring-fill ${ring.cls}" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>` : ''}`;
  }).join('');
  return `<svg class="rings" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${parts}</svg>`;
}
