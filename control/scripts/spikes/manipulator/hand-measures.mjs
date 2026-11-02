#!/usr/bin/env node
// hand-measures — the manual manipulator's phase 0 baseline for the HAND: the realistic hero's right hand as the rig
// bends it today, measured. Nothing here changes a kernel; it reads the rig a mint makes.
//
//   node scripts/spikes/manipulator/hand-measures.mjs [--cast male|female] [--json out.json]
//
// Prints, per cast:
//   • the hand's controls: the channels a pose can drive (one curl a digit, the wrist's three turns)
//   • the rest hand: each digit's bone lengths, the palm's length and breadth, the knuckle arc (each knuckle's place
//     along the hand short of the middle finger's)
//   • each hand word (station-loft-rig.js HAND_POSES): each digit's bend at its three joints (degrees off straight), its
//     tip's height off the palm's plane (+ into the palm side) and its distance to the palm's centre
//   • opposition: for each finger, the closest the thumb's tip comes to that finger's tip over every pair of curls the
//     two channels take (thumb −20 … 90, finger −30 … 110, every 10° then refined to 2°), against the two pads' radii: whether the
//     thumb can meet each finger tip to tip with today's one-curl thumb (tips only: whether the pads FACE is not read)
//   • the thumb's one curl as a path: its tip in the palm's frame every 15°
import { register } from 'node:module';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { validateRig, rigNodesAt, HAND_POSES } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { HAND_FORM, DIGITS } = await import('@/lib/graph/polygonizer/hero-hand.js');

const { values: opt } = parseArgs({ options: { cast: { type: 'string', multiple: true }, json: { type: 'string' } } });
const casts = opt.cast?.length ? opt.cast : ['male', 'female'];

const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(...a), unit = (a) => mul(a, 1 / len(a)), dist = (a, b) => len(sub(a, b));
const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
const mm = (m) => +(m * 1000).toFixed(1), d1 = (x) => +x.toFixed(1);

/** the joints of a digit from its root (the thumb's CMC, a finger's MCP) to its tip */
const chainOf = (d, S) => (d === 'thumb' ? ['thumbCmc', 'thumbMcp', 'thumbIp', 'thumbTip'] : [`${d}Mcp`, `${d}Pip`, `${d}Dip`, `${d}Tip`]).map((j) => `${j}${S}`);

