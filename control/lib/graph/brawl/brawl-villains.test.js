import { describe, it, expect } from 'vitest';
import { VILLAINS, VILLAIN_KINDS, LIEUTENANT_KINDS, VILLAIN_WORDS, readVillain, villainWave, villainSays } from './brawl-villains.js';
import { readWaves, streetOf } from './brawl-crowd.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// THE SUPERVILLAIN SHELF: each villain a row of the foe shelf's idioms, lowered onto the street's own words. One row per
// idiom is picked from the shelf in code; what is held is the idiom, not the row.
const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, boss: true }] }, 'belt');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const idioms = [...new Set(Object.values(VILLAINS).map((v) => v.idiom))];
const byIdiom = Object.fromEntries(idioms.map((i) => [i, Object.keys(VILLAINS).find((k) => VILLAINS[k].idiom === i)]));
const waveOf = (kind, over = {}) => { const W = villainWave(readVillain({ kind, ...over })); return [{ screen: 1, crowd: W.crowd, boss: W.boss }]; };

describe('the supervillain shelf', () => {
  it('every row says what it does and how it is beaten, and is read whole; villains and lieutenants are told apart', () => {
    for (const k of Object.keys(VILLAINS)) { const S = villainSays(readVillain(k)); expect(S.reads && S.beat, k).toBeTruthy(); }
    expect(VILLAIN_KINDS.length).toBeGreaterThan(0);
    expect(LIEUTENANT_KINDS.every((k) => VILLAINS[k].lieutenant)).toBe(true);
  });
  it('a designed villain is its kind\'s row with the person\'s words over it, checked word by word, teaching', () => {
    const R = readVillain({ kind: byIdiom.summoner, summons: { type: 'blaster', n: 3 }, hp: 600 });
    expect(R).toMatchObject({ idiom: 'summoner', hp: 600, summons: { type: 'blaster', n: 3 } });
    expect(() => readVillain({ kind: 'overlord' })).toThrow(/kind is one of/);
    expect(() => readVillain({ kind: byIdiom.summoner, summons: { type: 'caster' } })).toThrow(/does not summon/);
    expect(() => readVillain({ kind: byIdiom.modes, stages: [{ form: { archetype: 'rushdown', power: 'beam' } }, {}] })).toThrow(/stages\[0\]/);
    expect(() => readVillain({ kind: byIdiom.pair, pair: { archetype: 'ninja', power: 'beam' } })).toThrow(/archetype/);
    expect(() => readVillain({ kind: byIdiom.stages, stages: [{}, { calls: { robot: 2 } }] })).toThrow(/crowd type/);
    expect(() => readVillain({ mood: 'grim' })).toThrow(new RegExp(VILLAIN_WORDS[0]));
  });
  it('each idiom lowers onto the street\'s own words, which the street reads and stands', () => {
    for (const [idiom, kind] of Object.entries(byIdiom)) {
      const W = readWaves(waveOf(kind), belt)[0];
      if (idiom === 'summoner') expect(W.boss.summons, kind).toBeTruthy();
      if (idiom === 'pair') expect(W.boss.pair, kind).toBeTruthy();
      if (idiom === 'modes') expect(W.boss.stages.some((st) => st.form), kind).toBe(true);
      if (idiom === 'stages') expect(W.crowd.some((c) => c.stage), kind).toBe(true);
      expect(W.boss.recipe.specials.neutral.id, kind).toMatch(/^power\./);
      const st = streetOf({ belt, players: [{ recipe }], waves: waveOf(kind) });
      expect(Object.keys(st.mind.bosses).length, kind).toBe(idiom === 'pair' ? 2 : 1);
    }
  });
  it('the villain\'s power and name are its own over its kind\'s', () => {
    const W = villainWave(readVillain({ kind: byIdiom.summoner, power: 'flame' }), { name: 'Doctor Umbra' });
    expect(W.boss.recipe.name).toBe('Doctor Umbra');
    expect(W.boss.recipe.specials.neutral.id).toBe('power.flame');
  });
});
