// Gritty flora (gritty-flora.js): what grows on a gritty land laid with relief in its own colours, as strong as the land
// is gritty; a quiet land's flora as it came.
import { describe, expect, it } from 'vitest';
import { withGrittyFlora, withGrittyGround, FLORA_CUTS } from './gritty-flora.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';
import { assembleStageScene } from './stage.js';
import { isekaiKey, isekaiTexels } from './isekai-tiles.js';
import { assembleIsekaiScene } from './isekai.js';
import { readGeocube, lowerGeocube } from './geocube.js';
import { lookOf, registerLook } from './style/looks.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

const quad = (group, normal, z = 0) => ({ group, fill: '#506040', normal, corners: normal[2] > 0.7 ? [[0, 0, z], [1, 0, z], [1, 1, z], [0, 1, z]] : [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] });
const faces = () => [quad('isekai:crown', [0, 0, 1], 5), quad('isekai:crown', [0, -1, 0]), quad('isekai:wood', [0, -1, 0]), quad('isekai:wood', [0, 0, 1]), quad('isekai:ground', [0, 0, 1])];

describe('gritty flora', () => {
  it('a quiet land\'s flora comes back as it came', () => {
    const F = faces();
    expect(withGrittyFlora(F, GRIT_PIXELS - 0.01)).toBe(F);
    expect(withGrittyFlora(F, undefined)).toBe(F);
  });

  it('lays bark up trunks over the face\'s own colour; a crown is chipped (leaf-chips.js), never laid', () => {
    const [top, side, trunk, cut, ground] = withGrittyFlora(faces(), 0.7);
    expect(trunk.texture).toMatch(/^detail:dressed-/); expect(trunk.textureLit).toBe(true); expect(trunk.uv).toHaveLength(4);
    // (a crown still a ball on a gritty land keeps its flat stops; a trunk's level cut is no bark; the ground is not flora)
    for (const f of [top, side, cut, ground]) expect(f.texture).toBeUndefined();
    expect(Object.keys(FLORA_CUTS)).toEqual(['isekai:wood']);
  });

  it('its strength is the land\'s grit: another grit, another relief', () => {
    expect(withGrittyFlora(faces(), 0.9)[2].texture).not.toBe(withGrittyFlora(faces(), 0.5)[2].texture);
    expect(withGrittyFlora(faces(), 0.7)).toEqual(withGrittyFlora(faces(), 0.7));
  });

  it('lays the path on the trail, turf on the ground, and the verge across a fringe lane from the trail\'s side', () => {
    const lane = { ...quad('isekai:ground', [0, 0, 1]), corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }, land = [quad('isekai:trail', [0, 0, 1]), quad('isekai:ground', [0, 0, 1]), lane];
    expect(withGrittyGround(land, 0.2)).toBe(land);
    // (the trail runs along x = −1: the lane's two corners at x 0 are its side)
    const [path, turf, verge] = withGrittyGround(land, 0.7, { verge: (i) => i === 2, nearTrail: (c) => c[0] + 1 });
    for (const f of [path, turf, verge]) expect(f.texture).toMatch(/^detail:dressed-/);
    expect(new Set([path.texture, turf.texture, verge.texture]).size).toBe(3);
    expect(verge.uv.map((q) => q[1])).toEqual([0, 0, 0.999, 0.999]);
  });

  it('a gritty polygon land lays it; a quiet one does not', () => {
    // (one gritty stage: its broken rock's strewn stones make it a heavy one)
    const M = { kind: 'stage', kit: 'isekai-meadow' }, G = assembleStageScene({ ...M, shading: { grit: 0.7 } }), Q = assembleStageScene({ ...M, shading: true });
    const of = (P, g) => P.faces.filter((f) => f.group === g), detailed = (f) => /^detail:/.test(f.texture || '');
    // (its trees chipped: a core in two stops and chips over it; a quiet land's crowns balls, no chip)
    expect(of(G, 'isekai:core').length).toBeGreaterThan(0);
    expect(new Set(of(G, 'isekai:chips').map((f) => f.fill)).size).toBeGreaterThan(2);
    expect(of(G, 'isekai:crown').some(detailed)).toBe(false);
    expect(of(Q, 'isekai:core').length + of(Q, 'isekai:chips').length).toBe(0);
    expect(of(Q, 'isekai:crown').length).toBeGreaterThan(0);
    expect(of(G, 'isekai:trail').every((f) => detailed(f) || Math.abs(f.normal[2]) <= 0.7)).toBe(true);
    expect(of(Q, 'isekai:trail').some(detailed)).toBe(false);
    // (its clouds hi-def, the cutouts with them; a quiet land's pixel-locked)
    const clouds = (P) => P.faces.filter((f) => /:cumulus-/.test(f.texture || '')).map((f) => f.texture);
    expect(clouds(G).length).toBeGreaterThan(0);
    expect(clouds(G).every((k) => k.endsWith('+hd') && G.cutouts.includes(k))).toBe(true);
    expect(clouds(Q).some((k) => k.endsWith('+hd'))).toBe(false);
    // (a gritty cloud is a heap: three cards where a quiet one has one)
    expect(clouds(G).length).toBe(3 * clouds(Q).length);
  }, 60000);

  it('a hi-def tile: the same drawing at twice the size, every texel between two neighbouring stops, a cutout whole', () => {
    const key = 'isekai:isekai-meadow:cumulus-lit', K = isekaiKey(`${key}+hd`), px = isekaiTexels(key), hd = isekaiTexels(`${key}+hd`);
    expect(K.hd).toBe(true);
    expect([hd.W, hd.H]).toEqual([px.W * 2, px.H * 2]);
    expect(new Set(hd.a)).toEqual(new Set([0, 255]));
    const S = K.stops, inSpan = (c) => S.some((q, i) => i < S.length - 1 && [0, 1, 2].every((k) => c[k] >= Math.min(q[k], S[i + 1][k]) - 1 && c[k] <= Math.max(q[k], S[i + 1][k]) + 1));
    let out = 0, between = 0;
    for (let i = 0; i < hd.W * hd.H; i++) { const c = [hd.rgb[i * 3], hd.rgb[i * 3 + 1], hd.rgb[i * 3 + 2]]; if (!inSpan(c)) out++; if (!S.some((q) => q.every((v, k) => v === c[k]))) between++; }
    expect(out).toBe(0);
    expect(between).toBeGreaterThan(0);
    // (its outline broken further: more of the card is cloud than the pixel tile's body, at the same scale)
    const cover = (t) => t.a.reduce((n, v) => n + (v ? 1 : 0), 0) / (t.W * t.H);
    expect(cover(hd)).toBeGreaterThan(cover(px));
  });

  it('a gritty land\'s live grass takes the material light, its contrast the grit\'s, no dry hue', () => {
    const M = { kind: 'stage', kit: 'isekai-meadow', biocube: 'meadow' };
    const G = assembleStageScene({ ...M, shading: { grit: 0.7 } }).liveGrass, Q = assembleStageScene({ ...M, shading: true }).liveGrass;
    const t = (0.7 - GRIT_PIXELS) / (1 - GRIT_PIXELS);
    expect(G.real.ao).toBeCloseTo(0.6 - 0.3 * t, 4);
    expect(G.real.back).toBeCloseTo(0.6 + 0.4 * t, 4);
    expect(G.real.dry).toBe(0);
    expect(Q.real).toBeUndefined();
  }, 60000);

  it('a gritty look carries the leaf card; a gritty land\'s bushes stand leaf cards, hi-def, in the foliage\'s stops (its trees are chipped)', () => {
    expect(lookOf(lowerGeocube(readGeocube('limestone-crags'), 'outside').kit).card.tiles.leafcard).toMatchObject({ ramp: 'foliage', paint: 'leafcard' });
    expect(lookOf(lowerGeocube(readGeocube('valley-morning'), 'outside').kit).card.tiles.leafcard).toBeUndefined();
    const id = 'gritty-flora-leafcard-test', n = ISEKAI_MEADOW.palette.foliage.length, m = Math.floor((n - 1) / 2);
    registerLook({ id, base: 'isekai-meadow', read: 'a test look', card: { ...ISEKAI_MEADOW, tiles: { ...ISEKAI_MEADOW.tiles, leafcard: { ramp: 'foliage', lit: [m - 1, m, m + 1], shade: [m - 1, m, m + 1], scale: 2.4, paint: 'leafcard' } } }, swatches: {} });
    const G = assembleIsekaiScene({ style: id, shading: { grit: 0.7 } }), Q = assembleIsekaiScene({ style: id, shading: true });
    const cards = (P) => P.faces.filter((f) => f.group === 'isekai:leaves');
    expect(cards(G)).toHaveLength(0);
    expect(cards(Q)).toHaveLength(0);
    // (a bush stands leaf cards, and its faces are lumped, not the design's)
    const B = assembleIsekaiScene({ style: id, shading: { grit: 0.7 }, shrubs: { count: 6 } }), QB = assembleIsekaiScene({ style: id, shading: true, shrubs: { count: 6 } });
    expect(cards(B).length).toBeGreaterThan(0);
    expect(cards(B).every((f) => /:leafcard-b[0-3]\+hd$/.test(f.texture) && !f.textureLit && B.cutouts.includes(f.texture))).toBe(true);
    const bush = (P) => P.faces.filter((f) => f.group === 'flora:bush').map((f) => JSON.stringify(f.corners)).sort().join('|');
    expect(bush(B)).not.toBe(bush(QB));
  }, 90000);
});
