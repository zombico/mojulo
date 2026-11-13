/**
 * SHOVELS & BUCKETS: THE STARTER CARDS. One card per kind of work sim, each a reference point (no product, no level):
 * starters to tune, never the only shapes. A new work sim is a new card, not code.
 *
 *   kitchen        orders over time, near-even shovel and bucket, an unattended pot that burns: the multitasking sim
 *   farm           a shovel-heavy cycle (the tractor) with a long unattended grow and a harvest that is bucket work
 *   site           contracts on a long clock, a mixer that sets if left, a two-person crew: the scheduling sim
 *   roof           a standing job (a backlog) the wind adds to, a ladder that makes travel the cost: the chores sim
 *
 * Their numbers are seconds of play, not of life (a crop grows in a minute).
 */
export const SCENARIOS = Object.freeze({
  kitchen: {
    id: 'kitchen', name: 'Sushi counter',
    why: 'chop and cook are shovel work, plating and serving bucket work; the rice runs alone and burns if no hand is free',
    crew: { workers: 2, travel: 1.5 },
    items: { 'sliced-fish': { store: 4 }, 'cooked-rice': { store: 4, spoil: 60 }, salad: { store: 3 } },
    stations: {
      'chop-fish': { verb: 'shovel', takes: { fish: 1 }, gives: { 'sliced-fish': 1 }, work: 3 },
      pot: { verb: 'shovel', takes: { rice: 1 }, gives: { 'cooked-rice': 2 }, work: 1, wait: 12, hold: 8 },
      'chop-salad': { verb: 'shovel', takes: { lettuce: 1, tomato: 1 }, gives: { salad: 1 }, work: 4 },
      'plate-sushi': { verb: 'bucket', takes: { 'sliced-fish': 1, 'cooked-rice': 1 }, gives: { sushi: 1 }, work: 1 },
      'plate-roll': { verb: 'bucket', takes: { 'sliced-fish': 1, 'cooked-rice': 1, salad: 1 }, gives: { roll: 1 }, work: 1.5 },
    },
    demand: {
      mode: 'orders', every: 20, patience: 60, serve: 1,
      orders: [{ name: 'nigiri', wants: { sushi: 1 }, weight: 3 }, { name: 'salad', wants: { salad: 1 }, weight: 2 }, { name: 'roll', wants: { roll: 1 }, weight: 1 }],
    },
    session: 240,
  },
  farm: {
    id: 'farm', name: 'Wheat farm',
    why: 'the tractor ploughs and sows (shovel), the field grows alone and rots if left, harvesting and milling feed the market',
    crew: { workers: 1, travel: 2 },
    items: { seed: { fetch: 1 }, wheat: { store: 18 } },
    stations: {
      field: { verb: 'shovel', takes: { seed: 1 }, gives: { wheat: 6 }, work: 6, wait: 40, hold: 30, slots: 3, far: 2, collect: 4 },
      mill: { verb: 'shovel', takes: { wheat: 3 }, gives: { flour: 1 }, work: 5 },
      crate: { verb: 'bucket', takes: { wheat: 3 }, gives: { 'wheat-crate': 1 }, work: 2 },
    },
    demand: {
      mode: 'orders', every: 30, patience: 140, serve: 2, far: 3,
      orders: [{ name: 'crate of wheat', wants: { 'wheat-crate': 1 }, weight: 2 }, { name: 'sack of flour', wants: { flour: 1 }, weight: 1 }],
    },
    session: 480,
  },
  site: {
    id: 'site', name: 'Building site',
    why: 'digging and framing are shovel work, pouring and hauling bucket work; the mixer sets if nobody pours it',
    crew: { workers: 2, travel: 3 },
    items: { cement: { fetch: 2 }, timber: { fetch: 2 }, trench: { store: 2 } },
    stations: {
      dig: { verb: 'shovel', gives: { trench: 1 }, work: 10, slots: 2 },
      mixer: { verb: 'shovel', takes: { cement: 1 }, gives: { concrete: 2 }, work: 2, wait: 10, hold: 12 },
      pour: { verb: 'bucket', takes: { trench: 1, concrete: 1 }, gives: { footing: 1 }, work: 3 },
      frame: { verb: 'shovel', takes: { footing: 1, timber: 2 }, gives: { frame: 1 }, work: 12, slots: 2 },
    },
    demand: {
      mode: 'orders', every: 70, patience: 200, serve: 3,
      orders: [{ name: 'shed', wants: { frame: 1 }, weight: 2 }, { name: 'cabin', wants: { frame: 2 }, weight: 1 }],
    },
    session: 600,
  },
  roof: {
    id: 'roof', name: 'Leaves off the roof',
    why: 'raking is the shovel, bagging and the trip down the ladder the bucket; the wind keeps adding to the job',
    crew: { workers: 1, travel: 1 },
    items: { leaves: { fetch: 0.5 }, pile: { store: 4 } },
    stations: {
      rake: { verb: 'shovel', takes: { leaves: 4 }, gives: { pile: 1 }, work: 5 },
      bag: { verb: 'bucket', takes: { pile: 2 }, gives: { 'full-bag': 1 }, work: 3 },
    },
    demand: {
      mode: 'backlog', backlog: 10, every: 90, serve: 1, far: 8,
      orders: [{ name: 'a bag in the bin', wants: { 'full-bag': 1 } }],
    },
    session: 300,
  },
});

export const scenarioIds = () => Object.keys(SCENARIOS);
