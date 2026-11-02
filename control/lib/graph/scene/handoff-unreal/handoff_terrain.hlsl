// THE LAYERED GROUND IN UNREAL (mojulo's scene/handoff.js landParts, bound by import_handoff.py from handoff.json's
// `terrain`): the body of the terrain material's Custom node, its fragment the one Unity's port shares
// (handoff-hlsl/terrain.hlsl, the World page's `layeredGround` as the Godot port has it, with its noise,
// handoff-hlsl/terrain-noise.hlsl), included here when the pack is written (handoff-common.js packSource).
// Unreal is z-up, left-handed, in centimetres: mojulo's frame is its x, -y, z over 100, so the port runs in mojulo's
// frame (the page's world position as written) and turns its normal back. Inputs: P (absolute world position), N (the
// vertex normal), Face (the face's side: Unreal's TwoSidedSign), Cam (the camera's position), S01 and S23 (the corners'
// weights, the GLB's TEXCOORD_2 and _3), Col (the corner's solved base), the layers' arrays TBase, TNorm, TOrm, the images TDice, TPath, TGrass, and the read's numbers.
// Returns the base colour; Rough and Nrm (a world normal, Unreal's frame) are its other outputs.
// (the noise in a struct: a Custom node's code is a function's body, which defines no functions of its own)
struct MojuloTerrain {
	// @mojulo-include terrain-noise.hlsl
};
MojuloTerrain MJ;
#define MJ_VN MJ.mj_vn
#define MJ_VOR5 MJ.mj_vor5
#define MJ_GHT MJ.mj_gHt
#define MJ_ARR_Orm(a, gx, gy) TOrm.SampleGrad(TOrmSampler, a, gx, gy)
#define MJ_ARR_Base(a, gx, gy) TBase.SampleGrad(TBaseSampler, a, gx, gy)
#define MJ_ARR_Norm(a, gx, gy) TNorm.SampleGrad(TNormSampler, a, gx, gy)
#define MJ_LOD_PATH(uv, l) TPath.SampleLevel(TPathSampler, uv, l)
#define MJ_LOD_GRASS(uv, l) TGrass.SampleLevel(TGrassSampler, uv, l)
#define MJ_DICE(uv, gx, gy) TDice.SampleGrad(TDiceSampler, uv, gx, gy)
// (mojulo's frame: Unreal's x, -y, z over 100)
float3 vWPos = float3(P.x, -P.y, P.z) * 0.01;
float3 vCam = float3(Cam.x, -Cam.y, Cam.z) * 0.01;
float3 nV = normalize(float3(N.x, -N.y, N.z));
float4 vSplat = float4(S01.x, S01.y, S23.x, S23.y);
float face = Face;
// @mojulo-include terrain.hlsl
Rough = roughnessFactor;
Nrm = float3(nM.x, -nM.y, nM.z);
return max(diffuse, 0.0);
