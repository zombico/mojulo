// MojuloProbe.cs - THE HANDOFF'S PROBE AND STILLS in Unity (scene/handoff-unity.js's gate), run after the import:
//
//   Unity -batchmode -projectPath <pack> -executeMethod Mojulo.Handoff.Probe.Run -quit -logFile <log>
//     opens the developer's scene with mojulo's beside it and logs one line, `[mojulo-handoff-probe] {json}`: what the
//     importer built from the handoff, to be held against handoff.json
//   MOJULO_SHOTS=<shots.json> Unity -batchmode -projectPath <pack> -executeMethod Mojulo.Handoff.Probe.Render -quit ...
//     a still per shot of mojulo's scene through its own pipeline (a Camera rendered into a RenderTexture, read back,
//     a PNG): {"shots": [{"out": "<png>", "w": 1280, "h": 720, "camera": "<a camera's name>"} | {"out", "w", "h",
//     "at": [x, y, z], "look": [x, y, z], "yfov": radians} (mojulo's frame: z-up metres)]}; without -nographics
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

namespace Mojulo.Handoff
{
    public static class Probe
    {
        static double R(double v, int n = 5) => Math.Round(v, n);

        public static void Run()
        {
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            var o = new Dictionary<string, object>();
            try { Measure(o); }
            catch (Exception e) { o["ok"] = false; o["error"] = e.ToString(); }
            Debug.Log("[mojulo-handoff-probe] " + Json.Write(o));
        }

        static void Measure(Dictionary<string, object> o)
        {
            var H = Import.Handoff();
            var scenePath = Import.ScenePath(H);
            var levelPath = Import.LevelPath(H);
            o["ok"] = true;
            o["unity"] = Application.unityVersion;
            o["colour_space"] = PlayerSettings.colorSpace.ToString();
            var urp = GraphicsSettings.defaultRenderPipeline as UniversalRenderPipelineAsset;
            o["pipeline"] = urp != null ? AssetDatabase.GetAssetPath(urp) : null;
            o["hdr"] = urp != null && urp.supportsHDR;
            // (the tone's pass on the pipeline's renderer)
            UniversalRendererData rd = null;
            if (urp != null)
            {
                var so = new SerializedObject(urp);
                var list = so.FindProperty("m_RendererDataList");
                int di = so.FindProperty("m_DefaultRendererIndex")?.intValue ?? 0;
                rd = list != null && list.arraySize > di ? list.GetArrayElementAtIndex(di).objectReferenceValue as UniversalRendererData : null;
            }
            var tone = rd?.rendererFeatures.FirstOrDefault(x => x != null && x.name == Import.Tone) as FullScreenPassRendererFeature;
            o["tone"] = tone != null && tone.isActive && tone.passMaterial != null && tone.passMaterial.shader.name == "Mojulo/Tone";
            o["tone_depth"] = tone != null && (tone.requirements & ScriptableRenderPassInput.Depth) != 0 && rd.copyDepthMode == CopyDepthMode.AfterTransparents;

            if (!File.Exists(levelPath) || !File.Exists(scenePath)) { o["ok"] = false; o["error"] = "no scene at " + (File.Exists(levelPath) ? scenePath : levelPath); return; }
            var dev = EditorSceneManager.OpenScene(levelPath, OpenSceneMode.Single);
            var ms = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Additive);
            var stream = dev.GetRootGameObjects().SelectMany(g => g.GetComponentsInChildren<MojuloStream>(true)).FirstOrDefault();
            o["streamed"] = stream != null && stream.scenePath == scenePath && EditorBuildSettings.scenes.Any(s => s.path == scenePath && s.enabled) && EditorBuildSettings.scenes.Any(s => s.path == levelPath && s.enabled);
            // (what the developer added: every object of their scene but mojulo's link)
            o["developer"] = dev.GetRootGameObjects().Where(g => g.GetComponent<MojuloStream>() == null).Sum(g => g.GetComponentsInChildren<Transform>(true).Length);
            SceneManager.SetActiveScene(ms);
            var all = ms.GetRootGameObjects().SelectMany(g => g.GetComponentsInChildren<Transform>(true)).Select(t => t.gameObject).ToList();
            o["objects"] = all.Count;

