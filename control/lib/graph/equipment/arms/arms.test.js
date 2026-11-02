/**
 * equipment/arms — the modern and future arms: the opt-in (a firearm sample untouched until it names a model, a line,
 * parts or an arms finish; the mint stamps the model), one case per builder procedure (chosen from the registry, never
 * a catalogue sweep) held to the laws (chamfer floor, responses, one glow hue, the raked grip, the guard's opening, the
 * future line keeping the stations, fewer and bigger detail as it stylizes), the parts tuning what they say, the
 * finish cards as data, the refusals naming the choices, and the hero holding them.
 */
import { describe, expect, it } from 'vitest';

import { expandEquipment, validateBuild } from '../expand.js';
import { buildFirearm, FIREARM_STYLES } from '../firearm.js';
import { ARM_MODELS, buildArm, isArmsBuild, stampArms, validateArmsBuild, resolveArm, armClass } from './index.js';
import { ARM_FINISHES, finishCardOf, validateFinishCard } from './finishes.js';
import { CHAMFER_FLOOR, GRIP_RAKE, GUARD_OPENING, ARMS_LAWS_VERSION } from './laws.js';
import { gearRecord, validateGear } from '../../polygonizer/hero-gear.js';

const eq = (b) => ({ type: 'equipment', ...b });
/** one (item, model) per builder procedure, picked from the registry */
const PROCEDURES = (() => {
  const seen = new Map();
  for (const [item, I] of Object.entries(ARM_MODELS)) for (const [model, M] of Object.entries(I.models)) if (!seen.has(M.build)) seen.set(M.build, { item, model });
  return [...seen.values()];
})();
const FIREARMS = PROCEDURES.filter((p) => armClass(p.item) === 'firearm');
const count = (m, group) => ['extrudes', 'lathes', 'sweeps'].reduce((n, k) => n + (m[k] || []).filter((x) => x.group === group).length, 0);

describe('the opt-in', () => {
  it('a firearm sample naming none of model, line, parts or an arms finish is the samples\' build, byte for byte', () => {
    for (const style of Object.keys(FIREARM_STYLES)) {
      const b = eq({ item: 'pistol', style });
      expect(isArmsBuild(b)).toBe(false);
      expect(expandEquipment(b).monomers).toEqual(buildFirearm('pistol', FIREARM_STYLES[style]).monomers);
    }
  });
  it('a model, a line, parts or an arms finish opens the arms kernel; the arms-only items always do', () => {
    for (const k of [{ model: 'service' }, { line: 'future' }, { parts: { optic: 'reddot' } }, { style: 'fde' }]) expect(isArmsBuild(eq({ item: 'pistol', ...k }))).toBe(true);
    for (const item of ['rifle', 'smg', 'knife']) expect(isArmsBuild(eq({ item }))).toBe(true);
    expect(isArmsBuild(eq({ item: 'sword', model: 'service' }))).toBe(false);
  });
  it('the mint stamps the item\'s default model, and leaves a model it names and a blade alone', () => {
    expect(stampArms(eq({ item: 'carbine' })).model).toBe(ARM_MODELS.carbine.default);
    expect(stampArms(eq({ item: 'rifle', model: 'bullpup' })).model).toBe('bullpup');
    const sword = eq({ item: 'sword' }); expect(stampArms(sword)).toBe(sword);
    // the old firearm samples' looks carry over by name
    expect(resolveArm(stampArms(eq({ item: 'pistol', style: 'future' }))).line).toBe('future');
  });
});

