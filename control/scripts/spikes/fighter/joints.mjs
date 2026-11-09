#!/usr/bin/env node
// fighter joints — every pose the fight draws a body in, read in the round (versus-figure.js figurePose on the sim's own
// skeleton, figureBase), for the bends a body cannot make and for the parts of a body passing through each other.
//
// The poses: every frame of every move of a fighter of each archetype in each tradition (and in none), the stances
// (guard, crouch, walk, jump, dash, block) and the reactions (versusreact.js: hits high, body, low and crouching, a
// block, each fall, down, rise, tech, held), each at the blade its state stands it in (the arena's BLADE_OF).
//
//   joints     the elbow's and the knee's bend, the spine's twist (the shoulder line against the hip line about the
//              trunk), the neck's bend off the trunk, the ankle (the foot against the shin, in its hinge's plane) and the
//              shoulder (how far the upper arm reaches behind the chest), each against its limit (versus-figure.js
//              FIG_LIMITS, versus-rig.js RIG_LIMITS)
//   collision  how deep each pair of the body's own parts passes into each other (capsules on the sim's radii: the
//              trunk, the head, the upper arms, the forearms and fists, the thighs, the shins), a pair joined at a
//              joint read from past its joint
//
//   node control/scripts/spikes/fighter/joints.mjs [--out dir] [--worst n]
//
// Pure, no browser: report.json in --out, a summary on stdout (each measure's worst, and how many poses break it).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'fighter-joints') }, worst: { type: 'string', default: '6' } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
const V = (f) => import(path.join(CONTROL, 'lib/graph/versus', f));
const [{ compileFighter }, { solveFighter }, { TRADITIONS }, { rigJoints }, Fig, React, { POSES }] = await Promise.all(
  ['versus-compile.js', 'versus-solver.js', 'versus-traditions.js', 'versus-rig.js', 'versus-figure.js', 'versus-react.js', 'versus-library.js'].map(V));
const { figureBase, figurePose, FIG_LIMITS } = Fig;

// ── the poses ──
const BLADE_OF = { fall: 0, ko: 0, down: 0, thrown: 0, rise: 0.4, hit: 0.5, burst: 0.6 };
const poses = [];
const fighters = [];
for (const archetype of ['all-rounder', 'grappler', 'rushdown', 'zoner']) for (const tradition of [null, ...Object.keys(TRADITIONS)]) {
  const F = compileFighter(solveFighter({ id: 'x', archetype, ...(tradition ? { tradition } : {}) }).recipe);
  const who = `${archetype}${tradition ? `/${tradition}` : ''}`;
  fighters.push({ who, F });
  for (const [slot, m] of Object.entries(F.moves)) for (let f = 1; f <= m.total; f++) poses.push({ who, what: `${slot}${m.strength ? `.${m.strength}` : ''} f${f}`, F, pose: m.frames[f].pose, blade: 1 });
}
// (the stances and the reactions on one fighter of each tradition: they are the library's, its guard's)
for (const { who, F } of fighters.filter((x) => x.who.startsWith('all-rounder'))) {
  for (const k of ['guard', 'crouch', 'walkA', 'walkB', 'prejump', 'jump', 'dash', 'backdash', 'blockHigh', 'blockLow', 'win', 'lose']) poses.push({ who, what: `pose ${k}`, F, pose: POSES[k], blade: 1 });
  const own = { guard: F.rests?.stand ?? POSES.guard, crouch: F.rests?.crouch ?? POSES.crouch };
  const states = [];
  for (const h of [0, 1, 2]) for (const w of [0, 1, 2]) for (const c of [0, 1]) states.push({ st: 'hit', rx: { k: 'hit', h, w, c }, stun: 20 });
  states.push({ st: 'hit', low: 1, rx: { k: 'hit', h: 1, w: 2, c: 0 }, stun: 20 }, { st: 'hit', rx: { k: 'crush', h: 1, w: 2, c: 0 }, stun: 40 });
  for (const low of [0, 1]) states.push({ st: 'block', low, rx: { k: 'block', h: 1, w: 2, c: 0 }, stun: 16 });
  for (const k of ['launch', 'down', 'sweep', 'air', 'throw', 'blown', 'hit']) states.push({ st: 'fall', rx: { k, h: 1, w: 2, c: 0 }, stun: 60 });
  for (const st of ['down', 'rise', 'tech', 'thrown', 'locked']) states.push({ st, rx: { k: 'hit', h: 1, w: 2, c: 0 }, stun: 40 });
  for (const S of states) for (let sf = 0; sf <= 60; sf += 3) {
    const p = { ...S, sf, y: S.st === 'fall' ? 400 : 0, ko: 0 };
    const pose = React.reactionPose(p, { down: 36, rise: 10 }, own);
    if (pose) poses.push({ who, what: `${S.st}${S.rx ? `:${S.rx.k}${S.rx.h}${S.low ? 'L' : ''}` : ''} sf${sf}`, F, pose, blade: BLADE_OF[S.st] ?? 1 });
  }
}

