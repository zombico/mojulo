import { describe, it, expect } from 'vitest';
import { rollMascot, readMascot, readMascotBrief, asksForMascot, accordOf, MASCOT_KEYS, HOOKS, ENERGIES, FORMS, PROMISES } from './mascot.js';
import { mascotPlan, mascotPlanFromSheet, mascotPalette, EYE_FORMS } from './mascot-form.js';
import { rollStored, egocubeCreate, egocubeNodes, readEgocubeKind, isMascotRoll } from './kind.js';
import { rollEgocube } from './egocube.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig } from '../polygonizer/station-loft-rig.js';
import { poseLayered } from '../polygonizer/hero-gesture.js';

const sheetOf = (facets, seed = 1) => rollMascot({ facets, seed });
const hueOf = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const hueGap = (a, b) => { const d = Math.abs(hueOf(a) - hueOf(b)) % 360; return Math.min(d, 360 - d); };

describe('the mascot sheet', () => {
  it('is pure: the same arguments, the same sheet', () => {
    const a = rollMascot({ brief: 'a speedy mascot', seed: 4 });
    expect(JSON.stringify(rollMascot({ brief: 'a speedy mascot', seed: 4 }))).toBe(JSON.stringify(a));
    expect(a.tuning).toBe('mascot');
    expect(Object.keys(a.facets)).toEqual(MASCOT_KEYS);
  });
  it('reads a familiar name as a style, and a later word wins its facet', () => {
    const s = rollMascot({ brief: 'sonic-like' });
    expect(s.facets).toMatchObject({ promise: 'speed', form: 'sprout', accent: 'spike', eyes: 'joined', hook: 'quills', extremities: 'gloves', energy: 'zippy', hue: 'blue' });
    expect(rollMascot({ brief: 'sonic-like but red' }).facets.hue).toBe('red');
    expect(rollMascot({ brief: 'sonic-like', facets: { hue: 'green' } }).facets.hue).toBe('green');   // an explicit facet wins the brief
    expect(readMascotBrief('a cartoony knight').unread).toEqual(['knight']);
  });
  it('knows when a brief asks for a mascot, and when a word only shapes one', () => {
    expect(asksForMascot('something cartoony')).toBe(true);
    expect(asksForMascot('a kirby-like blob')).toBe(true);
    expect(asksForMascot('a spiky blue thing')).toBe(false);
    expect(asksForMascot('a weary paladin')).toBe(false);
    expect(asksForMascot('a cute chibi knight')).toBe(false);
  });
  it('fixing one facet never moves another (every die is thrown)', () => {
    const a = sheetOf({}, 9), b = sheetOf({ hue: a.facets.hue === 'red' ? 'blue' : 'red' }, 9);
    if (a.attempt === 0 && b.attempt === 0) for (const k of MASCOT_KEYS.filter((x) => x !== 'hue')) expect(b.facets[k], k).toBe(a.facets[k]);
  });
  it('draws a fault again unless the operator asked for every facet in it', () => {
    const asked = sheetOf({ promise: 'comfort', accent: 'spike' });
    expect(asked.faults).toEqual([expect.objectContaining({ id: 'soft-spike', held: true })]);
    for (let seed = 1; seed <= 6; seed++) expect(sheetOf({ promise: 'comfort' }, seed).facets.accent, `seed ${seed}`).not.toBe('spike');
  });
  it('refuses a person\'s facet and an unknown value, naming the known ones', () => {
    expect(() => readMascot({ age: 'child' })).toThrow(/unknown facet 'age'.*no age/);
    expect(() => readMascot({ hook: 'wings' })).toThrow(/unknown hook 'wings'.*ears/);
  });
  it('reads the accord from the accent (law 5) and carries no channel a life would write', () => {
    expect(accordOf('round')).toBe('harmony');
    expect(accordOf('spike')).toBe('contrast');
    const s = sheetOf({ promise: 'mischief' });
    for (const ch of ['wear', 'rest', 'dress']) expect(s.notes[ch]).toBeUndefined();
    expect(s.notes.promise[0].from).toBe('promise.mischief');
  });
});

