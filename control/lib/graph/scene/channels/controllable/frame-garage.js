/**
 * THE HANGAR (a frame level's garage, the pilot frame's `rule.garage`): before the operation starts, the frame stands
 * on its pad in a field hangar and the player fits it, part by part, on mana-ui (the campaign idioms `garage-slots`,
 * `garage-parts`, `machine-sheet`); the level is held behind it on the pause sidecar the shell's pause uses, as the
 * briefing holds a mission. A part fitted is stood at once (the frame kernel, assault-frame/kernel.js, the page's
 * `__frameRefit`), each candidate shown by what it does to the whole frame; SORTIE keeps the build in the save (the
 * `hangar` slice's setFlag events, assault-frame/hangar.js), takes the bay down and lets the operation go.
 *
 *   frameGarageSpec()             → the mana-ui spec (its defs only the idioms it uses)
 *   frameGarageScript(garage)     → the block the controllable channel splices beside its refit, in a scope of its own
 *                                   garage { owned: [part ids] }: the parts the player has to fit (the stock's, and
 *                                   what the save's `parts` slice holds, read from the level's params)
 *
 * The page answers to `window.__mojGarage` { up, open(), fit(slot, id), sortie(), act(effect), build, state } for probes
 * (act: what a key, a pad or a pointer does through the words).
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme } from '../../../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../../../controls/mana-controls.js';
import { cardTheme } from '../../../playscape/ui/theme-cards/loader.js';
import { MSG_PAUSE } from '../../../game/level-contract.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const B = (p) => ({ bind: `garage.${p}` });
const USES = ['garage-slots', 'garage-parts', 'machine-sheet'];
// (the look: the campaign's holo card, nothing drawn across the screen: the hangar is the screen's backdrop)
const LOOK = 'orbit';

export function frameGarageSpec() {
  const spec = {
    start: 'slots',
    hud: { use: 'hud', children: [
      { use: 'machine-sheet', props: { title: B('sheet.title'), loadLabel: 'Load t', numbers: B('sheet.numbers'), load: B('sheet.load'), loadMax: B('sheet.loadMax'), laws: B('sheet.laws') } },
    ] },
    screens: {
      slots: { use: 'garage-slots', props: { title: 'Hangar', slots: B('slots'), go: 'Sortie', sortie: { emit: 'garage:sortie' } } },
      parts: { use: 'garage-parts', props: { title: B('partsTitle'), parts: B('parts') } },
    },
  };
  const full = withIdioms(spec);
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USES.includes(k)));
  manaUi.readSpec(full);
  return full;
}

export function frameGarageScript(garage) {
  const T = readTheme({ ...cardTheme(LOOK), overlay: 'none', stage: 'none' }), C = manaControls();
  const sheet = [manaCss(), themeCss(T).replace(/\.mana-root/g, '#mjgarage .mana-root'),
    '#mjgarage .mana-root{--mana-stage:none;--mana-overlay:none}#mjgarage{position:fixed;inset:0;z-index:2147483000;pointer-events:none}#mjgarage>.gr-mana{position:absolute;inset:0;pointer-events:auto}',
    '#mjgarage .mana-screen[data-place=left]{max-width:min(34vw,470px)}body.moj-garage .fh{display:none}'].join('\n');
  return `
// ── the hangar: the frame fitted before it goes out ──
{
const __grOwned = new Set(${json(garage.owned ?? [])});
const __grCss = document.createElement('style'); __grCss.textContent = ${json(sheet)}; document.head.appendChild(__grCss);
const __grRoot = document.createElement('div'); __grRoot.id = 'mjgarage'; __grRoot.innerHTML = '<div class="gr-mana"></div>';
const __manaUi = ${manaUiSource()};
const __manaHostK = ${manaHostSource()};
const __manaPadLayout = (${padLayoutSource()});
const K = __FRAMEK, NAMES = { head: 'Head', core: 'Core', arms: 'Arms', legs: 'Legs', booster: 'Booster', generator: 'Generator', fcs: 'FCS', armR: 'R arm', armL: 'L arm', backR: 'R back', backL: 'L back' };
const ORDER = [...K.SLOTS, ...K.WEAPON_SLOTS];
const t1 = (kg) => Math.round(kg / 100) / 10;
const STATE = { garage: { slots: [], parts: [], partsTitle: '', sheet: { title: '', numbers: [], load: 0, loadMax: 1, laws: [] } } };
let rt = null, mview = null, up = false, build = null, bay = null, orbit = 0, last = 0, cam0 = null;
const pilot = () => __world.byId[__world.pilotId];
// (the frame's figures that matter, and which way is better)
const FIG = [['AP', (A) => A.ap, 'up'], ['Weight t', (A) => t1(A.weight), 'down'], ['Boost m/s', (A) => A.move.boost, 'up'], ['Quick boost', (A) => A.move.qb, 'up'], ['EN', (A) => A.en.max, 'up'], ['Lock m', (A) => A.fcs.range, 'up']];
const nameOf = (slot, id) => (id ? (K.tableOf(slot)[id] || {}).name || id : 'None');
function words() {
  const A = K.assembleFrame(build), G = STATE.garage;
  G.slots = ORDER.filter((s) => !(s === 'head' && K.PARTS.core[build.core] && K.PARTS.core[build.core].headless)).map((s) => ({ slot: NAMES[s], name: nameOf(s, build[s]), then: { emit: 'garage:slot', slot: s } }));
  G.sheet = { title: (K.PARTS.core[build.core] || {}).name + ' frame', numbers: FIG.map(([label, f]) => ({ label, value: String(f(A)) })).concat([{ label: 'Stability', value: String(A.stab.max) }]),
    load: t1(A.weight - A.parts.legs.weight), loadMax: t1(A.load), laws: A.laws.map((l) => ({ says: l.says, ok: !!l.ok })) };
}
function partsOf(slot) {
  const A = K.assembleFrame(build), T = K.tableOf(slot);
  const ids = Object.keys(T).filter((id) => __grOwned.has(id) || build[slot] === id);
  const cands = (K.WEAPON_SLOTS.includes(slot) ? [...ids, null] : ids);
  return cands.map((id) => {
    let A2 = A;
    try { A2 = K.assembleFrame({ ...build, [slot]: id }); } catch (e) { /* a part no frame can take: shown as it stands */ }
    const delta = FIG.map(([label, f, better]) => ({ label, from: f(A), to: f(A2), better })).filter((d, i) => i < 2 || d.from !== d.to);
    return { name: nameOf(slot, id), about: id ? T[id].about || '' : 'the slot left empty', ...(build[slot] === id ? { fitted: true } : {}), delta, then: { emit: 'garage:fit', slot, item: id || '-' } };
  });
}
function fit(slot, id) {
  const B2 = { ...build, [slot]: id };
  // (a core that carries its own sensors takes no head; one that does not, the first head there is, where none is fitted)
  if (slot === 'core' && K.PARTS.core[id] && !K.PARTS.core[id].headless && !B2.head) B2.head = Object.keys(K.PARTS.head).find((h) => __grOwned.has(h)) || Object.keys(K.PARTS.head)[0];
  try { build = K.readBuild(B2); } catch (e) { console.warn('garage:', e.message); return false; }
  __frameRefit(build);
  const P = pilot(); if (P) { __syncEntity(P, 0); if (up) onLayer(__bodies[P.id]); }
  words();
  return true;
}
// THE BAY: an interior the frame stands in while it is fitted (the field put away under it): a floor with its guide
// lines, the pad under the frame and its ring, a ribbed back wall under a light bar, side walls, a gantry either side with
// its platforms and lamps, and the roof's beams with their strips
function makeBay(P, H) {
  const g = new THREE.Group(), std = (c, r = 0.6, m = 0.5, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 1.4 } : {}) });
  const box = (s, p, mat) => { const o = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), mat); o.position.set(p[0], p[1], p[2]); o.raycast = function () {}; g.add(o); return o; };
  const floor = std(0x565d66, 0.8, 0.25), plate = std(0x6a727c, 0.5, 0.6), wall = std(0x4c535c, 0.7, 0.35), rib = std(0x7d8792, 0.4, 0.7), dark = std(0x2c3137, 0.75, 0.5);
  const amber = std(0x2a1a00, 0.5, 0, 0xffa53a), white = std(0x202428, 0.4, 0, 0xe4f0ff), red = std(0x2a0606, 0.5, 0, 0xff3a2e);
  const R = H * 1.15, W = H * 7, D = -H * 1.9, Y = H * 3.2, top = H * 2.7;
  box([W, W, 0.2], [0, 0, -0.1], floor);
  // (the guide lines: the bay's axis and its bounds, amber on the floor)
  for (const x of [-H * 1.35, H * 1.35]) box([0.25, W * 0.8, 0.04], [x, H * 0.6, 0.02], amber);
  box([0.25, W * 0.45, 0.04], [0, H * 2.6, 0.02], amber);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, 0.3, 48), plate); pad.rotation.x = Math.PI / 2; pad.position.z = 0.15; pad.raycast = function () {}; g.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.1, 6, 72), amber); ring.position.z = 0.32; ring.raycast = function () {}; g.add(ring);
  // (the back wall: panels between ribs, a light bar along its top and the bay's number in red lamps)
  box([W, 0.8, top], [0, D, top / 2], wall);
  for (let i = -6; i <= 6; i++) box([0.6, 1.0, top], [i * W / 13, D + 0.5, top / 2], rib);
  box([W * 0.9, 0.6, 0.5], [0, D + 0.7, top * 0.82], white);
  for (const z of [0.25, 0.32]) box([H * 0.9, 0.3, 0.2], [0, D + 0.6, top * z], red);
  // (the side walls, ribbed, and the roof's beams with their strips)
  for (const sx of [-1, 1]) {
    box([0.8, W, top], [sx * Y, 0, top / 2], wall);
    for (let i = -4; i <= 4; i++) box([1.0, 0.6, top], [sx * (Y - 0.5), i * W / 9, top / 2], rib);
  }
  for (let i = -3; i <= 3; i++) { box([Y * 2, 1.0, 1.2], [0, i * H * 0.9, top], dark); box([Y * 1.9, 0.5, 0.2], [0, i * H * 0.9, top - 0.7], white); }
  // (a gantry either side: its posts, its platforms at three heights with their rails, its lamps on the frame)
  for (const sx of [-1, 1]) {
    const x = sx * H * 1.55;
    for (const dy of [-1, 1]) for (const dx of [-1, 1]) box([0.5, 0.5, top], [x + dx * 1.4, dy * H * 0.55, top / 2], rib);
    for (const z of [0.38, 0.72, 1.05]) {
      box([3.4, H * 1.2, 0.3], [x, 0, H * z], plate);
      box([0.15, H * 1.2, 0.9], [x - sx * 1.6, 0, H * z + 0.6], rib);
      box([0.5, 1.1, 0.4], [x - sx * 1.8, H * 0.3, H * z + 1.2], white);
    }
  }
  // (its light: the bay's own, a cool fill and the lamps over the pad)
  g.add(new THREE.HemisphereLight(0xc8d6e6, 0x3a3530, 1.4));
  for (const [x, y, z, c, k] of [[0, H * 0.6, top - 1.5, 0xe8f2ff, 1.6], [-H * 1.4, -H * 0.4, H * 1.5, 0xffd9a8, 0.9], [H * 1.4, -H * 0.4, H * 1.5, 0xbfd8ff, 0.9]]) { const L = new THREE.PointLight(c, k, H * 12, 0); L.position.set(x, y, z); g.add(L); }
  g.position.set(P.transform.pos[0], P.transform.pos[1], P.transform.pos[2]);
  g.rotation.z = (P.transform.heading || 0) - Math.PI / 2;
  scene.add(g);
  return g;
}
// (the field put away while the frame is in its bay, and given back as it goes out: the camera sees one layer of its own,
// and only the bay, the frame and the lights are on it; a land that streams its chunks cannot show through)
const LAYER = 7;
let __grLit = null, __grMask = 0, __grBg = null;
const onLayer = (o) => { if (o) o.traverse((x) => x.layers.enable(LAYER)); };
function stow(on, P) {
  if (on) {
    __grLit = []; scene.traverse((o) => { if (o.isLight && !o.layers.isEnabled(LAYER)) { o.layers.enable(LAYER); __grLit.push(o); } });
    onLayer(bay); onLayer(__bodies[P.id]);
    __grMask = camera.layers.mask; camera.layers.set(LAYER);
    __grBg = scene.background; scene.background = new THREE.Color(0x0c0f13);
  } else {
    camera.layers.mask = __grMask;
    for (const o of __grLit || []) o.layers.disable(LAYER);
    __grLit = null; scene.background = __grBg;
  }
}
const hold = (on) => { window.__mojMenuOpen = on; window.__mojFreeze = on; try { window.postMessage({ moj: ${json(MSG_PAUSE)}, on }, '*'); } catch (e) { /* no scene */ } };
function open() {
  const P = pilot();
  if (up || !P || !P.rule || P.rule.type !== 'frame') return;
  build = K.readBuild((window.__mojFrameHangar && window.__mojFrameHangar.build) || (__FIG[P.body.figure] && __FIG[P.body.figure].frame && __FIG[P.body.figure].frame.build) || 'vanguard');
  up = true; document.body.classList.add('moj-garage'); document.body.appendChild(__grRoot); hold(true);
  const H = (__FIG[P.body.figure] && __FIG[P.body.figure].figH) || 9;
  cam0 = { pos: camera.position.clone(), q: camera.quaternion.clone(), up: camera.up.clone() };
  bay = makeBay(P, H); orbit = 0.6; stow(true, P);
  words();
  rt = __manaUi.runtime(${json(frameGarageSpec())}, { read: (p) => __manaUi.readPath(STATE, p), act, now: () => performance.now() / 1000, cues: 'silent' });
  rt.glyphs(${json(manaGlyphs())});
  mview = __manaUi.mount(__grRoot.querySelector('.gr-mana'), rt, { auto: true });
  __manaHostK.connect(rt, mview, { keys: ${json(C.keys)}, pad: ${json(C.pad)}, padLayout: __manaPadLayout });
  mview.paint();
  last = performance.now(); requestAnimationFrame(spin);
}
function sortie() {
  if (!up) return;
  const ev = K.flagsOfBuild(K.readBuild(build));
  if (window.__mojGame && window.__mojGame.emit) for (const e of ev) window.__mojGame.emit(e);
  up = false; try { rt.close(); } catch (e) { /* closed */ }
  __grRoot.remove(); document.body.classList.remove('moj-garage');
  stow(false); if (bay) { scene.remove(bay); bay = null; }
  if (cam0) { camera.up.copy(cam0.up); camera.position.copy(cam0.pos); camera.quaternion.copy(cam0.q); cam0 = null; }
  hold(false);
}
function act(e) {
  if (!e || !up) return;
  if (e.emit === 'garage:slot') { STATE.garage.parts = partsOf(e.slot); STATE.garage.partsTitle = NAMES[e.slot]; rt.open('parts'); }
  else if (e.emit === 'garage:fit') { fit(e.slot, e.item === '-' ? null : e.item); try { rt.back(); } catch (err) { rt.open('slots'); } }
  else if (e.emit === 'garage:sortie') sortie();
  if (mview) mview.paint();
}
// (the camera swaying slowly across the frame's front while the hangar is up: the level's own camera is held with it)
function spin(now) {
  if (!up) return;
  const P = pilot(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (P) {
    const H = (__FIG[P.body.figure] && __FIG[P.body.figure].figH) || 9, p = P.transform.pos, h = P.transform.heading || 0;
    // (a slow sway across the frame's front, never round behind a gantry)
    orbit += dt * 0.18;
    const a = h + 0.25 + 0.6 * Math.sin(orbit), d = H * 3.3;
    camera.position.set(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, p[2] + H * 0.95);
    camera.up.set(0, 0, 1); camera.lookAt(p[0], p[1], p[2] + H * 0.48);
  }
  requestAnimationFrame(spin);
}
// (opened as the level starts, after its params have stood the save's build: the other starts first)
(function hook(n) {
  // (the parts the save holds, its inventory's, join the stock's)
  if (window.__mojGame && window.__mojGame.onStart) { window.__mojGame.onStart((params) => { const s = params && params[K.PARTS_SLICE], it = s && s.items; if (it) for (const id in it) if (it[id] > 0) __grOwned.add(id); setTimeout(open, 0); }); return; }
  if (n < 400) setTimeout(() => hook(n + 1), 25);
})(0);
window.__mojGarage = { get up() { return up; }, open, fit: (s, id) => fit(s, id), sortie, act: (e) => act(e), get build() { return build; }, get state() { return STATE.garage; } };
}`;
}
