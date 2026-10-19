/**
 * variable-suit.js — the VARIABLE SUIT: a mobile suit designed to transform, the primitive between a Transformer and
 * a Gundam. A Transformer is a vehicle that stands up; a suit like the arena's Zakus and G-frames never folds at all.
 * A variable suit is a suit first (its proportions, its armour, its walk and its fight are a suit's) whose parts are
 * drawn to be a flight form too, and show it: the kite shield on its forearm is the nose, the flight binders hanging
 * from its backpack are the wings, the fins on its hips are the tail, its legs are the engine pods with nozzles in
 * the heels, its cockpit sits in the chest. Folded, it is a waverider: face down, legs together, arms under the belly,
 * the head tucked under the nose.
 *
 *   variableSuit({ H, palette, build }) → { manifest, kit, scheme }
 *
 *   manifest  an assembler biped (facing +y, metres, feet on z = 0) the suit bake rigs and animates like any suit
 *             (worlds/unit-rig.js): station ids in the biped vocabulary, thruster stations for its jets
 *   kit       the parts that MOVE apart when it transforms, each { id, source (a workbench recipe, authored where it
 *             sits on the standing suit), bone (the bone it rides standing), flight: { bone, pivot, turns, to? } }:
 *             in the flight form it is turned by `turns` (axis, degrees, in order) about `pivot` and, given `to`,
 *             moved there, all in `flight.bone`'s rest frame, riding that bone as the body folds
 *   scheme    the transformation row it folds by (schemes.js 'variable')
 *
 * `build` dials the design (shares of the height): { shoulder, binder, shield, crest }. Pure; the same arguments
 * write the same suit.
 */

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

export const VARIABLE_PALETTES = Object.freeze({
  federal: { body: '#e6eaef', chest: '#2c50a8', accent: '#c8323a', trim: '#f0c030', frame: '#596069', glass: '#38d2c6', dark: '#262b33' },
  titans: { body: '#2a3656', chest: '#1d2230', accent: '#e08a2c', trim: '#d8dde4', frame: '#4b515b', glass: '#ff5a4a', dark: '#15181e' },
  crimson: { body: '#b3262e', chest: '#23262d', accent: '#f0c030', trim: '#e9e3d6', frame: '#4f545c', glass: '#7ff0ff', dark: '#191b20' },
});

// a box: w × d (x × y) from z0 to z1, centred on (x, y); optionally tapered to a top w1 × d1 (points profile)
function box(H, { x = 0, y = 0, z0, z1, w, d, w1 = w, d1 = d, tint, r = 0.006 }) {
  const P = (cx, cy, cz) => ({ x: r4(cx * H), y: r4(cy * H), z: r4(cz * H) });
  if (w1 === w && d1 === d) {
    return { kind: 'extrude', spec: { profile: { rect: { w: r4(w * H), h: r4(d * H), r: r4(r * H) } }, axisFrom: P(x, y, z0), axisTo: P(x, y, z1), tint } };
  }
  const ring = (a, b) => [[-a / 2, -b / 2], [a / 2, -b / 2], [a / 2, b / 2], [-a / 2, b / 2]].map(([u, v]) => [r4(u * H), r4(v * H)]);
  return { kind: 'extrude', spec: { profile: { points: ring(w, d) }, endProfile: { points: ring(w1, d1) }, axisFrom: P(x, y, z0), axisTo: P(x, y, z1), tint } };
}
// a plate standing in the x–z plane (a flat blade): its outline [[x, z] …] (shares of H), `t` thick, centred on y.
// An extrusion along +y lays its profile's u on −x (extrude-faces perpBasis), so x goes in negated.
function plate(H, { pts, y = 0, t = 0.02, tint }) {
  return { kind: 'extrude', spec: { profile: { points: pts.map(([u, v]) => [r4(-u * H), r4(v * H)]) }, axisFrom: { x: 0, y: r4((y - t / 2) * H), z: 0 }, axisTo: { x: 0, y: r4((y + t / 2) * H), z: 0 }, tint } };
}
// a plate standing in the y–z plane (faces ±x): outline [[y, z] …], `t` thick, centred on x
function sidePlate(H, { pts, x = 0, t = 0.02, tint }) {
  return { kind: 'extrude', spec: { profile: { points: pts.map(([u, v]) => [r4(u * H), r4(v * H)]) }, axisFrom: { x: r4((x - t / 2) * H), y: 0, z: 0 }, axisTo: { x: r4((x + t / 2) * H), y: 0, z: 0 }, tint } };
}
// a limb: a hexagonal lathe from a to b with radii along it
function limb(H, a, b, radii, tint, sides = 6) {
  const n = radii.length - 1;
  return {
    kind: 'lathe',
    spec: {
      axisFrom: { x: r4(a[0] * H), y: r4(a[1] * H), z: r4(a[2] * H) }, axisTo: { x: r4(b[0] * H), y: r4(b[1] * H), z: r4(b[2] * H) },
      profile: radii.map((rv, i) => ({ t: r4(i / n), radius: r4(rv * H) })), crossSections: sides, samples: 6, tint,
    },
  };
}
// a nozzle: a short flared lathe, mouth at `b`
const nozzle = (H, a, b, r, tint) => limb(H, a, b, [r * 0.55, r * 0.8, r], tint, 10);

