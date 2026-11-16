// Training statistics derived from the workout log.

import { db, rev, routineById, scheduledRoutine } from './store.js';
import { startOfWeek, startOfDay, addDays, KG_PER_LB, wVal } from './format.js';
import { DEFAULT_REP_RANGE } from './data.js';

export const doneSets = (wex) => wex.sets.filter((s) => s.done && s.r > 0);

export function workoutSetCount(workout) {
  return workout.exercises.reduce((n, ex) => n + doneSets(ex).length, 0);
}

/** Heaviest set; ties go to more reps. Bodyweight sets compare by reps. */
export function topSet(sets) {
  let best = null;
  for (const s of sets) {
    if (!best || (s.w || 0) > (best.w || 0) || ((s.w || 0) === (best.w || 0) && s.r > best.r)) best = s;
  }
  return best;
}

export const weekOf = (ms) => startOfWeek(ms, db.settings.weekStart);

// ---- Memoized views of the log ------------------------------------------------

let memoRev = -1;
let memo = {};
function cached(key, compute) {
  if (memoRev !== rev()) { memo = {}; memoRev = rev(); }
  if (!(key in memo)) memo[key] = compute();
  return memo[key];
}

/** Completed workouts, newest first. */
export function workoutsDesc() {
  return cached('desc', () => [...db.workouts].sort((a, b) => b.start - a.start));
}

/** Every completed session of an exercise, newest first: [{ workout, sets }]. */
export function sessionsFor(exId) {
  return cached(`s:${exId}`, () => {
    const out = [];
    for (const w of workoutsDesc()) {
      const sets = [];
      for (const wex of w.exercises) if (wex.exId === exId) sets.push(...doneSets(wex));
      if (sets.length) out.push({ workout: w, sets });
    }
    return out;
  });
}

/**
 * Most recent session strictly before `before` (ms), ignoring workout `excludeId`.
 * With `routineId`, the last time this exercise was done in that routine wins
 * (so "last week's Push" is the baseline for this week's Push), falling back to any session.
 */
export function lastSession(exId, { excludeId, before = Infinity, routineId = null } = {}) {
  const ok = (s) => s.workout.id !== excludeId && s.workout.start < before;
  const list = sessionsFor(exId);
  return (routineId && list.find((s) => ok(s) && s.workout.routineId === routineId)) || list.find(ok) || null;
}

const wKey = (w) => (w || 0).toFixed(3);

/**
 * All-time bests from sessions before `before`, ignoring `excludeId`:
 * heaviest set, most reps in one set, and the most reps done at each weight.
 */
export function bestsFor(exId, { excludeId, before = Infinity } = {}) {
  const b = { maxW: 0, maxWSet: null, maxWDate: null, maxReps: 0, maxRepsSet: null, maxRepsDate: null, sessions: 0, repsAt: new Map() };
  for (const { workout, sets } of sessionsFor(exId)) {
    if (workout.id === excludeId || workout.start >= before) continue;
    b.sessions++;
    for (const s of sets) {
      if ((s.w || 0) > b.maxW || (s.w && s.w === b.maxW && s.r > (b.maxWSet?.r || 0))) {
        b.maxW = s.w || 0; b.maxWSet = s; b.maxWDate = workout.start;
      }
      if (s.r > b.maxReps) { b.maxReps = s.r; b.maxRepsSet = s; b.maxRepsDate = workout.start; }
      const k = wKey(s.w);
      if (s.r > (b.repsAt.get(k) || 0)) b.repsAt.set(k, s.r);
    }
  }
  return b;
}

/**
 * Is this set a personal record compared with earlier workouts?
 * - 'weight': heavier than ever before
 * - 'reps':   more reps than ever at a weight you've used before (or bodyweight)
 */
export function setPRType(set, bests) {
  if (!set || !set.done || !set.r || !bests || bests.sessions === 0) return null;
  if (set.w > 0 && set.w > bests.maxW + 1e-9) return 'weight';
  const prev = bests.repsAt.get(wKey(set.w));
  if (prev != null && set.r > prev) return 'reps';
  return null;
}

/** Plain-language label for a record. */
export function prLabel(pr, unit) {
  if (pr.type === 'weight') return 'Heaviest weight';
  if (pr.type === 'reps') return pr.w ? `Most reps with ${wVal(pr.w, unit)} ${unit}` : 'Most reps';
  return 'New best';
}

