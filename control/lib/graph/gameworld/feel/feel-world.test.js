// A gameworld's `feel`: read with the world (refused, teaching, when it names nothing), lowered over the hero's platform
// rule in every level the runner makes, the rest of the level untouched; a world with no feel is the world it was.

import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from '../index.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { POLE_IDS, POLES } from './cards.js';
import { feelCard, lowerFeel } from './lower.js';

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
});
