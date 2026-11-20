// The workout logger: a full-screen sheet used both for the live workout
// (db.active) and for editing / back-filling a finished workout.

import { db, persist, commit, uid, exById, exName, routineById, workoutById } from './store.js';
import {
  esc, fmtClock, fmtDateLong, fmtTime, fmtSet, fmtDuration, wInput, wVal,
  parseNumber, fromUnit, fmtDate, plural,
} from './format.js';
import { icon } from './icons.js';
import { openSheet, actionSheet, confirmAction, toast, navigate, goalText, deltaChip } from './ui.js';
import { pickExercises } from './picker.js';
import { DEFAULT_REP_RANGE } from './data.js';
import {
  lastSession, bestsFor, setPRType, computePRs, suggestNext, topSet,
  workoutSetCount, prLabel, doneSets,
} from './stats.js';

let ctx = null; // { mode: 'active' | 'edit', draft, sheet, isNew }
let restTimer = null;

export const isWorkoutSheetOpen = () => !!ctx;
const notify = () => document.dispatchEvent(new Event('workoutsheet'));
const unit = () => db.settings.unit;

function defaultName(ms) {
  const h = new Date(ms).getHours();
  if (h < 5) return 'Night Workout';
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  if (h < 21) return 'Evening Workout';
  return 'Night Workout';
}

const blankSets = (n) => Array.from({ length: n }, () => ({ w: null, r: null, done: false }));

function newWex(exId, sets) {
  const last = lastSession(exId);
  return { id: uid(), exId, sets: blankSets(sets ?? Math.max(1, last?.sets.length || 3)) };
}

// ---- Entry points -------------------------------------------------------------

/** Start a live workout from a routine, an ad-hoc template ({ name, items }), or empty. */
export async function startWorkout({ routineId = null, template = null } = {}) {
  if (db.active) {
    const choice = await actionSheet({
      title: 'Workout in progress',
      message: `“${db.active.name}” is still running.`,
      options: [
        { label: 'Resume Current Workout', value: 'resume', style: 'bold' },
        { label: 'Discard and Start New', value: 'discard', style: 'destructive' },
      ],
    });
    if (choice === 'resume') { openWorkoutSheet(); return; }
    if (choice !== 'discard') return;
  }
  const routine = routineId ? routineById(routineId) : template;
  const now = Date.now();
  db.active = {
    id: uid(),
    name: routine?.name || defaultName(now),
    routineId: routineId && routine ? routine.id : null,
    start: now,
    exercises: routine ? routine.items.filter((it) => exById(it.exId)).map((it) => newWex(it.exId, it.sets)) : [],
    rest: null,
  };
  commit();
  openWorkoutSheet();
}

export function openWorkoutSheet({ animate = true } = {}) {
  if (!db.active) return;
  if (ctx) ctx.sheet.close();
  openEditor({ mode: 'active', draft: db.active, animate });
}

/** Edit a finished workout, or create a past workout when id is null. */
export function editWorkout(id = null) {
  let draft;
  let isNew = false;
  if (id) {
    const w = workoutById(id);
    if (!w) return;
    draft = JSON.parse(JSON.stringify(w));
  } else {
    const start = Date.now() - 60 * 60000;
    draft = { id: uid(), name: defaultName(start), routineId: null, start, end: start + 60 * 60000, exercises: [], prs: [] };
    isNew = true;
  }
  openEditor({ mode: 'edit', draft, isNew });
}

function openEditor({ mode, draft, isNew = false }) {
  const sheet = openSheet({
    kind: 'full',
    className: 'workout-layer',
    label: mode === 'active' ? 'Current workout' : 'Edit workout',
    content: '',
    onClose: () => {
      ctx = null;
      stopRestTicker();
      notify();
    },
  });
  ctx = { mode, draft, sheet, isNew };
  sheet.setContent(renderShell());
  bindSheet(sheet.body);
  renderRest();
  notify();
}

// ---- Rendering ------------------------------------------------------------------

