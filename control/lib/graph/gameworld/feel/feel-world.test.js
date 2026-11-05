// A gameworld's `feel`: read with the world (refused, teaching, when it names nothing), lowered over the hero's platform
// rule in every level the runner makes, the rest of the level untouched; a world with no feel is the world it was.

import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from '../index.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { POLE_IDS, POLES } from './cards.js';
import { feelCard, lowerFeel, TAKES } from './lower.js';

const pole = POLE_IDS.find((id) => !POLES[id].set?.lane && !POLES[id].variants);
const order = (W) => { const G = readGameworld(W), st = gameStages(W)[0]; return stageLevelOrder(G, st, { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest; };

describe('a gameworld\'s feel', () => {
  it('reads with the world, and refuses a template it does not know, naming the ones it does', () => {
    expect(readGameworld({ ...MEADOWMARK, feel: pole }).feel).toEqual({ pole });
    expect(() => readGameworld({ ...MEADOWMARK, feel: 'nope' })).toThrow(new RegExp(`feel\\.pole is one of .*${pole}`));
    expect(readGameworld(MEADOWMARK).feel).toBeUndefined();
  });

  it('lays the template\'s card over the hero\'s rule; the rest of the level is the level it was', () => {
    const plain = order(MEADOWMARK), felt = order({ ...MEADOWMARK, feel: pole }), want = lowerFeel(feelCard(pole)).rule;
    const hero = felt.entities[0].rule;
    for (const [k, v] of Object.entries(want)) expect([k, hero[k]]).toEqual([k, v]);
    expect(hero.type).toBe(plain.entities[0].rule.type);
    const strip = (m) => JSON.stringify({ ...m, entities: m.entities.map((e, i) => (i === 0 ? { ...e, rule: null } : e)) });
    expect(strip(felt)).toBe(strip(plain));
  });

  it('a written feel wins over a goal\'s own feet (a deathmatch\'s shooter pole); without one the goal\'s feet stand', () => {
    const feet = () => ({ pilot: { rule: { speed: 1.23, jumpSpeed: 3.21, loadout: ['kept'] } } });
    const at = (W) => { const G = readGameworld(W); return stageLevelOrder(G, gameStages(W)[0], { ref: 'lv_0', heroRef: 'gw-hero', extra: feet }).args.manifest.entities[0].rule; };
    const own = at(MEADOWMARK), felt = at({ ...MEADOWMARK, feel: pole }), want = lowerFeel(feelCard(pole)).rule;
    expect([own.speed, own.jumpSpeed]).toEqual([1.23, 3.21]);
    expect([felt.speed, felt.jumpSpeed, felt.loadout]).toEqual([want.speed, want.jumpSpeed, ['kept']]);
  });

  it('a feel that asks for its takes ships them: the rule\'s takes, the hero\'s own jumps by state; the rest of the level as the plain feel\'s', () => {
    const plain = order({ ...MEADOWMARK, feel: pole }), taken = order({ ...MEADOWMARK, feel: { pole, takes: true } });
    expect(taken.entities[0].rule.takes).toEqual(lowerFeel(feelCard(pole), { takes: true }).rule.takes);
    const fig = taken.entities[0].body.figure, F = taken.figures[fig];
    expect(F.clips).toMatchObject(TAKES);
    expect(F.jumps.sort()).toEqual([...new Set(Object.values(TAKES))].sort());
    const strip = (m) => JSON.stringify({ ...m, entities: m.entities.map((e, i) => (i === 0 ? { ...e, rule: { ...e.rule, takes: null } } : e)), figures: Object.fromEntries(Object.entries(m.figures ?? {}).map(([k, f]) => [k, { ...f, clips: Object.fromEntries(Object.entries(f.clips ?? {}).filter(([st]) => !(st in TAKES))), jumps: null }])) });
    expect(strip(taken)).toBe(strip({ ...plain, figures: Object.fromEntries(Object.entries(plain.figures ?? {}).map(([k, f]) => [k, { ...f, jumps: null }])) }));
  });
});
