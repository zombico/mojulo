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
      { use: 'machine-sheet', props: { title: B('sheet.title'), loadLabel: 'Load t', load: B('sheet.load'), loadMax: B('sheet.loadMax'), rows: B('sheet.rows'), laws: B('sheet.laws') } },
    ] },
    screens: {
      slots: { use: 'garage-slots', props: { title: 'Hangar', slots: B('slots'), go: 'Sortie', sortie: { emit: 'garage:sortie' } } },
      parts: { use: 'garage-parts', props: { title: B('partsTitle'), parts: B('parts'), columns: B('columns'), rows: B('rows') } },
    },
  };
  const full = withIdioms(spec);
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USES.includes(k)));
  manaUi.readSpec(full);
  return full;
}

export function frameGarageScript(garage) {
  // (fitting is reading: the look's own colours and type, without its flourishes, a title said once)
  const T = readTheme({ ...cardTheme(LOOK), overlay: 'none', stage: 'none', breakout: 'none', backdrop: 'none', title: 'still' }), C = manaControls();
  const sheet = [manaCss(), themeCss(T).replace(/\.mana-root/g, '#mjgarage .mana-root'),
    '#mjgarage .mana-root{--mana-stage:none;--mana-overlay:none}#mjgarage{position:fixed;inset:0;z-index:2147483000;pointer-events:none}#mjgarage>.gr-mana{position:absolute;inset:0;pointer-events:auto}',
    '#mjgarage .mana-screen[data-place=left]{width:min(48vw,660px);max-width:none}',
    // (read on a solid dark plate, as the sheet is: light words never on the look's pale glass)
    '#mjgarage .mana-screen[data-place=left]{background:none!important;backdrop-filter:none!important;box-shadow:none!important}#mjgarage .mana-screen[data-place=left]::before,#mjgarage .mana-screen[data-place=left]::after{display:none!important}',
    '#mjgarage .mana-screen[data-place=left]>.mana-stack{background:rgba(11,15,21,.9)!important;backdrop-filter:none!important;-webkit-mask-image:none!important;mask-image:none!important;border:1px solid rgba(160,200,230,.22)}#mjgarage .mana-screen[data-place=left]>.mana-stack::before,#mjgarage .mana-screen[data-place=left]>.mana-stack::after{display:none!important}',
    // (a slot's parts read as a table across the screen: its window and its table the screen's width)
    '#mjgarage .mana-screen>.mana-stack{width:100%!important;max-width:none!important}#mjgarage .mana-screen .mana-table{width:100%!important}#mjgarage .mana-table td{white-space:nowrap}',
    // (a level's own HUD look can reach any mana root on the page: its echoed titles kept off the garage's)
    '#mjgarage :is(.mana-title,[data-echo])::before{content:none!important;display:none!important}',
    // (the field's HUD put away while the frame is in its bay: its radar, its readouts, its banners and legend)
    'body.moj-garage :is(.fh,#moj-mana-hud,.moj-c-radar,.moj-hud,.moj-hg,.moj-c-gauge,.moj-c-hp,.moj-c-lock,.moj-c-ehp,.moj-readout){display:none!important}'].join('\n');
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
const STATE = { garage: { slots: [], parts: [], partsTitle: '', columns: [], rows: [], sheet: { title: '', rows: [], load: 0, loadMax: 1, laws: [] } } };
let rt = null, mview = null, up = false, build = null, bay = null, orbit = 0, last = 0, cam0 = null;
const pilot = () => __world.byId[__world.pilotId];
// (the frame's figures that matter, and which way is better)
const FIG = [['ap', 'AP', (A) => A.ap], ['wt', 'Weight t', (A) => t1(A.weight)], ['boost', 'Boost m/s', (A) => A.move.boost], ['qb', 'Quick boost m/s', (A) => A.move.qb], ['en', 'EN', (A) => A.en.max], ['lock', 'Lock range m', (A) => A.fcs.range]];
// (a figure as words; its change from the fitted part beside it, signed)
const num = (v) => (Math.round(v * 100) / 100).toLocaleString('en-US');
const withDelta = (to, from) => { const d = Math.round((to - from) * 100) / 100; return d ? num(to) + (d > 0 ? ' +' : ' −') + num(Math.abs(d)) : num(to); };
const nameOf = (slot, id) => (id ? (K.tableOf(slot)[id] || {}).name || id : 'None');
function words() {
  const A = K.assembleFrame(build), G = STATE.garage;
  G.slots = ORDER.filter((s) => !(s === 'head' && K.PARTS.core[build.core] && K.PARTS.core[build.core].headless)).map((s) => ({ slot: NAMES[s], name: nameOf(s, build[s]), then: { emit: 'garage:slot', slot: s } }));
  G.sheet = { title: (K.PARTS.core[build.core] || {}).name + ' frame', rows: FIG.map(([, label, f]) => ({ what: label, value: num(f(A)) })).concat([{ what: 'Stability', value: num(A.stab.max) }]),
    load: t1(A.weight - A.parts.legs.weight), loadMax: t1(A.load), laws: A.laws.map((l) => ({ says: l.says, ok: !!l.ok })) };
}
function partsOf(slot) {
  const A = K.assembleFrame(build), T = K.tableOf(slot);
  const ids = Object.keys(T).filter((id) => __grOwned.has(id) || build[slot] === id);
  const cands = (K.WEAPON_SLOTS.includes(slot) ? [...ids, null] : ids);
  const G = STATE.garage;
  // (each part's frame, and the table's columns: AP and weight always, the rest only where the parts differ; short heads,
  // the units in the frame's sheet)
  const As = cands.map((id) => { try { return K.assembleFrame({ ...build, [slot]: id }); } catch (e) { return A; } });
  const SHORT = { ap: 'AP', wt: 'Weight', boost: 'Boost', qb: 'QB', en: 'EN', lock: 'Lock' };
  const cols = FIG.filter(([k, , f]) => k === 'ap' || k === 'wt' || (k !== 'qb' && new Set(As.map((X) => f(X))).size > 1));
  G.columns = [{ key: 'part', label: 'Part' }, ...cols.map(([key]) => ({ key, label: SHORT[key], align: 'right' }))];
  G.rows = [];
  G.parts = cands.map((id, i) => {
    const A2 = As[i], fitted = build[slot] === id;
    G.rows.push({ part: nameOf(slot, id), ...Object.fromEntries(cols.map(([key, , f]) => [key, fitted ? num(f(A)) : withDelta(f(A2), f(A))])), ...(fitted ? { mark: true } : {}) });
    return { name: nameOf(slot, id), about: id ? T[id].about || '' : 'the slot left empty', ...(fitted ? { fitted: true } : {}), then: { emit: 'garage:fit', slot, item: id || '-' } };
  });
  return G.parts;
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
// (the bay's dice: its dressing laid the same every time)
const dice = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
// THE TURNTABLE'S DECK: steel plate, seams in rings and spokes, a bolt along each, a hub, a hazard band round the rim
function deckTexture() {
  const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d'), c = N / 2, r = (k) => k * c, roll = dice(7);
  const grd = x.createRadialGradient(c, c, 0, c, c, c); grd.addColorStop(0, '#78818b'); grd.addColorStop(1, '#5d656e'); x.fillStyle = grd; x.fillRect(0, 0, N, N);
  // (the plates' wear: faint patches, each a shade off the deck)
  for (let i = 0; i < 160; i++) { const a = roll() * 6.283, d = r(0.08 + roll() * 0.78); x.fillStyle = roll() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; x.beginPath(); x.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, r(0.02 + roll() * 0.06), 0, 6.283); x.fill(); }
  const seam = (w, col) => { x.lineWidth = w; x.strokeStyle = col; };
  const rings = [0.16, 0.42, 0.68, 0.86];
  for (const k of rings) { seam(5, 'rgba(20,24,28,0.85)'); x.beginPath(); x.arc(c, c, r(k), 0, 6.283); x.stroke(); seam(1.5, 'rgba(200,210,220,0.25)'); x.beginPath(); x.arc(c, c, r(k) + 3, 0, 6.283); x.stroke(); }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.283 + (i % 2 ? 0 : 0.13), k0 = i % 2 ? 0.16 : 0.42;
    seam(5, 'rgba(20,24,28,0.85)'); x.beginPath(); x.moveTo(c + Math.cos(a) * r(k0), c + Math.sin(a) * r(k0)); x.lineTo(c + Math.cos(a) * r(0.86), c + Math.sin(a) * r(0.86)); x.stroke();
  }
  // (the bolts along the seams)
  x.fillStyle = '#9aa4ae';
  for (const k of rings) for (let i = 0; i < Math.round(k * 64); i++) { const a = (i / Math.round(k * 64)) * 6.283; x.beginPath(); x.arc(c + Math.cos(a) * (r(k) - 9), c + Math.sin(a) * (r(k) - 9), 3.2, 0, 6.283); x.fill(); }
  // (the hub, and the hazard band round the rim)
  x.fillStyle = '#3b4148'; x.beginPath(); x.arc(c, c, r(0.16), 0, 6.283); x.fill();
  // (the band: a stroke round the rim in a pattern of diagonal stripes)
  const st = document.createElement('canvas'); st.width = st.height = 48; const sx = st.getContext('2d');
  sx.fillStyle = '#1d1f22'; sx.fillRect(0, 0, 48, 48); sx.fillStyle = '#e9a42a';
  for (const o of [-48, 0, 48]) { sx.beginPath(); sx.moveTo(o, 48); sx.lineTo(o + 24, 48); sx.lineTo(o + 72, 0); sx.lineTo(o + 48, 0); sx.fill(); }
  x.lineWidth = r(0.075); x.strokeStyle = x.createPattern(st, 'repeat'); x.beginPath(); x.arc(c, c, r(0.94), 0, 6.283); x.stroke();
  seam(4, 'rgba(20,24,28,0.9)'); for (const k of [0.9, 0.98]) { x.beginPath(); x.arc(c, c, r(k), 0, 6.283); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; return t;
}
// THE BAY'S DRESSING: the back wall panelled (inset plates, vents, lamps), cable runs and trays along it, loose cables
// sagging between its ribs and down the gantries, and metal crates and drums stacked along the walls
function dress(g, box, B) {
  const { H, W, D, Y, top, wall, rib, dark, amber, white, red } = B, roll = dice(11);
  const mat = (c, r = 0.6, m = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const panel = mat(0x5a626c, 0.6, 0.5), panel2 = mat(0x434a52, 0.7, 0.45), slat = mat(0x1a1d21, 0.8, 0.4), rubber = mat(0x17191c, 0.85, 0.1);
  // (the panels: a grid of inset plates between the ribs, some a shade darker, a vent's slats in some, a lamp over a few)
  const cols = 12, rows = 3, cw = W / 13;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = -W / 2 + cw * (i + 1), z = top * (0.14 + j * 0.24), kind = roll();
    box([cw * 0.82, 0.35, top * 0.2], [x, D + 0.55, z], kind < 0.35 ? panel2 : panel);
    if (kind > 0.78) for (let v = 0; v < 5; v++) box([cw * 0.6, 0.2, 0.16], [x, D + 0.78, z - top * 0.07 + v * top * 0.035], slat);
    else if (kind < 0.12) box([0.5, 0.25, 0.3], [x, D + 0.8, z + top * 0.085], kind < 0.06 ? red : amber);
  }
  // (cable trays along the wall, and the cables in them)
  for (const z of [top * 0.62, top * 0.9]) { box([W * 0.94, 0.9, 0.18], [0, D + 1.0, z - 0.35], dark); for (let k = 0; k < 3; k++) box([W * 0.94, 0.22, 0.22], [0, D + 0.85 + k * 0.24, z - 0.12], rubber); }
  // (loose cables: each sagging between two points as it hangs, a tube along its curve)
  const cable = (a, b2, sag, r, m) => {
    const mid = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, (a[2] + b2[2]) / 2 - sag];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(...a), new THREE.Vector3((a[0] + mid[0]) / 2, (a[1] + mid[1]) / 2, mid[2] + sag * 0.35), new THREE.Vector3(...mid), new THREE.Vector3((b2[0] + mid[0]) / 2, (b2[1] + mid[1]) / 2, mid[2] + sag * 0.35), new THREE.Vector3(...b2)]);
    const o = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), m); o.raycast = function () {}; g.add(o);
  };
  const hues = [rubber, rubber, mat(0x8a6a1e, 0.6, 0.2), mat(0x2d4e6e, 0.6, 0.2), rubber];
  for (let i = 0; i < 10; i++) {
    const x0 = -W / 2 + W * (i + 0.2 + roll() * 0.6) / 10, x1 = x0 + W * (0.05 + roll() * 0.08), z = top * (0.55 + roll() * 0.3);
    cable([x0, D + 1.2, z], [x1, D + 1.2, z + (roll() - 0.5) * 2], 1.5 + roll() * 3.5, 0.12 + roll() * 0.12, hues[i % hues.length]);
  }
  // (and down the gantries to the floor: power to the bay's lamps)
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = sx * H * 1.55 + sx * (1.6 + i * 0.25);
    cable([x, -H * 0.3 + i * 0.8, H * 1.05 + 1], [x + sx * 3, -H * 0.6 - i, 0.2], 2.5 + i, 0.14, hues[(i + 2) % hues.length]);
  }
  // (crates and drums along the walls: steel crates with their edges framed and a stripe, stacked; drums in clusters)
  const crate = (x, y, z, s, turn) => {
    const c = new THREE.Group(), body = mat(roll() < 0.5 ? 0x5b6168 : 0x4d5a4a, 0.55, 0.65), edge = mat(0x2e3237, 0.5, 0.75);
    const add = (sz, p, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sz[0], sz[1], sz[2]), m); o.position.set(p[0], p[1], p[2]); o.raycast = function () {}; c.add(o); };
    add([s, s, s * 0.8], [0, 0, s * 0.4], body);
    for (const ex of [-1, 1]) for (const ey of [-1, 1]) add([0.22, 0.22, s * 0.8], [ex * s / 2, ey * s / 2, s * 0.4], edge);
    for (const ez of [0, 1]) { add([s + 0.1, 0.22, 0.22], [0, -s / 2, ez * s * 0.8], edge); add([s + 0.1, 0.22, 0.22], [0, s / 2, ez * s * 0.8], edge); add([0.22, s + 0.1, 0.22], [-s / 2, 0, ez * s * 0.8], edge); add([0.22, s + 0.1, 0.22], [s / 2, 0, ez * s * 0.8], edge); }
    add([s * 0.7, s + 0.04, s * 0.08], [0, 0, s * 0.55], amber);
    c.position.set(x, y, z); c.rotation.z = turn; g.add(c);
  };
  const drum = (x, y, k) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 14), mat(k ? 0x6b2a22 : 0x3e5466, 0.5, 0.55)); o.rotation.x = Math.PI / 2; o.position.set(x, y, 1.2); o.raycast = function () {}; g.add(o); };
  for (const sx of [-1, 1]) {
    const x0 = sx * (Y - 5);
    // (a stack in each back corner, three wide and up to three high)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i % 2; j++) crate(x0 - sx * i * 4.4, D + 4 + (j % 2) * 0.5, j * 3.3, 4, (roll() - 0.5) * 0.12);
    // (smaller crates along the side walls, and a cluster of drums)
    for (let i = 0; i < 4; i++) crate(sx * (Y - 3.5), -H * 0.2 + i * 5.2, 0, 2.6 + roll() * 1.2, (roll() - 0.5) * 0.4);
    for (let i = 0; i < 5; i++) drum(sx * (H * 2.3 + (i % 3) * 2), D + 9 + Math.floor(i / 3) * 2.1, i === 2);
  }
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
  // (the turntable: deck plate drawn on its top, ring and radial seams with their bolts, a hazard band at its rim)
  const deck = new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.55, metalness: 0.65 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, 0.3, 64), [plate, deck, plate]); pad.rotation.x = Math.PI / 2; pad.position.z = 0.15; pad.raycast = function () {}; g.add(pad);
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
  dress(g, box, { H, W, D, Y, top, wall, rib, dark, amber, white, red });
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
  // (the operation told first: the hangar opens once the briefing's Launch has let it go)
  if (window.__mojBriefing && window.__mojBriefing.up) { setTimeout(open, 120); return; }
  build = K.readBuild((window.__mojFrameHangar && window.__mojFrameHangar.build) || (__FIG[P.body.figure] && __FIG[P.body.figure].frame && __FIG[P.body.figure].frame.build) || 'vanguard');
  up = true; document.body.classList.add('moj-garage'); document.body.appendChild(__grRoot); hold(true);
  const H = (__FIG[P.body.figure] && __FIG[P.body.figure].figH) || 9;
  cam0 = { pos: camera.position.clone(), q: camera.quaternion.clone(), up: camera.up.clone() };
  bay = makeBay(P, H); orbit = 0.6; stow(true, P);
  words();
  rt = __manaUi.runtime(${json(frameGarageSpec())}, { read: (p) => __manaUi.readPath(STATE, p), act, now: () => performance.now() / 1000, cues: 'ticks' });
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
  if (window.__mojUiCue) window.__mojUiCue('close');
  if (cam0) { camera.up.copy(cam0.up); camera.position.copy(cam0.pos); camera.quaternion.copy(cam0.q); cam0 = null; }
  hold(false);
}
function act(e) {
  if (!e || !up) return;
  // (the menus' sounds: the cursor's ticks, played by the level's audio, frame-audio.js window.__mojUiCue)
  if (e.sound) { if (window.__mojUiCue) window.__mojUiCue(e.sound); return; }
  if (e.emit === 'garage:slot') { partsOf(e.slot); STATE.garage.partsTitle = NAMES[e.slot]; rt.open('parts'); }
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
