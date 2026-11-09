// Dot-matrix export map for the 유통 stage (Pacific-centred equirectangular).
import { DESTINATIONS, ORIGIN } from './config.js';
import { h, moneyStr } from './util.js';

const MASK = 'AAAAAwAnw////4AAIAAAAAAGAAAAAAAAAAADivwAf//wAAAAADAAf/wAHYAAAAAADoi3sAP//gAAAAAMAD///sAAAAgBgACfwz/AD/+gAAA4AEHf///+/8gBAP/7/nJdjwD/+AAAH/AA7f///////f4P//////h8H/gAAAf/6//f////////Mf/////9H4D8AeAA+ev///////////AP/////4A0B4AAAD5/////////////Af3////gHgA4AAAH5///////////LwAHgH///gHkAAAAAH4/////////+CIAABAB///4D+AAAAGCx/////////4A8AAIAAf///n/gAAAOCD/////////wA4AAAAAf///n/wAAAbP///////////AgAAAAAP/////wAAADf//////////9AAAAAAAF////0YAAAB///////////9AAAAAAAD////8EAAAB///////////5AAAAAAAD////2AAAAB/f5fP//////wAAAAAAAD////gAAAAfxnwPP//////jAAAAAAAD////AAAAAPCb3/n/////+CAAAAAAAD///8AAAAAfALf/n////+ECAAAAAAAB///8AAAAAGHQP/n/////mMAAAAAAAA///8AAAAAH+Ai///////E8AAAAAAAAf//wAAAAAP/AA///////BgAAAAAAAAP//gAAAAAf/73///////gAAAAAAAAAD/AQAAAAAf////f/////gAAAAAAAAAF+AQAAAAB///+/n/////AAAAAAAAAAC+AAAAAAB///+f0H////AAAAAAAAAAAeAwAAAAD////f/B///8gAAAAAAAAAAeGEAAAAH////v+B/z/AAAAAAAAAAAAPMAgAAAD////n+A/B+gAAAAAAAAAAAD8AAAAAD////n4AeB/AgAAAAAAAAAAAPAAAAAH////3gAcAfAgAAAAAAAAAAADAAAAAD////6AAcAfggAAAAAAAAAAABDwAAAD////8wAMATAIAAAAAAAAAAAAr/AAAB/////gAKASAAAAAAAAAAAAAAH/gAAA/////gACAAAIAAAAAAAAAAAAH/8AAAaH///AAAAsGAAAAAAAAAAAAAH/+AAAAB//+AAAAUOAAAAAAAAAAAAAP/+AAAAB//8AAAAYegAAAAAAAAAAAAP//gAAAD//4AAAAMeBgAAAAAAAAAAAP//8AAAB//wAAAAGdiuAAAAAAAAAAAf///AAAA//wAAAACAQHgAAAAAAAAAAP///gAAA//wAAAABwAHwgAAAAAAAAAH///AAAA//wAAAAACIDQIAAAAAAAAAH//+AAAAf/wAAAAAAAAAAAAAAAAAAAD//+AAAA//wgAAAAABxAAAAAAAAAAAD//+AAAA//wgAAAAAPxgBAAAAAAAAAA//8AAAA//jgAAAAAf5gAAAAAAAAAAAf/8AAAA//DgAAAAAf/gAAAAAAAAAAAf/8AAAAf/DAAAAAD//4CAAAAAAAAAAf/wAAAAf/DAAAAAH//4AAAAAAAAAAAf/AAAAAf+CAAAAAH//8AAAAAAAAAAAf/AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAD//+AAAAAAAAAAA/8AAAAAHwAAAAAADwf8AAAAAAAAAAA/gAAAAAAAAAAAAACAH4AIAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB+AAAAAAAAAAAAAAAAAAAGAAAAAAAAB6AAAAAAAAAAAAAAAAAwAMAAAAAAAAA8AAAAAAAAAAAAAAAAAQAYAAAAAAAAB4AAAAAAAAAAAAAAAAAAAwAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAACAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAeAAIP+f/gAAAAAAAAAAAMAAAAAAABP/+H//////AAAAAAAAAAA+AAAAAf////8////////AA=';
const STEP = 2, COLS = 180, ROWS = 75, LAT0 = 78;
const X = (lon) => (lon + 30 + 360) % 360;
const Y = (lat) => LAT0 - lat;

