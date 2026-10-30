// The 7G anime head's drawings (anime-drawings.js) on the studio's construction (anime-form.js `drawing`), on the default
// anime hero's head. The concepts: every drawing is named whole (a layer, a phrase, its words or channels, the face it
// lowers to); no drawing, or a neutral one, is the head byte for byte; each drawing keeps the head's topology, moves only
// its own layer's parts and region, and folds no face; layers that share no vertex add exactly. And the head in a socket
// (sculpt `orbit`): none at 0; the eye set back between the brow and the cheekbone, the nose and the chin kept; the
// pyramid nose (sculpt `noseShape`) its bridge raised from the eye's line, its tip out and pointing up, no line on it; the
// jaw curved in (sculpt `jawHollow`) narrower toward its edge, its side turned down; the drawings as whole on them. And the
// principles (docs/anime-face-principles.md) built in: the brow never covers the eye; the socket rises with the brow.
import { describe, it, expect } from 'vitest';
import { DRAWINGS, DRAWING_LAYERS, DRAWING_REST, drawingErrors, drawingWordErrors, drawingWords, lowerFace } from './anime-drawings.js';
import { animeHead } from './anime-head.js';
import { X, build, pts, checkDrawing, studio, headOf, browClearance } from './anime-drawings.fixture.js';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';
import { animeHeroEffective, heroFeatureAdvice, ANIME_FORM, ANIME_FORM_POLE } from './anime-looks.js';
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
    // (the builds' moves summed over a neutral head, N0)
    const sumOver = (N0, ...B) => { const out = {}; for (const n of X) { const P = B.map((b) => pts(b[n])); out[n] = pts(N0[n]).map((p, i) => p.map((x, c) => P.reduce((t, q) => t + q[i][c] - x, x))); } return out; };
    const sum = (...B) => sumOver(N, ...B);
    const err = (A, S) => Math.max(...X.flatMap((n) => pts(A[n]).map((p, i) => Math.hypot(...p.map((x, c) => x - S[n][i][c])))));
    const W = (n) => DRAWINGS[n].words, pair = (a, b, E = {}) => err(build({ ...a, ...b }, E), sum(build(a), build(b), ...(Object.keys(E).length ? [build(null, E)] : [])));
    for (const [a, b] of [['brows.worried', 'mouth.a'], ['lids.sad', 'mouth.shout'], ['gaze.left', 'mouth.o'], ['gaze.up', 'brows.raised']]) expect(pair(W(a), W(b)), `${a} × ${b}`).toBeLessThan(1e-6);
    // (a brow and a lid meet at the socket's rim, which warps with the brow over the rings the lid moves: measured near
    // half a millimetre, so a brow over a lid's shape takes a corrective)
    expect(pair(W('brows.raised'), W('lids.wide'))).toBeGreaterThan(1e-4);
    // (the smile widens the vowel's outline: within half a millimetre)
    expect(err(build(W('mouth.a'), { smile: 1 }), sum(build(W('mouth.a')), build(null, { smile: 1 })))).toBeLessThan(1e-3);
    // (the brow block rides up as the lids shut: on the studio's front (laws 18) within a tenth of a millimetre; in the
    // socket it rides the brow's plane, measured near 3 mm, so a brow's drawing over a shut eye takes a corrective too)
    const S = studio.build;
    expect(err(S(W('brows.angry'), { blink: 1 }), sumOver(S(), S(W('brows.angry')), S(null, { blink: 1 })))).toBeLessThan(1e-4);
    expect(err(build(W('brows.angry'), { blink: 1 }), sum(build(W('brows.angry')), build(null, { blink: 1 })))).toBeGreaterThan(1e-3);
    // (the lenses do not add: the lids clip them; measured 6 mm, so the gaze is drawn at positions and a lid's shape over a
    // turned gaze takes a corrective)
    expect(pair(W('lids.angry'), W('gaze.right'))).toBeGreaterThan(1e-3);
  });
}, 120000);

