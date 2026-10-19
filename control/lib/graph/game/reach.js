/**
 * THE REACH — which surfaces a hero's moves carry it to (the city stalker's progression: the gear's reach gates the map).
 * A level is its collider boxes and its grounds; a SURFACE is a ground or a box's top with room to stand on (not lidded,
 * wide enough for the body). A MOVE joins two surfaces by its own law, read with the engine's own dials (the platform
 * rule's run and jump, the wall's, wall.js, and the gear's, swing.js), so what the solver reaches is what the hero can:
 *
 *   walk    onto a surface within a step of the one it stands on, touching it
 *   jump    up to the jump's height (its air jumps added), across the gap its flight carries at that height
 *   drop    down any height, across the gap the fall carries
 *   wall    (rule.wall) up a face it can hold (no narrower than the wall's minFace, not `hold: false`), met from where it
 *           stands or a jump from it, to the top of that face (boxes stacked flush on its plane climb as one), if the
 *           top is a surface
 *   swing   (rule.gear) across to a surface no higher than a jump and the gear's clearance lift (the reel lifts the hero
 *           off the arc's bottom), within the line's reach, with an anchor over the way: a face's top or an underside the
 *           line can take, clear of both ends by the gear's clearance
 *
 * Analytic, not a simulation: a law per move, each held to the engine's own runs (reach.test.js), so a move it allows
 * the engine makes; one it refuses a player's skill may still find. Grounds default to one plane at 0 everywhere; a level
 * with water or a chasm names its own (`grounds: [{ x0, y0, x1, y1, z }]`), and a rooftop level none (`grounds: []`).
 *
 *   reachOf({ colliders, grounds?, start? }, rule) → { surfaces, reached: Set<id>, via: Map<id, { from, move }> }
 *     `start`: [x, y, z] where the hero stands (its feet), the surface under it; by default the first ground
 *   reachUpgrades(level, base, moves) → { <move>: [surface ids reached with it and not without it] }
 *   surfaceAt(surfaces, at) → the surface under a point's feet, or null
 *
 * Pure, deterministic.
 */
import { composeLive } from '../worlds/controllable/compose.js';

let E = null;
const engine = () => (E ||= composeLive());
const EPS = 0.05, INF = 1e9;

/** The rule's dials the laws read, its lengths in the world's units (the defaults metres × `metre`, as the engine's). */
function dialsOf(rule) {
  const m = rule.metre ?? 1, g = rule.gravity ?? 20 * m, vj = rule.jumpSpeed ?? 8.5 * m, run = rule.speed ?? 6 * m;
  const air = rule.airJumps ?? 0, mult = rule.airJumpMult ?? 0.9;
  const hJump = (vj * vj) / (2 * g) + air * ((vj * mult) ** 2) / (2 * g), tUp = vj / g + air * (vj * mult) / g;
  return {
    m, g, run, hJump, tUp, R: rule.collideRadius ?? 0, H: rule.collideHeight ?? 1.7 * m, step: rule.step ?? 0.35 * m,
    wall: rule.wall ? engine().wallDials(rule) : null, gear: rule.gear ? engine().gearOf(rule) : null,
  };
}

const gapOf = (a, b) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1));
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const rectOf = (c) => ({ x0: c.min[0], y0: c.min[1], x1: c.max[0], y1: c.max[1] });

/** The level's surfaces: its grounds, and every box top with room to stand (no box over most of it within a body's
 *  height, wider than the body both ways); a box marked `hold: false` (a level's edge) is none. */
export function surfacesOf({ colliders = [], grounds = null }, rule = {}) {
  const D = dialsOf(rule), out = [];
  for (const [i, g] of (grounds ?? [{ x0: -INF, y0: -INF, x1: INF, y1: INF, z: 0 }]).entries()) out.push({ id: `ground:${i}`, ground: true, z: g.z ?? 0, rect: { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 } });
  colliders.forEach((c, i) => {
    if (c.hold === false) return;
    const r = rectOf(c), z = c.max[2];
    if (r.x1 - r.x0 < 2 * D.R || r.y1 - r.y0 < 2 * D.R) return;
    const lid = colliders.reduce((a, o) => (o !== c && o.min[2] >= z - EPS && o.min[2] < z + D.H ? a + overlap(r, rectOf(o)) : a), 0);
    if (lid >= 0.9 * (r.x1 - r.x0) * (r.y1 - r.y0)) return;
    out.push({ id: c.of ?? `box:${i}`, box: i, z, rect: r });
  });
  return out;
}

/** The surface under a point's feet: the highest one whose rect holds it, at or under its height. */
export function surfaceAt(surfaces, at) {
  let best = null;
  for (const s of surfaces) {
    const r = s.rect;
    if (at[0] < r.x0 - EPS || at[0] > r.x1 + EPS || at[1] < r.y0 - EPS || at[1] > r.y1 + EPS || s.z > at[2] + 0.5) continue;
    if (!best || s.z > best.z) best = s;
  }
  return best;
}

