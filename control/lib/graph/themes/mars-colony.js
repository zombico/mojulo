/**
 * mars-colony — the SCIFI-family proof pack.
 *
 * This is the "extend to sci-fi" demonstration, honest about the current limit: the city
 * base has no material/palette knobs, so a full metal/glass reskin is NOT possible from
 * `fractal-city` yet. What the city CAN express — a dense night settlement under habitat
 * domes with no vegetation and a central mast — is what this pack asks for. The dramatic
 * material recolor lands when a base with a material axis (e.g. dungeon) is wired, at which
 * point this pack's `material`/`style` slots (added then) start being consumed too.
 */
export default {
  id: 'mars-colony',
  family: 'scifi',
  label: 'Mars colony',
  description: 'A dense night settlement under habitat domes, no vegetation, a central mast. Sci-fi family — a full metal/glass reskin needs the material axis (a base like dungeon), not yet wired for city.',
  slots: {
    context: { time: 'night', density: 0.8, depth: 3 },
    asset: {
      anchor: 'tower',
      elements: {
        civicDomes: true,        // read as pressurized habitat domes
        cityTrees: false,
        parkDoodads: false,
        religiousPlaces: false,
        powerLines: true,
      },
    },
  },
};
