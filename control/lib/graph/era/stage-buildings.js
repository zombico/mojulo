/**
 * STAGE BUILDINGS — game buildings standing in open ground, walked into as terrain (`enter: 'walk'`). An outdoor
 * stage recipe's `buildings` seats each one on the land the stage already laid:
 *
 *   buildings: [{ id?, use, seed?, at?, rooms?, add?, kit?, civilization? }]
 *     use            a program (era/programs.js): its rooms and doorways, its goal room
 *     at             a pocket beat's id ('pocket-1': the building stands in the clearing, its door to the trail), or
 *                    { x, y, facing: '+x' | '-x' | '+y' | '-y' } (its door's middle, and the way the door faces out);
 *                    absent, the next pocket the trail laid
 *     civilization   the language its builders speak (an anchor): absent, the outdoor kit's own (STRUCTURE_RAILS)
 *     kit            the room kit its inside is built in: absent, a lab's for a shell language, else the stone
 *
 * Each building is its INSIDE (the room kit's stage, its rooms laid from the program, a way out of its entry through
 * the front wall, baked in its own torchlight), its OUTSIDE (the outer walls of every room, a plinth down to the
 * land, a roof per room in the language's cap, painted in the kit's structure paint and lit by the stage's sun) and
 * its place: turned so the door faces out, its floor level with the land at its door (cut into its slope, as a game
 * building is), the land, trees, rocks and grass inside its footprint cleared. Its colliders (the stage's own walls, cut at the way out) and lights join the stage's, and
 * an anchor names it: its door, its rooms, its goal room.
 *
 * Pure: a function of the outdoor payload and the recipe. Colliders stay axis-aligned, so a building turns in
 * quarter turns.
 */
import { assembleStageScene, planStage } from './stage.js';
import { withProgram } from './programs.js';
import { stageLevel } from '../structure/level.js';
import { STRUCTURE_RAILS } from './out-structures.js';
import { structurePaint, paintStop } from './out-structures-paint.js';
import { decompileAnchor, ANCHOR_STRUCTURES, ANCHOR_IDS } from './out-anchor-structure.js';
import { designTown } from './out-town.js';
import { structureStyle } from './out-structures.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const P3 = (p) => p.map(r5);
const GROUND = /:(ground|trail|top|scree)$/;
const CLEARED = /:(wood|crown|tree|bough|rock|hat|blaze|debris|grass|grassblend|shadow|card|bush|flower|ikebana)$/;
const FACINGS = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };

/** The quarter turn that carries the plan's front (-y, out of the entry) onto `facing`. */
function turnFor(facing) {
  // R(θ)·[0,-1] = facing: -y→-y 0, -y→+x a quarter turn anticlockwise, -y→+y a half, -y→-x three quarters
  const q = { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing];
  const c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q];
  return { q, rot: ([x, y]) => [c * x - s * y, s * x + c * y] };
}

