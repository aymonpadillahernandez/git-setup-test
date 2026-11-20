// Plan tab (weekly schedule, routines) and the routine editor.

import { db, commit, uid, exById, exName, routineById, addStarterProgram, scheduledRoutine, removeRoutine } from '../store.js';
import { STARTER_PROGRAMS, DEFAULT_REP_RANGE } from '../data.js';
import { esc, fmtSet, fmtRelativeDay } from '../format.js';
import { icon } from '../icons.js';
import { onAction, onInput, openSheet, actionSheet, confirmAction, toast, navigate, segmented, bindSortable } from '../ui.js';
import { startWorkout, openWorkoutSheet, editWorkout } from '../workout.js';
import { pickExercises } from '../picker.js';
import { lastSession, topSet, workoutsDesc, todayPlan } from '../stats.js';

function lastDone(routineId) {
  return workoutsDesc().find((w) => w.routineId === routineId) || null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weekdays in display order (respecting the week-start setting). */
const weekdays = () => Array.from({ length: 7 }, (_, i) => (db.settings.weekStart + i) % 7);
const daysFor = (routineId) => weekdays().filter((d) => db.schedule[d] === routineId);

export function planView() {
  const routines = db.routines;
  const todayDow = new Date().getDay();
  const active = db.active
    ? `<section class="card active-card">
        <div class="active-pulse"></div>
        <div class="active-text"><strong>${esc(db.active.name)}</strong><span>In progress · <span data-elapsed="${db.active.start}"></span></span></div>
        <button class="pill-btn" data-action="resume-workout">Resume</button>
      </section>`
    : '';

  const rotation = db.settings.planMode !== 'schedule';
  const plan = routines.length ? todayPlan() : null;
  const modeSwitch = routines.length ? `<div class="section-head"><h2>How you train</h2></div>
    <div class="filter-row plan-mode">${segmented('planMode', [['rotation', 'In order'], ['schedule', 'Fixed days']], rotation ? 'rotation' : 'schedule', { action: 'plan-mode' })}</div>
    <p class="footnote">${rotation
      ? 'Train as many days a week as you like. Today always shows the next workout in your order, after the last one you did. After the last one, it starts again from the first.'
      : 'Each workout belongs to a weekday. The Today tab shows that day’s workout, and offers a missed one again on your next free day.'}</p>` : '';

  const schedule = routines.length && !rotation ? `<div class="section-head"><h2>Weekly schedule</h2></div>
    <section class="card list">${weekdays().map((d) => {
      const r = scheduledRoutine(d);
      return `<button class="row sched-row" data-action="sched-day" data-day="${d}">
        <span class="row-main"><span class="row-title">${DAY_NAMES[d]}${d === todayDow ? ' <span class="today-badge">Today</span>' : ''}</span></span>
        <span class="sched-value ${r ? 'on' : ''}">${r ? esc(r.name) : 'Rest'}</span>
        ${icon('chevronRight', { size: 16, stroke: 2.4, cls: 'chev' })}
      </button>`;
    }).join('')}</section>
    ` : '';

  const cards = routines.map((r, i) => {
    const names = r.items.map((it) => exName(it.exId));
    const preview = names.slice(0, 3).join(' · ') + (names.length > 3 ? ` +${names.length - 3}` : '');
    const last = lastDone(r.id);
    const days = daysFor(r.id).map((d) => DAY_NAMES[d].slice(0, 3)).join(' · ');
    const isNext = rotation && plan?.upNext?.id === r.id;
    return `<article class="routine-card ${isNext ? 'next' : ''}">
      ${rotation ? `<span class="drag-handle" aria-label="Reorder">${icon('grip', { size: 20, stroke: 2 })}</span><span class="rc-num">${i + 1}</span>` : ''}
      <button class="rc-main" data-action="routine-preview" data-id="${esc(r.id)}">
        <h3>${esc(r.name)}${!rotation && days ? ` <span class="rc-days">${esc(days)}</span>` : ''}${isNext ? ' <span class="rc-next">Next</span>' : ''}</h3>
        <p class="rc-ex">${esc(preview || 'No exercises yet')}</p>
        <p class="rc-last">${icon('calendar', { size: 13, stroke: 2.2 })} ${last ? esc(fmtRelativeDay(last.start)) : 'Not done yet'}</p>
      </button>
      <button class="rc-start" data-action="routine-start" data-id="${esc(r.id)}" aria-label="Start ${esc(r.name)}">${icon('play', { size: 16 })}</button>
    </article>`;
  }).join('');

  const starters = `<div class="starter-list">${Object.entries(STARTER_PROGRAMS).map(([key, p]) => `
      <button class="row starter" data-action="add-starter" data-key="${key}">
        <span class="row-main"><span class="row-title">${esc(p.label)}</span><span class="row-sub">${esc(p.detail)}</span></span>
        ${icon('plus', { size: 18, stroke: 2.4, cls: 'accent' })}
      </button>`).join('')}</div>`;

  return {
    title: 'Plan',
    body: `${active}
      ${modeSwitch}
      ${schedule}
      <div class="section-head"><h2>${rotation && routines.length ? 'Your order' : 'Routines'}</h2>${rotation && routines.length > 1 ? '<span class="section-note">Drag to reorder</span>' : ''}<a class="text-btn" href="#/routines/new">${icon('plus', { size: 17, stroke: 2.4 })} New</a></div>
      ${routines.length ? `<div class="routine-grid ${rotation ? 'sortable' : ''}">${cards}</div>` : `<section class="card empty-routines">
          <p>Routines are your workout templates: pick the exercises and rep ranges once, give each a day, and Lift has it ready every time.</p>
          <a class="btn tinted wide" href="#/routines/new">Create Routine</a>
          <div class="field-label">Or start with a proven program</div>
          ${starters}
        </section>`}
      ${db.active ? '' : `<button class="btn plain wide" data-action="quick-start">${icon('plus', { size: 18, stroke: 2.4 })} Start Empty Workout</button>`}
      <button class="btn plain wide" data-action="log-past">${icon('calendar', { size: 18 })} Log a Past Workout</button>`,
    mount: (root) => bindSortable(root.querySelector('.routine-grid.sortable'), {
      row: '.routine-card',
      onMove: (from, to) => {
        if (from === to) return;
        const [r] = db.routines.splice(from, 1);
        db.routines.splice(to, 0, r);
        commit();
      },
    }),
  };
}

onAction('plan-mode', (el) => {
  db.settings.planMode = el.dataset.value === 'schedule' ? 'schedule' : 'rotation';
  commit();
});

onAction('sched-day', async (el) => {
  const d = Number(el.dataset.day);
  const choice = await actionSheet({
    title: DAY_NAMES[d],
    options: [
      ...db.routines.map((r) => ({ label: r.name, value: r.id, style: db.schedule[d] === r.id ? 'bold' : '' })),
      { label: 'Rest Day', value: '__rest' },
    ],
  });
  if (!choice) return;
  if (choice === '__rest') delete db.schedule[d];
  else db.schedule[d] = choice;
  commit();
});

onAction('routine-start', (el) => startWorkout({ routineId: el.dataset.id }));
onAction('log-past', () => editWorkout(null));
onAction('add-starter', (el) => {
  addStarterProgram(el.dataset.key);
  commit();
  toast('Routines and schedule added');
});

/** Ask which routine to start (used by Summary). */
export async function chooseAndStart() {
  if (db.active) { openWorkoutSheet(); return; }
  if (!db.routines.length) { startWorkout(); return; }
  const choice = await actionSheet({
    title: 'Start Workout',
    options: [
      ...db.routines.map((r) => ({ label: r.name, value: r.id })),
      { label: 'Empty Workout', value: '__empty' },
    ],
  });
  if (!choice) return;
  startWorkout({ routineId: choice === '__empty' ? null : choice });
}
onAction('go-start', () => chooseAndStart());

onAction('routine-preview', (el) => {
  const r = routineById(el.dataset.id);
  if (!r) return;
  const u = db.settings.unit;
  const rows = r.items.map((it) => {
    const last = lastSession(it.exId, { routineId: r.id });
    const top = last && topSet(last.sets);
    return `<div class="row">
      <span class="row-main"><span class="row-title">${esc(exName(it.exId))}</span>
      <span class="row-sub">${it.sets} × ${it.repMin}–${it.repMax} reps${top ? ` · last best ${esc(fmtSet(top, u))}` : ''}</span></span>
    </div>`;
  }).join('');
  const sheet = openSheet({
    kind: 'auto',
    label: r.name,
    content: `<header class="sheet-nav">
        <button class="nav-btn" data-p="close">Close</button>
        <div class="sheet-title">${esc(r.name)}</div>
        <button class="nav-btn" data-p="edit">Edit</button>
      </header>
      <div class="sheet-scroll sheet-pad">
        <section class="card list flush">${rows || '<div class="row"><span class="row-sub">No exercises yet. Tap Edit to add some.</span></div>'}</section>
        <button class="btn filled wide big" data-p="start" ${r.items.length ? '' : 'disabled'}>${icon('play', { size: 18 })} Start Workout</button>
      </div>`,
  });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    sheet.close();
    if (b.dataset.p === 'edit') navigate(`routines/${r.id}`);
    if (b.dataset.p === 'start') startWorkout({ routineId: r.id });
  });
});