function renderShell() {
  const d = ctx.draft;
  const active = ctx.mode === 'active';
  const header = active
    ? `<header class="sheet-nav wk-nav">
        <button class="icon-btn" data-wk="minimize" aria-label="Minimize workout">${icon('chevronDown', { size: 24, stroke: 2.4 })}</button>
        <div class="wk-clock">${icon('timer', { size: 16, stroke: 2.2 })}<span data-elapsed="${d.start}">${fmtClock((Date.now() - d.start) / 1000)}</span></div>
        <button class="pill-btn green" data-wk="finish">Finish</button>
      </header>`
    : `<header class="sheet-nav wk-nav">
        <button class="nav-btn" data-wk="cancel-edit">Cancel</button>
        <div class="sheet-title">${ctx.isNew ? 'Log Past Workout' : 'Edit Workout'}</div>
        <button class="nav-btn bold" data-wk="save-edit">Save</button>
      </header>`;

  const meta = active
    ? `<div class="wk-meta">${esc(fmtDateLong(d.start))} · Started ${esc(fmtTime(d.start))}</div>`
    : `<div class="wk-when">
        <label><span>Date</span><input type="datetime-local" data-wk-field="start" value="${toLocalInput(d.start)}"></label>
        <label><span>Duration</span><span class="dur"><input type="text" inputmode="numeric" data-wk-field="duration" value="${Math.max(1, Math.round(((d.end || d.start) - d.start) / 60000))}"> min</span></label>
      </div>`;

  return `${header}
    <div class="sheet-scroll wk-scroll">
      <input class="wk-title" data-wk-field="name" value="${esc(d.name)}" aria-label="Workout name" maxlength="40" autocomplete="off">
      ${meta}
      <div class="wk-list">${d.exercises.map(renderCard).join('')}</div>
      ${d.exercises.length ? '' : `<div class="wk-empty">${icon('dumbbell', { size: 30, stroke: 1.8 })}<p>Add your first exercise to start logging sets.</p></div>`}
      <button class="btn tinted wide" data-wk="add-exercise">${icon('plus', { size: 18, stroke: 2.4 })} Add Exercises</button>
      ${active ? '<button class="btn plain destructive wide" data-wk="discard">Discard Workout</button>' : ''}
      ${!active && !ctx.isNew ? '<button class="btn plain destructive wide" data-wk="delete">Delete Workout</button>' : ''}
      <div class="wk-bottom-space"></div>
    </div>
    ${active ? '<div class="rest-bar" hidden></div>' : ''}`;
}

