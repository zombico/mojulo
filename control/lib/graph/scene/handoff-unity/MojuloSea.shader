// MojuloSea.shader - THE SEA IN UNITY (mojulo's scene/handoff.js seaPlane, bound by MojuloImport.cs from handoff.json's
// `sea`): the World page's sea (scene/channels/form-land.js) as the Unreal and Godot ports have it
// (handoff-unreal/handoff_sea.hlsl): see-through at its opacity and faded to nothing toward the shore by the depth under
// it (the map's red over `max` metres; off the map, the open sea, whole), the sky in its reflection: the page's own dome
// (from the horizon's colour to the zenith's by the reflected ray's height) at Schlick's Fresnel. Its colour is lit as a
// Lambert surface (its base, no specular of the engine's: the sky is its reflection), and by the dome's light
// (`irradiance`, handoff.js SEA_SKY_SHARE: three lights a standard material by its envMap's diffuse too) less what it
// reflects. It casts no shadow and writes its
// depth, so the tone pass hazes it by its own distance as the page does (the renderer copies depth after transparents).
// Runs in mojulo's frame (MojuloLighting.hlsl). The depth map is loaded with its first row at v = 0 (a data texture).
Shader "Mojulo/Sea"
{
    Properties
    {
        _TDepth ("Depth (R over max)", 2D) = "black" {}
        DOM ("Depth origin, metres", Vector) = (0, 0, 1, 1)
        DMaxOp ("Max, opacity", Vector) = (1, 0.9, 0, 0)
        Zenith ("Zenith (linear)", Vector) = (0.4, 0.55, 0.8, 1)
        Horizon ("Horizon (linear)", Vector) = (0.7, 0.8, 0.9, 1)
        Base ("Base (linear)", Vector) = (0, 0.29, 0.45, 1)
        Irr ("Sky light (linear)", Vector) = (0, 0, 0, 1)
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" "Queue" = "Transparent" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite On
            Cull Back
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include "MojuloLighting.hlsl"
            TEXTURE2D(_TDepth); SAMPLER(sampler_TDepth);
            CBUFFER_START(UnityPerMaterial)
            float4 DOM, DMaxOp, Zenith, Horizon, Base, Irr;
            CBUFFER_END
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float3 normalWS : TEXCOORD1; };
            Varyings vert(Attributes v)
            {
                Varyings o;
                VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS = p.positionCS; o.positionWS = p.positionWS; o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                float3 vP = MojuloFromUnity(i.positionWS);
                float3 vCam = MojuloFromUnity(_WorldSpaceCameraPos);
                float2 du = (vP.xy - DOM.xy) / max(DOM.zw, 1e-4);
                float dMax = max(DMaxOp.x, 1e-4);
                float off = (du.x < 0.0 || du.y < 0.0 || du.x > 1.0 || du.y > 1.0) ? 1.0 : 0.0;
                float alpha = off > 0.5 ? 1.0 : DMaxOp.y * smoothstep(0.0, dMax, SAMPLE_TEXTURE2D_LOD(_TDepth, sampler_TDepth, du, 0).r * dMax);
                float3 V = normalize(vCam - vP);
                float3 R = reflect(-V, float3(0.0, 0.0, 1.0));
                float3 sky = lerp(Horizon.rgb, Zenith.rgb, pow(max(0.0, R.z), 0.6));
                float nv = saturate(V.z);
                float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
                float3 refl = sky * fr + Base.rgb * Irr.rgb * (1.0 - fr);
                // (the base lit as a Lambert surface: the sun, the lamps, the ambient)
                InputData d = (InputData)0;
                d.positionWS = i.positionWS;
                d.normalWS = normalize(i.normalWS);
                d.viewDirectionWS = normalize(GetWorldSpaceViewDir(i.positionWS));
                d.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                d.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                half4 sm = half4(1, 1, 1, 1);
                Light L = GetMainLight(d.shadowCoord, d.positionWS, sm);
                float3 lit = L.color * (L.distanceAttenuation * L.shadowAttenuation * saturate(dot(d.normalWS, L.direction))) + SampleSH(d.normalWS);
                #if defined(_ADDITIONAL_LIGHTS)
                uint pixelLightCount = GetAdditionalLightsCount();
                InputData inputData = d;
                LIGHT_LOOP_BEGIN(pixelLightCount)
                    Light al = GetAdditionalLight(lightIndex, d.positionWS, sm);
                    lit += al.color * (al.distanceAttenuation * al.shadowAttenuation * saturate(dot(d.normalWS, al.direction)));
                LIGHT_LOOP_END
                #endif
                return half4(Base.rgb * lit + refl, alpha);
            }
            ENDHLSL
        }
    }
}
