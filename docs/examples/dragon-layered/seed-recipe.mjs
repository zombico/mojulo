/** seed-recipe.mjs — authors recipe.json ONCE. L0/L1 are declared as a station table; L2/L3 details are
 * authored here in head space against the baseline L1, then stored as local offsets in their pin frames.
 * Re-running reproduces recipe.json byte for byte. It is the authoring record, not the render path. */
import { writeFileSync } from 'node:fs';
import { buildPrimary, pinFrame, surfaceLocalOffset, mirrorFace, mirrorPid, recipePath } from './compile.mjs';
const sub = (a, b) => a.map((x, i) => x - b[i]); const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map(x => x * s);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const mean = ps => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);

const frame = { up: '+z', front: '+y', scale: 0.8, origin: [0, 0, 2.05], note: '1 unit = 1 m; head authored at 0.8 m per head unit, centred at the neck height of a hulking humanoid' };
const l1 = {
  stations: [  // y, top z, brow [x,z], side [x,z], lip [x,z], bottom z  (head units, right side)
    { station: 'st0', y: -0.36, top: 0.14, brow: [0.09, 0.10], side: [0.15, -0.01], lip: [0.11, -0.12], bottom: -0.16 },
    { station: 'st1', y: -0.22, top: 0.24, brow: [0.12, 0.19], side: [0.20, 0.03], lip: [0.14, -0.16], bottom: -0.21 },
    { station: 'st2', y: -0.05, top: 0.20, brow: [0.13, 0.16], side: [0.21, 0.02], lip: [0.15, -0.17], bottom: -0.22 },
    { station: 'st3', y: 0.12, top: 0.13, brow: [0.10, 0.11], side: [0.17, 0.00], lip: [0.13, -0.15], bottom: -0.19 },
    { station: 'st4', y: 0.28, top: 0.08, brow: [0.07, 0.07], side: [0.12, -0.01], lip: [0.10, -0.12], bottom: -0.15 },
    { station: 'st5', y: 0.44, top: 0.04, brow: [0.05, 0.03], side: [0.08, -0.03], lip: [0.07, -0.09], bottom: -0.11 },
  ],
  rules: { widthBlend: [1, 1, 1, 0.5, 0.15, 0], browBlend: [0, 1, 1, 0.5, 0, 0], snoutFrom: 3, snoutPivotY: -0.05, palateLift: 0.005, gumDrop: 0.01, gumInset: 0.01, jawSlotFrac: 0.6, jawSlotWidth: 0.8, craniumBack: [-0.42, 0.0], craniumTip: [0.54, -0.03], jawBack: [-0.38, -0.03], jawTip: [0.50, -0.07] },
};
const recipe = { schema: 'layered-station-head-v1', frame, l1, symmetry: { plane: 'x=0', policy: 'right half authored, left half mirrored by name; midline details use symmetric pins' }, parts: {}, creases: {} };
const base = buildPrimary(recipe, {});
const S = frame.scale, O = frame.origin; const W = (p) => [p[0] * S + O[0], p[1] * S + O[1], p[2] * S + O[2]];

/** author a right-side (or midline) part in head space; store offsets in its pin frame; mirror if asked */
function part(name, { layer, closure, pin, group, points, faces, stretch, boundary }, mirror) {
  const parent = base[pin.parent]; const f = pinFrame(parent, pin);
  const offsets = Object.fromEntries(Object.entries(points).map(([id, p]) => [id, surfaceLocalOffset(f, W(p))]));
  const fs = Object.fromEntries(faces.map((t, i) => [`f${String(i).padStart(2, '0')}`, t])); const groups = Object.fromEntries(Object.keys(fs).map((k) => [k, group]));
  const st = stretch && { dial: stretch.dial, origin: offsets[stretch.origin], axis: unit(sub(offsets[stretch.tip], offsets[stretch.origin])) };
  recipe.parts[name] = { layer, closure, pin, offsets, faces: fs, groups, ...(st ? { stretch: st } : {}), ...(boundary ? { boundary } : {}) };
  if (mirror) recipe.parts[mirror] = { layer, closure, pin: { parent: pin.parent, face: mirrorFace(pin.face), weights: [...pin.weights].reverse(), tangentEdge: pin.tangentEdge.map(mirrorPid), handedness: -1 }, offsets, faces: Object.fromEntries(Object.entries(fs).map(([k, t]) => [k, [...t].reverse()])), groups, ...(st ? { stretch: st } : {}), ...(boundary ? { boundary } : {}) };
}
const outward = (pts, tris, centre) => tris.map((t) => { const p = t.map((k) => pts[k]); const n = cross(sub(p[1], p[0]), sub(p[2], p[0])); return (n[0]*(mean(p)[0]-centre[0]) + n[1]*(mean(p)[1]-centre[1]) + n[2]*(mean(p)[2]-centre[2])) < 0 ? [t[0], t[2], t[1]] : t; });
const ringAround = (c, r, axis, n) => { const a = unit(axis); let u = cross(a, [0, 0, 1]); if (Math.hypot(...u) < 1e-6) u = cross(a, [0, 1, 0]); u = unit(u); const v = cross(a, u); return Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * i / n; return add(c, mul(add(mul(u, Math.cos(t)), mul(v, Math.sin(t))), r)); }); };

