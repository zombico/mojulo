// The 7G anime head's drawings (anime-drawings.js) on the studio's construction (anime-form.js `drawing`), on the default
// anime hero's head. The concepts: every drawing is named whole (a layer, a phrase, its words or channels, the face it
// lowers to); no drawing, or a neutral one, is the head byte for byte; each drawing keeps the head's topology, moves only
// its own layer's parts and region, and folds no face; layers that share no vertex add exactly. And the head in a socket
// (sculpt `orbit`): none at 0; the eye set back between the brow and the cheekbone, the nose and the chin kept; the
// pyramid nose (sculpt `noseShape`) its bridge raised from the eye's line, its tip no further out; the drawings as whole
// on them.
import { describe, it, expect } from 'vitest';
import { DRAWINGS, DRAWING_LAYERS, DRAWING_REST, drawingErrors, drawingWordErrors, drawingWords, lowerFace } from './anime-drawings.js';
import { animeHead } from './anime-head.js';
import { X, build, pts, checkDrawing, socketed } from './anime-drawings.fixture.js';
import { sculptBuild, resolveAnimeSculpt, validateAnimeSculpt } from './anime-sculpt.js';
import { compileLayered } from './station-loft.js';

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

describe('the head in a socket (sculpt orbit), and its pyramid nose (sculpt noseShape)', () => {
  const head = (sculpt) => { const h = animeHead({ preset: 'male', hair: 'none', hairFit: false, ...(sculpt ? { sculpt } : {}) }); return compileLayered({ parts: h.parts, dials: {}, creases: {} }); };
  const of = (m, part) => m.vertices.filter((_, i) => m.provenance[i].part === part);
  it('none at 0: the head byte for byte', () => {
    expect(sculptBuild('male', resolveAnimeSculpt({ orbit: 0 }))).not.toHaveProperty('orbit');
    expect(animeHead({ preset: 'male', hair: 'none', hairFit: false, sculpt: { orbit: 0 } })).toEqual(animeHead({ preset: 'male', hair: 'none', hairFit: false }));
  });
  it('sets the eye back between the brow and the cheekbone, the nose and the chin kept', () => {
    const A = head(null), B = head({ orbit: 0.02 }), mean = (P, k) => P.reduce((t, p) => t + p[k], 0) / P.length;
    // (front is +y: the iris sits back in its socket by most of the depth, 0.02 of the head's height)
    const H = Math.max(...of(A, 'face').map((p) => p[2])) - Math.min(...of(A, 'face').map((p) => p[2]));
    expect(mean(of(A, 'irisL'), 1) - mean(of(B, 'irisL'), 1)).toBeGreaterThan(0.012 * H);
    for (const [k, f] of [[1, Math.max], [2, Math.min], [2, Math.max]]) expect(f(...of(B, 'face').map((p) => p[k]))).toBeCloseTo(f(...of(A, 'face').map((p) => p[k])), 9);
    // (its rings follow the socket: more of them about each eye, the parts laid on it unchanged in count)
    expect(of(B, 'face').length).toBeGreaterThan(of(A, 'face').length); expect(of(B, 'browL').length).toBe(of(A, 'browL').length);
  });
  it('the pyramid nose: its bridge raised from the eye\'s line, its tip no further out than the round one\'s; the round one adds nothing', () => {
    expect(validateAnimeSculpt({ noseShape: 'hook' })[0]).toMatch(/noseShape: one of round, pyramid/);
    expect(sculptBuild('male', resolveAnimeSculpt({ noseShape: 'round' }))).toEqual(sculptBuild('male', resolveAnimeSculpt({})));
    // (the same face, its points moved: the centre line's point halfway from the eye's level down to the tip)
    const A = head(null), B = head({ noseShape: 'pyramid' }), FA = of(A, 'face'), FB = of(B, 'face');
    const H = Math.max(...FA.map((p) => p[2])) - Math.min(...FA.map((p) => p[2])), tip = FA.reduce((a, p) => (p[1] > a[1] ? p : a)), eye = of(A, 'irisL').reduce((t, p) => t + p[2], 0) / of(A, 'irisL').length;
    const mid = FA.map((p, i) => [p, i]).filter(([p]) => Math.abs(p[0]) < 1e-4 && p[1] > tip[1] - 0.05).reduce((a, b) => (Math.abs(b[0][2] - (eye + tip[2]) / 2) < Math.abs(a[0][2] - (eye + tip[2]) / 2) ? b : a))[1];
    expect(FB[mid][1] - FA[mid][1]).toBeGreaterThan(0.002 * H);
    expect(Math.max(...FB.map((p) => p[1]))).toBeLessThanOrEqual(tip[1] + 0.002 * H);
    // (the chin and the crown kept, to the micrometre: the pin's frame moves with the face's front and each offset rounds anew)
    for (const [k, f] of [[2, Math.min], [2, Math.max]]) expect(f(...FB.map((p) => p[k]))).toBeCloseTo(f(...FA.map((p) => p[k])), 6);
  });
  it('keeps every layer\'s drawing whole on it (under the pyramid nose too)', () => {
    for (const name of ['brows.angry', 'lids.angry', 'gaze.right', 'mouth.a']) socketed.checkDrawing(`socketed ${name}`, DRAWINGS[name].layer, DRAWINGS[name].words);
  });
}, 120000);
