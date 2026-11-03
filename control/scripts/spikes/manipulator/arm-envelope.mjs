#!/usr/bin/env node
// arm-envelope — the manual manipulator's phase 0 baseline for the ARM: how today's arm solver (hero-stance.js
// `reachArm`) reaches a field of targets from the boxer's guard, measured. Nothing here changes a kernel.
//
//   node scripts/spikes/manipulator/arm-envelope.mjs [--cast male|female] [--seed 1] [--dirs 16] [--json out.json]
//
// The realistic hero stands in the `guard` stance; its right arm is solved to each target with the rest of the body
// held. Targets are seeded (mulberry32): `--dirs` directions (in the world's frame, +y the way the stance faces its
// target) from the right shoulder (from 70° across the body to 100°
// outside, 50° below to 70° above the shoulder's level), each at four distances, a share of the arm's length (the
// shoulder to the elbow to the wrist): 0.5, 0.75, 0.95 (in reach) and 1.1 (past it: the body must join in).
//
// Per target: the wrist's error to the target (reachArm aims the wrist joint, not a surface of the hand); the elbow's
// bend; the shoulder's pitch, yaw and roll, and whether any sat on the search's bounds; the elbow's direction off the
// shoulder → wrist line (−1 hangs straight down: elbows down; +1 points up: a chicken wing); the PUNCH LINE: the angle
// between the forearm and the line from the shoulder to the target (a straight punch lands with the forearm along it,
// so this is the bend the wrist would have to make up); milliseconds per solve. Summarized per distance band.
// `--strike` sends the same directions through space boxer (hero-reach.js strikeTarget) as the knuckles' contact: the
// contact's error on the whole rig, the force line (the forearm against the approach the fist lands along), the servos
// past a stop at contact, the approach family chosen, milliseconds per strike (every family tried).
import { register } from 'node:module';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { validateRig, rigNodesAt } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { reachArm } = await import('@/lib/graph/polygonizer/hero-stance.js');
const { stanceBody, strikeTarget, contactOf, handFeatures } = await import('@/lib/graph/polygonizer/hero-reach.js');
const { servoRead } = await import('@/lib/graph/polygonizer/hero-servo.js');
const { elbowsDown } = await import('@/lib/graph/polygonizer/hero-elbow.js');
const { mulberry32 } = await import('@/lib/graph/city/plan/dice.js');

const { values: opt } = parseArgs({ options: { cast: { type: 'string', multiple: true }, seed: { type: 'string', default: '1' }, dirs: { type: 'string', default: '16' }, json: { type: 'string' }, strike: { type: 'boolean', default: false } } });
const casts = opt.cast?.length ? opt.cast : ['male', 'female'];
const SHARES = [0.5, 0.75, 0.95, 1.1];

const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a), unit = (a) => mul(a, 1 / len(a)), dist = (a, b) => len(sub(a, b));
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const ang = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
const r1 = (x) => +x.toFixed(1), mm = (m) => +(m * 1000).toFixed(1);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

