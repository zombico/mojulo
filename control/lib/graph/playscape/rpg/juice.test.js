import { describe, it, expect } from 'vitest';
import { readJuice, juiceKeys, JUICE_PRESETS, JUICE_ON, JUICE_ALSO } from './juice.js';
import { readRpg } from './rpg.js';
import { lowerPlay } from '../ui/direction.js';
import { momentKinds } from '../../scene/channels/moment-channel.js';
import { beamSpecs } from '../../scene/channels/beam-channel.js';

const PARTY = [{ id: 'ayla', class: 'fighter' }];

describe('battle juice: steps, composed, bound to the fight\'s happenings', () => {
  it('the defaults: every happening bound, every name followed to its steps; false is none', () => {
    const J = readJuice(undefined);
    expect(Object.keys(J.on).sort()).toEqual(Object.keys(JUICE_ON).sort());
    // a name inside a juice is that juice's steps: fire is the hit, and its burst
    expect(J.on['element:fire'].slice(0, JUICE_PRESETS.hit.length)).toEqual(JUICE_PRESETS.hit);
    expect(J.on['element:fire'].length).toBeGreaterThan(JUICE_PRESETS.hit.length);
    // a weakness layers its emphasis over whatever won
    expect(Object.keys(J.also)).toEqual(Object.keys(JUICE_ALSO));
    expect(J.also.weak).toEqual(JUICE_PRESETS.weak);
    expect(J.fx.puffs).toEqual(expect.arrayContaining(['sparks', 'flash', 'smoke']));
    expect(J.fx.shake).toBe(true);
    expect(readJuice(false)).toEqual({ on: {}, also: {}, fx: { puffs: [], shake: false, beams: {} } });
  });

  it('a world composes its own over the defaults: new names, new bindings, presets replaced', () => {
    const J = readJuice({
      slam: ['crit', { shake: 0.9 }, { emit: 'quake' }],
      hit: [{ pop: 'small' }],
      on: { 'ko:drake': ['slam', { puff: 'fireworks', at: 'actor' }], crit: 'slam' },
      also: { 'status:poison': [{ puff: 'smoke', color: '#6bd36b' }] },
    });
    expect(J.also['status:poison']).toEqual([{ puff: 'smoke', color: '#6bd36b' }]);
    expect(J.also.weak).toBeDefined();
    expect(J.on.hit).toEqual([{ pop: 'small' }]);
    expect(J.on.crit.at(-1)).toEqual({ emit: 'quake' });
    expect(J.on['ko:drake'].at(-1)).toEqual({ puff: 'fireworks', at: 'actor' });
    // fire still names hit: it is the world's hit now
    expect(J.on['element:fire'][0]).toEqual({ pop: 'small' });
  });

  it('teaches: a name it lacks, a name that names itself, a step it does not know, a value out of range', () => {
    expect(() => readJuice({ on: { hit: 'boom' } })).toThrow(/'boom' is no juice/);
    expect(() => readJuice({ a: ['b'], b: ['a'], on: { hit: 'a' } })).toThrow(/names itself \(a → b → a\)/);
    expect(() => readJuice({ on: { hit: [{ wobble: 1 }] } })).toThrow(/is a step: puff, beam/);
    expect(() => readJuice({ on: { hit: [{ puff: 'glitter' }] } })).toThrow(/puff is a moment/);
    expect(() => readJuice({ on: { hit: [{ shake: 4 }] } })).toThrow(/shake is 0 to 1/);
    expect(() => readJuice({ on: { 'Hit!': 'hit' } })).toThrow(/a happening is a word/);
    expect(() => readJuice({ on: { hit: [{ pop: 'big', at: 'actor' }] } })).toThrow(/at is not part of a pop/);
  });

  it('a skill\'s own juice: its use and its landing, a beam resolved to its attack', () => {
    const cfg = readRpg({ rpg: { party: PARTY, skills: { flare: { mp: 4, target: 'foe', power: 9, stat: 'mag', element: 'fire', juice: { cast: [{ beam: 'orb', color: '#ff7a2a' }], land: ['fire', { hold: 0.3 }] } } }, classes: { fighter: { skills: [{ skill: 'flare' }] } } } });
    expect(cfg.juice.on['cast:flare'][0]).toMatchObject({ beam: 'orb', color: '#ff7a2a', land: expect.any(Array) });
    expect(cfg.juice.fx.beams.orb).toBeDefined();
    expect(cfg.juice.on['skill:flare'].at(-1)).toEqual({ hold: 0.3 });
  });

  it('a beat\'s happenings, most specific first', () => {
    expect(juiceKeys({ kind: 'hurt', skill: 'fire', element: 'fire', mul: 2 })).toEqual(['skill:fire', 'weak', 'element:fire', 'hit']);
    expect(juiceKeys({ kind: 'hurt', skill: 'attack', crit: true })).toEqual(['skill:attack', 'crit', 'hit']);
    expect(juiceKeys({ kind: 'hurt', element: 'ice', mul: 0.5 })).toEqual(['element:ice', 'resist', 'hit']);
    expect(juiceKeys({ kind: 'ko', foe: 'slime' })).toEqual(['ko:slime', 'ko']);
    expect(juiceKeys({ kind: 'ko' })).toEqual(['fall']);
    expect(juiceKeys({ kind: 'start', boss: true })).toEqual(['start:boss', 'start']);
    expect(juiceKeys({ kind: 'cast', skill: 'heal' })).toEqual(['cast:heal', 'cast']);
    expect(juiceKeys({ kind: 'end', lost: true })).toEqual(['defeat']);
    expect(juiceKeys({ kind: 'spoils', xp: 4 })).toEqual(['victory']);
  });

  it('lowered: the level hands its ops to the characters, and the page draws the moments and attacks the juice names', () => {
    const play = { rpg: { party: PARTY, juice: { on: { 'cast:fire': [{ beam: 'ray' }] } }, encounters: [{ id: 'a', foes: ['slime'] }] } };
    const ev = lowerPlay({ play }, {});
    expect(ev.cast).toBe(true);
    expect(momentKinds(ev)).toEqual(expect.arrayContaining(['sparks', 'flash', 'shake']));
    expect(beamSpecs(ev)).toContain(ev.rpg.juice.fx.beams.ray);
    const none = lowerPlay({ play: { rpg: { ...play.rpg, juice: false } } }, {});
    expect(none.cast).toBeUndefined();
    expect(momentKinds(none)).toEqual([]);
  });
});
