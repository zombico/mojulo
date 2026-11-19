/**
 * SHOVELS & BUCKETS: THE STARTER CARDS. One card per kind of work sim, each a reference point (no product, no level):
 * starters to tune, never the only shapes. A new work sim is a new card, not code.
 *
 *   kitchen        orders over time, near-even shovel and bucket, an unattended pot that burns: the multitasking sim
 *   farm           a shovel-heavy cycle (the tractor) with a long unattended grow and a harvest that is bucket work
 *   site           contracts on a long clock, a mixer that sets if left, a two-person crew, a trench dug by spade or by
 *                  excavator: the scheduling sim
 *   roof           a standing job (a backlog) the wind adds to, the line up on a roof and the bin below a ladder: the
 *                  chores sim, travel its cost
 *
 * THE KITCHEN'S MENUS: the kitchen's paradigm (orders over time, prep worked by hand, what cooks alone and burns,
 * plating) with other recipes, each a shape of its own (a new menu is a card, its food read off it: food/derive.js):
 *
 *   pasta          two pots at once (the pasta and its sauce) met on the plate; or layered in a tray and baked again
 *   wok            a cooker's rice and a pot's noodles, the prep, and a wok that burns if left: fried rice, chow mein
 *   ramen          a stock that runs long, noodles and eggs boiled, pork sliced, the bowl built of four things
 *   diner          a grill that burns, a fryer, the salad cut, a burger stacked; a meal that wants both
 *   pizzeria       dough kneaded and rolled, a sauce simmered, cheese grated, the pizza topped and baked
 *
 * Their numbers are seconds of play, not of life (a crop grows in a minute).
 */
// the trades: one card a kind of work sim
const TRADES = Object.freeze({
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
      // two routes to a trench: the spade (two hands, slow) or the excavator (one, quick, parked across the site)
      dig: { verb: 'shovel', gives: { trench: 1 }, work: 10, slots: 2 },
      excavator: { verb: 'shovel', gives: { trench: 1 }, work: 3, far: 6 },
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
      mode: 'backlog', backlog: 10, every: 90, serve: 1, far: 2,
      orders: [{ name: 'a bag in the bin', wants: { 'full-bag': 1 } }],
    },
    // the roof 4 m up, the bin on the ground: a lean ladder down and up again with every bag
    site: { up: 4, climb: 'ladder' },
    session: 300,
  },
});

