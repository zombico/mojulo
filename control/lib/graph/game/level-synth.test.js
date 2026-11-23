// A level's mechanics lowered (level-synth.js): a level that keeps its own health and carries the Halo Meter is mended
// by the transformation (the bus's `halo:heal`, worlds/controllable/style.js); any other level gains no rule.
import { describe, it, expect } from 'vitest';
import { synthesizeLevel } from './level-synth.js';
import { createBusState, processEvents } from '../worlds/event-bus.js';

const level = (extra = {}) => ({ entities: [{ id: 'hero', rule: { type: 'platform' }, transform: { pos: [0, 0, 0] } }], game: { levelRef: 'l', mechanics: [{ kind: 'reach-exit', at: [9, 0, 0], radius: 1 }, { kind: 'fail-on-death', startHp: 100, hits: 10 }] }, ...extra });
const heals = (ev) => ev.reactions.filter((r) => r.on === 'halo:heal');

describe('the Halo Meter mends a level\'s own health', () => {
  it('a level with the meter gains the rule, up to the health it starts at', () => {
    const { mechEvents } = synthesizeLevel(level({ styleMeter: { halo: {} } }));
    expect(heals(mechEvents)).toEqual([{ on: 'halo:heal', do: 'inc', var: 'hp', by: 'event.by', max: 100 }]);
    const S = createBusState(mechEvents, []);
    S.vars.hp = 70;
    processEvents(S, [{ type: 'halo:heal', by: 4 }]);
    expect(S.vars.hp).toBe(74);
    processEvents(S, [{ type: 'halo:heal', by: 90 }]);
    expect(S.vars.hp).toBe(100);
  });
  it('a level without the Halo Meter, or without health of its own, gains nothing', () => {
    expect(heals(synthesizeLevel(level()).mechEvents)).toEqual([]);
    expect(heals(synthesizeLevel(level({ styleMeter: {} })).mechEvents)).toEqual([]);
    const body = level({ styleMeter: { halo: {} } }); body.game.mechanics = [body.game.mechanics[0], { kind: 'fail-on-death', of: 'body' }];
    expect(heals(synthesizeLevel(body).mechEvents)).toEqual([]);
  });
});
