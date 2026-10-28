/**
 * THE ADORNED: what is left of the armour an undead died or was buried in, sized to the LIVING body it was made for and
 * hanging on the body it is now: a skeleton's cuirass a hollow shell round its ribs, a corpse's a little proud of its
 * shrunken flesh. FORM ONLY: every piece is its own group (`Metal`), one tone.
 *
 *   helm       a kettle helm over the crown, its brim flared over the brow; on the skull or the corpse's head
 *   cuirass    a shell round the chest from the waist to the shoulders' line, the living torso's sections a little out
 *   pauldron   a domed plate over one shoulder (`pauldrons`: both)
 *   bracers    a tube round each forearm, the living forearm's girth out (a lost forearm takes none)
 *   greaves    a tube round each shin
 *
 *   adorned(plan, living, spec, { k, rand, lost, skull })   → { segments, joints }   each piece rigid on its bone
 *   spec { helm, cuirass, pauldron, pauldrons, bracers, greaves }: the odds each is still worn (0 … 1)
 *
 * `living` is the hero's plan before its flesh went (a skeleton's: the flesh it was built from; a corpse's: its own).
 * Pure: the dice are the caller's. Metres; template proportions × k (the hero's height over 2 m).
 */
const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const unit = (v) => mul(v, 1 / (Math.hypot(...v) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t)).map(r3);
const mir = (p) => [r3(-p[0]) + 0, p[1], p[2]];
const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
const TINT = '#cccccc';
// the skull's braincase rows above the brow ([z, half width, half length, centre forward], ./skull.js), the helm's form
const CROWN = [[0.075, 0.078, 0.106, -0.006], [0.11, 0.076, 0.1, -0.01], [0.14, 0.064, 0.084, -0.016], [0.162, 0.04, 0.056, -0.02]];

export function adorned(plan, living, spec, { k, rand, lost = null, skull = false }) {
  const J = plan.joints, segments = [], joints = {}, roll = (p) => rand() < (p ?? 0);
  const part = (n) => living.segments.find((s) => s.name === n);
  // HELM: the crown's rows a share out (a skull's close, a corpse's head fuller than its skull), its brim flared
  if (roll(spec.helm)) {
    const f = skull ? 1.18 : 1.32, hb = J.headBase, rows = [[0.068, 1.12], ...CROWN.map((row) => [row[0], 1])];
    const stations = rows.map(([z, flare], i) => { const row = CROWN[Math.max(0, i - 1)]; return { z: r3(hb[2] + z * k), r: [r3(row[1] * k * f * flare), r3(row[2] * k * f * flare)], yc: r3(hb[1] + row[3] * k) }; });
    segments.push({ name: 'helm', kind: 'trunk', stations, caps: { back: [0, stations[0].yc, r3(stations[0].z - 0.004 * k)], tip: [0, r3(hb[1] - 0.02 * k), r3(hb[2] + 0.182 * k * f)] }, group: 'Metal', tint: TINT, mirror: 'plane', bind: { bone: 'head' } });
  }
  // CUIRASS: the living torso's sections from the waist to the shoulders' line, a little out
  const torso = part('torso');
  if (torso?.kind === 'trunk' && roll(spec.cuirass)) {
    const lo = plan.rig?.joints?.navel?.at?.[2] ?? (J.hip[2] + J.neckHub[2]) / 2, hi = r3(J.shoulder[2] - 0.02 * k);
    const rows = torso.stations.filter((st) => st.z >= lo - 0.01 && st.z <= hi);
    const stations = rows.map((st) => { const [rx, ry] = Array.isArray(st.r) ? st.r : [st.r, st.r]; return { z: st.z, r: [r3(rx * 1.07 + 0.008), r3(ry * 1.1 + 0.01)], yc: st.yc ?? 0, e: 2.4 }; });
    if (stations.length >= 2) segments.push({ name: 'cuirass', kind: 'trunk', stations, caps: { back: [0, stations[0].yc, r3(stations[0].z - 0.015)], tip: [0, stations.at(-1).yc, r3(stations.at(-1).z + 0.012)] }, group: 'Metal', tint: TINT, mirror: 'plane', bind: { bone: 'torso' } });
  }
  // the side's joints (the right's as authored, the left's mirrored), each piece its own part on its side
  const at = (n, S) => (S === 'R' ? J[n] : J[`${n}__L`] ?? mir(J[n]));
  const place = (n, S, p) => { const nm = `${n}${S}`; joints[nm] = p.map(r3); return nm; };
  // PAULDRONS: a dome over the shoulder, along the arm from just inside the shoulder joint, out and up a little
  const sides = roll(spec.pauldrons) ? ['R', 'L'] : roll(spec.pauldron) ? [rand() < 0.5 ? 'R' : 'L'] : [];
  const arm = rad(part('upperArmR')?.rA ?? 0.05);
  for (const S of sides) {
    const sh = at('shoulder', S), ax = unit(sub(at('elbow', S), sh)), out = [S === 'R' ? 0.012 * k : -0.012 * k, 0, 0.018 * k];
    const st = [[-0.03, 1.45], [0.03, 1.8], [0.09, 1.7], [0.14, 1.35]].map(([d, f]) => ({ at: add(add(sh, mul(ax, d * k / 0.87)), out).map(r3), r: [r3(arm * f), r3(arm * f * 0.95)] }));
    segments.push({ name: `pauldron${S}`, kind: 'loft', stations: st, group: 'Metal', tint: TINT, mirror: null, bind: { bone: `upperArm${S}` } });
  }
  // BRACERS and GREAVES: a tube round the bone at the living limb's girth, a little out
  const tubes = [['bracer', 'foreArm', 'elbow', 'wrist', [0.3, 0.85], spec.bracers, 1.18], ['greave', 'shank', 'knee', 'ankle', [0.12, 0.8], spec.greaves, 1.15]];
  for (const [name, limb, from, to, [t0, t1], odds, f] of tubes) for (const S of ['R', 'L']) {
    if (!roll(odds) || (limb === 'foreArm' && lost?.part === 'foreArm' && lost.side === S)) continue;
    const L = part(`${limb}R`), rA = rad(L?.rA ?? 0.04) * f, rB = rad(L?.rB ?? 0.03) * f, A = at(from, S), B = at(to, S);
    if (!A || !B) continue;
    segments.push({ name: `${name}${S}`, kind: 'segment', from: place(`${name}a`, S, lerp(A, B, t0)), to: place(`${name}b`, S, lerp(A, B, t1)), rA: r3(rA + (rB - rA) * t0), rB: r3(rA + (rB - rA) * t1), over: [0.1, 0.1], group: 'Metal', tint: TINT, mirror: null, bind: { bone: `${limb}${S}` } });
  }
  return { segments, joints };
}
