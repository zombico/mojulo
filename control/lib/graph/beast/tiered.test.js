// The beast-kin on the tiered body (lib/graph/beast/tiered.js): a kin's card on the hero door, its words recorded under
// the spec's own (bald, bare in its coat, its rest), its girths laid on the hero's plan before the tiered passes, its
// hands keeping the card's fingers with a hooked claw out of every digit, and its joints the tiered body's: the stretch
// audit holds it to its build's own hero, where the sixth generation's creature biped pinched its knees to a third.
// Cards are chosen in code by the procedure they run.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS, kinCoat } from './cards.js';
import { beastCard, beastFlesh, KEPT_FINGERS } from './tiered.js';
import { KEPT_TOES } from './legs.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { beastWords } from './tiered.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig } from '../polygonizer/station-loft-rig.js';
import { stretchAudit, gaitFrames } from '../polygonizer/hero-stretch.js';

const kinBy = (pred) => Object.entries(BEAST_KINS).find(([, c]) => pred(c))[0];
const BARREL = kinBy((c) => c.mass.waist > 1), WASP = kinBy((c) => c.mass.waist < 0.8);
const HUMPED = kinBy((c) => c.hump > 0), FRAMED = kinBy((c) => Object.keys(c.frame ?? {}).length > 1);
const THREE = kinBy((c) => c.fingers === 3 && c.claws !== 'none'), CLAWLESS = kinBy((c) => c.claws === 'none');
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const kin = (id, extra = {}, cast = 'male') => mint({ cast, beast: { kin: id, ...extra } });
const seg = (p, n) => p.segments.find((s) => s.name === n);
const rOf = (v) => (Array.isArray(v) ? v[0] : v);
const person = heroPlanOf(mint({ cast: 'male' }));

