/**
 * STAGE BUILDINGS — game buildings standing in open ground, walked into as terrain (`enter: 'walk'`). An outdoor
 * stage recipe's `buildings` seats each one on the land the stage already laid:
 *
 *   buildings: [{ id?, use, seed?, at?, rooms?, add?, kit?, civilization?, look?, tone?, storeys?, wings?, loading?, bays? }]
 *     use            a program (era/programs.js): its rooms and doorways, its goal room
 *     at             a pocket beat's id ('pocket-1': the building stands in the clearing, its door to the trail), or
 *                    { x, y, facing: '+x' | '-x' | '+y' | '-y' } (its door's middle, and the way the door faces out);
 *                    absent, the next pocket the trail laid
 *     civilization   the language its builders speak (an anchor): absent, the outdoor kit's own (STRUCTURE_RAILS)
 *     kit            the room kit its inside is built in: absent, a lab's for a shell language, else the stone
 *     look, tone     a base's building (`base` uses), or a use given a `look` ({ construction?, palette? }), is COMPOSED
 *                    as a building level is (gameworld/levels.js buildingStage): its bay kit, its rooms stocked, its tone,
 *                    its plan's storeys, wings, loading and bays its own. Its windows open through its shell onto the
 *                    land (the sky cards behind them are where the shell is cut), the land's sun at its hour lays their
 *                    patches and its day dims their daylight; it wears its construction outside (style/bay-exterior.js),
 *                    a flat roof behind a parapet or a low steel one, its walls rising over a lower room's roof; and a
 *                    yard YARD deep before its front is kept clear of what grows
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
import { withProgram, PROGRAMS } from './programs.js';
import { stageLevel } from '../structure/level.js';
import { STRUCTURE_RAILS } from './out-structures.js';
import { structurePaint, paintStop } from './out-structures-paint.js';
import { madeRamp } from './style/swatches.js';
import { decompileAnchor, ANCHOR_STRUCTURES, ANCHOR_IDS } from './out-anchor-structure.js';
import { designTown } from './out-town.js';
import { structureStyle } from './out-structures.js';
import { dressTownFace } from './town-dress.js';
import { stepsLift } from './out-openings.js';
import { townLanguage } from './out-town.js';
import { streetSpan, layStreet } from './stage-street.js';
import { outTrailOf } from './out-trail-board.js';
import { slabOf } from './solid.js';
import { exteriorOf } from './style/bay-exterior.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const P3 = (p) => p.map(r5);
const GROUND = /:(ground|trail|top|scree)$/;
// a solid roof's thickness: its covering, battens and rafters (era/solid.js)
const ROOF_T = 0.18;
const CLEARED = /:(wood|crown|tree|bough|rock|hat|blaze|debris|grass|grassblend|shadow|card|bush|flower|ikebana)$/;
const FACINGS = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
// a composed building's yard: how deep the ground before its front is kept clear (m)
const YARD = 8;

/** The quarter turn that carries the plan's front (-y, out of the entry) onto `facing`. */
function turnFor(facing) {
  // R(θ)·[0,-1] = facing: -y→-y 0, -y→+x a quarter turn anticlockwise, -y→+y a half, -y→-x three quarters
  const q = { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing];
  const c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q];
  return { q, rot: ([x, y]) => [c * x - s * y, s * x + c * y] };
}

/** The land's sun (its sky's `sun.dir`, toward it, world frame) as a bay's window sun in a plan turned `q` quarters: its
 * elevation in degrees and the way its light travels, in the plan's frame (era/bay-glass.js sunPatches), and its day. */
function sunIn(sky, q) {
  // (a sky with no sun, a night's or a dusk's under its moon, lays no patch; its day dims the daylight at the windows)
  const day = r5(Math.max(0, Math.min(1, sky?.day ?? 1)));
  if (!sky?.sun?.dir) return { el: 0, toward: [0, -1], day };
  const dir = unit(sky.sun.dir), c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q], [x, y] = [-dir[0], -dir[1]];
  return { el: r5((Math.asin(Math.max(-1, Math.min(1, dir[2]))) * 180) / Math.PI), toward: [r5(c * x + s * y), r5(-s * x + c * y)], day };
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

/**
 * A building composed as a building level is (gameworld/levels.js buildingStage): a base's use (era/programs.js
 * `base`), or any use given a `look` ({ construction, palette }, as a walled-core dungeon's space carries it), on the bay
 * kit its use names, its look composed and its `tone` laid, its plan's `storeys`, `wings`, `loading` and `bays` its own;
 * null for every other building, laid as it was.
 */
function composedOf(b) {
  if (!PROGRAMS[b.use]?.base && b.look === undefined) return null;
  if (b.look !== undefined && (!b.look || typeof b.look !== 'object' || Array.isArray(b.look) || Object.keys(b.look).some((k) => !['construction', 'palette'].includes(k)))) throw new Error(`stage: building '${b.use}' look is { construction?, palette? }`);
  // (its plan's settings as a building level takes them: era/programs.js)
  const look = b.look ?? {}, plan = Object.fromEntries(['storeys', 'wings', 'loading', 'bays'].filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
  return {
    kind: 'stage', kit: b.kit ?? PROGRAMS[b.use]?.kit ?? `bay-${look.construction ?? 'utility'}`,
    program: { use: b.use, seed: b.seed ?? 1, ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}), ...plan },
    compose: { ...(look.construction ? { construction: look.construction } : {}), ...(look.palette ? { palette: look.palette } : {}) },
    ...(b.tone !== undefined ? { tone: b.tone } : {}),
  };
}

/** The kit's structure paint, or a plain one for a kit its towns are not painted for. `repoint`: a town's `paint`, a
 * group at another of the kit's ramps (a geocube's look carries the cube's: era/geocube.js CUBE_STREET_PAINT); a ramp the
 * kit lacks is passed over, so a street painted for a cube stands in another kit in that kit's own paint. */
function paintFor(kitId, repoint) {
  const hex = (c) => (typeof c === 'string' ? c : `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`);
  const has = (n) => { try { madeRamp(kitId, n); return true; } catch { return false; } };
  const swatches = repoint ? Object.fromEntries(Object.entries(repoint).filter(([, n]) => has(n))) : undefined;
  try { const P = structurePaint(kitId, swatches ? { swatches } : {}); return (group, v) => hex(paintStop(P, group, v)); }
  catch { const base = { 'str:plaster': [196, 186, 166], 'str:stone': [150, 146, 138], 'str:roof': [122, 72, 56] };
    return (group, v) => { const c = base[group] ?? base['str:stone'], k = 0.55 + 0.6 * v; return `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x * k))).toString(16).padStart(2, '0')).join('')}`; }; }
}

