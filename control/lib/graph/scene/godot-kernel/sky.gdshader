shader_type sky;
// mojulo-godot kernel — the SKY DOME (since 0.23.0): the page's dome (channels/sky-dome.js, score.skyDome) as a sky: a
// horizon-to-zenith gradient (t = (up · 1.05 + 0.06)^0.7, z-up there, y-up here), night stars over the upper dome, the
// moon and the sun as discs; the void of space with stars all round. Drawn as a sky, so the fog never reaches it (the
// page's dome and stars stand outside its fog too).

uniform vec3 zenith : source_color = vec3(0.35, 0.55, 0.85);
uniform vec3 horizon : source_color = vec3(0.75, 0.82, 0.9);
uniform bool space = false;
uniform float stars = 0.0;      // how many: the page's count over 900 (2000 in space), by how deep the night is
uniform float seed = 1.0;
uniform vec3 moon_dir = vec3(0.0, 1.0, 0.0);
uniform float moon_on = 0.0;
uniform vec3 sun_dir = vec3(0.0, 1.0, 0.0);
uniform float sun_on = 0.0;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + seed * 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
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
	COLOR = c;
}
