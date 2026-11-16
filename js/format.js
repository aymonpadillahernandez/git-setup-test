// Formatting helpers: units, numbers, dates. Weights are stored in kg.

export const KG_PER_LB = 0.45359237;
const LOCALE = 'en-US';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---- Weight -------------------------------------------------------------

export function toUnit(kg, unit) {
  if (kg == null) return null;
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

export function fromUnit(value, unit) {
  if (value == null || Number.isNaN(value)) return null;
  return unit === 'lb' ? value * KG_PER_LB : value;
}

/** Parse what the user typed (accepts "62,5" from European keyboards). */
export function parseNumber(text) {
  if (text == null) return null;
  const clean = String(text).trim().replace(',', '.');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const nfCache = new Map();
function nf(maxFrac, compact = false) {
  const key = `${maxFrac}-${compact}`;
  if (!nfCache.has(key)) {
    nfCache.set(key, new Intl.NumberFormat(LOCALE, {
      maximumFractionDigits: maxFrac,
      notation: compact ? 'compact' : 'standard',
    }));
  }
  return nfCache.get(key);
}

export function fmtNumber(n, maxFrac = 0) {
  return nf(maxFrac).format(n);
}

/** Weight value in the user's unit, without the unit label. */
export function wVal(kg, unit) {
  if (kg == null) return '';
  const v = toUnit(kg, unit);
  return nf(unit === 'lb' ? 1 : 2).format(v);
}

/** Weight value for an <input> (no grouping separators). */
export function wInput(kg, unit) {
  if (kg == null) return '';
  const v = toUnit(kg, unit);
  return String(Math.round(v * (unit === 'lb' ? 10 : 100)) / (unit === 'lb' ? 10 : 100));
}

export function fmtWeight(kg, unit) {
  return `${wVal(kg, unit)} ${unit}`;
}

/** "80 kg × 6", or "12 reps" for bodyweight sets. */
export function fmtSet(set, unit, { short = false } = {}) {
  if (!set) return '';
  if (!set.w) return `${set.r ?? 0} ${set.r === 1 ? 'rep' : 'reps'}`;
  return short ? `${wVal(set.w, unit)} × ${set.r}` : `${wVal(set.w, unit)} ${unit} × ${set.r}`;
}

export function fmtCompact(v) {
  return Math.abs(v) >= 10000 ? nf(1, true).format(v) : nf(v < 10 ? 1 : 0).format(v);
}

export function plural(n, one, many = `${one}s`) {
  return `${fmtNumber(n)} ${n === 1 ? one : many}`;
}

// ---- Dates --------------------------------------------------------------

const dtfCache = new Map();
function dtf(opts) {
  const key = JSON.stringify(opts);
  if (!dtfCache.has(key)) dtfCache.set(key, new Intl.DateTimeFormat(LOCALE, opts));
  return dtfCache.get(key);
}

export const fmtDate = (ms) => dtf({ weekday: 'short', month: 'short', day: 'numeric' }).format(ms);
export const fmtDateLong = (ms) => dtf({ weekday: 'long', month: 'long', day: 'numeric' }).format(ms);
export const fmtMonthDay = (ms) => dtf({ month: 'short', day: 'numeric' }).format(ms);
export const fmtMonth = (ms) => dtf({ month: 'short' }).format(ms);
export const fmtTime = (ms) => dtf({ hour: 'numeric', minute: '2-digit' }).format(ms);
export const fmtWeekday = (ms) => dtf({ weekday: 'short' }).format(ms);
export const fmtDayNum = (ms) => dtf({ day: 'numeric' }).format(ms);
export const fmtFullDate = (ms) => dtf({ month: 'short', day: 'numeric', year: 'numeric' }).format(ms);

export function fmtDuration(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms, days) {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Start (local midnight) of the week containing `ms`. weekStart: 0 = Sunday, 1 = Monday. */
export function startOfWeek(ms, weekStart = 1) {
  const d = new Date(startOfDay(ms));
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function fmtWeekRange(weekMs) {
  const end = addDays(weekMs, 6);
  const a = new Date(weekMs);
  const b = new Date(end);
  if (a.getMonth() === b.getMonth()) return `${fmtMonthDay(weekMs)} – ${b.getDate()}`;
  return `${fmtMonthDay(weekMs)} – ${fmtMonthDay(end)}`;
}

/** "This Week", "Last Week", or "Nov 2 – 8". */
export function fmtWeekLabel(weekMs, weekStart = 1) {
  const current = startOfWeek(Date.now(), weekStart);
  if (weekMs === current) return 'This Week';
  if (weekMs === startOfWeek(addDays(current, -1), weekStart)) return 'Last Week';
  return fmtWeekRange(weekMs);
}

export function fmtRelativeDay(ms) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return fmtFullDate(ms);
}
