/**
 * Harvest — cut a keyed bank render into parts along DECLARED joint geometry
 * (animation-cheats.plan.md, principle 1's harvest inversion). Parts are
 * never generated in isolation; they are cut from a full-figure render that
 * conformed to the rig skeleton, so mojulo knows where every limb is.
 *
 * v0 labeling: capsule distance. Each limb part claims the opaque pixels
 * within a radius of its joint segment(s); everything unclaimed is torso.
 * Lateral view: the far arm/leg are mostly occluded, so only NEAR limbs are
 * harvested — assembly re-creates far limbs as darkened duplicates (the
 * cut-out puppet convention). This character's coat/skirt keep the thighs
 * in the torso part: only the whole arm and the lower legs move.
 *
 * All buffers are raw RGBA at canvas size. Pure pixel math, deterministic.
 */

// distance from point to segment
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy || 1e-9;
  let t = ((px - ax) * vx + (py - ay) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
  return Math.hypot(dx, dy);
}

const extend = ([ax, ay], [bx, by], k) => [bx + (bx - ax) * k, by + (by - ay) * k];

/**
 * Part definitions from MEASURED canvas-space nodes (joint calibration).
 * `side` is the NEAR side suffix ('L' | 'R'). The near arm is harvested in
 * two segments; the far arm is NOT harvested (occluded — assembly duplicates
 * the near arm); BOTH lower legs are harvested when the bank pose splits
 * them clear of each other (the walk-contact bank does).
 * Radii in canvas px, tuned for a ~1050px-tall figure on a 1216 canvas.
 */
export function partDefs(nodes, side, { armR = 46, legR = 56, footR = 88 } = {}) {
  const far = side === 'L' ? 'R' : 'L';
  const n = (k) => nodes[k];
  const wristTip = extend(n('elbow' + side), n('wrist' + side), 0.45);   // include the hand
  const legDef = (s) => {
    // the painted boot extends well past the measured ankle — extend the
    // shin segment 55% beyond it and put the foot circle at the extended tip
    const footTip = extend(n('knee' + s), n('ankle' + s), 0.55);
    return {
      id: 'lowerLeg' + s,
      chain: ['knee' + s, 'ankle' + s],
      claims: (x, y) =>
        segDist(x, y, ...n('knee' + s), ...footTip) < legR ||
        Math.hypot(x - footTip[0], y - footTip[1]) < footR,
    };
  };
  return [
    {
      id: 'upperArm',
      chain: ['shoulder' + side, 'elbow' + side],
      claims: (x, y) => segDist(x, y, ...n('shoulder' + side), ...n('elbow' + side)) < armR,
    },
    {
      id: 'forearm',
      chain: ['elbow' + side, 'wrist' + side],
      claims: (x, y) => segDist(x, y, ...n('elbow' + side), ...wristTip) < armR,
    },
    legDef(side),
    legDef(far),
  ];
}

/**
 * Label every opaque pixel of the keyed bank render. Returns
 * { parts: { [id]: { raw, bbox } }, torso: { raw, bbox } } — each `raw` a
 * full-canvas RGBA buffer holding only that part's pixels.
 */
export function harvestParts(rgba, { width: w, height: h }, defs, { alphaFloor = 28 } = {}) {
  const out = {};
  for (const d of defs) out[d.id] = { raw: Buffer.alloc(w * h * 4), bbox: null, def: d };
  const torso = { raw: Buffer.alloc(w * h * 4), bbox: null };
  const grow = (slot, x, y) => {
    const b = slot.bbox;
    slot.bbox = b
      ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }
      : { x0: x, y0: y, x1: x, y1: y };
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] <= alphaFloor) continue;
      let slot = torso;
      for (const d of defs) if (d.claims(x, y)) { slot = out[d.id]; break; }
      slot.raw[i] = rgba[i]; slot.raw[i + 1] = rgba[i + 1]; slot.raw[i + 2] = rgba[i + 2]; slot.raw[i + 3] = rgba[i + 3];
      grow(slot, x, y);
    }
  }
  return { parts: out, torso };
}
