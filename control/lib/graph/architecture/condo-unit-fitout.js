/**
 * condo-unit-fitout — FRACTALLY populate a condo bachelor/apartment shell with a furnished,
 * varied interior. Each unit is seeded from its WORLD POSITION (so the concourse is
 * deterministic but every unit differs), an apartment ARCHETYPE is drawn (studio / one-bed /
 * loft), the interior is RECURSIVELY subdivided (a BSP, mirroring fractal-city's `splitRect`)
 * into program zones, and each zone is furnished from the feet-based asset builders.
 *
 * All geometry is done in UNIT-LOCAL coordinates: `al` runs ALONG the hall (units sit side by
 * side), `depth` runs from the hall glass (depth 0) into the unit toward the back wall
 * (depth D). A tiny `frame` maps (al, depth) → world (x, y) and unit-local facings → the
 * world facing strings the builders expect, so the same fit-out logic works on every hall
 * orientation (the axis/dir bookkeeping is confined to `makeFrame`).
 *
 * Consumed by condo-entrance.js `unitFaces`. Plan: condo-unit-fitout.plan.md.
 */

import { makeLight, shadeHex } from '../polygonizer/vexar.js';
import {
  assetFaces, buildBed, buildLobbySofa, buildFeatureTable, buildWallArt, buildHousePlant,
  buildBarCounter, buildBarStool, buildOfficeDesk, buildOfficeChair, buildToilet, buildVanity,
} from '../polygonizer/floorplan-building-assets.js';

// ── deterministic PRNG (mulberry32) — a unit's whole fit-out is a pure function of its
// position seed. No Math.random (would break determinism). Same recipe as fractal-city. ──
function mulberry32(a) {
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash a unit's world anchor (+ a scene seed) into a stable 32-bit position seed. */
function posSeed(alongCenter, cInner, seed) {
  return ((Math.floor(alongCenter * 1000) * 73856093) ^ (Math.floor(cInner * 1000) * 19349663) ^ ((seed | 0) * 83492791)) >>> 0;
}

// ── apartment archetypes — the program (ordered by which zone wants the most floor) + a
// floor tint. `zones` are furnished left-to-right after being matched to leaves by area. ──
const ARCHETYPES = [
  { name: 'studio', weight: 0.42, zones: ['bedsit', 'kitchen'], floor: '#8f8a80' },
  { name: 'one-bed', weight: 0.4, zones: ['living', 'bedroom', 'kitchen'], floor: '#95897b' },
  { name: 'loft', weight: 0.18, zones: ['living', 'work', 'sleep'], floor: '#817b73' },
];
const drawArchetype = (rng) => {
  let r = rng() * ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  for (const a of ARCHETYPES) { r -= a.weight; if (r <= 0) return a; }
  return ARCHETYPES[ARCHETYPES.length - 1];
};

// ── rect helpers in (al, depth) space — {x:al0, y:dep0, w:alW, d:depthW} ──────────────────
function splitRect(rect, axis, frac, gap = 0) {
  if (axis === 'x') { const a = (rect.w - gap) * frac; return [{ x: rect.x, y: rect.y, w: a, d: rect.d }, { x: rect.x + a + gap, y: rect.y, w: rect.w - a - gap, d: rect.d }]; }
  const a = (rect.d - gap) * frac; return [{ x: rect.x, y: rect.y, w: rect.w, d: a }, { x: rect.x, y: rect.y + a + gap, w: rect.w, d: rect.d - a - gap }];
}
const rectOverlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);
const area = (r) => r.w * r.d;

/** FRACTAL split: recursively bisect the long side (with a seeded ratio) until `n` leaves. */
function fractalLeaves(rect, n, rng, gap = 0) {
  if (n <= 1 || Math.min(rect.w, rect.d) < 5) return [rect];
  const nA = Math.ceil(n / 2), nB = n - nA;
  const horiz = rect.w >= rect.d;
  const frac = Math.max(0.34, Math.min(0.66, nA / n + (rng() - 0.5) * 0.22));
  const [a, b] = splitRect(rect, horiz ? 'x' : 'y', frac, gap);
  return [...fractalLeaves(a, nA, rng, gap), ...fractalLeaves(b, nB, rng, gap)];
}