describe('the head in a socket (sculpt orbit), its pyramid nose (sculpt noseShape), its jaw curved in (sculpt jawHollow) and its lips flat (sculpt flatLips)', () => {
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
  it('the pyramid nose: its bridge raised from the eye\'s line, its tip further out than the round one\'s and pointing up, no line drawn on it; the round one adds nothing', () => {
    expect(validateAnimeSculpt({ noseShape: 'hook' })[0]).toMatch(/noseShape: one of round, pyramid/);
    expect(sculptBuild('male', resolveAnimeSculpt({ noseShape: 'round' }))).toEqual(sculptBuild('male', resolveAnimeSculpt({})));
    // (the same face, its points moved: the centre line's point halfway from the eye's level down to the tip)
    const A = head(null), B = head({ noseShape: 'pyramid' }), FA = of(A, 'face'), FB = of(B, 'face');
    const H = Math.max(...FA.map((p) => p[2])) - Math.min(...FA.map((p) => p[2])), tip = FA.reduce((a, p) => (p[1] > a[1] ? p : a)), eye = of(A, 'irisL').reduce((t, p) => t + p[2], 0) / of(A, 'irisL').length;
    // (each face's centre line at the height halfway from the eye's level down to its tip, against its eye: the pyramid's
    // own rows make the two lattices differ, and the frame each build is pinned in moves with its face's front)
    const eyeOf = (M) => of(M, 'irisL').reduce((t, p, _, a) => [t[0] + p[1] / a.length, t[1] + p[2] / a.length], [0, 0]), eA = eyeOf(A), eB = eyeOf(B);
    const midOf = (F, e, t) => F.filter((p) => Math.abs(p[0]) < 1e-4 && p[1] > t[1] - 0.05).reduce((a, b) => (Math.abs(b[2] - (e[1] + t[2]) / 2) < Math.abs(a[2] - (e[1] + t[2]) / 2) ? b : a));
    const tipB = FB.reduce((a, p) => (p[1] > a[1] ? p : a));
    expect(midOf(FB, eB, tipB)[1] - eB[0]).toBeGreaterThan(midOf(FA, eA, tip)[1] - eA[0] + 0.002 * H);
    // (the profile's point: the tip out past the round one's and set higher, the underside cut back up to it, so it points
    // up; the shade side's plane carries what the round nose's line drew)
    expect(tipB[1] - eB[0]).toBeGreaterThan(tip[1] - eA[0] + 0.01 * H); expect(tipB[2] - eB[1]).toBeGreaterThan(tip[2] - eA[1]);
    expect(sculptBuild('male', resolveAnimeSculpt({ noseShape: 'pyramid' }))).not.toHaveProperty('noseLine'); expect(sculptBuild('male', resolveAnimeSculpt({}))).toHaveProperty('noseLine');
    // (the chin and the crown kept, to the micrometre: the pin's frame moves with the face's front and each offset rounds anew)
    for (const [k, f] of [[2, Math.min], [2, Math.max]]) expect(f(...FB.map((p) => p[k]))).toBeCloseTo(f(...FA.map((p) => p[k])), 6);
  });
  it('the lips flat: the rim round the mouth laid on the face, the skin elsewhere and the mouth\'s outline kept; none at 0', () => {
    expect(sculptBuild('male', resolveAnimeSculpt({ flatLips: 0 }))).not.toHaveProperty('flatLips');
    const A = head(null), B = head({ flatLips: 1 }), FA = of(A, 'face'), FB = of(B, 'face');
    // (the rim's points move straight back by up to the studio's raise, 9 mm of the studio head; nothing moves sideways or
    // forward, and the mouth's own outline, the opening, stays put)
    const moved = FA.map((p, i) => [p, FB[i]]).filter(([p, q]) => q[1] < p[1] - 1e-6);
    expect(moved.length).toBeGreaterThan(0);
    for (const [p, q] of FA.map((p, i) => [p, FB[i]])) { expect(Math.abs(q[0] - p[0])).toBeLessThan(1e-4); expect(Math.abs(q[2] - p[2])).toBeLessThan(1e-4); expect(q[1]).toBeGreaterThan(p[1] - 0.0092); expect(q[1]).toBeLessThan(p[1] + 1e-4); }
    expect(of(B, 'face').length).toBe(FA.length);
  });
  it('the jaw curved in: narrower toward its edge, its side turned down, the chin and the cheekbones kept; none at 0', () => {
    expect(sculptBuild('male', resolveAnimeSculpt({ jawHollow: 0 }))).not.toHaveProperty('jawHollow');
    const A = head(null), B = head({ jawHollow: 0.02 }), FA = of(A, 'face'), FB = of(B, 'face');
    const zLo = Math.min(...FA.map((p) => p[2])), zHi = Math.max(...FA.map((p) => p[2])), at = (F, z0, z1) => Math.max(...F.filter((p) => p[2] > z0 && p[2] < z1).map((p) => Math.abs(p[0])));
    // (the same face, its points moved: the jaw's edge narrower, the cheekbones' width kept; the centre line and the chin unmoved)
    expect(at(FB, zLo + 0.08 * (zHi - zLo), zLo + 0.14 * (zHi - zLo))).toBeLessThan(at(FA, zLo + 0.08 * (zHi - zLo), zLo + 0.14 * (zHi - zLo)) * 0.97);
    expect(at(FB, zLo + 0.45 * (zHi - zLo), zLo + 0.55 * (zHi - zLo))).toBeCloseTo(at(FA, zLo + 0.45 * (zHi - zLo), zLo + 0.55 * (zHi - zLo)), 6);
    FA.forEach((p, i) => { if (Math.abs(p[0]) < 1e-9) expect(FB[i][1]).toBeCloseTo(p[1], 6); });
    // (the lower face's side turned down: its faces' normals lean further down, so a side light grazes it)
    const tilt = (m) => { const P = m.vertices; let t = 0, n = 0; m.faces.forEach((f, i) => { if (m.provenance[f[0]].part !== 'face' || m.groups[i] !== 'Skin') return; const [a, b, c] = f.map((v) => P[v]), cz = (a[2] + b[2] + c[2]) / 3, cx = (a[0] + b[0] + c[0]) / 3; if (cz > zLo + 0.25 * (zHi - zLo) || Math.abs(cx) < 0.5 * at(FA, zLo, zHi)) return; const u = b.map((x, k) => x - a[k]), w = c.map((x, k) => x - a[k]), N = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; t += N[2] / (Math.hypot(...N) || 1); n++; }); return t / n; };
    expect(tilt(B)).toBeLessThan(tilt(A));
  });
  it('a new anime hero wears them (hero laws 19); a row before, the child and the studio\'s own face do not', () => {
    const sc = (spec) => animeHeroEffective(heroRecord({ head: 'anime', ...spec })).sculpt;
    for (const k of Object.keys(ANIME_FORM)) for (const cast of ['male', 'female']) expect(sc({ cast })[k], `${cast} ${k}`).toBe(resolveAnimeSculpt([ANIME_FORM, ANIME_FORM_POLE[cast].sculpt])[k]);
    // (each base's own: the male's head narrower and his jaw turned under half as much, the female's chin shorter)
    const fc = (spec) => animeHeroEffective(heroRecord({ head: 'anime', ...spec })).face;
    expect(fc({ cast: 'male' }).width).toBeLessThan(fc({ cast: 'male', laws: 18 }).width); expect(sc({ cast: 'male' }).jawHollow).toBeCloseTo(sc({ cast: 'female' }).jawHollow / 2, 9);
    expect(fc({ cast: 'female' }).chinHeight).toBeLessThan(fc({ cast: 'female', laws: 18 }).chinHeight);
    expect(sc({ cast: 'male', laws: 18 }).orbit).toBe(0); expect(sc({ cast: 'male', laws: 18 }).noseShape).toBeUndefined();
    expect(sc({ cast: 'child' }).orbit).toBe(0); expect(sc({ cast: 'male', sculpt: false })).toBe(false);
    // (a hero's own words move each: the socket deeper, the nose round)
    expect(sc({ cast: 'male', sculpt: { orbit: 0.005, noseShape: 'round' } })).toMatchObject({ orbit: 0.03, noseShape: 'round' });
    // (each base's formed head inside its feature bands: the default hero is advised nothing)
    for (const cast of ['male', 'female']) { const hero = heroRecord({ cast, head: 'anime' }); expect(heroFeatureAdvice(hero, heroPlanOf(hero).include[0].faceMeasures.features), cast).toEqual([]); }
  });
  it('keeps every layer\'s drawing whole on the head before its form (laws 18)', () => {
    for (const name of ['brows.angry', 'lids.angry', 'gaze.right', 'mouth.a']) studio.checkDrawing(`laws 18 ${name}`, DRAWINGS[name].layer, DRAWINGS[name].words);
  });
}, 120000);

