// The character-from-dream machine gate: a figure may claim dream-reconstruction
// provenance ONLY with a well-formed attestation that an image worker was
// actually invoked. This is the fix for the process failure where an agent
// skips the dream and reconstructs from imagination (dream-audit.js).
import { describe, expect, it } from 'vitest';

import { validateDreamAudit, normalizeDreamAudit, DREAM_PROVENANCE_KIND } from './dream-audit.js';

const GOOD_LOCAL = {
  source: 'local:comfyui@127.0.0.1:8188',
  invoked_generator: true,
  prompt: 'a male wizard in a green hooded cloak, character design sheet',
  job_id: 'dfda73cf-3b0f-4f2d-b286-42881b2a4a41',
  notes: 'dream dictated teal not forest-green; closed cape; hood unreachable',
};
const GOOD_NATIVE = {
  source: 'native',
  invoked_generator: true,
  prompt: 'exploded garment pieces for a courier with an oversized hood',
  seed: 74123,
};

describe('dream-audit gate', () => {
  it('accepts a well-formed local-worker attestation and stamps provenance', () => {
    expect(validateDreamAudit(GOOD_LOCAL)).toEqual([]);
    const p = normalizeDreamAudit(GOOD_LOCAL);
    expect(p.kind).toBe(DREAM_PROVENANCE_KIND);
    expect(p.source).toBe('local:comfyui@127.0.0.1:8188');
    expect(p.invoked_generator).toBe(true);
    expect(p.job_id).toBe('dfda73cf-3b0f-4f2d-b286-42881b2a4a41');
    expect(p.notes).toMatch(/teal/);
  });

  it('accepts a native (own image gen) attestation with a seed', () => {
    expect(validateDreamAudit(GOOD_NATIVE)).toEqual([]);
    expect(normalizeDreamAudit(GOOD_NATIVE).source).toBe('native');
  });

  it('REFUSES invoked_generator ≠ true — the core gate (imagined ≠ dreamed)', () => {
    const errs = validateDreamAudit({ ...GOOD_LOCAL, invoked_generator: false });
    expect(errs.some((e) => /invoked_generator/.test(e))).toBe(true);
    expect(() => normalizeDreamAudit({ ...GOOD_LOCAL, invoked_generator: false })).toThrow(/invoked_generator/);
  });

  it('REFUSES a missing invoked_generator (silent skip)', () => {
    const { invoked_generator, ...noAttest } = GOOD_NATIVE;
    expect(validateDreamAudit(noAttest).some((e) => /invoked_generator/.test(e))).toBe(true);
  });

  it('REFUSES a bad source (not native / local:*)', () => {
    expect(validateDreamAudit({ ...GOOD_NATIVE, source: 'imagination' }).some((e) => /source/.test(e))).toBe(true);
    expect(validateDreamAudit({ ...GOOD_NATIVE, source: 'cloud' }).some((e) => /source/.test(e))).toBe(true);
  });

  it('REFUSES a missing/too-short prompt', () => {
    expect(validateDreamAudit({ ...GOOD_NATIVE, prompt: 'wiz' }).some((e) => /prompt/.test(e))).toBe(true);
    const { prompt, ...noPrompt } = GOOD_NATIVE;
    expect(validateDreamAudit(noPrompt).some((e) => /prompt/.test(e))).toBe(true);
  });

  it('REFUSES when no generation identifier is present', () => {
    const { seed, ...noId } = GOOD_NATIVE;
    expect(validateDreamAudit(noId).some((e) => /job_id|image_sha256|seed|token/.test(e))).toBe(true);
  });

  it('REFUSES a non-object audit', () => {
    expect(validateDreamAudit(null).length).toBe(1);
    expect(validateDreamAudit('yes I dreamed it').length).toBe(1);
  });
});
