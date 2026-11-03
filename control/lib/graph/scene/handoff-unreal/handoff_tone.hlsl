// THE PAGE'S TONE AND HAZE IN UNREAL: a post-process material replacing Unreal's tonemapper (bound by import_handoff.py
// on the level's unbound PostProcessVolume, exposure fixed at 1, no bloom, vignette, grain or occlusion of the engine's).
// The page renders with three's NeutralToneMapping (Khronos PBR Neutral, exposure 1) and encodes to sRGB; its haze is
// three's FogExp2, 1 - exp(-(density x depth)^2) by the view's depth, mixed over the encoded picture toward the haze's
// own colour (measured against the page: its far sea is the hex itself), the sky clear of it. Measured in Unreal 5.8: a material at this location
// writes the picture as it is (no encoding after it), so it encodes here. The body of its Custom node.
// Inputs: C (the scene's colour, linear), D (the scene's depth, cm), CD (the custom depth: the sea's, which is see-through
// and writes no depth of its own), Haze (the haze's colour, sRGB), HazeK (density per metre, the sky's depth in cm past
// which nothing is hazed). Returns the picture, sRGB.
float3 c = max(C.rgb, 0.0);
float x = min(c.r, min(c.g, c.b));
float offs = x < 0.08 ? x - 6.25 * x * x : 0.04;
c -= offs;
float peak = max(c.r, max(c.g, c.b));
if (peak >= 0.76) {
	float d = 0.24;
	float np = 1.0 - d * d / (peak + d - 0.76);
	c *= np / peak;
	float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0);
	c = lerp(c, np.xxx, g);
}
c = saturate(c);
float3 e = float3(c.r <= 0.0031308 ? c.r * 12.92 : 1.055 * pow(c.r, 1.0 / 2.4) - 0.055,
                  c.g <= 0.0031308 ? c.g * 12.92 : 1.055 * pow(c.g, 1.0 / 2.4) - 0.055,
                  c.b <= 0.0031308 ? c.b * 12.92 : 1.055 * pow(c.b, 1.0 / 2.4) - 0.055);
float z = min(D.r, CD.r);
float dm = z * 0.01 * HazeK.x;
float f = (HazeK.x > 0.0 && z < HazeK.y) ? 1.0 - exp(-dm * dm) : 0.0;
return lerp(e, Haze.rgb, f);
