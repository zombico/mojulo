// A FRAME'S WAKE (frame-wake.js): the plasma's light a booster leaves, in its propellant's colour (parts.js PROPELLANTS),
// lasting longer and straight in vacuum, curling and shorter in air; and a page without a frame carries none of it.
import { describe, expect, it } from 'vitest';
import { frameWakeScript, WAKE } from './frame-wake.js';
import { frameFigure } from '../../../assault-frame/figure.js';
import { PARTS, PROPELLANTS, STOCK } from '../../../assault-frame/parts.js';
import { FLAME_LAYERS } from './frame-flame.js';

describe('a frame\'s wake', () => {
  it('is its booster\'s propellant\'s colour, on the plume and the wake both', () => {
    // (two stock frames whose boosters burn different gases, picked from the table)
    const [a, b] = Object.keys(STOCK).filter((k, i, all) => all.findIndex((x) => PARTS.booster[STOCK[x].booster].propellant === PARTS.booster[STOCK[k].booster].propellant) === i).slice(0, 2);
    const A = frameFigure({ build: a }), B = frameFigure({ build: b });
    expect(A.wake.colour).toBe(PROPELLANTS[PARTS.booster[STOCK[a].booster].propellant].colour);
    expect(A.wake.colour).not.toBe(B.wake.colour);
    expect(A.thrusters.every((t) => t.color === A.wake.colour)).toBe(true);
    // (no fire: the plume's tail takes the propellant's colour, not an amber of its own)
    expect(FLAME_LAYERS.tail.hot).toBe(null);
  });

  it('lasts longer and runs straight in vacuum; curls and fades sooner in air', () => {
    const air = frameWakeScript({ air: true }), space = frameWakeScript({ air: false });
    expect(air).toContain(`"life":${WAKE.life.air}`);
    expect(space).toContain(`"life":${WAKE.life.space}`);
    expect(WAKE.life.space).toBeGreaterThan(WAKE.life.air);
    expect(space).toContain('"air":false');
    // (the page's block is one script that parses)
    expect(() => new Function('THREE', 'scene', 'camera', '__world', '__bodies', 'window', space)).not.toThrow();
  });
});
