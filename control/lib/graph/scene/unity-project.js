/**
 * unity-project.js — the Unity 6 pack emitter (export-unity.plan.md Y0+Y1).
 *
 * Third engine leg beside godot-project.js (built) and the Unreal spec. The
 * pack is DATA (GLBs + score.json sidecars + game.json + audio + recipe)
 * plus the mojulo-unity kernel: one editor-side instrument
 * (Editor/MojuloImport.cs — builds and saves the scenes) and four runtime
 * scripts (Runtime/ — walker, mechanics interpreter, progression, menu; the
 * C# mirror of godot-kernel/, same score, third instrument), plus the
 * T-numbered operator guide (IMPORT-GUIDE.md — Unity import has irreducible
 * human steps; the protocol is the field-tested one from the donated Unity 6
 * AGENTS doc: one step per line, exact UI paths, verify-before-instruct).
 *
 * Everything emitted is deterministic text: no dice, no timestamps, stable
 * ordering. Unity's .meta GUIDs — the determinism threat — are minted from
 * sha256(manifestHash + path) by unityGuid(), so re-mints stay diff-clean.
 *
 * Frame: mojulo is z-up right-handed; facesToGlb bakes a -90°-about-X root
 * (z-up → glTF y-up), and glTFast imports glTF → Unity by negating X. The
 * composed sidecar mapping is P(v) = (-v.x, v.z, -v.y), implemented ONCE in
 * Runtime/MojuloLevel.cs and asserted by the machine gate against a named
 * entity node in the GLB (pinned Y0: landmark match to the centimeter).
 */
import { createHash } from 'node:crypto';
import { GREYBOX_HANDOFF_SENTENCE } from './engine-score.js';

export const UNITY_LEG_VERSION = '0.3.0';
export const UNITY_EDITOR_TARGET = 'Unity 6 (6000.2.x)';

/** Deterministic 32-hex Unity GUID for a pack file. */
export const unityGuid = (manifestHash, relPath) =>
  createHash('sha256').update(`mojulo-unity:${manifestHash}:${relPath}`).digest('hex').slice(0, 32);

/** Minimal .meta body — Unity keeps the guid and backfills importer config. */
export const unityMeta = (guid, { folder = false } = {}) =>
  `fileFormatVersion: 2\nguid: ${guid}\n${folder ? 'folderAsset: yes\n' : ''}`;

const fmt = (n) => {
  const v = Math.round(n * 1e6) / 1e6;
  return Object.is(v, -0) ? '0' : String(v);
};

const ledgerLines = (ledger) => Object.entries(ledger)
  .map(([k, v]) => `- \`${k}\`${v.count != null ? ` ×${v.count}` : ''}${v.kinds ? ` (${v.kinds.join(', ')})` : ''} — ${v.note}`)
  .join('\n');

// The greybox seam (skin-over-mesh.plan.md): stamped packs carry the handoff
// sentence as its own section; unstamped packs emit byte-identical text.
const greyboxSection = (stamped) => (stamped ? `## Greybox handoff

${GREYBOX_HANDOFF_SENTENCE}

` : '');

const MECHANICS_VOCAB = ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive'];
const COMPLETION_KINDS = ['reach-exit', 'survive'];

/** The honest-loss ledger for one level. Since 0.2.0 the mechanics vocabulary
 * is interpreted live by Runtime/MojuloLevel.cs — only out-of-vocabulary
 * gameplay and non-geometry channels remain losses. */