function toLocalInput(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function cardContext(wex) {
  const d = ctx.draft;
  const last = lastSession(wex.exId, { excludeId: d.id, before: d.start, routineId: d.routineId });
  const bests = bestsFor(wex.exId, { excludeId: d.id, before: d.start });
  return { last, bests };
}

/**
 * Placeholder values for set i. Weight and reps each come from the nearest set above
 * that has one; otherwise from last session's matching set.
 */
function placeholderFor(wex, i, last) {
  let w = null;
  let r = null;
  for (let j = i - 1; j >= 0 && (w == null || r == null); j--) {
    const s = wex.sets[j];
    if (w == null && s.w != null) w = s.w;
    if (r == null && s.r != null) r = s.r;
  }
  const prev = last?.sets[i] || last?.sets[last.sets.length - 1];
  return { w: w ?? prev?.w ?? null, r: r ?? prev?.r ?? null };
}

function renderCard(wex) {
  const u = unit();
  const ex = exById(wex.exId);
  const { last, bests } = cardContext(wex);
  const d = ctx.draft;
  const goal = ctx.mode === 'active' ? suggestNext(wex.exId, { excludeId: d.id, before: d.start, routineId: d.routineId, unit: u }) : null;
  const lastText = last
    ? `${last.sets.map((s) => (s.w ? `${wVal(s.w, u)}×${s.r}` : `${s.r}`)).join(', ')}`
    : '';

  const rows = wex.sets.map((s, i) => {
    const prev = last?.sets[i];
    const ph = placeholderFor(wex, i, last);
    const pr = setPRType(s, bests);
    return `<div class="set-row ${s.done ? 'done' : ''}" data-set="${i}">
      <div class="set-del-bg">${icon('trash', { size: 18 })}<span>Delete</span></div>
      <div class="set-inner">
        <span class="set-num">${pr ? `<span class="pr-badge" title="${esc(prLabel({ type: pr, w: s.w }, u))}">${icon('trophy', { size: 15, stroke: 2.2 })}</span>` : i + 1}</span>
        <button class="set-prev" data-wk="fill" tabindex="-1">${prev ? esc(prev.w ? `${wVal(prev.w, u)} × ${prev.r}` : `${prev.r} reps`) : '—'}</button>
        <input class="set-in" data-f="w" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="Weight set ${i + 1}" value="${s.w != null ? wInput(s.w, u) : ''}" placeholder="${ph.w != null ? wInput(ph.w, u) : u}">
        <input class="set-in" data-f="r" inputmode="numeric" enterkeyhint="done" autocomplete="off" aria-label="Reps set ${i + 1}" value="${s.r ?? ''}" placeholder="${ph.r ?? 'reps'}">
        <button class="set-check" data-wk="toggle" aria-label="Complete set ${i + 1}" aria-pressed="${s.done}">${icon('check', { size: 16, stroke: 3 })}</button>
      </div>
    </div>`;
  }).join('');

  return `<article class="ex-card" data-wex="${esc(wex.id)}">
    <header class="ex-head">
      <div class="ex-title">
        <h3>${esc(ex?.name || 'Deleted exercise')}</h3>
        ${last ? `<div class="ex-last">Last time · ${esc(fmtDate(last.workout.start))} · ${esc(lastText)}</div>` : '<div class="ex-last">First time: today sets your baseline</div>'}
      </div>
      <button class="icon-btn small" data-wk="ex-menu" aria-label="Exercise options">${icon('more', { size: 22 })}</button>
    </header>
    ${goal ? `<div class="ex-goal">${icon('target', { size: 15, stroke: 2.2 })}<span class="goal-text">${goalText(goal, u)}</span><span class="goal-range">${goal.range[0]}–${goal.range[1]} reps</span></div>` : ''}
    <div class="set-head"><span>Set</span><span>Previous</span><span>${esc(u)}</span><span>Reps</span><span class="sr-only">Done</span></div>
    <div class="sets">${rows}</div>
    <button class="add-set" data-wk="add-set">${icon('plus', { size: 16, stroke: 2.4 })} Add Set</button>
  </article>`;
}

function rerenderCard(wexId) {
  const el = ctx?.sheet.body.querySelector(`.ex-card[data-wex="${CSS.escape(wexId)}"]`);
  const wex = ctx?.draft.exercises.find((x) => x.id === wexId);
  if (el && wex) el.outerHTML = renderCard(wex);
}

function rerenderAll() {
  if (!ctx) return;
  const scroller = ctx.sheet.body.querySelector('.sheet-scroll');
  const top = scroller?.scrollTop || 0;
  ctx.sheet.setContent(renderShell());
  const s2 = ctx.sheet.body.querySelector('.sheet-scroll');
  if (s2) s2.scrollTop = top;
  renderRest();
}

function refreshPlaceholders(cardEl, wex) {
  const { last } = cardContext(wex);
  cardEl.querySelectorAll('.set-row').forEach((row) => {
    const i = Number(row.dataset.set);
    const ph = placeholderFor(wex, i, last);
    row.querySelector('[data-f="w"]').placeholder = ph.w != null ? wInput(ph.w, unit()) : unit();
    row.querySelector('[data-f="r"]').placeholder = ph.r ?? 'reps';
  });
}

const save = () => { if (ctx?.mode === 'active') persist(); };

// ---- Interaction -----------------------------------------------------------------

function locate(el) {
  const card = el.closest('.ex-card');
  const wex = card && ctx.draft.exercises.find((x) => x.id === card.dataset.wex);
  const row = el.closest('.set-row');
  const i = row ? Number(row.dataset.set) : -1;
  return { card, wex, row, i, set: wex && i >= 0 ? wex.sets[i] : null };
}

function bindSheet(body) {
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-wk]');
    if (!btn || !ctx) return;
    const handler = handlers[btn.dataset.wk];
    if (handler) { e.preventDefault(); handler(btn, e); }
  });

  body.addEventListener('input', (e) => {
    if (!ctx) return;
    const t = e.target;
    if (t.matches('.set-in')) {
      const { card, wex, set } = locate(t);
      if (!set) return;
      const n = parseNumber(t.value);
      if (t.dataset.f === 'w') set.w = n == null ? null : fromUnit(n, unit());
      else set.r = n == null ? null : Math.round(n);
      refreshPlaceholders(card, wex);
      save();
    } else if (t.dataset.wkField === 'name') {
      ctx.draft.name = t.value.trim() || 'Workout';
      save();
    } else if (t.dataset.wkField === 'duration') {
      const mins = parseNumber(t.value);
      if (mins) ctx.draft.end = ctx.draft.start + mins * 60000;
    } else if (t.dataset.wkField === 'start') {
      const ms = new Date(t.value).getTime();
      if (Number.isFinite(ms)) {
        const dur = (ctx.draft.end || ctx.draft.start) - ctx.draft.start;
        ctx.draft.start = ms;
        ctx.draft.end = ms + dur;
      }
    }
  });

  // Return key on the weight field jumps to reps.
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('.set-in')) return;
    e.preventDefault();
    if (e.target.dataset.f === 'w') e.target.closest('.set-inner').querySelector('[data-f="r"]').focus();
    else e.target.blur();
  });

  // Select the whole value on focus so typing replaces it.
  body.addEventListener('focusin', (e) => {
    if (e.target.matches('.set-in')) setTimeout(() => e.target.select?.(), 0);
  });

  bindSwipeToDelete(body);
}

