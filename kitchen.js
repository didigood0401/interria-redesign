import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.getElementById('stage');
const form = document.getElementById('ctl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- price + date (works without WebGL too) ---------- */
const RATE = { matte: 42000, gloss: 48000, wood: 52000, plum: 50000 };
const FAC_NAME = { matte: 'матовый', gloss: 'глянцевый', wood: 'под дерево', plum: 'цветной' };
const SHAPE_NAME = { line: 'прямая', l: 'угловая', u: 'П-образная', island: 'с островом' };
const SIDE = 1.8;
const fmt = n => n.toLocaleString('ru-RU').replace(/,/g, ' ');
function state() {
  const f = new FormData(form);
  return { shape: f.get('shape'), len: +f.get('len'), fac: f.get('fac') };
}
function meters(s) {
  let m = s.len;
  if (s.shape === 'l' || s.shape === 'island') m += SIDE;
  if (s.shape === 'u') m += SIDE * 2;
  if (s.shape === 'island') m += SIDE * 0.9;
  return m;
}
function updateText(s) {
  document.getElementById('lv').textContent = String(s.len).replace('.', ',') + ' м';
  const t = meters(s) * RATE[s.fac];
  const lo = Math.round(t * 0.9 / 5000) * 5000, hi = Math.round(t * 1.15 / 5000) * 5000;
  document.getElementById('pr').textContent = `${fmt(lo)} - ${fmt(hi)} ₽`;
  const d = new Date(); d.setDate(d.getDate() + 2 + 21);
  const ds = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  document.getElementById('dt').textContent = `${meters(s).toFixed(1).replace('.', ',')} погонных метра. Если заказать сегодня - монтаж до ${ds}.`;
  const body = `Здравствуйте! Хочу рассчитать кухню: ${SHAPE_NAME[s.shape]}, основная стена ${String(s.len).replace('.', ',')} м, фасад ${FAC_NAME[s.fac]}.`;
  document.getElementById('go').href = `mailto:mail@interria.ru?subject=${encodeURIComponent('Расчёт кухни')}&body=${encodeURIComponent(body)}`;
}

/* ---------- 3D ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 16 / 10, 0.1, 60);
let controls, kitchen = new THREE.Group(), tweens = [], running = true;

if (renderer) {
  document.getElementById('fb').remove();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Интерактивная 3D-модель кухни');
  renderer.domElement.setAttribute('role', 'img');

  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color('#2a2826');

  scene.add(new THREE.HemisphereLight(0xfff4e8, 0x3a332c, 0.35));
  const sun = new THREE.DirectionalLight(0xfff1e0, 2.2);
  sun.position.set(5, 7, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 25 });
  sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
  scene.add(sun);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minPolarAngle = 0.9; controls.maxPolarAngle = 1.45;
  controls.minAzimuthAngle = -0.15; controls.maxAzimuthAngle = 1.1;
  controls.minDistance = 4; controls.maxDistance = 11;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });

  scene.add(kitchen);
}

/* materials */
function woodTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9a7b5f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512, w = 0.6 + Math.random() * 2.2;
    g.strokeStyle = `rgba(${70 + Math.random() * 40},${45 + Math.random() * 25},${25 + Math.random() * 15},${0.06 + Math.random() * 0.14})`;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin(y / 70 + x) * 3, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const M = {};
function mats() {
  M.matte = new THREE.MeshStandardMaterial({ color: '#b5ab9d', roughness: 0.8, metalness: 0 });
  M.gloss = new THREE.MeshPhysicalMaterial({ color: '#e6e1d9', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
  M.wood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.7 });
  M.plum = new THREE.MeshStandardMaterial({ color: '#5e2433', roughness: 0.55 });
  M.carcass = new THREE.MeshStandardMaterial({ color: '#8f877c', roughness: 0.9 });
  M.plinth = new THREE.MeshStandardMaterial({ color: '#2b2927', roughness: 0.9 });
  M.top = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.35, metalness: 0.05 });
  M.splash = new THREE.MeshStandardMaterial({ color: '#e9e5de', roughness: 0.25 });
  M.wall = new THREE.MeshStandardMaterial({ color: '#cbc3b8', roughness: 0.95 });
  M.floor = new THREE.MeshStandardMaterial({ color: '#b3a491', roughness: 0.7 });
  M.hob = new THREE.MeshStandardMaterial({ color: '#0f0f10', roughness: 0.15, metalness: 0.3 });
  M.steel = new THREE.MeshStandardMaterial({ color: '#9a9a98', roughness: 0.3, metalness: 0.9 });
  M.led = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffe2b0', emissiveIntensity: 2.2 });
  M.glass = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.1, metalness: 0.4 });
}

