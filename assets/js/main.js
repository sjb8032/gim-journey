// App shell: asset manifest, router, landing, journey, kiosk tour.
import { STAGES, HARVEST_RANGE, INTRO_VIDEO } from './config.js';
import { createState, run, runBaseline } from './sim.js';
import { $, $$, h, icon, money, moneyStr, count, setImg, toast, store, reducedMotion, isCoarse } from './util.js';
import { chainChart } from './charts.js';
import { Dashboard } from './dashboard.js';

// ---------------------------------------------------------------- state
const app = {
  state: createState(),
  results: null,
  baseline: null,
  listeners: new Set(),
  on(fn) { this.listeners.add(fn); },
  recompute(reason) {
    this.results = run(this.state);
    this.baseline = runBaseline(this.state);
    for (const f of this.listeners) f(reason);
  },
  setR(v) { this.state.R = v; this.recompute('R'); },
  resetAll() { this.state = createState(); this.recompute('reset-all'); },
};
window.__app = app;

// ---------------------------------------------------------------- assets
async function loadAssets() {
  try {
    const r = await fetch('assets/assets.json', { cache: 'no-cache' });
    if (r.ok) window.__ASSETS = await r.json();
  } catch { /* offline or file:// — placeholders stay */ }
  window.__ASSETS ||= { preferLocal: false, stages: {}, models: {} };
}

// ---------------------------------------------------------------- views
const views = {
  home: $('#view-home'),
  journey: $('#view-journey'),
  stage: $('#view-stage'),
  data: $('#view-data'),
};
let current = null;
let dash = null;
let dataView = null;

function activate(name, arg) {
  for (const [k, el] of Object.entries(views)) el.classList.toggle('is-active', k === name);
  if (name !== 'stage') dash?.hide();
  if (name !== 'data') dataView?.hide?.();
  if (name === 'home') { homeBg.start(); film.play(); } else { homeBg.stop(); film.pause(); }
  if (name === 'stage') { dash ||= new Dashboard(views.stage, app); dash.show(arg); }
  if (name === 'data') {
    import('./data.js').then(({ DataView }) => { dataView ||= new DataView(views.data); dataView.show(arg); })
      .catch((e) => { console.error(e); views.data.querySelector('.data-body').innerHTML = '<p class="muted" style="padding:24px">데이터 뷰어를 불러오지 못했습니다.</p>'; });
  }
  if (name === 'journey') renderJourney();
  const titles = { home: '김의 여정', journey: '김의 여정 · 여섯 단계', stage: `${STAGES[arg]?.name ?? ''} 공장 · 김의 여정`, data: '실험 데이터 · 김의 여정' };
  document.title = titles[name] || '김의 여정';
  current = { name, arg };
}

function route() {
  const hsh = location.hash.replace('#', '') || 'home';
  let name = 'home', arg;
  if (hsh === 'journey') name = 'journey';
  else if (/^stage-[1-6]$/.test(hsh)) { name = 'stage'; arg = +hsh.slice(6) - 1; }
  else if (hsh === 'data' || hsh === 'data-video') { name = 'data'; arg = hsh === 'data-video' ? 'video' : 'csv'; }
  if (current && current.name === name && current.arg === arg) return;
  const swap = () => activate(name, arg);
  const crossView = !current || current.name !== name;
  if (crossView && document.startViewTransition && !reducedMotion()) document.startViewTransition(swap);
  else swap();
}

