// MojuloMarker.cs - a marker's or a seat's record in a mojulo handoff (scene/handoff-unity.js): the importer
// (MojuloImport.cs) stands one empty GameObject per marker under Mojulo/Markers and per seat under Mojulo/Seats, each
// carrying this, its record as the handoff wrote it (`json`, keys sorted) and its kind (spawn, entity, anchor, camera,
// seat, seats). The level's own record is MojuloLevel's, on the scene's root. A developer reads these to wire the loop.
using UnityEngine;

namespace Mojulo
{
    [DisallowMultipleComponent]
    public class MojuloMarker : MonoBehaviour
    {
        [Tooltip("What the marker is: spawn, entity, anchor, camera, seat or seats")]
        public string kind;
        [Tooltip("The marker's record from handoff.json, as JSON")]
        [TextArea(2, 12)]
        public string json;
    }
}
