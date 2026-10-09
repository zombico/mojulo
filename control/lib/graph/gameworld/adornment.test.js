import { describe, it, expect } from 'vitest';
import { readAdornment, resolveAdornment, resolveActions, readGameworld, applyDiff, buildAt, SCALES } from './index.js';
import { LOOKS } from '../playscape/elements/elements.js';

const look = Object.keys(LOOKS)[0];
// the loop: a step (early), a thrown strike (mid), a guard (late)
const actions = resolveActions({
  system: { kind: 'unlock' },
  powers: [{ id: 'step', verb: 'dash', look }, { id: 'strike', verb: 'cut', look }, { id: 'ward', verb: 'deflect', look }],
  progression: [{ stage: 'early', gains: ['step'] }, { stage: 'mid', gains: ['strike'] }, { stage: 'late', gains: ['ward'] }],
});
const sword = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const shield = { id: 'aegis', slot: 'left', build: { item: 'shield' }, serves: ['ward'] };
const bad = (a, re) => expect(() => readAdornment(a)).toThrow(re);
const world = (adornment) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: { tradition: 'anime' }, hero: { adornment } } });

describe('the hero\'s adornment', () => {
  it('says what is wrong', () => {
    bad([], /is \{ items, variations\? \}/);
    bad({ gear: [] }, /\.gear is not part of the adornment page/);
    bad({ items: [] }, /a list of \{ id, slot, build, serves \}/);
    bad({ items: [{ ...sword, id: 'Blade' }] }, /lowercase id/);
    bad({ items: [sword, sword] }, /appears twice/);
    bad({ items: [{ ...sword, slot: 'head' }] }, /slot is 'right', 'left', 'back', 'hip'/);
    bad({ items: [{ ...sword, build: { item: 'lance' } }] }, /build.item is dagger, sword/);
    bad({ items: [{ ...sword, build: { item: 'sword', type: 'equipment' } }] }, /build.type is not an equipment build word/);
    bad({ items: [{ ...sword, serves: [] }] }, /serves is a list of power ids/);
    bad({ items: [{ ...sword, serves: undefined }] }, /serves is a list of power ids/);
    bad({ items: [{ ...sword, build: { item: 'sword', dials: { mass: 9 } } }] }, /gear.right: build.dials.mass/);
    bad({ items: [{ ...sword, tiers: { final: {} } }] }, /tiers.final is not a stage/);
    bad({ items: [{ ...sword, tiers: { mid: { dials: { ornament: 9 } } } }] }, /tiers.mid: gear.right: build.dials.ornament/);
    bad({ items: [{ ...sword, tiers: { mid: { sharpness: 2 } } }] }, /tiers.mid.sharpness is not an equipment build word/);
    bad({ items: [{ ...sword, alt: [{ id: 'x' }] }] }, /alt\[0\].use is what it is used as/);
    bad({ items: [{ ...sword, alt: [{ id: 'x', use: 'a pole' }, { id: 'x', use: 'a pole' }] }] }, /alt\[1\].id 'x' appears twice/);
  });

  it('says what is wrong with a variation', () => {
    const items = [sword, shield, { id: 'second-blade', slot: 'right', build: { item: 'dagger' }, serves: ['step'] }];
    bad({ items, variations: [{ id: 'k', items: [] }] }, /variations\[0\].items is a list of item ids/);
    bad({ items, variations: [{ id: 'k', items: ['nope'] }] }, /'nope' is not an item/);
    bad({ items, variations: [{ id: 'k', items: ['blade', 'second-blade'] }] }, /two items fill the right slot/);
    bad({ items, variations: [{ id: 'k', items: ['blade'], stage: 'final' }] }, /stage is 'early' \| 'mid' \| 'late'/);
    bad({ items, variations: [{ id: 'k', items: ['blade'], scale: 'huge' }] }, /scale is 'down', 'up', or a number above 0/);
    bad({ items, variations: [{ id: 'k', items: ['blade'], scale: -1 }] }, /scale is/);
    bad({ items, variations: [{ id: 'k', items: ['blade'], use: { aegis: 'x' } }] }, /not an item this variation carries/);
    bad({ items, variations: [{ id: 'k', items: ['blade'], use: { blade: 'pole' } }] }, /'pole' is not an alternate use of it \(it has none\)/);
  });

  it('is read through the hero page of a world, which names the same errors', () => {
    expect(readGameworld(world({ items: [sword] })).characters.hero.adornment.items).toHaveLength(1);
    expect(() => readGameworld(world({ items: [{ ...sword, slot: 'head' }] }))).toThrow(/hero.adornment.items\[0\].slot/);
  });

  it('a build diff merges dials and parts a level deep and replaces the rest', () => {
    expect(applyDiff({ item: 'sword', dials: { mass: 1, ornament: 1 } }, { dials: { ornament: 3 }, gem: 'ruby' })).toEqual({ item: 'sword', dials: { mass: 1, ornament: 3 }, gem: 'ruby' });
    expect(applyDiff({ item: 'sword' }, undefined)).toEqual({ item: 'sword' });
    expect(applyDiff({ item: 'dagger' }, { item: 'sword' })).toEqual({ item: 'sword' });
  });

  it('an item grows cumulatively with the stage, and an alternate use is laid over that', () => {
    const it = readAdornment({ items: [{ ...sword, build: { item: 'sword', dials: { mass: 1, ornament: 0 } },
      tiers: { mid: { dials: { ornament: 1 } }, late: { dials: { mass: 1.5, ornament: 2 } } },
      alt: [{ id: 'pry', use: 'a bar to pry gates', serves: ['step'], build: { item: 'greatsword' } }] }] }).items[0];
    expect(buildAt(it, 'early').dials).toEqual({ mass: 1, ornament: 0 });
    expect(buildAt(it, 'mid').dials).toEqual({ mass: 1, ornament: 1 });
    expect(buildAt(it, 'late').dials).toEqual({ mass: 1.5, ornament: 2 });
    expect(buildAt(it).dials).toEqual({ mass: 1.5, ornament: 2 });
    expect(buildAt(it, 'mid', 'pry')).toMatchObject({ item: 'greatsword', dials: { mass: 1, ornament: 1 } });
  });

  it('a variation resolves to the door\'s gear and scale, at the stage it wears; the final design is the default', () => {
    const R = resolveAdornment({
      items: [{ ...sword, tiers: { mid: { dials: { ornament: 2 } } } }, shield],
      variations: [{ id: 'final-kit', items: ['blade', 'aegis'], scale: 'up' }, { id: 'mid-kit', items: ['blade'], stage: 'mid', scale: 0.9 }, { id: 'plain' , items: ['blade'], stage: 'mid' }],
    }, actions);
    expect(R.variations[0]).toMatchObject({ id: 'final-kit', stage: 'late', scale: SCALES.up });
    expect(Object.keys(R.variations[0].gear).sort()).toEqual(['left', 'right']);
    expect(R.variations[0].gear.right.dials.ornament).toBe(2);
    expect(R.variations[1]).toMatchObject({ stage: 'mid', scale: 0.9 });
    expect(R.variations[2].scale).toBeNull();
    expect(R.open).toEqual([]);
  });

  it('the loop leaves things open: a power that is not one, an item before its power, a final power nothing serves', () => {
    const R = resolveAdornment({
      items: [{ ...sword, serves: ['strike', 'blink'] }],
      variations: [{ id: 'early-kit', items: ['blade'], stage: 'early' }],
    }, actions);
    const o = R.open.join('\n');
    expect(o).toMatch(/item 'blade' serves 'blink', which is not a power/);
    expect(o).toMatch(/the final design's power 'ward' \(late\) is served by no item/);
    expect(o).toMatch(/variation 'early-kit' \(early\) carries 'blade', which serves 'strike', gained at mid/);
  });

  it('pure: the same page resolves to the same bytes', () => {
    const A = { items: [sword, shield], variations: [{ id: 'k', items: ['blade', 'aegis'] }] };
    expect(JSON.stringify(resolveAdornment(A, actions))).toBe(JSON.stringify(resolveAdornment(A, actions)));
  });
});
