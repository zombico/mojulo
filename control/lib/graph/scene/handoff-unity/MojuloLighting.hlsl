// MojuloLighting.hlsl - how mojulo's shaders light a surface in Unity (scene/handoff-unity.js): the page's
// MeshStandardMaterial (three's) under URP's lights, as the handoff's record lights it, out = base x light:
//   - a light's colour as URP hands it is the solve's level (the importer sets intensity = the record's / pi, measured
//     in 6000.2 against a white surface: a light of intensity I lights it to I x N.L, no 1/pi of Unity's), so the
//     diffuse is albedo x light x N.L (three's Lambert over pi x the level) and the specular three's GGX (Schlick's
//     Fresnel, the height-correlated Smith visibility, GGX's distribution) times pi x light x N.L
//   - URP's inverse-squared window for points and spots is three's: (1 - (d/range)^4)^2 / d^2
//   - the ambient the scene's flat colour (the solve's), diffuse only, by the surface's occlusion: no sky lighting, no
//     reflection of the environment (three with no environment map)
//   - no fog: the page's haze is exp-squared over the toned picture, the tone pass's (MojuloTone.shader)
// Also the frames: mojulo's (z-up metres) and Unity's (glTFast mirrors glTF's x; glTF is mojulo's x, z, -y).
#ifndef MOJULO_LIGHTING_INCLUDED
#define MOJULO_LIGHTING_INCLUDED

#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

float3 MojuloFromUnity(float3 p) { return float3(-p.x, -p.z, p.y); }
float3 UnityFromMojulo(float3 p) { return float3(-p.x, p.z, -p.y); }

// three's BRDF_GGX
half3 MojuloGGX(half3 F0, half rough, half3 N, half3 L, half3 V)
{
    float r = clamp(rough, 0.0525, 1.0);
    float a2 = r * r * r * r;
    float3 H = normalize(L + V);
    float nl = saturate(dot(N, L)), nv = saturate(dot(N, V)), nh = saturate(dot(N, H)), vh = saturate(dot(V, H));
    float fr = exp2((-5.55473 * vh - 6.98316) * vh);
    float3 F = F0 * (1.0 - fr) + fr;
    float gv = nl * sqrt(a2 + (1.0 - a2) * nv * nv);
    float gl = nv * sqrt(a2 + (1.0 - a2) * nl * nl);
    float Vis = 0.5 / max(gv + gl, 1e-6);
    float dd = nh * nh * (a2 - 1.0) + 1.0;
    float D = a2 / (PI * dd * dd);
    return F * (Vis * D);
}

half3 MojuloDirect(Light l, half3 N, half3 V, half3 diffuse, half3 F0, half rough)
{
    half nl = saturate(dot(N, l.direction));
    half3 radiance = l.color * (l.distanceAttenuation * l.shadowAttenuation * nl);
    return radiance * (diffuse + PI * MojuloGGX(F0, rough, N, l.direction, V));
}

// a surface lit as the page lights it: inputData's positionWS, normalWS, viewDirectionWS, shadowCoord and
// normalizedScreenSpaceUV set; emission added unlit
half3 MojuloShade(InputData inputData, half3 albedo, half metal, half rough, half occ, half3 emission)
{
    half3 N = inputData.normalWS, V = inputData.viewDirectionWS;
    half3 diffuse = albedo * (1.0 - metal);
    half3 F0 = lerp(half3(0.04, 0.04, 0.04), albedo, metal);
    half4 shadowMask = half4(1, 1, 1, 1);
    Light mainLight = GetMainLight(inputData.shadowCoord, inputData.positionWS, shadowMask);
    half3 c = MojuloDirect(mainLight, N, V, diffuse, F0, rough);
    #if defined(_ADDITIONAL_LIGHTS)
    uint pixelLightCount = GetAdditionalLightsCount();
    #if USE_CLUSTER_LIGHT_LOOP
    [loop] for (uint li = 0; li < min(URP_FP_DIRECTIONAL_LIGHTS_COUNT, MAX_VISIBLE_LIGHTS); li++)
    {
        Light dl = GetAdditionalLight(li, inputData.positionWS, shadowMask);
        c += MojuloDirect(dl, N, V, diffuse, F0, rough);
    }
    #endif
    LIGHT_LOOP_BEGIN(pixelLightCount)
        Light al = GetAdditionalLight(lightIndex, inputData.positionWS, shadowMask);
        c += MojuloDirect(al, N, V, diffuse, F0, rough);
    LIGHT_LOOP_END
    #endif
    c += diffuse * SampleSH(N) * occ;
    return c + emission;
}

// a normal map's normal without tangents, from the screen's derivatives (as three perturbs one without them): the
// frame dP/du, dP/dv solved exactly, so it holds whichever way the screen's y runs; glTFast's v (1 - glTF's) already
// turns glTF's map the way Unity reads it
half3 MojuloPerturb(float3 P, half3 N, float2 uv, half3 mapN)
{
    float3 dp1 = ddx(P), dp2 = ddy(P);
    float2 du1 = ddx(uv), du2 = ddy(uv);
    float det = du1.x * du2.y - du1.y * du2.x;
    if (abs(det) < 1e-12) return N;
    float3 T = (dp1 * du2.y - dp2 * du1.y) / det;
    float3 B = (dp2 * du1.x - dp1 * du2.x) / det;
    T = T - N * dot(N, T);
    B = B - N * dot(N, B);
    float lt = length(T), lb = length(B);
    if (lt < 1e-8 || lb < 1e-8) return N;
    return normalize(T / lt * mapN.x + B / lb * mapN.y + N * mapN.z);
}

#endif