const handlers = {
  minimize() { ctx.sheet.close(); },

  async finish() { await finishWorkout(); },

  async discard() {
    const ok = await confirmAction({ title: 'Discard this workout?', message: 'Sets you logged in this session will be lost.', confirm: 'Discard Workout', destructive: true });
    if (!ok) return;
    db.active = null;
    commit();
    ctx?.sheet.close();
  },

  async 'add-exercise'() {
    const ids = await pickExercises();
    if (!ids.length || !ctx) return;
    for (const id of ids) ctx.draft.exercises.push(newWex(id));
    save();
    rerenderAll();
    const cards = ctx.sheet.body.querySelectorAll('.ex-card');
    cards[cards.length - ids.length]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  'add-set'(btn) {
    const { wex, card } = locate(btn);
    wex.sets.push({ w: null, r: null, done: false });
    save();
    rerenderCard(wex.id);
    const newCard = ctx.sheet.body.querySelector(`.ex-card[data-wex="${CSS.escape(wex.id)}"]`);
    if (card) newCard?.querySelector('.set-row:last-child [data-f="w"]')?.focus({ preventScroll: true });
  },

  fill(btn) {
    const { wex, set } = locate(btn);
    const { last } = cardContext(wex);
    const i = Number(btn.closest('.set-row').dataset.set);
    const prev = last?.sets[i];
    if (!prev || !set) return;
    set.w = prev.w; set.r = prev.r;
    save();
    rerenderCard(wex.id);
  },

  toggle(btn) {
    const { wex, set, row } = locate(btn);
    if (!set) return;
    if (set.done) {
      set.done = false;
    } else {
      const { last } = cardContext(wex);
      const ph = placeholderFor(wex, Number(row.dataset.set), last);
      if (set.w == null && ph.w != null) set.w = ph.w;
      if (set.r == null && ph.r != null) set.r = ph.r;
      if (!set.r) {
        row.classList.remove('shake');
        void row.offsetWidth;
        row.classList.add('shake');
        row.querySelector('[data-f="r"]').focus();
        return;
      }
      if (set.w == null) set.w = 0;
      set.done = true;
      if (ctx.mode === 'active') startRest();
      const pr = setPRType(set, cardContext(wex).bests);
      if (pr) toast(`New record · ${prLabel({ type: pr, w: set.w }, unit())}`, { iconName: 'trophy' });
    }
    save();
    rerenderCard(wex.id);
  },

  async 'ex-menu'(btn) {
    const { wex } = locate(btn);
    const list = ctx.draft.exercises;
    const idx = list.indexOf(wex);
    const options = [
      { label: 'View Progress', value: 'progress' },
      { label: 'Replace Exercise', value: 'replace' },
    ];
    if (idx > 0) options.push({ label: 'Move Up', value: 'up' });
    if (idx < list.length - 1) options.push({ label: 'Move Down', value: 'down' });
    options.push({ label: 'Remove Exercise', value: 'remove', style: 'destructive' });
    const choice = await actionSheet({ title: exName(wex.exId), options });
    if (!choice || !ctx) return;
    if (choice === 'progress') {
      if (ctx.mode === 'active') ctx.sheet.close();
      navigate(`progress/${wex.exId}`);
      return;
    }
    if (choice === 'replace') {
      const [id] = await pickExercises({ title: 'Replace Exercise', multi: false });
      if (!id || !ctx) return;
      wex.exId = id;
    } else if (choice === 'up' || choice === 'down') {
      const j = choice === 'up' ? idx - 1 : idx + 1;
      [list[idx], list[j]] = [list[j], list[idx]];
    } else if (choice === 'remove') {
      if (doneSets(wex).length) {
        const ok = await confirmAction({ title: `Remove ${exName(wex.exId)}?`, message: 'Its logged sets will be removed from this workout.', confirm: 'Remove', destructive: true });
        if (!ok || !ctx) return;
      }
      list.splice(list.indexOf(wex), 1);
    }
    save();
    rerenderAll();
  },

  'cancel-edit'() { ctx.sheet.close(); },

  'save-edit'() {
    const d = ctx.draft;
    cleanUp(d);
    if (!workoutSetCount(d)) { toast('Log at least one set first', { iconName: 'close' }); return; }
    d.end = d.end && d.end > d.start ? d.end : d.start + 60 * 60000;
    const isNew = ctx.isNew;
    d.prs = computePRs(d);
    const i = db.workouts.findIndex((w) => w.id === d.id);
    if (i >= 0) db.workouts[i] = d; else db.workouts.push(d);
    commit();
    ctx.sheet.close();
    toast(isNew ? 'Workout logged' : 'Workout saved');
    if (isNew) navigate(`history/${d.id}`);
  },

  async delete() {
    const ok = await confirmAction({ title: 'Delete this workout?', message: 'This can’t be undone.', confirm: 'Delete Workout', destructive: true });
    if (!ok || !ctx) return;
    db.workouts = db.workouts.filter((w) => w.id !== ctx.draft.id);
    commit();
    ctx.sheet.close();
    navigate('history', { replace: true });
  },
};

/** Treat typed-but-unchecked sets as done, drop empty sets and exercises. */
function cleanUp(d) {
  for (const wex of d.exercises) {
    for (const s of wex.sets) if (!s.done && s.r > 0) { s.done = true; s.w = s.w ?? 0; }
    wex.sets = wex.sets.filter((s) => s.done && s.r > 0);
  }
  d.exercises = d.exercises.filter((wex) => wex.sets.length);
}

// ---- Swipe a set row left to delete it ---------------------------------------------

function bindSwipeToDelete(body) {
  let st = null;
  body.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.set-row');
    if (!row || e.button > 0) return;
    st = { row, x: e.clientX, y: e.clientY, dx: 0, active: false, id: e.pointerId };
  });
  body.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.active) {
      if (Math.abs(dy) > 12) { st = null; return; }
      if (dx < -12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        st.active = true;
        st.row.classList.add('swiping');
        try { st.row.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        document.activeElement?.blur?.();
      } else return;
    }
    st.dx = Math.min(0, dx);
    st.row.querySelector('.set-inner').style.transform = `translateX(${st.dx}px)`;
    st.row.classList.toggle('armed', st.dx < -90);
  });
  const end = () => {
    if (!st) return;
    const { row, dx, active } = st;
    st = null;
    if (!active) return;
    row.classList.remove('swiping');
    const inner = row.querySelector('.set-inner');
    if (dx < -90) {
      inner.style.transform = 'translateX(-100%)';
      row.classList.add('removing');
      setTimeout(() => {
        const { wex, i } = locate(row);
        if (!wex) return;
        wex.sets.splice(i, 1);
        save();
        rerenderCard(wex.id);
      }, 180);
    } else {
      inner.style.transform = '';
      row.classList.add('settling');
      setTimeout(() => row.classList.remove('settling'), 260);
    }
  };
  body.addEventListener('pointerup', end);
  body.addEventListener('pointercancel', end);
}

