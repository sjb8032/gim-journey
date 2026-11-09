// Value-chain simulation: material flow through each stage's machines, then economics.
// Everything here is a plausible-looking model for a demo, not a calibrated plant model.
import { STAGES, DEFAULT_HARVEST, DESIGN_HARVEST } from './config.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gradeMult = (Q) => 0.3 + 0.8 * Q;

export function defaultValues() {
  const out = {};
  for (const st of STAGES) {
    out[st.key] = {};
    for (const m of st.machines) {
      out[st.key][m.id] = {};
      for (const p of m.params) out[st.key][m.id][p.id] = p.value;
    }
  }
  return out;
}

export function createState() {
  return {
    R: DEFAULT_HARVEST,
    values: defaultValues(),
    scen: Object.fromEntries(STAGES.map((s) => [s.key, new Set()])),
  };
}

function mergeScenarios(st, active) {
  const sc = { priceMul: 1, qMul: 1, materialMul: 1, logisticsMul: 1, cap: {}, lossAdd: {}, shift: {} };
  if (!active) return sc;
  for (const s of st.scenarios) {
    if (!active.has(s.id)) continue;
    if (s.priceMul) sc.priceMul *= s.priceMul;
    if (s.qMul) sc.qMul *= s.qMul;
    if (s.materialMul) sc.materialMul *= s.materialMul;
    if (s.logisticsMul) sc.logisticsMul *= s.logisticsMul;
    for (const [k, v] of Object.entries(s.cap || {})) sc.cap[k] = (sc.cap[k] ?? 1) * v;
    for (const [k, v] of Object.entries(s.lossAdd || {})) sc.lossAdd[k] = (sc.lossAdd[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.shift || {})) sc.shift[k] = (sc.shift[k] ?? 0) + v;
  }
  return sc;
}

export function effValue(st, scSet, mId, p, v) {
  const sc = mergeScenarios(st, scSet);
  return clamp(v + (sc.shift[`${mId}.${p.id}`] ?? 0), p.min - (p.max - p.min), p.max + (p.max - p.min));
}

let DESIGN = null;   // design flow per stage (per day), computed once

function simStage(st, inSeason, vals, scSet, upQ) {
  const sc = mergeScenarios(st, scSet);
  const flowSeason = st.toFlowSeason(inSeason);
  const flowIn = flowSeason / st.days;
  const design = DESIGN ? DESIGN[st.key] : Infinity;
  let f = flowIn, Q = 1, energyAdj = 0, costAdj = 0, priceMult = 1;
  const machines = [];
  for (const m of st.machines) {
    let capMul = 1, loss = m.loss + (sc.lossAdd[m.id] ?? 0), mQ = 1;
    for (const p of m.params) {
      const raw = vals[m.id][p.id];
      const v = raw + (sc.shift[`${m.id}.${p.id}`] ?? 0);
      const d = (v - p.opt) / p.tol;
      const s = Math.exp(-0.5 * d * d);
      const n = (v - p.opt) / (p.max - p.min);
      const e = p.eff;
      if (e.y) loss += e.y * (1 - s);
      if (e.q) mQ *= 1 - e.q * (1 - s);
      if (e.c) capMul *= 1 + e.c * n;
      if (e.e) energyAdj += e.e * n;
      if (e.pm) priceMult *= 1 + e.pm * n;
      if (e.lm) loss += e.lm * n;
      if (e.k) costAdj += e.k * n;
    }
    loss = clamp(loss, 0, 0.9);
    capMul = Math.max(0.15, capMul) * (sc.cap[m.id] ?? 1);
    const cap = m.cap * design * capMul;
    const util = cap > 0 ? f / cap : 0;
    const processed = Math.min(f, cap);
    const overflow = Math.max(0, f - cap);
    const outFlow = processed * (1 - loss);
    machines.push({ id: m.id, def: m, inFlow: f, cap, util, processed, overflow, loss, outFlow, Q: mQ });
    Q *= mQ;
    f = outFlow;
  }
  Q = clamp(Q * sc.qMul, 0, 1);
  const Qeff = Q * (0.85 + 0.15 * upQ);
  let maxUtil = 0, bottleneck = null;
  for (const mm of machines) if (mm.util > maxUtil) { maxUtil = mm.util; bottleneck = mm; }
  return {
    st, key: st.key, inSeason, flowSeason, flowIn, outFlow: f,
    out: f * st.days * st.outPerFlow,
    yield: flowIn > 0 ? f / flowIn : 0,
    Q, Qeff, energyAdj, costAdj, priceMult: priceMult * sc.priceMul, sc, machines, maxUtil, bottleneck,
  };
}

