import { describe, expect, it } from 'vitest';
import {
  renderMaterializeFrames,
  renderTransfigureFrames,
  MATERIALIZE_CLASS_NAMES,
  TRANSFIGURE_CLASS_NAMES,
} from './carved-motion.js';

const SQUARE = { path: 'M -0.5 -0.5 L 0.5 -0.5 L 0.5 0.5 L -0.5 0.5 Z' };
const TRIANGLE = { path: 'M 0 -0.5 L 0.5 0.5 L -0.5 0.5 Z' };

const isSvg = (s) => typeof s === 'string' && s.startsWith('<svg') && s.trimEnd().endsWith('</svg>');
const hasSkin = (s) => s.includes('fill-rule="evenodd"');     // only emitted by extruded skin caps
const hasWire = (s) => s.includes('filter="url(#cm-glow)"');  // only emitted by wireSvg when drawn

describe('renderMaterializeFrames (presence: ∅ ⇄ form)', () => {
  it('ping-pongs N forward frames into 2N-2 valid SVG frames with the carve viewBox', () => {
    const N = 8;
    const { frameSvgs, viewBox } = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram' }, N);
    expect(frameSvgs).toHaveLength(2 * N - 2);
    expect(frameSvgs.every(isSvg)).toBe(true);
    expect(viewBox).toEqual([0, 0, 960, 540]);
  });

  it('starts from nothing — the first frame draws neither skin nor wire', () => {
    const { frameSvgs } = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram' }, 8);
    expect(hasSkin(frameSvgs[0])).toBe(false);
    expect(hasWire(frameSvgs[0])).toBe(false);
  });

  it('crossfades wire into skin — a mid frame carries both', () => {
    const { frameSvgs } = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram' }, 8);
    const mid = frameSvgs[4]; // phase ≈ 0.57: wire nearly full, skin coming in
    expect(hasWire(mid)).toBe(true);
    expect(hasSkin(mid)).toBe(true);
  });

  it('is deterministic — same input renders byte-identical frames', () => {
    const a = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram' }, 6);
    const b = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram' }, 6);
    expect(a.frameSvgs).toEqual(b.frameSvgs);
  });

  it('honors the material — gold and steel shade differently', () => {
    const gold = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram', material: 'gold' }, 4);
    const steel = renderMaterializeFrames({ shape: SQUARE, klass: 'hologram', material: 'steel' }, 4);
    expect(gold.frameSvgs).not.toEqual(steel.frameSvgs);
  });

  it('renders every materialize class: hologram, doom platform, transporter particles', () => {
    expect(MATERIALIZE_CLASS_NAMES).toEqual(['hologram', 'doom', 'transporter']);

    const doom = renderMaterializeFrames({ shape: SQUARE, klass: 'doom' }, 8);
    expect(doom.frameSvgs).toHaveLength(14);
    expect(doom.frameSvgs.some((s) => s.includes('class="cm-scan-plane"'))).toBe(true);
    expect(doom.frameSvgs.some((s) => hasSkin(s))).toBe(true);

    const transporter = renderMaterializeFrames({ shape: SQUARE, klass: 'transporter' }, 8);
    expect(transporter.frameSvgs).toHaveLength(14);
    expect(transporter.frameSvgs.some((s) => s.includes('class="cm-particles"'))).toBe(true);
    expect(transporter.frameSvgs.some((s) => hasSkin(s))).toBe(true);
  });
});

describe('renderTransfigureFrames (identity: form A ⇄ form B)', () => {
  it('produces valid ping-ponged frames over a from→to pair', () => {
    const N = 8;
    const { frameSvgs, viewBox } = renderTransfigureFrames({ from: TRIANGLE, to: SQUARE }, N);
    expect(frameSvgs).toHaveLength(2 * N - 2);
    expect(frameSvgs.every(isSvg)).toBe(true);
    expect(viewBox).toEqual([0, 0, 960, 540]);
  });

  it('endpoints are solid, the morph middle is wireframe-only', () => {
    const { frameSvgs } = renderTransfigureFrames({ from: TRIANGLE, to: SQUARE }, 8);
    expect(hasSkin(frameSvgs[0])).toBe(true);   // phase 0 — form A solid
    const mid = frameSvgs[4];                   // phase ≈ 0.57 — between deskin & reskin
    expect(hasSkin(mid)).toBe(false);
    expect(hasWire(mid)).toBe(true);
  });

  it('liquid-metal reskins the carved solid in chrome — same geometry, no wire', () => {
    const { frameSvgs } = renderTransfigureFrames({ from: TRIANGLE, to: SQUARE, klass: 'liquid-metal', material: 'gold' }, 8);
    const mid = frameSvgs[4];
    expect(mid).toContain('class="cm-liquid-metal"'); // the chrome layer
    expect(hasSkin(mid)).toBe(true);                   // it IS the carved skin, reskinned chrome
    expect(hasWire(mid)).toBe(false);                  // no wireframe in liquid-metal
    expect(frameSvgs.every(isSvg)).toBe(true);
  });

  it('liquid-metal carrier render is deterministic', () => {
    const a = renderTransfigureFrames({
      from: TRIANGLE, to: SQUARE, klass: 'liquid-metal',
      liquid: { carrier: '#a7f3d0' },
    }, 8);
    const b = renderTransfigureFrames({
      from: TRIANGLE, to: SQUARE, klass: 'liquid-metal',
      liquid: { carrier: '#a7f3d0' },
    }, 8);
    expect(a.frameSvgs).toEqual(b.frameSvgs);
    expect(a.frameSvgs[4]).toContain('class="cm-liquid-metal"');
    expect(hasWire(a.frameSvgs[4])).toBe(false);
  });

  it('is deterministic', () => {
    const a = renderTransfigureFrames({ from: TRIANGLE, to: SQUARE }, 6);
    const b = renderTransfigureFrames({ from: TRIANGLE, to: SQUARE }, 6);
    expect(a.frameSvgs).toEqual(b.frameSvgs);
  });

  it('rejects unknown / unrenderable classes', () => {
    expect(() => renderTransfigureFrames({ from: TRIANGLE, to: SQUARE, klass: 'nope' }, 4)).toThrow(/unknown transfigure class/);
    expect(TRANSFIGURE_CLASS_NAMES).toEqual(['galvatron', 'liquid-metal']);
  });
});
