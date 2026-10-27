/**
 * THE SKULL AS BONES: a skeleton's skull built from the body's own parts, as its ribs and pelvis are, so the jaw is a
 * bone of its own. A head card's rows are sections taken front to back, and cannot raise a mandible's ramus to its
 * hinge; these parts can:
 *
 *   braincase   a long domed trunk from the skull's base to its crown, widest at the temples, its back full
 *   face        the front below the forehead: the orbits, the cheeks, the upper jaw above the teeth
 *   rims        the brow ridge over the orbits and the rim below them; the nasal bridge out between them
 *   cheekbones  the body under each orbit flowing into the arch, plates on their edge, back to just before the ear
 *   the ear     its opening, and the mastoid pointing down behind it
 *   openings    dark in the face, sunk so the rims make the profile: the orbits and the nasal cavity
 *   teeth       the upper row, incisors to molars along the arch under the face (riding the head), the lower on the mandible
 *   mandible    a plate, each half from its condyle under the arch, down the broad ramus to a sharp angle, forward along
 *               the tall body to a chin that stands out, where the halves meet; the coronoid process up in front of the condyle;
 *               it and its teeth ride the rig's JAW bone, hinged at the condyles, so the jaw opens away from the skull
 *
 *   skullFrame(N, { k, s })   → { joints, segments, rig: { headTop, jawHinge, jawTip }, headParts, jawParts, groups }
 *                       (`headTop` the face's front: the rig's head bone points the way the skull looks)
 *                       N the neck's top (the skull's base sits on it), k the body's scale, s the skull's own
 *
 * Coordinates are template metres at 2 m tall (× k × s), from the skull's base, the skull upright on the neck. Pure.
 */
const r3 = (x) => Math.round(x * 1000) / 1000;

// the teeth of one side, [x, y, radius] from the front: two incisors, the canine, two premolars, two molars; the lower
// row sits in from the upper, as a bite does
const UPPER = [[0.005, 0.112, 0.005], [0.014, 0.109, 0.0045], [0.022, 0.103, 0.005], [0.027, 0.095, 0.0055], [0.03, 0.086, 0.0055], [0.033, 0.075, 0.007], [0.035, 0.064, 0.0065]];
const LOWER = UPPER.map(([x, y, r]) => [r3(x * 0.92), r3(y - 0.004), r3(r * 0.92)]);

