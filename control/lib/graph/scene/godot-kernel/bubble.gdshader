shader_type spatial;
// mojulo-godot kernel — A SHIELD'S BUBBLE (since 0.31.0): the status row a game's shield lights (car-designer/juice.js
// STATUS.shield), a sphere round the machine bright at its rim (kernel/juice.gd), added as the page adds it.
render_mode blend_add, unshaded, depth_draw_never, cull_back, shadows_disabled;

uniform vec3 col = vec3(1.0);
uniform float alpha = 0.0;

vec3 srgb_lin(vec3 c) {
	vec3 lo_c = c / 12.92;
	vec3 hi_c = pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
	return mix(hi_c, lo_c, step(c, vec3(0.04045)));
}

void fragment() {
	float f = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.2);
	ALBEDO = srgb_lin(col * (0.18 + 1.4 * f) * alpha * (0.25 + 0.9 * f));
}
