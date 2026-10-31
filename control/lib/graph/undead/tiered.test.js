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
import { undeadPicks } from './tiered.js';
import { BARE_CUTS, LOSS_CUTS } from './tiered-layers.js';
import { expandLayeredManifest } from '../../mcp/tools/layered.js';

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

describe('the layers on the tiered body', () => {
  const dead = (form, layers, build = 'canonical', seed = 3) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: form === 'zombie' ? '#9a9a90' : '#d6cfbd' }, undead: { form, build, seed, layers } });
  const groups = (P, g) => P.segments.filter((s) => s.group === g);
  it('shreds hang from the hero\'s trunk, a skeleton\'s or a corpse\'s, clear of the body under them', () => {
    for (const form of ['skeleton', 'zombie']) {
      const H = dead(form, ['shreds']), P = heroPlanOf(H), C = groups(P, 'Cloth');
      expect(C.some((s) => s.name.startsWith('shredHips'))).toBe(true);
      expect(P.palette.Cloth).toBeTruthy();
      // (the hip band from the hips, not the arms' span: no rag's top further out than the hip's own half width × 1.6)
      const hipX = Math.abs(P.joints.hip[0]);
      for (const s of C.filter((x) => x.name.startsWith('shredHips'))) for (const p of Object.values(s.stations[0].points)) expect(Math.abs(p[0])).toBeLessThan(hipX * 2.2);
      expect(() => expandPlan(P)).not.toThrow();
    }
  });
  it('decayed lays gaunt flesh back on the hero\'s skeleton: inside the cage, sinew on its limbs', () => {
    const P = heroPlanOf(dead('skeleton', ['decayed'])), F = groups(P, 'Flesh');
    const T = F.find((s) => s.name === 'fleshTorso'), ribX = Math.max(...P.segments.filter((s) => /^rib\dR$/.test(s.name)).flatMap((s) => s.stations.map((st) => st.at[0])));
    expect(T).toBeDefined();
    for (const st of T.stations) expect(st.r[0]).toBeLessThan(ribX);
    // (the sinew rides the hero's own limb bones: the shin is its shank)
    expect(F.filter((s) => s.kind === 'segment').every((s) => /^(thigh|shank|upperArm|foreArm)[RL]$|^neck$/.test(s.bind.bone))).toBe(true);
    expect(() => expandPlan(P)).not.toThrow();
  });
  it('bared lays a limb\'s bones on its side, cuts that side\'s flesh from the recipe, the other side whole', () => {
    // (a seed whose pick bares a limb word)
    const H = [1, 2, 3, 4, 5, 6, 7, 8].map((sd) => dead('zombie', ['bared'], 'heroic', sd)).find((h) => undeadPicks(h).bared.some((x) => BARE_CUTS[x.part]));
    const { part, side } = undeadPicks(H).bared.find((x) => BARE_CUTS[x.part]), other = side === 'R' ? 'L' : 'R';
    const P = heroPlanOf(H), R = expandLayeredManifest({ kind: 'layered', hero: H, plan: P }).recipe;
    const bones = groups(P, 'Bone').filter((s) => s.name.startsWith('bone'));
    expect(bones.length).toBeGreaterThan(0);
    for (const b of bones) { expect(b.name.endsWith(side)).toBe(true); expect(b.bind.bone.endsWith(side)).toBe(true); expect(b.mirror).toBe(null); }
    const first = BARE_CUTS[part].find((n) => R.parts[`${n}${other}`]);
    expect(R.parts[`${first}${side}`]).toBeUndefined();
    expect(R.parts[`${first}${other}`]).toBeDefined();
    for (const d of Object.values(R.dials)) for (const n of d.parts ?? []) expect(R.parts[n] || n.includes('.')).toBeTruthy();
  });
  it('a bared skull is the head: the head include and its dial gone, the rig\'s jaw the skull\'s, the head hung less', () => {
    const H = [1, 2, 3, 4, 5, 6, 7, 8].map((sd) => dead('zombie', ['bared'], 'canonical', sd)).find((h) => undeadPicks(h).bared.some((x) => x.part === 'skull'));
    const P = heroPlanOf(H);
    expect((P.include ?? []).some((x) => x.name === 'head')).toBe(false);
    expect(P.segments.some((s) => s.name === 'braincase')).toBe(true);
    expect(P.rig.joints.jawHinge.rides).toBe('head');
    for (const d of Object.values(P.dials)) for (const n of d.parts ?? []) expect(n).not.toBe('cranium');
    const plain = heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'zombie', build: 'canonical', seed: H.undead.seed } });
    expect(Math.abs(H.gesture.head.pitch)).toBeLessThan(Math.abs(plain.gesture.head.pitch));
    expect(() => expandPlan(P)).not.toThrow();
  });
});

