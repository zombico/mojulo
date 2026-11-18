// THE STARTER'S OWN FIGHTS HOLD THE FIGHT LAWS: a map that names no waves and no things is laid by its play type
// (quick.js streetPlay), and what is laid is measured (brawl/brawl-measure.js) on the reference street. A change to a
// default's counts, its food, a crowd type or a difficulty tier is read here before it ships.
import { describe, it, expect } from 'vitest';
import { streetPlay } from './quick.js';
import { brawlPreset } from '../brawl/brawl-levels.js';
import { PLAY_IDS } from '../brawl/brawl-play.js';
import { measureMap } from '../brawl/brawl-measure.js';
import { solveFighter } from '../versus/versus-solver.js';

const belt = brawlPreset('street').belt;
const me = { recipe: { ...solveFighter({ id: 'me', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' }, style: 'all-rounder' };

describe('the starter\'s fights, measured', () => {
  it.each(PLAY_IDS)('%s: what its play type lays holds every fight law', (play) => {
    const S = streetPlay(play, belt), street = { belt, players: [me], waves: S.waves, things: S.things, ...(S.play === 'gun' ? { gunner: { guns: [S.guns[0]], grenades: S.grenades ?? 3 } } : {}) };
    const M = measureMap(street);
    expect(M.laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.advice}`)).toEqual([]);
  }, 300000);
});
