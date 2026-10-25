shader_type spatial;
// mojulo-godot kernel — THE HEADLAMPS' POOL (since 0.31.0): a dark race mood's own light on the road ahead of a car
// (car-designer/supercar-figure.js beams; scene/channels/controllable __rlBeamF), a plane in the machine's frame a hair
// over the road (kernel/juice.gd), its two lobes opening and fading down its length, added. The page's numbers are its
// display's: lifted to linear here so Godot's output shows them. (The page squares each lobe's offset with pow(x, 2.0),
// which GLSL leaves undefined for a negative x; the square is written out.)
render_mode blend_add, unshaded, depth_draw_never, cull_disabled, shadows_disabled;

uniform vec3 col = vec3(1.0);
uniform float amount = 0.0;
uniform float spread = 0.32;

vec3 srgb_lin(vec3 c) {
	vec3 lo_c = c / 12.92;
	vec3 hi_c = pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
	return mix(hi_c, lo_c, step(c, vec3(0.04045)));
}

void fragment() {
	float v = UV.y;
	float u = UV.x * 2.0 - 1.0;
	float w = 0.3 + 0.7 * v;
	float c = spread * (1.0 - v);
	float a = (u - c) / (0.34 * w);
	float b = (u + c) / (0.34 * w);
	float lobes = exp(-a * a) + exp(-b * b);
	float k = smoothstep(0.0, 0.3, v) * pow(1.0 - v, 1.2) * min(1.0, lobes) * 1.6;
	ALBEDO = srgb_lin(col * k * amount);
}
