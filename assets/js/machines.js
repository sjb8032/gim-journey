// Procedural low-poly machines for the digital twin. Every builder returns
// { group, len, depth, h, tick(dt, t, s) } with the flow running along +x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const BELT_Y = 0.62;

// ---------- shared resources ----------
let SOFT = null;
export function softTexture() {
  if (SOFT) return SOFT;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  SOFT = new THREE.CanvasTexture(c);
  return SOFT;
}

export function makeMaterials(hue, light = false) {
  const H = new THREE.Color(hue);
  const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.9, ...o });
  // light = design B: white/grey equipment with blue trim instead of dark navy paint
  const L = light ? { paint: 0xdde3ea, paintLight: 0xf5f7fa, panel: 0xc3cdd9, blue: 0x2563eb, navy: 0x1e3a8a, white: 0xf8fafc, steelDark: 0x66727f, glow: 0.9 } : {};
  return {
    hue: H,
    steel: std({ color: 0xc3ccd6, metalness: 0.85, roughness: 0.3 }),
    steelDark: std({ color: L.steelDark ?? 0x59646f, metalness: 0.75, roughness: 0.42 }),
    paint: std({ color: L.paint ?? 0x27313f, metalness: light ? 0.15 : 0.35, roughness: 0.55 }),
    paintLight: std({ color: L.paintLight ?? 0xa9b3be, metalness: 0.2, roughness: 0.5 }),
    panel: std({ color: L.panel ?? 0x3a4657, metalness: light ? 0.2 : 0.4, roughness: 0.5 }),
    rubber: std({ color: 0x15181c, metalness: 0.1, roughness: 0.85 }),
    belt: std({ color: 0x1b2027, metalness: 0.2, roughness: 0.75 }),
    blue: std({ color: L.blue ?? 0x2f6fb3, metalness: 0.2, roughness: 0.45 }),
    navy: std({ color: L.navy ?? 0x1d2c4a, metalness: 0.3, roughness: 0.5 }),
    white: std({ color: L.white ?? 0xb9c2cc, metalness: 0.15, roughness: 0.5 }),
    wood: std({ color: 0x8a6a46, metalness: 0.0, roughness: 0.8 }),
    cardboard: std({ color: 0xc19a62, metalness: 0.0, roughness: 0.85 }),
    yellow: std({ color: 0xe0b23a, metalness: 0.3, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa8d8ff, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    water: std({ color: 0x1b5e86, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.85, emissive: 0x0b3550, emissiveIntensity: 0.6 }),
    accent: std({ color: H, emissive: H, emissiveIntensity: light ? L.glow : 2.6, metalness: 0, roughness: 0.4 }),
    accentSoft: std({ color: H, emissive: H, emissiveIntensity: light ? 0.3 : 0.9, metalness: 0, roughness: 0.4 }),
    heat: std({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 3, metalness: 0, roughness: 0.6 }),
    lamp: std({ color: 0xfff2d6, emissive: 0xfff0c8, emissiveIntensity: 2.4 }),
    red: std({ color: 0xff3b4f, emissive: 0xff2040, emissiveIntensity: 2.4 }),
    green: std({ color: 0x5ee0c1, emissive: 0x3fe0b0, emissiveIntensity: 2.2 }),
  };
}

const GEO = new Map();
function geo(key, make) { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); }
export function disposeShared() { for (const g of GEO.values()) g.dispose(); GEO.clear(); }

function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  if (parent) parent.add(o);
  return o;
}
const rbox = (w, h, d, r = 0.05) => geo(`rb${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)));
const bx = (w, h, d) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cy = (rt, rb, h, s = 24, open = false) => geo(`c${rt}|${rb}|${h}|${s}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
const sp = (r, s = 16) => geo(`s${r}|${s}`, () => new THREE.SphereGeometry(r, s, Math.max(8, s / 2)));

function legs(g, M, w, d, h, inset = 0.12) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(bx(0.08, h, 0.08), M.steelDark, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), g);
}
function statusLamp(g, M, x, y, z) {
  const post = mesh(cy(0.03, 0.03, 0.4, 8), M.steelDark, x, y + 0.2, z, g);
  const lamp = mesh(cy(0.07, 0.07, 0.16, 12), M.green.clone(), x, y + 0.48, z, g);
  post.castShadow = false;
  return lamp;
}
function setLamp(lamp, util, t) {
  if (!lamp) return;
  const c = util > 1 ? 0xff2040 : util > 0.9 ? 0xffb02e : 0x3fe0b0;
  lamp.material.emissive.setHex(c); lamp.material.color.setHex(c);
  lamp.material.emissiveIntensity = util > 1 ? 1.5 + 1.5 * (0.5 + 0.5 * Math.sin(t * 9)) : 2.2;
}

// ---------- particles ----------
export class Particles {
  constructor(count, { color = 0xffffff, size = 0.12, additive = true, opacity = 1 } = {}) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.base = new THREE.Color(color);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, map: softTexture(), vertexColors: true, transparent: true, opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this.i = 0; this.acc = 0;
    for (let k = 0; k < count; k++) this.pos[k * 3 + 1] = -999;
  }
  emit(x, y, z, vx, vy, vz, life) {
    const k = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([x, y, z], k * 3); this.vel.set([vx, vy, vz], k * 3);
    this.life[k] = life; this.max[k] = life;
  }
  /** spawner(emit) called `rate` times per second */
  update(dt, rate, spawner, gravity = 0, drag = 0) {
    this.acc += rate * dt;
    while (this.acc >= 1) { this.acc -= 1; spawner((...a) => this.emit(...a)); }
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -999; continue; }
      this.life[k] -= dt;
      const j = k * 3;
      this.vel[j + 1] += gravity * dt;
      const dr = 1 - drag * dt;
      this.vel[j] *= dr; this.vel[j + 1] *= dr; this.vel[j + 2] *= dr;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const f = Math.max(0, this.life[k] / this.max[k]);
      const a = Math.sin(Math.PI * Math.min(1, f * 1.15));
      this.col[j] = this.base.r * a; this.col[j + 1] = this.base.g * a; this.col[j + 2] = this.base.b * a;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

function canvasPanel(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ctx = c.getContext('2d');
  const redraw = (...a) => { draw(ctx, w, h, ...a); tex.needsUpdate = true; };
  redraw();
  return { tex, redraw };
}

// ======================================================================
// Builders
// ======================================================================
const B = {};

B.tankRack = (M) => {
  const g = new THREE.Group();
  const W = 2.6, D = 1.15, H = 2.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(bx(0.07, H, 0.07), M.steel, sx * (W / 2), H / 2, sz * (D / 2), g);
  const tanks = [];
  for (const [i, y] of [0.18, 1.02].entries()) {
    mesh(bx(W + 0.1, 0.06, D + 0.1), M.steelDark, 0, y, 0, g);
    for (let k = 0; k < 3; k++) {
      const x = -0.85 + k * 0.85;
      mesh(bx(0.72, 0.6, 0.9), M.glass, x, y + 0.33, 0, g).castShadow = false;
      const w = mesh(bx(0.66, 0.46, 0.84), M.water, x, y + 0.27, 0, g); w.castShadow = false;
      tanks.push([x, y]);
    }
    const led = mesh(bx(W - 0.1, 0.05, 0.12), M.accent, 0, y + 0.78, 0.3, g); led.castShadow = false;
    g.userData['led' + i] = led;
  }
  M.water.color.setHex(0x3d2a6e); M.water.emissive.setHex(0x2a1650);
  const bubbles = new Particles(140, { color: 0xc8b8ff, size: 0.06 });
  g.add(bubbles.points);
  const lamp = statusLamp(g, M, W / 2 + 0.2, 0, D / 2);
  return {
    group: g, len: W + 0.5, depth: D + 0.4, h: H,
    tick(dt, t, s) {
      const li = 1.2 + 2.4 * ((s.v.light - 10) / 110);
      g.userData.led0.material.emissiveIntensity = li;
      bubbles.update(dt, 30 * (0.3 + s.run), (emit) => {
        const [x, y] = tanks[(Math.random() * tanks.length) | 0];
        emit(x + (Math.random() - 0.5) * 0.5, y + 0.06, (Math.random() - 0.5) * 0.6, 0, 0.35 + Math.random() * 0.2, 0, 1.1);
      });
      setLamp(lamp, s.util, t);
    },
  };
};