describe('the mascot body (the laws as numbers)', () => {
  const headsTall = (sheet) => { const { H, height } = mascotPlan(sheet); return height / (2 * H.rz); };
  it('is head-heavy by form (law 3): about one, two and three heads tall', () => {
    const base = { hook: 'none', extremities: 'nubs', promise: 'comfort' };
    expect(headsTall(sheetOf({ ...base, form: 'orb' }))).toBeLessThan(1.3);
    expect(headsTall(sheetOf({ ...base, form: 'sprout' }))).toBeGreaterThan(1.6);
    expect(headsTall(sheetOf({ ...base, form: 'sprout' }))).toBeLessThan(2.5);
    expect(headsTall(sheetOf({ ...base, form: 'toon' }))).toBeGreaterThan(2.5);
    expect(headsTall(sheetOf({ ...base, form: 'toon' }))).toBeLessThan(3.6);
  });
  it('gives big eyes at the head\'s middle (law 4) on a round core (law 5)', () => {
    const { plan, H } = mascotPlan(sheetOf({ eyes: 'pair', form: 'sprout', hook: 'none' }));
    const eye = plan.segments.find((s) => s.name === 'eyeR'), mid = eye.stations[1];
    expect((2 * mid.r[1]) / (2 * H.rz)).toBeGreaterThan(0.25);
    expect(Math.abs(mid.at[2] - H.C[2])).toBeLessThan(0.15 * H.rz);
    expect(plan.style.e).toBe(2);
    expect(plan.segments.find((s) => s.name === 'head').e).toBeUndefined();
    expect(EYE_FORMS.dots.w).toBe(0);
  });
  it('draws the hook in the accent\'s family: a spiky ear is a cone, a round one a ball, a blocky one squared', () => {
    const ear = (accent) => mascotPlan(sheetOf({ hook: 'ears', accent, promise: 'might' })).plan.segments.find((s) => s.name === 'earR');
    const tipShare = (s) => s.stations.at(-1).r[0] / Math.max(...s.stations.map((x) => x.r[0]));
    expect(tipShare(ear('spike'))).toBeLessThan(0.2);
    expect(tipShare(ear('round'))).toBeGreaterThan(0.2);
    expect(ear('block').e).toBe(4);
  });
  it('owns its palette: the accent a neighbour in harmony, across the wheel in contrast (law 7)', () => {
    const harmony = mascotPalette(sheetOf({ accent: 'round', hue: 'blue' })), contrast = mascotPalette(sheetOf({ accent: 'spike', hue: 'blue', promise: 'speed' }));
    expect(hueGap(harmony.Body, harmony.Accent)).toBeLessThan(40);
    expect(hueGap(contrast.Body, contrast.Accent)).toBeGreaterThan(120);
    expect(contrast.Glove).toBe(mascotPalette(sheetOf({ extremities: 'gloves', hue: 'blue' })).Glove);
  });
  it('compiles every hook and every form into a plan that expands and closes (one case each, chosen from the tables)', () => {
    const cases = [...Object.keys(HOOKS).map((hook) => ({ hook, form: hook === 'tail' || hook === 'spines' ? 'sprout' : 'toon' })), ...Object.keys(FORMS).map((form) => ({ form, hook: 'none' }))];
    for (const facets of cases) {
      const recipe = expandPlan(mascotPlan(sheetOf(facets)).plan);
      const mesh = compileLayered(recipe);
      expect(mesh.faces.length, JSON.stringify(facets)).toBeGreaterThan(100);
    }
  }, 60000);
  it('rigs any topology and plays every energy\'s idle with its feet planted (laws 9, 10)', () => {
    for (const energy of Object.keys(ENERGIES)) {
      const form = energy === 'floaty' ? 'orb' : 'sprout';
      const plan = mascotPlan(sheetOf({ energy, form, hook: 'none', extremities: form === 'orb' ? 'nubs' : 'gloves' })).plan;
      const recipe = expandPlan(plan), mesh = compileLayered(recipe), R = validateRig(recipe.rig);
      for (const key of [...plan.clips.idle, plan.clips.hop[2], plan.clips.wave[1]]) {
        const { report } = poseLayered(mesh, recipe, key, { R });
        for (const leg of Object.values(report?.legs ?? {})) expect(leg.reach, `${energy} ${JSON.stringify(key)}`).not.toBe('clamped');
      }
      expect(Object.keys(plan.clips)).toEqual(['idle', 'hop', 'cheer', 'wave']);
    }
  }, 60000);
  it('lands every note, sets the promise\'s pose after the mint, and is pure', () => {
    const sheet = rollMascot({ brief: 'a cheeky purple mascot', seed: 3 }), P = mascotPlanFromSheet(sheet);
    expect(P.door).toBe('creature');
    expect(P.ledger).toHaveLength(Object.values(sheet.notes).flat().length);
    expect(P.ledger.every((r) => r.at)).toBe(true);
    expect(P.after).toEqual(expect.arrayContaining([{ op: 'set', path: '/dials/tilt', value: -9 }]));
    expect(P.create.spec).toMatchObject({ hullShade: true, toon: { light: true } });
    expect(JSON.stringify(mascotPlanFromSheet(sheet))).toBe(JSON.stringify(P));
    expect(() => mascotPlanFromSheet(rollEgocube({}))).toThrow(/mascot sheet/);
  });
});

describe('the egocube\'s mascot tuning', () => {
  const cube = (roll) => rollStored({ kind: 'egocube', roll });
  it('rolls a mascot when the brief asks for one, a person otherwise or when told', () => {
    expect(isMascotRoll({ brief: 'a sonic-like mascot' })).toBe(true);
    expect(cube({ brief: 'a sonic-like mascot' }).sheet.tuning).toBe('mascot');
    expect(cube({ brief: 'a cartoony knight', tuning: 'person' }).sheet.tuning).toBeUndefined();
    expect(cube({ brief: 'a cartoony knight', facets: { archetype: 'hero' } }).sheet.tuning).toBeUndefined();
    expect(cube({ brief: 'a weary paladin' }).sheet).toEqual(rollEgocube({ brief: 'a weary paladin' }));
    expect(cube({ tuning: 'mascot', facets: { promise: 'wonder' } }).sheet.facets.promise).toBe('wonder');
  });
  it('never ages a mascot, and makes it through the creature door', () => {
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { tuning: 'mascot', years: 12 } })).toThrow(/does not age/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { tuning: 'cartoon' } })).toThrow(/'person' or 'mascot'/);
    const m = cube({ brief: 'kirby-like' });
    expect(egocubeNodes(m)).toEqual([{ band: 'mascot', sheet: m.sheet }]);
    const C = egocubeCreate(m);
    expect(C.create.as).toBe('creature');
    expect(C.create.spec.plan.clips.idle).toBeTruthy();
  });
  it('leans its other facets by the promise', () => {
    expect(PROMISES.speed.lean.accent.spike).toBeGreaterThan(1);
    const spiky = [1, 2, 3, 4, 5, 6].filter((seed) => sheetOf({ promise: 'speed' }, seed).facets.accent === 'spike').length;
    const softSpiky = [1, 2, 3, 4, 5, 6].filter((seed) => sheetOf({ promise: 'comfort' }, seed).facets.accent === 'spike').length;
    expect(spiky).toBeGreaterThan(softSpiky);
  });
});
