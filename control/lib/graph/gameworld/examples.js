/**
 * An example gameworld: two levels and three civilizations. The meadow is settled by its framers, but its castle was
 * raised by the stepkeepers, a battered stronghold in tiers over an older town. Through a gate, the shore is drawn in
 * its own kit and settled by the shell-builders, whose castle comes out oval; its land is its own too, hummocky
 * ground, folded cliffs, and an arch among its rocks.
 *
 * Its review, part way through: the creator approved its natural world and its civilizations, and sent the meadow
 * back; the rest waits. (A print is what a part resolved to when it was approved: approve(world, part) writes it.)
 */
export const MEADOWMARK = Object.freeze({
  id: 'meadowmark', name: 'Meadowmark', seed: 8, mode: 'gated',
  review: {
    nature: { status: 'approved', print: '38c45714' },
    civilizations: { status: 'approved', print: '0d3da83b' },
    'level:meadow-ascent': { status: 'revise', note: 'The approach climbs too steeply for a first level: ease it back toward the world\'s heartbeat.' },
  },
  style: {
    kit: 'isekai-meadow', civilization: 'framers', trail: { heartbeat: 0.8, bumpiness: 0.6 }, meru: { preset: 'mountain-lookout' },
    land: { landscape: { variant: 'downs', many: 0.5 }, rock: { variant: 'tor', many: 0.25 }, landmark: { variant: 'monolith', many: 0.25 } },
  },
  civilizations: {
    framers: { name: 'The framers', anchor: 'timber-hall', fort: 'crenellated', town: { levels: 2 } },
    stepkeepers: { name: 'The stepkeepers', anchor: 'tiered', fort: 'battered' },
    'shell-builders': { name: 'The shell-builders', anchor: 'shell', fort: 'crenellated', town: { levels: 2, heartbeat: 'market' }, castle: { size: 48 } },
  },
  levels: {
    'meadow-ascent': {
      name: 'Meadow ascent', seed: 8,
      walk: { nodes: { trailhead: { trail: true }, approach: { trail: { heartbeat: 0.95 } }, lookout: { meru: true } } },
      places: { town: true, castle: { civilization: 'stepkeepers' } },
    },
    'shell-shore': {
      name: 'The shell shore', seed: 8,
      style: { kit: 'alien-night', civilization: 'shell-builders', land: { landscape: { variant: 'hummocky' }, strata: 'folded', landmark: { variant: 'arch', many: 0.5 } } },
      walk: { nodes: { landing: { trail: true }, terrace: { meru: { preset: 'temple-pyramid' } } } },
      places: { town: true, castle: true },
    },
  },
  links: [{ from: 'meadow-ascent', to: 'shell-shore', kind: 'gate' }],
});

/**
 * The meadow's gear language: the anime hero's card in the direction's colours, a jade blade and staff, brass
 * fittings, a clear stone. Every class of the world's equipment wears it unless its row names its own style.
 */
const WIND_BRASS_GEAR = {
  id: 'wind-brass', dials: { stylize: 0.85, mass: 1.05, focus: 'guard', ornament: 2 }, lean: {},
  language: {
    blade: 'hero', guard: 'winged', pommel: 'ring', grip: 'wire',
    staff: { head: 'crescent', wings: true, focus: 'head', shaft: ['satin', '#2f7f6e'] },
    bow: { limb: 'recurve', tips: 'wing', focus: 'riser', shaft: ['satin', '#2f7f6e'] },
    shield: { outline: 'heater', device: 'wings', focus: 'boss', board: ['satin', '#3a9e8a'] },
  },
  edge: { fuller: 0, bevel: 0.62, twoTone: true },
  roles: { blade: ['satin', '#3a9e8a'], edge: { metal: 'chrome', finish: 'mirror' }, fittings: { metal: 'brass', finish: 'polished' }, accent: { metal: 'gold', finish: 'mirror' }, wrap: ['matte', '#6b4a2f'] },
  gem: { gem: 'quartz', glow: 0.5, cut: 'brilliant' },
};
// a class's tiers as the staff's: richer at each stage
const GROWS = { early: { dials: { ornament: 1 } }, mid: { dials: { ornament: 2 } }, late: { dials: { ornament: 3 } } };