/** The kit's structure paint at a group and value, as hex (the town's own groups: str:plaster, str:thatch …). */
const paintRaw = (kitId, repoint) => paintFor(kitId, repoint);

/**
 * A town's street: the civilization's town designed on the kit (era/out-town.js), its lots in the town's own order
 * (the focus, then the near ring, a counter before a dwelling), the first `houses` of them standing; the first
 * `enter` of those walked into (their use's program inside; `goal`: the first holds the level's end), the rest
 * standing as the town draws them.
 */
const USE_ORDER = ['hall', 'shop', 'workshop', 'tower', 'barn', 'dwelling'];
const DOOR_USES = new Set(['dwelling', 'shop', 'tavern', 'keep', 'temple', 'crypt', 'guardhouse', 'library', 'lab']);
const RING_ORDER = { near: 0, mid: 1, far: 2 };
/** The lots a town's street stands, in its order (the focus, then the near ring, a counter before a dwelling), the
 * first `houses` of them: `{ seed, houses, enter, town, lots: [{ l, k }] }`, `town` the designed town (its seed, its
 * heartbeat) and `k` a lot's place in it. Its houses are `town-<use>-<n>` in this order (the folk stand by them). */
export function streetLots(town, kitId, seed0, solid = false) {
  const seed = town.seed ?? seed0 ?? 1, houses = town.houses ?? 6, enter = Math.min(town.enter ?? 1, houses);
  const T = designTown(structureStyle(kitId, seed), seed, { ...(town.recipe ?? {}), ...(town.anchor !== undefined ? { anchor: town.anchor } : {}) }, { solid });
  const lots = T.lots.map((l, k) => ({ l, k })).sort((a, b) => (b.l.focus ? 1 : 0) - (a.l.focus ? 1 : 0) || (RING_ORDER[a.l.ring] ?? 3) - (RING_ORDER[b.l.ring] ?? 3)
    || USE_ORDER.indexOf(a.l.use) - USE_ORDER.indexOf(b.l.use) || a.k - b.k).slice(0, houses);
  return { seed, houses, enter, town: T, lots };
}
function townStreet(town, kitId, seed0, solid = false) {
  if (!town || typeof town !== 'object') throw new Error('stage: town is { anchor?, seed?, houses?, enter?, goal?, recipe?, paint?, street? }');
  for (const k of Object.keys(town)) if (!['anchor', 'seed', 'houses', 'enter', 'goal', 'doors', 'recipe', 'paint', 'dress', 'street'].includes(k)) throw new Error(`stage: town.${k} is not a setting (anchor, seed, houses, enter, goal, doors, recipe, paint, dress, street)`);
  if (town.street !== undefined && typeof town.street !== 'boolean') throw new Error('stage: town.street is true (the trail through the town laid as its language\'s street) or false');
  if (town.paint !== undefined && (typeof town.paint !== 'object' || town.paint === null || Array.isArray(town.paint) || !Object.values(town.paint).every((n) => typeof n === 'string'))) throw new Error('stage: town.paint is { <surface group>: <one of the kit\'s ramps> }: the street\'s houses re-pointed');
  const { seed, enter, lots } = streetLots(town, kitId, seed0, solid);
  // (a language written as its elements is spoken by the houses too; a seeded one, { seed }, only by the street)
  const anchor = typeof town.anchor === 'string' || town.anchor?.elements || town.anchor?.pieces ? town.anchor : STRUCTURE_RAILS[kitId]?.anchor ?? 'timber-hall';
  // how each is entered: a household or a counter changes the scene at its door; a hall, a tower, a barn, a work floor
  // is walked into as terrain (the recipe's `doors: false` walks into all of them)
  return lots.map(({ l }, n) => (n < enter
    ? (town.doors !== false && DOOR_USES.has(l.use)
      ? { id: `town-${l.use}-${n + 1}`, use: l.use, lot: l, enter: 'door', seed: seed + n, civilization: anchor }
      : { id: `town-${l.use}-${n + 1}`, use: l.use, seed: seed + n, civilization: anchor, ...(town.goal && n === 0 ? { goal: true } : {}) })
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
 * (unpainted). `solid` (era/solid.js: no flat building polygons): each way out cut through the wall's depth (two jambs,
 * a head and a threshold from the outer face to the inside's), each roof a slab ROOF_T thick (its underside, its fascia
 * and verges); absent, the skin as it was, every byte.
 */
function shellOf(plan, ways, wall, cap, pitch, below, tops = {}, solid = false, bay = null) {
  const out = [], t = wall / 2, rooms = plan.rooms, holes = bay?.holes ?? null, parapet = bay?.parapet ?? 0;
  // a face wound so its normal points along `n`
  const faceN = (c, n, group) => { const nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))); out.push({ corners: nn[0] * n[0] + nn[1] * n[1] + nn[2] * n[2] < 0 ? c.slice().reverse() : c, group, n }); };
  // a room's roof faces as a slab: its underside and a band down each free edge (era/solid.js)
  const slab = (from) => {
    const polys = out.slice(from).filter((f) => f.group === 'roof').map((f) => f.corners), S = slabOf(polys, ROOF_T);
    for (const c of S.under) out.push({ corners: c, group: 'roof', n: [0, 0, -1] });
    for (const e of S.edges) faceN(e.corners, e.out, 'roof');
  };
  // on storeys (storeys.js): each room's walls from its floor (the ground storey's from the plinth), a room with one
  // over it walled up to the floor over it and flat-roofed there (hidden under it, or a terrace where it is not)
  const S = rooms.some((r) => r.storey) ? planStage(plan) : null, at0 = (r) => (S ? S.rooms.find((q) => q.id === (r.id)).z0 : 0);
  const sOf = (r) => r.storey ?? 0, under = (r) => !!S && S.flat.has(r.id);
  const topOf = (r) => (under(r) ? S.storeys[sOf(r) + 1].z0 : Math.max(at0(r) + r.h, tops[r.id] ?? 0) + 0.35);
  // (a bay building's flat roof stands behind a parapet: its outer walls rise past the roof, capped)
  const flatTop = (r) => !under(r) && (cap === 'flat' || (pitch ?? 40) <= 0);
  for (const r of rooms) {
    const zr = at0(r), base = sOf(r) ? zr : -below;
    const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.w, r.y + r.d], top = topOf(r), wallTop = top + (parapet && flatTop(r) ? parapet : 0);
    for (const side of ['-y', '+x', '+y', '-x']) {
      const alongX = side.endsWith('y'), line = side === '-y' ? y0 : side === '+y' ? y1 : side === '-x' ? x0 : x1;
      const out0 = side.startsWith('+') ? t : -t, a0 = (alongX ? x0 : y0) - t, a1 = (alongX ? x1 : y1) + t;
      // the spans of this side another room (of its storey) stands against
      const covered = rooms.filter((q) => q !== r && sOf(q) === sOf(r)).map((q) => {
        const qLine = side === '-y' ? q.y + q.d : side === '+y' ? q.y : side === '-x' ? q.x + q.w : q.x;
        if (Math.abs(qLine - line) > 1e-6) return null;
        const lo = alongX ? q.x : q.y, hi = alongX ? q.x + q.w : q.y + q.d;
        return [Math.max(lo, a0), Math.min(hi, a1), q];
      }).filter((s) => s && s[1] > s[0]).sort((p, q) => p[0] - q[0]);
      const free = [];
      let u = a0;
      for (const [lo, hi] of covered) { if (lo > u) free.push([u, lo]); u = Math.max(u, hi); }
      if (u < a1) free.push([u, a1]);
      const at = (uu, z) => (alongX ? [uu, line + out0, z] : [line + out0, uu, z]);
      const atIn = (uu, z) => (alongX ? [uu, line - out0, z] : [line - out0, uu, z]);
      const n = alongX ? [0, Math.sign(out0), 0] : [Math.sign(out0), 0, 0], un = alongX ? [1, 0, 0] : [0, 1, 0];
      const W = ways.filter((w) => w.room === r.id && w.side === side);
      // (the glazed openings on this side, `holes`: each cut through the shell, a reveal across to the room's wall)
      const H = holes ? openingsOn(holes, alongX, line + out0, n, a0, a1) : [];
      for (const h of H) {
        const atP = (uu, z) => (alongX ? [uu, h.plane, z] : [h.plane, uu, z]);
        faceN([at(h.u0, h.z0), atP(h.u0, h.z0), atP(h.u0, h.z1), at(h.u0, h.z1)], un, 'wall');
        faceN([at(h.u1, h.z0), atP(h.u1, h.z0), atP(h.u1, h.z1), at(h.u1, h.z1)], un.map((x) => -x), 'wall');
        faceN([at(h.u0, h.z1), at(h.u1, h.z1), atP(h.u1, h.z1), atP(h.u0, h.z1)], [0, 0, -1], 'wall');
        faceN([at(h.u0, h.z0), at(h.u1, h.z0), atP(h.u1, h.z0), atP(h.u0, h.z0)], [0, 0, 1], 'wall');
      }
      // the face winds so its normal points out (cut round the openings on it)
      const face0 = (u0, u1, z0, z1) => { if (u1 - u0 < 1e-3 || z1 - z0 < 1e-3) return; const c = [at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)], nn = unit(cross(sub3(c[1], c[0]), sub3(c[3], c[0]))); out.push({ corners: nn[0] * n[0] + nn[1] * n[1] < 0 ? c.reverse() : c, group: 'wall', n }); };
      const face = H.length ? (u0, u1, z0, z1) => { for (const q of cutRect(u0, u1, z0, z1, H)) face0(...q); } : face0;
      // (a bay building: where a lower room stands against this side, its wall still rises over that room's roof)
      if (bay) for (const [lo, hi, q] of covered) if (topOf(q) + 1e-6 < wallTop) face(lo, hi, Math.max(base, topOf(q)), wallTop);
      // (and its parapet: an inner face down to the roof from the wall's line, and its coping)
      const atL = (uu, z) => (alongX ? [uu, line, z] : [line, uu, z]), [r0, r1] = alongX ? [x0, x1] : [y0, y1];
      if (wallTop > top) for (const [s0, s1] of free) {
        const p0 = Math.max(s0, r0), p1 = Math.min(s1, r1);
        if (p1 - p0 < 1e-3) continue;
        faceN([atL(p0, top), atL(p1, top), atL(p1, wallTop), atL(p0, wallTop)], n.map((x) => -x), 'wall');
        faceN([at(s0, wallTop), at(s1, wallTop), atL(Math.min(s1, r1 + t), wallTop), atL(Math.max(s0, r0 - t), wallTop)], [0, 0, 1], 'wall');
      }
      for (const [s0, s1] of free) {
        let v = s0;
        for (const w of W) {
          if (w.hi < s0 || w.lo > s1) continue;
          face(v, w.lo, base, wallTop); face(w.lo, w.hi, w.top, wallTop); face(w.lo, w.hi, base, 0); v = w.hi;
          // (solid: the way cut through the wall, outer face to inner: its jambs facing in, its head down, its threshold up)
          if (solid) {
            faceN([at(w.lo, 0), atIn(w.lo, 0), atIn(w.lo, w.top), at(w.lo, w.top)], un, 'wall');
            faceN([at(w.hi, 0), atIn(w.hi, 0), atIn(w.hi, w.top), at(w.hi, w.top)], un.map((x) => -x), 'wall');
            faceN([at(w.lo, w.top), at(w.hi, w.top), atIn(w.hi, w.top), atIn(w.lo, w.top)], [0, 0, -1], 'wall');
            faceN([at(w.lo, 0), at(w.hi, 0), atIn(w.hi, 0), atIn(w.lo, 0)], [0, 0, 1], 'wall');
          }
        }
        face(v, s1, base, wallTop);
      }
    }
    // the roof: a gable along the long side (a hip when the cap is hipped), flat for a flat cap, a pyramid for a dome
    // (behind a parapet, to the wall's line and no further)
    const e = wallTop > top ? -t : 0.45, X0 = x0 - t - e, X1 = x1 + t + e, Y0 = y0 - t - e, Y1 = y1 + t + e, along = r.w >= r.d;
    const span = along ? Y1 - Y0 : X1 - X0, rise = cap === 'flat' || under(r) ? 0 : Math.min(r.h, (span / 2) * Math.tan(((pitch ?? 40) * Math.PI) / 180));
    const z0 = top, z1 = top + rise, from = out.length;
    if (under(r)) { out.push({ corners: [[x0 - t, y0 - t, z0], [x1 + t, y0 - t, z0], [x1 + t, y1 + t, z0], [x0 - t, y1 + t, z0]], group: 'roof', n: [0, 0, 1] }); continue; }   // (a floor over it, or a terrace walled by the storey on it)
    if (cap === 'flat' || rise < 0.05) { out.push({ corners: [[X0, Y0, z0], [X1, Y0, z0], [X1, Y1, z0], [X0, Y1, z0]], group: 'roof', n: [0, 0, 1] }); if (solid) slab(from); continue; }
    if (cap === 'dome' || cap === 'pyramid' || cap === 'cone' || cap === null) {
      const c = [(X0 + X1) / 2, (Y0 + Y1) / 2, z1];
      for (const [a, b] of [[[X0, Y0, z0], [X1, Y0, z0]], [[X1, Y0, z0], [X1, Y1, z0]], [[X1, Y1, z0], [X0, Y1, z0]], [[X0, Y1, z0], [X0, Y0, z0]]]) out.push({ corners: [a, b, c], group: 'roof' });
      if (solid) slab(from);
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
    if (solid) slab(from);
  }
  return out;
}

