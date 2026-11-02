// MojuloLevel.cs - a mojulo level's record and environment (scene/handoff-unity.js), on the root of mojulo's scene:
// the level record as the handoff wrote it (`json`: its environment, markers, contract, seats and reference), the
// handoff's version and the recipe's ref, and the environment the importer built (MojuloImport.cs): the ambient (the
// solve's, linear, flat), the sky dome's material, the haze (three's exp-squared: its colour as the page shows it and
// its density per metre). The haze is the tone pass's (MojuloTone.shader), read from two shader globals this sets while
// it is enabled; when the game loads mojulo's scene into another (MojuloStream), this lights it with the level's
// ambient and sky (a scene's lighting settings are the active scene's in Unity).
using UnityEngine;
using UnityEngine.Rendering;

namespace Mojulo
{
    [ExecuteAlways]
    [DisallowMultipleComponent]
    public class MojuloLevel : MonoBehaviour
    {
        public string handoff;
        public string recipe;
        [TextArea(2, 12)]
        public string json;
        [Tooltip("The solve's ambient, linear: a white surface it lights shows it")]
        public Color ambientLinear = Color.black;
        public Material sky;
        [Tooltip("The haze's colour as the page shows it (sRGB)")]
        public Color hazeColour = Color.white;
        [Tooltip("The haze's density per metre (three's FogExp2): 1 - exp(-(density x depth)^2); 0 is none")]
        public float hazeDensity;
        [Tooltip("The level has no sun of its own: this is the handoff's default one (high in the south-east, warm white)")]
        public bool sunDefault;

        static readonly int HazeId = Shader.PropertyToID("_MojuloHaze");
        static readonly int HazeKId = Shader.PropertyToID("_MojuloHazeK");

        void OnEnable()
        {
            Shader.SetGlobalVector(HazeId, new Vector4(hazeColour.r, hazeColour.g, hazeColour.b, 1f));
            Shader.SetGlobalVector(HazeKId, new Vector4(hazeDensity, 0f, 0f, 0f));
            if (Application.isPlaying && gameObject.scene != UnityEngine.SceneManagement.SceneManager.GetActiveScene()) Light();
        }

        void OnDisable()
        {
            Shader.SetGlobalVector(HazeKId, Vector4.zero);
        }

        /// <summary>The level's ambient and sky as the lighting of whatever scene is active.</summary>
        public void Light()
        {
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = ambientLinear.gamma;
            RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
            RenderSettings.reflectionIntensity = 0f;
            if (sky != null) RenderSettings.skybox = sky;
            RenderSettings.fog = false;
            DynamicGI.UpdateEnvironment();
        }
    }
}