B.chamber = (M) => {
  const g = new THREE.Group();
  mesh(rbox(1.9, 2.2, 1.4, 0.08), M.paintLight, 0, 1.1, 0, g);
  mesh(bx(1.5, 1.7, 0.02), M.glass, 0, 1.15, 0.71, g).castShadow = false;
  const light = mesh(bx(1.4, 1.5, 0.02), M.lamp.clone(), 0, 1.15, 0.62, g); light.castShadow = false;
  for (let k = 0; k < 4; k++) mesh(bx(1.3, 0.03, 0.9), M.steel, 0, 0.55 + k * 0.38, 0.1, g);
  const disp = mesh(bx(0.5, 0.18, 0.02), M.accent, 0.55, 2.05, 0.71, g); disp.castShadow = false;
  const lamp = statusLamp(g, M, -0.75, 2.2, 0);
  return {
    group: g, len: 2.2, depth: 1.6, h: 2.3,
    tick(dt, t, s) {
      const day = (t % 8) / 8 < s.v.photo / 24 + 0.15;
      light.material.emissiveIntensity = THREE.MathUtils.lerp(light.material.emissiveIntensity, day ? 2.2 : 0.15, dt * 4);
      setLamp(lamp, s.util, t);
    },
  };
};

B.tank = (M) => {
  const g = new THREE.Group();
  const shell = mesh(cy(0.8, 0.8, 1.05, 32, true), M.steel.clone(), 0, 0.53, 0, g); shell.material.side = THREE.DoubleSide;
  mesh(cy(0.8, 0.8, 0.05, 32), M.steelDark, 0, 0.02, 0, g);
  const w = mesh(cy(0.77, 0.77, 0.02, 32), M.water, 0, 0.9, 0, g); w.castShadow = false;
  mesh(geo('torusTank', () => new THREE.TorusGeometry(0.8, 0.04, 8, 40)), M.steelDark, 0, 1.05, 0, g).rotation.x = Math.PI / 2;
  const pipe = mesh(cy(0.05, 0.05, 1.4, 10), M.steelDark, 0.95, 0.7, 0, g); pipe.rotation.z = 0.3;
  const bubbles = new Particles(120, { color: 0xd7c8ff, size: 0.08 });
  g.add(bubbles.points);
  const lamp = statusLamp(g, M, -0.95, 0, 0.5);
  return {
    group: g, len: 2.1, depth: 1.8, h: 1.2,
    tick(dt, t, s) {
      bubbles.update(dt, 10 + s.v.air * 4, (emit) => {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.6;
        emit(Math.cos(a) * r, 0.92, Math.sin(a) * r, 0, 0.15 + Math.random() * 0.25, 0, 0.6);
      });
      w.position.y = 0.9 + Math.sin(t * 3) * 0.01;
      setLamp(lamp, s.util, t);
    },
  };
};

B.wheel = (M) => {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  mesh(rbox(3.0, 0.85, 1.7, 0.08), M.blue, 0, 0.43, 0, body);
  const w = mesh(bx(2.8, 0.02, 1.5), M.water, 0, 0.78, 0, body); w.castShadow = false;
  const drum = new THREE.Group(); drum.position.set(0, 1.05, 0); body.add(drum);
  const net = new THREE.MeshStandardMaterial({ color: 0x9c7fd8, emissive: 0x3b2470, emissiveIntensity: 0.6, wireframe: true });
  mesh(geo('drumNet', () => new THREE.CylinderGeometry(0.72, 0.72, 1.4, 18, 6, true)), net, 0, 0, 0, drum).rotation.x = Math.PI / 2;
  mesh(cy(0.06, 0.06, 1.7, 10), M.steel, 0, 0, 0, drum).rotation.x = Math.PI / 2;
  for (const z of [-0.7, 0.7]) {
    const rim = mesh(geo('wheelRim', () => new THREE.TorusGeometry(0.72, 0.035, 8, 36)), M.steel, 0, 0, z, drum);
    for (let k = 0; k < 6; k++) { const sp_ = mesh(bx(1.42, 0.04, 0.04), M.steel, 0, 0, z, drum); sp_.rotation.z = (k / 6) * Math.PI; }
    rim.castShadow = true;
  }
  mesh(rbox(0.5, 0.45, 0.4, 0.04), M.paint, 1.25, 1.05, 0.95, body);
  mesh(bx(0.04, 0.2, 0.1), M.accent, 1.0, 1.15, 1.16, body);
  const lamp = statusLamp(g, M, -1.45, 0.85, 0.75);
  return {
    group: g, body, len: 3.2, depth: 2.0, h: 1.9,
    tick(dt, t, s) {
      drum.rotation.z -= dt * (s.v.rpm / 60) * Math.PI * 2 * (0.4 + 0.6 * s.run);
      setLamp(lamp, s.util, t);
    },
  };
};

