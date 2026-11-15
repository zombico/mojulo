// A GAME'S STYLE METER (style-meter.js): read on the world, laid on its levels where it is asked for, nothing where not.
import { describe, it, expect } from 'vitest';
import { readStyleMeter, styleMeterOfGame, styleMeterSuggestion, STYLISH } from './style-meter.js';
import { POLE_IDS } from './feel/cards.js';
import { GAMEWORLD_KEYS } from './world.js';

const OTHER = POLE_IDS.find((id) => !STYLISH.includes(id));

describe('a game\'s style meter', () => {
  it('is the stylish template\'s on auto, the world\'s own where written, none where not', () => {
    expect(GAMEWORLD_KEYS).toContain('styleMeter');
    expect(styleMeterOfGame({ feel: STYLISH[0], styleMeter: 'auto' })).toMatchObject({ styleMeter: {}, from: 'feel' });
    expect(styleMeterOfGame({ feel: OTHER, styleMeter: 'auto' })).toBeNull();
    expect(styleMeterOfGame({ feel: OTHER, styleMeter: true })).toMatchObject({ styleMeter: {}, from: 'operator' });
    expect(styleMeterOfGame({ feel: OTHER, styleMeter: { tiers: ['dull', 'keen'], step: 50 } }).styleMeter.step).toBe(50);
    for (const none of [undefined, null, false]) expect(styleMeterOfGame({ feel: STYLISH[0], styleMeter: none })).toBeNull();
  });
  it('is offered to a stylish game that writes none, and says what it takes', () => {
    expect(styleMeterSuggestion({ feel: STYLISH[0] })).toMatchObject({ suggest: 'auto' });
    expect(styleMeterSuggestion({ feel: OTHER })).toBeNull();
    expect(styleMeterSuggestion({ feel: STYLISH[0], styleMeter: false })).toBeNull();
    for (const [bad, says] of [['loud', /is 'auto'/], [{ ranks: [] }, /has no 'ranks'/], [{ tiers: ['one'] }, /tiers is/], [{ repeat: 2 }, /repeat is/], [{ gain: { taunt: 5 } }, /not a gain/], [{ step: -1 }, /step is/]]) expect(() => readStyleMeter(bad), JSON.stringify(bad)).toThrow(says);
  });
});
