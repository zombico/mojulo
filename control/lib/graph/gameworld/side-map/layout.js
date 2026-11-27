/**
 * THE SIDE MAP'S LAYOUT (docs/side-map-principles.md): a zone chain (zones.js) laid on the along × up plane, in screens
 * (screen.js: the side map's camera for the hero's stature) and in the hero's reach (feel/reach.js). Each zone is laid
 * from where the last one left the walk; what the camera sees is its SWEPT area (a run's band one screen thick, a shaft's
 * one screen wide, a room's its size), what the play moves in is OPEN, and the rest is CLOSED (solid, painted later).
 *
 * The frame is the lane's (as the side strip's): `s` along the lane (+y), `z` up, the camera on the +x side; a solid is
 * drawn across the lane's width (x ±1.5). A floor stands two thirds of the way down its band: a band spans a third of a
 * screen under the floor and two thirds over it.
 *
 *   across  the course (course.js coursePlan) for what it teaches, at the run's length: floors and the gaps between, the
 *           path then designed from the top down (path.js: a profile by its role, steps and blocks along it),
 *           every gap open to the frame's bottom (a pit: falling out of it is a life); `pillars` a pit crossed on tops a
 *           jump apart; `ceiling` a held ceiling a jump and a body over the floor
 *   up      a shaft narrower than a screen, its walls closed out to the frame's edges, the next floor on its far wall's
 *           top: a CHIMNEY (rests on alternating walls, never more than three kicks apart, a pickup on each), LEDGES
 *           (tops a jump apart up the face), a SWITCHBACK (floors back and forth, a gap at alternate ends), a STAIR
 *           (short steps), a LADDER (climbed hand over hand); `rises`: its frame climbs on its own (the camera's)
 *   down    a CASCADE (steps down, a jump high each, going on along the lane) or a CHUTE (a one-way shaft, a shutter at
 *           its foot)
 *   room    floor, walls and ceiling at its size in screens, entered by a door at the floor (a boss's, its shutter)
 *
 *   layoutSideMap(map, { reach, stature }) → {
 *     screen, camera,                         the screen in metres and the side map's camera (screen.js)
 *     zones: [{ i, kind, run?, rect, exit, lock }]   each zone's swept rectangle, where the walk leaves it, the axis its
 *                                             camera holds ('z' across, 's' up and a chute, null a room and a cascade)
 *     swept, open, solids: [{ s0, s1, z0, z1, zone, role }]   the camera's area, the play's, the closed parts
 *     blocks: [{ min, max, role }]            the solids as the level's boxes
 *     gaps, rests, ladders, doors, spawners, pickups, checkpoints, advice
 *     steps: [{ zone, s, dz }]                 the path's features along a run (path.js): where its height rises or drops
 *     rises: [{ zone, from, to, pace }]       a rising frame and its pace, a share of the bot's (RISE_SHARE, climbTime)
 *   }
 *
 * Pure and deterministic.
 */
import { coursePlan } from '../course.js';
import { FPS } from '../feel/cards.js';
import { sideMapCamera } from './screen.js';
import { readSideMap } from './zones.js';
import { shapeRun } from './path.js';

const HALF = 1.5, TH = 0.4, PAD = 1.5, LAND = 4, LEDGE = 1.2, LADDER_SHAFT = 2.4, WALL = 0.6;
/** a storey's floor across a climb more than a screen tall: as thick as a building's (the castle's floor and ceiling) */
export const SLAB = 1.6;
/** the rising frame's share of the bot's pace up its climb (the frame takes this much longer than the bot: a margin) */
export const RISE_SHARE = 0.7;
/** a ladder climbed hand over hand, metres a second (the runtime's ladder, phase 8, climbs at it) */
export const LADDER_RATE = 2;
const PAUSE = 0.5, FRAME = 1 / FPS;

