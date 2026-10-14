// The city rail: a planned city (kind 'city'; the legacy one is 'fractal-city'). Its outcomes and concerns are
// city/plan/read.js's (the table `next` and the plan book's Open sheet read); its parts are the edifices its sites stand,
// the level cut for each segment and each door's inside (city/plan/game.js names them); it is looked at in its plan
// book and walked in its World. A segment's level reads its city by ref, so it is shown on its city's rail.
import { registerRail, sketchHref } from './rail.js';
import { readCity, cityConcernStates, CITY_OUTCOMES } from '../city/plan/read.js';
import { withCityRef } from '../city/plan/ref.js';
import { cityGameOrder } from '../city/plan/game.js';

export default registerRail({
  id: 'city',
  test: (m) => m.kind === 'city',
  outcomes: CITY_OUTCOMES.map(({ id, name }) => ({ id, name })),
  read(m, { ref, row }) {
    const parent = typeof m.city === 'string' ? m.city : null;
    const laid = withCityRef(m, (r) => row(r)?.manifest ?? null);
    const { read, design } = readCity(laid);
    const cityRef = parent ?? ref;
    const there = (r) => (row(r) ? 'fresh' : 'missing');
    const parts = [...new Set((Array.isArray(m.sites) ? m.sites : []).map((s) => s && s.from).filter((r) => typeof r === 'string'))]
      .map((r) => ({ ref: r, role: 'edifice', state: there(r) }));
    // a segment's level is a part of its city, not of itself
    if (!parent && cityRef && m.segments && m.segments.levels && design.segments) {
      const order = cityGameOrder(design, cityRef);
      for (const s of order.sketches) parts.push({ ref: s.ref, role: 'level', state: there(s.ref) });
      for (const x of order.interiors) parts.push({ ref: x.ref, role: 'inside', state: there(x.ref) });
    }
    return {
      concerns: cityConcernStates(laid, read),
      parts,
      exits: ref ? [{ id: 'book', href: sketchHref(parent ?? ref, 'bible') }, { id: 'walk', href: sketchHref(ref, 'world') }] : [],
      ...(parent ? { parent } : {}),
    };
  },
});
