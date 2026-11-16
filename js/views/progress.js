// Progress tab: every exercise you've trained, and a per-exercise page with the
// week-by-week trend, records and a full weekly log.

import { db, exById } from '../store.js';
import {
  esc, fmtSet, fmtMonthDay, fmtMonth, fmtWeekLabel, fmtWeekRange, fmtVolume, wVal, toUnit,
  fmtCompact, fmtRelativeDay, fmtFullDate, plural, addDays, fmtNumber,
} from '../format.js';
import { icon } from '../icons.js';
import { chartSlot, sparkline } from '../charts.js';
import { onAction, onInput, emptyState, deltaChip, segmented } from '../ui.js';
import { trainedExercises, weeklyFor, bestsFor, suggestNext, weekOf } from '../stats.js';

const prefs = { metric: {}, range: '6m' };

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
        button: '<a class="btn tinted" href="#/workout">Start a Workout</a>',
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

const METRICS = {
  weight: { label: 'Weight', title: 'Heaviest set each week' },
  e1rm: { label: 'Est. 1RM', title: 'Estimated one-rep max each week' },
  volume: { label: 'Volume', title: 'Total volume each week' },
  reps: { label: 'Reps', title: 'Most reps in one set each week' },
  total: { label: 'Total Reps', title: 'Total reps each week' },
};

const RANGES = [['3m', '3M', 13], ['6m', '6M', 26], ['1y', '1Y', 52], ['all', 'All', Infinity]];

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
  const metricKeys = bw ? ['reps', 'total'] : ['weight', 'e1rm', 'volume', 'reps'];
  const metric = metricKeys.includes(prefs.metric[exId]) ? prefs.metric[exId] : metricKeys[0];
  const [, , rangeWeeks] = RANGES.find(([k]) => k === prefs.range) || RANGES[1];
  const since = rangeWeeks === Infinity ? -Infinity : weekOf(addDays(Date.now(), -7 * (rangeWeeks - 1)));
  const weeks = all.filter((w) => w.week >= since);

  const cur = all[all.length - 1];
  const prev = all[all.length - 2];
  const bests = bestsFor(exId);
  const next = suggestNext(exId, { unit: u });

  // ---- Hero
  const hero = `<section class="card hero-card">
      <div class="hero-label">${esc(fmtWeekLabel(cur.week, db.settings.weekStart))} · top set</div>
      <div class="hero-value">${esc(fmtSet(cur.top, u))}</div>
      <div class="hero-delta">${prev ? `${topSetDelta(cur.top, prev.top, u)}<span>vs ${esc(relWeek(prev.week))}</span>` : '<span>Your first week. This is your baseline.</span>'}</div>
      ${next ? `<div class="hero-next">${icon('target', { size: 16, stroke: 2.2 })}<span>Next time, go for <strong>${esc(fmtSet(next, u))}</strong></span></div>` : ''}
    </section>`;

  // ---- Chart
  const value = (w) => ({
    weight: toUnit(w.top.w, u),
    e1rm: toUnit(w.e1rm, u),
    volume: toUnit(w.volume, u),
    reps: w.maxReps,
    total: w.reps,
  }[metric]);
  const fmtValue = (v) => ({
    weight: `${fmtNumber(v, u === 'lb' ? 1 : 2)} ${u}`,
    e1rm: `${fmtCompact(v)} ${u}`,
    volume: `${fmtCompact(v)} ${u}`,
    reps: plural(v, 'rep'),
    total: plural(v, 'rep'),
  }[metric]);
  const tipFor = (w) => {
    const when = `Week of ${fmtMonthDay(w.week)}`;
    switch (metric) {
      case 'weight': return [fmtSet(w.top, u), when];
      case 'e1rm': return [`${fmtCompact(toUnit(w.e1rm, u))} ${u}`, `${when} · est. 1RM`];
      case 'volume': return [fmtVolume(w.volume, u), `${when} · ${plural(w.sets.length, 'set')}`];
      default: return [plural(value(w), 'rep'), when];
    }
  };
  const spanDays = weeks.length ? (weeks[weeks.length - 1].week - weeks[0].week) / 864e5 : 0;
  const chartHtml = weeks.length
    ? chartSlot({
      type: 'line',
      height: 220,
      points: weeks.map((w) => ({ x: w.week, y: value(w), tip: tipFor(w) })),
      fmtY: (v) => fmtCompact(v),
      fmtX: (ms) => (spanDays > 200 ? fmtMonth(ms) : fmtMonthDay(ms)),
      endLabel: fmtValue(value(weeks[weeks.length - 1])),
    }, { label: `${METRICS[metric].title}. Latest: ${fmtValue(value(weeks[weeks.length - 1]))}. The weekly table below lists every value.` })
    : '<p class="chart-empty">No sessions in this time range.</p>';

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

  // ---- Week by week (newest first)
  const weekRows = [...all].reverse().map((w, i, arr) => {
    const older = arr[i + 1];
    return `<div class="row wk-row">
      <span class="row-main"><span class="row-title">${esc(fmtWeekRange(w.week))}</span>
        <span class="row-sub sets-line">${esc(w.sets.map((s) => (s.w ? `${wVal(s.w, u)}×${s.r}` : `${s.r}`)).join('  ·  '))}</span></span>
      <span class="wk-right"><span class="row-value">${esc(fmtSet(w.top, u))}</span>${older ? topSetDelta(w.top, older.top, u) : ''}</span>
    </div>`;
  }).join('');

  return {
    ...base,
    body: `${hero}
      <div class="filter-row">
        ${segmented(`metric:${exId}`, metricKeys.map((k) => [k, METRICS[k].label]), metric, { action: 'prog-metric' })}
      </div>
      <section class="card chart-card">
        <div class="card-head"><h4 class="card-title">${esc(METRICS[metric].title)}</h4></div>
        <div class="range-row">${RANGES.map(([k, label]) => `<button class="chip small ${k === prefs.range ? 'on' : ''}" data-action="prog-range" data-value="${k}">${label}</button>`).join('')}</div>
        ${chartHtml}
      </section>
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

onAction('prog-metric', (el) => {
  const exId = el.dataset.name.split(':')[1];
  prefs.metric[exId] = el.dataset.value;
  document.dispatchEvent(new Event('rerender'));
});

onAction('prog-range', (el) => {
  prefs.range = el.dataset.value;
  document.dispatchEvent(new Event('rerender'));
});
