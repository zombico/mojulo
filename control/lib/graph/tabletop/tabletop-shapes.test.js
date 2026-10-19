import { describe, it, expect } from 'vitest';
import { SHAPES, shapeOf, shapeFaces, shapeIcon } from './tabletop-shapes.js';
import { pieceBodies } from './tabletop-bodies.js';
import { resolveTabletop } from './tabletop-manifest.js';
import { CHESS } from './games/chess.js';

// One shape per form, chosen from the shelf by its form (the concept, not the catalogue).
const ofForm = (form) => Object.keys(SHAPES).find((k) => SHAPES[k].form === form);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centre = (f) => [0, 1, 2].map((i) => f.c0[i] + f.u[i] / 2 + f.v[i] / 2);

describe('meeple shapes: a piece given a body', () => {
  it('a cut-out: a face front and back drawn to its outline, a side panel for every edge, each facing out', () => {
    const name = ofForm('extrude'), S = SHAPES[name], faces = shapeFaces(name);
    expect(faces).toHaveLength(S.profile.length + 2);
    const [front, back, ...sides] = faces;
    expect(front.clip).toMatch(/^polygon\(/);
    expect(front.normal).toEqual([0, -1, 0]);
    expect(back.normal).toEqual([0, 1, 0]);
    // each side a plain rectangle, facing away from the cut-out's middle
    const mid = [0, 0, Math.max(...S.profile.map((p) => p[1])) / 2];
    for (const f of sides) {
      expect(f.clip).toBeUndefined();
      const c = centre(f);
      expect(dot(f.normal, [c[0] - mid[0], 0, c[2] - mid[2]])).toBeGreaterThan(-1e-9);
    }
  });

  it('a turned piece: bands round its axis facing out, unmasked, its flat top one polygon', () => {
    const name = 'rook', faces = shapeFaces(name);
    const bands = faces.filter((f) => Math.abs(f.normal[2]) < 0.99);
    expect(bands.every((f) => !f.clip)).toBe(true);
    for (const f of bands) {
      const c = centre(f);
      expect(dot(f.normal, [c[0], c[1], 0])).toBeGreaterThan(0);
    }
    // a cap that closes at the axis is one panel, not a fan
    const disc = shapeFaces(ofForm('lathe') === 'disc' ? 'disc' : { form: 'lathe', sides: 10, profile: [[0.3, 0], [0.3, 0.1], [0, 0.1]] });
    expect(disc.filter((f) => f.normal[2] > 0.99)).toHaveLength(1);
    // a whole chess set stays cheap: a handful of masks, not one per band
    const set = { king: 1, queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 };
    const masked = Object.entries(set).reduce((n, [k, m]) => n + m * shapeFaces(k).filter((f) => f.clip).length, 0);
    expect(masked).toBeLessThan(30);
  });

  it('a box has five sides (it stands on its base); a group places its parts', () => {
    expect(shapeFaces(ofForm('box'))).toHaveLength(5);
    const king = SHAPES.king, cross = shapeFaces(king.parts[1].shape), placed = shapeFaces('king').slice(-cross.length);
    expect(placed[0].c0[2]).toBeCloseTo(cross[0].c0[2] + king.parts[1].at[2], 6);
  });

  it('the plan\'s silhouette: a turned piece its profile mirrored, a cut-out its outline', () => {
    const [pawn] = shapeIcon('pawn');
    expect(pawn).toHaveLength(SHAPES.pawn.profile.length * 2);
    for (const [x, z] of pawn) expect(pawn.some(([x2, z2]) => Math.abs(x2 + x) < 1e-9 && Math.abs(z2 - z) < 1e-9)).toBe(true);
    expect(shapeIcon('meeple')).toEqual([SHAPES.meeple.profile]);
  });

  it('a shape written out is checked; a name off the shelf is refused with the shelf', () => {
    expect(shapeOf({ form: 'box', size: [0.2, 0.2, 0.4] }).form).toBe('box');
    expect(() => shapeOf('dragon')).toThrow(/no shape 'dragon'.*meeple/);
    expect(() => shapeOf({ form: 'extrude', profile: [[0, 0], [1, 0]], depth: 0.1 })).toThrow(/3 or more/);
    expect(() => resolveTabletop({ game: { ...CHESS, pieces: { ...CHESS.pieces, K: { ...CHESS.pieces.K, shape: 'dragon' } } } })).toThrow(/piece K: shape: no shape 'dragon'/);
  });

  it('bodies for a page: every shaped kind, the same bytes twice', () => {
    const a = pieceBodies(CHESS, { cell: 1, unit: 60 });
    expect(Object.keys(a.bodies).sort()).toEqual(['B', 'K', 'N', 'P', 'Q', 'R']);
    expect(a.bodies.P[0].t).toMatch(/^matrix3d\(/);
    expect(a.bodies.P.every((f) => f.k > 0)).toBe(true);
    expect(JSON.stringify(pieceBodies(CHESS, { cell: 1, unit: 60 }))).toBe(JSON.stringify(a));
    expect(pieceBodies({ pieces: { X: { rules: [] } } }, { cell: 1, unit: 60 }).bodies).toEqual({});
  });
});
