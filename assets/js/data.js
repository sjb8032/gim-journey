// Data viewer: scrollable CSV table (virtualised) + vertical swipe feed for depth-camera video.
import { $, h, icon, toast, fmt1 } from './util.js';

const ROW_H = 32, HEAD_H = 40;

// ---------------------------------------------------------------- CSV parsing
export function decodeText(buf) {
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), enc: 'UTF-8' }; }
  catch { return { text: new TextDecoder('euc-kr').decode(buf), enc: 'EUC-KR' }; }
}

export function parseCSV(text) {
  const first = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
  const cands = [',', '\t', ';', '|'];
  const delim = cands.map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every((x) => x.trim() === '')) rows.pop();
  const header = (rows.shift() || []).map((x, i) => x.trim() || `열${i + 1}`);
  const n = header.length;
  const body = rows.map((r) => { const o = r.slice(0, n); while (o.length < n) o.push(''); return o; });
  const types = header.map((_, c) => {
    let num = 0, tot = 0;
    for (let i = 0; i < Math.min(body.length, 400); i++) {
      const v = body[i][c].trim(); if (!v) continue; tot++;
      if (isFinite(Number(v))) num++;
    }
    return tot && num / tot >= 0.9 ? 'num' : 'str';
  });
  return { header, rows: body, types, delim: delim === '\t' ? 'TAB' : delim };
}

function stats(vals) {
  const xs = vals.filter((v) => isFinite(v));
  if (!xs.length) return null;
  let min = Infinity, max = -Infinity, s = 0;
  for (const v of xs) { if (v < min) min = v; if (v > max) max = v; s += v; }
  const mean = s / xs.length;
  let ss = 0; for (const v of xs) ss += (v - mean) ** 2;
  return { n: xs.length, min, max, mean, std: Math.sqrt(ss / Math.max(1, xs.length - 1)) };
}
const fnum = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3));

