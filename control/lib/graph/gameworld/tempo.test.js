// A gameworld's `tempo`: its world clock's moments (worlds/controllable/world-clock.js), laid on every level as `tempo`;
// 'auto' takes the game type's own from its juice flavor; a world that writes none is the world it was.

import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { tempoOfGame, tempoSuggestion, TEMPO_OF_FLAVOR } from './tempo.js';
import { TEMPO_PRESETS } from '../worlds/controllable/world-clock.js';
import { JUICE_FLAVORS } from '../scene/juice-style.js';

const order = (W) => { const G = readGameworld(W), st = gameStages(W)[0]; return stageLevelOrder(G, st, { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest; };
const slowFlavor = Object.keys(TEMPO_OF_FLAVOR).find((f) => TEMPO_OF_FLAVOR[f]), realFlavor = Object.keys(TEMPO_OF_FLAVOR).find((f) => !TEMPO_OF_FLAVOR[f]);

describe('a gameworld\'s tempo', () => {
  it('reads with the world, and teaches on a word it does not know', () => {
    expect(readGameworld({ ...MEADOWMARK, tempo: 'finisher' }).tempo).toBe('finisher');
    expect(readGameworld(MEADOWMARK).tempo).toBeUndefined();
    expect(() => readGameworld({ ...MEADOWMARK, tempo: 'matrix' })).toThrow(/finisher.*'auto'/s);
    expect(() => readGameworld({ ...MEADOWMARK, tempo: { moments: [{ on: 'strike', scale: 3, hold: 1 }] } })).toThrow(/0 \(held\) to 1/);
  });

  it('lays nothing on a world that writes none, or false; the same level with its tempo on one that does', () => {
    const plain = order(MEADOWMARK), off = order({ ...MEADOWMARK, tempo: false }), on = order({ ...MEADOWMARK, tempo: ['finisher', 'bullet'] });
    expect(plain.tempo).toBeUndefined();
    expect(JSON.stringify(off)).toBe(JSON.stringify(plain));
    expect(on.tempo).toEqual({ moments: [...TEMPO_PRESETS.finisher, ...TEMPO_PRESETS.bullet] });
    const { tempo: _t, ...rest } = on;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(plain));
  });

  it('\'auto\' takes the game type\'s own: a flavor that slows on its finisher, one that keeps real time', () => {
    expect(Object.keys(TEMPO_OF_FLAVOR).sort()).toEqual(Object.keys(JUICE_FLAVORS).sort());
    const slow = readGameworld({ ...MEADOWMARK, juice: { flavor: slowFlavor }, tempo: 'auto' });
    expect(tempoOfGame(slow)).toMatchObject({ tempo: { moments: TEMPO_PRESETS[TEMPO_OF_FLAVOR[slowFlavor]] }, from: 'flavor' });
    expect(tempoOfGame(readGameworld({ ...MEADOWMARK, juice: { flavor: realFlavor }, tempo: 'auto' }))).toBeNull();
    // the suggestion: what auto would lay on a world that writes none
    expect(tempoSuggestion(readGameworld({ ...MEADOWMARK, juice: { flavor: slowFlavor } }))).toMatchObject({ from: 'flavor' });
    expect(tempoSuggestion(slow)).toBeNull();
  });
});
