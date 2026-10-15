/**
 * equipment/firearm — a modern or future world's arms as equipment: built from the carry's own boxes (one source), its
 * cards its own (a myth's sample is refused by name), a future card's lit band and smooth corners, and a characterization
 * pin per firearm card × firearm (seed 3). Re-pin only with a change that says a firearm's emission changes.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { expandEquipment, validateBuild, GEAR_ITEMS, EQUIPMENT_ITEMS } from './expand.js';
import { FIREARM_ITEMS, FIREARM_STYLES, validateFirearmCard } from './firearm.js';
import { FIREARM_SHAPES } from './firearm-shapes.js';
import { CARRIED } from '../polygonizer/hero-carry.js';

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const PINS = {
  'service/pistol': '86eeae2d78af610e',
  'service/carbine': '51c5e9b746bad203',
  'service/shotgun': '68cdf37e9c521995',
  'future/pistol': '06f885c2f7545dc0',
  'future/carbine': '96538c14f20b222b',
  'future/shotgun': 'f32eb27f769521ba',
};

describe('firearms as equipment', () => {
  it('are their own family: the myth catalogue is unchanged, the gear catalogue holds both', () => {
    expect(EQUIPMENT_ITEMS).not.toContain('pistol');
    expect(GEAR_ITEMS).toEqual([...EQUIPMENT_ITEMS, ...FIREARM_ITEMS]);
  });
  it('the carry and the gear draw the same boxes', () => {
    for (const item of FIREARM_ITEMS) expect(CARRIED[item]).toBe(FIREARM_SHAPES[item]);
  });
  it('a service build is one extrude per carry box; a future one adds the lit band and rounds its corners', () => {
    const item = FIREARM_ITEMS[0];
    const s = expandEquipment({ type: 'equipment', item }), f = expandEquipment({ type: 'equipment', item, style: 'future' });
    expect(s.trace.style).toBe('service');
    expect(s.monomers.extrudes).toHaveLength(FIREARM_SHAPES[item].boxes.length);
    expect(f.monomers.extrudes.filter((e) => e.group === 'lit')).toHaveLength(2);
    expect(f.monomers.extrudes.filter((e) => e.group === 'lit').every((e) => e.material === 'neon')).toBe(true);
    expect(f.monomers.extrudes[0].profile.rect.r).toBeGreaterThan(s.monomers.extrudes[0].profile.rect.r);
  });
  it('sockets: the grip at the strong hand\'s station, the tip at the muzzle, the stock behind the grip', () => {
    for (const item of FIREARM_ITEMS) {
      const { sockets, trace } = expandEquipment({ type: 'equipment', item });
      expect(sockets.grip.origin).toEqual(FIREARM_SHAPES[item].stations.strong.at);
      expect(sockets.tip.origin).toEqual(FIREARM_SHAPES[item].muzzle);
      expect(sockets.stock.origin[2]).toBeLessThan(sockets.tip.origin[2]);
      expect(trace.length).toBeGreaterThan(sockets.tip.origin[2] - sockets.stock.origin[2] - 1);
    }
  });
  it('refuses by name: a myth sample, a stone, parts, an incomplete card', () => {
    expect(validateBuild({ type: 'equipment', item: 'pistol', style: 'elven' }).join('\n')).toMatch(/not a firearm sample \(service, future\)/);
    expect(validateBuild({ type: 'equipment', item: 'carbine', gem: 'ruby' }).join('\n')).toMatch(/build\.gem: a firearm takes none/);
    expect(validateBuild({ type: 'equipment', item: 'carbine', parts: { blade: 'leaf' } }).join('\n')).toMatch(/build\.parts: a firearm takes none/);
    expect(validateFirearmCard({ roles: { metal: ['gunmetal', '#333333'] } }).join('\n')).toMatch(/roles\.body: required/);
    expect(validateBuild({ type: 'equipment', item: 'sword', style: 'service' }).join('\n')).toMatch(/not a sample/);
  });
  it('the cards are pure data', () => {
    for (const card of Object.values(FIREARM_STYLES)) { expect(JSON.parse(JSON.stringify(card))).toEqual(card); expect(validateFirearmCard(card)).toEqual([]); }
  });
});

describe('firearm characterization (byte pins per firearm card × firearm)', () => {
  for (const [key, pin] of Object.entries(PINS)) {
    it(key, () => {
      const [style, item] = key.split('/');
      expect(hash(expandEquipment({ type: 'equipment', item, style, seed: 3 }).monomers)).toBe(pin);
    });
  }
  it('pins every firearm card × firearm', () => {
    expect(Object.keys(PINS).sort()).toEqual(Object.keys(FIREARM_STYLES).flatMap((s) => FIREARM_ITEMS.map((i) => `${s}/${i}`)).sort());
  });
});