/** Personal records set in `workout` compared with everything before it. One per exercise. */
export function computePRs(workout) {
  const prs = [];
  const seen = new Set();
  for (const wex of workout.exercises) {
    if (seen.has(wex.exId)) continue;
    seen.add(wex.exId);
    const sets = workout.exercises.filter((x) => x.exId === wex.exId).flatMap(doneSets);
    if (!sets.length) continue;
    const prior = bestsFor(wex.exId, { excludeId: workout.id, before: workout.start });
    if (prior.sessions === 0) continue;
    const top = topSet(sets);
    if (top.w > 0 && top.w > prior.maxW + 1e-9) {
      prs.push({ exId: wex.exId, type: 'weight', w: top.w, r: top.r });
      continue;
    }
    // Heaviest set that beat the rep record at its weight.
    const repPRs = sets.filter((s) => setPRType({ ...s, done: true }, prior) === 'reps');
    if (repPRs.length) {
      const best = topSet(repPRs);
      prs.push({ exId: wex.exId, type: 'reps', w: best.w || 0, r: best.r });
    }
  }
  return prs;
}

/** Per-week summary of one exercise, oldest first. */
export function weeklyFor(exId) {
  return cached(`wk:${exId}`, () => {
    const map = new Map();
    for (const { workout, sets } of sessionsFor(exId)) {
      const week = weekOf(workout.start);
      if (!map.has(week)) map.set(week, { week, sets: [], sessions: [] });
      const entry = map.get(week);
      entry.sessions.unshift({ workout, sets });
      entry.sets.unshift(...sets);
    }
    return [...map.values()].sort((a, b) => a.week - b.week).map((wk) => {
      const top = topSet(wk.sets);
      const maxReps = Math.max(...wk.sets.map((s) => s.r));
      return { ...wk, top, maxReps };
    });
  });
}

/** Weekly totals for the last `n` weeks (oldest first), including empty weeks. */
export function weeklyTotals(n = 8) {
  return cached(`tot:${n}:${db.settings.weekStart}`, () => {
    const current = weekOf(Date.now());
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
      weeks.push({ week: weekOf(addDays(current, -7 * i)), workouts: 0, sets: 0, duration: 0 });
    }
    const byWeek = new Map(weeks.map((w) => [w.week, w]));
    for (const w of db.workouts) {
      const entry = byWeek.get(weekOf(w.start));
      if (!entry) continue;
      entry.workouts++;
      entry.sets += workoutSetCount(w);
      entry.duration += Math.max(0, (w.end || w.start) - w.start);
    }
    return weeks;
  });
}