export function unityLevelLedger(score, { gameMode = false } = {}) {
  const ledger = { ...score.ledger };
  // skin-over-mesh phase 3: textures are a CARRIED line — glTFast imports the
  // GLB's TEXCOORD_0 + embedded PNGs as albedo maps, no importer work needed.
  if (Array.isArray(score.textures) && score.textures.length) {
    ledger.textures_carried = {
      count: score.textures.length,
      kinds: score.textures,
      note: 'surface/atlas textures travel inside the GLB (glTFast imports them as albedo maps) — the web build is the reference look',
    };
  }
  if (score.ground != null) {
    ledger.promoted_ground = { note: 'implicit runtime ground plane promoted by the importer — the collider AABBs are obstacle hulls only, never the floor' };
  }
  ledger.entity_markers = {
    note: 'entities that baked no mesh (glyph/primitive bodies — export-side gap) render as gold placeholder markers; the web build is the reference look',
  };
  const kinds = (score.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
  const interpreted = kinds.filter((k) => MECHANICS_VOCAB.includes(k));
  const unknown = kinds.filter((k) => !MECHANICS_VOCAB.includes(k));
  if (interpreted.length) {
    ledger.interpreted_mechanics = { count: interpreted.length, kinds: [...new Set(interpreted)], note: 'performed live by Runtime/MojuloLevel.cs' };
  }
  if (unknown.length) {
    ledger.unknown_mechanics = { count: unknown.length, kinds: [...new Set(unknown)], note: 'outside the kernel vocabulary — do not travel' };
  }
  if (gameMode && !kinds.some((k) => COMPLETION_KINDS.includes(k))) {
    ledger.no_completion_path = {
      note: 'no completion mechanic — the authored win condition lives in the runtime, which does not travel; the level is an explorable arena (Esc frees the mouse, M returns to the menu)',
    };
  }
  if (score.cameras?.length) {
    ledger.cameras_data_only = { count: score.cameras.length, note: 'authored camera framings ride score.json as data; the walker head camera is the play view' };
  }
  ledger.skipped_runtime = ledger.skipped_runtime
    ?? { note: 'game shell, AI, combat feel — re-orchestrate in-engine; reference performance is the web build' };
  return ledger;
}

/* ---------------------------------------------------------- runtime C# --- */
/* The mojulo-unity kernel, runtime half: the C# mirror of godot-kernel/.
 * Plain MonoBehaviours, legacy Input + IMGUI (zero package dependencies;
 * projects set to Input System-only need Active Input Handling = Both — a
 * guide step, see the emitted note). No compile-time glTFast reference. */

function walkerCs() {
  return `// generated by mojulo export-unity — do not hand-edit; re-mint from recipe/
/// <summary>
/// mojulo-unity kernel — the first-person walker. Built by MojuloLevel from
/// the score's eye height (1 mojulo unit = 1 meter at eye 1.7). WASD/arrows +
/// mouse look, Space jumps, Esc frees the mouse (click to recapture).
/// Falling past killY respawns at the spawn point.
/// </summary>
using UnityEngine;

namespace Mojulo
{
    public class MojuloWalker : MonoBehaviour
    {
        public float eye = 1.7f;
        public float speed = 6f;
        public float jump = 4.5f;
        public float gravity = 9.8f;
        public float killY = -100f;
        public Vector3 spawnPos;

        [HideInInspector] public Camera head;
        CharacterController cc;
        float pitch;
        float fallSpeed;

        public void Build(float eyeHeight, float eyeScale)
        {
            eye = eyeHeight;
            cc = gameObject.AddComponent<CharacterController>();
            cc.radius = Mathf.Max(0.3f * eyeScale, 0.05f);
            cc.height = Mathf.Max(1.8f * eyeScale, 2.2f * cc.radius);
            cc.center = new Vector3(0, cc.height / 2f, 0);
            var headGo = new GameObject("Head");
            headGo.transform.SetParent(transform, false);
            headGo.transform.localPosition = new Vector3(0, eye, 0);
            head = headGo.AddComponent<Camera>();
            head.farClipPlane = 8000f;
            headGo.AddComponent<AudioListener>();
        }

        void Start() { Cursor.lockState = CursorLockMode.Locked; }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape)) Cursor.lockState = CursorLockMode.None;
            else if (Input.GetMouseButtonDown(0)) Cursor.lockState = CursorLockMode.Locked;
            if (Cursor.lockState == CursorLockMode.Locked)
            {
                transform.Rotate(0, Input.GetAxis("Mouse X") * 2.2f, 0);
                pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * 2.2f, -86f, 86f);
                if (head != null) head.transform.localEulerAngles = new Vector3(pitch, 0, 0);
            }

            if (cc == null) return;
            if (cc.isGrounded)
            {
                fallSpeed = -0.5f;
                if (Input.GetKey(KeyCode.Space)) fallSpeed = jump;
            }
            else fallSpeed -= gravity * Time.deltaTime;

            var dir = Vector3.zero;
            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) dir += transform.forward;
            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) dir -= transform.forward;
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) dir -= transform.right;
            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) dir += transform.right;
            dir = dir.normalized * speed;
            cc.Move((dir + Vector3.up * fallSpeed) * Time.deltaTime);

            if (transform.position.y < killY) Respawn();
        }

        public void Respawn()
        {
            if (cc != null) cc.enabled = false;
            transform.position = spawnPos;
            fallSpeed = 0f;
            if (cc != null) cc.enabled = true;
        }
    }
}
`;
}

function levelCs() {
  return `// generated by mojulo export-unity — do not hand-edit; re-mint from recipe/
/// <summary>
/// mojulo-unity kernel — the level interpreter, the C# mirror of the Godot
/// kernel's level.gd. Reads the engine-agnostic score.json (z-up frame) and
/// performs the dynamic half live: spawns the walker, marks meshless
/// entities and hazards, interprets the declarative mechanics vocabulary
/// (reach-exit / collect / hazard-damage / survive / fail-on-death), draws
/// the IMGUI HUD and banners, loops the music bed. Static geometry (ground,
/// colliders, spawn marker) is built at import time by Editor/MojuloImport.cs.
/// One score, three instruments: web, Godot, this.
/// </summary>
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Mojulo
{
    public class MojuloLevel : MonoBehaviour
    {
        public TextAsset scoreJson;
        public AudioClip music;

        [Serializable] public class Aabb { public float[] min; public float[] max; }
        [Serializable] public class Entity { public string id; public string figure; public float[] translation; }
        [Serializable] public class PickupSpec { public string item = "item"; public float[] at; public float radius = 1.4f; }
        [Serializable] public class HazardSpec { public float[] at; public float radius = 1.5f; public float damage = 20f; }
        [Serializable] public class Mechanic
        {
            public string kind;
            public float[] at;
            public float[] half;
            public float radius = 2f;
            public bool planar = true;
            public PickupSpec[] pickups;
            public HazardSpec[] hazards;
            public float seconds = 30f;
            public float startHp = 100f;
        }
        [Serializable] public class Score
        {
            public string title;
            public float[] spawn;
            public float eye = 1.7f;
            public float ground;
            public Aabb[] colliders;
            public Entity[] entities;
            public Mechanic[] mechanics;
            public string player;
            public string soundtrack;
        }

        // The one frame conversion: mojulo z-up right-handed -> Unity y-up
        // left-handed (glTF y-up root rotation composed with glTFast's X
        // negation). Pinned by the machine gate's frame landmark.
        public static Vector3 P(float[] v) { return new Vector3(-v[0], v[2], -v[1]); }

        const float HazardCooldown = 0.8f;

        Score score;
        MojuloWalker walker;
        float eyeScale = 1f;
        string state = "playing"; // playing | complete | failed
        string banner;
        float bannerAt = -1f;

        class Zone { public Vector3 pos; public float[] half; public float radius; public bool planar; }
        class Pickup { public string item; public Vector3 pos; public float radius; public bool taken; public GameObject marker; }
        class Hazard { public Vector3 pos; public float radius; public float damage; public float cool; }

        readonly List<Zone> exits = new List<Zone>();
        readonly List<Pickup> pickups = new List<Pickup>();
        readonly List<Hazard> hazards = new List<Hazard>();
        readonly Dictionary<string, int> bag = new Dictionary<string, int>();
        float surviveLeft = -1f;
        bool failOnDeath;
        float hp = -1f;
        float startHp = 100f;

        void Start()
        {
            if (scoreJson == null) { Debug.LogError("[mojulo] MojuloLevel has no score"); return; }
            score = JsonUtility.FromJson<Score>(scoreJson.text);
            eyeScale = Mathf.Max(0.5f, score.eye / 1.7f);
            SpawnWalker();
            MarkMeshlessEntities();
            BuildMechanics();
            StartMusic();
            var editorCam = GameObject.Find("MojuloCamera");
            if (editorCam != null) editorCam.SetActive(false);
        }

        void SpawnWalker()
        {
            var go = new GameObject("MojuloWalkerRoot");
            walker = go.AddComponent<MojuloWalker>();
            var spawn = P(score.spawn ?? new float[] { 0f, 0f, 2f });
            spawn.y += 0.3f * eyeScale;
            walker.spawnPos = spawn;
            go.transform.position = spawn;
            walker.speed = 6f * eyeScale;
            walker.jump = 4.5f * eyeScale;
            walker.gravity = 9.8f * eyeScale;
            var killY = spawn.y - 300f;
            if (score.colliders != null && score.colliders.Length > 0)
            {
                var minZ = float.MaxValue;
                foreach (var c in score.colliders) if (c.min != null) minZ = Mathf.Min(minZ, c.min[2]);
                killY = minZ - 100f;
            }
            walker.killY = killY;
            walker.Build(score.eye > 0f ? score.eye : 1.7f, eyeScale);
        }

        // Entities that baked no mesh get a gold placeholder marker so
        // gameplay anchors are not invisible (same doctrine as Godot).
        void MarkMeshlessEntities()
        {
            if (score.entities == null) return;
            var world = GameObject.Find("World");
            foreach (var e in score.entities)
            {
                if (e.id == score.player || e.translation == null) continue;
                Transform node = null;
                if (world != null && !string.IsNullOrEmpty(e.figure)) node = FindDeep(world.transform, e.figure);
                if (node != null && node.GetComponentInChildren<Renderer>() != null) continue;
                var size = 0.7f * eyeScale;
                var marker = GameObject.CreatePrimitive(PrimitiveType.Cube);
                marker.name = "MojuloEntityMarker_" + e.id;
                UnityEngine.Object.Destroy(marker.GetComponent<Collider>());
                marker.transform.localScale = new Vector3(size, size, size);
                marker.transform.position = P(e.translation) + Vector3.up * (size / 2f);
                marker.GetComponent<Renderer>().material.color = new Color(0.92f, 0.76f, 0.3f);
            }
        }

        static Transform FindDeep(Transform root, string name)
        {
            if (root.name == name) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var hit = FindDeep(root.GetChild(i), name);
                if (hit != null) return hit;
            }
            return null;
        }

        void BuildMechanics()
        {
            if (score.mechanics == null) return;
            foreach (var m in score.mechanics)
            {
                switch (m.kind)
                {
                    case "reach-exit":
                        exits.Add(new Zone { pos = P(m.at ?? new float[3]), half = m.half, radius = m.radius, planar = m.planar });
                        break;
                    case "collect":
                        if (m.pickups != null)
                            foreach (var p in m.pickups)
                                pickups.Add(new Pickup { item = p.item, pos = P(p.at ?? new float[3]), radius = p.radius, marker = PickupMarker(P(p.at ?? new float[3])) });
                        break;
                    case "hazard-damage":
                        startHp = m.startHp; hp = startHp;
                        if (m.hazards != null)
                            foreach (var h in m.hazards)
                            {
                                var pos = P(h.at ?? new float[3]);
                                hazards.Add(new Hazard { pos = pos, radius = h.radius, damage = h.damage });
                                HazardMarker(pos, h.radius);
                            }
                        break;
                    case "fail-on-death":
                        failOnDeath = true;
                        if (hp < 0f) { startHp = m.startHp; hp = startHp; }
                        break;
                    case "survive":
                        surviveLeft = m.seconds;
                        break;
                }
            }
        }

        GameObject PickupMarker(Vector3 pos)
        {
            var size = 0.5f * eyeScale;
            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "MojuloPickup";
            UnityEngine.Object.Destroy(marker.GetComponent<Collider>());
            marker.transform.localScale = new Vector3(size, size, size);
            marker.transform.position = pos + Vector3.up * (0.6f * eyeScale);
            marker.GetComponent<Renderer>().material.color = new Color(0.98f, 0.85f, 0.25f);
            return marker;
        }

        // Hazards export no visual at all (score data, not entities) — a
        // translucent danger sphere keeps the gameplay anchor visible.
        void HazardMarker(Vector3 pos, float radius)
        {
            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "MojuloHazard";
            UnityEngine.Object.Destroy(marker.GetComponent<Collider>());
            marker.transform.localScale = new Vector3(radius * 2f, radius * 2f, radius * 2f);
            marker.transform.position = pos;
            var mat = marker.GetComponent<Renderer>().material;
            mat.color = new Color(0.95f, 0.25f, 0.2f, 0.35f);
            mat.SetFloat("_Mode", 3f); // legacy Standard transparent hint; harmless elsewhere
            mat.renderQueue = 3000;
        }

        void StartMusic()
        {
            if (music == null) return;
            var audio = gameObject.AddComponent<AudioSource>();
            audio.clip = music; audio.loop = true; audio.playOnAwake = false;
            audio.Play();
        }

        // Distance from a point to the walker's BODY (feet -> head segment),
        // not the feet point — a chest-height hazard must still connect.
        float BodyDistance(Vector3 target)
        {
            var feet = walker.transform.position;
            var y = Mathf.Clamp(target.y, feet.y, feet.y + score.eye);
            return Vector3.Distance(target, new Vector3(feet.x, y, feet.z));
        }

        bool ZoneHit(Zone z, Vector3 pos)
        {
            if (z.half != null && z.half.Length >= 3)
            {
                if (Mathf.Abs(pos.x - z.pos.x) > z.half[0] || Mathf.Abs(pos.z - z.pos.z) > z.half[1]) return false;
                return z.planar || Mathf.Abs(pos.y - z.pos.y) <= z.half[2];
            }
            if (z.planar)
                return new Vector2(pos.x - z.pos.x, pos.z - z.pos.z).magnitude <= z.radius;
            return Vector3.Distance(pos, z.pos) <= z.radius;
        }

        void Update()
        {
            if (state != "playing" || walker == null) return;
            if (Input.GetKeyDown(KeyCode.M) && MojuloGame.HasMenu()) { MojuloGame.ToMenu(); return; }
            var pos = walker.transform.position;
            foreach (var z in exits) if (ZoneHit(z, pos)) { Complete(); return; }
            if (surviveLeft >= 0f)
            {
                surviveLeft = Mathf.Max(0f, surviveLeft - Time.deltaTime);
                if (surviveLeft == 0f) { Complete(); return; }
            }
            foreach (var p in pickups)
                if (!p.taken && BodyDistance(p.pos) <= p.radius + 0.4f * eyeScale)
                {
                    p.taken = true;
                    if (p.marker != null) p.marker.SetActive(false);
                    bag[p.item] = (bag.TryGetValue(p.item, out var n) ? n : 0) + 1;
                    Debug.Log("moj: picked up " + p.item);
                }
            foreach (var h in hazards)
            {
                h.cool = Mathf.Max(0f, h.cool - Time.deltaTime);
                if (h.cool == 0f && BodyDistance(h.pos) <= h.radius + 0.4f * eyeScale)
                {
                    h.cool = HazardCooldown;
                    hp = Mathf.Max(0f, hp - h.damage);
                    Debug.Log("moj: hazard hit, hp " + (int)hp);
                    if (failOnDeath && hp <= 0f) { Fail(); return; }
                }
            }
        }

        void Complete()
        {
            state = "complete";
            banner = "LEVEL COMPLETE";
            bannerAt = Time.time;
            Debug.Log("moj: level complete");
            MojuloGame.LevelComplete(this);
        }

        void Fail()
        {
            state = "failed";
            banner = "FAILED";
            bannerAt = Time.time;
            Debug.Log("moj: level failed");
            if (MojuloGame.HasMenu()) MojuloGame.LevelFailed(this);
            else Invoke(nameof(ResetLevel), 1.5f);
        }

        public void ResetLevel()
        {
            banner = null;
            hp = (hp >= 0f || failOnDeath) ? startHp : -1f;
            bag.Clear();
            foreach (var p in pickups) { p.taken = false; if (p.marker != null) p.marker.SetActive(true); }
            if (score.mechanics != null)
                foreach (var m in score.mechanics)
                    if (m.kind == "survive") surviveLeft = m.seconds;
            walker.Respawn();
            state = "playing";
        }

        void OnGUI()
        {
            var parts = new List<string>();
            if (hp >= 0f) parts.Add("HP " + Mathf.CeilToInt(hp));
            if (surviveLeft >= 0f) parts.Add("SURVIVE " + Mathf.CeilToInt(surviveLeft));
            foreach (var kv in bag) parts.Add(kv.Key.ToUpperInvariant() + " ×" + kv.Value);
            if (parts.Count > 0)
                GUI.Label(new Rect(16, 12, 800, 30), string.Join("   ", parts), HudStyle(20, TextAnchor.UpperLeft));
            if (banner != null)
            {
                var style = HudStyle(48, TextAnchor.MiddleCenter);
                style.normal.textColor = state == "failed" ? new Color(1f, 0.35f, 0.3f) : Color.white;
                GUI.Label(new Rect(0, 0, Screen.width, Screen.height), banner, style);
            }
        }

        static GUIStyle HudStyle(int size, TextAnchor anchor)
        {
            var style = new GUIStyle(GUI.skin.label) { fontSize = size, alignment = anchor };
            style.normal.textColor = Color.white;
            return style;
        }
    }
}
`;
}

function gameCs() {
  return `// generated by mojulo export-unity — do not hand-edit; re-mint from recipe/
/// <summary>
/// mojulo-unity kernel — the game shell, the C# mirror of the Godot kernel's
/// game.gd autoload. Level flow (menu <-> levels via scene names in the build
/// settings list, written by the importer) and completion progression,
/// persisted in PlayerPrefs under "mojulo.completed". Store slices beyond
/// completion do not travel (see the pack README ledger).
/// </summary>
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mojulo
{
    public static class MojuloGame
    {
        public const string MenuScene = "mojulo-menu";
        const string SaveKey = "mojulo.completed";
        public static string current;

        public static bool HasMenu() { return Application.CanStreamedLevelBeLoaded(MenuScene); }

        public static HashSet<string> Completed()
        {
            var set = new HashSet<string>();
            foreach (var r in PlayerPrefs.GetString(SaveKey, "").Split('|'))
                if (r.Length > 0) set.Add(r);
            return set;
        }

        public static void StartLevel(string levelRef)
        {
            current = levelRef;
            SceneManager.LoadScene(levelRef);
        }

        public static void LevelComplete(MojuloLevel level)
        {
            if (!string.IsNullOrEmpty(current))
            {
                var done = Completed();
                done.Add(current);
                PlayerPrefs.SetString(SaveKey, string.Join("|", done));
                PlayerPrefs.Save();
            }
            if (HasMenu()) level.Invoke(nameof(ToMenuBridge.Go), 0f);
            ToMenuBridge.Arm(level, 1.5f);
        }

        public static void LevelFailed(MojuloLevel level) { ToMenuBridge.Arm(level, 1.5f); }

        public static void ToMenu()
        {
            current = null;
            SceneManager.LoadScene(MenuScene);
        }
    }

    /// <summary>Tiny helper: waits out the banner, then returns to the menu
    /// (static classes cannot Invoke; the level MonoBehaviour hosts it).</summary>
    public class ToMenuBridge : MonoBehaviour
    {
        public static void Arm(MojuloLevel level, float delay)
        {
            if (!MojuloGame.HasMenu()) return;
            var bridge = level.gameObject.AddComponent<ToMenuBridge>();
            bridge.Invoke(nameof(Go), delay);
        }
        public void Go() { MojuloGame.ToMenu(); }
    }
}
`;
}

function menuCs() {
  return `// generated by mojulo export-unity — do not hand-edit; re-mint from recipe/
/// <summary>
/// mojulo-unity kernel — the menu, the C# mirror of the Godot kernel's
/// menu.gd. Builds the level list from game.json (assigned by the importer);
/// locked entries show their gate state; completion marks ride PlayerPrefs.
/// IMGUI — zero scene wiring, works in any pipeline.
/// </summary>
using System;
using UnityEngine;

namespace Mojulo
{
    public class MojuloMenu : MonoBehaviour
    {
        public TextAsset gameJson;
        public AudioClip music;

        [Serializable] public class Gate { public string completed; }
        [Serializable] public class LevelEntry { public string title; public string @ref; public Gate gate; }
        [Serializable] public class GameManifest { public string title = "mojulo game"; public LevelEntry[] levels; }

        GameManifest game;

        void Start()
        {
            Cursor.lockState = CursorLockMode.None;
            game = gameJson != null ? JsonUtility.FromJson<GameManifest>(gameJson.text) : new GameManifest();
            if (music != null)
            {
                var audio = gameObject.AddComponent<AudioSource>();
                audio.clip = music; audio.loop = true; audio.Play();
            }
        }

        void OnGUI()
        {
            if (game == null) return;
            var done = MojuloGame.Completed();
            var y = Screen.height * 0.22f;
            var heading = new GUIStyle(GUI.skin.label) { fontSize = 40, alignment = TextAnchor.MiddleCenter };
            heading.normal.textColor = Color.white;
            GUI.Label(new Rect(0, y, Screen.width, 60), game.title, heading);
            y += 90;
            if (game.levels == null) return;
            foreach (var lv in game.levels)
            {
                var label = string.IsNullOrEmpty(lv.title) ? lv.@ref : lv.title;
                var gateRef = lv.gate != null ? lv.gate.completed : "";
                var locked = !string.IsNullOrEmpty(gateRef) && !done.Contains(gateRef);
                if (done.Contains(lv.@ref)) label += "  [done]";
                if (locked) label += "  [locked]";
                GUI.enabled = !locked;
                if (GUI.Button(new Rect(Screen.width / 2f - 220, y, 440, 44), label) && !locked)
                    MojuloGame.StartLevel(lv.@ref);
                GUI.enabled = true;
                y += 56;
            }
        }
    }
}
`;
}

/* ----------------------------------------------------------- editor C# --- */

/** Editor/MojuloImport.cs — the editor-side instrument. Zero compile-time
 * dependencies beyond UnityEditor + the pack's own runtime scripts: glTFast
 * is only needed at asset-import time, so its absence is detected as "the
 * .glb produced no prefab" and reported with the guide step to run. */
function importerCs({ packFolder }) {
  return `// generated by mojulo export-unity — do not hand-edit; re-mint from recipe/
/// <summary>
/// Mojulo pack importer (editor-only). World pack: builds one scene from
/// ${packFolder}/score.json + model.glb. Game pack (${packFolder}/game.json
/// present): builds one scene per level from levels/&lt;ref&gt;/ plus the menu
/// scene, and writes them all into the build settings scene list (menu
/// first). Static geometry (ground, colliders, spawn marker, editor camera,
/// light) is baked into the saved .unity scenes; the dynamic half (walker,
/// mechanics, HUD) is performed at play time by Runtime/MojuloLevel.cs.
/// Idempotent: re-running against a re-exported pack rebuilds in place.
/// Entry points: menu "Tools > Mojulo > Import Pack"; batchmode
/// Mojulo.Import.Run and Mojulo.Import.Verify (writes mojulo-gate.json).
/// </summary>
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Mojulo
{
    public static class Import
    {
        const string PackRoot = "Assets/${packFolder}";
        static string ScenesDir => PackRoot + "/Scenes";
        static Vector3 P(float[] v) { return MojuloLevel.P(v); }

        [Serializable] class GameLevel { public string title; public string @ref; }
        [Serializable] class GameManifest { public string title; public GameLevel[] levels; }

        [MenuItem("Tools/Mojulo/Import Pack")]
        public static void RunMenu() { Debug.Log("[mojulo] " + Build()); }

        /// <summary>Batchmode entry: -executeMethod Mojulo.Import.Run</summary>
        public static void Run()
        {
            try { Debug.Log("[mojulo] " + Build()); if (Application.isBatchMode) EditorApplication.Exit(0); }
            catch (Exception e) { Debug.LogError("[mojulo] import FAILED: " + e.Message); if (Application.isBatchMode) EditorApplication.Exit(1); else throw; }
        }

        static bool IsGame() { return File.Exists(PackRoot + "/game.json"); }

        static GameManifest ReadGame()
        {
            return JsonUtility.FromJson<GameManifest>(File.ReadAllText(PackRoot + "/game.json"));
        }

        static MojuloLevel.Score ReadScore(string resBase)
        {
            var p = resBase + "score.json";
            if (!File.Exists(p)) throw new Exception("score.json not found at " + p + " — copy the pack to " + PackRoot + " (IMPORT-GUIDE.md T003)");
            return JsonUtility.FromJson<MojuloLevel.Score>(File.ReadAllText(p));
        }

        static string Build()
        {
            Directory.CreateDirectory(ScenesDir);
            var scenes = new List<string>();
            string report;
            if (IsGame())
            {
                var game = ReadGame();
                var menuPath = BuildMenuScene(game);
                scenes.Add(menuPath);
                var n = 0;
                foreach (var lv in game.levels)
                {
                    scenes.Add(BuildLevelScene(PackRoot + "/levels/" + lv.@ref + "/", lv.@ref));
                    n++;
                }
                report = "imported game '" + game.title + "' -> menu + " + n + " level scene(s) in " + ScenesDir;
            }
            else
            {
                var scenePath = BuildLevelScene(PackRoot + "/", "mojulo-level");
                scenes.Add(scenePath);
                report = "imported '" + ReadScore(PackRoot + "/").title + "' -> " + scenePath;
            }
            var list = new List<EditorBuildSettingsScene>();
            foreach (var s in scenes) list.Add(new EditorBuildSettingsScene(s, true));
            EditorBuildSettings.scenes = list.ToArray();
            AssetDatabase.Refresh();
            return report;
        }

        static string BuildLevelScene(string resBase, string sceneName)
        {
            var score = ReadScore(resBase);
            var glbPath = resBase + "model.glb";
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(glbPath);
            if (prefab == null)
                throw new Exception(glbPath + " produced no prefab — is com.unity.cloud.gltfast installed? (IMPORT-GUIDE.md T002)");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var world = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            world.name = "World";

            // Hide the player-seat body: the operator IS the walker. GLB entity
            // wrappers are named by FIGURE (the id rides glTF extras, which
            // glTFast does not surface as a node name).
            if (!string.IsNullOrEmpty(score.player))
            {
                var seat = FindEntityNode(world.transform, score.entities, score.player);
                if (seat != null) seat.gameObject.SetActive(false);
            }

            // Implicit ground plane at mojulo z = ground: obstacle colliders
            // are hulls only — without this the player falls forever.
            var bounds = new Bounds(P(score.spawn ?? new float[] { 0f, 0f, 0f }), Vector3.one);
            if (score.colliders != null)
                foreach (var b in score.colliders) bounds.Encapsulate(new Bounds(AabbCenter(b), AabbSize(b)));
            var ground = new GameObject("MojuloGround");
            var gc = ground.AddComponent<BoxCollider>();
            ground.transform.position = new Vector3(bounds.center.x, score.ground - 0.5f, bounds.center.z);
            gc.size = new Vector3(bounds.size.x + 400f, 1f, bounds.size.z + 400f);

            var colliderRoot = new GameObject("MojuloColliders");
            if (score.colliders != null)
                for (int i = 0; i < score.colliders.Length; i++)
                {
                    var go = new GameObject("MojuloCollider_" + i);
                    go.transform.SetParent(colliderRoot.transform, false);
                    go.transform.position = AabbCenter(score.colliders[i]);
                    go.AddComponent<BoxCollider>().size = AabbSize(score.colliders[i]);
                }

            var spawn = new GameObject("MojuloSpawn");
            spawn.transform.position = P(score.spawn ?? new float[] { 0f, 0f, 0f });

            // Editor-view camera; MojuloLevel disables it when the walker spawns.
            var camGo = new GameObject("MojuloCamera");
            camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();
            camGo.transform.position = spawn.transform.position + Vector3.up * (score.eye > 0f ? score.eye : 1.7f);

            var lightGo = new GameObject("MojuloLight");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // The kernel seat: score + music wired for the runtime half.
            var kernel = new GameObject("MojuloKernel");
            var level = kernel.AddComponent<MojuloLevel>();
            level.scoreJson = AssetDatabase.LoadAssetAtPath<TextAsset>(resBase + "score.json");
            if (!string.IsNullOrEmpty(score.soundtrack))
                level.music = AssetDatabase.LoadAssetAtPath<AudioClip>(PackRoot + "/audio/" + score.soundtrack + ".wav");

            var scenePath = ScenesDir + "/" + sceneName + ".unity";
            if (!EditorSceneManager.SaveScene(scene, scenePath)) throw new Exception("SaveScene failed: " + scenePath);
            Debug.Log("[mojulo] level '" + score.title + "' -> " + scenePath + " (" + (score.colliders != null ? score.colliders.Length : 0) + " colliders)");
            return scenePath;
        }

        static string BuildMenuScene(GameManifest game)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camGo = new GameObject("MojuloCamera");
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.09f, 0.1f, 0.13f);
            camGo.AddComponent<AudioListener>();
            var menuGo = new GameObject("MojuloMenu");
            var menu = menuGo.AddComponent<MojuloMenu>();
            menu.gameJson = AssetDatabase.LoadAssetAtPath<TextAsset>(PackRoot + "/game.json");
            var menuMusic = AssetDatabase.LoadAssetAtPath<AudioClip>(PackRoot + "/audio/menu.wav");
            if (menuMusic != null) menu.music = menuMusic;
            var scenePath = ScenesDir + "/" + MojuloGame.MenuScene + ".unity";
            if (!EditorSceneManager.SaveScene(scene, scenePath)) throw new Exception("SaveScene failed: " + scenePath);
            return scenePath;
        }

        static Vector3 AabbCenter(MojuloLevel.Aabb b)
        {
            return P(new[] { (b.min[0] + b.max[0]) * 0.5f, (b.min[1] + b.max[1]) * 0.5f, (b.min[2] + b.max[2]) * 0.5f });
        }
        static Vector3 AabbSize(MojuloLevel.Aabb b)
        {
            return new Vector3(b.max[0] - b.min[0], b.max[2] - b.min[2], b.max[1] - b.min[1]);
        }

        static Transform FindDeep(Transform root, string name)
        {
            if (root.name == name) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var hit = FindDeep(root.GetChild(i), name);
                if (hit != null) return hit;
            }
            return null;
        }

        static Transform FindEntityNode(Transform world, MojuloLevel.Entity[] entities, string id)
        {
            if (entities != null)
                foreach (var e in entities)
                    if (e.id == id && !string.IsNullOrEmpty(e.figure))
                    {
                        var byFigure = FindDeep(world, e.figure);
                        if (byFigure != null) return byFigure;
                    }
            return FindDeep(world, "entity:" + id);
        }

        /// <summary>Standalone player build: -executeMethod Mojulo.Import.BuildPlayer.
        /// Builds the scene list the importer wrote (menu first for games) into
        /// build/mojulo.app (macOS) / build/mojulo.exe (Windows) for the host
        /// platform. Exit 0 iff the build report says Succeeded.</summary>
        public static void BuildPlayer()
        {
            try
            {
                var scenes = new List<string>();
                foreach (var s in EditorBuildSettings.scenes) if (s.enabled) scenes.Add(s.path);
                if (scenes.Count == 0) throw new Exception("no scenes in build settings — run Mojulo.Import.Run first");
                var target = EditorUserBuildSettings.activeBuildTarget;
                var path = "build/mojulo";
                if (target == BuildTarget.StandaloneOSX) path += ".app";
                else if (target == BuildTarget.StandaloneWindows64 || target == BuildTarget.StandaloneWindows) path += ".exe";
                var report = BuildPipeline.BuildPlayer(scenes.ToArray(), path, target, BuildOptions.None);
                var ok = report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded;
                Debug.Log("[mojulo] player build " + (ok ? "OK" : "FAILED") + " -> " + path
                    + " (" + scenes.Count + " scenes, " + report.summary.totalErrors + " errors)");
                if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
                else if (!ok) throw new Exception("build failed — see console");
            }
            catch (Exception e)
            {
                Debug.LogError("[mojulo] player build FAILED: " + e.Message);
                if (Application.isBatchMode) EditorApplication.Exit(1); else throw;
            }
        }

        /// <summary>Machine-gate assertions: -executeMethod Mojulo.Import.Verify.
        /// Writes mojulo-gate.json at the project root; exit 0 iff all pass.</summary>
        public static void Verify()
        {
            var checks = new List<string>();
            var failures = new List<string>();
            void Check(string label, bool ok, string detail)
            {
                checks.Add((ok ? "PASS " : "FAIL ") + label + (detail != null ? " — " + detail : ""));
                if (!ok) failures.Add(label);
            }
            try
            {
                var refs = new List<(string resBase, string sceneName)>();
                if (IsGame())
                {
                    var game = ReadGame();
                    var menuPath = ScenesDir + "/" + MojuloGame.MenuScene + ".unity";
                    Check("menu_scene", File.Exists(menuPath), menuPath);
                    foreach (var lv in game.levels) refs.Add((PackRoot + "/levels/" + lv.@ref + "/", lv.@ref));
                    var inBuild = new HashSet<string>();
                    foreach (var s in EditorBuildSettings.scenes) inBuild.Add(s.path);
                    Check("build_settings", inBuild.Contains(menuPath) && refs.TrueForAll(r => inBuild.Contains(ScenesDir + "/" + r.sceneName + ".unity")), inBuild.Count + " scenes listed");
                }
                else refs.Add((PackRoot + "/", "mojulo-level"));

                bool landmarked = false;
                foreach (var (resBase, sceneName) in refs)
                {
                    var score = ReadScore(resBase);
                    var scenePath = ScenesDir + "/" + sceneName + ".unity";
                    Check(sceneName + ":scene_exists", File.Exists(scenePath), scenePath);
                    if (!File.Exists(scenePath)) continue;
                    EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
                    var world = GameObject.Find("World");
                    Check(sceneName + ":world_instance", world != null, null);
                    var colliderRoot = GameObject.Find("MojuloColliders");
                    int n = colliderRoot != null ? colliderRoot.transform.childCount : -1;
                    Check(sceneName + ":collider_count", n == (score.colliders != null ? score.colliders.Length : 0), n + " vs " + (score.colliders != null ? score.colliders.Length : 0));
                    var spawn = GameObject.Find("MojuloSpawn");
                    bool spawnOk = spawn != null && (spawn.transform.position - P(score.spawn ?? new float[] { 0f, 0f, 0f })).magnitude < 0.01f;
                    Check(sceneName + ":spawn_marker", spawnOk, spawn != null ? spawn.transform.position.ToString("F2") : "missing");
                    Check(sceneName + ":ground_plane", GameObject.Find("MojuloGround") != null, null);
                    var kernel = GameObject.Find("MojuloKernel");
                    var levelComp = kernel != null ? kernel.GetComponent<MojuloLevel>() : null;
                    Check(sceneName + ":kernel_wired", levelComp != null && levelComp.scoreJson != null, null);

                    // Frame-mapping landmark (pinned Y0): an entity node that
                    // survives in the GLB must sit at P(translation).
                    if (!landmarked && world != null && score.entities != null)
                        foreach (var e in score.entities)
                        {
                            var node = FindEntityNode(world.transform, score.entities, e.id);
                            if (node == null || e.translation == null) continue;
                            var want = P(e.translation);
                            var d = (node.position - want).magnitude;
                            Check("frame_landmark:" + e.id, d < 0.5f, node.position.ToString("F2") + " vs " + want.ToString("F2"));
                            landmarked = true;
                            break;
                        }

                    // Rig clips (Y2): count the GLB's AnimationClips and prove
                    // the first one BINDS — sampling it must move at least one
                    // transform in the instantiated hierarchy (glTFast rebinds
                    // clips by node path; a mismatch animates nothing, silently).
                    // Runs LAST in the loop: sampling poses the open scene.
                    if (world != null)
                    {
                        var clips = new List<AnimationClip>();
                        foreach (var a in AssetDatabase.LoadAllAssetsAtPath(resBase + "model.glb"))
                            if (a is AnimationClip ac) clips.Add(ac);
                        if (clips.Count > 0)
                        {
                            var beforePos = new Dictionary<Transform, Vector3>();
                            var beforeRot = new Dictionary<Transform, Quaternion>();
                            foreach (var t in world.GetComponentsInChildren<Transform>(true))
                            {
                                beforePos[t] = t.localPosition;
                                beforeRot[t] = t.localRotation;
                            }
                            clips[0].SampleAnimation(world, clips[0].length * 0.5f);
                            int moved = 0;
                            foreach (var kv in beforePos)
                                if (kv.Key != null && ((kv.Key.localPosition - kv.Value).magnitude > 1e-4f
                                    || Quaternion.Angle(kv.Key.localRotation, beforeRot[kv.Key]) > 0.01f)) moved++;
                            Check(sceneName + ":clips_bound", moved > 0, clips.Count + " clips; '" + clips[0].name + "' moved " + moved + " transforms");
                        }
                    }
                }
            }
            catch (Exception e)
            {
                Check("verify_ran", false, e.Message);
            }
            var ok = failures.Count == 0;
            var json = "{\\"ok\\": " + (ok ? "true" : "false") + ", \\"checks\\": [\\"" + string.Join("\\", \\"", checks) + "\\"]}";
            File.WriteAllText("mojulo-gate.json", json);
            Debug.Log("[mojulo] gate " + (ok ? "PASS" : "FAIL") + " (" + checks.Count + " checks)");
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }
    }
}
`;
}

/* --------------------------------------------------------------- guide --- */

const GUIDE_PREAMBLE = (title, recipeNote) => `# ${title} — Unity import guide

#001 This pack is a derived artifact of a mojulo recipe (${recipeNote}); re-mint it from the recipe rather than hand-editing. Target editor: ${UNITY_EDITOR_TARGET}.
#002 Steps marked T are editor actions, one per line, in order. Everything not listed here is done by the importer script — do not set values by hand that the importer already sets.

## ① Create the project

T001 Unity Hub > Projects > New project > 3D (URP) template > Editor Version(currently pinned: 6000.2.x) > Create project
T001.01 Unity 6 names this template "Universal 3D"(3D URP); on older 2022 LTS editors it appears as "3D (URP)" — either works, this pack assumes URP
T002 Edit > Project Settings > Player > Other Settings > Active Input Handling(currently Input System Package (New) on new templates) > Both — the kernel's walker/HUD use classic Input + IMGUI; "Both" keeps the template's own systems working too

## ② Install the glTF importer

T003 Window > Package Manager > [+] > Install package by name… > \`com.unity.cloud.gltfast\` > Install

## ③ Copy the pack in

T004 Finder > copy this whole folder into the project's \`Assets/\` as \`MojuloPack\` (final path: \`Assets/MojuloPack\`)
T004.01 Project > Assets > MojuloPack — wait for the import spinner to finish; each \`model.glb\` shows a prefab icon when glTFast has imported it

## ④ Run the importer

T005 Tools > Mojulo > Import Pack
`;

const GUIDE_LEDGER = (ledger, startAt = 101) => Object.entries(ledger)
  .map(([k, v], i) => `#${String(startAt + i).padStart(3, '0')} ${k}${v.count != null ? ` ×${v.count}` : ''} — ${v.note}`)
  .join('\n');

/** World-pack guide (Y0 shape, upgraded: the kernel walker makes ⑤ playable). */
function importGuideWorld({ title, refName, score, ledger }) {
  const eyes = [
    '#003 the world mesh renders in its baked vertex colours (reference look: the mojulo web build)',
    `#004 you can walk: WASD/arrows + mouse look, Space jumps, Esc frees the mouse — eye height ${fmt(score.eye ?? 1.7)} m`,
    ...(score.soundtrack ? [`#005 the soundtrack (\`${score.soundtrack}\`) is playing on loop`] : []),
  ];
  return `${GUIDE_PREAMBLE(title, `\`recipe/${refName}.json\``)}T005.01 Console — confirm one line: \`[mojulo] imported '${title}' -> Assets/MojuloPack/Scenes/mojulo-level.unity\`

## ⑤ Open and play — the eyes gate

T006 Project > Assets > MojuloPack > Scenes > \`mojulo-level.unity\` — open
T007 Toolbar > [Play] — judge with your own eyes:
${eyes.join('\n')}

## ⑥ Ship it (optional) — a standalone app

T008 File > Build Profiles(older editors: Build Settings) > Build — pick an output folder; the scene list is already filled in by the importer

${greyboxSection(score.posture === 'greybox')}## What travelled, what didn't

${GUIDE_LEDGER(ledger)}
`;
}

