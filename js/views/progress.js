// Progress tab: every exercise you've trained, and a per-exercise page with the
// week-by-week trend, records and a full weekly log.

import { db, exById } from '../store.js';
import {
  esc, fmtSet, fmtMonthDay, fmtMonth, fmtWeekLabel, fmtWeekRange, fmtVolume, wVal, toUnit,
  fmtCompact, fmtRelativeDay, fmtFullDate, plural, addDays, fmtNumber,
} from '../format.js';
import { icon } from '../icons.js';
import { chartSlot, sparkline } from '../charts.js';
import { onAction, onInput, emptyState, deltaChip, segmented, goalText } from '../ui.js';
import { trainedExercises, weeklyFor, bestsFor, suggestNext, weekOf, sessionsFor, FORMULAS, e1rm } from '../stats.js';

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
    const spark = weeks.slice(-10).map((w) => (bw ? w.maxReps : w.e1rm));
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
      <p class="section-note pad">Top set of the latest week, change vs the week before, and the 10-week trend.</p>
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
// One range filter scopes every chart below it. Weight and reps get their own small
// charts that sit side by side on the same weeks (never a dual-axis chart), and
// estimated 1RM combines the two into a single strength trend.

const RANGES = [['3m', '3M', 13], ['6m', '6M', 26], ['1y', '1Y', 52], ['all', 'All', Infinity]];

function lineSpec(weeks, { value, tip, fmtY, endLabel, height, compact = false }) {
  const spanDays = weeks.length ? (weeks[weeks.length - 1].week - weeks[0].week) / 864e5 : 0;
  return {
    type: 'line',
    height,
    compact,
    points: weeks.map((w) => ({ x: w.week, y: value(w), tip: tip(w) })),
    fmtY,
    fmtX: (ms) => (spanDays > 200 ? fmtMonth(ms) : fmtMonthDay(ms)),
    endLabel,
  };
}