/**
 * The same world with its character book begun: an anime hero in the meadow's own direction, led by wind and
 * supported by brass, with a spiral motif. Its looks are four pages, its power set a metroidvania-like traversal set
 * (a step, a thrown ball of wind, a rising column), laid out early, mid and late, and a bouncy, bold walk. She wears a ponytail and a fitted cut of the meadow's tunic.
 * Nothing in it is reviewed and the base is not pinned: every part of the character book waits for the creator. Its
 * systems are laid out but hold nothing of their own: every number is the one the loop derives. Its equipment table is
 * filled, every class in one wind-and-brass gear language, the staff seeded by the hero's own.
 */
export const MEADOWMARK_HERO = Object.freeze({
  ...MEADOWMARK,
  characters: {
    direction: { tradition: 'anime', primary: 'wind', secondary: 'brass', motif: ['spiral'] },
    hero: {
      looks: {
        body: { cast: 'female', tune: { legs: 1.06, shoulders: 1.03 } },
        head: { look: ['heroine', 'tsurime', 'determined'] },
        hair: ['frieda-pony', 'swept-bangs'],
        colour: { palette: { Hair: '#f2d36b' } },
        // the meadow's tunic, cut close: the rail's adventurer at fit 0.25, sleeves long, the hem at the hip
        underlayer: { type: 'outfit', style: 'adventurer', dials: { fit: 0.25, stylize: 0.6 }, language: { top: { family: 'woven', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'boots' } },
      },
      motion: { vibe: ['bouncy', 'bold'] },
      // the kit the loop calls for: the dash and the rise are the body's; the thrown wind is a staff with the wind's stone,
      // richer at each stage, and as a plain pole it is a vault. The staff is the template of its class in the world's
      // equipment table; the other classes are left for the creator
      adornment: {
        bodily: ['gust-step', 'cyclone'],
        items: [{
          id: 'wind-staff', slot: 'right', serves: ['wind-orb'],
          build: { item: 'staff', parts: { head: 'claw' }, dials: { focus: 'head', ornament: 1, mass: 1 }, gem: 'quartz' },
          tiers: { mid: { dials: { ornament: 2, mass: 1.1 } }, late: { dials: { ornament: 3, mass: 1.25 } } },
          alt: [{ id: 'vault-pole', use: 'a pole to vault gaps with', serves: ['gust-step'], build: { parts: { head: 'plain' }, dials: { focus: 'none', mass: 1.4 }, gem: null } }],
        }],
      },
      actions: {
        idiom: 'metroidvania-like',
        powers: [
          { id: 'gust-step', verb: 'dash through the air', look: 'spiral' },
          { id: 'wind-orb', verb: 'throw a ball of wind', attack: 'orb' },
          { id: 'cyclone', verb: 'rise on a spinning column', look: 'column' },
        ],
        progression: [{ stage: 'early', gains: ['gust-step'] }, { stage: 'mid', gains: ['wind-orb'] }, { stage: 'late', gains: ['cyclone'] }],
      },
    },
  },
  // the gear: one language for every class, the staff seeded by the hero's (equipment.js)
  equipment: {
    style: WIND_BRASS_GEAR,
    classes: {
      dagger: { build: { parts: { blade: 'leaf' } }, tiers: GROWS },
      sword: { build: {}, tiers: GROWS },
      greatsword: { build: { parts: { blade: 'flamberge' }, dials: { mass: 1.3 } }, tiers: GROWS },
      bow: { build: {}, tiers: GROWS },
      shield: { build: {}, tiers: GROWS },
    },
  },
  // the systems, every number derived from the actions above (mechanics.js): nothing of its own yet
  mechanics: {},
});

/**
 * A frontier, composed from words: nothing in it was written as a kit or a building language. Its look is tunnelled
 * from the meadow's facets ("realism but stylized and detailed …": a grounded palette of seven stops a ramp, bare
 * basalt, sparse scrub, a gas giant in a pale day sky, dust in the air); the survey corps' habitats are tunnelled from
 * the building elements and the technology blocks; the dome growers start from the shell and make it theirs; each
 * civilization's machines are tunnelled into blocks, and its vehicles, tech-structures and weapons crafted (the
 * crafter, tech-crafter.js). Three levels from the landing flats to a walled relay. Its review has not begun: every
 * part waits for the creator.
 */
export const HALDEN_REACH = Object.freeze({
  id: 'halden-reach', name: 'Halden Reach', seed: 7, mode: 'gated',
  style: {
    kit: 'isekai-meadow',
    look: 'realism but stylized and detailed: a grounded frontier of rust plains, basalt cliffs, sparse lichen scrub, a gas giant in a pale sky, dusty, vast',
    civilization: 'survey-corps', trail: { heartbeat: 0.6, bumpiness: 0.55 }, meru: { preset: 'stacked-lookout' },
    land: { landscape: { variant: 'rugged', many: 0.5 }, rock: { variant: 'boulders', many: 0.5 }, strata: { variant: 'layered', many: 0.75 }, face: { variant: 'columnar', many: 0.75 }, cloud: { variant: 'cirrus', many: 0.25 }, landmark: { variant: 'butte', many: 0.5 } },
  },
  civilizations: {
    'survey-corps': {
      name: 'The survey corps', fort: 'battered', town: { levels: 1, heartbeat: 'hamlet' },
      builds: 'a modular sci-fi habitat, raised, with a comms mast and solar',
      technology: {
        finish: 'alloy', things: { hauler: 'a tracked ore hauler', relay: 'a wind turbine relay beacon', array: 'a solar power station', scanner: 'a portable survey scanner', fabricator: 'an automated fabricator' },
        direction: { elements: { primary: 'lightning' } },
        vehicles: { walker: { intent: 'an armoured walker', rank: 'focus' }, crawler: 'an armoured tracked crawler', skimmer: 'a small scout hover skimmer', lifter: 'a cargo helicopter' },
        structures: { mast: 'a tall lattice relay tower beacon', dish: 'a radio telescope dish', pad: 'a rocket launch gantry' },
        weapons: { carbine: 'a laser carbine', sentry: 'a sentry turret', shield: 'a riot shield' },
      },
    },
    'dome-growers': {
      name: 'The dome growers', anchor: 'shell', fort: 'crenellated', town: { levels: 2 },
      builds: 'pressurised domes, banded, with solar',
      technology: {
        finish: 'composite', things: { greenhouse: 'a hydroponic greenhouse', cistern: 'a water tank', loader: 'a tracked crane loader' },
        vehicles: { walker: 'a cargo walker', barge: 'a canal barge' },
        structures: { cooler: 'a cooling tower', wall: 'a forcefield barrier' },
        weapons: { lance: 'an arc lance', launcher: 'a missile launcher' },
      },
    },
  },
  levels: {
    'landing-flats': {
      name: 'The landing flats',
      walk: { nodes: { pad: { trail: { heartbeat: 0.35 } }, flats: { trail: true }, survey: { meru: true } } },
      places: { town: true },
    },
    'basalt-run': {
      name: 'The basalt run',
      style: { civilization: 'dome-growers', land: { face: { variant: 'columnar', many: 1 }, landmark: { variant: 'spire', many: 0.25 } } },
      walk: { nodes: { cut: { trail: { heartbeat: 0.8, bumpiness: 0.8 } }, gully: { trail: true } } },
      places: { town: true },
    },
    'relay-ridge': {
      name: 'Relay ridge',
      style: { trail: { heartbeat: 0.85 } },
      walk: { nodes: { switchback: { trail: true }, crest: { meru: { preset: 'mountain-lookout' } } } },
      places: { town: true, castle: true },
    },
  },
  links: [{ from: 'landing-flats', to: 'basalt-run', kind: 'road' }, { from: 'basalt-run', to: 'relay-ridge', kind: 'road' }],
});

// ── a party RPG, designed down to its buildings: the reference the hub town is held to ─────────────────────────────
const S = (group, value, bond = 'none') => ({ group, value, bond });
// the town's builders: written as a language's elements (era/out-anchor-elements.js), not chosen from the authored three
const HOLLIN_HOUSE = Object.freeze({
  id: 'hollin-house',
  read: 'a whitewashed house of lime-rendered rubble on a grey stone socle, dressed quoins at its corners, a red tile roof hipped at both ends, small round-headed lights on stone sills under keystones, shutters at most windows, a stone stack, a lower wing behind; a setts lane, flagged footways, lanterns on brackets, rendered garden walls',
  storeyH: 2.8,
  elements: {
    wall: { kind: 'wall', storeys: [S('str:plaster', 0.9), S('str:plaster', 0.93)] },
    roof: { kind: 'cap', form: 'hip', pitch: 34, eave: 0.6, group: 'str:tile', value: 0.42, courses: true },
    lights: { kind: 'light', form: 'arch', w: 0.95, h: 1.35, sill: 0.9, bay: 2.8, group: 'str:opening', value: 0.04 },
    door: { kind: 'door', form: 'arch', w: 1.15, h: 2.3 },
    socle: { kind: 'socle', h: 0.6, group: 'str:stone', value: 0.5 },
    sills: { kind: 'sill', h: 0.16, over: 0.07, group: 'str:stone', value: 0.8 },
    lintels: { kind: 'lintel', h: 0.24, form: 'key', group: 'str:stone', value: 0.78 },
    quoins: { kind: 'quoins', w: 0.36, course: 0.3, group: 'str:stone', value: 0.7 },
    stack: { kind: 'chimney', w: 0.6, group: 'str:stone', value: 0.55 },
    shutters: { kind: 'shutters', share: 0.6, group: 'str:paint', value: 0.4 },
    road: { kind: 'road', paving: 'setts' }, footway: { kind: 'footway', w: 1.6, paving: 'flags' }, kerb: { kind: 'kerb', h: 0.14, w: 0.25 },
    lamp: { kind: 'lamp', h: 3.1, head: 'lantern', arm: 'bracket', stride: 15 }, post: { kind: 'post', h: 0.9, form: 'capped', stride: 3.5 },
    gardens: { kind: 'boundary', form: 'rendered', roles: ['front', 'side', 'back'], lift: 0.45, pier: 4, cope: 0.06 },
    yards: { kind: 'boundary', form: 'drystone', roles: ['field', 'guard', 'retain'], lift: 0.4, pier: 4, cope: 0.06 },
    precinct: { kind: 'boundary', form: 'coursed', roles: ['precinct'], lift: 0.55, pier: 3.6, cope: 0.08 },
  },
  compose: { mass: { kind: 'block', w: 9.5, d: 7 }, storeys: 2, annex: { scale: 0.6 } },
});
// the older people of the downs, whose fort crowns the last hill: low drystone, a steep thatch
const BARROW_HOUSE = Object.freeze({
  id: 'barrow-house',
  read: 'a low house of unmortared grey stone under a steep thatched gable, small square lights, a door under a heavy stone lintel, a stack at the gable; a flagged way, drystone walls',
  storeyH: 2.6,
  elements: {
    wall: { kind: 'wall', storeys: [S('str:stone', 0.52, 'rubble')] },
    roof: { kind: 'cap', form: 'gable', pitch: 50, eave: 0.7, group: 'str:thatch', value: 0.46, courses: true },
    lights: { kind: 'light', form: 'rect', w: 0.8, h: 0.9, sill: 1, bay: 3, group: 'str:opening', value: 0.04 },
    door: { kind: 'door', form: 'rect', w: 1, h: 2 },
    lintels: { kind: 'lintel', h: 0.3, form: 'flat', group: 'str:stone', value: 0.6 },
    stack: { kind: 'chimney', w: 0.7, group: 'str:stone', value: 0.5 },
    road: { kind: 'road', paving: 'flags' }, footway: { kind: 'footway', w: 1.2, paving: 'flags' }, kerb: { kind: 'kerb', h: 0.1, w: 0.3 },
    lamp: { kind: 'lamp', h: 2.6, head: 'lantern', arm: 'post', stride: 20 }, post: { kind: 'post', h: 0.8, form: 'square', stride: 3 },
    yards: { kind: 'boundary', form: 'drystone', roles: ['front', 'side', 'back', 'field', 'guard', 'retain'], lift: 0.5, pier: 4, cope: 0.06 },
  },
  compose: { mass: { kind: 'block', w: 8, d: 6 }, storeys: 1 },
});

/**
 * Hollin Vale: a party RPG designed whole, the reference its hub town is held to. A party of four sets out from Hollin,
 * a walled market town of whitewashed stone under red tile, into the pine hollows and the barrow downs, fighting wolves,
 * beastfolk raiders, skeletons and zombies, to the old hill fort on Harrow Top. Nothing in it is a preset id where the
 * book can decide: the town's builders are written as their language's elements (rendered rubble, a hipped tile roof,
 * round-headed lights under keystones), so its walls are derived from them; the hill fort's people have their own; the
 * art direction is a palette in words over a morning cube; the hero, the party and the packs are the book's own.
 * Hollin is the hub every way leads back to: its street walked, the shop entered as part of the town, two houses entered
 * at their doors, the town's people living in it, its merchant and its innkeeper among them. Made end to end by a run,
 * it is the test asset for the gameworld's town, its folk, its battles and its shops.
 */
export const HOLLIN_VALE = Object.freeze({
  id: 'hollin-vale', name: 'Hollin Vale', seed: 11, mode: 'autonomous',
  brief: {
    prompt: 'a jrpg where a party of four sets out from a walled market town of whitewashed stone and red tile roofs, through pine forests and old barrow hills, battling wolves, beastfolk raiders, skeletons and zombies, to a ruined hill fort',
    why: { spirited: 'a party setting out on its first road: light on its feet, eager' },
  },
  intent: { from: 'jrpg' },
  // an even walk and a small jump: a party on the road, not a platformer
  feel: 'isekai-party',
  juice: 'auto',
  screen: 'screen',
  topology: 'interconnected',
  moves: true,
  style: {
    kit: 'isekai-meadow',
    look: 'stylized and detailed: dark pine forest on heather downs, grey granite tors, a pale northern sky, light mist',
    civilization: 'hollin-folk', trail: { heartbeat: 0.7, bumpiness: 0.55 },
    land: { landscape: { variant: 'downs', many: 0.75 }, rock: { variant: 'boulders', many: 0.25 }, landmark: { variant: 'monolith', many: 0 } },
    geocube: { from: 'upland-morning', biocube: { from: 'alpine' } },
    // (the stone and the earth locked: left to the wheel, a sky at 214 put the world's stone opposite it in mauve)
    palette: { intent: 'whitewash, red tile and dark pine under a cool morning sky', key: 'high', heat: 0.1, weight: 0, activity: 0.2, scheme: 'complementary', hues: { sky: 214, ground: 105, foliage: 140 }, lock: { accent: '#a8402a', rock: '#c9c2b4', soil: '#8a6a4a' } },
  },
  civilizations: {
    'hollin-folk': { name: 'The folk of Hollin', anchor: HOLLIN_HOUSE, town: { levels: 1, heartbeat: 'market' } },
    'barrow-wardens': {
      name: 'The barrow wardens', anchor: BARROW_HOUSE,
      // their fort: a battered drystone rampart, a solid parapet, square towers crenellated (their turrets under slate)
      fort: {
        read: 'a battered rampart of unmortared stone, a solid breastwork over its walk, square towers crenellated, a single box gate, a deep ditch cut in the hill',
        curtain: { base: 'battered', batter: 0.32, t: 3, group: 'str:stone', value: 0.5, bond: 'rubble' },
        parapet: { form: 'solid', h: 1.5, group: 'str:stone', value: 0.56 },
        walk: { w: 2 },
        tower: { plan: 'square', crown: 'crenel', cover: 'str:slate', value: 0.34 },
        gate: { form: 'box', clear: 4 },
        ditch: { w: 9, depth: 3 },
      },
    },
  },
  levels: {
    hollin: {
      name: 'Hollin',
      walk: { nodes: { square: { trail: true } } },
      places: { town: true, street: { houses: 8, enter: 2, walk: ['shop'], walls: true, inside: true } },
    },
    'pine-hollow': {
      name: 'The pine hollow',
      style: { land: { rock: { variant: 'boulders', many: 0.5 } } },
      walk: { nodes: { edge: { trail: true }, deep: { trail: { heartbeat: 0.85, bumpiness: 0.7 } } } },
    },
    'barrow-downs': {
      name: 'The barrow downs',
      walk: { nodes: { downs: { trail: true }, barrows: { trail: { heartbeat: 0.6 } } } },
    },
    'harrow-top': {
      name: 'Harrow Top',
      style: { trail: { heartbeat: 0.9 } },
      walk: { nodes: { climb: { trail: { heartbeat: 0.95, bumpiness: 0.6 } }, crest: { trail: true } } },
      places: { castle: { civilization: 'barrow-wardens' } },
    },
  },
  links: [
    { from: 'hollin', to: 'pine-hollow', kind: 'road' },
    { from: 'hollin', to: 'barrow-downs', kind: 'road' },
    { from: 'barrow-downs', to: 'harrow-top', kind: 'gate' },
  ],
  start: 'hollin',
  hub: 'hollin',
  // the fights: wolves in the hollow, the raiders and the dead on the downs, the dead rising round the fort
  battles: {
    // (two a stage: the hollow's edge and its deep, the downs and the barrows, the climb and the crest, the boss last)
    packs: [
      ['wolf', 'wolf'], ['wolf', 'bandit'], ['wolf', 'wolf', 'bandit'], ['bandit', 'bandit'],
      ['bandit', 'wolf', 'bandit'], ['skeleton', 'zombie'], ['skeleton', 'skeleton'], ['zombie', 'skeleton', 'zombie'],
      ['skeleton', 'zombie', 'bandit'], ['zombie', 'zombie', 'skeleton'], ['skeleton', 'skeleton', 'zombie'],
    ],
    boss: ['zombie', 'skeleton', 'zombie'],
    looks: { bandit: { people: 'lupine' } },
  },
  characters: {
    direction: { tradition: 'anime', body: 'game' },
    hero: {
      looks: {
        body: { cast: 'male', tune: { shoulders: 1.04 } },
        head: { look: ['lead'] },
        hair: ['kairo', 'messy'],
        colour: { palette: { Hair: '#3b2a1e' } },
        underlayer: { type: 'outfit', style: 'adventurer', dials: { fit: 0.3, stylize: 0.55 }, language: { top: { family: 'woven', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' }, feet: 'boots' } },
      },
      motion: { vibe: ['spirited'] },
      actions: { none: true },
      adornment: { items: [{ id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] }] },
    },
    casting: { scale: 'party', n: 3 },
    folk: true,
  },
});
