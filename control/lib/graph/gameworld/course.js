/**
 * THE COURSE — a platforming segment: floors and the gaps between them laid along a trail's own line, each gap and each
 * step SIZED BY THE REACH of the hero's feel (feel/reach.js) and TAGGED with the move it teaches. A platformer's level is
 * standard where an RPG's is not: trails linked one after another, each teaching what the next tests (its first level
 * the slice: basic, meet, advanced, gauntlet, boss).
 *
 *   TEACH         what a segment is for:
 *                   basic     the base movement: gaps and steps the running jump clears, widening as it goes
 *                   meet      the first encounter: one long floor, flat, room to meet a foe and learn the stomp or the blow
 *                   advanced  the card's advanced moves, each introduced just past the running jump, then tested: the air
 *                             jump (a step higher than a jump), the dash jump (a gap wider than one), the wall kick (a
 *                             face taller than a jump, kicked up)
 *                   gauntlet  basic gaps between floors long enough to fight on: movement and attack together
 *                   boss      one long floor: the arena
 *   VERTICALITY   how the floors climb: flat (level), rolling (up and down), climbing (each step up), towering (each step
 *                 up and taller: the wall's own in an advanced segment)
 *
 *   coursePlan(reach, { teach, verticality, length }) → { teach, verticality, lift, floors: [{ s0, s1, z }], gaps: [{
 *       s0, s1, w, dz, teaches, kind }] }: stations in metres along the line, heights over the course's base (the
 *       trailhead's ground plus `lift`), each gap between floor k and k+1: its width, its rise (negative a drop), the
 *       move it teaches and its kind (gap | step | drop | wall)
 *   courseLaws(plan, reach) → [{ id, holds, says }] the machine gate: every gap crossed by the move it teaches; an
 *       advanced one past the running jump; floors long enough to land on and to fight on
 *   lowerCourse(plan, lane, { player }) → { blocks, events: { sources, reactions } }: the floors as walkway tiles over
 *       the line (squares sized so their edges sit on the planned stations however the line turns), the stairs up onto
 *       the course and down to the exit, and a CATCH zone in each gap that puts a fallen hero back on the floor it left
 *
 * Pure and deterministic: no dice (the plan is the teaching's order, sized by the reach).
 */
import { reachAt } from './feel/reach.js';

export const TEACH = Object.freeze(['basic', 'meet', 'advanced', 'gauntlet', 'boss']);
export const VERTICALITY = Object.freeze({
  flat: { up: 0, down: 0, says: 'level floors: the gaps alone' },
  rolling: { up: 0.35, down: 0.35, says: 'up a step, down a step' },
  climbing: { up: 0.5, down: 0, says: 'each floor a step up' },
  towering: { up: 0.7, down: 0, says: 'each floor a tall step up' },
});
// the walkway: its width across the line, the tile laid along it, the course's lift over the trailhead's ground (the
// drop a gap falls to), the stairs' riser and tread, a floor's least length (a landing), a fighting floor's
const WIDTH = 3, TILE = 1.5, LIFT = 2.2, RISER = 0.22, TREAD = 0.4, LAND = 4, FIGHT = 9, MARGIN = 0.35, END = 3;
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * A level's `course` as written: { teach, verticality? } for every trail of its walk, or { <trail node>: { teach,
 * verticality? } } each its own (a node it does not name has none). Throws, teaching. → the same, read.
 */
