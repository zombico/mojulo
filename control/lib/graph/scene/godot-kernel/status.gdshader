shader_type spatial;
// mojulo-godot kernel — A RACER'S STATUS ON ITS PARTS (since 0.31.0): kernel/juice.gd lays this over each part of a
// juiced rig (its material_overlay) with the status rows' reading (kernel/vehicle.gd status): the page writes
// mix(base · tint, mix colour, mix) + glow into each part's fragment; here the glow and the mix colour are light laid
// over the part and the tint and the mix keep the share of the base they leave (premultiplied: the tint read as one
// share, the page's sum in its display values lifted to linear). Nothing on (a tint of 1, no mix, no glow) draws nothing.
render_mode blend_premul_alpha, unshaded, depth_draw_never, cull_back, shadows_disabled;

uniform float tint = 1.0;
uniform float mix_amount = 0.0;
uniform vec3 mix_col = vec3(1.0);
uniform vec3 glow = vec3(0.0);

vec3 srgb_lin(vec3 c) {
	vec3 lo_c = c / 12.92;
	vec3 hi_c = pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
	return mix(hi_c, lo_c, step(c, vec3(0.04045)));
}

void fragment() {
	ALBEDO = srgb_lin(mix_col * mix_amount + glow);
	ALPHA = 1.0 - clamp(tint, 0.0, 1.0) * (1.0 - mix_amount);
}
