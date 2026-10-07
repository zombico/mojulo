/**
 * godot-humanoid — the Godot side of a T-pose humanoid GLB (docs/emote-bridge.md phase 4): a BoneMap per figure
 * (Godot's SkeletonProfileHumanoid → the figure's VRM-named bones) and the GLB's `.import` naming it on the figure's
 * skeleton, so Godot's own retargeter renames the bones to the profile, makes the skeleton `%GeneralSkeleton`, and lets
 * any humanoid clip a Godot project owns play on the figure (and the figure's on any humanoid). Text only, no Godot.
 *
 * Names as Godot's glTF importer makes them (naming v2): a joint `<figure>:<vrmBone>` becomes the bone
 * `<figure>_<vrmBone>`, under the node `<figure>/Skeleton3D` (an engine figure is a scene-level node, beside `mojulo`). The profile's bone names are the VRM ones,
 * capitalised (hips → Hips, leftUpperArm → LeftUpperArm, leftThumbMetacarpal → LeftThumbMetacarpal).
 * An `.import` names its BoneMap by a res:// path, so the files assume the folder sits at `res://<dir>/` (`dir`).
 */

const profileName = (vrm) => vrm[0].toUpperCase() + vrm.slice(1);

/** The BoneMap resource text for one figure: `vrmNames` its VRM bones (the humanoid map's names and leaves). */
export function godotBoneMapTres(figure, vrmNames) {
  const lines = [...new Set(vrmNames)].map((v) => `bone_map/${profileName(v)} = &"${figure}_${v}"`);
  return `[gd_resource type="BoneMap" format=3]

[sub_resource type="SkeletonProfileHumanoid" id="SkeletonProfileHumanoid_mojulo"]

[resource]
profile = SubResource("SkeletonProfileHumanoid_mojulo")
${lines.join('\n')}
`;
}

/** The BoneMap file name for a figure, beside the GLB. */
export const godotBoneMapFile = (figure) => `${figure}.bonemap.tres`;

/** The post-import script beside the GLB: Godot's glTF import does not set `vertex_color_use_as_albedo`, so a mojulo
 * GLB (its colour is per vertex, COLOR_0, linear) would import white — the kernel's G0 material contract (level.gd
 * _fix_materials), applied at import instead of at run, since a lone GLB has no kernel. */
export const GODOT_POST_IMPORT_FILE = 'mojulo_import.gd';
export const GODOT_POST_IMPORT_GD = `@tool
extends EditorScenePostImport
# mojulo post-import (godot-humanoid.js): every surface takes its vertex colour (COLOR_0, linear) as albedo — Godot's
# glTF import leaves it white otherwise. The same contract as the mojulo kernel's level.gd _fix_materials.

func _post_import(scene):
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var mat = mesh.surface_get_material(s)
			if mat is StandardMaterial3D:
				mat.vertex_color_use_as_albedo = true
				mat.vertex_color_is_srgb = false
	return scene
`;

/** The GLB's `.import`: the scene importer with the post-import script and each figure's BoneMap on its skeleton (Godot
 * fills in the rest). */
export function godotHumanoidImport(figures, dir) {
  const nodes = figures.map((f) => `"PATH:${f}/Skeleton3D": {\n"retarget/bone_map": Resource("res://${dir}/${godotBoneMapFile(f)}")\n}`).join(',\n');
  return `[remap]

importer="scene"
importer_version=1
type="PackedScene"

[params]

import_script/path="res://${dir}/${GODOT_POST_IMPORT_FILE}"
_subresources={
"nodes": {
${nodes}
}
}
`;
}
