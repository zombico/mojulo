#!/usr/bin/env node
/**
 * export-mount.mjs — the mount (a horse) as one GLB an engine imports as it is: its rig's bones as joints, the body's
 * skin on its own weights, the corrective shapes as morph targets, every clip (the gaits' cycles in place with their
 * ground speed, the transitions and the halt, the jump, the idle and its layers, grazing) as joint keys and the shapes'
 * weights. Writes `<out>/mount-<register>-<coat>.glb`, its README (how each engine takes it) and its numbers.
 *
 *   node scripts/export-mount.mjs <out> [--register realistic|stylized] [--cells 64] [--coat bay] [--lit]
 *        [--no-correctives] [--clips walk,trot,…] [--tack] [--ride] [--rider '<character>'] [--cache <file>]
 *
 * RIDDEN (`--ride`, or `--rider`): the horse in its ridden head carriage, tacked, and carrying the riding interface:
 * sockets keyed through every clip (the seat, the stirrup bars, the irons, the bit's rings: an engine seats its own
 * characters by IK to them) and each clip's seat in its extras (`moj:ride`). `--rider` puts a CHARACTER on it: any
 * the studio makes (a hero spec, `'{"cast":"female","form":"realistic"}'`, minted once and cached; or `@recipe.json`, a
 * layered recipe), solved to the same targets every key, written as its own skinned figure beside the horse's with the
 * same clips (`rider:trot` plays with `mount:trot`), the reins on chains from the bit to its fists.
 *
 * The correctives are fit over every pose the clips make (correctives.js); their machine gate on poses the fit never
 * saw is the study sheet's (scripts/mount-study.mjs --correctives) and mount.deep.test.js's. That the GLB plays what
 * the solver solved (re-skinned from its own buffers) is export.test.js's.
 */
import path from 'node:path';
import os from 'node:os';
import { register as registerHook } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
registerHook('./mcp-stdio-loader.mjs', import.meta.url);           // (a character's modules reach the @/ alias)
import { resolveMount } from '../lib/graph/mount/build.js';
import { bodyMesh } from '../lib/graph/mount/body.js';
import { skinContext, correctiveKeys, correctiveCorpus, fitCorrectives } from '../lib/graph/mount/correctives.js';
import { mountClips, mountGlb, mountPack, MOUNT_CLIPS } from '../lib/graph/mount/export.js';
import { boneFrames } from '../lib/graph/mount/skin.js';
import { standPose } from '../lib/graph/mount/gait.js';
import { bodyField } from '../lib/graph/mount/body.js';
import { tackPieces } from '../lib/graph/mount/tack.js';
import { carriageOf, riddenFrame, ridingGeometry, rideSockets, reinRig, riderClipModes } from '../lib/graph/mount/ridden.js';
import { facesToGlb } from '../lib/graph/scene/scene-gltf.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const register = opt('register', 'realistic'), cells = Number(opt('cells', 64)), coat = opt('coat', 'bay'), lit = flag('lit'), bare = flag('no-correctives');
const riderSpec = opt('rider', null), ride = flag('ride') || !!riderSpec, tack = flag('tack') || ride;
const cacheDir = opt('cache', os.tmpdir());
const names = opt('clips', null)?.split(',') ?? MOUNT_CLIPS;
const out = args[0] || '.';
mkdirSync(out, { recursive: true });

