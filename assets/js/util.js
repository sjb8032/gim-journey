// Small shared helpers: DOM, formatting, tweening, icons, toast.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isCoarse = () => window.matchMedia('(pointer: coarse)').matches;

// ---------- number formatting (Korean units) ----------
const nf0 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const fmtInt = (v) => nf0.format(Math.round(v));
export const fmt1 = (v) => nf1.format(v);

/** Money in KRW → { v: '28.4', u: '억원' } */
export function money(won) {
  const a = Math.abs(won);
  const s = won < 0 ? '−' : '';
  if (a >= 1e12) return { v: s + fmt1(a / 1e12), u: '조원' };
  if (a >= 1e8) return { v: s + (a >= 1e10 ? fmtInt(a / 1e8) : fmt1(a / 1e8)), u: '억원' };
  if (a >= 1e4) return { v: s + fmtInt(a / 1e4), u: '만원' };
  return { v: s + fmtInt(a), u: '원' };
}
export const moneyStr = (won) => { const m = money(won); return m.v + m.u; };

/** Large counts → '27.1만' / '1,880만' / '1.2억' */
export function count(v) {
  const a = Math.abs(v);
  if (a >= 1e8) return fmt1(v / 1e8) + '억';
  if (a >= 1e5) return (a >= 1e7 ? fmtInt(v / 1e4) : fmt1(v / 1e4)) + '만';
  if (a >= 1e4) return fmt1(v / 1e4) + '만';
  if (a >= 100) return fmtInt(v);
  if (a >= 10) return fmt1(v);
  return (Math.round(v * 100) / 100).toLocaleString('ko-KR');
}

/** Value with sensible precision for a step size */
export function fmtStep(v, step) {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';

export function clock(date = new Date()) {
  return date.toTimeString().slice(0, 8);
}

// ---------- tween ----------
const tweens = new Set();
let rafOn = false;
function tick(now) {
  for (const t of Array.from(tweens)) {
    const k = clamp((now - t.t0) / t.dur, 0, 1);
    t.fn(t.ease(k));
    if (k >= 1) { tweens.delete(t); t.done && t.done(); }
  }
  if (tweens.size) requestAnimationFrame(tick); else rafOn = false;
}
export function tween(dur, fn, { ease = easeInOut, done } = {}) {
  const t = { t0: performance.now(), dur: Math.max(1, dur), fn, ease, done };
  tweens.add(t);
  if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
  return () => tweens.delete(t);
}

/** Count-up text animation for numbers formatted by fmt */
const counters = new WeakMap();
export function countTo(el, to, fmt, dur = 600) {
  const from = counters.get(el) ?? to;
  counters.set(el, to);
  if (reducedMotion() || from === to || !isFinite(from)) { el.textContent = fmt(to); return; }
  tween(dur, (k) => { el.textContent = fmt(lerp(from, to, k)); }, { ease: easeOut });
}

// ---------- seeded random ----------
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- storage (never trusted) ----------
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('gim:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gim:' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---------- icons (inline SVG, stroke = currentColor) ----------
const P = {
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  warn: '<path d="M12 3l9.5 17H2.5z"/><path d="M12 10v4M12 17.5v.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  wave: '<path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1"/><path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1"/>',
  thermo: '<path d="M10 14V5a2 2 0 114 0v9a4 4 0 11-4 0z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  storm: '<path d="M6 15a4 4 0 010-8 5 5 0 019.6-1A4 4 0 1118 15"/><path d="M11 13l-2 4h4l-2 4"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M9 10h6M9 14h6M12 7v10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  ship: '<path d="M3 17l2 3h14l2-3H3zM5 17V9h14v8M9 9V5h6v4"/>',
  reset: '<path d="M4 12a8 8 0 108-8H8"/><path d="M8 1L5 4l3 3"/>',
  rotate: '<path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  file: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plug: '<path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 01-10 0zM12 17v5"/>',
  bug: '<path d="M8 8a4 4 0 018 0v6a4 4 0 01-8 0z"/><path d="M3 13h5M16 13h5M4 7l4 2M20 7l-4 2M4 19l4-2M20 19l-4-2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
};
export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// ---------- toast ----------
let toastEl, toastTimer;
export function toast(html, ms = 3600, ic = 'check') {
  if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(toastEl); }
  toastEl.innerHTML = icon(ic) + `<span>${html}</span>`;
  requestAnimationFrame(() => toastEl.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

// ---------- image with local → remote fallback ----------
export function setImg(img, entry, onReady) {
  if (!entry) return;
  const sources = [];
  const pref = window.__ASSETS?.preferLocal;
  if (pref && entry.local) sources.push(entry.local);
  if (entry.remote) sources.push(entry.remote);
  if (!pref && entry.local) sources.push(entry.local);
  let i = 0;
  const tryNext = () => {
    if (i >= sources.length) return;
    img.src = sources[i++];
  };
  img.addEventListener('load', () => { img.classList.add('is-ready'); onReady && onReady(img); });
  img.addEventListener('error', tryNext);
  img.decoding = 'async';
  tryNext();
}

export function assetSources(entry) {
  if (!entry) return [];
  const pref = window.__ASSETS?.preferLocal;
  const out = [];
  if (pref && entry.local) out.push(entry.local);
  if (entry.remote) out.push(entry.remote);
  if (!pref && entry.local) out.push(entry.local);
  return out;
}