            var info = all.Select(g => g.GetComponent<MojuloLevel>()).FirstOrDefault(x => x != null);
            o["level"] = info != null;
            o["handoff"] = info?.handoff;
            o["record"] = info != null && info.json != null && Json.Parse(info.json) is Dictionary<string, object>;
            o["haze"] = info != null && info.hazeDensity > 0 ? (object)R(info.hazeDensity, 6) : null;
            o["haze_colour"] = info != null && info.hazeDensity > 0 ? new List<object> { R(info.hazeColour.r, 4), R(info.hazeColour.g, 4), R(info.hazeColour.b, 4) } : null;
            o["fog"] = RenderSettings.fog;
            o["fog_exp2"] = RenderSettings.fogMode == FogMode.ExponentialSquared ? (object)R(RenderSettings.fogDensity, 6) : null;
            var a = RenderSettings.ambientLight.linear;
            o["ambient"] = new List<object> { R(a.r, 4), R(a.g, 4), R(a.b, 4) };
            o["ambient_flat"] = RenderSettings.ambientMode == AmbientMode.Flat;
            o["reflection"] = R(RenderSettings.reflectionIntensity, 4);
            o["sky"] = RenderSettings.skybox != null && RenderSettings.skybox.shader.name == "Mojulo/Sky";

            int markers = 0, seats = 0, records = 0;
            foreach (var m in all.Select(g => g.GetComponent<MojuloMarker>()).Where(x => x != null))
            {
                if (m.kind == "seat") seats++;
                else if (m.kind != "seats") markers++;
                try { if (Json.Parse(m.json) is Dictionary<string, object>) records++; } catch (Exception) { }
            }
            o["markers"] = markers; o["seats"] = seats; o["marker_records"] = records;

            var lights = all.Select(g => g.GetComponent<Light>()).Where(x => x != null).ToList();
            var sun = lights.FirstOrDefault(l => l.type == LightType.Directional && l.name == "MojuloSun");
            o["sun"] = sun != null;
            o["sun_intensity"] = sun != null ? (object)R(sun.intensity) : null;
            o["sun_default"] = info != null && info.sunDefault;
            o["sun_shadow"] = sun != null && sun.shadows != LightShadows.None;
            var pts = lights.Where(l => l.type == LightType.Point).ToList();
            o["points"] = pts.Count;
            o["point_intensity"] = R(pts.Sum(l => (double)l.intensity), 4);
            o["point_shadows"] = pts.Count(l => l.shadows != LightShadows.None);

            var cams = all.Select(g => g.GetComponent<Camera>()).Where(x => x != null).ToList();
            o["cameras"] = cams.Count(c => c.name.StartsWith("MojuloCamera"));
            o["main_camera"] = cams.Count(c => c.enabled && c.CompareTag("MainCamera"));
            o["glb_cameras_on"] = cams.Count(c => c.enabled && !c.name.StartsWith("MojuloCamera"));

            var skinned = all.Select(g => g.GetComponent<SkinnedMeshRenderer>()).Where(x => x != null).ToList();
            o["skinned"] = skinned.Count;
            var anim = all.Select(g => g.GetComponent<Animator>()).Where(x => x != null && x.runtimeAnimatorController != null).ToList();
            o["animators"] = anim.Count;
            o["clips"] = anim.SelectMany(x => x.runtimeAnimatorController.animationClips).Distinct().Count();

            int blocking = 0, still = 0, entity = 0, terrain = 0, sea = 0;
            bool seaDepth = false; object seaShadow = null;
            var seen = new HashSet<Material>();
            foreach (var mr in all.Select(g => g.GetComponent<MeshRenderer>()).Where(x => x != null))
            {
                var mf = mr.GetComponent<MeshFilter>();
                if (mf == null || mf.sharedMesh == null) continue;
                if (mr.name.StartsWith("entity:") || (mr.transform.parent != null && mr.transform.parent.name.StartsWith("entity:"))) entity++;
                if (mr.GetComponent<MeshCollider>() != null) blocking++; else still++;
                foreach (var m in mr.sharedMaterials)
                {
                    if (m == null) continue;
                    if (m.shader.name == "Mojulo/Terrain") terrain++;
                    if (m.shader.name == "Mojulo/Sea") { sea++; seaDepth = m.GetTexture("_TDepth") != null; seaShadow = mr.shadowCastingMode != ShadowCastingMode.Off; }
                    seen.Add(m);
                }
            }
            foreach (var r in skinned) foreach (var m in r.sharedMaterials) if (m != null) seen.Add(m);
            o["entity_meshes"] = entity; o["blocking"] = blocking; o["no_collision"] = still;
            o["terrain"] = terrain; o["sea"] = sea; o["sea_depth"] = seaDepth; o["sea_shadow"] = seaShadow;