export function readCourse(v, at) {
  const one = (c, where) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error(`gameworld: ${where} is { teach, verticality? }`);
    for (const k of Object.keys(c)) if (!['teach', 'verticality'].includes(k)) throw new Error(`gameworld: ${where}.${k} is not a course setting (teach, verticality)`);
    if (!TEACH.includes(c.teach)) throw new Error(`gameworld: ${where}.teach is one of ${TEACH.join(', ')}`);
    if (c.verticality !== undefined && !VERTICALITY[c.verticality]) throw new Error(`gameworld: ${where}.verticality is one of ${Object.keys(VERTICALITY).join(', ')}`);
    return { teach: c.teach, ...(c.verticality !== undefined ? { verticality: c.verticality } : {}) };
  };
  if (v && typeof v === 'object' && !Array.isArray(v) && v.teach === undefined) {
    if (!Object.keys(v).length) throw new Error(`gameworld: ${at} is { teach, verticality? } or { <trail node>: { teach, verticality? } }`);
    return Object.fromEntries(Object.entries(v).map(([n, c]) => [n, one(c, `${at}.${n}`)]));
  }
  return one(v, at);
}
/** A stage's course: its node's, or the level's one; null when it has none. */
export const courseAt = (course, node) => (!course ? null : course.teach !== undefined ? course : course[node] ?? null);

/** The card's advanced moves the reach carries, in teaching order. */
export function advancedMoves(reach) {
  return ['air', 'dash', 'wall'].filter((m) => (m === 'wall' ? !!reach.wall : !!reach.moves?.[m]));
}

/** The gaps a segment teaches, in order: [{ teaches, w (share of the move's reach past the base), dz }] in metres. */
function beatsOf(reach, teach, verticality) {
  const V = VERTICALITY[verticality], run = reach.moves.run, H = run.height, L = run.long;
  // a basic gap: a share of the running jump's reach at the step's own height (so a step up is narrower)
  const basic = (share, k) => {
    const dz = k % 2 === 0 ? V.up * H * (verticality === 'rolling' ? 0.8 : 1) : (verticality === 'rolling' ? -V.down * H * 2 : V.up * H);
    const span = reachAt(run, dz) ?? L;
    return { teaches: 'run', w: r3(span * share), dz: r3(dz) };
  };
  if (teach === 'basic') return [0.35, 0.5, 0.6, 0.7].map((s, k) => basic(s, k));
  if (teach === 'gauntlet') return [0.45, 0.55, 0.6].map((s, k) => basic(s, k));
  if (teach === 'meet' || teach === 'boss') return [];
  // advanced: each move introduced just past the running jump, then tested nearer its own reach
  const out = [];
  for (const m of advancedMoves(reach)) {
    if (m === 'wall') {
      // a face taller than the jump: one kick, then two
      const climb = reach.wall.climb;
      out.push({ teaches: 'wall', w: 0, dz: r3(H + 0.6 * climb), kind: 'wall' }, { teaches: 'wall', w: 0, dz: r3(H + 1.4 * climb), kind: 'wall' });
      continue;
    }
    const M = reach.moves[m];
    if (m === 'air') {
      // a step higher than the jump, then a wide gap
      out.push({ teaches: 'air', w: 1.2, dz: r3(H + 0.35 * (M.height - H)) }, { teaches: 'air', w: r3(L + 0.6 * (M.long - L)), dz: 0 });
    } else {
      // a gap wider than the running jump, then wider still
      out.push({ teaches: m, w: r3(L + 0.3 * (M.long - L)), dz: 0 }, { teaches: m, w: r3(L + 0.65 * (M.long - L)), dz: 0 });
    }
    out.push(basic(0.5, 0));   // a breath between moves
  }
  if (out.length && out.at(-1).teaches === 'run') out.pop();
  return out;
}