// ── the measures ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a), unit = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
const bend = (a, j, b) => 180 - ang(sub(a, j), sub(b, j));
// the shortest distance between two segments
function segDist(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) return len(r);
  if (a <= 1e-12) { s = 0; t = Math.max(0, Math.min(1, f / e)); } else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return len(sub(c1, c2));
}
const TRUNK_W = 0.9, TRUNK_D = 0.62;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function measure(N, body) {
  const m = {};
  for (const S of ['L', 'R']) {
    m[`elbow${S}`] = bend(N[`shoulder${S}`], N[`elbow${S}`], N[`wrist${S}`]);
    m[`knee${S}`] = bend(N[`hip${S}`], N[`knee${S}`], N[`ankle${S}`]);
    // the ankle: the foot against the shin, 90 standing, in the side view (the figure's foot is a hinge in it: the rig
    // limits it, versus-rig.js RIG_LIMITS)
    // (read in the foot's own hinge plane, square to the heel and the toe: it turns with a spinning body)
    const hinge = unit(cross(sub(N[`heel${S}`], N[`ankle${S}`]), sub(N[`toe${S}`], N[`ankle${S}`])));
    const inPlane = (v) => sub(v, hinge.map((h) => h * dot(v, hinge)));
    m[`ankle${S}`] = ang(inPlane(sub(N[`knee${S}`], N[`ankle${S}`])), inPlane(sub(N[`toe${S}`], N[`ankle${S}`])));
  }
  const up = unit(sub(N.neckHub, N.pelvisHub));
  const flat = (v) => unit(sub(v, up.map((u) => u * dot(v, up))));
  const hips = flat(sub(N.hipR, N.hipL)), shoulders = flat(sub(N.shoulderR, N.shoulderL));
  m.spine = ang(hips, shoulders);
  m.neck = ang(up, sub(N.headTop, N.headBase));
  const chest = unit(cross(up, unit(sub(N.shoulderR, N.shoulderL))));
  for (const S of ['L', 'R']) m[`shoulderBack${S}`] = (Math.asin(Math.max(0, -dot(unit(sub(N[`elbow${S}`], N[`shoulder${S}`])), chest))) * 180) / Math.PI;
  // collision: capsules (m), a pair joined at a joint read past it
  const r = { trunk: body.bodyR / 1000, limb: body.limbR / 1000, leg: (body.limbR * 1.25) / 1000, head: (body.head / 1000) * 0.9 };
  const C = { trunk: [N.pelvisHub, N.neckHub, r.trunk], head: [N.headBase, N.headTop, r.head] };
  for (const S of ['L', 'R']) {
    C[`upper${S}`] = [lerp3(N[`shoulder${S}`], N[`elbow${S}`], 0.4), N[`elbow${S}`], r.limb];
    C[`fore${S}`] = [N[`elbow${S}`], N[`fist${S}`] ?? N[`wrist${S}`], r.limb];
    C[`thigh${S}`] = [lerp3(N[`hip${S}`], N[`knee${S}`], 0.3), N[`knee${S}`], r.leg];
    C[`shin${S}`] = [N[`knee${S}`], N[`ankle${S}`], r.leg * 0.85];
  }
  const pairs = [['foreL', 'trunk'], ['foreR', 'trunk'], ['foreL', 'head'], ['foreR', 'head'], ['upperL', 'trunk'], ['upperR', 'trunk'],
    ['foreL', 'foreR'], ['thighL', 'thighR'], ['shinL', 'shinR'], ['shinL', 'thighR'], ['shinR', 'thighL'], ['foreL', 'thighL'], ['foreR', 'thighR'],
  ];
  // (a forearm against its own upper arm, a shin against its own thigh, is the elbow's and the knee's fold: read above)
  // (the trunk is wider than it is deep: read in its own frame, its depth stretched to its width, so a capsule's
  // distance from its axis is its distance from an elliptic trunk, half-width TRUNK_W, half-depth TRUNK_D of bodyR)
  const across = unit(sub(N.shoulderR, N.shoulderL)), fwd = unit(cross(up, across)), side = unit(cross(fwd, up));
  const k = TRUNK_W / TRUNK_D, O = N.pelvisHub;
  const toTrunk = (v) => { const d = sub(v, O); return [dot(d, side), dot(d, fwd) * k, dot(d, up)]; };
  C.trunk = [N.pelvisHub, N.neckHub, (body.bodyR * TRUNK_W) / 1000];
  for (const [a, b] of pairs) {
    let [p1, q1, ra] = C[a], [p2, q2, rb] = C[b];
    if (b === 'trunk') { p1 = toTrunk(p1); q1 = toTrunk(q1); p2 = toTrunk(p2); q2 = toTrunk(q2); }
    // (a forearm against its own upper arm, a shin against its own thigh: read past the joint they share)
    const joined = a.slice(-1) === b.slice(-1) && ((a.startsWith('fore') && b.startsWith('upper')) || (a.startsWith('shin') && b.startsWith('thigh')));
    const P1 = joined ? lerp3(p1, q1, 0.45) : p1, P2 = joined ? p2 : p2, Q2 = joined ? lerp3(p2, q2, 0.55) : q2;
    m[`hit:${a}~${b}`] = Math.max(0, (ra + rb - segDist(P1, q1, P2, Q2)) * 1000);
  }
  return m;
}

