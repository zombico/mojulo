shader_type spatial;
render_mode unshaded, cull_disabled;
// mojulo-godot kernel — the TONE (since 0.23.0): a toned room stage (score.tone, era/tone.js) graded as the page grades it
// (channels/tone.js): the pixel's lit value (its vertex colour: the baked light), times `gain`, picks its colour off the
// surface's ramp (five stops, shadow → light), in `steps` hard bands when asked; a texture's own value shifts the colour
// inside its band by `detail` about `mid`. Darkness becomes the ramp's deepest colour, never black.

uniform vec3 ramp[5];
uniform float steps = 0.0;
uniform float gain = 1.0;
uniform float mid = 0.5;
uniform float detail = 0.0;
uniform bool has_map = false;
uniform sampler2D map : source_color, filter_linear_mipmap;

const vec3 W = vec3(0.2126, 0.7152, 0.0722);

float band(float x) {
	x = clamp(x, 0.0, 1.0);
	return steps > 0.5 ? (min(floor(x * steps), steps - 1.0) + 0.5) / steps : x;
}

vec3 ramp_at(float t) {
	float x = clamp(t, 0.0, 1.0) * 4.0;
	float i = min(3.0, floor(x));
	float f = x - i;
	vec3 a = ramp[0];
	vec3 b = ramp[1];
	if (i > 0.5) { a = ramp[1]; b = ramp[2]; }
	if (i > 1.5) { a = ramp[2]; b = ramp[3]; }
	if (i > 2.5) { a = ramp[3]; b = ramp[4]; }
	return mix(a, b, f);
}

void fragment() {
	float l = pow(max(dot(COLOR.rgb, W), 0.0), 0.4545);
	float t = band(l * gain);
	if (has_map) {
		float v = pow(max(dot(texture(map, UV).rgb, W), 0.0), 0.4545);
		t += (v - mid) * detail;
	}
	ALBEDO = ramp_at(t);
}
