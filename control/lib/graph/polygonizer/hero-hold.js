// hero-hold — holding gear without wearing it through the body. Laws-2 gear (a build minted under equipment laws 2, or
// an arm of equipment/arms) is held by three rules; gear minted before keeps the hold it was minted with.
//
//   1. THE ITEM CLEARS THE BODY AT REST. The body is read as capsules (hero-grip.js's, with a bar across the shoulders
//      and one across the hips); every item point keeps MARGIN of the figure's height from them, the holding arm's own
//      forearm aside. A mount that does not is fitted before it rides its bone (hero-gear.js gearMounts): a haft leans
//      out past the shoulder and the head, a blade or a gun turns out from the thigh, a shield stands off the arm.
//   2. THE HELD IDLE BREATHES THROUGH THE WEAPON. The idle's keys take the holding arm by the item's class — a blade's
//      elbow eased so its tip lifts and settles with the breath, a shield's forearm up in front of the body, a gun at
//      low ready — so the item moves with the figure instead of hanging from a still hand. A haft stays upright: its
//      wrist deviates against the elbow (0.9 of it, inside the wrist's range), in the idle and the walk, so a long pole
//      sways a little at its top instead of tipping with the forearm (a hand with digits: the rig's wrist channel).
//   3. NO KEY WEARS THE ITEM THROUGH THE BODY. At every key of the stand, the idle and the walk, an arm whose item comes inside the
//      margin is taken out from the body (its aim abducted a step at a time) until it clears.
//
// The readout (heldClearance) says, per held slot and clip, the nearest approach in metres (− inside). Pure: no dice.
import { expandEquipment, isArmsBuild, LAWS_VERSION } from '../equipment/expand.js';
import { perpBasis } from './extrude-faces.js';
import { rigNodesAt, boneFrames } from './station-loft-rig.js';

/** the body as capsules (joint, joint, radius in metres at the canonical height 1.75 m): the guards' and two bars */
export const HOLD_CAPSULES = Object.freeze([['pelvisHub', 'neckHub', 0.12], ['headBase', 'headTop', 0.1], ['shoulderL', 'shoulderR', 0.06], ['hipL', 'hipR', 0.1],
  ['shoulderL', 'elbowL', 0.045], ['shoulderR', 'elbowR', 0.045], ['elbowL', 'wristL', 0.035], ['elbowR', 'wristR', 0.035],
  ['hipL', 'kneeL', 0.07], ['hipR', 'kneeR', 0.07], ['kneeL', 'ankleL', 0.05], ['kneeR', 'ankleR', 0.05]]);
/** the clearance an item keeps, as a share of the figure's height over the canonical (m at 1.75 m) */
export const MARGIN = 0.025;
const CANON = 1.75;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);
const segDist = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1))); const q = add(a, mul(ab, t)); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/** Whether a gear build is held by these rules (laws-2 equipment or an arm), not the hold it was minted with. */
export const holdsByLaws = (build) => !!build && (isArmsBuild(build) || (build.laws ?? LAWS_VERSION) >= 2);

const POINTS = new Map();
/**
 * An item's sample points in its own frame (cm): each lathe's axis and its rings at four quarters, each extrude's
 * outline at both ends, every path's points, each field's centres. At most ~1200, memoised by the build.
 */
