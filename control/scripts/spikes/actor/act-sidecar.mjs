// act-sidecar — a body take (lib/graph/actor/body.js) as the joints of a minted hero's GLB play it: each frame the rig
// posed (rigNodesAt), raised to the GLB's rest (its pelvis' height over the rig's), turned into the flat skeleton's
// frames (boneFrames: each joint's absolute rotation and head, as station-loft-rig.js packLayeredRig packs a clip and
// scene-gltf.js addRigClip writes it), named as the GLB names its joints (`body:<bone>`). hero-live's viewer plays it
// under the face take of the same name, in place of the body's idle. No correctives (the export's, phase 2b).
//
//   rigFor(spec, cacheFile) → the validated rig of a hero spec (expanded once, cached as JSON: a realistic hero's
//     expansion takes most of a minute)
//   actSidecar(take, R, { dz, fps }) → { seconds, t, joints: [{ node, r, p }] } (fps 15 by default: the viewer
//     blends between keys, and a sidecar of many takes stays a few megabytes a take)
//   dzOf(glbFile, R) → the GLB's rest height over the rig's (m)
import { createRequire, register } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const lib = (p) => import(pathToFileURL(path.join(CONTROL, 'lib', p)).href);
const { validateRig, rigNodesAt, boneFrames } = await lib('graph/polygonizer/station-loft-rig.js');
const { poseAt } = await lib('graph/actor/body.js');

export async function rigFor(spec, cacheFile) {
  if (cacheFile && existsSync(cacheFile)) { const c = JSON.parse(readFileSync(cacheFile, 'utf8')); if (JSON.stringify(c.spec) === JSON.stringify(spec)) return validateRig(c.rig); }
  const { heroRecord, expandLayeredManifest } = await lib('mcp/tools/layered.js');
  const rig = expandLayeredManifest({ kind: 'layered', title: 'actor', hero: heroRecord(spec) }).recipe.rig;
  if (cacheFile) writeFileSync(cacheFile, JSON.stringify({ spec, rig }));
  return validateRig(rig);
}

export async function dzOf(glbFile, R) {
  const { NodeIO } = createRequire(path.join(CONTROL, 'package.json'))('@gltf-transform/core');
  const doc = await new NodeIO().read(glbFile), J = doc.getRoot().listSkins()[0].listJoints().find((j) => j.getName() === 'body:pelvis');
  return J ? J.getTranslation()[2] - R.joints.pelvisHub[2] : 0;
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
export function actSidecar(take, R, { dz = 0, fps = 15 } = {}) {
  const n = Math.max(2, Math.round(take.seconds * fps) + 1), t = Array.from({ length: n }, (_, k) => r4(Math.min(take.seconds, k / fps)));
  const rest = Object.fromEntries(Object.entries(R.joints).map(([k, v]) => [k, [v[0], v[1], v[2] + dz]]));
  const joints = R.bones.map((b) => ({ node: `body:${b.id}`, r: [], p: [] }));
  for (const x of t) {
    const { nodes } = rigNodesAt(R, poseAt(take, x));
    const shifted = Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, [v[0], v[1], v[2] + dz]]));
    for (const m of ['$body', '$facing', '$legYaw']) if (nodes[m]) Object.defineProperty(shifted, m, { value: nodes[m], enumerable: false });
    boneFrames(R, rest, shifted).forEach((F, i) => { joints[i].r.push(...F.q.map(r4)); joints[i].p.push(...F.head.map(r4)); });
  }
  // (a quaternion's sign kept continuous, so the viewer's linear blend never takes the long way round)
  for (const J of joints) for (let k = 4; k < J.r.length; k += 4) if (J.r[k] * J.r[k - 4] + J.r[k + 1] * J.r[k - 3] + J.r[k + 2] * J.r[k - 2] + J.r[k + 3] * J.r[k - 1] < 0) for (let i = 0; i < 4; i++) J.r[k + i] = -J.r[k + i];
  return { seconds: take.seconds, t, joints };
}
