/** godot-retarget.mjs — the phase-4 Godot gate (docs/emote-bridge.md): two mojulo humanoids exported as T-pose engine
 * skeletons with their Godot sidecars (the BoneMap and the .import export_model writes, godot-humanoid.js), imported by a
 * real Godot headless, and one figure's clip played on the OTHER's skeleton through Godot's own retargeter.
 *   the source: the flat figure doing an emote (`--emote`, default bow; 15 bones with its hand and foot leaves)
 *   the target: a hero (`--hero` a JSON hero spec, default the male anime hero; ~50 bones with fingers)
 * Reads back, per sampled frame, the direction of the trunk (Hips → Head) and the limbs in both skeletons, and prints
 * { renamed, clip, worst_dir_deg, hero_moved_deg }: renamed = both skeletons carry the profile's bone names under
 * %GeneralSkeleton; worst_dir_deg = the largest angle between the source's and the target's segment at the same time
 * (the trunk differs a little by construction: one spine bone against spine, chest and neck); hero_moved_deg = how far
 * the target moved from its rest (0 means the clip never reached it). Exit 1 when the gate fails, 2 without Godot.
 * The Godot binary: $MOJULO_GODOT, else `godot` on the PATH. Run from control:
 *   node ../docs/examples/humanoid/godot-retarget.mjs [--out <dir>] [--emote bow] [--hero '{"cast":"female"}'] */
import { register } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

register('../../../control/scripts/mcp-stdio-loader.mjs', import.meta.url);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = resolve(arg('out', join(tmpdir(), 'mojulo-godot-retarget')));
const emote = arg('emote', 'bow');
const heroSpec = JSON.parse(arg('hero', '{"cast":"male","head":"anime","hair":"short"}'));
const godot = process.env.MOJULO_GODOT || 'godot';
if (spawnSync(godot, ['--version']).status !== 0) { console.error(`no Godot at '${godot}' (set MOJULO_GODOT)`); process.exit(2); }

const { facesToGlb } = await import('../../../control/lib/graph/scene/scene-gltf.js');
const { godotBoneMapTres, godotBoneMapFile, godotHumanoidImport, GODOT_POST_IMPORT_FILE, GODOT_POST_IMPORT_GD } = await import('../../../control/lib/graph/scene/godot-humanoid.js');
const { tposeRig, withProfileJoints } = await import('../../../control/lib/graph/figures/rig-tpose.js');
const { assembleFigureScene } = await import('../../../control/lib/graph/figures/figure-world.js');
const { humanoidBonesFor } = await import('../../../control/lib/graph/polygonizer/figure-humanoid-map.js');
const { resolveWorldScene } = await import('../../../control/lib/graph/worlds/world-scene.js');
const { heroRecord, expandLayeredManifest } = await import('../../../control/lib/mcp/tools/layered.js');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="mojulo retarget gate"\n');
// each GLB in its own folder, with its sidecars, at the res:// path the .import names
function place(dir, figName, fig) {
  const at = join(out, dir); mkdirSync(at, { recursive: true });
  writeFileSync(join(at, 'model.glb'), facesToGlb({ faces: [], figures: { [figName]: fig } }, { clips: '_all', skinned: true, humanoid: true }).bytes);
  const { names, leaves } = humanoidBonesFor(withProfileJoints(fig).bones);
  writeFileSync(join(at, godotBoneMapFile(figName)), godotBoneMapTres(figName, [...names.values(), ...leaves.map((l) => l.vrm)]));
  writeFileSync(join(at, GODOT_POST_IMPORT_FILE), GODOT_POST_IMPORT_GD);
  writeFileSync(join(at, 'model.glb.import'), godotHumanoidImport([figName], dir));
}
place('mojulo/source', 'figure', Object.values(assembleFigureScene({ motion: { emote } }, { tpose: true }).figures)[0]);
const { payload } = await resolveWorldScene({ ref: 'sk_gate', manifest: expandLayeredManifest({ kind: 'layered', hero: heroRecord(heroSpec) }) });
place('mojulo/target', 'body', tposeRig(payload.figures.body));

writeFileSync(join(out, 'gate.gd'), `extends SceneTree
const PAIRS = [["Hips", "Head"], ["LeftUpperArm", "LeftLowerArm"], ["LeftLowerArm", "LeftHand"], ["RightUpperArm", "RightLowerArm"], ["RightLowerArm", "RightHand"], ["LeftUpperLeg", "LeftLowerLeg"], ["RightLowerLeg", "RightFoot"]]
# global poses composed from the local ones (a headless SceneTree does not refresh every skeleton's cache)
func _glob(sk, i):
	var t = sk.get_bone_pose(i)
	var p = sk.get_bone_parent(i)
	return t if p < 0 else _glob(sk, p) * t
func _dir(sk, a, b):
	return (_glob(sk, sk.find_bone(b)).origin - _glob(sk, sk.find_bone(a)).origin).normalized()
func _init():
	var src = load("res://mojulo/source/model.glb").instantiate()
	var dst = load("res://mojulo/target/model.glb").instantiate()
	root.add_child(src); root.add_child(dst)
	var sap = src.find_children("*", "AnimationPlayer", true, false)[0]
	var dap = dst.find_children("*", "AnimationPlayer", true, false)[0]
	var ssk = src.find_children("*", "Skeleton3D", true, false)[0]
	var dsk = dst.find_children("*", "Skeleton3D", true, false)[0]
	var renamed = ssk.name == "GeneralSkeleton" and dsk.name == "GeneralSkeleton"
	for p in PAIRS: renamed = renamed and ssk.find_bone(p[0]) >= 0 and dsk.find_bone(p[1]) >= 0
	var clip = sap.get_animation_list()[0]
	var lib = AnimationLibrary.new()
	lib.add_animation("emote", sap.get_animation(clip).duplicate(true))
	dap.add_animation_library("mojulo", lib)
	var rest = {}
	for p in PAIRS: rest[p[0] + p[1]] = _dir(dsk, p[0], p[1])
	sap.play(clip); dap.play("mojulo/emote")
	var length = sap.get_animation(clip).length
	var worst = 0.0
	var moved = 0.0
	for i in 17:
		var t = length * i / 16.0
		sap.seek(t, true); dap.seek(t, true)
		for p in PAIRS:
			var b = _dir(dsk, p[0], p[1])
			worst = max(worst, rad_to_deg(_dir(ssk, p[0], p[1]).angle_to(b)))
			moved = max(moved, rad_to_deg(b.angle_to(rest[p[0] + p[1]])))
	print("GATE ", JSON.stringify({ "renamed": renamed, "clip": clip, "worst_dir_deg": snapped(worst, 0.01), "hero_moved_deg": snapped(moved, 0.01) }))
	quit()
`);
const run = (args) => spawnSync(godot, ['--headless', '--path', out, ...args], { encoding: 'utf8' });
run(['--import']);
const r = run(['-s', 'gate.gd']);
const line = (r.stdout || '').split('\n').find((l) => l.startsWith('GATE '));
if (!line) { console.error(r.stdout, r.stderr); process.exit(1); }
const res = JSON.parse(line.slice(5));
console.log(JSON.stringify({ ...res, project: out }, null, 2));
process.exit(res.renamed && res.hero_moved_deg > 5 && res.worst_dir_deg < 10 ? 0 : 1);
