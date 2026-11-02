#!/usr/bin/env node
/**
 * export-mount.mjs — the mount (a horse) as one GLB an engine imports as it is: its rig's bones as joints, the body's
 * skin on its own weights, the corrective shapes as morph targets, every clip (the gaits' cycles in place with their
 * ground speed, the transitions and the halt, the jump, the idle and its layers, grazing) as joint keys and the shapes'
 * weights. Writes `<out>/mount-<register>-<coat>.glb`, its README (how each engine takes it) and its numbers.
 *
 *   node scripts/export-mount.mjs <out> [--register realistic|stylized] [--cells 64] [--coat bay] [--lit]
 *        [--no-correctives] [--clips walk,trot,…]
 *
 * The correctives are fit over every pose the clips make (correctives.js); their machine gate on poses the fit never
 * saw is the study sheet's (scripts/mount-study.mjs --correctives) and mount.deep.test.js's. That the GLB plays what
 * the solver solved (re-skinned from its own buffers) is export.test.js's.
 */
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolveMount } from '../lib/graph/mount/build.js';
import { bodyMesh } from '../lib/graph/mount/body.js';
import { skinContext, correctiveKeys, correctiveCorpus, fitCorrectives } from '../lib/graph/mount/correctives.js';
import { mountClips, mountGlb, MOUNT_CLIPS } from '../lib/graph/mount/export.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const register = opt('register', 'realistic'), cells = Number(opt('cells', 64)), coat = opt('coat', 'bay'), lit = flag('lit'), bare = flag('no-correctives');
const names = opt('clips', null)?.split(',') ?? MOUNT_CLIPS;
const out = args[0] || '.';
mkdirSync(out, { recursive: true });

const t0 = Date.now(), lap = (what) => console.log(`${what} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const B = resolveMount('horse', { register });
const mesh = bodyMesh(B, { cells });
lap(`body: ${mesh.vertices.length} vertices, ${mesh.quads.length} quads`);
let set = null;
if (!bare) {
  const ctx = skinContext(B, mesh), corpus = correctiveCorpus(B, { phases: 16, jumpSamples: 24 }).map((c) => c.frames);
  set = fitCorrectives(ctx, correctiveKeys(ctx, { corpus }), corpus);
  lap(`correctives: ${set.drivers.length} drivers, ${set.drivers.reduce((t, d) => t + d.keys.length, 0)} shapes, fit over ${corpus.length} poses`);
}
const clips = mountClips(B, { names });
const g = mountGlb(B, { mesh, set, clips, coat, lit });
const name = `mount-${register}-${coat}`;
writeFileSync(path.join(out, `${name}.glb`), g.bytes);
lap(`${name}.glb: ${(g.byteLength / 1e6).toFixed(1)} MB, ${g.vertexCount} vertices, ${g.triangleCount} triangles, ${g.animationCount} clips`);

const clipRows = Object.entries(g.pack.clips).map(([n, c]) => `| \`mount:${n}\` | ${c.s.toFixed(2)} s | ${c.once ? 'once' : 'loops'} | ${c.v ? `${c.v.toFixed(2)} m/s` : ''} |`);
const readme = `# The mount: a horse (${register}, ${coat})

One skinned GLB: the rig's ${g.pack.bones.length} bones as joints (flat under the figure's node, each at its bone's head
at rest), the body on its own four weights a vertex, ${set ? `${set.drivers.reduce((t, d) => t + d.keys.length, 0)} corrective shapes as morph targets` : 'no corrective shapes'},
and ${g.animationCount} clips. Metres, the scene's root turning mojulo's z-up into glTF's y-up; the mount faces +Z.

## The clips

In place: a gait's cycle loops on the spot and names its ground speed (\`moj:speed\` in the animation's extras): move
the body at that speed, or play the cycle at its planar speed ÷ moj:speed. A one-shot runs once, in place.

| clip | seconds | plays | speed |
|---|---|---|---|
${clipRows.join('\n')}

## The corrective shapes

${set ? `Every clip carries a weights channel for them (LINEAR, on the body's keys): play the clip and the folds (the armpit,
the stifle, the throat, the neck's base) are corrected as they were solved. A shape is one joint's key, its driver and
angle in the mesh's extras (\`correctives\`); to drive them from a pose an engine makes itself (IK, a blend), weight each
driver's keys piecewise linearly in the joint's bend (the child bone in its parent's frame about the parent's side
axis, from the stand), zero at the stand, one at the key.` : 'None in this file (`--no-correctives`): plain linear blend skinning.'}

## Engines

- **Godot 4**: drop the GLB in the project; it imports as a scene with an AnimationPlayer holding every clip, the
  blend shapes driven by the clips' weights tracks.
- **Unity**: import with a glTF importer (glTFast or UniGLTF); the clips arrive as Legacy or Mecanim clips with blend
  shape curves. Set the rig to Generic (a horse is not a humanoid).
- **Unreal 5**: Interchange imports a Skeletal Mesh, its Skeleton and an Animation Sequence per clip, the morph targets
  with their curves. Root motion is not in the clips: drive the capsule by the clip's speed.
- **Blender**: File → Import → glTF 2.0; each clip an Action, the shapes Shape Keys.
`;
writeFileSync(path.join(out, `${name}.md`), readme);
writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ register, coat, cells, lit, vertices: g.vertexCount, triangles: g.triangleCount, bytes: g.byteLength, shapes: set ? set.drivers.reduce((t, d) => t + d.keys.length, 0) : 0, clips: Object.fromEntries(Object.entries(g.pack.clips).map(([n, c]) => [n, { seconds: c.s, keys: c.k, once: !!c.once, speed: c.v ?? null }])) }, null, 2));
console.log(`wrote ${path.join(out, `${name}.glb`)}, ${name}.md, ${name}.json`);