B.freezer = (M) => {
  const g = new THREE.Group();
  mesh(rbox(2.3, 2.0, 1.7, 0.06), M.paintLight, 0, 1.0, 0, g);
  for (let k = -1; k <= 1; k++) mesh(bx(0.02, 1.9, 1.72), M.steel, k * 0.75, 1.0, 0, g);
  mesh(rbox(0.9, 1.6, 0.06, 0.03), M.white, 0.35, 0.85, 0.86, g);
  mesh(bx(0.06, 0.4, 0.06), M.steel, -0.05, 0.95, 0.92, g);
  const strip = mesh(bx(2.2, 0.05, 0.05), M.accent, 0, 1.95, 0.86, g); strip.castShadow = false;
  const panel = canvasPanel(256, 96, (c, w, h, v = -20) => {
    c.fillStyle = '#071018'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7fd4ff'; c.font = 'bold 54px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${v}°C`, w / 2, h / 2 + 4);
  });
  const disp = mesh(bx(0.6, 0.22, 0.02), new THREE.MeshBasicMaterial({ map: panel.tex }), -0.6, 1.55, 0.87, g); disp.castShadow = false;
  const frost = new Particles(90, { color: 0xbfe6ff, size: 0.07 });
  g.add(frost.points);
  const lamp = statusLamp(g, M, -1.0, 2.0, -0.5);
  let last = null;
  return {
    group: g, len: 2.6, depth: 1.9, h: 2.1,
    tick(dt, t, s) {
      if (last !== s.v.ftemp) { panel.redraw(s.v.ftemp); last = s.v.ftemp; }
      frost.update(dt, 14, (emit) => emit(-0.4 + Math.random() * 1.6, 2.0, 0.9 + Math.random() * 0.2, (Math.random() - 0.5) * 0.1, -0.25, 0.05, 2.2));
      setLamp(lamp, s.util, t);
    },
  };
};

B.washer = (M) => {
  const g = new THREE.Group();
  legs(g, M, 2.3, 1.0, 0.7);
  mesh(rbox(2.3, 0.18, 1.1, 0.04), M.steelDark, 0, 0.75, 0, g);
  const drum = new THREE.Group(); drum.position.set(0, 1.25, 0); g.add(drum);
  const dm = mesh(cy(0.5, 0.5, 2.0, 24, true), M.steel.clone(), 0, 0, 0, drum); dm.rotation.z = Math.PI / 2; dm.material.side = THREE.DoubleSide;
  for (let k = -2; k <= 2; k++) { const r = mesh(geo('washRing', () => new THREE.TorusGeometry(0.52, 0.035, 6, 30)), M.steelDark, k * 0.45, 0, 0, drum); r.rotation.y = Math.PI / 2; }
  const bar = mesh(bx(2.1, 0.06, 0.06), M.steel, 0, 1.95, 0, g);
  const nozzles = [-0.7, 0, 0.7];
  for (const x of nozzles) mesh(cy(0.04, 0.06, 0.14, 8), M.steelDark, x, 1.86, 0, g);
  bar.castShadow = false;
  const spray = new Particles(220, { color: 0x9fdcff, size: 0.07 });
  g.add(spray.points);
  const lamp = statusLamp(g, M, 1.25, 0.85, -0.45);
  return {
    group: g, len: 2.6, depth: 1.4, h: 2.0,
    tick(dt, t, s) {
      drum.rotation.x += dt * (s.v.drum / 60) * Math.PI * 2 * (0.3 + 0.7 * s.run);
      spray.update(dt, 50 + 40 * s.run, (emit) => {
        const x = nozzles[(Math.random() * 3) | 0];
        emit(x + (Math.random() - 0.5) * 0.1, 1.8, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.5, -1.4, (Math.random() - 0.5) * 0.5, 0.45);
      });
      setLamp(lamp, s.util, t);
    },
  };
};

B.ageTank = (M) => {
  const g = new THREE.Group();
  mesh(cy(0.72, 0.72, 1.7, 32), M.steel, 0, 1.05, 0, g);
  mesh(geo('dome', () => new THREE.SphereGeometry(0.72, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)), M.steel, 0, 1.9, 0, g);
  mesh(cy(0.5, 0.3, 0.2, 24), M.steelDark, 0, 0.1, 0, g);
  const glass = mesh(bx(0.12, 1.2, 0.02), M.glass, 0, 1.05, 0.73, g); glass.castShadow = false;
  const level = mesh(bx(0.08, 1, 0.02), M.accent, 0, 0.55, 0.735, g); level.castShadow = false;
  mesh(rbox(0.36, 0.3, 0.36, 0.04), M.paint, 0, 2.7, 0, g);
  const shaft = new THREE.Group(); shaft.position.set(0, 2.45, 0); g.add(shaft);
  mesh(cy(0.04, 0.04, 0.4, 8), M.steelDark, 0, 0, 0, shaft);
  for (let k = 0; k < 3; k++) { const b = mesh(bx(0.7, 0.03, 0.08), M.steelDark, 0, 0.05, 0, shaft); b.rotation.y = (k / 3) * Math.PI; }
  const p1 = mesh(cy(0.06, 0.06, 1.0, 10), M.steelDark, 0.9, 0.5, 0, g); p1.rotation.z = Math.PI / 2;
  const lamp = statusLamp(g, M, -0.9, 0, 0.4);
  return {
    group: g, len: 2.0, depth: 1.6, h: 2.9,
    tick(dt, t, s) {
      shaft.rotation.y += dt * (s.v.stir / 60) * Math.PI * 2;
      const fill = 0.35 + 0.6 * Math.min(1, s.util);
      level.scale.y = fill; level.position.y = 0.45 + fill * 0.5;
      setLamp(lamp, s.util, t);
    },
  };
};

B.cutter = (M) => {
  const g = new THREE.Group();
  mesh(rbox(1.3, 1.25, 1.1, 0.06), M.paint, 0, 0.62, 0, g);
  const hop = mesh(geo('hopper', () => new THREE.CylinderGeometry(0.62, 0.25, 0.6, 4, 1, true)), M.steel.clone(), 0, 1.55, 0, g); hop.material.side = THREE.DoubleSide;
  hop.rotation.y = Math.PI / 4;
  const win = mesh(cy(0.34, 0.34, 0.02, 28), M.glass, 0, 0.75, 0.56, g); win.rotation.x = Math.PI / 2; win.castShadow = false;
  const blade = new THREE.Group(); blade.position.set(0, 0.75, 0.5); g.add(blade);
  for (let k = 0; k < 4; k++) { const b = mesh(bx(0.56, 0.06, 0.02), M.steel, 0, 0, 0, blade); b.rotation.z = (k / 4) * Math.PI; }
  mesh(cy(0.06, 0.06, 0.06, 12), M.accent, 0, 0, 0.02, blade).rotation.x = Math.PI / 2;
  const lamp = statusLamp(g, M, 0.5, 1.25, -0.4);
  return {
    group: g, len: 1.7, depth: 1.4, h: 1.9,
    tick(dt, t, s) {
      const rpm = s.v.blade ?? s.v.kspeed ?? 1200;
      blade.rotation.z += dt * Math.min(40, rpm / 60) * 0.9;
      setLamp(lamp, s.util, t);
    },
  };
};

B.former = (M) => {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  mesh(rbox(3.2, 0.7, 1.3, 0.06), M.paint, 0, 0.35, 0, body);
  mesh(cy(0.45, 0.45, 0.9, 24), M.steel, -1.25, 1.1, -0.15, body);
  const frames = [];
  const fm = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, metalness: 0.6, roughness: 0.4 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0x1f2a22, roughness: 0.5, metalness: 0.1 });
  for (let k = 0; k < 9; k++) {
    const f = new THREE.Group();
    mesh(bx(0.3, 0.02, 0.3), sheet, 0, 0.02, 0, f);
    for (const [w, d, x, z] of [[0.34, 0.03, 0, 0.16], [0.34, 0.03, 0, -0.16], [0.03, 0.34, 0.16, 0], [0.03, 0.34, -0.16, 0]]) mesh(bx(w, 0.04, d), fm, x, 0.03, z, f);
    f.position.set(-1.4 + k * 0.33, 0.74, 0);
    body.add(f); frames.push(f);
  }
  const head = mesh(rbox(0.6, 0.3, 0.9, 0.04), M.steel, -0.6, 1.25, 0, body);
  mesh(bx(0.5, 0.04, 0.05), M.accent, -0.6, 1.08, 0.43, body).castShadow = false;
  mesh(bx(0.08, 0.5, 0.08), M.steelDark, -0.6, 0.98, 0.4, body); mesh(bx(0.08, 0.5, 0.08), M.steelDark, -0.6, 0.98, -0.4, body);
  const lamp = statusLamp(g, M, 1.45, 0.7, 0.5);
  return {
    group: g, body, len: 3.4, depth: 1.5, h: 1.6,
    tick(dt, t, s) {
      const v = (s.v.speed / 140) * 0.5 * (0.3 + 0.7 * s.run);
      for (const f of frames) { f.position.x += v * dt; if (f.position.x > 1.55) f.position.x -= 9 * 0.33; }
      head.position.y = 1.25 + Math.max(0, Math.sin(t * 6 * (s.v.speed / 140))) * 0.08;
      setLamp(lamp, s.util, t);
    },
  };
};

B.press = (M) => {
  const g = new THREE.Group();
  for (const x of [-0.6, 0.6]) for (const z of [-0.5, 0.5]) mesh(bx(0.1, 1.5, 0.1), M.steelDark, x, 0.75, z, g);
  mesh(bx(1.35, 0.1, 1.15), M.paint, 0, 1.5, 0, g);
  const rolls = [];
  for (const x of [-0.25, 0.25]) for (const y of [0.55, 0.9]) {
    const r = mesh(cy(0.16, 0.16, 0.95, 20), M.steel, x, y, 0, g); r.rotation.x = Math.PI / 2; rolls.push([r, y > 0.7 ? -1 : 1]);
  }
  const lamp = statusLamp(g, M, 0.6, 1.55, 0.5);
  return {
    group: g, len: 1.5, depth: 1.3, h: 1.6,
    tick(dt, t, s) { for (const [r, d] of rolls) r.rotation.y += d * dt * 3 * (0.3 + 0.7 * s.run); setLamp(lamp, s.util, t); },
  };
};

B.dryer = (M) => {
  const g = new THREE.Group();
  const L = 5.2;
  mesh(rbox(L, 1.75, 1.5, 0.08), M.paint, 0, 0.88, 0, g);
  const heat = M.heat.clone();
  for (let k = 0; k < 5; k++) {
    const x = -L / 2 + 0.6 + k * 1.0;
    mesh(bx(0.7, 0.55, 0.02), M.glass, x, 1.05, 0.76, g).castShadow = false;
    const inner = mesh(bx(0.66, 0.5, 0.02), heat, x, 1.05, 0.7, g); inner.castShadow = false;
  }
  const fans = [];
  for (const x of [-1.4, 0.4, 1.8]) {
    mesh(cy(0.3, 0.3, 0.2, 20), M.steelDark, x, 1.86, 0, g);
    const f = new THREE.Group(); f.position.set(x, 1.98, 0); g.add(f);
    for (let k = 0; k < 4; k++) { const b = mesh(bx(0.5, 0.02, 0.1), M.steel, 0, 0, 0, f); b.rotation.y = (k / 4) * Math.PI; }
    fans.push(f);
  }
  mesh(bx(L - 0.2, 0.05, 0.05), M.accent, 0, 1.72, 0.76, g).castShadow = false;
  const light = new THREE.PointLight(0xff7a2a, 3, 6, 2); light.position.set(0, 1.0, 1.4); g.add(light);
  const steam = new Particles(160, { color: 0xffffff, size: 0.35, opacity: 0.35 });
  g.add(steam.points);
  const lamp = statusLamp(g, M, L / 2 - 0.2, 1.75, -0.5);
  return {
    group: g, len: L + 0.4, depth: 1.7, h: 2.1,
    tick(dt, t, s) {
      const k = (s.v.temp - 30) / 40;
      heat.emissiveIntensity = 0.8 + k * 4.2 + Math.sin(t * 7) * 0.15;
      light.intensity = 1 + k * 5;
      for (const f of fans) f.rotation.y += dt * (4 + s.v.wind * 2);
      steam.update(dt, 8 + 18 * k * s.run, (emit) => {
        const x = [-1.4, 0.4, 1.8][(Math.random() * 3) | 0];
        emit(x + (Math.random() - 0.5) * 0.3, 2.05, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.15, 0.6 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, 2.2);
      }, 0, 0.3);
      setLamp(lamp, s.util, t);
    },
  };
};

B.inspector = (M) => {
  const g = new THREE.Group();
  for (const z of [-0.75, 0.75]) mesh(bx(0.1, 1.9, 0.1), M.steelDark, 0, 0.95, z, g);
  mesh(bx(0.2, 0.15, 1.7), M.paint, 0, 1.9, 0, g);
  const cam = mesh(rbox(0.32, 0.26, 0.3, 0.04), M.panel, 0, 1.7, 0, g);
  mesh(cy(0.07, 0.07, 0.1, 16), M.accent, 0, 1.55, 0, g);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x5ee0c1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const laser = mesh(geo('laser', () => new THREE.PlaneGeometry(0.03, 1.0)), laserMat, 0, 1.05, 0, g);
  laser.rotation.y = Math.PI / 2; laser.scale.set(1, 1, 1); laser.castShadow = false;
  const fan = mesh(geo('laserFan', () => new THREE.ConeGeometry(0.5, 0.95, 3, 1, true)), laserMat, 0, 1.07, 0, g); fan.castShadow = false;
  fan.scale.set(1, 1, 0.05);
  const lamp = statusLamp(g, M, 0.25, 1.98, 0.75);
  return {
    group: g, len: 1.3, depth: 1.8, h: 2.1,
    tick(dt, t, s) {
      const sweep = Math.sin(t * 3.2);
      fan.position.x = sweep * 0.35; fan.rotation.z = Math.PI + sweep * 0.25;
      laser.position.x = sweep * 0.35;
      laserMat.opacity = 0.35 + 0.25 * Math.abs(Math.sin(t * 11));
      cam.position.x = sweep * 0.05;
      setLamp(lamp, s.util, t);
    },
  };
};

B.packer = (M) => {
  const g = new THREE.Group();
  mesh(rbox(1.5, 1.6, 1.3, 0.06), M.paintLight, -0.3, 0.8, 0, g);
  mesh(bx(0.9, 0.5, 0.02), M.rubber, -0.3, 0.7, 0.66, g);
  mesh(bx(1.3, 0.04, 0.05), M.accent, -0.3, 1.5, 0.66, g).castShadow = false;
  mesh(bx(0.9, 0.12, 0.9), M.wood, 0.95, 0.06, 0, g);
  const boxes = [];
  for (let k = 0; k < 12; k++) {
    const b = mesh(bx(0.4, 0.28, 0.4), M.cardboard, 0.95 + ((k % 2) - 0.5) * 0.42, 0.26 + Math.floor(k / 4) * 0.29, (((k >> 1) % 2) - 0.5) * 0.42, g);
    b.visible = false; boxes.push(b);
  }
  const arm = new THREE.Group(); arm.position.set(0.4, 1.6, 0); g.add(arm);
  mesh(bx(0.08, 0.08, 0.08), M.steelDark, 0, 0, 0, arm);
  const a1 = mesh(bx(0.7, 0.08, 0.08), M.yellow, 0.35, 0, 0, arm);
  let n = 0, acc = 0;
  const lamp = statusLamp(g, M, -0.95, 1.6, -0.5);
  return {
    group: g, len: 2.3, depth: 1.5, h: 1.9,
    tick(dt, t, s) {
      acc += dt * (0.6 + 1.6 * s.run);
      if (acc > 1) { acc = 0; n = (n + 1) % 13; boxes.forEach((b, i) => (b.visible = i < n)); }
      arm.rotation.y = Math.sin(t * 2.4) * 0.9; a1.rotation.z = Math.sin(t * 4.8) * 0.2;
      setLamp(lamp, s.util, t);
    },
  };
};

B.scale = (M) => {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  mesh(rbox(1.9, 0.14, 1.7, 0.03), M.steelDark, 0, 0.07, 0, body);
  mesh(bx(1.3, 0.12, 1.2), M.wood, 0, 0.2, 0, body);
  const sack = rbox(0.55, 0.42, 0.45, 0.14);
  const sackM = M.blue.clone(); sackM.color.setHex(0x2d5fae); sackM.roughness = 0.8;
  for (let k = 0; k < 7; k++) mesh(sack, sackM, -0.32 + (k % 2) * 0.62, 0.48 + Math.floor(k / 4) * 0.42, ((k >> 1) % 2 - 0.5) * 0.56 + (k === 6 ? 0.28 : 0), body).rotation.y = (k * 0.37) % 0.3;
  mesh(bx(0.08, 1.4, 0.08), M.steel, 0.9, 0.7, 0.75, body);
  const panel = canvasPanel(256, 96, (c, w, h, v = 0) => {
    c.fillStyle = '#05120d'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5ee0c1'; c.font = 'bold 50px "IBM Plex Mono", monospace'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(`${Math.round(v).toLocaleString('en-US')} kg`, w - 14, h / 2 + 3);
  });
  const disp = mesh(bx(0.62, 0.24, 0.06), new THREE.MeshBasicMaterial({ map: panel.tex }), 0.9, 1.5, 0.75, body); disp.castShadow = false;
  const lamp = statusLamp(g, M, -0.95, 0.14, 0.8);
  let acc = 0;
  return {
    group: g, body, len: 2.2, depth: 2.0, h: 1.7,
    tick(dt, t, s) {
      acc += dt; if (acc > 0.8) { acc = 0; panel.redraw(840 + Math.random() * 60 + s.util * 20); }
      setLamp(lamp, s.util, t);
    },
  };
};

B.sorter = (M) => {
  const g = new THREE.Group();
  legs(g, M, 2.6, 1.6, 0.55);
  mesh(rbox(2.6, 0.1, 1.6, 0.03), M.steelDark, 0, 0.58, 0, g);
  const arms = [];
  const laneCols = [0x5ee0c1, 0xffc94a, 0x6d9cff];
  for (let k = 0; k < 3; k++) {
    const x = -0.8 + k * 0.8;
    const pivot = new THREE.Group(); pivot.position.set(x, 0.72, -0.7); g.add(pivot);
    const a = mesh(bx(0.06, 0.16, 0.9), M.yellow, 0, 0, 0.45, pivot); arms.push(pivot);
    const l = mesh(bx(0.5, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: laneCols[k], emissive: laneCols[k], emissiveIntensity: 2 }), x, 0.66, 0.82, g);
    l.castShadow = false; a.castShadow = true;
  }
  const lamp = statusLamp(g, M, 1.25, 0.6, -0.75);
  return {
    group: g, len: 2.8, depth: 1.9, h: 1.2,
    tick(dt, t, s) {
      arms.forEach((p, i) => { p.rotation.y = Math.max(0, Math.sin(t * (1.5 + s.run * 2) + i * 2.1)) * 0.9; });
      setLamp(lamp, s.util, t);
    },
  };
};

B.board = (M) => {
  const g = new THREE.Group();
  for (const x of [-1.3, 1.3]) mesh(bx(0.1, 1.2, 0.1), M.steelDark, x, 0.6, -0.4, g);
  mesh(rbox(3.0, 1.55, 0.14, 0.04), M.rubber, 0, 1.95, -0.4, g);
  const panel = canvasPanel(768, 384, (c, w, h, st = {}) => {
    c.fillStyle = '#04070c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(109,156,255,.25)'; c.lineWidth = 2;
    for (let y = 70; y < h; y += 52) { c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke(); }
    c.fillStyle = '#6d9cff'; c.font = '600 30px "IBM Plex Sans KR", sans-serif'; c.textBaseline = 'middle';
    c.fillText('전자 경매 · 물김', 26, 38);
    c.fillStyle = '#ff4d61'; c.beginPath(); c.arc(w - 40, 38, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e9eef5'; c.font = '500 24px "IBM Plex Mono", monospace';
    (st.rows || []).forEach((r, i) => {
      const y = 98 + i * 52;
      c.fillStyle = '#74829a'; c.fillText(r[0], 26, y);
      c.fillStyle = '#e9eef5'; c.fillText(r[1], 200, y);
      c.fillStyle = r[3] ? '#5ee0c1' : '#ffc94a'; c.textAlign = 'right'; c.fillText(r[2], w - 26, y); c.textAlign = 'left';
    });
  });
  const scr = mesh(bx(2.8, 1.35, 0.02), new THREE.MeshBasicMaterial({ map: panel.tex, toneMapped: false }), 0, 1.95, -0.32, g);
  scr.castShadow = false;
  const bidders = [];
  const bodyM = M.navy;
  for (let k = 0; k < 6; k++) {
    const a = -0.9 + (k / 5) * 1.8;
    const p = new THREE.Group(); p.position.set(Math.sin(a) * 1.25, 0, 0.55 + Math.cos(a) * 0.35); g.add(p);
    mesh(geo('cap', () => new THREE.CapsuleGeometry(0.14, 0.45, 4, 10)), bodyM, 0, 0.4, 0, p);
    mesh(sp(0.12, 14), M.paintLight, 0, 0.82, 0, p);
    const paddle = mesh(bx(0.04, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0x6d9cff, emissive: 0x6d9cff, emissiveIntensity: 0.3 }), 0.18, 0.72, 0, p);
    bidders.push(paddle);
  }
  const lamp = statusLamp(g, M, 1.5, 1.2, -0.4);
  let acc = 0, price = 1450;
  return {
    group: g, len: 3.2, depth: 2.2, h: 2.8,
    tick(dt, t, s) {
      acc += dt;
      if (acc > 1.1) {
        acc = 0;
        price = Math.round((s.price || 1450) * (0.97 + Math.random() * 0.06) / 10) * 10;
        const rows = [];
        for (let i = 0; i < 5; i++) {
          const lot = 120 + ((t * 3 + i * 7) | 0) % 80;
          rows.push([`LOT ${lot}`, `${['상', '상', '중', '특상', '상'][i]} · ${(Math.random() * 3 + 1).toFixed(1)}t`, `${(price + (Math.random() - 0.5) * 120).toFixed(0)}원`, i < 3]);
        }
        panel.redraw({ rows });
        bidders.forEach((b) => (b.material.emissiveIntensity = Math.random() < 0.35 * (0.4 + s.run) ? 3 : 0.3));
      }
      setLamp(lamp, s.util, t);
    },
  };
};

function truckModel(M) {
  const g = new THREE.Group();
  mesh(rbox(2.4, 1.25, 1.15, 0.05), M.white, -0.35, 1.05, 0, g);
  mesh(rbox(0.9, 0.95, 1.1, 0.12), M.navy, 1.35, 0.9, 0, g);
  mesh(bx(0.02, 0.4, 0.9), M.glass, 1.8, 1.12, 0, g).castShadow = false;
  mesh(rbox(0.6, 0.25, 0.8, 0.04), M.steelDark, -0.6, 1.8, 0, g);
  const wheelG = cy(0.26, 0.26, 0.22, 18);
  for (const x of [-1.15, -0.55, 1.35]) for (const z of [-0.56, 0.56]) { const w = mesh(wheelG, M.rubber, x, 0.27, z, g); w.rotation.x = Math.PI / 2; }
  mesh(bx(0.05, 0.12, 0.3), M.lamp, 1.82, 0.62, 0.38, g); mesh(bx(0.05, 0.12, 0.3), M.lamp, 1.82, 0.62, -0.38, g);
  const tail = M.red.clone();
  mesh(bx(0.03, 0.1, 0.18), tail, -1.57, 0.6, 0.42, g); mesh(bx(0.03, 0.1, 0.18), tail, -1.57, 0.6, -0.42, g);
  g.userData.tail = tail;
  return g;
}

B.truck = (M) => {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const tr = truckModel(M); body.add(tr);
  const lamp = statusLamp(g, M, -1.6, 0, 0.9);
  let phase = Math.random() * 10;
  return {
    group: g, body, len: 3.6, depth: 1.8, h: 2.0,
    tick(dt, t, s) {
      phase += dt * (0.25 + 0.35 * s.run);
      const p = phase % 6;
      body.position.x = p < 4 ? 0 : (p - 4) * (p - 4) * 1.2;
      tr.userData.tail.emissiveIntensity = Math.sin(t * 6) > 0 ? 2.6 : 0.4;
      setLamp(lamp, s.util, t);
    },
  };
};

B.rack = (M) => {
  const g = new THREE.Group();
  const W = 2.8, H = 2.7, D = 1.0;
  for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) mesh(bx(0.07, H, 0.07), M.steelDark, x, H / 2, z, g);
  for (let k = 0; k < 4; k++) mesh(bx(W, 0.05, D), M.yellow, 0, 0.35 + k * 0.68, 0, g);
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) {
    if ((k * 7 + i * 3) % 5 === 0) continue;
    mesh(bx(0.38, 0.4, 0.7), M.cardboard, -W / 2 + 0.3 + i * 0.44, 0.58 + k * 0.68, 0, g);
  }
  const shuttle = mesh(rbox(0.5, 0.12, 0.3, 0.03), M.accent, 0, 1, D / 2 + 0.25, g);
  mesh(bx(0.05, H, 0.05), M.steel, 0, H / 2, D / 2 + 0.25, g);
  const lamp = statusLamp(g, M, W / 2 + 0.25, 0, D / 2);
  return {
    group: g, len: W + 0.6, depth: D + 0.7, h: H,
    tick(dt, t, s) {
      shuttle.position.y = 0.5 + (0.5 + 0.5 * Math.sin(t * (0.8 + s.run))) * 1.9;
      shuttle.position.x = Math.sin(t * 0.7) * 1.1;
      setLamp(lamp, s.util, t);
    },
  };
};

B.coldroom = (M) => {
  const r = B.freezer(M);
  r.group.scale.set(1.12, 1.1, 1.05);
  r.len = 2.9; r.h = 2.3;
  const tick = r.tick;
  r.tick = (dt, t, s) => tick(dt, t, { ...s, v: { ...s.v, ftemp: s.v.ctemp } });
  return r;
};

B.ship = (M) => {
  const g = new THREE.Group();
  // crane at the quay edge
  for (const z of [-1.0, 1.0]) for (const x of [-0.5, 0.5]) mesh(bx(0.12, 3.0, 0.12), M.yellow, x, 1.5, z, g);
  const boom = mesh(bx(0.25, 0.2, 5.4), M.yellow, 0, 3.05, 1.6, g);
  const trolley = new THREE.Group(); trolley.position.set(0, 2.85, 0); g.add(trolley);
  mesh(bx(0.4, 0.15, 0.4), M.steelDark, 0, 0, 0, trolley);
  const cable = mesh(bx(0.02, 1, 0.02), M.steelDark, 0, -0.5, 0, trolley);
  const cont = mesh(rbox(0.45, 0.42, 0.95, 0.02), new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: 0.6, metalness: 0.3 }), 0, -1.2, 0, trolley);
  // ship berthed parallel to the quay (z positive side, on the water)
  const ship = new THREE.Group(); ship.position.set(0, -0.08, 3.2); g.add(ship);
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.6, -0.5); hullShape.lineTo(2.2, -0.5); hullShape.lineTo(2.9, 0); hullShape.lineTo(2.2, 0.5); hullShape.lineTo(-2.6, 0.5); hullShape.closePath();
  const hullGeo = geo('hull', () => { const gg = new THREE.ExtrudeGeometry(hullShape, { depth: 0.7, bevelEnabled: false }); gg.rotateX(-Math.PI / 2); gg.translate(0, -0.15, 0); return gg; });
  mesh(hullGeo, M.navy, 0, 0, 0, ship);
  mesh(bx(5.4, 0.05, 0.98), new THREE.MeshStandardMaterial({ color: 0xa8342c, roughness: 0.7 }), -0.15, 0.57, 0, ship);
  const colors = [0xc8553d, 0x2f6fb3, 0xe0b23a, 0x3d8b5c, 0x8f9aa6, 0xefdcae];
  for (let i = 0; i < 24; i++) {
    const c = new THREE.MeshStandardMaterial({ color: colors[(i * 7) % colors.length], roughness: 0.6, metalness: 0.25 });
    mesh(bx(0.86, 0.36, 0.42), c, -1.2 + (Math.floor(i / 2) % 4) * 0.9, 0.78 + Math.floor(i / 8) * 0.37, ((i % 2) - 0.5) * 0.44, ship);
  }
  mesh(rbox(0.6, 1.1, 0.9, 0.04), M.white, -2.15, 1.15, 0, ship);
  mesh(bx(0.62, 0.12, 0.92), M.accent, -2.15, 1.5, 0, ship).castShadow = false;
  const lamp = statusLamp(g, M, 0.6, 0, -1.2);
  return {
    group: g, len: 3.0, depth: 2.6, h: 3.3, ship,
    tick(dt, t, s) {
      const p = (t * (0.18 + 0.25 * s.run)) % 1;
      const z = p < 0.5 ? THREE.MathUtils.lerp(-0.6, 3.2, p * 2) : THREE.MathUtils.lerp(3.2, -0.6, (p - 0.5) * 2);
      trolley.position.z = z;
      cont.visible = p < 0.5;
      ship.position.y = Math.sin(t * 1.2) * 0.04; ship.rotation.x = Math.sin(t * 0.9) * 0.01;
      setLamp(lamp, s.util, t);
    },
  };
};

B.oven = (M) => {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const L = 3.2;
  legs(body, M, L, 1.1, 0.5);
  mesh(rbox(L, 0.7, 1.2, 0.06), M.steel, 0, 0.85, 0, body);
  const heat = M.heat.clone();
  const burners = [];
  for (let k = 0; k < 6; k++) {
    const x = -L / 2 + 0.35 + k * 0.5;
    mesh(cy(0.13, 0.16, 0.3, 14), M.steelDark, x, 1.38, 0, body);
    const b = mesh(cy(0.14, 0.14, 0.03, 14), heat, x, 1.22, 0, body); b.castShadow = false; burners.push(b);
  }
  const win = mesh(bx(L - 0.3, 0.2, 0.02), heat, 0, 0.85, 0.61, body); win.castShadow = false;
  const light = new THREE.PointLight(0xff5a1a, 2.5, 5, 2); light.position.set(0, 1.1, 0.9); body.add(light);
  const sparks = new Particles(140, { color: 0xffa060, size: 0.07 });
  g.add(sparks.points);
  const lamp = statusLamp(g, M, L / 2 - 0.1, 1.2, -0.5);
  return {
    group: g, body, len: L + 0.3, depth: 1.4, h: 1.7,
    tick(dt, t, s) {
      const tv = s.v.temp ?? s.v.temp2 ?? 300;
      const k = Math.min(1.2, Math.max(0, (tv - 150) / 270));
      heat.emissiveIntensity = 0.8 + k * 4 + Math.sin(t * 13) * 0.25;
      light.intensity = 1 + 4 * k;
      sparks.update(dt, 10 + 30 * k * s.run, (emit) => {
        const x = -L / 2 + 0.35 + ((Math.random() * 6) | 0) * 0.5;
        emit(x, 1.55, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.2, 0.9);
      });
      setLamp(lamp, s.util, t);
    },
  };
};

B.sprayer = (M) => {
  const g = new THREE.Group();
  legs(g, M, 1.9, 1.1, 0.55);
  mesh(rbox(1.9, 0.12, 1.2, 0.03), M.steelDark, 0, 0.6, 0, g);
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) mesh(bx(0.07, 1.4, 0.07), M.steel, x, 1.3, z, g);
  const oilM = new THREE.MeshStandardMaterial({ color: 0xc98a2a, metalness: 0.3, roughness: 0.3, transparent: true, opacity: 0.9 });
  mesh(cy(0.28, 0.28, 0.6, 20), oilM, -0.35, 2.25, 0, g);
  mesh(cy(0.24, 0.24, 0.5, 20), M.white, 0.4, 2.2, 0, g);
  const bar = mesh(bx(1.3, 0.08, 0.08), M.steel, 0, 1.45, 0, g);
  const roll = mesh(cy(0.12, 0.12, 1.1, 18), M.steel, -0.55, 0.85, 0, g); roll.rotation.x = Math.PI / 2;
  const oil = new Particles(160, { color: 0xffc070, size: 0.06 });
  const salt = new Particles(120, { color: 0xffffff, size: 0.045 });
  g.add(oil.points, salt.points);
  const lamp = statusLamp(g, M, 0.8, 0.62, -0.55);
  bar.castShadow = false;
  return {
    group: g, len: 2.2, depth: 1.4, h: 2.6,
    tick(dt, t, s) {
      roll.rotation.y += dt * 3 * s.run;
      oil.update(dt, 40 * (s.v.oil ?? 1) * (0.3 + s.run), (emit) => emit(-0.5 + Math.random() * 1.0, 1.4, (Math.random() - 0.5) * 0.3, 0, -1.2, 0, 0.6));
      salt.update(dt, 300 * (s.v.salt ?? 0.06) * (0.3 + s.run), (emit) => emit(-0.3 + Math.random() * 0.9, 1.4, (Math.random() - 0.5) * 0.4, 0, -1.6, 0, 0.5));
      setLamp(lamp, s.util, t);
    },
  };
};

B.metal = (M) => {
  const g = new THREE.Group();
  mesh(rbox(0.5, 1.4, 1.5, 0.05), M.paintLight, 0, 0.7, 0, g);
  const hole = mesh(bx(0.52, 0.45, 1.1), M.rubber, 0, BELT_Y + 0.1, 0, g); hole.castShadow = false;
  const ringM = M.accent.clone();
  const ring = mesh(geo('mdRing', () => new THREE.TorusGeometry(0.42, 0.03, 8, 40)), ringM, 0.27, BELT_Y + 0.12, 0, g);
  ring.rotation.y = Math.PI / 2; ring.scale.set(1, 0.65, 1.4);
  const lamp = statusLamp(g, M, 0, 1.4, 0.5);
  return {
    group: g, len: 1.0, depth: 1.6, h: 1.9,
    tick(dt, t, s) { ringM.emissiveIntensity = 1 + 2.5 * (0.5 + 0.5 * Math.sin(t * 5)); setLamp(lamp, s.util, t); },
  };
};

B.feeder = (M) => {
  const g = new THREE.Group();
  mesh(rbox(1.3, 0.5, 1.1, 0.04), M.paint, 0, 0.25, 0, g);
  const stack = new THREE.Group(); g.add(stack);
  const sheetM = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.4, metalness: 0.2 });
  for (let k = 0; k < 18; k++) mesh(bx(0.7, 0.025, 0.7), sheetM, -0.1, 0.52 + k * 0.03, 0, stack);
  for (const z of [-0.45, 0.45]) mesh(bx(0.08, 1.6, 0.08), M.steel, 0.35, 0.8, z, g);
  mesh(bx(0.1, 0.1, 1.0), M.steel, 0.35, 1.6, 0, g);
  const head = new THREE.Group(); head.position.set(0.1, 1.35, 0); g.add(head);
  mesh(bx(0.05, 0.4, 0.05), M.steelDark, 0, 0, 0, head);
  mesh(cy(0.12, 0.12, 0.05, 16), M.accent, 0, -0.22, 0, head);
  const lamp = statusLamp(g, M, -0.55, 0.5, -0.45);
  return {
    group: g, len: 1.6, depth: 1.4, h: 1.8,
    tick(dt, t, s) { head.position.y = 1.2 + 0.18 * Math.sin(t * (2 + 3 * s.run)); setLamp(lamp, s.util, t); },
  };
};

// ---------- reject stations (이물 제거 · 불량 배출) ----------
// A red bin on the front side; rejected items are thrown into it by the twin (r.bin = landing point).
function rejectBin(g, M, x, z) {
  const bin = new THREE.Group(); bin.position.set(x, 0, z); g.add(bin);
  const red = new THREE.MeshStandardMaterial({ color: 0xc8303f, roughness: 0.55, metalness: 0.1, emissive: 0x3a0610, emissiveIntensity: 0.6 });
  const W = 0.72, D = 0.56, H = 0.42, t = 0.04;
  mesh(bx(W, t, D), red, 0, t / 2, 0, bin);
  mesh(bx(W, H, t), red, 0, H / 2, -D / 2, bin);
  mesh(bx(W, H, t), red, 0, H / 2, D / 2, bin);
  mesh(bx(t, H, D), red, -W / 2, H / 2, 0, bin);
  mesh(bx(t, H, D), red, W / 2, H / 2, 0, bin);
  mesh(bx(W * 0.7, 0.07, 0.012), M.white, 0, H * 0.6, D / 2 + 0.012, bin).castShadow = false;
  const fill = mesh(bx(W - 2 * t - 0.01, 1, D - 2 * t - 0.01), new THREE.MeshStandardMaterial({ color: 0x2b2f2a, roughness: 0.95 }), 0, 0, 0, bin);
  fill.castShadow = false;
  let level = 0.18;
  const set = () => { const hh = Math.max(0.005, level * (H - 0.06)); fill.scale.y = hh; fill.position.y = t + hh / 2; };
  set();
  return {
    land: new THREE.Vector3(x, H * 0.55, z),
    add() { level += 0.05; if (level > 1) level = 0.15; set(); },   // emptied when full
  };
}
function chute(g, M, x, z0, z1, y0, y1) {
  const len = Math.hypot(z1 - z0, y1 - y0);
  const c = mesh(bx(0.42, 0.03, len), M.steel, x, (y0 + y1) / 2, (z0 + z1) / 2, g);
  c.rotation.x = Math.atan2(y0 - y1, z1 - z0);
  for (const s of [-1, 1]) { const w = mesh(bx(0.03, 0.1, len), M.steel, s * 0.2, 0.05, 0, c); w.castShadow = false; }
}

B.foreign = (M) => {
  const g = new THREE.Group();
  legs(g, M, 1.8, 0.9, 0.5);
  mesh(rbox(1.8, 0.08, 0.95, 0.02), M.steelDark, 0, 0.5, 0, g);
  for (const x of [-0.68, 0.68]) for (const z of [-0.5, 0.5]) mesh(bx(0.06, 0.62, 0.06), M.steel, x, BELT_Y + 0.28, z, g);
  mesh(rbox(1.55, 0.5, 1.12, 0.06), M.paintLight, 0, BELT_Y + 0.82, 0, g);
  mesh(bx(1.3, 0.05, 0.02), M.accent, 0, BELT_Y + 0.72, 0.57, g).castShadow = false;
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const scan = mesh(geo('scanLine', () => { const p = new THREE.PlaneGeometry(0.05, 0.95); p.rotateX(-Math.PI / 2); return p; }), scanMat, 0, BELT_Y + 0.08, 0, g);
  scan.castShadow = false;
  const bar = mesh(bx(0.08, 0.08, 0.5), M.steel, 0.62, BELT_Y + 0.12, -0.56, g); bar.castShadow = false;
  for (const dx of [-0.12, 0, 0.12]) { const n = mesh(cy(0.02, 0.04, 0.12, 8), M.steelDark, 0.62 + dx, BELT_Y + 0.12, -0.36, g); n.rotation.x = Math.PI / 2; }
  chute(g, M, 0.62, 0.36, 0.98, BELT_Y - 0.02, 0.44);
  const bin = rejectBin(g, M, 0.62, 1.2);
  const puff = new Particles(90, { color: 0xdff6ff, size: 0.12 });
  g.add(puff.points);
  const lamp = statusLamp(g, M, -0.82, 0.5, -0.45);
  let puffT = 0;
  return {
    group: g, len: 2.0, depth: 1.5, h: 1.75, bin: bin.land,
    reject() { puffT = 0.22; bin.add(); },
    tick(dt, t, s) {
      scan.position.x = Math.sin(t * (3 + 2 * s.run)) * 0.62;
      scanMat.opacity = 0.35 + 0.3 * (s.v.fsens ?? 85) / 100;
      puff.update(dt, puffT > 0 ? 160 : 0, (emit) => emit(0.62 + (Math.random() - 0.5) * 0.25, BELT_Y + 0.13, -0.3, (Math.random() - 0.5) * 0.3, 0.15, 1.4 + Math.random() * (s.v.air ?? 4) * 0.3, 0.3), 0, 1.5);
      puffT -= dt;
      setLamp(lamp, s.util, t);
    },
  };
};

B.defect = (M) => {
  const g = new THREE.Group();
  for (const z of [-0.78, 0.78]) mesh(bx(0.1, 1.75, 0.1), M.steelDark, -0.32, 0.88, z, g);
  mesh(bx(0.2, 0.15, 1.75), M.paint, -0.32, 1.78, 0, g);
  mesh(rbox(0.32, 0.26, 0.32, 0.04), M.panel, -0.32, 1.56, 0, g);
  mesh(cy(0.07, 0.07, 0.1, 16), M.accent, -0.32, 1.4, 0, g);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x8fd46b, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const fan = mesh(geo('laserFan2', () => new THREE.ConeGeometry(0.42, 0.75, 3, 1, true)), laserMat, -0.32, 1.0, 0, g);
  fan.scale.set(1, 1, 0.05); fan.rotation.z = Math.PI; fan.castShadow = false;
  const cylM = mesh(cy(0.08, 0.08, 0.45, 14), M.steel, 0.38, BELT_Y + 0.1, -0.82, g); cylM.rotation.x = Math.PI / 2;
  const rod = mesh(cy(0.025, 0.025, 0.42, 8), M.steelDark, 0.38, BELT_Y + 0.1, -0.5, g); rod.rotation.x = Math.PI / 2;
  const paddle = mesh(bx(0.34, 0.12, 0.04), M.yellow, 0.38, BELT_Y + 0.1, -0.36, g);
  chute(g, M, 0.38, 0.36, 0.98, BELT_Y - 0.02, 0.44);
  const bin = rejectBin(g, M, 0.38, 1.2);
  const lamp = statusLamp(g, M, -0.32, 1.85, 0.55);
  let push = 0;
  return {
    group: g, len: 1.6, depth: 1.8, h: 2.0, bin: bin.land,
    reject() { push = 1; bin.add(); },
    tick(dt, t, s) {
      push = Math.max(0, push - dt * 3.5);
      const e = Math.sin(Math.PI * Math.min(1, push)) ;
      paddle.position.z = -0.36 + e * 0.5; rod.position.z = -0.5 + e * 0.25;
      fan.position.x = -0.32 + Math.sin(t * 3) * 0.08;
      laserMat.opacity = 0.3 + 0.2 * Math.abs(Math.sin(t * 9));
      setLamp(lamp, s.util, t);
    },
  };
};

export const BUILDERS = B;

export function buildMachine(type, M) {
  const f = B[type] || B.packer;
  const r = f(M);
  r.group.traverse((o) => { if (o.isMesh) o.userData.pickable = true; });
  return r;
}

// ======================================================================
// Sea scene pieces (stage 2)
// ======================================================================
export function seaWater(hue, color = 0x0a2a3c) {
  const g = new THREE.PlaneGeometry(80, 60, 160, 120);
  g.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.15, envMapIntensity: 0.9, emissive: new THREE.Color(hue).multiplyScalar(0.02) });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        float wv(vec2 p){ return sin(p.x*0.55+uTime*0.9)*0.07 + sin(p.y*0.8+uTime*1.3)*0.05 + sin((p.x+p.y)*1.7+uTime*2.1)*0.02; }`)
      .replace('#include <beginnormal_vertex>', `
        vec2 pp = position.xz;
        float e = 0.05;
        float hx = wv(pp + vec2(e,0.0)) - wv(pp - vec2(e,0.0));
        float hz = wv(pp + vec2(0.0,e)) - wv(pp - vec2(0.0,e));
        vec3 objectNormal = normalize(vec3(-hx/(2.0*e), 1.0, -hz/(2.0*e)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.y += wv(position.xz);`);
  };
  const water = new THREE.Mesh(g, mat);
  water.receiveShadow = true;
  water.userData.uniforms = uniforms;
  return water;
}

