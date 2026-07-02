/**
 * figure-animal-ground — plant the animal on the floor + keep it stable, the way
 * figure-balance.js grounds the humanoid.
 *
 * Two constraints, the animal analogue of groundBalance/groundVault:
 *   1. PLANT — translate the assembled figure so its lowest contact sits on z = 0
 *      (the feet touch the floor; nothing floats or sinks).
 *   2. BALANCE — keep the centre of mass over the BASE OF SUPPORT. Quadrupeds are
 *      stable on four feet by construction; a BIPED (two grounded feet — theropod,
 *      raptor, bird) must stand like a humanoid, so its feet slide under the COM
 *      (the long tail pulls the COM back toward the hips — the counterweight doing
 *      its job, so the feet barely move once a tail is present).
 *
 * Pure: COM + foot placement run on the armature BEFORE the flesh/skull/feet are
 * built (so legs and feet follow); the plant runs on the assembled parts.
 */

// ── Centre of mass (xy) — segment midpoints × rough mass fractions, + the chains.
const SEG_MASS = [
  ['pelvisHub', 'neckHub', 0.5], ['neckHub', 'headTop', 0.06],
  ['hipL', 'kneeL', 0.06], ['hipR', 'kneeR', 0.06], ['kneeL', 'ankleL', 0.03], ['kneeR', 'ankleR', 0.03],
  ['shoulderL', 'elbowL', 0.03], ['shoulderR', 'elbowR', 0.03], ['elbowL', 'wristL', 0.02], ['elbowR', 'wristR', 0.02],
];
export function animalCOM(nodes, chains = []) {
  let x = 0, y = 0, M = 0;
  for (const [a, b, m] of SEG_MASS) {
    if (!nodes[a] || !nodes[b]) continue;
    x += (nodes[a].x + nodes[b].x) / 2 * m; y += (nodes[a].y + nodes[b].y) / 2 * m; M += m;
  }
  for (const ch of chains) {
    if (!ch || !ch.centers || !ch.centers.length) continue;
    let cx = 0, cy = 0; for (const c of ch.centers) { cx += c.x; cy += c.y; }
    const n = ch.centers.length, m = 0.09;                       // a chain (tail / neck) as a lumped counterweight
    x += (cx / n) * m; y += (cy / n) * m; M += m;
  }
  return { x: x / M, y: y / M };
}

/**
 * Slide a BIPED's grounded feet under the COM so it stands stably (no-op for a
 * quadruped's four-foot base). Moves each support foot fully and its knee partway,
 * so the legs angle to plant beneath the body — the humanoid stance.
 * @returns {object} adjusted node copy
 */
export function balanceFeet(nodes, feetKeys, com) {
  const p = {}; for (const k in nodes) p[k] = { ...nodes[k] };
  if (feetKeys.length !== 2) return p;                           // quadruped: inherently stable
  let fx = 0, fy = 0; for (const k of feetKeys) { fx += p[k].x; fy += p[k].y; }
  fx /= feetKeys.length; fy /= feetKeys.length;
  const dx = com.x - fx, dy = com.y - fy;                        // shift the support centroid under the COM
  const kneeOf = { ankleL: 'kneeL', ankleR: 'kneeR', wristL: 'elbowL', wristR: 'elbowR' };
  for (const k of feetKeys) {
    p[k].x += dx; p[k].y += dy;                                  // foot under the COM
    const knee = kneeOf[k];
    if (p[knee]) { p[knee].x += dx * 0.5; p[knee].y += dy * 0.5; }   // leg angles to it
  }
  return p;
}

// ── Plant: translate STAND-space render parts so the lowest point sits on z = 0.
export function plantParts(parts) {
  let minZ = Infinity;
  for (const pt of parts) for (const poly of pt.polylines) for (const q of poly) if (q.z < minZ) minZ = q.z;
  if (!Number.isFinite(minZ) || Math.abs(minZ) < 1e-9) return parts;
  return parts.map((pt) => ({ ...pt, polylines: pt.polylines.map((poly) => poly.map((q) => ({ x: q.x, y: q.y, z: q.z - minZ }))) }));
}

// ── Where the skull sits + muzzle direction: the neck-chain tip, else the head bone.
export function headFrameFrom(nodes, neckGeom) {
  if (neckGeom && neckGeom.centers && neckGeom.centers.length >= 2) {
    const cs = neckGeom.centers, tip = cs[cs.length - 1], prev = cs[cs.length - 2];
    return { anchor: tip, dir: { x: tip.x - prev.x, y: tip.y - prev.y, z: tip.z - prev.z } };
  }
  const h = nodes.headBase, t = nodes.headTop;
  return { anchor: h, dir: { x: t.x - h.x, y: t.y - h.y, z: t.z - h.z } };
}