// ── horns: 4-gon rings from the crown brow slot, swept back and up ──
{ const b = [0.11, -0.22, 0.21], m = [0.19, -0.42, 0.28], t = [0.26, -0.60, 0.34]; const pts = {};
  ringAround(b, 0.04, sub(m, b), 4).forEach((p, i) => pts[`b${i}`] = p); ringAround(m, 0.024, sub(t, m), 4).forEach((p, i) => pts[`m${i}`] = p);
  pts.tip = t; pts.root = sub(b, mul(unit(sub(m, b)), 0.02)); pts.base = b;
  const tris = []; for (let k = 0; k < 4; k++) { const a = `b${k}`, c = `b${(k + 1) % 4}`, d = `m${(k + 1) % 4}`, e = `m${k}`; tris.push([a, c, d], [a, d, e], [e, d, 'tip'], [c, a, 'root']); }
  delete pts.base; const centre = mean([b, t]);
  part('hornR', { layer: 2, closure: 'closed', group: 'Horns', points: pts, faces: outward(pts, tris, centre), stretch: { dial: 'hornSweep', origin: 'root', tip: 'tip' },
    pin: { parent: 'cranium', face: 'cranium/st1-st2.k0.a', weights: [0.25, 0.55, 0.20], tangentEdge: ['cranium/st2.browR', 'cranium/st1.browR'], handedness: 1 } }, 'hornL'); }
// ── eyes: a closed dome on the brow/side face at the eye station ──
{ const c = [0.175, -0.04, 0.09], n = unit([1, 0.25, 0.45]); const pts = {}; ringAround(c, 0.032, n, 6).forEach((p, i) => pts[`r${i}`] = p); pts.outer = add(c, mul(n, 0.014)); pts.inner = sub(c, mul(n, 0.03));
  const tris = []; for (let k = 0; k < 6; k++) tris.push([`r${k}`, `r${(k + 1) % 6}`, 'outer'], [`r${(k + 1) % 6}`, `r${k}`, 'inner']);
  part('eyeR', { layer: 2, closure: 'closed', group: 'Eyes', points: pts, faces: outward(pts, tris, c),
    pin: { parent: 'cranium', face: 'cranium/st2-st3.k1.a', weights: [0.5, 0.4, 0.1], tangentEdge: ['cranium/st2.browR', 'cranium/st2.sideR'], handedness: 1 } }, 'eyeL'); }
// ── teeth: tetrahedra on the lip line (upper, cranium) and the gum line (lower, jaw) ──
const tooth = (name, [x, y, z], dir, pin, mirror) => { const pts = { b0: [x, y - 0.025, z], b1: [x, y + 0.025, z], b2: [x - 0.035, y, z + 0.01 * dir], apex: [x + 0.008, y, z + 0.065 * dir] }; pts.base = mean([pts.b0, pts.b1, pts.b2]);
  const tris = outward(pts, [['b0', 'b1', 'b2'], ['b0', 'b1', 'apex'], ['b1', 'b2', 'apex'], ['b2', 'b0', 'apex']], mean([pts.base, pts.apex])); delete pts.base; const base = mean([pts.b0, pts.b1, pts.b2]); pts.root = base;
  part(name, { layer: 2, closure: 'closed', group: 'Teeth', points: pts, faces: tris.map((t) => t), stretch: { dial: 'toothLength', origin: 'root', tip: 'apex' }, pin }, mirror); };
