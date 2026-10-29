import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { planFromSheet as planFromSheetOf, shade, legible, BODY_MIN_L, EYE_ACCENTS, LOCK_KINDS, FUR_SPOTS } from './plan.js';
import { validateBody } from '../polygonizer/station-loft-body.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';
import { LINEAGES, HUMAN_IDS } from './ancestry.js';
import { HEAD_LIBRARY, HEAD_IDS, headPlan, headFor } from '../creature-heads/index.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { validateHead, headFromPlan } from '../polygonizer/station-loft-head.js';
import { validateHeroSpec } from '@/lib/mcp/tools/layered.js';
// (these read the sixth generation's procedures: a beast-kin sheet asks for the creature biped, plan.js `gen: 6`; the
// seventh, on the tiered body, is beast/route.test.js's)
const planFromSheet = (sheet, opts = {}) => planFromSheetOf(sheet, { gen: 6, ...opts });

describe('the creature head library', () => {
  it('holds heads that read as plan data, each serving its people', () => {
    for (const id of HEAD_IDS) {
      const plan = headPlan(id);
      expect(() => validateHead(plan), id).not.toThrow();
      expect(() => headFromPlan(plan), id).not.toThrow();
      expect(plan.landmarks.nape, id).toHaveLength(3);
      for (const lineage of HEAD_LIBRARY[id].serves) expect(LINEAGES[lineage], `${id} serves ${lineage}`).toBeTruthy();
    }
  });
  it('hands out a fresh copy, a palette over the head\'s own, and a head per people', () => {
    const a = headPlan('wolf'), b = headPlan('wolf', { palette: { Skull: '#ffffff' } });
    expect(b.palette.Skull).toBe('#ffffff');
    expect(a.palette.Skull).not.toBe('#ffffff');
    expect(headPlan('wolf').palette.Skull).toBe(a.palette.Skull);
    expect(headFor('lupine')).toEqual({ id: 'wolf', provisional: false });
    expect(headFor('feline')).toEqual({ id: 'felid', provisional: false });
    expect(headFor('orcish')).toBe(null);
    expect(() => headPlan('cat')).toThrow(/unknown head 'cat'.*wolf/);
    expect(() => headPlan('wolf', { palette: { Skull: 'white' } })).toThrow(/#rrggbb/);
  });
});

/** a people the library draws no head for (the stand-in's case) */
const SELKIE = { reads: 'selkie (seal-kin)', humanity: [0.3, 0.5], cover: { grey: '#6a6e72' }, cues: [{ at: 1, ch: 'structure', line: 'a seal\'s round face', derives: ['door = creature'] }] };

describe('a head derived from the nearest skull', () => {
  const rows = (id, part = 'cranium') => headPlan(id).parts[part].rows;
  it('moves the rows and keeps their names and slots, so everything addressed by station and slot still lands', () => {
    for (const id of HEAD_IDS.filter((x) => HEAD_LIBRARY[x].derived)) {
      const from = rows(HEAD_LIBRARY[id].from);
      expect(rows(id).map((r) => r[0]), id).toEqual(from.map((r) => r[0]));
      expect(rows(id).map((r) => Object.keys(r[2])), id).toEqual(from.map((r) => Object.keys(r[2])));
      expect(JSON.stringify(rows(id)), id).not.toBe(JSON.stringify(from));
    }
  });
  it('a felid: the wolf\'s muzzle pulled in, the skull rounder; a beak: the muzzle drawn to a point', () => {
    const tip = (id) => headPlan(id).parts.cranium.caps.tip[1], width = (id, i) => rows(id)[i][2].cheek[0];
    expect(tip('felid')).toBeLessThan(0.6 * tip('wolf'));
    expect(width('felid', 2)).toBeGreaterThan(width('wolf', 2));
    const last = rows('beaked').length - 1;
    expect(width('beaked', last) / width('beaked', 2)).toBeLessThan(0.15);
    expect(headPlan('beaked').ornaments.some((o) => o.kind === 'teeth')).toBe(false);
  });
  it('a derived head\'s own groups keep their colour under the character\'s skin', () => {
    const bird = planFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'avian' } })).create.spec.plan.heads[0].plan;
    expect(bird.palette.Snout).toBe(headPlan('beaked').palette.Snout);
  });
});

describe('a rolled beast\'s value', () => {
  it('a black coat is drawn deep, never vanishing on the dark stage: its hue kept, its value lifted to the floor', () => {
    expect(hexLch(legible('#1e1c1c'))[0]).toBeCloseTo(BODY_MIN_L, 0);
    expect(legible('#8a8a88')).toBe('#8a8a88');
  });
  it('the eye is the face\'s accent, a people\'s own colour; a dressed beast\'s underside is a pale throat and belly', () => {
    const P = planFromSheet(rollEgocube({ seed: 4, facets: { ancestry: 'feline' } }), { dress: 'designed' }).create.spec.plan;
    expect(EYE_ACCENTS.feline).toContain(P.heads[0].plan.palette.Iris);
    expect(P.style.drawn.markings).toEqual({ pattern: 'both', ventral: 'panel' });
  });
});