/** The course a segment lays: its floors and the gaps between them along `length` metres of line. */
export function coursePlan(reach, { teach = 'basic', verticality = 'flat', length = 72 } = {}) {
  if (!TEACH.includes(teach)) throw new Error(`course: teach is one of ${TEACH.join(', ')}`);
  if (!VERTICALITY[verticality]) throw new Error(`course: verticality is one of ${Object.entries(VERTICALITY).map(([k, v]) => `${k} (${v.says})`).join(', ')}`);
  const beats = beatsOf(reach, teach, verticality);
  const stairs = Math.ceil(LIFT / RISER) * TREAD;
  const s0 = END + stairs, s1 = length - END - stairs, room = s1 - s0;
  // the floors share what the gaps leave, a fighting segment's floors long enough to fight on
  const gapsLen = beats.reduce((a, b) => a + b.w, 0), n = beats.length + 1;
  const least = teach === 'gauntlet' || teach === 'meet' || teach === 'boss' ? FIGHT : LAND;
  if (room - gapsLen < n * least) throw new Error(`course: ${length} m of line holds no ${teach} course (its gaps take ${r3(gapsLen)} m, its ${n} floors need ${n * least} m)`);
  const floorLen = (room - gapsLen) / n;
  const floors = [], gaps = [];
  let s = s0, z = 0;
  for (let k = 0; k < n; k++) {
    floors.push({ s0: r3(s), s1: r3(s + floorLen), z: r3(z) });
    s += floorLen;
    const b = beats[k];
    if (!b) break;
    gaps.push({ s0: r3(s), s1: r3(s + b.w), w: b.w, dz: b.dz, teaches: b.teaches, kind: b.kind ?? (b.w > 0 ? 'gap' : b.dz >= 0 ? 'step' : 'drop') });
    s += b.w; z += b.dz;
  }
  return { teach, verticality, lift: LIFT, start: r3(END), end: r3(length - END), floors, gaps };
}

/** The course's laws: what the machine gate reads. */
export function courseLaws(plan, reach) {
  const run = reach.moves.run, laws = [];
  const law = (id, holds, says) => laws.push({ id, holds: !!holds, says });
  plan.gaps.forEach((g, k) => {
    const id = `gap-${k + 1}`;
    if (g.kind === 'wall') {
      const W = reach.wall, kicks = Math.ceil(Math.max(0, g.dz - run.height) / (W?.climb || 1));
      law(id, W && g.dz > run.height && kicks <= 3, `a ${g.dz} m face: past the jump's ${run.height} m, ${kicks} kick${kicks === 1 ? '' : 's'} up it (at most three)`);
      return;
    }
    const M = g.teaches === 'run' ? run : reach.moves[g.teaches], at = reachAt(M, g.dz);
    law(id, at !== null && at >= g.w + MARGIN, `${g.w} m across, ${g.dz} m up: the ${g.teaches === 'run' ? 'running jump' : g.teaches} reaches ${at ?? 'not that high'}`);
    if (g.teaches !== 'run') {
      const base = reachAt(run, g.dz);
      law(`${id}-teaches`, base === null || base < g.w, `the running jump ${base === null ? 'cannot rise' : `reaches ${base} m`} ${g.dz} m up: the ${g.teaches} is needed`);
    }
  });
  if (plan.teach === 'advanced') law('advanced', advancedMoves(reach).length > 0, advancedMoves(reach).length ? `it teaches ${advancedMoves(reach).join(', then ')}` : 'the feel has no advanced move to teach (a template with its takes: true carries its air jump, its dash, its wall)');
  const fight = ['gauntlet', 'meet', 'boss'].includes(plan.teach) ? FIGHT : LAND;
  law('floors', plan.floors.every((f) => f.s1 - f.s0 >= fight - 1e-6), `every floor at least ${fight} m: room to land${fight > LAND ? ' and to fight' : ''}`);
  return laws;
}

// ─── the lowering ───────────────────────────────────────────────────────────
/** The line at station s (metres along it): its point and heading, interpolated. */
function along(line, s) {
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i], d = Math.hypot(bx - ax, by - ay);
    if (acc + d >= s || i === line.length - 1) { const u = d ? Math.max(0, Math.min(1, (s - acc) / d)) : 0; return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, h: Math.atan2(by - ay, bx - ax) }; }
    acc += d;
  }
  return { x: line[0][0], y: line[0][1], h: 0 };
}
// a square's reach from its centre along heading h: its edge
const edge = (a, h) => a / Math.max(Math.abs(Math.cos(h)), Math.abs(Math.sin(h)));