/**
 * The glazed openings on one side of the shell: the holes (`{ n, plane, u0, u1, z0, z1 }`, plan coordinates, `n` the way
 * the opening looks out, `plane` its outer face) whose outward way is this side's and whose outer face stands within a
 * wall's breadth inside the shell's face at `shellAt`, clipped to the side's run `a0..a1`.
 */
function openingsOn(holes, alongX, shellAt, n, a0, a1) {
  return holes.filter((h) => h.n[0] === n[0] && h.n[1] === n[1] && Math.abs(h.plane - shellAt) < 0.6 && h.u1 > a0 && h.u0 < a1)
    .map((h) => ({ ...h, u0: Math.max(a0, h.u0), u1: Math.min(a1, h.u1) }));
}

/** A wall's rectangle `u0..u1 × z0..z1` less the openings in it: the strips between and round them. → [[u0, u1, z0, z1]] */
function cutRect(u0, u1, z0, z1, H) {
  const cuts = [...new Set([u0, u1, ...H.flatMap((h) => [h.u0, h.u1]).filter((u) => u > u0 && u < u1)])].sort((a, b) => a - b), out = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1], mid = (a + b) / 2;
    const over = H.filter((h) => h.u0 <= mid && h.u1 >= mid && h.z1 > z0 && h.z0 < z1).map((h) => [Math.max(z0, h.z0), Math.min(z1, h.z1)]).sort((p, q) => p[0] - q[0]);
    let z = z0;
    for (const [lo, hi] of over) { if (lo > z) out.push([a, b, z, lo]); z = Math.max(z, hi); }
    if (z < z1) out.push([a, b, z, z1]);
  }
  return out;
}

