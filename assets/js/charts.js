// Lightweight SVG charts: sparkline, area/line with hover, utilisation bars, value-chain columns.
import { h } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

function niceMax(v) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / e;
  const n = m <= 1 ? 1 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
  return n * e;
}

export function sparkline(svg, values, { color = 'var(--accent)', w = 200, h: H = 26, min = null } = {}) {
  if (!values.length) { svg.innerHTML = ''; return; }
  const lo = min ?? Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const n = values.length;
  const x = (i) => (n === 1 ? w : (i / (n - 1)) * (w - 4) + 2);
  const y = (v) => H - 3 - ((v - lo) / span) * (H - 7);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const last = values[n - 1];
  svg.innerHTML =
    `<path d="M${pts[0]} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H}Z" fill="${color}" fill-opacity=".10" stroke="none"/>` +
    `<path d="M${pts.join(' L')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    `<circle cx="${x(n - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2.6" fill="${color}" stroke="var(--ink-1)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
}

/** Line/area chart with crosshair tooltip. series[0] = primary (area), others = comparison lines. */
export function lineChart(host, { labels, series, fmt, height = 150 }) {
  let state = host._lc;
  if (!state) {
    state = host._lc = {};
    host.classList.add('chart');
    state.svg = document.createElementNS(NS, 'svg');
    state.tip = h('div', { class: 'chart-tip' });
    host.append(state.svg, state.tip);
    const move = (e) => {
      const s = host._lc; if (!s.geom) return;
      const r = s.svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * s.geom.W;
      const i = Math.max(0, Math.min(s.geom.n - 1, Math.round((px - s.geom.L) / s.geom.step)));
      s.hover = i; draw();
    };
    state.svg.addEventListener('pointermove', move);
    state.svg.addEventListener('pointerdown', move);
    state.svg.addEventListener('pointerleave', () => { host._lc.hover = null; draw(); });
  }
  state.data = { labels, series, fmt, height };
  const draw = () => {
    const s = host._lc, { labels: lb, series: sr, fmt: f, height: H } = s.data;
    const W = Math.max(240, host.clientWidth || 320);
    const L = 40, R = 10, T = 10, B = 22;
    const n = lb.length;
    const dmax = Math.max(...sr.flatMap((x) => x.values)) * 1.04 || 1;
    const tstep = niceMax(dmax / 3);
    const ticks = Math.max(1, Math.ceil(dmax / tstep));
    const max = tstep * ticks;
    const step = n > 1 ? (W - L - R) / (n - 1) : 0;
    const X = (i) => L + i * step;
    const Y = (v) => T + (1 - v / max) * (H - T - B);
    s.geom = { W, L, step, n };
    let out = `<g class="grid">`;
    for (let k = 0; k <= ticks; k++) {
      const v = tstep * k;
      out += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`;
      out += `<text class="axis" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${f(v, true)}</text>`;
    }
    out += `</g>`;
    lb.forEach((t, i) => { out += `<text class="axis" x="${X(i)}" y="${H - 6}" text-anchor="middle">${t}</text>`; });
    sr.forEach((ser, si) => {
      const pts = ser.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      if (si === 0) out += `<path d="M${pts[0]} L${pts.join(' L')} L${X(n - 1)},${Y(0)} L${X(0)},${Y(0)}Z" fill="${ser.color}" fill-opacity=".10"/>`;
      out += `<path d="M${pts.join(' L')}" fill="none" stroke="${ser.color}" stroke-width="${si === 0 ? 2 : 1.5}" ${ser.dash ? 'stroke-dasharray="4 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (si === 0) out += `<circle cx="${X(n - 1)}" cy="${Y(ser.values[n - 1])}" r="4" fill="${ser.color}" stroke="var(--ink-1)" stroke-width="2"/>`;
    });
    if (s.hover != null) {
      const i = s.hover;
      out += `<line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - B}" stroke="var(--fg-3)" stroke-width="1"/>`;
      sr.forEach((ser) => { out += `<circle cx="${X(i)}" cy="${Y(ser.values[i])}" r="4" fill="${ser.color}" stroke="var(--ink-1)" stroke-width="2"/>`; });
      s.tip.innerHTML = `<div class="t">${lb[i]}</div>` + sr.map((ser) => `<div class="r"><i style="background:${ser.color}"></i>${ser.name}<b>${f(ser.values[i])}</b></div>`).join('');
      const r = host.getBoundingClientRect(), sv = s.svg.getBoundingClientRect();
      s.tip.style.left = `${(X(i) / W) * sv.width + (sv.left - r.left)}px`;
      s.tip.style.top = `${(Math.min(...sr.map((x) => Y(x.values[i]))) / H) * sv.height + (sv.top - r.top)}px`;
      s.tip.classList.add('on');
    } else s.tip.classList.remove('on');
    out += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
    s.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    s.svg.setAttribute('height', H);
    s.svg.innerHTML = out;
  };
  draw();
}

