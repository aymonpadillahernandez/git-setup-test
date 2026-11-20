// App shell: router, navigation bar, tab bar, mini workout bar.

import { db, subscribe, requestPersistentStorage } from './store.js';
import { esc, fmtClock } from './format.js';
import { icon } from './icons.js';
import { hydrateCharts } from './charts.js';
import { onAction, navigate } from './ui.js';
import { todayView } from './views/today.js';
import { planView, routineEditorView } from './views/routines.js';
import { historyView, workoutDetailView } from './views/history.js';
import { progressView, exerciseProgressView } from './views/progress.js';
import { settingsView, exerciseManagerView } from './views/settings.js';
import { openWorkoutSheet, isWorkoutSheetOpen } from './workout.js';
import { showOnboarding } from './onboarding.js';

const TABS = [
  ['today', 'Today', 'rings'],
  ['plan', 'Plan', 'dumbbell'],
  ['history', 'History', 'history'],
  ['progress', 'Progress', 'chart'],
];

const ROUTES = [
  ['today', /^today$/, todayView],
  ['today', /^settings$/, settingsView],
  ['today', /^settings\/exercises$/, exerciseManagerView],
  ['plan', /^plan$/, planView],
  ['plan', /^routines\/([\w-]+)$/, routineEditorView],
  ['history', /^history$/, historyView],
  ['history', /^history\/([\w-]+)$/, workoutDetailView],
  ['progress', /^progress$/, progressView],
  ['progress', /^progress\/([\w-]+)$/, exerciseProgressView],
];

const viewEl = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const mini = document.getElementById('mini');

const lastRouteByTab = {};
const scrollByRoute = new Map();
let currentPath = null;
let currentTab = 'today';
let titleObserver;

function currentHashPath() {
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'today';
  return { summary: 'today', workout: 'plan' }[path] || path; // old links
}

function resolve(path) {
  for (const [tab, re, view] of ROUTES) {
    const m = path.match(re);
    if (m) return { tab, view, params: m.slice(1) };
  }
  return null;
}

function render({ refresh = false } = {}) {
  const path = currentHashPath();
  const route = resolve(path);
  if (!route) { navigate('today', { replace: true }); return; }

  const v = route.view(...route.params);
  if (!v) { navigate(route.tab, { replace: true }); return; }

  const prevPath = currentPath;
  if (prevPath && !refresh) scrollByRoute.set(prevPath, window.scrollY);
  const scrollTo = refresh ? window.scrollY : (scrollByRoute.get(path) ?? 0);
  const depth = path.split('/').length;
  const prevDepth = prevPath ? prevPath.split('/').length : depth;

  currentPath = path;
  currentTab = route.tab;
  lastRouteByTab[route.tab] = path;

  const large = v.large !== false;
  const back = v.left || (v.back
    ? `<a class="nav-back" href="#/${esc(v.back.href)}">${icon('chevronLeft', { size: 24, stroke: 2.4 })}<span>${esc(v.back.label)}</span></a>`
    : '');

  viewEl.className = `view ${large ? 'has-large' : 'no-large'}`;
  viewEl.innerHTML = `
    <header class="navbar ${large ? '' : 'show-title'}">
      <div class="nav-left">${back}</div>
      <div class="nav-title">${esc(v.title)}</div>
      <div class="nav-right">${v.right || ''}</div>
    </header>
    <div class="scroll-sentinel"></div>
    ${large ? `<div class="large-head">${v.eyebrow ? `<div class="eyebrow">${esc(v.eyebrow)}</div>` : ''}<h1 class="large-title">${esc(v.title)}</h1></div>` : ''}
    <div class="content">${v.body}</div>`;

  const prevTab = prevPath ? resolve(prevPath)?.tab : null;
  if (!refresh && prevTab === route.tab && depth !== prevDepth) {
    viewEl.classList.add(depth > prevDepth ? 'anim-push' : 'anim-pop');
  }

  v.mount?.(viewEl);
  hydrateCharts(viewEl);
  updateTabbar();
  updateMini();
  observeTitle();
  window.scrollTo(0, scrollTo);
}

function observeTitle() {
  titleObserver?.disconnect();
  const nav = viewEl.querySelector('.navbar');
  const target = viewEl.querySelector('.large-title') || viewEl.querySelector('.scroll-sentinel');
  if (!nav || !target || typeof IntersectionObserver === 'undefined') return;
  const isLarge = target.classList.contains('large-title');
  titleObserver = new IntersectionObserver(([entry]) => {
    const hidden = !entry.isIntersecting;
    nav.classList.toggle('scrolled', hidden);
    if (isLarge) nav.classList.toggle('show-title', hidden);
  }, { rootMargin: `-${nav.offsetHeight}px 0px 0px 0px` });
  titleObserver.observe(target);
}

function updateTabbar() {
  tabbar.innerHTML = TABS.map(([id, label, ic]) => `
    <a href="#/${id}" class="tab ${id === currentTab ? 'on' : ''}" data-action="tab" data-tab="${id}" aria-current="${id === currentTab ? 'page' : 'false'}">
      ${icon(ic, { size: 25, stroke: id === currentTab ? 2.3 : 1.9 })}<span>${label}</span>
    </a>`).join('');
}

onAction('tab', (el) => {
  const tab = el.dataset.tab;
  if (tab === currentTab) {
    if (currentPath === tab) window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate(tab);
  } else {
    navigate(lastRouteByTab[tab] || tab);
  }
});

export function updateMini() {
  const a = db.active;
  const show = !!a && !isWorkoutSheetOpen();
  mini.hidden = !show;
  document.body.classList.toggle('has-mini', show);
  if (!show) return;
  mini.innerHTML = `<button class="mini-inner" data-action="open-workout">
    <span class="mini-dot"></span>
    <span class="mini-text"><span class="mini-name">${esc(a.name || 'Workout')}</span><span class="mini-sub">Workout in progress</span></span>
    <span class="mini-time" data-elapsed="${a.start}">${fmtClock((Date.now() - a.start) / 1000)}</span>
    ${icon('chevronRight', { size: 18, stroke: 2.4 })}
  </button>`;
}

onAction('open-workout', () => openWorkoutSheet());

// Live clocks: any element with data-elapsed="<start ms>".
setInterval(() => {
  document.querySelectorAll('[data-elapsed]').forEach((el) => {
    el.textContent = fmtClock((Date.now() - Number(el.dataset.elapsed)) / 1000);
  });
}, 1000);

window.addEventListener('hashchange', () => render());
subscribe(() => render({ refresh: true }));
document.addEventListener('workoutsheet', () => updateMini());
document.addEventListener('rerender', () => render({ refresh: true }));

// iOS standalone detection for the install hint.
document.documentElement.classList.toggle('standalone', window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);

render();
if (db.active) openWorkoutSheet({ animate: false });
if (!db.settings.onboarded) showOnboarding();
else requestPersistentStorage();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
