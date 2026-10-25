shader_type sky;
// mojulo-godot kernel — THE SKY WITH A CLOUD DECK (since 0.31.0): kernel/sky.gdshader's dome (its gradient, stars, moon
// and sun, the same uniforms) with the page's undershot cloud deck over it (effects/effects-clouds.js, score.cloudDeck):
// the view ray meets the slab's near plane once, a 2D noise shape (fbm eroded by Worley puffs through the coverage
// pair) is its optical depth, lit by the sun's dual-lobe phase from below or self-shadowed from above, faded with
// distance and laid premultiplied over the dome. Drawn as a sky, the scene cuts it wherever geometry stands, as the
// page's depth clip does for every mesh nearer than the deck. The deck's maths is the fragment's, line for line (z up
// in the recipe's units: the eye ray and the camera come over from Godot's y-up metres). A level with no deck uses
// kernel/sky.gdshader, so nothing here can touch its sky.

uniform vec3 zenith : source_color = vec3(0.35, 0.55, 0.85);
uniform vec3 horizon : source_color = vec3(0.75, 0.82, 0.9);
uniform bool space = false;
uniform float stars = 0.0;
uniform float seed = 1.0;
uniform vec3 moon_dir = vec3(0.0, 1.0, 0.0);
uniform float moon_on = 0.0;
uniform vec3 sun_dir = vec3(0.0, 1.0, 0.0);
uniform float sun_on = 0.0;

// the deck (score.cloudDeck), z up, recipe units
uniform float mpu = 1.0;
uniform float base = 72.0;
uniform float top = 100.0;
uniform float thick = 28.0;
uniform float density = 0.42;
uniform vec3 albedo = vec3(0.95, 0.95, 0.95);
uniform float scale = 0.045;
uniform float worley = 0.099;
uniform vec2 drift = vec2(0.01, 0.006);
uniform float lo = 0.58;
uniform float hi = 0.86;
uniform vec3 deck_sun = vec3(0.0, 0.0, 1.0);
uniform vec3 sun_col = vec3(1.0, 0.94, 0.84);
uniform vec3 sky_col = vec3(0.52, 0.64, 0.86);
uniform vec3 gnd_col = vec3(0.3, 0.28, 0.25);
uniform float reach = 5.5;
uniform float phase_cap = 2.0;
uniform float max_dist = 900.0;
uniform float fade = 420.0;

const float SV_PI = 3.14159265;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + seed * 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// ── the deck: the fragment's noise, phase and shape (volume-lib.js VOLUME_NOISE_GLSL, VOLUME_PHASE_GLSL) ─────────────
float sv_hash13(vec3 p0) {
	vec3 p = fract(p0 * 0.1031);
	p += dot(p, p.yzx + 33.33);
	return fract((p.x + p.y) * p.z);
}

vec3 sv_hash33(vec3 p) {
	return vec3(sv_hash13(p), sv_hash13(p + 19.1), sv_hash13(p + 43.7));
}

float sv_noise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float n000 = sv_hash13(i);
	float n100 = sv_hash13(i + vec3(1.0, 0.0, 0.0));
	float n010 = sv_hash13(i + vec3(0.0, 1.0, 0.0));
	float n110 = sv_hash13(i + vec3(1.0, 1.0, 0.0));
	float n001 = sv_hash13(i + vec3(0.0, 0.0, 1.0));
	float n101 = sv_hash13(i + vec3(1.0, 0.0, 1.0));
	float n011 = sv_hash13(i + vec3(0.0, 1.0, 1.0));
	float n111 = sv_hash13(i + vec3(1.0, 1.0, 1.0));
	return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float sv_fbm(vec3 p0) {
	vec3 p = p0;
	float v = 0.0;
	float a = 0.55;
	for (int i = 0; i < 4; i++) {
		v += a * sv_noise(p);
		p = p * 2.02 + vec3(3.1, 1.7, 5.3);
		a *= 0.5;
	}
	return v;
}

float sv_worley(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	float d = 1.0;
	for (int x = -1; x <= 1; x++) {
		for (int y = -1; y <= 1; y++) {
			for (int z = -1; z <= 1; z++) {
				vec3 g = vec3(float(x), float(y), float(z));
				vec3 o = sv_hash33(i + g);
				vec3 r = g + o - f;
				d = min(d, dot(r, r));
			}
		}
	}
	return sqrt(d);
}