/** Game-pack guide: menu-first eyes gate over the whole progression loop. */
function importGuideGame({ title, levels, ledger, greybox = false }) {
  const levelList = levels
    .map((lv, i) => `#${String(10 + i).padStart(3, '0')} level ${i + 1}: ${lv.title ?? lv.ref} (\`${lv.ref}\`)${lv.gate?.completed ? ` — unlocks after \`${lv.gate.completed}\`` : ''}`)
    .join('\n');
  return `${GUIDE_PREAMBLE(title, '`recipe/`')}T005.01 Console — confirm one line: \`[mojulo] imported game '${title}' -> menu + ${levels.length} level scene(s) in Assets/MojuloPack/Scenes\`

## ⑤ Play the game — the eyes gate

T006 Project > Assets > MojuloPack > Scenes > \`mojulo-menu.unity\` — open
T007 Toolbar > [Play] — the menu lists the levels; locked ones name their gate:
${levelList}
#020 click a level: WASD/arrows + mouse to walk, Space jumps, Esc frees the mouse, M returns to the menu
#021 completing a level returns you to the menu with the next gate unlocked; progress persists between plays (PlayerPrefs)

## ⑥ Ship it (optional) — a standalone app

T008 File > Build Profiles(older editors: Build Settings) > Build — pick an output folder; the scene list (menu first, then every level) is already filled in by the importer

${greyboxSection(greybox)}## What travelled, what didn't

${GUIDE_LEDGER(ledger, 101)}
`;
}