describe('the beast-kin on the tiered body', () => {
  it('its words are recorded under the spec\'s own: bald, bare in its coat, its rest the card\'s', () => {
    const H = kin(BARREL), card = BEAST_KINS[BARREL];
    expect(H.form).toBe('tiered');
    expect(H.beast).toEqual({ kin: BARREL });
    expect(H.head).toBe('none');   // (bald: it wears its kin's head, beast/head.js; a person's head is bald, below)
    expect(kin(BARREL, { head: 'person' }).hair?.style ?? kin(BARREL, { head: 'person' }).hair).toBe('none');
    expect(H.detail).toBe('none');
    expect(H.palette.Skin).toBe(kinCoat(BARREL));
    for (const g of ['Top', 'Bottom', 'Shoes', 'Brow']) expect(H.palette[g]).toBe(H.palette.Skin);
    expect(H.palette.Claws).toBe(card.claw);
    expect(H.gesture.hinge).toBe(card.rest.hunch);
    expect(H.motion.walk).toMatchObject({ tilt: card.rest.hunch });
    // (the operator's own words over the card's)
    const own = kin(BARREL, {}, 'male'), mine = mint({ cast: 'male', palette: { Skin: '#112233' }, gesture: 'relaxed', beast: { kin: BARREL } });
    expect(mine.palette.Skin).toBe('#112233'); expect(mine.palette.Top).toBe('#112233'); expect(mine.gesture).toBe('relaxed');
    expect(own).toEqual(kin(BARREL));   // (deterministic)
  });

  it('its girths: the trunk a barrel or a wasp\'s waist by its card, the limbs and the neck the card\'s', () => {
    const waist = (p) => rOf(seg(p, 'torso').stations[0].r), chest = (p) => rOf(seg(p, 'torso').stations.at(-2).r);
    const barrel = heroPlanOf(kin(BARREL)), wasp = heroPlanOf(kin(WASP));
    // (each against a person of its kin's frame, its proportions as tune words: the girths are the card's mass over them)
    const like = (id) => heroPlanOf(mint({ cast: 'male', tune: BEAST_KINS[id].frame ?? {} })), person = like(BARREL), slim = like(WASP);
    expect(waist(barrel) / waist(person)).toBeGreaterThan(chest(barrel) / chest(person));   // the waist swells past the chest
    expect(waist(wasp) / waist(slim)).toBeLessThan(chest(wasp) / chest(slim));             // the waist pinches inside it
    // (a barrel swells forward: at its waist the back stands no further behind than the trunk's scale puts it)
    const B = seg(barrel, 'torso').stations, P = seg(person, 'torso').stations;
    const i = B.reduce((b, st, j) => (rOf(st.r) / rOf(P[j].r) > rOf(B[b].r) / rOf(P[b].r) ? j : b), 0), at = (p) => seg(p, 'torso').stations[i];
    const back = (st) => (st.yc ?? 0) - st.r[1];
    expect(back(at(barrel))).toBeGreaterThanOrEqual(back(at(person)) * BEAST_KINS[BARREL].mass.trunk - 1e-6);
    expect(at(barrel).yc ?? 0).toBeGreaterThan(at(person).yc ?? 0);
    const fore = (p) => rOf(seg(p, 'foreArmR').rA);
    expect(fore(barrel) / fore(person)).toBeCloseTo(BEAST_KINS[BARREL].mass.foreArm, 3);
    expect(fore(wasp) / fore(slim)).toBeCloseTo(BEAST_KINS[WASP].mass.foreArm, 3);
    // (the tiered passes run on the body as it now is: the shoulder's ball sits on the thicker arm)
    const ball = (p) => Math.max(...Object.values(seg(p, 'shoulderBallR').stations[2].points).map((q) => q[0]));
    expect(ball(barrel)).toBeGreaterThan(ball(person));
  });

  it('its frame: its proportions recorded as tune words under the operator\'s own; a move or a list stands as given', () => {
    const F = BEAST_KINS[FRAMED].frame, [k0, k1] = Object.keys(F);
    expect(kin(FRAMED).tune[k0]).toBeCloseTo(F[k0], 6);
    const mine = mint({ cast: 'male', tune: { [k0]: 1 }, beast: { kin: FRAMED } }).tune;
    expect(mine[k0]).toBe(1); expect(mine[k1]).toBeCloseTo(F[k1], 6);
    expect(beastWords({ cast: 'male', tune: 'heroic', beast: { kin: FRAMED } }).tune).toBe('heroic');
  });

  it('its silhouette\'s own masses: a hump behind under the neck, a keel in front under the shoulders, full hips, each holding the other side', () => {
    const base = person, H = { beast: { kin: HUMPED } }, card = beastCard(H), plain = { ...card, hump: 0, keel: 0, mass: { ...card.mass, hips: 1 } };
    const torso = (c) => seg(beastFlesh(base, H, c), 'torso').stations, back = (st) => (st.yc ?? 0) - st.r[1], front = (st) => (st.yc ?? 0) + st.r[1];
    const P = torso(plain), sh = base.joints.shoulder[2], near = (z) => P.reduce((b, st, i) => (Math.abs(st.z - z) < Math.abs(P[b].z - z) ? i : b), 0);
    const top = near(sh + 0.09), chest = near(sh - 0.17), low = 0;
    const hump = torso({ ...plain, hump: 1 }), keel = torso({ ...plain, keel: 1 }), hips = torso({ ...plain, mass: { ...plain.mass, hips: 1.3 } });
    expect(back(hump[top])).toBeLessThan(back(P[top]) - 0.01); expect(front(hump[top])).toBeCloseTo(front(P[top]), 6);
    expect(front(keel[chest])).toBeGreaterThan(front(P[chest]) + 0.01); expect(back(keel[chest])).toBeCloseTo(back(P[chest]), 6);
    expect(rOf(hips[low].r)).toBeGreaterThan(rOf(P[low].r) * 1.05); expect(rOf(hips[top].r)).toBeCloseTo(rOf(P[top].r), 3);
    // (absent, the trunk is the card's girths alone)
    expect(torso(plain)).toEqual(P);
  });

  it('its hands keep the card\'s fingers, the thumb among them, the rig whole; a hooked claw out of every digit', () => {
    const H = kin(THREE), plan = heroPlanOf(H), kept = KEPT_FINGERS[beastCard(H).fingers];
    for (const f of ['thumb', 'index', 'middle', 'ring', 'little']) expect(!!seg(plan, `${f}R`), f).toBe(kept.includes(f));
    expect(plan.rig.bones.some((b) => b.id === 'little1R' || b.perSide?.some((x) => x.id === 'little1$S'))).toBe(true);
    for (const d of Object.values(plan.dials)) if (Array.isArray(d.parts)) expect(d.parts).not.toContain('little$S');
    // a claw out of each kept finger, riding its last bone, past its tip; out of each toe, riding the toes
    for (const f of kept) { const c = seg(plan, `${f}ClawR`), tip = seg(plan, `${f}R`).caps.tip;
      expect(c.bind).toBe(`${f}3R`); expect(Math.hypot(...c.stations.at(-1).at.map((x, i) => x - tip[i]))).toBeGreaterThan(0.01); }
    expect(seg(plan, 'halluxClawR').bind).toBe('toesR');
    const long = Math.hypot(...[0, 1, 2].map((i) => seg(plan, 'indexClawR').stations.at(-1).at[i] - seg(plan, 'indexClawR').stations[1].at[i]));
    const blunt = heroPlanOf(kin(THREE, { claws: 'blunt' })), short = Math.hypot(...[0, 1, 2].map((i) => seg(blunt, 'indexClawR').stations.at(-1).at[i] - seg(blunt, 'indexClawR').stations[1].at[i]));
    expect(long).toBeGreaterThan(short * 1.4);
    expect(heroPlanOf(kin(CLAWLESS)).segments.some((s) => /Claw/.test(s.name))).toBe(false);
    expect(seg(heroPlanOf(kin(CLAWLESS, { fingers: 5 })), 'littleR')).toBeTruthy();
  });

  it('it binds and rigs as a hero does: every weight sums to one, the rest is the identity', () => {
    const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero: kin(THREE) });
    const R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials), skin = bindLayered(mesh, recipe, R), A = auditRig(mesh, skin, R);
    expect(A.badWeights).toBe(0);
    expect(A.restIdentity).toBeLessThan(1e-9);
    expect(Object.keys(mesh.parts).filter((n) => /Claw[RL]$/.test(n)).length).toBe(2 * (KEPT_FINGERS[3].length + KEPT_TOES.plantigrade[BEAST_KINS[THREE].toes].length));
  }, 60_000);

  it('its joints are the tiered body\'s: through walk, jog and sprint it pinches and folds no worse than its build\'s hero', () => {
    const audit = (hero) => { const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials);
      return stretchAudit(mesh, bindLayered(mesh, recipe, R), R, recipe, [{ label: 'stand', pose: {} }, ...gaitFrames(R, { samples: 4 })]).worst; };
    const build = { pole: 'male', build: 'brute' }, beast = audit(mint({ cast: build, beast: { kin: BARREL } })), hero = audit(mint({ cast: build, detail: 'none', hair: 'none' }));
    expect(beast.pinch.value).toBeGreaterThan(0.7);   // the creature biped's knee: 0.28 in the sprint
    expect(beast.pinch.value).toBeGreaterThan(hero.pinch.value - 0.05);
    expect(beast.folds.value).toBeLessThanOrEqual(hero.folds.value);
  }, 120_000);

  it('the door refuses what the tiered body does not stand', () => {
    const errs = (beast, extra = {}) => validateHeroSpec(beastWords({ form: 'tiered', cast: 'male', beast, ...extra })).join('\n');
    expect(errs({ kin: 'goblin' })).toMatch(/beast\.kin: one of/);
    expect(errs({ kin: BARREL, legs: 'hooved' })).toMatch(/beast\.legs/);
    expect(errs({ kin: BARREL, toes: 6 })).toMatch(/beast\.toes/);
    expect(errs({ kin: BARREL, fingers: 2 })).toMatch(/beast\.fingers/);
    expect(errs({ kin: BARREL, claws: 'sharp' })).toMatch(/beast\.claws/);
    expect(errs({ kin: BARREL, horns: 'curled' })).toMatch(/beast\.horns: not a word/);
    expect(errs({ kin: BARREL }, { form: 'classic' })).toMatch(/stand on the tiered body/);
    expect(errs({ kin: BARREL }, { undead: { form: 'zombie' } })).toMatch(/beast-kin or undead, not both/);
    expect(errs({ kin: BARREL })).toBe('');
  });

  it('absent, every pass returns what it was given', () => {
    const H = mint({ cast: 'male' });
    expect(beastWords(H)).toBe(H);
    expect(beastCard(H)).toBe(null);
  });
});
