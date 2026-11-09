// Stage definitions for the six-step laver (김) value chain.
// All economics are simulation assumptions tuned to look plausible, not measured data.
//
// Param effects (all optional), with s = exp(-0.5·((v-opt)/tol)²) and n = (v-opt)/(max-min):
//   y  : extra loss  += y·(1-s)          q  : quality ×= 1 - q·(1-s)
//   c  : capacity    ×= 1 + c·n          e  : energy  += e·n
//   pm : price       ×= 1 + pm·n         lm : loss    += lm·n
//   k  : labor/material cost += k·n

const P = (id, label, unit, min, max, step, value, opt, tol, eff = {}) => ({ id, label, unit, min, max, step, value, opt, tol, eff });

// 시작 화면 오른쪽에 띄우는 유튜브 영상 (id 만 바꾸면 다른 영상으로 교체됩니다. null 이면 숨김)
export const INTRO_VIDEO = {
  youtube: 'NbN755R6BPU',
  title: '세계 속 K-김 여행 · 특집 다큐 「씨위드 머니」',
  source: '목포MBC',
};

export const DEFAULT_HARVEST = 600;     // 톤 (물김 기준 재배량)
export const HARVEST_RANGE = [50, 1500, 10];
export const DESIGN_HARVEST = 720;      // 설비가 설계된 기준 재배량