function envelope(cast) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic' }) });
  const R = validateRig(m.recipe.rig);
  // the guard held, the right arm's channels off (the left in its own words: the solve adds the elbows-down roll once)
  const { body, nodes: n0 } = stanceBody(R, 'guard', 'R'), sh = n0.shoulderR;
  const L = dist(R.joints.shoulderR, R.joints.elbowR) + dist(R.joints.elbowR, R.joints.wristR);
  const rnd = mulberry32(Number(opt.seed));
  const dirs = Array.from({ length: Number(opt.dirs) }, () => {
    const az = -70 + 170 * rnd(), el = -50 + 120 * rnd();
    return { az: r1(az), el: r1(el), v: [Math.cos(rad(el)) * Math.sin(rad(az)), Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el))] };
  });
  const rows = [];
  for (const d of dirs) for (const k of SHARES) {
    const goal = add(sh, mul(d.v, k * L));
    const t0 = performance.now();
    const a = reachArm(R, body, 'R', goal);
    const ms = performance.now() - t0;
    const n = rigNodesAt(R, elbowsDown(R, { ...body, shR: a.sh, elbowR: a.elbow })).nodes;
    const S = n.shoulderR, E = n.elbowR, W = n.wristR;
    const line = unit(sub(W, S)), foot = add(S, mul(line, dot(sub(E, S), line))), off = sub(E, foot);
    const elbowDir = len(off) > 0.005 ? +(off[2] / len(off)).toFixed(2) : null;   // (a straight arm has no direction)
    const bounds = [a.sh.pitch <= -40 || a.sh.pitch >= 175 ? 'pitch' : null, Math.abs(a.sh.yaw) >= 100 ? 'yaw' : null, Math.abs(a.sh.roll) >= 160 ? 'roll' : null, a.elbow <= 0 || a.elbow >= 150 ? 'elbow' : null].filter(Boolean);
    rows.push({ az: d.az, el: d.el, share: k, err: mm(dist(W, goal)), elbow: a.elbow, sh: a.sh, bounds, elbowDir, punchLine: r1(ang(sub(W, E), sub(goal, S))), ms: r1(ms) });
  }
  const bands = SHARES.map((k) => {
    const rs = rows.filter((r) => r.share === k), bent = rs.filter((r) => r.elbowDir !== null);
    return {
      share: k, n: rs.length,
      errMedian: r1(median(rs.map((r) => r.err))), errMax: r1(Math.max(...rs.map((r) => r.err))), within5mm: rs.filter((r) => r.err <= 5).length,
      onBounds: rs.filter((r) => r.bounds.length).length,
      elbowUp: bent.filter((r) => r.elbowDir > 0).length, elbowDirMedian: +median(bent.map((r) => r.elbowDir)).toFixed(2),
      punchLineMedian: r1(median(rs.map((r) => r.punchLine))), punchLineOver20: rs.filter((r) => r.punchLine > 20).length, punchLineOver45: rs.filter((r) => r.punchLine > 45).length,
      msMedian: r1(median(rs.map((r) => r.ms))),
    };
  });
  // --strike: the same targets as the KNUCKLES' point through space boxer (hero-reach.js strikeTarget), the share now of
  // the reach to the knuckles; the force line is the forearm against the approach the fist lands along
  let strike = null;
  if (opt.strike) {
    const F = handFeatures(R, 'R'), LK = L + dist(F.surfaces.knuckles.p, F.wrist), srows = [];
    for (const d of dirs) for (const k of SHARES) {
      const at = add(sh, mul(d.v, k * LK));
      const t0 = performance.now(); const a = strikeTarget(R, body, 'R', { at, surface: 'knuckles' }); const ms = performance.now() - t0;
      const pose = { ...body, ...a.pose }, c = contactOf(R, pose, 'R', a.frame);
      const n = rigNodesAt(R, elbowsDown(R, pose)).nodes, rd = servoRead(R, elbowsDown(R, pose), n).R;
      const past = [rd.shoulder.swing, rd.shoulder.twist, rd.elbow, ...Object.values(rd.wrist)].filter((v) => v && !v.inRange).length;
      srows.push({ az: d.az, el: d.el, share: k, err: mm(c.err), family: a.family, aim: a.frame.aim, forceLine: r1(ang(sub(n.wristR, n.elbowR), a.frame.approach)), past, ms: r1(ms) });
    }
    strike = { reach: mm(LK), bands: SHARES.map((k) => { const rs = srows.filter((r) => r.share === k); const fam = {}; for (const r of rs) fam[r.family] = (fam[r.family] ?? 0) + 1; return { share: k, n: rs.length, errMedian: r1(median(rs.map((r) => r.err))), errMax: r1(Math.max(...rs.map((r) => r.err))), within5mm: rs.filter((r) => r.err <= 5).length, forceLineMedian: r1(median(rs.map((r) => r.forceLine))), forceLineOver20: rs.filter((r) => r.forceLine > 20).length, past: rs.filter((r) => r.past).length, families: fam, msMedian: r1(median(rs.map((r) => r.ms))) }; }), rows: srows };
  }
  return { cast, armLength: mm(L), shoulder: sh.map(mm), seed: Number(opt.seed), dirs: dirs.length, bands, rows, strike };
}

const out = casts.map(envelope);
for (const r of out) {
  console.log(`\n══ ${r.cast} (realistic), right arm from guard ══ arm ${r.armLength} mm, ${r.dirs} directions (seed ${r.seed})`);
  console.log('share  n  err med/max mm  ≤5mm  on-bounds  elbow-up  elbow-dir  punch-line med  >20°  >45°   ms/solve');
  for (const b of r.bands) console.log(`${String(b.share).padEnd(5)} ${String(b.n).padStart(2)}  ${String(b.errMedian).padStart(6)} / ${String(b.errMax).padEnd(6)}  ${String(b.within5mm).padStart(4)}  ${String(b.onBounds).padStart(9)}  ${String(b.elbowUp).padStart(8)}  ${String(b.elbowDirMedian).padStart(9)}  ${String(b.punchLineMedian).padStart(14)}  ${String(b.punchLineOver20).padStart(4)}  ${String(b.punchLineOver45).padStart(4)}  ${String(b.msMedian).padStart(9)}`);
  const worst = [...r.rows].filter((x) => x.share < 1).sort((a, b) => b.err - a.err).slice(0, 4);
  console.log('worst in-reach targets:', worst.map((w) => `az ${w.az} el ${w.el} ×${w.share}: ${w.err} mm${w.bounds.length ? ` (on ${w.bounds.join(', ')})` : ''}`).join('; '));
  if (r.strike) {
    console.log(`  space boxer, the knuckles to the same directions (reach to the knuckles ${r.strike.reach} mm):`);
    console.log('  share  n  contact med/max mm  ≤5mm  force-line med  >20°  past-a-stop  families                       ms/strike');
    for (const b of r.strike.bands) console.log(`  ${String(b.share).padEnd(5)} ${String(b.n).padStart(2)}  ${String(b.errMedian).padStart(8)} / ${String(b.errMax).padEnd(8)}  ${String(b.within5mm).padStart(4)}  ${String(b.forceLineMedian).padStart(14)}  ${String(b.forceLineOver20).padStart(4)}  ${String(b.past).padStart(11)}  ${JSON.stringify(b.families).padEnd(30)} ${String(b.msMedian).padStart(9)}`);
  }
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(out, null, 2));
