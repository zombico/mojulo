// MojuloImport.cs - THE ENGINE HANDOFF IN UNITY (mojulo's scene/handoff.js, written by scene/handoff-unity.js).
//
//   headless:      Unity -batchmode -projectPath <pack> -executeMethod Mojulo.Handoff.Import.Run -quit -logFile <log>
//   in the editor: Mojulo > Import the handoff
//
// It builds the level in the project from Assets/Mojulo/handoff.json and Assets/Mojulo/level.glb:
//   - mojulo's scene, Assets/Mojulo/Built/Level_Mojulo.unity, with everything it is built from beside it in Built/
//     (materials, texture arrays, the animator controller): all of it inside Assets/Mojulo/, which a re-handoff
//     replaces whole, so the importer builds it again every time. The developer's scene, Assets/Scenes/Level.unity, is
//     made the first time (a MojuloStream that loads mojulo's scene into it, its lighting the level's) and never
//     touched after: whatever the developer adds to it stays. Both are in the build's scene list.
//   - the project: the linear colour space; a URP asset (Assets/Settings/Mojulo_URP.asset, HDR, the depth texture,
//     the sun's shadows to 300 m) made once if the project has no pipeline; on the pipeline's renderer, the tone's
//     full-screen pass (MojuloTone, after post-processing) and its depth copied after the see-through (the sea's
//     depth, which the haze reads)
//   - the GLB as glTFast imports it (glTF's y-up to Unity's: mojulo's x, y, z lands as -x, z, -y), its prefab unpacked
//     into the scene: the meshes, the instances, the rigged figures with their clips (an AnimatorController of every
//     clip on the figure's Animator), the cameras (left off: the level's own stand at its camera markers), the lamps
//   - every material on mojulo's shaders: Mojulo/Lit (glTF's metal-rough as the page lights it: base = texture x factor
//     x the vertex colour where every primitive on it carries COLOR_0; normal; metal-rough; occlusion; emission; a
//     dressed face's or a bark's height bound as parallax at 0; a glTF BLEND see-through), the layered ground's parts
//     on Mojulo/Terrain (the page's fragment, its layers stacked into Texture2DArrays, the corners' weights the GLB's
//     TEXCOORD_2 and _3), the sea on Mojulo/Sea (faded toward the shore by its depth map, the sky in its reflection,
//     no shadow)
//   - collision: a MeshCollider on every static mesh but the instanced sets (stones, plants) and what is see-through
//   - the environment, measured in 6000.2 against the page's out = base x light: the sun a directional light at the
//     record's intensity / pi (URP lights a white surface to its intensity, no 1/pi); a lamp (form:lamp:*) a point
//     light at its glTF intensity / pi, its range the glTF range (URP's window is three's), no shadow; the ambient the
//     solve's, a flat colour (no sky lighting, no reflection); the sky the page's dome (MojuloSky.mat as the skybox);
//     the tone and haze in the tone pass (MojuloTone.shader): Khronos PBR Neutral, the page's exp-squared haze by depth
//     over the encoded picture; Unity's own fog off, its ExponentialSquared numbers set to the same haze for reference
//   - a Camera at each of the level's camera markers (MojuloCamera_<name>), the first one on
//   - every marker and seat an empty GameObject under Mojulo/Markers and Mojulo/Seats carrying its record
//     (MojuloMarker), the level's record on the root (MojuloLevel)
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

namespace Mojulo.Handoff
{
    public static class Import
    {
        public const string Root = "Assets/Mojulo";
        public const string Built = Root + "/Built";
        public const string DefaultScene = Built + "/Level_Mojulo.unity";
        public const string DefaultLevel = "Assets/Scenes/Level.unity";
        public const string DefaultSettings = "Assets/Settings";
        public const string Tone = "MojuloTone";

        public static void Log(string s) => Debug.Log("[mojulo-handoff] " + s);
        public static void Warn(string s) => Debug.LogWarning("[mojulo-handoff] " + s);
        public static void Fail(string s) => Debug.LogError("[mojulo-handoff] ERROR " + s);

        public static Dictionary<string, object> Handoff() => Json.Parse(File.ReadAllText(Path.Combine(Root, "handoff.json"))) as Dictionary<string, object>;
        public static string ScenePath(Dictionary<string, object> h) => Json.Str(Json.Obj(h, "paths"), "scene", DefaultScene);
        public static string LevelPath(Dictionary<string, object> h) => Json.Str(Json.Obj(h, "paths"), "level", DefaultLevel);
        static string Rel(string f) => Path.Combine(Root, f);

        // mojulo's frame (z-up, right-handed, metres) as Unity's (glTFast mirrors glTF's x; glTF is mojulo's x, z, -y)
        public static Vector3 U(float[] p) => p == null || p.Length < 3 ? Vector3.zero : new Vector3(-p[0], p[2], -p[1]);
        public static Vector3 M(Vector3 u) => new Vector3(-u.x, -u.z, u.y);

        static float Srgb2Lin(float c) => c <= 0.04045f ? c / 12.92f : Mathf.Pow((c + 0.055f) / 1.055f, 2.4f);
        public static float[] HexRgb(string h)
        {
            h = (h ?? "#c8d4e0").TrimStart('#');
            return new[] { 0, 2, 4 }.Select(i => Convert.ToInt32(h.Substring(i, 2), 16) / 255f).ToArray();
        }
        public static float[] HexLinear(string h) => HexRgb(h).Select(Srgb2Lin).ToArray();
        static Vector4 V4(float[] a, Vector4 d)
        {
            if (a == null) return d;
            var o = d;
            for (int i = 0; i < Math.Min(4, a.Length); i++) o[i] = a[i];
            return o;
        }
        static Color Lin(float[] c) => c == null ? Color.white : new Color(c[0], c[1], c[2], 1f);

