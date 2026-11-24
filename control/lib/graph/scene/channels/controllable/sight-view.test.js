// What a watcher sees, drawn: the fan's spans are a line of sight in height (sight-view.js __svSpans), so low cover
// hides a lowered body and the fan shows it.
import { describe, it, expect } from 'vitest';
import { sightScript } from './sight-view.js';

const spansOf = (colliders) => {
  const src = sightScript(), fn = src.slice(src.indexOf('function __svSpans'), src.indexOf('(function __svFrame')).trim();
  // eslint-disable-next-line no-unused-vars
  const __world = { colliders }, __SV = { hits: [] };
  // eslint-disable-next-line no-eval
  const f = eval(`(${fn})`);
  return (E, pe, far = 14) => f(0, 0, 1, 0, E, pe, 0, far, [0, 0, 0, 0]).map((v) => +v.toFixed(2));
};
const E = 1.275, STAND = 1.275, CROUCH = 0.825, PRONE = 0.34;

describe('the fan is a line of sight in height', () => {
  it('over a wall a metre high a standing body is seen all the way; crouched, the ground behind it is a hole; lying, to the range', () => {
    const at = spansOf([{ min: [5, -1, 0], max: [5.4, 1, 1] }]);
    expect(at(E, STAND)).toEqual([0, 14, 14, 14]);
    const c = at(E, CROUCH);
    expect(c.slice(0, 2)).toEqual([0, 5]);
    expect(c[2]).toBeCloseTo((5.4 * (E - CROUCH)) / (E - 1), 1);   // seen again where the line clears the wall's far top edge
    expect(c[3]).toBe(14);
    expect(at(E, PRONE)).toEqual([0, 5, 5, 5]);
  });
  it('a wall half as high hides only a body that lies down, and a wall over the eye ends the ray for anyone', () => {
    const low = spansOf([{ min: [5, -1, 0], max: [5.4, 1, 0.5] }]);
    expect(low(E, CROUCH)).toEqual([0, 14, 14, 14]);
    expect(low(E, PRONE).slice(0, 2)).toEqual([0, 5]);
    expect(low(E, PRONE)[2]).toBeGreaterThan(5.4);
    expect(spansOf([{ min: [5, -1, 0], max: [5.4, 1, 2] }])(E, STAND)).toEqual([0, 5, 5, 5]);
  });
});
