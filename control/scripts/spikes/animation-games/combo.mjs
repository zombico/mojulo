/**
 * animation-games — COMBO: a string of 3 or 5 hits, and HITSTUN, in the four registers. The moves are the hero library's
 * (hero-strike's jab and cross; hero-swing's chop, rising, thrust and cleave with a sword), each rendered by its register
 * (flavor.mjs, weapon.mjs) and CANCELLED into the next: cut at the register's cancel point and cross-faded into the next
 * move's start. The victim is simulated hit by hit.
 *
 * HITSTUN is how long a hit leaves the victim unable to act. A hit LINKS when it lands inside the stun the last hit
 * left; once the stun runs out the victim is free, and a free victim that has seen a hit coming BLOCKS (it takes the
 * blow on its guard: a small flinch, no stun). So a string is a TRUE combo exactly as far as each gap between hits fits
 * inside the stun before it. Each register has its own source of stun:
 *
 *   realistic    no rule: a body's own — the reaction time (0.22 s) and the flinch the blow causes (0.4 s at a full
 *                reaction, scaled by the blow): a 1-1-2 lands because the punches beat the reaction, and a long string
 *                drops when the victim recovers and guards. Each move is cancelled half way back to its guard
 *   action       an authored stun (the game's combo rule, combat-hit.js: max(min, base · decay^(n−1)): 0.5 s, decay
 *                0.85, at least 0.12), a small push each hit (0.6 m/s) the attacker follows to keep its range, every hit
 *                frozen, and the last hit a FINISHER: the full blow, launching the victim. Moves cancel at their
 *                follow-through
 *   platformer   no stun: a hit is a boop, then MERCY INVINCIBILITY (1 s: the victim cannot be hit). A string is one hit.
 *                Moves play out to ready
 *   pinball      no stun: the hit ricochets the victim away (out of reach); the string is one hit. Moves cancel at the
 *                follow-through
 *
 * Each hit's verdict: hit (landed: the stun it leaves, the frames of advantage the next move has), blocked, immune
 * (inside mercy invincibility), whiff (out of reach). Reach: the striking point (a fist, a blade's tip) at its contact
 * frame must be within 3 cm of the victim's chest. The library's strikes have no footwork, so the attacker STEPS IN:
 * through each move's wind-up its root slides toward the victim as far as the move's point falls short, half a step
 * (0.45 m) at most. A chained move ENTERS part way into its wind-up (`entry`: the share of its ready → cock span skipped),
 * as an action game's string flows from one blow's follow-through into the next.
 *
 *   COMBO_REGISTERS, STRINGS, comboRun(R, { string, register }) → { frames: [{ k, a, v, held, part }], hits, … }
 *   comboSignature(run) → the measures
 *
 * Pure and deterministic. A spike: nothing registers.
 */
import { render, nodesOf, blow, reactTake, strikeTake, FLAVORS } from './flavor.mjs';
import { swingTake } from './weapon.mjs';
import { mixNodes } from './motion.mjs';
import { heroRise } from '../../../lib/graph/polygonizer/hero-rise.js';
import { keyedClip } from '../../../lib/graph/polygonizer/hero-jump.js';
import { REACTS } from '../../../lib/graph/polygonizer/hero-react.js';
import { rigNodesAt } from '../../../lib/graph/polygonizer/station-loft-rig.js';

