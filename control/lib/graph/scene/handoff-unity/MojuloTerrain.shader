// MojuloTerrain.shader - the layered ground in URP (scene/handoff-unity.js; bound by MojuloImport.cs to every part
// handoff.json's `terrain` names): the page's fragment (MojuloTerrain.hlsl, the Unreal port's) gives the base colour,
// roughness and normal, lit as every mojulo surface is (MojuloLighting.hlsl: out = base x light). Its layers are
// Texture2DArrays (a layer a slice), its read's numbers the vectors below (the Unreal material's parameters, by name).
Shader "Mojulo/Terrain"
{
    Properties
    {
        _TBase ("Layers: base", 2DArray) = "" {}
        _TNorm ("Layers: normal", 2DArray) = "" {}
        _TOrm ("Layers: ORM (height in B)", 2DArray) = "" {}
        _TDice ("Scree dice", 2D) = "white" {}
        _TPath ("Trail mask", 2D) = "black" {}
        _TGrass ("Grass cover", 2D) = "white" {}
        TileA ("Tiles 0-3", Vector) = (1, 1, 1, 1)
        TileB ("Tiles 4-6, roughness", Vector) = (1, 1, 1, 1)
        M0 ("Mean 0", Vector) = (1, 1, 1, 0)
        M1 ("Mean 1", Vector) = (1, 1, 1, 0)
        M2 ("Mean 2", Vector) = (1, 1, 1, 0)
        M3 ("Mean 3", Vector) = (1, 1, 1, 0)
        M4 ("Mean 4", Vector) = (1, 1, 1, 0)
        M5 ("Mean 5", Vector) = (1, 1, 1, 0)
        M6 ("Mean 6", Vector) = (1, 1, 1, 0)
        PathOM ("Path origin, metres", Vector) = (0, 0, 1, 1)
        PathZ ("Path z, span, on, sdIn", Vector) = (0, 1, 0, 1.5)
        Flags ("Clay, undergrowth, grass, moss", Vector) = (0, 0, 0, 0)
        GrassOM ("Grass origin, metres", Vector) = (0, 0, 1, 1)
        Wet ("Wet z, band, tone, rough", Vector) = (-1000000000, 1, 1, 1)
        Dress ("Rubble, dust, reach", Vector) = (0, 0, 0, 0)
        Patch ("Patches", Vector) = (0, 0, 0, 0)
        GpCell ("Parallax cells", Vector) = (0.09, 0.34, 0.75, 0)
        GpDepth ("Parallax depths", Vector) = (0.03, 0.035, 0.06, 0)
        Gp ("Parallax dry, stretch, near", Vector) = (9, 7, 30, 0)
        PathBase ("Path base", Vector) = (0, 0, 0, 0)
        StoneBase ("Stone base", Vector) = (0, 0, 0, 0)
        ClayBase ("Clay base", Vector) = (0, 0, 0, 0)
        UnderBase ("Undergrowth base", Vector) = (0, 0, 0, 0)
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
        HLSLINCLUDE
        #include "MojuloLighting.hlsl"
        CBUFFER_START(UnityPerMaterial)
        float4 TileA, TileB, M0, M1, M2, M3, M4, M5, M6, PathOM, PathZ, Flags, GrassOM, Wet, Dress, Patch, GpCell, GpDepth, Gp, PathBase, StoneBase, ClayBase, UnderBase;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull Off
            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #include "MojuloTerrain.hlsl"

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv2 : TEXCOORD2; float2 uv3 : TEXCOORD3; float4 color : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float3 normalWS : TEXCOORD1; float4 splat : TEXCOORD2; float4 color : COLOR; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                // (glTFast writes 1 - v: the weights as the GLB carries them)
                o.splat = float4(v.uv2.x, 1.0 - v.uv2.y, v.uv3.x, 1.0 - v.uv3.y);
                o.color = v.color;
                return o;
            }

            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                float3 base; float rough; float3 N;
                MojuloTerrain(i.positionWS, normalize(i.normalWS), front ? 1.0 : -1.0, _WorldSpaceCameraPos, i.splat, i.color.rgb, base, rough, N);
                InputData d = (InputData)0;
                d.positionWS = i.positionWS;
                d.normalWS = normalize(N);
                d.viewDirectionWS = normalize(GetWorldSpaceViewDir(i.positionWS));
                d.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                d.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                return half4(MojuloShade(d, base, 0.0, rough, 1.0, 0.0), 1.0);
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
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            float3 _LightPosition;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            float4 vert(Attributes v) : SV_POSITION
            {
                float3 p = TransformObjectToWorld(v.positionOS.xyz);
                float3 n = TransformObjectToWorldNormal(v.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                float3 L = normalize(_LightPosition - p);
                #else
                float3 L = _LightDirection;
                #endif
                return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(p, n, L)));
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
            #pragma vertex vert
            #pragma fragment frag
            float4 vert(float4 positionOS : POSITION) : SV_POSITION { return TransformObjectToHClip(positionOS.xyz); }
            half frag() : SV_Target { return 0; }
            ENDHLSL
        }
    }
}
