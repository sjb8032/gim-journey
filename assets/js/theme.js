// Design versions. A = classic (cinematic dark), B = analytics (light, corporate blue).
// The inline script in index.html picks the version before the first paint
// (?theme=b in the address, otherwise the last choice on this device); this module
// exposes it to the scripts and swaps the stage colours for version B.
import { STAGES } from './config.js';
import { store, tween, easeOut, reducedMotion, fmt1, fmtInt } from './util.js';

export const THEME = document.documentElement.dataset.theme === 'analytics' ? 'analytics' : 'classic';
export const ANALYTICS = THEME === 'analytics';
export const BRAND = '#2563eb';

// B: one blue that deepens along the chain, so colour follows the value added at each step.
// OKLCH L 0.72 → 0.33 in even steps (validated as an ordinal ramp on white).
const B_HUES = ['#70a8eb', '#438dec', '#2171df', '#1959bf', '#1e4590', '#15306f'];
if (ANALYTICS) STAGES.forEach((s, i) => { s.hueA = s.hue; s.hue = B_HUES[i]; });

/** UI accent of a stage page: the stage colour in A, one brand blue in B. */
export const accentOf = (st) => (ANALYTICS ? BRAND : st.hue);

export function setTheme(t) {
  if (t !== 'classic' && t !== 'analytics') return;
  if (t === THEME) return;
  store.set('theme', t);
  const u = new URL(location.href);
  u.searchParams.delete('theme');
  history.replaceState(null, '', u);
  location.reload();
}

export const toggleTheme = () => setTheme(ANALYTICS ? 'classic' : 'analytics');

export function themeSwitchHTML() {
  return `<div class="theme-switch" role="group" aria-label="디자인 버전 (T)" title="디자인 A·B 바꾸기 (T)">` +
    `<button type="button" data-set-theme="classic" aria-pressed="${!ANALYTICS}" aria-label="디자인 A">A</button>` +
    `<button type="button" data-set-theme="analytics" aria-pressed="${ANALYTICS}" aria-label="디자인 B">B</button></div>`;
}

/** Money in one fixed unit, so a rolling number never changes unit mid-roll. */
const DIV = { '조원': 1e12, '억원': 1e8, '만원': 1e4, '원': 1 };
export const moneyFixed = (u) => (x) => {
  const v = Math.abs(x) / (DIV[u] || 1), s = x < 0 ? '−' : '';
  return s + (u === '조원' || (u === '억원' && v < 100) ? fmt1(v) : fmtInt(v));
};

/** B only: roll a number to its new value; a newer call cancels the running one. */
const rolling = new WeakMap();
export function rollNumber(el, to, fmt, { dur = 420, from: start } = {}) {
  const prev = rolling.get(el);
  const from = start ?? (prev ? prev.now : to);
  prev?.stop?.();
  const st = { now: from, stop: null };
  rolling.set(el, st);
  if (!ANALYTICS || reducedMotion() || !isFinite(from) || !isFinite(to) || from === to) {
    st.now = to; el.textContent = fmt(to); return;
  }
  st.stop = tween(dur, (k) => { st.now = from + (to - from) * k; el.textContent = fmt(st.now); }, { ease: easeOut, done: () => { st.now = to; el.textContent = fmt(to); } });
}
