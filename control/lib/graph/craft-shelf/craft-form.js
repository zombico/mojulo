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
 *   craftForm(archetype, { palette?, colors?, pose?, attitude?, made? })   made: its skin's panel lines, access panels
 *                                                   and fasteners (air-kit.js)
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
import { CRAFT_ODM } from './craft-odm.js';
import { PANEL_KINDS, itemFrame, skinPanels, fastenersOn } from './air-kit.js';

export const AIR_MATERIALS = Object.freeze({
  ...ROAD_MATERIALS,
  // (an aircraft's paint: a low sheen, no clearcoat, a broad soft highlight; its trim the same paint in its second colour)
  airPaint: Object.freeze({ metalness: 0.04, roughness: 0.68 }),
  airTrim: Object.freeze({ metalness: 0.04, roughness: 0.72 }),
  // (bare metal: an engine's casing, a nozzle's petals, a gear leg's oleo; worked by heat and wear)
  airMetal: Object.freeze({ metalness: 0.85, roughness: 0.38 }),
  // (a canopy's tinted glass: seen into, a hard sharp highlight on it)
  canopy: Object.freeze({ metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.42, depthWrite: false }),
  // (the nav lights, port red and starboard green, and an exhaust's glow: lit by their own)
  navRed: Object.freeze({ metalness: 0, roughness: 0.3, emissive: '#ff2a1a', emissiveIntensity: 0.9 }),
  navGreen: Object.freeze({ metalness: 0, roughness: 0.3, emissive: '#2bff6a', emissiveIntensity: 0.9 }),
  glow: Object.freeze({ metalness: 0, roughness: 0.6, emissive: '#ff8a3c', emissiveIntensity: 1.0 }),
});

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const CANOPY_GOLD = '#6f6a52';
/** A polygon's corners in the order that turns anticlockwise about `n` (reversed where they turn the other way). */
export function woundTo(c, n) {
  const w = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; w[0] += (a[1] - b[1]) * (a[2] + b[2]); w[1] += (a[2] - b[2]) * (a[0] + b[0]); w[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return w[0] * n[0] + w[1] * n[1] + w[2] * n[2] < 0 ? c.slice().reverse() : c;
}
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

// a fuselage's access panels: an avionics bay each side behind the cockpit, a gun bay low on the left, an equipment bay
// on the spine (y along, radians round from +x); as fractions of its length from the nose
function accessOf(F) {
  const L = F.y1 - F.y0, at = (f) => F.y1 - f * L;
  return [
    { y: [at(0.34), at(0.27)], a: [-0.25, 0.3] }, { y: [at(0.34), at(0.27)], a: [Math.PI - 0.3, Math.PI + 0.25] },
    { y: [at(0.24), at(0.18)], a: [Math.PI + 0.35, Math.PI + 0.85] },
    { y: [at(0.58), at(0.5)], a: [Math.PI / 2 - 0.28, Math.PI / 2 + 0.28] },
  ];
}

/** The craft's faces in the form render, by item (see the head of this file). */
export function craftForm(archetype, { palette, colors, pose = { gear: 1 }, attitude = 'level', made = false } = {}) {
  const row = CRAFT_ARCHETYPES[archetype];
  if (!row) throw new Error(`craft-form: no archetype '${archetype}' on the shelf`);
  const { manifest, readout } = assembleCraft(archetype, { palette, colors, pose, attitude, finish: true, ...(made ? { made } : {}) });
  const P = resolveCraftPalette(palette ?? row.palette, colors).colors;
  const { faces, placements } = lowerAssemblerBuild(manifest, { light: FLAT_LIGHT });
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, z0 = mn[2];
  const N = (c) => [r4(c[0] - cx), r4(c[1] - cy), r4(c[2] - z0)];
  // (each item's part number: its layout row's, a pair's two sides the one part)
  const skuOf = new Map(row.layout.flatMap((e) => (e.pair ? [[`${e.id}-r`, e.sku], [`${e.id}-l`, e.sku]] : [[e.id, e.sku]])));
  const items = [];
  placements.forEach((p, i) => {
    const id = p.id || `item${i}`;
    // (each face wound to agree with its normal: the page draws both sides and turns a face's normal round when it is
    // seen from its back, so a face wound against its normal, as a mirrored part's are, would shade as its underside)
    const own = faces.slice(p.faceStart, p.faceStart + p.faceCount).map((f) => {
      const c = f.corners.map(N);
      const material = slotOf(f.fill, f.pbr, P);
      // (made: a canopy's own glass the smoky gold of its coating, not the palette's tint)
      const albedo = made && id === 'canopy' && material === 'canopy' ? CANOPY_GOLD : String(f.fill).toLowerCase();
      return { corners: woundTo(c, f.outNormal), part: id, material, albedo, outNormal: f.outNormal, ...(f.group ? { fitting: f.group } : {}) };
    });
    if (!own.length) return;
    let fs = smoothForm(own, { crease: 35 });
    if (!fs.length) return;
    // (made: its skin's panel lines cut in, its access panels' fasteners set on it: air-kit.js)
    if (made) {
      // (on its skin only: a fitting, the made pieces on it, is passed by)
      const skin = fs.filter((f) => !f.fitting), kind = CRAFT_ODM[skuOf.get(id)]?.kind, F = itemFrame(skin, PANEL_KINDS[kind]);
      const access = kind === 'craft-fuselage' && F ? accessOf(F) : [];
      fs = [...skinPanels(skin, F, { access }), ...fastenersOn(skin, F, access), ...fs.filter((f) => f.fitting)];
    }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of fs) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
    items.push({ id, head: lo.map((v, k) => r4((v + hi[k]) / 2)), faces: fs });
  });
  return { items, length: r4(mx[1] - mn[1]), span: r4(mx[0] - mn[0]), height: r4(mx[2] - mn[2]), readout };
}

/** The craft as a rig figure in the form render: one bone per item, still (a craft's parts turn by their own clips
 *  when a game moves them), lit by its world's sky when it stands in one, else noon. */
export function craftFormFigure(archetype, { setting = null, keys = 2, ...opts } = {}) {
  // (a craft is big: its own shadow's steps on its curved skin want a deeper bias than a car's)
  const { items, length, span, height } = craftForm(archetype, opts);
  const bones = items.map((it) => ({ id: it.id, head: it.head }));
  const formOf = new Map(items.map((it) => [it.id, it.faces]));
  const baked = new Map(items.map((it) => [it.id, bakeForm(it.faces)]));
  const fig = packVehicleFigure(bones, baked, { keys, rolls: [], form: formOf });
  return {
    ...fig,
    clips: { idle: fig.clips.roll },
    form: { ...formLight(skyMood(setting?.sky), AIR_MATERIALS, {}), normalBias: 0.14 },
    figH: r4(height), length, span, height,
  };
}