function economics(rs, values, scen) {
  const [r1, r2, r3, r4, r5, r6] = rs;
  const E = (r) => r.st.econ;

  r1.priceUnit = E(r1).price * gradeMult(r1.Qeff) * r1.priceMult;
  r1.revenue = r1.out * r1.priceUnit;
  r1.inputCost = r1.flowSeason * E(r1).inCostPerFlow;

  r3.priceKg = E(r3).basePriceKg * gradeMult(r3.Qeff) * r3.priceMult;
  r3.priceUnit = r3.priceKg * 1000;
  r3.gross = r3.out * r3.priceUnit;
  r3.revenue = r3.gross * E(r3).feeRate;
  r3.inputCost = 0;

  r2.priceUnit = r3.priceUnit * (1 - E(r2).feeRate);
  r2.revenue = r2.out * r2.priceUnit;
  r2.inputCost = r2.inSeason * r1.priceUnit;

  r4.priceUnit = E(r4).price * gradeMult(r4.Qeff) * r4.priceMult;
  r4.revenue = r4.out * r4.priceUnit;
  r4.inputCost = r4.inSeason * r3.priceUnit * E(r4).buyMarkup;

  r5.priceUnit = E(r5).price * gradeMult(r5.Qeff) * r5.priceMult;
  r5.revenue = r5.out * r5.priceUnit;
  r5.inputCost = r5.inSeason * r4.priceUnit;

  const share = clamp(values.distribution.sort.export / 100, 0, 1);
  const g6 = gradeMult(r6.Qeff) * r6.priceMult;
  const pExp = E(r6).priceExport * (1 - 0.25 * share * share);
  r6.exportShare = share;
  r6.priceUnit = (E(r6).priceDomestic * (1 - share) + pExp * share) * g6;
  r6.revenue = r6.out * r6.priceUnit;
  r6.exportRevenue = r6.out * share * pExp * g6;
  r6.inputCost = r6.inSeason * r5.priceUnit;
  r6.countries = Math.round(values.distribution.port.countries + (r6.sc.shift['port.countries'] ?? 0));

  for (const r of rs) {
    const e = E(r);
    const energy = (e.energyPerFlow ?? 0) * r.flowSeason * Math.max(0.4, 1 + r.energyAdj);
    const material = (e.materialPerOut ?? 0) * r.out * Math.max(0.5, 1 + r.costAdj) * r.sc.materialMul;
    const logistics = r.key === 'distribution'
      ? r.out * (e.logisticsPerOut + e.exportExtra * share) * r.sc.logisticsMul * Math.max(0.5, 1 + r.costAdj)
      : 0;
    const fixed = e.fixed * Math.max(0.6, 1 + 0.5 * r.costAdj);
    const overtime = r.maxUtil > 1 ? e.fixed * 0.35 * Math.min(1.5, r.maxUtil - 1) : 0;
    const dep = e.capex / e.life;
    r.costs = { input: r.inputCost, energy, material, logistics, fixed, overtime, dep };
    r.cost = r.inputCost + energy + material + logistics + fixed + overtime + dep;
    r.profit = r.revenue - r.cost;
    r.roi = r.profit / e.capex;
    r.payback = r.profit > 0 ? e.capex / r.profit : Infinity;
    r.headline = r.key === 'auction' ? r.gross : r.revenue;
    r.monthly = r.st.months.w.map((w) => r.headline * w);
  }
}

function chain(R, values, scen) {
  const rs = [];
  let input = R, upQ = 1;
  for (const st of STAGES) {
    const r = simStage(st, input, values[st.key], scen?.[st.key], upQ);
    rs.push(r);
    input = r.out;
    upQ = r.Qeff;
  }
  economics(rs, values, scen);
  return rs;
}

function initDesign() {
  if (DESIGN) return;
  const rs = chain(DESIGN_HARVEST, defaultValues(), null);   // DESIGN null → infinite capacity
  DESIGN = Object.fromEntries(rs.map((r) => [r.key, r.flowIn]));
}

export function run(state) {
  initDesign();
  return chain(state.R, state.values, state.scen);
}

export function runBaseline(state) {
  initDesign();
  return chain(state.R, defaultValues(), state.scen);
}

export function grade(Q) {
  if (Q >= 0.92) return '특상';
  if (Q >= 0.84) return '상';
  if (Q >= 0.74) return '중';
  return '하';
}

const snap = (v, p) => {
  const s = Math.round((v - p.min) / p.step) * p.step + p.min;
  return Math.round(clamp(s, p.min, p.max) * 1e6) / 1e6;
};

/** Coordinate search on one stage's params, maximising that stage's profit. */
export function optimize(state, stageIdx) {
  initDesign();
  const st = STAGES[stageIdx];
  const vals = structuredClone(state.values);
  const objective = () => chain(state.R, vals, state.scen)[stageIdx].profit;
  let best = objective();
  for (let pass = 0; pass < 3; pass++) {
    for (const m of st.machines) {
      for (const p of m.params) {
        const cur = vals[st.key][m.id][p.id];
        let bestV = cur;
        const N = 48;
        for (let i = 0; i <= N; i++) {
          const v = snap(p.min + ((p.max - p.min) * i) / N, p);
          vals[st.key][m.id][p.id] = v;
          const o = objective();
          if (o > best + 1) { best = o; bestV = v; }
        }
        // local refinement around the best grid point
        for (let k = -6; k <= 6; k++) {
          const v = snap(bestV + k * p.step, p);
          vals[st.key][m.id][p.id] = v;
          const o = objective();
          if (o > best + 1) { best = o; bestV = v; }
        }
        vals[st.key][m.id][p.id] = bestV;
      }
    }
  }
  return vals[st.key];
}
