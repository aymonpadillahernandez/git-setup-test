// Today tab: the workout of the day (with last session's numbers and today's
// targets), this week at a glance, weekly volume trend and recent records.

import { db, exName, exById, persist } from '../store.js';
import {
  esc, fmtDateLong, fmtDate, fmtVolume, fmtMonthDay, fmtWeekLabel, fmtCompact, toUnit, fmtSet,
  fmtRelativeDay, plural, fmtDuration, fmtClock, wVal,
} from '../format.js';
import { icon } from '../icons.js';
import { chartSlot, rings } from '../charts.js';
import {
  weeklyTotals, goalStreak, recentPRs, PR_LABELS, todayPlan, lastSession, suggestNext, topSet,
  doneSets, workoutVolume, workoutsDesc,
} from '../stats.js';
import { onAction, emptyState, deltaChip } from '../ui.js';
import { startWorkout, openWorkoutSheet } from '../workout.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const setsLine = (sets, u) => sets.map((s) => (s.w ? `${wVal(s.w, u)}×${s.r}` : `${s.r}`)).join(' · ');

// ---- Week strip -------------------------------------------------------------------

function weekStrip(plan) {
  return `<div class="week-strip" role="list" aria-label="This week">${plan.week.map((d) => {
    const done = d.workouts.length > 0;
    const planned = !!d.routine;
    const missed = d.isPast && planned && !done;
    const name = d.workouts[0]?.name || d.routine?.name || (d.isPast ? '' : 'Rest');
    const state = done ? 'done' : missed ? 'missed' : planned ? 'planned' : 'rest';
    const label = `${DAY_NAMES[d.weekday]}: ${done ? `${d.workouts[0].name}, done` : planned ? `${d.routine.name}${missed ? ', missed' : ''}` : 'rest'}`;
    return `<div class="ws-day ${state} ${d.isToday ? 'today' : ''}" role="listitem" aria-label="${esc(label)}">
      <span class="ws-letter">${DAY_NAMES[d.weekday][0]}</span>
      <span class="ws-dot">${done ? icon('check', { size: 14, stroke: 3 }) : ''}</span>
      <span class="ws-name">${esc(name)}</span>
    </div>`;
  }).join('')}</div>`;
}

// ---- Today card ---------------------------------------------------------------------

function plannedList(routine, u) {
  const rows = routine.items.filter((it) => exById(it.exId)).map((it) => {
    const last = lastSession(it.exId, { routineId: routine.id });
    const goal = suggestNext(it.exId, { routineId: routine.id, unit: u });
    return `<a class="today-ex" href="#/progress/${esc(it.exId)}">
      <span class="te-main">
        <span class="te-name">${esc(exName(it.exId))}</span>
        <span class="te-last">${last ? `${esc(setsLine(last.sets, u))}<span class="te-date"> · ${esc(fmtMonthDay(last.workout.start))}</span>` : `${plural(it.sets, 'set')} · ${it.repMin}–${it.repMax} reps · no baseline yet`}</span>
      </span>
      <span class="te-goal ${goal?.kind === 'weight' ? 'up' : ''}">${goal ? `${goal.kind === 'weight' ? icon('arrowUp', { size: 12, stroke: 2.8 }) : ''}${esc(fmtSet(goal, u, { short: true }))}` : '—'}</span>
    </a>`;
  }).join('');
  return `<div class="today-cols"><span>Last time (${esc(u)} × reps)</span><span>Target</span></div>
    <div class="today-list">${rows || '<p class="today-empty">This routine has no exercises yet.</p>'}</div>`;
}

