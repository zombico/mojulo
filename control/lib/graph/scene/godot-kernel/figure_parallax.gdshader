// figure_parallax.gdshader — the realistic hero's clothes in depth (cloth-relief, realistic laws 12), kernel 0.31.0.
// The figure's imported material (its base colour times its vertex colour, its normal map, its ORM: occlusion,
// roughness, metalness on the same UVs) with its map UVs marched into the clothes' depth map along the view, in the
// tangent frame its TANGENT gives: the depth map white at the surface, black `depth` m in, `per_m` the UVs a metre spans
// across and along (the atlas is not square, so Godot's own heightmap, one scale for both, would stretch it). Applied by
// level.gd `_fix_parallax()` in place of a figure surface's material when score.figure_parallax names it; the
// World page's hero-live viewer marches the same.
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_disable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_disable;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap, repeat_disable;
uniform sampler2D height_tex : hint_default_white, filter_linear_mipmap, repeat_disable;
uniform float roughness_k = 1.0;
uniform float metallic_k = 1.0;
uniform float alpha_cut = 0.0;
uniform vec2 per_m = vec2(1.0, 1.0);
uniform float depth = 0.0;

void fragment() {
	vec2 uv = UV;
	vec3 vt = vec3(dot(VIEW, TANGENT), dot(VIEW, BINORMAL), dot(VIEW, NORMAL));
	if (vt.z > 0.08 && depth > 0.0) {
		vec2 dir = -vt.xy / vt.z * depth;
		vec2 duv = vec2(dir.x * per_m.x, -dir.y * per_m.y);
		float layer = 1.0 / 24.0;
		float d = 0.0;
		float h = 1.0 - texture(height_tex, uv).r;
		for (int i = 0; i < 24; i++) {
			if (d >= h) { break; }
			d += layer;
			uv += duv * layer;
			h = 1.0 - texture(height_tex, uv).r;
		}
	}
	vec4 a = texture(albedo_tex, uv);
	if (alpha_cut > 0.0 && a.a < alpha_cut) { discard; }
	ALBEDO = a.rgb * COLOR.rgb;
	NORMAL_MAP = texture(normal_tex, uv).rgb;
	vec3 orm = texture(orm_tex, uv).rgb;
	AO = orm.r;
	ROUGHNESS = orm.g * roughness_k;
	METALLIC = orm.b * metallic_k;
}
