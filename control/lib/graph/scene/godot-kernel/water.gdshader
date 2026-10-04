// water.gdshader — the mojulo water look (aqua rendering), kernel 0.4.0.
// The Godot lowering of the World page's aqua shader (lib/graph/scene/channels/aqua-glsl.js). Godot's glTF import drops
// KHR_materials_transmission / ior / volume, so a `water:<kind>` node would arrive as an opaque lit sheet; level.gd
// `_fix_water()` gives its surfaces this material from score.water instead. Per pixel:
//   thickness   the depth texture behind the water minus the water's own distance → the view ray's path through it
//   clarity     Beer–Lambert per channel, T = exp(−σ·d), over the SCREEN texture (refracted by the ripple normal),
//               so the bed loses red first — the chroma the web page's single alpha can only approximate
//   shore foam  water thinner than `shore` froths, in bands that lap toward the edge
//   reflection  Schlick Fresnel (F0 0.02) toward an analytic sky (score zenith/horizon) + a GGX sun glint
//   ripples     two fBm layers drifting along `flow`, fading below a pixel; they tilt the normal only
// Ripple and flow coordinates are mojulo's ground plane (x, −z in Godot's y-up frame), so a recipe's flow reads the
// same here as on the page. Unshaded: the level is baked, and the water carries its own light.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_always, blend_mix;

uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform vec3 sigma = vec3(0.45, 0.09, 0.06);
uniform vec3 tint = vec3(0.03, 0.27, 0.32);
uniform vec3 zenith = vec3(0.16, 0.3, 0.52);
uniform vec3 horizon = vec3(0.62, 0.7, 0.78);
uniform vec3 foam_color = vec3(0.86, 0.92, 0.96);
uniform vec3 sun_dir = vec3(0.4, 0.8, 0.3);
uniform float roughness = 0.06;
uniform float reflectivity = 1.0;
uniform float ripple_scale = 0.3;
uniform float ripple_slope = 0.2;
uniform float ripple_speed = 0.5;
uniform vec2 flow = vec2(0.6, 0.8);
uniform float still = 1.0;
uniform float shore = 1.0;
uniform float refraction = 0.03;
// 1 = a frozen sea/river: the page lights it with a sun and ambient (its body colour is a lit material there)
uniform float lit = 0.0;

varying vec3 wp;
varying vec3 body;

float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
}
float fbm(vec2 p, float fq) {
	float s = 0.0, a = 0.5, f = 1.0; mat2 R = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8));
	for (int i = 0; i < 5; i++) { s += a * (vnoise(p * f) - 0.5) * clamp(1.6 - 2.0 * fq * f, 0.0, 1.0); p = R * p + 7.3; f *= 2.03; a *= 0.5; }
	return s;
}
float ripple(vec2 q, float fq) {
	float t = TIME * ripple_speed * ripple_scale; vec2 side = vec2(-flow.y, flow.x);
	float a = fbm(q - flow * t, fq);
	return a + 0.7 * fbm(q * 1.7 - mix(flow * 1.6, -side * 0.6, still) * t + 1.3 * a + 11.0, fq * 1.7);
}

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// Godot hands a custom shader the GLB's COLOR_0 sRGB-encoded; the look's maths is linear
	vec3 c = COLOR.rgb;
	body = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

// a view-space point behind this pixel, from the depth texture
float scene_dist(vec2 uv, mat4 inv_proj) {
	float d = texture(depth_tex, uv).r;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	vec3 ndc = vec3(uv, d) * 2.0 - 1.0;
#else
	vec3 ndc = vec3(uv * 2.0 - 1.0, d);
#endif
	vec4 v = inv_proj * vec4(ndc, 1.0);
	return length(v.xyz / v.w);
}

void fragment() {
	vec2 p = vec2(wp.x, -wp.z);                                    // mojulo's ground plane
	float fp = max(length(fwidth(wp)), 1e-5), fq = fp * ripple_scale, e = 0.08;
	vec2 q = p * ripple_scale;
	float h0 = ripple(q, fq);
	vec2 s = vec2(ripple(q + vec2(e, 0.0), fq) - h0, ripple(q + vec2(0.0, e), fq) - h0) / e;
	vec3 ng = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);   // the mesh normal, world
	vec3 V = normalize(CAMERA_POSITION_WORLD - wp);
	if (dot(ng, V) < 0.0) ng = -ng;
	vec3 g = vec3(s.x, 0.0, -s.y);                                  // the slope in Godot's frame
	vec3 n = normalize(ng - ripple_slope * (g - ng * dot(ng, g)));

	// thickness along the view ray, and straight down
	float wd = length(VERTEX);
	float th = max(scene_dist(SCREEN_UV, INV_PROJECTION_MATRIX) - wd, 0.0);
	float hz = th * abs(dot(V, ng));
	// refraction: shift the bed by the ripple; keep the shift only where the shifted point is still behind the water
	vec2 ruv = SCREEN_UV + n.xz * refraction * clamp(th, 0.0, 1.0);
	if (scene_dist(ruv, INV_PROJECTION_MATRIX) < wd) ruv = SCREEN_UV;
	vec3 bed = textureLod(screen_tex, ruv, 0.0).rgb;

	vec3 Tv = exp(-sigma * th);
	float T = dot(Tv, vec3(0.3, 0.45, 0.25));
	float shoreF = shore > 0.0 ? (1.0 - smoothstep(0.0, shore, hz)) * (0.5 + 0.22 * sin(hz / shore * 7.0 - TIME * 2.2)) : 0.0;
	float froth = smoothstep(0.36, 0.62, shoreF + 0.5 * (vnoise(p * ripple_scale * 4.0 + flow * TIME * 0.4) - 0.5));
	vec3 Ls = normalize(sun_dir);
	vec3 lb = body * mix(1.0, 0.3 + 0.75 * max(dot(n, Ls), 0.0), lit);
	vec3 bc = mix(lb, tint * (0.55 + 0.45 * max(dot(normalize(sun_dir), ng), 0.0)), T * (1.0 - T) * 3.2 + 0.25 * T);
	vec3 col = bed * Tv + bc * (1.0 - T);
	col = mix(col, foam_color, froth);

	float F = clamp((0.02 + 0.98 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0)) * reflectivity, 0.0, 1.0) * (1.0 - froth);
	vec3 r = reflect(-V, n); r.y = abs(r.y) * 0.85 + 0.15 * max(r.y, 0.0); r = normalize(r);
	vec3 sky = mix(horizon, zenith, pow(max(r.y, 0.0), 0.55));
	col = mix(col, sky, F);
	vec3 L = normalize(sun_dir), H = normalize(L + V);
	float a = clamp(roughness + 0.6 * fp * ripple_scale, 0.01, 0.6), a2 = a * a * a * a;
	float nh = max(dot(n, H), 0.0), dd = nh * nh * (a2 - 1.0) + 1.0;
	float D = a2 / (3.14159 * dd * dd), Fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
	col += vec3(1.0, 0.95, 0.86) * min(D * Fh * 0.25 * max(dot(n, L), 0.0), 12.0) * (1.0 - froth);
	ALBEDO = col;
}
