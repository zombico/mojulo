/**
 * THE CLOCK DIAL — a level's clock (the clock mechanic's `minute` and `season` on the bus) read by the sky, as the World
 * page reads it (scene/channels/weather.js, its clocked step) and the Godot kernel does (kernel/weather.gd clock()):
 *
 *   nightAt(minute)        0 by day, 1 from 20:00 to 05:00, a two-hour smoothstep dusk (18 to 20) and dawn (5 to 7);
 *                          no minute reads as noon
 *   nightLook(S, nt)       the state darkened: its dim toward 0.78, its sky down by three quarters at full night
 *   NIGHT_SHADE            how far the night air takes the style's shade (0.75 at full night)
 *   seasonOf(vars)         the season the bus says (an integer, 0 when none)
 *
 * The page keeps these inline (its emitted text is pinned); clock-dial.test.js holds them equal to its text.
 */
const smooth = (u) => u * u * (3 - 2 * u);
export const NIGHT_SHADE = 0.75;

export function nightAt(minute) {
  const h = (Number.isFinite(minute) ? minute : 720) / 60;
  return h < 5 || h >= 20 ? 1 : h < 7 ? 1 - smooth((h - 5) / 2) : h >= 18 ? smooth((h - 18) / 2) : 0;
}

export function nightLook(S, nt) {
  return nt > 0 ? { ...S, dim: S.dim + (0.78 - S.dim) * nt, sky: S.sky * (1 - 0.75 * nt) } : S;
}

export const seasonOf = (vars) => (vars && Number.isInteger(vars.season) ? vars.season : 0);
