// The tell (worlds/controllable/tell.js): how lit a body's signal is now. The concepts: at rest an ember, never dark, so
// the gaze reads; while it means to fire, rising as its weapon's cooldown runs out, full as the next shot is ready; a
// flash at the shot, then the ember; a body down is dark; the function runs as the page runs it (its own source,
// import-free) with TELL's numbers.
import { describe, it, expect } from 'vitest';
import { tellOf, TELL } from './tell.js';

const foe = (extra = {}) => ({ id: 'b', weapon: { cooldown: 2, cooldownT: 2 }, ...extra });

describe('the tell', () => {
  it('at rest an ember, never dark; a body down, dark', () => {
    expect(tellOf(foe(), 1)).toBe(TELL.rest);
    expect(tellOf(foe({ downed: true }), 1)).toBe(0);
  });
  it('winding up: rising as the cooldown runs out, full when the shot is ready', () => {
    const at = (cooldownT) => tellOf(foe({ aiFire: true, weapon: { cooldown: 2, cooldownT } }), 1);
    expect(at(2)).toBeCloseTo(TELL.rest, 6);
    expect(at(1)).toBeGreaterThan(at(1.5));
    expect(at(0)).toBe(1);
  });
  it('a flash at the shot, then the ember', () => {
    const f = foe({ lastShot: { t: 1 } });
    expect(tellOf(f, 1.05)).toBe(1);
    expect(tellOf(f, 1 + TELL.flash + 0.01)).toBe(TELL.rest);
  });
  it('runs as the page runs it, with TELL\'s numbers', () => {
    const src = tellOf.toString();
    expect(src).not.toMatch(/\bimport\b|\brequire\(/);
    const again = new Function(`return (${src})`)(), f = foe({ aiFire: true, weapon: { cooldown: 2, cooldownT: 0.7 } });
    expect(again(f, 3)).toBe(tellOf(f, 3));
    const own = Object.fromEntries([...src.matchAll(/(\w+): ([\d.]+)/g)].slice(0, Object.keys(TELL).length).map(([, k, v]) => [k, Number(v)]));
    expect(own).toEqual({ ...TELL });
  });
});