/** The land's height under a point: the highest ground face over it (the land's quads are flat enough to plane). */
function groundIndex(faces) {
  const cells = new Map(), C = 1;
  for (const f of faces) {
    if (!GROUND.test(f.group || '') || !f.corners || f.corners.length < 3) continue;
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) {
      const k = `${i},${j}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(f);
    }
  }
  return (x, y) => {
    let best = null;
    for (const f of cells.get(`${Math.floor(x / C)},${Math.floor(y / C)}`) || []) {
      const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
      if (x < Math.min(...xs) - 1e-6 || x > Math.max(...xs) + 1e-6 || y < Math.min(...ys) - 1e-6 || y > Math.max(...ys) + 1e-6) continue;
      const n = f.normal, p = f.corners[0];
      if (!n || Math.abs(n[2]) < 0.2) continue;
      const z = p[2] - (n[0] * (x - p[0]) + n[1] * (y - p[1])) / n[2];
      if (best === null || z > best) best = z;
    }
    return best;
  };
}

/** The cells (a metre) where the land is rough (a cliff, its lip, a ridge) and where the trail runs. */
const ROUGH = /:(cliff|lip|ridge)$/, PATH = /:(trail|top)$/;
function cellsOf(faces, re) {
  const out = new Set();
  for (const f of faces) {
    if (!re.test(f.group || '') || !f.corners) continue;
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    for (let i = Math.floor(Math.min(...xs)); i <= Math.floor(Math.max(...xs)); i++) for (let j = Math.floor(Math.min(...ys)); j <= Math.floor(Math.max(...ys)); j++) out.add(`${i},${j}`);
  }
  return out;
}

/** A building's language: an anchor id (or elements), else the outdoor kit's own, else the timber hall. */
function anchorOf(b, kitId) {
  const a = b.civilization ?? STRUCTURE_RAILS[kitId]?.anchor ?? 'timber-hall';
  if (typeof a === 'string' && !ANCHOR_IDS.includes(a)) throw new Error(`stage: building civilization '${a}' is not an anchor (${ANCHOR_IDS.join(', ')})`);
  return a;
}

/** The kit's structure paint, or a plain one for a kit its towns are not painted for. */
function paintFor(kitId) {
  const hex = (c) => (typeof c === 'string' ? c : `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`);
  try { const P = structurePaint(kitId); return (group, v) => hex(paintStop(P, group, v)); }
  catch { const base = { 'str:plaster': [196, 186, 166], 'str:stone': [150, 146, 138], 'str:roof': [122, 72, 56] };
    return (group, v) => { const c = base[group] ?? base['str:stone'], k = 0.55 + 0.6 * v; return `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x * k))).toString(16).padStart(2, '0')).join('')}`; }; }
}

/** The kit's structure paint at a group and value, as hex (the town's own groups: str:plaster, str:thatch …). */
const paintRaw = (kitId) => paintFor(kitId);

/**
 * A town's street: the civilization's town designed on the kit (era/out-town.js), its lots in the town's own order
 * (the focus, then the near ring, a counter before a dwelling), the first `houses` of them standing; the first
 * `enter` of those walked into (their use's program inside; `goal`: the first holds the level's end), the rest
 * standing as the town draws them.
 */
const USE_ORDER = ['hall', 'shop', 'workshop', 'tower', 'barn', 'dwelling'];
const RING_ORDER = { near: 0, mid: 1, far: 2 };
function townStreet(town, kitId, seed0) {
  if (!town || typeof town !== 'object') throw new Error('stage: town is { anchor?, seed?, houses?, enter?, goal?, recipe? }');
  for (const k of Object.keys(town)) if (!['anchor', 'seed', 'houses', 'enter', 'goal', 'recipe'].includes(k)) throw new Error(`stage: town.${k} is not a setting (anchor, seed, houses, enter, goal, recipe)`);
  const seed = town.seed ?? seed0 ?? 1, houses = town.houses ?? 6, enter = Math.min(town.enter ?? 1, houses);
  const T = designTown(structureStyle(kitId, seed), seed, { ...(town.recipe ?? {}), ...(town.anchor !== undefined ? { anchor: town.anchor } : {}) });
  const anchor = typeof town.anchor === 'string' ? town.anchor : STRUCTURE_RAILS[kitId]?.anchor ?? 'timber-hall';
  const lots = T.lots.map((l, k) => ({ l, k })).sort((a, b) => (b.l.focus ? 1 : 0) - (a.l.focus ? 1 : 0) || (RING_ORDER[a.l.ring] ?? 3) - (RING_ORDER[b.l.ring] ?? 3)
    || USE_ORDER.indexOf(a.l.use) - USE_ORDER.indexOf(b.l.use) || a.k - b.k).slice(0, houses);
  return lots.map(({ l }, n) => (n < enter
    ? { id: `town-${l.use}-${n + 1}`, use: l.use, seed: seed + n, civilization: anchor, ...(town.goal && n === 0 ? { goal: true } : {}) }
    : { id: `town-${l.use}-${n + 1}`, use: l.use, lot: l }));
}

const quad = (corners, group, fill) => ({ corners: corners.map(P3), group, fill, cornerFills: [fill, fill, fill, fill].slice(0, corners.length) });
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/**
 * The outside of a planned building, in plan coordinates (metres, z from the floor): every room's outer walls where no
 * room stands against them (cut at the way out), a plinth under them `below` deep, and a roof per room in the cap's
 * form, over the highest thing built inside it (`tops`: a kit's vault rises over its walls). → [{ corners, group }]
 * (unpainted).
 */
function shellOf(plan, ways, wall, cap, pitch, below, tops = {}) {
  const out = [], t = wall / 2, rooms = plan.rooms;
  for (const r of rooms) {
    const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.w, r.y + r.d], top = Math.max(r.h, tops[r.id] ?? 0) + 0.35;
    for (const side of ['-y', '+x', '+y', '-x']) {
      const alongX = side.endsWith('y'), line = side === '-y' ? y0 : side === '+y' ? y1 : side === '-x' ? x0 : x1;
      const out0 = side.startsWith('+') ? t : -t, a0 = (alongX ? x0 : y0) - t, a1 = (alongX ? x1 : y1) + t;
      // the spans of this side another room stands against
      const covered = rooms.filter((q) => q !== r).map((q) => {
        const qLine = side === '-y' ? q.y + q.d : side === '+y' ? q.y : side === '-x' ? q.x + q.w : q.x;
        if (Math.abs(qLine - line) > 1e-6) return null;
        const lo = alongX ? q.x : q.y, hi = alongX ? q.x + q.w : q.y + q.d;
        return [Math.max(lo, a0), Math.min(hi, a1)];
      }).filter((s) => s && s[1] > s[0]).sort((p, q) => p[0] - q[0]);
      const free = [];
      let u = a0;
      for (const [lo, hi] of covered) { if (lo > u) free.push([u, lo]); u = Math.max(u, hi); }
      if (u < a1) free.push([u, a1]);
      const at = (uu, z) => (alongX ? [uu, line + out0, z] : [line + out0, uu, z]);
      const n = alongX ? [0, Math.sign(out0), 0] : [Math.sign(out0), 0, 0];
      const W = ways.filter((w) => w.room === r.id && w.side === side);
      for (const [s0, s1] of free) {
        // the face winds so its normal points out
        const face = (u0, u1, z0, z1) => { if (u1 - u0 < 1e-3 || z1 - z0 < 1e-3) return; const c = [at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)], nn = unit(cross(sub3(c[1], c[0]), sub3(c[3], c[0]))); out.push({ corners: nn[0] * n[0] + nn[1] * n[1] < 0 ? c.reverse() : c, group: 'wall', n }); };
        let v = s0;
        for (const w of W) { if (w.hi < s0 || w.lo > s1) continue; face(v, w.lo, -below, top); face(w.lo, w.hi, w.top, top); face(w.lo, w.hi, -below, 0); v = w.hi; }
        face(v, s1, -below, top);
      }
    }
    // the roof: a gable along the long side (a hip when the cap is hipped), flat for a flat cap, a pyramid for a dome
    const e = 0.45, X0 = x0 - t - e, X1 = x1 + t + e, Y0 = y0 - t - e, Y1 = y1 + t + e, along = r.w >= r.d;
    const span = along ? Y1 - Y0 : X1 - X0, rise = cap === 'flat' ? 0 : Math.min(r.h, (span / 2) * Math.tan(((pitch ?? 40) * Math.PI) / 180));
    const z0 = top, z1 = top + rise;
    if (cap === 'flat' || rise < 0.05) { out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], [X1, Y1, z0], [X0, Y1, z0]], group: 'roof', n: [0, 0, 1] }); continue; }
    if (cap === 'dome' || cap === 'pyramid' || cap === 'cone' || cap === null) {
      const c = [(X0 + X1) / 2, (Y0 + Y1) / 2, z1];
      for (const [a, b] of [[[X0, Y0, z0], [X1, Y0, z0]], [[X1, Y0, z0], [X1, Y1, z0]], [[X1, Y1, z0], [X0, Y1, z0]], [[X0, Y1, z0], [X0, Y0, z0]]]) out.push({ corners: [a, b, c], group: 'roof' });
      continue;
    }
    const hip = cap === 'hip' ? Math.min(span / 2, (along ? X1 - X0 : Y1 - Y0) / 2 - 0.01) : 0;
    if (along) {
      const ym = (Y0 + Y1) / 2, r0 = [X0 + hip, ym, z1], r1 = [X1 - hip, ym, z1];
      out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], r1, r0], group: 'roof' }, { corners: [[X1, Y1, z0], [X0, Y1, z0], r0, r1], group: 'roof' });
      out.push({ corners: [[X0, Y1, z0], [X0, Y0, z0], r0], group: hip ? 'roof' : 'gable' }, { corners: [[X1, Y0, z0], [X1, Y1, z0], r1], group: hip ? 'roof' : 'gable' });
    } else {
      const xm = (X0 + X1) / 2, r0 = [xm, Y0 + hip, z1], r1 = [xm, Y1 - hip, z1];
      out.push({ corners: [[X1, Y0, z0], [X1, Y1, z0], r1, r0], group: 'roof' }, { corners: [[X0, Y1, z0], [X0, Y0, z0], r0, r1], group: 'roof' });
      out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], r0], group: hip ? 'roof' : 'gable' }, { corners: [[X1, Y1, z0], [X0, Y1, z0], r1], group: hip ? 'roof' : 'gable' });
    }
  }
  return out;
}

/**
 * The outdoor payload with its buildings seated: their faces, lights, colliders and anchors added, the land's growth
 * cleared from their footprints. A recipe without `buildings` returns the payload as it came. `ctx.planOnly` seats
 * nothing and answers `{ reserved }`, the ground each would claim (the stage lays its land again round it: reserve.js).
 */
export function withBuildings(payload, manifest, ctx = {}) {
  if (manifest.buildings === undefined && manifest.town === undefined) return payload;
  const list0 = manifest.buildings ?? [];
  if (!Array.isArray(list0) || (manifest.buildings !== undefined && !list0.length)) throw new Error('stage: buildings is [{ use, at?, seed?, civilization?, kit? }], at least one');
  // a town's street (`town`): its lots in the town's own order, the first `enter` of them walked into, the rest its
  // houses standing as shells; seated after the recipe's own buildings, on what land is left
  const street = manifest.town !== undefined ? townStreet(manifest.town, manifest.kit, manifest.seed) : [];
  const list = [...list0, ...street];
  const kitId = manifest.kit, ground = groundIndex(payload.faces), paint = paintFor(kitId);
  const pockets = (payload.anchors || []).filter((a) => a.kind === 'beat' && a.beat === 'pocket');
  const sun = unit(payload.sky?.sun?.dir ?? [0.45, -0.55, 0.7]);
  const seated = [], taken = [], reserved = [];
  const beats = (payload.anchors || []).filter((a) => a.kind === 'beat' && Array.isArray(a.at)).sort((p, q) => (p.s ?? p.at[1]) - (q.s ?? q.at[1]));
  const bounds = (payload.colliders || []).filter((c) => String(c.of || '').startsWith('bound:'));
  const rough = cellsOf(payload.faces, ROUGH), path = cellsOf(payload.faces, PATH);
  let faces = payload.faces, lights = [...(payload.lights || [])], colliders = [...(payload.colliders || [])], anchors = [...(payload.anchors || [])];
  const cutouts = new Set(payload.cutouts || []);
  list.forEach((b, i) => {
    if (!b || typeof b.use !== 'string') throw new Error(`stage: buildings[${i}] needs a use`);
    const id = b.id ?? `${b.use}-${i + 1}`, anchor = anchorOf(b, kitId), t = 0.25;
    // a house of the town's standing as its shell (no inside): its footprint the lot's building, its door on its front
    const lot = b.lot ?? null;
    let inner = null, entry = null, doorPlan, rects;
    if (lot) {
      const fs = lot.design.faces, xs = fs.flatMap((f) => f.corners.map((c) => c[0])), ys = fs.flatMap((f) => f.corners.map((c) => c[1]));
      const dr = fs.find((f) => f.part === 'door' || f.part === 'accent');
      rects = [[Math.min(...xs), Math.max(0, Math.min(...ys)), Math.max(...xs), Math.max(...ys)]];
      doorPlan = [dr ? dr.corners.reduce((a, c) => a + c[0], 0) / dr.corners.length : (rects[0][0] + rects[0][2]) / 2, 0];
    } else {
      // the inside: the program on its room kit, a way out of the entry through its front
      const inner0 = withProgram({ kind: 'stage', kit: b.kit ?? (anchor === 'shell' ? 'research-lab' : 'gothic-stone'), program: { use: b.use, seed: b.seed ?? 1, civilization: anchor, ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}) } });
      entry = inner0.rooms.find((r) => r.id === inner0._program.entry);
      inner = { ...inner0, ways: [{ room: entry.id, side: '-y' }] };
      doorPlan = [(entry.x + entry.x + entry.w) / 2, entry.y];
      rects = inner.rooms.map((r) => [r.x - t, r.y - t, r.x + r.w + t, r.y + r.d + t]);
    }
    // how the building fits standing with its door at T facing out: its floor level with the land at its door (a game
    // building is cut into its slope, not stood on stilts over it), how far the land behind stands over that floor, how
    // much cliff and trail it covers, whether it crosses the stage's bounds or another building
    const fit = (T, facing) => {
      const { q, rot } = turnFor(facing);
      const toWorld = ([x, y]) => { const [u, v] = rot([x - doorPlan[0], y - doorPlan[1]]); return [T[0] + u, T[1] + v]; };
      const boxes = rects.map((R0) => { const a = toWorld([R0[0], R0[1]]), c = toWorld([R0[2], R0[3]]); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; });
      const samples = [];
      for (const R0 of rects) for (let x = R0[0]; x <= R0[2] + 1e-6; x += 1) for (let y = R0[1]; y <= R0[3] + 1e-6; y += 1) samples.push(toWorld([x, y]));
      const zs = samples.map(([x, y]) => ground(x, y)).filter((z) => z !== null);
      const atDoor = [toWorld([doorPlan[0], doorPlan[1] - 0.6]), toWorld([doorPlan[0], doorPlan[1] + 0.6])].map(([x, y]) => ground(x, y)).filter((z) => z !== null);
      if (zs.length < samples.length * 0.9 || !atDoor.length) return { off: true };
      const floor = Math.max(...atDoor) + 0.12;
      const cellsIn = (set) => { let n = 0; for (const B of boxes) for (let i = Math.floor(B[0]); i <= Math.floor(B[2]); i++) for (let j = Math.floor(B[1]); j <= Math.floor(B[3]); j++) if (set.has(`${i},${j}`)) n++; return n; };
      const hits = (B, c) => B[0] < c.max[0] && c.min[0] < B[2] && B[1] < c.max[1] && c.min[1] < B[3];
      // a building never stands on a beat of the trail (the way runs through them) or another building
      const onBeat = boxes.some((B) => beats.some((bt) => bt.at[0] > B[0] - 2 && bt.at[0] < B[2] + 2 && bt.at[1] > B[1] - 2 && bt.at[1] < B[3] + 2));
      const blocked = onBeat || boxes.some((B) => bounds.some((c) => hits(B, c)) || taken.some((T2) => B[0] < T2[2] && T2[0] < B[2] && B[1] < T2[3] && T2[1] < B[3]));
      return { q, rot, toWorld, boxes, zs, floor, into: Math.max(...zs) - floor, rough: cellsIn(rough), path: cellsIn(path), blocked };
    };
    const score = (F) => (F.off ? Infinity : F.into + 3 * F.rough + (F.path ? 40 : 0) + (F.blocked ? 1000 : 0));
    let T, facing;
    if (b.at && typeof b.at === 'object') {
      if (!Number.isFinite(b.at.x) || !Number.isFinite(b.at.y) || !FACINGS[b.at.facing]) throw new Error(`stage: buildings[${i}].at is a pocket id or { x, y, facing: +x | -x | +y | -y }`);
      T = [b.at.x, b.at.y]; facing = b.at.facing;
    } else if (typeof b.at === 'string') {
      const p = pockets.find((q) => q.id === b.at);
      if (!p) throw new Error(`stage: buildings[${i}] names '${b.at}', which is not a pocket (pockets: ${pockets.map((q) => q.id).join(', ') || 'none'}); give at: { x, y, facing }`);
      const toMouth = p.mouth ? [p.mouth[0] - p.at[0], p.mouth[1] - p.at[1]] : [0, -1];
      facing = Math.abs(toMouth[0]) >= Math.abs(toMouth[1]) ? (toMouth[0] >= 0 ? '+x' : '-x') : (toMouth[1] >= 0 ? '+y' : '-y');
      T = [p.at[0], p.at[1]];
    } else {
      // absent: the flattest place beside the trail, its door to the trail; the trail's beats and pockets the places
      // looked at (each beat a few distances out to either side), the first best kept
      const cands = [];
      for (const p of pockets) { const m = p.mouth ? [p.mouth[0] - p.at[0], p.mouth[1] - p.at[1]] : [0, -1]; cands.push([[p.at[0], p.at[1]], Math.abs(m[0]) >= Math.abs(m[1]) ? (m[0] >= 0 ? '+x' : '-x') : (m[1] >= 0 ? '+y' : '-y')]); }
      beats.forEach((bt, k) => {
        const a = beats[Math.max(0, k - 1)].at, c = beats[Math.min(beats.length - 1, k + 1)].at, d = unit([c[0] - a[0], c[1] - a[1], 0]), n = [-d[1], d[0]];
        for (const off of [5, 8, 11]) for (const sg of [1, -1]) {
          const out = [-sg * n[0], -sg * n[1]], f = Math.abs(out[0]) >= Math.abs(out[1]) ? (out[0] >= 0 ? '+x' : '-x') : (out[1] >= 0 ? '+y' : '-y');
          cands.push([[r5(bt.at[0] + sg * n[0] * off), r5(bt.at[1] + sg * n[1] * off)], f]);
        }
      });
      let best = null;
      for (const [P0, f] of cands) { const F = fit(P0, f), sc = score(F); if (!best || sc < best.sc - 1e-9) best = { T: P0, facing: f, sc }; }
      if (!best || best.sc === Infinity) throw new Error(`stage: buildings[${i}] (${id}) finds no place on the land beside the trail; give at: { x, y, facing }`);
      T = best.T; facing = best.facing;
    }
    const F = fit(T, facing);
    if (F.off) throw new Error(`stage: buildings[${i}] (${id}) stands off the land`);
    const { q, rot, toWorld, zs, floor, into } = F;
    taken.push(...F.boxes);
    // the planning pass only claims the ground (era/reserve.js): the land is laid again round it before anything is built
    if (ctx.planOnly) { reserved.push(...F.boxes.map((B) => B.map(r5))); return; }
    const clearUnder = (pad, land = true) => {
      const grow = F.boxes.map((B) => [B[0] - pad, B[1] - pad, B[2] + pad, B[3] + pad]), mid = (f) => { const n = f.corners.length; return [f.corners.reduce((a, c) => a + c[0], 0) / n, f.corners.reduce((a, c) => a + c[1], 0) / n]; };
      faces = faces.filter((f) => { const g = f.group || ''; if (CLEARED.test(g)) { const [cx, cy] = mid(f); return !grow.some((B) => cx >= B[0] && cx <= B[2] && cy >= B[1] && cy <= B[3]); } if (land && (GROUND.test(g) || ROUGH.test(g))) { const [cx, cy] = mid(f); return !F.boxes.some((B) => cx > B[0] && cx < B[2] && cy > B[1] && cy < B[3]); } return true; });
    };
    if (lot) {
      // the shell: the lot's building as the town draws it, painted and lit by the stage's sun, a plinth to the land,
      // one collider round it
      const below0 = Math.max(0.3, floor - Math.min(...zs) + 0.3), Wl = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
      clearUnder(0.4, false);   // a shell has no floor: its land stays (its collider keeps a walker out)
      const Pt = paintRaw(kitId), lit = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      const shellF = lot.design.faces.map((f) => { const c = f.corners.map(Wl), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))); return { ...quad(c, `town:${f.part}`, Pt(f.group, Math.min(1, (f.value ?? 0.6) * lit(nn)))), normal: P3(nn), outNormal: P3(nn) }; });
      const [x0, y0, x1, y1] = rects[0], plinth = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]].map(([a, c]) => { const cs = [Wl([...a, -below0]), Wl([...c, -below0]), Wl([...c, 0]), Wl([...a, 0])], nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[3], cs[0]))); return { ...quad(cs, 'town:plinth', Pt('str:stone', 0.45 * lit(nn))), normal: P3(nn), outNormal: P3(nn) }; });
      faces = [...faces, ...shellF, ...plinth];
      const top = Math.max(...lot.design.faces.flatMap((f) => f.corners.map((c) => c[2]))), B = F.boxes[0];
      colliders.push({ min: P3([B[0], B[1], floor - below0]), max: P3([B[2], B[3], floor + top]), of: `${id}:house` });
      anchors.push({ id: `house-${id}`, kind: 'house', use: b.use, at: P3(Wl([doorPlan[0], doorPlan[1], 0])), N: P3((() => { const [nx, ny] = F.rot([0, -1]); return [nx, ny, 0]; })()), floor: r5(floor), box: { min: P3([B[0], B[1], floor]), max: P3([B[2], B[3], floor + top]) } });
      seated.push({ id, use: b.use, house: true, floor: r5(floor) });
      return;
    }
    const P = assembleStageScene(inner, ctx), ways = planStage(inner).ways ?? [];
    const below = Math.max(0.3, floor - Math.min(...zs) + 0.3);
    const W = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
    const turnN = (n) => { const [x, y] = rot([n[0], n[1]]); return [x, y, n[2]]; };
    // the land's growth (a wall's width out) and the land itself (cliffs too) cleared under it: the floor the only ground inside
    clearUnder(0.4);
    // the inside, moved
    const moved = P.faces.map((f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(turnN(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(turnN(f.outNormal)) } : {}), node: f.node ? `${id}:${f.node}` : undefined }))
      .map(({ node, ...f }) => (node ? { ...f, node } : f));
    // the outside, painted and lit by the stage's sun
    const L = decompileAnchor(typeof anchor === 'string' ? ANCHOR_STRUCTURES[anchor] : anchor, typeof anchor === 'string' ? anchor : null);
    // painted as the language paints its houses: the mass's group and value on the walls, the cap's on the roof
    const mass = L.anchor.pieces.find((p) => p.role === 'mass') ?? {}, capP = L.anchor.pieces.find((p) => p.role === 'cap') ?? null;
    const wallGroup = mass.group ?? 'str:plaster', wallV = mass.value ?? 0.7, roofGroup = capP?.group ?? wallGroup, roofV = capP?.value ?? wallV * 0.7;
    // each room's highest face inside: the roof stands over the vault, not through it
    const tops = Object.fromEntries(inner.rooms.map((r) => [r.id, Math.max(0, ...P.faces.filter((f) => { const n = f.corners.length, cx = f.corners.reduce((a, c) => a + c[0], 0) / n, cy = f.corners.reduce((a, c) => a + c[1], 0) / n; return cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d; }).flatMap((f) => f.corners.map((c) => c[2])))]));
    const shell = shellOf(inner, ways, 0.5, L.vocab.cap, L.proportions.pitch, below, tops).map((s) => {
      const c = s.corners.map(W), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), lam = Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]);
      const roof = s.group === 'roof', v = (roof ? roofV : wallV) * (0.55 + 0.45 * lam);
      return { ...quad(c, `building:${s.group}`, paint(roof ? roofGroup : wallGroup, Math.min(1, v))), normal: P3(nn), outNormal: P3(nn) };
    });
    // the stoop: a ramp down from the threshold to the land in front of the door, as wide as the way out, so a walker
    // (and a hero, who steps only so high) comes in off the land
    const wy = ways[0], drop = floor - (ground(...toWorld([doorPlan[0], doorPlan[1] - 0.6])) ?? floor), run = Math.max(0.6, drop * 2.5);
    const stoop = drop > 0.05 ? (() => {
      const a = wy.lo - 0.2, c = wy.hi + 0.2, y0 = entry.y - t, y1 = y0 - run, zt = 0, zb = -drop - 0.15;
      const top = [[a, y1, zb], [c, y1, zb], [c, y0, zt], [a, y0, zt]].map(W), sides = [[[a, y0, zt], [a, y1, zb], [a, y0, zb]], [[c, y1, zb], [c, y0, zt], [c, y0, zb]]].map((tri) => tri.map(W));
      return [top, ...sides].map((cs) => { const nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[cs.length - 1], cs[0]))), lit = 0.35 + 0.65 * Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]); return { ...quad(cs, 'building:stoop', paint('str:stone', Math.min(1, 0.5 * lit))), normal: P3(nn), outNormal: P3(nn) }; });
    })() : [];
    faces = [...faces, ...moved, ...shell, ...stoop];
    for (const c of P.cutouts || []) cutouts.add(c);
    lights.push(...(P.lights || []).map((l) => ({ ...l, name: `${id}-${l.name}`, position: P3(W(l.position)) })));
    // its colliders: the stage's own, moved (a quarter turn keeps a box a box)
    colliders.push(...(P.colliders || []).map((c) => {
      const a = W(c.min), z = W(c.max);
      return { min: P3([Math.min(a[0], z[0]), Math.min(a[1], z[1]), a[2]]), max: P3([Math.max(a[0], z[0]), Math.max(a[1], z[1]), z[2]]), of: `${id}:${c.of}` };
    }));
    const goal = inner.rooms.find((r) => r.id === inner._program.goal);
    // the way to its goal room from the land: in front of the stoop, through the door, on through its doorways
    const L2 = stageLevel(inner, { goal: goal?.id ?? 'deepest', from: entry.id });
    const lead = [[doorPlan[0], entry.y - (drop > 0.05 ? Math.max(0.6, drop * 2.5) : 0) - 1.5], [doorPlan[0], entry.y + 1.5]];
    const route = [...lead, ...L2.route].map((p) => P3(toWorld(p)));
    const roomBox = (r) => { const a = W([r.x + t, r.y + t, 0]), c = W([r.x + r.w - t, r.y + r.d - t, r.h]); return { min: P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), a[2]]), max: P3([Math.max(a[0], c[0]), Math.max(a[1], c[1]), c[2]]) }; };
    const anchorRec = {
      id: `building-${id}`, kind: 'building', use: b.use, enter: 'walk', language: L.id, turn: q,
      at: P3(W([doorPlan[0], doorPlan[1], 0])), N: P3(turnN([0, -1, 0])), floor: r5(floor),
      entry: entry.id, goal: goal?.id ?? null, rooms: inner.rooms.map((r) => ({ id: r.id, box: roomBox(r) })),
      route, goalAt: P3([...toWorld(L2.goal.at), floor]), ...(b.goal ? { isGoal: true } : {}),
    };
    anchors.push(anchorRec);
    seated.push({ id, use: b.use, entry: entry.id, goal: goal?.id ?? null, language: L.id, floor: r5(floor), into: r5(Math.max(0, into)), rough: F.rough,
      findings: [...inner._program.findings.map((f) => f.says), ...(into > 2.5 ? [`the ${id} is cut ${r5(into)} m into its slope: its back rooms stand below the land (another pocket, or at a flatter place)`] : [])] });
  });
  if (ctx.planOnly) return { reserved };
  return { ...payload, faces, ...(cutouts.size ? { cutouts: [...cutouts].sort() } : {}), lights, colliders, anchors, buildings: seated };
}
