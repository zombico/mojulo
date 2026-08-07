import { describe, expect, it } from 'vitest';

import {
  KIND_VOICE_REGISTER,
  VOICE_BANKS,
  normalizeVoiceRegister,
  resolveVoiceRegister,
  suggestedSpeed,
  validateVoiceRegister,
} from './voice-register.js';

// ── DETERMINISM CONTRACT (voice-worker.plan.md → doctrine) ──────────────────
// A voice register's value rests on one property: same manifest → same blend
// weights → same waveform out of the worker. There is no seed because there
// is nothing random — the resolution is a lerp, and these tests pin it.

describe('resolveVoiceRegister', () => {
  it('is a pure lerp: confidence interpolates meek → authority', () => {
    const meekOnly = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 0 } });
    expect(meekOnly.weights).toEqual({ jf_nezumi: 1 });
    expect(meekOnly.voiceArg).toBe('jf_nezumi');

    const authorityOnly = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 1 } });
    expect(authorityOnly.weights).toEqual({ jf_alpha: 1 });

    const mid = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 0.5 } });
    expect(mid.weights.jf_nezumi).toBeCloseTo(0.5, 4);
    expect(mid.weights.jf_alpha).toBeCloseTo(0.5, 4);
  });

  it('depth blends in the anchor, bounded by the bank ceiling', () => {
    const full = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 1, depth: 1 } });
    expect(full.weights.jm_kumo).toBeCloseTo(VOICE_BANKS['jp-female'].depth.ceiling, 4);
    expect(full.weights.jf_alpha).toBeCloseTo(1 - VOICE_BANKS['jp-female'].depth.ceiling, 4);

    const half = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 1, depth: 0.5 } });
    expect(half.weights.jm_kumo).toBeCloseTo(0.15, 4);
  });

  it('weights sum to ~1 and the voiceArg ordering is stable', () => {
    const r = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 0.7, depth: 0.4 } });
    const sum = Object.values(r.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.999);
    expect(sum).toBeLessThan(1.001);
    // Descending weight order, so equal manifests always print equal strings.
    expect(r.voiceArg).toBe(
      Object.entries(r.weights).map(([id, w]) => `${id}:${w}`).join(','),
    );
    const again = resolveVoiceRegister({ bank: 'jp-female', axes: { confidence: 0.7, depth: 0.4 } });
    expect(again.voiceArg).toBe(r.voiceArg);
  });

  it('manifest pole overrides ARE the calibration workflow', () => {
    const r = resolveVoiceRegister({
      bank: 'jp-female',
      poles: { meek: 'jf_tebukuro' },
      axes: { confidence: 0 },
    });
    expect(r.weights).toEqual({ jf_tebukuro: 1 });
  });

  it('merges duplicate ids when a pole doubles as the depth anchor', () => {
    const r = resolveVoiceRegister({
      bank: 'jp-female',
      poles: { meek: 'jm_kumo', authority: 'jm_kumo' },
      axes: { confidence: 0.5, depth: 1 },
    });
    expect(r.weights).toEqual({ jm_kumo: 1 });
    expect(r.voiceArg).toBe('jm_kumo');
  });
});

describe('normalizeVoiceRegister', () => {
  it('defaults: jp-female bank, centered confidence, zero depth, derived speed', () => {
    const m = normalizeVoiceRegister({});
    expect(m.kind).toBe(KIND_VOICE_REGISTER);
    expect(m.bank).toBe('jp-female');
    expect(m.language).toBe('ja');
    expect(m.axes).toEqual({ confidence: 0.5, depth: 0 });
    expect(m.speed).toBe(suggestedSpeed(0.5));
  });

  it('clamps axes into [0,1] and rejects nonsense speed', () => {
    const m = normalizeVoiceRegister({ axes: { confidence: 7, depth: -3 } });
    expect(m.axes).toEqual({ confidence: 1, depth: 0 });
    expect(() => normalizeVoiceRegister({ speed: -1 })).toThrow(/invalid speed/);
  });

  it('explicit speed wins over the confidence coupling', () => {
    expect(normalizeVoiceRegister({ axes: { confidence: 0 }, speed: 1.2 }).speed).toBe(1.2);
  });

  it('rejects unknown banks with the bank list', () => {
    const v = validateVoiceRegister({ bank: 'en-female' });
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/unknown voice bank 'en-female'/);
  });
});

describe('suggestedSpeed', () => {
  it('meek reads slower than authoritative, inside the usable band', () => {
    expect(suggestedSpeed(0)).toBe(0.9);
    expect(suggestedSpeed(1)).toBe(1.03);
    expect(suggestedSpeed(0)).toBeLessThan(suggestedSpeed(1));
  });
});
