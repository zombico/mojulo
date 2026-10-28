// The undead on the tiered body (lib/graph/undead/tiered.js): a form reaches the HERO door from its lineage, its words
// recorded under the spec's own (bald, bare, one tone, a gaunt face, its rest), and its card's flesh passes laid on the
// hero's plan before the tiered passes. Cards are chosen in code by the pass they exercise.
import { describe, it, expect } from 'vitest';
import { UNDEAD_CARDS } from './cards.js';
import { undeadWords, undeadFlesh, undeadCard } from './tiered.js';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet } from '../egocube/plan.js';
import { heroRecord, heroPlanOf, validateHeroSpec } from '../../mcp/tools/layered.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { heroSkeleton } from './hero-bones.js';

const cardBy = (pred) => Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === 'flesh' && pred(c));
const zombie = (build, seed = 3, extra = {}) => ({ form: 'tiered', cast: 'male', palette: { Skin: '#9a9a90' }, undead: { form: 'zombie', build, seed }, ...extra });
const seg = (p, n) => p.segments.find((s) => s.name === n);
const r = (v) => (Array.isArray(v) ? Math.max(...v) : v);
const living = heroPlanOf(heroRecord({ form: 'tiered', cast: 'male' }));

describe('the undead on the tiered body', () => {
  it('a zombie lineage reaches the hero door, its form on the spec', () => {
    const sheet = rollEgocube({ facets: { ancestry: 'zombie', build: 'canonical', role: 'frontline' }, seed: 3 });
    expect(sheet.ancestry.door).toBe('hero');
    const P = planFromSheet(sheet);
    expect(P.create.as).toBe('hero');
    expect(P.create.spec).toMatchObject({ form: 'tiered', undead: { form: 'zombie', build: 'canonical', seed: 3 } });
    expect(validateHeroSpec(P.create.spec)).toEqual([]);
  });
  it('its words are recorded under the spec\'s own: bald, bare, one tone, a gaunt face, the rest its card\'s', () => {
    const [id, card] = cardBy((c) => (c.lean ?? 0) > 10 && (c.jaw ?? 0) > 0);
    const H = heroRecord(zombie(card.build));
    expect(H.undead).toMatchObject({ form: 'zombie' });
    expect(undeadCard(H)).toBe(UNDEAD_CARDS[id]);
    expect(H.hair === 'none' || H.hair?.style === 'none').toBe(true);
    for (const g of ['Top', 'Bottom', 'Shoes', 'Brow']) expect(H.palette[g]).toBe(H.palette.Skin);
    expect(H.face.cheek).toBeLessThan(1);
    expect(H.face.cheekbone).toBeGreaterThan(1);
    expect(H.gesture.hinge).toBe(card.lean);
    expect(H.expression.jawOpen).toBe(card.jaw);
    expect(H.motion.walk.tilt).toBeGreaterThan(0);
    // the operator's own words stand over the form's
    const own = heroRecord(zombie(card.build, 3, { palette: { Skin: '#9a9a90', Top: '#334455' }, face: { cheek: 1 } }));
    expect(own.palette.Top).toBe('#334455');
    expect(own.face.cheek).toBe(1);
  });
  it('its card\'s flesh on the hero\'s parts: wasted thin, or swollen with the belly pushed forward', () => {
    const [, thin] = cardBy((c) => !c.bloat && c.waste.limbs < 0.8);
    const W = heroPlanOf(heroRecord(zombie(thin.build)));
    expect(r(seg(W, 'upperArmR').rA)).toBeLessThan(r(seg(living, 'upperArmR').rA));
    expect(r(seg(W, 'torso').stations[2].r)).toBeLessThan(r(seg(living, 'torso').stations[2].r));
    const [, fat] = cardBy((c) => c.bloat);
    const B = heroPlanOf(heroRecord(zombie(fat.build)));
    expect(r(seg(B, 'torso').stations[2].r)).toBeGreaterThan(r(seg(living, 'torso').stations[2].r));
    // the belly: the waist's section brought forward of the living's, a smooth swell (its neighbours less so)
    const fwd = (p, i) => (seg(p, 'torso').stations[i].yc ?? 0) - (seg(living, 'torso').stations[i].yc ?? 0);
    expect(fwd(B, 0)).toBeGreaterThan(0.03);
    expect(fwd(B, 0)).toBeGreaterThan(fwd(B, seg(B, 'torso').stations.length - 1));
    // the plans build, the joints bridged and the shoulders balled on the body as it is now
    for (const p of [W, B]) { expect(() => expandPlan(p)).not.toThrow(); expect(seg(p, 'shoulderBallR')).toBeDefined(); expect(seg(p, 'elbowBridgeR')).toBeDefined(); }
  });
  it('absent, nothing moves; a form off the tiered body or unknown is refused', () => {
    const plain = { form: 'tiered', cast: 'male' };
    expect(undeadWords(plain)).toBe(plain);
    expect(undeadFlesh(living, plain)).toBe(living);
    expect(validateHeroSpec({ ...zombie('canonical'), undead: { form: 'mummy' } }).join()).toMatch(/undead.form/);
    expect(validateHeroSpec({ ...zombie('canonical'), form: 'realistic' }).join()).toMatch(/tiered body/);
  });
});