/* ------------------------------------------------------------- shared --- */

const kernelFiles = ({ packFolder }) => [
  { file: 'Editor/MojuloImport.cs', text: importerCs({ packFolder }) },
  { file: 'Runtime/MojuloWalker.cs', text: walkerCs() },
  { file: 'Runtime/MojuloLevel.cs', text: levelCs() },
  { file: 'Runtime/MojuloGame.cs', text: gameCs() },
  { file: 'Runtime/MojuloMenu.cs', text: menuCs() },
];

const readmeProvenance = ({ ref, manifestHash, remint }) => `## Provenance

- source ref: \`${ref}\`
- manifest sha256/16: \`${manifestHash}\`
- unity leg: v${UNITY_LEG_VERSION}, target ${UNITY_EDITOR_TARGET}, glTF importer \`com.unity.cloud.gltfast\`
- units: 1 mojulo unit = 1 meter; frame z-up → y-up baked into the GLB root, sidecar mapped by the kernel (one function, gate-asserted)
- re-mint: \`${remint ?? `node scripts/export-unity.mjs --ref ${ref}`}\` (from mojulo's \`control/\`)
`;

/* ------------------------------------------------------------ emitters --- */

/**
 * emitUnityProject — a standalone world pack: kernel + guide + README.
 * The assembler (unity-pack.js) ships model.glb, score.json, recipe/, audio/,
 * portability.json, and mints .meta files for everything.
 */