// ---------------------------------------------------------------- landing
const homeBg = (() => {
  const cv = $('#home-canvas');
  const g = cv.getContext('2d');
  let raf = 0, on = false, t0 = performance.now(), last = 0;
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    if (now - last < 33) return;
    last = now;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = (now - t0) / 1000;
    const hy = H * 0.36;
    let grd = g.createLinearGradient(0, 0, 0, hy);
    grd.addColorStop(0, '#060a14'); grd.addColorStop(0.7, '#141c33'); grd.addColorStop(1, '#3a3346');
    g.fillStyle = grd; g.fillRect(0, 0, W, hy);
    const glow = g.createRadialGradient(W * 0.64, hy, 0, W * 0.64, hy, W * 0.55);
    glow.addColorStop(0, 'rgba(255,176,110,.42)'); glow.addColorStop(0.35, 'rgba(160,110,140,.14)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, hy + 2);
    grd = g.createLinearGradient(0, hy, 0, H);
    grd.addColorStop(0, '#1b2433'); grd.addColorStop(0.25, '#0b1622'); grd.addColorStop(1, '#03070c');
    g.fillStyle = grd; g.fillRect(0, hy, W, H - hy);
    // distant islands
    g.fillStyle = 'rgba(8,12,20,.9)';
    g.beginPath(); g.moveTo(W * 0.05, hy); g.quadraticCurveTo(W * 0.14, hy - H * 0.035, W * 0.24, hy); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W * 0.78, hy); g.quadraticCurveTo(W * 0.86, hy - H * 0.022, W * 0.97, hy); g.closePath(); g.fill();
    // reflection of the glow
    const refl = g.createRadialGradient(W * 0.64, hy + 4, 0, W * 0.64, hy + 4, W * 0.35);
    refl.addColorStop(0, 'rgba(255,170,110,.22)'); refl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = refl; g.fillRect(0, hy, W, H * 0.3);
    // net rows in perspective
    const vx = W * 0.64, rows = 42;
    for (let i = 0; i < rows; i++) {
      const u = i / (rows - 1);
      const bx = -W * 0.9 + u * W * 2.8;
      g.strokeStyle = `rgba(150,175,205,${0.06 + 0.05 * (1 - Math.abs(u - 0.5))})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(vx, hy + 1); g.lineTo(bx, H); g.stroke();
      for (let k = 1; k < 26; k++) {
        const s = Math.pow(k / 26, 2.2);
        const x = vx + (bx - vx) * s, y = hy + 1 + (H - hy) * s + Math.sin(t * 1.2 + i * 0.7 + k * 0.9) * 1.2 * s * 3;
        const r = 0.5 + s * 2.6;
        g.fillStyle = `rgba(10,14,20,${0.5 + s * 0.5})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        if (s > 0.25) { g.fillStyle = `rgba(200,220,240,${0.05 * s})`; g.fillRect(x - r, y - r * 0.4, r * 2, 0.8); }
      }
    }
    // boat with a warm light and wake
    const bp = (t * 0.012) % 1;
    const bxp = W * (0.15 + bp * 0.7), byp = hy + (H - hy) * 0.18;
    const wake = g.createLinearGradient(bxp - 160, byp, bxp, byp);
    wake.addColorStop(0, 'rgba(220,235,255,0)'); wake.addColorStop(1, 'rgba(220,235,255,.35)');
    g.strokeStyle = wake; g.lineWidth = 2; g.beginPath(); g.moveTo(bxp - 160, byp + 6); g.lineTo(bxp, byp + 2); g.stroke();
    g.fillStyle = 'rgba(10,14,20,.95)'; g.fillRect(bxp - 10, byp - 3, 20, 6);
    const lg = g.createRadialGradient(bxp + 4, byp - 6, 0, bxp + 4, byp - 6, 26);
    lg.addColorStop(0, 'rgba(255,214,150,.95)'); lg.addColorStop(0.2, 'rgba(255,190,120,.4)'); lg.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = lg; g.fillRect(bxp - 30, byp - 32, 60, 52);
    // mist
    const mist = g.createLinearGradient(0, hy - 30, 0, hy + 60);
    mist.addColorStop(0, 'rgba(180,190,215,0)'); mist.addColorStop(0.5, `rgba(180,190,215,${0.07 + 0.02 * Math.sin(t * 0.5)})`); mist.addColorStop(1, 'rgba(180,190,215,0)');
    g.fillStyle = mist; g.fillRect(0, hy - 30, W, 90);
    if (reducedMotion()) { cancelAnimationFrame(raf); }
  };
  return {
    start() { if (on || document.hidden) return; on = true; raf = requestAnimationFrame(draw); },
    stop() { on = false; cancelAnimationFrame(raf); },
  };
})();

// 홈 배경 미디어와 여섯 단계 바로가기, 휴대폰 접속용 QR을 준비한다.
function initHome() {
  const A = window.__ASSETS;
  const img = $('#home-img');
  setImg(img, A.hero);
  const video = $('#home-video');
  if (A.heroVideo && !reducedMotion() && !(navigator.connection && navigator.connection.saveData)) {
    const srcs = [A.preferLocal && A.heroVideo.local, A.heroVideo.remote, !A.preferLocal && A.heroVideo.local].filter(Boolean);
    let i = 0;
    const next = () => { if (i < srcs.length) { video.src = srcs[i++]; video.play().catch(() => {}); } };
    video.addEventListener('error', next);
    video.addEventListener('playing', () => video.classList.add('is-ready'), { once: true });
    next();
  }
  // steps strip
  $('#home-steps').innerHTML = STAGES.map((s) => `<li><a href="#stage-${s.no}" style="--hue:${s.hue}"><span class="n">${String(s.no).padStart(2, '0')}</span><span class="t">${s.name}</span></a></li>`).join('');
  // QR to open on a phone
  try {
    if (window.qrcode && /^https?:/.test(location.protocol)) {
      const url = location.origin + location.pathname;
      const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
      $('#home-qr .qr').innerHTML = qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
      $('#home-qr').hidden = false;
      $('#home-qr').title = url;
    }
  } catch { /* QR optional */ }
}

