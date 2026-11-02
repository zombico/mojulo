/**
 * THE CRAFT IN THE FORM RENDER: an archetype off the craft shelf drawn as the field's vehicles are (car-designer/
 * road-military.js): each face its part and its material slot, its albedo with no light in it, its corner normals
 * worked out, the page lighting it by the world it stands in. The shelf's own figure (craft-rig.js) bakes the studio's
 * light into its colours; this is the same craft, the same faces, handed to the page instead.
 *
 *   from the lowered build   the assembler's faces lowered under the flat light (raw albedo: polygonizer/vexar.js
 *                            FLAT_LIGHT), each kept with its item (the hull, each wing, the engine, the canopy, the
 *                            gear, the stores)
 *   its slot                 the palette role its colour is nearest (paint, trim, glass, rubber, chrome, light), the
 *                            face's metalness telling bare metal from paint; a light by its hue (a nav light red or
 *                            green, an exhaust's glow)
 *   its form                 corner normals smoothed within its item and its slot (road-form.js smoothForm, a crease):
 *                            a lofted hull reads round, a wing's trailing edge and a panel's corner stay sharp
 *
 *   AIR_MATERIALS                                   the slots an aircraft is drawn in: a semi-gloss paint and its
 *                                                   trim, bare and hot metal, a canopy's tinted glass, the rubber, the
 *                                                   nav lights and the exhaust's glow
 *   craftForm(archetype, { palette?, colors?, pose?, attitude? })
 *     → { items: [{ id, head, faces }], length, span, height, readout }   the craft centred on x and y, its lowest
 *                                                   point on z = 0 (craft-rig.js craftPieces' frame)
 *   craftFormFigure(archetype, { …craftForm's, setting?, keys? }) → the rig figure, one bone per item, in the form
 *                                                   render, lit by its world's sky (form-light.js skyMood) or noon
 *
 * Craft space: +y the nose, +z up, metres. Pure and deterministic, as the shelf is.
 */
import { assembleCraft } from './index.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';
import { resolveCraftPalette } from './craft-common.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';
import { ROAD_MATERIALS, smoothForm, bakeForm } from '../car-designer/road-form.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { formLight, skyMood } from '../car-designer/form-light.js';

export const AIR_MATERIALS = Object.freeze({
  ...ROAD_MATERIALS,
  // (an aircraft's paint: semi-gloss, no clearcoat, a broad highlight; its trim the same paint in its second colour)
  airPaint: Object.freeze({ metalness: 0.08, roughness: 0.5 }),
  airTrim: Object.freeze({ metalness: 0.08, roughness: 0.55 }),
  // (bare metal: an engine's casing, a nozzle's petals, a gear leg's oleo; worked by heat and wear)
  airMetal: Object.freeze({ metalness: 0.85, roughness: 0.38 }),
  // (a canopy's tinted glass: deep, a hard sharp highlight)
  canopy: Object.freeze({ metalness: 0.25, roughness: 0.05 }),
  // (the nav lights, port red and starboard green, and an exhaust's glow: lit by their own)
  navRed: Object.freeze({ metalness: 0, roughness: 0.3, emissive: '#ff2a1a', emissiveIntensity: 0.9 }),
  navGreen: Object.freeze({ metalness: 0, roughness: 0.3, emissive: '#2bff6a', emissiveIntensity: 0.9 }),
  glow: Object.freeze({ metalness: 0, roughness: 0.6, emissive: '#ff8a3c', emissiveIntensity: 1.0 }),
});

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// a light's slot by its hue: red a port light, green a starboard one, anything else an exhaust's glow
function lightSlot(fill) {
  const [r, g, b] = rgb(fill);
  if (g > r * 1.3 && g > b) return 'navGreen';
  if (r > g * 2 && r > b * 2) return 'navRed';
  return 'glow';
}

/** A lowered face's slot: its palette role where its colour is one (paint, trim, glass, rubber, chrome, light), else
 *  its material's signature (a light is rough 1 and lit, glass smooth, bare metal metallic, rubber dark and rough),
 *  else the nearer of the paint and its trim. */
function slotOf(fill, pbr, P) {
  const c = rgb(fill), metal = (pbr?.[0] ?? 0) >= 0.5, rough = pbr?.[1] ?? 0.7;
  const role = Object.keys(P).find((k) => String(P[k]).toLowerCase() === String(fill).toLowerCase());
  const of = { paint: 'airPaint', trim: metal ? 'airMetal' : 'airTrim', chrome: 'airMetal', glass: 'canopy', rubber: 'rubber' };
  if (role === 'light') return lightSlot(fill);
  if (role) return of[role];
  if (!metal && rough >= 0.99) return lightSlot(fill);
  if (!metal && rough <= 0.3) return 'canopy';
  if (metal) return 'airMetal';
  if (rough >= 0.88 && (c[0] + c[1] + c[2]) / 3 < 48) return 'rubber';
  return dist(c, rgb(P.paint)) <= dist(c, rgb(P.trim)) ? 'airPaint' : 'airTrim';
}

/** The craft's faces in the form render, by item (see the head of this file). */
export function craftForm(archetype, { palette, colors, pose = { gear: 1 }, attitude = 'level' } = {}) {
  const row = CRAFT_ARCHETYPES[archetype];
  if (!row) throw new Error(`craft-form: no archetype '${archetype}' on the shelf`);
  const { manifest, readout } = assembleCraft(archetype, { palette, colors, pose, attitude, finish: true });
  const P = resolveCraftPalette(palette ?? row.palette, colors).colors;
  const { faces, placements } = lowerAssemblerBuild(manifest, { light: FLAT_LIGHT });
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, z0 = mn[2];
  const N = (c) => [r4(c[0] - cx), r4(c[1] - cy), r4(c[2] - z0)];
  const items = [];
  placements.forEach((p, i) => {
    const id = p.id || `item${i}`;
    const own = faces.slice(p.faceStart, p.faceStart + p.faceCount).map((f) => ({
      corners: f.corners.map(N), part: id, material: slotOf(f.fill, f.pbr, P), albedo: String(f.fill).toLowerCase(), outNormal: f.outNormal,
    }));
    if (!own.length) return;
    const fs = smoothForm(own, { crease: 35 });
    if (!fs.length) return;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of fs) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
    items.push({ id, head: lo.map((v, k) => r4((v + hi[k]) / 2)), faces: fs });
  });
  return { items, length: r4(mx[1] - mn[1]), span: r4(mx[0] - mn[0]), height: r4(mx[2] - mn[2]), readout };
}

/** The craft as a rig figure in the form render: one bone per item, still (a craft's parts turn by their own clips
 *  when a game moves them), lit by its world's sky when it stands in one, else noon. */
export function craftFormFigure(archetype, { setting = null, keys = 2, ...opts } = {}) {
  const { items, length, span, height } = craftForm(archetype, opts);
  const bones = items.map((it) => ({ id: it.id, head: it.head }));
  const formOf = new Map(items.map((it) => [it.id, it.faces]));
  const baked = new Map(items.map((it) => [it.id, bakeForm(it.faces)]));
  const fig = packVehicleFigure(bones, baked, { keys, rolls: [], form: formOf });
  return {
    ...fig,
    clips: { idle: fig.clips.roll },
    form: formLight(skyMood(setting?.sky), AIR_MATERIALS, {}),
    figH: r4(height), length, span, height,
  };
}