describe('a loss and a heavy arm on the tiered body', () => {
  const H0 = (form, build, seed) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: '#9a9a90' }, undead: { form, build, seed } });
  it('a seeded loss takes one side\'s hand or forearm from the skin, the other side and the rig whole', () => {
    for (const form of ['zombie', 'skeleton']) {
      const [, card] = Object.entries(UNDEAD_CARDS).find(([, c]) => (form === 'zombie' ? c.form === 'flesh' : c.form === 'bone') && c.loss);
      const H = Array.from({ length: 16 }, (_, i) => H0(form, card.build, i + 1)).find((h) => undeadPicks(h).lost);
      expect(H).toBeDefined();
      const { part, side } = undeadPicks(H).lost, other = side === 'R' ? 'L' : 'R';
      const P = heroPlanOf(H), R = expandLayeredManifest({ kind: 'layered', hero: H, plan: P }).recipe;
      expect(R.parts[`hand${side}`]).toBeUndefined();
      expect(R.parts[`hand${other}`]).toBeDefined();
      if (part === 'foreArm') expect(R.parts[`foreArm${side}`]).toBeUndefined();
      expect(R.parts[`upperArm${side}`]).toBeDefined();
      expect(JSON.stringify(R.rig ?? P.rig)).toContain(`hand${side}`);
      expect(LOSS_CUTS[part]).toContain('hand');
    }
  });
  it('a heavy arm swells its side and withers the other, ring by ring', () => {
    const [, card] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.heavy);
    const H = H0('zombie', card.build, 3), R = expandLayeredManifest({ kind: 'layered', hero: H, plan: heroPlanOf(H) }).recipe;
    const span = (p) => { const P = Object.values(p.stations[2].points), c = [0, 1, 2].map((i) => P.reduce((t, q) => t + q[i], 0) / P.length); return Math.max(...P.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]))); };
    const big = card.heavy.side, small = big === 'R' ? 'L' : 'R';
    expect(span(R.parts[`upperArm${big}`]) / span(R.parts[`upperArm${small}`])).toBeCloseTo(card.heavy.k ** 2, 1);
  });
});

