// THE PLAYTHROUGH (playthrough.js): a made level played by a scripted player on the runtime it ships. One small level a
// procedure: the world's own first level's hero, armed with its feel's kit as the page arms a held blade, on a flat floor,
// against one foe that can be downed and a contract won by downing it. The basic player wins it; the still player does
// not; the same run twice is the same run.
import { describe, expect, it } from 'vitest';

import { playLevel, playthroughSummary, PLAYERS } from './playthrough.js';
import { composeMechanics } from '../game/mechanics.js';
import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { armedRule } from './feel/measure.js';

const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const H = MEADOWMARK_HERO.characters.hero;
// (a kit chosen from the table, never by hand)
const KIT = Object.keys(TEMPLATE_ARSENALS)[0];
const world = { ...MEADOWMARK_HERO, feel: KIT, arsenal: 'auto', characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items: [BLADE] } } } };

/** The world's first walk's hero, armed as the page arms it, a foe ahead and a floor; won by downing the foe. */
function level({ foeHp = 6 } = {}) {
  const G = readGameworld(world), st = gameStages(world).find((s) => s.section !== 'building');
  const m = stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero' }).args.manifest;
  const hero0 = m.entities.find((e) => e.pilotable);
  const hero = { ...hero0, rule: armedRule(hero0.rule), transform: { pos: [0, 0, 0], heading: 0 } };
  const foe = { id: 'foe-1', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: foeHp, poise: 2, radius: 0.4 }, rule: { type: 'static' }, transform: { pos: [8, 0, 0], heading: Math.PI } };
  const C = composeMechanics([{ kind: 'fail-on-death', startHp: 20, hits: 2 }, { kind: 'defeat-all', who: 'foe-*', count: 1 }]);
  const floor = { corners: [[-40, -40, 0], [40, -40, 0], [40, 40, 0], [-40, 40, 0]], normal: [0, 0, 1] };
  return { entities: [hero, foe], events: C.events, faces: [floor], colliders: [], game: { mechanics: [], on: C.on } };
}

describe('a level played through', () => {
  it('the basic player closes on the foe, downs it with its string and wins the level', () => {
    const R = playLevel(level(), { player: 'basic', seconds: 30 });
    expect(R.outcome).toBe('success');
    expect(R.won).toBe(true);
    expect(R.downs).toBe(1);
    expect(R.presses).toBeGreaterThan(0);
    expect(playthroughSummary(R)).toMatch(/^basic: won/);
  });

  it('a player who does nothing does not win a level won by fighting', () => {
    const R = playLevel(level(), { player: 'still', seconds: 10 });
    expect(R.won).toBe(false);
    expect(R.downs).toBe(0);
  });

  it('is deterministic: the same level and player play the same', () => {
    const a = playLevel(level({ foeHp: 12 }), { player: 'basic', seconds: 30 }), b = playLevel(level({ foeHp: 12 }), { player: 'basic', seconds: 30 });
    expect(a).toEqual(b);
  });

  it('names its players and refuses another in words', () => {
    expect(PLAYERS).toContain('basic');
    expect(() => playLevel(level(), { player: 'ace' })).toThrow(/player is/);
  });
});