/**
 * How long the bot takes up a climb on the shipped rule, seconds: a chimney by its kicks (each its measured cycle, at least a jump's rise) and a
 * breath and the shaft crossed at each rest; ledges, a stair or a switchback a jump a stand and a walk across the shaft for each; a ladder at
 * its rate. Read off the reach: a running jump's rise, its height, the run's speed.
 */
export function climbTime({ climb, from, to, rests = [], width = 0, legs = [] }, reach) {
  const run = reach.moves.run, A = run.arc, apex = A.reduce((i, p, k) => (p[1] > A[i][1] ? k : i), 0) * FRAME, L = to - from;
  if (climb === 'ladder') return L / LADDER_RATE;
  // (a tower, an atrium: each storey's chimney by its kicks and rests, a ladder at its rate, and each storey crossed
  // from where the last was left to where the next is risen)
  if (climb === 'tower' || climb === 'atrium') {
    let t = 0, s = legs[0] ? (legs[0].span ? legs[0].span[0] : legs[0].s) : 0;
    for (const g of legs) {
      const at = g.span ? (g.span[0] + g.span[1]) / 2 : g.s;
      t += Math.abs(at - s) / (reach.speed ?? 5);
      t += g.kind === 'ladder' ? (g.zt - g.zb) / LADDER_RATE : climbTime({ climb: 'chimney', from: g.zb, to: g.zt, rests: g.rests, width: g.span[1] - g.span[0] }, reach);
      s = g.kind === 'ladder' ? g.s : g.exitDir > 0 ? g.span[1] + 1 : g.span[0] - 1;
    }
    return t;
  }
  const zs = [from, ...rests.map((r) => r.z), to];
  if (climb === 'chimney') {
    // (each kick its measured cycle, kick to kick, where the reach measured one: a stronger kick flies further off the
    // wall and takes longer back to it than a jump's rise)
    const kick = reach.wall?.climb || run.height, each = Math.max(apex, reach.wall?.every || 0);
    let kicks = 0; for (let k = 1; k < zs.length; k++) kicks += Math.ceil((zs[k] - zs[k - 1]) / kick - 1e-9);
    // (and each rest a breath and the shaft crossed: the rests stand on alternate walls, the next kicked from across)
    return kicks * each + rests.length * (PAUSE + width / (reach.speed ?? 5));
  }
  return (zs.length - 1) * (2 * apex + PAUSE + width / 2 / (reach.speed ?? 5));
}
const r3 = (v) => Math.round(v * 1000) / 1000;
// a rectangle less another: what is left of it, in at most four pieces (none thinner than a millimetre)
const cut = (r, o) => {
  if (!(o.s0 < r.s1 - 1e-3 && o.s1 > r.s0 + 1e-3 && o.z0 < r.z1 - 1e-3 && o.z1 > r.z0 + 1e-3)) return [r];
  const a = Math.max(r.s0, o.s0), b = Math.min(r.s1, o.s1), out = [];
  const add = (s0, s1, z0, z1) => { if (s1 - s0 > 1e-3 && z1 - z0 > 1e-3) out.push({ ...r, s0: r3(s0), s1: r3(s1), z0: r3(z0), z1: r3(z1) }); };
  add(r.s0, a, r.z0, r.z1); add(b, r.s1, r.z0, r.z1); add(a, b, r.z0, Math.min(r.z1, o.z0)); add(a, b, Math.max(r.z0, o.z1), r.z1);
  return out;
};

