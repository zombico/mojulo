// MojuloStream.cs - the developer's scene's link to mojulo's (scene/handoff-unity.js): the importer writes the
// developer's scene (Assets/Scenes/Level.unity) once with one of these, which loads mojulo's scene
// (Assets/Mojulo/Built/Level_Mojulo.unity, rebuilt on every handoff) into it, additively, by its name, when the game
// runs; the editor opens it beside the developer's scene (MojuloImport.cs). Whatever the developer adds to their scene
// stays: a re-handoff rebuilds mojulo's scene only.
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mojulo
{
    [DisallowMultipleComponent]
    public class MojuloStream : MonoBehaviour
    {
        [Tooltip("mojulo's scene, by its name (in the build's scene list)")]
        public string sceneName = "Level_Mojulo";
        [Tooltip("mojulo's scene, by its path")]
        public string scenePath = "Assets/Mojulo/Built/Level_Mojulo.unity";

        void Awake()
        {
            if (!SceneManager.GetSceneByName(sceneName).isLoaded) SceneManager.LoadScene(sceneName, LoadSceneMode.Additive);
        }
    }
}