        [MenuItem("Mojulo/Import the handoff")]
        static void Menu() => Run();

        public static void Run()
        {
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            Application.SetStackTraceLogType(LogType.Warning, StackTraceLogType.None);
            try { Build(); }
            catch (Exception e)
            {
                Fail("the build stopped: " + e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
            }
        }

        // ---- the project: colour space, pipeline, the tone's pass ---------------------------------------------------

        static UniversalRendererData Pipeline(string settings, out bool made)
        {
            made = false;
            if (PlayerSettings.colorSpace != ColorSpace.Linear)
            {
                PlayerSettings.colorSpace = ColorSpace.Linear;
                Log("the colour space set to linear (the page's)");
            }
            var asset = GraphicsSettings.defaultRenderPipeline as UniversalRenderPipelineAsset;
            if (GraphicsSettings.defaultRenderPipeline == null)
            {
                if (!AssetDatabase.IsValidFolder(settings)) AssetDatabase.CreateFolder(Path.GetDirectoryName(settings).Replace('\\', '/'), Path.GetFileName(settings));
                var rdPath = settings + "/Mojulo_URP_Renderer.asset";
                ScriptableRendererData rd0 = null;
                try
                {
                    // (URP's own way to make a renderer: its post-processing data and shaders filled in)
                    var mk = typeof(UniversalRenderPipelineAsset).GetMethod("CreateRendererAsset", BindingFlags.NonPublic | BindingFlags.Static);
                    rd0 = mk?.Invoke(null, new object[] { rdPath, RendererType.UniversalRenderer, false, "Renderer" }) as ScriptableRendererData;
                }
                catch (Exception e) { Warn("URP's renderer maker: " + e.Message); }
                if (rd0 == null)
                {
                    rd0 = ScriptableObject.CreateInstance<UniversalRendererData>();
                    AssetDatabase.CreateAsset(rd0, rdPath);
                }
                asset = UniversalRenderPipelineAsset.Create(rd0);
                asset.supportsHDR = true;
                asset.supportsCameraDepthTexture = true;
                asset.shadowDistance = 300f;
                asset.shadowCascadeCount = 4;
                asset.mainLightShadowmapResolution = 4096;
                asset.msaaSampleCount = 4;
                asset.maxAdditionalLightsCount = 8;
                AssetDatabase.CreateAsset(asset, settings + "/Mojulo_URP.asset");
                GraphicsSettings.defaultRenderPipeline = asset;
                made = true;
                Log("made the pipeline " + settings + "/Mojulo_URP.asset");
            }
            if (asset == null) { Fail("the project's pipeline is not URP: the tone's pass and mojulo's shaders need it"); return null; }
            var so = new SerializedObject(asset);
            var list = so.FindProperty("m_RendererDataList");
            int di = so.FindProperty("m_DefaultRendererIndex")?.intValue ?? 0;
            var rd = list != null && list.arraySize > di ? list.GetArrayElementAtIndex(di).objectReferenceValue as UniversalRendererData : null;
            if (rd == null) Fail("the pipeline's default renderer is not a Universal Renderer");
            return rd;
        }

        static void TonePass(UniversalRendererData rd, Material tone)
        {
            if (rd == null) return;
            var f = rd.rendererFeatures.FirstOrDefault(x => x != null && x.name == Tone) as FullScreenPassRendererFeature;
            if (f == null)
            {
                f = ScriptableObject.CreateInstance<FullScreenPassRendererFeature>();
                f.name = Tone;
                AssetDatabase.AddObjectToAsset(f, rd);
                rd.rendererFeatures.Add(f);
                AssetDatabase.SaveAssets();
                // (URP keeps each feature's local id beside the list)
                var so = new SerializedObject(rd);
                var map = so.FindProperty("m_RendererFeatureMap");
                if (map != null && AssetDatabase.TryGetGUIDAndLocalFileIdentifier(f, out string _, out long lid))
                {
                    while (map.arraySize < rd.rendererFeatures.Count) { map.arraySize++; map.GetArrayElementAtIndex(map.arraySize - 1).longValue = 0; }
                    map.GetArrayElementAtIndex(rd.rendererFeatures.IndexOf(f)).longValue = lid;
                    so.ApplyModifiedPropertiesWithoutUndo();
                }
                Log("added the tone's pass to " + AssetDatabase.GetAssetPath(rd));
            }
            f.injectionPoint = FullScreenPassRendererFeature.InjectionPoint.AfterRenderingPostProcessing;
            f.fetchColorBuffer = true;
            f.requirements = ScriptableRenderPassInput.Depth;
            f.passMaterial = tone;
            f.passIndex = 0;
            f.bindDepthStencilAttachment = false;
            f.SetActive(true);
            // (the sea writes its depth while it draws, after the opaques: the copy the haze reads is made after it)
            if (rd.copyDepthMode != CopyDepthMode.AfterTransparents) rd.copyDepthMode = CopyDepthMode.AfterTransparents;
            EditorUtility.SetDirty(f);
            EditorUtility.SetDirty(rd);
            AssetDatabase.SaveAssetIfDirty(rd);
        }

        // ---- images: as the handoff wrote them ----------------------------------------------------------------------

        // a PNG of the pack read as written; `top0` puts its first row at v = 0 (the page's data textures, and Unreal's
        // import), else at v = 1 (an image, as Unity and the page load one)
        static Texture2D Png(string file, bool linear, bool mips, bool top0)
        {
            var t = new Texture2D(2, 2, TextureFormat.RGBA32, mips, linear);
            if (!t.LoadImage(File.ReadAllBytes(Rel(file)), false)) { Fail("cannot read " + file); return null; }
            if (top0)
            {
                var px = t.GetPixels32(0);
                int w = t.width, h = t.height;
                var o = new Color32[px.Length];
                for (int y = 0; y < h; y++) Array.Copy(px, (h - 1 - y) * w, o, y * w, w);
                t.SetPixels32(o, 0);
                t.Apply(mips);
            }
            return t;
        }

        static Texture2D SaveTex(Texture2D t, string name, FilterMode filter, TextureWrapMode wrap)
        {
            if (t == null) return null;
            t.name = name;
            t.filterMode = filter;
            t.wrapMode = wrap;
            t.anisoLevel = filter == FilterMode.Point ? 0 : 4;
            AssetDatabase.CreateAsset(t, Built + "/Textures/" + name + ".asset");
            return t;
        }

        static Texture2DArray Array2D(string name, List<object> files, bool linear)
        {
            var first = Png((string)files[0], linear, false, true);
            if (first == null) return null;
            int w = first.width, h = first.height;
            var a = new Texture2DArray(w, h, files.Count, TextureFormat.RGBA32, true, linear);
            for (int i = 0; i < files.Count; i++)
            {
                var t = i == 0 ? first : Png((string)files[i], linear, false, true);
                if (t == null || t.width != w || t.height != h) { Fail("terrain layer " + files[i] + " is not " + w + "x" + h); return null; }
                a.SetPixels32(t.GetPixels32(0), i, 0);
                UnityEngine.Object.DestroyImmediate(t);
            }
            a.Apply(true, false);
            a.name = name;
            a.wrapMode = TextureWrapMode.Repeat;
            a.filterMode = FilterMode.Trilinear;
            a.anisoLevel = 8;
            AssetDatabase.CreateAsset(a, Built + "/Textures/" + name + ".asset");
            return a;
        }

        // ---- the materials -------------------------------------------------------------------------------------------

        public class Mats
        {
            public readonly Dictionary<string, Dictionary<string, object>> gltf = new Dictionary<string, Dictionary<string, object>>();
            public readonly Dictionary<string, bool> coloured = new Dictionary<string, bool>();
            public readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();
            public readonly HashSet<Material> seeThrough = new HashSet<Material>();
            public readonly HashSet<string> terrainNames = new HashSet<string>();
            public string seaName;
            public Material terrain, sea;
            public readonly Dictionary<string, int> stats = new Dictionary<string, int> { { "slots", 0 }, { "lit", 0 }, { "translucent", 0 }, { "vertex_colour", 0 }, { "normal", 0 }, { "orm", 0 }, { "height", 0 }, { "unmatched", 0 } };
            readonly Shader lit = Shader.Find("Mojulo/Lit");
            readonly Dictionary<string, object> heights;

            public Mats(Dictionary<string, object> glb, Dictionary<string, object> h)
            {
                if (lit == null) Fail("no Mojulo/Lit shader (Assets/Mojulo/Shaders did not compile?)");
                var ms = Json.Arr(glb, "materials") ?? new List<object>();
                foreach (var o in ms) { var d = o as Dictionary<string, object>; var n = Json.Str(d, "name", ""); if (!gltf.ContainsKey(n)) gltf[n] = d; }
                // (a material takes the vertex colour where every primitive drawn with it carries COLOR_0)
                foreach (var mo in Json.Arr(glb, "meshes") ?? new List<object>())
                    foreach (var po in Json.Arr(mo, "primitives") ?? new List<object>())
                    {
                        var p = po as Dictionary<string, object>;
                        if (!(p.TryGetValue("material", out var k) && k is double kd)) continue;
                        var n = Json.Str(ms[(int)kd], "name", "");
                        var has = Json.Obj(p, "attributes")?.ContainsKey("COLOR_0") ?? false;
                        coloured[n] = (coloured.TryGetValue(n, out var was) ? was : true) && has;
                    }
                foreach (var n in Json.Arr(Json.Obj(h, "terrain"), "parts") ?? new List<object>()) terrainNames.Add((string)n);
                seaName = Json.Str(Json.Obj(h, "sea"), "part");
                heights = Json.Obj(h, "materials") ?? new Dictionary<string, object>();
            }

            static string Safe(string s) => new string((s ?? "").Select(c => char.IsLetterOrDigit(c) || c == '-' ? c : '_').ToArray());
            static Texture Tex(Material m, string prop) => m != null && m.HasProperty(prop) ? m.GetTexture(prop) : null;

            public Material For(Material cur)
            {
                var key = cur != null ? cur.name : "";
                stats["slots"]++;
                if (cache.TryGetValue(key, out var hit)) return hit;
                if (terrain != null && terrainNames.Contains(key)) return cache[key] = terrain;
                if (sea != null && key == seaName) return cache[key] = sea;
                if (!gltf.TryGetValue(key, out var g)) { stats["unmatched"]++; g = new Dictionary<string, object>(); }
                var pbr = Json.Obj(g, "pbrMetallicRoughness");
                var m = new Material(lit) { name = "M_" + (key.Length > 0 ? Safe(key) : "Default") };
                var bt = Tex(cur, "baseColorTexture");
                if (bt != null) m.SetTexture("_BaseMap", bt);
                m.SetVector("_BaseFactor", V4(Json.Floats(pbr, "baseColorFactor"), new Vector4(1, 1, 1, 1)));
                m.SetFloat("_RoughnessFactor", (float)Json.Num(pbr, "roughnessFactor", 1));
                m.SetFloat("_MetallicFactor", (float)Json.Num(pbr, "metallicFactor", 1));
                m.SetVector("_EmissiveFactor", V4(Json.Floats(g, "emissiveFactor"), Vector4.zero));
                if (coloured.TryGetValue(key, out var vc) && vc) { m.EnableKeyword("_MOJULO_VERTEX_COLOUR"); m.SetFloat("_VertexColour", 1); stats["vertex_colour"]++; }
                var nt = Json.Has(g, "normalTexture") ? Tex(cur, "normalTexture") : null;
                if (nt != null)
                {
                    m.SetTexture("_NormalMap", nt);
                    m.SetFloat("_NormalScale", (float)Json.Num(Json.Obj(g, "normalTexture"), "scale", 1));
                    m.EnableKeyword("_MOJULO_NORMALMAP"); m.SetFloat("_UseNormal", 1);
                    stats["normal"]++;
                }
                var mr = Json.Has(pbr, "metallicRoughnessTexture") ? Tex(cur, "metallicRoughnessTexture") : null;
                if (mr != null) { m.SetTexture("_OrmMap", mr); stats["orm"]++; }
                var oc = Json.Has(g, "occlusionTexture") ? (Tex(cur, "occlusionTexture") ?? mr) : null;
                if (oc != null) { m.SetTexture("_OcclusionMap", oc); m.SetFloat("_OcclusionStrength", (float)Json.Num(Json.Obj(g, "occlusionTexture"), "strength", 1)); }
                var et = Json.Has(g, "emissiveTexture") ? Tex(cur, "emissiveTexture") : null;
                if (et != null) m.SetTexture("_EmissiveMap", et);
                if (heights.TryGetValue(key, out var hs) && hs is Dictionary<string, object> spec && Json.Str(spec, "height") != null)
                {
                    var file = Json.Str(spec, "height");
                    var ht = AssetDatabase.LoadAssetAtPath<Texture2D>(Built + "/Textures/TH_" + Safe(Path.GetFileNameWithoutExtension(file)) + ".asset")
                             ?? SaveTex(Png(file, true, true, false), "TH_" + Safe(Path.GetFileNameWithoutExtension(file)), FilterMode.Trilinear, TextureWrapMode.Repeat);
                    if (ht != null) { m.SetTexture("_HeightMap", ht); m.SetFloat("_HeightScale", 0f); stats["height"]++; }
                }
                if (Json.Str(g, "alphaMode") == "BLEND")
                {
                    m.EnableKeyword("_MOJULO_BLEND"); m.SetFloat("_Blend", 1);
                    m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha); m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha); m.SetFloat("_ZWrite", 0);
                    m.SetOverrideTag("RenderType", "Transparent");
                    m.renderQueue = (int)RenderQueue.Transparent;
                    seeThrough.Add(m);
                    stats["translucent"]++;
                }
                else stats["lit"]++;
                AssetDatabase.CreateAsset(m, Built + "/Materials/" + m.name + ".mat");
                return cache[key] = m;
            }
        }

