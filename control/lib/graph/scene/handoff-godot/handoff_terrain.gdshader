// THE LAYERED GROUND IN GODOT (mojulo's scene/handoff.js landParts, bound by handoff_post_import.gd from handoff.json's
// `terrain`): the World page's fragment (scene/channels/form-land.js, `layeredGround`) ported line for line, so a form
// land's parts read in Godot as they read on the page. Each layer's texture along the face's dominant axis (the rock
// along both side axes on a turning face), its weight raised by its own height and by noise, its colour about its mean
// over the corner's solved base; the path's mask feathered by noise, its powder and clay; the undergrowth on a green
// land; the moss and the ledges' dirt on the rock; the scree thinned by its stones' dice; the trail's patches and dust;
// the ground's own parallax kinds (pebbles, cracked earth, plates); the scree's, clay's, undergrowth's and rock's marches
// near the camera; the sand wet by its height. Not here (the page's alone): the dunes' and the snow's own layers.
// The mesh's own space is mojulo's frame (z-up, metres: the GLB's root turns it to Godot's y-up), so the page's world
// position is the vertex as written; the corners' weights are CUSTOM0 (the GLB's TEXCOORD_2 and _3).
shader_type spatial;
render_mode cull_disabled, diffuse_lambert;

uniform sampler2DArray tBase : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2DArray tNorm : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2DArray tOrm : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tDice : filter_nearest_mipmap, repeat_enable;
uniform sampler2D tPath : filter_linear, repeat_disable;
uniform sampler2D tGrassL : filter_linear, repeat_disable;
uniform float uTile[7];
uniform vec3 uMean[7];
uniform float uRough = 1.0;
uniform float uHasPath = 0.0;
uniform vec2 uPathO;
uniform vec2 uPathM = vec2(1.0);
uniform vec2 uPathZ = vec2(0.0, 1.0);
uniform vec3 uPathBase;
uniform vec3 uStoneBase;
uniform vec3 uClayBase;
uniform vec3 uUnderBase;
uniform float uClay = 0.0;
uniform float uUnder = 0.0;
uniform float uHasG = 0.0;
uniform float uMoss = 0.0;
uniform vec2 uGOl;
uniform vec2 uGMl = vec2(1.0);
uniform vec4 uWet = vec4(-1e9, 1.0, 1.0, 1.0);
uniform vec3 uDress;
uniform vec3 uPatch;
uniform float uSdIn = 1.5;
// (the ground's parallax kinds, GROUND_PARALLAX: each kind's cell and depth, pebbles, cracks, plates; and the dry field's
// size, the trail's stretch and how near they are marched)
uniform vec3 uGpCell = vec3(0.09, 0.34, 0.75);
uniform vec3 uGpDepth = vec3(0.03, 0.035, 0.06);
uniform vec3 uGp = vec3(9.0, 7.0, 30.0);

varying vec4 vSplat;
varying vec3 vWPos;
varying vec3 vNrm;
varying vec3 vCam;

float hn(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hn(i), hn(i + vec2(1.0, 0.0)), f.x), mix(hn(i + vec2(0.0, 1.0)), hn(i + vec2(1.0, 1.0)), f.x), f.y); }
// (the ground's own parallax kinds, procedural: a Voronoi cell's distance, its edge and its dice; and each kind's height
// over its cells)
vec3 vor5(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); float d1 = 8.0; float d2 = 8.0; vec2 id = vec2(0.0);
	for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(float(x), float(y)); vec2 o = vec2(hn(i + g), hn(i + g + 17.3)) * 0.8 + 0.1; float d = length(g + o - f);
		if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
	} }
	return vec3(d1, d2 - d1, hn(id + 5.1));
}
float gHt(int k, vec2 p0) {
	vec2 p = p0;
	if (k > 0) { p += vec2(vn(p * 0.45), vn(p * 0.45 + 7.7)) * (k == 1 ? 0.8 : 1.6); }
	vec3 v = vor5(p);
	if (k == 0) { float r = mix(0.22, 0.46, fract(v.z * 7.3)); float q = clamp(v.x / r, 0.0, 1.0); return v.z < 0.28 ? 0.0 : sqrt(1.0 - q * q) * mix(0.6, 1.0, v.z); }
	if (k == 1) { return smoothstep(0.0, mix(0.012, 0.09, vn(p * 1.7 + 3.0)), v.y) * (0.8 + 0.2 * v.x); }
	return smoothstep(0.0, 0.05, v.y) * mix(0.35, 1.0, v.z);
}

