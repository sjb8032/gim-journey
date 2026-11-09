// Stage dashboard: inputs · digital twin · process flow · KPIs · charts · log.
import { STAGES, HARVEST_RANGE } from './config.js';
import { optimize, grade, defaultValues, effValue } from './sim.js';
import { $, h, icon, money, moneyStr, count, fmtStep, clock, tween, easeInOut, toast, setImg, store, reducedMotion } from './util.js';
import { sparkline, lineChart, utilBars, costBar } from './charts.js';
import { FlowDiagram } from './flow.js';
import { WorldMap } from './worldmap.js';

const COST_COLORS = ['#5a6b85', '#7c8aa3', '#3e4d63', '#8e9bb0', '#2c394b', '#b06a6a', '#46556d'];

export class Dashboard {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.idx = 0;
    this.selected = null;
    this.hist = {};
    this.live = [];
    this.timers = [];
    this.build();
    window.__dash = this;   // handy for debugging in the browser console
    app.on((reason) => { if (this.active) this.refresh(reason); });
  }

  // ------------------------------------------------------------------ DOM
  // 여섯 단계가 공유하는 대시보드와 조작 버튼을 구성한다.
  build() {
    const r = this.root;
    r.innerHTML = `
      <header class="topbar solid stage-top">
        <a class="back-link" href="#journey">${icon('arrowL')}<span>여정</span></a>
        <nav class="stepper" aria-label="여정 단계">${STAGES.map((s) => `<a href="#stage-${s.no}" style="--hue:${s.hue}" data-no="${s.no}"><span class="sw"></span><span class="n">${String(s.no).padStart(2, '0')}</span><span class="t">${s.name}</span></a>`).join('')}</nav>
        <button class="icon-btn js-fs" aria-label="전체 화면">${icon('expand')}</button>
      </header>
      <div class="dash">
        <aside class="dash-left">
          <div class="stage-hero"><div class="bg"><img alt=""></div><h2 id="d-title"></h2><p class="tag" id="d-tag"></p></div>
          <div class="panel ctl p-harvest">
            <div class="ctl-label"><label for="d-R-range">재배량 (물김 기준)</label><span class="ctl-value"><output id="d-R" for="d-R-range">600</output><span>톤</span></span></div>
            <input type="range" class="range" id="d-R-range" min="${HARVEST_RANGE[0]}" max="${HARVEST_RANGE[1]}" step="${HARVEST_RANGE[2]}">
            <div class="chain-io"><div><span class="k" id="d-in-k">투입</span><b id="d-in">-</b></div><span class="arr" aria-hidden="true">→</span><div><span class="k" id="d-out-k">산출</span><b id="d-out">-</b></div></div>
            <a class="up-hint" id="d-up" hidden></a>
          </div>
          <div class="panel ctl p-ai">
            <button class="btn-ai" id="d-ai">${icon('spark')}<span>AI 최적화</span><span class="sub">파라미터 자동 튜닝</span></button>
            <div class="ctl-label scenario-head"><span>돌발 시나리오</span><button class="btn btn-quiet btn-reset" id="d-reset" type="button" aria-label="현재 단계의 설비 설정과 시나리오 초기화">${icon('reset')}<span>초기화</span></button></div>
            <div class="chips" id="d-scen"></div>
          </div>
          <div class="panel p-machine">
            <div class="chips" id="d-mchips" style="margin-bottom:14px"></div>
            <div class="machine-head"><h3 id="d-mname"></h3><span class="state-pill" id="d-mstate"></span></div>
            <div class="params" id="d-params"></div>
          </div>
        </aside>
        <main class="dash-center">
          <div class="twin" id="d-twin">
            <div class="twin-hud"><div class="hud-live"><b id="d-live">-</b><svg id="d-live-spark" aria-hidden="true"></svg></div><div class="hud-clock" id="d-clock"></div></div>
            <div class="twin-legend" aria-hidden="true"><span class="n"><i></i>정상</span><span class="w"><i></i>고부하 90%+</span><span class="c"><i></i>병목 100%+</span></div>
            <div class="twin-banner" id="d-banner" hidden></div>
            <div class="twin-scan" id="d-scan"></div>
            <div class="twin-tools">
              <button class="icon-btn" id="d-view" aria-label="전체 보기" title="전체 보기">${icon('reset')}</button>
              <button class="icon-btn" id="d-quality" aria-label="그래픽 효과" title="그래픽 효과 켜기/끄기">${icon('layers')}</button>
            </div>
            <div class="twin-hint" id="d-hint">드래그 회전 | 휠 확대 | 기계를 누르면 파라미터</div>
          </div>
          <div class="panel flow-panel"><div class="panel-h"><h3>공정 흐름도</h3><span class="flow-sum" id="d-flow-sum"></span></div><div class="flow-scroll" id="d-flow"></div></div>
        </main>
        <aside class="dash-right">
          <div class="kpis" id="d-kpis"></div>
          <div class="panel p-season"><div class="panel-h"><h3 id="d-season-h">월별 매출</h3><div class="legend"><span><i style="background:var(--accent)"></i>현재 설정</span><span><i class="ln-dash"></i>기본 설정</span></div></div><div id="d-season"></div></div>
          <div class="panel p-map" id="d-map-panel" hidden><div class="panel-h"><h3>수출 지도</h3><span class="eyebrow">부산항 출발</span></div><div id="d-map"></div></div>
          <div class="panel p-util"><div class="panel-h"><h3>설비 가동률</h3></div><div id="d-util"></div></div>
          <div class="panel p-cost"><div class="panel-h"><h3>손익 구조</h3><span class="eyebrow" id="d-pl-h"></span></div><div id="d-cost"></div></div>
          <div class="panel p-log"><div class="panel-h"><h3>운영 로그</h3><span class="eyebrow">LIVE</span></div><div class="log" id="d-log" aria-live="off"></div></div>
        </aside>
      </div>`;

    const $r = (s) => r.querySelector(s);
    this.el = {
      img: $r('.stage-hero img'), title: $r('#d-title'), tag: $r('#d-tag'),
      R: $r('#d-R'), Rr: $r('#d-R-range'), up: $r('#d-up'), inK: $r('#d-in-k'), in: $r('#d-in'), outK: $r('#d-out-k'), out: $r('#d-out'),
      ai: $r('#d-ai'), reset: $r('#d-reset'), scen: $r('#d-scen'), mchips: $r('#d-mchips'), mname: $r('#d-mname'), mstate: $r('#d-mstate'), params: $r('#d-params'),
      twin: $r('#d-twin'), live: $r('#d-live'), liveSpark: $r('#d-live-spark'), clock: $r('#d-clock'), banner: $r('#d-banner'), scan: $r('#d-scan'),
      view: $r('#d-view'), quality: $r('#d-quality'), hint: $r('#d-hint'), flow: $r('#d-flow'), flowSum: $r('#d-flow-sum'),
      kpis: $r('#d-kpis'), season: $r('#d-season'), seasonH: $r('#d-season-h'), mapPanel: $r('#d-map-panel'), map: $r('#d-map'), util: $r('#d-util'), cost: $r('#d-cost'), plH: $r('#d-pl-h'), log: $r('#d-log'),
    };
    const E = this.el;
    E.Rr.addEventListener('input', () => this.app.setR(+E.Rr.value));
    E.ai.addEventListener('click', () => this.runAI());
    E.reset.addEventListener('click', () => this.resetStage());
    E.view.addEventListener('click', () => this.twin?.fitView(true));
    E.quality.addEventListener('click', () => {
      if (!this.twin) return;
      this.twin.setQuality(this.twin.quality === 'high' ? 'low' : 'high');
      this.syncQuality();
      store.set('quality', this.twin.quality);
    });
    this.flow = new FlowDiagram(E.flow, (id) => this.select(id, 'flow'));
    this.map = new WorldMap(E.map);
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.target.closest?.('input, select, textarea')) return;
      if (e.key === 'ArrowRight' && this.idx < 5) location.hash = `#stage-${this.idx + 2}`;
      if (e.key === 'ArrowLeft' && this.idx > 0) location.hash = `#stage-${this.idx}`;
    });
  }

  ensureTwin() {
    if (this.twin !== undefined) return;
    this.twin = null;
    // Lazy import so the landing page never pays for three.js
    this.twinReady = import('./twin.js').then(({ Twin }) => {
      this.twin = new Twin(this.el.twin, { onSelect: (id) => this.select(id, 'twin') });
      const q = store.get('quality');
      if (q && this.twin.ok) this.twin.setQuality(q);
      this.twin.onQualityDrop = () => this.syncQuality();
      this.syncQuality();
      return this.twin;
    }).catch((err) => {
      console.error(err);
      this.el.twin.insertAdjacentHTML('beforeend', '<div class="twin-fallback">3D 뷰를 불러오지 못했습니다. 공정 흐름도와 지표는 그대로 동작합니다.</div>');
    });
  }

  syncQuality() {
    if (!this.twin) return;
    this.el.quality.setAttribute('aria-pressed', String(this.twin.quality === 'high'));
  }

  // ------------------------------------------------------------------ lifecycle
  // 선택한 단계의 제목, 설비와 시뮬레이션 상태를 화면에 표시한다.
  show(idx) {
    const st = STAGES[idx];
    const changed = this.idx !== idx || !this.loaded;
    this.idx = idx; this.st = st; this.active = true; this.loaded = true;
    const E = this.el;
    this.root.style.setProperty('--accent', st.hue);
    this.root.querySelectorAll('.stepper a').forEach((a) => {
      if (+a.dataset.no === st.no) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
      else a.removeAttribute('aria-current');
    });
    if (changed) {
      E.img.classList.remove('is-ready');
      E.img.removeAttribute('src');
      const fresh = E.img.cloneNode(); E.img.replaceWith(fresh); E.img = fresh;
      setImg(E.img, window.__ASSETS?.stages?.[st.key]);
      E.title.textContent = st.title;
      E.tag.textContent = st.tagline;
      E.inK.textContent = st.inLabel; E.outK.textContent = st.outLabel;
      E.seasonH.textContent = st.months.labels[0].includes('분기') ? '분기별 매출' : '월별 매출';
      if (st.key === 'auction') E.seasonH.textContent = '월별 거래액';
      E.mapPanel.hidden = st.key !== 'distribution';
      this.hist = {}; this.live = [];
      this.buildScenarios();
      this.buildMachineChips();
      this.flow.build(st);
      const r = this.result();
      this.select(r.bottleneck?.util > 0.9 ? r.bottleneck.id : st.machines.find((m) => m.hero)?.id || st.machines[0].id, 'init');
      E.log.innerHTML = '';
      this.log(st.machines[0].id, `${st.place} 디지털 트윈 연결 | 센서 ${st.machines.length * 4 + 3}개 동기화`, 'ai');
      E.hint.style.opacity = '1';
      setTimeout(() => (E.hint.style.opacity = '0'), 6000);
    }
    this.ensureTwin();
    Promise.resolve(this.twinReady).then(() => {
      if (!this.twin?.ok || !this.active) return;
      if (changed || this.twin.stage !== st) this.twin.load(st);
      this.twin.update(this.result(), this.app.state.values[st.key]);
      this.twin.select(this.selected);
      this.twin.alarm(this.app.state.scen[st.key].size > 0);
      this.twin.start();
    });
    this.refresh('show');
    this.startTimers();
  }

  hide() {
    this.active = false;
    this.twin?.pause?.();
    this.stopTimers();
  }

  result() { return this.app.results[this.idx]; }

  // 실시간 생산량, 시계와 운영 로그를 주기적으로 갱신한다.
  startTimers() {
    this.stopTimers();
    const tickLive = () => {
      const r = this.result();
      const last = r.machines[r.machines.length - 1];
      const v = last.processed * last.def.disp.f * (1 + (Math.random() - 0.5) * 0.05);
      this.live.push(v); if (this.live.length > 40) this.live.shift();
      this.el.live.textContent = `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1)} ${last.def.disp.u}`;
      sparkline(this.el.liveSpark, this.live, { w: 90, h: 24 });
      this.el.clock.textContent = `${clock()} | ${this.st.place}`;
    };
    tickLive();
    this.timers.push(setInterval(tickLive, 1000));
    const tickLog = () => {
      if (!this.active) return;
      const [mid, tpl] = this.st.logs[(Math.random() * this.st.logs.length) | 0];
      this.log(mid, this.fill(tpl));
      this.timers.push(setTimeout(tickLog, 1600 + Math.random() * 1800));
    };
    this.timers.push(setTimeout(tickLog, 1200));
  }
  stopTimers() { this.timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); this.timers = []; }

  fill(tpl) {
    const vals = this.app.state.values[this.st.key];
    const r = this.result();
    return tpl.replace(/\{([^}]+)\}/g, (_, k) => {
      if (k === 'price') return Math.round((r.priceKg || 0) * (0.97 + Math.random() * 0.06)).toLocaleString('ko-KR');
      if (k.startsWith('rand:')) {
        const [, a, b] = k.split(':');
        const v = +a + Math.random() * (+b - +a);
        return a.includes('.') ? v.toFixed(1) : Math.round(v).toLocaleString('ko-KR');
      }
      const [m, p] = k.split('.');
      const pd = this.st.machines.find((x) => x.id === m)?.params.find((x) => x.id === p);
      const v = vals[m]?.[p];
      return v == null ? '-' : fmtStep(pd ? effValue(this.st, this.app.state.scen[this.st.key], m, pd, v) : v, pd?.step ?? 1);
    });
  }

  log(mid, text, cls = '') {
    const m = this.st.machines.find((x) => x.id === mid);
    const p = h('p', { class: cls }, h('time', {}, clock()), h('span', { html: `<b>${m ? m.name : 'SYSTEM'}</b> ${text}` }));
    this.el.log.prepend(p);
    while (this.el.log.childElementCount > 14) this.el.log.lastChild.remove();
  }

  // ------------------------------------------------------------------ controls
  buildScenarios() {
    const E = this.el, st = this.st, active = this.app.state.scen[st.key];
    E.scen.innerHTML = '';
    for (const s of st.scenarios) {
      const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(active.has(s.id)), title: s.desc, html: `${icon(s.icon, 'ic')}${s.name}` });
      b.addEventListener('click', () => this.toggleScenario(s, b));
      E.scen.append(b);
    }
    this.syncBanner();
  }

  // 돌발 시나리오를 전환하고 손익 변화와 알림을 표시한다.
  toggleScenario(s, btn) {
    const set = this.app.state.scen[this.st.key];
    const on = !set.has(s.id);
    on ? set.add(s.id) : set.delete(s.id);
    btn.setAttribute('aria-pressed', String(on));
    const before = this.result();
    this.app.recompute('scenario');
    const after = this.result();
    this.syncBanner();
    this.twin?.alarm?.(set.size > 0);
    if (on) {
      this.log(this.st.machines[0].id, `⚠ ${s.name} — ${s.desc}`, 'crit');
      toast(`<b>${s.name}</b> | 이익 ${moneyStr(before.profit)} → ${moneyStr(after.profit)}. AI 최적화로 대응해 보세요.`, 4200, 'warn');
    } else this.log(this.st.machines[0].id, `${s.name} 상황 해제`, '');
  }

  // 현재 활성화된 시나리오를 3D 화면의 안내 배너에 표시한다.
  syncBanner() {
    const st = this.st, set = this.app.state.scen[st.key];
    const act = st.scenarios.filter((s) => set.has(s.id));
    const b = this.el.banner;
    if (!act.length) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = `${icon('warn')}<b>${act.map((s) => s.name).join(' | ')}</b><span>${act[act.length - 1].desc}</span>`;
  }

  resetStage() {
    const st = this.st;
    this.app.state.values[st.key] = defaultValues()[st.key];
    this.app.state.scen[st.key].clear();
    this.buildScenarios();
    this.twin?.alarm?.(false);
    this.app.recompute('reset');
    this.renderParams();
    this.log(st.machines[0].id, '모든 설비를 기본 설정으로 되돌렸습니다', 'ai');
  }

  buildMachineChips() {
    const E = this.el;
    E.mchips.innerHTML = '';
    this.mchip = {};
    for (const m of this.st.machines) {
      const b = h('button', { class: 'chip m-chip', type: 'button', 'aria-pressed': 'false', html: `<span class="st"></span>${m.name}` });
      b.addEventListener('click', () => this.select(m.id, 'chip'));
      E.mchips.append(b);
      this.mchip[m.id] = b;
    }
  }

  select(id, src) {
    if (!this.st.machines.find((m) => m.id === id)) return;
    this.selected = id;
    for (const [mid, b] of Object.entries(this.mchip || {})) b.setAttribute('aria-pressed', String(mid === id));
    this.renderParams();
    this.twin?.select?.(id);
    if (src === 'twin' || src === 'flow' || src === 'label' || src === 'util') this.twin?.focus?.(id);
    if (src === 'flow' || src === 'util') this.el.params.closest('.panel')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (this.app.results) this.refresh('select');
  }

  renderParams() {
    const E = this.el, st = this.st, m = st.machines.find((x) => x.id === this.selected);
    if (!m) return;
    E.mname.textContent = m.name;
    E.params.innerHTML = '';
    this.paramEls = {};
    const vals = this.app.state.values[st.key][m.id];
    for (const p of m.params) {
      const id = `p-${st.key}-${m.id}-${p.id}`;
      const range = h('input', { type: 'range', class: 'range', id, min: p.min, max: p.max, step: p.step, value: vals[p.id] });
      const val = h('span', { class: 'val' });
      const row = h('div', { class: 'param' },
        h('div', { class: 'top' }, h('label', { for: id }, p.label), val),
        range,
        h('div', { class: 'hint' }, h('span', {}, `${fmtStep(p.min, p.step)}`), h('span', { class: 'opt' }, `권장 ${fmtStep(p.opt, p.step)}${p.unit.length <= 3 ? p.unit : ''}`), h('span', {}, `${fmtStep(p.max, p.step)}`)));
      range.addEventListener('input', () => {
        const v = +range.value;
        this.app.state.values[st.key][m.id][p.id] = v;
        this.paintParam(p, range, val, v);
        this.app.recompute('param');
      });
      range.addEventListener('change', () => {
        this.log(m.id, `${p.label} → ${fmtStep(+range.value, p.step)} ${p.unit} (운영자 변경)`);
      });
      this.paintParam(p, range, val, vals[p.id]);
      E.params.append(row);
      this.paramEls[p.id] = { range, val, p, row };
    }
  }

  paintParam(p, range, val, v) {
    range.value = v;
    range.style.setProperty('--p', `${((v - p.min) / (p.max - p.min)) * 100}%`);
    const sh = effValue(this.st, this.app.state.scen[this.st.key], this.selected, p, v);
    const shifted = Math.abs(sh - v) > 1e-9;
    val.innerHTML = `${fmtStep(v, p.step)}<small>${p.unit}</small>${shifted ? ` <small style="color:var(--crit)">→ 실제 ${fmtStep(sh, p.step)}</small>` : ''}`;
    range.closest('.param')?.classList.toggle('is-tuned', Math.abs(v - p.opt) <= p.step * 0.51);
  }

  // ------------------------------------------------------------------ AI
  // 최적화한 설비 설정을 적용하고 변경 내역과 ROI를 안내한다.
  runAI() {
    if (this.aiRunning) return;
    this.aiRunning = true;
    const st = this.st, idx = this.idx, E = this.el;
    const before = this.result();
    const target = optimize(this.app.state, idx);
    const from = structuredClone(this.app.state.values[st.key]);
    E.ai.classList.add('is-running');
    E.ai.querySelector('span').textContent = 'AI 최적화 중…';
    E.scan.classList.remove('run'); void E.scan.offsetWidth; E.scan.classList.add('run');
    this.twin?.scan?.();
    this.log(st.machines[0].id, `AI 최적화 시작 | 파라미터 ${st.machines.reduce((s, m) => s + m.params.length, 0)}개 탐색`, 'ai');
    const ms = st.machines;
    let lastSel = -1;
    const dur = reducedMotion() ? 10 : 2200;
    tween(dur, (k) => {
      const vals = this.app.state.values[st.key];
      for (const m of ms) for (const p of m.params) {
        const a = from[m.id][p.id], b = target[m.id][p.id];
        const v = a + (b - a) * k;
        vals[m.id][p.id] = k >= 1 ? b : Math.round(v / p.step) * p.step;
      }
      const si = Math.min(ms.length - 1, Math.floor(k * ms.length));
      if (si !== lastSel) { lastSel = si; this.select(ms[si].id, 'ai'); }
      else if (this.paramEls) for (const pe of Object.values(this.paramEls)) this.paintParam(pe.p, pe.range, pe.val, vals[this.selected][pe.p.id]);
      this.app.recompute('ai');
    }, {
      ease: easeInOut,
      done: () => {
        this.app.state.values[st.key] = target;
        this.app.recompute('ai-done');
        const after = this.result();
        this.aiRunning = false;
        E.ai.classList.remove('is-running');
        E.ai.querySelector('span').textContent = 'AI 최적화';
        this.select(after.bottleneck?.id || ms[0].id, 'ai');
        const changes = [];
        for (const m of ms) for (const p of m.params) {
          const a = from[m.id][p.id], b = target[m.id][p.id];
          if (Math.abs(a - b) > p.step / 2) changes.push({ m, p, a, b, w: Math.abs(a - b) / (p.max - p.min) });
        }
        changes.sort((x, y) => y.w - x.w).slice(0, 3).reverse().forEach((c) => this.log(c.m.id, `${c.p.label} ${fmtStep(c.a, c.p.step)} → ${fmtStep(c.b, c.p.step)}${c.p.unit}`, 'ai'));
        const dRoi = (after.roi - before.roi) * 100;
        this.log(ms[0].id, `AI 최적화 완료 | ROI ${(before.roi * 100).toFixed(1)}% → ${(after.roi * 100).toFixed(1)}%`, 'ai');
        toast(dRoi > 0.05
          ? `AI 최적화 완료 | ROI <b>${(before.roi * 100).toFixed(1)}% → ${(after.roi * 100).toFixed(1)}%</b> (+${dRoi.toFixed(1)}%p)`
          : `이미 최적 상태에 가깝습니다 | ROI <b>${(after.roi * 100).toFixed(1)}%</b>`, 4200, 'spark');
        const best = store.get('best-' + st.key, -Infinity);
        if (after.roi > best) store.set('best-' + st.key, after.roi);
      },
    });
  }

  // ------------------------------------------------------------------ render
  // 재배량과 설비 설정에 맞춰 대시보드 지표와 차트를 갱신한다.
  refresh(reason) {
    if (!this.active) return;
    const r = this.result(), st = this.st, E = this.el, S = this.app.state;
    const base = this.app.baseline[this.idx];
    E.R.textContent = S.R.toLocaleString('ko-KR');
    E.Rr.value = S.R;
    E.Rr.style.setProperty('--p', `${((S.R - HARVEST_RANGE[0]) / (HARVEST_RANGE[1] - HARVEST_RANGE[0])) * 100}%`);
    E.in.textContent = `${count(r.inSeason)} ${st.inUnit}`;
    E.out.textContent = `${count(r.out)} ${st.outUnit}`;
    const upB = this.app.results.slice(0, this.idx).filter((x) => x.maxUtil > 1).pop();
    E.up.hidden = !upB;
    if (upB) {
      E.up.href = `#stage-${upB.st.no}`;
      E.up.innerHTML = `${icon('warn')}<span>상류 병목 | ${upB.st.no}단계 ${upB.st.name} ${upB.bottleneck.def.name} ${Math.round(upB.maxUtil * 100)}%. 여기로 오는 물량이 막혀 있습니다.</span>`;
    }

    // machine chip status + state pill
    for (const mm of r.machines) {
      const dot = this.mchip?.[mm.id]?.querySelector('.st');
      if (dot) dot.className = `st ${mm.util > 1 ? 'crit' : mm.util > 0.9 ? 'warn' : ''}`;
      if (mm.id === this.selected) {
        const cls = mm.util > 1 ? 'crit' : mm.util > 0.9 ? 'warn' : '';
        E.mstate.className = `state-pill ${cls}`;
        E.mstate.innerHTML = cls === 'crit' ? `${icon('warn')}병목 ${Math.round(mm.util * 100)}%` : cls === 'warn' ? `${icon('warn')}고부하 ${Math.round(mm.util * 100)}%` : `가동률 ${Math.round(mm.util * 100)}%`;
      }
    }
    if (reason !== 'param' && reason !== 'ai' && this.paramEls) {
      const vals = S.values[st.key][this.selected];
      for (const pe of Object.values(this.paramEls)) this.paintParam(pe.p, pe.range, pe.val, vals[pe.p.id]);
    }

    this.flow.update(r, this.selected);
    const bn = r.bottleneck;
    E.flowSum.innerHTML = `산출 <b>${count(r.out)} ${st.outUnit}</b> | ${st.key === 'auction' ? '거래액' : '매출'} <b>${moneyStr(r.headline)}</b>${bn ? ` | <span class="${bn.util > 1 ? 'crit' : bn.util > 0.9 ? 'warn' : ''}">최대 부하 ${bn.def.name} ${Math.round(bn.util * 100)}%</span>` : ''}`;
    if (this.twin?.ok && this.twin.stage === st) this.twin.update(r, S.values[st.key]);
    this.renderKpis(r, base, reason);
    lineChart(E.season, {
      labels: st.months.labels,
      series: [
        { name: '현재 설정', values: r.monthly, color: st.hue },
        { name: '기본 설정', values: base.monthly, color: 'var(--fg-3)', dash: true },
      ],
      fmt: (v, axis) => { const m = money(v); return axis ? m.v.replace(/\.0$/, '') + (m.u === '억원' ? '억' : m.u === '만원' ? '만' : '') : m.v + m.u; },
      height: 150,
    });
    utilBars(E.util, r.machines.map((mm) => ({ id: mm.id, name: mm.def.name, util: mm.util, cls: mm.util > 1 ? 'crit' : mm.util > 0.9 ? 'warn' : '', sel: mm.id === this.selected })), (id) => this.select(id, 'util'));
    const c = r.costs;
    E.plH.textContent = r.profit >= 0 ? `영업이익률 ${((r.profit / Math.max(1, r.revenue)) * 100).toFixed(1)}%` : '적자';
    costBar(E.cost, [
      { name: st.key === 'farm' ? '채묘망 구입' : st.key === 'seed' ? '종자 원료' : '원료 매입', value: c.input, color: COST_COLORS[0] },
      { name: '에너지', value: c.energy, color: COST_COLORS[1] },
      { name: st.key === 'distribution' ? '물류비' : '부자재', value: c.material + c.logistics, color: COST_COLORS[2] },
      { name: '인건비 | 고정비', value: c.fixed, color: COST_COLORS[3] },
      { name: '감가상각', value: c.dep, color: COST_COLORS[4] },
      ...(c.overtime > 0 ? [{ name: '초과 가동', value: c.overtime, color: COST_COLORS[5] }] : []),
      { name: '영업이익', value: Math.max(0, r.profit), color: st.hue },
    ].filter((d) => d.value > 0 || d.name === '영업이익'), moneyStr);
    if (st.key === 'distribution') this.map.update(r);
  }

  // 단계별 핵심 지표와 기본 설정 대비 변화를 표시한다.
  renderKpis(r, base, reason) {
    const st = this.st, E = this.el;
    const ex = st.extra(r);
    const defs = [
      { id: 'rev', label: st.key === 'auction' ? '거래액 (낙찰 총액)' : '매출액', v: r.headline, b: base.headline, f: money, hero: true },
      { id: 'roi', label: 'ROI (연간)', v: r.roi * 100, b: base.roi * 100, f: (v) => ({ v: v.toFixed(1), u: '%' }), pp: true },
      { id: 'profit', label: st.key === 'auction' ? '영업이익 (수수료)' : '영업이익', v: r.profit, b: base.profit, f: money },
      { id: 'yield', label: '수율', v: r.yield * 100, b: base.yield * 100, f: (v) => ({ v: v.toFixed(1), u: '%' }), pp: true },
      { id: 'out', label: st.outLabel, v: r.out, b: base.out, f: (v) => ({ v: count(v), u: st.outUnit }) },
      { id: 'q', label: '품질 등급', v: r.Qeff * 100, b: base.Qeff * 100, f: (v) => ({ v: grade(v / 100), u: `${v.toFixed(0)}점` }), pp: true, unitless: true },
      { id: 'ex', label: ex.label, v: parseFloat(String(ex.value).replace(/,/g, '')), b: null, f: () => ({ v: ex.value, u: ex.unit }) },
    ];
    if (!this.kpiEls || this.kpiStage !== st.key) {
      E.kpis.innerHTML = '';
      this.kpiEls = {};
      this.kpiStage = st.key;
      for (const d of defs) {
        const tile = h('div', { class: `kpi ${d.hero ? 'hero' : ''}` },
          h('div', { class: 'lb' }, h('span', { class: 'lbt' }, d.label)),
          h('div', { class: 'vl' }, h('b'), h('span')),
          h('div', { class: 'dl' }));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'spark'); svg.setAttribute('aria-hidden', 'true');
        tile.append(svg);
        E.kpis.append(tile);
        this.kpiEls[d.id] = { tile, b: tile.querySelector('.vl b'), u: tile.querySelector('.vl span'), dl: tile.querySelector('.dl'), lbt: tile.querySelector('.lbt'), svg };
      }
    }
    for (const d of defs) {
      const k = this.kpiEls[d.id];
      const fv = d.f(d.v);
      k.lbt.textContent = d.label;
      k.b.textContent = fv.v; k.u.textContent = fv.u;
      const hist = (this.hist[d.id] ||= []);
      if (reason !== 'select' && isFinite(d.v)) {
        if (!hist.length || Math.abs(hist[hist.length - 1] - d.v) > 1e-9) { hist.push(d.v); if (hist.length > 30) hist.shift(); }
      }
      if (hist.length < 2) hist.unshift(d.b ?? d.v);
      sparkline(k.svg, hist, { color: st.hue });
      if (d.b != null && isFinite(d.b)) {
        const diff = d.pp ? d.v - d.b : d.b !== 0 ? ((d.v - d.b) / Math.abs(d.b)) * 100 : 0;
        const up = diff > 0.05, down = diff < -0.05;
        k.dl.className = `dl ${up ? 'up' : down ? 'down' : ''}`;
        k.dl.textContent = `${up ? '▲' : down ? '▼' : '―'} ${Math.abs(diff).toFixed(1)}${d.pp ? (d.unitless ? '점' : '%p') : '%'}`;
      } else k.dl.textContent = ex.note || (st.key === 'distribution' ? `수출 비중 ${(r.exportShare * 100).toFixed(0)}% | ${r.countries}개국` : '현재 설정 기준');
      if (reason === 'ai-done') { k.tile.classList.remove('flash'); void k.tile.offsetWidth; k.tile.classList.add('flash'); }
    }
  }
}
