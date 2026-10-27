// A foe's disposal read off the game's style guide (vanish.js): each way the table decides (a game type that goes at
// once, an anime look, a western one, a world drawn plainly), the bestiary's own word over it, its colour from the
// world's palette, and the fielded foe carrying it. The page plays each fade only when named.
import { describe, it, expect } from 'vitest';
import { vanishOfGame, vanishOf, readVanish, VANISHES, LINGER } from './vanish.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { hostileCast, readBestiary } from './foes.js';
import { statusScript } from '../scene/channels/status-channel.js';
import { eventsChannelScript } from '../scene/channels/events.js';

const G = (juice) => readGameworld({ ...MEADOWMARK_HERO, ...(juice !== undefined ? { juice } : {}) });
const BEATS = [{ beat: 'trailhead', at: [0, 0, 0] }, { beat: 'reveal', at: [10, 0, 0] }, { beat: 'exit', at: [30, 0, 0] }];
const ENDS = { spawn: [0, 0, 0], exit: [30, 0, 0], beats: BEATS };
const walk = { walk: { nodes: { a: { trail: {} } } } };

describe('how a downed foe goes', () => {
  it('in its game type\'s register: a platformer squashes, a pinball table pops, an action game throws, a realistic one falls', () => {
    expect(vanishOfGame(G({ flavor: 'platformer' }))).toMatchObject({ is: 'squash', linger: 0 });
    expect(vanishOfGame(G({ flavor: 'pinball' }))).toMatchObject({ is: 'pop', linger: 0 });
    expect(vanishOfGame(G({ look: 'isekai', flavor: 'action' }))).toMatchObject({ is: 'motes', die: 'launch', linger: LINGER.action });
    expect(vanishOfGame(G({ look: 'isekai', flavor: 'realistic' }))).toMatchObject({ is: 'motes', die: 'fall', linger: LINGER.realistic });
    expect(LINGER.realistic).toBeGreaterThan(LINGER.action);
  });
  it('and the others fade in the look\'s own way', () => {
    expect(vanishOfGame(G({ look: 'cel', flavor: 'action' })).is).toBe('blink');
    expect(vanishOfGame(G({ register: 'western', flavor: 'realistic' }))).toMatchObject({ is: 'sink', linger: LINGER.realistic });
    expect(vanishOfGame(G({ register: 'western', flavor: 'action' })).is).toBe('fade');
    expect(vanishOfGame(G(false))).toMatchObject({ is: 'fade', from: 'plain' });
    // a world that writes no juice goes as 'auto' would draw it
    expect(vanishOfGame(G())).toMatchObject({ is: vanishOfGame(G('auto')).is });
  });
  it('motes take the world palette\'s colour; a bestiary entry names its own way and how long it lies', () => {
    const W = G({ look: 'isekai', flavor: 'action' }), m = vanishOfGame(W);
    expect(m.rgb).toHaveLength(3);
    expect(vanishOf(W, { class: 'walker', vanish: 'blink' })).toEqual({ is: 'blink', linger: m.linger, die: m.die });
    expect(vanishOf(W, { class: 'walker', vanish: { die: 'fall' } }).die).toBe('fall');
    // a squash or a pop is a death beat of its own: named alone, at once, whatever the world's lie
    expect(vanishOf(W, { class: 'walker', vanish: 'pop' })).toMatchObject({ is: 'pop', linger: 0, die: 'fall' });
    expect(vanishOf(W, { class: 'walker', vanish: { is: 'squash', linger: 1 } }).linger).toBe(1);
    expect(() => readVanish({ die: 'explode' }, 'foes.a.vanish')).toThrow(/die/);
    expect(vanishOf(W, { class: 'walker', vanish: { linger: 3 } })).toMatchObject({ is: 'motes', linger: 3, rgb: m.rgb });
    expect(() => readVanish('explode', 'foes.a.vanish')).toThrow(/no vanish 'explode'/);
    expect(() => readVanish({ linger: -1 }, 'foes.a.vanish')).toThrow(/linger/);
    expect(readBestiary({ a: { class: 'walker', vanish: 'sink' } }).a.vanish).toBe('sink');
  });
  it('a fielded foe carries its way out; no carcass is kept', () => {
    const W = readGameworld({ id: 'w', juice: { flavor: 'platformer' }, foes: { a: { class: 'walker' }, b: { class: 'walker', vanish: 'motes' } }, levels: { one: { ...walk, foes: { count: 2 } } } });
    const X = hostileCast(W, 'one', ENDS, { refs: { a: 'w-a', b: 'w-b' } });
    expect(X.entities.map((e) => e.body.vanish.is)).toEqual(['squash', 'motes']);
  });
  it('the page plays a fade only when its world names one', () => {
    for (const k of Object.keys(VANISHES).filter((x) => x !== 'smoke')) {
      expect(statusScript({}, ['smoke'])).not.toContain(`I.is === '${k}'`);
      expect(statusScript({}, [k])).toContain(`I.is === '${k}'`);
    }
    const ev = { reactions: [{ on: 'hit:p', do: 'inc', var: 'hp', by: -1 }] };
    expect(eventsChannelScript(ev)).not.toContain('__stepTransits');
    expect(eventsChannelScript({ ...ev, vanish: ['sink'] })).toContain("I.is === 'sink'");
  });
});
