/**
 * transportation-hub — an autogenerative TRANSIT-HUB scene primitive, sibling to
 * fractal-city. Where the city fractally subdivides into a uniform quadrant grid of
 * building blocks, a transportation hub is organized around a different concern:
 *
 *   anchor terminal (head-house / concourse) + fractal FINGERS (piers / platforms /
 *   bays) + modal apron fields + transit ribbons (runways / rails / busways) +
 *   modal vehicles.
 *
 * The fractal recursion here is LINEAR repetition along a spine: the terminal
 * sprouts concourse fingers, and each finger fills with its mode's repeated unit (a
 * gate module / a platform+track pair / a sawtooth bus bay). `mode` picks one of
 * three coherent compositions: 'airport' | 'train-station' | 'bus-terminal'.
 *
 * Output is a flat list of world boxes + grounds + ribbons + raw faces, fed to
 * scene-css3d's renderBoxCityToHtml — the same dependency-free preserve-3d emitter
 * the city/room/terrain scenes use. Only a tiny RECIPE is stored; the whole hub is
 * regenerated deterministically on render.
 *
 * Camera convention (matches the city): the primary camera sits at +y looking −y,
 * so the NEAR edge is high-y and the FAR edge is low-y. The terminal anchor lands on
 * the near edge; fingers/yards recede toward the far edge; runways/tracks/lanes lie
 * along the far edge.
 */

import { assembleBoxCityScene, emitPreserve3dScene } from './scene-css3d.js';
import { buildFacadeCard } from './facade-card.js';
import { makeLight, scaleHex, litFactor } from './polygonizer/vexar.js';
import { groundStreet, airportStrip } from './roads.js';
import { vehicleFaces, aircraftFootprint } from './vehicles-css3d.js';
import { pickAircraftLiveryScheme } from './polygonizer/vehicle-fuselage-net.js';
import { typesInFamily, describeType } from './meta-fabricator.js';

export const HUB_MODES = ['airport', 'train-station', 'bus-terminal'];

// deterministic RNG so a seed reproduces a hub (same primitive as fractal-city)
function mulberry32(a) {
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deep enough that the radial terminal (hub + full-length spokes, ~13 units of reach) fits
// ABOVE a clear apron gap + the taxiway + the runways, without squeezing the spokes. The
// vertical budget: runways+taxiway 0–10, clear apron gap 10–14 (apronFloor), terminal 14–46.
const DEFAULT_REGION = { x: 0, y: 0, w: 40, d: 46 };
// the primary (apron) camera — also the camHint that orients curved aircraft skins
const APRON_CAM = [20, 74, 18];   // primary apron viewpoint (also the vehicle camHint) — pulled back for the deeper apron
const FLOOD_HEAD = '#f2d18a';                      // warm lamp-head marker → night light source
// GSE vehicle nets are authored in METRES (a ~7 m catering truck), but the aircraft
// fuselage nets live in a COMPRESSED unit space (~6 net units for a 38 m jet, so the
// apron reads beside multi-storey concourses). Rendering a metre-scale truck at the
// plane's own render scale makes it ~6× too big; this factor brings GSE into aircraft
// space so a catering truck reads ~1/5 of an airliner (matching real proportions).
// Tracks `planeScale` proportionally — bump both together so vehicles stay ~1/5 of a jet.
const GSE_SCALE = 0.37;

// ── shared box-composite props ─────────────────────────────────────────────────
// a flood-light mast: tall pole + crossbar + two warm heads (the heads are read
// back as night light sources, exactly like fractal-city's street/freeway lamps).
function floodMast(boxes, x, y, h = 5.4) {
  boxes.push({ kind: 'flood-pole', x: x - 0.1, y: y - 0.1, w: 0.2, d: 0.2, z0: 0, z1: h, tint: '#4a4f55' });
  boxes.push({ kind: 'flood-bar', x: x - 0.7, y: y - 0.08, w: 1.4, d: 0.16, z0: h - 0.3, z1: h - 0.18, tint: '#4a4f55' });
  for (const ox of [-0.5, 0.5]) boxes.push({ kind: 'flood-head', x: x + ox - 0.18, y: y - 0.16, w: 0.36, d: 0.3, z0: h - 0.42, z1: h - 0.28, tint: FLOOD_HEAD });
}

// ── airport facades + raw-face prisms ──────────────────────────────────────────
// Airport buildings are NOT city buildings: they read as continuous CURTAINWALL
// glazing — strong horizontal floor bands, sparse verticals, a solid spandrel base
// and a deep fascia. Built as raw CSS-3D faces (not the city facade programs) so the
// terminal/concourses/tower carry their own architectural language. Pre-shaded with
// the scene's default light (vehicles do the same); moonlight/diffusion layer on top.
const SCENE_LIGHT = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
const AIRPORT_ROOF = '#b7bcc2';                             // light brushed-aluminium standing-seam metal — a neutral cool grey that reads as a modern terminal roof, off the bluish glazing and the apron

const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// order a quad's winding so its emitter front face (U×V) points along `outward`, so a
// single-sided face is visible from outside the volume (backface-cull hides the rest).
function quadOut(c0, c1, c2, c3, outward) {
  const n = vcross(vsub(c1, c0), vsub(c3, c0));
  return vdot(n, outward) >= 0 ? [c0, c1, c2, c3] : [c0, c3, c2, c1];
}

// Curtainwall glazing. `vbays` = number of vertical glass divisions (the vertical
// mullion lines delineating the glass); `vertical` flips to a vertical-fin–dominant
// rhythm (a structural variant). `lit` = Lambert factor for the face.
function airportCurtain(lit, bands, glass = '#9fc0d8', mull = '#42566a', vbays = 5, vertical = false) {
  const g = scaleHex(glass, lit), m = scaleHex(mull, lit * 0.95), mv = scaleHex(mull, lit * 0.72), base = scaleHex(mull, lit * 0.6);
  const F = Math.max(2, bands), V = Math.max(2, vbays);
  if (vertical) {                                   // tall vertical fins + faint floor lines
    return `repeating-linear-gradient(to right, ${m} 0 2.1px, transparent 2.1px calc(100%/${V})),`
      + `repeating-linear-gradient(to top, ${scaleHex(mull, lit * 0.45)} 0 1px, transparent 1px calc(100%/${F})),`
      + `linear-gradient(to bottom, transparent 0 88%, ${base} 88%),${g}`;
  }
  return `repeating-linear-gradient(to top, ${m} 0 1.7px, transparent 1.7px calc(100%/${F})),`          // floor lines (dominant)
    + `repeating-linear-gradient(to right, ${mv} 0 1.5px, transparent 1.5px calc(100%/${V})),`           // vertical mullions delineating the glass
    + `linear-gradient(to bottom, transparent 0 80%, ${base} 80%),`                                      // solid spandrel base
    + g;
}
// The World-renderer RELIEF twin of airportCurtain: the same curtainwall expressed as a
// facade "shirt" card (buildFacadeCard) so scene-three's expandSurfaceCards floats proud
// mullions/spandrels off a recessed glass sheet — the airport buildings stop reading flat
// in the World the way the fractal-city facades already do. Purely additive: the CSS-3D
// path ignores `card` and keeps painting airportCurtain's gradient. `vertical` selects the
// vertical-fin rhythm (pier — dominant pilasters), matching airportCurtain's vertical variant
// and towerGlass; the default `banded` rhythm matches the dominant horizontal floor bands.
function airportCard(glass, mull, bands, bays, vertical = false) {
  return buildFacadeCard({ material: 'glass', rhythm: vertical ? 'pier' : 'banded', glass, frame: mull }, bands, bays);
}
// vertical-mullion glass for the control-tower shaft — a different rhythm again.
function towerGlass(lit, glass = '#8fb6cc', mull = '#3a4a59') {
  const g = scaleHex(glass, lit), m = scaleHex(mull, lit * 0.95);
  return `repeating-linear-gradient(to right, ${m} 0 1.6px, transparent 1.6px 22%),`
    + `repeating-linear-gradient(to top, ${scaleHex(mull, lit * 0.6)} 0 1px, transparent 1px 30%),${g}`;
}

const polyRing = (cx, cy, r, z, N, rot0) => Array.from({ length: N }, (_, i) => { const a = rot0 + (i / N) * 2 * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
// Lambert for a quad, normal flipped to point up (roofs / dome facets).
function litQuadUp(c) {
  let n = vcross(vsub(c[1], c[0]), vsub(c[3], c[0]));
  if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return litFactor([n[0] / l, n[1] / l, n[2] / l], SCENE_LIGHT);
}

// an N-gon prism (the mandala terminal / the tower cab) as raw faces: curtainwall
// sides (front winds outward) + an optional clipped polygon roof cap. `bgFn(lit)` → side CSS.
// `cardFn(bands, bays) -> facade card` is optional; when supplied, each glazed side face also
// carries a World relief "shirt" (see airportCard) on top of its CSS gradient bg.
function prismFaces(cx, cy, r, z0, z1, N, rot0, { bgFn, cardFn = null, roof = AIRPORT_ROOF, cap = true }) {
  const bot = polyRing(cx, cy, r, z0, N, rot0), top = polyRing(cx, cy, r, z1, N, rot0), faces = [];
  const bands = Math.max(2, Math.round((z1 - z0) / 0.62));
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const mx = (bot[i][0] + bot[j][0]) / 2 - cx, my = (bot[i][1] + bot[j][1]) / 2 - cy, ml = Math.hypot(mx, my) || 1;
    const out = [mx / ml, my / ml, 0];
    const chord = Math.hypot(bot[j][0] - bot[i][0], bot[j][1] - bot[i][1]);
    const lit = litFactor(out, SCENE_LIGHT), bays = Math.max(2, Math.round(chord / 0.7));
    const f = { corners: quadOut(bot[i], bot[j], top[j], top[i], out), bg: bgFn(lit, bands, bays) };
    if (cardFn) { f.card = cardFn(bands, bays); f.lit = lit; }
    faces.push(f);
  }
  if (cap) {
    const poly = Array.from({ length: N }, (_, i) => { const a = rot0 + (i / N) * 2 * Math.PI; return `${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`; }).join(', ');
    faces.push({ corners: [[cx - r, cy - r, z1], [cx + r, cy - r, z1], [cx + r, cy + r, z1], [cx - r, cy + r, z1]], fill: scaleHex(roof, litFactor([0, 0, 1], SCENE_LIGHT)), clip: `polygon(${poly})`, doubleSided: true });
  }
  return faces;
}

// a flat polygon roof RING (annulus) at height z — the perimeter roof that carries the
// rooftop kit, surrounding the central curved dome.
function annulusRoofFaces(cx, cy, rOut, rIn, z, N, rot0, tint) {
  const o = polyRing(cx, cy, rOut, z, N, rot0), inn = polyRing(cx, cy, rIn, z, N, rot0), faces = [];
  const f = scaleHex(tint, litFactor([0, 0, 1], SCENE_LIGHT));
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; faces.push({ corners: [o[i], o[j], inn[j], inn[i]], fill: f, doubleSided: true }); }
  return faces;
}

// a SINE-curved vaulted dome ceiling over the concourse: stacked polygon rings whose
// height rises on a quarter-sine from the eave (z=zBase) to the apex (z=zBase+domeH).
function sineDomeFaces(cx, cy, r, zBase, domeH, N, rot0, rings, tint) {
  const level = (k) => polyRing(cx, cy, r * (1 - k / rings), zBase + domeH * Math.sin((k / rings) * Math.PI / 2), N, rot0);
  const faces = [];
  let prev = level(0);
  for (let k = 1; k <= rings; k++) {
    const cur = level(k);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; const q = [prev[i], prev[j], cur[j], cur[i]]; faces.push({ corners: q, fill: scaleHex(tint, litQuadUp(q)), doubleSided: true }); }
    prev = cur;
  }
  return faces;
}

