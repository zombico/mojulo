import { describe, it, expect } from 'vitest';
import { readJuice, juiceKeys, lensYields, JUICE_PRESETS, JUICE_ON, JUICE_ALSO } from './juice.js';
import { rpgUiSpec, rpgUiCss, rpgUiTheme, LENS_SCOPE } from './rpg-ui.js';
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
    expect(readJuice(false)).toEqual({ on: {}, also: {}, fx: { puffs: [], shake: false, beams: {}, lens: false } });
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

describe('the bodies act a blow out', () => {
  it('a blow makes its striker swing and its target recoil, a KO a fall; an act is a step any juice can take', () => {
    expect(JUICE_PRESETS.hit).toEqual(expect.arrayContaining([{ act: 'strike', at: 'actor' }, { act: 'hurt' }]));
    expect(JUICE_PRESETS.crit).toEqual(expect.arrayContaining([{ act: 'strike', at: 'actor' }, { act: 'hurt' }]));
    expect(JUICE_PRESETS.ko).toContainEqual({ act: 'fall' });
    const J = readJuice({ on: { 'skill:fire': [{ act: 'cast', at: 'actor', for: 0.8 }, 'hit'] } });
    expect(J.on['skill:fire'][0]).toEqual({ act: 'cast', at: 'actor', for: 0.8 });
    expect(() => readJuice({ on: { hit: [{ act: 'dance' }] } })).toThrow(/act is strike, cast, hurt, fall/);
    expect(() => readJuice({ on: { hit: [{ act: 'strike', k: 2 }] } })).toThrow(/k is not part of a act/);
  });
});

describe('the lens: the screen round a still figure, where the world leaves the beat bare', () => {
  it('a step any juice can take, read and taught; by default a miss bends the air round its target, a cast lights the caster\'s', () => {
    const J = readJuice({ on: { 'skill:fire': [{ lens: 'ink', at: 'actor' }, 'hit'] } });
    expect(J.on['skill:fire'][0]).toEqual({ lens: 'ink', at: 'actor' });
    expect(J.fx.lens).toBe(true);
    expect(readJuice(false).fx.lens).toBe(false);
    expect(() => readJuice({ on: { hit: [{ lens: 'glow' }] } })).toThrow(/lens is ring, lift, shade, ink/);
    expect(() => readJuice({ on: { hit: [{ lens: 'ring', for: 1 }] } })).toThrow(/for is not part of a lens/);
    const D = readJuice(undefined);
    expect(D.on.miss).toContainEqual({ lens: 'ring' });
    expect(D.on.cast).toEqual([{ lens: 'lift', at: 'actor' }]);
    expect(juiceKeys({ kind: 'cast', who: 'ayla' })).toContain('cast');
  });

  it('it yields where the world answers its figure (a puff on it, a beam landing on it) or the whole screen (a flash)', () => {
    const at = { lens: 'ring' }, mine = { lens: 'lift', at: 'actor' };
    expect(lensYields([at], at)).toBe(false);
    expect(lensYields([{ flash: '#fff' }, mine], mine)).toBe(true);
    // a puff on the same figure yields; on the other side it does not
    expect(lensYields([{ puff: 'sparks' }, at], at)).toBe(true);
    expect(lensYields([{ puff: 'sparks' }, mine], mine)).toBe(false);
    expect(lensYields([{ puff: 'smoke', at: 'actor' }, mine], mine)).toBe(true);
    // a beam lands on the target, never the actor
    expect(lensYields([{ beam: 'bolt' }, at], at)).toBe(true);
    expect(lensYields([{ beam: 'bolt' }, mine], mine)).toBe(false);
    // the defaults: every bound happening's lens plays (they are put where the world is bare)
    const D = readJuice(undefined);
    for (const steps of Object.values(D.on)) for (const s of steps) if (s.lens) expect(lensYields(steps, s)).toBe(false);
  });

  it('the fight\'s UI lays it apart from its windows, its strikes the figures the channel projects, its host never raised', () => {
    const lens = rpgUiSpec().lens;
    expect(lens.use).toBe('lens');
    expect(lens.children[0]).toMatchObject({ use: 'strike', props: { rows: { bind: 'battle.strikes' } } });
    const css = rpgUiCss(rpgUiTheme({}));
    const host = css.split('\n').find((l) => l.startsWith(`${LENS_SCOPE}{`));
    expect(host).toBeTruthy();
    expect(host).not.toMatch(/z-index|contain|isolation|transform|opacity|filter/);
    expect(css).toContain(`${LENS_SCOPE} .mana-lens .mana-struck[data-kind=ring]`);
  });
});