/** The larger axis-aligned remainder of `leaf` minus `box` (so furniture dodges the WC). */
function subtractBox(leaf, box) {
  if (!box || !rectOverlaps(leaf, box)) return leaf;
  const c = [];
  if (box.x + box.w < leaf.x + leaf.w) c.push({ x: box.x + box.w, y: leaf.y, w: leaf.x + leaf.w - (box.x + box.w), d: leaf.d });
  if (box.x > leaf.x) c.push({ x: leaf.x, y: leaf.y, w: box.x - leaf.x, d: leaf.d });
  if (box.y > leaf.y) c.push({ x: leaf.x, y: leaf.y, w: leaf.w, d: box.y - leaf.y });
  if (box.y + box.d < leaf.y + leaf.d) c.push({ x: leaf.x, y: box.y + box.d, w: leaf.w, d: leaf.y + leaf.d - (box.y + box.d) });
  return c.sort((p, q) => area(q) - area(p))[0] || leaf;
}

// ── the (al, depth) → world frame — the ONLY place axis/dir bookkeeping lives ─────────────
function makeFrame(axis, cInner, cOuter) {
  const dir = Math.sign(cOuter - cInner) || 1;         // +1 ⇒ back wall is at larger world cross coord
  const D = Math.abs(cOuter - cInner);
  const isx = axis === 'x';                            // hall runs along world x ⇒ cross is world y
  const cross = (depth) => cInner + dir * depth;       // unit depth → world cross coord
  const toWorld = (al, depth) => (isx ? { x: al, y: cross(depth) } : { x: cross(depth), y: al });
  const alongAxis = axis;                              // builders' long-side axis parallel to the hall
  const crossAxis = isx ? 'y' : 'x';
  // world facing strings: toward the hall (depth→0) vs the back wall (depth→D)
  const faceHall = isx ? (dir > 0 ? '-y' : '+y') : (dir > 0 ? '-x' : '+x');
  const faceBack = isx ? (dir > 0 ? '+y' : '-y') : (dir > 0 ? '+x' : '-x');
  const backSign = dir > 0 ? '+' : '-';                // sign on the cross axis toward the back wall
  return { dir, D, cross, toWorld, alongAxis, crossAxis, faceHall, faceBack, backSign };
}

