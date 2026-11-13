/**
 * A land's game buildings read in the form render, whole (worlds/world-scene.js over era/stage-buildings.js): the page's
 * live shadows are fitted to the built place (so a person's shadow is not lost in a map stretched over the land), a
 * yard's floods are dark by day, each room says the light a body in it takes, and a body an entity wears carries the
 * land's rig. One small cube, one building, one standing figure.
 */
import { describe, expect, it } from 'vitest';

import { resolveWorldScene } from './world-scene.js';

describe('a land\'s buildings under the form render\'s light', () => {
  it('fits the hour\'s map to the built place, keeps floods dark by day, and lights its cast by where it stands', async () => {
    const manifest = {
      kind: 'geocube', cube: { from: 'island-noon', biocube: 'coast' }, show: 'path', hour: 13, shadows: { actors: true, hour: true },
      buildings: [{ use: 'warehouse', look: { construction: 'utility' }, yard: { floods: 1 }, apron: 'slab' }],
      figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
      entities: [{ id: 'a', rule: { type: 'static' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0], heading: 0 } }],
    };
    const { payload: P } = await resolveWorldScene({ ref: 'built-light', title: 'b', manifest }, { era: 'gen-7', live: true });
    const [b] = P.buildings, A = b.site.apron, fit = P.shadows.fit;
    // (the box holds the apron and a margin, and is far smaller than a land)
    expect(fit.half).toBeGreaterThan(Math.hypot(A[2] - A[0], A[3] - A[1]) / 2);
    expect(fit.half).toBeLessThan(Math.hypot(A[2] - A[0], A[3] - A[1]) / 2 + 30);
    expect(fit.at[0]).toBeCloseTo((A[0] + A[2]) / 2, 1);
    expect(P.form.room.reflect?.floods).toBeUndefined();
    expect(P.form.room.place.rooms.length).toBeGreaterThan(0);
    expect(P.form.room.place.floods).toBeUndefined();
    expect(P.figures.hero.cast).toMatchObject({ surface: 'form' });
    // (and the form render's finish, asked by no one: its lamps and lit windows spill their light)
    expect(P.finish).toMatchObject({ curve: 'neutral', bloom: { strength: 1, radius: 1 } });
  }, 900000);
});
