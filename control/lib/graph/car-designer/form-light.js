/**
 * THE FORM RENDER'S LIGHT for a vehicle (era/eras.js gen-7: a surface carries its material and its form, and the
 * renderer lights it). A figure drawn in the form render (vehicle-rig.js packFormMesh) carries this as its `form`, and
 * the page's controllable channel lights it so: physical materials by slot, the key's colour and strength over the
 * world's shadow lights, a hemisphere of the sky over the ground, and an environment of that sky for its reflections.
 *
 *   formLight(mood, materials) → { materials, key, keyIntensity, ambient, sky: { zenith, horizon, ground }, toLight?,
 *                                  exposure }
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
export function formLight(mood, materials) {
  const key = mood ? mood.key : [1, 0.97, 0.92], peak = Math.max(...key, 1e-3);
  return {
    materials,
    key: key.map((v) => r4(v / peak)), keyIntensity: r4(2.6 * Math.min(1, peak)),
    ambient: r4(mood ? (mood.ambient[0] + mood.ambient[1] + mood.ambient[2]) / 3 : 0.55),
    sky: { ...(mood?.sky ? { zenith: mood.sky.zenith, horizon: mood.sky.horizon } : NOON_SKY), ground: GROUND },
    ...(mood ? { toLight: mood.toLight.map(r4) } : {}),
    exposure: 1,
  };
}
