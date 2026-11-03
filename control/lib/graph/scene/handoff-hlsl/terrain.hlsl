// THE LAYERED GROUND, shared by Unreal's and Unity's ports (handoff-unreal/handoff_terrain.hlsl,
// handoff-unity/MojuloTerrain.hlsl include it, handoff-common.js packSource): the World page's fragment
// (scene/channels/form-land.js, `layeredGround`) as the Godot port has it (handoff-godot/handoff_terrain.gdshader), line
// for line but for the frame, the samplers and the outputs, which each port supplies. Each layer's texture along the
// face's dominant axis (the rock along both side axes on a turning face), its weight raised by its own height and by
// noise, its colour about its mean over the corner's solved base; the path's mask feathered by noise, its powder and
// clay; the undergrowth on a green land; the moss and the ledges' dirt on the rock; the scree thinned by its stones'
// dice; the trail's patches and dust; the ground's own parallax kinds (pebbles, cracked earth, plates); the scree's,
// clay's, undergrowth's and rock's marches near the camera; the sand wet by its height. Not here (the page's alone): the
// dunes' and the snow's own layers.
// In, from the port, in mojulo's frame (z-up metres): vWPos (the world position), vCam (the camera's), nV (the vertex
// normal), face (the face's side, >= 0 its front), vSplat (the corners' weights, mojulo's order), Col (the corner's
// solved base), the read's numbers (TileA, TileB, M0..M6, PathOM, PathZ, Flags, GrassOM, Wet, Dress, Patch, GpCell,
// GpDepth, Gp, PathBase, StoneBase, ClayBase, UnderBase), the noise (MJ_VN, MJ_VOR5, MJ_GHT) and the samples (MJ_ARR_Orm,
// MJ_ARR_Base, MJ_ARR_Norm: the layers' arrays by (uv, layer) and gradients; MJ_LOD_PATH, MJ_LOD_GRASS; MJ_DICE). Out:
// diffuse (the base colour), roughnessFactor and nM (the shading normal, mojulo's frame), which the port writes out.
float uTile[7] = { TileA.x, TileA.y, TileA.z, TileA.w, TileB.x, TileB.y, TileB.z };
float3 uMean[7] = { M0.xyz, M1.xyz, M2.xyz, M3.xyz, M4.xyz, M5.xyz, M6.xyz };
float uRough = TileB.w;
float2 uPathO = PathOM.xy; float2 uPathM = max(PathOM.zw, 1e-4); float2 uPathZ = PathZ.xy; float uHasPath = PathZ.z; float uSdIn = PathZ.w;
float uClay = Flags.x; float uUnder = Flags.y; float uHasG = Flags.z; float uMoss = Flags.w;
float2 uGOl = GrassOM.xy; float2 uGMl = max(GrassOM.zw, 1e-4);
float4 uWet = Wet; float3 uDress = Dress.xyz; float3 uPatch = Patch.xyz; float3 uGpCell = GpCell.xyz; float3 uGpDepth = GpDepth.xyz; float3 uGp = Gp.xyz;
float3 uPathBase = PathBase.xyz; float3 uStoneBase = StoneBase.xyz; float3 uClayBase = ClayBase.xyz; float3 uUnderBase = UnderBase.xyz;
float3 diffuse = Col.rgb;
float roughnessFactor = 1.0;
// (the page's normal turned by the face's side, gl_FrontFacing: a face wound away from the eye is lit as its back)
float3 nW = nV * (face >= 0.0 ? 1.0 : -1.0);
float3 aN = abs(nW);
float2 uvW; float3 tT; float3 tB;
if (aN.z >= aN.x && aN.z >= aN.y) { uvW = vWPos.xy; tT = float3(1.0, 0.0, 0.0); tB = float3(0.0, 1.0, 0.0); }
else if (aN.x >= aN.y) { uvW = float2(vWPos.y * sign(nW.x), vWPos.z); tT = float3(0.0, sign(nW.x), 0.0); tB = float3(0.0, 0.0, 1.0); }
else { uvW = float2(-vWPos.x * sign(nW.y), vWPos.z); tT = float3(-sign(nW.y), 0.0, 0.0); tB = float3(0.0, 0.0, 1.0); }
// the path: the mask at this point of the plan, on ground that faces up and at the trail's own height
float pw = 0.0; float pd = 99.0;
if (uHasPath > 0.5) {
	float2 pu = (vWPos.xy - uPathO) / uPathM;
	if (pu.x > 0.0 && pu.y > 0.0 && pu.x < 1.0 && pu.y < 1.0) {
		float4 pm = MJ_LOD_PATH(pu, 0);
		float pz = uPathZ.x + (pm.b * 255.0 * 256.0 + pm.a * 255.0) / 65535.0 * uPathZ.y;
		float onIt = smoothstep(0.6, 0.85, nW.z) * (1.0 - smoothstep(0.6, 1.5, abs(vWPos.z - pz)));
		pd = onIt > 0.0 ? pm.g * (uSdIn + uDress.z) - uSdIn : 99.0;
		float eN = MJ_VN(vWPos.xy / 0.9 + 3.7) * 0.65 + MJ_VN(vWPos.xy / 0.22 + 8.1) * 0.35 - 0.5; float eW = 0.35 + 0.55 * MJ_VN(vWPos.xy / 1.6 + 1.3);
		pw = (1.0 - smoothstep(-0.25, eW, pd + eN * 0.75)) * onIt;
	}
}
// (a face with no natural layer, the trail's own ribbons and the walls of its shelves: the path's material all over it)
if (vSplat.x + vSplat.y + vSplat.z + vSplat.w < 0.01) { pw = 1.0; }
float hgt[7]; float3 bs[7]; float3 ns[7]; float2 rs[7];
// the scree's parallax, near and only where there is scree
float2 scUV = uvW / uTile[1];
float camD = length(vCam - vWPos); float pomK = 1.0 - smoothstep(18.0, 36.0, camD);
float2 sgx = ddx(scUV); float2 sgy = ddy(scUV);
if (vSplat.y > 0.001 && pomK > 0.0) {
	float3 V = normalize(vCam - vWPos); float3 vt = float3(dot(V, tT), dot(V, tB), dot(V, nW));
	float2 dP = vt.xy / max(vt.z, 0.25) * (0.08 / uTile[1]) * pomK / 16.0;
	float lay = 0.0; float hh = 1.0 - MJ_ARR_Orm(float3(scUV, 1.0), sgx, sgy).b;
	[loop] for (int k = 0; k < 16; k++) { if (lay >= hh) { break; } scUV -= dP; hh = 1.0 - MJ_ARR_Orm(float3(scUV, 1.0), sgx, sgy).b; lay += 1.0 / 16.0; }
}
// the clay's parallax, cheap
float2 clUV = uvW / uTile[5];
float2 cgx = ddx(clUV); float2 cgy = ddy(clUV);
if (pw > 0.001 && uClay > 0.0 && camD < 30.0) {
	float3 V2 = normalize(vCam - vWPos); float3 vt2 = float3(dot(V2, tT), dot(V2, tB), dot(V2, nW));
	clUV -= vt2.xy / max(vt2.z, 0.3) * (MJ_ARR_Orm(float3(clUV, 5.0), cgx, cgy).b - 0.5) * (0.035 / uTile[5]) * (1.0 - smoothstep(15.0, 30.0, camD));
}
// the undergrowth's parallax: a short march near
float2 ugUV = uvW / uTile[6];
float2 ugx = ddx(ugUV); float2 ugy = ddy(ugUV);
if (uUnder > 0.5 && vSplat.z > 0.05 && camD < 20.0) {
	float3 V3 = normalize(vCam - vWPos); float3 vt3 = float3(dot(V3, tT), dot(V3, tB), dot(V3, nW));
	float2 dU = vt3.xy / max(vt3.z, 0.3) * (0.02 / uTile[6]) * (1.0 - smoothstep(10.0, 20.0, camD)) / 4.0;
	float l3 = 0.0; float h3 = 1.0 - MJ_ARR_Orm(float3(ugUV, 6.0), ugx, ugy).b;
	[loop] for (int k = 0; k < 4; k++) { if (l3 >= h3) { break; } ugUV -= dU; h3 = 1.0 - MJ_ARR_Orm(float3(ugUV, 6.0), ugx, ugy).b; l3 += 0.25; }
}
// the rock: on a face turning between the two side axes sampled along both and blended; its parallax near
float2 rkUV = uvW / uTile[0]; float2 rk2 = float2(0.0, 0.0); float3 rT2 = tT; float3 rB2 = tB; float rkB = 0.0;
if (aN.z < max(aN.x, aN.y) && vSplat.x > 0.001) {
	float bx = aN.x / max(1e-4, aN.x + aN.y);
	if (aN.x >= aN.y) { rk2 = float2(-vWPos.x * sign(nW.y), vWPos.z); rT2 = float3(-sign(nW.y), 0.0, 0.0); rkB = 0.5 * (1.0 - smoothstep(0.0, 0.12, bx - 0.5)); }
	else { rk2 = float2(vWPos.y * sign(nW.x), vWPos.z); rT2 = float3(0.0, sign(nW.x), 0.0); rkB = 0.5 * (1.0 - smoothstep(0.0, 0.12, 0.5 - bx)); }
	rB2 = float3(0.0, 0.0, 1.0); rk2 /= uTile[0];
}
float2 rgx = ddx(rkUV); float2 rgy = ddy(rkUV);
if (vSplat.x > 0.05 && camD < 26.0) {
	float3 V4 = normalize(vCam - vWPos); float3 vt4 = float3(dot(V4, tT), dot(V4, tB), dot(V4, nW));
	float2 dR = vt4.xy / max(vt4.z, 0.3) * (0.06 / uTile[0]) * (1.0 - smoothstep(14.0, 26.0, camD)) / 8.0;
	float l4 = 0.0; float h4 = 1.0 - MJ_ARR_Orm(float3(rkUV, 0.0), rgx, rgy).b;
	[loop] for (int k = 0; k < 8; k++) { if (l4 >= h4) { break; } rkUV -= dR; h4 = 1.0 - MJ_ARR_Orm(float3(rkUV, 0.0), rgx, rgy).b; l4 += 0.125; }
}
float2 wgx = ddx(uvW); float2 wgy = ddy(uvW);
[unroll] for (int i = 0; i < 7; i++) {
	float2 uvI = i == 0 ? rkUV : i == 1 ? scUV : i == 5 ? clUV : i == 6 ? ugUV : uvW / uTile[i];
	float3 a = float3(uvI, float(i));
	float2 gx = wgx / uTile[i]; float2 gy = wgy / uTile[i];
	float4 o = MJ_ARR_Orm(a, gx, gy);
	hgt[i] = o.b; rs[i] = o.rg;
	bs[i] = MJ_ARR_Base(a, gx, gy).rgb / uMean[i];
	ns[i] = MJ_ARR_Norm(a, gx, gy).xyz * 2.0 - 1.0;
}
if (rkB > 0.001) {
	float3 a2 = float3(rk2, 0.0); float2 g2x = ddx(rk2); float2 g2y = ddy(rk2);
	float4 o2 = MJ_ARR_Orm(a2, g2x, g2y); float3 n2 = MJ_ARR_Norm(a2, g2x, g2y).xyz * 2.0 - 1.0;
	float3 w1 = tT * ns[0].x + tB * ns[0].y + nW * ns[0].z; float3 w2 = rT2 * n2.x + rB2 * n2.y + nW * n2.z; float3 wb = normalize(lerp(w1, w2, rkB));
	ns[0] = float3(dot(wb, tT), dot(wb, tB), dot(wb, nW));
	hgt[0] = lerp(hgt[0], o2.b, rkB); rs[0] = lerp(rs[0], o2.rg, rkB); bs[0] = lerp(bs[0], MJ_ARR_Base(a2, g2x, g2y).rgb / uMean[0], rkB);
}
// (dirt settles on the rock's ledges)
float ledge = vSplat.x > 0.001 ? smoothstep(0.5, 0.85, (tT * ns[0].x + tB * ns[0].y + nW * ns[0].z).z) * (0.55 + 0.45 * MJ_VN(vWPos.xy / 1.2 + vWPos.z * 0.7 + 63.0)) + 0.3 * smoothstep(0.62, 0.85, nW.z) * smoothstep(0.5, 0.75, MJ_VN(vWPos.xy / 2.0 + 29.0)) : 0.0;
// (the trail's dirt two: powder and clay by a wandering field)
float clayK = saturate(uClay * (1.0 + 2.2 * (MJ_VN(vWPos.xy / 1.6 + 91.0) * 0.7 + MJ_VN(vWPos.xy / 0.55 + 13.0) * 0.3 - 0.5)));
float cN = MJ_VN(vWPos.xy / 0.7 + 21.0) * 0.6 + MJ_VN(vWPos.xy / 0.18 + 5.5) * 0.4 - 0.5;
float core = pd < 98.0 ? 1.0 - smoothstep(-0.7, -0.1, pd + cN * 0.6) : 0.0;
clayK = saturate(clayK * lerp(0.25, 1.0, core) + core * 0.35 * step(0.001, uClay));
// (the cover on a green land)
float gcov = uHasG > 0.5 ? MJ_LOD_GRASS((vWPos.xy - uGOl) / uGMl, 0).b : 1.0;
float ugK = uUnder * saturate(0.62 + 0.5 * (MJ_VN(vWPos.xy / 3.5 + 47.0) - 0.5)) * lerp(0.6, 1.0, gcov);
float ws[7];
ws[0] = vSplat.x * (1.0 - pw); ws[1] = vSplat.y * (1.0 - pw); ws[2] = vSplat.z * (1.0 - pw) * (1.0 - ugK); ws[3] = vSplat.w * (1.0 - pw);
ws[4] = pw * (1.0 - clayK); ws[5] = pw * clayK; ws[6] = vSplat.z * (1.0 - pw) * ugK;
float toDirt = ws[0] * min(1.0, ledge) * 0.7; ws[0] -= toDirt; ws[2] += toDirt; float dirtFrac = toDirt / max(1e-4, ws[2]);
// (the moss)
float mossK = uMoss > 0.0 ? uMoss * smoothstep(0.3, 0.75, (tT * ns[0].x + tB * ns[0].y + nW * ns[0].z).z) * smoothstep(0.3, 0.6, MJ_VN(vWPos.xy / 1.8 + vWPos.z * 0.6 + 81.0) * 0.7 + MJ_VN(vWPos.xy / 0.5 + 7.0) * 0.3) : 0.0;
float toMoss = ws[0] * min(1.0, mossK * 1.6); ws[0] -= toMoss; ws[6] += toMoss;
// the scree thins out by its stones
float wsum = max(1e-4, ws[0] + ws[1] + ws[2] + ws[3] + ws[4] + ws[5] + ws[6]); float sh = ws[1] / wsum * smoothstep(0.55, 0.8, nW.z);
float sn = MJ_VN(vWPos.xy / 2.5 + 17.3) * 0.7 + MJ_VN(vWPos.xy / 0.8 + 5.1) * 0.3 - 0.5;
float vergeW = uDress.x * (pd <= 0.05 ? 0.15 : exp(-pow((pd - 0.45) / 0.7, 2.0))) * smoothstep(0.6, 0.85, nW.z);
sh = max(sh, pd < 98.0 ? vergeW * 0.9 : 0.0);
// (the dice as the page loads them: an image, its first row at the top)
float kept = sh > 0.001 ? step(MJ_DICE(float2(scUV.x, 1.0 - scUV.y), float2(sgx.x, -sgx.y), float2(sgy.x, -sgy.y)).r, min(1.0, sh * 1.2 + sn * 0.3 * min(1.0, sh * 4.0))) : 0.0;
float top = 0.0; float steepF = 1.0 - smoothstep(0.5, 0.8, abs(nW.z));
[unroll] for (int i2 = 0; i2 < 7; i2++) {
	float nz = MJ_VN(vWPos.xy / 2.5 + float(i2) * 17.3) * 0.7 + MJ_VN(vWPos.xy / 0.8 + float(i2) * 5.1) * 0.3 - 0.5;
	float nzF = MJ_VN(vWPos.xy / 0.35 + vWPos.z * 1.7 + float(i2) * 3.1) - 0.5;
	ws[i2] = i2 == 1 ? kept * 4.0 : ws[i2] > 0.001 ? ws[i2] + (hgt[i2] * lerp(0.35, 0.95, steepF) + nz * 0.35 + nzF * 0.35 * steepF) * min(1.0, ws[i2] * 3.0) : 0.0;
	top = max(top, ws[i2]);
}
float tw = 0.0; float3 mb = float3(0.0, 0.0, 0.0); float3 mn = float3(0.0, 0.0, 0.0); float2 mr = float2(0.0, 0.0);
[unroll] for (int i3 = 0; i3 < 7; i3++) { float w = max(ws[i3] - (top - 0.08), 0.0); tw += w; mb += bs[i3] * w; mr += rs[i3] * w; mn += ns[i3] * w; ws[i3] = w; }
mb /= max(1e-4, tw); mr /= max(1e-4, tw); mn = normalize(mn);
// the trail's patches
float tsh = (ws[4] + ws[5]) / max(1e-4, tw);
float pkW = smoothstep(0.62, 0.72, MJ_VN(vWPos.xy / 2.2 + 11.0)) * uPatch.x * tsh; float pkD = smoothstep(0.7, 0.8, MJ_VN(vWPos.xy / 2.0 + 37.0)) * uPatch.y * tsh;
float pkG = smoothstep(0.6, 0.7, MJ_VN(vWPos.xy / 1.8 + 71.0)) * uPatch.z * tsh;
mb = lerp(mb, bs[1], pkG); mn = normalize(lerp(mn, ns[1], pkG)); mr = lerp(mr, rs[1], pkG);
mb *= lerp(1.0, 1.15, pkW) * lerp(1.0, 0.78, pkD); mn = normalize(lerp(mn, float3(0.0, 0.0, 1.0), 0.5 * pkW)); mr.y = lerp(mr.y, 0.45, pkD);
// the trail's dust
float dust = (1.0 - 0.7 * ws[6] / max(1e-4, tw)) * uDress.y * (pd < 98.0 ? (1.0 - smoothstep(0.1, uDress.z * (0.45 + 0.55 * MJ_VN(vWPos.xy / 3.0 + 5.0)), pd)) * lerp(0.45, 1.0, smoothstep(0.0, 0.6, pd)) : 0.0) * smoothstep(0.6, 0.85, nW.z);
diffuse = lerp(diffuse, uPathBase, ws[4] / max(1e-4, tw));
diffuse = lerp(diffuse, uClayBase, ws[5] / max(1e-4, tw));
diffuse = lerp(diffuse, uUnderBase, ws[6] / max(1e-4, tw));
diffuse = lerp(diffuse, uStoneBase, ws[1] / max(1e-4, tw));
diffuse = lerp(diffuse, lerp(diffuse, uPathBase, 0.55), dirtFrac * ws[2] / max(1e-4, tw));
diffuse *= mb * lerp(1.0, mr.x, 0.5);
roughnessFactor = clamp(mr.y * uRough, 0.04, 1.0);
// the ground's own parallax kinds: pebbles, cracked earth, fractured plates
{
	float sS = ws[2] / max(1e-4, tw); float rS = ws[0] / max(1e-4, tw);
	float gBare = uHasG > 0.5 ? 1.0 - MJ_LOD_GRASS((vWPos.xy - uGOl) / uGMl, 0).b : 1.0;
	float bare = sS * smoothstep(0.15, 0.7, gBare) * smoothstep(0.55, 0.8, nW.z);
	float dryF = smoothstep(0.45, 0.65, MJ_VN(vWPos.xy / uGp.x + 4.2));
	float tvF = MJ_VN(vWPos.xy / uGp.y + 55.0); float tPeb = 1.0 - smoothstep(0.28, 0.38, tvF); float tCrk = smoothstep(0.62, 0.72, tvF);
	float fines = vSplat.y * (1.0 - kept) * smoothstep(0.55, 0.8, nW.z) * (1.0 - pw);
	float wK0 = saturate(bare * (1.0 - dryF) + tsh * tPeb + fines * 0.9); float wK1 = saturate(bare * dryF + tsh * tCrk);
	float wK2 = rS * 0.85 * smoothstep(0.5, 0.62, MJ_VN(vWPos.xy / 6.0 + vWPos.z * 0.35 + 9.0)); float wMax = max(wK0, max(wK1, wK2));
	if (wMax > 0.02) {
		int kd = wK0 >= wMax ? 0 : wK1 >= wMax ? 1 : 2;
		float cellK = kd == 0 ? uGpCell.x : kd == 1 ? uGpCell.y : uGpCell.z;
		float depK = kd == 0 ? uGpDepth.x : kd == 1 ? uGpDepth.y : uGpDepth.z;
		float2 gp = uvW / cellK;
		float detK = 1.0 - smoothstep(0.25, 0.7, length(fwidth(gp)));
		if (detK > 0.0) {
			if (camD < uGp.z) {
				float3 V5 = normalize(vCam - vWPos); float3 vt5 = float3(dot(V5, tT), dot(V5, tB), dot(V5, nW));
				float2 dG = vt5.xy / max(vt5.z, 0.3) * (depK / cellK) * (1.0 - smoothstep(uGp.z * 0.6, uGp.z, camD)) / 8.0;
				float lG = 0.0; float hG = 1.0 - MJ_GHT(kd, gp);
				[loop] for (int k = 0; k < 8; k++) { if (lG >= hG) { break; } gp -= dG; hG = 1.0 - MJ_GHT(kd, gp); lG += 0.125; }
			}
			float h0 = MJ_GHT(kd, gp); float hx = MJ_GHT(kd, gp + float2(0.04, 0.0)); float hy = MJ_GHT(kd, gp + float2(0.0, 0.04));
			float3 gN = normalize(float3((h0 - hx) * depK / (0.04 * cellK), (h0 - hy) * depK / (0.04 * cellK), 1.0));
			float wG = wMax * detK; float cz = MJ_VOR5(gp).z;
			mn = normalize(lerp(mn, gN, wG));
			float peb = step(0.001, h0);
			float tone = kd == 0 ? lerp(0.9, lerp(0.72, 1.2, cz) * lerp(0.7, 1.05, h0), peb) : kd == 1 ? lerp(0.42, 1.08, smoothstep(0.0, 0.6, h0)) : lerp(0.62, 1.12, cz) * lerp(0.55, 1.0, h0);
			diffuse *= lerp(1.0, tone, wG);
			if (kd == 0) { diffuse = lerp(diffuse, uStoneBase * tone * lerp(0.85, 1.1, frac(cz * 13.0)), 0.7 * peb * wG); }
			roughnessFactor = lerp(roughnessFactor, kd == 1 ? 0.95 : 0.8, wG * 0.5);
		}
	}
}
float3 dustC = lerp(uPathBase, dot(uPathBase, float3(0.2126, 0.7152, 0.0722)).xxx, 0.35) * 1.25 * lerp(float3(1.0, 1.0, 1.0), mb, 0.3);
diffuse = lerp(diffuse, dustC, dust * 0.85); roughnessFactor = lerp(roughnessFactor, 1.0, dust); mn = normalize(lerp(mn, float3(0.0, 0.0, 1.0), dust * 0.6));
// (the sand wet by its height over the water)
float wet = (1.0 - smoothstep(0.0, uWet.y, abs(vWPos.z - uWet.x + (MJ_VN(vWPos.xy / 1.7 + 3.1) - 0.5) * uWet.y * 0.8))) * ws[3] / max(1e-4, tw);
diffuse *= lerp(1.0, uWet.z, wet);
roughnessFactor = lerp(roughnessFactor, uWet.w, wet);
float3 nM = normalize(tT * mn.x + tB * mn.y + nW * mn.z);
