// App state, persisted to localStorage. All weights are stored in kilograms.
//
// Shape:
// {
//   version, settings: { unit, weeklyGoal, weekStart, rest, onboarded },
//   exercises: [{ id, name, muscle }],
//   routines:  [{ id, name, items: [{ exId, sets }] }],
//   workouts:  [{ id, name, routineId, start, end, exercises: [{ id, exId, sets: [{ w, r, done }] }], prs }],
//   active:    workout-in-progress | null  (same shape as a workout, plus `rest`)
//   meta:      { created, lastBackup }
// }

import { DEFAULT_EXERCISES, STARTER_PROGRAMS } from './data.js';

const KEY = 'lift:data';
const VERSION = 1;

export let db = load();
let revision = 0;
const listeners = new Set();

export const rev = () => revision;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fresh() {
  return {
    version: VERSION,
    settings: { unit: 'kg', weeklyGoal: 3, weekStart: 1, rest: 90, onboarded: false },
    exercises: DEFAULT_EXERCISES.map(([id, name, muscle]) => ({ id, name, muscle })),
    routines: [],
    workouts: [],
    active: null,
    meta: { created: Date.now(), lastBackup: null },
  };
}

/** Fill in anything missing so older saves and imported backups keep working. */
export function normalize(data) {
  const base = fresh();
  if (!data || typeof data !== 'object') return base;
  const out = {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    meta: { ...base.meta, ...(data.meta || {}) },
  };
  out.exercises = Array.isArray(data.exercises) ? data.exercises.filter((e) => e && e.id && e.name) : base.exercises;
  out.routines = Array.isArray(data.routines) ? data.routines.filter((r) => r && r.id) : [];
  out.workouts = Array.isArray(data.workouts) ? data.workouts.filter((w) => w && w.id && Array.isArray(w.exercises)) : [];
  out.routines.forEach((r) => { r.items = Array.isArray(r.items) ? r.items : []; });
  out.workouts.forEach((w) => { w.prs = Array.isArray(w.prs) ? w.prs : []; });
  out.active = data.active && Array.isArray(data.active.exercises) ? data.active : null;
  out.version = VERSION;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : fresh();
  } catch (err) {
    console.error('Could not read saved data', err);
    return fresh();
  }
}

/** Save without notifying views (use while the user is typing). */
export function persist() {
  revision++;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (err) {
    console.error(err);
    alert('Could not save your data. Your phone storage may be full.');
  }
}

/** Save and re-render whatever is listening. */
export function commit() {
  persist();
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceAll(data) {
  db = normalize(data);
  commit();
}

export function resetAll() {
  db = fresh();
  commit();
}

// ---- Lookups --------------------------------------------------------------

export const exById = (id) => db.exercises.find((e) => e.id === id);
export const exName = (id) => exById(id)?.name ?? 'Deleted exercise';
export const routineById = (id) => db.routines.find((r) => r.id === id);
export const workoutById = (id) => db.workouts.find((w) => w.id === id);

// ---- Mutations --------------------------------------------------------------

export function addExercise(name, muscle) {
  const ex = { id: `c-${uid()}`, name: name.trim(), muscle: muscle || 'Other', custom: true };
  db.exercises.push(ex);
  commit();
  return ex;
}

export function addStarterProgram(key) {
  const program = STARTER_PROGRAMS[key];
  if (!program) return;
  for (const [name, exIds] of program.routines) {
    db.routines.push({ id: uid(), name, items: exIds.map((exId) => ({ exId, sets: 3 })) });
  }
}

/** Ask the browser not to evict our storage (best effort). */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
