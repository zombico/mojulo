/**
 * THE SIDE MAP'S BOT — the machine gate's player (docs/side-map-principles.md "What holds it"): a laid map played to its
 * end on the rule its game ships (feel/lower.js), under the side map's camera (worlds/controllable/sidemap.js), as the
 * layout says the way goes. It reads the map as a player who knows it would, and says what playing it took.
 *
 *   a run      held right; a hop at each step up the path (path.js) and each crate standing in it (crates.js); a jump at each pit's lip (the move it teaches: a running jump, a dash jump out of a dash
 *              begun a few frames before, a jump and an air dash at its apex)
 *   a chimney  the next stand (a rest, then the way out over the far wall's top): kicked up the wall across from it, kick
 *              after kick, until the feet are over it, then over onto it. Each kick counted; the least the feet stood
 *              over the rising frame's bottom is the climb's MARGIN
 *   a foe      ahead on its floor within FOE_AHEAD m (cast.js): fired at, a tap every FOE_TAP frames; hopped when it reaches it
 *   a ladder   walked to, held up to its top
 *   a drop     walked off (a cascade's steps, a chute)
 *   a room     crossed to its far wall: the end; a room holding a foe (a boss) fought first, from ROOM_NEAR to ROOM_FAR m
 *              off it, firing, hopping now and then over what it lobs
 *
 *   playSideMap(layout, reach, { stature, seconds?, trace?, drive? }) → { done, time, falls, downed, climbs: [{ zone, climb, kicks, margin,
 *                time }], at }   done: the hero stood in the last zone at its far side within `seconds` (240)
 *
 * Deterministic: a fixed step, the same map plays the same way.
 */
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';
import { groundOf } from '../../playscape/terrain.js';
import { sideMapPlay } from './play.js';

