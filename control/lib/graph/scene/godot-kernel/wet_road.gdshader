shader_type spatial;
// mojulo-godot kernel — A WET ROAD (since 0.31.0): the film the page lays over a rain race's road (roads/race-mood.js,
// scene/channels/wet-road.js), lit per pixel: the sky by Fresnel (a grazing look down the road shines, a look straight
// down does not), and each of the lamps nearest the eye thrown back as a streak (the lamp mirrored under the road, the
// film narrow across and long toward the eye), broken by a slow shimmer. kernel/level.gd lays the quads and hands it
// the nearest lamps each frame. The page's maths in the recipe's frame (z up, recipe units: Godot's world over mpu);
// its numbers are its display's, lifted to linear so Godot's output shows them. Added, no depth write.
render_mode blend_add, unshaded, depth_draw_never, cull_disabled, shadows_disabled;

const int LAMPS = 24;
uniform float mpu = 1.0;
uniform vec3 zen = vec3(0.0);
uniform vec3 hor = vec3(0.0);
uniform int count = 0;
uniform vec4 lamps[24];
uniform vec3 lamp_cols[24];

varying vec3 vw;

float h2(vec2 p) {
	vec3 q = fract(vec3(p.xyx) * 0.1031);
	q += dot(q, q.yzx + 33.33);
	return fract((q.x + q.y) * q.z);
}

float n2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 w = f * f * (3.0 - 2.0 * f);
	return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), w.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), w.x), w.y);
}

vec3 srgb_lin(vec3 c) {
	vec3 lo_c = c / 12.92;
	vec3 hi_c = pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
	return mix(hi_c, lo_c, step(c, vec3(0.04045)));
}

void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vw = vec3(w.x, -w.z, w.y) / mpu;
}

// the film seen from cam at a point: the sky's sheen and the lamps' streaks (the page's fragment)
vec3 film(vec3 p, vec3 cam, float t) {
	vec3 V = normalize(cam - p);
	vec3 R = reflect(-V, vec3(0.0, 0.0, 1.0));
	float F = 0.02 + 0.98 * pow(1.0 - clamp(V.z, 0.0, 1.0), 5.0);
	float shimmer = 0.65 + 0.7 * n2(p.xy * 1.7 + vec2(0.0, t * 0.9)) * n2(p.xy * 0.6 - vec2(t * 0.3, 0.0));
	vec3 col = mix(hor, zen, clamp(R.z * 1.6, 0.0, 1.0)) * F * 0.55;
	vec3 toP = normalize(p - cam);
	for (int i = 0; i < LAMPS; i++) {
		if (i >= count) {
			break;
		}
		vec3 L = lamps[i].xyz;
		vec3 M = vec3(L.xy, 2.0 * p.z - L.z);
		vec3 toM = normalize(M - cam);
		vec3 side = normalize(cross(toM, vec3(0.0, 0.0, 1.0)));
		vec3 up = cross(side, toM);
		vec3 d = toP - toM;
		float dx = dot(d, side);
		float dy = dot(d, up);
		float s = exp(-dx * dx / 0.00005 - dy * dy / 0.006) * lamps[i].w / (1.0 + length(L.xy - p.xy) * 0.015);
		col += lamp_cols[i] * s * shimmer;
	}
	return col;
}

void fragment() {
	vec3 cam = vec3(CAMERA_POSITION_WORLD.x, -CAMERA_POSITION_WORLD.z, CAMERA_POSITION_WORLD.y) / mpu;
	ALBEDO = srgb_lin(film(vw, cam, TIME));
}