// the top a holdable face carries a climb to: up the boxes stacked flush on its plane, from the box it starts on
function climbTop(cs, c, ax, s) {
  const at = s > 0 ? c.max[ax] : c.min[ax], ta = 1 - ax;
  let top = c;
  for (let grew = true; grew;) {
    grew = false;
    for (const o of cs) {
      if (o === top || o.hold === false || Math.abs((s > 0 ? o.max[ax] : o.min[ax]) - at) > EPS) continue;
      if (o.max[ta] <= top.min[ta] || o.min[ta] >= top.max[ta] || Math.abs(o.min[2] - top.max[2]) > EPS) continue;
      top = o; grew = true;
    }
  }
  return top;
}

/** The moves out of a surface: [{ to, move }]. */
function movesFrom(A, surfaces, cs, D, byBox) {
  const out = [];
  for (const B of surfaces) {
    if (B === A) continue;
    const dz = B.z - A.z, gap = gapOf(A.rect, B.rect);
    if (Math.abs(dz) <= D.step && gap <= 2 * D.R + EPS) { out.push({ to: B, move: 'walk' }); continue; }
    if (dz > 0 && dz <= D.hJump && gap <= D.run * (D.tUp + Math.sqrt(2 * (D.hJump - dz) / D.g)) + 2 * D.R) { out.push({ to: B, move: 'jump' }); continue; }
    if (dz < 0 && gap <= D.run * (D.tUp + Math.sqrt(2 * (D.hJump - dz) / D.g)) + 2 * D.R) { out.push({ to: B, move: 'drop' }); continue; }
  }
  // the wall: a face met from here (standing, or a jump's flight out), climbed to its top
  if (D.wall) {
    const flight = D.run * 2 * D.tUp + D.wall.reach + D.R;
    for (const c of cs) {
      if (c.hold === false || c.min[2] > A.z + D.hJump + D.H * 0.5 || c.max[2] <= A.z + D.H * 0.5) continue;
      if (gapOf(A.rect, rectOf(c)) > flight) continue;
      for (const ax of [0, 1]) for (const s of [-1, 1]) {
        const ta = 1 - ax;
        if (c.max[ta] - c.min[ta] < D.wall.minFace) continue;
        const T = byBox.get(climbTop(cs, c, ax, s));
        if (T && T !== A) out.push({ to: T, move: 'wall' });
      }
    }
  }
  // the swing: across at height, under an anchor the line can take
  if (D.gear) {
    for (const B of surfaces) {
      // (the arc's bottom stands `clear` over the ground and the reel lifts the hero off it: a swing lands a jump and the
      // clearance higher than it set out, at the least; the engine's runs go higher, reach.test.js)
      if (B === A || B.z > A.z + D.hJump + D.gear.clear || gapOf(A.rect, B.rect) > D.gear.reach) continue;
      const need = Math.max(A.z, B.z) + Math.min(D.gear.clear, D.H) + D.H;
      // the middle of the way: between the two surfaces' nearest edges, or of their overlap
      const mx = (Math.max(A.rect.x0, B.rect.x0) + Math.min(A.rect.x1, B.rect.x1)) / 2, my = (Math.max(A.rect.y0, B.rect.y0) + Math.min(A.rect.y1, B.rect.y1)) / 2;
      const near = { x0: mx, y0: my, x1: mx, y1: my };
      if (cs.some((c) => c.hold !== false && (c.max[2] >= need || c.min[2] >= need) && gapOf(near, rectOf(c)) <= D.gear.reach * 0.7)) out.push({ to: B, move: 'swing' });
    }
  }
  return out;
}

export function reachOf(level, rule = {}) {
  const cs = level.colliders || [], D = dialsOf(rule), surfaces = surfacesOf(level, rule);
  const byBox = new Map(surfaces.filter((s) => s.box !== undefined).map((s) => [cs[s.box], s]));
  const start = level.start ? surfaceAt(surfaces, level.start) : surfaces.find((s) => s.ground) ?? surfaces[0];
  const reached = new Set(), via = new Map();
  if (!start) return { surfaces, reached, via, start: null };
  reached.add(start.id);
  const queue = [start];
  while (queue.length) {
    const A = queue.shift();
    for (const { to, move } of movesFrom(A, surfaces, cs, D, byBox)) {
      if (reached.has(to.id)) continue;
      reached.add(to.id); via.set(to.id, { from: A.id, move }); queue.push(to);
    }
  }
  return { surfaces, reached, via, start: start.id };
}

/** What each move opens: the surfaces reached with it over `base` and not without it. */
export function reachUpgrades(level, base, moves) {
  const without = reachOf(level, base).reached;
  return Object.fromEntries(Object.entries(moves).map(([id, patch]) => [id, [...reachOf(level, { ...base, ...patch }).reached].filter((s) => !without.has(s))]));
}
