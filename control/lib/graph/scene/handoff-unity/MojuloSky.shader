// MojuloSky.shader - THE SKY IN UNITY (the level's `environment.sky`, the scene's skybox, set by MojuloImport.cs on
// MojuloSky.mat): the World page's dome, from the horizon's colour to the zenith's by the height of the eye's ray (pow
// 0.6, as the page's and the other adapters'); below the horizon the horizon's colour. Unlit; it passes through the tone
// as the page's does, and the haze leaves it clear (the tone pass's sky test). A level with no sky has its background
// colour as both. Unity's y is mojulo's z.
Shader "Mojulo/Sky"
{
    Properties
    {
        Zenith ("Zenith (linear)", Vector) = (0.2, 0.35, 0.6, 1)
        Horizon ("Horizon (linear)", Vector) = (0.6, 0.75, 0.85, 1)
    }
    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" "RenderPipeline" = "UniversalPipeline" }
        Cull Off
        ZWrite Off
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
            float4 Zenith, Horizon;
            CBUFFER_END
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };
            Varyings vert(float4 positionOS : POSITION)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(positionOS.xyz);
                o.dir = positionOS.xyz;
                return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                float3 d = normalize(i.dir);
                return half4(lerp(Horizon.rgb, Zenith.rgb, pow(max(d.y, 0.0), 0.6)), 1.0);
            }
            ENDHLSL
        }
    }
}