tooth('toothU1R', [0.13, 0.14, -0.15], -1, { parent: 'cranium', face: 'cranium/st3-st4.k2.a', weights: [0, 0.9, 0.1], tangentEdge: ['cranium/st3.lipR', 'cranium/st4.lipR'], handedness: 1 }, 'toothU1L');
tooth('toothU2R', [0.105, 0.27, -0.125], -1, { parent: 'cranium', face: 'cranium/st3-st4.k2.a', weights: [0, 0.1, 0.9], tangentEdge: ['cranium/st3.lipR', 'cranium/st4.lipR'], handedness: 1 }, 'toothU2L');
tooth('toothU3R', [0.075, 0.40, -0.10], -1, { parent: 'cranium', face: 'cranium/st4-st5.k2.a', weights: [0, 0.3, 0.7], tangentEdge: ['cranium/st4.lipR', 'cranium/st5.lipR'], handedness: 1 }, 'toothU3L');
tooth('toothL1R', [0.11, 0.20, -0.145], 1, { parent: 'jaw', face: 'jaw/st3-st4.k0.a', weights: [0, 0.5, 0.5], tangentEdge: ['jaw/st3.gumR', 'jaw/st4.gumR'], handedness: 1 }, 'toothL1L');
tooth('toothL2R', [0.085, 0.34, -0.12], 1, { parent: 'jaw', face: 'jaw/st4-st5.k0.a', weights: [0, 0.6, 0.4], tangentEdge: ['jaw/st4.gumR', 'jaw/st5.gumR'], handedness: 1 }, 'toothL2L');
// ── nostrils: an open triangle on the snout top near the tip (L3, declared boundary) ──
{ const pts = { a: [0.02, 0.38, 0.035], b: [0.05, 0.40, 0.03], c: [0.03, 0.44, 0.025] };
  part('nostrilR', { layer: 3, closure: 'open', group: 'Nostrils', points: pts, faces: [['a', 'b', 'c']], boundary: [['a', 'b'], ['b', 'c'], ['c', 'a']],
    pin: { parent: 'cranium', face: 'cranium/st4-st5.k0.a', weights: [0.4, 0.3, 0.3], tangentEdge: ['cranium/st4.browR', 'cranium/st5.browR'], handedness: 1 } }, 'nostrilL'); }
// ── crest: three closed midline spikes on symmetric pins along the top slot edge ──
const topZ = (y) => { const s = l1.stations; for (let i = 0; i + 1 < s.length; i++) if (y >= s[i].y && y <= s[i + 1].y) { const t = (y - s[i].y) / (s[i + 1].y - s[i].y); return s[i].top + (s[i + 1].top - s[i].top) * t; } throw new Error('y off the crown'); };
[['crest1', -0.08, 0.09, 'st1', 'st2'], ['crest2', -0.20, 0.11, 'st1', 'st2'], ['crest3', -0.32, 0.09, 'st0', 'st1']].forEach(([name, y, h, sA, sB]) => {
  const z = topZ(y) - 0.01; const pts = { b0: [0.03, y - 0.03, z], b1: [0.03, y + 0.03, z], b2: [-0.03, y + 0.03, z], b3: [-0.03, y - 0.03, z], apex: [0, y - 0.03, z + h] }; pts.root = mean([pts.b0, pts.b1, pts.b2, pts.b3]);
  const tris = outward(pts, [['b0', 'b1', 'b2'], ['b0', 'b2', 'b3'], ['b0', 'b1', 'apex'], ['b1', 'b2', 'apex'], ['b2', 'b3', 'apex'], ['b3', 'b0', 'apex']], [0, y, z + 0.02]);
  const yA = l1.stations.find((s) => s.station === sA).y, yB = l1.stations.find((s) => s.station === sB).y; const t = (y - yA) / (yB - yA);
  part(name, { layer: 2, closure: 'closed', group: 'Crest', points: pts, faces: tris, stretch: { dial: 'crestHeight', origin: 'root', tip: 'apex' },
    pin: { parent: 'cranium', face: `cranium/${sA}-${sB}.k0.b`, weights: [1 - t, 0, t], tangentEdge: [`cranium/${sB}.top`, `cranium/${sA}.top`], handedness: 1, mirror: { face: mirrorFace(`cranium/${sA}-${sB}.k0.b`), tangentEdge: [`cranium/${sB}.top`, `cranium/${sA}.top`] } } });
});
// ── brow creases: L3 feature edges on the cranium brow slot edges ──
for (const side of ['R', 'L']) for (const [a, b] of [['st1', 'st2'], ['st2', 'st3']]) recipe.creases[`brow${side}.${a}-${b}`] = { parent: 'cranium', edge: [`cranium/${a}.brow${side}`, `cranium/${b}.brow${side}`], role: 'crease' };

writeFileSync(recipePath, JSON.stringify(recipe, null, 1) + '\n');
console.log('parts', Object.keys(recipe.parts).length, 'creases', Object.keys(recipe.creases).length);