describe('an even body, whatever the silhouette', () => {
  it('the trunk never stands from the limbs past the even ratio, the overall size the card\'s', async () => {
    const { EVEN_RATIO } = await import('./tiered.js');
    // (one case per way out of proportion: the swollen trunk on its limbs, and the limbs wasted most against the trunk)
    const flesh = Object.values(UNDEAD_CARDS).filter((x) => x.form === 'flesh'), lean = (x) => (x.waste.trunk * (x.bloat?.trunk ?? 1)) / (x.waste.limbs * (x.bloat?.limbs ?? 1));
    for (const c of [flesh.find((x) => x.bloat), [...flesh].sort((a, b) => lean(b) - lean(a)).find((x) => !x.bloat)]) {
      const P = heroPlanOf(heroRecord(zombie(c.build)));
      // (measured at the chest, clear of the belly's swell)
      const top = (p) => seg(p, 'torso').stations.at(-2).r, kT = r(top(P)) / r(top(living)), kL = r(seg(P, 'shankR').rA) / r(seg(living, 'shankR').rA);
      expect(kT / kL).toBeLessThan(EVEN_RATIO * 1.02);
      expect(kL / kT).toBeLessThan(EVEN_RATIO * 1.02);
      const want = (c.waste.trunk * (c.bloat?.trunk ?? 1)) * (c.waste.limbs * (c.bloat?.limbs ?? 1));
      expect(kT * kL).toBeCloseTo(want, 2);
    }
  });
});

describe('the skeleton on the tiered body', () => {
  const bone = (pred) => Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === 'bone' && pred(c));
  const skeleton = (build, seed = 3) => ({ form: 'tiered', cast: 'male', palette: { Skin: '#d6cfbd' }, undead: { form: 'skeleton', build, seed } });
  it('a skeleton lineage reaches the hero door; its rest the card\'s, its jaw hung in its idle', () => {
    const sheet = rollEgocube({ facets: { ancestry: 'skeleton', build: 'canonical', role: 'frontline' }, seed: 3 });
    expect(sheet.ancestry.door).toBe('hero');
    const [, card] = bone((c) => (c.jaw ?? 0) > 0);
    const H = heroRecord(skeleton(card.build));
    expect(H.gesture.hinge).toBe(card.lean);
    expect(H.clips.idle[0].jaw).toBe(card.jaw);
  });
  it('its bones on the hero\'s landmarks: no flesh, no head card; a spine, an egg of ribs, a pelvis, every limb its bone', () => {
    const [, card] = bone((c) => c.build === 'canonical');
    const P = heroPlanOf(heroRecord(skeleton(card.build))), names = new Set(P.segments.map((s) => s.name));
    for (const gone of ['shoulderBallR', 'elbowBridgeR', 'kneeBridgeR', 'pectoralR']) expect(names.has(gone)).toBe(false);
    expect((P.include ?? []).some((x) => x.name === 'head')).toBe(false);
    for (const n of ['spineLow', 'sternum', 'clavR', 'iliumR', 'pubisR', 'braincase', 'mandibleR', 'thighR', 'shankR', 'footR', 'handR', 'index1R', 'thumb3R']) expect(names.has(n)).toBe(true);
    expect([...names].filter((n) => /^(lumbar|thoracic|cervical)\d+$/.test(n)).length).toBeGreaterThan(15);
    // the ribs an egg: the top rib narrower than the cage's widest, each falling to the front
    const ribs = P.segments.filter((s) => /^rib\dR$/.test(s.name)), wide = (s) => Math.max(...s.stations.map((st) => st.at[0]));
    expect(wide(ribs[0])).toBeLessThan(Math.max(...ribs.map(wide)) * 0.8);
    for (const rb of ribs) expect(rb.stations.at(-1).at[2]).toBeLessThan(rb.stations[0].at[2]);
    // a limb's bone rides the hero's own bone; a finger's phalanx its phalanx's; the jaw the skull's hinge
    expect(P.segments.find((s) => s.name === 'shankR').bind.bone).toBe('shankR');
    expect(P.segments.find((s) => s.name === 'index2R').bind.bone).toBe('index2R');
    expect(P.rig.joints.jawHinge.rides).toBe('head');
    expect(P.segments.find((s) => s.name === 'mandibleR').bind.bone).toBe('jaw');
    // the dials keep only parts the skeleton has, and the plan builds
    for (const d of Object.values(P.dials)) for (const p of d.parts ?? []) expect(names.has(p.replace('$S', 'R')) || names.has(p.replace(/L$/, 'R'))).toBe(true);
    expect(() => expandPlan(P)).not.toThrow();
  });
  it('the card\'s bone weights read: the heaviest skeleton\'s femur thicker than the lightest\'s', () => {
    const cards = Object.values(UNDEAD_CARDS).filter((c) => c.form === 'bone'), heavy = cards.reduce((a, b) => (b.bones.shaft > a.bones.shaft ? b : a)), light = cards.reduce((a, b) => (b.bones.shaft < a.bones.shaft ? b : a));
    const plan = heroPlanOf(heroRecord({ form: 'tiered', cast: 'male' })), mid = (c) => r(heroSkeleton(plan, c).segments.find((s) => s.name === 'thighR').rMid);
    expect(mid(heavy)).toBeGreaterThan(mid(light) * 1.5);
  });
});
