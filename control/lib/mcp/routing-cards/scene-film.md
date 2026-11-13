---
{
  "id": "scene-film",
  "name": "Film a scene with my 3D characters — a screenplay acted, shot and rendered in Blender",
  "summary": "A scene written as a screenplay, acted by the person's personas or heroes (faces and bodies on the words, listening, crossing to marks), covered the way a director shoots it, and handed to Blender as a film pack to render in Cycles or EEVEE.",
  "when": "\"a short film where my two characters argue\", \"shoot this dialogue with my personas\", \"film the scene I wrote\", \"an animated short with my 3D characters\", \"block and cover this scene\", \"render the conversation in Blender / Cycles\", \"a screenplay to a film\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion({ title, subject: { screenplay: { cast: { <who>: { persona: '<ref>' } | { hero: '<ref>' }, … }, marks?, script } }, shot: { motion: 'coverage', params: { look: 'film' | 'anime' } }, export: 'blender' })`. The script is a screenplay: `MARA: the line`, `JON (worried): the line`, and directions ("Mara crosses to the table.", "Jon turns to Mara.", "Jon waits 2 seconds."). A persona plays itself (its hero, register, style and role); a part's own words win. The hero must be realistic (`form: 'realistic'`) or wear the anime head. Back: the Blender pack (each actor a skinned GLB, the coverage's cameras cut at markers, the look), the director's notes with what to try, and the command that builds it. Make the cast first (cards `hero`, `persona`). Manual: `get_motion_vocab({ id: 'scene-film' })`. Family: `get_creative_toolset({ form: 'motion' })`.