export const STAGES = [
  // ───────────────────────────── 1. 종자 ─────────────────────────────
  {
    key: 'seed', no: 1, name: '종자', en: 'SEED', hue: '#b28dff',
    title: '종자 배양, 채묘', place: '종자 배양장', time: '04:00',
    tagline: '굴 껍데기 속 사상체를 키워 각포자를 방출시키고, 수차에 감은 김발에 붙입니다.',
    layout: 'line', env: 'lab',
    flowUnit: '책', days: 40,
    inLabel: '목표 재배량', inUnit: '톤', outLabel: '채묘망 출하', outUnit: '책',
    toFlowSeason: (R) => (R / 0.45) * 1.15,          // 목표 재배량 → 필요 망 수
    outPerFlow: 1,
    econ: { price: 48000, inCostPerFlow: 5000, energyPerFlow: 2200, materialPerOut: 1200, fixed: 0.12e8, capex: 1.2e8, life: 10 },
    months: { labels: ['7월', '8월', '9월', '10월'], w: [0.12, 0.22, 0.38, 0.28] },
    machines: [
      { id: 'conch', name: '사상체 배양조', type: 'tankRack', cap: 1.32, loss: 0.02, disp: { f: 1, u: '책/일' },
        params: [
          P('temp', '배양 수온', '°C', 14, 28, 0.5, 20, 22, 2.6, { y: 0.07, q: 0.04, e: 0.35 }),
          P('light', '광량', 'μmol', 10, 120, 1, 56, 45, 18, { y: 0.05, q: 0.03, e: 0.25 }),
          P('n', '영양염(N)', 'μM', 50, 500, 10, 200, 250, 95, { y: 0.04, q: 0.02, k: 0.04 }),
        ] },
      { id: 'mature', name: '성숙 유도', type: 'chamber', cap: 1.36, loss: 0.015, disp: { f: 1, u: '책/일' },
        params: [
          P('photo', '명기 광주기', 'h', 8, 16, 0.5, 11, 10, 1.6, { y: 0.07, q: 0.03 }),
          P('cool', '수온 하강', '°C', 15, 24, 0.5, 19.5, 18, 1.8, { y: 0.05, e: -0.15 }),
        ] },
      { id: 'release', name: '각포자 방출', type: 'tank', cap: 1.4, loss: 0.025, disp: { f: 1, u: '책/일' },
        params: [
          P('air', '통기량', 'L/min', 2, 20, 0.5, 6, 9, 4, { y: 0.04, e: 0.12 }),
          P('dens', '포자 밀도', '만/mL', 1, 30, 0.5, 8, 12, 6, { q: 0.08, y: 0.03 }),
        ] },
      { id: 'wheel', name: '채묘 수차', type: 'wheel', hero: true, cap: 1.04, loss: 0.03, disp: { f: 1, u: '책/일' },
        params: [
          P('rpm', '수차 회전', 'rpm', 2, 14, 0.5, 8, 6, 2.4, { c: 0.55, q: 0.09 }),
          P('hours', '채묘 시간', 'h', 2, 12, 0.5, 5, 6, 2.2, { q: 0.07, c: -0.45 }),
          P('load', '1회 투입', '책', 20, 80, 1, 40, 50, 18, { c: 0.5, y: 0.04 }),
        ] },
      { id: 'freeze', name: '냉동망 보관', type: 'freezer', cap: 1.5, loss: 0.015, disp: { f: 1, u: '책/일' },
        params: [
          P('dry', '망 건조율', '% 수분', 10, 40, 1, 27, 22, 6, { y: 0.07, q: 0.04 }),
          P('ftemp', '냉동 온도', '°C', -30, -10, 1, -17, -20, 4, { y: 0.05, e: -0.3 }),
        ] },
    ],
    scenarios: [
      { id: 'hot', name: '고수온 (+3°C)', icon: 'thermo', desc: '배양 수온이 상승해 사상체 생장이 둔화됩니다.', shift: { 'conch.temp': 3, 'mature.cool': 3 } },
      { id: 'power', name: '정전 2시간', icon: 'plug', desc: '수차와 냉동고 가동이 일시 중단됐습니다.', cap: { wheel: 0.62 }, lossAdd: { freeze: 0.04 } },
    ],
    extra: (r) => ({ label: '포자 부착 밀도', value: (18 + 54 * r.Q).toFixed(0), unit: '개/cm' }),
    logs: [
      ['conch', '배양조 수온 {conch.temp}°C | 광량 {conch.light} μmol'],
      ['mature', '광주기 {mature.photo}h 명기 | 성숙률 {rand:72:94}%'],
      ['release', '각포자 방출 감지 | {release.dens}만 개/mL'],
      ['wheel', '수차 {wheel.rpm} rpm | 이번 회차 {wheel.load}책 채묘'],
      ['freeze', '냉동망 {rand:20:60}책 입고 | {freeze.ftemp}°C'],
    ],
  },

  // ───────────────────────────── 2. 양식 ─────────────────────────────
  {
    key: 'farm', no: 2, name: '양식', en: 'FARM', hue: '#3fc8e4',
    title: '해상 양식 및 채취', place: '신안 앞바다 부류식 양식장', time: '06:10',
    tagline: '채묘망을 바다에 펼쳐 키우고, 채취선이 다 자란 김을 거둬 들입니다.',
    layout: 'sea', env: 'sea',
    flowUnit: '톤', days: 150,
    inLabel: '설치 채묘망', inUnit: '책', outLabel: '물김 생산', outUnit: '톤',
    toFlowSeason: (nets) => nets * 0.452,               // 망 수 → 잠재 생산량(톤)
    outPerFlow: 1,
    econ: { inCostPerFlow: 0, energyPerFlow: 128000, materialPerOut: 42000, fixed: 2.15e8, capex: 9.2e8, life: 8, feeRate: 0.045 },
    months: { labels: ['11월', '12월', '1월', '2월', '3월', '4월'], w: [0.08, 0.19, 0.25, 0.23, 0.16, 0.09] },
    machines: [
      { id: 'install', name: '부류식 시설', type: 'netRows', cap: 1.5, loss: 0.015, disp: { f: 1, u: 't/일' },
        params: [
          P('depth', '시설 수심', 'm', 1, 6, 0.1, 2.5, 3, 1.2, { y: 0.05, q: 0.03 }),
          P('gap', '망 간격', 'm', 2, 10, 0.5, 4, 5, 1.8, { q: 0.07 }),
        ] },
      { id: 'sensor', name: '수질 센서 부이', type: 'buoy', cap: 2.2, loss: 0.0, disp: { f: 1, u: 't/일' },
        params: [
          P('wtemp', '수온', '°C', 4, 16, 0.5, 9.5, 8, 2.4, { y: 0.09, q: 0.08 }),
          P('din', '영양염(DIN)', 'μM', 2, 30, 0.5, 10.5, 14, 6, { y: 0.05, q: 0.10 }),
          P('sal', '염분', 'psu', 24, 34, 0.5, 31.5, 30, 2.4, { y: 0.04 }),
        ] },
      { id: 'treat', name: '활성처리선', type: 'boat2', cap: 1.6, loss: 0.012, disp: { f: 1, u: 't/일' },
        params: [
          P('expose', '노출 시간', 'h/일', 0, 8, 0.5, 2, 3, 1.5, { y: 0.08, q: 0.05 }),
          P('cycle', '처리 주기', '일', 3, 15, 1, 9, 7, 3, { y: 0.05, k: -0.15 }),
        ] },
      { id: 'harvest', name: '채취선', type: 'boat', hero: true, cap: 1.0, loss: 0.03, disp: { f: 1, u: 't/일' },
        params: [
          P('hcycle', '채취 주기', '일', 10, 30, 1, 14, 18, 5, { q: 0.09 }),
          P('height', '채취 높이', 'cm', 5, 25, 1, 15, 12, 4, { y: 0.05, q: 0.03 }),
          P('speed', '운항 속도', 'knot', 2, 10, 0.5, 6, 5, 2, { c: 0.6, q: 0.05, e: 0.4 }),
        ] },
      { id: 'unload', name: '하역장', type: 'dock', cap: 1.38, loss: 0.02, disp: { f: 1000 / 120, u: '포대/일' },
        params: [
          P('haul', '운반 시간', 'h', 1, 10, 0.5, 3.5, 2, 2.4, { y: 0.07, q: 0.07 }),
          P('chill', '해수 냉각', '°C', 2, 15, 0.5, 7.5, 5, 3, { y: 0.04, e: -0.2 }),
        ] },
    ],
    scenarios: [
      { id: 'typhoon', name: '태풍 내습', icon: 'storm', desc: '시설 일부가 유실되고 채취선 출항이 제한됩니다.', lossAdd: { install: 0.14 }, cap: { harvest: 0.7 } },
      { id: 'warm', name: '고수온', icon: 'thermo', desc: '수온이 4°C 올라 갯병 위험이 커졌습니다.', shift: { 'sensor.wtemp': 4 } },
      { id: 'pale', name: '영양염 부족', icon: 'drop', desc: '영양염이 떨어져 김이 누렇게 변하는 황백화가 우려됩니다.', shift: { 'sensor.din': -6 } },
    ],
    extra: (r) => ({ label: '1책당 생산', value: (r.out * 1000 / Math.max(1, r.inSeason)).toFixed(0), unit: 'kg/책' }),
    logs: [
      ['sensor', '수온 {sensor.wtemp}°C | DIN {sensor.din} μM | 염분 {sensor.sal} psu'],
      ['harvest', '채취선 2호 {rand:3:9}번 줄 채취 완료 | {rand:1.1:2.8}t'],
      ['treat', '활성처리 {treat.cycle}일 주기 | 노출 {treat.expose}h'],
      ['unload', '하역 {rand:40:120}포대 | 해수 냉각 {unload.chill}°C'],
      ['install', '부이 장력 정상 | 수심 {install.depth}m'],
    ],
  },

  // ───────────────────────────── 3. 경매 ─────────────────────────────
  {
    key: 'auction', no: 3, name: '경매', en: 'AUCTION', hue: '#6d9cff',
    title: '산지 위판 및 경매', place: '수협 산지 위판장', time: '07:30',
    tagline: '물김 포대를 계량, 검사해 등급을 매기고, 중도매인 전자 경매로 값을 정합니다.',
    layout: 'line', env: 'hall',
    flowUnit: '톤', days: 150,
    inLabel: '위판 물량', inUnit: '톤', outLabel: '낙찰 물량', outUnit: '톤',
    toFlowSeason: (t) => t,
    outPerFlow: 1,
    econ: { basePriceKg: 1450, feeRate: 0.045, energyPerFlow: 4000, materialPerOut: 2500, fixed: 0.12e8, capex: 0.9e8, life: 12 },
    months: { labels: ['11월', '12월', '1월', '2월', '3월', '4월'], w: [0.08, 0.19, 0.25, 0.23, 0.16, 0.09] },
    machines: [
      { id: 'weigh', name: '하역 | 계량', type: 'scale', hero: true, cap: 1.45, loss: 0.008, disp: { f: 1000 / 120, u: '포대/일' },
        params: [
          P('wait', '하역 대기', '분', 5, 120, 5, 40, 15, 25, { y: 0.04, q: 0.05 }),
          P('spray', '해수 살수', '회/h', 0, 12, 1, 3, 6, 3, { y: 0.03, q: 0.04 }),
        ] },
      { id: 'inspect', name: '품질 검사', type: 'inspector', cap: 1.3, loss: 0.015, disp: { f: 1000 / 120, u: '포대/일' },
        params: [
          P('sample', '검사 표본률', '%', 1, 20, 1, 4, 8, 4, { q: 0.07, c: -0.35 }),
          P('foreign', '이물 허용치', 'ppm', 0, 50, 1, 22, 10, 8, { q: 0.08 }),
        ] },
      { id: 'grade', name: '등급 분류', type: 'sorter', cap: 1.4, loss: 0.006, disp: { f: 1000 / 120, u: '포대/일' },
        params: [
          P('levels', '등급 세분화', '단계', 2, 6, 1, 3, 4, 1, { q: 0.05, pm: 0.04 }),
          P('unit', '소분 단위', 'kg', 60, 150, 5, 100, 120, 25, { c: 0.3, q: 0.02 }),
        ] },
      { id: 'auction', name: '전자 경매', type: 'board', cap: 1.02, loss: 0.025, disp: { f: 1, u: 't/일' },
        params: [
          P('bidders', '참여 중도매인', '명', 5, 60, 1, 24, 40, 15, { pm: 0.22, k: 0.05, y: 0.02 }),
          P('reserve', '최저 입찰가', '원/kg', 600, 2400, 50, 1150, 1300, 300, { pm: 0.16, lm: 0.22 }),
          P('rounds', '경매 회차', '회/일', 1, 6, 1, 2, 3, 1.2, { c: 0.5, y: 0.02 }),
        ] },
      { id: 'ship', name: '낙찰 | 출하', type: 'truck', cap: 1.5, loss: 0.008, disp: { f: 1, u: 't/일' },
        params: [
          P('swait', '출하 대기', 'h', 0.5, 8, 0.5, 3, 1.5, 1.5, { y: 0.06, q: 0.05 }),
          P('trucks', '배차 차량', '대', 2, 20, 1, 7, 10, 4, { c: 0.6, k: 0.08 }),
        ] },
    ],
    scenarios: [
      { id: 'boom', name: '수출 수요 급증', icon: 'trend', desc: '가공 업체 매수세가 몰려 낙찰가가 오릅니다.', priceMul: 1.28 },
      { id: 'glut', name: '물량 폭주', icon: 'wave', desc: '같은 날 물김이 몰려 대기 시간이 길어집니다.', shift: { 'weigh.wait': 45, 'ship.swait': 3 }, cap: { auction: 0.85 } },
    ],
    extra: (r) => ({ label: '평균 낙찰가', value: Math.round(r.priceUnit / 1000).toLocaleString('ko-KR'), unit: '원/kg' }),
    logs: [
      ['weigh', '{rand:12:40}번 포대 계량 {rand:112:128}kg'],
      ['inspect', '검사 표본 {inspect.sample}% | 이물 {rand:2:18}ppm'],
      ['grade', '등급 판정 | 상품 {rand:52:78}% / 중품 {rand:15:35}%'],
      ['auction', '낙찰 {price}원/kg | 중도매인 {rand:101:160}번'],
      ['ship', '{rand:2:8}호차 출하 | {rand:4.0:8.5}t'],
    ],
  },

  // ───────────────────────────── 4. 1차 가공 ─────────────────────────────
  {
    key: 'primary', no: 4, name: '1차 가공', en: 'PRIMARY', hue: '#ff9a5c',
    title: '마른김 제조 라인', place: '해남 김 가공공장', time: '10:00',
    tagline: '물김을 씻고 숙성해 잘게 썬 뒤, 틀에 떠서 말려 마른김(100장=1속)을 만듭니다.',
    layout: 'line', env: 'factory',
    flowUnit: '톤', days: 120,
    inLabel: '물김 투입', inUnit: '톤', outLabel: '마른김 생산', outUnit: '속',
    toFlowSeason: (t) => t,
    outPerFlow: 530,                                    // 무손실 기준 물김 1t → 530속
    econ: { price: 10500, energyPerFlow: 520000, materialPerOut: 310, fixed: 3.9e8, capex: 30e8, life: 10, buyMarkup: 1.03 },
    months: { labels: ['11월', '12월', '1월', '2월', '3월', '4월'], w: [0.07, 0.18, 0.25, 0.24, 0.17, 0.09] },
    machines: [
      { id: 'wash', name: '원초 세척기', type: 'washer', cap: 1.36, loss: 0.02, disp: { f: 1, u: 't/일' },
        params: [
          P('wtemp', '세척 수온', '°C', 2, 20, 0.5, 10, 6, 3.5, { q: 0.05, y: 0.02, e: 0.15 }),
          P('times', '세척 횟수', '회', 1, 6, 1, 2, 3, 1.2, { q: 0.08, y: 0.02, k: 0.03 }),
          P('drum', '드럼 회전', 'rpm', 10, 60, 1, 35, 28, 10, { c: 0.4, y: 0.04 }),
        ] },
      { id: 'age', name: '숙성 탱크', type: 'ageTank', cap: 1.45, loss: 0.01, disp: { f: 1, u: 't/일' },
        params: [
          P('time', '숙성 시간', 'h', 0.5, 8, 0.5, 2, 3, 1.5, { q: 0.08, c: -0.3 }),
          P('salt', '탱크 염도', '%', 0.5, 4, 0.1, 2.8, 2, 0.8, { q: 0.05, y: 0.02 }),
          P('stir', '교반 속도', 'rpm', 5, 40, 1, 20, 15, 7, { y: 0.03, e: 0.1 }),
        ] },
      { id: 'cut', name: '세절기', type: 'cutter', cap: 1.42, loss: 0.01, disp: { f: 1, u: 't/일' },
        params: [
          P('size', '절단 크기', 'mm', 2, 12, 0.5, 6.5, 5, 2, { q: 0.08, y: 0.02 }),
          P('blade', '칼날 회전', 'rpm', 800, 3000, 50, 2000, 1600, 500, { c: 0.35, y: 0.03, e: 0.1 }),
        ] },
      { id: 'form', name: '초제기', type: 'former', hero: true, cap: 1.08, loss: 0.015, disp: { f: 530 * 100 / 1200, u: '장/분' },
        params: [
          P('conc', '초제 농도', 'g/L', 2, 10, 0.1, 6.4, 5.5, 1.3, { q: 0.08, y: 0.02 }),
          P('weight', '장당 중량', 'g', 2.0, 3.6, 0.05, 2.9, 2.7, 0.35, { q: 0.06, y: 0.03 }),
          P('speed', '성형 속도', '장/분', 60, 240, 5, 160, 140, 50, { c: 0.7, q: 0.07 }),
        ] },
      { id: 'press', name: '탈수기', type: 'press', cap: 1.5, loss: 0.005, disp: { f: 530 * 100 / 1200, u: '장/분' },
        params: [
          P('kpa', '압착 압력', 'kPa', 50, 400, 10, 150, 200, 70, { q: 0.05, y: 0.02, e: 0.1 }),
        ] },
      { id: 'dry', name: '열풍 건조기', type: 'dryer', cap: 1.02, loss: 0.02, disp: { f: 530 * 100 / 1200, u: '장/분' },
        params: [
          P('temp', '건조 온도', '°C', 30, 70, 0.5, 50, 45, 6, { q: 0.11, c: 0.5, e: 0.5 }),
          P('hours', '건조 시간', 'h', 1, 5, 0.1, 2.2, 2.5, 0.8, { q: 0.06, c: -0.5 }),
          P('wind', '풍속', 'm/s', 1, 8, 0.1, 3, 4, 1.6, { c: 0.2, q: 0.03, e: 0.2 }),
        ] },
      { id: 'vision', name: '박리 | 비전검사', type: 'inspector', cap: 1.6, loss: 0.012, disp: { f: 530 * 100 / 1200, u: '장/분' },
        params: [
          P('sens', '검출 민감도', '%', 50, 99, 1, 80, 88, 7, { q: 0.08, lm: 0.05 }),
          P('fps', '카메라 FPS', 'fps', 30, 240, 10, 90, 120, 50, { c: 0.4, e: 0.05 }),
        ] },
      { id: 'pack', name: '결속 | 포장', type: 'packer', cap: 1.5, loss: 0.003, disp: { f: 530 / 20, u: '속/h' },
        params: [
          P('pspeed', '포장 속도', '속/분', 5, 40, 1, 15, 18, 8, { c: 0.5, y: 0.02 }),
        ] },
    ],
    scenarios: [
      { id: 'boiler', name: '보일러 고장', icon: 'bolt', desc: '건조기 열원이 절반으로 줄었습니다.', cap: { dry: 0.52 } },
      { id: 'disease', name: '원초 품질 저하', icon: 'bug', desc: '갯병 걸린 원초가 섞여 들어와 선별 손실이 늘어납니다.', lossAdd: { wash: 0.06 }, qMul: 0.9 },
      { id: 'humid', name: '고습 장마', icon: 'drop', desc: '습도가 높아 건조가 더디고 변색 위험이 있습니다.', cap: { dry: 0.8 }, qMul: 0.95 },
    ],
    extra: (r) => ({ label: '장당 원가', value: Math.round(r.cost / Math.max(1, r.out * 100)).toLocaleString('ko-KR'), unit: '원/장' }),
    logs: [
      ['wash', '세척 {wash.times}회 | 수온 {wash.wtemp}°C | 이물 {rand:0:6}건 제거'],
      ['age', '숙성 탱크 #{rand:1:4} 교반 {age.stir} rpm | 염도 {age.salt}%'],
      ['form', '초제 {form.speed}장/분 | 장당 {form.weight}g'],
      ['dry', '건조실 {dry.temp}°C | 습도 {rand:18:34}% | 풍속 {dry.wind}m/s'],
      ['vision', '비전검사 불량 {rand:1:7}장 제거 (구멍 | 이물)'],
      ['pack', '{rand:120:420}속 결속 완료 | 팔레트 #{rand:10:99}'],
    ],
  },

  // ───────────────────────────── 5. 2차 가공 ─────────────────────────────
  {
    key: 'secondary', no: 5, name: '2차 가공', en: 'SECONDARY', hue: '#8fd46b',
    title: '조미김 생산 라인', place: '김 스낵 | 조미김 공장', time: '14:00',
    tagline: '마른김에서 이물을 골라내고, 굽고 조미해 다시 구운 뒤, 불량을 걸러 질소 포장합니다.',
    layout: 'line', env: 'factory2',
    flowUnit: '속', days: 250,
    inLabel: '마른김 투입', inUnit: '속', outLabel: '조미김 생산', outUnit: '봉',
    toFlowSeason: (sok) => sok,
    outPerFlow: 75,                                     // 무손실 기준 1속 → 75봉(도시락김)
    econ: { price: 480, energyPerFlow: 1250, materialPerOut: 86, fixed: 14e8, capex: 46e8, life: 10 },
    months: { labels: ['1분기', '2분기', '3분기', '4분기'], w: [0.24, 0.23, 0.24, 0.29] },
    machines: [
      { id: 'feed', name: '원초 투입', type: 'feeder', cap: 1.5, loss: 0.006, disp: { f: 100 / 960, u: '장/분' },
        params: [
          P('fspeed', '투입 속도', '장/분', 100, 600, 10, 280, 300, 120, { c: 0.6, y: 0.02 }),
        ] },
      { id: 'foreign', name: '이물 제거', type: 'foreign', reject: true, cap: 1.45, loss: 0.012, disp: { f: 100 / 960, u: '장/분' },
        params: [
          P('fsens', '이물 검출 민감도', '%', 50, 99, 1, 86, 92, 7, { q: 0.08, lm: 0.03 }),
          P('air', '에어 분사 압력', 'bar', 1, 8, 0.1, 3.4, 4.5, 1.5, { y: 0.02, q: 0.03, e: 0.08 }),
        ] },
      { id: 'roast1', name: '1차 굽기', type: 'oven', hero: true, cap: 1.04, loss: 0.02, disp: { f: 100 / 960, u: '장/분' },
        params: [
          P('temp', '굽기 온도', '°C', 200, 420, 5, 330, 300, 40, { q: 0.1, c: 0.4, e: 0.4 }),
          P('belt', '컨베이어 속도', 'm/min', 5, 30, 0.5, 16, 14, 5, { c: 0.6, q: 0.08 }),
        ] },
      { id: 'season', name: '조미 도포', type: 'sprayer', cap: 1.4, loss: 0.01, disp: { f: 100 / 960, u: '장/분' },
        params: [
          P('oil', '기름 도포량', 'g/장', 0.3, 1.6, 0.05, 1.0, 0.8, 0.25, { q: 0.08, k: 0.12 }),
          P('salt', '소금', 'g/장', 0.02, 0.15, 0.005, 0.085, 0.06, 0.025, { q: 0.08 }),
          P('sesame', '참기름 블렌드', '%', 0, 100, 5, 30, 40, 25, { q: 0.05, pm: 0.06, k: 0.12 }),
        ] },
      { id: 'roast2', name: '2차 굽기', type: 'oven', cap: 1.3, loss: 0.025, disp: { f: 100 / 960, u: '장/분' },
        params: [
          P('temp2', '굽기 온도', '°C', 150, 350, 5, 255, 230, 35, { q: 0.1, e: 0.35 }),
          P('dwell', '체류 시간', '초', 2, 15, 0.5, 5, 6, 2.5, { q: 0.05, c: -0.4 }),
        ] },
      { id: 'cut2', name: '재단기', type: 'cutter', cap: 1.45, loss: 0.012, disp: { f: 75 / 960, u: '봉/분' },
        params: [
          P('pieces', '재단 규격', '매/장', 4, 16, 1, 8, 8, 3, { q: 0.03 }),
          P('kspeed', '칼날 속도', 'rpm', 200, 1200, 20, 700, 600, 200, { c: 0.4, y: 0.03 }),
        ] },
      { id: 'defect', name: '불량 선별 | 배출', type: 'defect', reject: true, cap: 1.5, loss: 0.02, disp: { f: 75 / 960, u: '봉/분' },
        params: [
          P('burn', '탄 김 판정 기준', 'ΔE', 2, 12, 0.5, 6.5, 5, 2, { q: 0.08, lm: -0.02 }),
          P('broken', '파손 허용치', '%', 0, 20, 1, 8, 5, 4, { q: 0.06, lm: -0.02 }),
          P('vspeed', '검사 속도', '봉/분', 40, 220, 5, 110, 120, 45, { c: 0.5, q: 0.04 }),
        ] },
      { id: 'metal', name: '금속 검출기', type: 'metal', cap: 1.7, loss: 0.005, disp: { f: 75 / 960, u: '봉/분' },
        params: [
          P('fe', '검출 감도(Fe)', 'mm', 0.5, 3, 0.1, 1.5, 1.0, 0.5, { q: 0.07, lm: -0.01 }),
        ] },
      { id: 'pack2', name: '질소 충전 포장', type: 'packer', cap: 1.36, loss: 0.005, disp: { f: 75 / 960, u: '봉/분' },
        params: [
          P('bspeed', '포장 속도', '봉/분', 40, 200, 5, 100, 110, 40, { c: 0.6, y: 0.02 }),
          P('n2', '질소 치환율', '%', 80, 99.5, 0.5, 96, 98, 1.5, { q: 0.07, k: 0.04 }),
        ] },
    ],
    scenarios: [
      { id: 'oil', name: '식용유값 급등', icon: 'drop', desc: '참기름 | 식용유 원가가 40% 올랐습니다.', materialMul: 1.4 },
      { id: 'claim', name: '이물 혼입 증가', icon: 'warn', desc: '원초에 패각 | 비닐 같은 이물이 늘어 선별 부담이 커졌습니다.', qMul: 0.9, lossAdd: { foreign: 0.03 } },
      { id: 'kfood', name: 'K-푸드 붐', icon: 'trend', desc: '해외 바이어 주문이 늘어 출고가가 오릅니다.', priceMul: 1.15 },
    ],
    // 선별 배출률과 봉당 원가를 보조 지표로 표시한다.
    extra: (r) => {
      const rej = r.machines.filter((m) => m.def.reject || m.id === 'metal').reduce((s, m) => s + m.processed * m.loss, 0);
      return { label: '이물 | 불량 배출', value: ((rej / Math.max(1e-9, r.flowIn)) * 100).toFixed(1), unit: '%', note: `봉당 원가 ${Math.round(r.cost / Math.max(1, r.out)).toLocaleString('ko-KR')}원` };
    },
    logs: [
      ['foreign', '광학 선별 | 이물 {rand:1:6}건 배출 (패각 | 비닐 | 머리카락) | 에어 {foreign.air} bar'],
      ['defect', '불량 배출 | 탄 김 {rand:3:15}장, 파손 {rand:2:10}장 → 불량함'],
      ['roast1', '1차 굽기 {roast1.temp}°C | 벨트 {roast1.belt} m/min'],
      ['season', '기름 {season.oil}g/장 | 소금 {season.salt}g/장 | 참기름 {season.sesame}%'],
      ['roast2', '2차 굽기 {roast2.temp2}°C | 체류 {roast2.dwell}초'],
      ['metal', '금속 검출 0건 | 테스트피스 통과'],
      ['pack2', '질소 치환 {pack2.n2}% | {rand:600:1400}봉 포장'],
      ['feed', '원초 {rand:20:60}속 투입 | {feed.fspeed}장/분'],
    ],
  },

  // ───────────────────────────── 6. 유통 ─────────────────────────────
  {
    key: 'distribution', no: 6, name: '유통', en: 'DISTRIBUTION', hue: '#efdcae',
    title: '콜드체인 물류 | 수출', place: '스마트 물류센터 | 부산항', time: '19:30',
    tagline: '물류센터에서 보관, 분류해 국내 매장으로, 컨테이너에 실어 세계로 보냅니다.',
    layout: 'line', env: 'port',
    flowUnit: '봉', days: 300,
    inLabel: '조미김 입고', inUnit: '봉', outLabel: '판매 출고', outUnit: '봉',
    toFlowSeason: (pack) => pack,
    outPerFlow: 1,
    econ: { priceDomestic: 640, priceExport: 800, logisticsPerOut: 52, exportExtra: 38, fixed: 7.6e8, capex: 26e8, life: 10 },
    months: { labels: ['1분기', '2분기', '3분기', '4분기'], w: [0.23, 0.22, 0.25, 0.30] },
    machines: [
      { id: 'wh', name: '스마트 물류센터', type: 'rack', cap: 1.5, loss: 0.002, disp: { f: 1 / 60, u: '박스/일' },
        params: [
          P('turn', '재고 회전', '일', 5, 60, 1, 28, 20, 10, { y: 0.02, k: 0.08 }),
          P('auto', '자동화율', '%', 20, 95, 1, 55, 80, 20, { c: 0.5, k: -0.12, e: 0.1 }),
        ] },
      { id: 'cold', name: '항온 | 항습 보관', type: 'coldroom', cap: 1.6, loss: 0.002, disp: { f: 1 / 60, u: '박스/일' },
        params: [
          P('ctemp', '보관 온도', '°C', 0, 25, 0.5, 18, 12, 6, { y: 0.02, q: 0.04, e: -0.2 }),
          P('rh', '습도', '%RH', 20, 80, 1, 55, 40, 12, { q: 0.07, y: 0.02 }),
        ] },
      { id: 'sort', name: '자동 분류기', type: 'sorter', cap: 1.05, loss: 0.002, disp: { f: 1 / 60, u: '박스/일' },
        params: [
          P('sspeed', '분류 속도', '박스/h', 200, 2000, 20, 800, 900, 400, { c: 0.6, y: 0.01 }),
          P('export', '수출 비중', '%', 0, 90, 1, 40, 50, 25, { k: 0.03 }),
        ] },
      { id: 'truck', name: '콜드체인 배송', type: 'truck', hero: true, cap: 1.3, loss: 0.003, disp: { f: 1 / 60, u: '박스/일' },
        params: [
          P('fleet', '배송 차량', '대', 2, 30, 1, 10, 14, 6, { c: 0.6, k: 0.08 }),
          P('online', '온라인 비중', '%', 0, 70, 1, 25, 35, 18, { pm: 0.05, k: 0.04, q: 0.03 }),
        ] },
      { id: 'port', name: '수출 선적', type: 'ship', cap: 1.4, loss: 0.003, disp: { f: 1 / 60, u: '박스/일' },
        params: [
          P('fill', '컨테이너 적재율', '%', 50, 100, 1, 84, 92, 8, { k: -0.08, c: 0.3, y: 0.02 }),
          P('sail', '선적 주기', '일', 3, 21, 1, 10, 7, 4, { y: 0.02, q: 0.03 }),
          P('countries', '수출국 수', '개국', 5, 40, 1, 15, 25, 10, { pm: 0.06, k: 0.05, q: 0.04 }),
        ] },
    ],
    scenarios: [
      { id: 'freight', name: '해상 운임 급등', icon: 'ship', desc: '컨테이너 운임이 50% 올랐습니다.', logisticsMul: 1.5 },
      { id: 'fx', name: '원화 약세', icon: 'coin', desc: '환율 상승으로 수출 단가가 유리해졌습니다.', priceMul: 1.07 },
      { id: 'eu', name: 'EU 신시장 개척', icon: 'globe', desc: '유럽 대형 유통망에 입점했습니다.', priceMul: 1.05, shift: { 'port.countries': 6 } },
    ],
    extra: (r) => ({ label: '수출액', value: (r.exportRevenue / 1e8).toFixed(1), unit: '억원' }),
    logs: [
      ['wh', '입고 {rand:80:240}박스 | 자동화율 {wh.auto}%'],
      ['cold', '보관실 {cold.ctemp}°C | {cold.rh}%RH 유지'],
      ['sort', '분류 {sort.sspeed}박스/h | 수출 {sort.export}%'],
      ['truck', '{rand:1:9}호차 출발 | 수도권 {rand:12:40}개 점포'],
      ['port', '부산항 컨테이너 {rand:2:6}FEU 선적 | {port.countries}개국'],
    ],
  },
];

