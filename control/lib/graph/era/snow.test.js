// Snow (snow.js): the cover a level's land takes — where it lies (over its line, on ground level enough, longer on the
// side turned from the sun, opened in patches by the wind), its colour the theorist's from the world's sky and sun, the
// grass thinning under it, the leaves turned up carrying it; on a stage, the ground cut where it crosses, the trail
// trodden, the far ridges capped, the bare season's trees their wood, and the page's footprint bed on it.
import { describe, expect, it } from 'vitest';
import { readSnow, snowField, snowRamp, snowFar, grassUnder, capOf, SNOW_DEPTHS, SNOW_DEFAULTS } from './snow.js';
import { lchOf } from '../color-theorist/oklab.js';
import { ISEKAI_STYLES } from './isekai.js';
import { assembleStageScene } from './stage.js';
import { readGeocube, withGeocube } from './geocube.js';
import { readBiocube } from './biocube.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { LEAF_FORMS, leafForm } from './leaf-forms.js';

const st = ISEKAI_STYLES['isekai-meadow'], up = [0, 0, 1];

describe('snow, read', () => {
  it('is true, a depth\'s word or a document; anything else is refused', () => {
    expect(readSnow(undefined)).toBe(null);
    expect(readSnow(true)).toEqual({ ...SNOW_DEFAULTS });
    expect(readSnow('deep').depth).toBe(SNOW_DEPTHS.deep);
    expect(readSnow({ line: 6, depth: 'dusting' })).toMatchObject({ line: 6, depth: SNOW_DEPTHS.dusting });
    for (const bad of ['blizzard', { depth: 3 }, { hold: 0.2 }, { line: 'high' }, { colour: '#fff' }, [1]]) expect(() => readSnow(bad)).toThrow(/snow/);
  });
});

describe('where it lies', () => {
  const at = (S, z, n = up, x = 3, y = 4) => snowField(readSnow(S), { base: 0, sun: [0.5, 0.3, 0.8] })(x, y, z, n);
  it('over its line and not under it; everywhere without one', () => {
    expect(at({ line: 6, drift: 0 }, 10)).toBeGreaterThan(0);
    expect(at({ line: 6, drift: 0 }, 2)).toBeLessThan(0);
    expect(at({ drift: 0 }, -5)).toBeGreaterThan(0);
  });
  it('on ground level enough to hold it, steep rock bare; the side turned from the sun holding it steeper', () => {
    const steep = (a) => [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.8];
    expect(at({ drift: 0, hold: 0.85 }, 0, steep(0))).toBeLessThan(0);
    const toSun = Math.atan2(0.3, 0.5), lee = { drift: 0, hold: 0.82, lee: 1 };
    expect(at(lee, 0, steep(toSun + Math.PI))).toBeGreaterThan(at(lee, 0, steep(toSun)));
  });
  it('opened in patches by the drift, and unbroken without it', () => {
    const open = (drift) => { let n = 0; for (let x = 0; x < 40; x += 1.3) for (let y = 0; y < 40; y += 1.3) if (at({ drift }, 0, up, x, y) <= 0) n++; return n; };
    expect(open(0)).toBe(0);
    expect(open(0.9)).toBeGreaterThan(open(0.3));
  });
});

describe('its colour and what grows under it', () => {
  it('is near-white and quiet in chroma, its shade darker, solved from the world\'s own sky and sun', () => {
    const R = snowRamp(st.palette, st.light);
    expect(R.length).toBe(st.palette.rock.length);
    const L = R.map((c) => lchOf(c)[0]);
    expect(L[L.length - 1]).toBeGreaterThan(0.93);
    expect(L.every((v, i) => i === 0 || v > L[i - 1])).toBe(true);
    expect(R.every((c) => lchOf(c)[1] < 0.03)).toBe(true);
    expect(snowFar(st.palette, R).length).toBe(st.palette.far.length);
  });
  it('lets the grass stand through a dusting, thins it under a cover and buries it in deep snow; caps more leaves the deeper', () => {
    const D = (d) => readSnow({ depth: d });
    expect(grassUnder(D(SNOW_DEPTHS.dusting))).toBe(1);
    expect(grassUnder(D(SNOW_DEPTHS.cover))).toBeGreaterThan(0);
    expect(grassUnder(D(SNOW_DEPTHS.cover))).toBeLessThan(1);
    expect(grassUnder(D(SNOW_DEPTHS.deep))).toBe(0);
    expect(capOf(D(SNOW_DEPTHS.deep)).up).toBeLessThan(capOf(D(SNOW_DEPTHS.dusting)).up);
    expect(capOf(D(SNOW_DEPTHS.deep)).share).toBeGreaterThan(capOf(D(SNOW_DEPTHS.dusting)).share);
  });
  it('a cube carries its snow to its trail\'s stage, a recipe\'s own winning; a bare season is a biocube\'s word', () => {
    expect(() => readGeocube({ from: 'limestone-crags', snow: 'blizzard' })).toThrow(/snow/);
    expect(withGeocube({ kind: 'stage', trail: {}, geocube: { from: 'limestone-crags', snow: 'deep' } }).snow).toBe('deep');
    expect(withGeocube({ kind: 'stage', trail: {}, snow: { line: 4 }, geocube: { from: 'limestone-crags', snow: 'deep' } }).snow).toEqual({ line: 4 });
    expect(readBiocube({ from: 'forest', flora: { trees: { season: 'bare' } } }).flora.trees.season).toBe('bare');
    expect(() => readBiocube({ from: 'forest', flora: { trees: { season: 'autumnal' } } })).toThrow(/season/);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { kinds: [{ form: 'spray', evergreen: 'yes' }] } } })).toThrow(/evergreen/);
  });
});