describe('the armed and the adorned', () => {
  const dead = (form, build, layers, seed = 3) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: '#d6cfbd' }, undead: { form, build, seed, layers } });
  it('armed: the card\'s weapons are the hero\'s gear, the operator\'s own over them, a lost hand\'s moved to the free one', () => {
    const [, card] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === 'bone' && c.armed?.right && c.armed?.left);
    const H = dead('skeleton', card.build, ['armed']);
    expect(H.gear.right.item).toBe(card.armed.right.item);
    expect(H.gear.left.item).toBe(card.armed.left.item);
    expect(dead('skeleton', card.build, []).gear).toBeUndefined();
    const own = heroRecord({ form: 'tiered', cast: 'male', gear: { right: { type: 'equipment', item: 'dagger' } }, undead: { form: 'skeleton', build: card.build, seed: 3, layers: ['armed'] } });
    expect(own.gear.right.item).toBe('dagger');
    // (a one-handed card whose loss takes its weapon hand: the weapon moves over)
    const [, one] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.loss && c.armed?.right && !c.armed.left);
    const form = one.form === 'bone' ? 'skeleton' : 'zombie';
    const lostR = Array.from({ length: 40 }, (_, i) => dead(form, one.build, ['armed'], i + 1)).find((h) => undeadPicks(h).lost?.side === 'R');
    expect(lostR).toBeDefined();
    expect(lostR.gear.right).toBeUndefined();
    expect(lostR.gear.left.item).toBe(one.armed.right.item);
  });
  it('adorned: the armour sized to the living body, on a skeleton a shell clear of its ribs, each piece on its bone', () => {
    const [, card] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === 'bone' && Object.values(c.adorned ?? {}).every((p) => p >= 0.8) && c.adorned.pauldrons);
    const P = heroPlanOf(dead('skeleton', card.build, ['adorned'])), M = P.segments.filter((s) => s.group === 'Metal');
    for (const n of ['helm', 'cuirass', 'pauldronR', 'pauldronL']) expect(M.some((s) => s.name === n)).toBe(true);
    const ribX = Math.max(...P.segments.filter((s) => /^rib\dR$/.test(s.name)).flatMap((s) => s.stations.map((st) => st.at[0])));
    for (const st of M.find((s) => s.name === 'cuirass').stations) expect(st.r[0]).toBeGreaterThan(ribX);
    expect(M.find((s) => s.name === 'helm').bind.bone).toBe('head');
    expect(M.find((s) => s.name === 'pauldronL').bind.bone).toBe('upperArmL');
    expect(P.palette.Metal).toBeTruthy();
    expect(() => expandPlan(P)).not.toThrow();
  });
  it('the revenant and the risen reach the hero door armed and adorned, their plans building', () => {
    for (const ancestry of ['revenant', 'risen']) {
      const sheet = rollEgocube({ facets: { ancestry, build: 'canonical', role: 'frontline' }, seed: 3 });
      const H = heroRecord(planFromSheet(sheet).create.spec), P = heroPlanOf(H);
      expect(H.undead.layers).toEqual(expect.arrayContaining(['adorned', 'armed']));
      expect(Object.keys(H.gear ?? {}).length).toBeGreaterThan(0);
      expect(() => expandLayeredManifest({ kind: 'layered', hero: H, plan: P })).not.toThrow();
    }
  });
});

describe('the open flesh: half-bone limbs and torn edges in layers', () => {
  const corpse = (build, seed) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: '#9a9a90' }, undead: { form: 'zombie', build, seed, layers: ['bared'] } });
  const [, card] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.bared?.parts.some((p) => p.startsWith('half')) && c.bared.parts.includes('ribs') && c.bared.parts.some((p) => ['foreArm', 'shin', 'thigh', 'arm'].includes(p)));
  const runs = Array.from({ length: 12 }, (_, i) => corpse(card.build, i + 1));
  it('a half word lays the bone its whole length and a sleeve of skin over one end, its meat running on past the skin', () => {
    const H = runs.find((h) => undeadPicks(h).bared.some((x) => x.part.startsWith('half')));
    const { part, side } = undeadPicks(H).bared.find((x) => x.part.startsWith('half'));
    const P = heroPlanOf(H), limb = { halfForeArm: 'ForeArm', halfUpperArm: 'UpperArm', halfThigh: 'Thigh', halfShin: 'Shank' }[part];
    const skin = P.segments.find((s) => s.name === `sleeve${limb}Skin${side}`), meat = P.segments.find((s) => s.name === `sleeve${limb}Meat${side}`), bone = P.segments.find((s) => s.name === `bone${limb}${side}`);
    expect(skin.group).toBe('Skin'); expect(meat.group).toBe('Meat'); expect(bone.group).toBe('Bone');
    // the layers nest: the meat narrower than the skin, the bone thinner than the meat; the meat longer than the skin
    expect(r(meat.rA)).toBeLessThan(r(skin.rA));
    expect(r(bone.rMid)).toBeLessThan(r(meat.rB));
    const len = (s) => Math.hypot(...P.joints[s.to].map((v, i) => v - P.joints[s.from][i]));
    expect(len(meat)).toBeGreaterThan(len(skin));
    expect(P.palette.Meat).toBeTruthy();
    expect(() => expandPlan(P)).not.toThrow();
  });
  it('a whole bared limb leaves the flesh at a torn edge: a collar of meat on the bone past the skin', () => {
    const H = runs.find((h) => undeadPicks(h).bared.some((x) => ['foreArm', 'shin', 'thigh', 'arm'].includes(x.part)));
    const P = heroPlanOf(H), edges = P.segments.filter((s) => s.name.startsWith('edge'));
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) { expect(e.group).toBe('Meat'); expect(r(e.rB)).toBeLessThan(r(e.rA)); }
  });
  it('bared ribs show through an open wound of meat on their side', () => {
    const H = runs.find((h) => undeadPicks(h).bared.some((x) => x.part === 'ribs')), side = undeadPicks(H).bared.find((x) => x.part === 'ribs').side;
    const w = heroPlanOf(H).segments.find((s) => s.name === `wound${side}`);
    expect(w.group).toBe('Meat');
    for (const st of w.stations) expect(Math.sign(st.at[0])).toBe(side === 'R' ? 1 : -1);
  });
});

