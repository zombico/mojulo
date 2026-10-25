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
import { heroShade, TIERED_SMOOTH_CREASE, WEB_ARMPIT, CHILD_SHADE } from './tiered-form.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
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
    expect(HERO_LAWS_VERSION).toBe(17);
    expect(heroRecord({ cast: 'male', core: 'streamlined' }).laws).toBeUndefined();   // reads none of the tables
    expect(validateHeroSpec({ cast: 'male', laws: 1 })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', laws: 99 })).toEqual([expect.stringMatching(/^laws: 99 is unknown — this kernel carries hero laws 1 … 17/)]);
  });
  it('laws 15 poses the head and the neck as the cervical chain and holds the wave\'s small look; laws 14 keeps its plan', () => {
    const at = (laws) => heroPlanOf({ ...heroRecord({ cast: 'female' }), laws }), p14 = at(14), p15 = at(15);
    expect(p15.rig.cervical).toBe(true); expect(p14.rig.cervical).toBeUndefined();
    const heads = (p) => p.clips.wave.map((k) => k.head ?? null);
    expect(heads(p14)).toEqual([null, { x: 0.1, y: 0.95, z: 0.3 }, null, null]);
    expect(heads(p15)[0]).toBeNull(); expect(new Set(heads(p15).slice(1).map((h) => JSON.stringify(h))).size).toBe(1);
    // (the wave's look on the rig: a few degrees, the neck's column carrying more of it than the atlas)
    const R = validateRig(expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord({ cast: 'female' }), laws: 15 } }).recipe.rig), deg = (r) => (r * 180) / Math.PI, side = (N) => [deg(Math.atan2(N.headBase[0] - N.neckHub[0], N.headBase[2] - N.neckHub[2])), deg(Math.atan2(N.headTop[0] - N.headBase[0], N.headTop[2] - N.headBase[2]))];
    const [r0, r1] = side(rigNodesAt(R, {}).nodes), [n, h] = side(rigNodesAt(R, p15.clips.wave[2]).nodes);
    expect(n - r0).toBeGreaterThan(2); expect(n - r0).toBeLessThan(10); expect(Math.abs(h - n - (r1 - r0))).toBeLessThan(n - r0);
  });
  it('laws 16 seats the head on its neck: the landmark neck leans forward up to the skull, hers the more; his skull deeper behind, the face and hers untouched', () => {
    const at = (cast, laws) => heroPlanOf({ ...heroRecord({ cast, form: 'tiered' }), laws });
    const lean = (p) => { const S = p.segments.find((s) => s.name === 'neck').stations, a = S[1].at, b = S[3].at; return (Math.atan2(b[1] - a[1], b[2] - a[2]) * 180) / Math.PI; };
    const skull = (p) => p.include.flatMap((inc) => Object.values(inc.parts.cranium?.stations ?? []).flatMap((st) => Object.values(st.points)));
    const m15 = at('male', 15), m16 = at('male', 16), f15 = at('female', 15), f16 = at('female', 16);
    expect(lean(m16) - lean(m15)).toBeGreaterThan(1.5); expect(lean(f16) - lean(m16)).toBeGreaterThan(0.5);
    const back = (P) => Math.min(...P.map((q) => q[1])), A = skull(m15), B = skull(m16), mid = (back(A) + Math.max(...A.map((q) => q[1]))) / 2;
    expect(back(A) - back(B)).toBeGreaterThan(0.01);
    // (the face's points stand within a millimetre or so: the fitted surface's triangles over the crown and the cheek span
    // both halves, so a ray at the front can meet one the back moved)
    expect(A.length).toBe(B.length); A.forEach((q, i) => { if (q[1] > mid) expect(Math.hypot(...q.map((v, a) => v - B[i][a]))).toBeLessThan(0.0015); });
    expect(skull(f16)).toEqual(skull(f15));
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
  it('laws 7, the tiered limb end: a lofted limb\'s shaping rings move with its end, its last span kept; another form is as it was', () => {
    const at = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).plan;
    const thigh = (p) => p.segments.find((g) => g.name === 'thighR').stations, span = (S) => S[S.length - 2].at[2] - S[S.length - 1].at[2];
    const tiered = { cast: 'male', form: 'tiered' }, six = thigh(at(tiered, 6)), seven = thigh(at(tiered, 7)), whole = thigh(at({ cast: 'male', form: 'classic' }, 7));
    expect(seven.at(-1).at).toEqual(six.at(-1).at);   // the end where the bridge begins, as it was
    expect(span(six)).toBeLessThan(0.02);   // (laws 6: the knee's last span closed to a centimetre or so)
    // the span's share of the whole limb's last run as on the whole limb (the ring at its u)
    const share = (S) => span(S) / (S[S.length - 3].at[2] - S[S.length - 1].at[2]);
    expect(share(seven)).toBeCloseTo(share(whole), 2);
    expect(at({ cast: 'male', form: 'classic' }, 7)).toEqual(at({ cast: 'male', form: 'classic' }, 6));
  });
  it('laws 8, the shoulder web: over the ball in the arm\'s group, ending on the arm\'s own ring, closed, split with its arm; laws 7 has none', () => {
    const at = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).recipe;
    const tiered = { cast: 'male', form: 'tiered' }, R = at(tiered, 8);
    expect(at(tiered, 7).parts.shoulderWebR).toBeUndefined();
    for (const S of ['R', 'L']) {
      const w = R.parts[`shoulderWeb${S}`], arm = R.parts[`upperArm${S}`], st1 = arm.stations.find((st) => st.id === 'st1');
      expect(w.group).toBe(arm.group);
      expect(w.stations.at(-1).points).toEqual(st1.points);   // one surface with the arm there: the same points
      const A = auditLayered(compileLayered(R)); expect(A[`shoulderWeb${S}`]).toMatchObject({ windingErrors: 0, boundaryEdges: 0, degenerate: 0 });
    }
    // (a bare arm's web is skin, as the arm is; a target that splits the arm splits the web with it)
    expect(at({ ...tiered, detail: 'swimsuit' }, 8).parts.shoulderWebR.group).toBe('Skin');
    const big = at({ ...tiered, target: '4k' }, 8); expect(big.parts.shoulderWebR.slots.length).toBe(big.parts.upperArmR.slots.length);
    // the classic body has no ball and so no web
    expect(at({ cast: 'male', form: 'classic' }, 8).parts.shoulderWebR).toBeUndefined();
  }, 120_000);
  it('laws 9, the shoulder cone: the web\'s inner fairing in its group, closed, held in the torso at its base, split with the arm; the web hugs the arm; laws 8 as it was', () => {
    const at = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).recipe;
    const tiered = { cast: 'male', form: 'tiered' }, R = at(tiered, 9), eight = at(tiered, 8);
    expect(eight.parts.shoulderConeR).toBeUndefined();
    const A = auditLayered(compileLayered(R));
    for (const S of ['R', 'L']) { expect(R.parts[`shoulderCone${S}`].group).toBe(R.parts[`upperArm${S}`].group); expect(A[`shoulderCone${S}`]).toMatchObject({ windingErrors: 0, boundaryEdges: 0, degenerate: 0 }); }
    // (its base ring wider than its ball end: a cone from the ball toward the trunk; its ball end inside the ball)
    const ring = (st) => Object.values(st.points), span = (st) => { const P = ring(st); return Math.max(...P.map((p) => Math.hypot(p[1] - P[0][1], p[2] - P[0][2]))); };
    const cone = R.parts.shoulderConeR.stations; expect(span(cone[0])).toBeGreaterThan(span(cone[cone.length - 1]));
    // (it runs on into the arm, ending inside the arm's belly ring; the ball drawn in under it)
    const mid = (st) => { const P = ring(st); return [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length); }, belly = mid(R.parts.upperArmR.stations.find((st) => st.id === 'st1'));
    expect(Math.hypot(...mid(cone[cone.length - 1]).map((x, k) => x - belly[k]))).toBeLessThan(1e-3);
    expect(span(R.parts.shoulderBallR.stations[2])).toBeLessThan(span(eight.parts.shoulderBallR.stations[2]));
    // (laws 9: the web's ring before the arm's lies on the arm's way down; laws 8's was halfway from the equator)
    expect(R.parts.shoulderWebR.stations.at(-2).points).not.toEqual(eight.parts.shoulderWebR.stations.at(-2).points);
    expect(R.parts.shoulderWebR.stations.at(-1).points).toEqual(eight.parts.shoulderWebR.stations.at(-1).points);
    const big = at({ ...tiered, target: '4k' }, 9); expect(big.parts.shoulderConeR.slots.length).toBe(big.parts.upperArmR.slots.length);
  }, 120_000);
  it('laws 10, the web\'s armpit: no face of the cone or the web folds over with the arm raised; laws 9 folded one', () => {
    // a fold is two neighbouring faces of one part that face the same way at the bind and opposite ways posed
    const folds = (laws, pose) => {
      const m = expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord({ cast: 'male', form: 'tiered' }, { staleScale: true }), laws } });
      const mesh = compileLayered(m.recipe, m.dials), R = validateRig(m.recipe.rig);
      const posed = skinLayered(mesh, bindLayered(mesh, m.recipe, R), boneFrames(R, R.joints, rigNodesAt(R, pose).nodes));
      const sub = (a, b) => a.map((x, k) => x - b[k]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const nrm = (V, [a, b, c]) => { const u = sub(V[b], V[a]), v = sub(V[c], V[a]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; return n.map((x) => x / (Math.hypot(...n) || 1)); };
      let n = 0;
      for (const part of ['shoulderConeR', 'shoulderWebR']) {
        const F = mesh.faces.filter((f) => f.every((v) => mesh.provenance[v].part === part)), edges = new Map();
        F.forEach((f, i) => f.forEach((a, k) => { const b = f[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; (edges.get(key) ?? edges.set(key, []).get(key)).push(i); }));
        for (const fs of edges.values()) if (fs.length === 2 && dot(nrm(mesh.vertices, F[fs[0]]), nrm(mesh.vertices, F[fs[1]])) > 0 && dot(nrm(posed, F[fs[0]]), nrm(posed, F[fs[1]])) < -0.5) n++;
      }
      return n;
    };
    const up = { armR: 'up', armL: 'up' };
    expect(folds(9, up)).toBeGreaterThan(0);
    expect(folds(10, up)).toBe(0); expect(folds(10, { armR: 'forward', armL: 'forward' })).toBe(0);
    // (the web's under-arm slots carry their own blend toward the arm; laws 9's web has none)
    const at = (laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord({ cast: 'male', form: 'tiered' }, { staleScale: true }), laws } }).recipe.parts.shoulderWebR.bind.blend;
    for (const sl of WEB_ARMPIT.slots) { expect(at(10)[`st2.${sl}`]).toBeDefined(); expect(at(9)[`st2.${sl}`]).toBeUndefined(); }
  }, 120_000);
  it('laws 11, the chibi\'s chest: it meets the shoulder\'s ring without a shelf and stands as deep as the belly; another cast as it was', () => {
    const torso = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).recipe.parts.torso.stations;
    const half = (st, k) => { const P = Object.values(st.points).map((p) => p[k]); return (Math.max(...P) - Math.min(...P)) / 2; }, z = (st) => Math.min(...Object.values(st.points).map((p) => p[2]));
    // the step out from the chest's ring to the armpit's, per metre of rise: laws 10's chibi a shelf, laws 11's no steeper than the man's slope tenfold
    const step = (S) => { const a = S.find((st) => st.id === 'st2'), b = S.find((st) => st.id === 'st2_st3_50'); return (half(b, 0) - half(a, 0)) / (z(b) - z(a)); };
    const chibi = { cast: 'chibi', form: 'tiered', head: 'anime' }, man = { cast: 'male', form: 'tiered' };
    expect(step(torso(chibi, 10))).toBeGreaterThan(2);
    expect(step(torso(chibi, 11))).toBeLessThan(1);
    const deep = (S) => half(S.find((st) => st.id === 'st2'), 1) / half(S.find((st) => st.id === 'st1_st2_50'), 1);
    expect(deep(torso(chibi, 10))).toBeLessThan(0.8); expect(deep(torso(chibi, 11))).toBeGreaterThan(0.9);
    expect(torso(man, 11)).toEqual(torso(man, 10));
  }, 120_000);
  it('laws 12, the chibi form: limbs cylinders, no pectoral, a larger head on a shorter body, small hands and round shoes; another cast as it was', () => {
    const R = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).recipe;
    const chibi = { cast: 'chibi', form: 'tiered', head: 'anime' }, twelve = R(chibi, 12), eleven = R(chibi, 11);
    // a limb's taper: its widest ring over its narrowest, across (the shank: the calf over the ankle)
    const taper = (rc, name) => { const S = rc.parts[name].stations, w = S.map((st) => { const P = Object.values(st.points).map((p) => p[0]); return Math.max(...P) - Math.min(...P); }); return Math.max(...w) / Math.min(...w); };
    for (const limb of ['shankR', 'upperArmR']) expect(taper(twelve, limb), limb).toBeLessThan(taper(eleven, limb));
    expect(eleven.parts.pectoralR).toBeDefined(); expect(twelve.parts.pectoralR).toBeUndefined();
    // the head a larger share of the height; the hand shorter
    const share = (rc) => { const J = rc.rig.joints; return (J.headTop.at[2] - J.headBase.at[2]) / J.headTop.at[2]; };
    expect(share(twelve)).toBeGreaterThan(share(eleven));
    const len = (rc) => { const J = rc.rig.joints; return Math.hypot(...[0, 1, 2].map((k) => J.knucklesR.at[k] - J.wristR.at[k])); };
    expect(len(twelve)).toBeLessThan(len(eleven));
    const shoe = (rc) => { const J = rc.rig.joints; return J.toeTipR.at[1] - J.ankleR.at[1]; }, wide = (rc) => Math.max(...Object.values(rc.parts.footR.stations[0].points).map((p) => Math.abs(p[0] - rc.rig.joints.ankleR.at[0])));
    expect(shoe(twelve)).toBeLessThan(shoe(eleven)); expect(wide(twelve)).toBeGreaterThan(wide(eleven));
    // (a man is as he was; a stored chibi under laws 11 too)
    const man = { cast: 'male', form: 'tiered' };
    expect(R(man, 12)).toEqual(R(man, 11));
  }, 120_000);
  it('laws 13, the child form: the bare word is the child build; a barrel torso, fuller arms, no pectoral, a larger head; the chibi and a man as they were', () => {
    const R = (spec, laws) => expandLayeredManifest({ kind: 'layered', hero: { ...heroRecord(spec, { staleScale: true }), laws } }).recipe;
    // (the bare word: under laws 12 the figure cast on a man's radii, under 13 the child build, as the build itself is)
    const word = { cast: 'child', form: 'tiered', head: 'anime' }, build = { cast: { pole: 'male', build: 'child' }, form: 'tiered', head: 'anime' };
    const twelve = R(build, 12), thirteen = R(build, 13);
    expect(R(word, 13)).toEqual(thirteen); expect(R(word, 12)).not.toEqual(twelve);
    const half = (st, k) => { const P = Object.values(st.points).map((p) => p[k]); return (Math.max(...P) - Math.min(...P)) / 2; };
    const round = (rc) => { const st = rc.parts.torso.stations.find((x) => x.id === 'st1'); return half(st, 1) / half(st, 0); };
    expect(round(thirteen)).toBeGreaterThan(round(twelve));
    const arm = (rc) => half(rc.parts.upperArmR.stations[Math.floor(rc.parts.upperArmR.stations.length / 2)], 0);
    expect(arm(thirteen)).toBeGreaterThan(arm(twelve));
    expect(twelve.parts.pectoralR).toBeDefined(); expect(thirteen.parts.pectoralR).toBeUndefined();
    const share = (rc) => { const J = rc.rig.joints; return (J.headTop.at[2] - J.headBase.at[2]) / J.headTop.at[2]; };
    expect(share(thirteen)).toBeGreaterThan(share(twelve));
    expect(heroPlanOf({ ...heroRecord(build, { staleScale: true }), laws: 13 }).style.body).toBe('child');
    for (const spec of [{ cast: 'chibi', form: 'tiered', head: 'anime' }, { cast: 'male', form: 'tiered' }]) expect(R(spec, 13), spec.cast).toEqual(R(spec, 12));
  }, 120_000);
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
    // (laws 14: the child shaded round, its crease wider and its face leaning toward the head's capsule; laws 13 as the tiered)
    const child = { form: 'tiered', head: 'anime', cast: { build: 'child' } };
    expect(heroShade({ ...child, laws: 14 })).toEqual({ crease: CHILD_SHADE.crease, ellipsoid: 0, face: CHILD_SHADE.face });
    expect(heroShade({ ...child, laws: 13 })).toEqual({ crease: TIERED_SMOOTH_CREASE, ellipsoid: 0 });
    for (const k of ['Skin', 'Top']) expect(CHILD_SHADE.crease[k]).toBeGreaterThan(TIERED_SMOOTH_CREASE[k]);
  });
});
