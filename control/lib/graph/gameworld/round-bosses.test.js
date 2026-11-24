// THE ROUND'S BOSSES: the climax each kind of story calls for, a starter each, written out whole in the world's battles
// so the person edits it. Every story has its boss; a named story lays its own (the sea's leviathan, in its era too);
// what the world writes is what the fight reads (an edited row changes the fight); and a person's own boss, a foe of
// their own with its own look and height, is laid as readily as a preset.
import { describe, it, expect } from 'vitest';
import { ROUND_BOSSES, ROUND_BOSS_IDS, bossOfLabour, roundBossBattles } from './round-bosses.js';
import { LABOURS } from './gmn.js';
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { FOE_LOOKS, FOE_HEIGHT, battleBase, foeGearOf, readBattles } from './battles.js';
import { composeGameworld, readGameworld } from './index.js';
import { ROUND_ERAS, ROUND_ERA_IDS } from './round-eras.js';
import { TRADITIONS } from './characters.js';
import { battlePeopleRoll } from './battles.js';
import { egocubeCreate, rollStored } from '../egocube/kind.js';

describe('the round\'s bosses', () => {
  it('every story has one, a preset with its look and height; its rows are the battles\' own', () => {
    for (const labour of Object.keys(LABOURS)) expect(ROUND_BOSS_IDS, labour).toContain(bossOfLabour(labour));
    expect(bossOfLabour(undefined)).toBe('drake');
    const id = bossOfLabour('cross-the-great-sea'), R = roundBossBattles(id, { place: 'the far shore' });
    expect(FOE_PRESETS[id] && FOE_LOOKS[id] && FOE_HEIGHT[id]).toBeTruthy();
    expect(R.foes[id]).toEqual(FOE_PRESETS[id]);
    expect(R.bossPages[0].say).toContain('the far shore');
    // (a beast is told, a speaker speaks)
    expect(R.bossPages[0].who).toBeUndefined();
    expect(roundBossBattles('champion', { place: 'x' }).bossPages[0].who).toBe('The Champion');
    expect(() => readBattles(R)).not.toThrow();
    // (a people boss holds its kind's arms though its look is written out)
    expect(foeGearOf(structuredClone(FOE_LOOKS.champion), 'champion')?.right?.armory).toBe('old-longsword');
    expect(Object.keys(ROUND_BOSSES)).toEqual(ROUND_BOSS_IDS);
  });

  it('a named story lays its own, written out whole, in its era too; what is written is what the fight reads', () => {
    const W = composeGameworld({ prompt: 'a jrpg voyage across the sea to find my sister', seed: 3 });
    expect(W.battles.boss).toEqual(['leviathan']);
    expect(W.battles.foes.leviathan).toMatchObject({ hp: FOE_PRESETS.leviathan.hp, phases: FOE_PRESETS.leviathan.phases });
    expect(W.battles.looks.leviathan).toEqual(FOE_LOOKS.leviathan);
    expect(W.battles.heights.leviathan).toBe(FOE_HEIGHT.leviathan);
    expect(W.brief.round.boss).toMatchObject({ pack: ['leviathan'], for: 'cross-the-great-sea' });
    expect(() => readGameworld(W)).not.toThrow();
    // (edited: its numbers, its form, its name, as the fight reads them)
    const E = structuredClone(W);
    Object.assign(E.battles.foes.leviathan, { hp: 999, name: 'Old Tidecaller' });
    E.battles.foes.leviathan.phases[0].weak = ['light'];
    const cfg = readRpg({ rpg: battleBase(E) });
    expect(cfg.foes.leviathan).toMatchObject({ name: 'Old Tidecaller', base: { hp: 999 } });
    expect(cfg.foes.leviathan.phases[0].weak).toEqual(['light']);
    // (in its era: renamed, in its era's look)
    const F = composeGameworld({ prompt: 'a sci-fi jrpg voyage across the sea to find my sister', seed: 3 });
    expect(F.battles.foes.leviathan.name).toBe('Abyssal Leviathan');
    expect(F.battles.looks.leviathan).toMatchObject({ species: 'seaSerpent', ooze: 'techno' });
  });

  it('a person\'s own boss is laid as readily: their foe, its look and height', () => {
    const W = structuredClone(composeGameworld({ prompt: 'a jrpg voyage across the sea to find my sister', seed: 3 }));
    W.battles.boss = ['kraken'];
    W.battles.foes.kraken = { name: 'Kraken', hp: 600, atk: 20, def: 10, mag: 20, spd: 8, boss: true, skills: ['tidal-wave'],
      pattern: [{ use: 'attack' }, { use: 'tidal-wave', when: { every: 3 }, charge: '{name} coils its arms…' }] };
    W.battles.looks.kraken = { species: 'octopus', ooze: 'frost' };
    W.battles.heights.kraken = 2.8;
    W.battles.bossPages = [{ when: { start: true }, say: 'The deep stirs.' }];
    expect(() => readGameworld(W)).not.toThrow();
    expect(readRpg({ rpg: battleBase(W) }).foes.kraken.pattern[1].charge).toBe('{name} coils its arms…');
    expect(() => readBattles({ ...W.battles, heights: { kraken: 40 } })).toThrow(/0.3 to 12/);
  });

  it('a people boss is drawn in every tradition at the age it names, and an era\'s holds none of the fantasy armory', () => {
    // (the people bosses, found in code: a look that names a people)
    const people = ROUND_BOSS_IDS.filter((id) => FOE_LOOKS[id].people);
    expect(people.length).toBeGreaterThan(0);
    for (const tradition of Object.keys(TRADITIONS)) for (const id of people) {
      const look = FOE_LOOKS[id], G = { seed: 3, battles: {}, characters: { direction: { tradition } } };
      const C = egocubeCreate(rollStored({ kind: 'egocube', roll: battlePeopleRoll(G, id, look), moves: 'battle' }), { armed: true });
      expect(C.node.band, `${tradition} ${id}`).toBe(look.facets.age);
      expect(C.create.spec.head === 'anime', `${tradition} ${id}`).toBe(TRADITIONS[tradition].head === 'anime');
      expect((C.create.spec.outfit?.pieces ?? []).some((p) => p.kind === 'medallion'), `${tradition} ${id}`).toBe(false);
    }
    for (const era of ROUND_ERA_IDS) for (const id of people) {
      const L = ROUND_ERAS[era].foes[id]?.look;
      if (L) expect(foeGearOf(L, id)?.right?.armory ?? null, `${era} ${id}`).toBeNull();
    }
  });
});
