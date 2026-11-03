// MojuloLit.shader - a mojulo handoff's lit surface in URP (scene/handoff-unity.js, bound by MojuloImport.cs to every
// glTF material but the layered ground's and the sea's): glTF's metal-rough material as the page's MeshStandardMaterial
// lights it (MojuloLighting.hlsl): base = its texture x its factor x the vertex colour where every primitive on it
// carries COLOR_0 (_MOJULO_VERTEX_COLOUR: glTF's COLOR_0 is linear, glTFast keeps it as written), its normal map (no
// tangents needed: the screen's derivatives, as three's), roughness and metal from its metal-rough map, occlusion from
// its own, its emission; a dressed face's or a bark's height map bound as parallax at 0 (at the relief's own depth it
// reads as nothing over the normal map; a developer raises _HeightScale). Two-sided, as the page's. A glTF BLEND is
// see-through (_MOJULO_BLEND).
Shader "Mojulo/Lit"
{
    Properties
    {
        _BaseMap ("Base", 2D) = "white" {}
        _BaseFactor ("Base factor (linear)", Vector) = (1, 1, 1, 1)
        _NormalMap ("Normal", 2D) = "bump" {}
        _NormalScale ("Normal scale", Float) = 1
        _OrmMap ("Metal-rough (G rough, B metal)", 2D) = "white" {}
        _RoughnessFactor ("Roughness", Range(0, 1)) = 1
        _MetallicFactor ("Metallic", Range(0, 1)) = 0
        _OcclusionMap ("Occlusion (R)", 2D) = "white" {}
        _OcclusionStrength ("Occlusion strength", Range(0, 1)) = 1
        _EmissiveMap ("Emissive", 2D) = "white" {}
        _EmissiveFactor ("Emissive factor (linear)", Vector) = (0, 0, 0, 0)
        _HeightMap ("Height", 2D) = "black" {}
        _HeightScale ("Height (parallax, uv units; 0 is off)", Float) = 0
        [Toggle(_MOJULO_VERTEX_COLOUR)] _VertexColour ("Vertex colour as base", Float) = 0
        [Toggle(_MOJULO_NORMALMAP)] _UseNormal ("Normal map", Float) = 0
        [Toggle(_MOJULO_BLEND)] _Blend ("See-through", Float) = 0
        [HideInInspector] _SrcBlend ("", Float) = 1
        [HideInInspector] _DstBlend ("", Float) = 0
        [HideInInspector] _ZWrite ("", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
        HLSLINCLUDE
        #include "MojuloLighting.hlsl"
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_NormalMap); SAMPLER(sampler_NormalMap);
        TEXTURE2D(_OrmMap); SAMPLER(sampler_OrmMap);
        TEXTURE2D(_OcclusionMap); SAMPLER(sampler_OcclusionMap);
        TEXTURE2D(_EmissiveMap); SAMPLER(sampler_EmissiveMap);
        TEXTURE2D(_HeightMap); SAMPLER(sampler_HeightMap);
        CBUFFER_START(UnityPerMaterial)
        float4 _BaseMap_ST;
        float4 _BaseFactor;
        float _NormalScale, _RoughnessFactor, _MetallicFactor, _OcclusionStrength, _HeightScale;
        float4 _EmissiveFactor;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull Off
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma shader_feature_local _MOJULO_VERTEX_COLOUR
            #pragma shader_feature_local _MOJULO_NORMALMAP
            #pragma shader_feature_local_fragment _MOJULO_BLEND
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; float4 color : COLOR; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float3 normalWS : TEXCOORD1; float2 uv : TEXCOORD2; float4 color : COLOR; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = v.uv;
                o.color = v.color;
                return o;
            }

            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                float face = front ? 1.0 : -1.0;
                float3 V = normalize(GetWorldSpaceViewDir(i.positionWS));
                half3 N = normalize(i.normalWS);
                float2 uv = i.uv;
                if (_HeightScale > 0.0)
                {
                    // (a single step of parallax along the view, in the face's own frame from the derivatives)
                    float3 dp1 = ddx(i.positionWS), dp2 = ddy(i.positionWS); float2 du1 = ddx(uv), du2 = ddy(uv);
                    float det = du1.x * du2.y - du1.y * du2.x;
                    if (abs(det) > 1e-12)
                    {
                        float3 T = normalize((dp1 * du2.y - dp2 * du1.y) / det), B = normalize((dp2 * du1.x - dp1 * du2.x) / det);
                        float3 Nf = N * face;
                        float h = SAMPLE_TEXTURE2D(_HeightMap, sampler_HeightMap, uv).r - 0.5;
                        float3 vt = float3(dot(V, T), dot(V, B), max(dot(V, Nf), 0.2));
                        uv += vt.xy / vt.z * h * _HeightScale;
                    }
                }
                half4 base = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv) * _BaseFactor;
                #if defined(_MOJULO_VERTEX_COLOUR)
                base *= i.color;
                #endif
                #if defined(_MOJULO_NORMALMAP)
                half3 mapN = SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv).xyz * 2.0 - 1.0;
                mapN.xy *= _NormalScale;
                N = MojuloPerturb(i.positionWS, N, uv, mapN);
                #endif
                N *= face;
                half4 orm = SAMPLE_TEXTURE2D(_OrmMap, sampler_OrmMap, uv);
                half occ = lerp(1.0, SAMPLE_TEXTURE2D(_OcclusionMap, sampler_OcclusionMap, uv).r, _OcclusionStrength);
                half3 em = SAMPLE_TEXTURE2D(_EmissiveMap, sampler_EmissiveMap, uv).rgb * _EmissiveFactor.rgb;
                InputData d = (InputData)0;
                d.positionWS = i.positionWS;
                d.normalWS = N;
                d.viewDirectionWS = V;
                d.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                d.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                half3 c = MojuloShade(d, base.rgb, saturate(orm.b * _MetallicFactor), saturate(orm.g * _RoughnessFactor), occ, em);
                #if defined(_MOJULO_BLEND)
                return half4(c, base.a);
                #else
                return half4(c, 1.0);
                #endif
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Off
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            float3 _LightPosition;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            float4 vert(Attributes v) : SV_POSITION
            {
                UNITY_SETUP_INSTANCE_ID(v);
                float3 p = TransformObjectToWorld(v.positionOS.xyz);
                float3 n = TransformObjectToWorldNormal(v.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                float3 L = normalize(_LightPosition - p);
                #else
                float3 L = _LightDirection;
                #endif
                float4 cs = TransformWorldToHClip(ApplyShadowBias(p, n, L));
                cs = ApplyShadowClamping(cs);
                return cs;
            }
            half4 frag() : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull Off
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            struct Attributes { float4 positionOS : POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            float4 vert(Attributes v) : SV_POSITION { UNITY_SETUP_INSTANCE_ID(v); return TransformObjectToHClip(v.positionOS.xyz); }
            half frag() : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull Off
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; };
            Varyings vert(Attributes v) { UNITY_SETUP_INSTANCE_ID(v); Varyings o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.normalWS = TransformObjectToWorldNormal(v.normalOS); return o; }
            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target { return half4(NormalizeNormalPerPixel(i.normalWS * (front ? 1.0 : -1.0)), 0.0); }
            ENDHLSL
        }
    }
}