// ---- Routine editor ----------------------------------------------------------

let draft = null;
let draftFor = null;

export function routineEditorView(id) {
  if (draftFor !== id || !draft) {
    if (id === 'new') draft = { id: uid(), name: '', items: [], isNew: true };
    else {
      const r = routineById(id);
      if (!r) return null;
      draft = JSON.parse(JSON.stringify(r));
    }
    draftFor = id;
  }
  const rows = draft.items.map((it, i) => {
    const ex = exById(it.exId);
    return `<div class="row re-row" data-i="${i}">
      <span class="drag-handle" aria-label="Reorder">${icon('grip', { size: 20, stroke: 2 })}</span>
      <button class="row-main re-target" data-action="re-target" data-i="${i}"><span class="row-title">${esc(ex?.name || 'Deleted exercise')}</span><span class="row-sub accent">${it.repMin}–${it.repMax} reps ${icon('chevronRight', { size: 12, stroke: 2.6 })}</span></button>
      <span class="stepper">
        <button data-action="re-sets" data-i="${i}" data-d="-1" aria-label="Fewer sets" ${it.sets <= 1 ? 'disabled' : ''}>${icon('minus', { size: 15, stroke: 2.6 })}</button>
        <span class="stepper-val">${it.sets}<small> ${it.sets === 1 ? 'set' : 'sets'}</small></span>
        <button data-action="re-sets" data-i="${i}" data-d="1" aria-label="More sets" ${it.sets >= 10 ? 'disabled' : ''}>${icon('plus', { size: 15, stroke: 2.6 })}</button>
      </span>
      <button class="icon-btn small danger" data-action="re-remove" data-i="${i}" aria-label="Remove">${icon('close', { size: 16, stroke: 2.4 })}</button>
    </div>`;
  }).join('');

  return {
    title: draft.isNew ? 'New Routine' : 'Edit Routine',
    large: false,
    left: '<button class="nav-btn" data-action="re-cancel">Cancel</button>',
    right: '<button class="nav-btn bold" data-action="re-save">Save</button>',
    body: `<section class="card form-card">
        <input class="field big" data-input="re-name" value="${esc(draft.name)}" placeholder="Routine name (e.g. Push Day)" maxlength="40" autocomplete="off">
      </section>
      <div class="section-head"><h2>Exercises</h2>${draft.items.length > 1 ? '<span class="section-note">Drag to reorder</span>' : ''}</div>
      ${draft.items.length ? '<p class="footnote top">Tap an exercise to set its rep range. When every set reaches the top of the range, Lift tells you to add weight.</p>' : ''}
      ${draft.items.length ? `<section class="card list sortable">${rows}</section>` : ''}
      <button class="btn tinted wide" data-action="re-add">${icon('plus', { size: 18, stroke: 2.4 })} Add Exercises</button>
      ${draft.isNew ? '' : '<button class="btn plain destructive wide" data-action="re-delete">Delete Routine</button>'}`,
    mount: (root) => bindSortable(root.querySelector('.sortable'), {
      row: '.re-row',
      onMove: (from, to) => {
        if (to !== from && draft) {
          const [item] = draft.items.splice(from, 1);
          draft.items.splice(to, 0, item);
        }
        rerender();
      },
    }),
  };
}