// THE KITCHEN'S MENUS (see the header): a kitchen's starters beside the sushi counter, the same trade
const MENUS = Object.freeze({
  pasta: {
    id: 'pasta', name: 'Pasta bar',
    why: 'the pasta and its sauce run alone in two pots at once and meet on the plate; a tray layered and baked again',
    crew: { workers: 2, travel: 1.5 },
    items: { 'boiled-pasta': { store: 4, spoil: 50 }, 'tomato-sauce': { store: 4 }, 'grated-cheese': { store: 4 }, 'pasta-tray': { store: 2 } },
    stations: {
      'boil-pasta': { verb: 'shovel', takes: { pasta: 1 }, gives: { 'boiled-pasta': 2 }, work: 1, wait: 10, hold: 8 },
      'chop-tomato': { verb: 'shovel', takes: { tomato: 1 }, gives: { 'chopped-tomato': 1 }, work: 2 },
      'simmer-sauce': { verb: 'shovel', takes: { 'chopped-tomato': 1 }, gives: { 'tomato-sauce': 2 }, work: 1, wait: 8, hold: 12 },
      'grate-cheese': { verb: 'shovel', takes: { cheese: 1 }, gives: { 'grated-cheese': 2 }, work: 2 },
      'plate-spaghetti': { verb: 'bucket', takes: { 'boiled-pasta': 1, 'tomato-sauce': 1, 'grated-cheese': 1 }, gives: { spaghetti: 1 }, work: 1 },
      'fill-tray': { verb: 'bucket', takes: { 'boiled-pasta': 1, 'tomato-sauce': 1, 'grated-cheese': 1 }, gives: { 'pasta-tray': 1 }, work: 1.5 },
      oven: { verb: 'shovel', takes: { 'pasta-tray': 1 }, gives: { 'pasta-bake': 1 }, work: 0.5, wait: 12, hold: 8 },
    },
    demand: {
      mode: 'orders', every: 24, patience: 70, serve: 1,
      orders: [{ name: 'spaghetti', wants: { spaghetti: 1 }, weight: 3 }, { name: 'pasta bake', wants: { 'pasta-bake': 1 }, weight: 2 }],
    },
    session: 240,
  },
  wok: {
    id: 'wok', name: 'Wok station',
    why: 'rice from the cooker and noodles from the pot, the prep cut, and a wok that burns if left: everything tossed at the end',
    crew: { workers: 2, travel: 1.5 },
    items: { 'cooked-rice': { store: 4, spoil: 80 }, 'boiled-noodles': { store: 4, spoil: 50 }, 'diced-carrot': { store: 4 }, 'beaten-egg': { store: 3 }, 'sliced-chicken': { store: 4 } },
    stations: {
      'rice-cooker': { verb: 'shovel', takes: { rice: 1 }, gives: { 'cooked-rice': 2 }, work: 1, wait: 10, hold: 14 },
      'boil-noodles': { verb: 'shovel', takes: { noodles: 1 }, gives: { 'boiled-noodles': 1 }, work: 1, wait: 6, hold: 8 },
      'dice-carrot': { verb: 'shovel', takes: { carrot: 1 }, gives: { 'diced-carrot': 2 }, work: 2 },
      'beat-egg': { verb: 'shovel', takes: { egg: 1 }, gives: { 'beaten-egg': 1 }, work: 1 },
      'slice-chicken': { verb: 'shovel', takes: { chicken: 1 }, gives: { 'sliced-chicken': 1 }, work: 2 },
      'wok-rice': { verb: 'shovel', takes: { 'cooked-rice': 1, 'diced-carrot': 1, 'beaten-egg': 1 }, gives: { 'fried-rice': 1 }, work: 2, wait: 5, hold: 5 },
      'wok-noodles': { verb: 'shovel', takes: { 'boiled-noodles': 1, 'sliced-chicken': 1, 'diced-carrot': 1 }, gives: { 'chow-mein': 1 }, work: 2, wait: 5, hold: 5 },
    },
    demand: {
      mode: 'orders', every: 24, patience: 70, serve: 1,
      orders: [{ name: 'fried rice', wants: { 'fried-rice': 1 }, weight: 3 }, { name: 'chow mein', wants: { 'chow-mein': 1 }, weight: 2 }],
    },
    session: 240,
  },
  ramen: {
    id: 'ramen', name: 'Noodle bar',
    why: 'a stock that runs long and keeps, noodles and eggs boiled to the minute, pork sliced: four things in every bowl',
    crew: { workers: 2, travel: 1.5 },
    items: { broth: { store: 6 }, 'boiled-noodles': { store: 3, spoil: 40 }, 'boiled-egg': { store: 6 }, 'sliced-pork': { store: 6 } },
    stations: {
      'stock-pot': { verb: 'shovel', takes: { bones: 1 }, gives: { broth: 3 }, work: 1, wait: 14, hold: 40 },
      'boil-noodles': { verb: 'shovel', takes: { noodles: 1 }, gives: { 'boiled-noodles': 1 }, work: 1, wait: 6, hold: 6 },
      'boil-egg': { verb: 'shovel', takes: { egg: 1 }, gives: { 'boiled-egg': 2 }, work: 0.5, wait: 8, hold: 20 },
      'slice-pork': { verb: 'shovel', takes: { pork: 1 }, gives: { 'sliced-pork': 2 }, work: 2 },
      'bowl-ramen': { verb: 'bucket', takes: { broth: 1, 'boiled-noodles': 1, 'boiled-egg': 1, 'sliced-pork': 1 }, gives: { ramen: 1 }, work: 1.5 },
    },
    demand: {
      mode: 'orders', every: 26, patience: 70, serve: 1,
      orders: [{ name: 'ramen', wants: { ramen: 1 } }],
    },
    session: 240,
  },
  diner: {
    id: 'diner', name: 'Burger diner',
    why: 'a grill that burns and a fryer, the salad cut, the burger stacked: a meal wants a burger and fries together',
    crew: { workers: 2, travel: 1.5 },
    items: { 'grilled-beef': { store: 3 }, 'shredded-lettuce': { store: 4 }, 'sliced-tomato': { store: 4 }, 'cut-potato': { store: 4 }, fries: { store: 4, spoil: 40 } },
    stations: {
      grill: { verb: 'shovel', takes: { beef: 1 }, gives: { 'grilled-beef': 1 }, work: 1, wait: 8, hold: 6, slots: 2 },
      'chop-lettuce': { verb: 'shovel', takes: { lettuce: 1 }, gives: { 'shredded-lettuce': 2 }, work: 2 },
      'slice-tomato': { verb: 'shovel', takes: { tomato: 1 }, gives: { 'sliced-tomato': 2 }, work: 2 },
      'cut-potato': { verb: 'shovel', takes: { potato: 1 }, gives: { 'cut-potato': 2 }, work: 2 },
      fryer: { verb: 'shovel', takes: { 'cut-potato': 1 }, gives: { fries: 1 }, work: 0.5, wait: 8, hold: 8 },
      'stack-burger': { verb: 'bucket', takes: { bun: 1, 'grilled-beef': 1, 'shredded-lettuce': 1, 'sliced-tomato': 1 }, gives: { burger: 1 }, work: 1.5 },
    },
    demand: {
      mode: 'orders', every: 22, patience: 65, serve: 1,
      orders: [{ name: 'burger', wants: { burger: 1 }, weight: 3 }, { name: 'fries', wants: { fries: 1 }, weight: 2 }, { name: 'meal', wants: { burger: 1, fries: 1 }, weight: 1 }],
    },
    session: 240,
  },
  pizzeria: {
    id: 'pizzeria', name: 'Pizzeria',
    why: 'dough kneaded and rolled, a sauce simmered, cheese grated, the pizza topped and baked in an oven that burns it if left',
    crew: { workers: 2, travel: 1.5 },
    items: { dough: { store: 3 }, 'rolled-dough': { store: 3 }, 'tomato-sauce': { store: 4 }, 'grated-cheese': { store: 4 }, 'raw-pizza': { store: 2 } },
    stations: {
      knead: { verb: 'shovel', takes: { flour: 1 }, gives: { dough: 1 }, work: 3 },
      'roll-dough': { verb: 'shovel', takes: { dough: 1 }, gives: { 'rolled-dough': 1 }, work: 2 },
      'chop-tomato': { verb: 'shovel', takes: { tomato: 1 }, gives: { 'chopped-tomato': 1 }, work: 2 },
      'simmer-sauce': { verb: 'shovel', takes: { 'chopped-tomato': 1 }, gives: { 'tomato-sauce': 2 }, work: 1, wait: 8, hold: 14 },
      'grate-cheese': { verb: 'shovel', takes: { cheese: 1 }, gives: { 'grated-cheese': 2 }, work: 2 },
      'top-pizza': { verb: 'bucket', takes: { 'rolled-dough': 1, 'tomato-sauce': 1, 'grated-cheese': 1 }, gives: { 'raw-pizza': 1 }, work: 1.5 },
      oven: { verb: 'shovel', takes: { 'raw-pizza': 1 }, gives: { pizza: 1 }, work: 0.5, wait: 10, hold: 6 },
    },
    demand: {
      mode: 'orders', every: 28, patience: 80, serve: 1,
      orders: [{ name: 'margherita', wants: { pizza: 1 } }],
    },
    session: 240,
  },
});

export const SCENARIOS = Object.freeze({ ...TRADES, ...MENUS });

export const scenarioIds = () => Object.keys(SCENARIOS);
