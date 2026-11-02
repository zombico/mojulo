/**
 * equipment/compose — laws 2: a hilt carrying an end. One case per composition procedure (a sword hilt with a blade, a
 * sword hilt with a head, a haft with a blade, a haft with a head), held to laws 8–11; the item names as presets; laws
 * 1 untouched; the bow and the shield drawn as laws 1 draws them.
 */
import { describe, expect, it } from 'vitest';

import { expandEquipment, validateBuild } from './expand.js';
import { GRIP_HANDS, GUARD_RISE, HEAD_SHARE, LAWS_VERSION } from './principles.js';
import { lowerObjectFaces } from '../worlds/workbench.js';

const eq = (b) => ({ type: 'equipment', seed: 3, ...b });
const PROCEDURES = {
  'sword hilt + blade': { item: 'sword', style: 'historical' },
  'sword hilt + head': { item: 'sword', style: 'dwarven', parts: { end: 'mace' } },
  'haft + blade': { item: 'staff', style: 'historical', parts: { hilt: 'pole', end: 'blade', blade: 'sabre' } },
  'haft + head': { item: 'staff', style: 'historical', parts: { head: 'halberd' } },
};

describe('laws 2: a hilt carrying an end', () => {
  it('is current, and each composition validates, is deterministic and lowers', () => {
    expect(LAWS_VERSION).toBe(2);
    for (const b of Object.values(PROCEDURES)) {
      expect(validateBuild(eq(b))).toEqual([]);
      expect(expandEquipment(eq(b))).toEqual(expandEquipment(eq(b)));
      expect(lowerObjectFaces({ kind: 'workbench', units: 'cm', build: eq(b) }).length).toBeGreaterThan(50);
    }
  });
  it('the item names are presets, and the hilt says how a hand holds it', () => {
    const t = (b) => expandEquipment(eq(b)).trace;
    expect(t({ item: 'sword', style: 'historical' }).variants).toMatchObject({ hilt: 'one-hand', end: 'blade' });
    expect(t({ item: 'greatsword', style: 'historical' }).variants).toMatchObject({ hilt: 'two-hand', end: 'blade' });
    expect(t({ item: 'staff', style: 'historical' }).variants).toMatchObject({ hilt: 'long', end: 'plain' });
    expect(t({ item: 'staff', style: 'dwarven', parts: { head: 'axe', reach: 'arm' } }).hold).toBe('blade');
    expect(t(PROCEDURES['haft + head']).hold).toBe('haft');
    expect(t(PROCEDURES['sword hilt + head']).hold).toBe('blade');
  });
  it('law 8: the grip is counted in hands', () => {
    const g = (item) => expandEquipment(eq({ item, style: 'historical' })).trace.grip.L;
    expect(g('sword')).toBeCloseTo(GRIP_HANDS['one-hand'], 0);
    expect(g('greatsword') / g('sword')).toBeCloseTo(GRIP_HANDS['two-hand'] / GRIP_HANDS['one-hand'], 1);
    expect(expandEquipment(eq({ item: 'sword', style: 'historical', parts: { hiltLength: 19 } })).trace.grip.L).toBeCloseTo(19, 0);
  });
  it('law 9: the guard is sized by its blade and its rise bounded by its span', () => {
    for (const style of ['historical', 'elven', 'anime-hero']) for (const item of ['dagger', 'sword']) {
      const t = expandEquipment(eq({ item, style })).trace;
      expect(t.guard.span).toBeLessThanOrEqual(t.blade.L * 0.5 + 1e-6);
      expect(t.guard.rise).toBeLessThanOrEqual(GUARD_RISE * t.guard.span + t.guard.H + 1e-6);
    }
  });
  it('law 10: the pommel balances the blade inside the grip\'s bounds', () => {
    for (const item of ['dagger', 'sword', 'greatsword']) {
      const t = expandEquipment(eq({ item, style: 'anime-hero' })).trace, r = t.pommel.R / t.grip.R;
      expect(r).toBeGreaterThanOrEqual(1.15 - 1e-6); expect(r).toBeLessThanOrEqual(2.3 * 1.3);
    }
    const t = (item) => expandEquipment(eq({ item, style: 'historical' })).trace.pommel.R;
    expect(t('greatsword')).toBeGreaterThan(t('dagger'));
  });
  it('law 11: a head is a share of its haft, and a band sits on a wandering shaft', () => {
    const t = expandEquipment(eq(PROCEDURES['haft + head'])).trace;
    expect(t.length - t.haft.L).toBeGreaterThanOrEqual(HEAD_SHARE.halberd * t.haft.L);
    const druid = expandEquipment(eq({ item: 'staff', style: 'druid' }));
    const band = druid.monomers.lathes.find((l) => l.group === 'grip'), g = druid.sockets.grip.origin;
    expect(Math.hypot(g[0], g[1])).toBeGreaterThan(0.05);                     // the shaft wanders here
    expect([band.axisFrom.x, band.axisFrom.y]).toEqual([g[0], g[1]]);         // and the band is on it
  });
  it('an end that cradles a stone needs one on any hilt; laws 1 takes no hilt or end; the bow and shield are as laws 1', () => {
    expect(validateBuild(eq({ item: 'sword', style: 'historical', parts: { end: 'claw' } })).join('\n')).toMatch(/cradles a stone/);
    expect(validateBuild(eq({ item: 'sword', style: 'elven', parts: { end: 'claw' }, dials: { focus: 'head' } }))).toEqual([]);
    expect(validateBuild(eq({ item: 'sword', style: 'historical', laws: 1, parts: { hilt: 'pole' } })).join('\n')).toMatch(/laws 2's/);
    expect(validateBuild(eq({ item: 'sword', style: 'historical', parts: { hilt: 'spear' } })).join('\n')).toMatch(/not one of dagger, one-hand/);
    for (const item of ['bow', 'shield']) expect(expandEquipment(eq({ item, style: 'elven' })).monomers).toEqual(expandEquipment(eq({ item, style: 'elven', laws: 1 })).monomers);
  });
});
