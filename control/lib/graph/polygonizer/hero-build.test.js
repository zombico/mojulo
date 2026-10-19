// hero-build.test.js — the hero door's BUILD form, `cast: { pole, build }` (hero-form.js HERO_BUILDS): a hero pole
// wearing a figure-cast preset with its dials over the pole's and its radii as ratios of the pole's. A child build has a
// child's radii (the bare 'child' word keeps the adult radii it was minted with); a female brute keeps the female's
// landmarks; `scale` on a worn head is refused with a pointer to tune.stature; the child-coded guard reads the RESOLVED
// cast, so a list, a dial map or a build that comes to child takes no bust.
import { describe, it, expect } from 'vitest';
import { heroPlan, castOf, HERO_CASTS, HERO_BUILD_NAMES, HERO_LAWS_VERSION } from './hero-form.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { CAST_PRESETS, CAST_PRESET_NAMES, composeCast, resolveCast } from './figure-cast.js';
import { heroHeadPole } from './anime-looks.js';
import { validateHeroSpec, heroRecord, expandLayeredManifest, heroMeasures } from '../../mcp/tools/layered.js';

const expand = (spec, opts) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec, opts) });
const torsoRing = (plan, id) => plan.segments.find((s) => s.name === 'torso').stations.find((st) => st.id === id);
const bustParts = (m) => Object.keys(m.recipe.parts).filter((p) => /^bust/.test(p));

describe('composeCast lays one dial set over another', () => {
  it('lengths and spans multiply, the shoulder drop adds; the canonical is the identity', () => {
    const c = composeCast(HERO_CASTS.female.dials, CAST_PRESETS.brute.dials);
    expect(c.shoulderSpan).toBeCloseTo(0.8 * 1.34, 12); expect(c.hipSpan).toBeCloseTo(0.62 * 1.06, 12);
    expect(c.shoulderDrop).toBe(11); expect(composeCast({ shoulderDrop: 8 }, { shoulderDrop: -3 }).shoulderDrop).toBe(5);
    const { from: _f, ...plain } = composeCast(HERO_CASTS.male.dials, 'canonical');
    expect(plain).toEqual(resolveCast(HERO_CASTS.male.dials));
  });
  it('a build for every figure-cast preset', () => {
    expect(HERO_BUILD_NAMES).toEqual(CAST_PRESET_NAMES);
  });
});

describe('a child build has a child\'s body', () => {
  it('a child\'s chest radius, a child\'s hips, a narrower girdle for its height; the bare word keeps its adult radii', () => {
    const male = castOf('male'), child = castOf({ build: 'child' });
    expect(child.body.chest).toBeCloseTo(0.154, 6);                     // ≈ 31 cm across, against the man's 44
    expect(child.body.chest).toBeLessThan(0.75 * male.body.chest);
    expect(child.body.bust).toBe(0); expect(child.child).toBe(true); expect(child.headScale).toBeCloseTo(1.18, 6);
    const M = heroPlan({ cast: 'male' }), C = heroPlan({ cast: { build: 'child' } }), F = heroPlan({ cast: 'female' });
    expect(torsoRing(C, 'st2').r[0] / torsoRing(M, 'st2').r[0]).toBeCloseTo(0.7, 2);   // the chest ring follows the radius
    // the hip joints sit inside the adult female's (the bare child preset's sat 60 % wider than hers)
    expect(C.joints.hip[0]).toBeLessThan(F.joints.hip[0]);
    expect(heroPlan({ cast: 'child' }).joints.hip[0]).toBeGreaterThan(1.5 * F.joints.hip[0]);
    // the shoulders: narrower for the figure's height than the man's (a scaled adult keeps his ratio)
    const across = (P) => heroMeasures(P).shoulder_m / P.joints.headBase[2];
    expect(across(C)).toBeLessThan(0.95 * across(M));   // to the atlas: the child's larger head is not counted
    expect(across(heroPlan({ cast: 'male', tune: { stature: 0.85 } }))).toBeCloseTo(across(M), 3);
    // opt-in: the bare preset word still wears the adult radii, so rows minted with it render as they did
    expect(torsoRing(heroPlan({ cast: 'child' }), 'st2').r).toEqual(torsoRing(heroPlan({ cast: 'canonical' }), 'st2').r);
  });
  it('a girl is the female pole\'s child: her landmarks, a child\'s radii, no bust', () => {
    const girl = castOf({ pole: 'female', build: 'child' }), woman = castOf('female');
    expect(girl.silhouette).toBe('female'); expect(girl.body.chest).toBeCloseTo(woman.body.chest * 0.7, 6);
    const m = expand({ cast: { pole: 'female', build: 'child' } });
    expect(bustParts(m)).toEqual([]);
    expect(m.recipe.rig.bones.some((b) => /bust/.test(b.id ?? ''))).toBe(false);
  });
  it('the chibi build is a child too: its radii, no bust', () => {
    const chibi = castOf({ build: 'chibi' });
    expect(chibi.child).toBe(true); expect(chibi.body.chest).toBeLessThan(castOf({ build: 'child' }).body.chest);
    expect(bustParts(expand({ cast: { pole: 'female', build: 'chibi' } }))).toEqual([]);
  });
});