function rerender() { document.dispatchEvent(new Event('rerender')); }

onInput('re-name', (el) => { if (draft) draft.name = el.value; });

onAction('re-sets', (el) => {
  const it = draft?.items[Number(el.dataset.i)];
  if (!it) return;
  it.sets = Math.max(1, Math.min(10, it.sets + Number(el.dataset.d)));
  rerender();
});

const REP_PRESETS = [[3, 5, 'Strength'], [5, 8, 'Strength'], [6, 10, 'Strength & size'], [8, 12, 'Muscle growth'], [10, 15, 'Muscle growth'], [12, 20, 'Endurance']];

onAction('re-target', (el) => {
  const it = draft?.items[Number(el.dataset.i)];
  if (!it) return;
  const render = () => `<header class="sheet-nav">
      <span class="nav-btn-spacer"></span>
      <div class="sheet-title">${esc(exName(it.exId))}</div>
      <button class="nav-btn bold" data-t="done">Done</button>
    </header>
    <div class="sheet-pad">
      <div class="field-label">Rep range</div>
      <div class="chips">${REP_PRESETS.map(([a, b]) => `<button class="chip ${a === it.repMin && b === it.repMax ? 'on' : ''}" data-t="preset" data-a="${a}" data-b="${b}">${a}–${b}</button>`).join('')}</div>
      <section class="card list flush range-card">
        <div class="row"><span class="row-main"><span class="row-title">Minimum reps</span></span>
          <span class="stepper"><button data-t="min" data-d="-1" ${it.repMin <= 1 ? 'disabled' : ''} aria-label="Fewer">${icon('minus', { size: 15, stroke: 2.6 })}</button><span class="stepper-val">${it.repMin}</span><button data-t="min" data-d="1" ${it.repMin >= it.repMax ? 'disabled' : ''} aria-label="More">${icon('plus', { size: 15, stroke: 2.6 })}</button></span></div>
        <div class="row"><span class="row-main"><span class="row-title">Maximum reps</span></span>
          <span class="stepper"><button data-t="max" data-d="-1" ${it.repMax <= it.repMin ? 'disabled' : ''} aria-label="Fewer">${icon('minus', { size: 15, stroke: 2.6 })}</button><span class="stepper-val">${it.repMax}</span><button data-t="max" data-d="1" ${it.repMax >= 30 ? 'disabled' : ''} aria-label="More">${icon('plus', { size: 15, stroke: 2.6 })}</button></span></div>
        <div class="row"><span class="row-main"><span class="row-title">Sets</span></span>
          <span class="stepper"><button data-t="sets" data-d="-1" ${it.sets <= 1 ? 'disabled' : ''} aria-label="Fewer">${icon('minus', { size: 15, stroke: 2.6 })}</button><span class="stepper-val">${it.sets}</span><button data-t="sets" data-d="1" ${it.sets >= 10 ? 'disabled' : ''} aria-label="More">${icon('plus', { size: 15, stroke: 2.6 })}</button></span></div>
      </section>
      <p class="footnote">${REP_PRESETS.find(([a, b]) => a === it.repMin && b === it.repMax)?.[2] ? `${REP_PRESETS.find(([a, b]) => a === it.repMin && b === it.repMax)[2]} range. ` : ''}Each session, aim for one more rep. Once all ${it.sets} sets reach ${it.repMax} reps, add weight and start again at ${it.repMin}.</p>
    </div>`;
  const sheet = openSheet({ kind: 'auto', label: 'Rep range', content: render(), onClose: rerender });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const t = b.dataset.t;
    if (t === 'done') { sheet.close(); return; }
    if (t === 'preset') { it.repMin = Number(b.dataset.a); it.repMax = Number(b.dataset.b); }
    const d = Number(b.dataset.d);
    if (t === 'min') it.repMin = Math.max(1, Math.min(it.repMax, it.repMin + d));
    if (t === 'max') it.repMax = Math.max(it.repMin, Math.min(30, it.repMax + d));
    if (t === 'sets') it.sets = Math.max(1, Math.min(10, it.sets + d));
    sheet.setContent(render());
  });
});

