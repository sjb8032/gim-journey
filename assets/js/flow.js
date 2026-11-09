// Process flow diagram (SVG): input → machines → output, with live numbers on the figure.
import { count, fmt1, moneyStr } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

export function fmtFlow(v) {
  if (v >= 10000) return count(v);
  if (v >= 100) return Math.round(v).toLocaleString('ko-KR');
  if (v >= 10) return fmt1(v);
  return v.toFixed(2);
}

export class FlowDiagram {
  constructor(host, onPick) {
    this.host = host;
    this.onPick = onPick;
    this.svg = el('svg', { class: 'flow-svg', role: 'img' });
    host.append(this.svg);
    this.ro = new ResizeObserver(() => { if (this.stage) { this.build(this.stage); if (this.last) this.update(...this.last); } });
    this.ro.observe(host);
  }

  // 투입부터 설비별 처리와 산출까지 공정 흐름도를 구성한다.
  build(stage) {
    this.stage = stage;
    const svg = this.svg;
    svg.innerHTML = '';
    const n = stage.machines.length;
    const NW = 124, NH = 78, IOW = 108, OW = 150, H = 104, top = 6;
    const fixed = IOW + n * NW + OW + 24;
    const avail = Math.max(0, this.host.clientWidth - 4);
    const gap = Math.max(30, Math.min(64, (avail - fixed) / (n + 1)));
    const W = Math.round(fixed + gap * (n + 1));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.width = `${W}px`;
    const cy = top + NH / 2;
    const xs = [];
    let x = 12;
    xs.push(x); x += IOW + gap;
    for (let i = 0; i < n; i++) { xs.push(x); x += NW + gap; }
    xs.push(x);
    this.nodes = {}; this.edges = [];
    // edges first (under nodes)
    const edgeG = el('g');
    svg.append(edgeG);
    for (let i = 0; i <= n; i++) {
      const x1 = xs[i] + (i === 0 ? IOW : NW), x2 = xs[i + 1];
      const d = `M${x1 + 2},${cy} L${x2 - 6},${cy}`;
      edgeG.append(el('path', { class: 'flow-edge-base', d }));
      const dash = el('path', { class: 'flow-edge', d });
      edgeG.append(dash);
      edgeG.append(el('path', { d: `M${x2 - 10},${cy - 4} L${x2 - 4},${cy} L${x2 - 10},${cy + 4}`, fill: 'none', stroke: 'var(--fg-3)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
      const loss = el('text', { class: 'flow-loss', x: (x1 + x2) / 2, y: cy + 18, 'text-anchor': 'middle' }, '');
      edgeG.append(loss);
      this.edges.push({ dash, loss });
    }
    // input node
    const inG = el('g', { class: 'flow-io', transform: `translate(${xs[0]},${top})` });
    inG.append(el('rect', { width: IOW, height: NH, rx: 10, fill: 'var(--ink-2)', stroke: 'var(--hair-2)' }));
    inG.append(el('text', { class: 'cap', x: 12, y: 18 }, stage.inLabel));
    this.inBig = el('text', { class: 'big', x: 12, y: 44 }, '');
    this.inMid = el('text', { class: 'mid', x: 12, y: 63 }, '');
    inG.append(this.inBig, this.inMid);
    svg.append(inG);
    // machine nodes
    stage.machines.forEach((m, i) => {
      const g = el('g', { class: 'flow-node', transform: `translate(${xs[i + 1]},${top})`, 'data-id': m.id, tabindex: 0, role: 'button', 'aria-label': m.name });
      g.append(el('rect', { class: 'pulse', width: NW, height: NH, rx: 10, style: 'transform-box: fill-box; transform-origin: center' }));
      g.append(el('rect', { class: 'box', width: NW, height: NH, rx: 10 }));
      g.append(el('text', { class: 'ix', x: 11, y: 17 }, String(i + 1).padStart(2, '0')));
      const tag = el('text', { class: 'tag', x: NW - 10, y: 17, 'text-anchor': 'end' }, '');
      g.append(tag);
      g.append(el('text', { class: 'nm', x: 11, y: 36 }, m.name));
      const fv = el('text', { class: 'fv', x: 11, y: 56 });
      const v = el('tspan', {}, '—'); const u = el('tspan', { class: 'fu', dx: 4 }, m.disp.u);
      fv.append(v, u); g.append(fv);
      g.append(el('rect', { class: 'ut-bg', x: 11, y: 64, width: NW - 22, height: 4, rx: 2 }));
      const ut = el('rect', { class: 'ut', x: 11, y: 64, width: 0, height: 4, rx: 2 });
      g.append(ut);
      g.addEventListener('click', () => this.onPick?.(m.id));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onPick?.(m.id); } });
      svg.append(g);
      this.nodes[m.id] = { g, v, ut, tag, w: NW - 22 };
    });
    // output node
    const oG = el('g', { class: 'flow-io', transform: `translate(${xs[n + 1]},${top})` });
    oG.append(el('rect', { width: OW, height: NH, rx: 10, fill: 'color-mix(in srgb, var(--accent) 10%, var(--ink-2))', stroke: 'color-mix(in srgb, var(--accent) 45%, transparent)' }));
    oG.append(el('text', { class: 'cap', x: 12, y: 18 }, stage.outLabel));
    this.outBig = el('text', { class: 'big', x: 12, y: 44 }, '');
    this.outMoney = el('text', { class: 'money', x: 12, y: 63 }, '');
    oG.append(this.outBig, this.outMoney);
    svg.append(oG);
  }