// a plain (flat-tinted) oriented box A→B — the telescoping segment of a jet bridge.
function orientedTubeFaces(A, B, width, z0, z1, tint) {
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, hw = width / 2;
  const aL = [A[0] + nx * hw, A[1] + ny * hw], aR = [A[0] - nx * hw, A[1] - ny * hw];
  const bL = [B[0] + nx * hw, B[1] + ny * hw], bR = [B[0] - nx * hw, B[1] - ny * hw];
  const P = (p, z) => [p[0], p[1], z], faces = [];
  const wall = (p0, p1, out) => faces.push({ corners: quadOut(P(p0, z0), P(p1, z0), P(p1, z1), P(p0, z1), out), fill: scaleHex(tint, litFactor(out, SCENE_LIGHT)) });
  wall(aL, bL, [nx, ny, 0]); wall(aR, bR, [-nx, -ny, 0]); wall(aL, aR, [-ux, -uy, 0]); wall(bL, bR, [ux, uy, 0]);
  faces.push({ corners: [P(aL, z1), P(bL, z1), P(bR, z1), P(aR, z1)], fill: scaleHex(tint, litFactor([0, 0, 1], SCENE_LIGHT)), doubleSided: true });
  return faces;
}

// oriented-bounding-box overlap (separating-axis test) — each plane reserves a footprint
// OBB { c, ux, nx, halfU, halfN }; two planes may only both stand if their OBBs are disjoint.
function obbProj(o, ax) {
  const c = o.c[0] * ax[0] + o.c[1] * ax[1];
  const r = o.halfU * Math.abs(o.ux[0] * ax[0] + o.ux[1] * ax[1]) + o.halfN * Math.abs(o.nx[0] * ax[0] + o.nx[1] * ax[1]);
  return [c - r, c + r];
}
function obbOverlap(a, b) {
  for (const ax of [a.ux, a.nx, b.ux, b.nx]) {
    const pa = obbProj(a, ax), pb = obbProj(b, ax);
    if (pa[1] < pb[0] || pb[1] < pa[0]) return false;
  }
  return true;
}
// the painted aircraft STAND on the apron — the reserved surface area under a plane.
function standPadFace(C, u, n, halfU, halfN, fill) {
  const p = (su, sn) => [C[0] + u[0] * su * halfU + n[0] * sn * halfN, C[1] + u[1] * su * halfU + n[1] * sn * halfN, 0.045];
  return { corners: [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], fill: scaleHex(fill, litFactor([0, 0, 1], SCENE_LIGHT)), doubleSided: true };
}