describe('a pole with a build: female, built brute', () => {
  const FB = { pole: 'female', build: 'brute' }, MB = { pole: 'male', build: 'brute' };
  it('validates, and refuses a pole, a build or a key it does not know by name', () => {
    expect(validateHeroSpec({ cast: FB })).toEqual([]);
    expect(validateHeroSpec({ cast: FB, head: 'anime' })).toEqual([]);
    expect(validateHeroSpec({ cast: { pole: 'female', build: 'giant' } })).toEqual([expect.stringMatching(/^cast\.build: one of canonical, heroic, brute/)]);
    expect(validateHeroSpec({ cast: { pole: 'robot', build: 'brute' } })).toEqual([expect.stringMatching(/^cast\.pole: one of male, female/)]);
    expect(validateHeroSpec({ cast: { ...FB, thigh: 1.1 } })).toEqual([expect.stringMatching(/^cast\.thigh: the build form takes \{ pole, build \}/)]);
    expect(() => heroPlan({ cast: { pole: 'female', build: 'giant' } })).toThrow(/cast\.build: one of/);
  });
  it('keeps the female landmarks: her silhouette, her head, her bust; broader by the brute\'s percentages', () => {
    const fb = castOf(FB);
    expect(fb.silhouette).toBe('female'); expect(fb.pole).toBe('female'); expect(fb.headScale).toBe(HERO_CASTS.female.headScale);
    expect(fb.body.chest).toBeCloseTo(HERO_CASTS.female.body.chest * 1.22, 6);
    const m = expand({ cast: FB }), f = expand({ cast: 'female' }), mb = expand({ cast: MB });
    expect(m.plan.include[0].parts).toEqual(f.plan.include[0].parts);   // the landmark head is the female's, untouched
    expect(bustParts(m).length).toBeGreaterThan(0);                     // an adult female keeps her bust
    expect(heroHeadPole({ cast: FB })).toBe('female');                  // the anime head's design base is hers
    expect(castOf(FB, 'anime').silhouette).toBe('female');
    // broad, but a woman's broad: wider than the plain female, narrower in the shoulder and wider in the hip than his
    const W = heroMeasures(m.plan), Wf = heroMeasures(f.plan), Wm = heroMeasures(mb.plan);
    expect(W.shoulder_m).toBeGreaterThan(1.15 * Wf.shoulder_m);
    expect(W.shoulder_m).toBeLessThan(Wm.shoulder_m); expect(W.hip_m).toBeGreaterThan(Wm.hip_m);
  });
  it('stands, wears the anime head and is titled by its words', () => {
    expect(expand({ cast: FB, gesture: 'relaxed' }).recipe.clips.gesture).toBeTruthy();
    expect(expand({ cast: FB, head: 'anime' }).plan.frame.note).toMatch(/humanoid female·brute starter, the anime head \(Anime Form Studio, female base\)/);
  });
});