void vertex() {
	vSplat = CUSTOM0;
	vWPos = VERTEX;
	vNrm = NORMAL;
	vCam = (inverse(MODEL_MATRIX) * vec4(INV_VIEW_MATRIX[3].xyz, 1.0)).xyz;
}

void fragment() {
	vec3 diffuse = COLOR.rgb;
	float roughnessFactor = 1.0;
	vec3 nW = normalize(vNrm) * (FRONT_FACING ? 1.0 : -1.0);
	vec3 aN = abs(nW);
	vec2 uvW; vec3 tT; vec3 tB;
	if (aN.z >= aN.x && aN.z >= aN.y) { uvW = vWPos.xy; tT = vec3(1.0, 0.0, 0.0); tB = vec3(0.0, 1.0, 0.0); }
	else if (aN.x >= aN.y) { uvW = vec2(vWPos.y * sign(nW.x), vWPos.z); tT = vec3(0.0, sign(nW.x), 0.0); tB = vec3(0.0, 0.0, 1.0); }
	else { uvW = vec2(-vWPos.x * sign(nW.y), vWPos.z); tT = vec3(-sign(nW.y), 0.0, 0.0); tB = vec3(0.0, 0.0, 1.0); }
	// the path: the mask at this point of the plan, on ground that faces up and at the trail's own height
	float pw = 0.0; float pd = 99.0;
	if (uHasPath > 0.5) {
		vec2 pu = (vWPos.xy - uPathO) / uPathM;
		if (pu.x > 0.0 && pu.y > 0.0 && pu.x < 1.0 && pu.y < 1.0) {
			vec4 pm = texture(tPath, pu);
			float pz = uPathZ.x + (pm.b * 255.0 * 256.0 + pm.a * 255.0) / 65535.0 * uPathZ.y;
			float onIt = smoothstep(0.6, 0.85, nW.z) * (1.0 - smoothstep(0.6, 1.5, abs(vWPos.z - pz)));
			pd = onIt > 0.0 ? pm.g * (uSdIn + uDress.z) - uSdIn : 99.0;
			float eN = vn(vWPos.xy / 0.9 + 3.7) * 0.65 + vn(vWPos.xy / 0.22 + 8.1) * 0.35 - 0.5; float eW = 0.35 + 0.55 * vn(vWPos.xy / 1.6 + 1.3);
			pw = (1.0 - smoothstep(-0.25, eW, pd + eN * 0.75)) * onIt;
		}
	}
	// (a face with no natural layer, the trail's own ribbons and the walls of its shelves: the path's material all over it)
	if (vSplat.x + vSplat.y + vSplat.z + vSplat.w < 0.01) { pw = 1.0; }
	float hgt[7]; vec3 bs[7]; vec3 ns[7]; vec2 rs[7];
	// the scree's parallax, near and only where there is scree
	vec2 scUV = uvW / uTile[1];
	float camD = length(vCam - vWPos); float pomK = 1.0 - smoothstep(18.0, 36.0, camD);
	if (vSplat.y > 0.001 && pomK > 0.0) {
		vec3 V = normalize(vCam - vWPos); vec3 vt = vec3(dot(V, tT), dot(V, tB), dot(V, nW));
		vec2 gx = dFdx(scUV); vec2 gy = dFdy(scUV); vec2 dP = vt.xy / max(vt.z, 0.25) * (0.08 / uTile[1]) * pomK / 16.0;
		float lay = 0.0; float hh = 1.0 - textureGrad(tOrm, vec3(scUV, 1.0), gx, gy).b;
		for (int k = 0; k < 16; k++) { if (lay >= hh) { break; } scUV -= dP; hh = 1.0 - textureGrad(tOrm, vec3(scUV, 1.0), gx, gy).b; lay += 1.0 / 16.0; }
	}
	// the clay's parallax, cheap
	vec2 clUV = uvW / uTile[5];
	if (pw > 0.001 && uClay > 0.0 && camD < 30.0) {
		vec3 V2 = normalize(vCam - vWPos); vec3 vt2 = vec3(dot(V2, tT), dot(V2, tB), dot(V2, nW));
		clUV -= vt2.xy / max(vt2.z, 0.3) * (texture(tOrm, vec3(clUV, 5.0)).b - 0.5) * (0.035 / uTile[5]) * (1.0 - smoothstep(15.0, 30.0, camD));
	}
	// the undergrowth's parallax: a short march near
	vec2 ugUV = uvW / uTile[6];
	if (uUnder > 0.5 && vSplat.z > 0.05 && camD < 20.0) {
		vec3 V3 = normalize(vCam - vWPos); vec3 vt3 = vec3(dot(V3, tT), dot(V3, tB), dot(V3, nW));
		vec2 dU = vt3.xy / max(vt3.z, 0.3) * (0.02 / uTile[6]) * (1.0 - smoothstep(10.0, 20.0, camD)) / 4.0;
		float l3 = 0.0; float h3 = 1.0 - texture(tOrm, vec3(ugUV, 6.0)).b;
		for (int k = 0; k < 4; k++) { if (l3 >= h3) { break; } ugUV -= dU; h3 = 1.0 - texture(tOrm, vec3(ugUV, 6.0)).b; l3 += 0.25; }
	}
	// the rock: on a face turning between the two side axes sampled along both and blended; its parallax near
	vec2 rkUV = uvW / uTile[0]; vec2 rk2 = vec2(0.0); vec3 rT2 = tT; vec3 rB2 = tB; float rkB = 0.0;
	if (aN.z < max(aN.x, aN.y) && vSplat.x > 0.001) {
		float bx = aN.x / max(1e-4, aN.x + aN.y);
		if (aN.x >= aN.y) { rk2 = vec2(-vWPos.x * sign(nW.y), vWPos.z); rT2 = vec3(-sign(nW.y), 0.0, 0.0); rkB = 0.5 * (1.0 - smoothstep(0.0, 0.12, bx - 0.5)); }
		else { rk2 = vec2(vWPos.y * sign(nW.x), vWPos.z); rT2 = vec3(0.0, sign(nW.x), 0.0); rkB = 0.5 * (1.0 - smoothstep(0.0, 0.12, 0.5 - bx)); }
		rB2 = vec3(0.0, 0.0, 1.0); rk2 /= uTile[0];
	}
	if (vSplat.x > 0.05 && camD < 26.0) {
		vec3 V4 = normalize(vCam - vWPos); vec3 vt4 = vec3(dot(V4, tT), dot(V4, tB), dot(V4, nW));
		vec2 gx4 = dFdx(rkUV); vec2 gy4 = dFdy(rkUV); vec2 dR = vt4.xy / max(vt4.z, 0.3) * (0.06 / uTile[0]) * (1.0 - smoothstep(14.0, 26.0, camD)) / 8.0;
		float l4 = 0.0; float h4 = 1.0 - textureGrad(tOrm, vec3(rkUV, 0.0), gx4, gy4).b;
		for (int k = 0; k < 8; k++) { if (l4 >= h4) { break; } rkUV -= dR; h4 = 1.0 - textureGrad(tOrm, vec3(rkUV, 0.0), gx4, gy4).b; l4 += 0.125; }
	}
	for (int i = 0; i < 7; i++) {
		vec3 a = vec3(i == 0 ? rkUV : i == 1 ? scUV : i == 5 ? clUV : i == 6 ? ugUV : uvW / uTile[i], float(i));
		vec4 o = texture(tOrm, a);
		hgt[i] = o.b; rs[i] = o.rg;
		bs[i] = texture(tBase, a).rgb / uMean[i];
		ns[i] = texture(tNorm, a).xyz * 2.0 - 1.0;
	}
	if (rkB > 0.001) {
		vec3 a2 = vec3(rk2, 0.0); vec4 o2 = texture(tOrm, a2); vec3 n2 = texture(tNorm, a2).xyz * 2.0 - 1.0;
		vec3 w1 = tT * ns[0].x + tB * ns[0].y + nW * ns[0].z; vec3 w2 = rT2 * n2.x + rB2 * n2.y + nW * n2.z; vec3 wb = normalize(mix(w1, w2, rkB));
		ns[0] = vec3(dot(wb, tT), dot(wb, tB), dot(wb, nW));
		hgt[0] = mix(hgt[0], o2.b, rkB); rs[0] = mix(rs[0], o2.rg, rkB); bs[0] = mix(bs[0], texture(tBase, a2).rgb / uMean[0], rkB);
	}
	// (dirt settles on the rock's ledges)
	float ledge = vSplat.x > 0.001 ? smoothstep(0.5, 0.85, (tT * ns[0].x + tB * ns[0].y + nW * ns[0].z).z) * (0.55 + 0.45 * vn(vWPos.xy / 1.2 + vWPos.z * 0.7 + 63.0)) + 0.3 * smoothstep(0.62, 0.85, nW.z) * smoothstep(0.5, 0.75, vn(vWPos.xy / 2.0 + 29.0)) : 0.0;
	// (the trail's dirt two: powder and clay by a wandering field)
	float clayK = clamp(uClay * (1.0 + 2.2 * (vn(vWPos.xy / 1.6 + 91.0) * 0.7 + vn(vWPos.xy / 0.55 + 13.0) * 0.3 - 0.5)), 0.0, 1.0);
	float cN = vn(vWPos.xy / 0.7 + 21.0) * 0.6 + vn(vWPos.xy / 0.18 + 5.5) * 0.4 - 0.5;
	float core = pd < 98.0 ? 1.0 - smoothstep(-0.7, -0.1, pd + cN * 0.6) : 0.0;
	clayK = clamp(clayK * mix(0.25, 1.0, core) + core * 0.35 * step(0.001, uClay), 0.0, 1.0);
	// (the cover on a green land)
	float gcov = uHasG > 0.5 ? texture(tGrassL, (vWPos.xy - uGOl) / uGMl).b : 1.0;
	float ugK = uUnder * clamp(0.62 + 0.5 * (vn(vWPos.xy / 3.5 + 47.0) - 0.5), 0.0, 1.0) * mix(0.6, 1.0, gcov);
	float ws[7];
	ws[0] = vSplat.x * (1.0 - pw); ws[1] = vSplat.y * (1.0 - pw); ws[2] = vSplat.z * (1.0 - pw) * (1.0 - ugK); ws[3] = vSplat.w * (1.0 - pw);
	ws[4] = pw * (1.0 - clayK); ws[5] = pw * clayK; ws[6] = vSplat.z * (1.0 - pw) * ugK;
	float toDirt = ws[0] * min(1.0, ledge) * 0.7; ws[0] -= toDirt; ws[2] += toDirt; float dirtFrac = toDirt / max(1e-4, ws[2]);
	// (the moss)
	float mossK = uMoss > 0.0 ? uMoss * smoothstep(0.3, 0.75, (tT * ns[0].x + tB * ns[0].y + nW * ns[0].z).z) * smoothstep(0.3, 0.6, vn(vWPos.xy / 1.8 + vWPos.z * 0.6 + 81.0) * 0.7 + vn(vWPos.xy / 0.5 + 7.0) * 0.3) : 0.0;
	float toMoss = ws[0] * min(1.0, mossK * 1.6); ws[0] -= toMoss; ws[6] += toMoss;
	// the scree thins out by its stones
	float wsum = max(1e-4, ws[0] + ws[1] + ws[2] + ws[3] + ws[4] + ws[5] + ws[6]); float sh = ws[1] / wsum * smoothstep(0.55, 0.8, nW.z);
	float sn = vn(vWPos.xy / 2.5 + 17.3) * 0.7 + vn(vWPos.xy / 0.8 + 5.1) * 0.3 - 0.5;
	float vergeW = uDress.x * (pd <= 0.05 ? 0.15 : exp(-pow((pd - 0.45) / 0.7, 2.0))) * smoothstep(0.6, 0.85, nW.z);
	sh = max(sh, pd < 98.0 ? vergeW * 0.9 : 0.0);
	// (the dice as the page loads them: an image, its first row at the top)
	float kept = sh > 0.001 ? step(texture(tDice, vec2(scUV.x, 1.0 - scUV.y)).r, min(1.0, sh * 1.2 + sn * 0.3 * min(1.0, sh * 4.0))) : 0.0;
	float top = 0.0; float steepF = 1.0 - smoothstep(0.5, 0.8, abs(nW.z));
	for (int i = 0; i < 7; i++) {
		float nz = vn(vWPos.xy / 2.5 + float(i) * 17.3) * 0.7 + vn(vWPos.xy / 0.8 + float(i) * 5.1) * 0.3 - 0.5;
		float nzF = vn(vWPos.xy / 0.35 + vWPos.z * 1.7 + float(i) * 3.1) - 0.5;
		ws[i] = i == 1 ? kept * 4.0 : ws[i] > 0.001 ? ws[i] + (hgt[i] * mix(0.35, 0.95, steepF) + nz * 0.35 + nzF * 0.35 * steepF) * min(1.0, ws[i] * 3.0) : 0.0;
		top = max(top, ws[i]);
	}
	float tw = 0.0; vec3 mb = vec3(0.0); vec3 mn = vec3(0.0); vec2 mr = vec2(0.0);
	for (int i = 0; i < 7; i++) { float w = max(ws[i] - (top - 0.08), 0.0); tw += w; mb += bs[i] * w; mr += rs[i] * w; mn += ns[i] * w; ws[i] = w; }
	mb /= max(1e-4, tw); mr /= max(1e-4, tw); mn = normalize(mn);
	// the trail's patches
	float tsh = (ws[4] + ws[5]) / max(1e-4, tw);
	float pkW = smoothstep(0.62, 0.72, vn(vWPos.xy / 2.2 + 11.0)) * uPatch.x * tsh; float pkD = smoothstep(0.7, 0.8, vn(vWPos.xy / 2.0 + 37.0)) * uPatch.y * tsh;
	float pkG = smoothstep(0.6, 0.7, vn(vWPos.xy / 1.8 + 71.0)) * uPatch.z * tsh;
	mb = mix(mb, bs[1], pkG); mn = normalize(mix(mn, ns[1], pkG)); mr = mix(mr, rs[1], pkG);
	mb *= mix(1.0, 1.15, pkW) * mix(1.0, 0.78, pkD); mn = normalize(mix(mn, vec3(0.0, 0.0, 1.0), 0.5 * pkW)); mr.y = mix(mr.y, 0.45, pkD);
	// the trail's dust
	float dust = (1.0 - 0.7 * ws[6] / max(1e-4, tw)) * uDress.y * (pd < 98.0 ? (1.0 - smoothstep(0.1, uDress.z * (0.45 + 0.55 * vn(vWPos.xy / 3.0 + 5.0)), pd)) * mix(0.45, 1.0, smoothstep(0.0, 0.6, pd)) : 0.0) * smoothstep(0.6, 0.85, nW.z);
	diffuse = mix(diffuse, uPathBase, ws[4] / max(1e-4, tw));
	diffuse = mix(diffuse, uClayBase, ws[5] / max(1e-4, tw));
	diffuse = mix(diffuse, uUnderBase, ws[6] / max(1e-4, tw));
	diffuse = mix(diffuse, uStoneBase, ws[1] / max(1e-4, tw));
	diffuse = mix(diffuse, mix(diffuse, uPathBase, 0.55), dirtFrac * ws[2] / max(1e-4, tw));
	diffuse *= mb * mix(1.0, mr.x, 0.5);
	roughnessFactor = clamp(mr.y * uRough, 0.04, 1.0);
	// the ground's own parallax kinds: pebbles, cracked earth, fractured plates
	{
		float sS = ws[2] / max(1e-4, tw); float rS = ws[0] / max(1e-4, tw);
		float gBare = uHasG > 0.5 ? 1.0 - texture(tGrassL, (vWPos.xy - uGOl) / uGMl).b : 1.0;
		float bare = sS * smoothstep(0.15, 0.7, gBare) * smoothstep(0.55, 0.8, nW.z);
		float dryF = smoothstep(0.45, 0.65, vn(vWPos.xy / uGp.x + 4.2));
		float tvF = vn(vWPos.xy / uGp.y + 55.0); float tPeb = 1.0 - smoothstep(0.28, 0.38, tvF); float tCrk = smoothstep(0.62, 0.72, tvF);
		float fines = vSplat.y * (1.0 - kept) * smoothstep(0.55, 0.8, nW.z) * (1.0 - pw);
		float wK0 = clamp(bare * (1.0 - dryF) + tsh * tPeb + fines * 0.9, 0.0, 1.0); float wK1 = clamp(bare * dryF + tsh * tCrk, 0.0, 1.0);
		float wK2 = rS * 0.85 * smoothstep(0.5, 0.62, vn(vWPos.xy / 6.0 + vWPos.z * 0.35 + 9.0)); float wMax = max(wK0, max(wK1, wK2));
		if (wMax > 0.02) {
			int kd = wK0 >= wMax ? 0 : wK1 >= wMax ? 1 : 2;
			float cellK = kd == 0 ? uGpCell.x : kd == 1 ? uGpCell.y : uGpCell.z;
			float depK = kd == 0 ? uGpDepth.x : kd == 1 ? uGpDepth.y : uGpDepth.z;
			vec2 gp = uvW / cellK;
			float detK = 1.0 - smoothstep(0.25, 0.7, length(fwidth(gp)));
			if (detK > 0.0) {
				if (camD < uGp.z) {
					vec3 V5 = normalize(vCam - vWPos); vec3 vt5 = vec3(dot(V5, tT), dot(V5, tB), dot(V5, nW));
					vec2 dG = vt5.xy / max(vt5.z, 0.3) * (depK / cellK) * (1.0 - smoothstep(uGp.z * 0.6, uGp.z, camD)) / 8.0;
					float lG = 0.0; float hG = 1.0 - gHt(kd, gp);
					for (int k = 0; k < 8; k++) { if (lG >= hG) { break; } gp -= dG; hG = 1.0 - gHt(kd, gp); lG += 0.125; }
				}
				float h0 = gHt(kd, gp); float hx = gHt(kd, gp + vec2(0.04, 0.0)); float hy = gHt(kd, gp + vec2(0.0, 0.04));
				vec3 gN = normalize(vec3((h0 - hx) * depK / (0.04 * cellK), (h0 - hy) * depK / (0.04 * cellK), 1.0));
				float wG = wMax * detK; float cz = vor5(gp).z;
				mn = normalize(mix(mn, gN, wG));
				float peb = step(0.001, h0);
				float tone = kd == 0 ? mix(0.9, mix(0.72, 1.2, cz) * mix(0.7, 1.05, h0), peb) : kd == 1 ? mix(0.42, 1.08, smoothstep(0.0, 0.6, h0)) : mix(0.62, 1.12, cz) * mix(0.55, 1.0, h0);
				diffuse *= mix(1.0, tone, wG);
				if (kd == 0) { diffuse = mix(diffuse, uStoneBase * tone * mix(0.85, 1.1, fract(cz * 13.0)), 0.7 * peb * wG); }
				roughnessFactor = mix(roughnessFactor, kd == 1 ? 0.95 : 0.8, wG * 0.5);
			}
		}
	}
	vec3 dustC = mix(uPathBase, vec3(dot(uPathBase, vec3(0.2126, 0.7152, 0.0722))), 0.35) * 1.25 * mix(vec3(1.0), mb, 0.3);
	diffuse = mix(diffuse, dustC, dust * 0.85); roughnessFactor = mix(roughnessFactor, 1.0, dust); mn = normalize(mix(mn, vec3(0.0, 0.0, 1.0), dust * 0.6));
	// (the sand wet by its height over the water)
	float wet = (1.0 - smoothstep(0.0, uWet.y, abs(vWPos.z - uWet.x + (vn(vWPos.xy / 1.7 + 3.1) - 0.5) * uWet.y * 0.8))) * ws[3] / max(1e-4, tw);
	diffuse *= mix(1.0, uWet.z, wet);
	roughnessFactor = mix(roughnessFactor, uWet.w, wet);
	ALBEDO = diffuse;
	ROUGHNESS = roughnessFactor;
	METALLIC = 0.0;
	NORMAL = normalize((VIEW_MATRIX * (MODEL_MATRIX * vec4(normalize(tT * mn.x + tB * mn.y + nW * mn.z), 0.0))).xyz);
}
