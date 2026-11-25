/**
 * THE SCROLL STAGE'S INTERIOR (Blaze Gunner): a run flown INSIDE a station or a facility, the genre's infiltration: a
 * ceiling and a floor that close in and open out, bends to follow, bulkheads to weave between, the room at its heart.
 * Laid in the stage's screen axes (frame.js: u along, v across), so the top view gets it turned (its walls left and
 * right). The open is laid a STEP at a time (a screen's eighth along), and its floor and ceiling drawn as lines through
 * each step's middle, so a change of height is a ramp, never a stair; a bulkhead is the one square thing in the way.
 *
 *   a stage's `interior`: { at: screens along (where its mouth is), look?: INTERIOR_LOOKS, sections: [{ kind, length? }],
 *                           seed? }
 *
 *   SECTIONS (a new section is a row): each { length (screens), gap: [lo, hi] (the open's share of a screen across),
 *   drift (how far the open's middle wanders, a share across), turn? (the share a bend moves it a step), bulkheads?
 *   (every n steps, a wall across from ceiling or floor, alternating, leaving `pass` of a screen), mounts (guns'
 *   places a screen, on the walls facing the open), says }
 *     mouth     the way in: the hull's face, its walls closing from the screen's edges to the next section's
 *     hall      a corridor wide enough to fight in, its walls wandering a little
 *     duct      narrow, in bends: the open climbs and drops a step at a time, held between
 *     shutters  bulkheads across the corridor, from the ceiling and the floor in turn: weave between them
 *     core      the room at the heart: wide, its walls far apart
 *
 *   INTERIOR_LOOKS   station (white panels, cyan strips, windows out to the stars) | facility (dark steel, amber lamps,
 *                    hazard stripes): the drawing's (phase 12), named here so a stage can say it
 *   PASSAGE          the narrowest the open may be, in ship breadths (a bulkhead's pass included)
 *   CLIMB            the share of the ship's slowest speed across a bend may ask of it as the scroll carries it on
 *
 *   readInterior(v, at?)  → errors (strings); [] when it lays
 *   planInterior(spec, { cam, ship, track, start, seed, gears? }) → {
 *     u0, u1, look, step,                    where it begins and ends along (metres), its look, a step's length
 *     sections: [{ kind, u0, u1 }]
 *     profile: [{ u0, u1, lo, hi, mid, section }]  the open, step by step (v in metres on the play plane; mid the
 *                                             camera's middle across there)
 *     edges: [{ u, lo, hi, mid, section }]    the floor and the ceiling as lines through the knots (the run's ends and
 *                                             each step's middle): what is flown, drawn and struck
 *     walls: [{ id, u0, u1, v0, v1, role: 'bulkhead', from: 'ceiling' | 'floor', section }]   what stands across the way
 *     mounts: [{ id, u, v, side: 'ceiling' | 'floor', section }]   where a gun stands on a wall, facing the open
 *     reach                                   how far past the open a wall goes (a screen across: never seen beyond)
 *   }
 *   openAt(plan, u)  → [lo, hi] the open's floor and ceiling at u (null off the run)
 *   interiorLaws(plan, { cam, ship, pace, gears? }) → [{ id, holds, says }], read at the knots and a bulkhead's ends:
 *     passage (the open, a bulkhead's pass included, never narrower than PASSAGE breadths), continuity (each stretch's
 *     open overlaps the next by as much), climb (a ramp asks no more than CLIMB of the slowest gear across), on screen (the open inside the frame, its edge kept),
 *     mounts (each on a wall, facing an open at least PASSAGE wide)
 *
 * Pure and deterministic: the same stage the same walls.
 */
import { streamOf } from '../../city/plan/dice.js';

