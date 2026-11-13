---
{
  "id": "film-studio",
  "name": "Make a whole short film of several scenes — departments, approved boards, a cut, Blender",
  "summary": "A film of scenes with one cast, its sets, its look and its edit, made in departments and waves: each scene boarded and approved by the person, the whole cut as an animatic with its voices and dubs, then each scene filmed in Blender (resumable).",
  "when": "\"a short film in three scenes\", \"an animated short with my characters, start to finish\", \"an episode\", \"put the scenes in order and cut them together\", \"approve the storyboards\", \"render every scene of the film in Blender\", \"the animatic of the whole film\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion({ film: { write: { cast: { <who>: { persona | hero } }, sets?: { <id>: world_ref }, scenes: [{ id, set?, cast: { <who>: {} }, script, voice?, dub? }], edit?: { order } } } })` writes the film (a stored row, its page its book). Then `film: { ref, run: 'storyboard' }` (every scene boarded, seconds), the person looks and `film: { ref, approve: { <scene>: 'board' } }`, `run: 'animatic'` (one cut with its voice and dub tracks), `run: 'blender'` (each scene's pack, resumable: run again for `pending`). Edit with `film: { ref, patch: [{ op: 'set', path, value }] }`. Every call answers the readout: scenes, departments (script, casting, set, performance, camera, voice, look, edit, render), advice, next. One scene alone → card `scene-film`. Manual: `get_motion_vocab({ id: 'film-studio' })`. Family → `get_creative_toolset({ form: 'motion' })`.
