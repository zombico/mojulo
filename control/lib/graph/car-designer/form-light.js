/**
 * THE FORM RENDER'S LIGHT for a vehicle (era/eras.js gen-7: a surface carries its material and its form, and the
 * renderer lights it). A figure drawn in the form render (vehicle-rig.js packFormMesh) carries this as its `form`, and
 * the page's controllable channel lights it so: physical materials by slot, the key's colour and strength over the
 * world's shadow lights, a hemisphere of the sky over the ground, and an environment of that sky for its reflections.
 *
 *   formLight(mood, materials, { ground? }) → { materials, key, keyIntensity, ambient, sky: { zenith, horizon, ground },
 *                                  toLight?, exposure }   (ground: the colour the hemisphere bounces up, [r, g, b])
 *   skyMood(sky)  → a world's own sky (its zenith, horizon, day and sun) read as a mood's light, for formLight
 *     mood       a race mood (roads/race-mood.js moodOf) or null (noon); its key's travel rides along when it names one
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
    key: key.map((v) => r4(v / peak)), keyIntensity: r4(2.6 * Math.min(1, peak)),
    ambient: r4(mood ? (mood.ambient[0] + mood.ambient[1] + mood.ambient[2]) / 3 : 0.55),
    sky: { ...(mood?.sky ? { zenith: mood.sky.zenith, horizon: mood.sky.horizon } : NOON_SKY), ground: ground ?? GROUND },
    ...(mood?.toLight ? { toLight: mood.toLight.map(r4) } : {}),
    exposure: 1,
  };
}

/** A world's own sky read as the light a body in it stands in (a mood's shape, for formLight): the key warm white by
 *  day, toward the horizon's colour as the sun sinks, a dim moonlight by night (the zenith's cool) at an eighth of the
 *  day's; the ambient the sky's share of it; its sky the world's; its travel the world's sun when it is up. */
export function skyMood(sky) {
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
