/**
 * The playscape's acceptance test: no Ikea furniture in a lich's crypt, unless we really want it. Every shelf the
 * builder draws from is sorted for the world's setting; what misses never arrives unasked, and what the recipe names
 * arrives stamped with what it misses.
 */
import { describe, expect, it } from 'vitest';

import { SETTING_AXES, admit, fitSetting, settingErrors, tagErrors } from './setting.js';
import { SHELVES, sortShelves } from './shelves.js';
import { STAGE_KIT_SETTINGS, stageSetting } from '../era/kit-settings.js';
import { STAGE_KITS } from '../era/stage.js';
import { starter } from '../era/entries.js';

// stands in for the furnishings roster (1006-furnishings-roster) until it lands on this line: a flat-pack living room
const FLAT_PACK = {
  about: 'modern domestic furniture',
  entries: () => ['sofa', 'media-unit', 'coffee-table', 'floor-lamp', 'bookcase'].map((id) => ({
    id: `furnishing:${id}`, role: id, setting: { era: ['modern'], place: ['domestic', 'civic'], fiction: ['grounded'] },
  })),
};
const LICH_CRYPT = { ...starter('gothic-stone'), setting: { fiction: 'fantasy' } };
const ids = (xs) => xs.map((e) => e.id);

describe('the lich\'s crypt', () => {
  const world = stageSetting(LICH_CRYPT);

  it('reads as a medieval burial place where magic is real', () => {
    expect(world).toEqual({ era: 'medieval', place: 'funerary', fiction: 'fantasy' });
  });

  it('draws no flat-pack furniture on its own', () => {
    const sorted = sortShelves(world, { shelves: { ...SHELVES, furnishing: FLAT_PACK } });
    expect(sorted.furnishing.admitted).toEqual([]);
    expect(sorted.furnishing.left.map((l) => l.misses.map((m) => m.axis))).toContainEqual(['era', 'place', 'fiction']);
  });

  it('keeps a sofa the recipe names, stamped with what it misses', () => {
    const sorted = sortShelves(world, { named: ['furnishing:sofa'], shelves: { furnishing: FLAT_PACK } });
    expect(ids(sorted.furnishing.kept)).toEqual(['furnishing:sofa']);
    expect(sorted.furnishing.kept[0].note).toMatch(/named off-setting: misses era medieval/);
    expect(ids(sorted.furnishing.admitted)).toEqual([]);
  });

  it('dresses itself from what belongs: bones and a coffin, a skull and a key, a magic glow, a book face', () => {
    const s = sortShelves(world);
    expect(ids(s.prop.admitted)).toEqual(expect.arrayContaining(['prop:coffin', 'prop:bones', 'prop:crate']));
    expect(ids(s.glyph.admitted)).toEqual(expect.arrayContaining(['glyph:skull', 'glyph:key', 'glyph:orb']));
    expect(ids(s.glyph.admitted)).not.toEqual(expect.arrayContaining(['glyph:flag']));
    expect(ids(s.glyph.admitted)).not.toContain('glyph:star');
    expect(ids(s.sfx.admitted)).toEqual(expect.arrayContaining(['sfx:drain', 'sfx:ward']));
    expect(ids(s.hud.admitted)).not.toContain('hud:style:hud');
    expect(ids(s.hud.admitted)).not.toContain('hud:font:mono');
  });

  it('takes every rule: a rule has no look of its own', () => {
    const s = sortShelves(world);
    expect(s.idiom.left).toEqual([]);
  });

  it('a grounded crypt (no lich) has no glow at all', () => {
    const s = sortShelves(stageSetting(starter('gothic-stone')));
    expect(ids(s.sfx.admitted)).toEqual(['sfx:hit']);
    expect(ids(s.glyph.admitted)).not.toContain('glyph:orb');
  });

  it('the same flat-pack sofa is welcome in a modern plaza', () => {
    expect(admit(FLAT_PACK.entries(), stageSetting(starter('island-plaza'))).admitted.length).toBe(5);
  });
});

describe('the setting words', () => {
  it('every stage kit stands somewhere, in known words', () => {
    expect(new Set(Object.keys(STAGE_KIT_SETTINGS))).toEqual(new Set(Object.keys(STAGE_KITS)));
    for (const [k, s] of Object.entries(STAGE_KIT_SETTINGS)) expect(settingErrors(s, k)).toEqual([]);
  });

  it('every entry on every shelf is tagged (or deliberately untagged) in known words', () => {
    for (const [shelf, s] of Object.entries(SHELVES)) {
      for (const e of s.entries()) {
        if (shelf === 'idiom') { expect(e.setting, e.id).toBeUndefined(); continue; }
        expect(e.setting, `${e.id} has no setting row`).toBeTruthy();
        expect(tagErrors(e.setting, e.id)).toEqual([]);
      }
    }
  });

  it('refuses a world value off the list, naming the list', () => {
    expect(settingErrors({ fiction: 'lich' })[0]).toMatch(/grounded, fantasy, sci-fi, toy/);
  });

  it('an axis either side leaves out constrains nothing', () => {
    expect(fitSetting({}, { era: 'medieval' }).fits).toBe(true);
    expect(fitSetting({ era: ['modern'] }, {}).fits).toBe(true);
    expect(Object.keys(SETTING_AXES)).toEqual(['era', 'place', 'fiction']);
  });
});