/** Consecutive weeks hitting the weekly goal. The current week only counts once it is met. */
export function goalStreak() {
  return cached(`streak:${db.settings.weeklyGoal}:${db.settings.weekStart}`, () => {
    const goal = db.settings.weeklyGoal;
    const counts = new Map();
    for (const w of db.workouts) {
      const k = weekOf(w.start);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let week = weekOf(Date.now());
    let streak = (counts.get(week) || 0) >= goal ? 1 : 0;
    for (;;) {
      week = weekOf(addDays(week, -1));
      if ((counts.get(week) || 0) >= goal) streak++;
      else break;
    }
    return streak;
  });
}

/** Exercises that have at least one logged session, most recently trained first. */
export function trainedExercises() {
  return cached('trained', () => {
    const seen = new Map();
    for (const w of workoutsDesc()) {
      for (const wex of w.exercises) {
        if (!seen.has(wex.exId) && doneSets(wex).length) seen.set(wex.exId, w.start);
      }
    }
    return [...seen.entries()].map(([exId, last]) => ({ exId, last }));
  });
}

/** Recent personal records across all workouts, newest first. */
export function recentPRs(limit = 5) {
  const out = [];
  for (const w of workoutsDesc()) {
    for (const pr of w.prs || []) {
      out.push({ ...pr, date: w.start, workoutId: w.id });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Rep range for an exercise: from the given routine, else any routine using it, else 8–12. */
export function repRangeFor(exId, routineId = null) {
  const fromRoutine = (r) => r?.items.find((it) => it.exId === exId);
  const item = fromRoutine(routineId && routineById(routineId))
    || db.routines.map(fromRoutine).find(Boolean);
  return item ? [item.repMin, item.repMax] : DEFAULT_REP_RANGE;
}

/**
 * What to aim for next time, using double progression (the most common way to
 * progress with a rep range): add reps until every set at your top weight reaches
 * the top of the range, then add weight and start again at the bottom of the range.
 * Returns { w, r, kind: 'reps' | 'weight' | 'allSets', range } or null.
 */
export function suggestNext(exId, { excludeId, before, routineId = null, unit } = {}) {
  const last = lastSession(exId, { excludeId, before, routineId });
  if (!last) return null;
  const top = topSet(last.sets);
  if (!top) return null;
  const range = repRangeFor(exId, routineId);
  const [min, max] = range;
  if (!top.w) return { w: 0, r: top.r + 1, kind: 'reps', range };
  const atTop = last.sets.filter((s) => Math.abs((s.w || 0) - top.w) < 1e-6);
  if (atTop.every((s) => s.r >= max)) {
    const step = unit === 'lb' ? 5 * KG_PER_LB : 2.5;
    return { w: top.w + step, r: min, kind: 'weight', range };
  }
  if (top.r >= max) return { w: top.w, r: max, kind: 'allSets', range };
  return { w: top.w, r: Math.max(min, top.r + 1), kind: 'reps', range };
}

// ---- Workout of the day ----------------------------------------------------------

export const hasSchedule = () => Object.keys(db.schedule).some((d) => scheduledRoutine(Number(d)));

/**
 * What to train today.
 * - 'rotation' mode (default): routines are done in order, any number of days a week.
 *   Today = the routine after the last one you completed (Day 5 wraps to Day 1).
 * - 'schedule' mode: today's planned routine; on an unplanned day, the first routine
 *   planned earlier this week that hasn't been done yet (catch-up), else rest.
 * Returns { mode, kind: 'today' | 'catchup' | 'rest' | 'next' | 'none', routine, upNext,
 *           cycle: { index, total }, todayWorkout, nextPlanned, catchupDay, week }.
 */
export function todayPlan(now = Date.now()) {
  const mode = db.settings.planMode === 'schedule' && hasSchedule() ? 'schedule' : 'rotation';
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const weekStart = weekOf(now);
  const weekEnd = addDays(weekStart, 7);
  const todays = workoutsDesc().filter((w) => w.start >= dayStart && w.start < dayEnd);
  const thisWeek = workoutsDesc().filter((w) => w.start >= weekStart && w.start < weekEnd);
  const doneThisWeek = (routineId) => thisWeek.some((w) => w.routineId === routineId);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const next = addDays(day, 1);
    week.push({
      day,
      weekday: new Date(day).getDay(),
      routine: mode === 'schedule' ? scheduledRoutine(new Date(day).getDay()) : null,
      workouts: thisWeek.filter((w) => w.start >= day && w.start < next),
      isToday: day === dayStart,
      isPast: day < dayStart,
    });
  }

  let kind = 'none';
  let routine = null;
  let nextPlanned = null;
  let catchupDay = null;
  let upNext = null;
  let cycle = null;

  if (mode === 'schedule') {
    routine = scheduledRoutine(new Date(now).getDay());
    if (routine) kind = 'today';
    else {
      const missed = week.find((d) => d.isPast && d.routine && !doneThisWeek(d.routine.id));
      if (missed) { kind = 'catchup'; routine = missed.routine; catchupDay = missed.day; }
      else kind = 'rest';
    }
    for (let i = 1; i <= 7; i++) {
      const day = addDays(dayStart, i);
      const r = scheduledRoutine(new Date(day).getDay());
      if (r) { nextPlanned = { day, routine: r }; break; }
    }
  } else if (db.routines.length) {
    const last = workoutsDesc().find((w) => w.routineId && routineById(w.routineId));
    const idx = last ? db.routines.findIndex((r) => r.id === last.routineId) : -1;
    upNext = db.routines[(idx + 1) % db.routines.length];
    const doneTodayRoutine = todays.find((w) => w.routineId && routineById(w.routineId));
    routine = doneTodayRoutine ? routineById(doneTodayRoutine.routineId) : upNext;
    cycle = { index: db.routines.indexOf(upNext), total: db.routines.length };
    kind = 'next';
  }

  const todayWorkout = (routine && todays.find((w) => w.routineId === routine.id)) || todays[0] || null;
  return { mode, kind, routine, upNext, cycle, todayWorkout, nextPlanned, catchupDay, week };
}
