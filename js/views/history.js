// History tab: workouts grouped by week, and the workout detail page.

import { db, exName, workoutById } from '../store.js';
import {
  esc, fmtWeekLabel, fmtVolume, fmtDuration, fmtWeekday, fmtDayNum, fmtDateLong, fmtTime,
  fmtSet, fmtMonthDay, wVal, plural,
} from '../format.js';
import { icon } from '../icons.js';
import { onAction, emptyState, deltaChip, toast } from '../ui.js';
import {
  workoutsDesc, weekOf, workoutVolume, workoutSetCount, doneSets, topSet, lastSession,
  bestsFor, setPRType, PR_LABELS, setVolume,
} from '../stats.js';
import { editWorkout, saveAsRoutine, startWorkout } from '../workout.js';

export function historyView() {
  const u = db.settings.unit;
  const list = workoutsDesc();
  const groups = [];
  for (const w of list) {
    const wk = weekOf(w.start);
    let g = groups[groups.length - 1];
    if (!g || g.week !== wk) { g = { week: wk, items: [] }; groups.push(g); }
    g.items.push(w);
  }

  const body = groups.length ? groups.map((g) => {
    const vol = g.items.reduce((v, w) => v + workoutVolume(w), 0);
    return `<div class="section-head"><h2>${esc(fmtWeekLabel(g.week, db.settings.weekStart))}</h2>
        <span class="section-note">${plural(g.items.length, 'workout')} · ${esc(fmtVolume(vol, u))}</span></div>
      <section class="card list">${g.items.map((w) => `<a class="row hist-row" href="#/history/${esc(w.id)}">
          <span class="date-badge"><span class="dow">${esc(fmtWeekday(w.start).toUpperCase())}</span><span class="dnum">${esc(fmtDayNum(w.start))}</span></span>
          <span class="row-main"><span class="row-title">${esc(w.name)}</span>
            <span class="row-sub">${esc(fmtDuration((w.end || w.start) - w.start))} · ${plural(workoutSetCount(w), 'set')} · ${esc(fmtVolume(workoutVolume(w), u))}</span></span>
          ${w.prs?.length ? `<span class="pr-count" aria-label="${w.prs.length} records">${icon('trophy', { size: 15, stroke: 2.2 })}${w.prs.length}</span>` : ''}
          ${icon('chevronRight', { size: 16, stroke: 2.4, cls: 'chev' })}
        </a>`).join('')}</section>`;
  }).join('') : emptyState({
    iconName: 'history',
    title: 'No workouts yet',
    text: 'Finished workouts show up here, grouped by week.',
    button: '<a class="btn tinted" href="#/plan">Start a Workout</a>',
  });

  return {
    title: 'History',
    right: `<button class="icon-btn" data-action="log-past" aria-label="Log a past workout">${icon('plus', { size: 24, stroke: 2.2 })}</button>`,
    body,
  };
}

export function workoutDetailView(id) {
  const w = workoutById(id);
  if (!w) return null;
  const u = db.settings.unit;
  const prsByEx = new Map((w.prs || []).map((p) => [p.exId, p]));

  const cards = w.exercises.map((wex) => {
    const sets = doneSets(wex);
    if (!sets.length) return '';
    const prev = lastSession(wex.exId, { excludeId: w.id, before: w.start });
    const bests = bestsFor(wex.exId, { excludeId: w.id, before: w.start });
    const top = topSet(sets);
    const prevTop = prev && topSet(prev.sets);
    let compare = '';
    if (prevTop) {
      if (top.w && prevTop.w && Math.abs(top.w - prevTop.w) > 1e-9) {
        compare = `${deltaChip(top.w - prevTop.w, { format: (v) => `${wVal(v, u)} ${u}` })}<span>top set vs ${esc(fmtMonthDay(prev.workout.start))}</span>`;
      } else {
        compare = `${deltaChip(top.r - prevTop.r, { format: (v) => plural(v, 'rep'), neutral: 'Matched' })}<span>top set vs ${esc(fmtMonthDay(prev.workout.start))}</span>`;
      }
    }
    const pr = prsByEx.get(wex.exId);
    const vol = sets.reduce((v, s) => v + setVolume(s), 0);
    return `<section class="card ex-detail">
      <a class="ex-detail-head" href="#/progress/${esc(wex.exId)}">
        <span class="row-main"><span class="row-title">${esc(exName(wex.exId))}</span>
        <span class="row-sub">${plural(sets.length, 'set')}${vol ? ` · ${esc(fmtVolume(vol, u))}` : ''}</span></span>
        ${icon('chart', { size: 18, cls: 'accent' })}
      </a>
      ${compare ? `<div class="ex-compare">${compare}</div>` : ''}
      ${pr ? `<div class="ex-pr">${icon('trophy', { size: 15, stroke: 2.2 })} ${esc(PR_LABELS[pr.type])}</div>` : ''}
      <ol class="set-list">${sets.map((s, i) => {
        const isPr = setPRType(s, bests);
        return `<li><span class="set-num">${i + 1}</span><span class="set-val">${esc(fmtSet(s, u))}</span>${isPr ? `<span class="set-pr">${icon('trophy', { size: 13, stroke: 2.4 })}</span>` : ''}</li>`;
      }).join('')}</ol>
    </section>`;
  }).join('');

  return {
    title: w.name,
    eyebrow: `${fmtDateLong(w.start)} · ${fmtTime(w.start)}`.toUpperCase(),
    back: { href: 'history', label: 'History' },
    right: `<button class="nav-btn" data-action="edit-workout" data-id="${esc(w.id)}">Edit</button>`,
    body: `<div class="stat-grid four card">
        <div><span class="stat-label">Time</span><span class="stat-value">${esc(fmtDuration((w.end || w.start) - w.start))}</span></div>
        <div><span class="stat-label">Volume</span><span class="stat-value">${esc(fmtVolume(workoutVolume(w), u))}</span></div>
        <div><span class="stat-label">Sets</span><span class="stat-value">${workoutSetCount(w)}</span></div>
        <div><span class="stat-label">Records</span><span class="stat-value">${(w.prs || []).length}</span></div>
      </div>
      ${cards}
      <button class="btn tinted wide" data-action="repeat-workout" data-id="${esc(w.id)}">${icon('play', { size: 16 })} Do This Workout Again</button>
      ${w.routineId ? '' : `<button class="btn plain wide" data-action="workout-to-routine" data-id="${esc(w.id)}">Save as Routine</button>`}`,
  };
}

onAction('edit-workout', (el) => editWorkout(el.dataset.id));

onAction('workout-to-routine', (el) => {
  const w = workoutById(el.dataset.id);
  if (!w) return;
  saveAsRoutine(w);
  toast('Saved as routine');
});

onAction('repeat-workout', (el) => {
  const w = workoutById(el.dataset.id);
  if (!w) return;
  if (w.routineId && db.routines.some((r) => r.id === w.routineId)) {
    startWorkout({ routineId: w.routineId });
  } else {
    startWorkout({ template: { name: w.name, items: w.exercises.map((x) => ({ exId: x.exId, sets: doneSets(x).length || 3 })) } });
  }
});