  // 현재 생산량, 설비 부하와 선택 상태를 흐름도에 반영한다.
  update(r, selected) {
    this.last = [r, selected];
    const st = this.stage;
    if (!st || st.key !== r.key) return;
    const U = st.flowUnit;
    this.inBig.textContent = `${count(r.inSeason)} ${st.inUnit}`;
    this.inMid.textContent = `${count(r.flowIn)} ${U}/일`;
    this.outBig.textContent = `${count(r.out)} ${st.outUnit}`;
    this.outMoney.textContent = (st.key === 'auction' ? '거래액 ' : '매출 ') + moneyStr(r.headline);
    const design = r.machines[0].cap / r.machines[0].def.cap;
    r.machines.forEach((mm, i) => {
      const nd = this.nodes[mm.id];
      if (!nd) return;
      const cls = mm.util > 1 ? 'crit' : mm.util > 0.9 ? 'warn' : '';
      nd.g.setAttribute('class', `flow-node ${cls} ${mm.id === selected ? 'sel' : ''}`);
      nd.v.textContent = fmtFlow(mm.processed * mm.def.disp.f);
      nd.ut.setAttribute('width', Math.max(1, Math.min(1, mm.util) * nd.w));
      nd.tag.textContent = mm.util > 1 ? '병목' : mm.util > 0.9 ? '고부하' : `${Math.round(mm.util * 100)}%`;
      if (!cls) nd.tag.setAttribute('fill', 'var(--fg-3)'); else nd.tag.removeAttribute('fill');
      const e = this.edges[i];
      const ratio = mm.inFlow / Math.max(1e-6, design);
      e.dash.style.setProperty('--dur', `${Math.max(0.35, Math.min(3, 1.4 / Math.max(0.15, ratio)))}s`);
      if (i > 0) {
        const prev = r.machines[i - 1];
        const lossPct = prev.inFlow > 0 ? (1 - prev.outFlow / prev.inFlow) * 100 : 0;
        e.loss.textContent = lossPct > 0.05 ? `−${lossPct.toFixed(1)}%` : '';
      }
    });
    const lastM = r.machines[r.machines.length - 1];
    const lastE = this.edges[this.edges.length - 1];
    const lp = lastM.inFlow > 0 ? (1 - lastM.outFlow / lastM.inFlow) * 100 : 0;
    lastE.loss.textContent = lp > 0.05 ? `−${lp.toFixed(1)}%` : '';
    lastE.dash.style.setProperty('--dur', `${Math.max(0.35, Math.min(3, 1.4 / Math.max(0.15, lastM.outFlow / design)))}s`);
    this.svg.setAttribute('aria-label', `공정 흐름: ${st.machines.map((m) => m.name).join(' → ')}. 산출 ${count(r.out)} ${st.outUnit}`);
  }
}
