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
import { FOE_CLASSES } from '../foes/index.js';
import { resolveFoe } from '../foes/resolve.js';

const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const H = MEADOWMARK_HERO.characters.hero;
// (a kit chosen from the table, never by hand)
const KIT = Object.keys(TEMPLATE_ARSENALS)[0];
const world = { ...MEADOWMARK_HERO, feel: KIT, arsenal: 'auto', characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items: [BLADE] } } } };

// (a kit whose sidearm is an automatic, chosen from the table: the sidearm a shot answers)
const AUTO_KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => (TEMPLATE_ARSENALS[id].ranged ?? []).some((r) => r.mode === 'auto'));

// (the foe shelf's class whose charge is telegraphed, chosen from the table: the one that rushes)
const RUSHER = Object.values(FOE_CLASSES).find((c) => c.move === 'rush').id;
/** A foe of the shelf as a level stands it: its class's rule and blow, a body to hit. */
const shelfFoe = (cls, hp, pos) => {
  const E = resolveFoe({ class: cls }).entity;
  return { id: 'foe-1', team: 'foes', ...E, rule: { ...E.rule, eye: 0, step: 0.3, collideRadius: 0.3, collideHeight: 1.8 }, body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp, poise: 2, radius: 0.4 }, transform: { pos, heading: Math.PI } };
};

/** The world's first walk's hero, armed as the page arms it, a foe ahead and a floor; won by downing the foe.
 * `shooter`: the foe carries a gun and stands out of the blade's reach, a wall across the line from where the hero
 * starts (and no further: a few steps on, the line is clear). */
function level({ foeHp = 6, kit = KIT, shooter = false, shelf = null } = {}) {
  const W = kit === KIT ? world : { ...world, feel: kit };
  const G = readGameworld(W), st = gameStages(W).find((s) => s.section !== 'building');
  const m = stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero' }).args.manifest;
  const hero0 = m.entities.find((e) => e.pilotable);
  const hero = { ...hero0, rule: armedRule(hero0.rule), transform: { pos: [0, 0, 0], heading: 0 } };
  const foe = { id: 'foe-1', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: foeHp, poise: 2, radius: 0.4 }, rule: { type: 'static' }, transform: { pos: [8, 0, 0], heading: Math.PI } };
  const C = composeMechanics([{ kind: 'fail-on-death', startHp: 20, hits: 2 }, { kind: 'defeat-all', who: 'foe-*', count: 1 }]);
  const floor = { corners: [[-40, -40, 0], [40, -40, 0], [40, 40, 0], [-40, 40, 0]], normal: [0, 0, 1] };
  if (shelf) return { entities: [hero, shelfFoe(shelf, foeHp, [10, 0, 0])], events: C.events, faces: [floor], colliders: [], game: { mechanics: [], on: C.on } };
  if (!shooter) return { entities: [hero, foe], events: C.events, faces: [floor], colliders: [], game: { mechanics: [], on: C.on } };
  const far = { ...foe, weapon: { fireClass: 'sight', damage: 1 }, transform: { pos: [20, 2, 0], heading: Math.PI } };
  const wall = { min: [3, -3, 0], max: [3.5, 0.8, 2.5], of: 'wall' };
  return { entities: [hero, far], events: C.events, faces: [floor], colliders: [wall], game: { mechanics: [], on: C.on } };
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

  it('a shooter behind a wall is closed on until the line is clear, then shot down: no round is spent on the wall', () => {
    const R = playLevel(level({ kit: AUTO_KIT, shooter: true, foeHp: 4 }), { player: 'basic', seconds: 30 });
    expect(R.won).toBe(true);
    // (downed by the sidearm from where the line opened, never walked up to and cut down)
    expect(R.shots).toBeGreaterThan(0);
    expect(R.presses).toBe(0);
  });

  it('a charge telegraphed is met on the guard: the rusher spends its charge there and is cut down, the hero unhurt', () => {
    const R = playLevel(level({ shelf: RUSHER, foeHp: 8 }), { player: 'basic', seconds: 60 });
    expect(R.won).toBe(true);
    expect(R.hitsBy).toEqual({});
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
