/**
 * The THEBES style card: how New Kingdom Thebes should LOOK, as principles and as the numbers the light bake
 * (../light.js) and the page's sky read. Machine checks in ../style.test.js.
 */
export const THEBES_STYLE = Object.freeze({
  id: 'thebes',
  principles: Object.freeze([
    'Hard sun, measured: gypsum-washed walls are the brightest thing in the town, the sunlit lanes next; a lane in shade is a cool blue-grey, never black, and still brighter than the Nile brick turned from the sun.',
    'The alleys are slots of shade: a beaten-mud alley between house walls lies in shadow several times as often as a main street, while the temple\'s open court stands in sun.',
    'Walls stand in their own contact shade: the ground darkens at the foot of every wall, pylon and colonnade.',
    'Shadows fall true: a pylon\'s batter, a colossus, a column and a palm each throw the shape they are, and no two shadows darken twice where they overlap.',
    'The sky is a place: a clear blue over the Nile, paler and warmer at the horizon.',
  ]),
  values: Object.freeze(['whitewash', 'lane', 'shade', 'brick']),
  light: { shade: { color: '#5a6488', alpha: 0.42, soft: 0.3 }, ao: { radius: 6, alpha: 0.3 }, palm: { alpha: 0.55, reach: 0.42 } },
  // principle 2: the `alley` lanes (by surface) at least `alleyShade` in shade and `overStreets` times the streets; the precinct at most `courtShade`
  lanes: { alley: 'mud', alleyShade: 0.28, overStreets: 2.5, courtShade: 0.25 },
  sky: { preset: 'day', sunElev: 0.9, palette: { highlight: [236, 226, 204], shadow: [16, 92, 196] }, sun: false, horizonY: 0.5 },
});
