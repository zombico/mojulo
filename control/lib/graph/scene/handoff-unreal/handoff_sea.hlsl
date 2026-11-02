// THE SEA IN UNREAL (mojulo's scene/handoff.js seaPlane, bound by import_handoff.py from handoff.json's `sea`): the body
// of the sea material's Custom node, its fragment the one Unity's port shares (handoff-hlsl/sea.hlsl), included here when
// the pack is written (handoff-common.js packSource). Its colour is lit by the material (its base colour and roughness,
// no specular of the engine's: the sky is its reflection). Runs in mojulo's frame: Unreal's x, -y, z over 100.
// Inputs: P (absolute world position), Cam (the camera's), TDepth (the depth map), DOM (its origin and metres on the
// plan), DMaxOp (max, opacity), Zen, Hor (the sky's colours, linear), Base (the sea's colour), Irr (the dome's light,
// linear). Returns the reflection and the sky's light on the colour (emissive); Alpha its opacity.
float3 vP = float3(P.x, -P.y, P.z) * 0.01;
float3 vCam = float3(Cam.x, -Cam.y, Cam.z) * 0.01;
float3 zen = Zen.rgb;
float3 hor = Hor.rgb;
#define MJ_SEA_DEPTH(uv) TDepth.SampleLevel(TDepthSampler, uv, 0)
// @mojulo-include sea.hlsl
Alpha = alpha;
return refl;