// ---- Rest timer ------------------------------------------------------------------

function startRest() {
  const secs = db.settings.rest;
  if (!secs) return;
  ctx.draft.rest = { endsAt: Date.now() + secs * 1000, total: secs };
  renderRest();
}

function stopRestTicker() { clearInterval(restTimer); restTimer = null; }

function renderRest() {
  const bar = ctx?.sheet.body.querySelector('.rest-bar');
  if (!bar) return;
  const rest = ctx.draft.rest;
  stopRestTicker();
  if (!rest) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.classList.remove('finished');
  bar.innerHTML = `<div class="rest-progress"><span></span></div>
    <button class="rest-btn" data-rest="-15">−15</button>
    <div class="rest-center"><span class="rest-label">Rest</span><span class="rest-time"></span></div>
    <button class="rest-btn" data-rest="15">+15</button>
    <button class="rest-btn skip" data-rest="skip">Skip</button>`;
  bar.onclick = (e) => {
    const b = e.target.closest('[data-rest]');
    if (!b || !ctx?.draft.rest) return;
    if (b.dataset.rest === 'skip') { ctx.draft.rest = null; save(); renderRest(); return; }
    const delta = Number(b.dataset.rest) * 1000;
    ctx.draft.rest.endsAt += delta;
    ctx.draft.rest.total = Math.max(5, ctx.draft.rest.total + delta / 1000);
    save();
    tick();
  };
  const fill = bar.querySelector('.rest-progress span');
  const time = bar.querySelector('.rest-time');
  const tick = () => {
    const r = ctx?.draft.rest;
    if (!r) { stopRestTicker(); return; }
    const left = Math.ceil((r.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      stopRestTicker();
      bar.classList.add('finished');
      bar.innerHTML = `<div class="rest-done">${icon('bolt', { size: 18, stroke: 2.2 })} Rest over — next set!</div>`;
      navigator.vibrate?.(300);
      ctx.draft.rest = null;
      save();
      setTimeout(() => { if (ctx && !ctx.draft.rest) bar.hidden = true; }, 4000);
      return;
    }
    time.textContent = fmtClock(left);
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / r.total))})`;
  };
  tick();
  restTimer = setInterval(tick, 250);
}

// ---- Finish ------------------------------------------------------------------------

async function finishWorkout() {
  const d = ctx.draft;
  const pending = d.exercises.reduce((n, wex) => n + wex.sets.filter((s) => !s.done && !(s.r > 0)).length, 0);
  const preview = JSON.parse(JSON.stringify(d));
  cleanUp(preview);
  if (!workoutSetCount(preview)) {
    const ok = await confirmAction({ title: 'No sets logged yet', message: 'Complete at least one set, or discard this workout.', confirm: 'Discard Workout', destructive: true });
    if (ok) { db.active = null; commit(); ctx?.sheet.close(); }
    return;
  }
  if (pending) {
    const ok = await confirmAction({
      title: 'Finish workout?',
      message: `${plural(pending, 'empty set')} will be left out.`,
      confirm: 'Finish Workout',
    });
    if (!ok) return;
  }
  cleanUp(d);
  d.end = Date.now();
  delete d.rest;
  d.prs = computePRs(d);
  db.workouts.push(d);
  db.active = null;
  commit();
  ctx?.sheet.close();
  showCompletion(d);
}

function showCompletion(w) {
  const u = unit();
  // Compare each exercise's best set with the last time you did it.
  let beaten = 0;
  let compared = 0;
  const highlights = w.exercises.map((wex) => {
    const top = topSet(doneSets(wex));
    const prev = lastSession(wex.exId, { excludeId: w.id, before: w.start, routineId: w.routineId });
    const prevTop = prev && topSet(prev.sets);
    let chip = '';
    if (prevTop) {
      compared++;
      const heavier = (top.w || 0) - (prevTop.w || 0);
      if (Math.abs(heavier) > 1e-6) {
        if (heavier > 0) beaten++;
        chip = deltaChip(heavier, { format: (v) => `${wVal(v, u)} ${u}` });
      } else {
        if (top.r > prevTop.r) beaten++;
        chip = deltaChip(top.r - prevTop.r, { format: (v) => plural(v, 'rep'), neutral: 'Same' });
      }
    }
    return `<li><span class="done-ex"><span>${esc(exName(wex.exId))}</span><span class="muted">${esc(plural(doneSets(wex).length, 'set'))} · best ${esc(fmtSet(top, u))}</span></span>${chip}</li>`;
  }).join('');

  const sheet = openSheet({
    kind: 'page',
    label: 'Workout complete',
    content: `<div class="sheet-scroll done-sheet">
      <div class="done-badge ${w.prs.length ? '' : 'ok'}">${icon(w.prs.length ? 'trophy' : 'check', { size: 40, stroke: 2.2 })}</div>
      <h2>${w.prs.length ? 'New records!' : 'Workout complete'}</h2>
      <p class="muted">${esc(w.name)} · ${esc(fmtDateLong(w.start))}</p>
      <div class="stat-grid three">
        <div><span class="stat-label">Time</span><span class="stat-value">${esc(fmtDuration(w.end - w.start))}</span></div>
        <div><span class="stat-label">Sets</span><span class="stat-value">${workoutSetCount(w)}</span></div>
        <div><span class="stat-label">Records</span><span class="stat-value">${w.prs.length}</span></div>
      </div>
      ${compared ? `<div class="done-compare ${beaten ? 'up' : 'down'}">${icon(beaten ? 'arrowUp' : 'check', { size: 16, stroke: 2.6 })}
        <span>${beaten ? `You beat last time on ${beaten} of ${compared} exercises` : 'You matched last time. Next time, aim for one more rep.'}</span></div>` : ''}
      ${w.prs.length ? `<section class="card list"><h4 class="card-title">Personal records</h4>${w.prs.map((p) => `<div class="row pr-row">${icon('trophy', { size: 18, stroke: 2.2, cls: 'gold' })}
          <span class="row-main"><span>${esc(exName(p.exId))}</span><span class="row-sub">${esc(prLabel(p, u))}</span></span>
          <span class="row-value">${esc(fmtSet(p, u))}</span></div>`).join('')}</section>` : ''}
      <section class="card list"><h4 class="card-title">Exercises</h4><ul class="done-list">${highlights}</ul></section>
      <p class="footnote baseline-note">${icon('check', { size: 14, stroke: 2.6 })} Saved. These sets are your baseline for next time.</p>
      ${!w.routineId ? '<button class="btn tinted wide" data-done="routine">Save as Routine</button>' : ''}
      <button class="btn filled wide" data-done="close">Done</button>
    </div>`,
  });
  sheet.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-done]');
    if (!b) return;
    if (b.dataset.done === 'routine') {
      saveAsRoutine(w);
      b.remove();
      toast('Saved as routine');
    } else sheet.close();
  });
}

export function saveAsRoutine(w) {
  const r = {
    id: uid(),
    name: w.name,
    items: w.exercises.map((wex) => ({ exId: wex.exId, sets: Math.max(1, doneSets(wex).length || wex.sets.length), repMin: DEFAULT_REP_RANGE[0], repMax: DEFAULT_REP_RANGE[1] })),
  };
  db.routines.push(r);
  const stored = workoutById(w.id);
  if (stored && !stored.routineId) stored.routineId = r.id;
  commit();
  return r;
}

