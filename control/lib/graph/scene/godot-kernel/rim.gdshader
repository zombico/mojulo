// rim.gdshader — the figure rim (shader-look phase 4), kernel 0.2.3.
// The one runtime look term the bake cannot carry: an additive fresnel edge light, the Godot
// lowering of the World page's __rimPatch (rig-preview / controllable channels). Applied by
// level.gd `_apply_rim()` as a NEXT_PASS on every surface of a figure that score.look.figures
// names, with `rim_color` = [r,g,b] × strength in alpha and `rim_power` from the same five
// numbers the web renderer reads. The GLB ships no NORMAL for packed figures (and Godot's
// runtime GLTFDocument import generates none), so the facet normal is derived per pixel from
// screen-space derivatives of the view-space position — the SAME construction as the web
// patch's dFdx/dFdy normal, orientation-fixed toward the camera.
shader_type spatial;
render_mode unshaded, blend_add, cull_back, depth_draw_never;

uniform vec4 rim_color : source_color = vec4(0.4, 0.6, 1.0, 0.5);
uniform float rim_power = 3.0;

void fragment() {
	vec3 n = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	float d = dot(n, normalize(VIEW));
	if (d < 0.0) { d = -d; }
	float f = pow(1.0 - clamp(d, 0.0, 1.0), rim_power);
	ALBEDO = rim_color.rgb * (rim_color.a * f);
}