// ---------------------------------------------------------------- view
export class DataView {
  constructor(root) {
    this.root = root;
    this.csvList = [];
    this.clips = [];
    this.build();
    this.manifest = fetch('data/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    this.manifest.then((m) => this.applyManifest(m));
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <header class="topbar solid">
        <a class="back-link" href="#home">${icon('arrowL')}<span>처음으로</span></a>
        <div class="tabs" role="tablist" aria-label="데이터 종류">
          <button role="tab" id="dv-t-csv" aria-controls="dv-p-csv" aria-selected="true">${icon('table')}<span>실험 데이터 CSV</span></button>
          <button role="tab" id="dv-t-vid" aria-controls="dv-p-vid" aria-selected="false">${icon('video')}<span>Depth 카메라 영상</span></button>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-quiet" id="dv-open" type="button">${icon('file')}<span>파일 열기</span></button>
        <input type="file" id="dv-file" accept=".csv,.tsv,.txt,video/*" multiple hidden>
        <a class="btn btn-quiet" href="#journey">체험하기</a>
        <button class="icon-btn js-fs" aria-label="전체 화면">${icon('expand')}</button>
      </header>
      <div class="data-body">
        <section class="tab-panel" id="dv-p-csv" role="tabpanel" aria-labelledby="dv-t-csv">
          <div class="csv-bar">
            <div class="title"><h2 id="dv-title">불러오는 중…</h2><span class="badge" id="dv-badge" hidden></span></div>
            <select class="select" id="dv-select" aria-label="CSV 파일 선택" hidden></select>
            <input class="search" id="dv-search" type="search" placeholder="표에서 찾기" aria-label="표에서 찾기">
          </div>
          <div class="csv-meta" id="dv-meta"></div>
          <div class="csv-split">
            <div class="table-wrap" id="dv-wrap" tabindex="0" aria-label="CSV 표 (스크롤)"><div class="vtable" id="dv-table"></div></div>
            <aside class="col-stats panel" id="dv-stats"></aside>
          </div>
        </section>
        <section class="tab-panel" id="dv-p-vid" role="tabpanel" aria-labelledby="dv-t-vid" hidden>
          <div class="feed-wrap">
            <div class="feed" id="dv-feed" tabindex="0" aria-label="영상 피드, 위아래로 넘겨 보세요"></div>
            <nav class="feed-nav" aria-label="영상 이동">
              <button class="icon-btn" id="dv-up" aria-label="이전 영상">${icon('up')}</button>
              <div class="dots" id="dv-dots"></div>
              <button class="icon-btn" id="dv-down" aria-label="다음 영상">${icon('down')}</button>
            </nav>
          </div>
        </section>
      </div>
      <div class="drop-overlay" id="dv-drop">CSV나 영상 파일을 놓으면 바로 열립니다</div>`;
    const q = (s) => r.querySelector(s);
    this.el = {
      tCsv: q('#dv-t-csv'), tVid: q('#dv-t-vid'), pCsv: q('#dv-p-csv'), pVid: q('#dv-p-vid'),
      open: q('#dv-open'), file: q('#dv-file'), title: q('#dv-title'), badge: q('#dv-badge'), select: q('#dv-select'), search: q('#dv-search'),
      meta: q('#dv-meta'), wrap: q('#dv-wrap'), table: q('#dv-table'), stats: q('#dv-stats'),
      feed: q('#dv-feed'), dots: q('#dv-dots'), up: q('#dv-up'), down: q('#dv-down'), drop: q('#dv-drop'),
    };
    const E = this.el;
    E.tCsv.addEventListener('click', () => (location.hash = '#data'));
    E.tVid.addEventListener('click', () => (location.hash = '#data-video'));
    E.open.addEventListener('click', () => E.file.click());
    E.file.addEventListener('change', () => { this.openFiles([...E.file.files]); E.file.value = ''; });
    E.select.addEventListener('change', () => this.loadCsv(this.csvList[+E.select.value]));
    let st = 0;
    E.search.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => this.applyFilter(), 120); });
    E.wrap.addEventListener('scroll', () => this.scheduleRows(), { passive: true });
    new ResizeObserver(() => this.scheduleRows()).observe(E.wrap);
    E.up.addEventListener('click', () => this.step(-1));
    E.down.addEventListener('click', () => this.step(1));
    // drag & drop
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => { if (!this.active || !e.dataTransfer?.types?.includes('Files')) return; dragDepth++; E.drop.classList.add('on'); });
    window.addEventListener('dragleave', () => { if (!this.active) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) E.drop.classList.remove('on'); });
    window.addEventListener('dragover', (e) => { if (this.active) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      if (!this.active) return;
      e.preventDefault(); dragDepth = 0; E.drop.classList.remove('on');
      this.openFiles([...(e.dataTransfer?.files || [])]);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active || this.tab !== 'video' || e.target.closest?.('input, select, textarea')) return;
      if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) { e.preventDefault(); this.step(1); }
      if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); this.step(-1); }
      if (e.key === ' ') { e.preventDefault(); this.togglePlay(this.cur); }
    });
  }

  show(tab = 'csv') {
    this.active = true;
    this.tab = tab;
    const E = this.el;
    E.tCsv.setAttribute('aria-selected', String(tab === 'csv'));
    E.tVid.setAttribute('aria-selected', String(tab === 'video'));
    E.pCsv.hidden = tab !== 'csv';
    E.pVid.hidden = tab !== 'video';
    if (tab === 'video') { this.ensureObserver(); setTimeout(() => this.playVisible(), 60); }
    else this.pauseAll();
    this.scheduleRows();
  }
  hide() { this.active = false; this.pauseAll(); }

  async applyManifest(m) {
    this.csvList = (m.csv || []).map((x) => ({ ...x }));
    this.renderCsvSelect();
    if (this.csvList.length) this.loadCsv(this.csvList[0]);
    else this.emptyCsv();
    const vids = m.videos || [];
    for (const v of vids) await this.addVideo(v);
    if (!this.clips.length) this.emptyFeed();
    this.renderDots();
    if (this.active && this.tab === 'video') this.playVisible();
  }

  // ------------------------------------------------------------------ files
  async openFiles(files) {
    if (!files.length) return;
    const csvs = files.filter((f) => /\.(csv|tsv|txt)$/i.test(f.name) || f.type === 'text/csv');
    const vids = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(f.name));
    for (const f of csvs) {
      const entry = { title: f.name, local: true, buffer: await f.arrayBuffer() };
      this.csvList.unshift(entry);
    }
    if (csvs.length) { this.renderCsvSelect(); this.el.select.value = '0'; this.loadCsv(this.csvList[0]); location.hash = '#data'; }
    if (vids.length) {
      const first = this.clips.length;
      this.clearEmptyFeed();
      for (const f of vids) await this.addVideo({ title: f.name, file: URL.createObjectURL(f), kind: /depth/i.test(f.name) ? 'depth' : 'rgb', local: true });
      this.renderDots();
      location.hash = '#data-video';
      setTimeout(() => this.clips[first]?.el.scrollIntoView({ behavior: 'smooth' }), 120);
    }
    if (!csvs.length && !vids.length) toast('CSV 또는 영상(mp4·webm) 파일만 열 수 있습니다', 3000, 'warn');
    else toast(`${csvs.length + vids.length}개 파일을 열었습니다 (이 기기에서만 보입니다)`, 2600, 'file');
  }

  // ------------------------------------------------------------------ CSV
  renderCsvSelect() {
    const E = this.el;
    E.select.innerHTML = this.csvList.map((c, i) => `<option value="${i}">${c.title}</option>`).join('');
    E.select.hidden = this.csvList.length < 2;
  }

  emptyCsv() {
    this.el.title.textContent = '실험 데이터 CSV';
    this.el.table.innerHTML = `<div class="empty"><div class="dropzone"><b>data/csv/</b> 폴더에 CSV를 넣고 <b>data/manifest.json</b>에 등록하거나,<br>CSV 파일을 이 화면에 끌어다 놓으세요.</div></div>`;
    this.el.stats.innerHTML = '';
  }

  // CSV를 읽고 출처 표시와 표, 통계를 갱신한다.
  async loadCsv(entry) {
    if (!entry) return;
    const E = this.el;
    E.title.textContent = entry.title;
    E.badge.hidden = !entry.local;
    E.badge.className = 'badge local';
    E.badge.textContent = '로컬 파일';
    try {
      let buf = entry.buffer;
      if (!buf) {
        const res = await fetch(entry.file);
        if (!res.ok) throw new Error(res.status);
        buf = await res.arrayBuffer();
      }
      const { text, enc } = decodeText(buf);
      const d = parseCSV(text);
      this.csv = { ...d, enc, title: entry.title };
      this.sort = null;
      E.search.value = '';
      this.selCol = d.types.findIndex((t, i) => t === 'num' && i > 0);
      if (this.selCol < 0) this.selCol = d.types.indexOf('num');
      this.layoutTable();
      this.applyFilter();
    } catch (err) {
      E.table.innerHTML = `<div class="empty">CSV를 불러오지 못했습니다 (${entry.file || entry.title}). 파일 경로와 manifest.json을 확인하세요.</div>`;
    }
  }

  layoutTable() {
    const d = this.csv;
    const ch = (s) => [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 13 : 7.4), 0);
    this.widths = [56, ...d.header.map((hd, c) => {
      let w = ch(hd) + 30;
      for (let i = 0; i < Math.min(d.rows.length, 200); i++) w = Math.max(w, ch(d.rows[i][c]) + 24);
      return Math.max(72, Math.min(260, Math.round(w)));
    })];
    this.totalW = this.widths.reduce((a, b) => a + b, 0);
    const T = this.el.table;
    T.innerHTML = '';
    T.style.width = `${this.totalW}px`;
    const head = h('div', { class: 'thead', style: { width: `${this.totalW}px` } });
    head.append(h('div', { class: 'th num', style: { width: `${this.widths[0]}px` } }, '#'));
    d.header.forEach((hd, c) => {
      const th = h('div', { class: `th ${d.types[c] === 'num' ? 'num' : ''}`, style: { width: `${this.widths[c + 1]}px` }, role: 'columnheader', tabindex: '0', title: `${hd} — 눌러서 정렬` }, h('span', {}, hd), h('span', { class: 'srt' }, ''));
      const act = () => this.onHeader(c);
      th.addEventListener('click', act);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      head.append(th);
    });
    this.head = head;
    this.rowsEl = h('div', { class: 'rows' });
    T.append(head, this.rowsEl);
    this.pool = [];
  }

  onHeader(c) {
    const d = this.csv;
    if (d.types[c] === 'num') this.selCol = c;
    if (!this.sort || this.sort.c !== c) this.sort = { c, dir: 1 };
    else if (this.sort.dir === 1) this.sort.dir = -1;
    else this.sort = null;
    this.applyFilter();
  }

  // 검색과 정렬을 적용하고 행·열 개수, 표와 통계를 갱신한다.
  applyFilter() {
    const d = this.csv; if (!d) return;
    const qv = this.el.search.value.trim().toLowerCase();
    let idx = d.rows.map((_, i) => i);
    if (qv) idx = idx.filter((i) => d.rows[i].some((v) => v.toLowerCase().includes(qv)));
    if (this.sort) {
      const { c, dir } = this.sort, num = d.types[c] === 'num';
      idx.sort((a, b) => {
        const x = d.rows[a][c], y = d.rows[b][c];
        if (num) return ((Number(x) || 0) - (Number(y) || 0)) * dir;
        return x.localeCompare(y, 'ko') * dir;
      });
    }
    this.view = idx;
    this.head.querySelectorAll('.th').forEach((th, k) => {
      if (k === 0) return;
      const c = k - 1;
      th.classList.toggle('on', c === this.selCol);
      th.querySelector('.srt').textContent = this.sort?.c === c ? (this.sort.dir > 0 ? '▲' : '▼') : '';
    });
    this.el.table.style.height = `${HEAD_H + idx.length * ROW_H}px`;
    this.rowsEl.style.height = `${idx.length * ROW_H}px`;
    const numCols = d.types.filter((t) => t === 'num').length;
    this.el.meta.innerHTML = `<span>행 <b>${idx.length.toLocaleString('ko-KR')}</b>${qv ? ` / ${d.rows.length.toLocaleString('ko-KR')}` : ''}</span><span>열 <b>${d.header.length}</b> (숫자 ${numCols})</span>`;
    this.pool.forEach((r) => r.remove()); this.pool = [];
    this.renderedRange = null;
    this.renderRows();
    this.renderStats();
  }

  scheduleRows() {
    if (this.rowRaf) return;
    this.rowRaf = requestAnimationFrame(() => { this.rowRaf = 0; this.renderRows(); });
  }

  renderRows() {
    if (!this.csv || !this.view || !this.active) return;
    const wrap = this.el.wrap;
    const top = Math.max(0, wrap.scrollTop - HEAD_H);
    const start = Math.max(0, Math.floor(top / ROW_H) - 6);
    const end = Math.min(this.view.length, Math.ceil((top + wrap.clientHeight) / ROW_H) + 6);
    if (this.renderedRange && this.renderedRange[0] === start && this.renderedRange[1] === end) return;
    this.renderedRange = [start, end];
    const d = this.csv;
    const need = end - start;
    while (this.pool.length < need) {
      const tr = h('div', { class: 'tr', style: { width: `${this.totalW}px` } });
      this.widths.forEach((w, c) => tr.append(h('div', { class: `td ${c === 0 || d.types[c - 1] === 'num' ? 'num' : ''}`, style: { width: `${w}px` } })));
      this.rowsEl.append(tr); this.pool.push(tr);
    }
    this.pool.forEach((tr, k) => {
      const vi = start + k;
      if (vi >= end) { tr.style.display = 'none'; return; }
      tr.style.display = '';
      tr.style.top = `${vi * ROW_H}px`;
      const ri = this.view[vi];
      const row = d.rows[ri];
      const cells = tr.children;
      cells[0].textContent = ri + 1;
      for (let c = 0; c < row.length; c++) {
        const cell = cells[c + 1];
        cell.textContent = row[c];
        cell.title = row[c].length > 18 ? row[c] : '';
        cell.classList.toggle('hl', c === this.selCol);
      }
    });
  }

  renderStats() {
    const d = this.csv, E = this.el;
    const c = this.selCol;
    if (c == null || c < 0) { E.stats.innerHTML = '<p class="muted">숫자 열이 없습니다.</p>'; return; }
    const vals = this.view.map((i) => Number(d.rows[i][c])).filter((v) => d.rows.length && isFinite(v));
    const ordered = [...this.view].sort((a, b) => a - b).map((i) => Number(d.rows[i][c]));
    const s = stats(vals);
    const numCols = d.header.map((hd, i) => [hd, i]).filter(([, i]) => d.types[i] === 'num');
    E.stats.innerHTML = `
      <div class="panel-h"><h3>열 통계</h3><select class="select" id="dv-col" aria-label="통계를 볼 열">${numCols.map(([hd, i]) => `<option value="${i}" ${i === c ? 'selected' : ''}>${hd}</option>`).join('')}</select></div>
      ${s ? `<dl class="stat-grid"><div><dt>평균</dt><dd>${fnum(s.mean)}</dd></div><div><dt>표준편차</dt><dd>${fnum(s.std)}</dd></div><div><dt>최소</dt><dd>${fnum(s.min)}</dd></div><div><dt>최대</dt><dd>${fnum(s.max)}</dd></div></dl>` : ''}
      <div><div class="panel-h" style="margin:4px 0 6px"><h3 style="font-size:.8125rem">행 순서별 추이</h3><span class="eyebrow">N=${s ? s.n.toLocaleString('ko-KR') : 0}</span></div><div id="dv-series" class="chart"></div></div>
      <div><div class="panel-h" style="margin:4px 0 6px"><h3 style="font-size:.8125rem">분포</h3></div><div id="dv-hist" class="chart"></div></div>`;
    E.stats.querySelector('#dv-col').addEventListener('change', (e) => { this.selCol = +e.target.value; this.applyFilter(); });
    if (s) { seriesChart(E.stats.querySelector('#dv-series'), ordered.filter((v) => isFinite(v))); histChart(E.stats.querySelector('#dv-hist'), vals, s); }
  }

  // ------------------------------------------------------------------ video feed
  async addVideo(v) {
    if (v.split && v.split > 0) {
      const dur = v.duration || (await probeDuration(v.file));
      if (dur && isFinite(dur)) {
        const n = Math.ceil(dur / v.split);
        for (let i = 0; i < n; i++) this.addClip({ ...v, start: i * v.split, end: Math.min(dur, (i + 1) * v.split), part: `${i + 1}/${n}` });
        return;
      }
    }
    this.addClip(v);
  }

  // 영상 유형과 출처를 표시하고 재생 조작 요소를 구성한다.
  addClip(v) {
    this.clearEmptyFeed();
    const i = this.clips.length;
    const el = h('article', { class: 'clip paused', 'data-i': i });
    const video = h('video', { muted: true, playsinline: true, loop: v.end == null, preload: 'none', 'aria-label': v.title });
    video.muted = true;
    const kind = (v.kind || 'depth').toLowerCase();
    const kindLabel = { depth: '깊이 영상', rgb: '컬러 영상' }[kind] ?? kind.toUpperCase();
    const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const range = v.range || (v.start != null ? `${fmtT(v.start)}–${fmtT(v.end)}` : '');
    el.innerHTML = `
      <div class="tap" aria-hidden="true"></div>
      <div class="ov-top"><div><span class="kind"><span class="badge">${kindLabel}</span>${v.local ? '<span class="badge local">로컬</span>' : ''}</span><h3>${v.title}${v.part ? ` · ${v.part}` : ''}</h3><p class="meta">${[range, v.note].filter(Boolean).join(' · ')}</p></div><span class="idx"></span></div>
      ${kind === 'depth' && (v.depthMin != null || v.depthMax != null) ? `<div class="cbar ${v.nearIsWarm === false ? 'flip' : ''}" aria-hidden="true"><span>${v.depthMin ?? '가까움'}${v.depthMin != null ? 'mm' : ''}</span><i></i><span>${v.depthMax ?? '멂'}${v.depthMax != null ? 'mm' : ''}</span></div>` : ''}
      <div class="play-ind" aria-hidden="true">${icon('play')}</div>
      <div class="ov-bot"><div class="prog" role="slider" aria-label="재생 위치" tabindex="0"><i></i></div><div class="ctrl"><button class="pp" type="button" aria-label="재생/일시정지">${icon('play')}</button><button class="spd" type="button" aria-label="재생 속도">1×</button><span class="t">00:00</span></div></div>`;
    el.prepend(video);
    const clip = { v, el, video, i, loaded: false };
    this.clips.push(clip);
    this.el.feed.append(el);
    el.querySelector('.tap').addEventListener('click', () => this.togglePlay(clip));
    el.querySelector('.pp').addEventListener('click', () => this.togglePlay(clip));
    const spd = el.querySelector('.spd');
    spd.addEventListener('click', () => { const r = [0.5, 1, 2][([0.5, 1, 2].indexOf(video.playbackRate) + 1) % 3]; video.playbackRate = r; spd.textContent = `${r}×`; });
    const prog = el.querySelector('.prog'), bar = prog.querySelector('i'), tEl = el.querySelector('.t');
    const span = () => ({ a: v.start ?? 0, b: v.end ?? (video.duration || 0) });
    prog.addEventListener('click', (e) => { const r = prog.getBoundingClientRect(); const { a, b } = span(); video.currentTime = a + ((e.clientX - r.left) / r.width) * (b - a); });
    video.addEventListener('timeupdate', () => {
      const { a, b } = span();
      if (v.end != null && video.currentTime >= b - 0.05) video.currentTime = a;
      const k = b > a ? (video.currentTime - a) / (b - a) : 0;
      bar.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
      tEl.textContent = `${fmtT(video.currentTime - a)} / ${fmtT(b - a)}`;
    });
    video.addEventListener('loadedmetadata', () => {
      if (v.start != null) video.currentTime = v.start;
      if (!v.note) el.querySelector('.meta').textContent = [range, `${video.videoWidth}×${video.videoHeight}`].filter(Boolean).join(' · ');
    });
    video.addEventListener('play', () => { el.classList.remove('paused'); el.querySelector('.pp').innerHTML = icon('pause'); });
    video.addEventListener('pause', () => { el.classList.add('paused'); el.querySelector('.pp').innerHTML = icon('play'); });
    video.addEventListener('error', () => { if (!clip.errored) { clip.errored = true; el.insertAdjacentHTML('beforeend', `<div class="missing">영상을 불러오지 못했습니다<br><small>${v.file?.startsWith('blob:') ? '' : v.file}</small></div>`); } });
    if (this.io) this.io.observe(el);
    this.updateIdx();
  }

  updateIdx() { this.clips.forEach((c, i) => { c.el.querySelector('.idx').textContent = `${String(i + 1).padStart(2, '0')} / ${String(this.clips.length).padStart(2, '0')}`; }); }

  emptyFeed() {
    this.el.feed.innerHTML = `<div class="clip"><div class="missing"><div class="dropzone" style="max-width:420px;margin:auto"><b>data/videos/</b> 폴더에 mp4를 넣고 <b>data/manifest.json</b>에 등록하거나,<br>영상 파일을 이 화면에 끌어다 놓으세요.</div></div></div>`;
    this.feedEmpty = true;
  }
  clearEmptyFeed() { if (this.feedEmpty) { this.el.feed.innerHTML = ''; this.feedEmpty = false; } }

  renderDots() {
    const D = this.el.dots;
    D.innerHTML = '';
    this.clips.slice(0, 40).forEach((c, i) => {
      const b = h('button', { type: 'button', 'aria-label': `${i + 1}번 영상` });
      b.addEventListener('click', () => c.el.scrollIntoView({ behavior: 'smooth' }));
      D.append(b);
    });
    this.updateIdx();
    this.markDot();
  }
  markDot() { [...this.el.dots.children].forEach((b, i) => b.setAttribute('aria-current', String(i === this.cur?.i))); }

  ensureObserver() {
    if (this.io) return;
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const clip = this.clips[+e.target.dataset.i];
        if (!clip) continue;
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          this.cur = clip; this.markDot();
          this.load(clip); this.load(this.clips[clip.i + 1], true);
          if (this.active && this.tab === 'video') clip.video.play().catch(() => {});
        } else if (!clip.video.paused) clip.video.pause();
      }
    }, { root: this.el.feed, threshold: [0, 0.6] });
    this.clips.forEach((c) => this.io.observe(c.el));
  }

  load(clip, preloadOnly = false) {
    if (!clip || clip.loaded) return;
    clip.loaded = true;
    clip.video.preload = preloadOnly ? 'metadata' : 'auto';
    clip.video.src = clip.v.file;
  }

  playVisible() {
    if (!this.clips.length) return;
    const f = this.el.feed;
    const i = Math.round(f.scrollTop / Math.max(1, f.clientHeight));
    const c = this.clips[Math.min(this.clips.length - 1, i)];
    if (!c) return;
    this.cur = c; this.markDot(); this.load(c); this.load(this.clips[c.i + 1], true);
    c.video.play().catch(() => {});
  }
  pauseAll() { this.clips.forEach((c) => c.video.pause()); }
  togglePlay(c) { if (!c) return; c.video.paused ? c.video.play().catch(() => {}) : c.video.pause(); }
  step(d) {
    const i = Math.max(0, Math.min(this.clips.length - 1, (this.cur?.i ?? 0) + d));
    this.clips[i]?.el.scrollIntoView({ behavior: 'smooth' });
  }
}

function probeDuration(src) {
  return new Promise((res) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.src = src;
    v.onloadedmetadata = () => res(v.duration);
    v.onerror = () => res(null);
    setTimeout(() => res(null), 8000);
  });
}

function seriesChart(host, values) {
  const W = Math.max(240, host.clientWidth || 280), H = 120, L = 38, R = 6, T = 8, B = 16;
  if (!values.length) { host.innerHTML = ''; return; }
  const step = Math.max(1, Math.ceil(values.length / 300));
  const pts = [];
  for (let i = 0; i < values.length; i += step) pts.push([i, values[i]]);
  let lo = Math.min(...values), hi = Math.max(...values); if (hi === lo) { hi += 1; lo -= 1; }
  const X = (i) => L + (i / Math.max(1, values.length - 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">
    <g class="grid"><line x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}"/><line x1="${L}" x2="${W - R}" y1="${Y(lo)}" y2="${Y(lo)}"/></g>
    <text class="axis" x="${L - 5}" y="${Y(hi) + 3}" text-anchor="end">${fnum(hi)}</text><text class="axis" x="${L - 5}" y="${Y(lo) + 3}" text-anchor="end">${fnum(lo)}</text>
    <text class="axis" x="${L}" y="${H - 3}">1</text><text class="axis" x="${W - R}" y="${H - 3}" text-anchor="end">${values.length.toLocaleString('ko-KR')}행</text>
    <path d="${d} L${X(values.length - 1)},${Y(lo)} L${X(0)},${Y(lo)}Z" fill="var(--live)" fill-opacity=".10"/>
    <path d="${d}" fill="none" stroke="var(--live)" stroke-width="1.6" stroke-linejoin="round"/>
    <line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--fg-3)" visibility="hidden"/>
    <circle class="xd" r="3.5" fill="var(--live)" stroke="var(--ink-1)" stroke-width="2" visibility="hidden"/>
    <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg><div class="chart-tip"></div>`;
  const svg = host.querySelector('svg'), tip = host.querySelector('.chart-tip'), xh = svg.querySelector('.xh'), xd = svg.querySelector('.xd');
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(((px - L) / (W - L - R)) * (values.length - 1))));
    xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('visibility', 'visible');
    xd.setAttribute('cx', X(i)); xd.setAttribute('cy', Y(values[i])); xd.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="t">${(i + 1).toLocaleString('ko-KR')}번째 행</div><div class="r">값<b>${fnum(values[i])}</b></div>`;
    tip.style.left = `${(X(i) / W) * r.width}px`; tip.style.top = `${(Y(values[i]) / H) * r.height}px`;
    tip.classList.add('on');
  });
  svg.addEventListener('pointerleave', () => { tip.classList.remove('on'); xh.setAttribute('visibility', 'hidden'); xd.setAttribute('visibility', 'hidden'); });
}

function histChart(host, values, s) {
  const W = Math.max(240, host.clientWidth || 280), H = 96, L = 6, R = 6, T = 6, B = 16;
  const nb = 18, lo = s.min, hi = s.max === s.min ? s.min + 1 : s.max;
  const bins = new Array(nb).fill(0);
  for (const v of values) bins[Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb))]++;
  const mx = Math.max(...bins) || 1;
  const bw = (W - L - R) / nb;
  let out = '';
  bins.forEach((c, i) => {
    const hh = (c / mx) * (H - T - B);
    if (c) out += `<rect x="${(L + i * bw + 1).toFixed(1)}" y="${(H - B - hh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="var(--live)" fill-opacity=".75"><title>${fnum(lo + (i / nb) * (hi - lo))}–${fnum(lo + ((i + 1) / nb) * (hi - lo))}: ${c}개</title></rect>`;
  });
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}"><g class="grid"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/></g>${out}
    <text class="axis" x="${L}" y="${H - 3}">${fnum(lo)}</text><text class="axis" x="${W - R}" y="${H - 3}" text-anchor="end">${fnum(hi)}</text></svg>`;
}
