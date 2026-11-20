// Progress tab: every exercise you've trained, and a per-exercise page with the
// week-by-week trend, records and a full weekly log.

import { db, exById } from '../store.js';
import {
  esc, fmtSet, fmtMonthDay, fmtMonth, fmtWeekLabel, fmtWeekRange, wVal, toUnit,
  fmtRelativeDay, fmtFullDate, plural, addDays, fmtNumber,
} from '../format.js';
import { icon } from '../icons.js';
import { chartSlot, sparkline } from '../charts.js';
import { onAction, onInput, emptyState, deltaChip, segmented, goalText } from '../ui.js';
import { trainedExercises, weeklyFor, bestsFor, suggestNext, weekOf, sessionsFor } from '../stats.js';

const prefs = { range: '6m' };

function relWeek(week) {
  const label = fmtWeekLabel(week, db.settings.weekStart);
  return /Week$/.test(label) ? label.toLowerCase() : label;
}

const isBodyweight = (weeks) => weeks.every((w) => !w.top?.w);

/** Change between two weekly top sets, phrased the way a lifter thinks about it. */
function topSetDelta(cur, prev, u) {
  if (!cur || !prev) return '';
  if (cur.w && prev.w && Math.abs(cur.w - prev.w) > 1e-9) {
    return deltaChip(cur.w - prev.w, { format: (v) => `${wVal(v, u)} ${u}` });
  }
  return deltaChip(cur.r - prev.r, { format: (v) => plural(v, 'rep'), neutral: 'Same' });
}

export function progressView() {
  const u = db.settings.unit;
  const trained = trainedExercises();
  if (!trained.length) {
    return {
      title: 'Progress',
      body: emptyState({
        iconName: 'chart',
        title: 'Nothing to chart yet',
        text: 'After your first workout, every exercise gets its own page with your weight and reps week by week.',
        button: '<a class="btn tinted" href="#/plan">Start a Workout</a>',
      }),
    };
  }

  const rows = trained.map(({ exId, last }) => {
    const ex = exById(exId);
    const weeks = weeklyFor(exId);
    const cur = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    const bw = isBodyweight(weeks);
    const spark = weeks.slice(-10).map((w) => (bw ? w.maxReps : w.top.w));
    return `<a class="row prog-row" href="#/progress/${esc(exId)}" data-name="${esc((ex?.name || '').toLowerCase())}">
      <span class="row-main"><span class="row-title">${esc(ex?.name || 'Deleted exercise')}</span>
      <span class="row-sub">${esc(fmtSet(cur.top, u))} · ${esc(fmtRelativeDay(last))}</span></span>
      ${spark.length > 1 ? sparkline(spark) : ''}
      <span class="prog-delta">${prev ? topSetDelta(cur.top, prev.top, u) : '<span class="delta new">New</span>'}</span>
      ${icon('chevronRight', { size: 16, stroke: 2.4, cls: 'chev' })}
    </a>`;
  }).join('');

  return {
    title: 'Progress',
    body: `<div class="search-field">${icon('search', { size: 17 })}<input type="search" data-input="prog-search" placeholder="Search exercises" autocomplete="off"></div>
      <p class="section-note pad">Your best set of the latest week and how it changed from the week before.</p>
      <section class="card list prog-list">${rows}</section>
      <p class="no-results" hidden>No exercises match.</p>`,
  };
}

onInput('prog-search', (el) => {
  const q = el.value.trim().toLowerCase();
  let any = false;
  document.querySelectorAll('.prog-row').forEach((r) => {
    const show = !q || r.dataset.name.includes(q);
    r.hidden = !show;
    if (show) any = true;
  });
  const none = document.querySelector('.no-results');
  if (none) none.hidden = any;
});

// ---- Exercise page -----------------------------------------------------------------
// Simple on purpose: weight and reps, week by week. One range filter scopes both
// charts, which sit on the same weeks (never one chart with two scales).

const RANGES = [['3m', '3M', 13], ['6m', '6M', 26], ['1y', '1Y', 52], ['all', 'All', Infinity]];

function lineSpec(weeks, { value, tip, fmtY, endLabel, height }) {
  const spanDays = weeks.length ? (weeks[weeks.length - 1].week - weeks[0].week) / 864e5 : 0;
  return {
    type: 'line',
    height,
    compact: true,
    points: weeks.map((w) => ({ x: w.week, y: value(w), tip: tip(w) })),
    fmtY,
    fmtX: (ms) => (spanDays > 200 ? fmtMonth(ms) : fmtMonthDay(ms)),
    endLabel,
  };
}