const rows = [];
for (const P of poses) {
  const J = rigJoints(P.F.body, P.pose);
  const N = figurePose(figureBase(P.F.body), J, {
    face: 1, air: !!P.pose.air, blade: P.blade, stance: P.F.stance, twist: P.pose.twist ?? 0, sway: P.pose.sway ?? 0, tilt: P.pose.tilt ?? 0,
    spin: P.pose.spin ?? 0, bank: P.pose.bank ?? 0, lie: !!P.pose.lie, ...(P.pose.hands ? { hands: P.pose.hands } : {}), ...(P.pose.feet ? { feet: P.pose.feet } : {}),
  });
  rows.push({ who: P.who, what: P.what, m: measure(N, P.F.body) });
}

// ── the limits it reads against (the figure's own when it has them) ──
const L = { neck: 55, ankle: [60, 185], shoulderBack: 60, ...(FIG_LIMITS ?? { elbow: 150, knee: 155, spine: 60 }) };
const limitOf = (k) => (k.startsWith('elbow') ? [0, L.elbow] : k.startsWith('knee') ? [0, L.knee] : k === 'spine' ? [0, L.spine] : k === 'neck' ? [0, L.neck] : k.startsWith('ankle') ? L.ankle : k.startsWith('shoulderBack') ? [0, L.shoulderBack] : [0, 15]);
const keys = Object.keys(rows[0].m);
const summary = {};
const n = Number(opt.worst);
for (const k of keys) {
  const [lo, hi] = limitOf(k);
  const vals = rows.map((r) => r.m[k]).sort((a, b) => a - b);
  const broken = rows.filter((r) => r.m[k] > hi + 1e-6 || r.m[k] < lo - 1e-6);
  const worst = [...rows].sort((a, b) => Math.max(b.m[k] - hi, lo - b.m[k]) - Math.max(a.m[k] - hi, lo - a.m[k])).slice(0, n).map((r) => `${r.who} ${r.what}: ${r.m[k].toFixed(1)}`);
  summary[k] = { limit: [lo, hi], min: +vals[0].toFixed(1), p50: +vals[Math.floor(vals.length / 2)].toFixed(1), p99: +vals[Math.floor(vals.length * 0.99)].toFixed(1), max: +vals.at(-1).toFixed(1), broken: broken.length, worst: broken.length ? worst : [] };
}
console.log(`${rows.length} poses`);
for (const [k, S] of Object.entries(summary)) console.log(`${k.padEnd(18)} limit ${JSON.stringify(S.limit).padEnd(9)} p50 ${String(S.p50).padStart(6)} p99 ${String(S.p99).padStart(6)} max ${String(S.max).padStart(6)}  broken ${String(S.broken).padStart(5)}${S.broken ? `   e.g. ${S.worst.slice(0, 2).join(' | ')}` : ''}`);
writeFileSync(path.join(out, 'report.json'), JSON.stringify({ poses: rows.length, summary }, null, 1));
console.log(path.join(out, 'report.json'));
