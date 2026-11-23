/**
 * THE FORM RENDER'S LIGHT for a vehicle (era/eras.js gen-7: a surface carries its material and its form, and the
 * renderer lights it). A figure drawn in the form render (vehicle-rig.js packFormMesh) carries this as its `form`, and
 * the page's controllable channel lights it so: physical materials by slot, the key's colour and strength over the
 * world's shadow lights, a hemisphere of the sky over the ground, and an environment of that sky for its reflections.
 *
 *   formLight(mood, materials, { ground? }) → { materials, key, keyIntensity, ambient, sky: { zenith, horizon, ground },
 *                                  toLight?, hemi?, rim?, exposure }   (ground: the colour the hemisphere bounces up,
 *                                  [r, g, b]; hemi and rim the body's own fill and edge where the mood writes them)
 *   skyMood(sky)  → a world's own sky (its zenith, horizon, day and sun) read as a mood's light, for formLight; a
 *                   space sky (`space: true`) the star's, SPACE_MOOD
 *     mood       a race mood (roads/race-mood.js moodOf) or null (noon); its key's travel rides along when it names one,
 *                its key's level (`level`, 2.6 where absent), its ground, its fill and its rim too
 *     materials  the slots' response (vehicle-surface-finish.js VEHICLE_MATERIALS, racer-shade.js KART_MATERIALS)
 *
 * Pure.
 */
const r4 = (v) => Math.round(v * 1e4) / 1e4;
// the light the form render draws the car under: the material slots' response (vehicle-surface-finish.js), the key's
// colour and strength and the ambient (the mood's, else noon's), the sky it reflects (the mood's, else a noon sky), and
// the key's travel when the mood names one (else the world's sun on the page)
const NOON_SKY = { zenith: [96, 138, 190], horizon: [198, 207, 218] }, GROUND = [92, 90, 84];
export function formLight(mood, materials, { ground = null } = {}) {
  const key = mood ? mood.key : [1, 0.97, 0.92], peak = Math.max(...key, 1e-3);
  return {
    materials,
    key: key.map((v) => r4(v / peak)), keyIntensity: r4((mood?.level ?? 2.6) * Math.min(1, peak)),
    ambient: r4(mood ? (mood.ambient[0] + mood.ambient[1] + mood.ambient[2]) / 3 : 0.55),
    sky: { ...(mood?.sky ? { zenith: mood.sky.zenith, horizon: mood.sky.horizon } : NOON_SKY), ground: ground ?? mood?.ground ?? GROUND },
    ...(mood?.toLight ? { toLight: mood.toLight.map(r4) } : {}),
    // (a mood that writes the body's fill and rim itself, the star's: the cast rig's hemisphere and rim, linear)
    ...(mood?.hemi ? { hemi: { sky: mood.hemi.sky.map(r4), ground: mood.hemi.ground.map(r4), gain: 1 } } : {}),
    ...(mood?.rim ? { rim: { linear: mood.rim.linear.map(r4), strength: mood.rim.strength, power: mood.rim.power } } : {}),
    exposure: 1,
  };
}

/**
 * THE STAR (a body in space: a world's sky `space: true`): space lit as it is, the gen-7 rig with nothing between the
 * light and the hull. One key, a G star's white (5800 K) at full strength, since no air dims or warms it; it comes from
 * where the sky draws its star (`sky.sun.dir`). No sky to fill the shade and no ground to bounce: the hemisphere is the
 * galaxy's faint glow over the dark, a cool lift that keeps the shade side dark and never black (the cast rig's value
 * law), the key side about fifteen times it. Nothing behind the hull to outline it, so the rim carries the silhouette
 * (the rig's separation law): a cool starlit edge. The sky it reflects is the void, the star in it the one hot glint.
 */
export const SPACE_MOOD = Object.freeze({
  key: [1, 0.96, 0.91], level: 3.1, ambient: [0.05, 0.05, 0.07],
  sky: Object.freeze({ zenith: [7, 9, 17], horizon: [11, 13, 24] }), ground: [3, 3, 6],
  hemi: Object.freeze({ sky: [0.026, 0.031, 0.046], ground: [0.011, 0.011, 0.015] }),
  rim: Object.freeze({ linear: [0.075, 0.095, 0.15], strength: 1, power: 3.5 }),
});

/** A world's own sky read as the light a body in it stands in (a mood's shape, for formLight): the key warm white by
 *  day, toward the horizon's colour as the sun sinks, a dim moonlight by night (the zenith's cool) at an eighth of the
 *  day's; the ambient the sky's share of it; its sky the world's; its travel the world's sun when it is up. */
export function skyMood(sky) {
  if (sky && sky.space) {
    const d = Array.isArray(sky.sun?.dir) ? sky.sun.dir : null, L = d ? Math.hypot(d[0], d[1], d[2]) : 0;
    return { ...SPACE_MOOD, ...(L > 0 ? { toLight: d.map((v) => v / L) } : {}) };
  }
  if (!sky || !Array.isArray(sky.zenith) || !Array.isArray(sky.horizon)) return null;
  const d = Number.isFinite(sky.day) ? Math.max(0, Math.min(1, sky.day)) : 1;
  const unitC = (c) => { const m = Math.max(...c, 1); return c.map((v) => v / m); };
  const day = [1, 0.97, 0.92], low = unitC(sky.horizon), night = unitC(sky.zenith).map((v) => 0.55 + 0.45 * v);
  // (the key's colour: the night's cool under the day's warm, the horizon's tint strongest in between)
  const tint = d > 0.5 ? day.map((v, k) => v + (low[k] - v) * (1 - d) * 0.6) : night.map((v, k) => v + (low[k] - v) * d * 1.2);
  const strength = 0.12 + 0.88 * Math.pow(d, 0.7);
  const amb = 0.14 + 0.4 * d, zen = unitC(sky.zenith);
  const sun = Array.isArray(sky.sun?.dir) && sky.sun.dir[2] > 0.05 ? sky.sun.dir : null;
  return { key: tint.map((v) => v * strength), ambient: zen.map((v) => amb * (0.75 + 0.25 * v)), sky: { zenith: sky.zenith, horizon: sky.horizon }, ...(sun ? { toLight: sun } : {}) };
}