export function skullFrame(N, { k, s = 1 }) {
  // (a radius is a number or [across, along the ring's front]: a plate is thin across and tall)
  const m = k * s, P = ([x, y, z]) => [r3(N[0] + x * m), r3(N[1] + y * m), r3(N[2] + z * m)], R = (r) => (Array.isArray(r) ? r.map((v) => r3(v * m)) : r3(r * m)), Z = (z) => r3(N[2] + z * m);
  const B = { bone: 'head' }, Jb = { bone: 'jaw' };
  const joints = {}, segments = [], headParts = [], jawParts = [];
  const add = (seg, jaw = false) => { segments.push(seg); const names = seg.mirror === 'name' ? [seg.name, seg.name.replace(/R$/, 'L')] : [seg.name]; (jaw ? jawParts : headParts).push(...names); };
  const trunk = (name, rows, caps, group) => add({ name, kind: 'trunk', stations: rows.map(([z, rx, ry, yc]) => ({ z: Z(z), r: [R(rx), R(ry)], yc: r3(N[1] + yc * m) })), caps: { back: P(caps[0]), tip: P(caps[1]) }, group, tint: '#cccccc', mirror: 'plane', bind: B });
  const loft = (name, pts, r, group, jaw = false) => add({ name, kind: 'loft', frame: 'up', stations: pts.map((p, i) => ({ at: P(p), r: R(Array.isArray(r) && Array.isArray(r[0]) || (Array.isArray(r) && r.length === pts.length) ? r[i] : r) })), group, tint: '#cccccc', mirror: 'name', bind: jaw ? Jb : B }, jaw);
  const bar = (name, a, b, r, group, mirror, jaw = false, slots) => { joints[`${name}a`] = P(a); joints[`${name}b`] = P(b); add({ name, kind: 'segment', from: `${name}a`, to: `${name}b`, rA: R(r[0]), rB: R(r[1]), over: [0.3, 0.3], ...(slots ? { slots } : {}), group, tint: '#cccccc', mirror, bind: jaw ? Jb : B }, jaw); };

  // the braincase: [z, half width, half length, centre forward] up from the base: long, its back full behind the neck,
  // the forehead rising back from the brow
  trunk('braincase', [[0.0, 0.05, 0.062, -0.034], [0.035, 0.071, 0.098, -0.014], [0.075, 0.078, 0.106, -0.006], [0.11, 0.076, 0.1, -0.01], [0.14, 0.064, 0.084, -0.016], [0.162, 0.04, 0.056, -0.02]],
    [[0, -0.034, -0.01], [0, -0.02, 0.176]], 'Skull');
  // the face: the upper jaw (deep enough front to back to carry the molars, a little forward under the nose), the cheeks,
  // a band under the orbits, the orbits, the brow ridge standing forward over them (a band across: a mirrored loft cannot
  // run straight across the face), the forehead
  trunk('face', [[-0.008, 0.04, 0.034, 0.078], [0.012, 0.046, 0.038, 0.076], [0.035, 0.056, 0.04, 0.074], [0.055, 0.064, 0.04, 0.074], [0.078, 0.066, 0.036, 0.074], [0.097, 0.068, 0.044, 0.072], [0.112, 0.062, 0.03, 0.07]],
    [[0, 0.08, -0.018], [0, 0.07, 0.122]], 'Skull');
  // the orbit's outer rim, from the brow's end down to the cheek
  loft('orbitRimR', [[0.056, 0.098, 0.1], [0.061, 0.095, 0.088], [0.062, 0.096, 0.074], [0.059, 0.099, 0.062], [0.052, 0.104, 0.055]], [[0.007, 0.008], [0.006, 0.008], [0.006, 0.008], [0.006, 0.007], [0.006, 0.006]], 'Skull');
  // the cheekbone's body under the orbit, flowing back into the arch: plates standing on their edge, the arch to just
  // before the ear
  loft('malarR', [[0.05, 0.1, 0.054], [0.063, 0.087, 0.05], [0.068, 0.072, 0.046]], [[0.011, 0.015], [0.01, 0.014], [0.007, 0.011]], 'Skull');
  loft('zygomaR', [[0.066, 0.076, 0.047], [0.071, 0.045, 0.044], [0.072, 0.015, 0.042], [0.066, -0.006, 0.04]], [[0.005, 0.009], [0.005, 0.007], [0.005, 0.007], [0.006, 0.009]], 'Skull');
  // the nasal bridge, out from between the orbits (the profile's nose), its aperture under it
  bar('nasalBone', [0, 0.112, 0.09], [0, 0.126, 0.064], [0.009, 0.006], 'Skull', 'plane');
  // behind the ear: the ear's opening and the mastoid pointing down
  bar('earR', [0.064, -0.014, 0.036], [0.073, -0.011, 0.039], [0.008, 0.008], 'Socket', 'name', false, 'ring12');
  bar('mastoidR', [0.058, -0.026, 0.03], [0.054, -0.02, -0.004], [0.013, 0.006], 'Skull', 'name');
  // the openings, sunk into the face so they read as holes from the front and leave the rims the profile; each orbit
  // looks a little outward, as the skull's do (round: a ring of twelve, not the limb's six)
  // (the orbits a little wider than tall; the nasal opening a tall pear, narrow above)
  add({ name: 'socketR', kind: 'loft', frame: 'up', slots: 'ring12', stations: [{ at: P([0.024, 0.09, 0.077]), r: R([0.021, 0.019]) }, { at: P([0.034, 0.107, 0.076]), r: R([0.021, 0.018]) }], group: 'Socket', tint: '#cccccc', mirror: 'name', bind: B });
  add({ name: 'nasal', kind: 'loft', frame: 'up', slots: 'ring12', stations: [{ at: P([0, 0.103, 0.045]), r: R([0.011, 0.016]) }, { at: P([0, 0.117, 0.043]), r: R([0.01, 0.015]) }], group: 'Socket', tint: '#cccccc', mirror: 'plane', bind: B });
  // the upper teeth, riding the head, their crowns down
  UPPER.forEach(([x, y, r], i) => bar(`toothU${i}R`, [x, y, -0.004], [x, y + 0.001, -0.021], [r, r * 0.9], 'Teeth', 'name'));
  // the mandible, a plate (thin across, tall in its run): the condyle under the arch before the ear, the ramus broad and
  // near upright down to a sharp angle, the body forward and tall to a chin that stands out, where the halves meet
  loft('mandibleR', [[0.062, -0.006, 0.032], [0.062, -0.006, 0.018], [0.061, -0.004, -0.012], [0.058, -0.008, -0.04], [0.05, 0.024, -0.05], [0.036, 0.066, -0.053], [0.018, 0.092, -0.055], [0.0, 0.102, -0.056]],
    [[0.01, 0.006], [0.006, 0.008], [0.005, 0.016], [0.006, 0.013], [0.006, 0.016], [0.006, 0.016], [0.007, 0.017], [0.008, 0.018]], 'Jaw', true);
  // the coronoid process, up from the ramus's front to under the arch, in front of the condyle
  loft('coronoidR', [[0.059, 0.008, -0.016], [0.061, 0.017, 0.008], [0.063, 0.021, 0.03]], [[0.005, 0.01], [0.004, 0.007], [0.003, 0.004]], 'Jaw', true);
  // the lower teeth, standing on the mandible's body (a closed bite leaves them a little below the upper row)
  LOWER.forEach(([x, y, r], i) => bar(`toothL${i}R`, [x, y, -0.046], [x, y + 0.001, -0.026], [r * 0.9, r], 'Teeth', 'name', true));

  return {
    joints, segments, headParts, jawParts,
    // (the head bone runs from the neck to the FACE, as a head card's runs to its snout's tip: the rest aims it where
    // the head looks, so a bone to the crown would turn the skull face-down)
    rig: { headTop: P([0, 0.126, 0.045]), jawHinge: P([0, -0.006, 0.032]), jawTip: P([0, 0.102, -0.056]) },
    groups: ['Skull', 'Jaw', 'Socket', 'Teeth'],
  };
}