export function itemPoints(build) {
  const key = JSON.stringify(build);
  if (POINTS.has(key)) return POINTS.get(key);
  const m = expandEquipment(build).monomers, pts = [];
  for (const L of m.lathes || []) {
    const a = xyz(L.axisFrom), b = xyz(L.axisTo), d = sub(b, a), len = Math.hypot(...d) || 1, [u, v] = perpBasis(mul(d, 1 / len));
    // rings every 5 cm along the axis (a long shaft's middle is where an arm meets it), the radius its profile's there
    const prof = L.profile || [], rAt = (t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i].t + 1e-9) { const p0 = prof[i - 1], p1 = prof[i], u = (t - p0.t) / Math.max(1e-9, p1.t - p0.t); return p0.radius + (p1.radius - p0.radius) * u; } return prof.at(-1)?.radius ?? 0; };
    const nRings = Math.max(2, Math.min(40, Math.ceil(len / 5)));
    for (let i = 0; i <= nRings; i++) {
      const t = i / nRings, r = rAt(t), c = add(a, mul(d, t)); pts.push(c);
      if (r > 0) for (const w of [u, v, mul(u, -1), mul(v, -1), mul(add(u, v), Math.SQRT1_2), mul(sub(u, v), Math.SQRT1_2), mul(add(u, v), -Math.SQRT1_2), mul(sub(v, u), Math.SQRT1_2)]) pts.push(add(c, mul(w, r)));
    }
  }
  for (const E of m.extrudes || []) {
    const a = xyz(E.axisFrom), b = xyz(E.axisTo), d = sub(b, a), len = Math.hypot(...d) || 1, [u, v] = perpBasis(mul(d, 1 / len));
    const ring = E.profile?.points ?? (E.profile?.rect ? [[E.profile.rect.w / 2, E.profile.rect.h / 2], [-E.profile.rect.w / 2, E.profile.rect.h / 2], [-E.profile.rect.w / 2, -E.profile.rect.h / 2], [E.profile.rect.w / 2, -E.profile.rect.h / 2]] : []);
    const step = Math.max(1, Math.floor(ring.length / 16));
    for (let i = 0; i < ring.length; i += step) for (const c of [a, b]) pts.push(add(c, add(mul(u, ring[i][0]), mul(v, ring[i][1]))));
  }
  for (const k of ['sweeps', 'lofts']) for (const S of m[k] || []) { const P = S.path || [], step = Math.max(1, Math.floor(P.length / 20)); for (let i = 0; i < P.length; i += step) pts.push(xyz(P[i])); }
  for (const F of m.fields || []) for (const t of F.terms || []) if (t.shape?.center) pts.push(xyz(t.shape.center));
  const step = Math.max(1, Math.floor(pts.length / 1200)), out = pts.filter((_, i) => i % step === 0);
  if (POINTS.size > 64) POINTS.clear();
  POINTS.set(key, out);
  return out;
}

/** The capsules a slot's own arm keeps out of its item's way (the forearm that holds it; a shield's whole arm). */
export function skipsOf(slot, hold) {
  const S = slot === 'right' ? 'R' : slot === 'left' ? 'L' : null;
  if (!S) return new Set();
  return new Set(hold === 'forearm' ? [`elbow${S}-wrist${S}`] : [`elbow${S}-wrist${S}`]);
}

/** The nearest approach (m, − inside) of world points to the body's capsules at `nodes`, the figure `h` m tall. */
export function clearanceOf(points, nodes, h, skip = new Set()) {
  let best = Infinity, at = null; const k = h / CANON;
  for (const p of points) for (const [a, b, r] of HOLD_CAPSULES) {
    const name = `${a}-${b}`; if (skip.has(name) || !nodes[a] || !nodes[b]) continue;
    const d = segDist(p, nodes[a], nodes[b]) - r * k; if (d < best) { best = d; at = name; }
  }
  return { d: best, at };
}

/** A mount's item points in the figure's rest frame (m): its anchor `o` on `t`, turned by M, scaled by k. */
export const restPoints = (G, pts) => pts.map((q) => add(G.t, mv(G.M, mul(sub(q, G.o), G.k))));
/** …and as a posed bone carries them (boneFrames' frame). */
export const posedPoints = (G, pts, frame) => restPoints(G, pts).map((p) => add(frame.head, mv(frame.m, sub(p, frame.restHead))));

/** A rotation by `deg` about the unit axis `u` (Rodrigues), as rows. */
export function rotation(u, deg) {
  // (every turn here is under a right angle: Math.cos and Math.sin need no reduction, the same bytes on every CPU)
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c, [x, y, z] = u;
  return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
}
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

/** the poses a held item rides through, by the arm that holds it: rest, the held idle's deepest elbow, the walk's two
 * swings (hero-form.js's walk), so a mount fitted once clears in every clip it plays */
