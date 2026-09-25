/** Machine checks for head-detail: closure, determinism and the principle rules the grammar holds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt, compile, refineStation, refineSlot, loadRecipe, clone, jawFloor, keepOut } from './compile.mjs';
import { surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';

const partsOf = (head, x) => build(head, x).parts;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('every part of both heads is closed and consistently wound in every expression', () => {
  for (const [h, head] of Object.entries(HEADS)) for (const [e, x] of Object.entries(EXPRESSIONS)) {
    const { audit } = toSource(build(head, x));
    assert.equal(audit.open, 0, `${h}/${e}: open edges`); assert.equal(audit.badWinding, 0, `${h}/${e}: winding`);
  }
});

test('deterministic: the same head and expression build byte-identical sources', () => {
  for (const head of Object.values(HEADS)) assert.ok(same(toSource(build(head, EXPRESSIONS.snarl)), toSource(build(head, EXPRESSIONS.snarl))));
});

test('the core names no species: every species word lives in HEAD DATA', () => {
  const src = readFileSync(new URL('./compile.mjs', import.meta.url), 'utf8');
  const core = src.slice(src.indexOf('═ CORE'), src.indexOf('═ HEAD DATA'));
  assert.ok(core.length > 1000);
  for (const word of ['dragon', 'bear', 'Horn', 'horn', 'crest', 'Crest', 'ear', 'fang']) assert.ok(!new RegExp(`\\b${word}\\b`).test(core), `core mentions ${word}`);
});

test('the same expressions drive both heads, and a control a head lacks is a no-op', () => {
  // earAttitude has no region on the dragon; hornCurl none on the bear
  assert.ok(same(partsOf(HEADS.dragon, {}), partsOf(HEADS.dragon, { earAttitude: 1 })));
  assert.ok(same(partsOf(HEADS.bear, {}), partsOf(HEADS.bear, { hornCurl: 1 })));
});

test('bone carriers do not move under skin controls', () => {
  const skinOnly = { browRaise: 1, browFurrow: 1, sneer: 1, cheekBunch: 1, cornerRetract: 1 };
  for (const head of Object.values(HEADS)) {
    const a = partsOf(head, {}), b = partsOf(head, skinOnly);
    const bone = Object.keys(a).filter((k) => /^(tooth|horn|eye|catch|tongue|ear|nose|crest)/.test(k));
    assert.ok(bone.length > 4);
    for (const k of bone) assert.ok(same(a[k].points, b[k].points), `${k} moved under a skin control`);
  }
});

test('a one-sided expression never moves the other side; the shared midline bounds anything pinned across it', () => {
  const moved = (A, B) => Math.max(0, ...Object.entries(A).map(([id, p]) => Math.hypot(...p.map((v, i) => v - B[id][i]))));
  for (const head of Object.values(HEADS)) {
    const a = build(head, {}), b = build(head, { sneer: { L: 1 }, browFurrow: { L: 1 }, cheekBunch: { L: 1 } });
    for (const [id, p] of Object.entries(a.skin.cranium.points)) if (id.endsWith('R')) assert.ok(same(p, b.skin.cranium.points[id]), `${id} moved`);
    const mid = (pts) => Object.fromEntries(Object.entries(pts).filter(([id]) => !/[RL]$/.test(id)));
    const midline = moved(mid(a.skin.cranium.points), mid(b.skin.cranium.points));
    for (const k of ['browR', 'foldR', 'surroundR', 'nostrilR']) assert.ok(moved(a.parts[k].points, b.parts[k].points) <= midline + 1e-12, `${k} moved more than the shared midline`);
  }
});

test('the upper surround tucks under the brow and the tongue rests on the jaw floor', () => {
  for (const head of Object.values(HEADS)) {
    const p = partsOf(head, {});
    // the rule as built, in the eye's own frame: every upper outer point of the surround sits `tuck` below
    // the brow's lower edge (strip point 0 at each station) at the same position along the eye's tangent
    const f = frameAt(carriers(head.recipe, head, {}).bone, 'cranium', head.regions.eye.at, 'R');
    const edge = [0, 1, 2, 3, 4].map((j) => surfaceLocalOffset(f, p.browR.points[`st${j}.s0`])).sort((u, v) => u[0] - v[0]);
    const browY = (x) => { if (x <= edge[0][0]) return edge[0][1]; for (let k = 0; k + 1 < edge.length; k++) if (x <= edge[k + 1][0]) return edge[k][1] + (edge[k + 1][1] - edge[k][1]) * (x - edge[k][0]) / (edge[k + 1][0] - edge[k][0]); return edge[edge.length - 1][1]; };
    const outer = Object.entries(p.surroundR.points).filter(([id]) => /\.s4$/.test(id)).map(([, q]) => surfaceLocalOffset(f, q)).filter((q) => q[1] > 0);
    assert.ok(outer.length >= 8);
    for (const q of outer) assert.ok(q[1] <= browY(q[0]) - head.regions.orbit.tuck + 1e-6, `surround point ${q.map((v) => v.toFixed(4))} is not tucked under the brow`);
    const tongueLow = Math.min(...Object.values(p['tongue.0'].points).map((q) => q[2]));
    const floor = Math.min(...Object.entries(build(head, {}).skin.jaw.points).filter(([id]) => /\.gum$/.test(id)).map(([, q]) => q[2]));
    assert.ok(tongueLow > floor - 0.01, 'tongue sits below the jaw floor');
  }
});

test('refinement keeps addresses: (s, t) names the same bilinear patch point, and refining converges on it', () => {
  // an address means the point on the cell's bilinear patch; the coarse two-triangle split sits off that patch
  // by the cell's non-planarity, and linear refinement moves every address onto it
  const plain = clone(loadRecipe()), fine = clone(loadRecipe());
  for (const [a, b] of [['st1', 'st2'], ['st2', 'st3'], ['st3', 'st4'], ['st4', 'st5']]) refineStation(fine, 'cranium', a, b);
  refineSlot(fine, 'cranium', 'brow', 'sideR', 'temple'); refineSlot(fine, 'cranium', 'side', 'lipR', 'cheek');
  const [A, B] = [plain, fine].map((r) => compile(r, {}, { details: false, creases: false }).parts);
  assert.ok(B.cranium.stations.length === A.cranium.stations.length + 4 && B.cranium.slots.length === A.cranium.slots.length + 4);
  const S = A.cranium.slots, P = (j, k) => A.cranium.points[`cranium/st${j}.${S[k]}`]; const L = (a, b, w) => a.map((x, n) => x + (b[n] - x) * w);
  const dist = (p, q) => Math.hypot(...p.map((x, n) => x - q[n]));
  for (const q of [[2.45, 1.55], [1.55, 0.55], [4.55, 0.6], [1.7, 2.97], [3.6, 2.4]]) {
    const i = Math.floor(q[0]), k = Math.floor(q[1]), u = q[0] - i, v = q[1] - k; const bilinear = L(L(P(i, k), P(i + 1, k), u), L(P(i, k + 1), P(i + 1, k + 1), u), v);
    const coarse = dist(frameAt(A, 'cranium', q, 'R').origin, bilinear), refined = dist(frameAt(B, 'cranium', q, 'R').origin, bilinear);
    assert.ok(refined < 0.001 && refined <= coarse + 1e-9, `address ${q}: refined ${(refined * 1000).toFixed(2)} mm, coarse ${(coarse * 1000).toFixed(2)} mm off the patch`);
  }
});

test('the tongue never goes below the jaw, in any expression or at the controls\' extremes', () => {
  // in the jaw's own frame (it rides the hinge): every tongue vertex stays above the jaw's underside at its x
  // (held at the chin past the tip), and above the jaw's lowest point outright
  const extremes = [{ jawOpen: 30, tongueOut: 1, tongueCurl: -1 }, { jawOpen: 30, tongueOut: 1, tongueCurl: -1, tongueSway: 1 }, { jawOpen: 0, tongueOut: 1, tongueCurl: -1 }, { jawOpen: 12, tongueOut: 0.5, tongueCurl: 1 }];
  for (const [h, head] of Object.entries(HEADS)) for (const x of [...Object.values(EXPRESSIONS), ...extremes]) {
    const { bone } = carriers(head.recipe, head, x); const base = frameAt(bone, 'jaw', head.regions.tongue.at, 'R'); const floor = jawFloor(bone, base);
    const jawLow = Math.min(...Object.values(bone.jaw.points).map((q) => surfaceLocalOffset(base, q)[2]));
    const parts = build(head, x).parts; const tongue = Object.keys(parts).filter((k) => k.startsWith('tongue.')).flatMap((k) => Object.values(parts[k].points)).map((q) => surfaceLocalOffset(base, q));
    for (const q of tongue) { assert.ok(q[2] >= floor(q[0]) - 1e-6, `${h} ${JSON.stringify(x)}: tongue ${(q[2] - floor(q[0])) * 1000} mm under the jaw's underside`); assert.ok(q[2] >= jawLow - 1e-6, `${h}: tongue below the jaw's lowest point`); }
  }
});

test('no lid or pad vertex is ever inside the eyeball, in any expression or at the controls\' extremes', () => {
  // in the eye's own frame: the ball's extent is its drawn vertices' furthest reach from its centre (gaze never moves it)
  const extremes = [{ lidClose: 1 }, { lidClose: 1, browFurrow: 1, cheekBunch: 1 }, { lidClose: -1, browRaise: 1, browArch: 1 }, { browFurrow: 1, eyeGaze: [30, 20] }];
  for (const [h, head] of Object.entries(HEADS)) for (const x of [...Object.values(EXPRESSIONS), ...extremes]) {
    const p = build(head, x).parts; const f = frameAt(carriers(head.recipe, head, x).bone, 'cranium', head.regions.eye.at, 'R');
    const r = (q) => { const l = surfaceLocalOffset(f, q); return Math.hypot(l[0], l[1], l[2] - 0.002); };
    const ball = Math.max(...Object.values(p.eyeR.points).map(r)); const lid = Math.min(...Object.values(p.surroundR.points).map(r));
    assert.ok(lid >= ball - 1e-9, `${h} ${JSON.stringify(x)}: surround ${((ball - lid) * 1000).toFixed(2)} mm inside the eyeball`);
  }
});

test('tiles yield to regions, and which tiles exist never depends on the expression', () => {
  for (const [h, head] of Object.entries(HEADS)) {
    const rest = carriers(head.recipe, head, {}).skin; const at = build(head, {}).parts;
    for (const side of ['R', 'L']) { const zones = keepOut(rest, head.regions, side); assert.ok(zones.length > 10);
      // a tile's `back` point sits 3 mm under its centre along the normal
      for (const [k, t] of Object.entries(at).filter(([k]) => k.startsWith(`tile`) && k.includes(side))) for (const z of zones) assert.ok(Math.hypot(...t.points.back.map((v, i) => v - z.p[i])) >= z.r - 0.003 - 1e-9, `${h} ${k} grows inside a region`); }
    const ids = (x) => Object.keys(build(head, x).parts).filter((k) => k.startsWith('tile')).join();
    for (const x of Object.values(EXPRESSIONS)) assert.equal(ids(x), ids({}), `${h}: the tile set changed with the expression`);
  }
});

test('driven strips rise with their controls and are always present', () => {
  const lift = (head, x, k) => { const { parts, skin } = build(head, x); const D = head.regions.wrinkles[Number(k.slice(7, -1))]; const mid = D.strip[Math.floor(D.strip.length / 2)];
    const f = frameAt(skin, D.part || 'cranium', mid, 'R'); return Math.max(...Object.values(parts[k].points).map((q) => surfaceLocalOffset(f, q)[2])); };
  for (const [h, head] of Object.entries(HEADS)) head.regions.wrinkles.forEach((D, i) => { const k = `wrinkle${i}R`; const drive = Object.fromEntries(Object.keys(D.drive).map((c) => [c, 1]));
    assert.ok(k in build(head, {}).parts, `${h} ${k} missing at rest`);
    assert.ok(lift(head, drive, k) > lift(head, {}, k) + 0.002, `${h} ${k} did not rise under ${Object.keys(D.drive)}`); });
});

test('details built from a loft ride it: horn ridges stay centred on their horn rings under curl', () => {
  for (const hornCurl of [0, 0.35, 1]) { const p = build(HEADS.dragon, { hornCurl }).parts;
    const ctr = (pts, j) => { const q = Object.entries(pts).filter(([id]) => id.startsWith(`st${j}.`)).map(([, v]) => v); return q[0].map((_, i) => q.reduce((s, v) => s + v[i], 0) / q.length); };
    for (const j of [1, 2, 3, 4, 5]) { const a = ctr(p.hornR.points, j), b = ctr(p[`hornRidge${j}R`].points, 1); assert.ok(Math.hypot(...a.map((v, i) => v - b[i])) < 1e-9, `ridge ${j} left its ring at hornCurl ${hornCurl}`); } }
});