float sv_hg(float mu, float g) {
	float g2 = g * g;
	return (1.0 - g2) / (4.0 * SV_PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}

float sv_phase(float mu, float g_fwd, float g_back, float w_back, float cap) {
	return min(mix(sv_hg(mu, g_fwd), sv_hg(mu, g_back), w_back) * 4.0 * SV_PI, cap);
}

vec3 lin_srgb(vec3 c) {
	vec3 lo_c = c * 12.92;
	vec3 hi_c = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
	return mix(hi_c, lo_c, step(c, vec3(0.0031308)));
}

vec3 srgb_lin(vec3 c) {
	vec3 lo_c = c / 12.92;
	vec3 hi_c = pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
	return mix(hi_c, lo_c, step(c, vec3(0.04045)));
}

float deck_shape(vec3 p, float t_clock) {
	vec3 q = p * scale + vec3(t_clock * drift.x, t_clock * drift.y, 0.0);
	float b = sv_fbm(q);
	float puff = 1.0 - sv_worley(p * worley);
	return smoothstep(lo, hi, b + 0.24 * puff);
}

// the deck seen along rd from ro: premultiplied colour and its alpha (the fragment's main, past its depth clip)
vec4 deck(vec3 ro, vec3 rd, float t_clock) {
	float h_cam = ro.z;
	float d_u = rd.z;
	bool below = h_cam < base;
	bool above = h_cam > top;
	if ((!below && !above) || (below && d_u <= 1e-4) || (above && d_u >= -1e-4)) {
		return vec4(0.0);
	}
	float t = ((below ? base : top) - h_cam) / d_u;
	if (t > max_dist) {
		return vec4(0.0);
	}
	vec3 P = ro + rd * t;
	float shape = deck_shape(P, t_clock);
	if (shape < 0.002) {
		return vec4(0.0);
	}
	float od = shape * thick * density;
	float alpha = 1.0 - exp(-od);
	float mu = dot(rd, deck_sun);
	float phase = sv_phase(mu, 0.45, -0.18, 0.32, phase_cap);
	vec3 L;
	if (below) {
		float T = exp(-od * 0.6);
		L = sun_col * mix(0.12, 1.0, T) * phase + mix(gnd_col, sky_col, 0.35) * 0.9;
	} else {
		vec3 sun_flat = vec3(deck_sun.x, deck_sun.y, 0.0);
		float toward = deck_shape(P + sun_flat * reach, t_clock);
		float sh = exp(-toward * thick * density * 0.35);
		L = sun_col * sh * phase + sky_col * 0.65;
	}
	float a = alpha * exp(-t / fade);
	return vec4(albedo * L * a, a);
}

void sky() {
	vec3 d = EYEDIR;
	vec3 c = vec3(0.0);
	if (!space) {
		float t = pow(clamp(d.y * 1.05 + 0.06, 0.0, 1.0), 0.7);
		c = mix(horizon, zenith, t);
	}
	if (stars > 0.0 && (space || d.y > 0.0)) {
		vec3 cell = floor(d * 220.0);
		float h = hash(cell);
		if (h > 1.0 - 0.012 * stars) {
			c += vec3(0.6 + 0.4 * hash(cell + 7.0));
		}
	}
	if (moon_on > 0.0 && dot(d, normalize(moon_dir)) > 0.9994) {
		c = mix(c, vec3(0.92, 0.93, 0.96), moon_on);
	}
	if (sun_on > 0.0) {
		float s = dot(d, normalize(sun_dir));
		c += vec3(1.0, 0.95, 0.85) * sun_on * (smoothstep(0.9992, 0.9996, s) + 0.25 * pow(max(s, 0.0), 64.0));
	}
	// the deck over the dome, in the recipe's frame: z up from Godot's y, recipe units from its metres; laid over in the
	// display's sRGB as the page blends it over its canvas, the sky's colour linear on both sides
	vec4 cl = deck(vec3(POSITION.x, -POSITION.z, POSITION.y) / mpu, normalize(vec3(d.x, -d.z, d.y)), TIME);
	COLOR = srgb_lin(lin_srgb(c) * (1.0 - cl.a) + cl.rgb);
}