function todayCard(plan, u) {
  const strip = weekStrip(plan);
  const head = (kicker, title, meta, cls = '') => `<div class="today-head ${cls}">
      <div class="today-kicker">${kicker}</div>
      <h2 class="today-name">${esc(title)}</h2>
      ${meta ? `<div class="today-meta">${meta}</div>` : ''}
    </div>`;

  // A workout is running.
  if (db.active) {
    const a = db.active;
    const rows = a.exercises.map((wex) => {
      const done = wex.sets.filter((s) => s.done).length;
      return `<div class="today-ex static"><span class="te-main"><span class="te-name">${esc(exName(wex.exId))}</span>
        <span class="te-last">${done ? esc(setsLine(wex.sets.filter((s) => s.done), u)) : 'Not started'}</span></span>
        <span class="te-progress ${done && done >= wex.sets.length ? 'complete' : ''}">${done}/${wex.sets.length}</span></div>`;
    }).join('');
    return `<section class="card today-card">${strip}
      ${head(`<span class="live-dot"></span>In progress · <span data-elapsed="${a.start}">${fmtClock((Date.now() - a.start) / 1000)}</span>`, a.name, '')}
      <div class="today-list">${rows}</div>
      <div class="today-actions"><button class="btn filled wide big" data-action="resume-workout">${icon('play', { size: 18 })} Resume Workout</button></div>
    </section>`;
  }

  // Already trained today: show what was logged (it is now the baseline for next time).
  if (plan.todayWorkout) {
    const w = plan.todayWorkout;
    const rows = w.exercises.filter((wex) => doneSets(wex).length).map((wex) => {
      const sets = doneSets(wex);
      const prev = lastSession(wex.exId, { excludeId: w.id, before: w.start, routineId: w.routineId });
      const top = topSet(sets);
      const prevTop = prev && topSet(prev.sets);
      let delta = '';
      if (prevTop) {
        delta = top.w && prevTop.w && Math.abs(top.w - prevTop.w) > 1e-6
          ? deltaChip(top.w - prevTop.w, { format: (v) => `${wVal(v, u)} ${u}` })
          : deltaChip(top.r - prevTop.r, { format: (v) => plural(v, 'rep'), neutral: 'Same' });
      }
      return `<a class="today-ex" href="#/progress/${esc(wex.exId)}"><span class="te-main"><span class="te-name">${esc(exName(wex.exId))}</span>
        <span class="te-last">${esc(setsLine(sets, u))}</span></span>${delta}</a>`;
    }).join('');
    return `<section class="card today-card">${strip}
      ${head(`${icon('check', { size: 13, stroke: 3 })} Completed today`, w.name, `${esc(fmtDuration((w.end || w.start) - w.start))} · ${esc(fmtVolume(workoutVolume(w), u))}${w.prs?.length ? ` · ${plural(w.prs.length, 'record')}` : ''}`, 'done')}
      <div class="today-cols"><span>Logged today (${esc(u)} × reps)</span><span>vs last time</span></div>
      <div class="today-list">${rows}</div>
      <p class="today-note">${icon('check', { size: 13, stroke: 2.8 })} Saved as your baseline for next time.</p>
      <div class="today-actions two">
        <a class="btn tinted" href="#/history/${esc(w.id)}">View or Edit</a>
        <button class="btn plain" data-action="go-start">Another Workout</button>
      </div>
    </section>`;
  }

  if (plan.kind === 'none') {
    return `<section class="card today-card">
      ${head('Get started', 'Plan your week', 'Create routines, then give each one a day. Lift will have your workout ready every day, with last week’s numbers.')}
      <div class="today-actions two">
        <a class="btn filled" href="#/plan">Set Up Plan</a>
        <button class="btn plain" data-action="quick-start">Empty Workout</button>
      </div>
    </section>`;
  }

  if (plan.kind === 'rest') {
    const next = plan.nextPlanned;
    return `<section class="card today-card">${strip}
      ${head('Rest day', 'Recover and grow', next ? `Next up: <strong>${esc(next.routine.name)}</strong> on ${esc(DAY_NAMES[new Date(next.day).getDay()])}.` : 'Nothing planned. Enjoy the day off.')}
      <div class="today-actions two">
        ${next ? `<button class="btn tinted" data-action="today-start" data-id="${esc(next.routine.id)}">Do ${esc(next.routine.name)} Now</button>` : ''}
        <button class="btn plain" data-action="go-start">Other Workout</button>
      </div>
    </section>`;
  }

  const r = plan.routine;
  const lastDone = workoutsDesc().find((w) => w.routineId === r.id);
  const sets = r.items.reduce((n, it) => n + it.sets, 0);
  const kicker = plan.kind === 'today' ? 'Today’s workout'
    : plan.kind === 'catchup' ? `Catch up · planned for ${DAY_NAMES[new Date(plan.catchupDay).getDay()]}`
      : 'Up next';
  const meta = `${plural(r.items.length, 'exercise')} · ${plural(sets, 'set')}${lastDone ? ` · last done ${esc(fmtDate(lastDone.start))}` : ''}`;
  return `<section class="card today-card">${strip}
    ${head(esc(kicker), r.name, meta)}
    ${plannedList(r, u)}
    <div class="today-actions">
      <button class="btn filled wide big" data-action="today-start" data-id="${esc(r.id)}">${icon('play', { size: 18 })} Start ${esc(r.name)}</button>
      <button class="btn plain small" data-action="go-start">Do a different workout</button>
    </div>
  </section>`;
}

