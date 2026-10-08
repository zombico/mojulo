// look_coat.gdshader — a status's COAT (playscape looks), kernel 0.6.0: the Godot lowering of the World page's fresnel
// coat (status-channel __elCoatMat). Laid by kernel/looks.gd as a MeshInstance3D's material_overlay, so the body's own
// materials stay untouched: a rim pow(1 - |n·v|, power) × k in the look's colour, or in black (dark: kokusen's flash).
// The facet normal comes from screen-space derivatives of the view-space position, as rim.gdshader's does (a packed
// GLB ships no NORMAL). A transit drives the same overlay: stripes (a hologram's scanlines) and a band of light at a
// world height (a scan's plane); the body's own fade is its GeometryInstance3D.transparency.
shader_type spatial;
render_mode unshaded, blend_mix, cull_back, depth_draw_never;

uniform vec3 coat_color : source_color = vec3(0.6, 0.8, 1.0);
uniform float k = 0.0;
uniform float power = 2.0;
uniform float dark = 0.0;
uniform float stripes = 0.0;
uniform float band = 0.0;
uniform float band_y = 0.0;

void fragment() {
	vec3 n = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	float d = abs(dot(n, normalize(VIEW)));
	float rim = clamp(pow(1.0 - clamp(d, 0.0, 1.0), power) * k, 0.0, 1.0);
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float st = stripes * (0.55 + 0.45 * sin(wp.y * 60.0 - TIME * 8.0));
	float bd = band * exp(-pow((wp.y - band_y) * 14.0, 2.0));
	ALBEDO = dark > 0.5 ? vec3(0.0) : coat_color + vec3(bd);
	ALPHA = clamp(rim + st * 0.6 + bd, 0.0, 1.0);
}