describe('a spire (a fir, a pine)', () => {
  it('is evergreen by its form, a cone: its tiers climb the stem to the tree\'s height, shorter up it', () => {
    expect(LEAF_FORMS.spire.evergreen).toBe(true);
    expect(Object.entries(LEAF_FORMS).filter(([k, F]) => k !== 'spire' && F.evergreen).length).toBe(0);
    const G = leafForm('spire', { base: [0, 0, 0], h: 10, c: [0, 0, 3], Rc: 2, seed: 3 });
    const top = Math.max(...G.lobes.map((L) => L.at[2])), tiers = G.limbs.filter((l) => l.pts.length === 3);
    expect(top).toBeGreaterThan(8);
    const reach = (l) => Math.hypot(l.pts[2][0] - l.pts[0][0], l.pts[2][1] - l.pts[0][1]);
    const lo = tiers.slice().sort((a, b) => a.pts[0][2] - b.pts[0][2]);
    expect(reach(lo[0])).toBeGreaterThan(reach(lo[lo.length - 1]) * 2);
  });
});

describe('snow on a stage', () => {
  const BIO = { from: 'forest', flora: { trees: { kinds: ['tuft', { form: 'spire', trunk: 0.15, spread: 0.2 }], season: 'bare' } } };
  const deep = { kind: 'stage', trail: {}, geocube: { from: 'limestone-crags', biocube: BIO, snow: 'deep' } };

  it('lies on the ground and the trail, caps the far ridges, buries the grass; the bare trees their wood, the evergreen in leaf; the page\'s prints on it', () => {
    const P = assembleStageScene(deep, {});
    const groups = new Set(P.faces.map((f) => f.group));
    expect(groups.has('isekai:snow')).toBe(true);
    // (the far ridges: some faces in the snow's hazed stops)
    expect(P.faces.filter((f) => f.group === 'isekai:ridge').length).toBeGreaterThan(0);
    // (the spire, evergreen by its form, keeps its crown; the tuft, whose leaves fall, draws none)
    expect(groups.has('isekai:core')).toBe(true);
    // (no working key leaves the stage)
    expect(P.faces.some((f) => f._ramp !== undefined || f._tint !== undefined || f._soft !== undefined || f._lobe !== undefined)).toBe(false);
    // (the grass gone under deep snow where the snow lies: the prints' mask and the grass's agree)
    const SP = P.snowPrints, m = Buffer.from(SP.grid.m.__b64, 'base64');
    expect([...m].filter((v) => v & 1).length).toBeGreaterThan(m.length * 0.5);
    expect(SP.sink).toBeLessThanOrEqual(SP.depth);
    if (P.liveGrass) { const g = Buffer.from(P.liveGrass.grid.m.__b64, 'base64'); expect([...g].filter((v) => v & 1).length).toBeLessThan(g.length * 0.2); }
    // (the page carries the prints' bed only with them)
    expect(emitThreeWorld({ ...P, inline: true }).includes('stepSnowPrints(t)')).toBe(true);
    expect(emitThreeWorld({ faces: P.faces.slice(0, 50), inline: true }).includes('stepSnowPrints')).toBe(false);
  }, 180000);

  it('thins a biocube\'s live grass by the share its depth leaves, as the tufts, and grows no wildflowers in it', () => {
    const cube = { from: 'island-noon', biocube: { from: 'meadow', flora: { flowers: { share: 0.4 } } } };
    const bare = assembleStageScene({ kind: 'stage', trail: {}, seed: 3, geocube: cube }, {});
    const snowed = assembleStageScene({ kind: 'stage', trail: {}, seed: 3, geocube: { ...cube, snow: 'cover' } }, {});
    const cells = (P) => [...Buffer.from(P.liveGrass.grid.m.__b64, 'base64')].filter((v) => v & 1).length;
    expect(bare.liveGrass.flowers).toBeTruthy();
    expect(snowed.liveGrass.flowers ?? null).toBe(null);
    expect(cells(snowed)).toBeLessThan(cells(bare) * 0.8);
  }, 180000);

  it('names no snow on a land that is no polygon land, and adds nothing where none falls', () => {
    expect(() => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: {}, snow: 'deep' }, {})).toThrow(/polygon land/);
  });
});