// Export destinations (simulation weights) used by the 유통 map.
export const DESTINATIONS = [
  ['미국', 34.0, -118.2, 22], ['중국', 31.2, 121.5, 16], ['일본', 35.6, 139.8, 14], ['태국', 13.7, 100.5, 6],
  ['대만', 25.0, 121.5, 5], ['러시아', 43.1, 131.9, 4], ['베트남', 10.8, 106.7, 3.5], ['호주', -33.9, 151.2, 3],
  ['캐나다', 49.3, -123.1, 2.8], ['독일', 53.6, 10.0, 2.4], ['네덜란드', 51.9, 4.5, 2.0], ['영국', 51.5, -0.1, 1.8],
  ['싱가포르', 1.3, 103.8, 1.6], ['홍콩', 22.3, 114.2, 1.5], ['말레이시아', 3.0, 101.4, 1.4], ['인도네시아', -6.1, 106.8, 1.3],
  ['필리핀', 14.6, 121.0, 1.2], ['프랑스', 49.5, 0.1, 1.1], ['UAE', 25.2, 55.3, 1.0], ['멕시코', 19.1, -104.3, 0.9],
  ['뉴질랜드', -36.8, 174.8, 0.8], ['몽골', 47.9, 106.9, 0.7], ['카자흐스탄', 43.2, 76.9, 0.65], ['인도', 19.1, 72.9, 0.6],
  ['브라질', -23.9, -46.3, 0.55], ['칠레', -33.0, -71.6, 0.5], ['스페인', 39.5, -0.4, 0.48], ['이탈리아', 44.4, 8.9, 0.46],
  ['폴란드', 54.4, 18.6, 0.42], ['스웨덴', 57.7, 11.9, 0.4], ['튀르키예', 41.0, 29.0, 0.38], ['사우디', 21.5, 39.2, 0.36],
  ['이스라엘', 32.8, 35.0, 0.3], ['남아공', -29.9, 31.0, 0.28], ['우즈베키스탄', 41.3, 69.2, 0.26], ['캄보디아', 11.6, 104.9, 0.24],
  ['미얀마', 16.8, 96.2, 0.22], ['페루', -12.1, -77.1, 0.2], ['파나마', 9.4, -79.9, 0.18], ['이집트', 31.2, 29.9, 0.16],
];
export const ORIGIN = ['부산항', 35.1, 129.04];