function measure(cast) {
  const S = 'R';
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic' }) });
  const R = validateRig(m.recipe.rig), H = R.hands[S];
  const nodesAt = (fingers) => rigNodesAt(R, { support: 'none', ...(fingers ? { [`fingers${S}`]: fingers } : {}) }).nodes;
  const rest = nodesAt(null);
  // the palm's frame at rest: A along the hand (the wrist to the middle knuckle), V across toward the thumb, N out of the
  // palm's front (the side the fingers close toward)
  const wrist = rest[`wrist${S}`], mid = rest[`middleMcp${S}`];
  const A = unit(sub(mid, wrist));
  let V = sub(rest[`indexMcp${S}`], rest[`littleMcp${S}`]); V = unit(sub(V, mul(A, dot(V, A))));
  let N = unit(cross(A, V));
  const fistTip = nodesAt('fist')[`middleTip${S}`];
  if (dot(sub(fistTip, mid), N) < 0) N = mul(N, -1);
  const palmLen = dist(wrist, mid), breadth = dist(rest[`indexMcp${S}`], rest[`littleMcp${S}`]);
  // the palm's centre: half way down the palm, on its plane (the joints lie on the bones' line, inside the flesh)
  const centre = add(wrist, mul(A, palmLen * 0.5));

  const restHand = {
    palm: { length: mm(palmLen), breadth: mm(breadth) },
    knuckleArc: Object.fromEntries(DIGITS.filter((d) => d !== 'thumb').map((d) => [d, mm(dot(sub(rest[`${d}Mcp${S}`], mid), A))])),
    digits: Object.fromEntries(DIGITS.map((d) => { const c = chainOf(d, S); return [d, { bones: c.slice(1).map((j, i) => mm(dist(rest[c[i]], rest[j]))), reach: mm(dist(rest[c[0]], rest[c[3]])) }]; })),
  };

  /** a digit's bend at each joint, degrees off straight (the root's off the hand's own line: the metacarpal for a
   * finger, the thumb's rest metacarpal for the thumb) */
  const bends = (n, d) => {
    const c = chainOf(d, S).map((j) => n[j]);
    const before = d === 'thumb' ? sub(rest[`thumbMcp${S}`], rest[`thumbCmc${S}`]) : sub(n[`${d}Mcp${S}`], n[`wrist${S}`]);
    const segs = [sub(c[1], c[0]), sub(c[2], c[1]), sub(c[3], c[2])];
    return d === 'thumb' ? [ang(before, segs[0]), ang(segs[0], segs[1]), ang(segs[1], segs[2])].map(d1) : [ang(before, segs[0]), ang(segs[0], segs[1]), ang(segs[1], segs[2])].map(d1);
  };
  const words = {};
  for (const w of Object.keys(HAND_POSES)) {
    const n = nodesAt(w);
    words[w] = Object.fromEntries(DIGITS.map((d) => { const tip = n[`${d}Tip${S}`]; return [d, { bend: bends(n, d), tipDepth: mm(dot(sub(tip, centre), N)), toCentre: mm(dist(tip, centre)) }]; }));
  }

  // opposition: the thumb's tip against each finger's tip over both channels' curls
  const F = HAND_FORM[cast === 'female' ? 'female' : 'male'];
  const padSum = (d) => F.thumb.r[3] + F.fingers[d].r[3];
  const opposition = {};
  for (const d of DIGITS.filter((x) => x !== 'thumb')) {
    let best = null;
    const tryAt = (t, c) => { if (t < -20 || t > 90 || c < -30 || c > 110) return; const n = nodesAt({ thumb: t, [d]: c }); const g = dist(n[`thumbTip${S}`], n[`${d}Tip${S}`]); if (!best || g < best.gap) best = { gap: g, thumb: t, finger: c }; };
    for (let t = -20; t <= 90; t += 10) for (let c = -30; c <= 110; c += 10) tryAt(t, c);
    for (const step of [4, 2]) { const b = best; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) tryAt(b.thumb + i * step, b.finger + j * step); }
    opposition[d] = { closest: mm(best.gap), pads: mm(padSum(d)), meets: best.gap <= padSum(d) * 1.15, atThumb: best.thumb, atFinger: best.finger };
  }

  // the thumb's one curl as a path: its tip in the palm's frame (along the hand from the wrist, across toward the thumb,
  // out of the palm's front), every 15°
  const loc = (p) => { const v = sub(p, wrist); return [dot(v, A), dot(v, V), dot(v, N)].map(mm); };
  const thumbSweep = [];
  for (let t = -15; t <= 90; t += 15) thumbSweep.push({ curl: t, tip: loc(nodesAt({ thumb: t })[`thumbTip${S}`]) });
  const palmFront = mm(Math.max(...F.palm.rings.map((r) => r[3])));

  const controls = { perHand: Object.keys(H.digits).length + 3, digits: Object.keys(H.digits).map((d) => `${d}: 1 curl over ${H.digits[d].links.length} joints`), wrist: Object.keys(H.axes), spread: false, bones: H.joints.filter((j) => /(Mcp|Pip|Dip|Ip|Cmc)R$/.test(j)).length };
  return { cast, controls, rest: restHand, words, opposition, thumbSweep, palmFront };
}

const out = casts.map(measure);
for (const r of out) {
  console.log(`\n══ ${r.cast} (realistic), right hand ══`);
  console.log(`controls: ${r.controls.perHand} channels a hand (${r.controls.digits.join('; ')}; wrist ${r.controls.wrist.join('/')}); spread: none; ${r.controls.bones} digit joints`);
  console.log(`palm ${r.rest.palm.length} mm long, ${r.rest.palm.breadth} mm across the knuckles; knuckle arc (mm along the hand from the middle's): ${Object.entries(r.rest.knuckleArc).map(([d, v]) => `${d} ${v}`).join(', ')}`);
  for (const [d, v] of Object.entries(r.rest.digits)) console.log(`  ${d.padEnd(7)} bones ${v.bones.join(' / ')} mm, root to tip ${v.reach} mm`);
  for (const [w, ds] of Object.entries(r.words)) {
    console.log(`  word '${w}':`);
    for (const [d, v] of Object.entries(ds)) console.log(`    ${d.padEnd(7)} bend ${v.bend.map((x) => String(x).padStart(5)).join(' ')}°   tip ${String(v.tipDepth).padStart(6)} mm off the palm plane, ${String(v.toCentre).padStart(5)} mm to its centre`);
  }
  console.log(`  the thumb's curl, its tip [along, across, out of the palm front] mm (the palm's front ${r.palmFront} mm off its axis):`);
  for (const t of r.thumbSweep) console.log(`    ${String(t.curl).padStart(4)}°  ${t.tip.map((x) => String(x).padStart(6)).join(' ')}`);
  console.log('  opposition (thumb tip to finger tip, the closest over both curls):');
  for (const [d, v] of Object.entries(r.opposition)) console.log(`    ${d.padEnd(7)} ${String(v.closest).padStart(5)} mm (pads ${v.pads} mm) ${v.meets ? 'meets' : 'MISSES'} at thumb ${v.atThumb}°, finger ${v.atFinger}°`);
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(out, null, 2));