export function emitUnityProject({ ref, score, manifestHash, packFolder = 'MojuloPack', audioFile = null, remint = null }) {
  const title = score.title ?? ref;
  const ledger = unityLevelLedger(score);
  const files = [
    ...kernelFiles({ packFolder }),
    { file: 'IMPORT-GUIDE.md', text: importGuideWorld({ title, refName: ref, score, ledger }) },
    {
      file: 'README.md',
      text: `# ${title} — Unity handoff

A generated Unity pack (mojulo \`export-unity\`, leg v${UNITY_LEG_VERSION}). The world's truth
lives in \`recipe/\` — this whole folder is a derived artifact; re-mint it from
the recipe rather than hand-editing. The pack is DATA (\`score.json\`, the GLB${audioFile ? ', audio' : ''})
performed by the mojulo-unity kernel (\`Editor/\` builds the scene, \`Runtime/\`
performs the walker + mechanics live) inside a stock ${UNITY_EDITOR_TARGET} project —
follow \`IMPORT-GUIDE.md\`; the web build is the reference performance.

${readmeProvenance({ ref, manifestHash, remint })}
${greyboxSection(score.posture === 'greybox')}## What travelled, what didn't

${ledgerLines(ledger)}
`,
    },
  ];
  return { files, ledger };
}

