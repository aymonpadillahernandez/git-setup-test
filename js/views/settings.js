// Settings, exercise library management, backup / restore.

import { db, commit, persist, replaceAll, resetAll, exById } from '../store.js';
import { MUSCLES } from '../data.js';
import { esc, fmtRelativeDay, plural } from '../format.js';
import { icon } from '../icons.js';
import { onAction, onInput, segmented, actionSheet, confirmAction, toast, navigate } from '../ui.js';
import { newExerciseSheet } from '../picker.js';
import { sessionsFor, FORMULAS, recomputeAllPRs } from '../stats.js';

const REST_OPTIONS = [[0, 'Off'], [30, '30 s'], [45, '45 s'], [60, '1 min'], [90, '1 min 30 s'], [120, '2 min'], [150, '2 min 30 s'], [180, '3 min'], [240, '4 min'], [300, '5 min']];

export function settingsView() {
  const s = db.settings;
  return {
    title: 'Settings',
    large: false,
    back: { href: 'today', label: 'Today' },
    body: `<div class="section-head"><h2>Training</h2></div>
      <section class="card list">
        <div class="row"><span class="row-main"><span class="row-title">Units</span></span>${segmented('unit', [['kg', 'kg'], ['lb', 'lb']], s.unit)}</div>
        <div class="row"><span class="row-main"><span class="row-title">Weekly goal</span><span class="row-sub">Workouts per week</span></span>
          <span class="stepper">
            <button data-action="goal" data-d="-1" aria-label="Lower goal" ${s.weeklyGoal <= 1 ? 'disabled' : ''}>${icon('minus', { size: 15, stroke: 2.6 })}</button>
            <span class="stepper-val">${s.weeklyGoal}</span>
            <button data-action="goal" data-d="1" aria-label="Raise goal" ${s.weeklyGoal >= 7 ? 'disabled' : ''}>${icon('plus', { size: 15, stroke: 2.6 })}</button>
          </span></div>
        <div class="row"><span class="row-main"><span class="row-title">Week starts on</span></span>${segmented('weekStart', [[1, 'Mon'], [0, 'Sun']], s.weekStart)}</div>
        <label class="row"><span class="row-main"><span class="row-title">Rest timer</span><span class="row-sub">Starts when you complete a set</span></span>
          <select class="select" data-input="rest">${REST_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === s.rest ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="row"><span class="row-main"><span class="row-title">Strength formula</span><span class="row-sub">Estimated 1-rep max</span></span>
          <select class="select" data-input="formula">${Object.entries(FORMULAS).map(([k, f]) => `<option value="${k}" ${k === s.formula ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
      </section>
      <p class="footnote">${esc(FORMULAS[s.formula]?.label || 'Epley')}: est. 1RM = ${esc(FORMULAS[s.formula]?.text || FORMULAS.epley.text)}. It combines weight and reps into one strength number, so you can compare 80 kg × 5 with 70 kg × 10. Most accurate for sets of 1–10 reps.</p>
      <section class="card list">
        <a class="row" href="#/settings/exercises"><span class="row-main"><span class="row-title">Exercises</span></span><span class="row-value">${db.exercises.length}</span>${icon('chevronRight', { size: 16, stroke: 2.4, cls: 'chev' })}</a>
      </section>

      <div class="section-head"><h2>Your data</h2></div>
      <section class="card list">
        <button class="row" data-action="export"><span class="row-icon accent">${icon('upload', { size: 19 })}</span><span class="row-main"><span class="row-title">Export Backup</span>
          <span class="row-sub">Last backup: ${db.meta.lastBackup ? esc(fmtRelativeDay(db.meta.lastBackup)) : 'never'}</span></span></button>
        <label class="row"><span class="row-icon accent">${icon('download', { size: 19 })}</span><span class="row-main"><span class="row-title">Restore from Backup</span></span>
          <input type="file" accept=".json,application/json" data-input="import" hidden></label>
      </section>
      <p class="footnote">Everything is stored privately on this device, with no account and no cloud. Export a backup now and then and save it to Files or iCloud Drive.</p>
      <section class="card list"><button class="row destructive" data-action="erase"><span class="row-main"><span class="row-title">Erase All Data</span></span></button></section>
      <p class="footnote center">Lift · ${plural(db.workouts.length, 'workout')} logged</p>`,
  };
}

onAction('segment', (el) => {
  const { name, value } = el.dataset;
  if (name === 'unit') db.settings.unit = value === 'lb' ? 'lb' : 'kg';
  else if (name === 'weekStart') db.settings.weekStart = Number(value);
  else return;
  commit();
});

onAction('goal', (el) => {
  db.settings.weeklyGoal = Math.max(1, Math.min(7, db.settings.weeklyGoal + Number(el.dataset.d)));
  commit();
});

onInput('rest', (el, e) => {
  if (e.type !== 'change') return;
  db.settings.rest = Number(el.value) || 0;
  persist();
  toast(db.settings.rest ? 'Rest timer updated' : 'Rest timer off', { iconName: 'timer' });
});

onInput('formula', (el, e) => {
  if (e.type !== 'change' || !FORMULAS[el.value]) return;
  db.settings.formula = el.value;
  commit();
  recomputeAllPRs();
  commit();
});

onAction('export', async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify({ app: 'lift', exportedAt: Date.now(), data: db }, null, 1);
  const name = `lift-backup-${stamp}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Lift backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    db.meta.lastBackup = Date.now();
    commit();
    toast('Backup exported');
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Export failed', { iconName: 'close' });
  }
});

