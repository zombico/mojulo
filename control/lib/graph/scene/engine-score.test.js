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
