import { describe, it, expect } from 'vitest';

import {
  resolveTurntable, isTurnable, stripSize, stripEndPercent, stripStyleVars,
  TURNTABLE_FRAMES, TURNTABLE_CELL, TURNTABLE_REST_FRAME, TURNTABLE_FPS,
} from '@/lib/graph/sketch/turntable-strip';

describe('resolveTurntable', () => {
  it('turns a walkable world, and points the strip at the bake route', () => {
    const r = resolveTurntable({ manifest: { kind: 'fractal-city' }, ref: 'sk_a' });
    expect(r.turns).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.strip).toBe('/api/sketches/sk_a/turntable.png');
    expect(r.still).toBe('/api/sketches/sk_a/png?inline=1&scale=1');
  });

  it('turns the orbit-only object kinds too — a workbench is exactly what should turn', () => {
    for (const kind of ['workbench', 'assembler', 'molecule-view', 'planetary']) {
      expect(resolveTurntable({ manifest: { kind }, ref: 'sk_b' }).turns).toBe(true);
    }
  });

  it('turns a /scene kind (css3d-turntable, subway-station) — both resolve a World payload to bake from', () => {
    for (const kind of ['css3d-turntable', 'subway-station']) {
      expect(resolveTurntable({ manifest: { kind }, ref: 'sk_c' }).turns).toBe(true);
    }
  });

  it('says a diagram is flat instead of pretending it has a ¾ view', () => {
    const r = resolveTurntable({ manifest: { title: 'a flow chart' }, ref: 'sk_d' });
    expect(r.turns).toBe(false);
    expect(r.reason).toBe('flat');
    expect(r.strip).toBeNull();
    // …but it still gets a picture: the cheap vector still, no Chromium involved.
    expect(r.still).toBe('/api/sketches/sk_d/svg?inline=1');
  });

  it('gives the SVG illustration kinds the same flat still', () => {
    for (const kind of ['image-outcome', 'sequential-art', 'cover', 'character-sheet']) {
      const r = resolveTurntable({ manifest: { kind }, ref: 'sk_e' });
      expect(r.turns).toBe(false);
      expect(r.still).toBe('/api/sketches/sk_e/svg?inline=1');
    }
  });

  it('reports no still at all for the kinds that are not looked at', () => {
    for (const kind of ['beats-ambient', 'beats-sfx', 'voice-register', 'game', 'motion-comic']) {
      const r = resolveTurntable({ manifest: { kind }, ref: 'sk_f' });
      expect(r.turns).toBe(false);
      expect(r.reason).toBe('noStill');
      expect(r.still).toBeNull();
    }
  });

  it('encodes the ref into every src', () => {
    const r = resolveTurntable({ manifest: { kind: 'fractal-city' }, ref: 'sk a/b' });
    expect(r.strip).toBe('/api/sketches/sk%20a%2Fb/turntable.png');
  });

  it('returns null without a manifest or a ref', () => {
    expect(resolveTurntable({ ref: 'sk_g' })).toBeNull();
    expect(resolveTurntable({ manifest: { kind: 'fractal-city' } })).toBeNull();
    expect(resolveTurntable()).toBeNull();
  });

  it('carries the playback contract: 16 frames at 6fps is a ~2.7s turn, not a 667ms whip', () => {
    const r = resolveTurntable({ manifest: { kind: 'fractal-city' }, ref: 'sk_h' });
    expect(r.frames).toBe(TURNTABLE_FRAMES);
    expect(r.frames).toBe(16);
    expect(r.fps).toBe(TURNTABLE_FPS);
    expect(r.durationMs).toBe(Math.round((TURNTABLE_FRAMES / TURNTABLE_FPS) * 1000));
    // A turntable is inspected, not flicked past: 6fps, ~2.7s per revolution.
    expect(r.fps).toBe(6);
    expect(r.durationMs).toBe(2667);
  });
});

describe('isTurnable', () => {
  it('agrees with resolveTurntable, and is safe on junk', () => {
    expect(isTurnable({ kind: 'fractal-city' })).toBe(true);
    expect(isTurnable({ kind: 'beats-ambient' })).toBe(false);
    expect(isTurnable(null)).toBe(false);
    expect(isTurnable('nope')).toBe(false);
  });
});

describe('strip geometry', () => {
  it('lays the frames out in one row', () => {
    expect(stripSize()).toEqual({ width: TURNTABLE_CELL.width * TURNTABLE_FRAMES, height: TURNTABLE_CELL.height });
    expect(stripSize(4, { width: 10, height: 20 })).toEqual({ width: 40, height: 20 });
  });

  it('ends past 100%, because 100% would land between cells', () => {
    // p% lands on frame p·(N−1)/100. Ending at 100% would put step k on frame
    // 15k/16 — a fraction of a cell for every k but 0. 100·N/(N−1) fixes it.
    expect(stripEndPercent(16)).toBeCloseTo(106.6667, 3);
    const end = stripEndPercent(16);
    for (let k = 0; k < 16; k++) {
      const p = (end * k) / 16;          // where steps(16) lands on step k
      expect((p * 15) / 100).toBeCloseTo(k, 9);   // …exactly frame k
    }
  });

  it('rests on frame 0 — the world its own authored camera framed', () => {
    expect(TURNTABLE_REST_FRAME).toBe(0);
    expect((stripEndPercent(16) * TURNTABLE_REST_FRAME) / 16).toBe(0);
  });

  it('hands the component the vars instead of the algebra', () => {
    expect(stripStyleVars({ frames: 16, durationMs: 667 })).toEqual({
      '--turn-frames': '16',
      '--turn-end': `${stripEndPercent(16)}%`,
      '--turn-duration': '667ms',
    });
  });
});