/** Horizontal utilisation bars. rows: [{id, name, util, cls, sel}] */
export function utilBars(host, rows, onPick) {
  if (!host._ub || host._ub.length !== rows.length) {
    host.innerHTML = '';
    host._ub = rows.map((r) => {
      const el = h('div', { class: 'ubar', role: 'button', tabindex: '0', title: r.name },
        h('span', { class: 'nm' }, r.name),
        h('span', { class: 'tr' }, h('i'), h('span', { class: 'cap' })),
        h('span', { class: 'v' }, ''));
      el.addEventListener('click', () => onPick?.(r.id));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(r.id); } });
      host.append(el);
      return el;
    });
  }
  rows.forEach((r, i) => {
    const el = host._ub[i];
    el.className = `ubar ${r.cls || ''} ${r.sel ? 'sel' : ''}`;
    const w = Math.min(120, r.util * 100);
    el.querySelector('.tr i').style.width = `${(w / 120) * 100}%`;
    el.querySelector('.v').textContent = `${Math.round(r.util * 100)}%`;
    el.setAttribute('aria-label', `${r.name} 가동률 ${Math.round(r.util * 100)}%`);
  });
}

/** Value chain: one column per stage (headline revenue), labelled at the cap. */
export function chainChart(host, stages, fmt, onPick) {
  const W = Math.max(320, host.clientWidth || 600), H = 210;
  const L = 8, R = 8, T = 24, B = 40;
  const n = stages.length;
  const max = niceMax(Math.max(...stages.map((s) => s.value)) * 1.05);
  const band = (W - L - R) / n;
  const bw = Math.min(46, band * 0.5);
  const Y = (v) => T + (1 - v / max) * (H - T - B);
  let out = `<g class="grid"><line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/></g>`;
  stages.forEach((s, i) => {
    const cx = L + band * i + band / 2;
    const y = Y(s.value), hgt = Math.max(2, Y(0) - y);
    const r = Math.min(4, hgt / 2);
    out += `<g class="cc" data-i="${i}" style="cursor:pointer">`;
    out += `<rect x="${cx - band / 2}" y="${T - 10}" width="${band}" height="${H - T - B + 10}" fill="transparent"/>`;
    out += `<path d="M${cx - bw / 2},${Y(0)} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${Y(0)} Z" fill="${s.hue}" fill-opacity=".85"/>`;
    out += `<text x="${cx}" y="${y - 7}" text-anchor="middle" fill="var(--fg)" font-size="12" font-weight="600">${fmt(s.value)}</text>`;
    out += `<text x="${cx}" y="${H - 22}" text-anchor="middle" fill="var(--fg-2)" font-size="11.5">${s.name}</text>`;
    out += `<text x="${cx}" y="${H - 8}" text-anchor="middle" fill="var(--fg-3)" font-size="10" font-family="var(--font-mono)">${s.sub}</text>`;
    out += `</g>`;
  });
  let svg = host.querySelector('svg');
  if (!svg) {
    svg = document.createElementNS(NS, 'svg'); host.append(svg);
    svg.addEventListener('click', (e) => { const g = e.target.closest('.cc'); if (g) onPick?.(+g.dataset.i); });
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '단계별 매출: ' + stages.map((s) => `${s.name} ${fmt(s.value)}`).join(', '));
  svg.innerHTML = out;
}

/** Tall segmented bar: where the revenue goes (costs + profit). items: [{name, value, color}] */
export function costBar(host, items, fmt) {
  const pos = items.filter((d) => d.value > 0);
  const total = pos.reduce((s, d) => s + d.value, 0) || 1;
  const bar = pos.map((d) => {
    const share = d.value / total;
    const label = share > 0.11 ? `<span>${Math.round(share * 100)}%</span>` : '';
    return `<i style="flex:${share} 1 0;background:${d.color}" title="${d.name} ${fmt(d.value)} (${(share * 100).toFixed(1)}%)">${label}</i>`;
  }).join('');
  const legend = items.map((d) => `<div><span><i style="background:${d.color}"></i>${d.name}</span><b>${fmt(d.value)}</b></div>`).join('');
  host.innerHTML = `<div class="segbar" role="img" aria-label="${items.map((d) => `${d.name} ${fmt(d.value)}`).join(', ')}">${bar}</div><div class="seglegend">${legend}</div>`;
}
