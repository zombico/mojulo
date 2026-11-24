// THE ROUND'S ERAS: a party RPG's round reskinned in its setting's era, its numbers the presets'. Each era's rows read
// as a book's battles do (its looks, its foes, every item and gear); what it renames is a preset; its citadel is built
// of real programs; a sci-fi prompt composes the future round (its kit, its foes, its items, its boss, its place), and a
// fantasy one is as it was.
import { describe, it, expect } from 'vitest';
import { ROUND_ERAS, ROUND_ERA_IDS, roundEraOf, eraBattles } from './round-eras.js';
import { readBattles, foeGearOf, FOE_LOOKS } from './battles.js';
import { FOE_PRESETS, ITEM_PRESETS, GEAR_PRESETS } from '../playscape/rpg/presets.js';
import { PROGRAM_IDS } from '../era/programs.js';
import { composeGameworld, readGameworld } from './index.js';

describe('a round\'s eras', () => {
  it('each era\'s rows read as a book\'s battles, renaming presets only, its citadel of real programs; fantasy has none', () => {
    expect(ROUND_ERA_IDS).toEqual(expect.arrayContaining(['future', 'modern']));
    expect(roundEraOf('rustic')).toBeNull();
    for (const era of ROUND_ERA_IDS) {
      const R = ROUND_ERAS[era], E = eraBattles(R);
      expect(() => readBattles(E), era).not.toThrow();
      for (const k of Object.keys(R.foes)) expect(FOE_PRESETS[k] || FOE_LOOKS[k], `${era} ${k}`).toBeTruthy();
      for (const k of Object.keys(R.items)) expect(ITEM_PRESETS[k], `${era} ${k}`).toBeTruthy();
      for (const k of Object.keys(R.gear)) expect(GEAR_PRESETS[k], `${era} ${k}`).toBeTruthy();
      for (const u of [R.citadel.gate, R.citadel.vault, R.citadel.core]) expect(PROGRAM_IDS, `${era} ${u}`).toContain(u);
      // (every preset written, so a named table keeps the whole list; the numbers the presets')
      expect(Object.keys(E.items).sort()).toEqual(Object.keys(ITEM_PRESETS).sort());
      expect(E.foes.slime).toMatchObject({ ...FOE_PRESETS.slime, name: R.foes.slime.name });
    }
  });

  it('a kind\'s arms go with its preset look, never with an era\'s', () => {
    expect(foeGearOf(FOE_LOOKS.goblin, 'goblin')?.right?.armory).toBe('cudgel');
    expect(foeGearOf({ people: 'insectoid' }, 'goblin')).toBeNull();
  });

  it('a sci-fi prompt composes the future round; a fantasy one is as it was', () => {
    const W = composeGameworld({ prompt: 'a sci-fi jrpg where we storm the alien fortress', seed: 3 });
    expect(W.style.kit).toBe('alien-night');
    expect(W.brief.round.era.era).toBe('future');
    expect(W.battles.foes.wolf.name).toBe('Hound Unit');
    expect(W.battles.looks.wolf).toEqual({ species: 'wolf', ooze: 'transmetal' });
    expect(W.battles.items.potion.name).toBe('Med-kit');
    expect(W.battles.bossPages[0].who).toBe('Core Sentinel');
    expect(W.brief.round.citadel.uses).toEqual(['barracks', 'lab', 'command']);
    expect(Object.values(W.levels)[0].name).toBe('Colony town');
    expect(() => readGameworld(W)).not.toThrow();
    const F = composeGameworld({ prompt: 'a medieval fantasy jrpg with a dungeon and a boss', seed: 3 });
    expect(F.brief.round.era).toBeUndefined();
    // (only its boss written out, to edit, as the preset is: round-bosses.js)
    expect(F.battles.foes).toEqual({ drake: FOE_PRESETS.drake });
  });
});
