/**
 * godot-humanoid — the Godot side of a T-pose humanoid GLB (docs/emote-bridge.md phase 4): a BoneMap per figure
 * (Godot's SkeletonProfileHumanoid → the figure's VRM-named bones) and the GLB's `.import` naming it on the figure's
 * skeleton, so Godot's own retargeter renames the bones to the profile, makes the skeleton `%GeneralSkeleton`, and lets
 * any humanoid clip a Godot project owns play on the figure (and the figure's on any humanoid). Text only, no Godot.
 *
 * Names as Godot's glTF importer makes them (naming v2): a joint `<figure>:<vrmBone>` becomes the bone
 * `<figure>_<vrmBone>`, under the node `mojulo/<figure>/Skeleton3D`. The profile's bone names are the VRM ones,
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

/** The GLB's `.import`: the scene importer with each figure's BoneMap on its skeleton (Godot fills in the rest). */
export function godotHumanoidImport(figures, dir) {
  const nodes = figures.map((f) => `"PATH:mojulo/${f}/Skeleton3D": {\n"retarget/bone_map": Resource("res://${dir}/${godotBoneMapFile(f)}")\n}`).join(',\n');
  return `[remap]

importer="scene"
importer_version=1
type="PackedScene"

[params]

_subresources={
"nodes": {
${nodes}
}
}
`;
}
