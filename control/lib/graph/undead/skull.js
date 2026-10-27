/**
 * THE SKULL AS BONES: a skeleton's skull built from the body's own parts, as its ribs and pelvis are, so the jaw is a
 * bone of its own. A head card's rows are sections taken front to back, and cannot raise a mandible's ramus to its
 * hinge; these parts can:
 *
 *   braincase   a domed trunk from the skull's base to its crown, widest at the temples
 *   face        the front below the forehead: the brow ridge, the orbits, the cheeks, the upper jaw above the teeth
 *   arches      the cheekbones: a bar each side from the cheek back to just before the ear, the jaw passing up under it
 *   sockets     dark openings in the face: the orbits and the nasal cavity (the holes read by their dark, not cut)
 *   teeth       a row of upper teeth in an arc under the face (riding the head), a row of lower ones on the mandible
 *   mandible    each half from its condyle under the arch, down the ramus to the angle, forward along the body to the
 *               chin, where the halves meet; it and its teeth ride the rig's JAW bone, hinged at the condyles, so the
 *               jaw opens away from the skull
 *
 *   skullFrame(N, { k, s })   → { joints, segments, rig: { headTop, jawHinge, jawTip }, headParts, jawParts, groups }
 *                       (`headTop` the face's front: the rig's head bone points the way the skull looks)
 *                       N the neck's top (the skull's base sits on it), k the body's scale, s the skull's own
 *
 * Coordinates are template metres at 2 m tall (× k × s), from the skull's base, the skull upright on the neck. Pure.
 */
const r3 = (x) => Math.round(x * 1000) / 1000;

// the teeth along an arc: `n` a side from the front, their crowns toward `crown` z, their roots at `root` z
const arc = (n, rx, ry, y0, step) => Array.from({ length: n }, (_, i) => { const t = (i + 0.5) * step; return [rx * Math.sin(t), y0 + ry * Math.cos(t)]; });

export function skullFrame(N, { k, s = 1 }) {
  const m = k * s, P = ([x, y, z]) => [r3(N[0] + x * m), r3(N[1] + y * m), r3(N[2] + z * m)], R = (r) => r3(r * m), Z = (z) => r3(N[2] + z * m);
  const B = { bone: 'head' }, Jb = { bone: 'jaw' };
  const joints = {}, segments = [], headParts = [], jawParts = [];
  const add = (seg, jaw = false) => { segments.push(seg); const names = seg.mirror === 'name' ? [seg.name, seg.name.replace(/R$/, 'L')] : [seg.name]; (jaw ? jawParts : headParts).push(...names); };
  const trunk = (name, rows, caps, group) => add({ name, kind: 'trunk', stations: rows.map(([z, rx, ry, yc]) => ({ z: Z(z), r: [R(rx), R(ry)], yc: r3(N[1] + yc * m) })), caps: { back: P(caps[0]), tip: P(caps[1]) }, group, tint: '#cccccc', mirror: 'plane', bind: B });
  const loft = (name, pts, r, group, jaw = false) => add({ name, kind: 'loft', stations: pts.map((p, i) => ({ at: P(p), r: R(Array.isArray(r) ? r[i] : r) })), group, tint: '#cccccc', mirror: 'name', bind: jaw ? Jb : B }, jaw);
  const bar = (name, a, b, r, group, mirror, jaw = false, slots) => { joints[`${name}a`] = P(a); joints[`${name}b`] = P(b); add({ name, kind: 'segment', from: `${name}a`, to: `${name}b`, rA: R(r[0]), rB: R(r[1]), over: [0.3, 0.3], ...(slots ? { slots } : {}), group, tint: '#cccccc', mirror, bind: jaw ? Jb : B }, jaw); };

  // the braincase: [z, half width, half length, centre forward] up from the base
  trunk('braincase', [[0.0, 0.048, 0.055, -0.03], [0.035, 0.07, 0.09, -0.008], [0.075, 0.078, 0.1, 0], [0.11, 0.076, 0.096, -0.004], [0.14, 0.064, 0.082, -0.008], [0.162, 0.04, 0.054, -0.01]],
    [[0, -0.03, -0.01], [0, -0.01, 0.176]], 'Skull');
  // the face: the brow ridge, the orbits, the cheeks, the upper jaw
  trunk('face', [[-0.005, 0.036, 0.026, 0.085], [0.015, 0.046, 0.03, 0.088], [0.045, 0.06, 0.03, 0.09], [0.075, 0.068, 0.026, 0.088], [0.105, 0.068, 0.024, 0.083]],
    [[0, 0.085, -0.014], [0, 0.08, 0.117]], 'Skull');
  // the cheekbones, from the cheek back to before the ear, falling a little (a loft's ring needs its run to rise or fall)
  loft('zygomaR', [[0.048, 0.096, 0.05], [0.064, 0.062, 0.047], [0.069, 0.022, 0.043], [0.064, -0.006, 0.04]], [0.011, 0.009, 0.008, 0.009], 'Skull');
  // the openings: the orbits and the nose (dark, standing just proud of the face so they read as holes)
  // (round: a ring of twelve, not the limb's six)
  bar('socketR', [0.031, 0.104, 0.076], [0.031, 0.119, 0.074], [0.021, 0.02], 'Socket', 'name', false, 'ring12');
  bar('nasal', [0, 0.108, 0.043], [0, 0.123, 0.04], [0.012, 0.01], 'Socket', 'plane', false, 'ring12');
  // the upper teeth, riding the head
  arc(4, 0.03, 0.024, 0.082, 0.34).forEach(([x, y], i) => bar(`toothU${i}R`, [x, y, -0.006], [x, y + 0.002, -0.025], [0.0055, 0.005], 'Teeth', 'name'));
  // the mandible: condyle (under the arch, before the ear), the ramus down to the angle, the body forward to the chin
  loft('mandibleR', [[0.062, -0.002, 0.03], [0.061, -0.008, -0.008], [0.057, -0.004, -0.048], [0.046, 0.038, -0.06], [0.028, 0.078, -0.064], [0.0, 0.096, -0.066]], [0.01, 0.011, 0.012, 0.012, 0.013, 0.015], 'Jaw', true);
  // the lower teeth, standing on the mandible's body (a closed bite leaves them a crown's gap below the upper row)
  arc(4, 0.027, 0.021, 0.079, 0.36).forEach(([x, y], i) => bar(`toothL${i}R`, [x, y, -0.056], [x, y + 0.002, -0.031], [0.005, 0.005], 'Teeth', 'name', true));

  return {
    joints, segments, headParts, jawParts,
    // (the head bone runs from the neck to the FACE, as a head card's runs to its snout's tip: the rest aims it where
    // the head looks, so a bone to the crown would turn the skull face-down)
    rig: { headTop: P([0, 0.123, 0.045]), jawHinge: P([0, -0.002, 0.03]), jawTip: P([0, 0.096, -0.066]) },
    groups: ['Skull', 'Jaw', 'Socket', 'Teeth'],
  };
}