const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; };

/* one base module of width w, local origin at back-left-bottom, facing +z */
function baseModule(w, fac, kind) {
  const g = new THREE.Group();
  const plinth = box(w, 0.1, 0.52, M.plinth); plinth.position.set(w / 2, 0.05, 0.26); g.add(plinth);
  const car = box(w, 0.72, 0.58, M.carcass); car.position.set(w / 2, 0.46, 0.29); g.add(car);
  const rows = kind === 'drawers' ? [0.22, 0.24, 0.24] : kind === 'oven' ? [0.14, 0.56] : [0.7];
  let y = 0.1;
  rows.forEach((h, i) => {
    const isOven = kind === 'oven' && i === 1;
    const f = box(w - 0.006, h - 0.006, 0.02, isOven ? M.glass : M[fac]);
    f.position.set(w / 2, y + h / 2, 0.59); f.userData.fac = !isOven; g.add(f);
    y += h;
  });
  return g;
}
function upperModule(w, fac) {
  const g = new THREE.Group();
  const c = box(w, 0.72, 0.33, M.carcass); c.position.set(w / 2, 1.46 + 0.36, 0.165); g.add(c);
  const f = box(w - 0.006, 0.716, 0.02, M[fac]); f.position.set(w / 2, 1.46 + 0.36, 0.34); f.userData.fac = true; g.add(f);
  const led = box(w - 0.04, 0.008, 0.02, M.led); led.position.set(w / 2, 1.455, 0.29); led.castShadow = false; g.add(led);
  return g;
}
function tallModule(w, fac) {
  const g = new THREE.Group();
  const c = box(w, 2.08, 0.58, M.carcass); c.position.set(w / 2, 1.14, 0.29); g.add(c);
  [[0.1, 1.2], [1.3, 0.88]].forEach(([y, h]) => {
    const f = box(w - 0.006, h - 0.006, 0.02, M[fac]); f.position.set(w / 2, y + h / 2, 0.59); f.userData.fac = true; g.add(f);
  });
  return g;
}

/* a run of modules along local +x; returns group + list of module groups (for animation) */
function run(len, fac, opts = {}) {
  const g = new THREE.Group(), mods = [];
  const n = Math.round(len / 0.6);
  for (let i = 0; i < n; i++) {
    const tall = opts.tallEnd && i === n - 1;
    const kind = i === Math.floor(n / 2) ? 'oven' : i % 3 === 1 ? 'drawers' : 'door';
    const m = tall ? tallModule(0.6, fac) : baseModule(0.6, fac, kind);
    m.position.x = i * 0.6; g.add(m); mods.push(m);
    if (!tall && opts.uppers !== false) { const u = upperModule(0.6, fac); u.position.x = i * 0.6; g.add(u); mods.push(u); }
  }
  const topLen = (opts.tallEnd ? n - 1 : n) * 0.6;
  const top = box(topLen + 0.01, 0.04, 0.62, M.top); top.position.set(topLen / 2, 0.84, 0.31); g.add(top); mods.push(top);
  if (opts.uppers !== false) {
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(topLen, 0.6), M.splash); sp.position.set(topLen / 2, 1.16, 0.004); sp.receiveShadow = true; g.add(sp);
  }
  return { g, mods, topLen };
}

function sink(parent, x, z) {
  const s = box(0.5, 0.01, 0.4, M.steel); s.position.set(x, 0.862, z); parent.add(s);
  const tap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 10, 24, Math.PI), M.steel);
  tap.position.set(x, 0.86, z - 0.17); tap.rotation.y = Math.PI / 2; tap.castShadow = true; parent.add(tap);
}
function hob(parent, x, z) { const h = box(0.58, 0.006, 0.5, M.hob); h.position.set(x, 0.863, z); parent.add(h); }

let room;
function buildRoom(L, D) {
  if (room) scene.remove(room);
  room = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(L / 2, 0, 3); floor.receiveShadow = true; room.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), M.wall); back.position.set(L / 2, 1.6, 0); back.receiveShadow = true; room.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D + 4, 3.2), M.wall); left.rotation.y = Math.PI / 2; left.position.set(0, 1.6, (D + 4) / 2); left.receiveShadow = true; room.add(left);
  scene.add(room);
}