describe('a rolled beast\'s topology, from its frame\'s notes', () => {
  const plan = (a, seed, humanity) => planFromSheet(rollEgocube({ seed, facets: { ancestry: a, ...(humanity ? { humanity } : {}) } })).create.spec.plan;
  it('a cat\'s thin tail is carried lifted, a heavy tail held level: neither hangs to the floor as a third leg', () => {
    for (const [a, seed] of [['feline', 4], ['draconic', 3]]) {
      const P = plan(a, seed), tip = P.joints.tail5[2], root = P.joints.tail0[2];
      expect(tip, a).toBeGreaterThan(0.5 * root);
    }
  });
  it('wings on the arms are flight feathers on the hand and forearm; a second pair of arms is rigged under the first', () => {
    const bird = planFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'avian', humanity: 0.3 } }));
    expect(bird.create.spec.plan.segments.filter((g) => /^wing/.test(g.name))).toHaveLength(5);
    expect(bird.ledger.find((r) => /wings on the arms/.test(r.line)).at).toMatch(/wingPrim/);
    const bug = plan('insectoid', 2);
    expect(bug.segments.map((g) => g.name)).toEqual(expect.arrayContaining(['upperArm2R', 'foreArm2R', 'hand2R']));
    expect(bug.rig.bones.find((b) => b.perSide).perSide.map((b) => b.id)).toContain('upperArm2$S');
    expect(bug.dials.lean.parts).toContain('upperArm2L');
    expect(() => expandPlan(bug)).not.toThrow();
  });
});

describe('the shapes that break the outline', () => {
  const roll = (facets, lineages) => planFromSheet(rollEgocube({ seed: 2, facets, ...(lineages ? { lineages } : {}) }), { dress: 'designed' }).create.spec.plan;
  it('lie along the body\'s contour unless they stand for contrast: a coat\'s tufts, a bird\'s feathers, quills; a crest of spines stands', () => {
    const wolf = roll({ ancestry: 'lupine', humanity: 0.24 }), bird = roll({ ancestry: 'avian', humanity: 0.2 }), dragon = roll({ ancestry: 'draconic', humanity: 0.2 });
    for (const L of [...wolf.body.locks, ...bird.body.locks.filter((x) => x.id !== 'crest')]) { expect(L.flow, L.id).toBeUndefined(); expect(L.share).toBe(true); }
    expect(wolf.body.locks.find((L) => L.id === 'ruff').against).toBe(true);   // a trunk's coat lies down it
    expect(bird.body.locks.every((L) => L.profile === 'feather')).toBe(true);
    const spines = dragon.body.locks.find((L) => L.id === 'spines');
    expect(spines.profile).toBe('spine'); expect(spines.sides).toEqual(['R']); expect(spines.flow).toBeTruthy(); expect(spines.lift).toBeGreaterThan(LOCK_KINDS.tuft.lift);
    const kin = roll({ ancestry: 'quill', humanity: 0.22 }, { quill: { reads: 'porcupine-kin', humanity: [0.2, 0.5], cover: { brown: '#5a4632' }, cues: [{ at: 1, ch: 'cover', line: 'quills over the back', plan: { cover: { kind: 'quills', where: [] } } }, { at: 1, ch: 'structure', line: 'a blunt muzzle', derives: ['door = creature'] }] } });
    expect(kin.body.locks.map((L) => L.profile)).toEqual(['quill']);
    expect(() => expandPlan(kin)).not.toThrow();
  });
  it('locks in layers lie in a brick (an offset layer one lock fewer, in the gaps); a coat\'s are clumps; none under what is worn', () => {
    const wolf = planFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'lupine' } })).create.spec.plan;
    const back = { id: 'back', parts: ['torso'], share: true, s: [0.2, 0.9], t: [0.6, 1], layers: { overlap: -0.9 }, length: [0.02, 0.02], width: 0.025, profile: 'bump', lift: 1, group: ['Fur'] };
    const perRow = {}; for (const n of Object.keys(expandPlan({ ...wolf, adorn: [], body: { ...wolf.body, locks: [back] } }).parts).filter((x) => /^lock\.back\.torso\.R\./.test(x))) { const j = n.split('.').at(-1); perRow[j] = (perRow[j] ?? 0) + 1; }
    const counts = Object.keys(perRow).sort((a, b) => a - b).map((j) => perRow[j]);
    expect(counts.length).toBeGreaterThan(1); counts.forEach((c, j) => expect(c).toBe(counts[0] - (j % 2)));
    // a clump: the lock and its fanned blades, by name
    const ruff = Object.keys(expandPlan(wolf).parts).filter((n) => /^lock\.ruff\.torso\.R\.0\.0(\.c\d)?$/.test(n));
    expect(ruff.length).toBe(wolf.body.locks.find((t) => t.id === 'ruff').clump);
    // the same window on the forearm, bare and under a bracer: the bracer's stretch grows none
    const lock = { id: 'test', parts: ['foreArmR'], share: true, s: [0.05, 0.95], t: [0.3, 1], layers: true, length: [0.06, 0.05], width: 0.02, group: ['Fur'] };
    const bare = { ...wolf, adorn: [], body: { ...wolf.body, locks: [lock] } }, n = (plan) => Object.keys(expandPlan(plan).parts).filter((x) => x.startsWith('lock.test')).length;
    const worn = { ...bare, adorn: [{ id: 'bracer', mode: 'shell', part: 'foreArmR', share: true, s: [0.4, 0.95], t: 'wrap', mugen: 0.012, thick: 0.01, group: 'Leather', signature: { kind: 'studs', r: 0.008, h: 0.004, count: 3, m: 6, group: 'Leather' } }] };
    expect(n(worn)).toBeGreaterThan(0); expect(n(worn)).toBeLessThan(n(bare));
  });
  it('a reptile\'s raised scales are bumps: osteoderms down the back, tubercles on the limbs, standing apart', () => {
    const dragon = planFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'draconic', humanity: 0.3 } })).create.spec.plan;
    const bumps = dragon.body.locks.filter((L) => L.profile === 'bump');
    expect(bumps.map((L) => L.id)).toEqual(expect.arrayContaining(['osteoderms', 'tubercles']));
    expect(bumps.every((L) => L.layers.overlap < 0 && L.lift === 1)).toBe(true);
    expect(Object.keys(expandPlan(dragon).parts).filter((x) => x.startsWith('lock.osteoderms')).length).toBeGreaterThan(6);
  });
  it('a lock\'s section is a named profile', () => {
    const parts = { torso: {} }, K = { parts: ['torso'], s: [0, 1], t: [0, 1], group: ['Fur'], length: 0.1, width: 0.02 };
    expect(validateBody({ locks: [{ ...K, profile: 'feather' }] }, parts)).toEqual([]);
    expect(validateBody({ locks: [{ ...K, profile: 'leaf' }] }, parts)[0]).toMatch(/profile: 'blade' \| 'feather' \| 'quill' \| 'spine' \| 'bump'/);
    expect(validateBody({ locks: [{ ...K, layers: { overlap: 2 } }] }, parts)[0]).toMatch(/layers/);
  });
});

