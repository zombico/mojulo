import { describe, it, expect } from 'vitest';
import { readAdornment, resolveAdornment, resolveActions, readGameworld, applyDiff, buildAt } from './index.js';
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
    bad([], /is \{ items, bodily\? \}/);
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

  it('variations are retired: the page says where the loadouts went', () => {
    bad({ items: [sword], variations: [{ id: 'k', items: ['blade'] }] }, /loadouts are retired; each item is the template of its class in the world's equipment table/);
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

  it('a loop the items serve leaves nothing open', () => {
    expect(resolveAdornment({ items: [sword, shield], bodily: ['step'] }, actions).open).toEqual([]);
  });

  it('the loop leaves things open: a power that is not one, a final power nothing serves', () => {
    const R = resolveAdornment({ items: [{ ...sword, serves: ['strike', 'blink'] }] }, actions);
    const o = R.open.join('\n');
    expect(o).toMatch(/item 'blade' serves 'blink', which is not a power/);
    expect(o).toMatch(/the final design's power 'ward' \(late\) is served by no item/);
  });

  it('pure: the same page resolves to the same bytes', () => {
    const A = { items: [sword, shield] };
    expect(JSON.stringify(resolveAdornment(A, actions))).toBe(JSON.stringify(resolveAdornment(A, actions)));
  });
});
