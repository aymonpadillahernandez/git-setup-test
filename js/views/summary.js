// Summary tab: this week at a glance, weekly volume trend, recent records.

import { db, exName, persist } from '../store.js';
import { esc, fmtDateLong, fmtVolume, fmtMonthDay, fmtWeekLabel, fmtCompact, toUnit, fmtSet, fmtRelativeDay, plural, fmtDuration } from '../format.js';
import { icon } from '../icons.js';
import { chartSlot, rings } from '../charts.js';
import { weeklyTotals, goalStreak, recentPRs, PR_LABELS } from '../stats.js';
import { onAction, emptyState } from '../ui.js';
import { startWorkout, openWorkoutSheet } from '../workout.js';

export function summaryView() {
  const u = db.settings.unit;
  const goal = db.settings.weeklyGoal;
  const weeks = weeklyTotals(8);
  const now = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const streak = goalStreak();
  const hasAny = db.workouts.length > 0;

  const volTarget = prev.volume;
  const volProgress = volTarget ? now.volume / volTarget : 0;
  const workoutsLeft = Math.max(0, goal - now.workouts);

  let message;
  if (!hasAny) message = 'Log your first workout to start your streak.';
  else if (workoutsLeft === 0 && volTarget && now.volume > volTarget) message = 'Goal reached and you beat last week’s volume. Outstanding.';
  else if (workoutsLeft === 0) message = volTarget ? `Weekly goal reached. ${fmtVolume(volTarget - now.volume, u)} more to beat last week.` : 'Weekly goal reached. Keep it rolling.';
  else if (volTarget && now.volume > volTarget) message = `Already past last week’s volume. ${plural(workoutsLeft, 'more workout')} to hit your goal.`;
  else message = `${plural(workoutsLeft, 'more workout')} to hit your goal this week.`;

  const startBtn = db.active
    ? `<button class="btn filled wide big" data-action="resume-workout">${icon('play', { size: 18 })} Resume ${esc(db.active.name)}</button>`
    : `<button class="btn filled wide big" data-action="go-start">${icon('plus', { size: 20, stroke: 2.6 })} Start Workout</button>`;

  const installHint = !document.documentElement.classList.contains('standalone') && /iPhone|iPad|iPod/.test(navigator.userAgent) && !db.meta.hideInstall
    ? `<section class="card hint-card">
        <div class="hint-icon">${icon('addSquare', { size: 22 })}</div>
        <div class="hint-text"><strong>Add Lift to your Home Screen</strong>
        <span>In Safari, tap ${icon('share', { size: 15 })} Share, then “Add to Home Screen”. It opens full-screen and works offline.</span></div>
        <button class="icon-btn small" data-action="hide-install" aria-label="Dismiss">${icon('close', { size: 16 })}</button>
      </section>`
    : '';

  const weekCard = `<section class="card week-card">
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

  const welcome = !hasAny ? emptyState({
    iconName: 'dumbbell',
    title: 'Your progress starts here',
    text: 'Log a workout and Lift will track every set, show your progress week by week, and tell you what to beat next time.',
  }) : '';

  return {
    title: 'Summary',
    eyebrow: fmtDateLong(Date.now()).toUpperCase(),
    right: `<a class="icon-btn" href="#/settings" aria-label="Settings">${icon('gear', { size: 23, stroke: 1.9 })}</a>`,
    body: `${installHint}${weekCard}${startBtn}${tiles}${chart}${records}${welcome}`,
  };
}

onAction('resume-workout', () => openWorkoutSheet());
onAction('quick-start', () => startWorkout());
onAction('hide-install', () => { db.meta.hideInstall = true; persist(); document.querySelector('.hint-card')?.remove(); });