onAction('re-remove', (el) => {
  draft?.items.splice(Number(el.dataset.i), 1);
  rerender();
});

onAction('re-add', async () => {
  const ids = await pickExercises();
  if (!draft || !ids.length) return;
  for (const exId of ids) draft.items.push({ exId, sets: 3, repMin: DEFAULT_REP_RANGE[0], repMax: DEFAULT_REP_RANGE[1] });
  rerender();
});

onAction('re-cancel', () => {
  draft = null; draftFor = null;
  navigate('plan');
});

onAction('re-save', () => {
  if (!draft) return;
  const name = draft.name.trim();
  if (!name) {
    const input = document.querySelector('[data-input="re-name"]');
    input?.focus();
    toast('Give your routine a name', { iconName: 'edit' });
    return;
  }
  const { isNew, ...routine } = draft;
  routine.name = name;
  const i = db.routines.findIndex((r) => r.id === routine.id);
  if (i >= 0) db.routines[i] = routine; else db.routines.push(routine);
  draft = null; draftFor = null;
  commit();
  toast(isNew ? 'Routine created' : 'Routine saved');
  navigate('plan');
});

onAction('re-delete', async () => {
  if (!draft) return;
  const ok = await confirmAction({ title: `Delete “${draft.name || 'this routine'}”?`, message: 'Past workouts stay in your history.', confirm: 'Delete Routine', destructive: true });
  if (!ok) return;
  removeRoutine(draft.id);
  draft = null; draftFor = null;
  commit();
  navigate('plan');
});
