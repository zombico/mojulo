---
{
  "id": "scene-film",
  "name": "Film a scene with my 3D characters — a screenplay acted, storyboarded, shot and rendered in Blender",
  "summary": "A scene written as a screenplay, acted by the person's personas or heroes (faces and bodies on the words, listening, crossing to marks), covered the way a director shoots it, and handed to Blender as a film pack to render in Cycles or EEVEE.",
  "when": "\"a short film where my two characters argue\", \"shoot this dialogue with my personas\", \"film the scene I wrote\", \"an animated short with my 3D characters\", \"block and cover this scene\", \"storyboard the scene\", \"an animatic of my script\", \"render the conversation in Blender / Cycles\", \"a screenplay to a film\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion({ title, subject: { screenplay: { cast: { <who>: { persona: '<ref>' } | { hero: '<ref>' }, … }, marks?, script } }, shot: { motion: 'coverage', params: { look: 'film' | 'anime' } }, export })`: `storyboard` (default: a panel a shot, drawn with stand-ins, seconds), `mp4` (plus an animatic), `blender` (the film; actors minted, minutes). The script is a screenplay: `MARA: the line`, `JON (worried): the line`, and directions ("Mara crosses to the table.", "Jon turns to Mara.", "Jon waits 2 seconds."). A persona plays itself (its hero, register, style and role); a part's own words win. The hero must be realistic (`form: 'realistic'`) or wear the anime head. Board first, film after: the same plan. Back: the storyboard page, the director's notes with what to try, and for `blender` the pack and its build command. Make the cast first (cards `hero`, `persona`). Manual: `get_motion_vocab({ id: 'scene-film' })`. Family: `get_creative_toolset({ form: 'motion' })`.