onInput('import', async (el, e) => {
  if (e.type !== 'change' || !el.files?.[0]) return;
  try {
    const parsed = JSON.parse(await el.files[0].text());
    const data = parsed?.data ?? parsed;
    if (!data || !Array.isArray(data.workouts) || !Array.isArray(data.exercises)) throw new Error('Not a Lift backup');
    const ok = await confirmAction({
      title: 'Replace all data?',
      message: `This backup has ${plural(data.workouts.length, 'workout')} and ${plural(data.routines?.length || 0, 'routine')}. Everything currently on this device will be replaced.`,
      confirm: 'Restore Backup',
      destructive: true,
    });
    if (!ok) return;
    replaceAll({ ...data, settings: { ...data.settings, onboarded: true } });
    toast('Backup restored');
  } catch (err) {
    toast('That file isn’t a valid backup', { iconName: 'close' });
  } finally {
    el.value = '';
  }
});

onAction('erase', async () => {
  const ok = await confirmAction({ title: 'Erase all data?', message: 'All workouts, routines and settings will be deleted from this device. Export a backup first if you want to keep them.', confirm: 'Erase Everything', destructive: true });
  if (!ok) return;
  resetAll();
  location.hash = '#/today';
  location.reload();
});

// ---- Exercise library ----------------------------------------------------------------

export function exerciseManagerView() {
  const groups = MUSCLES.map((m) => [m, db.exercises.filter((e) => (MUSCLES.includes(e.muscle) ? e.muscle : 'Other') === m).sort((a, b) => a.name.localeCompare(b.name))])
    .filter(([, list]) => list.length);
  return {
    title: 'Exercises',
    large: false,
    back: { href: 'settings', label: 'Settings' },
    right: `<button class="icon-btn" data-action="ex-new" aria-label="New exercise">${icon('plus', { size: 24, stroke: 2.2 })}</button>`,
    body: groups.map(([m, list]) => `<div class="section-head"><h2>${esc(m)}</h2></div>
      <section class="card list">${list.map((e) => {
        const n = sessionsFor(e.id).length;
        return `<button class="row" data-action="ex-manage" data-id="${esc(e.id)}">
          <span class="row-main"><span class="row-title">${esc(e.name)}</span>${n ? `<span class="row-sub">${plural(n, 'session')}</span>` : ''}</span>
          ${icon('more', { size: 20, cls: 'chev' })}
        </button>`;
      }).join('')}</section>`).join(''),
  };
}

onAction('ex-new', async () => {
  const ex = await newExerciseSheet('');
  if (ex) toast(`${ex.name} added`);
});

onAction('ex-manage', async (el) => {
  const ex = exById(el.dataset.id);
  if (!ex) return;
  const n = sessionsFor(ex.id).length;
  const choice = await actionSheet({
    title: ex.name,
    options: [
      { label: 'Rename / Change Muscle', value: 'edit' },
      ...(n ? [{ label: 'View Progress', value: 'progress' }] : []),
      { label: 'Delete Exercise', value: 'delete', style: 'destructive' },
    ],
  });
  if (choice === 'edit') {
    const saved = await newExerciseSheet('', { existing: ex });
    if (saved) commit();
  } else if (choice === 'progress') {
    navigate(`progress/${ex.id}`);
  } else if (choice === 'delete') {
    if (n) {
      toast(`Can’t delete: used in ${plural(n, 'workout')}`, { iconName: 'close' });
      return;
    }
    const ok = await confirmAction({ title: `Delete ${ex.name}?`, message: 'It will also be removed from your routines.', confirm: 'Delete', destructive: true });
    if (!ok) return;
    db.exercises = db.exercises.filter((e) => e.id !== ex.id);
    db.routines.forEach((r) => { r.items = r.items.filter((it) => it.exId !== ex.id); });
    commit();
  }
});
