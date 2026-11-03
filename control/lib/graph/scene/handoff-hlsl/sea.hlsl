// THE SEA, shared by Unreal's and Unity's ports (handoff-unreal/handoff_sea.hlsl, handoff-unity/MojuloSea.shader include
// it, handoff-common.js packSource): the World page's sea (scene/channels/form-land.js) as the Godot port has it
// (handoff-godot/handoff_sea.gdshader): see-through at its opacity and faded to nothing toward the shore by the depth
// under it (the map's red over `max` metres; off the map, the open sea, whole: the page lays a deep floor there that the
// handoff does not carry), the sky in its reflection: the page's own dome (from the horizon's colour to the zenith's by
// the reflected ray's height) at Schlick's Fresnel, and the dome's light on its colour (`irradiance`, handoff.js
// SEA_SKY_SHARE: three lights a standard material by its envMap's diffuse too) less what it reflects.
// In, from the port, in mojulo's frame: vP (the world position), vCam (the camera's), DOM (the depth map's origin and
// metres on the plan), DMaxOp (max, opacity), zen and hor (the sky's colours, linear), Base (the sea's colour), Irr (the
// dome's light, linear), MJ_SEA_DEPTH(uv) (the depth map's sample). Out: alpha (its opacity) and refl (the reflection
// and the sky's light on the colour), which the port writes out.
float2 du = (vP.xy - DOM.xy) / max(DOM.zw, 1e-4);
float dMax = max(DMaxOp.x, 1e-4);
float off = (du.x < 0.0 || du.y < 0.0 || du.x > 1.0 || du.y > 1.0) ? 1.0 : 0.0;
float alpha = off > 0.5 ? 1.0 : DMaxOp.y * smoothstep(0.0, dMax, MJ_SEA_DEPTH(du).r * dMax);
float3 V = normalize(vCam - vP);
float3 R = reflect(-V, float3(0.0, 0.0, 1.0));
float3 sky = lerp(hor, zen, pow(max(0.0, R.z), 0.6));
float nv = saturate(V.z);
float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
float3 refl = sky * fr + Base.rgb * Irr.rgb * (1.0 - fr);
