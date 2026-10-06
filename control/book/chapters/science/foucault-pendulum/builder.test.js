// Standalone builder tests — run with no install: node --test builder.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { kind, plan, assemble, FOUCAULT_SCENARIOS } from './builder.js';

test('kind metadata is complete', () => {
  assert.equal(kind.id, 'foucault-pendulum');
  assert.equal(kind.manifestKind, 'foucault-pendulum-view');
  assert.equal(kind.family, 'science');
  assert.ok(kind.title.length > 0);
  assert.deepEqual(FOUCAULT_SCENARIOS, ['paris', 'pole', 'equator']);
});

test('deterministic: same recipe → deep-equal plan', () => {
  const a = plan({ scenario: 'paris', vectors: true });
  const b = plan({ scenario: 'paris', vectors: true });
  assert.deepEqual(a, b);
});

test('the loop closes seamlessly (with and without precession)', () => {
  for (const scenario of ['paris', 'pole', 'equator']) {
    const { movers } = plan({ scenario });
    const path = movers[0].path;
    assert.deepEqual(path[path.length - 1], path[0], `${scenario} loop must close`);
  }
});

test('equator: no precession — the swing stays in one vertical plane', () => {
  const { movers, stats } = plan({ scenario: 'equator' });
  assert.equal(stats.omegaDegPerHour, 0);
  assert.equal(stats.daysPerRotation, null);
  for (const p of movers[0].path) assert.ok(Math.abs(p[1]) < 1e-9, 'y must stay 0');
});

test('paris: precession is 15.04 × sin(48.86°) ≈ 11.32°/h and the plane sweeps', () => {
  const { movers, stats } = plan({ scenario: 'paris' });
  assert.ok(Math.abs(stats.omegaDegPerHour - 11.32) < 0.02);
  assert.ok(movers[0].path.some((p) => Math.abs(p[1]) > 1), 'path must leave the initial plane');
});

test('faces are well-formed quads and the bob group exists', () => {
  const { faces } = plan({});
  assert.ok(faces.length > 200);
  for (const f of faces) {
    assert.equal(f.corners.length, 4);
    for (const c of f.corners) { assert.equal(c.length, 3); c.forEach((v) => assert.ok(Number.isFinite(v))); }
    assert.match(f.fill, /^#[0-9a-f]{6}$/i);
  }
  assert.ok(faces.some((f) => f.group === 'bob'));
});

test('vectors: kinematics arrays align with the path', () => {
  const { movers } = plan({ vectors: true });
  const mv = movers[0];
  assert.equal(mv.vdir.length, mv.path.length);
  assert.equal(mv.speed.length, mv.path.length);
  assert.equal(mv.accel.length, mv.path.length);
  assert.ok(mv.maxSpeed > 0 && mv.maxAccel > 0);
});

test('assemble: a complete emitThreeWorld payload', () => {
  const p = assemble({ scenario: 'pole' }, { title: 'Pole test' });
  assert.equal(p.title, 'Pole test');
  assert.equal(p.cameras.length, 2);
  assert.ok(p.faces.length > 0 && p.movers.length === 1 && p.fields.length === 1);
  assert.match(p.bg, /^#[0-9a-f]{6}$/i);
  assert.deepEqual(p.viewBox, { width: 1120, height: 780 });
});

test('bad params clamp instead of throwing', () => {
  const p = plan({ latitude: 500, amplitude: -3, scale: 99 });
  assert.equal(p.stats.latitudeDeg, 90);
  assert.ok(p.movers[0].path.every((c) => c.every((v) => Number.isFinite(v))));
});
