import { describe, expect, it } from 'vitest';

import {
  GREYBOX_LEDGER_NOTE,
  HANDOFF_POSTURES,
  extractEngineScore,
  resolvePosture,
} from './engine-score.js';

// A minimal resolved-world payload — enough for the score extractor, nothing
// engine-specific. Kept tiny and fixed: the unstamped snapshot below is the
// phase-0 guard that the greybox seam never leaks into undeclared exports.
const sketch = (manifest = {}) => ({ ref: 'sk_score_fixture', manifest: { kind: 'floorplan-world', title: 'fixture', ...manifest } });
const payload = () => ({
  title: 'fixture world',
  colliders: [{ min: [0, 0, 0], max: [1, 1, 1] }],
  entities: [{ id: 'walker', rule: { type: 'walk' } }],
  walk: { eye: 1.6 },
});

describe('resolvePosture', () => {
  it('returns null when neither the call nor the manifest declares one', () => {
    expect(resolvePosture(null, {})).toBeNull();
    expect(resolvePosture(undefined, undefined)).toBeNull();
  });

  it('explicit (per-handoff) wins over the manifest default', () => {
    expect(resolvePosture('final', { posture: 'greybox' })).toBe('final');
  });

  it('falls back to the manifest default', () => {
    expect(resolvePosture(null, { posture: 'greybox' })).toBe('greybox');
  });

  it('fails loudly on an unknown posture — at export, not silently', () => {
    expect(() => resolvePosture('blockout', {})).toThrow(/unknown handoff posture 'blockout'/);
    expect(() => resolvePosture(null, { posture: 'draft' })).toThrow(/unknown handoff posture 'draft'/);
  });

  it('the posture vocabulary is exactly greybox|final', () => {
    expect(HANDOFF_POSTURES).toEqual(['greybox', 'final']);
  });
});

describe('extractEngineScore — the greybox seam (skin-over-mesh.plan.md phase 0)', () => {
  it('unstamped: no posture key, no greybox ledger entry — byte-identical to pre-seam output', () => {
    const score = extractEngineScore(sketch(), payload());
    expect('posture' in score).toBe(false);
    expect(score.ledger.greybox_declared).toBeUndefined();
    // pin the whole unstamped shape so any future stamp leakage fails here first
    expect(score).toMatchSnapshot();
  });

  it('greybox: stamps the score and leads the ledger with the reframe note', () => {
    const score = extractEngineScore(sketch(), payload(), { posture: 'greybox' });
    expect(score.posture).toBe('greybox');
    expect(score.ledger.greybox_declared).toEqual({ note: GREYBOX_LEDGER_NOTE });
    expect(Object.keys(score.ledger)[0]).toBe('greybox_declared');
  });

  it('final: stamps the score, adds NO ledger note (final is a declaration, not a reframe)', () => {
    const score = extractEngineScore(sketch(), payload(), { posture: 'final' });
    expect(score.posture).toBe('final');
    expect(score.ledger.greybox_declared).toBeUndefined();
  });

  it('a stamped score differs from unstamped ONLY by the stamp + reframe', () => {
    const plain = extractEngineScore(sketch(), payload());
    const stamped = extractEngineScore(sketch(), payload(), { posture: 'greybox' });
    const { posture, ...rest } = stamped;
    const { greybox_declared, ...restLedger } = rest.ledger;
    expect(posture).toBe('greybox');
    expect(greybox_declared).toBeDefined();
    expect({ ...rest, ledger: restLedger }).toEqual(plain);
  });

  it('manifest posture is the durable default; the call-site declaration overrides it', () => {
    expect(extractEngineScore(sketch({ posture: 'greybox' }), payload()).posture).toBe('greybox');
    expect(extractEngineScore(sketch({ posture: 'greybox' }), payload(), { posture: 'final' }).posture).toBe('final');
  });

  it('posture is never inferred — a world with zero surfacing stays unstamped', () => {
    // bare geometry, no textures, no materials: absence of skin must not imply greybox
    const score = extractEngineScore(sketch(), { title: 'bare' });
    expect('posture' in score).toBe(false);
  });
});