/** The course as the level's blocks and its catch zones. */
export function lowerCourse(plan, lane, { player = 'hero', value = 0.58 } = {}) {
  const { line, ground } = lane, a = WIDTH / 2;
  const base = ground(...(({ x, y }) => [x, y])(along(line, plan.start))) + plan.lift;
  const blocks = [], parts = [], sources = [], reactions = [];
  const tile = (s, top, lo, floor) => {
    const P = along(line, s);
    blocks.push({ min: [r3(P.x - a), r3(P.y - a), r3(lo)], max: [r3(P.x + a), r3(P.y + a), r3(top)] }); parts.push({ floor });
  };
  const lowUnder = (s0, s1) => { let lo = Infinity; for (let s = s0; s <= s1 + 1e-9; s += 1) { const P = along(line, s); for (const [dx, dy] of [[-a, -a], [a, -a], [-a, a], [a, a]]) lo = Math.min(lo, ground(P.x + dx, P.y + dy)); } return lo - 0.3; };
  // the floors: tiles every TILE metres, the first and the last set back so their edges sit on the floor's ends
  plan.floors.forEach((f, k) => {
    const top = base + f.z, lo = lowUnder(f.s0, f.s1);
    const e0 = edge(a, along(line, f.s0).h), e1 = edge(a, along(line, f.s1).h);
    const first = f.s0 + e0, last = f.s1 - e1;
    for (let s = first; s < last; s += TILE) tile(s, top, lo, k);
    tile(last, top, lo, k);
  });
  // the stairs: up from the trailhead's ground onto the first floor, down from the last floor to the exit's ground
  const steps = Math.ceil(plan.lift / RISER), f0 = plan.floors[0], fN = plan.floors.at(-1), topN = base + fN.z;
  for (let k = 0; k < steps; k++) {
    const sU = f0.s0 - (steps - k) * TREAD + TREAD / 2, PU = along(line, sU), zU = base - plan.lift + (k + 1) * (plan.lift / steps);
    blocks.push({ min: [r3(PU.x - a), r3(PU.y - a), r3(lowUnder(sU, sU))], max: [r3(PU.x + a), r3(PU.y + a), r3(zU)] }); parts.push({ stair: 'up' });
    const sD = fN.s1 + k * TREAD + TREAD / 2, PD = along(line, sD), gD = ground(PD.x, PD.y), zD = topN - (k + 1) * ((topN - gD) / steps);
    if (zD > gD + 0.05) { blocks.push({ min: [r3(PD.x - a), r3(PD.y - a), r3(lowUnder(sD, sD))], max: [r3(PD.x + a), r3(PD.y + a), r3(zD)] }); parts.push({ stair: 'down' }); }
  }
  // the catch zones: each gap's void below its floors' tops, a fallen hero put back on the floor it left
  plan.gaps.forEach((g, k) => {
    if (g.kind === 'wall' || g.w <= 0) return;
    const P0 = along(line, g.s0), P1 = along(line, g.s1), back = along(line, g.s0 - 1);
    const fromTop = base + plan.floors[k].z, toTop = base + plan.floors[k + 1].z, top = Math.min(fromTop, toTop) - 0.8;
    const lo = lowUnder(g.s0, g.s1) - 2, cx = (P0.x + P1.x) / 2, cy = (P0.y + P1.y) / 2;
    const zone = `__course-${k + 1}__`;
    sources.push({ type: 'zone', zone, at: [r3(cx), r3(cy), r3((top + lo) / 2)], half: [r3(Math.abs(P1.x - P0.x) / 2 + a), r3(Math.abs(P1.y - P0.y) / 2 + a), r3((top - lo) / 2)], watch: player });
    reactions.push({ on: 'enter', match: { zone }, do: 'move', target: player, to: [r3(back.x), r3(back.y), r3(fromTop + 0.1)] });
  });
  // (`parts`: what each block is, in order: a floor by its index, or a stair up or down; a side strip skins by it)
  return { blocks: [{ blocks, course: false, value }], events: { sources, reactions }, base: r3(base), parts };
}
