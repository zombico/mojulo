/**
 * An example gameworld: two levels in one world. The first follows its world in everything but a steeper second
 * trail; the second is a local lord, drawn in its own kit and built in its own language, so its castle comes out oval.
 */
export const MEADOWMARK = Object.freeze({
  id: 'meadowmark', name: 'Meadowmark', seed: 8,
  style: {
    kit: 'isekai-meadow', anchor: 'timber-hall', fort: 'crenellated',
    trail: { heartbeat: 0.8, bumpiness: 0.6 }, meru: { preset: 'mountain-lookout' }, town: { levels: 2 },
  },
  levels: {
    'meadow-ascent': {
      name: 'Meadow ascent', seed: 8,
      walk: { nodes: { trailhead: { trail: true }, approach: { trail: { heartbeat: 0.95 } }, lookout: { meru: true } } },
      places: { town: true, castle: true },
    },
    'shell-shore': {
      name: 'The shell shore', seed: 8,
      style: { kit: 'alien-night', anchor: 'shell' },
      walk: { nodes: { landing: { trail: true }, terrace: { meru: { preset: 'temple-pyramid' } } } },
      places: { town: { heartbeat: 'market' }, castle: { size: 48 } },
    },
  },
  links: [{ from: 'meadow-ascent', to: 'shell-shore', kind: 'gate' }],
});