describe('the spots: flesh gone in patches', () => {
  const spotted = (build, seed, layers = ['bared', 'spots']) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: '#9a9a90' }, undead: { form: 'zombie', build, seed, layers } });
  const [, card] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.spots && c.bared?.parts.includes('skull'));
  const runs = Array.from({ length: 10 }, (_, i) => spotted(card.build, i + 1));
  it('patches of meat on the flesh the corpse still has, some deep to the bone, none on a limb gone to bone', () => {
    const H = runs[0], P = heroPlanOf(H), body = P.segments.filter((s) => /^spot\d+$/.test(s.name));
    expect(body.length).toBeGreaterThanOrEqual(card.spots.count[0]);
    for (const s of body) { expect(s.group).toBe('Meat'); expect(s.kind).toBe('rings'); }
    expect(runs.some((h) => heroPlanOf(h).segments.some((s) => /^spot\d+Bone$/.test(s.name) && s.group === 'Bone'))).toBe(true);
    const bared = new Set(undeadPicks(H).bared.flatMap(({ part, side }) => ({ arm: ['upperArm', 'foreArm'], foreArm: ['foreArm'], halfForeArm: ['foreArm'], halfUpperArm: ['upperArm'], thigh: ['thigh'], halfThigh: ['thigh'], shin: ['shank'], halfShin: ['shank'] }[part] ?? []).map((l) => `${l}${side}`)));
    for (const s of body) expect(bared.has(s.bind.bone)).toBe(false);
    // a patch on the torso hugs it: its rim's points within a few centimetres of the trunk's own section
    const T = P.segments.find((s) => s.name === 'torso'), onT = body.filter((s) => s.bind.bone === 'torso');
    for (const s of onT) for (const p of Object.values(s.stations[1].points)) {
      const st = T.stations.reduce((a, b) => (Math.abs(b.z - p[2]) < Math.abs(a.z - p[2]) ? b : a)), [rx, ry] = st.r;
      expect(Math.hypot(p[0] / rx, (p[1] - (st.yc ?? 0)) / ry)).toBeLessThan(1.35);
    }
    expect(() => expandPlan(P)).not.toThrow();
  });
  it('the face: bone through a corpse\'s own head, or flesh left on a bared skull, each on its own surface', () => {
    const withSkull = runs.find((h) => undeadPicks(h).bared.some((x) => x.part === 'skull')), withHead = runs.find((h) => !undeadPicks(h).bared.some((x) => x.part === 'skull'));
    const S = heroPlanOf(withSkull).segments, F = heroPlanOf(withHead).segments;
    expect(S.some((s) => /^skullSkin\d+$/.test(s.name) && s.group === 'Skin')).toBe(true);
    expect(S.some((s) => /^skullMeat\d+$/.test(s.name) && s.group === 'Meat')).toBe(true);
    expect(F.some((s) => /^faceBone\d+$/.test(s.name) && s.group === 'Bone' && s.bind.bone === 'head')).toBe(true);
  });
  it('over flesh only; absent, no patch; the rotting lineage lays it', () => {
    expect(heroPlanOf(spotted(card.build, 3, ['bared'])).segments.some((s) => /^spot/.test(s.name))).toBe(false);
    expect(() => heroPlanOf(heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'skeleton', build: 'canonical', seed: 3, layers: ['spots'] } }))).toThrow(/spots layer lies over flesh/);
    const sheet = rollEgocube({ facets: { ancestry: 'rotting', build: 'canonical', role: 'frontline' }, seed: 3 });
    expect(sheet.ancestry.layers).toEqual(['bared', 'spots']);
  });
});

