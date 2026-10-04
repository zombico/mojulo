// Wet sand that follows the swash. A beach's swash edge is periodic — e(t) = E − R·(0.5 − 0.5·sin ωt) (surface.js) —
// so "how long since the water last covered this row" is closed-form: no state, the same answer at any t, in a builder,
// on the page, or in a frozen export. From that one number:
//   film  the thin sheet of water the backwash leaves: a mirror that drains in a second or two (sky + sun glint)
//   dark  the sand's own wetness: darkens at once and dries over tens of seconds, so the whole swash zone stays dark
//         and a capillary band above the highest reach stays damp, fading up the beach.
// WS_GLSL is the shader twin. It is written in the subset of GLSL that is also JavaScript once `float ` becomes `let `,
// so the test runs the very text the GPU compiles against wsDryTime() below.

export const WS_FILM = 1.6;     // s: the water film drains
export const WS_DRAIN = 40;     // s: the sand itself dries
export const WS_CAP = 0.55;     // dampness at the swash's top, decaying up the beach over half the swash range
export const WS_DARK = 0.4;     // full wetness darkens sand to 60 %
export const WS_FOAM = 5;       // s: foam stranded by the uprush drains and pops

const TAU = Math.PI * 2;
const mod = (x, y) => x - y * Math.floor(x / y);

/** Seconds since the swash last covered row y at time t (0 while covered, 1e4 where it never reaches). */
export function wsDryTime(shore, y, t) {
  const a = 1 - (2 * (shore.edgeY - y)) / shore.swashRange;
  if (a <= -1) return 0;
  if (a >= 1) return 1e4;
  const ph = shore.omSwash * t;
  if (Math.sin(ph) > a) return 0;
  return mod(ph - (Math.PI - Math.asin(a)), TAU) / shore.omSwash;
}

/** Seconds since the uprush last reached row y at time t (1e4 where it never does, or where the sea never leaves).
 *  The stranded foam ages by this: fresh where the front has just passed, thinning to nothing over a few seconds. */
export function wsWetAge(shore, y, t) {
  const a = 1 - (2 * (shore.edgeY - y)) / shore.swashRange;
  if (a <= -1 || a >= 1) return 1e4;
  return mod(shore.omSwash * t - Math.asin(a), TAU) / shore.omSwash;
}

/** { film, dark } in 0..1 for row y at time t. */
export function shoreMoisture(shore, y, t) {
  const dt = wsDryTime(shore, y, t);
  const cap = y > shore.edgeY ? WS_CAP * Math.exp(-(y - shore.edgeY) / (shore.swashRange * 0.5)) : WS_CAP;
  return { film: Math.exp(-dt / WS_FILM), dark: Math.max(Math.exp(-dt / WS_DRAIN), cap) };
}

// uniforms: uWsEdge, uWsRange, uWsOm, uWsTime (s)
export const WS_GLSL = `
float wsMod(float x, float y) { return x - y * floor(x / y); }
float wsDryTime(float y, float t) {
  float a = 1.0 - (2.0 * (uWsEdge - y)) / uWsRange;
  if (a <= -1.0) { return 0.0; }
  if (a >= 1.0) { return 1e4; }
  float ph = uWsOm * t;
  if (sin(ph) > a) { return 0.0; }
  return wsMod(ph - (3.14159265 - asin(a)), 6.28318531) / uWsOm;
}
float wsWetAge(float y, float t) {
  float a = 1.0 - (2.0 * (uWsEdge - y)) / uWsRange;
  if (a <= -1.0 || a >= 1.0) { return 1e4; }
  return wsMod(uWsOm * t - asin(a), 6.28318531) / uWsOm;
}
`;