// ---------------------------------------------------------------- intro video (YouTube)
const film = (() => {
  const V = INTRO_VIDEO;
  let card = null;
  const src = (autoplay) => {
    const id = encodeURIComponent(V.youtube);
    const q = new URLSearchParams({ autoplay: autoplay ? '1' : '0', mute: '1', playsinline: '1', rel: '0', modestbranding: '1', enablejsapi: '1', loop: '1', playlist: V.youtube });
    if (/^https?:/.test(location.protocol)) q.set('origin', location.origin);
    return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
  };
  const frame = (autoplay) => h('iframe', {
    src: src(autoplay), title: `${V.title} (${V.source})`, loading: 'eager',
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
  const send = (func) => { try { card?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'); } catch { /* ignore */ } };
  const wide = () => window.matchMedia('(min-width: 1100px)').matches;
  function init() {
    if (!V?.youtube) return;
    $('#film-title').textContent = V.title;
    $('#film-src').textContent = V.source ? `· ${V.source}` : '';
    $('#film-open').hidden = false;
    const mount = () => {
      if (!wide() || card) return;
      card = frame(true);
      $('#film-frame').append(card);
      $('#home-film').hidden = false;
    };
    mount();
    window.matchMedia('(min-width: 1100px)').addEventListener('change', mount);
    const modal = $('#film-modal');
    const close = () => { modal.hidden = true; $('#film-modal-frame').innerHTML = ''; };
    $('#film-open').addEventListener('click', () => {
      send('pauseVideo');
      const f = frame(true); f.src = f.src.replace('mute=1', 'mute=0');
      $('#film-modal-frame').append(f);
      modal.hidden = false;
      $('#film-close').focus();
    });
    $('#film-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }
  return { init, play: () => send('playVideo'), pause: () => { send('pauseVideo'); } };
})();

// ---------------------------------------------------------------- journey
let journeyBuilt = false;
function buildJourney() {
  const track = $('#track');
  track.innerHTML = STAGES.map((s, i) => `
    <li class="stage-card" style="--hue:${s.hue};--next:${STAGES[i + 1]?.hue ?? s.hue}">
      <a class="stage-link" href="#stage-${s.no}" aria-label="${s.no}단계 ${s.name} 공장 열기">
        <div class="stage-media" style="view-transition-name: stage-media-${s.no}">
          <div class="ph" style="background:radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, ${s.hue} 34%, #0b1018), #070a10 70%)"></div>
          <img alt="" loading="lazy">
          <span class="stage-no">${String(s.no).padStart(2, '0')}</span>
          <span class="stage-time">${s.time}</span>
          <span class="stage-alert" hidden>병목</span>
          <span class="stage-name-over">${s.name}</span>
        </div>
        <div class="stage-body">
          <p class="stage-en">${s.en} · ${s.place}</p>
          <p class="stage-desc">${s.tagline}</p>
          <dl class="stage-io">
            <div><dt>${s.outLabel}</dt><dd data-k="out">-</dd></div>
            <div><dt>${s.key === 'auction' ? '거래액' : '매출'}</dt><dd data-k="rev">-</dd></div>
          </dl>
          <span class="stage-cta">공장 열기 ${icon('arrowR')}</span>
        </div>
      </a>
      <span class="rail" aria-hidden="true"></span>
    </li>`).join('');
  $$('.stage-card', track).forEach((li, i) => setImg($('img', li), window.__ASSETS.stages?.[STAGES[i].key]));
  const R = $('#j-R-range');
  R.min = HARVEST_RANGE[0]; R.max = HARVEST_RANGE[1]; R.step = HARVEST_RANGE[2];
  R.addEventListener('input', () => app.setR(+R.value));
  $('#j-minus').addEventListener('click', () => app.setR(Math.max(HARVEST_RANGE[0], app.state.R - 50)));
  $('#j-plus').addEventListener('click', () => app.setR(Math.min(HARVEST_RANGE[1], app.state.R + 50)));
  $('#j-reset').addEventListener('click', () => { app.resetAll(); toast('모든 단계를 기본 설정으로 되돌렸습니다'); });
  journeyBuilt = true;
}

function renderJourney() {
  if (!journeyBuilt) buildJourney();
  const rs = app.results, S = app.state;
  $('#j-R').textContent = S.R.toLocaleString('ko-KR');
  const R = $('#j-R-range'); R.value = S.R;
  R.style.setProperty('--p', `${((S.R - HARVEST_RANGE[0]) / (HARVEST_RANGE[1] - HARVEST_RANGE[0])) * 100}%`);
  $$('.stage-card').forEach((li, i) => {
    const r = rs[i];
    $('[data-k="out"]', li).textContent = `${count(r.out)} ${r.st.outUnit}`;
    $('[data-k="rev"]', li).textContent = moneyStr(r.headline);
    const al = $('.stage-alert', li);
    al.hidden = r.maxUtil <= 1;
    al.textContent = `병목 ${Math.round(r.maxUtil * 100)}%`;
  });
  const last = rs[5], raw = rs[2];
  const fin = money(last.revenue);
  $('#j-final').innerHTML = `${fin.v}<small>${fin.u}</small>`;
  $('#j-mult').innerHTML = `×${(last.revenue / Math.max(1, raw.gross)).toFixed(1)}<small>배</small>`;
  const totalProfit = rs.reduce((s, r) => s + r.profit, 0);
  const tp = money(totalProfit);
  $('#j-profit').innerHTML = `${tp.v}<small>${tp.u}</small>`;
  chainChart($('#j-chain'), rs.map((r) => ({ name: r.st.name, hue: r.st.hue, value: r.headline, sub: `ROI ${(r.roi * 100).toFixed(0)}%` })), moneyStr, (i) => { location.hash = `#stage-${i + 1}`; });
}

app.on(() => { if (current?.name === 'journey' || !journeyBuilt) { if (journeyBuilt) renderJourney(); } });

// ---------------------------------------------------------------- tour / kiosk
const tour = {
  on: false, timer: 0, step: 0,
  start() {
    if (this.on) return;
    this.on = true; this.step = 0;
    $$('.js-tour').forEach((b) => b.setAttribute('aria-pressed', 'true'));
    toast('자동 시연을 시작합니다 · 화면을 누르면 멈춥니다', 3000, 'play');
    this.next();
  },
  next() {
    if (!this.on) return;
    if (this.step >= STAGES.length) { location.hash = '#journey'; this.timer = setTimeout(() => { this.step = 0; this.next(); }, 9000); return; }
    location.hash = `#stage-${this.step + 1}`;
    const s = this.step;
    this.timer = setTimeout(() => {
      if (!this.on) return;
      if (dash && dash.idx === s) dash.runAI();
      this.timer = setTimeout(() => { this.step++; this.next(); }, 7000);
    }, 3200);
  },
  stop() {
    if (!this.on) return;
    this.on = false; clearTimeout(this.timer);
    $$('.js-tour').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    toast('자동 시연을 멈췄습니다', 2000, 'pause');
  },
};
document.addEventListener('pointerdown', (e) => { if (tour.on && !e.target.closest('.js-tour')) tour.stop(); }, true);
document.addEventListener('keydown', (e) => { if (tour.on && e.key !== 'F' && e.key !== 'f') tour.stop(); }, true);

const kiosk = new URLSearchParams(location.search).has('kiosk');
let idleT = 0;
function bumpIdle() {
  if (!kiosk) return;
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (!tour.on) { app.resetAll(); tour.start(); } }, 75000);
}
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, bumpIdle, { passive: true }));

// ---------------------------------------------------------------- chrome
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast('이 화면에서는 전체 화면을 쓸 수 없습니다', 2400, 'warn'); }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.js-fs')) toggleFullscreen();
  if (e.target.closest('.js-tour')) { tour.on ? tour.stop() : tour.start(); }
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) homeBg.stop(); else if (current?.name === 'home') homeBg.start(); });

// ---------------------------------------------------------------- boot
(async function boot() {
  await loadAssets();
  app.recompute('boot');
  initHome();
  film.init();
  window.addEventListener('hashchange', route);
  route();
  bumpIdle();
  document.documentElement.classList.add('booted');
})();
