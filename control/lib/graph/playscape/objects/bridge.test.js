/**
 * The bridge: a static platform from bank to bank, called by its ends (or over a trail's pit), built of the elements a
 * style guide names, answering as a platform does, holding the object laws, and coming apart by its joints.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { bridgeParams, deckTop, endsOver, crossingRead, BRIDGE_VARIANT_IDS, BRIDGE_VARIANTS } from './bridge.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { dismantle } from '../destruct/dismantle.js';
import { cleave } from '../destruct/cleave.js';

const bridge = (spec) => resolveObject({ entry: 'bridge', from: [0, 0, 0], to: [6, 0, 0], ...spec });

describe('called by its ends', () => {
  it('spans from one end to the other, whatever its heading', () => {
    const p = bridgeParams({ from: [2, 1, 3], to: [2, 9, 3] });
    expect(p.span).toBe(8);
    expect(p.D).toEqual([0, 1, 0]);
    expect(deckTop(p, 0)).toEqual([2, 1, 3]);
    expect(deckTop(p, 8)).toEqual([2, 9, 3]);
  });

  it('spans a trail\'s pit from its hazard anchor: the ends either side of the gap, the trail\'s width', () => {
    const pit = { id: 'hazard-pit-1', kind: 'hazard', hazard: 'pit', at: [4, 30, 0.5], box: { min: [1, 29, 0.5], max: [7, 31, 2.3] }, jump: 2 };
    const o = resolveObject({ entry: 'bridge', variant: 'plank', over: pit });
    expect(o.params.from[1]).toBeLessThan(29);
    expect(o.params.to[1]).toBeGreaterThan(31);
    expect(o.params.from[0]).toBe(4);
    expect(endsOver(pit).width).toBe(2.4);   // a 6 m wide pit box: half of it, capped at a road
  });

  it('refuses what it cannot build, naming why', () => {
    expect(() => bridge({ variant: 'suspension' })).toThrow(/plank, deck, rope, arch/);
    expect(() => bridge({ to: [0.5, 0, 0] })).toThrow(/at least 1 m/);
    expect(() => bridge({ elements: { gargoyles: true } })).toThrow(/not a bridge element/);
    expect(() => bridge({ from: undefined, to: undefined })).toThrow(/give its ends/);
  });
});

describe('it answers as a platform does', () => {
  it('its width reads as a crossing, and it says whether it is railed', () => {
    expect([3, 1.5, 0.8, 0.4].map(crossingRead)).toEqual(['road', 'path', 'plank', 'beam']);
    expect(bridge({ variant: 'plank' }).crossing).toMatchObject({ read: 'beam', railed: false });
    expect(bridge({ variant: 'deck' }).crossing).toMatchObject({ read: 'path', railed: true });
    expect(bridge({ variant: 'deck', elements: { rails: false } }).crossing.railed).toBe(false);
  });

  it('a rope bridge sags; a long one sags past a walk into a scramble', () => {
    const short = bridge({ variant: 'rope' }), long = bridge({ variant: 'rope', to: [12, 0, 0] });
    expect(Math.min(...short.deck.line.map((q) => q[2]))).toBeLessThan(-0.3);
    expect(short.crossing.walk).toBe('walk');
    expect(long.crossing.walk).toBe('scramble');
  });

  it('lowers its deck to floor faces and colliders end to end, and its rails to lines', () => {
    const w = bridge({ variant: 'deck' }).world;
    expect(w.faces.every((f) => f.group === 'floor')).toBe(true);
    expect(w.colliders.length).toBe(w.faces.length);
    expect(w.rails).toHaveLength(2);
    expect(bridge({ variant: 'plank' }).world.rails).toEqual([]);
  });

  it('names its bearings on each bank and the clearance under it', () => {
    const o = bridge({ variant: 'arch' });
    expect(o.bearings.map((b) => b.end)).toEqual(['from', 'to']);
    expect(o.clearance.under).toBeLessThan(-1);   // an arch's void
  });
});

describe('built of the elements a style guide names', () => {
  it('every variant builds the elements it lists, and an element can be turned off', () => {
    for (const v of BRIDGE_VARIANT_IDS) {
      const o = bridge({ variant: v });
      for (const e of BRIDGE_VARIANTS[v].elements.filter((x) => x !== 'piers')) expect(o.elements).toContain(e);
    }
    expect(bridge({ variant: 'deck', elements: { posts: false } }).elements).not.toContain('posts');
    expect(bridge({ variant: 'deck', to: [10, 0, 0] }).elements).toContain('piers');   // a long deck stands on piers
  });

  it('an arch carries its motif along the parapets', () => {
    expect(bridge({ variant: 'arch' }).elements).toContain('dentils');
    expect(bridge({ variant: 'arch', motif: 'band' }).elements).toContain('band');
  });

  for (const v of BRIDGE_VARIANT_IDS) for (const span of [3, 6, 10]) {
    it(`${v}, ${span} m holds the object laws (the runs shade the 66, one 33 in the middle third)`, () => {
      const o = bridge({ variant: v, to: [span, 0, 0] });
      expect(objectAdvice(objectMeasures(o.faces, o.frame, o.interest), o.interest)).toEqual([]);
    });
  }
});

describe('it comes apart by its joints', () => {
  it('sever a rope bridge\'s footropes and its planks fall; the posts and handropes stand', () => {
    const r = dismantle(bridge({ variant: 'rope' }), { sever: ['footropes'] });
    const falling = r.bodies.flatMap((b) => b.parts), standing = r.statics.flatMap((s) => s.parts);
    expect(falling).toContain('planks');
    expect(standing).toEqual(expect.arrayContaining(['posts', 'handropes']));
  });

  it('a stone arch dices like any item', () => {
    const c = cleave(bridge({ variant: 'arch' }), { pattern: 'grid', cell: 1 });
    expect(c.chunks.length).toBeGreaterThan(10);
  });
});
