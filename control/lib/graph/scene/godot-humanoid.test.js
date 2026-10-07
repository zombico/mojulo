// The Godot sidecars of a T-pose humanoid GLB: the BoneMap Godot's retargeter reads, and the .import that names it.
// (The live gate, a real Godot importing them and retargeting a clip, is docs/examples/humanoid/godot-retarget.mjs.)
import { describe, expect, it } from 'vitest';

import { godotBoneMapTres, godotBoneMapFile, godotHumanoidImport, GODOT_POST_IMPORT_GD } from './godot-humanoid.js';

describe('the Godot humanoid sidecars', () => {
  it('a BoneMap maps the profile names (the VRM names, capitalised) onto the bones as Godot names them', () => {
    const t = godotBoneMapTres('figure', ['hips', 'leftUpperArm', 'leftThumbMetacarpal', 'hips']);
    expect(t).toMatch(/^\[gd_resource type="BoneMap" format=3\]/);
    expect(t).toMatch(/profile = SubResource\("SkeletonProfileHumanoid_mojulo"\)/);
    expect(t).toContain('bone_map/Hips = &"figure_hips"');
    expect(t).toContain('bone_map/LeftUpperArm = &"figure_leftUpperArm"');
    expect(t).toContain('bone_map/LeftThumbMetacarpal = &"figure_leftThumbMetacarpal"');
    expect(t.match(/bone_map\/Hips/g)).toHaveLength(1);
  });

  it('the .import names each figure\'s BoneMap on its skeleton, at the res:// folder', () => {
    const t = godotHumanoidImport(['body'], 'mojulo/sk_abc');
    expect(t).toContain('importer="scene"');
    expect(t).toContain('"PATH:body/Skeleton3D": {\n"retarget/bone_map": Resource("res://mojulo/sk_abc/body.bonemap.tres")\n}');
    expect(godotBoneMapFile('body')).toBe('body.bonemap.tres');
    expect(t).toContain('import_script/path="res://mojulo/sk_abc/mojulo_import.gd"');
  });

  it('the post-import script gives every surface its vertex colour (linear) as albedo', () => {
    expect(GODOT_POST_IMPORT_GD).toMatch(/^@tool\nextends EditorScenePostImport/);
    expect(GODOT_POST_IMPORT_GD).toContain('mat.vertex_color_use_as_albedo = true');
    expect(GODOT_POST_IMPORT_GD).toContain('mat.vertex_color_is_srgb = false');
  });
});
