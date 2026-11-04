// The lock's coat (hair-coat.js): a lock read along its own centre line, the beast's pattern read down it as down a tail,
// the cards valid in the beast's own words, a coated head carrying its locks' frames (and an uncoated one nothing), the
// paint mapping each coated lock onto its own rectangle, and paints composed face by face.
import { describe, expect, it } from 'vitest';

import { COAT_CARDS, COAT_CARD_NAMES, validateHairCoat, resolveHairCoat, lockCoatFrame, hairCoatPaint, composePaints, hairCoatsIn } from './hair-coat.js';
import { patternField } from '../beast/pattern.js';
import { animeHead, ANIME_HAIR_MOVES } from './anime-head.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';

describe('the coat words', () => {
  it("are the beast's own: every card is a valid coat, and a card's words lie under the coat's own", () => {
    for (const name of COAT_CARD_NAMES) expect(validateHairCoat(name), name).toEqual([]);
    const own = resolveHairCoat({ from: 'snake', color: '#335522', pattern: [] });
    expect(own).toMatchObject({ color: '#335522', cover: COAT_CARDS.snake.cover, pattern: [] });
    expect(resolveHairCoat('ember').color).toBe('#d8451c');
    expect(resolveHairCoat({ pattern: [{ kind: 'stripes' }] }).color).toBe('Hair');
  });

  it('refuses a coat whose words are wrong, at the shapes and at the hero door, naming where', () => {
    expect(validateHairCoat('python').join(' ')).toMatch(/coat card/);
    expect(validateHairCoat({ cover: 'bark' }).join(' ')).toMatch(/cover/);
    expect(validateHairCoat({ pattern: [{ kind: 'zigzag' }] }).join(' ')).toMatch(/pattern\[0\]\.kind/);
    const hair = { style: 'short', shapes: { layers: [{ shape: 'banana', coat: { pattern: [{ kind: 'stripes', period: 9 }] } }] } };
    expect(hairCoatsIn(hair).map(([, at]) => at)).toEqual(['hair.shapes.layers[0].coat']);
    expect(validateHeroSpec({ head: 'anime', hair }).join(' ')).toMatch(/hair\.shapes\.layers\[0\]\.coat\.pattern\[0\]\.period/);
  });
});

describe("a lock's frame", () => {
  // a straight lock up +z from the origin, a ring of points round it at radius 0.1, the head off to −x
  const line = [[0, 0, 0], [0, 0, 0.5], [0, 0, 1]];
  const ring = (z) => Array.from({ length: 8 }, (_, i) => [0.1 * Math.cos((i * Math.PI) / 4), 0.1 * Math.sin((i * Math.PI) / 4), z]);
  const points = [...ring(0.25), ...ring(0.75), [0, 0, 1]];

  it('runs root to tip along its line and round it from its outer face to the face toward the head, with no seam', () => {
    const F = lockCoatFrame(points, line, [-1, 0, 0.5]);
    expect(F.length).toBeCloseTo(1);
    expect(F.radius).toBeCloseTo(0.1);
    expect(F.uv[0]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.25, 6)]);          // +x: the face away from the head
    expect(F.uv[4][0]).toBeCloseTo(1);                                                   // −x: the face toward it
    expect(F.uv[2][0]).toBeCloseTo(0.5); expect(F.uv[6][0]).toBeCloseTo(0.5);           // the two sides, mirrored
    expect(F.uv[8][1]).toBeCloseTo(0.75);
    expect(F.uv[16]).toEqual([0.5, 1]);                                                  // the tip's apex
  });
});

describe('the pattern down a lock', () => {
  const S = (chain, D = 1) => ({ region: 'lock', D, theta: Math.acos(D) / Math.PI, z: 0, zt: 0, chain, s: chain * 0.5, across: 0, p: [0, chain * 0.5, 0] });

  it('darkens the tip and not the root (points), rings it along its length (stripes), lightens the side toward the head (countershade)', () => {
    const points = patternField([{ kind: 'points', color: '#000000', from: 0.7, soft: 0.05 }], { coat: '#ffffff' });
    expect(points(S(0.1))).toBeNull();
    expect(points(S(0.95))).toBe('#000000');
    const stripes = patternField([{ kind: 'stripes', color: '#000000', period: 0.05, width: 0.4, wobble: 0 }], { coat: '#ffffff' });
    const along = Array.from({ length: 40 }, (_, i) => stripes(S(i / 40)) !== null);
    expect(along.filter(Boolean).length).toBeGreaterThan(5);
    expect(along.filter((x) => !x).length).toBeGreaterThan(5);
    const shade = patternField([{ kind: 'countershade', color: '#ffffff', reach: 0.3, soft: 0.05 }], { coat: '#000000' });
    expect(shade(S(0.5, -1))).toBe('#ffffff');
    expect(shade(S(0.5, 1))).toBeNull();
  });
});

