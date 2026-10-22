// hero-build.test.js — the hero door's BUILD form, `cast: { pole, build }` (hero-form.js HERO_BUILDS): a hero pole
// wearing a figure-cast preset with its dials over the pole's and its radii as ratios of the pole's. A child build has a
// child's radii (the bare 'child' word keeps the adult radii it was minted with); a female brute keeps the female's
// landmarks; `scale` on a worn head is refused with a pointer to tune.stature; the child-coded guard reads the RESOLVED
// cast, so a list, a dial map or a build that comes to child takes no bust.
import { describe, it, expect } from 'vitest';
import { heroPlan, castOf, HERO_CASTS, HERO_BUILD_NAMES, HERO_LAWS_VERSION, LEG_SET, LEG_LENGTH, ARM_LENGTH, CHIBI } from './hero-form.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { CAST_PRESETS, CAST_PRESET_NAMES, composeCast, resolveCast } from './figure-cast.js';
import { heroHeadPole } from './anime-looks.js';
import { validateHeroSpec, heroRecord, expandLayeredManifest, heroMeasures, heroReadout, heroPlanOf, CLASSIC_DEPRECATED, STREAMLINED_DEPRECATED } from '../../mcp/tools/layered.js';
import { heroShade, TIERED_SMOOTH_CREASE } from './tiered-form.js';
import { STUDIO_SMOOTH_CREASE } from './station-loft-shade.js';

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
  it('stamps every structured-core hero (the shoulder line, laws 2; the leg set, laws 3; the leg length, laws 4; the arm length, laws 5) and the newer tables; leaves the inline hero alone', () => {
    for (const spec of [{ cast: 'male' }, { cast: { pole: 'female', build: 'brute' } }, { cast: 'male', form: 'tiered' }, { cast: 'female', head: 'anime', painterly: true }, { cast: 'male', geocube: 'island-noon' }]) {
      expect(heroRecord(spec).laws, JSON.stringify(spec)).toBe(HERO_LAWS_VERSION);
      expect(heroRecord(spec, { staleScale: true }).laws, JSON.stringify(spec)).toBeUndefined();
    }
    expect(HERO_LAWS_VERSION).toBe(6);
    expect(heroRecord({ cast: 'male', core: 'streamlined' }).laws).toBeUndefined();   // reads none of the tables
    expect(validateHeroSpec({ cast: 'male', laws: 1 })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', laws: 99 })).toEqual([expect.stringMatching(/^laws: 99 is unknown — this kernel carries hero laws 1 … 6/)]);
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
  it('laws 3 turns the leg back about the ankle: the hip\'s joint into the pelvis, the knee by its share, its bend kept', () => {
    const spec = { cast: { pole: 'female', build: 'brute' } };
    const J = (laws) => { const m = expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }); return Object.fromEntries(Object.entries(m.recipe.rig.joints).map(([k, j]) => [k, j.at])); };
    const two = J(2), three = J(3);
    for (const S of ['R', 'L']) {
      const h2 = two[`hip${S}`], h3 = three[`hip${S}`], k2 = two[`knee${S}`], k3 = three[`knee${S}`], a = three[`ankle${S}`];
      expect(a).toEqual(two[`ankle${S}`]);
      expect(h3[1]).toBeCloseTo(h2[1] - LEG_SET.hipBack * h2[2], 5); expect(h3[0]).toBe(h2[0]); expect(h3[2]).toBe(h2[2]);
      // the knee off the line from the hip to the ankle as far as it was: the bend, the leg's slack, kept
      const off = (h, k) => { const t = (k[2] - a[2]) / (h[2] - a[2]); return k[1] - (a[1] + t * (h[1] - a[1])); };
      expect(off(h3, k3)).toBeCloseTo(off(h2, k2), 5);
    }
  });
  it('laws 4 lengthens an adult\'s leg by the lumbar\'s run: the hip\'s joint up, the navel joint and the neck where they stood; a child keeps its own', () => {
    const J = (spec, laws) => { const m = expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }); return Object.fromEntries(Object.entries(m.recipe.rig.joints).map(([k, j]) => [k, j.at])); };
    const adult = { cast: { pole: 'female', build: 'brute' } }, three = J(adult, 3), four = J(adult, 4);
    const run = LEG_LENGTH.rise * (three.hipR[2] - three.ankleR[2]);
    for (const S of ['R', 'L']) {
      expect(four[`hip${S}`][2] - three[`hip${S}`][2]).toBeCloseTo(run, 2);
      expect(four[`ankle${S}`][2]).toBe(three[`ankle${S}`][2]);
      expect(four[`knee${S}`][2]).toBeGreaterThan(three[`knee${S}`][2]);
    }
    // the trunk's top stays (the leg's slant takes a millimetre or two of the run's height)
    for (const k of ['navel', 'neckHub', 'shoulderR']) expect(Math.abs(four[k][2] - three[k][2]), k).toBeLessThan(0.003);
    // a child's proportions are its own (the build chosen from the catalog)
    const child = { cast: { pole: 'male', build: HERO_BUILD_NAMES.find((n) => castOf({ pole: 'male', build: n }).child) } };
    expect(J(child, 4)).toEqual(J(child, 3));
  });
  it('laws 5 shortens an adult\'s humerus and forearm by ARM_LENGTH, the shoulder where it stood; a child keeps its own', () => {
    const J = (spec, laws) => { const m = expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }); return Object.fromEntries(Object.entries(m.recipe.rig.joints).map(([k, j]) => [k, j.at])); };
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const adult = { cast: { pole: 'male', build: 'lithe' } }, four = J(adult, 4), five = J(adult, 5);
    for (const S of ['R', 'L']) {
      expect(five[`shoulder${S}`]).toEqual(four[`shoulder${S}`]);
      expect(d(five[`shoulder${S}`], five[`elbow${S}`]) / d(four[`shoulder${S}`], four[`elbow${S}`])).toBeCloseTo(ARM_LENGTH.upperArm, 2);
      expect(d(five[`elbow${S}`], five[`wrist${S}`]) / d(four[`elbow${S}`], four[`wrist${S}`])).toBeCloseTo(ARM_LENGTH.forearm, 2);
    }
    expect(five.hipR).toEqual(four.hipR);
    const child = { cast: { pole: 'female', build: HERO_BUILD_NAMES.find((n) => castOf({ pole: 'female', build: n }).child) } };
    expect(J(child, 5)).toEqual(J(child, 4));
  });
  it('laws 6, the chibi: the bare word is the build, its head larger, its arms thinner, its neck fuller; another cast is as it was', () => {
    const at = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).plan;
    const zs = (p) => p.include.find((i) => i.name === 'head').parts.cranium.stations.flatMap((st) => Object.values(st.points).map((q) => q[2]));
    const head = (p) => Math.max(...zs(p)) - Math.min(...zs(p)), seg = (p, n) => p.segments.find((g) => g.name === n), arm = (p) => seg(p, 'upperArmR').rA[1];
    const chibi = { cast: 'chibi' }, build = { cast: { pole: 'male', build: 'chibi' } }, five = at(chibi, 5), six = at(chibi, 6);
    expect(head(six) / head(at(build, 5))).toBeCloseTo(CHIBI.headScale, 3); expect(head(six)).toBeGreaterThan(head(five));
    expect(arm(six)).toBeLessThan(arm(five)); expect(arm(six) / arm(at(build, 5))).toBeCloseTo(CHIBI.arm, 3);
    // the hero's own arm over the law's: the bare word and the build alike
    expect(seg(at({ ...chibi, body: { arm: 0.05 } }, 6), 'upperArmR')).toEqual(seg(at({ ...build, body: { arm: 0.05 } }, 6), 'upperArmR'));
    const adult = { cast: { pole: 'female', build: 'lithe' } };
    expect(at(adult, 6)).toEqual(at(adult, 5));
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


describe('the game bodies: the tiered form, and the deprecated ones said on the readout', () => {
  it('the classic body (named, or stored without a form) and the streamlined core are said deprecated; the tiered is not', () => {
    const warn = (spec) => { const hero = heroRecord(spec); return heroReadout(hero, heroPlanOf(hero), null, []).warnings ?? []; };
    expect(warn({ cast: 'male', form: 'classic' })).toContain(CLASSIC_DEPRECATED);
    expect(warn({ cast: 'male' })).toContain(CLASSIC_DEPRECATED);
    expect(warn({ cast: 'male', core: 'streamlined' })).toEqual(expect.arrayContaining([STREAMLINED_DEPRECATED]));
    expect(warn({ cast: 'male', core: 'streamlined' })).not.toContain(CLASSIC_DEPRECATED);
    for (const form of ['tiered', 'realistic']) expect(warn({ cast: 'male', form })).not.toContain(CLASSIC_DEPRECATED);
  }, 120_000);
  it('the tiered body is shaded at its own crease (the anime head\'s too), its landmark head toward its ellipsoid; another the studio\'s', () => {
    expect(heroShade({ form: 'tiered' }).crease).toBe(TIERED_SMOOTH_CREASE); expect(heroShade({ form: 'tiered' }).ellipsoid).toBeTruthy();
    expect(heroShade({ form: 'tiered', head: 'anime' })).toEqual({ crease: TIERED_SMOOTH_CREASE, ellipsoid: 0 });
    for (const h of [{ form: 'classic' }, {}, undefined]) expect(heroShade(h)).toEqual({ crease: STUDIO_SMOOTH_CREASE, ellipsoid: 0 });
  });
});
