// node --test docs/examples/hero-head/test-head.mjs — the hero head: closed in every expression and hair style,
// deterministic, the baked include pinned byte for byte, the core still names no anatomy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEADS, EXPRESSIONS, HAIR, heroHead, bakeHero, bakedPath, build, toSource } from './head.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('every part of every head is closed and consistently wound in every expression', () => {
  for (const [h, head] of Object.entries(HEADS)) for (const [e, x] of Object.entries(EXPRESSIONS)) {
    const { audit } = toSource(build(head, x));
    assert.equal(audit.open, 0, `${h}/${e}: open edges`); assert.equal(audit.badWinding, 0, `${h}/${e}: winding`);
  }
});

test('every hair style builds alone and together; an unknown style refuses', () => {
  for (const style of Object.keys(HAIR)) { const { audit, faces } = toSource(build(heroHead({ hair: [style] }), {})); assert.equal(audit.open + audit.badWinding, 0, style); assert.ok(faces.length > 2000); }
  const bare = toSource(build(heroHead({ hair: [] }), {})).faces.length, all = toSource(build(heroHead({ hair: Object.keys(HAIR) }), {})).faces.length;
  assert.ok(all > bare + 200);
  assert.throws(() => heroHead({ hair: ['mohawk'] }), /unknown hair style 'mohawk'/);
});

test('deterministic, and a one-sided expression never moves the other side', () => {
  const head = HEADS.hero;
  assert.ok(same(toSource(build(head, EXPRESSIONS.smile)), toSource(build(head, EXPRESSIONS.smile))));
  const a = build(head, {}), b = build(head, { browFurrow: { L: 1 }, cheekBunch: { L: 1 }, cornerRetract: { L: 1 } });
  for (const [id, p] of Object.entries(a.skin.cranium.points)) if (id.endsWith('R')) assert.ok(same(p, b.skin.cranium.points[id]), `${id} moved`);
});

test('baked.json is bakeHero() at the neutral expression, byte for byte, and carries the jaw joints a rig needs', () => {
  const baked = bakeHero();
  assert.equal(readFileSync(bakedPath, 'utf8'), JSON.stringify(baked) + '\n');
  assert.deepEqual(Object.keys(baked.dials), ['jawOpen']); assert.deepEqual(baked.bind, { cranium: 'head', jaw: 'jaw' });
  assert.ok(baked.joints.jawHinge[2] < 0 && baked.joints.jawTip[1] > baked.joints.jawHinge[1]);
  assert.ok(Object.keys(baked.parts).some((k) => k.startsWith('tile')) && baked.parts.eyeR && baked.parts.eyeL && baked.parts.nose);
});

test('the core names no anatomy this head adds', () => {
  const core = readFileSync(new URL('../../../control/lib/graph/polygonizer/station-loft-detail.js', import.meta.url), 'utf8');
  // 'hair' alone is not on the list: it is the core's idiom for a small distance
  for (const word of ['human', 'hero', 'Hair', 'nose', 'bangs', 'ponytail']) assert.ok(!new RegExp(`\\b${word}\\b`).test(core), `core mentions ${word}`);
});