// a jet bridge as a DARK-GREY telescoping tube: concentric square segments stepping
// DOWN in cross-section toward the plane (the "extendo-spring" read), from the
// concourse edge E to the dock point D (D is placed clear of the fuselage by the caller).
function jetBridgeFaces(E, D) {
  const dx = D[0] - E[0], dy = D[1] - E[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const n = 4, segLen = len / n, zc = 0.6, baseHalf = 0.3, tipHalf = 0.17, faces = [];
  for (let i = 0; i < n; i++) {
    const t0 = i * segLen, t1 = (i + 1) * segLen + 0.06;     // slight overlap → telescoped sections
    const A = [E[0] + ux * t0, E[1] + uy * t0], B = [E[0] + ux * t1, E[1] + uy * t1];
    const half = baseHalf + (tipHalf - baseHalf) * (i / (n - 1));
    faces.push(...orientedTubeFaces(A, B, 2 * half, zc - half, zc + half, i % 2 ? '#33363b' : '#43474d'));
  }
  return faces;
}

// rooftop kit on a (roughly round) roof: HVAC plant + a skylight strip + vent stacks
// + an antenna mast, scattered on the roof ring (boxes → plain shaded box path).
function roofKit(boxes, cx, cy, rInner, rOuter, zMain, zDrum, rng) {
  const ring = (frac, ang, w, d, h, tint, z = zMain) => {
    const r = rInner + (rOuter - rInner) * frac;
    boxes.push({ kind: 'roof-kit', x: cx + Math.cos(ang) * r - w / 2, y: cy + Math.sin(ang) * r - d / 2, w, d, z0: z, z1: z + h, tint });
  };
  ring(0.55, rng() * 6.28, 0.85, 0.6, 0.34, '#6f757b');                 // big HVAC plant
  ring(0.7, rng() * 6.28, 0.5, 0.5, 0.26, '#7a8086');                   // condenser
  ring(0.62, rng() * 6.28, 0.45, 0.45, 0.22, '#82888e');               // vent box
  for (let i = 0; i < 3; i++) ring(0.78, 1.2 + i * 2.1, 0.16, 0.16, 0.45, '#565b61');   // vent stacks
  ring(0.4, rng() * 6.28, 1.3, 0.3, 0.05, '#cdd8dc');                   // skylight strip (flush)
  boxes.push({ kind: 'roof-mast', x: cx - 0.06, y: cy - 0.06, w: 0.12, d: 0.12, z0: zDrum, z1: zDrum + 1.5, tint: '#9aa0a6' });   // antenna on the drum
  boxes.push({ kind: 'roof-mast', x: cx - 0.16, y: cy - 0.07, w: 0.32, d: 0.06, z0: zDrum + 1.2, z1: zDrum + 1.27, tint: '#9aa0a6' });
}

// an oriented (arbitrary-angle) glazed corridor box A→B: two long curtainwall walls +
// two end caps (fronts wind outward) + a fascia roof. The fractal boarding finger.
function corridorFaces(A, B, width, z0, z1, { glass = '#a7c4d6', mull = '#46586a', roof = AIRPORT_ROOF, vertical = false } = {}) {
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, hw = width / 2;
  const aL = [A[0] + nx * hw, A[1] + ny * hw], aR = [A[0] - nx * hw, A[1] - ny * hw];
  const bL = [B[0] + nx * hw, B[1] + ny * hw], bR = [B[0] - nx * hw, B[1] - ny * hw];
  const P = (p, z) => [p[0], p[1], z];
  const bands = Math.max(2, Math.round((z1 - z0) / 0.62));
  const faces = [];
  const wall = (p0, p1, out, span) => {
    const lit = litFactor(out, SCENE_LIGHT), bays = Math.max(2, Math.round(span / 0.7));
    faces.push({ corners: quadOut(P(p0, z0), P(p1, z0), P(p1, z1), P(p0, z1), out), bg: airportCurtain(lit, bands, glass, mull, bays, vertical), card: airportCard(glass, mull, bands, bays, vertical), lit });
  };
  wall(aL, bL, [nx, ny, 0], len); wall(aR, bR, [-nx, -ny, 0], len);     // long sides
  wall(aL, aR, [-ux, -uy, 0], width); wall(bL, bR, [ux, uy, 0], width); // end caps
  faces.push({ corners: [P(aL, z1), P(bL, z1), P(bR, z1), P(aR, z1)], fill: scaleHex(roof, litFactor([0, 0, 1], SCENE_LIGHT)), doubleSided: true });
  return faces;
}

// the control tower: a tall vertical-mullion glass shaft + a flared dark-glazed
// octagonal cab + a roof ring + a thin mast. Its own façade language, not the cab box.
function controlTowerFaces(cx, cy) {
  const faces = [];
  faces.push(...prismFaces(cx, cy, 0.85, 0, 8.0, 4, Math.PI / 4, { bgFn: (lit) => towerGlass(lit), cardFn: (bands, vb) => airportCard('#8fb6cc', '#3a4a59', bands, vb, true), roof: '#6a7078' }));   // shaft
  faces.push(...prismFaces(cx, cy, 1.45, 7.8, 9.5, 8, 0, { bgFn: (lit) => towerGlass(lit, '#33424f', '#222c35'), cardFn: (bands, vb) => airportCard('#33424f', '#222c35', bands, vb, true), roof: '#525861' }));   // flared dark cab
  return { faces, mast: { x: cx - 0.07, y: cy - 0.07, w: 0.14, d: 0.14, z0: 9.5, z1: 11.0, tint: '#9aa0a6' } };
}

// a RADAR DOME (radome): a faceted geodesic hemisphere, off-white with alternating
// panel shades, sitting at z=zBase. Structural variation on terminal roofs / airfield.
function radomeFaces(cx, cy, r, zBase) {
  const N = 10, rings = 4, faces = [];
  const level = (k) => polyRing(cx, cy, r * Math.cos((k / rings) * Math.PI / 2), zBase + r * Math.sin((k / rings) * Math.PI / 2), N, 0);
  let prev = level(0);
  for (let k = 1; k <= rings; k++) {
    const cur = level(k);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; const q = [prev[i], prev[j], cur[j], cur[i]]; faces.push({ corners: q, fill: scaleHex((i + k) % 2 ? '#dfe4e8' : '#cbd1d6', litQuadUp(q)), doubleSided: true }); }
    prev = cur;
  }
  return faces;
}
// a standalone radar station: a thin tower + a radome on top (airfield edge dressing).
function radarStationFaces(cx, cy, h = 4.2, r = 0.85) {
  const tower = prismFaces(cx, cy, 0.32, 0, h, 6, 0, { bgFn: (lit) => scaleHex('#7c8088', lit), roof: '#5c6168' });
  return [...tower, ...radomeFaces(cx, cy, r, h)];
}

// a flat canopy roof on four posts, covering [x,y,w,d] at deck height z
function canopy(boxes, x, y, w, d, z, roofTint = '#8b8378') {
  for (const [px, py] of [[x + 0.18, y + 0.18], [x + w - 0.18, y + 0.18], [x + 0.18, y + d - 0.18], [x + w - 0.18, y + d - 0.18]])
    boxes.push({ kind: 'canopy-post', x: px - 0.07, y: py - 0.07, w: 0.14, d: 0.14, z0: 0, z1: z, tint: '#6f6a61' });
  boxes.push({ kind: 'canopy-roof', x, y, w, d, z0: z, z1: z + 0.18, tint: roofTint });
}

// ── airport ──────────────────────────────────────────────────────────────────
//
// Generative layout: a central terminal anchors the apron, and concourse boarding
// corridors grow out of it as MANJI ARMS — a corridor runs, then HOOKS a right angle
// in a consistent rotational sense (the pinwheel chirality), the 卍 shape real piers
// form to grow gate frontage. The N-fold/spine symmetry is deliberately broken: one
// PRIMARY arm dominates, the rest vary in length + angle, and some collapse to stubs
// (the `asymmetry` knob scales how far). Aircraft are placed from a finite SPACE
// BUDGET — gates are spaced to the jet's length, and a global plane allowance is spent
// gate-by-gate (nearest the terminal first), so a hub fills up realistically.
//
// `glyph` is a coarse topology selector (radial mandala core vs linear spine) kept for
// back-compat; `primary` ('core' | 'spine' | 'hammerhead') is the real driver of which
// element dominates. Same seed → same hub.
export const AIRPORT_GLYPHS = ['radial', 'linear'];
export const AIRPORT_PRIMARIES = ['core', 'spine', 'hammerhead'];
// the apron fleet: which aircraft classes park, and how often. Narrowbody liners
// dominate, jumbos + regionals are common, bizjets sprinkle in. Derived from the
// fixed-wing-aircraft FAMILY's airfield-eligible members (meta-fabricator is the
// single source of truth: add an aircraft type to the vehicle registry and it
// appears here, weighted by its registry `weight` — no edit needed in this file).
const AIRPORT_FLEET = typesInFamily('fixed-wing-aircraft')
  .map((type) => describeType(type))
  .filter((d) => d.contexts.includes('airfield'))
  .map((d) => ({ type: d.type, weight: d.weight }));
