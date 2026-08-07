// Keyframe meru audit — the deterministic scale/position gate extracted from
// composite-keys.mjs. Synthetic RGBA figures (a solid head-band column over a
// body block) exercise compliance, ground violation, and whole-cel heal without
// depending on any painted fixture.
import { describe, it, expect } from 'vitest';
import { auditCel, auditFaceHold } from './keyframe-audit.js';

const CANVAS = { width: 120, height: 400 };
// A canonical unit spanning y=40 (crown) .. y=360 (ground), span 320.
const CANONICAL = { crown: 40, ground: 360, span: 320 };

// Paint a filled figure: a wide head band (so findHeadTop sees a sustained
// head-sized row run) from `top`, down to `bottom`. Column is centred.
function paintFigure({ top, bottom, width = 100 }) {
  const { width: w, height: h } = CANVAS;
  const buf = new Uint8ClampedArray(w * h * 4);
  const x0 = Math.floor((w - width) / 2);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      const i = (y * w + x) * 4;
      buf[i] = 20; buf[i + 1] = 20; buf[i + 2] = 20; buf[i + 3] = 255;
    }
  }
  return buf;
}

describe('auditCel', () => {
  it('passes a figure that already fills the unit (head-to-sole = span)', () => {
    const rgba = paintFigure({ top: 40, bottom: 360 });
    const r = auditCel(rgba, { canvas: CANVAS, canonical: CANONICAL });
    expect(r.compliant).toBe(true);
    expect(r.normalized).toBe(false);
    expect(r.healed).toBeNull();
    expect(Math.abs(r.heightRatio - 1)).toBeLessThan(0.06);
  });

  it('heals a scale violation (oversized figure) onto the unit', () => {
    // 1.25× the unit: head-to-sole span 400 vs 320, soles below ground.
    const rgba = paintFigure({ top: 20, bottom: 380 });
    const r = auditCel(rgba, { canvas: CANVAS, canonical: CANONICAL });
    expect(r.normalized).toBe(true);
    expect(r.healed).not.toBeNull();
    // After the whole-cel similarity heal it sits within the unit.
    expect(r.compliant).toBe(true);
    expect(Math.abs(r.heightRatio - 1)).toBeLessThan(0.06);
  });

  it('leaves retry null once a figure is compliant', () => {
    const rgba = paintFigure({ top: 40, bottom: 360 });
    const r = auditCel(rgba, { canvas: CANVAS, canonical: CANONICAL });
    expect(r.compliant).toBe(true);
    expect(r.retry).toBeNull();
  });

  it('a healed scale violation still ends compliant with no retry note', () => {
    const rgba = paintFigure({ top: 20, bottom: 380 });
    const r = auditCel(rgba, { canvas: CANVAS, canonical: CANONICAL });
    expect(r.normalized).toBe(true);
    expect(r.compliant).toBe(true);
    expect(r.retry).toBeNull();
  });
});

// The HELD-REGION gate for face variants: outside the head band the variant
// must match the base cel ("only the face changes" as a machine number — the
// deviation GPT's talking-phone run measured at up to ~50%).
describe('auditFaceHold', () => {
  const ctx = { canvas: CANVAS, canonical: CANONICAL };

  it('an identical cel holds perfectly', () => {
    const base = paintFigure({ top: 40, bottom: 360 });
    const r = auditFaceHold(paintFigure({ top: 40, bottom: 360 }), base, ctx);
    expect(r.holdFrac).toBe(0);
    expect(r.compliant).toBe(true);
    expect(r.retry).toBeNull();
  });

  it('a change confined to the face band still holds', () => {
    const base = paintFigure({ top: 40, bottom: 360 });
    const variant = paintFigure({ top: 40, bottom: 360 });
    // recolor rows inside the head band (headTop=40, face region ≈ 40..117)
    for (let y = 45; y < 100; y += 1) {
      for (let x = 0; x < CANVAS.width; x += 1) {
        const i = (y * CANVAS.width + x) * 4;
        if (variant[i + 3] > 28) { variant[i] = 250; variant[i + 1] = 250; variant[i + 2] = 250; }
      }
    }
    const r = auditFaceHold(variant, base, ctx);
    expect(r.holdFrac).toBe(0);
    expect(r.compliant).toBe(true);
  });

  it('wholesale drift below the face fails with the deterministic fraction', () => {
    const base = paintFigure({ top: 40, bottom: 360 });
    const variant = paintFigure({ top: 40, bottom: 360 });
    // repaint the whole body below the face band — the GPT failure mode
    for (let y = 150; y <= 360; y += 1) {
      for (let x = 0; x < CANVAS.width; x += 1) {
        const i = (y * CANVAS.width + x) * 4;
        if (variant[i + 3] > 28) { variant[i] = 250; variant[i + 1] = 120; variant[i + 2] = 40; }
      }
    }
    const r = auditFaceHold(variant, base, ctx);
    expect(r.holdFrac).toBeGreaterThan(0.35);
    expect(r.compliant).toBe(false);
    expect(r.retry).toMatch(/OUTSIDE the face changed/);
  });
});