function ridePoses(S, hold, hands) {
  const I = IDLE_BY_HOLD[hold] ?? IDLE_BY_HOLD.blade, sx = S === 'R' ? 1 : -1, e = Math.max(...I.elbow);
  const poses = [{}, { [`elbow${S}`]: e }, { [`arm${S}`]: { x: 0.2 * sx, y: 0.42, z: -0.88 }, [`elbow${S}`]: 'half' }, { [`arm${S}`]: { x: 0.2 * sx, y: -0.4, z: -0.9 }, [`elbow${S}`]: 'slight' }];
  return hold === 'haft' && hands ? poses.map((p) => withUpright(p, S)) : poses;
}
/** the clips a held item is checked through: the stand (the clip the static solid is posed at), the idle, the walk */
const RIDES = Object.freeze(['gesture', 'idle', 'walk']);
/** the bend words' degrees (figure-posing.js BEND_WORDS) */
const BEND = Object.freeze({ straight: 0, slight: 25, half: 75, bent: 110, full: 145 });
/** a key with its haft's wrist deviating against its elbow (rule 2), inside the wrist's range (hero-grip WRIST_RANGE) */
function withUpright(key, S) {
  const e = key[`elbow${S}`], deg = typeof e === 'number' ? e : BEND[e] ?? BEND.slight;
  if (key[`wrist${S}`]) return key;
  return { ...key, [`wrist${S}`]: { flex: 0, deviation: -Math.min(35, Math.round(0.9 * deg)), twist: 0 } };
}

/**
 * Rule 1: a mount fitted so its item clears the body in every pose it rides through (ridePoses). `G` is the mount as
 * hero-gear placed it ({ slot, hold, M, o, t, k, build, boneIndex }), `R` the validated rig, `out` the slot's outward
 * unit (x away from the midline), `f` forward, `a` the hand's long axis (down at rest), `h` the figure's height. → the
 * mount, turned or stood off as little as clears it, and its worst clearance.
 */
export function fitRest(G, R, { out, f, a, h }) {
  const pts = itemPoints(G.build), skip = skipsOf(G.slot, G.hold), need = MARGIN * h / CANON, S = G.slot === 'right' ? 'R' : 'L';
  const poses = ridePoses(S, G.hold, !!R.hands?.[S]).map((pose) => { const nodes = rigNodesAt(R, pose).nodes; return { nodes, frame: boneFrames(R, R.joints, nodes)[G.boneIndex] }; });
  const clear = (H) => poses.reduce((w, P) => { const c = clearanceOf(posedPoints(H, pts, P.frame), P.nodes, h, skip); return c.d < w.d ? c : w; }, { d: Infinity, at: null });
  let c = clear(G);
  if (c.d >= need) return { G, clearance: c };
  if (G.hold === 'forearm') {
    // a shield stands off the arm along its own outward, a centimetre at a time (at most 10)
    for (let i = 1; i <= 10; i++) { const H = { ...G, t: add(G.t, mul(out, 0.01 * i * h / CANON)) }, ci = clear(H); if (ci.d > c.d) { G = H; c = ci; } if (c.d >= need) break; }
    return { G, clearance: c };
  }
  // a haft rolls out about the forward axis (its top past the shoulder and the head) and pitches forward about the
  // outward one; a blade or a gun yaws out about the hand's axis (its tip off the thigh). The least turn that clears
  // (else the best): steps of 7.5°, under a right angle each
  const best = { G, c };
  const roll = (deg) => rotation(f, (S === 'R' ? 1 : -1) * deg), pitch = (deg) => rotation(out, (S === 'R' ? -1 : 1) * deg);
  const tries = G.hold === 'haft'
    ? [0, 7.5, 15, 22.5, 30].flatMap((p) => [7.5, 15, 22.5, 30, 37.5, 45].map((r) => [r + p, mm(roll(r), pitch(p))]))
    : [7.5, 15, 22.5, 30, 37.5].flatMap((d) => [[d, rotation(a, d)], [d, rotation(a, -d)]]);
  tries.sort((x, y) => x[0] - y[0]);
  for (const [, T] of tries) {
    const H = { ...G, M: mm(T, G.M) }, ci = clear(H);
    if (ci.d > best.c.d + 1e-6) { best.G = H; best.c = ci; }
    if (ci.d >= need) return { G: H, clearance: ci };
  }
  return { G: best.G, clearance: best.c };
}

/** the held idle's arm words by the item's class (rule 2): the elbow through the four idle keys, the arm's aim nudge */
const IDLE_BY_HOLD = Object.freeze({
  blade: { elbow: [16, 24, 16, 21], fwd: 0.02 },
  haft: { elbow: [20, 25, 20, 23], fwd: 0.1 },
  forearm: { elbow: [38, 44, 38, 42], fwd: 0.16 },
  firearm: { elbow: [14, 18, 14, 17], fwd: 0.04 },
  bow: { elbow: [12, 15, 12, 14], fwd: 0.02 },
});