// weighted pick from ctx.fleet via the seeded rng
function sampleAircraft(ctx) {
  const total = ctx.fleet.reduce((s, f) => s + f.weight, 0);
  let r = ctx.rng() * total;
  for (const f of ctx.fleet) { r -= f.weight; if (r <= 0) return f; }
  return ctx.fleet[ctx.fleet.length - 1];
}

function planAirport({ region, rng, density, depth, glyph, primary, asymmetry, chirality }, out) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y, y1 = region.y + region.d;
  const { grounds } = out;

  grounds.push({ x: x0 - 1, y: y0 - 1, w: region.w + 2, d: region.d + 2, z: 0, fill: '#3d4147' });          // tarmac base
  grounds.push({ x: x0 + 1, y: y0 + 1, w: region.w - 2, d: region.d - 2, z: 0.02, fill: '#c2c6ce' });       // bright apron (transportApron)

  // the airplane space budget + the shared corridor context. Planes park BROADSIDE
  // (fuselage parallel to the concourse) so each is perpendicular to its radial bridge.
  // A weighted FLEET mixes classes: jumbo widebodies, narrowbody liners, regional jets
  // and little bizjets, each carrying its own world footprint so gates fit any class.
  const planeScale = 2.1;                                   // jets read NEXT TO the multi-storey concourses; nudged up so planes/GSE don't read toy-like (GSE_SCALE tracks this)
  const fleet = AIRPORT_FLEET.map((f) => {
    const fp = aircraftFootprint(f.type, planeScale);
    return { type: f.type, weight: f.weight, scale: planeScale, fuselen: fp.length, wingspan: fp.span, fuseR: fp.radius };
  });
  // gate STEP is sized to the dominant narrowbody (not the longest class) so corridors
  // stay densely gated; a sampled jumbo that won't fit its slot is rejected by the OBB
  // test below, so widebodies naturally settle into the roomier stands.
  const stepClass = fleet.find((f) => f.type === 'airliner') || fleet.reduce((a, b) => (a.fuselen <= b.fuselen ? a : b));
  const ctx = {
    rng, density, faces: out.faces, boxes: out.boxes,
    corW: 1.7, deckZ1: 2.5, fleet,
    gateSpacing: stepClass.fuselen + 1.0,
    minBranch: 4.2,
    budget: Math.round(4 + density * 6),                      // aircraft allowance (spent gate-by-gate)
    apronFloor: y0 + 14,                                      // terminal/planes stay above this; below is the clear apron gap (10–14) + taxiway + runways
    planes: 0, gates: 0, corridors: 0, gse: 0, taxiing: 0, hub: null, placed: [], slots: [], walls: [], mix: {},  // hub + plane OBBs + gate slots + concourse walls + tally
    // generative shape knobs — the manji hook grammar reads these
    chirality: (chirality === 1 || chirality === -1) ? chirality : (rng() < 0.5 ? 1 : -1),   // pinwheel sense of every hook
    asymmetry: Math.max(0, Math.min(1, Number.isFinite(+asymmetry) ? +asymmetry : 0.6)),     // how far symmetry is broken
  };
  const allowance = ctx.budget;
  const branchDepth = Math.max(0, Math.min(2, (Number.isFinite(+depth) ? Math.trunc(+depth) : 2) - 1));

  // resolve the GLYPH (coarse topology) + the PRIMARY shape (the real dominance driver).
  // An explicit value wins; otherwise primary derives the glyph (spine→linear,
  // core/hammerhead→radial), and a missing primary derives from the glyph.
  const prim = AIRPORT_PRIMARIES.includes(primary) ? primary : null;
  const g = AIRPORT_GLYPHS.includes(glyph) ? glyph
    : prim === 'spine' ? 'linear' : (prim === 'core' || prim === 'hammerhead') ? 'radial'
    : (rng() < 0.5 ? 'radial' : 'linear');
  ctx.primary = prim || (g === 'linear' ? 'spine' : (rng() < 0.5 ? 'core' : 'hammerhead'));
  const T = g === 'linear' ? glyphLinear(ctx, region, rng, branchDepth, out) : glyphRadial(ctx, region, rng, branchDepth, out);

  // everything below the apron floor — the clear apron buffer, the taxiway, and the
  // runways — is OFF-LIMITS to parked aircraft. One big wall up to apronFloor keeps planes
  // off the runway/taxiway AND leaves a clear strip of open apron between them and the gates.
  const bandLo = y0 - 0.5, bandHi = ctx.apronFloor;
  ctx.walls.push({ c: [(x0 + x1) / 2, (bandLo + bandHi) / 2], ux: [1, 0], nx: [0, 1], halfU: region.w / 2 + 1, halfN: (bandHi - bandLo) / 2 });

  // the whole terminal now exists → fill the gate slots (budget met, no superposition)
  // and stage the larger service trucks across the clear apron as ants.
  fillGates(ctx, region);
  scatterApronAnts(ctx, region);
  addTaxiingPlanes(ctx, region);   // a few aircraft live on the tarmac (taxiing) so the field reads active

  // shared airfield kit: control tower + radomes + a standalone radar station
  const tower = controlTowerFaces(T.tx, T.ty);
  out.faces.push(...tower.faces); out.boxes.push(tower.mast);
  out.faces.push(...radomeFaces(T.tx - 2.0, T.ty - 1.4, 0.85, 0));          // ground radome beside the tower
  out.faces.push(...radarStationFaces(x0 + 3, y0 + 9.5));                    // standalone radar station on the field

  airportStrip([x0 + 1, y0 + 8.5], [x1 - 1, y0 + 8.5], { type: 'tarmac', width: 3 }).ribbons.forEach((r) => out.ribbons.push(r));   // taxiway
  for (const cyl of [y0 + 2.7, y0 + 6.0]) airportStrip([x0 + 1, cyl], [x1 - 1, cyl], { type: 'runway', width: 2.6 }).ribbons.forEach((r) => out.ribbons.push(r));   // two runways
  for (const [fx, fy] of [[x0 + 2.5, y0 + 11], [x1 - 2.5, y0 + 11], [x0 + 2.5, y1 - 2], [x1 - 2.5, y1 - 2]]) floodMast(out.boxes, fx, fy);

  out.stats = { mode: 'airport', glyph: g, primary: ctx.primary, chirality: ctx.chirality, asymmetry: +ctx.asymmetry.toFixed(2), arms: T.arms, corridors: ctx.corridors, gates: ctx.gates, planes: ctx.planes, taxiing: ctx.taxiing, gse: ctx.gse, mix: ctx.mix, budget: allowance };
  out.debug = { region, hub: ctx.hub, placed: ctx.placed, walls: ctx.walls };   // top-down introspection (overlap/fit checks)
}