describe('casts and forms a worn head cannot build are refused at the door, not thrown downstream', () => {
  it('a list or a dial map is the blank trunk\'s; the tiered form needs the structured core', () => {
    for (const head of [undefined, 'landmark', 'anime']) {
      for (const cast of [['child'], { thigh: 0.9 }]) expect(validateHeroSpec({ cast, head })).toEqual([expect.stringMatching(/^cast: a list or a dial map builds only the blank trunk/)]);
    }
    expect(validateHeroSpec({ cast: ['child'], head: 'none' })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', form: 'tiered', core: 'streamlined' })).toEqual([expect.stringMatching(/^form: 'tiered' builds on the structured core/)]);
    expect(validateHeroSpec({ cast: 'male', form: 'tiered' })).toEqual([]);
  });
});

describe('scale on a worn head', () => {
  it('is refused with a pointer to tune.stature on the landmark and anime heads; the blank trunk honours it', () => {
    for (const head of [undefined, 'landmark', 'anime']) {
      expect(validateHeroSpec({ cast: 'male', head, scale: 0.8 })).toEqual([expect.stringMatching(/^scale: the (landmark|anime) head's figure takes its height from tune\.stature/)]);
    }
    expect(validateHeroSpec({ cast: 'male', head: 'none', scale: 0.8 })).toEqual([]);
    const z = (spec) => expand(spec).plan.joints.headBase[2];
    expect(z({ cast: 'male', head: 'none', scale: 0.8 }) / z({ cast: 'male', head: 'none' })).toBeCloseTo(0.8, 5);
    // the pointer works: stature moves a worn head's figure
    expect(z({ cast: 'male', tune: { stature: 0.8 } }) / z({ cast: 'male' })).toBeCloseTo(0.8, 5);
  });
  it('a spec re-recorded on every render (a world\'s inline hero) keeps rendering, as it always did, without it', () => {
    // (an inline hero is never stamped, so it reads laws 1: it is held to the same hero minted under laws 1)
    const plain = expand({ cast: 'female', laws: 1 }), stale = expand({ cast: 'female', scale: 0.7 }, { staleScale: true });
    expect(stale.plan).toEqual(plain.plan); expect(stale.recipe).toEqual(plain.recipe);
  });
});

describe('the child-coded guard reads the resolved cast', () => {
  it('refuses a bust on a build, a list or a dial map that comes to a child', () => {
    // a list or a dial map builds on the blank trunk only (a worn head refuses it by name, above)
    const refused = (cast, why) => expect(validateHeroSpec({ cast, head: 'none', body: { bust: 0.03 } })).toEqual([`body.bust: ${why} is a child-coded figure and takes no bust; remove body.bust (0 is the only value it takes)`]);
    refused({ pole: 'female', build: 'child' }, "the 'child' build");
    refused({ build: 'chibi' }, "the 'chibi' build");
    refused(['child', { forearm: 1.1 }], "the cast on 'child'");
    refused(['brute', 'chibi'], "the cast on 'chibi'");
    refused({ from: 'child', thigh: 0.8 }, "the cast on 'child'");
    refused({ ...CAST_PRESETS.child.dials }, "the cast resolving to 'child'");
    for (const cast of [{ pole: 'female', build: 'brute' }, ['brute', { forearm: 1.3 }], { thigh: 1.1 }]) expect(validateHeroSpec({ cast, head: 'none', body: { bust: 0.03 } }), JSON.stringify(cast)).toEqual([]);
  });
  it('and at plan time: a figure that comes to a child is never bare-chested, a rash vest over its torso', () => {
    const torso = (m) => { const mesh = compileLayered(m.recipe); return new Set(mesh.groups.filter((_, i) => /^torso\/st[0-2]/.test(mesh.faceIds[i]))); };
    for (const spec of [{ cast: ['child', { forearm: 1.1 }], head: 'none' }, { cast: { pole: 'female', build: 'child' } }]) {
      const m = expand({ ...spec, detail: 'swimsuit' });
      expect(bustParts(m), JSON.stringify(spec)).toEqual([]); expect([...torso(m)], JSON.stringify(spec)).toEqual(['Swim']);
    }
    expect(torso(expand({ cast: 'male', detail: 'swimsuit' }))).toEqual(new Set(['Skin']));   // an adult's chest is bare
  });
});

describe('the hero laws: a hero reading the newer tables is stamped at mint; laws 1 builds as an unstamped row', () => {
  it('stamps every structured-core hero (the shoulder line, laws 2) and the newer tables; leaves the inline hero alone', () => {
    for (const spec of [{ cast: 'male' }, { cast: { pole: 'female', build: 'brute' } }, { cast: 'male', form: 'tiered' }, { cast: 'female', head: 'anime', painterly: true }, { cast: 'male', geocube: 'island-noon' }]) {
      expect(heroRecord(spec).laws, JSON.stringify(spec)).toBe(HERO_LAWS_VERSION);
      expect(heroRecord(spec, { staleScale: true }).laws, JSON.stringify(spec)).toBeUndefined();
    }
    expect(HERO_LAWS_VERSION).toBe(2);
    expect(heroRecord({ cast: 'male', core: 'streamlined' }).laws).toBeUndefined();   // reads none of the tables
    expect(validateHeroSpec({ cast: 'male', laws: 1 })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', laws: 99 })).toEqual([expect.stringMatching(/^laws: 99 is unknown — this kernel carries hero laws 1 … 2/)]);
  });
  it('laws 1 builds what an unstamped row does; laws 2 moves the torso\'s shoulder line alone', () => {
    const spec = { cast: { pole: 'female', build: 'brute' } };
    const at = (laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), ...(laws ? { laws } : {}) } });
    const bare = at(null), one = at(1), two = at(2);
    expect(one.plan).toEqual(bare.plan); expect(one.recipe).toEqual(bare.recipe);
    // laws 2: only the torso differs, and in it only the top rings (the trapezius and the neck's root)
    const moved = Object.keys(two.recipe.parts).filter((k) => JSON.stringify(two.recipe.parts[k]) !== JSON.stringify(one.recipe.parts[k]));
    expect(moved).toEqual(['torso']);
    const st = (r) => Object.fromEntries((r.parts.torso.stations ?? []).map((s, i) => [s.id ?? i, JSON.stringify(s)]));
    const a = st(one.recipe), b = st(two.recipe);
    expect(Object.keys(a).filter((k) => a[k] !== b[k]).sort()).toEqual(['st3_st4_50', 'st4']);
  });
  it('laws 2 keeps the cage closed: the lifted root carries the top cap\'s tip up with it', () => {
    // the cast furthest from the identity (chosen from the catalog: the most dials off 1) and the blank trunk
    const off = (c) => Object.values(CAST_PRESETS[c].dials).reduce((t, v) => t + Math.abs(v - 1), 0);
    const far = CAST_PRESET_NAMES.reduce((a, c) => (off(c) > off(a) ? c : a));
    for (const spec of [{ cast: far }, { cast: 'male', head: 'none' }]) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
      const torso = auditLayered(compileLayered(m.recipe, m.dials)).torso;
      expect(torso.windingErrors, JSON.stringify(spec)).toBe(0); expect(torso.pass, JSON.stringify(spec)).toBe(true);
    }
  });
});

