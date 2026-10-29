// The 7G anime head's drawings (anime-drawings.js) on the studio's construction (anime-form.js `drawing`), on the default
// anime hero's head. The concepts: every drawing is named whole (a layer, a phrase, its words or channels, the face it
// lowers to); no drawing, or a neutral one, is the head byte for byte; each drawing keeps the head's topology, moves only
// its own layer's parts and region, and folds no face; layers that share no vertex add exactly.
import { describe, it, expect } from 'vitest';
import { DRAWINGS, DRAWING_LAYERS, DRAWING_REST, drawingErrors, drawingWordErrors, drawingWords, lowerFace } from './anime-drawings.js';
import { animeHead } from './anime-head.js';
import { X, build, pts, checkDrawing } from './anime-drawings.fixture.js';

const drawn = Object.entries(DRAWINGS).filter(([, D]) => D.words);

describe('the drawings, named', () => {
  it('each whole: its layer, a phrase, its words or channels, the face it lowers to', () => {
    for (const name of Object.keys(DRAWINGS)) expect(drawingErrors(name), name).toEqual([]);
    for (const L of DRAWING_LAYERS) expect(DRAWINGS[DRAWING_REST[L]].layer).toBe(L);
    expect(lowerFace({})).toEqual({ blink: 0, smile: 0, open: 0, brow: 0 });
    expect(lowerFace({ brows: 'brows.angry', mouth: 'mouth.a' })).toEqual({ blink: 0, smile: 0, open: 0.8, brow: 1 });
    // (no lowered face opens the mouth past 0.85: the studio's own open folds past 0.9)
    expect(Math.max(...Object.values(DRAWINGS).map((D) => (D.channels ?? D.lower).open ?? 0))).toBeLessThanOrEqual(0.85);
    expect(drawingWords({ brows: 'brows.angry', lids: 'lids.angry', mouth: 'mouth.shout' })).toEqual({ brow: { knit: 1 }, lid: { inner: 0.55 }, mouth: { up: 0.8, down: 0.85, box: 0.6 } });
    expect(() => drawingWords({ brows: 'mouth.a' })).toThrow(/not a brows drawing/);
  });
  it('refused by name: a word out of range or unknown, and a drawing on the studio\'s own face', () => {
    expect(drawingWordErrors({ mouth: { down: 1 } })[0]).toMatch(/drawing\.mouth\.down: a number in \[0, 0\.85\]/);
    expect(drawingWordErrors({ grin: 1 })[0]).toMatch(/not a drawing word/);
    expect(drawingErrors('mouth.yell')[0]).toMatch(/unknown drawing/);
    expect(() => animeHead({ preset: 'male', hair: 'none', hairFit: false, sculpt: false, drawing: { brow: { knit: 1 } } })).toThrow(/graphic face/);
  });
});

describe('the drawings, built', () => {
  const N = build();
  it('none, or a neutral one, is the head byte for byte', () => {
    expect(build({})).toEqual(N);
    expect(build({ mouth: { wide: 1, corner: 0 }, pupil: 1, gaze: { x: 0 } })).toEqual(N);
  });
  it('each word\'s drawing keeps the topology, moves only its layer, and folds no face', () => {
    // (one drawing per word, the first the catalog draws it with: each word is its own procedure; every drawing and each
    // word's range ends are the deep sweep's, anime-drawings.deep.test.js)
    const wordsOf = (W) => Object.entries(W).flatMap(([k, v]) => (typeof v === 'object' ? Object.keys(v).map((q) => `${k}.${q}`) : [k]));
    const seen = new Set();
    for (const [name, D] of drawn) { const fresh = wordsOf(D.words).filter((w) => !seen.has(w)); if (!fresh.length) continue; fresh.forEach((w) => seen.add(w)); checkDrawing(name, D.layer, D.words); }
    expect(seen.size).toBeGreaterThan(12);
  });
  it('adds exactly across the layers that share no vertex, and nearly where the blink and the smile reach in', () => {
    const sum = (...B) => { const out = {}; for (const n of X) { const P = B.map((b) => pts(b[n])); out[n] = pts(N[n]).map((p, i) => p.map((x, c) => P.reduce((s, q) => s + q[i][c] - x, x))); } return out; };
    const err = (A, S) => Math.max(...X.flatMap((n) => pts(A[n]).map((p, i) => Math.hypot(...p.map((x, c) => x - S[n][i][c])))));
    const W = (n) => DRAWINGS[n].words, pair = (a, b, E = {}) => err(build({ ...a, ...b }, E), sum(build(a), build(b), ...(Object.keys(E).length ? [build(null, E)] : [])));
    for (const [a, b] of [['brows.angry', 'lids.angry'], ['brows.worried', 'mouth.a'], ['lids.sad', 'mouth.shout'], ['gaze.left', 'mouth.o'], ['gaze.up', 'brows.raised']]) expect(pair(W(a), W(b)), `${a} × ${b}`).toBeLessThan(1e-6);
    // (the brow block rides up as the lids shut; the smile widens the vowel's outline: within a tenth and half a millimetre)
    expect(err(build(W('brows.angry'), { blink: 1 }), sum(build(W('brows.angry')), build(null, { blink: 1 })))).toBeLessThan(1e-4);
    expect(err(build(W('mouth.a'), { smile: 1 }), sum(build(W('mouth.a')), build(null, { smile: 1 })))).toBeLessThan(1e-3);
    // (the lenses do not add: the lids clip them; measured 6 mm, so the gaze is drawn at positions and a lid's shape over a
    // turned gaze takes a corrective)
    expect(pair(W('lids.angry'), W('gaze.right'))).toBeGreaterThan(1e-3);
  });
}, 120000);
