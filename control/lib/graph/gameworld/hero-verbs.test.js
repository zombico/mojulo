// The hero fights with what it carries (adornment.js BASIC_VERBS, levels.js): an item serving the body's own strike gives
// the pilot its contact window (the page arms it with the held item's numbers), one serving its shot arms the pilot as the
// quick shooter's player is armed; a hero carrying nothing for either is played as it was. One case per procedure: a blade
// on a trail and in a building, a long gun and a pistol, a hero with neither.
import { describe, expect, it } from 'vitest';

import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { readAdornment, resolveAdornment } from './adornment.js';
import { readEquipment } from './equipment.js';
import { SHOOT, SHOULDER } from './quick.js';

const H = MEADOWMARK_HERO.characters.hero;
const carrying = (items, more = {}) => ({ ...MEADOWMARK_HERO, ...more, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items } } } });
const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const gun = (item) => ({ id: 'gun', slot: 'right', build: { item }, serves: ['shoot'] });
const firstLevel = (W) => { const G = readGameworld(W), st = gameStages(W).find((s) => s.section !== 'building'); return stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero' }).args.manifest; };
const pilot = (m) => m.entities.find((e) => e.pilotable);
const hint = (m) => (m.events?.hud ?? []).map((h) => h.text).join(' ');

describe('the adornment page carries what the body fights with', () => {
  it('an item may serve the body\'s strike or shot, leaving nothing open; a firearm is carried, never a table class', () => {
    expect(resolveAdornment({ items: [BLADE] }, { powers: [], progression: [] }).open).toEqual([]);
    expect(resolveAdornment({ items: [gun('carbine')] }, { powers: [], progression: [] }).open).toEqual([]);
    expect(resolveAdornment({ items: [{ ...BLADE, serves: ['slash'] }] }, { powers: [], progression: [] }).open[0]).toMatch(/serves 'slash', which is not a power \(the hero has none yet\)/);
    expect(() => readAdornment({ items: [gun('pistol')] })).not.toThrow();
    expect(() => readEquipment({ classes: { pistol: { build: { item: 'pistol' } } } })).toThrow(/not a class of gear/);
  });
});

describe('the pilot strikes and shoots with what the hero carries', () => {
  it('a blade for its strike: the contact window where no feel names one, the strike said in the controls', () => {
    const m = firstLevel(carrying([BLADE]));
    expect(pilot(m).rule.strikeContact).toEqual([0.28, 0.62]);
    expect(hint(m)).toMatch(/click {2}strike/);
    // (a feel that names a window keeps its own)
    const felt = firstLevel(carrying([BLADE], { feel: 'ebon-spirits' }));
    expect(Array.isArray(pilot(felt).rule.strikeContact)).toBe(true);
  });

  it('a long gun the rifle\'s numbers, a pistol the handgun\'s: fired from the eye, the body hittable, over the shoulder', () => {
    const m = firstLevel(carrying([gun('carbine')]));
    expect(pilot(m).weapon).toMatchObject({ ...SHOOT.rifle, eye: 1.5, converge: true });
    expect(pilot(m).body).toMatchObject({ hittable: true });
    expect(m.camera).toMatchObject({ rule: 'follow', ...SHOULDER });
    expect(hint(m)).toMatch(/click {2}fire/);
    expect(pilot(firstLevel(carrying([gun('pistol')]))).weapon).toMatchObject({ ...SHOOT.gun, eye: 1.5 });
  });

  it('a hero carrying nothing for either is played as it was', () => {
    const plain = firstLevel(MEADOWMARK_HERO), p = pilot(plain);
    expect(p.rule?.strikeContact).toBeUndefined();
    expect(p.weapon).toBeUndefined();
    expect(hint(plain)).not.toMatch(/click {2}(strike|fire)/);
  });
});