export function waveHeight(x, z, t) {
  return Math.sin(x * 0.55 + t * 0.9) * 0.07 + Math.sin(z * 0.8 + t * 1.3) * 0.05 + Math.sin((x + z) * 1.7 + t * 2.1) * 0.02;
}

export function boatModel(M, { len = 3.2, color = 0xe9edf1, accent = true } = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, -0.55); shape.lineTo(len / 2 - 0.6, -0.55); shape.quadraticCurveTo(len / 2 + 0.3, 0, len / 2 - 0.6, 0.55); shape.lineTo(-len / 2, 0.55); shape.closePath();
  const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  hg.rotateX(-Math.PI / 2); hg.translate(0, -0.25, 0);
  const hull = mesh(hg, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 }), 0, 0, 0, g);
  hull.userData.ownGeo = true;
  mesh(bx(len - 0.4, 0.06, 1.0), M.navy, -0.1, 0.32, 0, g);
  mesh(rbox(0.8, 0.7, 0.8, 0.06), M.white, -len / 2 + 0.75, 0.68, 0, g);
  mesh(bx(0.82, 0.18, 0.82), M.navy, -len / 2 + 0.75, 1.1, 0, g);
  mesh(cy(0.03, 0.03, 0.8, 6), M.steelDark, -len / 2 + 0.75, 1.55, 0, g);
  if (accent) mesh(sp(0.06, 10), M.accent, -len / 2 + 0.75, 1.95, 0, g).castShadow = false;
  return g;
}