let dotsPath = null;
function landPath() {
  if (dotsPath) return dotsPath;
  const bin = atob(MASK);
  let d = '';
  for (let i = 0; i < COLS * ROWS; i++) {
    if (!(bin.charCodeAt(i >> 3) & (1 << (7 - (i & 7))))) continue;
    const r = Math.floor(i / COLS), c = i % COLS;
    const lat = LAT0 - r * STEP - STEP / 2, lon = -180 + c * STEP + STEP / 2;
    d += `M${X(lon).toFixed(1)} ${Y(lat).toFixed(1)}h0`;
  }
  return (dotsPath = d);
}

export class WorldMap {
  constructor(host) {
    this.host = host;
    host.classList.add('wmap');
    this.wrap = h('div', { class: 'chart' });
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 360 150');
    this.svg.setAttribute('role', 'img');
    this.tip = h('div', { class: 'chart-tip' });
    this.wrap.append(this.svg, this.tip);
    this.list = h('div', { class: 'wmap-list' });
    host.append(this.wrap, this.list);
    this.svg.addEventListener('pointermove', (e) => {
      const t = e.target.closest('.dst');
      if (!t) { this.tip.classList.remove('on'); return; }
      const d = this.rows[+t.dataset.i];
      this.tip.innerHTML = `<div class="t">${d.name}</div><div class="r">수출액<b>${moneyStr(d.value)}</b></div><div class="r">비중<b>${(d.share * 100).toFixed(1)}%</b></div>`;
      const r = this.wrap.getBoundingClientRect();
      this.tip.style.left = `${e.clientX - r.left}px`; this.tip.style.top = `${e.clientY - r.top}px`;
      this.tip.classList.add('on');
    });
    this.svg.addEventListener('pointerleave', () => this.tip.classList.remove('on'));
  }

  update(r) {
    const N = Math.max(1, Math.min(DESTINATIONS.length, r.countries || 15));
    const pick = DESTINATIONS.slice(0, N);
    const tot = pick.reduce((s, d) => s + d[3], 0);
    this.rows = pick.map(([name, lat, lon, w]) => ({ name, lat, lon, share: w / tot, value: (r.exportRevenue || 0) * (w / tot) }));
    if (this.lastN === N && this.svg.childElementCount) { this.renderList(); return; }
    this.lastN = N;
    const ox = X(ORIGIN[2]), oy = Y(ORIGIN[1]);
    let out = `<path class="land" d="${landPath()}"/>`;
    this.rows.forEach((d, i) => {
      const x = X(d.lon), y = Y(d.lat);
      const dist = Math.hypot(x - ox, y - oy);
      const mx = (x + ox) / 2, my = (y + oy) / 2 - dist * 0.28;
      out += `<path class="arc" d="M${ox},${oy} Q${mx.toFixed(1)},${my.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}" style="animation-delay:-${(i * 0.13).toFixed(2)}s"/>`;
    });
    this.rows.forEach((d, i) => {
      out += `<circle class="dst" data-i="${i}" cx="${X(d.lon).toFixed(1)}" cy="${Y(d.lat).toFixed(1)}" r="${(1.1 + Math.sqrt(d.share) * 6).toFixed(2)}"/>`;
    });
    out += `<circle class="org-ring" cx="${ox}" cy="${oy}" r="2.2"/><circle class="org" cx="${ox}" cy="${oy}" r="1.6"/>`;
    out += `<text x="${ox + 3}" y="${oy + 6}" fill="var(--fg-2)" font-size="5">부산항</text>`;
    this.svg.innerHTML = out;
    this.svg.setAttribute('aria-label', `수출 ${N}개국: ` + this.rows.slice(0, 6).map((d) => d.name).join(', ') + ' 등');
    this.renderList();
  }

  renderList() {
    this.list.innerHTML = this.rows.slice(0, 6).map((d) => `<div><span>${d.name}</span><b>${moneyStr(d.value)}</b></div>`).join('');
  }
}