export function exerciseProgressView(exId) {
  const ex = exById(exId);
  if (!ex) return null;
  const u = db.settings.unit;
  const all = weeklyFor(exId);
  const base = { title: ex.name, eyebrow: ex.muscle.toUpperCase(), back: { href: 'progress', label: 'Progress' } };

  if (!all.length) {
    return { ...base, body: emptyState({ iconName: 'chart', title: 'No sets logged yet', text: `Add ${ex.name} to a workout and your progress will appear here.` }) };
  }

  const bw = isBodyweight(all);
  const [, , rangeWeeks] = RANGES.find(([k]) => k === prefs.range) || RANGES[1];
  const since = rangeWeeks === Infinity ? -Infinity : weekOf(addDays(Date.now(), -7 * (rangeWeeks - 1)));
  const weeks = all.filter((w) => w.week >= since);
  const latest = weeks[weeks.length - 1];

  const cur = all[all.length - 1];
  const prev = all[all.length - 2];
  const bests = bestsFor(exId);
  const recentRoutine = sessionsFor(exId)[0]?.workout.routineId || null;
  const next = suggestNext(exId, { unit: u, routineId: recentRoutine });
  const fmtW = (kg) => `${wVal(kg, u)} ${u}`;
  const when = (w) => `Week of ${fmtMonthDay(w.week)}`;

  const hero = `<section class="card hero-card">
      <div class="hero-label">${esc(fmtWeekLabel(cur.week, db.settings.weekStart))} · best set</div>
      <div class="hero-value">${esc(fmtSet(cur.top, u))}</div>
      <div class="hero-delta">${prev ? `${topSetDelta(cur.top, prev.top, u)}<span>vs ${esc(relWeek(prev.week))}</span>` : '<span>Your first week. This is your baseline.</span>'}</div>
      ${next ? `<div class="hero-next">${icon('target', { size: 16, stroke: 2.2 })}<span class="goal-text">${goalText(next, u)}</span></div>` : ''}
    </section>`;

  const filter = `<div class="filter-row range-filter">${segmented('range', RANGES.map(([k, l]) => [k, l]), prefs.range, { action: 'prog-range' })}</div>`;

  const charts = `<section class="card chart-card">
      ${weeks.length ? `${bw ? '' : `
        <div class="card-head"><h4 class="card-title">Weight</h4></div>
        <p class="card-sub">Heaviest set each week</p>
        ${chartSlot(lineSpec(weeks, { height: 170, value: (w) => toUnit(w.top.w, u), tip: (w) => [fmtSet(w.top, u), when(w)], fmtY: (v) => fmtNumber(v, 1), endLabel: fmtW(latest.top.w) }), { label: `Heaviest weight per week, latest ${fmtW(latest.top.w)}. Every week is listed below.` })}`}
        <div class="card-head ${bw ? '' : 'second'}"><h4 class="card-title">Reps</h4></div>
        <p class="card-sub">${bw ? 'Most reps in one set each week' : 'Reps on that heaviest set'}</p>
        ${chartSlot(lineSpec(weeks, { height: 150, value: (w) => (bw ? w.maxReps : w.top.r), tip: (w) => [plural(bw ? w.maxReps : w.top.r, 'rep'), bw ? when(w) : `${when(w)} · with ${fmtW(w.top.w)}`], fmtY: (v) => fmtNumber(v), endLabel: plural(bw ? latest.maxReps : latest.top.r, 'rep') }), { label: 'Reps per week. Every week is listed below.' })}`
      : '<p class="chart-empty">No sessions in this time range.</p>'}
    </section>`;

  const records = [
    ...(bw ? [] : [['Heaviest weight', fmtSet(bests.maxWSet, u), bests.maxWDate]]),
    ['Most reps', bests.maxRepsSet ? fmtSet(bests.maxRepsSet, u) : plural(bests.maxReps, 'rep'), bests.maxRepsDate],
    ['Sessions', String(bests.sessions), null],
    ...(bw ? [['First logged', fmtFullDate(all[0].week), null]] : []),
  ];

  const weekRows = [...all].reverse().map((w, i, arr) => {
    const older = arr[i + 1];
    return `<div class="row wk-row">
      <span class="row-main"><span class="row-title">${esc(fmtWeekRange(w.week))}</span>
        <span class="row-sub sets-line">${esc(w.sets.map((x) => (x.w ? `${wVal(x.w, u)}×${x.r}` : `${x.r}`)).join('  ·  '))}</span></span>
      <span class="wk-right"><span class="row-value">${esc(fmtSet(w.top, u))}</span>${older ? topSetDelta(w.top, older.top, u) : ''}</span>
    </div>`;
  }).join('');

  return {
    ...base,
    body: `${hero}${filter}${charts}
      <div class="section-head"><h2>Personal bests</h2></div>
      <div class="record-grid">${records.map(([label, val, date]) => `<div class="record">
          <span class="record-label">${esc(label)}</span>
          <span class="record-value">${esc(val)}</span>
          ${date ? `<span class="record-date">${esc(fmtFullDate(date))}</span>` : ''}
        </div>`).join('')}</div>
      <div class="section-head"><h2>Week by week</h2><span class="section-note">${plural(all.length, 'week')}</span></div>
      <section class="card list">${weekRows}</section>`,
  };
}

onAction('prog-range', (el) => {
  prefs.range = el.dataset.value;
  document.dispatchEvent(new Event('rerender'));
});
