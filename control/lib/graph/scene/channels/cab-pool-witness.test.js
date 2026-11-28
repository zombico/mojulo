// A carjack SEEN (cab-pool.js `witness`, carjackSeen): a beat patrol in the traffic, or an officer or a patrol car out,
// within its sight of the take raises the wanted level; out of it, the take is got away with (`carjack:unseen`). A page
// with no witness presses the carjack as it always did.
import { describe, it, expect } from 'vitest';
import { carjackSeen, cabPoolScript } from './cab-pool.js';

describe('a carjack seen', () => {
  const at = [0, 0, 0], hull = (x, police) => ({ p: [x, 0, 0], ...(police ? { police: true } : {}) });
  it('by a patrol in the traffic within sight, not by one beyond it, nor by a plain car beside it', () => {
    expect(carjackSeen([hull(30, true)], [], at, 40)).toBe(true);
    expect(carjackSeen([hull(55, true)], [], at, 40)).toBe(false);
    expect(carjackSeen([hull(5, false)], [], at, 40)).toBe(false);
  });
  it('by an officer or a patrol car out; not by one asleep or gone', () => {
    const cop = (o) => ({ id: 'police-1', transform: { pos: [10, 0, 0] }, ...o });
    expect(carjackSeen([], [cop({})], at, 40)).toBe(true);
    expect(carjackSeen([], [cop({ dormant: true, gone: true })], at, 40)).toBe(false);
    expect(carjackSeen([], [{ id: 'police-car-1', carBody: {}, transform: { pos: [0, 20, 0] } }], at, 40)).toBe(true);
    expect(carjackSeen([], [{ id: 'car-3', transform: { pos: [1, 0, 0] } }], at, 40)).toBe(false);
  });
  it('is asked only where a page has a witness: without one, the carjack is pressed as it was', () => {
    expect(cabPoolScript({ mayhem: true, witness: 40 })).toContain("'carjack:unseen'");
    expect(cabPoolScript({ mayhem: true })).not.toContain('carjack:unseen');
  });
});