describe('the principles, built in (docs/anime-face-principles.md)', () => {
  it('the brow never covers the eye: the angriest brow over the widest lid, on the lowest brow, clears it; before laws 19 it did not', () => {
    const words = drawingWords({ brows: 'brows.angry', lids: 'lids.wide' }), low = { cast: 'male', animeStyle: 'shonen-high' };
    expect(browClearance(headOf(low, words))).toBeGreaterThan(0);
    expect(browClearance(headOf({ ...low, laws: 18 }, words))).toBeLessThan(0);
    // (a word takes it off: the operator's call)
    expect(sculptBuild('male', resolveAnimeSculpt({ browClear: 0 }))).not.toHaveProperty('browClear');
  });
  it('the socket warps with the brow: its recess reaches higher under a raised brow', () => {
    // (the recess's top over the eye's middle: the highest face point there set back by a quarter of the deepest)
    // (the recess above the eye: over the eye's column and above its top, how far the socket sets the face back, summed;
    // the same head without its socket the reference)
    const recess = (spec, words = null) => {
      const A = headOf(spec, words), B = headOf({ ...spec, sculpt: { ...(spec.sculpt ?? {}), orbit: -0.025 } }, words);
      const iris = A.vertices.filter((_, i) => A.provenance[i].part === 'irisR'), ex = iris.reduce((t, p) => t + p[0] / iris.length, 0), top = Math.max(...iris.map((p) => p[2]));
      return A.vertices.reduce((t, p, i) => (A.provenance[i].part === 'face' && Math.abs(p[0] - ex) < 0.006 && p[2] > top && p[1] > 0 ? t + (B.vertices[i][1] - p[1]) : t), 0);
    };
    expect(recess({ cast: 'male' }, drawingWords({ brows: 'brows.raised' }))).toBeGreaterThan(recess({ cast: 'male' }) * 1.005);
    expect(recess({ cast: 'male' }, drawingWords({ brows: 'brows.angry' }))).toBeLessThan(recess({ cast: 'male' }));
  });
}, 300000);