        // ---- the layered ground and the sea -----------------------------------------------------------------------

        static Material Terrain(Dictionary<string, object> T)
        {
            var L = Json.Obj(T, "layers");
            if (L == null || !new[] { "base", "normal", "orm" }.All(L.ContainsKey)) { Fail("the terrain's layers are missing"); return null; }
            var sh = Shader.Find("Mojulo/Terrain");
            if (sh == null) { Fail("no Mojulo/Terrain shader"); return null; }
            var m = new Material(sh) { name = "M_MojuloTerrain" };
            m.SetTexture("_TBase", Array2D("TA_MojuloTerrainBase", (List<object>)L["base"], false));
            m.SetTexture("_TNorm", Array2D("TA_MojuloTerrainNormal", (List<object>)L["normal"], true));
            m.SetTexture("_TOrm", Array2D("TA_MojuloTerrainOrm", (List<object>)L["orm"], true));
            var R = Json.Obj(T, "read") ?? new Dictionary<string, object>();
            var I = Json.Obj(T, "images") ?? new Dictionary<string, object>();
            var tile = (Json.Floats(R, "tile") ?? new float[0]).Concat(Enumerable.Repeat(1f, 7)).ToArray();
            m.SetVector("TileA", new Vector4(tile[0], tile[1], tile[2], tile[3]));
            m.SetVector("TileB", new Vector4(tile[4], tile[5], tile[6], 1f));
            var mean = Json.Arr(R, "mean") ?? new List<object>();
            for (int i = 0; i < 7; i++) m.SetVector("M" + i, i < mean.Count ? V4(Json.Floats(mean[i]), new Vector4(1, 1, 1, 0)) : new Vector4(1, 1, 1, 0));
            var B = Json.Obj(R, "bases") ?? new Dictionary<string, object>();
            foreach (var (k, n) in new[] { ("path", "PathBase"), ("clay", "ClayBase"), ("stone", "StoneBase"), ("under", "UnderBase") })
                if (Json.Has(B, k)) m.SetVector(n, V4(Json.Floats(B, k), Vector4.zero));
            var D = Json.Obj(R, "dress") ?? new Dictionary<string, object>();
            var flags = new Vector4((float)Json.Num(D, "clay"), Json.Truthy(R, "green") ? 1f : 0f, 0f, (float)Json.Num(R, "moss"));
            m.SetVector("Dress", new Vector4((float)Json.Num(D, "rubble"), (float)Json.Num(D, "dust"), (float)Json.Num(D, "reach"), 0f));
            m.SetVector("Patch", V4(Json.Floats(D, "patches"), Vector4.zero));
            var W = Json.Obj(R, "wet");
            m.SetVector("Wet", new Vector4(W == null || !Json.Has(W, "z") ? -1e9f : (float)Json.Num(W, "z"), (float)Json.Num(W, "band", 1), (float)Json.Num(W, "tone", 1), (float)Json.Num(W, "rough", 1)));
            if (Json.Str(I, "dice") != null) m.SetTexture("_TDice", SaveTex(Png(Json.Str(I, "dice"), true, true, true), "T_MojuloDice", FilterMode.Point, TextureWrapMode.Repeat));
            var P = Json.Obj(R, "path");
            float pathOn = 0f;
            if (P != null && Json.Str(I, "path") != null)
            {
                m.SetTexture("_TPath", SaveTex(Png(Json.Str(I, "path"), true, false, true), "T_MojuloPath", FilterMode.Bilinear, TextureWrapMode.Clamp));
                var o = Json.Floats(P, "origin"); var me = Json.Floats(P, "metres");
                m.SetVector("PathOM", new Vector4(o[0], o[1], me[0], me[1]));
                pathOn = 1f;
            }
            var pz = Json.Floats(P, "z") ?? new[] { 0f, 1f };
            m.SetVector("PathZ", new Vector4(pz[0], pz[1], pathOn, (float)Json.Num(D, "sdIn", 1.5)));
            var G = Json.Obj(R, "grass");
            if (G != null && Json.Str(I, "grass") != null)
            {
                m.SetTexture("_TGrass", SaveTex(Png(Json.Str(I, "grass"), true, false, true), "T_MojuloGrass", FilterMode.Bilinear, TextureWrapMode.Clamp));
                var o = Json.Floats(G, "origin"); var me = Json.Floats(G, "metres");
                m.SetVector("GrassOM", new Vector4(o[0], o[1], me[0], me[1]));
                flags.z = 1f;
            }
            else m.SetVector("GrassOM", new Vector4(0, 0, 1, 1));
            m.SetVector("Flags", flags);
            var X = Json.Obj(R, "parallax");
            if (X != null)
            {
                var pe = Json.Obj(X, "pebbles"); var cr = Json.Obj(X, "cracks"); var pl = Json.Obj(X, "plates");
                m.SetVector("GpCell", new Vector4((float)Json.Num(pe, "cell"), (float)Json.Num(cr, "cell"), (float)Json.Num(pl, "cell"), 0));
                m.SetVector("GpDepth", new Vector4((float)Json.Num(pe, "depth"), (float)Json.Num(cr, "depth"), (float)Json.Num(pl, "depth"), 0));
                m.SetVector("Gp", new Vector4((float)Json.Num(X, "dry"), (float)Json.Num(X, "stretch"), (float)Json.Num(X, "near"), 0));
            }
            AssetDatabase.CreateAsset(m, Built + "/Materials/M_MojuloTerrain.mat");
            return m;
        }