/**
 * A bay building's glazed openings, read off its inside before it is moved: each window's sky card (era/bay-glass.js
 * glazeOpening) stands at the opening's outer face, as wide and as tall as it, facing in. → [{ n, plane, u0, u1, z0, z1 }]
 */
function openingsOf(faces) {
  return faces.filter((f) => f.group === 'stage:sky').map((f) => {
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]), zs = f.corners.map((c) => c[2]);
    const alongX = Math.abs(f.normal[1]) > 0.5, n = alongX ? [0, -Math.sign(f.normal[1])] : [-Math.sign(f.normal[0]), 0];
    const [u0, u1] = alongX ? [Math.min(...xs), Math.max(...xs)] : [Math.min(...ys), Math.max(...ys)];
    return { n, plane: alongX ? ys[0] : xs[0], u0, u1, z0: Math.min(...zs), z1: Math.max(...zs) };
  });
}

/**
 * The door a building is entered by when the scene changes at it (`enter: 'door'`): its zone on the threshold
 * outside, and where a walker coming back out stands (on the land a few steps out, facing away). `x` the door's
 * middle and `y0` its wall's outer face, in plan (the front faces -y); `out` how far the stoop runs.
 */
function doorOf(id, x, y0, out, F, ground) {
  const zone = F.toWorld([x, y0 - 0.7]), back = F.toWorld([x, y0 - out - 2.4]), [nx, ny] = F.rot([0, -1]), odd = F.q % 2 === 1;
  const gz = (p) => ground(p[0], p[1]) ?? F.floor;
  return { id, at: P3([zone[0], zone[1], F.floor]), half: odd ? [0.75, 1.4, 2] : [1.4, 0.75, 2], spawn: P3([back[0], back[1], gz(back)]), heading: r5(Math.atan2(ny, nx)) };
}

