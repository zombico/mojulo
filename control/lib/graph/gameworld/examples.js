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