describe('a coated head', () => {
  it('carries each coated lock its frame, sized in metres by its span, and an uncoated head none', () => {
    const coated = animeHead({ preset: 'female', hair: ANIME_HAIR_MOVES.gorgon.hair });
    const locks = Object.entries(coated.parts).filter(([n]) => /^hair(Banana|Pepper|Carrot|Peel)\d/.test(n));
    expect(locks.length).toBeGreaterThan(10);
    for (const [n, P] of locks) {
      expect(P.coat, n).toBeTruthy();
      expect(Object.keys(P.coat.uv)).toEqual(Object.keys(P.offsets));
      expect(P.coat.length).toBeGreaterThan(P.coat.radius);
      expect(P.coat.span).toBeGreaterThan(0);
    }
    const { coat: _c, ...plainShapes } = ANIME_HAIR_MOVES.gorgon.hair.shapes;
    const plain = animeHead({ preset: 'female', hair: { ...ANIME_HAIR_MOVES.gorgon.hair, shapes: { ...plainShapes, layers: plainShapes.layers.map(({ coat: _x, ...L }) => L) } } });
    expect(Object.values(plain.parts).some((P) => P.coat)).toBe(false);
  }, 60_000);
});

describe('the paint', () => {
  // two coated locks and a plain part on a hand-made mesh: a quad each, ids as the hero's mesh carries them
  const coat = (spec) => ({ spec: resolveHairCoat(spec), uv: { v0: [0, 0], v1: [1, 0], v2: [1, 1], v3: [0, 1] }, length: 1, radius: 0.05, span: Math.hypot(0.1, 1) });
  const quad = (x) => [[x, 0, 0], [x + 0.1, 0, 0], [x + 0.1, 0, 1], [x, 0, 1]];
  const mesh = {
    vertices: [...quad(0), ...quad(1), ...quad(2)],
    pointIds: ['hairBanana0/v0', 'hairBanana0/v1', 'hairBanana0/v2', 'hairBanana0/v3', 'hairBanana1/v0', 'hairBanana1/v1', 'hairBanana1/v2', 'hairBanana1/v3', 'face/v0', 'face/v1', 'face/v2', 'face/v3'],
    faces: [[0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7], [8, 9, 10], [8, 10, 11]],
    parts: { hairBanana0: { group: 'Hair', coat: coat('snake') }, hairBanana1: { group: 'Hair', coat: coat('banded') }, face: { group: 'Skin' } },
  };

  it("maps each coated lock onto its own rectangle and paints only the locks' faces", () => {
    const P = hairCoatPaint(mesh, { palette: { Hair: '#4f6b3f' } });
    expect(P.key).toMatch(/^hairCoat-/);
    expect([0, 1, 2, 3, 4, 5].map((fi) => P.painted(fi))).toEqual([true, true, true, true, false, false]);
    P.painted(0); const a = P.uvAt({ vi: 2 }); P.painted(2); const b = P.uvAt({ vi: 6 });
    expect(a).not.toEqual(b);
    for (const t of [a, b]) for (const x of t) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); }
    expect(hairCoatPaint({ ...mesh, parts: { face: { group: 'Skin' } } }, {})).toBeNull();
  });

  it('composes paints face by face: the texture, the UVs and the light of the paint that owns the face', () => {
    const own = (key, set) => ({ key, url: `data:${key}`, painted: (fi) => set.has(fi), uvAt: () => [key.length, 0], light: () => key });
    const C = composePaints([own('face', new Set([1])), null, own('locks', new Set([2]))]);
    expect(C.textures).toEqual({ face: 'data:face', locks: 'data:locks' });
    expect(C.painted(2)).toBe(true); expect(C.key).toBe('locks'); expect(C.light('#000000')).toBe('locks');
    expect(C.painted(1)).toBe(true); expect(C.key).toBe('face');
    expect(C.painted(9)).toBe(false);
    const one = own('only', new Set());
    expect(composePaints([null, one])).toBe(one);
    expect(composePaints([null])).toBeNull();
  });
});