/** Weekly volume including empty weeks, so gaps in training are visible. */
function volumeBars(weeks, u) {
  if (!weeks.length) return [];
  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  const bars = [];
  for (let wk = weeks[0].week; wk <= weeks[weeks.length - 1].week; wk = weekOf(addDays(wk, 7))) {
    const w = byWeek.get(wk);
    bars.push({
      label: fmtMonthDay(wk),
      value: toUnit(w?.volume || 0, u),
      highlight: wk === weeks[weeks.length - 1].week,
      tip: [w ? fmtVolume(w.volume, u) : 'No sessions', `Week of ${fmtMonthDay(wk)}${w ? ` · ${plural(w.sets.length, 'set')}` : ''}`],
    });
  }
  return bars;
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
  const first = weeks[0];
  const latest = weeks[weeks.length - 1];

  const cur = all[all.length - 1];
  const prev = all[all.length - 2];
  const bests = bestsFor(exId);
  const recentRoutine = sessionsFor(exId)[0]?.workout.routineId || null;
  const next = suggestNext(exId, { unit: u, routineId: recentRoutine });
  const formula = FORMULAS[db.settings.formula] || FORMULAS.epley;
  const fmtW = (v) => `${fmtNumber(v, u === 'lb' ? 1 : 2)} ${u}`;
  const fmtE = (kg) => `${fmtNumber(toUnit(kg, u))} ${u}`; // est. 1RM: whole numbers

  // ---- Hero
  const hero = `<section class="card hero-card">
      <div class="hero-label">${esc(fmtWeekLabel(cur.week, db.settings.weekStart))} · top set</div>
      <div class="hero-value">${esc(fmtSet(cur.top, u))}</div>
      <div class="hero-delta">${prev ? `${topSetDelta(cur.top, prev.top, u)}<span>vs ${esc(relWeek(prev.week))}</span>` : '<span>Your first week. This is your baseline.</span>'}</div>
      ${next ? `<div class="hero-next">${icon('target', { size: 16, stroke: 2.2 })}<span class="goal-text">${goalText(next, u)}</span>${bw ? '' : `<span class="goal-range">${next.range[0]}–${next.range[1]} reps</span>`}</div>` : ''}
    </section>`;

  // ---- Range filter (scopes everything below)
  const filter = `<div class="filter-row range-filter">${segmented('range', RANGES.map(([k, l]) => [k, l]), prefs.range, { action: 'prog-range' })}</div>`;

  // ---- Stat tiles for the selected range
  const change = (a, b) => (a && b && weeks.length > 1 ? ((b - a) / a) * 100 : null);
  const strengthChange = bw ? change(first?.maxReps, latest?.maxReps) : change(first?.e1rm, latest?.e1rm);
  const sessionsInRange = weeks.reduce((n, w) => n + w.sessions.length, 0);
  const tiles = weeks.length ? `<div class="tiles">
      <div class="tile"><span class="tile-label">${bw ? 'Best set' : 'Est. 1RM'}</span><span class="tile-value">${esc(bw ? plural(latest.maxReps, 'rep') : `${fmtCompact(toUnit(latest.e1rm, u))} ${u}`)}</span><span class="tile-label">latest week</span></div>
      <div class="tile"><span class="tile-label">${bw ? 'Reps' : 'Strength'}</span><span class="tile-value">${strengthChange == null ? '—' : `${strengthChange >= 0 ? '+' : '−'}${fmtNumber(Math.abs(strengthChange), Math.abs(strengthChange) < 10 ? 1 : 0)}%`}</span><span class="tile-label">${strengthChange == null ? 'need 2+ weeks' : `since ${esc(fmtMonthDay(first.week))}`}</span></div>
      <div class="tile"><span class="tile-label">Sessions</span><span class="tile-value">${sessionsInRange}</span><span class="tile-label">${esc(plural(weeks.length, 'week'))} trained</span></div>
    </div>` : '';

  const empty = '<p class="chart-empty">No sessions in this time range.</p>';
  const when = (w) => `Week of ${fmtMonthDay(w.week)}`;

  // ---- Strength (est. 1RM): weight and reps combined
  const strengthCard = bw ? '' : `<section class="card chart-card">
      <div class="card-head"><h4 class="card-title">Strength · estimated 1RM</h4></div>
      <p class="card-sub">Weight and reps combined into one number, best set each week</p>
      ${weeks.length ? chartSlot(lineSpec(weeks, {
        height: 200,
        value: (w) => toUnit(w.e1rm, u),
        tip: (w) => [fmtE(w.e1rm), `${when(w)} · from ${fmtSet(w.sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a)), u)}`],
        fmtY: (v) => fmtCompact(v),
        endLabel: fmtE(latest.e1rm),
      }), { label: `Estimated one-rep max per week, latest ${fmtE(latest.e1rm)}. Values are listed in the week-by-week table.` }) : empty}
      <p class="formula-note">${esc(formula.label)} formula: est. 1RM = ${esc(formula.text)}</p>
    </section>`;

  // ---- Weight & reps as small multiples (same weeks, separate scales)
  const weightRepsCard = `<section class="card chart-card">
      <div class="card-head"><h4 class="card-title">${bw ? 'Reps' : 'Weight & reps'}</h4></div>
      <p class="card-sub">${bw ? 'Best set and total reps each week' : 'Your heaviest set each week'}</p>
      ${weeks.length ? (bw ? `
        <div class="mini-label">Best set</div>
        ${chartSlot(lineSpec(weeks, { height: 140, compact: true, value: (w) => w.maxReps, tip: (w) => [plural(w.maxReps, 'rep'), when(w)], fmtY: (v) => fmtNumber(v), endLabel: plural(latest.maxReps, 'rep') }), { label: 'Most reps in one set per week' })}
        <div class="mini-label">Total reps</div>
        ${chartSlot(lineSpec(weeks, { height: 140, compact: true, value: (w) => w.reps, tip: (w) => [plural(w.reps, 'rep'), `${when(w)} · ${plural(w.sets.length, 'set')}`], fmtY: (v) => fmtNumber(v), endLabel: plural(latest.reps, 'rep') }), { label: 'Total reps per week' })}`
      : `
        <div class="mini-label">Weight (${esc(u)})</div>
        ${chartSlot(lineSpec(weeks, { height: 150, compact: true, value: (w) => toUnit(w.top.w, u), tip: (w) => [fmtSet(w.top, u), when(w)], fmtY: (v) => fmtCompact(v), endLabel: fmtW(toUnit(latest.top.w, u)) }), { label: `Top set weight per week, latest ${fmtW(toUnit(latest.top.w, u))}` })}
        <div class="mini-label">Reps (on that set)</div>
        ${chartSlot(lineSpec(weeks, { height: 130, compact: true, value: (w) => w.top.r, tip: (w) => [plural(w.top.r, 'rep'), `${when(w)} · at ${fmtW(toUnit(w.top.w, u))}`], fmtY: (v) => fmtNumber(v), endLabel: plural(latest.top.r, 'rep') }), { label: `Reps on the top set per week, latest ${latest.top.r}` })}`) : empty}
    </section>`;

  // ---- Volume
  const volumeCard = bw ? '' : `<section class="card chart-card">
      <div class="card-head"><h4 class="card-title">Volume</h4></div>
      <p class="card-sub">Sets × reps × weight, each week</p>
      ${weeks.length ? chartSlot({
        type: 'columns',
        height: 160,
        fmtY: (v) => fmtCompact(v),
        valueLabel: fmtCompact(toUnit(latest.volume, u)),
        bars: volumeBars(weeks, u),
      }, { label: `Weekly volume, latest ${fmtVolume(latest.volume, u)}` }) : empty}
    </section>`;

  // ---- Records
  const records = bw
    ? [
      ['Most reps', plural(bests.maxReps, 'rep'), bests.maxRepsDate],
      ['Sessions', String(bests.sessions), null],
    ]
    : [
      ['Heaviest weight', fmtSet(bests.maxWSet, u), bests.maxWDate],
      ['Best est. 1RM', `${fmtCompact(toUnit(bests.maxE1rm, u))} ${u}`, bests.maxE1rmDate],
      ['Most reps', plural(bests.maxReps, 'rep'), bests.maxRepsDate],
      ['Best session volume', fmtVolume(bests.maxVol, u), bests.maxVolDate],
    ];

  // ---- Week by week (newest first): every set's weight × reps
  const weekRows = [...all].reverse().map((w, i, arr) => {
    const older = arr[i + 1];
    return `<div class="row wk-row">
      <span class="row-main"><span class="row-title">${esc(fmtWeekRange(w.week))}</span>
        <span class="row-sub sets-line">${esc(w.sets.map((x) => (x.w ? `${wVal(x.w, u)}×${x.r}` : `${x.r}`)).join('  ·  '))}</span>
        ${bw ? '' : `<span class="row-sub wk-stats">1RM ${esc(fmtCompact(toUnit(w.e1rm, u)))} · vol ${esc(fmtVolume(w.volume, u))}</span>`}</span>
      <span class="wk-right"><span class="row-value">${esc(fmtSet(w.top, u))}</span>${older ? topSetDelta(w.top, older.top, u) : ''}</span>
    </div>`;
  }).join('');

  return {
    ...base,
    body: `${hero}${filter}${tiles}${strengthCard}${weightRepsCard}${volumeCard}
      <div class="section-head"><h2>Personal records</h2></div>
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
