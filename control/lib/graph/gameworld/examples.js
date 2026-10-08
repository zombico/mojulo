/**
 * An example gameworld: two levels and three civilizations. The meadow is settled by its framers, but its castle was
 * raised by the stepkeepers, a battered stronghold in tiers over an older town. Through a gate, the shore is drawn in
 * its own kit and settled by the shell-builders, whose castle comes out oval.
 */
export const MEADOWMARK = Object.freeze({
  id: 'meadowmark', name: 'Meadowmark', seed: 8,
  style: { kit: 'isekai-meadow', civilization: 'framers', trail: { heartbeat: 0.8, bumpiness: 0.6 }, meru: { preset: 'mountain-lookout' } },
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
      style: { kit: 'alien-night', civilization: 'shell-builders' },
      walk: { nodes: { landing: { trail: true }, terrace: { meru: { preset: 'temple-pyramid' } } } },
      places: { town: true, castle: true },
    },
  },
  links: [{ from: 'meadow-ascent', to: 'shell-shore', kind: 'gate' }],
});
