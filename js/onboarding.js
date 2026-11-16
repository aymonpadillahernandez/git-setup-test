// First-launch welcome + quick setup.

import { db, commit, addStarterProgram, requestPersistentStorage } from './store.js';
import { STARTER_PROGRAMS } from './data.js';
import { esc } from './format.js';
import { icon } from './icons.js';
import { openSheet } from './ui.js';

export function showOnboarding() {
  const choice = { unit: db.settings.unit, goal: db.settings.weeklyGoal, program: 'ppl' };

  const welcome = () => `<div class="onb">
      <div class="onb-scroll">
        <img class="onb-icon" src="icons/icon-180.png" alt="" width="84" height="84">
        <h1>Welcome to Lift</h1>
        <ul class="onb-features">
          <li><span class="onb-fi blue">${icon('list', { size: 30, stroke: 2.2 })}</span><div><strong>Log every set in seconds</strong><p>Last session’s weight and reps are pre-filled. Tap ✓ and move on.</p></div></li>
          <li><span class="onb-fi orange">${icon('chart', { size: 30, stroke: 2.2 })}</span><div><strong>See your progress week by week</strong><p>Every exercise gets a chart and a week-by-week log of weight and reps.</p></div></li>
          <li><span class="onb-fi gold">${icon('trophy', { size: 30, stroke: 2.2 })}</span><div><strong>Always know what to beat</strong><p>Get a target for every exercise, and a trophy when you set a record.</p></div></li>
        </ul>
      </div>
      <div class="onb-foot"><button class="btn filled wide big" data-onb="next">Continue</button></div>
    </div>`;

  const setup = () => `<div class="onb">
      <div class="onb-scroll">
        <h1 class="onb-h">Quick setup</h1>
        <div class="field-label">Units</div>
        <div class="segmented big" data-onb-group="unit">
          <button class="${choice.unit === 'kg' ? 'on' : ''}" data-onb="unit" data-v="kg">Kilograms (kg)</button>
          <button class="${choice.unit === 'lb' ? 'on' : ''}" data-onb="unit" data-v="lb">Pounds (lb)</button>
        </div>
        <div class="field-label">Weekly goal</div>
        <section class="card list flush"><div class="row"><span class="row-main"><span class="row-title">Workouts per week</span></span>
          <span class="stepper"><button data-onb="goal" data-d="-1" aria-label="Lower">${icon('minus', { size: 15, stroke: 2.6 })}</button>
          <span class="stepper-val" data-goal>${choice.goal}</span>
          <button data-onb="goal" data-d="1" aria-label="Raise">${icon('plus', { size: 15, stroke: 2.6 })}</button></span></div></section>
        <div class="field-label">Starter routines</div>
        <section class="card list flush">
          ${Object.entries(STARTER_PROGRAMS).map(([k, p]) => `<button class="row radio ${choice.program === k ? 'on' : ''}" data-onb="program" data-v="${k}">
            <span class="row-main"><span class="row-title">${esc(p.label)}</span><span class="row-sub">${esc(p.detail)}</span></span>
            <span class="radio-dot">${icon('check', { size: 14, stroke: 3 })}</span></button>`).join('')}
          <button class="row radio ${choice.program === 'none' ? 'on' : ''}" data-onb="program" data-v="none">
            <span class="row-main"><span class="row-title">I’ll build my own</span><span class="row-sub">Start with an empty list</span></span>
            <span class="radio-dot">${icon('check', { size: 14, stroke: 3 })}</span></button>
        </section>
        <p class="footnote">You can edit routines, units and your goal any time.</p>
      </div>
      <div class="onb-foot"><button class="btn filled wide big" data-onb="done">Get Started</button></div>
    </div>`;

  const sheet = openSheet({ kind: 'full', className: 'onb-layer', label: 'Welcome', content: welcome() });
  sheet.el.querySelector('[data-sheet-dismiss]').replaceWith(Object.assign(document.createElement('div'), { className: 'sheet-backdrop' }));

  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-onb]');
    if (!b) return;
    const kind = b.dataset.onb;
    if (kind === 'next') { sheet.setContent(setup()); return; }
    if (kind === 'unit') choice.unit = b.dataset.v;
    if (kind === 'goal') choice.goal = Math.max(1, Math.min(7, choice.goal + Number(b.dataset.d)));
    if (kind === 'program') choice.program = b.dataset.v;
    if (kind === 'done') {
      db.settings.unit = choice.unit;
      db.settings.weeklyGoal = choice.goal;
      db.settings.onboarded = true;
      if (choice.program !== 'none') addStarterProgram(choice.program);
      commit();
      requestPersistentStorage();
      sheet.close();
      return;
    }
    const scroll = sheet.body.querySelector('.onb-scroll')?.scrollTop || 0;
    sheet.setContent(setup());
    sheet.body.querySelector('.onb-scroll').scrollTop = scroll;
  });
}