const row = (o) => Object.freeze(o);
export const SECTIONS = Object.freeze({
  mouth: row({ length: 1, gap: [0.6, 0.66], drift: 0, mounts: 0, says: 'the way in: the hull\'s face, its walls closing from the screen\'s edges' }),
  hall: row({ length: 3, gap: [0.56, 0.66], drift: 0.12, mounts: 2, says: 'a corridor wide enough to fight in, its walls wandering a little' }),
  duct: row({ length: 2, gap: [0.32, 0.36], drift: 0.2, turn: 0.06, mounts: 0, says: 'narrow, in bends: the open climbs and drops a step at a time' }),
  shutters: row({ length: 2, gap: [0.6, 0.64], drift: 0.05, bulkheads: 3, pass: 0.3, mounts: 1, says: 'bulkheads from the ceiling and the floor in turn: weave between them' }),
  core: row({ length: 1.5, gap: [0.82, 0.86], drift: 0, mounts: 0, says: 'the room at the heart: wide, its walls far apart' }),
});
export const SECTION_IDS = Object.freeze(Object.keys(SECTIONS));
export const INTERIOR_LOOKS = Object.freeze(['station', 'facility']);
export const PASSAGE = 4;
export const CLIMB = 0.5;
/** a step's length, a share of the screen along */
export const STEP = 1 / 8;
// (a wall reaches past the frame's edge, so its far side is never seen: a screen past the open)
const REACH = 1;
// (the frame's edge kept clear of the open, a share across: the HUD's corners and the ship's half)
const EDGE = 0.04;
const SLOWEST = 0.45;   // the slowest gear, a share of the screen across a second (worlds/controllable/scroll.js's gears)

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** What is wrong with an interior (strings, each teaching); [] when it lays. */
export function readInterior(v, at = 'airspace.scroll.interior') {
  if (!isObj(v)) return [`${at} is { at: screens along, look?, sections: [{ kind, length? }], seed? }: a run flown inside a station or a facility`];
  const e = [];
  for (const k of Object.keys(v)) if (!['at', 'look', 'sections', 'seed'].includes(k)) e.push(`${at}.${k} is not an interior's word (at, look, sections, seed)`);
  if (!isNum(v.at) || v.at < 0) e.push(`${at}.at is screens along the stage (where its mouth is)`);
  if (v.look !== undefined && !INTERIOR_LOOKS.includes(v.look)) e.push(`${at}.look is ${INTERIOR_LOOKS.join(' | ')}`);
  if (!Array.isArray(v.sections) || !v.sections.length) e.push(`${at}.sections is a list of { kind, length? } (${SECTION_IDS.join(', ')})`);
  else v.sections.forEach((S, k) => {
    const w = `${at}.sections[${k}]`;
    if (!isObj(S)) { e.push(`${w} is { kind, length? }`); return; }
    for (const f of Object.keys(S)) if (!['kind', 'length'].includes(f)) e.push(`${w}.${f} is not a section's word (kind, length)`);
    if (!SECTIONS[S.kind]) e.push(`${w}.kind is a section (${SECTION_IDS.join(', ')})`);
    if (S.length !== undefined && !(isNum(S.length) && S.length >= 0.5 && S.length <= 12)) e.push(`${w}.length is screens, 0.5 to 12`);
  });
  if (v.seed !== undefined && !Number.isInteger(v.seed)) e.push(`${at}.seed is a whole number`);
  return e;
}

// the camera's middle across, metres, where it stands at `u` along: the track's legs from its start (holds stand still)
function middleAt(track, start) {
  const pts = [[start[0], start[1]]];
  for (const L of track) if (L.by) { const p = pts[pts.length - 1]; pts.push([p[0] + L.by[0], p[1] + L.by[1]]); }
  return (u) => {
    if (u <= pts[0][0]) return pts[0][1];
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1], pts[k]];
      if (u <= b[0]) return b[0] - a[0] > 1e-9 ? a[1] + ((u - a[0]) / (b[0] - a[0])) * (b[1] - a[1]) : b[1];
    }
    return pts[pts.length - 1][1];
  };
}

