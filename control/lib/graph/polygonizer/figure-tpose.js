/**
 * figure-tpose — the vajra armature in the VRM T-POSE (docs/emote-bridge.md §3.6): the same 17 landmarks, the same bone
 * lengths, the arms straight out along the figure's lateral axis (left = −x) and the legs straight down. The posing API
 * cannot reach it — the elbow only folds forward, so the forearm's carrying angle stays — so the landmarks are placed
 * directly. A REST map: pass it as the rest armature (`articulate(dof, base)`, buildPosedFigure's `rest`) and the
 * procedural flesh is built on it, so the flat figure's T rest is rebuilt rather than skinned there (a rigid-part body
 * tears at the shoulder when skinned 80°). The trunk, head and the hips stay where the base has them.
 */
import { basePositions } from './figure-vajra.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The T-pose of a rest map (a cast's armature, or the canonical one when omitted). Returns a new map. */
export function tposeArmature(base = null) {
  const m = Object.fromEntries(Object.entries(base || basePositions()).map(([k, v]) => [k, { x: v.x, y: v.y, z: v.z }]));
  for (const [S, side] of [['L', -1], ['R', 1]]) {
    const upper = dist(m[`elbow${S}`], m[`shoulder${S}`]), fore = dist(m[`wrist${S}`], m[`elbow${S}`]);
    const thigh = dist(m[`knee${S}`], m[`hip${S}`]), shank = dist(m[`ankle${S}`], m[`knee${S}`]);
    const sh = m[`shoulder${S}`], hip = m[`hip${S}`];
    m[`elbow${S}`] = { x: sh.x + side * upper, y: sh.y, z: sh.z };
    m[`wrist${S}`] = { x: sh.x + side * (upper + fore), y: sh.y, z: sh.z };
    m[`knee${S}`] = { x: hip.x, y: hip.y, z: hip.z - thigh };
    m[`ankle${S}`] = { x: hip.x, y: hip.y, z: hip.z - thigh - shank };
  }
  return m;
}