const DT60 = 1 / 60, LIP = 0.35, DASH_LEAD = 5, FOE_AHEAD = 9, FOE_TAP = 8, ROOM_NEAR = 4.5, ROOM_FAR = 7, ROOM_HOP = 50;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A laid map played to its end by the bot, on the rule its game ships (`reach.rule`). */
export function playSideMap(layout, reach, { stature = 1.7, seconds = 240, trace = null, drive = null } = {}) {
  const L = layout, P = sideMapPlay(L, { stature }), rule = reach.rule;
  // (its own world by default; `drive`: another's, { world, dt, step(input) }: a level resolved as its page resolves it,
  // played on its bus, game/level-sim.js)
  const own = drive ? null : createWorld({
    entities: [{ id: 'hero', pilotable: true, rule: { ...rule, type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: stature, move: 'lane', lane: [[0, -50], [0, 1e5]] }, transform: { pos: P.spawn, heading: Math.PI / 2 } }, ...P.ladders],
    camera: P.camera, pilot: 'hero', colliders: P.colliders,
  });
  const hooks = { ground: groundOf(P.colliders, -1e4) }, w = drive ? drive.world : own, DT = drive?.dt ?? DT60, h = w.byId.hero, last = L.zones.at(-1);
  const kickGap = Math.max(1, Math.round(2 / 60 / DT)), lead = Math.max(1, Math.round((DASH_LEAD / 60) / DT));
  const climbs = L.zones.filter((Z) => Z.run === 'up').map((Z) => ({ zone: Z.i, climb: Z.climb, kicks: 0, margin: Infinity, t0: null, time: null }));
  let f = 0, dashAt = null, lastKick = -99, done = false, aim = null, standZ = null;
  const press = (input) => { if (trace) trace(f, h, w.camera.frame, input); return drive ? drive.step(input) : stepWorld(w, input, DT, hooks); };
  for (; f < seconds / DT && !done; f++) {
    // (its zone: the furthest along whose open space it stands in, not the camera's, which turns a corner early)
    const p = h.transform.pos, s = p[1], z = p[2], inOpen = L.open.filter((r) => s >= r.s0 - 0.05 && s <= r.s1 + 0.05 && z >= r.z0 - 0.5 && z <= r.z1);
    const k = inOpen.length ? Math.max(...inOpen.map((r) => r.zone)) : w.camera.frame?.zone ?? 0, Z = L.zones[k];
    // (a room holding a foe still standing, a boss's: fought from a gun's distance, back and forth, firing, till it falls)
    const held = Z.kind === 'room' ? (w.entities || []).find((e) => e.team === 'foes' && !e.gone && !e.downed && !e.dormant && e.transform && e.transform.pos[1] >= Z.rect[0] && e.transform.pos[1] <= Z.rect[1]) : null;
    if (held) {
      const d = held.transform.pos[1] - s, dir = d > ROOM_FAR ? 1 : d < ROOM_NEAR ? -1 : 0;
      press({ strafe: dir, fire: (f % FOE_TAP) < FOE_TAP / 2, jump: h.grounded && f % ROOM_HOP === 0, jumpHeld: true });
      continue;
    }
    if (k === last.i && s >= last.rect[1] - 2) { done = true; break; }
    const C = climbs.find((c) => c.zone === k);
    if (C) {
      C.t0 ??= w.time;
      if (w.camera.frame && !w.camera._fell) C.margin = Math.min(C.margin, z - w.camera.frame.z0);
    }
    for (const c of climbs) if (c.t0 !== null && c.time === null && c.zone !== k) c.time = r3(w.time - c.t0);
    // a CHIMNEY, a ledge stair, a switchback, a stair: the next stand, kicked or jumped to
    if (Z.run === 'up' && Z.climb !== 'ladder') {
      const o = L.open.find((r) => r.zone === Z.i), top = Z.exit[1];
      const stands = [...L.rests.filter((r) => r.zone === Z.i).map((r) => ({ s0: r.s0, s1: r.s1, z: r.z })), { s0: o.s1, s1: o.s1 + 3, z: top }].sort((a, b) => a.z - b.z);
      // (the next stand over the one it last stood on: a jump's height is not where it stands)
      if (h.grounded || standZ === null) standZ = z;
      const next = stands.find((t) => t.z > standZ + 0.25) ?? stands.at(-1), mid = (next.s0 + next.s1) / 2, onNear = mid < (o.s0 + o.s1) / 2;
      const over = z >= next.z + 0.3;
      if (over || Z.climb !== 'chimney') {
        // over it (or a climb by jumps): step onto it, jumping when standing below it
        // (and held still once over its middle, so the run does not carry it past)
        // (a jump only from within a metre and a half of the stand's edge, never from under another one)
        const edge = mid > s ? next.s0 : next.s1, near = Math.abs(edge - s) < 1.5 || (s >= next.s0 && s <= next.s1);
        const dir = Math.abs(mid - s) < 0.25 ? 0 : Math.sign(mid - s), jump = h.grounded && next.z > z + 0.25 && near;
        press({ strafe: dir, jump, jumpHeld: true });
      } else {
        // under it: kick up the wall across from it
        const wallDir = onNear ? 1 : -1, kick = (h.grounded || h.cling) && f - lastKick > kickGap;
        if (kick && h.cling) { C.kicks++; lastKick = f; } else if (kick) lastKick = f;
        press({ strafe: wallDir, jump: kick, jumpHeld: true });
      }
      continue;
    }
    if (Z.run === 'up') {
      const l = L.ladders.find((x) => x.zone === Z.i);
      if (h.climbing) { press({ forward: 1 }); continue; }
      if (l && Math.abs(s - l.foot[0]) > 0.2 && z < l.lip[1] - 0.5) { press({ strafe: Math.sign(l.foot[0] - s) }); continue; }
      if (l && z < l.lip[1] - 0.5) { press({ forward: 1 }); continue; }
      press({ strafe: 1 });
      continue;
    }
    // a RUN, a drop or a room: right, and a jump at each pit's lip
    const g = L.gaps.find((x) => x.s0 >= s - 0.05 && x.s0 - s < 6 && x.kind !== 'wall');
    let input = { strafe: 1, jumpHeld: true };
    if (g && h.grounded) {
      const d = g.s0 - s;
      if (g.teaches === 'dash' && d < (DASH_LEAD / 60) * 10 + LIP + 0.6) { dashAt ??= f; input.boost = true; if (d < LIP + 0.2 && f - dashAt >= lead) input.jump = true; }
      else if (d < LIP) input.jump = true;
    }
    // (the top past the pit aimed at: once over a narrow one, the stick let go, so the run does not carry past it)
    if (input.jump) aim = L.solids.find((r) => r.zone === g.zone && Math.abs(r.s0 - g.s1) < 0.05 && (r.role === 'floor' || r.role === 'pillar')) ?? null;
    if (h.grounded && !input.jump) aim = null;
    if (!h.grounded && aim && aim.s1 - aim.s0 < 3) { if (s >= aim.s1 - 0.35) input.strafe = -1; else if (s >= aim.s0 + 0.35) input.strafe = 0; }
    // (a step up the path ahead, path.js: hopped at its foot)
    const st = L.steps.find((x) => x.dz > 0.3 && x.s >= s - 0.05 && x.s - s < LIP + 0.25)
      // (a crate in the way, crates.js, hopped as a step is, while it stands)
      ?? (L.crates ?? []).find((c) => c.s0 >= s - 0.05 && c.s0 - s < LIP + 0.45 && Math.abs(c.z0 - z) < 0.3 && !(w.breakables || []).some((b) => b.id === c.id && b.broken));
    if (st && h.grounded && !input.jump) input.jump = true;
    // a FOE ahead (cast.js): shot at, tap after tap, while one stands within a screen's half on its floor; one that reaches
    // it hopped (a stomp, or over it)
    const foe = (w.entities || []).filter((e) => e.team === 'foes' && !e.gone && !e.downed && !e.dormant && e.transform)
      .map((e) => ({ e, d: e.transform.pos[1] - s, dz: e.transform.pos[2] - z })).filter((x) => x.d > -0.3 && x.d < FOE_AHEAD && Math.abs(x.dz) < 2.5).sort((a, b) => a.d - b.d)[0];
    if (foe) {
      input.fire = (f % FOE_TAP) < FOE_TAP / 2;
      if (foe.d < 1.4 && h.grounded && !input.jump) input.jump = true;
    }
    if (!h.grounded && dashAt !== null) input.boost = true;
    if (h.grounded && !input.boost) dashAt = null;
    // an air dash at the apex of a jump over the gap that teaches it
    const ga = L.gaps.find((x) => x.teaches === 'airDash' && s > x.s0 - 1 && s < x.s1);
    if (ga && !h.grounded && h.vel[2] <= 0) input.boost = true;
    press(input);
  }
  for (const c of climbs) if (c.t0 !== null && c.time === null) c.time = r3(w.time - c.t0);
  const downed = (w.entities || []).filter((e) => e.team === 'foes' && (e.gone || e.downed || (e.body && e.body.hp <= 0))).length;
  return { done, time: r3(w.time), falls: w.sideFalls || 0, downed, climbs: climbs.map((c) => ({ zone: c.zone, climb: c.climb, kicks: c.kicks, margin: c.margin === Infinity ? null : r3(c.margin), time: c.time })), at: h.transform.pos.map(r3) };
}