/** The interior laid: its sections, the open step by step and as its edges, the bulkheads, the guns' places. */
export function planInterior(spec, { cam, track, start = [0, 0], seed = 1 }) {
  const errs = readInterior(spec);
  if (errs.length) throw new Error(errs.join('; '));
  const A = cam.screen.along, C = cam.screen.across, step = r3(A * STEP), mid = middleAt(track, start);
  const die = streamOf(spec.seed ?? seed, 'scroll-interior', 'walls');
  const lerp = (a, b, t) => a + (b - a) * t, pick = (g) => lerp(g[0], g[1], die());
  const u0 = r3(spec.at * A), sections = [], profile = [], walls = [], mounts = [];
  let u = u0, centre = 0;   // (the open's middle, a share across off the camera's)
  spec.sections.forEach((S0, si) => {
    const S = SECTIONS[S0.kind], n = Math.max(1, Math.round(((S0.length ?? S.length) * A) / step)), s0 = u;
    const next = SECTIONS[spec.sections[si + 1]?.kind] ?? S;
    let bend = 0, held = 0, gap = pick(S.gap);
    for (let k = 0; k < n; k++) {
      // the open's width: a mouth closes from near the frame to the next section's; the rest wander inside their own
      if (S0.kind === 'mouth') gap = lerp(0.9, (next.gap[0] + next.gap[1]) / 2, (k + 1) / n);
      else if (k % 4 === 0) gap = pick(S.gap);
      // its middle: a duct in bends (held a while, then climbing or dropping a step at a time), the rest wandering
      if (S.turn) {
        if (held > 0) held -= 1;
        else if (bend === 0) { bend = (die() < 0.5 ? -1 : 1) * (Math.abs(centre + S.turn) > S.drift ? -1 : 1); held = 2 + Math.floor(die() * 2); }
        else { bend = 0; held = 2 + Math.floor(die() * 2); }
        if (held > 0 && bend !== 0) centre += bend * S.turn;
      } else if (S.drift > 0 && k % 2 === 0) centre += (die() * 2 - 1) * S.drift * 0.35;
      // (kept within its drift, and inside the frame with its edge)
      const room = Math.max(0, 0.5 - EDGE - gap / 2);
      centre = Math.max(-Math.min(S.drift, room), Math.min(Math.min(S.drift, room), centre));
      if (!S.drift) centre = lerp(centre, 0, 0.5);
      const a = u, b = r3(u + step), m = mid((a + b) / 2), lo = r3(m + (centre - gap / 2) * C), hi = r3(m + (centre + gap / 2) * C);
      profile.push({ u0: r3(a), u1: b, lo, hi, mid: r3(m), section: si });
      u = b;
    }
    sections.push({ kind: S0.kind, u0: r3(s0), u1: r3(u) });
  });
  // the EDGES: the open's floor and ceiling as lines through each step's middle, so every change of height is a ramp,
  // never a step (the run's ends hold their first and last step's: the hull's face square across them)
  const knot = (p, at) => ({ u: r3(at), lo: p.lo, hi: p.hi, mid: p.mid, section: p.section });
  const edges = [knot(profile[0], u0), ...profile.map((p) => knot(p, (p.u0 + p.u1) / 2)), knot(profile[profile.length - 1], u)];
  const edgeAt = (x) => { for (let k = 1; k < edges.length; k++) if (x <= edges[k].u + 1e-9) { const a = edges[k - 1], b = edges[k], t = b.u - a.u > 1e-9 ? (x - a.u) / (b.u - a.u) : 0; return [lerp(a.lo, b.lo, t), lerp(a.hi, b.hi, t)]; } const z = edges[edges.length - 1]; return [z.lo, z.hi]; };
  // the BULKHEADS: across the corridor every few steps, from the ceiling and the floor in turn, leaving their pass at
  // their narrowest across their width (the edges may slope under them)
  spec.sections.forEach((S0, si) => {
    const S = SECTIONS[S0.kind];
    if (!S.bulkheads) return;
    const steps = profile.filter((p) => p.section === si);
    steps.forEach((p, k) => {
      if (k === 0 || k % S.bulkheads !== 0 || k === steps.length - 1) return;
      const fromTop = (k / S.bulkheads) % 2 === 1, w = r3(step * 0.35), c = (p.u0 + p.u1) / 2, ends = [edgeAt(c - w / 2), edgeAt(c + w / 2)];
      const v0 = fromTop ? r3(Math.max(ends[0][0], ends[1][0]) + S.pass * C) : r3(Math.min(ends[0][0], ends[1][0]) - C), v1 = fromTop ? r3(Math.max(ends[0][1], ends[1][1]) + C) : r3(Math.min(ends[0][1], ends[1][1]) - S.pass * C);
      walls.push({ id: `bulkhead-${si}-${k}`, u0: r3(c - w / 2), u1: r3(c + w / 2), v0, v1, role: 'bulkhead', from: fromTop ? 'ceiling' : 'floor', section: si });
    });
  });
  // the GUNS' places: on the walls at a step's middle, the ceiling and the floor in turn, a step clear of any bulkhead
  spec.sections.forEach((S0, si) => {
    const S = SECTIONS[S0.kind];
    if (!S.mounts) return;
    const steps = profile.filter((p) => p.section === si), every = Math.max(2, Math.round(steps.length / (S.mounts * (S0.length ?? S.length))));
    steps.forEach((p, k) => {
      if (k === 0 || k % every !== 0) return;
      const c = r3((p.u0 + p.u1) / 2), side = (k / every) % 2 === 1 ? 'floor' : 'ceiling';
      if (walls.some((w) => Math.abs((w.u0 + w.u1) / 2 - c) < step * 1.2)) return;
      mounts.push({ id: `mount-${si}-${k}`, u: c, v: side === 'floor' ? p.lo : p.hi, side, section: si });
    });
  });
  return { u0, u1: r3(u), look: spec.look ?? 'station', step, reach: r3(REACH * C), sections, profile, edges, walls, mounts };
}