describe('planFromSheet', () => {
  it('compiles every people into a call its door accepts (seeds 1–2; the deep sweep takes 1–10) into a call its door accepts', () => {
    for (const anc of [...Object.keys(LINEAGES), ...HUMAN_IDS]) for (let seed = 1; seed <= 2; seed++) {
      const sheet = rollEgocube({ seed, facets: { ancestry: anc } }), p = planFromSheet(sheet);
      expect(p.door, `${anc} ${seed}`).toBe(sheet.ancestry.door);
      if (p.door === 'creature') {
        expect(p.create.as).toBe('creature');
        expect(() => expandPlan(p.create.spec.plan), `${anc} seed ${seed}`).not.toThrow();
      } else {
        expect(p.create.as).toBe('hero');
        expect(validateHeroSpec(p.create.spec), `${anc} seed ${seed}`).toEqual([]);
      }
    }
  }, 60000);
  it('writes the Pale Warden\'s thesis from its roll, as it was written by hand', () => {
    const p = planFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'lupine' } }));
    expect(p.thesis).toBe('barrel · digitigrade biped, leaning forward · long muzzle (wolf) · a ruff of fur at the neck and shoulders · 2 m');
    const plan = p.create.spec.plan;
    expect(plan.heads[0].plan.name).toBe('wolf');
    // the coat as shapes that break the outline (locks), where the warden's roll has fur
    // clumps where fur breaks the outline, then one to three choice spots for variety (by the seed), the tail's brush last
    const ids = plan.body.locks.map((t) => t.id), spots = ids.slice(3, -2);
    expect([...ids.slice(0, 3), ...ids.slice(-2)]).toEqual(['ruff', 'ruffNeck', 'thigh', 'tail', 'cheeks']);
    // the cheeks are clumps, the head's tiles below the cheek row gone
    expect(plan.heads[0].plan.regions.tiles?.every((T) => T.t[0] < 3) ?? true).toBe(true);
    expect(spots.length).toBeGreaterThanOrEqual(1); expect(spots.length).toBeLessThanOrEqual(3); expect(spots.every((x) => x in FUR_SPOTS)).toBe(true);
    expect(plan.body.locks.find((t) => t.id === 'ruff').clump).toBeGreaterThan(2);
    expect(plan.body.tiles).toBeUndefined();
    expect(plan.adorn.map((a) => a.id)).toEqual(expect.arrayContaining(['belt', 'cord', 'pack', 'satchelR', 'satchelL', 'wrapR', 'wrapL']));
    expect(plan.adorn.filter((a) => a.signature.group === 'Emblem')).toHaveLength(1);
    expect(p.after).toEqual([{ op: 'set', path: '/dials/lean', value: 18 }]);
  });
  it('wears the named library head, else the people\'s, else none and says so', () => {
    const dragon = planFromSheet(rollEgocube({ facets: { ancestry: 'draconic', humanity: 0.2 } }));
    expect(dragon.thesis).toMatch(/long snout \(dragon\)/);
    const bear = planFromSheet(rollEgocube({ facets: { ancestry: 'ursine', humanity: 0.3 } }));
    expect(bear.thesis).toMatch(/short muzzle \(bear\)/);
    const cat = planFromSheet(rollEgocube({ facets: { ancestry: 'feline', humanity: 0.4 } }));
    expect(cat.thesis).toMatch(/short muzzle \(felid\)/);
    const kin = planFromSheet(rollEgocube({ facets: { ancestry: 'selkie' }, lineages: { selkie: SELKIE } }));
    expect(kin.thesis).toMatch(/head pending \(the felid stands in\)/);
    expect(kin.ledger.filter((r) => r.channel === 'structure').every((r) => /no library head for selkie yet: the felid head stands in/.test(r.pending))).toBe(true);
  });
  it('scales a head authored in metres with its horns on it, and strips a stand-in to a neutral skull', () => {
    const dragon = planFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'draconic' } })).create.spec.plan.heads[0].plan;
    expect(dragon.ornaments.filter((o) => o.name === 'horn').map((o) => o.space)).toEqual(['head']);
    expect(dragon.units.scale).toBeLessThan(1);
    const kin = planFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'selkie' }, lineages: { selkie: SELKIE } })).create.spec.plan.heads[0].plan;
    expect(kin.ornaments.some((o) => o.kind === 'sweep' && o.name !== 'nose')).toBe(false);
    expect(kin.midline).toBeUndefined();
  });
  it('lands every note once, in the call or as pending with a reason', () => {
    for (const [anc, seed] of [['lupine', 3], ['draconic', 5], ['european', 2], ['infernal', 4]]) {
      const sheet = rollEgocube({ seed, facets: { ancestry: anc } }), p = planFromSheet(sheet);
      expect(p.ledger).toHaveLength(Object.values(sheet.notes).flat().length);
      for (const r of p.ledger) expect(Boolean(r.at) !== Boolean(r.pending), `${anc} ${r.line}`).toBe(true);
    }
    const tiefling = planFromSheet(rollEgocube({ seed: 4, facets: { ancestry: 'infernal' } }));
    expect(tiefling.door).toBe('hero');
    expect(tiefling.ledger.find((r) => /horns/.test(r.line)).pending).toMatch(/hero grammar/);
  });
  it('is pure: the same sheet, the same call', () => {
    const sheet = rollEgocube({ seed: 7, facets: { ancestry: 'draconic' } });
    expect(JSON.stringify(planFromSheet(sheet))).toBe(JSON.stringify(planFromSheet(sheet)));
  });
  it('writes the hair\'s wave only on a style that takes it: a free fall with a wave is the wavy fall, a crop takes none', () => {
    const textured = (sheet) => (sheet.notes.hair || []).some((n) => /^(wavy|curly|coily) hair$/.test(n.line));
    // (the first seed whose sheet reads a wave in the hair, a free woman's and a man's)
    const roll = (facets) => { for (let seed = 1; seed <= 40; seed++) { const sh = rollEgocube({ seed, facets: { age: 'adult', ancestry: HUMAN_IDS[0], ...facets } }); if (textured(sh)) return sh; } return null; };
    const fall = roll({ pole: 'female', order: 0.9 }), crop = roll({ pole: 'male', order: 0.5 });
    expect(fall && crop).toBeTruthy();
    expect(planFromSheet(fall).create.spec.hair).toMatchObject({ style: 'wavy', wave: expect.any(Number) });
    expect(planFromSheet(crop).create.spec.hair).toEqual({ style: 'crop' });
  });
  it('takes the hero door\'s amounts from the sheet\'s directions, inside the channel ranges', () => {
    const p = planFromSheet(rollEgocube({ brief: 'a weary paladin' }));
    expect(p.create.spec.expression.browTilt).toBeGreaterThan(0);
    expect(p.create.spec.gesture).toBe('guard');
    expect(shade('#808080', 0.5)).toBe('#c0c0c0');
    expect(shade('#808080', -0.5)).toBe('#404040');
  });
});
