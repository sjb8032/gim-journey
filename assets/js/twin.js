// Digital-twin viewport: one WebGL renderer reused across the six stages.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildMachine, makeMaterials, Particles, BELT_Y, seaWater, waveHeight, boatModel, softTexture } from './machines.js';

const INK = 0x06090f;
const ST_COL = { n: new THREE.Color(0x4a5a70), w: new THREE.Color(0xffc94a), c: new THREE.Color(0xff4d61) };

const LOOKS = {
  seed: (k) => (k <= 3 ? { s: [0.34, 0.12, 0.3], c: 0x5b4a8a } : k === 4 ? { s: [0.58, 0.3, 0.3], c: 0x7b58c2 } : { s: [0.58, 0.3, 0.3], c: 0xa6c3e8 }),
  auction: (k, it) => ({ s: [0.52, 0.4, 0.44], c: k <= 2 ? 0x2d5fae : it.alt ? 0x3f7ad6 : 0x24508f }),
  primary: (k) => (k <= 2 ? { s: [0.42, 0.2, 0.42], c: 0x4a2f3d } : k === 3 ? { s: [0.32, 0.1, 0.32], c: 0x3b2a30 } : k <= 5 ? { s: [0.6, 0.035, 0.6], c: 0x2b3329 } : k <= 7 ? { s: [0.58, 0.025, 0.58], c: 0x0f1315 } : { s: [0.62, 0.22, 0.62], c: 0x1b2024 }),
  secondary: (k) => (k <= 1 ? { s: [0.6, 0.025, 0.6], c: 0x111517 } : k === 2 ? { s: [0.6, 0.03, 0.6], c: 0x1f3d24 } : k <= 4 ? { s: [0.6, 0.035, 0.6], c: 0x3c6a2e } : k <= 6 ? { s: [0.3, 0.05, 0.4], c: 0x4a7a33 } : { s: [0.38, 0.12, 0.28], c: 0xe6d3a3 }),
  distribution: (k, it) => ({ s: [0.5, 0.38, 0.5], c: k >= 3 && it.alt ? 0xefdcae : 0xc19a62 }),
};

function gridTexture(hue) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const col = new THREE.Color(hue);
  const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
  g.strokeStyle = `rgba(${rgb},0.10)`; g.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 256); g.stroke(); g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(256, i + 0.5); g.stroke(); }
  g.strokeStyle = `rgba(${rgb},0.22)`; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0.75, 0); g.lineTo(0.75, 256); g.moveTo(0, 0.75); g.lineTo(256, 0.75); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backdrop(hue) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const col = new THREE.Color(hue);
  const grd = g.createRadialGradient(256, 190, 10, 256, 256, 380);
  grd.addColorStop(0, `rgba(${(col.r * 60) | 0},${(col.g * 60 + 10) | 0},${(col.b * 70 + 18) | 0},1)`);
  grd.addColorStop(0.55, '#0a0f17');
  grd.addColorStop(1, '#05080d');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beltTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9aa6b3'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#7f8b98'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 5, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function outlineGeo(w, d, th = 0.06, r = 0.18) {
  const rr = (s, W, D, R) => {
    s.moveTo(-W / 2 + R, -D / 2); s.lineTo(W / 2 - R, -D / 2); s.quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + R);
    s.lineTo(W / 2, D / 2 - R); s.quadraticCurveTo(W / 2, D / 2, W / 2 - R, D / 2); s.lineTo(-W / 2 + R, D / 2);
    s.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - R); s.lineTo(-W / 2, -D / 2 + R); s.quadraticCurveTo(-W / 2, -D / 2, -W / 2 + R, -D / 2);
  };
  const s = new THREE.Shape(); rr(s, w, d, r);
  const h = new THREE.Path(); rr(h, w - th * 2, d - th * 2, Math.max(0.02, r - th)); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-Math.PI / 2);
  return g;
}

export class Twin {
  constructor(host, { onSelect } = {}) {
    this.host = host;
    this.onSelect = onSelect;
    this.quality = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760 ? 'low' : 'high';
    this.clock = new THREE.Clock();
    this.t = 0;
    this.running = false;
    this.ok = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      this.ok = false;
      host.insertAdjacentHTML('beforeend', '<div class="twin-fallback">이 기기에서는 3D(WebGL)를 켤 수 없어 공정 흐름도와 지표만 표시합니다.</div>');
      return;
    }
    const r = this.renderer;
    r.domElement.className = 'gl';
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.prepend(r.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'labels';
    host.append(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    this.camera.position.set(8, 10, 16);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 70;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => { this.userMoved = true; this.cancelCam?.(); });

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.9);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindPointer();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.applyQuality();

    const draco = new DRACOLoader(); draco.setDecoderPath('assets/vendor/three/addons/libs/draco/gltf/');
    this.gltf = new GLTFLoader(); this.gltf.setDRACOLoader(draco); this.gltf.setMeshoptDecoder(MeshoptDecoder);