/** The zone chain laid on the plane. */
export function layoutSideMap(map, { reach, stature }) {
  const M = readSideMap(map), camera = sideMapCamera(stature), W = camera.screen.width, H = camera.screen.height;
  const run = reach.moves.run, J = run.height, LJ = run.long, kick = reach.wall?.climb ?? null;
  const door = r3(stature + J + 0.4);
  const out = { screen: camera.screen, camera, stature, steps: [], towers: [], zones: [], swept: [], open: [], solids: [], gaps: [], rests: [], ladders: [], doors: [], spawners: [], pickups: [], checkpoints: [], rises: [], advice: [] };
  const rect = (list, s0, s1, z0, z1, zone, role) => { if (s1 - s0 > 1e-6 && z1 - z0 > 1e-6) list.push({ s0: r3(s0), s1: r3(s1), z0: r3(z0), z1: r3(z1), zone, ...(role ? { role } : {}) }); };
  const solid = (s0, s1, z0, z1, zone, role) => rect(out.solids, s0, s1, z0, z1, zone, role);
  const band = (z) => [z - H / 3, z + (2 * H) / 3];
  const advise = (zone, says) => out.advice.push({ zone, says });

  // A TOWER (a screen wide) or an ATRIUM (two), climbed as a wall-climbing hero climbs: STOREYS, a thick floor at every
  // screen of height (SLAB), each risen through a CHUTE: a chimney of two walls up the shaft's own wall and an inner
  // one (kicked up, its rests within three kicks, as a chimney's; entered under its inner wall, left over it onto the
  // floor above, the last over the far wall's top: the way out), the chutes at the two ends in turn so every storey is
  // crossed; a LADDER only where a wall kick has nothing to kick off (an atrium's middle storey, risen through a chute in
  // the open; every storey, for a hero that kicks off no wall). No stairs: going up is the wall's. `out.towers` its legs,
  // in the order climbed
  const built = (Z, i, s, z) => {
    const L = Z.screens * H, two = Z.climb === 'atrium', n = Math.max(1, Math.round(Z.screens)), w = r3(two ? 2 * W - 2 * WALL : W - 2 * WALL - 2.2);
    const top = z + L, side = two ? WALL : r3((W - w) / 2), c = s + side, cw = r3(Math.min(Math.max(0.9 * LJ, 2.4), 0.4 * W)), TIN = 1, CHUTE = 2.4;
    solid(s, c + w, band(z)[0], z, i, 'floor');
    solid(c - side, c, z + door, top + (2 * H) / 3, i, 'wall');
    solid(c + w, c + w + side, band(z)[0], top, i, 'wall');
    rect(out.open, c, c + w, z, top + (2 * H) / 3, i);
    rect(out.open, s, c, z, z + door, i);
    const lv = Array.from({ length: n + 1 }, (_, k) => (k === n ? top : z + (k * L) / n));
    // (where each storey is risen: the last at the far end, the way out; down from it the ends in turn; an atrium's
    // storey under the last in the open at its middle, by a ladder)
    const at = Array.from({ length: n }, (_, j) => (n - 1 - j) % 2 === 0 ? 'hi' : 'lo');
    if (two && n >= 2) { at[n - 2] = 'mid'; for (let k = n - 3; k >= 0; k--) at[k] = at[k + 1] === 'mid' ? (at[n - 1] === 'hi' ? 'lo' : 'hi') : at[k + 1] === 'hi' ? 'lo' : 'hi'; }
    const legs = [], chutes = Array.from({ length: n + 1 }, () => []), mid = c + w / 2;
    for (let k = 1; k <= n; k++) {
      const zb = lv[k - 1], zt = lv[k], where = at[k - 1], last = k === n, ladder = !kick || where === 'mid';
      if (ladder) {
        // (a ladder up through a chute in the open, or, a hero with no wall kick, up the end's own wall)
        const ls = where === 'mid' ? mid : where === 'lo' ? c + 0.6 : c + w - 0.6, ch = where === 'mid' ? [ls - CHUTE / 2, ls + CHUTE / 2] : where === 'lo' ? [c, c + CHUTE] : [c + w - CHUTE, c + w];
        const lipS = where === 'hi' ? ch[0] : ch[1], off = where === 'hi' ? lipS - 0.8 : lipS + 0.8;
        if (!last) chutes[k].push(ch);
        if (last) out.ladders.push({ zone: i, foot: [r3(ls), r3(zb)], lip: [r3(c + w), r3(zt)], off: [r3(c + w + 0.8), r3(zt)], face: 'camera' });
        else out.ladders.push({ zone: i, foot: [r3(ls), r3(zb)], lip: [r3(lipS), r3(zt)], off: [r3(off), r3(zt)], face: 'camera' });
        legs.push({ kind: 'ladder', s: r3(ls), zb: r3(zb), zt: r3(zt) });
        continue;
      }
      // (a chimney at the end: the shaft's wall and an inner wall, open under the inner one a door's height to be
      // entered, its rests on the two walls in turn, the last on the wall it is left over)
      // (entered through the shaft's own doorway, the ground storey's at the near end, its inner wall stands whole; else
      // it is entered under its inner wall, a door's height open)
      const [a, bnd] = where === 'lo' ? [c, c + cw] : [c + w - cw, c + w], innerS = where === 'lo' ? [bnd, bnd + TIN] : [a - TIN, a];
      const byDoor = k === 1 && where === 'lo';
      solid(innerS[0], innerS[1], byDoor ? zb : zb + door, last ? zt : zt - SLAB, i, 'wall');
      if (!last) chutes[k].push([a, bnd]);
      const exitDir = last ? 1 : where === 'lo' ? 1 : -1, most = 0.9 * Math.min(3 * kick, zt - zb);
      // (the first rest on the wall open at its foot, so the first kick is off the whole wall across from it; the last on
      // the wall it is left over: as many rests as that takes, evenly)
      const gapLeft = byDoor || where === 'hi', exitLeft = exitDir < 0;
      let m = Math.max(1, Math.ceil((zt - zb) / most) - 1);
      if (((m - 1) % 2 === 0) !== (gapLeft === exitLeft)) m++;
      const restOn = (j) => ((m - j) % 2 === 0 ? (exitLeft ? 'left' : 'right') : exitLeft ? 'right' : 'left');
      const rests = [];
      for (let j = 1; j <= m; j++) {
        const rz = zb + (j * (zt - zb)) / (m + 1), left = restOn(j) === 'left', r0 = left ? a : bnd - LEDGE, r1 = left ? a + LEDGE : bnd;
        solid(r0, r1, rz - TH, rz, i, 'rest');
        const R = { zone: i, s0: r3(r0), s1: r3(r1), z: r3(rz), side: left ? 'near' : 'far' };
        rests.push(R); out.rests.push(R);
        out.pickups.push({ zone: i, at: [r3((r0 + r1) / 2), r3(rz + 0.4)] });
      }
      legs.push({ kind: 'chimney', span: [r3(a), r3(bnd)], zb: r3(zb), zt: r3(zt), exitDir, rests });
    }
    // THE STOREYS' FLOORS: thick, across the shaft, open at their chutes
    for (let k = 1; k < n; k++) {
      const cuts = chutes[k].sort((x, y) => x[0] - y[0]);
      let from = c;
      for (const [a, bnd] of [...cuts, [c + w, c + w]]) { if (a - from > 0.05) solid(from, a, lv[k] - SLAB, lv[k], i, 'slab'); from = Math.max(from, bnd); }
    }
    out.towers.push({ zone: i, legs });
    if (Z.rises) { const t = climbTime({ climb: Z.climb, from: z, to: top, legs, width: w }, reach); out.rises.push({ zone: i, from: r3(z), to: r3(top), pace: r3((RISE_SHARE * L) / t) }); }
    rect(out.swept, c - side, c + w + side, band(z)[0], top + (2 * H) / 3, i);
    out.checkpoints.push({ zone: i, at: [r3(c + 1.2), r3(z)] });
    return { rect: [c - side, c + w + side, band(z)[0], top + (2 * H) / 3], exit: [c + w, top], lock: two ? null : 's' };
  };

  const LAY = {
    across(Z, i, s, z) {
      const L = Z.screens * W, floors = [];
      if (Z.pillars) {
        // a pit crossed on PILLARS: a landing, the tops a running jump's share apart at unlike heights, a landing
        const gap = r3(0.6 * LJ), lift = [0, 0.3, -0.25, 0.2, -0.1];
        floors.push({ s0: 0, s1: LAND, z: 0 });
        let at = LAND;
        for (let k = 0; k < Z.pillars; k++) { at += gap; floors.push({ s0: at, s1: at + LEDGE, z: r3(J * lift[k % lift.length]), pillar: true }); at += LEDGE; }
        at += gap;
        if (at + LAND > L) advise(i, `${Z.pillars} pillars need ${r3(at + LAND)} m and the run is ${r3(L)} m: it is laid longer`);
        floors.push({ s0: at, s1: Math.max(L, at + LAND), z: 0 });
        // (each gap between the tops a pit, crossed by the running jump)
        for (let k = 1; k < floors.length; k++) { const a = floors[k - 1], b = floors[k]; out.gaps.push({ zone: i, s0: r3(s + a.s1), s1: r3(s + b.s0), w: r3(b.s0 - a.s1), dz: r3(b.z - a.z), teaches: 'run', kind: 'pillar' }); }
      } else {
        const teach = Z.teach && Z.teach !== 'boss' ? Z.teach : 'boss';
        let plan;
        // (no wall face in a run: the wall kick is a climb's to teach, and a run stays one screen thick)
        try { plan = coursePlan(reach, { teach, verticality: 'flat', length: L, lift: 0, end: PAD, floor: 0, walls: false }); }
        catch { plan = coursePlan(reach, { teach: 'boss', verticality: 'flat', length: Math.max(L, 30), lift: 0, end: PAD, floor: 0 }); advise(i, `${r3(L)} m (${Z.screens} screens) holds no ${teach} course: it is laid as one floor; give it more screens`); }
        const laid = [{ s0: 0, s1: plan.floors[0].s0, z: 0 }, ...plan.floors, { s0: plan.floors.at(-1).s1, s1: Math.max(L, plan.floors.at(-1).s1), z: plan.floors.at(-1).z }];
        // THE PATH, designed from the top down (path.js): the run's profile from its role and where it leads, its beats
        // on the bay grid the back wall's pillars and seams stand on, never at a pit's lip or on a dash's runway
        const N = M.zones[i + 1], toward = N?.run === 'up' ? 1 : N?.run === 'down' ? -1 : 0;
        const role = Z.teach ?? (Z.beat === 'rest' || Z.beat === 'landing' ? Z.beat : 'run');
        const P = shapeRun(laid, { role, toward, W, H, J, gaps: plan.gaps, length: Math.max(L, laid.at(-1).s1), stepUp: reach.rule?.step ?? 0.35 });
        floors.push(...P.floors);
        for (const st of P.steps) out.steps.push({ zone: i, s: r3(s + st.s), dz: st.dz });
        for (const g of plan.gaps) out.gaps.push({ zone: i, s0: r3(s + g.s0), s1: r3(s + g.s1), w: g.w, dz: g.dz, teaches: g.teaches, kind: g.kind });
      }
      // (the band the camera holds, from the way in: the path's heights stand inside it, path.js)
      const len = Math.max(L, floors.at(-1).s1), lo = Math.min(...floors.map((f) => f.z)), hi = Math.max(...floors.map((f) => f.z));
      const [zb, zt] = band(z);
      for (const f of floors) solid(s + f.s0, s + f.s1, zb, z + f.z, i, f.pillar ? 'pillar' : 'floor');
      const ceil = Z.ceiling ? z + hi + Math.max(door, 0.35 * H) : zt;
      if (Z.ceiling) solid(s, s + len, ceil, zt, i, 'ceiling');
      rect(out.open, s, s + len, z + lo, ceil, i);
      rect(out.swept, s, s + len, zb, zt, i);
      // where foes come from, along the run (a count), each over the floor under it
      const floorAt = (u) => floors.find((f) => u >= f.s0 && u <= f.s1) ?? floors[0];
      // (one that falls over a gap stands on the nearest floor, a metre in from its edge: never in the air over a pit)
      const onFloor = (u) => { if (floors.some((f) => u >= f.s0 && u <= f.s1)) return u; const f = floors.reduce((a, b) => (Math.min(Math.abs(u - b.s0), Math.abs(u - b.s1)) < Math.min(Math.abs(u - a.s0), Math.abs(u - a.s1)) ? b : a)); return Math.max(f.s0 + Math.min(1, (f.s1 - f.s0) / 2), Math.min(f.s1 - Math.min(1, (f.s1 - f.s0) / 2), u)); };
      for (let k = 0; k < (Z.spawners ?? 0); k++) { const u = onFloor((len * (k + 0.5)) / Z.spawners), f = floorAt(u); out.spawners.push({ zone: i, at: [r3(s + u), r3(z + f.z)] }); }
      if (Z.beat === 'landing') out.pickups.push({ zone: i, at: [r3(s + len / 2), r3(z + floorAt(len / 2).z + 0.5)] });
      out.checkpoints.push({ zone: i, at: [r3(s + PAD / 2), r3(z)] });
      return { rect: [s, s + len, zb, zt], exit: [s + len, z + floors.at(-1).z], lock: 'z' };
    },
    up(Z, i, s, z) {
      const L = Z.screens * H, form = Z.climb;
      if (form === 'tower' || form === 'atrium') return built(Z, i, s, z);
      if (form === 'chimney' && !kick) advise(i, 'the hero kicks off no wall (its feel has no cling): a chimney cannot be climbed; climb it by ledges');
      const w = r3(form === 'chimney' ? Math.min(Math.max(0.9 * LJ, 2.4), 0.4 * W) : form === 'ladder' ? LADDER_SHAFT : Math.min(Math.max(3 * LJ, 8), 0.45 * W));
      // (the shaft stands a wall's thickness on from where the walk came in: its near wall rises from a doorway at its foot,
      // so a chimney has both its walls from the floor up even where the run before it is open to the frame's top)
      const side = (W - w) / 2, c = s + WALL, top = z + L;
      // the shaft's floor, its near wall over the way in (a door's height open), its far wall up to the next floor
      solid(s, c + w, band(z)[0], z, i, 'floor');
      solid(c - side, c, z + door, top + (2 * H) / 3, i, 'wall');
      solid(c + w, c + w + side, band(z)[0], top, i, 'wall');
      rect(out.open, c, c + w, z, top + (2 * H) / 3, i);
      rect(out.open, s, c, z, z + door, i);   // (the doorway: after the shaft, which is the zone's first open)
      const rests = [];
      if (form === 'chimney' || form === 'stair' || form === 'ledges') {
        // a rest, on alternate walls: a chimney's within three kicks, a ledge stair's a jump up, a stair's a short step
        // (a stair's step as short as a standing hero allows: two rests on one wall are two steps apart, and the hero stands
        // on the lower under the upper)
        const most = form === 'chimney' ? 0.9 * Math.min(3 * (kick || J), L) : form === 'stair' ? Math.max(0.45 * J, (stature + TH + 0.2) / 2) : 0.75 * J;
        // (evenly spaced, no further apart than the form allows, the last on the far wall: the way out)
        // (a chimney's first rest on the near wall, over its doorway; a ledge stair's and a stair's on the far wall, so the
        // doorway at the foot is not walked into the first one's edge: the count kept so the last is on the far wall)
        const nearFirst = form === 'chimney';
        let n = Math.ceil(L / most) - 1; if ((n % 2 === 0) !== nearFirst) n++;
        const step = L / (n + 1);
        for (let k = 1, at = z + step; k <= n; k++, at = z + k * step) {
          const left = (k % 2 === 1) === nearFirst;
          const s0 = left ? c : c + w - (form === 'chimney' ? LEDGE : 0.45 * w), s1 = left ? c + (form === 'chimney' ? LEDGE : 0.45 * w) : c + w;
          solid(s0, s1, at - TH, at, i, 'rest');
          rests.push({ zone: i, s0: r3(s0), s1: r3(s1), z: r3(at), side: left ? 'near' : 'far' });
          if (form === 'chimney') out.pickups.push({ zone: i, at: [r3((s0 + s1) / 2), r3(at + 0.4)] });
        }
      } else if (form === 'switchback') {
        // floors across the shaft, an opening at alternate ends, stacked far enough apart for the hero to stand under
        // the one above (more than a jump: so a STEP stands on each floor under the opening above it, half the rise, and
        // the climb is two hops: onto the step, up through the opening)
        const gap = Math.max(LEDGE * 2, 0.6 * LJ), least = stature + TH + 0.2;
        // (evenly spaced, no closer than a standing hero allows, an odd count so the last reaches the far wall)
        let n = Math.max(1, Math.floor(L / least) - 1); if (n % 2 === 0) n--;
        const step = L / (n + 1);
        const stepUnder = (k, base) => {
          // the step on the floor at `base` under floor k's opening (k odd: its opening at the near end; even: the far;
          // the last, the far wall's top over the far end)
          const near = k <= n && k % 2 === 1, a = near ? c + gap - LEDGE : c + w - gap, b0 = near ? c + gap : c + w - gap + LEDGE;
          const [sa, sb] = k > n ? [c + w - LEDGE, c + w] : [a, b0];
          solid(sa, sb, base, base + step / 2, i, 'step');
          rests.push({ zone: i, s0: r3(sa), s1: r3(sb), z: r3(base + step / 2), side: 'step' });
        };
        for (let k = 1, at = z + step; k <= n; k++, at = z + k * step) {
          stepUnder(k, at - step);
          const s0 = k % 2 ? c + gap : c, s1 = k % 2 ? c + w : c + w - gap;
          solid(s0, s1, at - TH, at, i, 'rest');
          rests.push({ zone: i, s0: r3(s0), s1: r3(s1), z: r3(at), side: k % 2 ? 'far' : 'near' });
        }
        stepUnder(n + 1, top - step);
      } else if (form === 'ladder') {
        out.ladders.push({ zone: i, foot: [r3(c + w / 2), r3(z)], lip: [r3(c + w), r3(top)], face: 'camera' });
      }
      out.rests.push(...rests);
      if (Z.rises) { const t = climbTime({ climb: form, from: z, to: top, rests, width: w }, reach); out.rises.push({ zone: i, from: r3(z), to: r3(top), pace: r3((RISE_SHARE * L) / t) }); }
      rect(out.swept, c - side, c + w + side, band(z)[0], top + (2 * H) / 3, i);
      out.checkpoints.push({ zone: i, at: [r3(c + w / 2), r3(z)] });
      return { rect: [c - side, c + w + side, band(z)[0], top + (2 * H) / 3], exit: [c + w, top], lock: 's' };
    },
    down(Z, i, s, z) {
      const L = Z.screens * H, c = s;
      if (Z.drop === 'chute') {
        const w = LADDER_SHAFT, side = (W - w) / 2, foot = z - L;
        solid(c - side, c, band(foot)[0], z, i, 'wall');
        solid(c + w, c + w + side, foot + door, band(z)[1], i, 'wall');
        solid(c, c + w, band(foot)[0], foot, i, 'floor');
        rect(out.open, c, c + w, foot, band(z)[1], i);
        rect(out.swept, c - side, c + w + side, band(foot)[0], band(z)[1], i);
        out.doors.push({ zone: i, at: [r3(c + w), r3(foot)], kind: 'shutter', why: 'a chute is one-way: its foot shuts behind' });
        out.checkpoints.push({ zone: i, at: [r3(c + w / 2), r3(foot)] });
        return { rect: [c - side, c + w + side, band(foot)[0], band(z)[1]], exit: [c + w, foot], lock: 's' };
      }
      // a CASCADE: steps down, each a jump high and a landing long, the camera following both ways down them: a step
      // is seen from every frame within half a screen of it, so its solid goes as deep as the lowest of those frames
      const n = Math.max(1, Math.round(L / J)), d = L / n, m = Math.ceil((W / 2 + LAND / 2) / LAND);
      let lo = z;
      for (let k = 1; k <= n; k++) {
        const zk = z - k * d, s0 = c + (k - 1) * LAND, s1 = c + k * LAND, deep = band(z - Math.min(n, k + m) * d)[0];
        solid(s0, s1, deep, zk, i, 'step');
        rect(out.swept, s0, s1, deep, band(zk)[1], i);
        rect(out.open, s0, s1, zk, band(zk)[1], i);
        lo = zk;
      }
      out.checkpoints.push({ zone: i, at: [r3(c + LAND / 2), r3(z - d)] });
      return { rect: [c, c + n * LAND, band(lo)[0], band(z)[1]], exit: [c + n * LAND, lo], lock: null };
    },
    room(Z, i, s, z) {
      const wR = Z.room[0] * W, hR = Z.room[1] * H, c = s, zb = z - H / 3, top = zb + hR, wall = 0.6;
      solid(c, c + wR, zb, z, i, 'floor');
      solid(c, c + wR, top - wall, top, i, 'ceiling');
      solid(c, c + wall, z + door, top - wall, i, 'wall');
      solid(c + wR - wall, c + wR, z, top - wall, i, 'wall');
      rect(out.open, c + wall, c + wR - wall, z, top - wall, i);
      rect(out.open, c, c + wall, z, z + door, i);
      rect(out.swept, c, c + wR, zb, top, i);
      if (Z.teach === 'boss') out.doors.push({ zone: i, at: [r3(c), r3(z)], kind: 'shutter', why: 'the boss\'s room: its door shuts behind', span: [r3(c), r3(c + wall)], top: r3(z + door) });
      out.checkpoints.push({ zone: i, at: [r3(c + wall + 1), r3(z)] });
      return { rect: [c, c + wR, zb, top], exit: [c + wR, z], lock: null };
    },
  };

  let s = 0, z = 0;
  M.zones.forEach((Z, i) => {
    const F = LAY[Z.kind === 'room' ? 'room' : Z.run](Z, i, s, z);
    out.zones.push({ i, kind: Z.kind, ...(Z.run ? { run: Z.run } : {}), rect: F.rect.map(r3), exit: F.exit.map(r3), lock: F.lock, ...(Z.teach ? { teach: Z.teach } : {}), ...(Z.beat ? { beat: Z.beat } : {}), ...(Z.climb ? { climb: Z.climb } : {}), ...(Z.drop ? { drop: Z.drop } : {}) });
    [s, z] = F.exit;
  });
  // a zone's solids never stand in another zone's open space, nor over another zone's solids: each is cut to what is
  // left (a shaft's near wall would hang into the run before it, a chute's far wall into the room after it)
  const kept = [];
  for (const r of out.solids) {
    let parts = [r];
    for (const o of [...out.open.filter((o) => o.zone !== r.zone), ...kept.filter((k) => k.zone !== r.zone)]) parts = parts.flatMap((p) => cut(p, o));
    kept.push(...parts);
  }
  out.solids = kept;
  out.blocks = out.solids.map((r) => ({ min: [-HALF, r.s0, r.z0], max: [HALF, r.s1, r.z1], role: r.role }));
  return out;
}