// ---- View -------------------------------------------------------------------------

export function todayView() {
  const u = db.settings.unit;
  const goal = db.settings.weeklyGoal;
  const weeks = weeklyTotals(8);
  const now = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const streak = goalStreak();
  const hasAny = db.workouts.length > 0;
  const plan = todayPlan();

  const volTarget = prev.volume;
  const volProgress = volTarget ? now.volume / volTarget : 0;
  const workoutsLeft = Math.max(0, goal - now.workouts);

  let message;
  if (!hasAny) message = 'Log your first workout to start your streak.';
  else if (workoutsLeft === 0 && volTarget && now.volume > volTarget) message = 'Goal reached and you beat last week’s volume. Outstanding.';
  else if (workoutsLeft === 0) message = volTarget ? `Weekly goal reached. ${fmtVolume(volTarget - now.volume, u)} more to beat last week.` : 'Weekly goal reached. Keep it rolling.';
  else if (volTarget && now.volume > volTarget) message = `Already past last week’s volume. ${plural(workoutsLeft, 'more workout')} to hit your goal.`;
  else message = `${plural(workoutsLeft, 'more workout')} to hit your goal this week.`;

  const installHint = !document.documentElement.classList.contains('standalone') && /iPhone|iPad|iPod/.test(navigator.userAgent) && !db.meta.hideInstall
    ? `<section class="card hint-card">
        <div class="hint-icon">${icon('addSquare', { size: 22 })}</div>
        <div class="hint-text"><strong>Add Lift to your Home Screen</strong>
        <span>In Safari, tap ${icon('share', { size: 15 })} Share, then “Add to Home Screen”. It opens full-screen and works offline.</span></div>
        <button class="icon-btn small" data-action="hide-install" aria-label="Dismiss">${icon('close', { size: 16 })}</button>
      </section>`
    : '';

  const weekCard = `<div class="section-head"><h2>This week</h2></div>
    <section class="card week-card">
      <div class="week-top">
        <div class="week-rings">${rings([
          { value: now.workouts / goal, cls: 'r1' },
          { value: volProgress, cls: 'r2' },
        ])}</div>
        <div class="week-stats">
          <div class="ring-stat">
            <span class="ring-key r1"></span>
            <span class="ring-label">Workouts</span>
            <span class="ring-value">${now.workouts}<span class="of">/${goal}</span></span>
          </div>
          <div class="ring-stat">
            <span class="ring-key r2"></span>
            <span class="ring-label">${volTarget ? 'Volume vs last week' : 'Volume this week'}</span>
            <span class="ring-value">${esc(fmtCompact(toUnit(now.volume, u)))}<span class="of">${volTarget ? `/${esc(fmtCompact(toUnit(volTarget, u)))}` : ''} ${esc(u)}</span></span>
          </div>
        </div>
      </div>
      <p class="week-msg">${esc(message)}</p>
    </section>`;

  const tiles = `<div class="tiles">
      <div class="tile"><span class="tile-icon flame">${icon('flame', { size: 18, stroke: 2 })}</span><span class="tile-value">${streak}</span><span class="tile-label">${streak === 1 ? 'week' : 'weeks'} streak</span></div>
      <div class="tile"><span class="tile-icon">${icon('list', { size: 18 })}</span><span class="tile-value">${now.sets}</span><span class="tile-label">sets this week</span></div>
      <div class="tile"><span class="tile-icon">${icon('timer', { size: 18 })}</span><span class="tile-value">${now.duration ? esc(fmtDuration(now.duration)) : '0m'}</span><span class="tile-label">time this week</span></div>
    </div>`;

  const chart = hasAny ? `<section class="card">
      <div class="card-head"><h4 class="card-title">Weekly volume</h4><a class="card-link" href="#/history">History</a></div>
      ${chartSlot({
        type: 'columns',
        height: 170,
        fmtY: (v) => fmtCompact(v),
        valueLabel: now.volume ? fmtCompact(toUnit(now.volume, u)) : '',
        bars: weeks.map((w, i) => ({
          label: i === weeks.length - 1 ? 'Now' : fmtMonthDay(w.week),
          value: toUnit(w.volume, u),
          highlight: i === weeks.length - 1,
          tip: [fmtVolume(w.volume, u), `${fmtWeekLabel(w.week, db.settings.weekStart)} · ${plural(w.workouts, 'workout')}`],
        })),
      }, { label: `Weekly volume for the last 8 weeks. This week ${fmtVolume(now.volume, u)}, last week ${fmtVolume(prev.volume, u)}.` })}
      <table class="sr-only"><caption>Weekly volume</caption><tbody>${weeks.map((w) => `<tr><th>${esc(fmtWeekLabel(w.week, db.settings.weekStart))}</th><td>${esc(fmtVolume(w.volume, u))}</td><td>${plural(w.workouts, 'workout')}</td></tr>`).join('')}</tbody></table>
    </section>` : '';

  const prs = recentPRs(5);
  const records = prs.length ? `<div class="section-head"><h2>Recent records</h2></div>
    <section class="card list">${prs.map((p) => `<a class="row" href="#/progress/${esc(p.exId)}">
        <span class="row-icon gold">${icon('trophy', { size: 18, stroke: 2.2 })}</span>
        <span class="row-main"><span class="row-title">${esc(exName(p.exId))}</span><span class="row-sub">${esc(PR_LABELS[p.type])} · ${esc(fmtRelativeDay(p.date))}</span></span>
        <span class="row-value">${esc(p.type === 'volume' ? fmtVolume(p.vol, u) : fmtSet(p, u))}</span>
        ${icon('chevronRight', { size: 16, stroke: 2.4, cls: 'chev' })}
      </a>`).join('')}</section>` : '';

  const welcome = !hasAny && plan.kind !== 'none' ? emptyState({
    iconName: 'dumbbell',
    title: 'Your progress starts here',
    text: 'Your first session sets the baseline. From then on, every workout shows last time’s weight and reps and what to beat.',
  }) : '';

  return {
    title: 'Today',
    eyebrow: fmtDateLong(Date.now()).toUpperCase(),
    right: `<a class="icon-btn" href="#/settings" aria-label="Settings">${icon('gear', { size: 23, stroke: 1.9 })}</a>`,
    body: `${installHint}${todayCard(plan, u)}${weekCard}${tiles}${chart}${records}${welcome}`,
  };
}

onAction('today-start', (el) => startWorkout({ routineId: el.dataset.id }));
onAction('resume-workout', () => openWorkoutSheet());
onAction('quick-start', () => startWorkout());
onAction('hide-install', () => { db.meta.hideInstall = true; persist(); document.querySelector('.hint-card')?.remove(); });
