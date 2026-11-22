// heroStature: a hero's height off its plan alone (the head's include placed on the body, its crown over it), so a level
// can make its hero collide as tall as it stands without compiling the mesh. The concepts: a tiered head reads one, a
// stature tune scales it as it scales the figure, and a body whose head reads none says null.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroStature } from './layered.js';
import { withDefaultForm } from '../../graph/polygonizer/motion-stamp.js';

const stature = (spec) => heroStature(heroRecord(withDefaultForm(spec)));

describe('heroStature', () => {
  it('reads the crown of each tiered head: the toy hero robot under its bare anime head, the landmark adult', () => {
    const robot = stature({ cast: 'male', head: 'anime', proportions: 'herobot', animeStyle: null }), adult = stature({ cast: 'male' });
    // (a person's height, and the robot's big head on shorter limbs stands under the adult)
    expect(adult).toBeGreaterThan(1.6);
    expect(adult).toBeLessThan(1.9);
    expect(robot).toBeGreaterThan(1.5);
    expect(robot).toBeLessThan(adult);
  });
  it('a stature tune scales it as it scales the figure', () => {
    const base = stature({ cast: 'male' }), tall = stature({ cast: 'male', tune: { stature: 1.1 } });
    expect(tall / base).toBeCloseTo(1.1, 2);
  });
  it('says null where the head reads none: the realistic form\'s height is its mesh\'s', () => {
    expect(stature({ cast: 'male', form: 'realistic' })).toBeNull();
  });
});
