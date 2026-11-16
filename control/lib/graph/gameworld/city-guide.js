/**
 * THE CITY'S GUIDE — what a played town or district says as it opens, and where to go: the page's guide
 * (scene/channels/guide.js: an intro, the controls as lessons with the hero in hand, then THE WAY ON, a line with an
 * arrow and the metres to it and a pillar of light where it stands), read off the level's own recipe so it never says a
 * thing the level does not have. The way on is the game's loop made visible: a car to get into (the nearest one the
 * level stands), then a job's pick-up and its hand-in (the errand's legs, errand.js: its trade and its deliver, where
 * the level laid them); a STANDING job (`repeat`) goes round again from its pick-up. With no job the city is simply
 * open, and says so.
 *
 *   CITY_GUIDE                 its numbers and its words
 *   cityGuide(manifest)        → { intro, lessons, steps: [{ id, say, kind, at, radius, says? }], loop?, done } | null:
 *                              a level manifest (its title, entities, game.mechanics); null where it stands no car
 *
 * Pure: the level's recipe in, the guide out.
 */
export const CITY_GUIDE = Object.freeze({
  // how near a car is "reached" (m): its door's reach
  car: 3.4,
  // the controls, taught in order with the hero in hand (guide.js lessons: `fact` what the pilot does to pass one)
  lessons: Object.freeze([
    Object.freeze({ keys: 'W A S D  walk', fact: 'move' }),
    Object.freeze({ keys: 'E  get into a car · E  get out when stopped' }),
    Object.freeze({ keys: 'W  drive · S  brake · A D  steer' }),
  ]),
  open: 'The city is open: take any car',
});

const words = (item) => String(item).replace(/-/g, ' ');
const r3 = (v) => Math.round(v * 1000) / 1000;
const at3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2] ?? 0)];

export function cityGuide(manifest) {
  const M = manifest ?? {}, entities = Array.isArray(M.entities) ? M.entities : [];
  const hero = entities.find((e) => e && e.pilotable && e.transform), cabs = entities.filter((e) => e?.mount?.cab && !e.mount.spare && e.transform);
  if (!hero || !cabs.length) return null;
  const from = hero.transform.pos, d = (e) => Math.hypot(e.transform.pos[0] - from[0], e.transform.pos[1] - from[1]);
  const car = cabs.reduce((m, e) => (d(e) < d(m) ? e : m), cabs[0]);
  const mechanics = Array.isArray(M.game?.mechanics) ? M.game.mechanics : [];
  // (the car is reached by being in one, whichever: standing beside it is not it. `cab`: scene/channels/guide.js)
  const steps = [{ id: 'car', say: 'Get into a car', kind: 'find', at: at3(car.transform.pos), radius: CITY_GUIDE.car, cab: true }];
  // each job's legs in the order it is done: what it asks for picked up where it is had, then handed in
  let loop = null;
  const jobs = mechanics.filter((m) => m && m.kind === 'deliver' && Array.isArray(m.at));
  for (const J of jobs) {
    const first = steps.length;
    for (const w of J.wants ?? []) {
      const T = mechanics.find((m) => m && m.kind === 'trade' && m.item === w.item && Array.isArray(m.at));
      if (T) steps.push({ id: `pick-${T.item}`, say: `Pick up the ${words(T.item)}`, kind: 'find', at: at3(T.at), radius: T.radius ?? 2, says: `${words(T.item)[0].toUpperCase()}${words(T.item).slice(1)} aboard` });
    }
    const paid = (J.reward ?? []).map((r) => `${r.n ?? 1} ${words(r.item)}`).join(', ');
    steps.push({ id: `deliver-${J.id ?? 'errand'}`, say: `Deliver the ${(J.wants ?? []).map((w) => words(w.item)).join(', ') || 'goods'}`, kind: 'find', at: at3(J.at), radius: J.radius ?? 2, ...(paid ? { says: `Paid ${paid}` } : {}) });
    // (the first standing job goes round again from its pick-up)
    if (J.repeat === true && loop === null) loop = first;
  }
  const job = jobs.length > 0;
  return {
    // (the game's name: a level's title is `<game> · <level> · <stage>`)
    intro: `${M.title ? `${String(M.title).split(' · ')[0]}. ` : ''}${job ? 'Take any car. A job waits where the light stands.' : 'Take any car. The city is open.'}`,
    lessons: CITY_GUIDE.lessons.map((l) => ({ ...l })),
    steps,
    ...(loop !== null ? { loop } : {}),
    done: CITY_GUIDE.open,
  };
}
