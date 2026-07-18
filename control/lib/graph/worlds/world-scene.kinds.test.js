import { describe, expect, it } from 'vitest';

import { resolveWorldScene, WALK_KINDS } from './world-scene.js';

/**
 * Characterization net for the kind → assemble*Scene dispatch (world-scene-registry.plan.md).
 *
 * One row per dispatch arm: the minimal manifest that yields a non-null payload, snapshotted
 * as { title, hash } where hash is a stable content hash of the whole payload. Payloads are
 * deterministic by the substrate's own invariant (recipe → regenerated geometry, no RNG, no
 * clock), so any snapshot diff during the registry refactor is a transcription error by
 * construction — a title typo, a dropped { ...manifest } spread, time/sky not forwarded.
 *
 * Kept after the refactor: it becomes the standing guard that a new kind's registry row
 * actually renders, and that shared-assembler edits change payloads consciously
 * (snapshot update = explicit acknowledgment).
 */

// kind → minimal manifest. Bare { kind } wherever the assembler has full defaults; the
// exceptions document each kind's minimum viable recipe.
const FIXTURES = {
  planetary: { kind: 'planetary' },
  'molecule-view': { kind: 'molecule-view', atoms: [{ symbol: 'C', pos: [0, 0, 0] }, { symbol: 'O', pos: [1.2, 0, 0] }] },
  'dna-view': { kind: 'dna-view' },
  'energy-cycle': { kind: 'energy-cycle' },
  'dna-process': { kind: 'dna-process' },
  'cellular-view': { kind: 'cellular-view' },
  'atom-view': { kind: 'atom-view' },
  'mechanics-view': { kind: 'mechanics-view' },
  'orbit-view': { kind: 'orbit-view' },
  'comet-view': { kind: 'comet-view' },
  'field-view': { kind: 'field-view' },
  'fluid-view': { kind: 'fluid-view' },
  'ocean-view': { kind: 'ocean-view' },
  'gravity-wave-view': { kind: 'gravity-wave-view' },
  'parallel-transport-view': { kind: 'parallel-transport-view' },
  'windmill-view': { kind: 'windmill-view' },
  'double-slit-view': { kind: 'double-slit-view' },
  'black-hole-view': { kind: 'black-hole-view' },
  'saturn-view': { kind: 'saturn-view' },
  'galaxy-view': { kind: 'galaxy-view' },
  'star-birth-view': { kind: 'star-birth-view' },
  'pulsar-view': { kind: 'pulsar-view' },
  'plasma-globe-view': { kind: 'plasma-globe-view' },
  'lightning-storm-view': { kind: 'lightning-storm-view' },
  'wavepacket-view': { kind: 'wavepacket-view' },
  'fission-view': { kind: 'fission-view' },
  'cascade-view': { kind: 'cascade-view' },
  'fusion-view': { kind: 'fusion-view' },
  'cherenkov-view': { kind: 'cherenkov-view' },
  'reactor-view': { kind: 'reactor-view' },
  'atmosphere-view': { kind: 'atmosphere-view' },
  'transformer-view': { kind: 'transformer-view' },
  'vector-match-view': { kind: 'vector-match-view' },
  'transform-view': { kind: 'transform-view' },
  'field-flow-view': { kind: 'field-flow-view' },
  'surface-view': { kind: 'surface-view' },
  'series-view': { kind: 'series-view' },
  'probability-view': { kind: 'probability-view' },
  'complex-view': { kind: 'complex-view' },
  'trig-circle-view': { kind: 'trig-circle-view' },
  'pythagoras-view': { kind: 'pythagoras-view' },
  'quadratic-view': { kind: 'quadratic-view' },
  'complete-square-view': { kind: 'complete-square-view' },
  'conics-view': { kind: 'conics-view' },
  'derivative-view': { kind: 'derivative-view' },
  'ftc-view': { kind: 'ftc-view' },
  'fractal-city': { kind: 'fractal-city' },
  'condo-complex': { kind: 'condo-complex' },
  'school-complex': { kind: 'school-complex' },
  'transportation-hub': { kind: 'transportation-hub' },
  'subway-station': { kind: 'subway-station' },
  'subway-building': { kind: 'subway-building' },
  floorplan: { kind: 'floorplan' },
  restaurant: { kind: 'restaurant' },
  'vehicle-instance': { kind: 'vehicle-instance', type: 'airliner', decoration: { scheme: 'teal' } },
  workbench: { kind: 'workbench' },
  assembler: { kind: 'assembler' },
  'painted-landscape': { kind: 'painted-landscape', heartbeat: 'chop', splatch: 'verdure-trio' },
  controllable: { kind: 'controllable' },
  'operator-world': { kind: 'operator-world' },
  // the room FALLBACK arm (not a registry entry): any unrecognized kind falls through to
  // assembleRoomScene, which requires an eligible room manifest.
  room: { kind: 'room', cameraPrimitive: { kind: 'two-point' }, pureMandala: { room: {} } },
};