// RADIAL glyph — a central N-fold polygon terminal (the mandala). Glazed walls, a flat
// perimeter roof ring (rooftop kit + a roof radome), a vertical-mullion clerestory drum,
// a sine-curved dome ceiling, and concourses growing out as manji arms. A 'core' primary
// enlarges the headhouse; 'hammerhead' shrinks it and forces the primary arm to a cross.
function glyphRadial(ctx, region, rng, branchDepth, out) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y;
  const hcx = (x0 + x1) / 2, hcy = ctx.apronFloor + 13;   // hub sits a full spoke-reach above the apron floor → normal spokes land at the gap, not in it
  const N = 4, rot0 = rng() * Math.PI;   // four spokes per hub reads cleanly; the asymmetry/stub grammar below still breaks the symmetry
  const isCore = ctx.primary === 'core', isHammer = ctx.primary === 'hammerhead';
  const hubR = isCore ? 4.4 : isHammer ? 3.0 : 3.6, hubZ = isCore ? 4.1 : 3.7;
  const rDome = hubR * 0.66, clerZ = hubZ + 0.55, domeH = 1.7, apexZ = clerZ + domeH;
  out.faces.push(...prismFaces(hcx, hcy, hubR, 0, hubZ, N, rot0, { bgFn: (lit, bands, vb) => airportCurtain(lit, bands, '#a9c6d8', '#3f5366', vb), cardFn: (bands, vb) => airportCard('#a9c6d8', '#3f5366', bands, vb), cap: false }));
  out.faces.push(...annulusRoofFaces(hcx, hcy, hubR, rDome, hubZ, N, rot0, AIRPORT_ROOF));
  out.faces.push(...prismFaces(hcx, hcy, rDome, hubZ, clerZ, N, rot0, { bgFn: (lit, bands, vb) => airportCurtain(lit, bands, '#c2dbe8', '#52677a', vb, true), cardFn: (bands, vb) => airportCard('#c2dbe8', '#52677a', bands, vb, true), cap: false }));  // vertical-fin clerestory
  out.faces.push(...sineDomeFaces(hcx, hcy, rDome, clerZ, domeH, N, rot0, 7, scaleHex(AIRPORT_ROOF, 1.06)));
  roofKit(out.boxes, hcx, hcy, rDome + 0.2, hubR * 0.95, hubZ, apexZ, rng);
  const ra = rot0 + 0.7, rk = (rDome + hubR) / 2;
  out.faces.push(...radomeFaces(hcx + Math.cos(ra) * rk, hcy + Math.sin(ra) * rk, 0.7, hubZ));   // a radome on the roof ring
  // one PRIMARY arm dominates (longer, branches deeper); the rest vary in length +
  // angle, and some collapse to short stubs — broken N-fold symmetry.
  const primaryIdx = Math.floor(rng() * N), asym = ctx.asymmetry;
  for (let i = 0; i < N; i++) {
    const ang = rot0 + (i + 0.5) / N * 2 * Math.PI + (rng() - 0.5) * asym * 0.5;   // perturbed spoke
    let len = 8.5 * (1 + (rng() - 0.5) * asym * 0.8), depth = branchDepth, force = null;
    const stub = rng() < asym * 0.3;
    if (i === primaryIdx) { len = 8.5 * (isHammer ? 1.7 : 1.5); force = isHammer ? 'cross' : null; }
    else if (stub) { len *= 0.42; depth = 0; }
    const A = [hcx + Math.cos(ang) * (hubR + 0.05), hcy + Math.sin(ang) * (hubR + 0.05)];
    concourse(ctx, A, ang, len, depth, rng() < 0.4, force);     // some fingers glazed with vertical fins
  }
  ctx.hub = { cx: hcx, cy: hcy, R: hubR };
  ctx.walls.push({ c: [hcx, hcy], ux: [1, 0], nx: [0, 1], halfU: hubR, halfN: hubR });   // the headhouse — planes/ants must clear it
  return { tx: hcx + hubR + 2.4, ty: hcy + 1.5, arms: N };
}

// LINEAR glyph — a long central concourse SPINE with PERPENDICULAR finger bays growing
// off both sides (a pier terminal). A 'spine' primary builds the spine taller. Finger
// count, position + length all vary, with one PRIMARY finger pair running long; each
// finger still manji-hooks at its tip. Spine roof carries kit + radomes.
function glyphLinear(ctx, region, rng, branchDepth, out) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y;
  const hcy = ctx.apronFloor + 11, sx0 = x0 + 5, sx1 = x1 - 5, sLen = sx1 - sx0;   // spine sits a finger-reach above the apron floor → fingers land at the gap, not in it
  const spineW = 2.4, spineZ = ctx.primary === 'spine' ? 3.7 : 3.2;
  out.faces.push(...corridorFaces([sx0, hcy], [sx1, hcy], spineW, 0, spineZ, { glass: '#a9c6d8', mull: '#3f5366' }));   // glazed hall
  ctx.walls.push(wallObb([sx0, hcy], [sx1, hcy], spineW));   // the spine is a wall planes must clear
  // spine roof kit + radomes + a mast
  for (let k = 0; k < 4; k++) { const px = sx0 + sLen * ((k + 0.5) / 4); out.boxes.push({ kind: 'roof-kit', x: px - 0.4, y: hcy - 0.3, w: 0.8, d: 0.6, z0: spineZ, z1: spineZ + 0.3, tint: '#6f757b' }); }
  out.boxes.push({ kind: 'roof-mast', x: (sx0 + sx1) / 2 - 0.06, y: hcy - 0.06, w: 0.12, d: 0.12, z0: spineZ, z1: spineZ + 1.6, tint: '#9aa0a6' });
  out.faces.push(...radomeFaces(sx0 + sLen * 0.3, hcy, 0.7, spineZ), ...radomeFaces(sx0 + sLen * 0.72, hcy, 0.6, spineZ));
  // perpendicular finger bays on both sides
  const asym = ctx.asymmetry, nFingers = 3 + Math.floor(rng() * 2), primaryIdx = Math.floor(rng() * nFingers);   // fewer, wider-spaced fingers so bigger jets fit between them
  for (let i = 0; i < nFingers; i++) {
    const fx = sx0 + sLen * ((i + 0.5) / nFingers) + (rng() - 0.5) * asym * 1.5, vfin = rng() < 0.4;
    let lenN = 6.0 * (1 + (rng() - 0.5) * asym * 0.7), lenS = 6.0 * (1 + (rng() - 0.5) * asym * 0.7);
    if (i === primaryIdx) { lenN *= 1.5; lenS *= 1.5; }
    concourse(ctx, [fx, hcy + spineW / 2], Math.PI / 2, lenN, Math.min(branchDepth, 1), vfin);    // toward the camera
    concourse(ctx, [fx, hcy - spineW / 2], -Math.PI / 2, lenS, Math.min(branchDepth, 1), vfin);   // toward the far edge
  }
  return { tx: sx1 + 1.6, ty: hcy + 2.2, arms: nFingers * 2 };
}

// one boarding concourse from A along `angle` for `length`, lining both sides with
// gates, then a MANJI HOOK at the tip: instead of a symmetric Y-fork, the corridor
// turns a RIGHT ANGLE in a consistent rotational sense (ctx.chirality) — the 卍 arm
// real piers/bays form to grow apron frontage. The move varies: a single hook, a
// both-sides cross (a hammerhead), or a straight run-on with one side finger.
// `forceMove` pins the first move (gives a hammerhead primary arm its cross).
function concourse(ctx, A, angle, length, depth, vertical = false, forceMove = null) {
  // clip a corridor heading toward the runway so the TERMINAL never grows into the apron
  // buffer / runway zone — it stops at the apron floor (keeps the gap between gates and runway).
  const sy = Math.sin(angle);
  if (sy < -1e-6) {
    if (A[1] <= ctx.apronFloor) return;                         // already at/below the floor → nothing to grow
    length = Math.min(length, (ctx.apronFloor - A[1]) / sy);    // truncate so B lands on the apron floor
    if (length < ctx.corW) return;
  }
  const B = [A[0] + Math.cos(angle) * length, A[1] + Math.sin(angle) * length];
  ctx.corridors++;
  ctx.faces.push(...corridorFaces(A, B, ctx.corW, 0, ctx.deckZ1, { vertical }));
  collectGates(ctx, A, B);
  if (depth <= 0 || length <= ctx.minBranch) return;
  const child = length * (0.55 + ctx.rng() * 0.12);            // decayed + jittered child length
  const turn = ctx.chirality * Math.PI / 2;                    // the 90° pinwheel hook
  const move = forceMove || (ctx.rng() < 0.52 ? 'hook' : ctx.rng() < 0.74 ? 'cross' : 'continue');
  if (move === 'hook') {
    concourse(ctx, B, angle + turn, child, depth - 1, vertical);
  } else if (move === 'cross') {                               // hammerhead — both perpendicular sides
    concourse(ctx, B, angle + turn, child, depth - 1, vertical);
    concourse(ctx, B, angle - turn, child * (0.7 + ctx.rng() * 0.3), depth - 1, vertical);
  } else {                                                     // run straight on + one side finger (a pier)
    concourse(ctx, B, angle, child, depth - 1, vertical);
    if (length > ctx.minBranch * 1.15) concourse(ctx, B, angle + turn, child * 0.72, depth - 1, vertical);
  }
}