// ── local box (partition walls, rugs) — vexar-shaded quads, no bottom ─────────────────────
function boxFaces(x0, x1, y0, y1, z0, z1, tint, light, top = false) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return [];
  const f = [], q = (c, n) => f.push({ corners: c, fill: shadeHex(tint, n, light), doubleSided: true });
  q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  q([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  q([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  if (top) q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  return f;
}
// a thin slab (rug) on the floor in (al,depth) space
function rugFaces(frame, alC, depC, alW, depW, z, tint, light) {
  const p0 = frame.toWorld(alC - alW / 2, depC - depW / 2), p1 = frame.toWorld(alC + alW / 2, depC + depW / 2);
  return boxFaces(Math.min(p0.x, p1.x), Math.max(p0.x, p1.x), Math.min(p0.y, p1.y), Math.max(p0.y, p1.y), z, z + 0.06, tint, light, true);
}

const RUGS = ['#7c5b52', '#4f6360', '#6b6480', '#8a7a56', '#566079'];

// ── zone furnishers — each gets the FREE rect (leaf minus WC) in (al,depth), the frame, the
// rng, base z, and the shared opts; returns baked faces. Anchors back the deep wall and face
// the hall glass so the fit-out reads through the storefront. ─────────────────────────────
function centre(rect) { return { al: rect.x + rect.w / 2, dep: rect.y + rect.d / 2 }; }

function furnishBedsit(rect, F, rng, z, o) {
  // studio: a bed in the deep corner + a small sofa toward the hall, a rug + plant
  const faces = [], light = o.light, add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const c = centre(rect);
  const bedC = F.toWorld(rect.x + Math.min(3.6, rect.w * 0.4), rect.y + rect.d - 3.2);
  add(buildBed({ ...bedC, z, len: 6.4, wide: 4.6, along: F.crossAxis, head: F.backSign }));
  const sofaC = F.toWorld(c.al, Math.max(2.4, rect.y + rect.d * 0.32));
  faces.push(...rugFaces(F, c.al, rect.y + rect.d * 0.34, Math.min(rect.w * 0.7, 8), Math.min(rect.d * 0.4, 6), z, RUGS[Math.floor(rng() * RUGS.length)], light));
  add(buildLobbySofa({ ...sofaC, z, w: Math.min(rect.w * 0.66, 6.5), d: 2.8, h: 2.5, along: F.alongAxis, back: F.faceBack }));
  add(buildFeatureTable({ ...F.toWorld(c.al, rect.y + 1.6), z, r: 1.5, h: 1.5 }));
  return faces;
}

function furnishLiving(rect, F, rng, z, o) {
  const faces = [], light = o.light, add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const c = centre(rect);
  faces.push(...rugFaces(F, c.al, c.dep, Math.min(rect.w * 0.72, 9), Math.min(rect.d * 0.6, 7), z, RUGS[Math.floor(rng() * RUGS.length)], light));
  add(buildLobbySofa({ ...F.toWorld(c.al, rect.y + rect.d - 2.2), z, w: Math.min(rect.w * 0.7, 7.5), d: 3, h: 2.6, along: F.alongAxis, back: F.faceBack }));
  add(buildFeatureTable({ ...F.toWorld(c.al, c.dep - 0.4), z, r: 1.7, h: 1.5 }));
  if (rng() < 0.7) add(buildHousePlant({ ...F.toWorld(rect.x + 1.6, rect.y + rect.d - 1.6), z, h: 5.4, spread: 2.1 }));
  add(buildWallArt({ ...F.toWorld(c.al, rect.y + rect.d - 0.1), z: z + 5.2, w: Math.min(rect.w * 0.5, 3.2), h: 1.9, along: F.alongAxis, face: F.faceHall }));
  return faces;
}

function furnishBedroom(rect, F, rng, z, o, partition = false) {
  const faces = [], light = o.light, add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const c = centre(rect);
  if (partition) faces.push(...partitionWall(rect, F, z, o));
  add(buildBed({ ...F.toWorld(c.al, rect.y + rect.d - 3.1), z, len: 6.6, wide: 5, along: F.crossAxis, head: F.backSign }));
  // a nightstand beside the head (a small round side table)
  add(buildFeatureTable({ ...F.toWorld(rect.x + 1.2, rect.y + rect.d - 1.4), z, r: 0.8, h: 1.6 }));
  add(buildWallArt({ ...F.toWorld(c.al, rect.y + rect.d - 0.1), z: z + 5, w: 2.6, h: 1.7, along: F.alongAxis, face: F.faceHall }));
  return faces;
}

function furnishSleep(rect, F, rng, z, o) {
  const faces = [], light = o.light, add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const c = centre(rect);
  add(buildBed({ ...F.toWorld(c.al, rect.y + rect.d - 3), z, len: 6.6, wide: 4.9, along: F.crossAxis, head: F.backSign }));
  if (rng() < 0.5) add(buildHousePlant({ ...F.toWorld(rect.x + 1.4, rect.y + 1.6), z, h: 4.6, spread: 1.8 }));
  return faces;
}

function furnishWork(rect, F, rng, z, o) {
  const faces = [], light = o.light, add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const c = centre(rect);
  add(buildOfficeDesk({ ...F.toWorld(c.al, rect.y + rect.d - 1.8), z, w: Math.min(rect.w * 0.7, 4.6), d: 2.2, h: 2.4, screenFace: F.faceHall }));
  add(buildOfficeChair({ ...F.toWorld(c.al, rect.y + rect.d - 3.6), z, back: F.faceBack }));
  if (rng() < 0.6) add(buildHousePlant({ ...F.toWorld(rect.x + 1.4, rect.y + 1.5), z, h: 4.8, spread: 1.9 }));
  return faces;
}

function furnishKitchen(rect, F, rng, z, o) {
  const faces = [], light = o.light, add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const c = centre(rect);
  // counter run against the deep wall, stools facing the hall
  const runLen = Math.min(rect.w * 0.82, 10);
  add(buildBarCounter({ ...F.toWorld(c.al, rect.y + rect.d - 1.3), z, w: runLen, d: 2, h: 3.4, along: F.alongAxis }));
  const n = Math.max(1, Math.floor(runLen / 3));
  for (let i = 0; i < n; i += 1) {
    const al = c.al - runLen / 2 + (i + 0.5) * (runLen / n);
    add(buildBarStool({ ...F.toWorld(al, rect.y + rect.d - 3.1), z }));
  }
  return faces;
}

// a full-height partition on the zone's hall-facing (low-depth) edge, with a centred door gap
function partitionWall(rect, F, z, o) {
  const t = 0.35, gap = 2.6, dep = rect.y;             // the interior edge nearest the hall
  if (dep < 1.2) return [];                             // that edge IS the storefront setback — no wall
  const segs = [[rect.x, rect.x + rect.w / 2 - gap / 2], [rect.x + rect.w / 2 + gap / 2, rect.x + rect.w]];
  const faces = [];
  for (const [a0, a1] of segs) {
    if (a1 - a0 < 0.2) continue;
    const p0 = F.toWorld(a0, dep - t / 2), p1 = F.toWorld(a1, dep + t / 2);
    faces.push(...boxFaces(Math.min(p0.x, p1.x), Math.max(p0.x, p1.x), Math.min(p0.y, p1.y), Math.max(p0.y, p1.y), z, z + o.height, o.unitWall || '#9b968d', o.light));
  }
  return faces;
}

const FURNISH = { bedsit: furnishBedsit, living: furnishLiving, bedroom: furnishBedroom, sleep: furnishSleep, work: furnishWork, kitchen: furnishKitchen };
// which zone wants the most floor (matched to the largest leaves first)
const ZONE_PREF = { living: 5, bedsit: 5, bedroom: 4, sleep: 3, work: 3, kitchen: 1 };

/**
 * Furnish ONE unit interior. Pure geometry → baked faces.
 * @param u {{ axis, alongCenter, a0, a1, cInner, cOuter, wcSide, wcFront, baseZ, height, seed }}
 *   `a0..a1` = the unit's along-span (world); `cInner` = hall glass, `cOuter` = back wall;
 *   `wcSide/wcFront` = the washroom's inner corner already carved by unitFaces.
 * @returns {{ faces, archetype }}
 */
export function furnishUnit(u, opts = {}) {
  const o = { light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.56, diffuse: 0.5 }), unitWall: '#9b968d', height: u.height, ...opts };
  const rng = mulberry32(posSeed(u.alongCenter ?? (u.a0 + u.a1) / 2, u.cInner, u.seed ?? 1));
  const arch = drawArchetype(rng);
  const F = makeFrame(u.axis, u.cInner, u.cOuter);
  const z = u.baseZ + 0.02, wallT = 0.4, setback = 1.3;
  // interior in (al, depth): inside the side walls, a storefront setback at the hall, wall at back
  const alo = Math.min(u.a0, u.a1) + wallT, ahi = Math.max(u.a0, u.a1) - wallT;
  const interior = { x: alo, y: setback, w: ahi - alo, d: F.D - wallT - setback };
  if (interior.w < 4 || interior.d < 4) return { faces: [], archetype: arch.name };
  // the washroom reserved box in (al, depth) — the back corner on the a0 side
  const wcAlLo = Math.min(u.a0, u.wcSide), wcAlHi = Math.max(u.a0, u.wcSide);
  const wcDepLo = Math.abs(u.wcFront - u.cInner), wcDepHi = F.D;
  const wcBox = { x: wcAlLo, y: Math.min(wcDepLo, wcDepHi), w: wcAlHi - wcAlLo, d: Math.abs(wcDepHi - wcDepLo) };

  const zones = arch.zones;
  const leaves = fractalLeaves(interior, zones.length, rng).sort((a, b) => area(b) - area(a));
  const order = [...zones].sort((a, b) => (ZONE_PREF[b] || 0) - (ZONE_PREF[a] || 0));   // biggest-wanting zone → biggest leaf
  const faces = [];
  faces.push(...rugFaces(F, (alo + ahi) / 2, F.D / 2, interior.w + 0.3, interior.d + 0.3, u.baseZ + 0.005, arch.floor, o.light));   // archetype floor finish
  order.forEach((tag, i) => {
    const leaf = leaves[Math.min(i, leaves.length - 1)];
    if (!leaf) return;
    const free = subtractBox(leaf, wcBox);
    if (area(free) < 6) return;
    const fn = FURNISH[tag];
    if (!fn) return;
    const partition = tag === 'bedroom' && arch.name === 'one-bed';
    faces.push(...fn(free, F, rng, z, o, partition));
  });
  return { faces, archetype: arch.name };
}

// ── FLOOR-2 APARTMENT — a real 1BR / 2BR laid off a corridor. Unlike the ground-floor shells
// (fractal, one glass front), this is a proper flat: entered from the corridor (`entryCoord`
// side), bedrooms + living face the exterior FACADE (`windowCoord` side, where the plate's inset
// glazing gives every habitable room a window), with a galley kitchen + an enclosed bath tucked
// against the entry wall. Depth runs entry(0) → window(D); units sit side by side along `axis`.
// @param a {{ rect:{x0,x1,y0,y1}, bedrooms, axis:'x'|'y', entryCoord, windowCoord, baseZ, height, seed }}
// @returns {{ faces, kind:'1br'|'2br' }}
export function furnishApartment(a, opts = {}) {
  const o = { light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.56, diffuse: 0.5 }), unitWall: '#b7b2a6', height: a.height, ...opts };
  const light = o.light, faces = [], t = 0.4;
  const z0 = a.baseZ, z1 = a.baseZ + a.height, z = a.baseZ + 0.02;
  const F = makeFrame(a.axis, a.entryCoord, a.windowCoord);   // depth 0 = corridor entry, D = facade window
  const rng = mulberry32(posSeed((a.rect.x0 + a.rect.x1) / 2, (a.rect.y0 + a.rect.y1) / 2 + a.bedrooms, a.seed ?? 1));
  const alo = (a.axis === 'x' ? a.rect.x0 : a.rect.y0) + t, ahi = (a.axis === 'x' ? a.rect.x1 : a.rect.y1) - t;
  const alW = ahi - alo, D = F.D;
  if (alW < 12 || D < 12) return { faces, kind: `${a.bedrooms}br` };
  // ── wall helpers in (al, depth) space ──
  const crAt = (depth) => (a.axis === 'x' ? F.toWorld(alo, depth).y : F.toWorld(alo, depth).x);
  const box = (al0, al1, c0, c1, za, zb, tint) => (a.axis === 'x' ? boxFaces(al0, al1, c0, c1, za, zb, tint, light) : boxFaces(c0, c1, al0, al1, za, zb, tint, light));
  const wallAlong = (al0, al1, depth, za = z0, zb = z1) => { const c = crAt(depth); faces.push(...box(al0, al1, c - t / 2, c + t / 2, za, zb, o.unitWall)); };  // runs along `al`
  const wallDepth = (alAt, d0, d1, za = z0, zb = z1) => { const c0 = crAt(d0), c1 = crAt(d1); faces.push(...box(alAt - t / 2, alAt + t / 2, Math.min(c0, c1), Math.max(c0, c1), za, zb, o.unitWall)); };  // runs in depth
  const doorGap = 3;
  const gappedAlong = (al0, al1, depth, doorAl) => { wallAlong(al0, doorAl - doorGap / 2, depth); wallAlong(doorAl + doorGap / 2, al1, depth); wallAlong(al0, al1, depth, z0 + a.height - 2.2, z1); };  // wall + lintel over the door
  const gappedDepth = (alAt, d0, d1, doorD) => { wallDepth(alAt, d0, doorD - doorGap / 2); wallDepth(alAt, doorD + doorGap / 2, d1); };

  // 1) shell: two side (demising) walls full depth + an entry wall on the corridor with a door.
  wallDepth(alo, 0, D); wallDepth(ahi, 0, D);
  gappedAlong(alo, ahi, 0.001, alo + alW * 0.5);
  faces.push(...rugFaces(F, (alo + ahi) / 2, D / 2, alW - 0.2, D - 0.2, z0 + 0.005, o.aptFloor || '#b0a99c', light));   // flat floor finish

  // 2) wet strip against the entry (interior, no window): an enclosed BATH in a corner + a galley KITCHEN.
  const wetD = Math.min(9, D * 0.34), bathW = Math.min(6, alW * 0.34);
  wallAlong(alo, alo + bathW, wetD);                        // bath back wall (parallel to entry)
  gappedDepth(alo + bathW, 0, wetD, wetD * 0.5);            // bath side wall + door to the corridor foyer
  const bathC = { al: alo + bathW * 0.5, dep: wetD * 0.5 };
  const bw = a.axis === 'x' ? '-x' : '-y';
  for (const f of assetFaces(buildToilet({ ...F.toWorld(alo + 1.2, wetD - 1.4), z, wall: bw }), { light })) faces.push(f);
  for (const f of assetFaces(buildVanity({ ...F.toWorld(bathC.al, 1.1), z, w: bathW - 1.2, d: 1.8, along: F.alongAxis }), { light })) faces.push(f);
  faces.push(...furnishKitchen({ x: alo + bathW, y: 0, w: alW - bathW, d: wetD }, F, rng, z, o));   // counter+stools against the wetD wall

  // 3) living + bedroom(s) face the window (depth wetD..D), split along the corridor.
  const bandY = wetD, bandD = D - wetD;
  const livingFrac = a.bedrooms >= 2 ? 0.42 : 0.5;
  const livingRect = { x: alo, y: bandY, w: alW * livingFrac, d: bandD };
  faces.push(...furnishLiving(livingRect, F, rng, z, o));
  const bedAl0 = alo + alW * livingFrac, bedSpan = ahi - bedAl0, per = bedSpan / a.bedrooms;
  for (let i = 0; i < a.bedrooms; i += 1) {
    const bx0 = bedAl0 + i * per;
    const br = { x: bx0, y: bandY, w: per, d: bandD };
    gappedDepth(bx0, bandY, D, bandY + Math.min(3, bandD * 0.4));   // wall separating this room from its neighbour, with a door near the corridor
    faces.push(...furnishBedroom(br, F, rng, z, o, true));          // partition on the wetD edge + bed/nightstand/art
  }
  return { faces, kind: `${a.bedrooms}br` };
}
