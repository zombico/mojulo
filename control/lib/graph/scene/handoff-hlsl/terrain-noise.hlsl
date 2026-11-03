// THE LAYERED GROUND'S NOISE, shared by Unreal's and Unity's ports (handoff-unreal/handoff_terrain.hlsl,
// handoff-unity/MojuloTerrain.hlsl include it, handoff-common.js packSource): the page's hash, value noise, its cellular
// noise (the nearest cell's distance, the gap to the next and the cell's own hash) and the parallax kinds' heights
// (pebbles, cracked earth, plates), as the Godot port has them (handoff-godot/handoff_terrain.gdshader). Unreal's port
// keeps them in a struct (a Custom node defines no functions of its own), Unity's at file scope; the body calls them as
// MJ_VN, MJ_VOR5 and MJ_GHT, which each port defines.
float mj_hn(float2 p) { return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float mj_vn(float2 p) { float2 i = floor(p); float2 f = frac(p); f = f * f * (3.0 - 2.0 * f); return lerp(lerp(mj_hn(i), mj_hn(i + float2(1.0, 0.0)), f.x), lerp(mj_hn(i + float2(0.0, 1.0)), mj_hn(i + float2(1.0, 1.0)), f.x), f.y); }
float3 mj_vor5(float2 p) {
	float2 i = floor(p); float2 f = frac(p); float d1 = 8.0; float d2 = 8.0; float2 id = float2(0.0, 0.0);
	for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {
		float2 g = float2(float(x), float(y)); float2 o = float2(mj_hn(i + g), mj_hn(i + g + 17.3)) * 0.8 + 0.1; float d = length(g + o - f);
		if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
	} }
	return float3(d1, d2 - d1, mj_hn(id + 5.1));
}
float mj_gHt(int k, float2 p0) {
	float2 p = p0;
	if (k > 0) { p += float2(mj_vn(p * 0.45), mj_vn(p * 0.45 + 7.7)) * (k == 1 ? 0.8 : 1.6); }
	float3 v = mj_vor5(p);
	if (k == 0) { float r = lerp(0.22, 0.46, frac(v.z * 7.3)); float q = saturate(v.x / r); return v.z < 0.28 ? 0.0 : sqrt(1.0 - q * q) * lerp(0.6, 1.0, v.z); }
	if (k == 1) { return smoothstep(0.0, lerp(0.012, 0.09, mj_vn(p * 1.7 + 3.0)), v.y) * (0.8 + 0.2 * v.x); }
	return smoothstep(0.0, 0.05, v.y) * lerp(0.35, 1.0, v.z);
}
