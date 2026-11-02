// THE SIGNS AND SIGNALS: a signal's three lenses under their visors on a bordered backplate; a stop sign an octagon; each
// sign on its post's foot; set down facing its approach; a toon register's each its own.
import { describe, it, expect } from 'vitest';
import { signalHead, signOf, mastArm, place, SIGN_KINDS } from './signs.js';
import { proportions } from './doodads.js';
import { mulberry32 } from '../city/plan/dice.js';

const plain = () => proportions(mulberry32(1), false), toon = (s) => proportions(mulberry32(s), true);

describe('the signs and signals', () => {
  it('heads a signal with three lenses, each under a visor, on a bordered backplate', () => {
    const fs = signalHead(plain(), mulberry32(1));
    for (const r of ['lens-red', 'lens-amber', 'lens-green']) expect(fs.some((f) => f.role === r)).toBe(true);
    expect(fs.some((f) => f.role === 'border')).toBe(true);
    // (a toon head's lenses each their own size)
    const size = (fs2, r) => Math.max(...fs2.filter((f) => f.role === r).flatMap((f) => f.corners.map((c) => c[1])));
    const T = signalHead(toon(3), mulberry32(3));
    expect(new Set(['lens-red', 'lens-amber', 'lens-green'].map((r) => size(T, r).toFixed(3))).size).toBeGreaterThan(1);
  });

  it('stands every kind of sign on its post\'s foot, a stop sign\'s plate an octagon', () => {
    for (const k of SIGN_KINDS) {
      const fs = signOf(k, plain(), mulberry32(2));
      expect(Math.min(...fs.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(0, 6);
    }
    const stop = signOf('stop', plain(), mulberry32(2)).filter((f) => f.role === 'sign-red');
    expect(stop.length).toBe(8);
  });

  it('sets a sign down facing its approach, and bows a toon mast arm', () => {
    const fs = place(signOf('speed', plain(), mulberry32(1)), [10, 5, 1], [0, 1]), plate = fs.find((f) => f.role === 'sign-white');
    expect(plate.out[1]).toBeCloseTo(1, 6);
    const zs = (A) => A.flatMap((f) => f.corners.map((c) => c[2]));
    const P = zs(mastArm(6, plain())), T = zs(mastArm(6, { ...toon(4), bend: 1 }));
    expect(Math.max(...T)).toBeGreaterThan(Math.max(...P) + 0.2);
  });
});