// an OBB {c,ux,nx,halfU,halfN} for a corridor segment of width w — a WALL that parked
// planes (and apron ants) must clear, so nothing is drawn on top of a concourse.
function wallObb(A, B, w) {
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
  const ux = [dx / len, dy / len], nx = [-ux[1], ux[0]];
  return { c: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], ux, nx, halfU: len / 2, halfN: w / 2 };
}
// ENUMERATE gate slots along a corridor (filled later by fillGates, once the WHOLE
// terminal exists so a plane can be tested against every concourse). The corridor itself
// is recorded as a wall. A slot = edge point + outward normal + corridor axis; both flanks
// of the corridor get a slot at each station.
function collectGates(ctx, A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy);
  ctx.walls.push(wallObb(A, B, ctx.corW));
  if (len < ctx.gateSpacing * 0.6) return;                  // too short to hold even a downgraded bay
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, u = [ux, uy];
  // at least one station (midpoint) on a short arm; evenly spaced stations on longer ones
  const n = Math.max(1, Math.floor((len - ctx.gateSpacing * 0.5) / ctx.gateSpacing) + 1);
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? len / 2 : ctx.gateSpacing * 0.55 + (len - ctx.gateSpacing * 1.0) * (i / (n - 1));
    const ex = A[0] + ux * t, ey = A[1] + uy * t;
    for (const side of [1, -1]) { ctx.gates++; ctx.slots.push({ e: [ex, ey], u, nOut: [nx * side, ny * side] }); }
  }
}
// does a plane footprint sit clear of every concourse + every placed plane, and inside
// the apron edge? The plane-vs-building test the old per-corridor pass could not do.
function planeFits(obb, ctx, region, margin = 0.4) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y, y1 = region.y + region.d;
  for (const [su, sn] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const px = obb.c[0] + obb.ux[0] * su * obb.halfU + obb.nx[0] * sn * obb.halfN;
    const py = obb.c[1] + obb.ux[1] * su * obb.halfU + obb.nx[1] * sn * obb.halfN;
    if (px < x0 + margin || px > x1 - margin || py < y0 + margin || py > y1 - margin) return false;
  }
  for (const w of ctx.walls) if (obbOverlap(obb, w)) return false;
  for (const o of ctx.placed) if (obbOverlap(obb, o)) return false;
  return true;
}
// SPEND the plane budget over the collected slots, in TWO passes so the apron keeps a
// believable fleet mix AND the budget is met without superposition:
//   pass 1 — honour the weighted sampled class at each slot (NO downgrade), so widebodies
//            and narrowbodies land in the roomy bays where they actually fit;
//   pass 2 — spend any leftover budget on still-empty slots with the LARGEST class that
//            fits, mopping up the tight bays (typically with regionals / bizjets).
// A single greedy downgrade pass would shrink almost everything to bizjets, because gate
// stations are spaced to the narrowbody and a sampled jumbo nearly always has to downgrade.
function fillGates(ctx, region) {
  const bySize = [...ctx.fleet].sort((a, b) => b.fuselen - a.fuselen);     // largest → smallest
  const hub = ctx.hub;
  const slots = ctx.slots
    .map((s, i) => ({ ...s, i, key: (hub ? Math.hypot(s.e[0] - hub.cx, s.e[1] - hub.cy) : 0) + ctx.rng() * 2 }))
    .sort((a, b) => b.key - a.key);                                        // outer (roomy) bays first
  const tryPlace = (s, ac) => {
    const gateOffset = ctx.corW / 2 + 0.55 + ac.wingspan / 2;              // push the plane out so its near wing clears the concourse
    const doorAhead = ac.fuselen * 0.32;                                   // door sits forward of the fuselage centre
    const C = [s.e[0] + s.nOut[0] * gateOffset - s.u[0] * doorAhead, s.e[1] + s.nOut[1] * gateOffset - s.u[1] * doorAhead];
    const obb = { c: C, ux: s.u, nx: s.nOut, halfU: ac.fuselen / 2 + 0.3, halfN: ac.wingspan / 2 + 0.3 };
    if (!planeFits(obb, ctx, region)) return false;
    ctx.placed.push(obb); emitPlane(ctx, s, ac, C, gateOffset);
    ctx.budget--; ctx.planes++; ctx.mix[ac.type] = (ctx.mix[ac.type] || 0) + 1;
    return true;
  };
  const used = new Set();
  for (const s of slots) { if (ctx.budget <= 0) break; if (tryPlace(s, sampleAircraft(ctx))) used.add(s.i); }   // pass 1: weighted class, no downgrade
  for (const s of slots) {                                                 // pass 2: fill remaining bays to meet budget
    if (ctx.budget <= 0) break;
    if (used.has(s.i)) continue;
    for (const ac of bySize) if (tryPlace(s, ac)) { used.add(s.i); break; }
  }
}
// draw a parked plane: its painted stand, the aircraft (broadside, fuselage ∥ concourse),
// the telescoping jet bridge, and the ONE small door-service vehicle (boarding stairs)
// that genuinely docks the plane. The larger trucks are staged on the apron as ants.
function emitPlane(ctx, slot, ac, C, gateOffset) {
  const u = slot.u, nOut = slot.nOut, ex = slot.e[0], ey = slot.e[1];
  ctx.faces.push(standPadFace(C, u, nOut, ac.fuselen / 2 + 0.25, ac.wingspan / 2 + 0.25, '#9fa4ac'));
  ctx.faces.push(...vehicleFaces({ type: ac.type, cx: C[0], cy: C[1], heading: Math.atan2(u[1], u[0]), scale: ac.scale, quality: 0.25, stations: 16, angles: 13, camHint: APRON_CAM, livery: pickAircraftLiveryScheme(ctx.rng) }));
  const E = [ex + nOut[0] * (ctx.corW / 2 - 0.05), ey + nOut[1] * (ctx.corW / 2 - 0.05)];
  const D = [ex + nOut[0] * (gateOffset - ac.fuseR - 0.05), ey + nOut[1] * (gateOffset - ac.fuseR - 0.05)];
  ctx.faces.push(...jetBridgeFaces(E, D));
  if (ctx.rng() < 0.85) {                                                  // boarding stairs nosed at the forward door
    const G = [C[0] + nOut[0] * (ac.fuseR + 0.40) + u[0] * ac.fuselen * 0.22, C[1] + nOut[1] * (ac.fuseR + 0.40) + u[1] * ac.fuselen * 0.22];
    ctx.faces.push(...vehicleFaces({ type: 'boardingStairs', cx: G[0], cy: G[1], heading: Math.atan2(-nOut[1], -nOut[0]), scale: GSE_SCALE, quality: 0.25, camHint: APRON_CAM }));
    ctx.gse++;
  }
}
// scatter the LARGER ground vehicles across CLEAR apron as 'ants' — service trucks staged
// AWAY from the aircraft (not docked), each placed only where it clears every concourse,
// every plane, the hub, the runway/taxiway band, and its sibling ants. Deterministic.
const APRON_ANTS = [{ type: 'cateringTruck', w: 3 }, { type: 'beltLoader', w: 3 }, { type: 'opsWagon', w: 2 }];
function scatterApronAnts(ctx, region) {
  const x0 = region.x, y0 = region.y, hub = ctx.hub;
  const target = Math.round(ctx.planes * 1.2 + ctx.density * 4), antTot = APRON_ANTS.reduce((s, a) => s + a.w, 0);
  const ants = [];
  let tries = 0;
  while (ants.length < target && tries < target * 40) {
    tries++;
    const px = x0 + 1 + ctx.rng() * (region.w - 2), py = y0 + 1 + ctx.rng() * (region.d - 2);
    if (py < ctx.apronFloor) continue;                                     // keep off the apron gap + taxiway + runways
    const head = ctx.rng() * Math.PI * 2, cs = Math.cos(head), sn = Math.sin(head);
    const obb = { c: [px, py], ux: [cs, sn], nx: [-sn, cs], halfU: 0.55, halfN: 0.34 };
    if (hub && Math.hypot(px - hub.cx, py - hub.cy) < hub.R + 0.9) continue;
    if (ctx.walls.some((w) => obbOverlap(obb, w))) continue;
    if (ctx.placed.some((o) => obbOverlap(obb, o))) continue;
    if (ants.some((a) => obbOverlap(obb, a))) continue;
    ants.push(obb);
    let r = ctx.rng() * antTot, pick = APRON_ANTS[0];
    for (const a of APRON_ANTS) { r -= a.w; if (r <= 0) { pick = a; break; } }
    ctx.faces.push(...vehicleFaces({ type: pick.type, cx: px, cy: py, heading: head, scale: GSE_SCALE, quality: 0.25, camHint: APRON_CAM }));
    ctx.gse++;
  }
}
// a few aircraft LIVE ON THE TARMAC — taxiing along the taxiway — so the field reads as
// active, not a static gate line. They sit on the movement area (below the apron floor,
// where parked planes can't go), nose along the lane, spaced so they don't pile up. Jumbos
// stay at the gates (their wing sweep is too wide for the lane). Counted separately from
// the gate budget.
function addTaxiingPlanes(ctx, region) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y;
  const tw = y0 + 8.5;                                                      // taxiway centerline
  const target = 1 + Math.round(ctx.density * 2);                           // 1–3 taxiing aircraft
  const lane = [];
  let tries = 0;
  while (lane.length < target && tries < target * 14) {
    tries++;
    const ac = sampleAircraft(ctx);
    if (ac.type === 'widebody') continue;                                  // jumbos taxi too wide for this lane — keep them gated
    const heading = ctx.rng() < 0.5 ? 0 : Math.PI;                         // rolling either way along the lane
    const tx = x0 + 4 + ctx.rng() * (region.w - 8);
    if (tx - ac.fuselen / 2 < x0 + 2 || tx + ac.fuselen / 2 > x1 - 2) continue;
    const obb = { c: [tx, tw], ux: [Math.cos(heading), Math.sin(heading)], nx: [-Math.sin(heading), Math.cos(heading)], halfU: ac.fuselen / 2 + 0.6, halfN: ac.wingspan / 2 + 0.4 };
    if (lane.some((o) => obbOverlap(o, obb))) continue;                    // don't stack taxiing planes on each other
    lane.push(obb);
    ctx.faces.push(...vehicleFaces({ type: ac.type, cx: tx, cy: tw, heading, scale: ac.scale, quality: 0.25, stations: 16, angles: 13, camHint: APRON_CAM, livery: pickAircraftLiveryScheme(ctx.rng) }));
    ctx.taxiing++; ctx.mix[ac.type] = (ctx.mix[ac.type] || 0) + 1;
  }
}

