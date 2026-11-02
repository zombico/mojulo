// MojuloTone.shader - THE PAGE'S TONE AND HAZE IN UNITY: a full-screen pass after URP's post-processing (the renderer's
// FullScreenPassRendererFeature "MojuloTone", added by MojuloImport.cs; URP's own tonemapping is off: its "Neutral" is not
// Khronos PBR Neutral). The page renders with three's NeutralToneMapping (Khronos PBR Neutral, exposure 1) and encodes
// to sRGB; its haze is three's FogExp2, 1 - exp(-(density x depth)^2) by the view's depth, mixed over the encoded picture
// toward the haze's own colour (as the Unreal adapter measured against the page: its far sea is the hex itself), the sky
// clear of it. Unity encodes the picture after this pass (a linear colour space's sRGB target), so it hands back the
// encoded picture's linear value. The haze's colour and density are MojuloLevel's globals (_MojuloHaze, _MojuloHazeK):
// a scene with none is toned and not hazed. Unity's own fog (RenderSettings, ExponentialSquared: exp(-(density x
// depth)^2), the same curve) stays off: it mixes in the light before the tone, where the page mixes after it.
Shader "Mojulo/Tone"
{
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }
        ZWrite Off
        ZTest Always
        Cull Off
        Blend Off
        Pass
        {
            Name "MojuloTone"
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            float4 _MojuloHaze;
            float4 _MojuloHazeK;

            float3 KhronosNeutral(float3 c)
            {
                c = max(c, 0.0);
                float x = min(c.r, min(c.g, c.b));
                float offs = x < 0.08 ? x - 6.25 * x * x : 0.04;
                c -= offs;
                float peak = max(c.r, max(c.g, c.b));
                if (peak >= 0.76)
                {
                    float d = 0.24;
                    float np = 1.0 - d * d / (peak + d - 0.76);
                    c *= np / peak;
                    float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0);
                    c = lerp(c, np.xxx, g);
                }
                return saturate(c);
            }
            float3 Encode(float3 c)
            {
                return float3(c.r <= 0.0031308 ? c.r * 12.92 : 1.055 * pow(c.r, 1.0 / 2.4) - 0.055,
                              c.g <= 0.0031308 ? c.g * 12.92 : 1.055 * pow(c.g, 1.0 / 2.4) - 0.055,
                              c.b <= 0.0031308 ? c.b * 12.92 : 1.055 * pow(c.b, 1.0 / 2.4) - 0.055);
            }
            float3 Decode(float3 c)
            {
                return float3(c.r <= 0.04045 ? c.r / 12.92 : pow((c.r + 0.055) / 1.055, 2.4),
                              c.g <= 0.04045 ? c.g / 12.92 : pow((c.g + 0.055) / 1.055, 2.4),
                              c.b <= 0.04045 ? c.b / 12.92 : pow((c.b + 0.055) / 1.055, 2.4));
            }
            half4 frag(Varyings input) : SV_Target
            {
                float2 uv = input.texcoord;
                float3 e = Encode(KhronosNeutral(SAMPLE_TEXTURE2D_X_LOD(_BlitTexture, sampler_LinearClamp, uv, 0).rgb));
                float raw = SampleSceneDepth(uv);
                #if UNITY_REVERSED_Z
                bool sky = raw <= 0.0;
                #else
                bool sky = raw >= 1.0;
                #endif
                float z = LinearEyeDepth(raw, _ZBufferParams);
                float dm = z * _MojuloHazeK.x;
                float f = (_MojuloHazeK.x > 0.0 && !sky) ? 1.0 - exp(-dm * dm) : 0.0;
                return half4(Decode(lerp(e, _MojuloHaze.rgb, f)), 1.0);
            }
            ENDHLSL
        }
    }
}