// (keys and times of a clip as the pack keys it: 30 a second, a loop's last wrapping onto its first)
const g0K = (n) => { const c = clipsRef[n]; return c.once ? Math.max(2, Math.round(c.s * 30) + 1) : Math.max(2, Math.round(c.s * 30)); };
const keyT = (n, k) => { const c = clipsRef[n], K = g0K(n); return c.once ? c.s * k / (K - 1) : c.s * k / K; };
let clipsRef = {}, rideTargetsOf = null, rideExtras = () => ({});
const t0 = Date.now(), lap = (what) => console.log(`${what} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const B = resolveMount('horse', { register });
const mesh = bodyMesh(B, { cells });
lap(`body: ${mesh.vertices.length} vertices, ${mesh.quads.length} quads`);
let set = null;
if (!bare) {
  const ctx = skinContext(B, mesh), corpus = correctiveCorpus(B, { phases: 16, jumpSamples: 24, ridden: ride }).map((c) => c.frames);
  set = fitCorrectives(ctx, correctiveKeys(ctx, { corpus }), corpus);
  lap(`correctives: ${set.drivers.length} drivers, ${set.drivers.reduce((t, d) => t + d.keys.length, 0)} shapes, fit over ${corpus.length} poses`);
}
const clips = mountClips(B, { names, ridden: ride });
clipsRef = clips;
if (ride) {
  const { rideTargets, riderModeAt } = await import('../lib/graph/mount/ridden.js');
  rideTargetsOf = (geo, m) => rideTargets(geo, m.mode, { leather: 0.35, out: 0.1 }, { rise: m.rise });
  // each clip's seat through its keys (the trunk's lean, the arms' setting, the seat's lift and rise): an engine's IK
  // poses its own rider by them with the sockets
  rideExtras = (n) => { const K = g0K(n), r4 = (x) => Math.round(x * 1e4) / 1e4, m = Array.from({ length: K }, (_, k) => riderModeAt(n, clips[n], keyT(n, k))); return { about: 'the rider\'s seat at each key (ridden.js): lean (deg, the trunk forward of upright), elbow (deg, the shoulder\'s flexion: the forearm then aimed at the bit), lift (m, out of the saddle), carriage (the horse\'s ridden head carriage, a share); sit the pelvis on socket:seat, the balls of the feet on socket:iron*, the fists on the line to socket:bit*', lean: m.map((x) => r4(x.lean)), elbow: m.map((x) => r4(x.elbow)), lift: m.map((x) => r4(x.lift)), carriage: m.map((x) => r4(x.carriage)) }; };
}
let g, riderNote = '';
const name = `mount-${register}-${coat}${riderSpec ? '-ridden' : ride ? '-ride' : tack ? '-tacked' : ''}`;
if (!ride) g = mountGlb(B, { mesh, set, clips, coat, lit, tack });
else {
  // THE RIDING INTERFACE: the sockets (and with a character, the character and the reins)
  const rest = boneFrames(B, standPose(B)), anchors = tackPieces(B, { reins: false }).anchors, F = bodyField(B);
  let cal = { leather: 0.35, out: 0.1, splay: 40 }, H = null, recipe = null, rc = null;
  if (riderSpec) {
    const { compileLayered } = await import('../lib/graph/polygonizer/station-loft.js');
    const { validateRig, bindLayered, packLayeredRig } = await import('../lib/graph/polygonizer/station-loft-rig.js');
    const { riderSeat, riderPose, rideCharacter, fistOf, RIDER_MODES } = await import('../lib/graph/mount/rider.js');
    const { rigNodesAt } = await import('../lib/graph/polygonizer/station-loft-rig.js');
    if (riderSpec.startsWith('@')) recipe = JSON.parse(readFileSync(riderSpec.slice(1), 'utf8'));
    else {
      const file = path.join(cacheDir, `mojulo-rider-${createHash('sha256').update(riderSpec).digest('hex').slice(0, 12)}.json`);
      if (existsSync(file)) recipe = JSON.parse(readFileSync(file, 'utf8'));
      else { const { heroRecord, expandLayeredManifest } = await import('../lib/mcp/tools/layered.js'); recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord(JSON.parse(riderSpec)) }).recipe; writeFileSync(file, JSON.stringify(recipe)); }
    }
    const hmesh = compileLayered(recipe), R = { ...validateRig(recipe.rig), reach: 'clamp' }, hskin = bindLayered(hmesh, recipe, R);
    H = { R, mesh: hmesh, skin: hskin, recipe };
    cal = riderSeat(H, ridingGeometry(anchors, rest, rest), (p) => F.field(p));
    lap(`rider: ${hmesh.vertices.length} vertices; leathers ${cal.leather.toFixed(2)} m, irons ${cal.out.toFixed(2)} m out, knees out ${cal.splay}°`);
    rc = rideCharacter(B, H, clips, { anchors, cal, rest });
    lap('rider: every clip keyed');
    // the reins: from the bits to the fists at the ridden halt (their length: that distance and a little)
    const stand1 = boneFrames(B, riddenFrame(standPose(B), carriageOf(standPose(B)))), geo1 = ridingGeometry(anchors, stand1, rest);
    const n1 = rigNodesAt(R, riderPose(H, cal, geo1, RIDER_MODES.sit).pose).nodes, fists1 = { R: fistOf(n1, 'R'), L: fistOf(n1, 'L') };
    H.reins = reinRig(anchors.bits, fists1, Math.hypot(...fists1.R.map((x, i) => x - geo1.bits.R[i])) + 0.02);
    H.pack = (() => {
      const seconds = {}, fns = {};
      for (const [n, r] of Object.entries(rc)) { const fn = (u) => r.poses[r.once ? Math.round(u * (r.K - 1)) : Math.round(u * r.K) % r.K]; fn.keys = r.K; if (r.once) fn.once = true; fns[n] = fn; seconds[n] = r.s; }
      // (lit by the engine: its smooth normals carried and no shade baked into its colours, so its corners weld back into
      // its own vertices; a baked shade differs face by face and would split every one)
      const vn = hmesh.vertices.map(() => [0, 0, 0]);
      for (const f of hmesh.faces) { const [a, b, c] = f.map((i) => hmesh.vertices[i]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; for (const i of f) for (let q = 0; q < 3; q++) vn[i][q] += nn[q]; }
      const un = vn.map((n) => { const l = Math.hypot(...n) || 1; return n.map((x) => x / l); }), normals = hmesh.faces.map((f) => f.map((i) => un[i]));
      return { ...packLayeredRig(hmesh, hskin, R, { clips: fns, palette: recipe.palette, seconds, normals, engineLit: true }), weld: true };
    })();
  }
  const sockets = rideSockets(anchors, rest, cal), modesOf = {};
  const extra = {
    joints: [...sockets.joints, ...(H ? H.reins.joints : [])], meshes: H ? [H.reins.mesh] : [],
    keysAt: (n, k, f) => {
      const r = rc?.[n], geo = r ? r.geos[k] : ridingGeometry(anchors, f, rest);
      let T = r?.targets[k];
      if (!T) { modesOf[n] ??= riderClipModes(n, clips[n], Array.from({ length: g0K(n) }, (_, i) => clips[n].at(keyT(n, i))), (i) => keyT(n, i)); const m = modesOf[n][k]; T = rideTargetsOf(geo, m); }
      return [...sockets.keys(T, geo, f), ...(H ? H.reins.keys(geo.bits, r.fists[k]) : [])];
    },
    clipExtras: Object.fromEntries(Object.keys(clips).map((n) => [n, { 'moj:ride': rideExtras(n) }])),
  };
  const pack = mountPack(B, { mesh, set, clips, coat, tack: { reins: false, stirrups: { length: cal.leather, out: cal.out } }, extra });
  const o = facesToGlb({ figures: { mount: pack, ...(H ? { rider: H.pack } : {}) } }, { generator: 'mojulo mount', clips: '_all', skinned: true, lit });
  g = { ...o, pack };
  riderNote = H ? `, a rider (${H.mesh.vertices.length} vertices) on the same clips` : '';
}
writeFileSync(path.join(out, `${name}.glb`), g.bytes);
lap(`${name}.glb: ${(g.byteLength / 1e6).toFixed(1)} MB, ${g.vertexCount} vertices, ${g.triangleCount} triangles, ${g.animationCount} clips${riderNote}`);

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

${ride ? `## Riding

The horse is in its ridden head carriage, tacked, and carries the riding interface. Its joints \`socket:*\` are keyed
through every clip:

- \`socket:saddle\`: the seat's middle on the saddle.
- \`socket:seat\`: where a rider's sit bones go in the moment (the rising trot, the two-point's steadier seat).
- \`socket:barR\`, \`socket:barL\`: the stirrup bars.
- \`socket:ironR\`, \`socket:ironL\`: the irons' treads, for the balls of the feet.
- \`socket:bitR\`, \`socket:bitL\`: the bit's rings.

Each animation's extras carry \`moj:ride\`: the seat at each key (the trunk's lean, the arms' setting, the seat's
lift, the carriage's share). To put an engine's own character on the horse, solve its IK each frame:

1. The pelvis on \`socket:seat\`.
2. The feet on \`socket:iron*\`.
3. The trunk leaned by \`lean\`.
4. The upper arm set by \`elbow\`, the forearm aimed at \`socket:bit*\`.
5. The head held upright.
${riderSpec ? `
This file also carries a rider: the figure \`rider\`, solved to the same targets, with clips of the same names as the
horse's. Play \`rider:trot\` together with \`mount:trot\`. The reins run on chains from the bit to its fists.` : ''}

` : ''}## Engines

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