/** Whether a point lies on a street's paving (its road, walks, kerbs and door paths): a lookup over their top faces. */
function pavedBy(faces) {
  const C = 2, cells = new Map(), tops = faces.filter((f) => /^street:(road|walk|kerb)$/.test(f.group) && f.normal[2] > 0.7);
  for (const f of tops) {
    const P = f.corners.map((c) => [c[0], c[1]]), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) {
      const k = `${i},${j}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(P);
    }
  }
  const inside = (P, x, y) => { let s = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  return (x, y) => (cells.get(`${Math.floor(x / C)},${Math.floor(y / C)}`) || []).some((P) => inside(P, x, y));
}

/** The live grass with no cell on the paving: a cell's tufts stand anywhere in it, so a cell any corner of which is paved
 *  grows none (era/isekai.js liveGrassConfig's mask, bit 1 the cell grows). */
function offPaving(L, paved) {
  const g = L.grid, M = Uint8Array.from(Buffer.from(g.m.__b64, 'base64')), CX = g.nx - 1;
  let n = 0;
  for (let j = 0; j < g.ny - 1; j++) for (let i = 0; i < CX; i++) {
    if (!(M[j * CX + i] & 1)) continue;
    const at = (a, b) => paved(g.x0 + (i + a) * g.cell, g.y0 + (j + b) * g.cell);
    if (at(0, 0) || at(1, 0) || at(1, 1) || at(0, 1) || at(0.5, 0.5)) { M[j * CX + i] = 0; n++; }
  }
  return n ? { ...L, grid: { ...g, m: { ...g.m, __b64: Buffer.from(M.buffer).toString('base64') } } } : L;
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
  const street = manifest.town !== undefined ? townStreet(manifest.town, manifest.kit, manifest.seed, !!ctx.solid) : [];
  const list = [...list0, ...street];
  const kitId = manifest.kit, ground = groundIndex(payload.faces), paint = paintFor(kitId, manifest.town?.paint);
  const pockets = (payload.anchors || []).filter((a) => a.kind === 'beat' && a.beat === 'pocket');
  const sun = unit(payload.sky?.sun?.dir ?? [0.45, -0.55, 0.7]);
  const seated = [], taken = [], reserved = [];
  const beats = (payload.anchors || []).filter((a) => a.kind === 'beat' && Array.isArray(a.at)).sort((p, q) => (p.s ?? p.at[1]) - (q.s ?? q.at[1]));
  const bounds = (payload.colliders || []).filter((c) => String(c.of || '').startsWith('bound:'));
  const rough = cellsOf(payload.faces, ROUGH), path = cellsOf(payload.faces, PATH);
  let faces = payload.faces, lights = [...(payload.lights || [])], colliders = [...(payload.colliders || [])], anchors = [...(payload.anchors || [])];
  const cutouts = new Set(payload.cutouts || []);
  // the town's street (`town.street`, stage-street.js): the trail through it laid as its language's lane; the houses
  // seated to front it, behind its footway, and kept off it
  const ST = manifest.town?.street && manifest.trail !== undefined ? (() => {
    const L = townLanguage(structureStyle(kitId, manifest.town.seed ?? manifest.seed ?? 1), manifest.town.anchor);
    return { L, span: streetSpan(L), site: outTrailOf(manifest).site };
  })() : null;
  const offStreet = (x, y) => ST && Math.abs(x - ST.site.trailX(y)) < ST.span.half + 0.2;
  // the street's stretch: from before its first house to past its last, along the trail
  const streetRange = (ys) => [Math.max(0, Math.min(...ys) - 6), Math.min(ST.site.D, Math.max(...ys) + 6)], planned = [];
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
      // the inside: the program on its room kit, a way out of the entry through its front; a base's building (or one
      // given a look) on its bay kit and composed, as a building level is (gameworld/levels.js buildingStage), so its
      // rooms are stocked, its own ways out (a hangar's doors) kept beside the front
      const inner0 = withProgram(composedOf(b) ?? { kind: 'stage', kit: b.kit ?? (anchor === 'shell' ? 'research-lab' : 'gothic-stone'), program: { use: b.use, seed: b.seed ?? 1, civilization: anchor, ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}) } });
      entry = inner0.rooms.find((r) => r.id === inner0._program.entry);
      const front = { room: entry.id, side: '-y' };
      inner = { ...inner0, ways: composedOf(b) ? [front, ...(inner0.ways ?? []).filter((w) => w.room !== front.room || w.side !== front.side)] : [front] };
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
      // (a door with steps stands its floor up them: the steps' foot on the land, era/out-openings.js)
      const floor = Math.max(...atDoor) + (lot?.design?.dims?.steps ? stepsLift(lot.design.dims.steps) : 0.12);
      const cellsIn = (set) => { let n = 0; for (const B of boxes) for (let i = Math.floor(B[0]); i <= Math.floor(B[2]); i++) for (let j = Math.floor(B[1]); j <= Math.floor(B[3]); j++) if (set.has(`${i},${j}`)) n++; return n; };
      const hits = (B, c) => B[0] < c.max[0] && c.min[0] < B[2] && B[1] < c.max[1] && c.min[1] < B[3];
      // a building never stands on a beat of the trail (the way runs through them) or another building
      const onBeat = boxes.some((B) => beats.some((bt) => bt.at[0] > B[0] - 2 && bt.at[0] < B[2] + 2 && bt.at[1] > B[1] - 2 && bt.at[1] < B[3] + 2));
      const onStreet = !!ST && String(id).startsWith('town-') && boxes.some((B) => [[B[0], B[1]], [B[2], B[1]], [B[0], B[3]], [B[2], B[3]], [(B[0] + B[2]) / 2, (B[1] + B[3]) / 2]].some(([x, y]) => offStreet(x, y)));
      const blocked = onBeat || onStreet || boxes.some((B) => bounds.some((c) => hits(B, c)) || taken.some((T2) => B[0] < T2[2] && T2[0] < B[2] && B[1] < T2[3] && T2[1] < B[3]));
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
      const cands = [], street = ST && String(id).startsWith('town-');
      if (street) {
        // a town with a street fronts it: a seat every metre and a half along it, either side, just behind its footway
        // and facing it (the house turned to the nearest quarter), the seats nearest the town's heart first
        for (let y = 2; y <= ST.site.D - 2 + 1e-9; y += 1.5) {
          const x = ST.site.trailX(y), dx = ST.site.trailX(y + 0.5) - ST.site.trailX(y - 0.5), l = Math.hypot(dx, 1), n = [1 / l, -dx / l];
          for (const sg of [1, -1]) {
            const out = [-sg * n[0], -sg * n[1]], f = Math.abs(out[0]) >= Math.abs(out[1]) ? (out[0] >= 0 ? '+x' : '-x') : (out[1] >= 0 ? '+y' : '-y');
            cands.push([[r5(x + sg * n[0] * (ST.span.half + 1.4)), r5(y + sg * n[1] * (ST.span.half + 1.4))], f, 0.15 * Math.abs(y - ST.site.D / 2)]);
          }
        }
      } else {
        for (const p of pockets) { const m = p.mouth ? [p.mouth[0] - p.at[0], p.mouth[1] - p.at[1]] : [0, -1]; cands.push([[p.at[0], p.at[1]], Math.abs(m[0]) >= Math.abs(m[1]) ? (m[0] >= 0 ? '+x' : '-x') : (m[1] >= 0 ? '+y' : '-y')]); }
        beats.forEach((bt, k) => {
          const a = beats[Math.max(0, k - 1)].at, c = beats[Math.min(beats.length - 1, k + 1)].at, d = unit([c[0] - a[0], c[1] - a[1], 0]), n = [-d[1], d[0]];
          for (const off of [5, 8, 11]) for (const sg of [1, -1]) {
            const out = [-sg * n[0], -sg * n[1]], f = Math.abs(out[0]) >= Math.abs(out[1]) ? (out[0] >= 0 ? '+x' : '-x') : (out[1] >= 0 ? '+y' : '-y');
            cands.push([[r5(bt.at[0] + sg * n[0] * off), r5(bt.at[1] + sg * n[1] * off)], f]);
          }
        });
      }
      let best = null;
      for (const [P0, f, near = 0] of cands) { const F = fit(P0, f), sc = score(F) + near; if (!best || sc < best.sc - 1e-9) best = { T: P0, facing: f, sc }; }
      if (!best || best.sc === Infinity) throw new Error(`stage: buildings[${i}] (${id}) finds no place on the land beside the trail; give at: { x, y, facing }`);
      // (a street's house with no free frontage left is not built: stacked on another it would be a ruin)
      if (street && best.sc >= 1000) return;
      T = best.T; facing = best.facing;
    }
    const F = fit(T, facing);
    if (F.off) throw new Error(`stage: buildings[${i}] (${id}) stands off the land`);
    const { q, rot, toWorld, zs, floor, into } = F;
    taken.push(...F.boxes);
    // the planning pass only claims the ground (era/reserve.js): the land is laid again round it before anything is built
    if (ctx.planOnly) {
      reserved.push(...F.boxes.map((B) => B.map(r5)));
      // (a composed building's yard: the ground before its front, as wide as it and YARD deep, kept clear of what grows)
      if (composedOf(b)) { const x0 = Math.min(...rects.map((R0) => R0[0])), x1 = Math.max(...rects.map((R0) => R0[2])), y0 = Math.min(...rects.map((R0) => R0[1])), a = F.toWorld([x0 - 1, y0 - YARD]), c = F.toWorld([x1 + 1, y0]); reserved.push([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])].map(r5)); }
      if (ST && String(id).startsWith('town-')) planned.push(T[1]);
      return;
    }
    const clearUnder = (pad, land = true) => {
      const grow = F.boxes.map((B) => [B[0] - pad, B[1] - pad, B[2] + pad, B[3] + pad]), mid = (f) => { const n = f.corners.length; return [f.corners.reduce((a, c) => a + c[0], 0) / n, f.corners.reduce((a, c) => a + c[1], 0) / n]; };
      faces = faces.filter((f) => { const g = f.group || ''; if (CLEARED.test(g)) { const [cx, cy] = mid(f); return !grow.some((B) => cx >= B[0] && cx <= B[2] && cy >= B[1] && cy <= B[3]); } if (land && (GROUND.test(g) || ROUGH.test(g))) { const [cx, cy] = mid(f); return !F.boxes.some((B) => cx > B[0] && cx < B[2] && cy > B[1] && cy < B[3]); } return true; });
    };
    if (lot) {
      // the shell: the lot's building as the town draws it, painted and lit by the stage's sun, a plinth to the land,
      // one collider round it
      const below0 = Math.max(0.3, floor - Math.min(...zs) + 0.3), Wl = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
      clearUnder(0.4, false);   // a shell has no floor: its land stays (its collider keeps a walker out)
      const Pt = paintRaw(kitId, manifest.town?.paint), lit = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      // (a cube's street dressed: its walls painted from relief, town-dress.js; absent, the paint alone)
      const Dr = manifest.town?.dress, dressed = (face, grp) => (Dr ? dressTownFace(face, grp, Dr) : face);
      const shellF = lot.design.faces.map((f) => { const c = f.corners.map(Wl), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))); return dressed({ ...quad(c, `town:${f.part}`, Pt(f.group, Math.min(1, (f.value ?? 0.6) * lit(nn)))), normal: P3(nn), outNormal: P3(nn) }, f.group); });
      const [x0, y0, x1, y1] = rects[0], plinth = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]].map(([a, c]) => { const cs = [Wl([...a, -below0]), Wl([...c, -below0]), Wl([...c, 0]), Wl([...a, 0])], nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[3], cs[0]))); return dressed({ ...quad(cs, 'town:plinth', Pt('str:stone', 0.45 * lit(nn))), normal: P3(nn), outNormal: P3(nn) }, 'plinth'); });
      // (a screen over a light: one card, its star field a cutout texture, era/screen-tiles.js)
      const screenF = (lot.design.screens || []).map((f) => { const c = f.corners.map(Wl), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), fill = Pt(f.group, Math.min(1, (f.value ?? 0.6) * lit(nn))); cutouts.add(f.texture); return { corners: c.map(P3), group: 'town:screen', fill, cornerFills: c.map(() => fill), normal: P3(nn), outNormal: P3(nn), texture: f.texture, textureLit: true, uv: f.uv }; });
      faces = [...faces, ...shellF, ...screenF, ...plinth];
      const top = Math.max(...lot.design.faces.flatMap((f) => f.corners.map((c) => c[2]))), B = F.boxes[0];
      colliders.push({ min: P3([B[0], B[1], floor - below0]), max: P3([B[2], B[3], floor + top]), of: `${id}:house` });
      const door = b.enter === 'door' ? doorOf(id, doorPlan[0], 0, 0, F, ground) : null;
      anchors.push({ id: `house-${id}`, kind: 'house', use: b.use, at: P3(Wl([doorPlan[0], doorPlan[1], 0])), N: P3((() => { const [nx, ny] = F.rot([0, -1]); return [nx, ny, 0]; })()), floor: r5(floor), box: { min: P3([B[0], B[1], floor]), max: P3([B[2], B[3], floor + top]) },
        ...(door ? { enter: 'door', door, inside: { use: b.use, seed: b.seed ?? 1, civilization: anchor } } : {}) });
      seated.push({ id, use: b.use, house: true, floor: r5(floor), ...(door ? { enter: 'door' } : {}) });
      return;
    }
    if (b.enter === 'door') {
      // the scene changes at its door: the outside only (walls, roofs, stoop), a door shut in the way in, solid; the
      // inside is a level of its own (its program, entered by its door)
      const waysD = planStage(inner).ways ?? [], belowD = Math.max(0.3, floor - Math.min(...zs) + 0.3);
      const Wd = (p) => { const [x, y] = toWorld(p); return [x, y, p[2] + floor]; };
      clearUnder(0.4);
      const L0 = decompileAnchor(typeof anchor === 'string' ? ANCHOR_STRUCTURES[anchor] : anchor, typeof anchor === 'string' ? anchor : null);
      const massD = L0.anchor.pieces.find((p) => p.role === 'mass') ?? {}, capD = L0.anchor.pieces.find((p) => p.role === 'cap') ?? null;
      const lam = (nn) => Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]);
      const DrD = manifest.town?.dress;
      const paintFace = (cs, group, grp, v) => { const nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[cs.length - 1], cs[0]))), F0 = { ...quad(cs, group, paint(grp, Math.min(1, v * (0.55 + 0.45 * lam(nn))))), normal: P3(nn), outNormal: P3(nn) }; return DrD && group !== 'building:door' ? dressTownFace(F0, grp, DrD) : F0; };
      const shellD = shellOf(inner, waysD, 0.5, L0.vocab.cap, L0.proportions.pitch, belowD, {}, !!ctx.solid).map((sf) => paintFace(sf.corners.map(Wd), `building:${sf.group}`, sf.group === 'roof' ? (capD?.group ?? 'str:plaster') : (massD.group ?? 'str:plaster'), sf.group === 'roof' ? (capD?.value ?? 0.5) : (massD.value ?? 0.7)));
      // the door, shut: a leaf filling the way in, set a hand's width inside the outer face
      const wy = waysD[0], y = entry.y - t + 0.08, leaf = [[wy.lo, y, 0], [wy.hi, y, 0], [wy.hi, y, wy.top], [wy.lo, y, wy.top]].map(Wd);
      const doorLeaf = { ...paintFace(leaf.slice().reverse(), 'building:door', 'str:timber', 0.35) };
      const dropD = floor - (ground(...toWorld([doorPlan[0], doorPlan[1] - 0.6])) ?? floor), runD = Math.max(0.6, dropD * 2.5);
      const stoopD = dropD > 0.05 ? (() => {
        const a = wy.lo - 0.2, c = wy.hi + 0.2, y0 = entry.y - t, y1 = y0 - runD, zb = -dropD - 0.15;
        return [[[a, y1, zb], [c, y1, zb], [c, y0, 0], [a, y0, 0]], [[a, y0, 0], [a, y1, zb], [a, y0, zb]], [[c, y1, zb], [c, y0, 0], [c, y0, zb]]].map((cs) => paintFace(cs.map(Wd), 'building:stoop', 'str:stone', 0.5));
      })() : [];
      faces = [...faces, ...shellD, doorLeaf, ...stoopD];
      const tallD = Math.max(12, ...shellD.flatMap((f) => f.corners.map((c) => c[2] - floor)));
      for (const B of F.boxes) colliders.push({ min: P3([B[0], B[1], floor - belowD]), max: P3([B[2], B[3], floor + tallD]), of: `${id}:shut` });
      const door = doorOf(id, doorPlan[0], entry.y - t, dropD > 0.05 ? runD : 0, F, ground);
      anchors.push({ id: `building-${id}`, kind: 'building', use: b.use, enter: 'door', language: L0.id, turn: q, at: P3(Wd([doorPlan[0], doorPlan[1], 0])), N: P3((() => { const [nx, ny] = rot([0, -1]); return [nx, ny, 0]; })()), floor: r5(floor),
        door, inside: { use: b.use, seed: b.seed ?? 1, civilization: anchor, ...(b.kit ? { kit: b.kit } : {}), ...(b.rooms ? { rooms: b.rooms } : {}), ...(b.add ? { add: b.add } : {}), ...(b.look !== undefined ? { look: b.look } : {}), ...(b.tone !== undefined ? { tone: b.tone } : {}) }, ...(b.goal ? { isGoal: true } : {}) });
      seated.push({ id, use: b.use, enter: 'door', language: L0.id, floor: r5(floor), into: r5(Math.max(0, into)), rough: F.rough, findings: inner._program.findings.map((f) => f.says) });
      return;
    }
    // (a composed bay building takes the land's sun at its windows, turned into its plan's frame, and its windows open
    // through the shell: the sky cards that stood behind them in a room on its own are where the shell is cut)
    const bay = !!composedOf(b);
    const P0 = assembleStageScene(bay ? { ...inner, _sun: sunIn(payload.sky, q) } : inner, ctx), ways = planStage(inner).ways ?? [];
    const holes = bay ? openingsOf(P0.faces) : null, P = bay ? { ...P0, faces: P0.faces.filter((f) => f.group !== 'stage:sky') } : P0;
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
    // (a composed bay building wears its construction outside, painted in its palette: style/bay-exterior.js)
    const X = bay ? exteriorOf(P0.compose?.axes) : null;
    const shell = X ? shellOf(inner, ways, 0.5, X.cap, X.pitch, below, tops, !!ctx.solid, { holes, parapet: X.parapet }).map((s) => {
      // (lit by the land's sun where its sky has one, else by its day alone: a dusk under its moon, a night; the fill is
      // the light the page multiplies the tile by, so a sunlit wall carries white and shows its material as painted)
      const c = s.corners.map(W), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), lam = payload.sky?.sun?.dir ? Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]) : 0;
      const T = s.group === 'roof' ? X.roof : X.wall, flat = Math.abs(nn[2]) > 0.5, day = Math.max(0, Math.min(1, payload.sky?.day ?? 1)), g = Math.round(255 * Math.min(1, (0.68 + 0.32 * lam) * (0.35 + 0.65 * day))), fill = `#${g.toString(16).padStart(2, '0').repeat(3)}`;
      const uv = c.map((p) => (flat ? [p[0], p[1]] : [p[0] * -nn[1] + p[1] * nn[0], p[2]]).map((v) => r5(v / T.scale)));
      return { ...quad(c, `building:${s.group}`, fill), texture: T.key, textureLit: true, uv, normal: P3(nn), outNormal: P3(nn) };
    }) : shellOf(inner, ways, 0.5, L.vocab.cap, L.proportions.pitch, below, tops, !!ctx.solid).map((s) => {
      const c = s.corners.map(W), nn = unit(cross(sub3(c[1], c[0]), sub3(c[c.length - 1], c[0]))), lam = Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]);
      const roof = s.group === 'roof', v = (roof ? roofV : wallV) * (0.55 + 0.45 * lam);
      const F0 = { ...quad(c, `building:${s.group}`, paint(roof ? roofGroup : wallGroup, Math.min(1, v))), normal: P3(nn), outNormal: P3(nn) };
      return manifest.town?.dress ? dressTownFace(F0, roof ? roofGroup : wallGroup, manifest.town.dress) : F0;
    });
    // the stoop: a ramp down from the threshold to the land in front of the door, as wide as the way out, so a walker
    // (and a hero, who steps only so high) comes in off the land
    const wy = ways[0], drop = floor - (ground(...toWorld([doorPlan[0], doorPlan[1] - 0.6])) ?? floor), run = Math.max(0.6, drop * 2.5);
    const stoop = drop > 0.05 ? (() => {
      const a = wy.lo - 0.2, c = wy.hi + 0.2, y0 = entry.y - t, y1 = y0 - run, zt = 0, zb = -drop - 0.15;
      const top = [[a, y1, zb], [c, y1, zb], [c, y0, zt], [a, y0, zt]].map(W), sides = [[[a, y0, zt], [a, y1, zb], [a, y0, zb]], [[c, y1, zb], [c, y0, zt], [c, y0, zb]]].map((tri) => tri.map(W));
      return [top, ...sides].map((cs) => { const nn = unit(cross(sub3(cs[1], cs[0]), sub3(cs[cs.length - 1], cs[0]))), lit = 0.35 + 0.65 * Math.max(0, nn[0] * sun[0] + nn[1] * sun[1] + nn[2] * sun[2]); const F0 = { ...quad(cs, 'building:stoop', paint('str:stone', Math.min(1, 0.5 * lit))), normal: P3(nn), outNormal: P3(nn) }; return manifest.town?.dress ? dressTownFace(F0, 'plinth', manifest.town.dress) : F0; });
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
    // (on storeys, each room at its floor: storeys.js)
    const PI = planStage(inner), zIn = (r) => PI.rooms.find((q) => q.id === r.id).z0 ?? 0;
    const roomBox = (r) => { const a = W([r.x + t, r.y + t, zIn(r)]), c = W([r.x + r.w - t, r.y + r.d - t, zIn(r) + r.h]); return { min: P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), a[2]]), max: P3([Math.max(a[0], c[0]), Math.max(a[1], c[1]), c[2]]) }; };
    const anchorRec = {
      id: `building-${id}`, kind: 'building', use: b.use, enter: 'walk', language: L.id, ...(X ? { look: { construction: P0.compose.axes.construction, palette: P0.compose.axes.palette } } : {}), turn: q,
      at: P3(W([doorPlan[0], doorPlan[1], 0])), N: P3(turnN([0, -1, 0])), floor: r5(floor),
      entry: entry.id, goal: goal?.id ?? null, rooms: inner.rooms.map((r) => ({ id: r.id, box: roomBox(r), ...(r.storey ? { storey: r.storey } : {}) })),
      route, goalAt: P3([...toWorld(L2.goal.at), floor + (L2.goal.at[2] ?? 0)]), ...(PI.storeys ? { storeys: PI.storeys.length } : {}), ...(b.goal ? { isGoal: true } : {}),
    };
    anchors.push(anchorRec);
    seated.push({ id, use: b.use, entry: entry.id, goal: goal?.id ?? null, language: L.id, ...(X ? { look: anchorRec.look } : {}), floor: r5(floor), into: r5(Math.max(0, into)), rough: F.rough,
      findings: [...inner._program.findings.map((f) => f.says), ...(into > 2.5 ? [`the ${id} is cut ${r5(into)} m into its slope: its back rooms stand below the land (another pocket, or at a flatter place)`] : []),
        ...(bay && F.blocked ? [`the ${id} found no place clear of the trail's beats, the stage's edge and the other buildings: it stands over one (a smaller plan, fewer bays or wings, or at: { x, y, facing })`] : [])] });
  });
  // (planning: the street's ground is reserved too, so nothing grows on it when the land is laid again)
  if (ctx.planOnly && ST && planned.length) {
    const [y0, y1] = streetRange(planned);
    for (let y = y0; y < y1; y += 2) { const xs = [y, y + 1, y + 2].map((q) => ST.site.trailX(Math.min(q, y1))), h = ST.span.half + 0.5; reserved.push([r5(Math.min(...xs) - h), r5(y), r5(Math.max(...xs) + h), r5(Math.min(y + 2, y1))]); }
  }
  if (ctx.planOnly) return { reserved };
  // the street, once its houses stand: from before the first to past the last along the trail, the land's growth and
  // the trail under it cleared, a path of slabs to each door
  let liveGrass = null;
  if (ST && !ctx.planOnly) {
    const doors = anchors.filter((a) => (a.kind === 'house' || a.kind === 'building') && String(a.id).includes('town-'));
    if (doors.length) {
      const [y0, y1] = streetRange(doors.map((d) => d.at[1]));
      const fillOf = (re) => faces.find((f) => re.test(f.group || '') && typeof f.fill === 'string')?.fill ?? '#8a7a62';
      const lit = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      const { faces: SF, clear } = layStreet(ST.site, ST.L, ST.span, { y0, y1, ground, paint, lit, soil: fillOf(/:trail$/), grass: fillOf(/:ground$/), dress: manifest.town.dress, doors });
      const mid = (f) => { const n = f.corners.length; return [f.corners.reduce((a, c) => a + c[0], 0) / n, f.corners.reduce((a, c) => a + c[1], 0) / n]; };
      // (nothing grows on the street's own ground either, its door paths among it: what stands within a hand of it goes;
      // and the land wholly under its paving goes with the trail, so no blend of the trail's runs under the street: its
      // kerbs and walks are its edge)
      const paved = pavedBy(SF), near = (x, y) => paved(x, y) || [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dy]) => paved(x + dx, y + dy));
      const under = (f) => f.corners.every((c) => paved(c[0], c[1])) && paved(...mid(f));
      faces = [...faces.filter((f) => { const g = f.group || ''; if (GROUND.test(g) && under(f)) return false; if (!(CLEARED.test(g) || PATH.test(g))) return true; const [cx, cy] = mid(f); return !clear(cx, cy) && !(CLEARED.test(g) && near(cx, cy)); }), ...SF];
      if (payload.liveGrass) liveGrass = offPaving(payload.liveGrass, paved);
    }
  }
  return { ...payload, faces, ...(liveGrass ? { liveGrass } : {}), ...(cutouts.size ? { cutouts: [...cutouts].sort() } : {}), lights, colliders, anchors, buildings: seated };
}
