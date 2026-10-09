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
 * The same world with its character book begun: an anime hero in the meadow's own direction, led by wind and
 * supported by brass, with a spiral motif. Its looks are four pages, its power set a metroidvania-like traversal set
 * (a step, a thrown ball of wind, a rising column), laid out early, mid and late, and a bouncy, bold walk. Nothing in it
 * is reviewed and the base is not pinned: every part of the character book waits for the creator.
 */
export const MEADOWMARK_HERO = Object.freeze({
  ...MEADOWMARK,
  characters: {
    direction: { tradition: 'anime', primary: 'wind', secondary: 'brass', motif: ['spiral'] },
    hero: {
      looks: {
        body: { cast: 'female', tune: { legs: 1.04, shoulders: 1.03 } },
        head: { look: ['heroine', 'soft'] },
        hair: { length: 1.5, fringe: 0.85 },
        colour: { palette: { Hair: '#e8cf7a' } },
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
});

/**
 * A frontier, composed from words: nothing in it was written as a kit or a building language. Its look is tunnelled
 * from the meadow's facets ("realism but stylized and detailed …": a grounded palette of seven stops a ramp, bare
 * basalt, sparse scrub, a gas giant in a pale day sky, dust in the air); the survey corps' habitats are tunnelled from
 * the building elements and the technology blocks; the dome growers start from the shell and make it theirs; each
 * civilization's machines are tunnelled into blocks. Three levels from the landing flats to a walled relay. Its review
 * has not begun: every part waits for the creator.
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
      technology: { finish: 'alloy', things: { hauler: 'a tracked ore hauler', relay: 'a wind turbine relay beacon', array: 'a solar power station', scanner: 'a portable survey scanner', fabricator: 'an automated fabricator' } },
    },
    'dome-growers': {
      name: 'The dome growers', anchor: 'shell', fort: 'crenellated', town: { levels: 2 },
      builds: 'pressurised domes, banded, with solar',
      technology: { finish: 'composite', things: { greenhouse: 'a hydroponic greenhouse', cistern: 'a water tank', loader: 'a tracked crane loader' } },
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
