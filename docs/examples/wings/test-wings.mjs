/** Machine checks for the wing op on both creatures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWing, DRAGON_WING, VULTURE_WING, dragon, vulture, toSource, measuredEdge } from './wings.mjs';

test('both creatures are closed and consistently wound spread, half folded and folded', () => {
  for (const make of [dragon, vulture]) for (const f of [0, 0.5, 1]) { const s = toSource(make(f)); assert.equal(s.audit.open, 0); assert.equal(s.audit.wind, 0); }
});

test('deterministic', () => { assert.equal(JSON.stringify(toSource(vulture(0.5))), JSON.stringify(toSource(vulture(0.5)))); });

test('the fold keeps bone lengths; membrane weights sum to 1; every vane rides exactly one bone', () => {
  const lens = (w) => w.bones.slice(0, 2).map((b) => Math.hypot(...b.tail.map((x, i) => x - b.head[i])));
  const rest = lens(buildWing(DRAGON_WING, [0.2, -0.3, 1.7], 0));
  for (const f of [0.25, 0.5, 1]) { const w = buildWing(DRAGON_WING, [0.2, -0.3, 1.7], f); lens(w).forEach((l, i) => assert.ok(Math.abs(l - rest[i]) < 1e-9));
    for (const o of w.bind.membrane) assert.ok(Math.abs(Object.values(o).reduce((a, b) => a + b, 0) - 1) < 1e-12); }
  const v = buildWing(VULTURE_WING, [0.11, 0.14, 0.9], 0); assert.ok(Object.keys(v.bind).length > 50);
  for (const b of Object.values(v.bind)) assert.equal(Object.keys(b).length, 1);
});

test('the membrane waveform has one scallop per gap between rays', () => {
  const { rmax } = measuredEdge(DRAGON_WING); const s = rmax.filter((x) => x > 0); let dips = 0;
  for (let k = 3; k < s.length - 3; k++) { const w = s.slice(k - 3, k + 4); if (s[k] === Math.min(...w) && Math.max(...w) - s[k] > 0.02 * Math.max(...s)) dips++; }
  assert.equal(dips, DRAGON_WING.membrane.order.length - 1);
});
