/**
 * THE COMIC HERO PACK'S LOOKS: one dial of three REGISTERS, every stop a geocube the tree reads TODAY (era/geocube.js
 * readGeocube: a `from` preset with its changes) and the hero direction that goes with it (gameworld/characters.js).
 * Each register has its own light, and the world and the hero take the same one:
 *
 *   anime      the isekai shell's own light (era/isekai.js): every colour on its ramp, rock and cliff drawn lit or in
 *              shade by tile per facet (the sun's Lambert × its shadow), grass hats and the field, a painted sky. The
 *              cube's outside has no polygon land (`outside.land: false`), which would draw over it. Not the `cel`
 *              register: the anime look is not inked. The hero is the anime tradition on the tiered body: the anime
 *              head under its character light
 *   dcau       the gritty look at golden hour (the operator's reference: a seventh-generation western at sunset): a low
 *              warm sun behind lit cloud, the figures backlit and darker than the sky, dusty ground drawn from relief, a
 *              warm haze that sinks the distance, warm earth against a cool stone; the light baked into the vertex
 *              (gen-6), the world's colours the colour theorist's. The hero is the western tradition on the tiered body,
 *              baked by the cube's cast light
 *   realistic  the seventh generation (era/eras.js gen-7): the form render under a live key, worked steel and leather,
 *              no outline. The realistic body
 *
 *   DIAL            the stops in order: [{ id, body, reads }]
 *   LOOKS           { <look id>: { stop, reads, geocube, paint, level?, hero, why } } a look is a stop at an hour
 *                     geocube  the spec a level's `geocube` takes, readable now; its `light` the air (outsideFog against
 *                              the reference's, the sky's colours), its `palette` the theorist's spec (a seed: solved)
 *                     paint    the rest of a level's paint beside the geocube (city/plan/look.js): the `hour` the cube
 *                              lights it at and the `clouds` over it
 *                     level    the QA level it is seen on: 'city' (a downtown painted by the cube, the default) or
 *                              'trail' (open ground: the city kind lights itself and never draws the isekai bake)
 *                     bake     the hero wears the look's cube, baked in its light (era/cast-light.js: the key, the tinted
 *                              ambient, the ground's bounce, the rim); absent, the hero's own light (the anime head's
 *                              character light, which a cube on the hero would replace)
 *                     hero     the gameworld `characters.direction` for it, plus `form` where the body is the realistic one
 *   lookOf(id)      one, or throws naming the known ids
 *
 * A look is not yet a `reality.look` value: `comic-day` and `comic-night` stand in the registry as planned (absent), and
 * the sixth-gen look row that would make them is the `comic-look` package. Until then a world takes the geocube directly.
 */
export const DIAL = Object.freeze([
  { id: 'anime', body: 'tiered', reads: 'the anime open field: every colour on its ramp, rock lit or in shade by tile, grass hats, a painted sky; the hero the anime head under its character light' },
  { id: 'dcau', body: 'tiered', reads: 'the frontier film at golden hour: a low warm sun behind lit cloud, the figures backlit, dusty ground and a warm haze, the light baked, the colours the theorist\'s; the hero the tiered body under the cube\'s cast light' },
  { id: 'realistic', body: 'realistic', reads: 'the seventh generation: light on material under a live key, no outline; the realistic hero' },
]);

export const LOOKS = Object.freeze({
  'anime-day': {
    stop: 'anime', reads: 'the anime field at noon: a hard sun, the grass lit to its top stop, rock in two tiles, heaped cumulus',
    geocube: { from: 'island-noon', colour: { stone: '#a9a4b8', floor: '#c9a27a' }, outside: { land: false }, light: { outsideFog: 0.7 } },
    paint: { hour: 'noon', clouds: 'fair' },
    level: 'trail',
    hero: { tradition: 'anime', from: 'world', primary: 'the emblem', secondary: 'the hair' },
    why: ['The light is the palette\'s: a colour moves along its ramp in the sun and the shade, never off it.', 'Rock and cliff are two tiles, lit and shade, chosen per facet by the sun and its shadow: the band follows the big shapes.', 'Shade is a cool colour, never black; the sky is the brightest thing.', 'A cool lilac stone and a warm sand ground, so the grass and the sky carry the hue.'],
  },
  'dcau-golden': {
    stop: 'dcau', reads: 'the frontier film at golden hour: a low sun behind lit cloud, the figures backlit, dusty ground, a warm haze',
    // the gritty look as the baseline (the light shaped in the vertex, vertex-contrast.js wii; the walls and the rock dressed
    // from relief at grit) under the desert-dusk reference's low warm key, the air thick enough to warm the distance; the
    // colours the theorist's, full where they look good: rust and ochre lit warm, the stone and the shade a cool teal against them
    // (the cast's rim in the cube's own sky, strong enough to hold a backlit figure's outline: a dark suit keeps its form)
    geocube: { from: 'jungle-haze', light: { reference: 'desert-dusk', outsideFog: 1.4, rim: { strength: 0.9, power: 2.5 } }, contrast: 'wii', grit: 0.8, materials: { age: 'worn' },
      palette: { intent: 'a dusty frontier at golden hour: rust and ochre ground under a warm low sun, the stone and the shade cool against it', key: 'mid', heat: 0.6, weight: 0.2, activity: 0.3, scheme: 'split-complementary', hue: '#b07a48', hues: { sky: 60 }, seed: 5 } },
    paint: { hour: 'golden', clouds: 'fair', materials: 'modern' },
    bake: true,
    hero: { tradition: 'western', from: 'world', primary: 'the silhouette', secondary: 'the emblem' },
    why: ['The sky is the brightest thing: a warm gold the figures stand against, backlit.', 'Warm against cool: rust and ochre in the low sun, the stone and the shade a cool teal; colour where it looks good.', 'The air is warm and thick: the distance sinks into the sky\'s colour.', 'The ground is worn and dusty, drawn from relief; the light is baked.'],
  },
  'realistic-night': {
    stop: 'realistic', reads: 'the film by night: a city under overcast, worked steel and leather, the light live',
    geocube: { from: 'city-night', era: 'gen-7', register: 'continuous', materials: { age: 'worn' }, light: { outsideFog: 0.9 } },
    paint: { hour: 'night', clouds: 'overcast' },
    hero: { tradition: 'western', from: 'world', form: 'realistic', primary: 'the silhouette', secondary: 'the emblem, small' },
    why: ['Light on material, as a camera sees it: the renderer lights it, the surface holds no light.', 'The suit is worn: a film\'s costume, not a print.', 'Overcast night, the air a little thick: the city lights bloom, the far towers soften.'],
  },
});

export function lookOf(id) {
  const L = LOOKS[id];
  if (!L) throw new Error(`comic-hero: no look '${id}' (known: ${Object.keys(LOOKS).join(', ')})`);
  return L;
}
