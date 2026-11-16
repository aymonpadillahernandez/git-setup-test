// Shared UI plumbing: delegated actions, bottom sheets, dialogs, toasts.

import { esc, fmtSet } from './format.js';
import { icon } from './icons.js';

export function navigate(path, { replace = false } = {}) {
  const hash = `#/${path}`;
  if (replace) location.replace(hash);
  else location.hash = hash;
}

// ---- Delegated events -----------------------------------------------------------
// Elements declare `data-action="name"`; handlers are registered once by name.

const actions = new Map();
const inputs = new Map();

export function onAction(name, fn) { actions.set(name, fn); }
export function onInput(name, fn) { inputs.set(name, fn); }

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions.get(el.dataset.action);
  if (fn) {
    event.preventDefault();
    fn(el, event);
  }
});

for (const type of ['input', 'change']) {
  document.addEventListener(type, (event) => {
    const el = event.target.closest('[data-input]');
    if (!el) return;
    const fn = inputs.get(el.dataset.input);
    if (fn) fn(el, event);
  });
}

// ---- Sheets -----------------------------------------------------------------
const stack = [];

function lockScroll() { document.documentElement.classList.toggle('sheet-open', stack.length > 0); }

/**
 * Open a bottom sheet. `content` is HTML. Returns { el, body, close }.
 * kind: 'page' (tall card), 'full' (covers screen), 'auto' (sized to content).
 */
export function openSheet({ content, kind = 'page', className = '', onClose, label = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `sheet-layer kind-${kind} ${className}`;
  wrap.innerHTML = `<div class="sheet-backdrop" data-sheet-dismiss></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${content}</section>`;
  document.body.appendChild(wrap);
  const handle = {
    el: wrap,
    body: wrap.querySelector('.sheet'),
    closed: false,
    close(result) {
      if (handle.closed) return;
      handle.closed = true;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      wrap.classList.remove('open');
      wrap.classList.add('closing');
      lockScroll();
      setTimeout(() => wrap.remove(), 320);
      onClose?.(result);
    },
    setContent(html) { handle.body.innerHTML = html; },
  };
  wrap.querySelector('[data-sheet-dismiss]').addEventListener('click', () => handle.close());
  stack.push(handle);
  lockScroll();
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return handle;
}

export function closeTopSheet() { stack[stack.length - 1]?.close(); }

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

/**
 * iOS-style action sheet. Resolves with the chosen option's value, or null on cancel.
 * options: [{ label, value, style: 'destructive' | 'default' }]
 */
export function actionSheet({ title = '', message = '', options = [], cancel = 'Cancel' }) {
  return new Promise((resolve) => {
    let result = null;
    const head = title || message
      ? `<div class="as-head">${title ? `<div class="as-title">${esc(title)}</div>` : ''}${message ? `<div class="as-msg">${esc(message)}</div>` : ''}</div>`
      : '';
    const sheet = openSheet({
      kind: 'action',
      label: title || 'Options',
      content: `<div class="as-group">${head}${options.map((o, i) => `<button class="as-btn ${o.style || ''}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>
        <div class="as-group"><button class="as-btn cancel" data-cancel>${esc(cancel)}</button></div>`,
      onClose: () => resolve(result),
    });
    sheet.body.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.i != null) result = options[Number(btn.dataset.i)].value;
      sheet.close();
    });
  });
}

/** Two-button confirm as an action sheet. Resolves true/false. */
export async function confirmAction({ title, message, confirm = 'OK', destructive = false }) {
  const value = await actionSheet({ title, message, options: [{ label: confirm, value: true, style: destructive ? 'destructive' : 'bold' }] });
  return value === true;
}

/** Ask for a short text value. Resolves with the trimmed string or null. */
export function promptText({ title, value = '', placeholder = '', confirm = 'Save' }) {
  return new Promise((resolve) => {
    let result = null;
    const sheet = openSheet({
      kind: 'auto',
      label: title,
      content: `<header class="sheet-nav">
          <button class="nav-btn" data-cancel>Cancel</button>
          <div class="sheet-title">${esc(title)}</div>
          <button class="nav-btn bold" data-ok>${esc(confirm)}</button>
        </header>
        <div class="sheet-pad"><input class="field" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="60" autocomplete="off"></div>`,
      onClose: () => resolve(result),
    });
    const input = sheet.body.querySelector('input');
    const ok = () => {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      result = v;
      sheet.close();
    };
    sheet.body.querySelector('[data-cancel]').onclick = () => sheet.close();
    sheet.body.querySelector('[data-ok]').onclick = ok;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

// ---- Toast --------------------------------------------------------------------
let toastTimer;
export function toast(message, { iconName = 'check' } = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = `${icon(iconName, { size: 18 })}<span>${esc(message)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---- Small builders -------------------------------------------------------------

export function segmented(name, options, value, { action = 'segment' } = {}) {
  return `<div class="segmented" role="tablist">${options.map(([v, label]) => `<button role="tab" class="${String(v) === String(value) ? 'on' : ''}" aria-selected="${String(v) === String(value)}" data-action="${action}" data-name="${esc(name)}" data-value="${esc(v)}">${esc(label)}</button>`).join('')}</div>`;
}

export function emptyState({ iconName, title, text, button = '' }) {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName, { size: 34, stroke: 1.8 })}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${button}
  </div>`;
}

/** "Beat last time: 75 kg × 10" etc. for a suggestNext() result (HTML). */
export function goalText(goal, unit) {
  if (!goal) return '';
  const set = `<strong>${esc(fmtSet(goal, unit))}</strong>`;
  if (goal.kind === 'weight') return `Add weight: ${set}`;
  if (goal.kind === 'allSets') return `Get ${set} on every set`;
  return `Beat last time: ${set}`;
}

export function deltaChip(diff, { format = (v) => String(v), neutral = 'Same' } = {}) {
  if (diff == null) return '';
  if (Math.abs(diff) < 1e-9) return `<span class="delta flat">${esc(neutral)}</span>`;
  const up = diff > 0;
  return `<span class="delta ${up ? 'up' : 'down'}">${icon(up ? 'arrowUp' : 'arrowDown', { size: 12, stroke: 2.6 })}${esc(format(Math.abs(diff)))}</span>`;
}

/**
 * Drag a row by its `.drag-handle` to reorder rows inside `list`.
 * Calls onMove(from, to) when dropped (from === to if nothing moved).
 */
export function bindSortable(list, { row, onMove }) {
  if (!list) return;
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || !list.contains(handle)) return;
    e.preventDefault();
    const el = handle.closest(row);
    const rows = [...list.querySelectorAll(row)];
    const from = rows.indexOf(el);
    const step = rows.length > 1
      ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top
      : el.offsetHeight;
    const startY = e.clientY;
    let to = from;
    el.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dy = ev.clientY - startY;
      el.style.transform = `translateY(${dy}px)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / step)));
      rows.forEach((r, i) => {
        if (r === el) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -step;
        if (from > to && i < from && i >= to) shift = step;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      rows.forEach((r) => { r.style.transform = ''; });
      el.classList.remove('dragging');
      onMove(from, to);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}
