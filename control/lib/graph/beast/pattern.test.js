// The biped's coat pattern (beast/pattern.js) and the coat as an atlas (beast/coat-atlas.js): the laws each layer keeps
// in an upright body's anatomy, on hand-built samples (one per region a layer reads), and the atlas on one minted beast:
// absent nothing, deterministic, the coat's faces only, a stripe finer than the rings, the cover's relief laid on it.
import { describe, it, expect } from 'vitest';
import { patternField, patternErrors, PATTERN_KINDS } from './pattern.js';
import { beastCoatPaint, coatRelief, COAT_RELIEF_SCALE } from './coat-atlas.js';
import { beastWords } from './tiered.js';
import { beastCoatOf, beastCoverStyleOf } from './cover.js';
import { heroRecord, expandLayeredManifest, validateHeroSpec } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { layeredShadingNormals } from '../polygonizer/station-loft-shade.js';

const COAT = '#b08a52';
const at = (o) => ({ region: 'trunk', D: 0, theta: 0.5, z: 1.2, zt: 0.5, chain: 0, s: 0, p: [0.1, 0, 1.2], ...o });
const one = (L) => patternField([L], { coat: COAT });

describe('the layers, in a biped\'s anatomy', () => {
  it('countershade lightens the front and the inner limbs, never the back or the outer face', () => {
    const f = one({ kind: 'countershade' });
    expect(f(at({ D: -1, theta: 1 }))).not.toBe(null); expect(f(at({ D: 1, theta: 0 }))).toBe(null);
    expect(f(at({ region: 'arm', D: -0.9 }))).not.toBe(null); expect(f(at({ region: 'arm', D: 0.9 }))).toBe(null);
  });
  it('stripes sweep from the spine and stop short of the front; band a limb\'s outer face only; ring the tail', () => {
    const f = one({ kind: 'stripes', wobble: 0 }), hits = (o) => Array.from({ length: 200 }, (_, i) => f(at({ ...o, z: 1 + i * 0.002, s: i * 0.002 }))).filter(Boolean).length;
    expect(hits({ theta: 0.1, D: 0.95 })).toBeGreaterThan(30); expect(hits({ theta: 0.95, D: -0.99 })).toBe(0);
    expect(hits({ region: 'leg', D: 0.8, chain: 0.5 })).toBeGreaterThan(30); expect(hits({ region: 'leg', D: -0.8, chain: 0.5 })).toBe(0);
    expect(hits({ region: 'tail', D: -1 })).toBeGreaterThan(30);
  });
  it('points darken a limb toward its end; dorsal marks the spine alone; spots and rosettes are mirror-symmetric', () => {
    const P = one({ kind: 'points' }); expect(P(at({ region: 'arm', chain: 0.95 }))).not.toBe(null); expect(P(at({ region: 'arm', chain: 0.2 }))).toBe(null);
    const D = one({ kind: 'dorsal' }); expect(D(at({ D: 1, p: [0.001, -0.1, 1.2] }))).not.toBe(null); expect(D(at({ D: 1, p: [0.12, -0.1, 1.2] }))).toBe(null);
    for (const kind of ['spots', 'rosettes']) { const f = one({ kind }); for (let i = 0; i < 40; i++) { const p = [0.03 * i, -0.1, 1 + 0.011 * i]; expect(f(at({ D: 0.5, p }))).toBe(f(at({ D: 0.5, p: [-p[0], p[1], p[2]] }))); } }
  });
  it('refuses a layer it does not know and a word a layer does not take, by name', () => {
    expect(patternErrors([{ kind: 'tartan' }]).join()).toMatch(/kind: countershade/);
    expect(patternErrors([{ kind: 'stripes', size: 0.1 }]).join()).toMatch(/stripes takes/);
    expect(patternErrors([{ kind: 'spots', color: 'red' }]).join()).toMatch(/color/);
    expect(patternErrors(PATTERN_KINDS.map((kind) => ({ kind })))).toEqual([]);
  });
});

describe('the coat as an atlas', () => {
  const mint = (beast) => { const hero = heroRecord(withDefaultWalk(beastWords(withDefaultForm({ cast: 'female', beast })))), { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }); return { hero, recipe, mesh: compileLayered(recipe, dials) }; };
  const pattern = [{ kind: 'countershade' }, { kind: 'stripes' }];
  it('no pattern, no atlas; a pattern paints the coat\'s faces alone, deterministic', () => {
    const plain = mint({ kin: 'feline' }); expect(beastCoatPaint(plain.mesh, plain.recipe, plain.hero)).toBe(null);
    expect(validateHeroSpec({ cast: 'female', beast: { kin: 'feline', pattern } })).toEqual([]);
    const A = mint({ kin: 'feline', pattern }), P = beastCoatPaint(A.mesh, A.recipe, A.hero), coat = beastCoatOf(A.hero);
    expect(P.stats.faces).toBeGreaterThan(1000);
    A.mesh.faces.forEach((_, fi) => { if (P.faceUV(fi)) expect(coat.has(A.mesh.groups[fi])).toBe(true); });
    expect(beastCoatPaint(A.mesh, A.recipe, A.hero).key).toBe(P.key);
  }, 60_000);
  it('a stripe is finer than the rings: down a leg its colour turns more often than the leg has rings', () => {
    const A = mint({ kin: 'feline', pattern }), P = beastCoatPaint(A.mesh, A.recipe, A.hero), rings = ['thighR', 'shankR'].reduce((n, x) => n + P.layout.rects.find((r) => r.name === x).F.P.stations.length, 0);
    const field = patternField(pattern, { coat: A.recipe.palette.Skin });
    let turns = 0, prev;
    for (let i = 0; i < 600; i++) { const s = (i / 600) * 0.9, on = field({ region: 'leg', D: 0.9, theta: 0, z: 0, zt: 0, chain: s / 1.0, s, p: [0.1, 0, 0.9 - s] }) !== null; if (prev !== undefined && on !== prev) turns++; prev = on; }
    expect(turns).toBeGreaterThan(rings);
  }, 60_000);
  it('the cover\'s relief rides the atlas: a normal map at its own scale, a tangent on every painted corner', () => {
    const A = mint({ kin: 'feline', pattern }), P = beastCoatPaint(A.mesh, A.recipe, A.hero), N = layeredShadingNormals(A.mesh, A.recipe, {});
    const R = coatRelief(A.mesh, P, beastCoverStyleOf(A.hero), N);
    expect(R.atlas.w).toBe(P.atlas.w * COAT_RELIEF_SCALE); expect(R.atlas.h).toBe(P.atlas.h * COAT_RELIEF_SCALE);
    const fi = [...Array(A.mesh.faces.length).keys()].find((f) => P.faceUV(f));
    expect(R.tangentAt(fi, 0)).toHaveLength(4);
    expect(coatRelief(A.mesh, P, null, N)).toBe(null);
  }, 60_000);
});
