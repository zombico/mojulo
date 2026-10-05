/**
 * The GIZA style card: how the Old Kingdom plateau should LOOK, as principles and as the numbers the light
 * bake (../light.js) and the page's sky read. Machine checks in ../style.test.js.
 */
export const GIZA_STYLE = Object.freeze({
  id: 'giza',
  principles: Object.freeze([
    'The pyramids measure the plateau: each throws one long, clean shadow across the desert, its edges straight.',
    'The escarpment holds its own shade: the floodplain at the foot of the scarp lies in the plateau\'s shadow where the sun stands behind it.',
    'Walls stand in their own contact shade: the streets between mastabas and the workers\' galleries are darker than the open desert.',
    'Shadows fall true and never darken twice where they overlap.',
    'The sky is a place: a pale, dusty blue over the desert.',
  ]),
  values: Object.freeze([]),
  light: { shade: { color: '#5a6488', alpha: 0.42, soft: 0.4 }, ao: { radius: 8, alpha: 0.28 }, palm: { alpha: 0.55, reach: 0.42 } },
  sky: { preset: 'day', sunElev: 0.85, palette: { highlight: [236, 224, 200], shadow: [30, 96, 180] }, sun: false, horizonY: 0.5 },
});