        static (float[], float[]) SkyColours(Dictionary<string, object> env)
        {
            var sky = Json.Obj(env, "sky");
            var bg = Json.Str(env, "background", "#c8d4e0");
            return (HexLinear(Json.Str(sky, "zenith", bg)), HexLinear(Json.Str(sky, "horizon", bg)));
        }

        static Material Sea(Dictionary<string, object> S, Dictionary<string, object> env, Mats mats)
        {
            var sh = Shader.Find("Mojulo/Sea");
            if (sh == null) { Fail("no Mojulo/Sea shader"); return null; }
            var m = new Material(sh) { name = "M_MojuloSea" };
            var R = Json.Obj(S, "read") ?? new Dictionary<string, object>();
            if (Json.Str(S, "image") != null) m.SetTexture("_TDepth", SaveTex(Png(Json.Str(S, "image"), true, false, true), "T_MojuloSeaDepth", FilterMode.Bilinear, TextureWrapMode.Clamp));
            var o = Json.Floats(R, "origin") ?? new[] { 0f, 0f }; var me = Json.Floats(R, "metres") ?? new[] { 1f, 1f };
            m.SetVector("DOM", new Vector4(o[0], o[1], me[0], me[1]));
            m.SetVector("DMaxOp", new Vector4((float)Json.Num(R, "max", 1), (float)Json.Num(R, "opacity", 0.9), 0, 0));
            var (zen, hor) = SkyColours(env);
            m.SetVector("Zenith", V4(zen, Vector4.one));
            m.SetVector("Horizon", V4(hor, Vector4.one));
            mats.gltf.TryGetValue(Json.Str(S, "part", "form:sea"), out var g);
            var pbr = Json.Obj(g, "pbrMetallicRoughness");
            var bc = Json.Floats(pbr, "baseColorFactor") ?? new[] { 0f, 0.29f, 0.45f, 1f };
            m.SetVector("Base", new Vector4(bc[0], bc[1], bc[2], 1f));
            m.renderQueue = (int)RenderQueue.Transparent;
            AssetDatabase.CreateAsset(m, Built + "/Materials/M_MojuloSea.mat");
            return m;
        }

