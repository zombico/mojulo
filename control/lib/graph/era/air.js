/**
 * AIR — how a style draws its air. The style guide owns this, the weather asks it. A kit's style card already carries
 * the pieces (the fog's colour and density, the ambient light that is its SHADE, the cel strength, the soil ramp); this
 * reads them into one card so fog, world and weather draw in the same hand:
 *
 *   hue      the fog's colour at its clear value (the card's air.fog.color)
 *   density  the kit's own fog density (a state's fog factor multiplies it)
 *   shade    the colour the world's dark side takes: the card's ambient, never black (the look layer's shade-is-colour)
 *   depth    0…1, how far murk falls from the hue toward the shade (a storm's dark; 0.5 default)
 *   cast     0…1, how strong cast and contact shadows are when the sun is out (1 default); weather thins them
 *   body     how the fog is drawn: 'smooth' (the exponential falloff), 'banded' (flat planes, `steps` of them: a cel
 *            look) or 'dithered' (an ordered stipple across `steps` levels: a pixel look)
 *   steps    the planes or levels of a banded or dithered fog
 *   skyFollow 0…1, how far the sky takes the fog's colour as the weather changes it
 *   states   { <state>: { hue } }: the colour a state's air is in this style (a dust storm's ochre, a blizzard's cold
 *            white), else the ramp of hue → shade by the state's veil. The WEATHER stays values-only; colour is here.
 *
 * Every field is tunable on the weather (`weather.air`) and on a world's style; what is left out is the card's own.
 */

