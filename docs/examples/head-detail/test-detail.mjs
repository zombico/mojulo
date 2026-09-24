/** Machine checks for head-detail: closure, determinism and the principle rules the grammar holds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt } from './compile.mjs';
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

test('a one-sided expression leaves the other side untouched', () => {
  for (const head of Object.values(HEADS)) {
    const a = build(head, {}), b = build(head, { sneer: { L: 1 }, browFurrow: { L: 1 }, cheekBunch: { L: 1 } });
    for (const [id, p] of Object.entries(a.skin.cranium.points)) if (id.endsWith('R')) assert.ok(same(p, b.skin.cranium.points[id]), `${id} moved`);
    for (const k of ['browR', 'foldR', 'surroundR', 'nostrilR']) assert.ok(same(a.parts[k].points, b.parts[k].points), `${k} moved`);
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