/** Where the open's floor and ceiling stand at `u` (the edges, a line between knots); null off the run. */
export function openAt(plan, u) {
  const E = plan.edges;
  if (u < E[0].u || u > E[E.length - 1].u) return null;
  for (let k = 1; k < E.length; k++) if (u <= E[k].u + 1e-9) { const a = E[k - 1], b = E[k], t = b.u - a.u > 1e-9 ? (u - a.u) / (b.u - a.u) : 0; return [a.lo + (b.lo - a.lo) * t, a.hi + (b.hi - a.hi) * t]; }
  return null;
}

/** The interior held to its laws (see the header), read at its edges' knots. */
export function interiorLaws(plan, { cam, ship, pace, gears = [SLOWEST] }) {
  const C = cam.screen.across, need = PASSAGE * ship.breadth, out = [], E = plan.edges;
  // the open at a knot, a bulkhead's pass where one stands over it
  const passAt = (q) => {
    const bh = plan.walls.find((w) => w.role === 'bulkhead' && w.u0 - 1e-6 <= q.u && q.u <= w.u1 + 1e-6);
    if (!bh) return [q.lo, q.hi];
    return bh.from === 'ceiling' ? [q.lo, bh.v0] : [bh.v1, q.hi];
  };
  // (each bulkhead's ends besides: the edges slope under it)
  const pts = [...E, ...plan.walls.flatMap((w) => [w.u0, w.u1].map((u) => { const o = openAt(plan, u); return { u, lo: o[0], hi: o[1] }; }))].sort((a, b) => a.u - b.u);
  const narrow = pts.filter((q) => { const [a, b] = passAt(q); return b - a < need - 1e-6; });
  out.push({ id: 'passage', holds: !narrow.length, says: narrow.length ? `the open narrower than ${PASSAGE} ship breadths (${r3(need)} m) at ${narrow.map((q) => r3(q.u)).join(', ')}` : `the open never narrower than ${PASSAGE} ship breadths (${r3(need)} m), a bulkhead's pass included` });
  const broken = [];
  for (let k = 1; k < pts.length; k++) { const [a0, b0] = passAt(pts[k - 1]), [a1, b1] = passAt(pts[k]); if (Math.min(b0, b1) - Math.max(a0, a1) < need - 1e-6) broken.push(r3(pts[k].u)); }
  out.push({ id: 'continuity', holds: !broken.length, says: broken.length ? `a stretch whose open overlaps the last by less than the passage at ${broken.join(', ')}` : 'every stretch\'s open overlaps the last by the passage at least' });
  // a ramp: the middle's move across between knots, against what the slowest gear covers while the scroll crosses it
  const fly = Math.min(...gears) * C, steep = [];
  for (let k = 1; k < E.length; k++) {
    const dm = Math.abs((E[k].lo + E[k].hi) / 2 - (E[k - 1].lo + E[k - 1].hi) / 2), t = (E[k].u - E[k - 1].u) / pace;
    if (dm > CLIMB * fly * t + 1e-6) steep.push(E[k].u);
  }
  out.push({ id: 'climb', holds: !steep.length, says: steep.length ? `a ramp steeper than the slowest gear can follow at ${steep.join(', ')}` : `every ramp asks no more than ${CLIMB} of the slowest gear across` });
  const half = (0.5 - EDGE) * C, off = E.filter((q) => q.lo < q.mid - half - 1e-6 || q.hi > q.mid + half + 1e-6);
  out.push({ id: 'on-screen', holds: !off.length, says: off.length ? `the open past the frame's kept edge at ${off.map((q) => q.u).join(', ')}` : 'the open always inside the frame, its edge kept' });
  const bad = plan.mounts.filter((M) => {
    const o = openAt(plan, M.u);
    if (!o) return true;
    return Math.abs(M.v - (M.side === 'floor' ? o[0] : o[1])) > 1e-6 || o[1] - o[0] < need - 1e-6;
  });
  out.push({ id: 'mounts', holds: !bad.length, says: bad.length ? `a gun not on its wall or over too narrow an open: ${bad.map((M) => M.id).join(', ')}` : 'every gun stands on its wall, facing an open the passage wide' });
  return out;
}
