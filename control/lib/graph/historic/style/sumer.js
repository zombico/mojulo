/**
 * The SUMER style card: how the Uruk-period town should LOOK, written as principles and as the numbers the
 * light bake (../light.js) and the page's sky read. The record (../record/sumer.js) says what Sumer built;
 * the culture (../cultures/sumer.js) says in what colours and at what scale; this says what the eye should
 * find. The sixth-gen composer's lesson: every principle has a machine check (../style.test.js).
 */
export const SUMER_STYLE = Object.freeze({
  id: 'sumer',
  principles: Object.freeze([
    'Hard sun, measured: the whitewashed temple is the brightest thing in the town, the sunlit lanes next; a lane in shade is a cool blue-grey, never black, and still brighter than the mud brick turned from the sun.',
    'The alleys are slots of shade: a beaten-mud alley between house walls lies in shadow several times as often as a main street, while the open court of the precinct stands in sun.',
    'Walls stand in their own contact shade: the ground darkens at the foot of every wall and in the corners of every court, the sky hemmed in there.',
    'Shadows fall true: a battered wall, a ziggurat\'s tiers and a palm\'s crown each throw the shape they are, and no two shadows darken twice where they overlap.',
    'The sky is a place: hazy and bluer overhead, pale with dust at the horizon, never a flat page.',
  ]),
  // the value order principle 1 measures, brightest first
  values: Object.freeze(['whitewash', 'lane', 'shade', 'brick']),
  light: { shade: { color: '#5a6488', alpha: 0.42, soft: 0.3 }, ao: { radius: 6, alpha: 0.32 }, palm: { alpha: 0.55, reach: 0.42 } },
  // principle 2: the `alley` lanes (by surface) at least `alleyShade` in shade and `overStreets` times the streets; the precinct at most `courtShade`
  lanes: { alley: 'mud', alleyShade: 0.28, overStreets: 2.5, courtShade: 0.25 },
  sky: { preset: 'day', sunElev: 0.85, palette: { highlight: [232, 222, 198], shadow: [22, 86, 186] }, sun: false, horizonY: 0.5 },
});
