// Exercise picker and "new exercise" form, shared by workouts and routines.

import { db, addExercise, exById } from './store.js';
import { MUSCLES } from './data.js';
import { esc, fmtSet } from './format.js';
import { icon } from './icons.js';
import { openSheet } from './ui.js';
import { trainedExercises, lastSession, topSet } from './stats.js';

/** Resolves with an array of exercise ids (empty if cancelled). */
export function pickExercises({ title = 'Add Exercises', multi = true, confirm = 'Add' } = {}) {
  return new Promise((resolve) => {
    const selected = [];
    let result = [];
    const unit = db.settings.unit;

    const row = (ex) => {
      const last = lastSession(ex.id);
      const top = last && topSet(last.sets);
      return `<button class="pick-row" data-id="${esc(ex.id)}" data-name="${esc(ex.name.toLowerCase())}">
        <span class="pick-check">${icon('check', { size: 14, stroke: 3 })}</span>
        <span class="pick-text"><span class="pick-name">${esc(ex.name)}</span>
        <span class="pick-sub">${top ? `Last: ${esc(fmtSet(top, unit))}` : esc(ex.muscle)}</span></span>
      </button>`;
    };

    const recent = trainedExercises().slice(0, 6).map((t) => exById(t.exId)).filter(Boolean);
    const groups = MUSCLES.map((m) => [m, db.exercises.filter((e) => e.muscle === m).sort((a, b) => a.name.localeCompare(b.name))])
      .filter(([, list]) => list.length);
    const extra = db.exercises.filter((e) => !MUSCLES.includes(e.muscle));
    if (extra.length) groups.push(['Other', extra]);

    const sheet = openSheet({
      kind: 'page',
      label: title,
      content: `<header class="sheet-nav">
          <button class="nav-btn" data-cancel>Cancel</button>
          <div class="sheet-title">${esc(title)}</div>
          ${multi ? `<button class="nav-btn bold" data-ok disabled>${esc(confirm)}</button>` : '<span class="nav-btn-spacer"></span>'}
        </header>
        <div class="sheet-search">${icon('search', { size: 17 })}<input type="search" placeholder="Search exercises" autocomplete="off" enterkeyhint="search"></div>
        <div class="sheet-scroll">
          <button class="pick-new" data-new>${icon('plus', { size: 18, stroke: 2.4 })}<span>New Exercise</span></button>
          ${recent.length ? `<section class="pick-group" data-group="recent"><h4>Recent</h4>${recent.map(row).join('')}</section>` : ''}
          ${groups.map(([m, list]) => `<section class="pick-group"><h4>${esc(m)}</h4>${list.map(row).join('')}</section>`).join('')}
          <p class="pick-none" hidden>No matches. Tap “New Exercise” to add it.</p>
        </div>`,
      onClose: () => resolve(result),
    });

    const body = sheet.body;
    const okBtn = body.querySelector('[data-ok]');
    const search = body.querySelector('input[type=search]');

    const sync = () => {
      body.querySelectorAll('.pick-row').forEach((r) => r.classList.toggle('on', selected.includes(r.dataset.id)));
      if (okBtn) {
        okBtn.disabled = selected.length === 0;
        okBtn.textContent = selected.length ? `${confirm} (${selected.length})` : confirm;
      }
    };

    body.querySelector('[data-cancel]').onclick = () => sheet.close();
    if (okBtn) okBtn.onclick = () => { result = [...selected]; sheet.close(); };

    body.addEventListener('click', async (e) => {
      const r = e.target.closest('.pick-row');
      if (r) {
        const id = r.dataset.id;
        if (!multi) { result = [id]; sheet.close(); return; }
        const i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1); else selected.push(id);
        sync();
        return;
      }
      if (e.target.closest('[data-new]')) {
        const ex = await newExerciseSheet(search.value.trim());
        if (!ex) return;
        if (!multi) { result = [ex.id]; sheet.close(); return; }
        selected.push(ex.id);
        result = [...selected];
        sheet.close();
      }
    });

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      body.querySelectorAll('.pick-group').forEach((g) => {
        if (g.dataset.group === 'recent') { g.hidden = !!q; return; }
        let visible = 0;
        g.querySelectorAll('.pick-row').forEach((r) => {
          const match = !q || r.dataset.name.includes(q);
          r.hidden = !match;
          if (match) visible++;
        });
        g.hidden = visible === 0;
        if (visible) any = true;
      });
      body.querySelector('.pick-none').hidden = any;
    });
  });
}

/** Form to create a custom exercise. Resolves with the new exercise or null. */
export function newExerciseSheet(name = '', { existing = null } = {}) {
  return new Promise((resolve) => {
    let result = null;
    let muscle = existing?.muscle || 'Chest';
    const sheet = openSheet({
      kind: 'auto',
      label: existing ? 'Edit Exercise' : 'New Exercise',
      content: `<header class="sheet-nav">
          <button class="nav-btn" data-cancel>Cancel</button>
          <div class="sheet-title">${existing ? 'Edit Exercise' : 'New Exercise'}</div>
          <button class="nav-btn bold" data-ok>${existing ? 'Save' : 'Add'}</button>
        </header>
        <div class="sheet-pad">
          <input class="field" type="text" placeholder="Exercise name" maxlength="50" value="${esc(existing?.name || name)}" autocomplete="off">
          <div class="field-label">Muscle group</div>
          <div class="chips">${MUSCLES.map((m) => `<button class="chip ${m === muscle ? 'on' : ''}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
        </div>`,
      onClose: () => resolve(result),
    });
    const input = sheet.body.querySelector('input');
    sheet.body.querySelector('[data-cancel]').onclick = () => sheet.close();
    sheet.body.querySelector('.chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      muscle = chip.dataset.m;
      sheet.body.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
    });
    const ok = () => {
      const value = input.value.trim();
      if (!value) { input.focus(); return; }
      if (existing) {
        existing.name = value;
        existing.muscle = muscle;
        result = existing;
      } else {
        result = addExercise(value, muscle);
      }
      sheet.close();
    };
    sheet.body.querySelector('[data-ok]').onclick = ok;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    setTimeout(() => input.focus(), 80);
  });
}