        // ---- the build ------------------------------------------------------------------------------------------------

        static Dictionary<string, object> GlbJson(string path)
        {
            using (var f = File.OpenRead(path))
            using (var r = new BinaryReader(f))
            {
                r.ReadBytes(12);
                int n = r.ReadInt32();
                r.ReadInt32();
                return Json.Parse(System.Text.Encoding.UTF8.GetString(r.ReadBytes(n))) as Dictionary<string, object>;
            }
        }

        // glTFast's import of the GLB as the handoff needs it (its .meta is the least one, so it starts at glTFast's
        // serialized defaults): Mecanim clips (an Animator plays them), mipmapped textures, every node by its glTF name
        static void GlbSettings(string glbPath)
        {
            var imp = AssetImporter.GetAtPath(glbPath);
            if (imp == null) return;
            var so = new SerializedObject(imp);
            bool changed = false;
            void Int(string p, int v)
            {
                var sp = so.FindProperty(p);
                if (sp == null) { Warn("glTFast has no import setting " + p); return; }
                if (sp.intValue != v) { sp.intValue = v; changed = true; }
            }
            void Bool(string p, bool v)
            {
                var sp = so.FindProperty(p);
                if (sp == null) { Warn("glTFast has no import setting " + p); return; }
                if (sp.boolValue != v) { sp.boolValue = v; changed = true; }
            }
            Int("importSettings.animationMethod", 2);
            Int("importSettings.nodeNameMethod", 0);
            Bool("importSettings.generateMipMaps", true);
            Int("importSettings.anisotropicFilterLevel", 4);
            if (!changed) return;
            so.ApplyModifiedPropertiesWithoutUndo();
            imp.SaveAndReimport();
            Log("imported " + glbPath + " again with Mecanim clips and mipmaps");
        }