// FNV-1a over a stable (sorted-key) traversal — hashed incrementally so multi-MB payloads
// (condo-complex ≈ 74k faces) never materialize as one string.
const fnv = { h: 0 };
const mix = (state, str) => {
  let h = state;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};
const hashWalk = (v, h) => {
  if (v === null || v === undefined) return mix(h, v === null ? 'null' : 'undef');
  const t = typeof v;
  if (t === 'number' || t === 'boolean' || t === 'string') return mix(h, `${t}:${v};`);
  if (t === 'function') return mix(h, 'fn;'); // payloads should not carry functions; hash presence only
  if (Array.isArray(v)) {
    h = mix(h, `[${v.length}`);
    for (const x of v) h = hashWalk(x, h);
    return mix(h, ']');
  }
  if (ArrayBuffer.isView(v)) return hashWalk([v.constructor.name, Array.from(v)], h);
  const keys = Object.keys(v).sort();
  h = mix(h, `{${keys.length}`);
  for (const k of keys) h = hashWalk(v[k], mix(h, `${k}:`));
  return mix(h, '}');
};
const payloadHash = (payload) => hashWalk(payload, 0x811c9dc5).toString(16).padStart(8, '0');

const sketch = (manifest) => ({ manifest, title: null });

describe('world-scene kinds — per-arm characterization', () => {
  it('every dispatch arm resolves its fixture to a stable { title, hash } snapshot', async () => {
    const rows = {};
    for (const [kind, manifest] of Object.entries(FIXTURES)) {
      const { payload } = await resolveWorldScene(sketch(manifest));
      expect(payload, `fixture for '${kind}' produced no payload`).toBeTruthy();
      rows[kind] = { title: payload.title ?? null, hash: payloadHash(payload) };
    }
    expect(rows).toMatchSnapshot();
  }, 120000);

  it('resolves are deterministic (same fixture twice → identical hash)', async () => {
    // spot-check across the calling-convention families rather than re-running all ~59:
    // view-convention, spread-convention, time/sky-forwarding, bespoke-options, async-textures, fallback.
    for (const kind of ['orbit-view', 'planetary', 'fractal-city', 'subway-building', 'workbench', 'room']) {
      const a = await resolveWorldScene(sketch(FIXTURES[kind]));
      const b = await resolveWorldScene(sketch(FIXTURES[kind]));
      expect(payloadHash(a.payload), `'${kind}' resolve is unstable across runs`).toBe(payloadHash(b.payload));
    }
  }, 60000);

  it('an unrecognized kind with no room-eligible manifest resolves to a null payload', async () => {
    const { payload, kind } = await resolveWorldScene(sketch({ kind: 'no-such-kind' }));
    expect(payload).toBeNull();
    expect(kind).toBe('no-such-kind');
  });

  it('viewOpts.view forwards into the floorplan arm (pinned: forwarding must survive the refactor)', async () => {
    const base = await resolveWorldScene(sketch(FIXTURES.floorplan));
    const dollhouse = await resolveWorldScene(sketch(FIXTURES.floorplan), { view: 'dollhouse' });
    // the two payloads need not differ in every field, but the resolve must not throw and
    // must keep producing a payload; pin both hashes so a dropped forwarding shows up.
    expect(base.payload).toBeTruthy();
    expect(dollhouse.payload).toBeTruthy();
    expect({ base: payloadHash(base.payload), dollhouse: payloadHash(dollhouse.payload) }).toMatchSnapshot();
  });
});

describe('world-scene kinds — side tables pinned as literals', () => {
  it('WALK_KINDS survives the derivation change bit-for-bit', () => {
    expect([...WALK_KINDS].sort()).toEqual([
      'condo-complex', 'edifice', 'floorplan', 'fractal-city', 'koenigsberg', 'math-structure',
      'operator-world', 'painted-landscape', 'restaurant', 'room', 'school-complex',
      'subway-building', 'subway-station', 'transportation-hub',
    ]);
  });

  it('the fog-capable kind set is exactly { fractal-city }', async () => {
    const withFog = await resolveWorldScene(sketch({ ...FIXTURES['fractal-city'], fog: true }));
    expect(withFog.payload.fog).toBeTruthy();
    // representative walkable-but-not-fog-capable kind: same flag, no effect.
    const notFog = await resolveWorldScene(sketch({ ...FIXTURES['transportation-hub'], fog: true }));
    expect(notFog.payload.fog).toBeUndefined();
  });
});
