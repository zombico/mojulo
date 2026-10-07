// Standalone builder tests — run with no install: node --test builder.test.js
// Tier-2: the injected toolkit is MOCKED here (the real one exists only inside
// mojulo); the mock mirrors buildVolumeFrag's shape — options in, string out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kind, plan, assemble, AURORA_SCENARIOS } from './builder.js';

const mockToolkit = {
  version: 1,
  effects: {
    buildVolumeFrag: (opts) =>
      `MOCKFRAG|uniforms:${(opts.uniforms || []).join('')}|steps:${opts.steps}`
      + `|occ:${opts.occluder ? opts.occluder.radiusUniform + '/' + opts.occluder.groundFn : 'none'}`
      + `|globals:${opts.globals}`,
    SDF_GLSL: '',
  },
};

test('kind metadata is complete', () => {
  assert.equal(kind.id, 'aurora');
  assert.equal(kind.manifestKind, 'aurora-view');
  assert.equal(kind.family, 'science');
  assert.deepEqual(AURORA_SCENARIOS, ['quiet', 'active', 'storm']);
});

test('Tier-2 gate: throws a teaching error without the toolkit', () => {
  assert.throws(() => plan({}), /Tier-2 builder.*injected effects toolkit/s);
  assert.throws(() => assemble({}, { title: 'x' }), /Tier-2 builder/);
});

test('deterministic: same recipe + toolkit → deep-equal plan', () => {
  const a = plan({ scenario: 'storm' }, { toolkit: mockToolkit });
  const b = plan({ scenario: 'storm' }, { toolkit: mockToolkit });
  assert.deepEqual(a, b);
});

test('the frag is composed through the injected scaffold with the ground occluder', () => {
  const { raymarch } = plan({}, { toolkit: mockToolkit });
  assert.match(raymarch.frag, /^MOCKFRAG/);
  assert.match(raymarch.frag, /occ:uRground\/auroraGround/);
  assert.match(raymarch.frag, /volSample/);            // the transfer fn rides opts.globals
  assert.match(raymarch.frag, /auroraGround/);
  // uniforms are declared ONCE, inside globals (duplicates fail GLSL compile)
  for (const u of ['uRmax', 'uRground', 'uActivity', 'uOval', 'uOvalW', 'uFold']) {
    const decls = raymarch.frag.match(new RegExp(`uniform float ${u};`, 'g')) || [];
    assert.equal(decls.length, 1, `${u} must be declared exactly once`);
  }
});

test('uniforms are complete and scenario presets differ physically', () => {
  const quiet = plan({ scenario: 'quiet' }, { toolkit: mockToolkit });
  const storm = plan({ scenario: 'storm' }, { toolkit: mockToolkit });
  for (const u of ['uRmax', 'uRground', 'uActivity', 'uOval', 'uOvalW', 'uFold']) {
    assert.ok(Number.isFinite(quiet.raymarch.customUniforms[u]), `missing ${u}`);
  }
  assert.ok(storm.raymarch.customUniforms.uActivity > quiet.raymarch.customUniforms.uActivity);
  assert.ok(storm.raymarch.customUniforms.uOval > quiet.raymarch.customUniforms.uOval, 'storm oval widens equatorward');
});

test('activity override clamps to 0..1', () => {
  const p = plan({ activity: 7 }, { toolkit: mockToolkit });
  assert.equal(p.raymarch.customUniforms.uActivity, 1);
  assert.equal(plan({ activity: -2 }, { toolkit: mockToolkit }).raymarch.customUniforms.uActivity, 0);
});

test('assemble: a complete raymarch payload', () => {
  const p = assemble({ scenario: 'quiet' }, { title: 'Quiet arc', toolkit: mockToolkit });
  assert.equal(p.title, 'Quiet arc');
  assert.ok(p.raymarch.frag.length > 0);
  assert.equal(p.raymarch.readout.length, 4);
  assert.match(p.bg, /^#[0-9a-f]{6}$/i);
  assert.deepEqual(p.viewBox, { width: 1120, height: 780 });
});