// ── train-station ──────────────────────────────────────────────────────────────
function planTrainStation({ region, rng, density }, out) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y, y1 = region.y + region.d;
  const { boxes, grounds } = out;

  grounds.push({ x: x0 - 1, y: y0 - 1, w: region.w + 2, d: region.d + 2, z: 0, fill: '#4b4a44' });          // ground
  boxes.push({ kind: 'building', shape: 'box', x: x0 + 2.5, y: y1 - 5, w: region.w - 5, d: 3, z0: 0, z1: 4.6 });   // head-house

  const platY0 = y0 + 5, platY1 = y1 - 6, platLen = platY1 - platY0;
  const nPlat = 4, platW = 1.5, track = 1.9;
  const totalSpan = nPlat * platW + (nPlat - 1) * track;
  const startX = (x0 + x1) / 2 - totalSpan / 2;
  const trainLivery = ['#9c4b4b', '#3f6e8c', '#4a7a55', '#b08a3a'];
  for (let p = 0; p < nPlat; p++) {
    const px = startX + p * (platW + track);
    boxes.push({ kind: 'platform', x: px, y: platY0, w: platW, d: platLen, z0: 0, z1: 0.3, tint: '#c1b8aa' });   // raised platform slab (railPlatform)
    platformCanopy(boxes, px - 0.1, platY0 + 1, platW + 0.2, platLen - 2, 3.0);
    if (p < nPlat - 1) {                                                                                          // a track in the gap to the next platform
      const tx = px + platW + track / 2;
      grounds.push({ kind: 'ballast', x: tx - 0.8, y: platY0, w: 1.6, d: platLen, z: 0.05, fill: '#57534d' });
      for (const ox of [-0.5, 0.5]) grounds.push({ kind: 'rail', x: tx + ox - 0.05, y: platY0, w: 0.1, d: platLen, z: 0.12, fill: '#9a9488' });
      if (rng() < 0.3 + density * 0.5) trainConsist(boxes, tx, platY0 + 1.5, platLen - 3, trainLivery[p % trainLivery.length]);
    }
  }
  // a footbridge crossing all the platforms, on posts, near the platform mid
  const fbY = platY0 + platLen * 0.5;
  boxes.push({ kind: 'footbridge', x: startX - 0.6, y: fbY - 0.65, w: totalSpan + 1.2, d: 1.3, z0: 3.0, z1: 3.32, tint: '#8a8276' });
  for (let p = 0; p <= nPlat; p++) boxes.push({ kind: 'footbridge-post', x: startX - 0.4 + p * (platW + track) - 0.08, y: fbY - 0.08, w: 0.16, d: 0.16, z0: 0, z1: 3.0, tint: '#6f6a61' });
  for (const fx of [startX - 1.6, startX + totalSpan + 1.6]) floodMast(boxes, fx, platY0 + platLen * 0.5);

  out.stats = { mode: 'train-station', platforms: nPlat };
}

// a long flat platform canopy: a thin roof on a row of paired posts down its length
function platformCanopy(boxes, x, y, w, len, z) {
  boxes.push({ kind: 'canopy-roof', x, y, w, d: len, z0: z, z1: z + 0.16, tint: '#8d8a82' });
  for (let py = y + 0.6; py < y + len; py += 3.5) for (const px of [x + 0.15, x + w - 0.15])
    boxes.push({ kind: 'canopy-post', x: px - 0.06, y: py - 0.06, w: 0.12, d: 0.12, z0: 0, z1: z, tint: '#6f6a61' });
}

// a multi-car train sitting on a track centerline (along +y): boxed carriages with a
// dark window stripe, small couplers between cars.
function trainConsist(boxes, cx, y0, len, livery) {
  const carLen = 2.6, gap = 0.35, n = Math.max(2, Math.floor(len / (carLen + gap)));
  for (let i = 0; i < n; i++) {
    const cy = y0 + i * (carLen + gap);
    boxes.push({ kind: 'train-car', x: cx - 0.55, y: cy, w: 1.1, d: carLen, z0: 0.3, z1: 1.85, tint: livery });
    boxes.push({ kind: 'train-window', x: cx - 0.58, y: cy + 0.25, w: 1.16, d: carLen - 0.5, z0: 1.25, z1: 1.6, tint: '#23262b' });
  }
}