describe('the attack skeleton', () => {
  const ravager = (build = 'canonical', seed = 3) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: '#d6cfbd' }, undead: { form: 'skeleton', build, seed, layers: ['attack'] } });
  it('every long bone a column of segments as the spine is, the forearm\'s and the shin\'s two side by side, the shafts a core', () => {
    const P = heroPlanOf(ravager()), plain = heroPlanOf(heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'skeleton', build: 'canonical', seed: 3 } }));
    for (const limb of ['thigh', 'shank', 'upperArm', 'foreArm']) {
      const col = P.segments.filter((s) => new RegExp(`^${limb}Col\\d+R$`).test(s.name));
      expect(col.length).toBeGreaterThan(5);
      for (const s of col) { expect(s.bind.bone).toBe(`${limb}R`); expect(s.mirror).toBe('name'); }
      // the segments climb the limb in order, from its first joint to its last
      const J = P.joints, [from, to] = { thigh: ['hip', 'knee'], shank: ['knee', 'ankle'], upperArm: ['shoulder', 'elbow'], foreArm: ['elbow', 'wrist'] }[limb];
      const d = J[to].map((v, i) => v - J[from][i]), along = (s) => s.stations[0].at.reduce((t, v, i) => t + (v - J[from][i]) * d[i], 0);
      expect(col.map(along)).toEqual([...col.map(along)].sort((a, b) => a - b));
      expect(r(P.segments.find((s) => s.name === `${limb}R`).rMid)).toBeLessThan(r(plain.segments.find((s) => s.name === `${limb}R`).rMid));
    }
    for (const limb of ['shank', 'foreArm']) expect(P.segments.some((s) => new RegExp(`^${limb}Twin\\d+R$`).test(s.name))).toBe(true);
    for (const limb of ['thigh', 'upperArm']) expect(P.segments.some((s) => new RegExp(`^${limb}Twin\\d+R$`).test(s.name))).toBe(false);
    expect(() => expandPlan(P)).not.toThrow();
  });
  it('each finger ends in a claw on its last bone; the stand a crouch to strike, the elbows bent, the jaw dropped', () => {
    const H = ravager(), P = heroPlanOf(H);
    for (const d of ['thumb', 'index', 'middle', 'ring', 'little']) expect(P.segments.find((s) => s.name === `${d}ClawR`).bind.bone).toBe(`${d}3R`);
    expect(H.gesture.hinge).toBeGreaterThan(15);
    expect(H.gesture.elbowR).toBeGreaterThan(45);
    expect(H.clips.idle[0].jaw).toBeGreaterThan(0);
  });
  it('over bone only; the ravager lineage lays it; a skeleton without it unchanged', () => {
    expect(() => heroPlanOf(heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'zombie', build: 'canonical', seed: 3, layers: ['attack'] } }))).toThrow(/attack layer lies over bone/);
    const sheet = rollEgocube({ facets: { ancestry: 'ravager', build: 'canonical', role: 'frontline' }, seed: 3 });
    expect(sheet.ancestry).toMatchObject({ door: 'hero', form: 'skeleton', layers: ['attack'] });
    expect(heroPlanOf(heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'skeleton', build: 'canonical', seed: 3 } })).segments.some((s) => /Col\d+R$/.test(s.name))).toBe(false);
  });
});