const G = 9.81, FPS = 60, FADE = 4, CHEST = 0.12, REACH_TOL = 0.03, STEP = 0.45;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * `stun(n, hit)` seconds the n-th landed hit stuns for; `cancel` the share of a move's settle (follow → ready) played
 * before the next move cuts in (0 at the follow-through, 1 the whole move); `entry` the share of a chained move's wind-up
 * it skips; `push` m/s each hit pushes the victim ('blow': the register's own blow); `finisher` the last
 * hit is the register's full blow, a launch; `invuln` seconds of mercy invincibility after a hit; `blocks` a free victim
 * that has seen a hit blocks the next.
 */
export const COMBO_REGISTERS = Object.freeze({
  realistic: { stun: (n, h) => 0.22 + 0.4 * clamp(h.reactGain, 0, 1), cancel: 0.5, entry: 0.5, push: 'blow', finisher: false, invuln: 0, blocks: true },
  action: { stun: (n) => Math.max(0.12, 0.5 * 0.85 ** (n - 1)), cancel: 0, entry: 1, push: 0.6, finisher: true, invuln: 0, blocks: true },
  platformer: { stun: () => 0, cancel: 1, entry: 0, push: 'blow', finisher: false, invuln: 1, blocks: false },
  pinball: { stun: () => 0, cancel: 0, entry: 1, push: 'blow', finisher: false, invuln: 0, blocks: false },
});

/** the strings: fists (hero-strike) and a sword (hero-swing), each move the reaction its blow draws */
export const STRINGS = Object.freeze({
  fist3: { label: 'fists, 3 hits: jab, jab, cross', moves: [['jab', 'hitHigh'], ['jab', 'hitHigh'], ['cross', 'hitBody']] },
  fist5: { label: 'fists, 5 hits: jab, jab, cross, jab, cross', moves: [['jab', 'hitHigh'], ['jab', 'hitHigh'], ['cross', 'hitBody'], ['jab', 'hitHigh'], ['cross', 'hitBody']] },
  sword3: { label: 'sword, 3 hits: chop, rising, thrust', moves: [['chop', 'hitHigh'], ['rising', 'hitBody'], ['thrust', 'hitBody']], weapon: 'sword' },
  sword5: { label: 'sword, 5 hits: chop, rising, chop, rising, cleave', moves: [['chop', 'hitHigh'], ['rising', 'hitBody'], ['chop', 'hitHigh'], ['rising', 'hitBody'], ['cleave', 'hitHigh']], weapon: 'sword' },
});

// the solved strikes, once per rig (hero-strike solves a strike in a second or two)
const STRIKE = new WeakMap();
const strikeOf = (R, name) => { if (!STRIKE.has(R)) STRIKE.set(R, new Map()); const m = STRIKE.get(R); if (!m.has(name)) m.set(name, strikeTake(name, R)); return m.get(name); };
const KO = new WeakMap();
const koOf = (R) => { if (!KO.has(R)) KO.set(R, heroRise('knockedOut', R, { down: true })); return KO.get(R); };
const midToes = (n) => [(n.toeBaseL[0] + n.toeBaseR[0]) / 2, (n.toeBaseL[1] + n.toeBaseR[1]) / 2];
const shift = (n, d) => Object.fromEntries(Object.entries(n).map(([k, p]) => [k, [p[0] + d[0], p[1] + d[1], p[2] + (d[2] ?? 0)]]));
const turn = (n, at) => Object.fromEntries(Object.entries(n).map(([k, p]) => [k, [-p[0], at - p[1], p[2]]]));
const r4n = (n) => Object.fromEntries(Object.entries(n).map(([k, p]) => [k, p.map(r4)]));

/**
 * A string in a register: the attacker's moves cancelled one into the next, the victim (the same rig, facing it, its
 * chest where the first move's striking point lands) taking each hit the register's way.
 */
export function comboRun(R, { string, register, stun = null }) {
  const S = STRINGS[string], C = { ...COMBO_REGISTERS[register], ...(stun ? { stun } : {}) }, F = FLAVORS[register];
  if (!S) throw new Error(`animation-games: no string '${string}' (have ${Object.keys(STRINGS).join(', ')})`);
  const takes = S.moves.map(([m]) => (S.weapon ? swingTake(m, S.weapon, R, register) : strikeOf(R, m)));
  const stand = rigNodesAt(R, keyedClip(REACTS.hitHigh, R).fn(0)).nodes;
  const point = (take, n) => (take.point ? take.point(n) : n[`wrist${take.hand}`]);
  // the victim's place: its chest on the first move's striking point at contact
  const first = render(takes[0], register, R, { landed: false }), fN = nodesOf(R, first).nodes;
  const at0 = point(takes[0], fN[first.beats.find((b) => b.id === 'contact').frame])[1] + CHEST;
  const A = [], hits = [];   // the attacker's frames (rig-frame nodes and held), the hits
  // the victim's state, stepped a frame at a time
  const V = { y: 0, v: 0, z: 0, vz: 0, air: false, frames: [], react: null, stunEnd: -1, invulnEnd: -1, alert: false, freezeEnd: -1, lying: false, landed: 0 };
  const stepVictim = (k) => {   // the victim at frame k: its root (slide, flight), its pose (a reaction playing, or the stand)
    while (V.frames.length <= k) {
      const f = V.frames.length, frozen = f <= V.freezeEnd;
      if (!frozen) {
        if (V.air) { V.y += V.v / FPS; V.z += V.vz / FPS; V.vz -= G / FPS; if (V.z <= 0) { V.z = 0; V.air = false; V.v *= 0.5; } }
        else if (V.v) { const a = (F.force.model === 'ricochet' ? 2 : 0.8 * G) / FPS; V.y += V.v / FPS; V.v = Math.abs(V.v) <= a ? 0 : V.v - Math.sign(V.v) * a; }
      }
      let n = stand;
      if (V.react) { const j = f - V.react.start; n = V.react.nodes ? V.react.nodes[clamp(j, 0, V.react.nodes.length - 1)] : rigNodesAt(R, V.react.poses[clamp(j, 0, V.react.poses.length - 1)]).nodes; }
      V.frames.push({ nodes: n, y: V.y, z: V.z });
    }
    return V.frames[k];
  };
  let follow = 0, steps = 0;   // the attacker's root, carried toward the victim by its steps in
  for (let i = 0; i < takes.length; i++) {
    const take = takes[i], last = i === takes.length - 1, finisher = C.finisher && last && takes.length > 1;
    const full = blow(take, register, R), base = A.length;
    // where the move enters (a chained move part way into its wind-up), where its contact falls, and the verdict there
    const dry = render(take, register, R, { landed: false }), cF0 = dry.beats.find((b) => b.id === 'contact').frame;
    const j0 = i ? Math.round(C.entry * dry.beats.find((b) => b.id === 'load').frame) : 0, kC = base + cF0 - j0;
    const vAt = stepVictim(kC - 1);
    const p = point(take, nodesOf(R, dry).nodes[cF0]), front = at0 + vAt.y - CHEST;
    // the step in: as far as the point falls short of the chest, half a step at most, taken through the wind-up
    const from = follow, step = clamp(front - (p[1] + follow), 0, STEP); follow += step; if (step > 0.005) steps++;
    const reach = p[1] + follow;
    let verdict;
    if (reach < front - REACH_TOL || vAt.z > 0.3 || V.lying) verdict = 'whiff';
    else if (kC <= V.invulnEnd) verdict = 'immune';
    else if (C.blocks && V.alert && kC > V.stunEnd) verdict = 'blocked';
    else verdict = 'hit';
    const landed = verdict === 'hit';
    const r = render(take, register, R, { blowDv: full.dv, landed });
    const nodes = nodesOf(R, r).nodes;
    // the cut: through the follow-through and the register's share of the settle (the last move plays out)
    const fo = r.beats.find((b) => b.id === 'follow').frame, end = r.frames.length - 1;
    const cut = last ? end : Math.round(fo + C.cancel * (end - fo));
    // (the cross-fade from the last move ends before this one's contact, so the contact pose is the move's own)
    const fade = Math.min(FADE, cF0 - j0);
    for (let j = j0; j <= cut; j++) {
      let n = nodes[j];
      if (i > 0 && j - j0 < fade) n = mixNodes(A[base - 1].nodes, n, (j - j0 + 1) / (fade + 1));
      const u = cF0 > j0 ? clamp((j - j0) / (cF0 - j0), 0, 1) : 1;
      A.push({ nodes: n, held: r.frames[j].held, move: i, follow: from + (follow - from) * u * u * (3 - 2 * u) });
    }
    // the victim answers
    const n = hits.filter((h) => h.verdict === 'hit').length + (landed ? 1 : 0);
    // the promise: the striking point at contact, where the move puts it (on the attacker's own root)
    const pointErr = r4(Math.hypot(...[0, 1, 2].map((q) => point(take, A[kC].nodes)[q] - p[q])));
    const h = { move: S.moves[i][0], frame: kC, verdict, dv: full.dv, hitstop: r.hitstop, pointErr };
    if (landed) {
      const gain = finisher || C.push === 'blow' ? full.reactGain : clamp((C.push ?? 0) / 1.2, 0.15, 1.5);
      const stun = C.stun(n, { reactGain: full.reactGain });
      V.alert = true; V.freezeEnd = kC + r.hitstop; V.stunEnd = kC + r.hitstop + Math.round(stun * FPS); V.invulnEnd = C.invuln ? kC + Math.round(C.invuln * FPS) : -1;
      if (finisher) {   // the launch: the full blow, off the feet, the collapse in the air
        const kb = full.knockback, a = ((kb.angle || 15) * Math.PI) / 180;
        V.v = full.dv * Math.cos(a); V.vz = full.dv * Math.sin(a); V.air = V.vz > 0; V.lying = true;
        const K = koOf(R), d = (n0) => { const m = midToes(n0), s = midToes(stand); return [s[0] - m[0], s[1] - m[1], 0]; }, k0 = K.fn(0), dd = d(rigNodesAt(R, k0).nodes);
        const dur = Math.round(K.seconds * 0.75 * FPS);
        V.react = { start: kC + r.hitstop + 1, nodes: Array.from({ length: dur + 1 }, (_, j) => shift(rigNodesAt(R, K.fn(j / dur)).nodes, dd)) };
      } else {
        V.v = C.push === 'blow' ? full.dv : C.push;
        const rr = render(reactTake(S.moves[i][1], R, { gain }), register, R, { blowDv: full.dv });
        V.react = { start: kC, poses: rr.frames.map((f) => f.pose) };
      }
      Object.assign(h, { stun: r4(stun), stunEnd: V.stunEnd, reactGain: full.reactGain, push: r4(V.v) });
    } else if (verdict === 'blocked') {   // taken on the guard: a small flinch, no stun
      const rr = render(reactTake(S.moves[i][1], R, { gain: 0.12 }), register, R, {});
      V.react = { start: kC, poses: rr.frames.map((f) => f.pose) };
    }
    hits.push(h);
  }
  // play the victim out a second past the attacker
  const total = A.length + FPS;
  stepVictim(total - 1);
  // advantage: the frames the stun left after the next move's contact (≥ 0 links), the gap between contacts
  hits.forEach((h, j) => { const nx = hits[j + 1]; if (nx) { h.gap = r4((nx.frame - h.frame) / FPS); if (h.verdict === 'hit') h.advantage = h.stunEnd - nx.frame; } });
  const frames = Array.from({ length: total }, (_, k) => {
    const a = A[Math.min(k, A.length - 1)], v = V.frames[k];
    return { k, a: r4n(shift(a.nodes, [0, a.follow, 0])), v: r4n(turn(shift(v.nodes, [0, 0, v.z]), at0 + v.y)), held: k < A.length && a.held, move: k < A.length ? a.move : null };
  });
  return { string, label: S.label, register, fps: FPS, at: r4(at0), hits, steps, stepped: r4(follow), attackerFrames: A.length, frames };
}

/** the measures: the true combo (landed hits running from the first), each verdict, stuns, gaps and advantages, the
 * victim's travel and whether a finisher left it lying */
export function comboSignature(c) {
  let run = 0; for (const h of c.hits) { if (h.verdict === 'hit') run++; else break; }
  const last = c.frames.at(-1);
  return { register: c.register, string: c.string, landed: c.hits.filter((h) => h.verdict === 'hit').length, trueCombo: run, of: c.hits.length,
    verdicts: c.hits.map((h) => h.verdict), pointErr: Math.max(...c.hits.map((h) => h.pointErr)), hitstops: c.hits.map((h) => h.hitstop), stuns: c.hits.map((h) => h.stun ?? null), gaps: c.hits.map((h) => h.gap ?? null), advantages: c.hits.map((h) => h.advantage ?? null),
    seconds: r4(c.attackerFrames / c.fps), stepped: c.stepped, steps: c.steps, victimTravel: r4(last.v.navel[1] - c.frames[0].v.navel[1]), lying: last.v.headTop[2] < 0.5 };
}