describe('each builder procedure under the laws', () => {
  it('is deterministic, lowers through the workbench and stamps its laws', () => {
    for (const p of PROCEDURES) {
      const a = expandEquipment(eq(p)), b = expandEquipment(eq(p));
      expect(a).toEqual(b);
      expect(a.trace.laws).toBe(ARMS_LAWS_VERSION);
      expect(a.monomers.extrudes.length).toBeGreaterThan(5);
      expect(validateBuild(eq(p))).toEqual([]);
    }
  });
  it('law 2: every chamfer at or over the floor, the future line\'s broader', () => {
    for (const p of PROCEDURES) {
      const m = buildArm(eq(p)).trace.arms, f = buildArm(eq({ ...p, line: 'future' })).trace.arms;
      expect(m.chamfer.min).toBeGreaterThanOrEqual(CHAMFER_FLOOR);
      expect(f.chamfer.max).toBeGreaterThan(m.chamfer.max);
    }
  });
  it('law 3: three solid responses on the default finishes, one glow hue on the future line and none on the modern', () => {
    for (const p of PROCEDURES) for (const line of ['modern', 'future']) {
      const r = buildArm(eq({ ...p, line })).trace.arms;
      expect(r.advice).toEqual([]);
      expect(r.glowHues).toBe(line === 'future' ? 1 : 0);
    }
  });
  it('law 4 and 6: a firearm\'s grip rakes back off the bore, its fist below the bore and behind the muzzle, its guard a finger\'s opening', () => {
    for (const p of FIREARMS) {
      const e = buildArm(eq(p)), g = e.sockets.grip;
      const rake = (Math.atan2(g.axis[2], g.axis[1]) * 180) / Math.PI;
      if (p.item !== 'shotgun') expect(Math.abs(rake - GRIP_RAKE)).toBeLessThan(0.01);
      expect(g.origin[1]).toBeLessThan(0);
      expect(g.origin[2]).toBeLessThan(e.sockets.tip.origin[2]);
      expect(e.sockets.tip.origin.slice(0, 2)).toEqual([0, 0]);
      expect(e.trace.arms.guardOpening).toBeGreaterThanOrEqual(GUARD_OPENING);
    }
  });
  it('law 7: the future line keeps the stations (the grip where the hand goes)', () => {
    for (const p of PROCEDURES) expect(buildArm(eq({ ...p, line: 'future' })).sockets.grip.origin).toEqual(buildArm(eq(p)).sockets.grip.origin);
  });
  it('law 5: the tertiary detail gets fewer as the arm stylizes', () => {
    const rifle = { item: 'rifle' };
    expect(count(buildArm(eq({ ...rifle, dials: { stylize: 1 } })).monomers, 'rail')).toBeLessThan(count(buildArm(eq(rifle)).monomers, 'rail'));
  });
  it('law 8: a blade\'s edge is its own brighter response, the future line\'s the glow', () => {
    const knife = PROCEDURES.find((p) => p.item === 'knife');
    const mats = (b) => new Set(buildArm(eq(b)).monomers.extrudes.filter((x) => x.group === 'blade-edge').map((x) => JSON.stringify([x.material, x.tint ?? null])));
    const blade = (b) => new Set(buildArm(eq(b)).monomers.extrudes.filter((x) => x.group === 'blade').map((x) => JSON.stringify([x.material, x.tint ?? null])));
    expect([...mats(knife)]).not.toEqual([...blade(knife)]);
    expect([...mats({ ...knife, line: 'future' })][0]).toMatch(/neon/);
  });
});

describe('the near line (law 9: futuristic, styled real)', () => {
  const NEAR = PROCEDURES.map((p) => ({ ...p, line: 'near' }));
  it('lights only a display: every glow monomer is a screen, one hue at most, the shell parted by a seam', () => {
    for (const b of NEAR) {
      const m = buildArm(eq(b)).monomers, lit = ['extrudes', 'lathes', 'sweeps'].flatMap((k) => (m[k] || []).filter((x) => x.material === 'neon'));
      expect(lit.every((x) => x.group === 'screen')).toBe(true);
      expect(buildArm(eq(b)).trace.arms.glowHues).toBeLessThanOrEqual(1);
      if (armClass(b.item) === 'firearm') expect(count(m, 'seam') + count(m, 'screen')).toBeGreaterThan(0);
    }
  });
  it('a near model draws in the near line unless its build or its finish says otherwise', () => {
    const near = Object.entries(ARM_MODELS).flatMap(([item, I]) => Object.entries(I.models).filter(([, M]) => M.line === 'near').map(([model]) => ({ item, model })));
    expect(near.length).toBeGreaterThan(0);
    const one = near[0];
    expect(resolveArm(eq(one)).line).toBe('near');
    expect(resolveArm(eq({ ...one, style: 'black' })).line).toBe('modern');
    expect(resolveArm(eq({ ...one, line: 'future' })).line).toBe('future');
  });
  it('each near model (its own code path: a shroud, a layout, a builder) builds under the laws', () => {
    const near = Object.entries(ARM_MODELS).flatMap(([item, I]) => Object.entries(I.models).filter(([, M]) => M.line === 'near').map(([model]) => ({ item, model })));
    for (const b of near) {
      expect(validateBuild(eq(b))).toEqual([]);
      const e = buildArm(eq(b));
      expect(e.trace.arms.advice).toEqual([]);
      expect(e.trace.arms.guardOpening).toBeGreaterThanOrEqual(GUARD_OPENING);
      expect(e.sockets.grip.origin[2]).toBeLessThan(e.sockets.tip.origin[2]);
    }
  });
  it('shows what its parts do: the coilgun\'s coils countable in their own copper, the capacitor bank\'s cells bare', () => {
    const coil = Object.entries(ARM_MODELS.rifle.models).find(([, M]) => M.build === 'coilgun')[0];
    const m = buildArm(eq({ item: 'rifle', model: coil })).monomers;
    const coils = m.lathes.filter((x) => x.group === 'coils');
    expect(coils.length).toBeGreaterThanOrEqual(3);
    expect(coils[0].material).toEqual({ metal: 'copper', finish: 'polished' });
    expect(count(m, 'cells')).toBeGreaterThan(0);
    expect(count(buildArm(eq({ item: 'rifle', model: coil, dials: { stylize: 1 } })).monomers, 'coils')).toBeLessThan(coils.length);
  });
});

