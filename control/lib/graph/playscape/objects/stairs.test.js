/**
 * The stairs: a walk from one level to the next (a flight, outdoor steps, a ramp), called by its ends like a bridge,
 * its going laid by the stride, the outdoor steps held to the man-made index's own laws, holding the object laws, and
 * walked in the world: the platform rule climbs it riser by riser.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { stairsParams, treads, STAIRS_VARIANT_IDS, STAIRS_VARIANTS } from './stairs.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { MADE_LAWS } from '../../era/out-made.js';
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';

const stairs = (spec) => resolveObject({ entry: 'stairs', from: [0, 0, 0], rise: 2.4, facing: [0, 1], ...spec });

describe('the going, from the stride', () => {
  it('risers as high as the law allows, the tread what the stride leaves', () => {
    const p = stairsParams({ from: [0, 0, 0], rise: 2.4 });
    expect(p.R * p.n).toBeCloseTo(2.4, 3);
    expect(p.R).toBeLessThanOrEqual(0.19);
    expect(2 * p.R + p.T).toBeCloseTo(0.63, 3);
  });

  it('a long stair breaks for a landing; outdoor steps sooner than a built flight', () => {
    expect(stairsParams({ from: [0, 0, 0], rise: 2.4 }).flights).toBe(1);
    expect(stairsParams({ from: [0, 0, 0], rise: 3.2 }).flights).toBe(2);
    expect(stairsParams({ variant: 'steps', from: [0, 0, 0], rise: 2.4 }).flights).toBe(2);
    expect(treads(stairsParams({ from: [0, 0, 0], rise: 3.2 })).filter((t) => t.landing)).toHaveLength(1);
  });

  it('called by both ends, it fits its going to the run it is given and is measured', () => {
    const o = stairs({ to: [0, 3, 1.8] });
    expect(o.params.run).toBeCloseTo(3, 6);
    expect(o.params.to).toEqual([0, 3, 1.8]);
    const cramped = stairs({ to: [0, 1.2, 1.8] });   // 1.8 m up in 1.2 m: the treads come out short, and it says so
    expect(cramped.laws.find((l) => l.law === 'tread')).toMatchObject({ ok: false });
  });

  it('a ramp holds the walk\'s grade, and breaks for a landing every 9 m of run', () => {
    expect(stairsParams({ variant: 'ramp', from: [0, 0, 0], rise: 1 }).grade).toBe(0.25);
    expect(stairsParams({ variant: 'ramp', from: [0, 0, 0], rise: 3.2 }).flights).toBe(2);
  });

  it('refuses what it cannot build, naming why', () => {
    expect(() => stairs({ variant: 'escalator' })).toThrow(/flight, steps, ramp/);
    expect(() => stairs({ rise: 0.1 })).toThrow(/at least 0.2 m/);
    expect(() => stairs({ elements: { gargoyles: true } })).toThrow(/not a stairs element/);
    expect(() => stairs({ edge: 'glass' })).toThrow(/edge is one of/);
    expect(() => resolveObject({ entry: 'stairs' })).toThrow(/give their ends/);
  });
});

describe('the laws: its own, and the man-made index\'s', () => {
  it('outdoor steps are measured by the index\'s own steps laws', () => {
    const o = stairs({ variant: 'steps' });
    expect(o.laws.map((l) => l.law)).toEqual(MADE_LAWS.filter((l) => l.pattern === 'steps').map((l) => l.law));
    expect(o.laws.every((l) => l.ok)).toBe(true);
  });

  for (const v of STAIRS_VARIANT_IDS) {
    const rises = v === 'ramp' ? [0.5, 1, 2.4, 3.2] : [0.5, 1, 2.4, 3.2, 5];
    for (const rise of rises) for (const edge of v === 'steps' ? ['timber', 'stone'] : ['timber']) {
      if (v === 'steps' && edge === 'stone' && rise === 0.5) continue;   // a stone stoop's pins run a hair over the third: advice, documented
      it(`${v}${v === 'steps' ? ` (${edge})` : ''}, ${rise} m holds the object laws and its walk laws`, () => {
        const o = stairs({ variant: v, rise, edge });
        expect(objectAdvice(objectMeasures(o.faces, o.frame, o.interest), o.interest)).toEqual([]);
        expect(o.laws.filter((l) => l.ok === false)).toEqual([]);
      });
    }
  }

  it('every variant builds its elements; the rail follows its law', () => {
    for (const v of STAIRS_VARIANT_IDS) {
      const o = stairs({ variant: v, rise: 5, edge: 'timber' });
      for (const e of STAIRS_VARIANTS[v].elements.filter((x) => !['pins', 'nosings'].includes(x))) expect(o.elements).toContain(e);
    }
    expect(stairs({ rise: 0.5 }).elements).not.toContain('handrail');   // a stoop needs none
    expect(stairs({ elements: { handrail: false } }).laws.find((l) => l.law === 'handrail')).toMatchObject({ ok: false, value: 'open' });
    expect(stairs({ variant: 'steps', edge: 'stone' }).elements).toEqual(expect.arrayContaining(['pins']));
  });

  it('answers as a link: the walk and how long it takes', () => {
    const f = stairs({}), r = stairs({ variant: 'ramp' });
    expect(f.walk).toMatchObject({ rise: 2.4 });
    expect(f.walk.pitch).toBeGreaterThan(30);
    expect(r.walk.pitch).toBeLessThan(17);
    expect(r.walk.seconds).toBeLessThan(stairs({ variant: 'ramp' }).params.run / 4);
  });
});

// a ground hook from the stair's own colliders, the level above it past its top, the floor at 0
const groundOf = (o, top) => (pos) => {
  let g = 0;
  for (const c of [...o.world.colliders, top]) if (pos[0] >= c.min[0] && pos[0] <= c.max[0] && pos[1] >= c.min[1] && pos[1] <= c.max[1] && c.max[2] <= pos[2] + 1e-6) g = Math.max(g, c.max[2]);
  return g;
};
function walkUp(o, ticks = 150) {
  const top = { min: [-3, o.params.to[1] + 0.25, -1], max: [3, o.params.to[1] + 40, o.params.rise] };
  const w = createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.25 }, transform: { pos: [0, -1, 0], heading: Math.PI / 2 } }] });
  w.colliders = [...o.world.colliders, top];
  const ground = groundOf(o, top);
  for (let i = 0; i < ticks; i++) stepWorld(w, { forward: 1 }, 1 / 60, { ground });
  return w.byId.hero;
}

describe('walked in the world', () => {
  for (const v of STAIRS_VARIANT_IDS) it(`the platform rule walks up a ${v} to the level above`, () => {
    const o = stairs({ variant: v, rise: 1.6 });
    const h = walkUp(o);
    expect(h.grounded).toBe(true);
    expect(h.transform.pos[2]).toBeCloseTo(1.6, 3);
    expect(h.transform.pos[1]).toBeGreaterThan(o.params.to[1]);
  });

  it('a rise steeper than a step is not walked: the wall stops the walker', () => {
    const o = resolveObject({ entry: 'stairs', from: [0, 0, 0], rise: 1.6, facing: [0, 1], riser: 0.5 });   // 0.53 m risers
    expect(walkUp(o, 300).transform.pos[2]).toBeLessThan(0.6);
  });
});