describe('extractEngineScore — the locomotion row (export-unreal U2, the walking-suits gap)', () => {
  const rigPayload = () => ({
    ...payload(),
    entities: [
      { id: 'unit', body: { figure: 'suit_multi' }, rule: { type: 'walk' }, transform: { pos: [1, 2, 0] } },
      { id: 'prop', body: { figure: 'crate' }, transform: { pos: [0, 0, 0] } },
    ],
    figures: {
      suit_multi: { clips: { idle: {}, forward: {}, boost: {}, turn: {} } },
      crate: {}, // no clips — a statue is honest for it
    },
  });

  it('names idle/walk/boost from the figure clip vocabulary (forward IS the walk)', () => {
    const score = extractEngineScore(sketch(), rigPayload());
    expect(score.entities.find((e) => e.id === 'unit').locomotion)
      .toEqual({ idle: 'suit_multi:idle', walk: 'suit_multi:forward', boost: 'suit_multi:boost' });
  });

  it('entities without travel clips get no row — byte-identical to pre-seam output', () => {
    const score = extractEngineScore(sketch(), rigPayload());
    expect(score.entities.find((e) => e.id === 'prop').locomotion).toBeUndefined();
    const bare = extractEngineScore(sketch(), payload());
    expect(bare.entities[0].locomotion).toBeUndefined();
  });

  it("accepts 'walk' as an alias when a figure names its cycle that way", () => {
    const p = rigPayload();
    p.figures.suit_multi = { clips: { idle: {}, walk: {} } };
    expect(extractEngineScore(sketch(), p).entities[0].locomotion)
      .toEqual({ idle: 'suit_multi:idle', walk: 'suit_multi:walk' });
  });
});

describe('fallback ground elevation', () => {
  it('keeps zero by default and converts an explicit floor to the mesh unit scale', () => {
    expect(extractEngineScore(sketch(), payload()).ground).toBe(0);
    const p = { ...payload(), metersPerUnit: 0.3048, walk: { eye: 5.3, ground: -20 } };
    expect(extractEngineScore(sketch(), p).ground).toBeCloseTo(-6.096);
    expect(extractEngineScore(sketch(), { ...p, walk: { ground: NaN } }).ground).toBe(0);
  });
});

describe('the seat facing (walk.yaw)', () => {
  it('rides as a degrees row when finite; absent ⇒ no row', () => {
    expect(extractEngineScore(sketch(), payload()).yaw).toBeUndefined();
    expect(extractEngineScore(sketch(), { ...payload(), walk: { eye: 1.6, yaw: 90 } }).yaw).toBe(90);
    expect(extractEngineScore(sketch(), { ...payload(), walk: { eye: 1.6, yaw: 'east' } }).yaw).toBeUndefined();
  });
});

describe('the sky row (unreal-demo D2 — the declaration travels)', () => {
  it('carries the payload sky preset by name and nothing else; absent ⇒ no row', () => {
    expect(extractEngineScore(sketch(), payload()).sky).toBeUndefined();
    const p = { ...payload(), sky: { preset: 'night', stars: true, moon: true, seed: 7 } };
    expect(extractEngineScore(sketch(), p).sky).toEqual({ preset: 'night' });
    expect(extractEngineScore(sketch(), { ...payload(), sky: { stars: true } }).sky).toBeUndefined();
  });
});

describe('mechanics scale with the unit declaration', () => {
  const mech = [
    { kind: 'reach-exit', at: [1, 2, 3], radius: 0.5 },
    { kind: 'collect', into: 'bag', pickups: [{ item: 'cell', at: [2, 0, 1], radius: 0.25 }] },
    { kind: 'hazard-damage', hazards: [{ at: [0, 1, 0], radius: 0.7, damage: 30 }] },
    { kind: 'fail-on-death' },
  ];
  it('is the identity without a unit', () => {
    expect(extractEngineScore(sketch({ game: { mechanics: mech } }), payload()).mechanics).toEqual(mech);
  });
  it('scales at + radius on zones, pickups and hazards; everything else passes through', () => {
    const out = extractEngineScore(sketch({ game: { mechanics: mech } }), { ...payload(), metersPerUnit: 2 }).mechanics;
    expect(out[0]).toEqual({ kind: 'reach-exit', at: [2, 4, 6], radius: 1 });
    expect(out[1]).toEqual({ kind: 'collect', into: 'bag', pickups: [{ item: 'cell', at: [4, 0, 2], radius: 0.5 }] });
    expect(out[2]).toEqual({ kind: 'hazard-damage', hazards: [{ at: [0, 2, 0], radius: 1.4, damage: 30 }] });
    expect(out[3]).toEqual({ kind: 'fail-on-death' });
  });
});

describe('the HUD widget list rides the score as data (hud-widgets.js)', () => {
  it('normalized widgets land under `hud` with a hud_declared ledger row; absent rows ⇒ no key, no row', () => {
    const payload = { faces: [], events: { reactions: [{ on: 'x', do: 'emit', type: 'y' }], hud: [{ var: 'hp', as: 'bar', max: 100, slot: 'bottom-left' }, { on: 'game-over', text: 'TIME!' }] } };
    const score = extractEngineScore(sketch(), payload);
    expect(score.hud).toEqual([
      { kind: 'readout', var: 'hp', label: 'hp', slot: 'bottom-left', as: 'bar', max: 100 },
      { kind: 'banner', on: 'game-over', text: 'TIME!', slot: 'center', ttl: 2 },
    ]);
    expect(score.ledger.hud_declared.count).toBe(2);
    const bare = extractEngineScore(sketch(), { faces: [] });
    expect(bare.hud).toBeUndefined();
    expect(bare.ledger.hud_declared).toBeUndefined();
  });
});
