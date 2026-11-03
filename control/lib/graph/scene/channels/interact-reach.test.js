import { describe, it, expect } from 'vitest';
import { usesOf, reachScript } from './interact-channel.js';

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