            int lit = 0, translucent = 0, vc = 0, normal = 0, orm = 0, height = 0, other = 0;
            object heightScale = null, terrainLayers = null, terrainPath = false;
            foreach (var m in seen)
            {
                var sh = m.shader.name;
                if (sh == "Mojulo/Lit")
                {
                    if (m.IsKeywordEnabled("_MOJULO_BLEND")) translucent++; else lit++;
                    if (m.IsKeywordEnabled("_MOJULO_VERTEX_COLOUR")) vc++;
                    if (m.IsKeywordEnabled("_MOJULO_NORMALMAP") && m.GetTexture("_NormalMap") != null) normal++;
                    if (m.GetTexture("_OrmMap") != null) orm++;
                    if (m.GetTexture("_HeightMap") != null) { height++; heightScale = R(m.GetFloat("_HeightScale")); }
                }
                else if (sh == "Mojulo/Terrain")
                {
                    var arr = m.GetTexture("_TBase") as Texture2DArray;
                    terrainLayers = arr != null ? (object)arr.depth : null;
                    var tp = m.GetTexture("_TPath");
                    terrainPath = tp != null && tp.name == "T_MojuloPath";
                }
                else if (sh != "Mojulo/Sea") other++;
            }
            o["materials"] = seen.Count; o["lit"] = lit; o["translucent"] = translucent; o["vertex_colour"] = vc;
            o["normal"] = normal; o["orm"] = orm; o["height"] = height; o["height_scale"] = heightScale; o["other_materials"] = other;
            o["terrain_layers"] = terrainLayers; o["terrain_path"] = terrainPath;
        }

        // ---- the stills ----------------------------------------------------------------------------------------------

        public static void Render()
        {
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            try
            {
                // (the editor compiles a shader variant in the background the first time one is drawn, and draws a
                // stand-in meanwhile: a still waits for every variant it draws)
                ShaderUtil.allowAsyncCompilation = false;
                var J = Json.Parse(File.ReadAllText(Environment.GetEnvironmentVariable("MOJULO_SHOTS"))) as Dictionary<string, object>;
                var H = Import.Handoff();
                var scene = EditorSceneManager.OpenScene(Import.ScenePath(H), OpenSceneMode.Single);
                SceneManager.SetActiveScene(scene);
                var all = scene.GetRootGameObjects().SelectMany(g => g.GetComponentsInChildren<Camera>(true)).ToList();
                int i = 0;
                foreach (var so in Json.Arr(J, "shots") ?? new List<object>())
                {
                    var s = so as Dictionary<string, object>;
                    int w = (int)Json.Num(s, "w", 1280), h = (int)Json.Num(s, "h", 720);
                    Camera cam;
                    GameObject temp = null;
                    if (Json.Str(s, "camera") != null)
                    {
                        cam = all.FirstOrDefault(c => c.name == Json.Str(s, "camera"));
                        if (cam == null) { Import.Fail("no camera " + Json.Str(s, "camera")); continue; }
                    }
                    else
                    {
                        temp = new GameObject("MojuloShot_" + i);
                        SceneManager.MoveGameObjectToScene(temp, scene);
                        var at = Json.Floats(s, "at"); var look = Json.Floats(s, "look");
                        temp.transform.position = Import.U(at);
                        temp.transform.rotation = Quaternion.LookRotation(Import.U(look) - Import.U(at), Vector3.up);
                        cam = temp.AddComponent<Camera>();
                        cam.fieldOfView = (float)(Json.Num(s, "yfov", 50 * Math.PI / 180) * 180 / Math.PI);
                        cam.nearClipPlane = 0.1f; cam.farClipPlane = 20000f; cam.allowHDR = true; cam.clearFlags = CameraClearFlags.Skybox;
                        temp.AddComponent<UniversalAdditionalCameraData>().renderPostProcessing = false;
                    }
                    // (a camera rendering into a texture renders in that texture's format: an HDR one, as the screen's
                    // intermediate is, so the tone pass sees the light unclamped; then encoded to 8-bit sRGB to read)
                    var hdr = new RenderTexture(w, h, 24, RenderTextureFormat.ARGBHalf, RenderTextureReadWrite.Linear) { antiAliasing = Math.Max(1, (int)Json.Num(s, "msaa", 4)) };
                    var rt = new RenderTexture(w, h, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
                    var was = cam.enabled;
                    cam.enabled = true;
                    cam.aspect = (float)w / h;
                    cam.targetTexture = hdr;
                    cam.Render();
                    Graphics.Blit(hdr, rt);
                    RenderTexture.active = rt;
                    var tex = new Texture2D(w, h, TextureFormat.RGB24, false, false);
                    tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
                    tex.Apply();
                    RenderTexture.active = null;
                    cam.targetTexture = null;
                    cam.enabled = was;
                    var outPath = Json.Str(s, "out");
                    File.WriteAllBytes(outPath, tex.EncodeToPNG());
                    Debug.Log("[mojulo-handoff-render] " + cam.name + " -> " + outPath);
                    UnityEngine.Object.DestroyImmediate(tex);
                    rt.Release();
                    hdr.Release();
                    if (temp != null) UnityEngine.Object.DestroyImmediate(temp);
                    i++;
                }
            }
            catch (Exception e)
            {
                Import.Fail("render: " + e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
            }
        }
    }
}
