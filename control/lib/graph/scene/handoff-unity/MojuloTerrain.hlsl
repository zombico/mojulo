// MojuloTerrain.hlsl - THE LAYERED GROUND IN UNITY (mojulo's scene/handoff.js landParts, bound by MojuloImport.cs from
// handoff.json's `terrain` to every part it names, MojuloTerrain.shader): the fragment Unreal's port shares
// (handoff-hlsl/terrain.hlsl, the World page's `layeredGround` as the Godot port has it, with its noise,
// handoff-hlsl/terrain-noise.hlsl), included here when the pack is written (handoff-common.js packSource); this file
// gives it the frame, the samplers and the outputs.
// It runs in mojulo's frame (z-up metres, the page's world position as written): Unity's world is glTFast's mirror of
// glTF's (mojulo's -x, z, -y), so P, the camera and the normal are turned back in and the normal turned out again
// (MojuloLighting.hlsl). The corners' weights are the GLB's TEXCOORD_2 and _3 with glTFast's v undone (it writes
// 1 - v); the images are loaded by the importer with their first row at v = 0, as the page's data textures (and as
// Unreal's), so every sample is the Unreal port's, the dice read flipped as the page reads an image.
#ifndef MOJULO_TERRAIN_INCLUDED
#define MOJULO_TERRAIN_INCLUDED

TEXTURE2D_ARRAY(_TBase); SAMPLER(sampler_TBase);
TEXTURE2D_ARRAY(_TNorm); SAMPLER(sampler_TNorm);
TEXTURE2D_ARRAY(_TOrm); SAMPLER(sampler_TOrm);
TEXTURE2D(_TDice); SAMPLER(sampler_TDice);
TEXTURE2D(_TPath); SAMPLER(sampler_TPath);
TEXTURE2D(_TGrass); SAMPLER(sampler_TGrass);
#define MJ_ARR_Orm(a, gx, gy) SAMPLE_TEXTURE2D_ARRAY_GRAD(_TOrm, sampler_TOrm, (a).xy, (a).z, gx, gy)
#define MJ_ARR_Base(a, gx, gy) SAMPLE_TEXTURE2D_ARRAY_GRAD(_TBase, sampler_TBase, (a).xy, (a).z, gx, gy)
#define MJ_ARR_Norm(a, gx, gy) SAMPLE_TEXTURE2D_ARRAY_GRAD(_TNorm, sampler_TNorm, (a).xy, (a).z, gx, gy)
#define MJ_LOD_PATH(uv, l) SAMPLE_TEXTURE2D_LOD(_TPath, sampler_TPath, uv, l)
#define MJ_LOD_GRASS(uv, l) SAMPLE_TEXTURE2D_LOD(_TGrass, sampler_TGrass, uv, l)
#define MJ_DICE(uv, gx, gy) SAMPLE_TEXTURE2D_GRAD(_TDice, sampler_TDice, uv, gx, gy)

// @mojulo-include terrain-noise.hlsl
#define MJ_VN mj_vn
#define MJ_VOR5 mj_vor5
#define MJ_GHT mj_gHt

// P (Unity's world position), N (its vertex normal), face (the face's side: SV_IsFrontFace), Cam (the camera's position),
// vSplat (the corners' weights in mojulo's order), Col (the corner's solved base) -> the base colour, the roughness and
// the shading normal (Unity's frame)
void MojuloTerrain(float3 P, float3 N, float face, float3 Cam, float4 vSplat, float3 Col, out float3 baseOut, out float roughOut, out float3 normalOut)
{
    float3 vWPos = MojuloFromUnity(P);
    float3 vCam = MojuloFromUnity(Cam);
    float3 nV = normalize(MojuloFromUnity(N));
    // @mojulo-include terrain.hlsl
    roughOut = roughnessFactor;
    normalOut = UnityFromMojulo(nM);
    baseOut = max(diffuse, 0.0);
}

#endif