describe('the parts and the finishes', () => {
  it('a barrel word or length moves the muzzle by its length', () => {
    const tip = (parts) => buildArm(eq({ item: 'carbine', parts })).sockets.tip.origin[2];
    const M = ARM_MODELS.carbine.models.assault.barrel;
    expect(tip({ barrel: 'long' }) - tip({ barrel: 'short' })).toBeCloseTo(M.long - M.short, 2);
    expect(tip({ barrel: 40 }) - tip({ barrel: M.standard })).toBeCloseTo(40 - M.standard, 2);
  });
  it('a part draws what it names (a suppressor is longer than a crown; a scope is the optic group)', () => {
    const len = (parts) => buildArm(eq({ item: 'pistol', model: 'service', parts })).trace.length;
    expect(len({ muzzle: 'suppressor' })).toBeGreaterThan(len({}) + 10);
    expect(count(buildArm(eq({ item: 'rifle', parts: { optic: 'scope' } })).monomers, 'optic')).toBeGreaterThan(count(buildArm(eq({ item: 'rifle', parts: { optic: 'none' } })).monomers, 'optic'));
  });
  it('the finish cards are plain data and valid; the old firearm card reads as one', () => {
    for (const [id, card] of Object.entries(ARM_FINISHES)) { expect(JSON.parse(JSON.stringify(card))).toEqual(card); expect(validateFinishCard(card)).toEqual([]); expect(card.id).toBe(id); }
    const old = finishCardOf(FIREARM_STYLES.future);
    expect(old.line).toBe('future'); expect(old.roles.glow).toEqual(FIREARM_STYLES.future.roles.lit); expect(validateFinishCard(old)).toEqual([]);
  });
  it('refuses by name: a model, a slot, a word, a finish, a line, a stone, the laws', () => {
    const errs = (b) => validateArmsBuild(eq(b)).join('\n');
    expect(errs({ item: 'pistol', model: 'derringer' })).toMatch(/not a pistol model \(service, compact, heavy, smart, revolver\)/);
    expect(errs({ item: 'pistol', parts: { stock: 'fixed' } })).toMatch(/a service pistol takes barrel, magazine/);
    expect(errs({ item: 'rifle', parts: { optic: 'binoculars' } })).toMatch(/not one of irons, reddot, holo, scope, smart, none/);
    expect(errs({ item: 'rifle', parts: { barrel: 200 } })).toMatch(/4–90/);
    expect(errs({ item: 'knife', style: 'tiger' })).toMatch(/not a finish \(black/);
    expect(errs({ item: 'smg', line: 'retro' })).toMatch(/not a line \(modern, future, near\)/);
    expect(errs({ item: 'knife', gem: 'ruby' })).toMatch(/takes no stone/);
    expect(errs({ item: 'knife', laws: 9 })).toMatch(/arms laws 1/);
  });
});

describe('the hero holds them', () => {
  it('stamps the model on a stored gun, takes a knife as a blade and a rifle in the hand, refuses a rifle on the hip', () => {
    const g = gearRecord({ right: { item: 'pistol' }, hip: { item: 'knife' } });
    expect(g.right.model).toBe('service'); expect(g.right.laws).toBe(ARMS_LAWS_VERSION);
    expect(validateGear({ right: { item: 'rifle', model: 'bullpup' }, left: { item: 'knife', model: 'karambit' } })).toEqual([]);
    expect(validateGear({ hip: { item: 'rifle' } }).join('\n')).toMatch(/long gun/);
  });
});
