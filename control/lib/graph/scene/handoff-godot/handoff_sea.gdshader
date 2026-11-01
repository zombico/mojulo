// THE SEA IN GODOT (mojulo's scene/handoff.js seaPlane, bound by handoff_post_import.gd from handoff.json's `sea`): the
// World page's sea (scene/channels/form-land.js) ported: one plane at the water's height in the sea's colour, lit,
// see-through at its opacity and faded to nothing toward the shore by the depth under it (the map's red over `max`
// metres; off the map, the open sea), drawn without writing depth, the sky in its reflection: the page reflects its
// own dome (from the horizon's colour to the zenith's by the reflected ray's height), here by the same dome and
// Schlick's Fresnel. The plane's own space is mojulo's frame (z-up, metres: the GLB's root turns it).
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back, diffuse_lambert;

uniform vec3 uBase = vec3(0.0, 0.29, 0.45);
uniform float uRough = 0.06;
uniform float uOpacity = 0.9;
uniform sampler2D tDepth : filter_linear, repeat_disable;
uniform vec2 uDO;
uniform vec2 uDM = vec2(1.0);
uniform float uDMax = 1.0;
uniform vec3 uZenith : source_color = vec3(0.42, 0.56, 0.75);
uniform vec3 uHorizon : source_color = vec3(0.78, 0.83, 0.88);

varying vec3 vP;
varying vec3 vCam;

void vertex() {
	vP = VERTEX;
	vCam = (inverse(MODEL_MATRIX) * vec4(INV_VIEW_MATRIX[3].xyz, 1.0)).xyz;
}

void fragment() {
	ALBEDO = uBase;
	ROUGHNESS = uRough;
	METALLIC = 0.0;
	vec2 du = (vP.xy - uDO) / uDM;
	float fade = du.x < 0.0 || du.y < 0.0 || du.x > 1.0 || du.y > 1.0 ? 1.0 : smoothstep(0.0, uDMax, texture(tDepth, du).r * uDMax);
	ALPHA = uOpacity * fade;
	vec3 V = normalize(vCam - vP);
	vec3 R = reflect(-V, vec3(0.0, 0.0, 1.0));
	vec3 sky = mix(uHorizon, uZenith, pow(max(0.0, R.z), 0.6));
	float nv = clamp(V.z, 0.0, 1.0);
	EMISSION = sky * (0.04 + 0.96 * pow(1.0 - nv, 5.0));
}