// ── bus-terminal ─────────────────────────────────────────────────────────────
function planBusTerminal({ region, rng, density }, out) {
  const x0 = region.x, x1 = region.x + region.w, y0 = region.y, y1 = region.y + region.d;
  const { boxes, grounds, faces } = out;

  grounds.push({ x: x0 - 1, y: y0 - 1, w: region.w + 2, d: region.d + 2, z: 0, fill: '#3f444b' });          // apron base
  grounds.push({ x: x0 + 1, y: y0 + 4, w: region.w - 2, d: region.d - 12, z: 0.02, fill: '#c2c6ce' });      // bright apron
  boxes.push({ kind: 'building', shape: 'box', x: x0 + 2.5, y: y1 - 5, w: region.w - 5, d: 3, z0: 0, z1: 3.8 });   // concourse

  // sawtooth gate line: a staggered row of buses parked at a constant slant, each
  // under a small bay canopy + numbered pylon. The slant is what makes it read as a
  // sawtooth jetty rather than a parking row.
  const nBay = 6, tilt = 0.5, heading = -Math.PI / 2 + tilt, bayY = y1 - 8.5;
  let buses = 0;
  for (let i = 0; i < nBay; i++) {
    const bx = x0 + 3.5 + (region.w - 7) * ((i + 0.5) / nBay);
    canopy(boxes, bx - 0.8, bayY - 0.4, 1.6, 1.2, 2.8);
    boxes.push({ kind: 'bay-pylon', x: bx - 0.07, y: bayY - 1.5, w: 0.14, d: 0.14, z0: 0, z1: 2.2, tint: '#5a5f66' });
    if (rng() < 0.4 + density * 0.5) { faces.push(...vehicleFaces({ type: 'cityBus', cx: bx, cy: bayY, heading, scale: 1.0, camHint: APRON_CAM })); buses++; }
  }

  // a drive lane sweeping across the apron + a back row of laid-up buses nose-in (−y)
  groundStreet([x0 + 1, y0 + 7], [x1 - 1, y0 + 7], { width: 2.4, laneLine: true, asphalt: '#3a414b' }).ribbons.forEach((r) => out.ribbons.push(r));
  for (let i = 0; i < 5; i++) {
    const bx = x0 + 4 + (region.w - 8) * (i / 4);
    if (rng() < 0.55) { faces.push(...vehicleFaces({ type: 'cityBus', cx: bx, cy: y0 + 4.2, axis: 'y', dir: -1, scale: 1.0, camHint: APRON_CAM })); buses++; }
  }
  for (const [fx, fy] of [[x0 + 2.5, y0 + 8.5], [x1 - 2.5, y0 + 8.5], [x0 + 2.5, bayY], [x1 - 2.5, bayY]]) floodMast(boxes, fx, fy);

  out.stats = { mode: 'bus-terminal', bays: nBay, buses };
}

const PLANNERS = { airport: planAirport, 'train-station': planTrainStation, 'bus-terminal': planBusTerminal };

/**
 * Plan a transportation hub.
 * @param {object} o
 * @param {'airport'|'train-station'|'bus-terminal'} o.mode
 * @param {{x,y,w,d}} o.region   world footprint of the whole scene
 * @param {number}    o.seed
 * @param {number}    o.density  0.2–1 — how full the gates/platforms/bays are
 * @param {number}    o.depth    1–3 — fractal corridor branch depth (airport)
 * @param {'core'|'spine'|'hammerhead'} [o.primary]  airport: the dominant shape (default seeded)
 * @param {number}    [o.asymmetry]  airport: 0–1, how far symmetry is broken (default 0.6)
 * @param {1|-1}      [o.chirality]  airport: pinwheel sense of the manji hooks (default seeded)
 * @returns {{ boxes, grounds, ribbons, faces, sources, stats }}
 */
export function planTransportationHub({ region = DEFAULT_REGION, mode = 'airport', seed = 1, density = 0.6, depth = 2, glyph, primary, asymmetry, chirality } = {}) {
  const planner = PLANNERS[mode] || planAirport;
  const rng = mulberry32(seed >>> 0 || 1);
  const d = Math.max(0.2, Math.min(1, Number.isFinite(+density) ? +density : 0.6));
  const out = { boxes: [], grounds: [], ribbons: [], faces: [], stats: {} };
  planner({ region, rng, density: d, depth, glyph, primary, asymmetry, chirality }, out);
  out.sources = floodSources(out.boxes);
  out.stats = { ...out.stats, boxes: out.boxes.length, grounds: out.grounds.length, ribbons: out.ribbons.length, faces: out.faces.length };
  return out;
}

// read the warm flood-mast heads back as downward light cones for the night bake —
// the same lamp-heads-as-emitters pattern fractal-city uses.
function floodSources(boxes) {
  const sources = [];
  for (const b of boxes) if (b.kind === 'flood-head' && b.tint === FLOOD_HEAD)
    sources.push({ pos: [b.x + b.w / 2, b.y + b.d / 2, b.z0], dir: [0, 0, -1], spread: 70, color: [1, 0.82, 0.5], intensity: 2.4, rays: 60, bounces: 1, glowBlur: 20, glowSpread: 9, fixtureR: 0.2 });
  return sources;
}

const HUB_CAMERAS = [
  { name: 'apron', worldFraming: { cameraPosition: APRON_CAM, lookAt: [20, 22, 3], horizontalFov: 70, pictureCenter: [600, 380] } },
  { name: 'aerial', worldFraming: { cameraPosition: [20, -10, 54], lookAt: [20, 24, 0], horizontalFov: 58, pictureCenter: [600, 380] } },
];

const NIGHT_DIFFUSION = { soft: true, gain: 2.6, softness: 1.0, shadows: true, shadowStrength: 1.15, shadowMaxAlpha: 0.5 };
const DAY_DIFFUSION = { soft: true, gain: 1.9, softness: 1.05, shadows: true, shadowStrength: 1.0, shadowMaxAlpha: 0.4 };

// the DAY sun: one external warm source high above + to the side (mirrors the city)
function daySun(region) {
  const cx = region.x + region.w / 2, cy = region.y + region.d / 2;
  const sx = region.x + region.w * 1.0, sy = region.y - region.d * 0.55, sz = 40;
  const dx = cx - sx, dy = cy - sy, dz = -sz, dl = Math.hypot(dx, dy, dz) || 1;
  return { pos: [sx, sy, sz], dir: [dx / dl, dy / dl, dz / dl], spread: 40, color: [1, 0.95, 0.82], intensity: 2.5, rays: 440, bounces: 1, fixture: false };
}

/**
 * Plan + render a transportation hub as self-contained preserve-3d HTML.
 * `opts.time` ('day' | 'night') selects the daylight model: a day sun (lit decks +
 * cast shadows + day sky) or a night scene (flood-mast sources + moonlight + stars).
 */
export function assembleTransportationHubScene(opts = {}) {
  const region = opts.region || DEFAULT_REGION;
  const plan = planTransportationHub({ ...opts, region });
  const { boxes, grounds, ribbons, faces } = plan;
  const time = opts.time || (opts.night ? 'night' : opts.day ? 'day' : null);
  const night = time === 'night', day = time === 'day';
  let sources = night ? (opts.sources || plan.sources) : day ? [daySun(region)] : (opts.sources || []);
  const cap = opts.maxLamps ?? 16;
  if (night && sources.length > cap) sources = Array.from({ length: cap }, (_, i) => sources[Math.floor(i * (sources.length / cap))]);
  return assembleBoxCityScene({
    boxes, grounds, ribbons, faces,
    sources,
    diffusion: opts.diffusion || (night ? NIGHT_DIFFUSION : day ? DAY_DIFFUSION : {}),
    moonlight: opts.moonlight ?? (night ? true : undefined),
    light: opts.light || (night ? makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.08, diffuse: 0.06 })
      : day ? makeLight({ direction: [0.35, 0.4, -0.85], ambient: 0.5, diffuse: 0.4 }) : undefined),
    cameras: opts.cameras || HUB_CAMERAS,
    viewBox: opts.viewBox || { width: 1200, height: 760 },
    unitScale: opts.unitScale || 20,
    title: opts.title || `mojulo transportation hub · ${opts.mode || 'airport'}`,
    ...(opts.sky ? { sky: opts.sky } : night ? { sky: { preset: 'night', stars: true, moon: true, seed: opts.seed ?? 7 } } : day ? { sky: { preset: 'day' } } : {}),
  });
}

export function renderTransportationHubToHtml(opts = {}) {
  return emitPreserve3dScene({ ...assembleTransportationHubScene(opts), signs: opts.signs });
}