        static GameObject Child(Transform parent, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            return go;
        }

        static Camera StandCamera(Transform parent, string name, float[] at, float[] look, double yfov)
        {
            var go = Child(parent, name);
            go.transform.position = U(at);
            var dir = U(look) - U(at);
            if (dir.sqrMagnitude > 1e-9f) go.transform.rotation = Quaternion.LookRotation(dir, Vector3.up);
            var c = go.AddComponent<Camera>();
            c.fieldOfView = (float)((yfov > 0 ? yfov : 50.0 * Math.PI / 180.0) * 180.0 / Math.PI);
            c.nearClipPlane = 0.1f;
            c.farClipPlane = 20000f;
            c.allowHDR = true;
            c.clearFlags = CameraClearFlags.Skybox;
            var ad = go.AddComponent<UniversalAdditionalCameraData>();
            ad.renderPostProcessing = false;
            return c;
        }

        static void Build()
        {
            var H = Handoff();
            var scenePath = ScenePath(H);
            var levelPath = LevelPath(H);
            var settings = Json.Str(Json.Obj(H, "paths"), "settings", DefaultSettings);
            var level = Json.Obj(H, "level");
            var env = Json.Obj(level, "environment") ?? new Dictionary<string, object>();
            var glbPath = Rel("level.glb");
            var glb = GlbJson(glbPath);

            // (the project's pipeline, the tone's pass)
            var rd = Pipeline(settings, out bool madePipeline);
            var tone = AssetDatabase.LoadAssetAtPath<Material>(Rel("Shaders/MojuloTone.mat"));
            if (tone == null) Fail("no " + Rel("Shaders/MojuloTone.mat"));
            TonePass(rd, tone);

            // (what a previous build of this handoff left: built again)
            if (AssetDatabase.IsValidFolder(Built)) AssetDatabase.DeleteAsset(Built);
            AssetDatabase.CreateFolder(Root, "Built");
            AssetDatabase.CreateFolder(Built, "Materials");
            AssetDatabase.CreateFolder(Built, "Textures");

            GlbSettings(glbPath);
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(glbPath);
            if (model == null)
            {
                AssetDatabase.ImportAsset(glbPath, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
                model = AssetDatabase.LoadAssetAtPath<GameObject>(glbPath);
            }
            if (model == null) throw new Exception("glTFast made nothing of " + glbPath + " (is com.unity.cloud.gltfast in Packages/manifest.json?)");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var root = new GameObject("Mojulo");
            var info = root.AddComponent<MojuloLevel>();
            info.handoff = Json.Str(H, "version");
            info.recipe = Json.Str(level, "ref");
            info.json = level != null ? Json.Write(level) : "null";

            var inst = (GameObject)PrefabUtility.InstantiatePrefab(model, scene);
            PrefabUtility.UnpackPrefabInstance(inst, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);
            inst.name = "Level";
            inst.transform.SetParent(root.transform, false);

            // (the materials)
            var mats = new Mats(glb, H);
            if (Json.Obj(H, "terrain") != null) mats.terrain = Terrain(Json.Obj(H, "terrain"));
            if (Json.Obj(H, "sea") != null) mats.sea = Sea(Json.Obj(H, "sea"), env, mats);
            foreach (var r in inst.GetComponentsInChildren<Renderer>(true))
            {
                var cur = r.sharedMaterials;
                r.sharedMaterials = cur.Select(mats.For).ToArray();
                var see = r.sharedMaterials.Any(x => mats.seeThrough.Contains(x) || (mats.sea != null && x == mats.sea));
                if (see) r.shadowCastingMode = ShadowCastingMode.Off;
            }

            // (collision: every static mesh but the instanced sets and what is see-through)
            var instanced = (Json.Arr(H, "instanced") ?? new List<object>()).Select(x => (string)x).ToArray();
            int blocks = 0, still = 0;
            foreach (var mf in inst.GetComponentsInChildren<MeshFilter>(true))
            {
                var mr = mf.GetComponent<MeshRenderer>();
                if (mf.sharedMesh == null || mr == null) continue;
                bool inSet = instanced.Any(p => mf.gameObject.name.StartsWith(p, StringComparison.Ordinal) || (mf.transform.parent != null && mf.transform.parent.name.StartsWith(p, StringComparison.Ordinal)));
                bool see = mr.sharedMaterials.Any(x => mats.seeThrough.Contains(x) || (mats.sea != null && x == mats.sea));
                if (inSet || see) { still++; continue; }
                var mc = mf.gameObject.AddComponent<MeshCollider>();
                mc.sharedMesh = mf.sharedMesh;
                blocks++;
            }

            // (the GLB's cameras stay, off: the level's own stand at its camera markers)
            foreach (var c in inst.GetComponentsInChildren<Camera>(true)) c.enabled = false;

            // (the lamps: the glTF intensity / pi, its range, no shadow)
            var nodes = (Json.Arr(glb, "nodes") ?? new List<object>()).Cast<Dictionary<string, object>>().ToList();
            var lights = Json.Arr(Json.Obj(Json.Obj(glb, "extensions"), "KHR_lights_punctual"), "lights") ?? new List<object>();
            int lamps = 0;
            foreach (var l in inst.GetComponentsInChildren<Light>(true))
            {
                Dictionary<string, object> li = null;
                for (var t = l.transform; t != null && li == null; t = t.parent)
                {
                    var nd = nodes.FirstOrDefault(n => Json.Str(n, "name") == t.name && Json.Obj(Json.Obj(n, "extensions"), "KHR_lights_punctual") != null);
                    if (nd == null) continue;
                    var k = (int)Json.Num(Json.Obj(Json.Obj(nd, "extensions"), "KHR_lights_punctual"), "light", -1);
                    if (k >= 0 && k < lights.Count) li = lights[k] as Dictionary<string, object>;
                }
                l.lightmapBakeType = LightmapBakeType.Realtime;
                if (li == null) continue;
                l.intensity = (float)(Json.Num(li, "intensity", 1) / Math.PI);
                if (Json.Has(li, "range")) l.range = (float)Json.Num(li, "range");
                if (Json.Floats(li, "color") != null) l.color = Lin(Json.Floats(li, "color")).gamma;
                l.shadows = LightShadows.None;
                lamps++;
            }

            // (the environment)
            var envGo = Child(root.transform, "Environment");
            var sun = Json.Obj(env, "sun");
            Light sunLight = null;
            if (sun != null)
            {
                var go = Child(envGo.transform, "MojuloSun");
                var d = U(Json.Floats(sun, "direction") ?? new[] { 0f, 0f, 1f });
                go.transform.rotation = Quaternion.LookRotation(-d.normalized, Mathf.Abs(d.normalized.y) > 0.99f ? Vector3.forward : Vector3.up);
                sunLight = go.AddComponent<Light>();
                sunLight.type = LightType.Directional;
                sunLight.intensity = (float)(Json.Num(sun, "intensity", Math.PI) / Math.PI);
                sunLight.color = Lin(Json.Floats(sun, "color")).gamma;
                sunLight.shadows = LightShadows.Soft;
                sunLight.lightmapBakeType = LightmapBakeType.Realtime;
                info.sunDefault = Json.Truthy(sun, "default");
                RenderSettings.sun = sunLight;
            }
            var amb = Json.Floats(env, "ambient");
            string ambFrom = "solve";
            if (amb == null || amb.Length < 3)
            {
                var (_, hor) = SkyColours(env);
                amb = Json.Obj(env, "sky") != null ? hor : HexLinear(Json.Str(env, "background", "#c8d4e0"));
                ambFrom = Json.Obj(env, "sky") != null ? "sky" : "background";
            }
            info.ambientLinear = new Color(amb[0], amb[1], amb[2], 1f);
            var skyMat = AssetDatabase.LoadAssetAtPath<Material>(Rel("Shaders/MojuloSky.mat"));
            if (skyMat != null)
            {
                // (set on a whole material copied over the pack's: the pack writes it with no properties, and a material
                // read so saves what it is set to only in part; saved now, as an asset refresh later in the build reads a
                // dirty material back from disk)
                var (zen, hor) = SkyColours(env);
                var fresh = new Material(skyMat.shader) { name = skyMat.name };
                fresh.SetVector("Zenith", V4(zen, Vector4.one));
                fresh.SetVector("Horizon", V4(hor, Vector4.one));
                EditorUtility.CopySerialized(fresh, skyMat);
                UnityEngine.Object.DestroyImmediate(fresh);
                EditorUtility.SetDirty(skyMat);
                AssetDatabase.SaveAssetIfDirty(skyMat);
            }
            else Fail("no " + Rel("Shaders/MojuloSky.mat"));
            info.sky = skyMat;
            var hz = Json.Obj(env, "haze");
            if (hz != null)
            {
                var hc = HexRgb(Json.Str(hz, "color", "#c8d4e0"));
                info.hazeColour = new Color(hc[0], hc[1], hc[2], 1f);
                info.hazeDensity = (float)Json.Num(hz, "density");
                RenderSettings.fogColor = info.hazeColour;
                RenderSettings.fogMode = FogMode.ExponentialSquared;
                RenderSettings.fogDensity = info.hazeDensity;
            }
            info.Light();
            info.enabled = false; info.enabled = true;

            // (the cameras, markers and seats)
            var camGo = Child(root.transform, "Cameras");
            int cams = 0;
            foreach (var mo in Json.Arr(level, "markers") ?? new List<object>())
            {
                var m = mo as Dictionary<string, object>;
                if (Json.Str(m, "kind") != "camera" || !Json.Has(m, "at")) continue;
                var nm = Json.Str(m, "name", "camera");
                if (nm.StartsWith("camera:")) nm = nm.Substring("camera:".Length);
                var c = StandCamera(camGo.transform, "MojuloCamera_" + nm, Json.Floats(m, "at"), Json.Floats(m, "look") ?? new[] { 0f, 0f, 0f }, Json.Num(m, "yfov", 0));
                c.enabled = cams == 0;
                if (cams == 0) c.gameObject.tag = "MainCamera";
                cams++;
            }
            if (cams == 0)
            {
                var sp = (Json.Arr(level, "markers") ?? new List<object>()).Cast<Dictionary<string, object>>().FirstOrDefault(m => Json.Str(m, "kind") == "spawn" && Json.Has(m, "at"));
                var look = sp != null ? Json.Floats(sp, "at") : new[] { 0f, 0f, 0f };
                var c = StandCamera(camGo.transform, "MojuloCamera", new[] { look[0], look[1] - 8, look[2] + 5 }, look, 0);
                c.gameObject.tag = "MainCamera";
                cams = 1;
            }
            int nMarkers = 0, nSeats = 0;
            var mk = Child(root.transform, "Markers");
            foreach (var mo in Json.Arr(level, "markers") ?? new List<object>())
            {
                var m = mo as Dictionary<string, object>;
                var go = Child(mk.transform, Json.Str(m, "name", "marker"));
                if (Json.Has(m, "at")) go.transform.position = U(Json.Floats(m, "at"));
                var c = go.AddComponent<MojuloMarker>();
                c.kind = Json.Str(m, "kind", "marker");
                c.json = Json.Write(m);
                nMarkers++;
            }
            var seats = Json.Obj(level, "seats");
            if (seats != null)
            {
                var st = Child(root.transform, "Seats");
                var sc = st.AddComponent<MojuloMarker>();
                sc.kind = "seats";
                sc.json = Json.Write(new[] { "screen", "lives", "pool", "join", "drop" }.ToDictionary(k => k, k => seats.TryGetValue(k, out var v) ? v : null));
                foreach (var ro in Json.Arr(seats, "rows") ?? new List<object>())
                {
                    var r = ro as Dictionary<string, object>;
                    var go = Child(st.transform, "Seat_" + (Json.Str(r, "label") ?? Json.Num(r, "n").ToString()));
                    if (Json.Has(r, "spawn")) go.transform.position = U(Json.Floats(r, "spawn"));
                    var c = go.AddComponent<MojuloMarker>();
                    c.kind = "seat";
                    c.json = Json.Write(r);
                    nSeats++;
                }
            }

            // (a rigged figure's clips: an AnimatorController of them all on its Animator)
            var clips = AssetDatabase.LoadAllAssetsAtPath(glbPath).OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview__")).ToList();
            if (clips.Count > 0)
            {
                var ctl = AnimatorController.CreateAnimatorControllerAtPath(Built + "/Mojulo.controller");
                foreach (var c in clips) ctl.AddMotion(c);
                // (glTFast's clips are bound from the GLB's root, which its design-time import leaves without an Animator)
                var anims = inst.GetComponentsInChildren<Animator>(true);
                if (anims.Length == 0) anims = new[] { inst.AddComponent<Animator>() };
                foreach (var a in anims) if (a.runtimeAnimatorController == null) a.runtimeAnimatorController = ctl;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(scenePath));
            if (!EditorSceneManager.SaveScene(scene, scenePath)) throw new Exception("cannot save " + scenePath);
            AssetDatabase.SaveAssets();
            Log("built " + Json.Str(H, "version") + " in " + scenePath + ": " + Json.Write(mats.stats.ToDictionary(k => k.Key, k => (object)(double)k.Value)) + "; "
                + blocks + " colliders, " + still + " without; " + lamps + " lamps; " + nMarkers + " markers, " + nSeats + " seats; " + cams + " cameras; " + clips.Count + " clips; ambient from " + ambFrom
                + (madePipeline ? "; the pipeline made" : ""));

            DeveloperScene(levelPath, scenePath, info);
            AssetDatabase.SaveAssets();
        }

        // the developer's scene, made once: mojulo's scene loaded into it (MojuloStream), its lighting the level's; then
        // both in the build's scene list (the developer's first)
        static void DeveloperScene(string levelPath, string scenePath, MojuloLevel info)
        {
            var amb = info.ambientLinear;
            var sky = info.sky;
            if (!File.Exists(levelPath))
            {
                var dev = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                var go = new GameObject("Mojulo");
                var s = go.AddComponent<MojuloStream>();
                s.scenePath = scenePath;
                s.sceneName = Path.GetFileNameWithoutExtension(scenePath);
                RenderSettings.ambientMode = AmbientMode.Flat;
                RenderSettings.ambientLight = amb.gamma;
                RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
                RenderSettings.reflectionIntensity = 0f;
                RenderSettings.skybox = sky;
                RenderSettings.fog = false;
                Directory.CreateDirectory(Path.GetDirectoryName(levelPath));
                if (!EditorSceneManager.SaveScene(dev, levelPath)) throw new Exception("cannot save " + levelPath);
                Log("made the developer's scene " + levelPath);
            }
            else Log("kept the developer's scene " + levelPath);
            var list = EditorBuildSettings.scenes.Where(x => x.path != scenePath && x.path != levelPath).ToList();
            list.Insert(0, new EditorBuildSettingsScene(levelPath, true));
            list.Insert(1, new EditorBuildSettingsScene(scenePath, true));
            EditorBuildSettings.scenes = list.ToArray();
        }
    }

    // the editor opens mojulo's scene beside the developer's, as the game loads it (MojuloStream)
    [InitializeOnLoad]
    static class OpenBeside
    {
        static OpenBeside()
        {
            EditorSceneManager.sceneOpened += (scene, mode) =>
            {
                if (Application.isBatchMode || mode != OpenSceneMode.Single) return;
                foreach (var r in scene.GetRootGameObjects())
                {
                    var s = r.GetComponentInChildren<MojuloStream>(true);
                    if (s == null || !File.Exists(s.scenePath) || SceneManager.GetSceneByPath(s.scenePath).isLoaded) continue;
                    EditorSceneManager.OpenScene(s.scenePath, OpenSceneMode.Additive);
                }
            };
        }
    }
}