/**
 * emitUnityGame — a game pack: kernel + game guide + README with per-level
 * ledgers. The assembler ships game.json, per-level model.glb/score.json,
 * recipe/, audio/. levels: [{ ref, title, gate, score, audioFile }].
 */
export function emitUnityGame({ ref, title, manifestHash, levels, shellExtras = [], packFolder = 'MojuloPack', remint = null }) {
  const ledger = {
    skipped_store: { note: 'store slices (character/inventory state) do not travel — only completion progression is kept (PlayerPrefs "mojulo.completed")' },
    levels: {},
  };
  if (shellExtras.length) {
    ledger.skipped_shell = {
      kinds: shellExtras,
      note: 'authored shell UI beyond the level list (menu structure, setup/hangar, difficulty, theme) does not travel — the kernel menu is a plain level table',
    };
  }
  const oddGates = levels.filter((lv) => lv.gate && !lv.gate.completed);
  if (oddGates.length) {
    ledger.gate_approximated = {
      count: oddGates.length,
      note: 'non-completion gates (store flags) approximated as unlocked — flag state does not travel',
    };
  }
  for (const lv of levels) ledger.levels[lv.ref] = unityLevelLedger(lv.score, { gameMode: true });

  const topLedger = {
    skipped_store: ledger.skipped_store,
    ...(ledger.skipped_shell ? { skipped_shell: ledger.skipped_shell } : {}),
    ...(ledger.gate_approximated ? { gate_approximated: ledger.gate_approximated } : {}),
  };
  const perLevelLedgers = levels
    .map((lv) => `### \`${lv.ref}\`\n\n${ledgerLines(ledger.levels[lv.ref])}`)
    .join('\n\n');
  const levelList = levels
    .map((lv, i) => `${i + 1}. ${lv.title ?? lv.ref} (\`${lv.ref}\`)${lv.gate?.completed ? ` — unlocks after \`${lv.gate.completed}\`` : ''}`)
    .join('\n');

  const greybox = levels.some((lv) => lv.score?.posture === 'greybox');
  const files = [
    ...kernelFiles({ packFolder }),
    { file: 'IMPORT-GUIDE.md', text: importGuideGame({ title, levels, ledger: topLedger, greybox }) },
    {
      file: 'README.md',
      text: `# ${title} — Unity handoff (game)

A generated Unity pack (mojulo \`export-unity\`, game scope, leg v${UNITY_LEG_VERSION}). The
game's truth lives in \`recipe/\` — this whole folder is a derived artifact;
re-mint it from the recipe rather than hand-editing. The pack is DATA
(\`game.json\`, per-level \`score.json\` + GLB, audio beds) performed by the
mojulo-unity kernel (\`Editor/\` builds menu + level scenes into the build
settings, \`Runtime/\` performs the walker, the mechanics vocabulary, and the
gated progression live) — follow \`IMPORT-GUIDE.md\`; the web build is the
reference performance.

${readmeProvenance({ ref, manifestHash, remint })}
${greyboxSection(greybox)}## Levels

${levelList}

## What travelled, what didn't

${ledgerLines(topLedger)}

${perLevelLedgers}
`,
    },
  ];
  return { files, ledger };
}