function build(s, animate) {
  kitchen.clear(); tweens = [];
  const all = [];
  const L = s.len;
  const back = run(L, s.fac, { tallEnd: L >= 3 });
  kitchen.add(back.g); all.push(...back.mods);
  sink(back.g, Math.min(1.5, L / 2 - 0.6) + 0.3, 0.3);
  hob(back.g, Math.max(back.topLen - 0.9, L / 2 + 0.3), 0.3);

  if (s.shape === 'l' || s.shape === 'u' || s.shape === 'island') {
    const side = run(SIDE, s.fac, { uppers: true });
    side.g.rotation.y = Math.PI / 2; side.g.position.set(0, 0, 0.6 + SIDE);
    kitchen.add(side.g); all.push(...side.mods);
  }
  if (s.shape === 'u') {
    const side = run(SIDE, s.fac, { uppers: false });
    side.g.rotation.y = -Math.PI / 2; side.g.position.set(L, 0, 0.6);
    kitchen.add(side.g); all.push(...side.mods);
  }
  if (s.shape === 'island') {
    const isl = new THREE.Group();
    const a = run(SIDE, s.fac, { uppers: false }); a.g.position.z = 0.6; isl.add(a.g); all.push(...a.mods);
    const b = run(SIDE, s.fac, { uppers: false }); b.g.rotation.y = Math.PI; b.g.position.set(SIDE, 0, 0.6); isl.add(b.g); all.push(...b.mods);
    const top = box(SIDE + 0.3, 0.04, 1.3, M.top); top.position.set(SIDE / 2, 0.86, 0.6); isl.add(top); all.push(top);
    isl.position.set(L / 2 - SIDE / 2 + 0.4, 0, 2.5);
    kitchen.add(isl);
  }
  buildRoom(L, s.shape === 'island' ? 4.6 : 3);

  // frame the camera
  const depth = s.shape === 'island' ? 3.8 : s.shape === 'line' ? 0.6 : 2.4;
  const target = new THREE.Vector3(L / 2, 1.0, depth / 2);
  const dist = 3.6 + Math.max(L, depth) * 0.85;
  camTo = { target, pos: new THREE.Vector3(target.x + dist * 0.42, 2.3, target.z + dist * 0.9) };
  if (!camera.userData.init) { camera.position.copy(camTo.pos); controls.target.copy(target); camera.userData.init = true; }

  const t0 = performance.now();
  all.forEach((o, i) => {
    if (!animate || reduce) return;
    const y = o.position.y;
    o.position.y = y + 1.6; o.visible = false;
    tweens.push({ o, from: y + 1.6, to: y, start: t0 + i * 28, dur: 650 });
  });
}
let camTo = null;

function swapFacades(fac) {
  const list = [];
  kitchen.traverse(o => { if (o.isMesh && o.userData.fac) list.push(o); });
  list.sort((a, b) => a.getWorldPosition(new THREE.Vector3()).x - b.getWorldPosition(new THREE.Vector3()).x);
  const t0 = performance.now();
  list.forEach((o, i) => {
    if (reduce) { o.material = M[fac]; return; }
    tweens.push({ o, flip: true, fac, start: t0 + i * 22, dur: 420 });
  });
}

const ease = t => 1 - Math.pow(1 - t, 4);
function tick(now) {
  if (running) {
    tweens = tweens.filter(tw => {
      const p = Math.min(1, Math.max(0, (now - tw.start) / tw.dur));
      if (now < tw.start) return true;
      tw.o.visible = true;
      if (tw.flip) {
        tw.o.scale.z = 1 + Math.sin(p * Math.PI) * 6;
        tw.o.position.z += 0; if (p > 0.5 && !tw.done) { tw.o.material = M[tw.fac]; tw.done = true; }
        if (p >= 1) tw.o.scale.z = 1;
      } else {
        tw.o.position.y = tw.from + (tw.to - tw.from) * ease(p);
      }
      return p < 1;
    });
    if (camTo) {
      camera.position.lerp(camTo.pos, 0.045);
      controls.target.lerp(camTo.target, 0.06);
      if (camera.position.distanceTo(camTo.pos) < 0.01) camTo = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}

function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}

let last = state();
updateText(last);
if (renderer) {
  mats();
  build(last, false);
  new ResizeObserver(resize).observe(stage); resize();
  new IntersectionObserver(es => { running = es[0].isIntersecting; }).observe(stage);
  // assemble on first view
  let seen = false;
  new IntersectionObserver(es => { if (es[0].isIntersecting && !seen) { seen = true; build(state(), true); } }, { threshold: 0.3 }).observe(stage);
  requestAnimationFrame(tick);
}
form.addEventListener('input', onChange);
form.addEventListener('change', onChange);
function onChange() {
  const s = state(); updateText(s);
  if (!renderer) { last = s; return; }
  if (s.shape !== last.shape || s.len !== last.len) { camera.userData.init = true; build(s, true); }
  else if (s.fac !== last.fac) swapFacades(s.fac);
  last = s;
}