/**
 * Rules 2 and 3 on a plan's clips: the idle's keys take each laws-2 held arm by its item's class, and every key of the
 * idle and the walk takes an arm out from the body until its item clears. `mounts` are hero-gear's (fitted at rest);
 * `R` the validated rig. A clip the operator gave (`own`) is left as written. → { clips, clearance }.
 */
export function heldClips(clips, { mounts, R, own = {} }) {
  const J = R.joints, h = J.headTop ? J.headTop[2] : CANON, need = MARGIN * h / CANON;
  const held = mounts.filter((G) => (G.slot === 'right' || G.slot === 'left') && holdsByLaws(G.build));
  const worn = mounts.filter((G) => holdsByLaws(G.build));
  if (!worn.length) return { clips, clearance: null };
  const restDir = (S) => { const d = sub(J[`wrist${S}`], J[`shoulder${S}`]), l = Math.hypot(...d) || 1; return mul(d, 1 / l); };
  const out = { ...clips };
  if (held.length && Array.isArray(clips.idle) && own.idle === undefined) {
    out.idle = clips.idle.map((k, i) => {
      const key = { ...k };
      let out1 = key;
      for (const G of held) { const S = G.slot === 'right' ? 'R' : 'L', I = IDLE_BY_HOLD[G.hold] ?? IDLE_BY_HOLD.blade; out1[`elbow${S}`] = I.elbow[i % I.elbow.length]; if (G.hold === 'haft' && R.hands?.[S]) out1 = withUpright(out1, S); }
      return out1;
    });
  }
  for (const name of RIDES) if (Array.isArray(out[name]) && own[name] === undefined) for (const G of held) { const S = G.slot === 'right' ? 'R' : 'L'; if (G.hold === 'haft' && R.hands?.[S]) out[name] = out[name].map((k) => withUpright(k, S)); }
  // rule 3: each key of the idle and the walk, each held arm out a step at a time until its item clears
  for (const name of RIDES) {
    if (!Array.isArray(out[name])) continue;
    const solved = [];
    for (const k0 of out[name]) {
      let key = { ...k0 };
      for (let step = 0; step <= 6; step++) {
        const nodes = rigNodesAt(R, key).nodes, frames = boneFrames(R, J, nodes);
        const tight = worn.map((G) => ({ G, c: clearanceOf(posedPoints(G, itemPoints(G.build), frames[G.boneIndex]), nodes, h, skipsOf(G.slot, G.hold)) }));
        // (a haft or a shield is fitted in the hand by rule 1: swinging the arm out tips a rigid haft in toward the head)
        const fix = tight.filter(({ G, c }) => c.d < need && (G.slot === 'right' || G.slot === 'left') && !['haft', 'forearm'].includes(G.hold) && own[name] === undefined);
        if (!fix.length || step === 6) break;
        for (const { G } of fix) {
          // the arm's aim: its rest line, out from the body a step more (x away from the midline), a little forward
          const S = G.slot === 'right' ? 'R' : 'L', sx = S === 'R' ? 1 : -1, d0 = key[`arm${S}`] ? [key[`arm${S}`].x, key[`arm${S}`].y, key[`arm${S}`].z] : restDir(S);
          const I = IDLE_BY_HOLD[G.hold] ?? IDLE_BY_HOLD.blade, d = add(d0, [sx * 0.07, I.fwd * 0.25, 0]), l = Math.hypot(...d);
          key = { ...key, [`arm${S}`]: { x: r4(d[0] / l), y: r4(d[1] / l), z: r4(d[2] / l) } };
        }
      }
      solved.push(key);
    }
    out[name] = solved;
  }
  // the readout: the clearance the solved keys keep (measured again on them)
  const clearance = {};
  for (const name of RIDES) {
    if (!Array.isArray(out[name])) continue;
    for (const key of out[name]) {
      const nodes = rigNodesAt(R, key).nodes, frames = boneFrames(R, J, nodes);
      for (const G of worn) { const c = clearanceOf(posedPoints(G, itemPoints(G.build), frames[G.boneIndex]), nodes, h, skipsOf(G.slot, G.hold)); const id = `${G.slot}.${name}`; if (!(id in clearance) || c.d < clearance[id].m) clearance[id] = { slot: G.slot, item: G.item, clip: name, m: r4(c.d), at: c.at, clear: c.d >= need - 1e-9 }; }
    }
  }
  return { clips: out, clearance };
}
const r4 = (v) => Math.round(v * 1e4) / 1e4;
