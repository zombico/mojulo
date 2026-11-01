// THE SEA IN UNREAL (mojulo's scene/handoff.js seaPlane, bound by import_handoff.py from handoff.json's `sea`): the World
// page's sea (scene/channels/form-land.js) ported from the Godot port (handoff-godot/handoff_sea.gdshader), the body of
// the sea material's Custom node: see-through at its opacity and faded to nothing toward the shore by the depth under it
// (the map's red over `max` metres; off the map, the open sea, whole: the page lays a deep floor there that the handoff
// does not carry), the sky in its reflection: the page's own dome (from the horizon's colour to the zenith's by the
// reflected ray's height) at Schlick's Fresnel. Its colour is lit by the material (its base colour and roughness, no
// specular of the engine's: the sky is its reflection). Runs in mojulo's frame: Unreal's x, -y, z over 100.
// Inputs: P (absolute world position), Cam (the camera's), TDepth (the depth map), DOM (its origin and metres on the
// plan), DMaxOp (max, opacity), Zen, Hor (the sky's colours, linear). Returns the reflection (emissive); Alpha its opacity.
float3 vP = float3(P.x, -P.y, P.z) * 0.01;
float3 vCam = float3(Cam.x, -Cam.y, Cam.z) * 0.01;
float2 du = (vP.xy - DOM.xy) / max(DOM.zw, 1e-4);
float dMax = max(DMaxOp.x, 1e-4);
float off = (du.x < 0.0 || du.y < 0.0 || du.x > 1.0 || du.y > 1.0) ? 1.0 : 0.0;
Alpha = off > 0.5 ? 1.0 : DMaxOp.y * smoothstep(0.0, dMax, TDepth.SampleLevel(TDepthSampler, du, 0).r * dMax);
float3 V = normalize(vCam - vP);
float3 R = reflect(-V, float3(0.0, 0.0, 1.0));
float3 sky = lerp(Hor.rgb, Zen.rgb, pow(max(0.0, R.z), 0.6));
float nv = saturate(V.z);
return sky * (0.04 + 0.96 * pow(1.0 - nv, 5.0));