const source = (...parts) => {
  const s = {};
  for (const p of parts) { const k = p.kind === 'lathe' ? 'lathes' : 'extrudes'; (s[k] = s[k] || []).push(p.spec); }
  return s;
};

/**
 * variableSuit({ H, palette, build }) → { manifest, kit, scheme: 'variable' }
 */
export function variableSuit({ H = 18, palette = 'federal', build = {} } = {}) {
  const C = typeof palette === 'object' ? { ...VARIABLE_PALETTES.federal, ...palette } : (VARIABLE_PALETTES[palette] || VARIABLE_PALETTES.federal);
  const sh = build.shoulder ?? 0.2, bl = build.binder ?? 0.44, sl = build.shield ?? 0.3, cr = build.crest ?? 0.07;
  const item = (id, ...parts) => ({ id, source: source(...parts), at: [0, 0, 0] });
  const items = [];
  const kit = [];
  for (const s of [-1, 1]) {
    const x = s, tag = s < 0 ? 'l' : 'r';
    // legs: the engine pods — a frame strut inside armour that widens to the calf, a heel nozzle at the back
    items.push(
      item(`thigh_${tag}`,
        limb(H, [0.09 * x, 0, 0.49], [0.09 * x, 0, 0.3], [0.05, 0.056, 0.055, 0.05], C.frame),
        box(H, { x: 0.09 * x, y: 0.012, z0: 0.33, z1: 0.47, w: 0.085, d: 0.085, w1: 0.095, d1: 0.09, tint: C.body })),
      item(`shin_guard_${tag}`,
        limb(H, [0.09 * x, 0, 0.3], [0.09 * x, -0.005, 0.07], [0.048, 0.05, 0.05, 0.046], C.frame),
        box(H, { x: 0.09 * x, y: 0.0, z0: 0.08, z1: 0.29, w: 0.09, d: 0.11, w1: 0.11, d1: 0.13, tint: C.body }),
        box(H, { x: 0.09 * x, y: 0.068, z0: 0.24, z1: 0.31, w: 0.07, d: 0.03, tint: C.chest })),   // the knee guard
      item(`calf_vent_${tag}`, box(H, { x: 0.147 * x, y: -0.02, z0: 0.15, z1: 0.25, w: 0.012, d: 0.06, tint: C.accent })),
      item(`foot_${tag}`,
        box(H, { x: 0.09 * x, y: 0.03, z0: 0, z1: 0.055, w: 0.09, d: 0.2, w1: 0.085, d1: 0.17, tint: C.body }),
        box(H, { x: 0.09 * x, y: 0.12, z0: 0, z1: 0.035, w: 0.07, d: 0.04, tint: C.accent })),   // the toe
      item(`heel_cone_${tag}`, nozzle(H, [0.09 * x, -0.04, 0.05], [0.09 * x, -0.085, 0.045], 0.03, C.dark)),
      // arms: a broad shoulder block, a frame upper arm, an armoured forearm, a fist
      item(`shoulder_${tag}`, box(H, { x: (sh + 0.012) * x, y: 0, z0: 0.71, z1: 0.81, w: 0.12, d: 0.14, w1: 0.13, d1: 0.15, tint: C.chest, r: 0.012 })),
      item(`upper_arm_${tag}`, limb(H, [sh * x, 0, 0.75], [sh * x, 0, 0.63], [0.034, 0.036, 0.036, 0.034], C.frame)),
      item(`forearm_${tag}`, box(H, { x: sh * x, y: 0.005, z0: 0.48, z1: 0.62, w: 0.07, d: 0.075, w1: 0.085, d1: 0.09, tint: C.body })),
      item(`hand_${tag}`, box(H, { x: sh * x, y: 0.01, z0: 0.415, z1: 0.475, w: 0.055, d: 0.06, tint: C.frame })),
      // the hip: a side skirt
      item(`skirt_side_${tag}`, box(H, { x: 0.13 * x, y: 0, z0: 0.42, z1: 0.53, w: 0.03, d: 0.11, w1: 0.025, d1: 0.12, tint: C.body })),
    );
    // KIT: the flight binder — a long blade hanging from the backpack's shoulder, hinged at its top: it swings out
    // and back into a swept wing
    const hx = 0.085 * x, hy = -0.16, hz = 0.8;
    kit.push({
      id: `binder_${tag}`, bone: 'torso',
      source: source(plate(H, { y: hy, t: 0.022, tint: C.chest, pts: [[hx - 0.02 * x, hz], [hx + 0.05 * x, hz + 0.02], [hx + 0.065 * x, hz - bl * 0.85], [hx + 0.02 * x, hz - bl], [hx - 0.01 * x, hz - bl * 0.9]] }),
        plate(H, { y: hy - 0.012, t: 0.006, tint: C.trim, pts: [[hx + 0.012 * x, hz - 0.04], [hx + 0.04 * x, hz - 0.03], [hx + 0.05 * x, hz - bl * 0.8], [hx + 0.02 * x, hz - bl * 0.85]] })),
      // spread out and swept back: about the torso's y, out to the side
      flight: { bone: 'torso', pivot: [hx * H, hy * H, hz * H], turns: [['y', -s * 70]] },
    });
    // KIT: the hip fin — a blade on the side skirt that flips up into the tail
    kit.push({
      id: `hip_fin_${tag}`, bone: 'pelvis',
      source: source(sidePlate(H, { x: 0.152 * x, t: 0.012, tint: C.accent, pts: [[-0.05, 0.52], [0.02, 0.52], [-0.02, 0.4], [-0.07, 0.37]] })),
      flight: { bone: 'pelvis', pivot: [0.152 * x * H, -0.02 * H, 0.52 * H], turns: [['x', -95]] },
    });
  }
  // the trunk: pelvis (a front skirt with the colour's stripe), waist, the chest with its cockpit and vents, a backpack
  // with two nozzles, the neck
  items.push(
    item('pelvis', box(H, { z0: 0.47, z1: 0.555, w: 0.2, d: 0.13, w1: 0.21, d1: 0.13, tint: C.body })),
    item('skirt_front', box(H, { y: 0.07, z0: 0.41, z1: 0.52, w: 0.11, d: 0.02, w1: 0.13, d1: 0.025, tint: C.accent })),
    item('skirt_rear', box(H, { y: -0.075, z0: 0.43, z1: 0.53, w: 0.15, d: 0.02, tint: C.body })),
    item('waist', box(H, { z0: 0.55, z1: 0.61, w: 0.14, d: 0.1, tint: C.frame })),
    item('chest', box(H, { z0: 0.6, z1: 0.79, w: 0.24, d: 0.16, w1: 0.31, d1: 0.18, tint: C.chest, r: 0.012 })),
    item('chest_cockpit', box(H, { y: 0.085, z0: 0.64, z1: 0.72, w: 0.07, d: 0.02, tint: C.glass })),
    item('chest_vent_l', box(H, { x: -0.07, y: 0.088, z0: 0.73, z1: 0.775, w: 0.06, d: 0.02, tint: C.trim })),
    item('chest_vent_r', box(H, { x: 0.07, y: 0.088, z0: 0.73, z1: 0.775, w: 0.06, d: 0.02, tint: C.trim })),
    item('back_pack', box(H, { y: -0.125, z0: 0.63, z1: 0.79, w: 0.16, d: 0.08, tint: C.body })),
    item('back_thruster', nozzle(H, [-0.04, -0.15, 0.645], [-0.04, -0.17, 0.6], 0.028, C.dark), nozzle(H, [0.04, -0.15, 0.645], [0.04, -0.17, 0.6], 0.028, C.dark)),
    item('neck', limb(H, [0, 0, 0.79], [0, 0, 0.83], [0.03, 0.03, 0.03], C.frame)),
    // the head: a helmet, a visor, a face mask, the crest (a V)
    item('head', box(H, { z0: 0.825, z1: 0.92, w: 0.075, d: 0.085, w1: 0.07, d1: 0.08, tint: C.body, r: 0.01 }),
      box(H, { y: 0.043, z0: 0.865, z1: 0.885, w: 0.06, d: 0.006, tint: C.glass }),
      box(H, { y: 0.04, z0: 0.83, z1: 0.86, w: 0.035, d: 0.012, tint: C.accent }),
      plate(H, { y: 0.04, t: 0.006, tint: C.trim, pts: [[0, 0.89], [-cr, 0.89 + cr * 0.9], [-cr * 0.85, 0.89 + cr], [0, 0.9]] }),
      plate(H, { y: 0.04, t: 0.006, tint: C.trim, pts: [[0, 0.89], [cr, 0.89 + cr * 0.9], [cr * 0.85, 0.89 + cr], [0, 0.9]] })),
  );
  // KIT: the shield — a kite on the left forearm's outer face; folded, the waverider's nose: above the head, its point
  // ahead, its face down
  const sx = -(sh + 0.06);
  kit.push({
    id: 'shield', bone: 'forearmL',
    source: source(sidePlate(H, { x: sx, t: 0.024, tint: C.body, pts: [[-0.065, 0.62], [0.065, 0.62], [0.05, 0.62 - sl * 0.7], [0, 0.62 - sl], [-0.05, 0.62 - sl * 0.7]] }),
      sidePlate(H, { x: sx - 0.013, t: 0.006, tint: C.accent, pts: [[-0.03, 0.6], [0.03, 0.6], [0.02, 0.6 - sl * 0.6], [0, 0.6 - sl * 0.8], [-0.02, 0.6 - sl * 0.6]] })),
    // its face turned down (−x → +y), its point turned ahead (down → up the body: forward when it lies flat)
    flight: { bone: 'torso', pivot: [sx * H, 0, (0.62 - sl / 2) * H], turns: [['z', -90], ['y', 180]], to: [0, -0.01 * H, (0.86 + sl / 2) * H] },
  });
  return {
    manifest: { kind: 'assembler', title: `variable suit (${typeof palette === 'string' ? palette : 'custom'})`, facing: '+y', units: 'm', items },
    kit,
    scheme: 'variable',
  };
}
