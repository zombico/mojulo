/**
 * equipment/armory and laws 2's new ends and shields: one case per procedure — each new head (a builder of its own),
 * each shield axis (an outline, a curve, a construction), the armory's roll — held to what it says: a head sized by its
 * haft and carrying no stone, a curved face that wraps, planks and panels that add their seams and straps, laws 1
 * refusing the new words, an armed undead minted now arming from its kit and one minted before keeping its card's.
 */
import { describe, expect, it } from 'vitest';

import { expandEquipment, validateBuild } from './expand.js';
import { LAWS2_HEADS, HEAD_SIZE } from './heads.js';
import { SHIELD_OUTLINES } from './shields.js';
import { ARMORY_ARMS, ARMORY_KITS, TWO_HANDED, armFrom, ARMORY_VERSION } from './armory.js';
import { heroRecord } from '../../mcp/tools/layered.js';
import { undeadArms } from '../undead/tiered.js';

const eq = (b) => ({ type: 'equipment', seed: 3, ...b });
const count = (m, group) => ['lathes', 'extrudes', 'sweeps', 'lofts'].reduce((n, k) => n + (m[k] || []).filter((x) => x.group === group).length, 0);

describe('laws 2: the staves and the clubs', () => {
  it('each new head builds on any haft, carries no stone, and is sized by its haft', () => {
    for (const end of LAWS2_HEADS) {
      const b = eq({ item: 'staff', style: 'historical', parts: { hilt: 'arm', end } });
      expect(validateBuild(b), end).toEqual([]);
      const arm = expandEquipment(b).trace, long = expandEquipment(eq({ item: 'staff', style: 'historical', parts: { hilt: 'long', end } })).trace;
      expect(arm.focal).toBeUndefined();                                                     // no stone
      // law 11: at least its share of its haft (a scythe's blade reaches out sideways, its share along the blade)
      if (end !== 'scythe') for (const t of [arm, long]) expect(t.length - t.haft.L, end).toBeGreaterThanOrEqual(HEAD_SIZE[end][0] * t.haft.L - 1e-6);
    }
    expect(validateBuild(eq({ item: 'staff', style: 'historical', laws: 1, parts: { head: 'club' } })).join('\n')).toMatch(/laws 2's/);
    expect(validateBuild(eq({ item: 'sword', style: 'historical', parts: { end: 'hammer' } }))).toEqual([]);   // any hilt
  });
});

describe('laws 2: curved and paneled shields', () => {
  const sh = (parts, extra = {}) => expandEquipment(eq({ item: 'shield', style: 'historical', parts, ...extra }));
  it('a barrel wraps the face (its edges behind its middle), a dish domes it', () => {
    const board = sh({ outline: 'scutum' }).monomers.lofts.find((l) => l.group === 'board');
    const mid = board.stations[13].profile, front = mid.slice(0, 13);                        // the front, left to right
    expect(front[0][1]).toBeGreaterThan(front[6][1] + 3);                                       // the edge is back (+y)
    const dome = sh({ outline: 'round', curve: 'dish' }).monomers.lathes.find((l) => l.group === 'board');
    expect(dome.axisTo.y).toBeLessThan(-3);                                                     // its apex forward
    expect(sh({ outline: 'scutum' }).trace.variants).toMatchObject({ outline: 'scutum', curve: 'barrel', construction: 'board' });
  });
  it('planks add their seams and bands, panels their straps and rivets', () => {
    const plain = count(sh({ outline: 'tower' }).monomers, 'device');
    expect(count(sh({ outline: 'tower', construction: 'planks' }).monomers, 'device')).toBeGreaterThan(plain + 5);
    expect(count(sh({ outline: 'tower', construction: 'panels' }).monomers, 'device')).toBeGreaterThan(plain + 5);
  });
  it('laws 1 refuses the new words; a laws-2 shield naming none is drawn as laws 1 draws it', () => {
    for (const parts of [{ outline: SHIELD_OUTLINES[0] }, { curve: 'barrel' }, { construction: 'planks' }]) expect(validateBuild(eq({ item: 'shield', style: 'historical', laws: 1, parts })).join('\n')).toMatch(/laws 2's/);
    expect(sh({}).monomers).toEqual(sh({}, { laws: 1 }).monomers);
  });
});

describe('the armory', () => {
  it('a kit names only arms in the roster; a roll is deterministic, varies by seed, and a two-handed arm takes no shield', () => {
    for (const K of Object.values(ARMORY_KITS)) for (const pool of Object.values(K)) for (const n of pool) if (n) expect(ARMORY_ARMS[n]).toBeTruthy();
    expect(armFrom('soldier', 7)).toEqual(armFrom('soldier', 7));
    expect(new Set(Array.from({ length: 12 }, (_, i) => armFrom('soldier', i + 1).right.armory)).size).toBeGreaterThan(1);
    for (let s = 1; s <= 24; s++) { const g = armFrom('warden', s); if (TWO_HANDED.includes(g.right?.armory)) expect(g.left).toBeUndefined(); }
    const g = armFrom('soldier', 3); expect(validateBuild(g.right)).toEqual([]); expect(g.right.laws).toBe(2);
  });
  it('an armed undead minted now is stamped and arms from its kit; one minted before keeps its card\'s arms under laws 1', () => {
    const hero = heroRecord({ cast: 'male', undead: { form: 'skeleton', layers: ['armed'], seed: 4 } });
    expect(hero.undead.armory).toBe(ARMORY_VERSION);
    expect(Object.values(hero.gear).every((b) => b.laws === 2 && ARMORY_ARMS[b.armory])).toBe(true);
    const old = undeadArms({ undead: { form: 'skeleton', layers: ['armed'], seed: 4 } });
    expect(Object.values(old).every((b) => b.laws === 1 && b.armory === undefined)).toBe(true);
  });
});
