// Workout tab (start a workout, routines) and the routine editor.

import { db, commit, uid, exById, exName, routineById, addStarterProgram } from '../store.js';
import { STARTER_PROGRAMS } from '../data.js';
import { esc, fmtSet, fmtRelativeDay, plural } from '../format.js';
import { icon } from '../icons.js';
import { onAction, onInput, openSheet, actionSheet, confirmAction, toast, navigate } from '../ui.js';
import { startWorkout, openWorkoutSheet, editWorkout } from '../workout.js';
import { pickExercises } from '../picker.js';
import { lastSession, topSet, workoutsDesc } from '../stats.js';

function lastDone(routineId) {
  return workoutsDesc().find((w) => w.routineId === routineId) || null;
}

export function workoutTabView() {
  const routines = db.routines;
  const active = db.active
    ? `<section class="card active-card">
        <div class="active-pulse"></div>
        <div class="active-text"><strong>${esc(db.active.name)}</strong><span>In progress · <span data-elapsed="${db.active.start}"></span></span></div>
        <button class="pill-btn" data-action="resume-workout">Resume</button>
      </section>`
    : '';

  const cards = routines.map((r) => {
    const names = r.items.map((it) => exName(it.exId));
    const preview = names.slice(0, 3).join(' · ') + (names.length > 3 ? ` +${names.length - 3}` : '');
    const last = lastDone(r.id);
    return `<article class="routine-card">
      <button class="rc-main" data-action="routine-preview" data-id="${esc(r.id)}">
        <h3>${esc(r.name)}</h3>
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
    title: 'Workout',
    body: `${active}
      ${db.active ? '' : `<button class="btn filled wide big" data-action="quick-start">${icon('plus', { size: 20, stroke: 2.6 })} Start Empty Workout</button>`}
      <div class="section-head"><h2>Routines</h2><a class="text-btn" href="#/routines/new">${icon('plus', { size: 17, stroke: 2.4 })} New</a></div>
      ${routines.length ? `<div class="routine-grid">${cards}</div>` : `<section class="card empty-routines">
          <p>Routines are your workout templates: pick the exercises once, then start them in one tap.</p>
          <a class="btn tinted wide" href="#/routines/new">Create Routine</a>
          <div class="field-label">Or start with a proven program</div>
          ${starters}
        </section>`}
      <button class="btn plain wide" data-action="log-past">${icon('calendar', { size: 18 })} Log a Past Workout</button>`,
  };
}

onAction('routine-start', (el) => startWorkout({ routineId: el.dataset.id }));
onAction('log-past', () => editWorkout(null));
onAction('add-starter', (el) => {
  addStarterProgram(el.dataset.key);
  commit();
  toast('Routines added');
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
    const last = lastSession(it.exId);
    const top = last && topSet(last.sets);
    return `<div class="row">
      <span class="row-main"><span class="row-title">${esc(exName(it.exId))}</span>
      <span class="row-sub">${plural(it.sets, 'set')}${top ? ` · last best ${esc(fmtSet(top, u))}` : ''}</span></span>
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
      <span class="row-main"><span class="row-title">${esc(ex?.name || 'Deleted exercise')}</span><span class="row-sub">${esc(ex?.muscle || '')}</span></span>
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
      ${draft.items.length ? `<section class="card list sortable">${rows}</section>` : ''}
      <button class="btn tinted wide" data-action="re-add">${icon('plus', { size: 18, stroke: 2.4 })} Add Exercises</button>
      ${draft.isNew ? '' : '<button class="btn plain destructive wide" data-action="re-delete">Delete Routine</button>'}`,
    mount: (root) => bindReorder(root),
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

onAction('re-remove', (el) => {
  draft?.items.splice(Number(el.dataset.i), 1);
  rerender();
});

onAction('re-add', async () => {
  const ids = await pickExercises();
  if (!draft || !ids.length) return;
  for (const exId of ids) draft.items.push({ exId, sets: 3 });
  rerender();
});

onAction('re-cancel', () => {
  draft = null; draftFor = null;
  navigate('workout');
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
  navigate('workout');
});

onAction('re-delete', async () => {
  if (!draft) return;
  const ok = await confirmAction({ title: `Delete “${draft.name || 'this routine'}”?`, message: 'Past workouts stay in your history.', confirm: 'Delete Routine', destructive: true });
  if (!ok) return;
  db.routines = db.routines.filter((r) => r.id !== draft.id);
  draft = null; draftFor = null;
  commit();
  navigate('workout');
});

/** Drag the grip handle to reorder rows. */
function bindReorder(root) {
  const list = root.querySelector('.sortable');
  if (!list) return;
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    e.preventDefault();
    const row = handle.closest('.re-row');
    const rows = [...list.querySelectorAll('.re-row')];
    const from = rows.indexOf(row);
    const h = row.offsetHeight;
    const startY = e.clientY;
    let to = from;
    row.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dy = ev.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      rows.forEach((r, i) => {
        if (r === row) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -h;
        if (from > to && i < from && i >= to) shift = h;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      if (to !== from && draft) {
        const [item] = draft.items.splice(from, 1);
        draft.items.splice(to, 0, item);
      }
      rerender();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}