    this.fps = { acc: 0, frames: 0, low: 0 };
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); else if (this.wantRun) this.start(); });
    r.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.stop(); });
  }

  // ---------------------------------------------------------------- setup
  resize() {
    if (!this.ok) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.fitInfo && !this.userMoved) this.fitView(false);
  }

  applyQuality() {
    const hi = this.quality === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1.25));
    this.renderer.shadowMap.enabled = hi;
    this.bloom.enabled = hi;
    this.resize();
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  setQuality(q) { this.quality = q; this.applyQuality(); }

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (moved > 6) return;
      const id = this.pick(e);
      if (id) this.onSelect?.(id, 'twin');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      const now = performance.now();
      if (now - (this._lastHover || 0) < 60) return;
      this._lastHover = now;
      const id = this.pick(e);
      el.style.cursor = id ? 'pointer' : 'grab';
      if (id !== this.hoverId) {
        if (this.hoverId) this.items3d?.[this.hoverId]?.label.classList.remove('hover');
        this.hoverId = id;
        if (id) this.items3d?.[id]?.label.classList.add('hover');
      }
    });
    el.addEventListener('dblclick', () => this.fitView(true));
  }

  pick(e) {
    if (!this.pickables?.length) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.machineId) o = o.parent;
    return o?.userData.machineId || null;
  }

  // ---------------------------------------------------------------- scene
  clear() {
    this.cancelCam?.();
    const disposeMat = (m) => { for (const k of ['map', 'emissiveMap']) if (m[k] && m[k] !== this.envTex) m[k].dispose?.(); m.dispose?.(); };
    this.scene.traverse((o) => {
      if (o.isCSS2DObject) o.element.remove();
      if (o.geometry && (o.userData.ownGeo || !o.geometry.parameters || o.isPoints || o.isInstancedMesh)) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(disposeMat);
    });
    this.scene.clear();
    this.labelRenderer.domElement.innerHTML = '';
    this.items3d = {}; this.pickables = []; this.ticks = []; this.belts = []; this.flowItems = null;
    this.selected = null; this.hoverId = null;
  }

  load(stage) {
    if (!this.ok) return;
    this.clear();
    this.stage = stage;
    this.userMoved = false;
    const hue = new THREE.Color(stage.hue);
    const M = (this.M = makeMaterials(stage.hue));
    const sc = this.scene;
    sc.background = backdrop(stage.hue);
    sc.environment = this.envTex;
    sc.fog = new THREE.FogExp2(0x070b12, stage.layout === 'sea' ? 0.016 : 0.022);

    const hemi = new THREE.HemisphereLight(0x9fb8ff, 0x0b0f16, 0.55);
    const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
    key.position.set(9, 16, 10); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(hue, 1.6); rim.position.set(-10, 6, -12);
    this.rim = rim; this.rimBase = hue.clone();
    sc.add(hemi, key, rim, key.target);
    this.key = key;

    if (stage.layout === 'sea') this.buildSea(stage, M);
    else this.buildLine(stage, M);

    // AI scan plane
    const scanMat = new THREE.MeshBasicMaterial({ color: hue.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), scanMat);
    this.scanPlane.userData.ownGeo = true;
    this.scanPlane.rotation.y = Math.PI / 2;
    this.scanPlane.visible = false;
    sc.add(this.scanPlane);

    this.loadHero(stage);
    this.fitView(false, true);
  }

  registerMachine(def, r, group, labelY) {
    group.userData.machineId = def.id;
    group.traverse((o) => { if (o.isMesh && o.userData.pickable !== false) this.pickables.push(o); });
    const el = document.createElement('div');
    el.className = 'm-label';
    el.innerHTML = `<span class="d"></span><b>${def.name}</b><span class="u">—</span><span class="x"></span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); this.onSelect?.(def.id, 'label'); });
    const lbl = new CSS2DObject(el);
    lbl.position.set(0, labelY, 0);
    lbl.center.set(0.5, 1);
    group.add(lbl);
    this.items3d[def.id] = { id: def.id, def, r, group, label: el, labelObj: lbl, state: { util: 0, run: 0.5, v: {} } };
    if (r.tick) this.ticks.push((dt, t) => r.tick(dt, t, this.items3d[def.id].state));
  }

  buildLine(stage, M) {
    const sc = this.scene;
    const ms = stage.machines.map((def) => ({ def, r: buildMachine(def.type, M) }));
    const two = ms.length > 5;
    const nA = two ? Math.ceil(ms.length / 2) : ms.length;
    const gap = 1.25;
    const rowZ = two ? [-2.7, 2.7] : [0];
    const rows = [ms.slice(0, nA), ms.slice(nA)];
    const rowLen = rows.map((row) => row.reduce((s, m) => s + m.r.len, 0) + gap * Math.max(0, row.length - 1));
    const maxLen = Math.max(...rowLen);
    const path = [];
    rows.forEach((row, ri) => {
      if (!row.length) return;
      const dir = ri === 0 ? 1 : -1;
      let x = dir * (-rowLen[ri] / 2);
      const z = rowZ[ri];
      if (ri === 0) path.push(new THREE.Vector3(x - 1.6 * dir, BELT_Y, z));
      else {
        const turnX = maxLen / 2 + 1.5;
        path.push(new THREE.Vector3(turnX, BELT_Y, rowZ[0]), new THREE.Vector3(turnX, BELT_Y, z));
      }
      for (const m of row) {
        const cx = x + dir * m.r.len / 2;
        m.r.group.position.set(cx, 0, z);
        if (dir < 0) m.r.group.scale.x = -1;   // mirror so the machine front still faces the camera
        sc.add(m.r.group);
        m.pathIndex = path.length;
        path.push(new THREE.Vector3(cx, BELT_Y, z));
        x += dir * (m.r.len + gap);
      }
      if (ri === rows.length - 1 || !rows[1].length) path.push(new THREE.Vector3(x - dir * gap + dir * 1.6, BELT_Y, z));
    });
    if (two && rows[1].length === 0) path.pop();

    // platform
    const bbox = new THREE.Box3();
    for (const m of ms) {
      const p = m.r.group.position;
      bbox.expandByPoint(new THREE.Vector3(p.x - m.r.len / 2, 0, p.z - m.r.depth / 2));
      bbox.expandByPoint(new THREE.Vector3(p.x + m.r.len / 2, m.r.h, p.z + m.r.depth / 2));
    }
    for (const p of path) bbox.expandByPoint(p);
    const size = bbox.getSize(new THREE.Vector3()), center = bbox.getCenter(new THREE.Vector3());
    const port = stage.env === 'port';
    const PW = size.x + 3.2;
    const back = bbox.min.z - 1.5, front = port ? 1.7 : bbox.max.z + 1.5;
    const PD = front - back;
    const pz = (front + back) / 2;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.36, PD), new THREE.MeshStandardMaterial({ color: 0x0e141d, roughness: 0.92, metalness: 0.1 }));
    plat.userData.ownGeo = true;
    plat.position.set(center.x, -0.18, pz); plat.receiveShadow = true;
    sc.add(plat);
    const grid = gridTexture(stage.hue); grid.repeat.set(PW / 2, PD / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({ map: grid, transparent: true, depthWrite: false }));
    top.userData.ownGeo = true; top.rotation.x = -Math.PI / 2; top.position.set(center.x, 0.003, pz);
    sc.add(top);
    const edge = new THREE.Mesh(outlineGeo(PW, PD, 0.05, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(stage.hue).multiplyScalar(1.8) }));
    edge.userData.ownGeo = true; edge.position.set(center.x, 0.006, pz);
    sc.add(edge);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: 1, metalness: 0 }));
    floor.userData.ownGeo = true; floor.rotation.x = -Math.PI / 2; floor.position.y = -0.37; floor.receiveShadow = true;
    sc.add(floor);
    if (port) {
      const water = seaWater(stage.hue);
      water.geometry.dispose();
      water.geometry = new THREE.PlaneGeometry(PW + 30, 14, 120, 40); water.geometry.rotateX(-Math.PI / 2);
      water.userData.ownGeo = true;
      water.position.set(center.x, -0.22, front + 7);
      water.material.envMapIntensity = 0.3;
      sc.add(water);
      this.ticks.push((dt, t) => { water.userData.uniforms.uTime.value = t; });
    }
    this.key.shadow.camera.left = -PW / 2 - 2; this.key.shadow.camera.right = PW / 2 + 2;
    this.key.shadow.camera.top = PD / 2 + 4; this.key.shadow.camera.bottom = -PD / 2 - 4;
    this.key.target.position.copy(center); this.key.position.set(center.x + 9, 16, center.z + 10);
    this.key.shadow.camera.updateProjectionMatrix();

    // belts along the path
    const beltTex = beltTexture();
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const len = a.distanceTo(b);
      if (len < 0.05) continue;
      const tex = beltTex.clone(); tex.needsUpdate = true; tex.repeat.set(len / 0.5, 1);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 });
      const belt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.64), mat);
      belt.userData.ownGeo = true;
      belt.position.copy(a).lerp(b, 0.5); belt.position.y = BELT_Y - 0.06;
      belt.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      belt.receiveShadow = true;
      sc.add(belt);
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.05), M.steel);
        rail.userData.ownGeo = true;
        rail.position.set(0, 0.04, side * 0.34); belt.add(rail);
      }
      const nLegs = Math.max(1, Math.floor(len / 1.6));
      for (let k = 0; k <= nLegs; k++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, BELT_Y - 0.06, 0.06), M.steelDark);
        leg.userData.ownGeo = true;
        leg.position.set(-len / 2 + (k / nLegs) * len, -(BELT_Y - 0.06) / 2, 0.28); belt.add(leg);
      }
      this.belts.push({ mat, tex, dir: 1 });
    }

    // machines: outlines + labels + beacons
    for (const m of ms) {
      const og = new THREE.Mesh(outlineGeo(m.r.len + 0.25, m.r.depth + 0.25), new THREE.MeshBasicMaterial({ color: ST_COL.n.clone(), transparent: true, opacity: 0.9 }));
      og.userData.ownGeo = true; og.userData.pickable = false;
      og.position.y = 0.012;
      m.r.group.add(og);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4d61).multiplyScalar(2.2), transparent: true, opacity: 0.85 }));
      beacon.userData.ownGeo = true; beacon.userData.pickable = false; beacon.visible = false;
      m.r.group.add(beacon);
      this.registerMachine(m.def, m.r, m.r.group, m.r.h + 0.35);
      Object.assign(this.items3d[m.def.id], { outline: og, beacon, pathIndex: m.pathIndex });
    }

    // flowing items
    this.path = path;
    this.cum = [0];
    for (let i = 1; i < path.length; i++) this.cum.push(this.cum[i - 1] + path[i].distanceTo(path[i - 1]));
    this.pathLen = this.cum[this.cum.length - 1];
    this.mPos = ms.map((m) => this.cum[m.pathIndex]);
    const MAX = 280;
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 }), MAX);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = true; im.frustumCulled = false; im.userData.pickable = false;
    im.setColorAt(0, new THREE.Color(0));
    sc.add(im);
    const sparks = new Particles(200, { color: 0xff5a6a, size: 0.12 });
    sc.add(sparks.points);
    this.flowItems = { im, items: [], MAX, acc: 0, look: LOOKS[stage.key] || LOOKS.distribution, sparks, tmpM: new THREE.Matrix4(), tmpC: new THREE.Color(), q: new THREE.Quaternion(), sv: new THREE.Vector3(), pv: new THREE.Vector3() };
    this.fitInfo = { box: bbox.clone().expandByVector(new THREE.Vector3(1, 0, 1)), dir: new THREE.Vector3(0.18, 0.62, 1).normalize() };
    if (port) this.fitInfo.box.expandByPoint(new THREE.Vector3(center.x, 0, front + 2.4));
  }

  buildSea(stage, M) {
    const sc = this.scene;
    const water = seaWater(stage.hue);
    water.userData.ownGeo = true;
    sc.add(water);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x03070c }));
    bed.userData.ownGeo = true; bed.rotation.x = -Math.PI / 2; bed.position.y = -3; sc.add(bed);
    this.key.shadow.camera.left = -20; this.key.shadow.camera.right = 20; this.key.shadow.camera.top = 16; this.key.shadow.camera.bottom = -16;
    this.key.shadow.camera.updateProjectionMatrix();
    this.ticks.push((dt, t) => { water.userData.uniforms.uTime.value = t; });

    const rowsN = 7, L = 22;
    const sea = (this.sea = { rowsN, L, rowZ: [], blades: [], harvestT: 0 });
    // ropes + buoys + blades
    const netGroup = new THREE.Group(); netGroup.userData.machineId = 'install'; sc.add(netGroup);
    const buoyIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.35, metalness: 0.2 }), rowsN * 17);
    const bladeGeo = new THREE.PlaneGeometry(0.12, 1); bladeGeo.translate(0, 0.5, 0); bladeGeo.rotateX(-Math.PI / 2);
    const bladeIM = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x1d2f22, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide, emissive: 0x06120a }), rowsN * 70);
    buoyIM.castShadow = true; bladeIM.receiveShadow = true;
    netGroup.add(buoyIM, bladeIM);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 0.8 });
    sea.ropes = [];
    for (let r = 0; r < rowsN; r++) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 6), ropeMat);
      rope.userData.ownGeo = true; rope.rotation.z = Math.PI / 2; netGroup.add(rope); sea.ropes.push(rope);
      for (let k = 0; k < 70; k++) sea.blades.push({ r, x: -L / 2 + 0.2 + (k / 69) * (L - 0.4) + (Math.random() - 0.5) * 0.2, g: 0.5 + Math.random() * 0.5, ph: Math.random() * 6.28, side: Math.random() < 0.5 ? -1 : 1 });
    }
    sea.buoyIM = buoyIM; sea.bladeIM = bladeIM;
    sea.layout = (gapParam) => { const gap = 1.4 + gapParam * 0.22; sea.rowZ = Array.from({ length: rowsN }, (_, r) => (r - (rowsN - 1) / 2) * gap); };
    sea.layout(5);
    // pickable proxy for the nets (invisible plane)
    const proxy = new THREE.Mesh(new THREE.PlaneGeometry(L, 12), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.userData.ownGeo = true; proxy.rotation.x = -Math.PI / 2; proxy.position.y = 0.05; netGroup.add(proxy);
    const netDef = stage.machines.find((m) => m.id === 'install');
    this.registerMachine(netDef, { tick: null }, netGroup, 1.2);
    this.items3d.install.labelObj.position.set(-6, 1.2, -6);

    // sensor buoy
    const sensor = new THREE.Group(); sensor.position.set(5.5, 0, -0.6); sc.add(sensor);
    const ybody = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.45 });
    sensor.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 20), ybody), { castShadow: true }));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), ybody); cone.position.y = 0.6; sensor.add(cone);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), M.steelDark); mast.position.y = 1.4; sensor.add(mast);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), M.accent); top.position.y = 2.15; sensor.add(top);
    [sensor.children].flat().forEach((o) => { o.userData.ownGeo = true; });
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(stage.hue).multiplyScalar(1.5), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.userData.ownGeo = true; ring.userData.pickable = false;
    sc.add(ring);
    this.registerMachine(stage.machines.find((m) => m.id === 'sensor'), { tick: null }, sensor, 2.6);

    // treatment boat
    const boat2 = new THREE.Group(); sc.add(boat2);
    boat2.add(boatModel(M, { len: 2.4, color: 0x9aa6b4 }));
    const spray = new Particles(160, { color: 0x9ff0d2, size: 0.12 }); sc.add(spray.points);
    this.registerMachine(stage.machines.find((m) => m.id === 'treat'), { tick: null }, boat2, 2.3);

    // harvest boat (hero)
    const boat = new THREE.Group(); sc.add(boat);
    const boatBody = boatModel(M, { len: 3.6 }); boat.add(boatBody);
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 16), M.steel); roller.rotation.x = Math.PI / 2; roller.position.set(1.95, 0.45, 0); roller.userData.ownGeo = true;
    boatBody.add(roller);
    const wake = new Particles(260, { color: 0xcfe8ff, size: 0.22, opacity: 0.55 }); sc.add(wake.points);
    const hr = { group: boat, body: boatBody, len: 3.6, depth: 1.3, h: 1.6 };
    this.registerMachine(stage.machines.find((m) => m.id === 'harvest'), hr, boat, 2.4);

    // dock
    const dock = new THREE.Group(); dock.position.set(-15.5, 0, 0); sc.add(dock);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 9), M.wood); deck.position.y = 0.45; deck.castShadow = deck.receiveShadow = true; dock.add(deck);
    for (const x of [-1.6, 1.6]) for (const z of [-4, -1.3, 1.3, 4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), M.steelDark); p.position.set(x, -0.4, z); dock.add(p); }
    const crane = new THREE.Group(); crane.position.set(1.0, 0.6, -2.5); dock.add(crane);
    const cm = M.yellow;
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), cm); c1.position.y = 1.3; crane.add(c1);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), cm); arm.position.set(0.9, 2.55, 0); crane.add(arm);
    const sackG = new THREE.BoxGeometry(0.5, 0.36, 0.42);
    const sacks = new THREE.InstancedMesh(sackG, new THREE.MeshStandardMaterial({ color: 0x2d5fae, roughness: 0.8 }), 36);
    sacks.castShadow = true; dock.add(sacks);
    dock.traverse((o) => { if (o.isMesh) o.userData.ownGeo = true; });
    this.registerMachine(stage.machines.find((m) => m.id === 'unload'), { tick: null }, dock, 3.6);

    Object.assign(sea, { boat, boatBody, roller, wake, boat2, spray, sensor, ring, ringMat, sacks, sackN: 0, boatPhase: 0, boat2Phase: 0.5 });
    this.fitInfo = { box: new THREE.Box3(new THREE.Vector3(-18, 0, -9), new THREE.Vector3(12, 2, 9)), dir: new THREE.Vector3(0.25, 0.7, 1).normalize() };
    this.ticks.push((dt, t) => this.tickSea(dt, t));
  }

  tickSea(dt, t) {
    const s = this.sea, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    const st = (id) => this.items3d[id]?.state || { util: 0, run: 0.5, v: {} };
    const inst = st('install'), sen = st('sensor'), har = st('harvest'), tre = st('treat'), unl = st('unload');
    if (inst.v.gap != null && inst.v.gap !== s.gapV) { s.layout(inst.v.gap); s.gapV = inst.v.gap; }
    // ropes & buoys
    let bi = 0;
    s.rowZ.forEach((z, r) => {
      s.ropes[r].position.set(0, waveHeight(0, z, t) + 0.03, z);
      for (let k = 0; k < 17; k++) {
        const x = -s.L / 2 + (k / 16) * s.L;
        pv.set(x, waveHeight(x, z, t) + 0.05, z); m.compose(pv, q.identity(), sv.set(1, 1, 1));
        s.buoyIM.setMatrixAt(bi++, m);
      }
    });
    s.buoyIM.instanceMatrix.needsUpdate = true;
    // boat path: serpentine over the rows
    const speed = (har.v.speed ?? 5) * 0.09 * (0.4 + 0.6 * har.run);
    s.boatPhase = (s.boatPhase + dt * speed / s.rowsN) % 1;
    const seg = s.boatPhase * s.rowsN, row = Math.floor(seg), f = seg - row;
    const dir = row % 2 === 0 ? 1 : -1;
    const bz = (s.rowZ[row] ?? 0) + (s.rowZ[1] - s.rowZ[0]) * 0.5;
    const bx_ = dir * (-s.L / 2 + f * s.L);
    s.boat.position.set(bx_, waveHeight(bx_, bz, t) + 0.05, bz);
    s.boat.rotation.y = dir > 0 ? 0 : Math.PI;
    s.boat.rotation.z = Math.sin(t * 1.3) * 0.03;
    s.roller.rotation.y += dt * 4;
    s.wake.update(dt, 40, (emit) => emit(bx_ - dir * 1.8, 0.1, bz + (Math.random() - 0.5) * 0.8, -dir * 0.6, 0.05, (Math.random() - 0.5) * 0.6, 1.8), 0, 0.8);
    // blades: sway, harvest near boat, regrow
    const grow = 0.02 + 0.06 * (sen.Q ?? 0.85) * (inst.Q ?? 1);
    const hy = Math.max(0.15, 1 - (har.v.height ?? 12) / 30);
    const len = 0.45 + 0.08 * ((har.v.hcycle ?? 18) / 18);
    s.blades.forEach((b, i) => {
      const z = s.rowZ[b.r];
      if (Math.abs(b.x - bx_) < 0.8 && Math.abs(z - bz) < 1.2) b.g = Math.min(b.g, hy);
      b.g = Math.min(1, b.g + grow * dt);
      const sway = Math.sin(t * 1.4 + b.ph) * 0.35;
      e.set(0, b.side > 0 ? Math.PI / 2 + sway : -Math.PI / 2 + sway, 0);
      q.setFromEuler(e);
      pv.set(b.x, waveHeight(b.x, z, t) + 0.035, z);
      sv.set(1, 1, 0.2 + b.g * len * 1.6);
      m.compose(pv, q, sv);
      s.bladeIM.setMatrixAt(i, m);
    });
    s.bladeIM.instanceMatrix.needsUpdate = true;
    // treatment boat
    s.boat2Phase = (s.boat2Phase + dt * 0.02 * (1 + tre.run)) % 1;
    const z2 = (s.rowZ[s.rowsN - 1] ?? 6) + 1.6, x2 = Math.sin(s.boat2Phase * Math.PI * 2) * (s.L / 2 - 2);
    const dx = Math.cos(s.boat2Phase * Math.PI * 2);
    s.boat2.position.set(x2, waveHeight(x2, z2, t) + 0.05, z2); s.boat2.rotation.y = dx > 0 ? 0 : Math.PI;
    s.spray.update(dt, 20 + 30 * tre.run, (emit) => emit(x2 + (Math.random() - 0.5) * 1.6, 0.9, z2 - 0.9, (Math.random() - 0.5) * 0.4, 0.2, -0.9 - Math.random() * 0.4, 1.1), -1.2, 0.2);
    // sensor ring pulse
    const p = (t * 0.6) % 1;
    s.ring.position.set(s.sensor.position.x, waveHeight(s.sensor.position.x, s.sensor.position.z, t) + 0.04, s.sensor.position.z);
    s.ring.scale.setScalar(0.6 + p * 3.2); s.ringMat.opacity = (1 - p) * 0.6;
    s.sensor.position.y = waveHeight(s.sensor.position.x, s.sensor.position.z, t) - 0.05;
    s.sensor.rotation.z = Math.sin(t * 1.1) * 0.05;
    // dock sacks
    const target = Math.round(Math.min(36, 8 + 28 * Math.min(1.2, unl.util)));
    s.sackN += (target - s.sackN) * Math.min(1, dt * 0.8);
    const n = Math.round(s.sackN);
    for (let k = 0; k < 36; k++) {
      const vis = k < n;
      pv.set(-1 + (k % 4) * 0.55, vis ? 0.78 + Math.floor(k / 12) * 0.37 : -50, 1.2 + (Math.floor(k / 4) % 3) * 0.47);
      m.compose(pv, q.identity(), sv.set(1, 1, 1));
      s.sacks.setMatrixAt(k, m);
    }
    s.sacks.instanceMatrix.needsUpdate = true;
  }

  async loadHero(stage) {
    const hero = stage.machines.find((m) => m.hero);
    const entry = window.__ASSETS?.models?.[stage.key];
    if (!hero || !entry) return;
    const pref = window.__ASSETS?.preferLocal;
    const urls = [pref && entry.local, entry.remote, !pref && entry.local].filter(Boolean);
    const token = (this.loadToken = Symbol());
    for (const url of urls) {
      try {
        const gltf = await this.gltf.loadAsync(url);
        if (token !== this.loadToken) return;
        const it = this.items3d[hero.id];
        if (!it) return;
        const obj = gltf.scene;
        const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3());
        if (sz.z > sz.x * 1.15) { obj.rotation.y = Math.PI / 2; }
        const holder = new THREE.Group(); holder.add(obj);
        const b2 = new THREE.Box3().setFromObject(holder), s2 = b2.getSize(new THREE.Vector3()), c2 = b2.getCenter(new THREE.Vector3());
        const r = it.r;
        const k = Math.min((r.len * 1.05) / s2.x, (r.depth * 1.15) / s2.z, (r.h * 1.35) / s2.y);
        obj.position.set(-c2.x, -b2.min.y, -c2.z);
        holder.scale.setScalar(k);
        obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.ownGeo = true; if (o.material) o.material.envMapIntensity = 0.9; } });
        if (r.body) r.body.visible = false;
        const container = stage.layout === 'sea' ? it.group : it.group;
        holder.position.y = stage.layout === 'sea' ? -0.15 : 0;
        container.add(holder);
        holder.traverse((o) => { if (o.isMesh) this.pickables.push(o); });
        it.heroLoaded = true;
        return;
      } catch (e) { /* try next source */ }
    }
  }

  // ---------------------------------------------------------------- state
  update(result, values) {
    if (!this.ok || !this.items3d) return;
    this.result = result;
    for (const mm of result.machines) {
      const it = this.items3d[mm.id];
      if (!it) continue;
      const vals = values[mm.id];
      it.state.util = mm.util;
      it.state.run = Math.min(1.4, mm.inFlow / Math.max(1e-6, mm.cap / mm.def.cap));
      it.state.v = { ...vals };
      it.state.Q = mm.Q;
      if (result.key === 'auction') it.state.price = result.priceKg;
      const cls = mm.util > 1 ? 'crit' : mm.util > 0.9 ? 'warn' : '';
      it.label.classList.toggle('warn', cls === 'warn');
      it.label.classList.toggle('crit', cls === 'crit');
      it.label.querySelector('.u').textContent = Math.round(mm.util * 100) + '%';
      const p0 = mm.def.params[0];
      it.label.querySelector('.x').textContent = `${p0.label} ${vals[p0.id]}${p0.unit.startsWith('%') || p0.unit.length <= 2 ? p0.unit : ' ' + p0.unit}`;
      it.status = cls;
      if (it.outline) {
        const col = it.id === this.selected ? new THREE.Color(this.stage.hue).multiplyScalar(1.6) : cls === 'crit' ? ST_COL.c : cls === 'warn' ? ST_COL.w : ST_COL.n;
        it.outline.material.color.copy(col);
      }
      if (it.beacon) {
        it.beacon.visible = mm.util > 1;
        const hgt = 0.6 + Math.min(3, (mm.util - 1) * 6);
        it.beacon.scale.y = hgt; it.beacon.position.y = it.r.h + 0.9 + hgt / 2;
      }
    }
  }

  select(id) {
    if (!this.ok || !this.items3d) return;
    this.selected = id;
    for (const [mid, it] of Object.entries(this.items3d)) {
      it.label.classList.toggle('sel', mid === id);
      if (it.outline) {
        const cls = it.status;
        it.outline.material.color.copy(mid === id ? new THREE.Color(this.stage.hue).multiplyScalar(1.6) : cls === 'crit' ? ST_COL.c : cls === 'warn' ? ST_COL.w : ST_COL.n);
      }
    }
  }

  focus(id) {
    const it = this.items3d?.[id];
    if (!it) return;
    const p = new THREE.Vector3(); it.group.getWorldPosition(p); p.y = Math.min(1.2, (it.r.h ?? 2) * 0.5 + 0.3);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    dir.y = Math.max(dir.y, 0.45); dir.normalize();
    const dist = Math.max(7, (it.r.len || 3) * 2.1 + 3);
    this.flyTo(p, p.clone().add(dir.multiplyScalar(dist)), 900);
    this.userMoved = true;
  }

  fitView(animate = true, intro = false) {
    if (!this.fitInfo) return;
    const { box, dir } = this.fitInfo;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const distW = (size.x * 0.55) / Math.tan(hfov / 2);
    const distH = (Math.max(size.z, size.y * 2) * 0.62) / Math.tan(vfov / 2);
    const dist = Math.min(80, Math.max(distW, distH, 9));
    const target = center.clone(); target.y = 0.6;
    const pos = target.clone().add(dir.clone().multiplyScalar(dist));
    this.userMoved = false;
    if (intro && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.copy(target.clone().add(dir.clone().multiplyScalar(dist * 1.8)).add(new THREE.Vector3(-dist * 0.5, dist * 0.4, 0)));
      this.controls.target.copy(target);
      this.flyTo(target, pos, 1900);
    } else if (animate) this.flyTo(target, pos, 800);
    else { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); }
  }

  flyTo(target, pos, ms) {
    this.cancelCam?.();
    const t0 = performance.now(), p0 = this.camera.position.clone(), q0 = this.controls.target.clone();
    let alive = true;
    this.cancelCam = () => { alive = false; };
    const ease = (k) => 1 - Math.pow(1 - k, 3);
    this.camAnim = (now) => {
      if (!alive) return false;
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      this.camera.position.lerpVectors(p0, pos, e);
      this.controls.target.lerpVectors(q0, target, e);
      return k < 1;
    };
  }

  scan() {
    if (!this.ok || !this.fitInfo) return;
    const box = this.fitInfo.box, size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    this.scanPlane.scale.set(size.z + 4, 6, 1);
    this.scanPlane.position.set(box.min.x - 2, 2.2, c.z);
    this.scanPlane.visible = true;
    this.scanAnim = { t0: performance.now(), from: box.min.x - 2, to: box.max.x + 2, dur: 1500, loops: 2 };
  }

  alarm(on) { this.alarmOn = on; }

  // ---------------------------------------------------------------- loop
  start() {
    this.wantRun = true;
    if (!this.ok || this.running || document.hidden) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  pause() { this.wantRun = false; this.stop(); }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    const t = this.t, now = performance.now();
    if (this.camAnim && !this.camAnim(now)) this.camAnim = null;
    this.controls.update();
    for (const f of this.ticks) f(dt, t);
    if (this.flowItems && this.result) this.tickFlow(dt, t);
    for (const b of this.belts) b.tex.offset.x -= dt * this.beltSpeed() * 2;
    if (this.scanAnim) {
      const a = this.scanAnim, k = (now - a.t0) / a.dur;
      if (k >= a.loops) { this.scanPlane.visible = false; this.scanAnim = null; }
      else {
        const f = k % 1;
        this.scanPlane.position.x = a.from + (a.to - a.from) * f;
        this.scanPlane.material.opacity = 0.35 * Math.sin(Math.PI * f);
      }
    }
    if (this.rim) {
      const target = this.alarmOn ? new THREE.Color(0xff3045) : this.rimBase;
      this.rim.color.lerp(target, Math.min(1, dt * 3));
      this.rim.intensity = this.alarmOn ? 2.2 + Math.sin(t * 5) * 0.9 : 1.6;
    }
    if (this.quality === 'high') this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    // adaptive quality
    const f = this.fps; f.acc += dt; f.frames++;
    if (f.acc > 2.5) {
      const fps = f.frames / f.acc; f.acc = 0; f.frames = 0;
      if (this.quality === 'high' && fps < 26) { f.low++; if (f.low >= 2) { this.setQuality('low'); this.onQualityDrop?.(); } } else f.low = 0;
    }
  }

  beltSpeed() {
    const r = this.result;
    if (!r) return 0.6;
    const ratio = r.flowIn / Math.max(1e-6, r.machines[0].cap / r.machines[0].def.cap);
    return 0.5 + 0.7 * Math.min(1.5, ratio);
  }

  tickFlow(dt, t) {
    const F = this.flowItems, r = this.result;
    const speed = this.beltSpeed() * 1.35;
    const ratio = r.flowIn / Math.max(1e-6, r.machines[0].cap / r.machines[0].def.cap);
    const rate = Math.min(4.5, 0.5 + 2.6 * ratio);
    F.acc += rate * dt;
    while (F.acc >= 1 && F.items.length < F.MAX) {
      F.acc -= 1;
      F.items.push({ d: 0, k: 0, alt: Math.random() < 0.45, j: (Math.random() - 0.5) * 0.18, pop: 0 });
    }
    const ms = r.machines;
    const alive = [];
    for (const it of F.items) {
      if (it.pop > 0) { it.pop -= dt * 4; if (it.pop > 0) alive.push(it); continue; }
      const prevD = it.d;
      it.d += speed * dt;
      // crossed machine positions?
      while (it.k < this.mPos.length && it.d >= this.mPos[it.k] && prevD <= this.mPos[it.k] + 1e-6) {
        const mm = ms[it.k];
        const overflowFrac = mm.inFlow > 0 ? mm.overflow / mm.inFlow : 0;
        const pLoss = Math.min(0.9, mm.loss * 1.4 + overflowFrac);
        it.k++;
        if (Math.random() < pLoss) { it.pop = 1; break; }
      }
      if (it.pop > 0) {
        const p = this.pointAt(it.d, F.pv);
        F.sparks.emit(p.x, p.y + 0.3, p.z, 0, 0.8, 0, 0.6);
        for (let n = 0; n < 4; n++) F.sparks.emit(p.x, p.y + 0.2, p.z, (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, 0.5);
        alive.push(it);
        continue;
      }
      if (it.d < this.pathLen) alive.push(it);
    }
    F.items = alive;
    F.sparks.update(dt, 0, () => {}, -2.5, 0.5);
    let i = 0;
    for (const it of F.items) {
      const p = this.pointAt(it.d, F.pv);
      const look = F.look(it.k, it);
      const sc = it.pop > 0 ? Math.max(0.01, it.pop) : 1;
      F.sv.set(look.s[0] * sc, look.s[1] * sc, look.s[2] * sc);
      F.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.dirAt(it.d));
      p.y = BELT_Y + look.s[1] / 2 * sc;
      const lateral = it.j;
      const ang = this.dirAt(it.d);
      p.x += Math.sin(ang) * lateral; p.z += Math.cos(ang) * lateral;
      F.tmpM.compose(p, F.q, F.sv);
      F.im.setMatrixAt(i, F.tmpM);
      F.im.setColorAt(i, F.tmpC.setHex(it.pop > 0 ? 0xff4d61 : look.c));
      i++;
    }
    F.im.count = i;
    F.im.instanceMatrix.needsUpdate = true;
    if (F.im.instanceColor) F.im.instanceColor.needsUpdate = true;
  }

  pointAt(d, out) {
    const c = this.cum, P = this.path;
    let i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    const seg = c[i] - c[i - 1] || 1;
    const f = Math.min(1, Math.max(0, (d - c[i - 1]) / seg));
    return out.copy(P[i - 1]).lerp(P[i], f);
  }
  dirAt(d) {
    const c = this.cum, P = this.path;
    let i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    return -Math.atan2(P[i].z - P[i - 1].z, P[i].x - P[i - 1].x);
  }
}
