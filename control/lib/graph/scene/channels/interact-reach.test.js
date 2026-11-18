import { describe, it, expect } from 'vitest';
import { usesOf, reachScript, seatUsesOf, seatReachScript } from './interact-channel.js';

// the reach prompt run on a stub page: the walker at `pos`, the zones entered in the order given
function reachIn(uses, pos, entered) {
  const el = () => ({ className: '', innerHTML: '', style: {}, textContent: '', appendChild() {} });
  const window = { __mojCtrl: { world: { pilotId: 'hero', byId: { hero: { transform: { pos } } }, entities: [] }, interacts: () => 0, label: () => 'E' } };
  const step = new Function('document', 'wrap', 'window', `${reachScript(uses)}; return __stepReach;`)({ createElement: el, head: el() }, el(), window);
  step(entered.map((zone) => ({ type: 'enter', zone })), []);
  return window.__mojReach;
}
const zone = (zone, at, use) => ({ type: 'zone', zone, at, radius: 1.6, planar: true, use, prompt: 'Talk' });

describe('the reach prompt where usable zones overlap', () => {
  it('the nearest one answers, not the last entered; zones apart carry nothing more and their page is as it was', () => {
    const S = [zone('za', [0, 0], 'keeper'), zone('zb', [1.1, 0], 'neighbour'), zone('zc', [30, 0], 'far')];
    const U = usesOf(S);
    expect(U.za.at).toEqual([0, 0]);
    expect(U.zc.at).toBeUndefined();
    // (walked up to the keeper: its zone entered first, the neighbour's after, the keeper still the one in reach)
    expect(reachIn(U, [0.1, 0.9, 0], ['za', 'zb'])).toBe('keeper');
    expect(reachIn(U, [1.0, 0.9, 0], ['zb', 'za'])).toBe('neighbour');
    // a page whose zones never overlap: no centres, no nearest, the script as before
    const apart = usesOf([zone('za', [0, 0], 'a'), zone('zc', [30, 0], 'c')]);
    expect(Object.values(apart).some((u) => u.at)).toBe(false);
    expect(reachScript(apart)).not.toContain('__nearest');
  });
});

// a seat's reach on a stub page: seat 2's body at `pos`, its zones entered, its own presses counted by the seats block
function seatReachIn(uses, pos, entered, presses) {
  const el = () => ({ className: '', innerHTML: '', style: {}, textContent: '', appendChild() {} });
  let n = 0;
  const window = { __mojCtrl: { world: { byId: { 'hero-2': { transform: { pos } } } } }, __mojSeatUses: () => n, __mojSeatLabel: () => 'X' };
  const THREE = { Vector3: class { set() { return this; } project() { this.x = 0; this.y = 0; return this; } } };
  const step = new Function('document', 'wrap', 'window', 'THREE', 'camera', `${seatReachScript(uses)}; return __stepSeatReach;`)({ createElement: el, head: el() }, el(), window, THREE, {});
  const sent = [];
  step(entered.map((zone) => ({ type: 'enter', zone })), sent);
  for (let k = 0; k < presses; k++) { n++; step([], sent); }
  return sent.map((e) => e.type);
}

describe('a seat\'s own reach', () => {
  const S = [{ type: 'zone', zone: 'use-w0-crate-fish', at: [0, 0], radius: 1.1, use: 'w0-crate-fish', watch: 'hero', prompt: 'take fish' },
    { type: 'zone', zone: 's2:use-w0-crate-fish', at: [0, 0], radius: 1.1, seatUse: 'w0-crate-fish', seat: 2, watch: 'hero-2', prompt: 'take fish' },
    { type: 'zone', zone: 's2:use-w0-crate-rice', at: [1.5, 0], radius: 1.1, seatUse: 'w0-crate-rice', seat: 2, watch: 'hero-2', prompt: 'take rice' }];
  it('a seat\'s zones never reach the pilot\'s, and a seat\'s press sends its own use of the place nearest its body', () => {
    expect(Object.keys(usesOf(S))).toEqual(['use-w0-crate-fish']);
    const U = seatUsesOf(S);
    expect(Object.keys(U)).toEqual(['s2:use-w0-crate-fish', 's2:use-w0-crate-rice']);
    expect(seatReachIn(U, [1.2, 0, 0], ['s2:use-w0-crate-fish', 's2:use-w0-crate-rice'], 1)).toEqual(['s2:use-w0-crate-rice']);
    expect(seatReachIn(U, [0.2, 0, 0], ['s2:use-w0-crate-rice', 's2:use-w0-crate-fish'], 2)).toEqual(['s2:use-w0-crate-fish', 's2:use-w0-crate-fish']);
    expect(seatReachIn(U, [9, 0, 0], [], 1)).toEqual([]);   // in no place: a press does nothing
    expect(seatUsesOf([S[0]])).toEqual({});
  });
});