const HEX = /^#[0-9a-f]{6}$/i;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const AIR_BODIES = Object.freeze({
  smooth: 'the exponential falloff of ordinary fog',
  banded: 'flat planes of haze, `steps` of them (a cel look)',
  dithered: 'an ordered stipple across `steps` levels (a pixel look)',
});
export const AIR = Object.freeze({
  hue: 'the fog\'s colour at its clear value (#rrggbb)',
  shade: 'the colour the world\'s dark side takes, never black (#rrggbb)',
  depth: 'how far murk falls from the hue toward the shade, 0…1',
  cast: 'how strong cast and contact shadows are in full sun, 0…1; the weather thins them',
  body: `how the fog is drawn: ${Object.keys(AIR_BODIES).join(', ')}`,
  steps: 'the planes of a banded fog, the levels of a dithered one: 2…8',
  skyFollow: 'how far the sky takes the fog\'s colour as the weather changes it, 0…1',
  states: 'the colour a state\'s air is in this style: { <state>: { hue } } (else the hue → shade ramp by its veil)',
});
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const num01 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** A tuning of the air ({ hue?, shade?, depth?, cast?, body?, steps?, skyFollow?, states? }), read; every word checked. */
export function readAir(a, where = 'air', stateNames = null) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error(`${where} is { ${Object.keys(AIR).join(', ')} }`);
  const out = {};
  for (const [k, v] of Object.entries(a)) {
    if (!own(AIR, k)) throw new Error(`${where}.${k} is not an air setting (${Object.keys(AIR).join(', ')})`);
    if (k === 'hue' || k === 'shade') { if (!(typeof v === 'string' && HEX.test(v))) throw new Error(`${where}.${k} is a colour, #rrggbb`); out[k] = v.toLowerCase(); }
    else if (k === 'depth' || k === 'cast' || k === 'skyFollow') { if (!num01(v)) throw new Error(`${where}.${k} is from 0 to 1`); out[k] = v; }
    else if (k === 'body') { if (!own(AIR_BODIES, v)) throw new Error(`${where}.body is one of: ${Object.keys(AIR_BODIES).join(', ')}`); out.body = v; }
    else if (k === 'steps') { if (!(Number.isInteger(v) && v >= 2 && v <= 8)) throw new Error(`${where}.steps is a whole number from 2 to 8`); out.steps = v; }
    else {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where}.states is { <state>: { hue } }`);
      out.states = {};
      for (const [n, s] of Object.entries(v)) {
        if (stateNames && !stateNames.includes(n)) throw new Error(`${where}.states.${n} is not a weather state (${stateNames.join(', ')})`);
        if (!s || typeof s !== 'object' || !(typeof s.hue === 'string' && HEX.test(s.hue)) || Object.keys(s).some((x) => x !== 'hue')) throw new Error(`${where}.states.${n} is { hue: '#rrggbb' }`);
        out.states[n] = { hue: s.hue.toLowerCase() };
      }
    }
  }
  return out;
}

// what each state's air is in a style that says nothing of it: dust takes the soil, snow the cold of the hue
function derivedStates(hue, soil) {
  const h = hexRgb(hue), ochre = soil ? soil.map((v) => v / 255) : mix(h, [0.78, 0.62, 0.38], 0.7);
  return {
    dust: { hue: rgbHex(mix(h, ochre, 0.7)) },
    duststorm: { hue: rgbHex(mix(h, ochre, 0.9).map((v) => v * 0.9)) },
    snow: { hue: rgbHex(mix(h, [0.93, 0.96, 1], 0.55)) },
    blizzard: { hue: rgbHex(mix(h, [0.93, 0.96, 1], 0.75)) },
  };
}

/** The air card of a style card (era/isekai.js and kin: air.fog, light.ambient, cel, palette), with a tuning laid over. */
export function airCard(S, tuning = {}) {
  const fog = (S && S.air && S.air.fog) || { color: '#b8c4cc', density: 0.006 };
  const hue = tuning.hue ?? fog.color, shade = tuning.shade ?? (S && S.light && HEX.test(S.light.ambient) ? S.light.ambient : rgbHex(mix(hexRgb(hue), [0.1, 0.12, 0.2], 0.6)));
  const cel = S && Number.isFinite(S.cel) && S.cel > 0.05 ? S.cel : 0;
  const body = tuning.body ?? (cel ? 'banded' : 'smooth');
  const soil = S && S.palette && Array.isArray(S.palette.soil) && S.palette.soil[2] ? S.palette.soil[2] : null;
  return {
    hue, density: fog.density, shade, depth: tuning.depth ?? 0.5, cast: tuning.cast ?? 1, body,
    steps: tuning.steps ?? (cel ? Math.max(3, Math.min(5, Math.round(6 - cel * 8))) : 4),
    skyFollow: tuning.skyFollow ?? (cel ? 0.6 : 0.8),
    states: { ...derivedStates(hue, soil), ...(tuning.states || {}) },
  };
}

/** An air card from a bare haze colour (a world with no kit): its shade a cooler, darker mix of it. */
export function airFromHaze(haze, tuning = {}) {
  return airCard({ air: { fog: { color: HEX.test(haze && haze.color) ? haze.color : '#b8c4cc', density: haze && Number.isFinite(haze.density) ? haze.density : 0.006 } } }, tuning);
}

/** The fog's colour for a state (by its veil, 0…1; 0.75 is the clear value): its own hue if the card names one, else the
 *  card's hue; moving toward the shade as the veil falls (a state with its own hue: toward its own dark; never black), toward light as it rises. [r, g, b] 0…1. Pure:
 *  the page runs this source. */
export function airColour(card, name, veil) {
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const c0 = hx(card.states && card.states[name] ? card.states[name].hue : card.hue), sh = hx(card.shade);
  // a state the style gives its own hue (dust, snow) darkens in that hue; the rest fall toward the world's shade
  const own = !!(card.states && card.states[name]), deep = own ? c0.map((v) => v * (1 - 0.4 * card.depth)) : sh.map((v) => v * (1 - 0.45 * card.depth)), light = mx(c0, [1, 1, 1], 0.55), v = veil / 0.75;
  if (v <= 1) { const u = Math.max(0, v); return mx(deep, c0, u * u * (3 - 2 * u)); }
  return mx(c0, light, Math.min(1, (v - 1) / 0.33));
}

/** How strong cast shadows are under a state (0…1): the sun must be out, and fog takes them; the card's `cast` is the
 *  ceiling. A state is { sky, fog } (weather/weather.js). Pure: the page runs this source. */
export function castOf(S, card) {
  const sun = Math.min(1, Math.max(0, (S.sky - 0.45) / 0.4)), murk = 1 - 0.8 * Math.min(1, Math.max(0, (S.fog - 0.6) / 5));
  return card.cast * sun * murk;
}
