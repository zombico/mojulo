// THE HIGHLIGHT: a thing indicated by a rim light (a fresnel at its silhouette), a standing state of the fx channel.
import { describe, it, expect } from 'vitest';
import { readHighlight, highlightFor, isHighlight, HIGHLIGHT_COLOR, HIGHLIGHT_MOTIONS } from './highlight.js';
import { decorateMechanics } from './mechanic-decor.js';
import { fxChannelScript } from '../scene/channels/fx.js';

describe('a highlight, as words', () => {
  it('fills every dial; true is the default colour', () => {
    expect(readHighlight({ highlight: true })).toEqual({ highlight: HIGHLIGHT_COLOR, pulse: false, power: 2.2, k: 1.1 });
    expect(readHighlight({ highlight: '#59D8FF', pulse: true, as: HIGHLIGHT_MOTIONS[0], when: 'quest-next' })).toMatchObject({ highlight: '#59d8ff', pulse: true, as: HIGHLIGHT_MOTIONS[0], when: 'quest-next' });
  });
  it('refuses a word it does not know, and says which', () => {
    expect(() => readHighlight({ highlight: 'gold' })).toThrow(/#rrggbb/);
    expect(() => readHighlight({ highlight: true, glow: 2 })).toThrow(/glow/);
    expect(() => readHighlight({ highlight: true, as: 'dim' })).toThrow(new RegExp(HIGHLIGHT_MOTIONS.join(', ')));
    expect(() => readHighlight({ highlight: true, power: 40 })).toThrow(/power/);
  });
  it('a level\'s default: true, a colour or its dials; unsaid, none', () => {
    expect(highlightFor({})).toBeNull();
    expect(highlightFor({ highlight: false })).toBeNull();
    expect(highlightFor({ highlight: true })).toEqual({ highlight: true });
    expect(highlightFor({ highlight: '#ff5a7a' })).toEqual({ highlight: '#ff5a7a' });
    expect(highlightFor({ highlight: { color: '#ff5a7a', pulse: true } })).toEqual({ highlight: '#ff5a7a', pulse: true });
    expect(() => highlightFor({ highlight: 3 })).toThrow(/game.highlight/);
  });
});

describe('the fx channel carries it', () => {
  const plain = { states: { d: 'float' }, on: { 'goal:*': 'burst' } };
  it('a world without one emits not a byte of it', () => { expect(fxChannelScript(plain)).not.toMatch(/Hl|highlight/i); });
  it('a state that is one: the shell, the page\'s own depth, its dials filled; the script parses', () => {
    const js = fxChannelScript({ states: { d: { highlight: true, as: 'float' }, e: 'spin' } });
    expect(js).toContain('__fxHlShell');
    expect(js).toContain('logdepthbuf_fragment');
    expect(js).toContain(`"highlight":"${HIGHLIGHT_COLOR}","pulse":false,"power":2.2,"k":1.1,"as":"float"`);
    expect(() => new Function(`let stepFx; const __BUS = { processEvents() {} }; ${js}`)).not.toThrow();
  });
  it('a bad one is refused where the page is emitted', () => { expect(() => fxChannelScript({ states: { d: { highlight: 'red' } } })).toThrow(/fx.states.d/); });
});

describe('a level that asks: what its mechanics lay to be taken is indicated', () => {
  const M = [{ kind: 'collect', pickups: [{ item: 'gem', at: [1, 2, 0] }] }, { kind: 'reach-exit', at: [5, 5, 0] }];
  it('unsaid, the states are the motions they were', () => { expect(Object.values(decorateMechanics(M).fx.states)).toEqual(['float']); });
  it('said: each pickup lit under its motion, and the exit', () => {
    const S = decorateMechanics(M, { highlight: { highlight: true, pulse: true } }).fx.states;
    expect(S.dec_pk_0_0).toEqual({ highlight: true, pulse: true, as: 'float' });
    expect(isHighlight(S.dec_exit_1)).toBe(true);
  });
});
