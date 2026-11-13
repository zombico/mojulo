// How a liquid is seen, read off what it is (rupa/liquid-look.js).
import { describe, it, expect } from 'vitest';
import { liquidLook, LIQUID_OPTICS, LOOK } from './liquid-look.js';
import { MATTER, LIQUID_IDS } from './matter.js';

describe('a liquid\'s look, from its matter', () => {
  it('every liquid in the table can be drawn: the look reads the same list the physics does', () => {
    expect(Object.keys(LIQUID_OPTICS).sort()).toEqual([...LIQUID_IDS].sort());
  });

  it('its thickness is its physics: a fuel lies thinner than water, a liquid that holds a yield stress stands tallest', () => {
    const water = liquidLook('water'), fuel = liquidLook('gasoline'), mud = liquidLook('mud');
    expect(fuel.thick).toBeLessThan(water.thick);
    expect(mud.thick).toBeGreaterThan(water.thick);
    // (water's puddle is a few millimetres; drawn so its lip reads, and never under the least)
    const puddle = 2 * Math.sqrt(MATTER.water.tension / (MATTER.water.density * 9.81));
    expect(water.thick).toBeCloseTo(puddle * LOOK.read, 3);
    for (const id of [LIQUID_IDS[0], 'gasoline']) expect(liquidLook(id).thick).toBeGreaterThanOrEqual(LOOK.least);
  });

  it('a liquid that flows is a mirror; one that holds its lumps is not; a thicker one a touch less true', () => {
    expect(liquidLook('water').rough).toBeLessThan(0.05);
    expect(liquidLook('honey').rough).toBeGreaterThan(liquidLook('water').rough);
    expect(liquidLook('mud').rough).toBeGreaterThan(0.3);
  });

  it('what is its own rides beside: water seen through, a fuel\'s film, and no solid has a look', () => {
    expect(liquidLook('water').clear).toBeGreaterThan(0);
    expect(liquidLook('gasoline').film).toBeGreaterThan(0);
    expect(liquidLook('crude').clear).toBeUndefined();
    expect(() => liquidLook('steel')).toThrow(/not a liquid/);
  });
});
