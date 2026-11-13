---
{
  "id": "scene-film",
  "name": "Scene film (a screenplay acted, shot by its coverage, filmed in Blender)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "A SCENE written as a screenplay, acted by its cast (personas or heroes), shot the way a director covers it, and handed to Blender as a film pack: each actor a skinned GLB with its performance, the cameras cut together, a film (Cycles) or anime (EEVEE) look.",
  "when": "Reach for this on 'a short film of my two characters talking / shoot this scene / film the dialogue / an animated short / render the conversation in Blender / a scene with my personas / Cycles render of the scene'."
}
---

The cinematics department's film (`docs/cinematics.md`): one kind of actor, a hero playing a role from a script in a
style, blocked on one clock, shot by the director's coverage. The pack is written by the same core as
`scripts/export-scene-blender.mjs`, so the two agree byte for byte.

## Forge

```
forge_motion({ title: 'The key', export: 'blender',
  subject: { screenplay: {
    marks: { door: [-1.3, 0.2], window: [1.1, 0.7], table: [0.1, 0.35] },
    cast: { mara: { persona: 'sk_…', mark: 'door' }, jon: { hero: 'sk_…', register: 'documentary', mark: 'window' } },
    script: 'MARA: You kept the *key*.\nJON (worried): I kept everything. [pause] That was the trouble.\nMara crosses to the table.\nJon turns to Mara.\nMARA (determined): Then send one *now*.' } },
  shot: { motion: 'coverage', params: { look: 'film' } } })
```

- **The script**: `NAME: the line` (the persona's markup: `*stress*`, `[pause]`, `[pause 1.5]`, `(aside)`),
  `NAME (worried): the line` for that line's face, and directions: "Mara crosses to the table.", "Jon turns to Mara.",
  "Mara looks at the door.", "Jon waits 2 seconds.", "Slow motion.", "Real time.", "Freeze.". Anything else is a note.
  `who` in the cast is the name the script writes, lower case.
- **The cast**: each part plays from
  - `persona: <ref>`: the persona is the actor (`create_character({ as: 'persona' })`). Its hero is the body, and its
    register, style and role are how it plays;
  - `hero: <ref>`: a minted hero (`create_character({ as: 'hero' })`);
  - `hero: { … }`: a hero spec;
  - nothing: the default realistic hero.

  The part's own `register`, `style` (thespian, action-star, anime-mocap, extra), `role` (`{ status: 'high' | 'even' |
  'low', face?, emote? }`), `mark` and `height` win over the persona's. A hero acts only where its face takes a
  performance: the realistic hero (`form: 'realistic'`) or the anime head (`head: 'anime'`). Any other is refused by
  name.
- **The marks**: `{ <name>: [x, y] }` in metres. Without them the cast stands in a line, facing each other.
- **shot.params**:
  - `look`: `film` (default) or `anime`;
  - `style`: a playing style for every part without one;
  - `grain`: `twos` | `threes`, the scene on twos with the camera on ones, as anime is keyed;
  - `grade`: a word (film, noir, bleach, vivid, pastel, cold, warm) or the dials;
  - `hero`: the spec every part without a body plays.

  `shot.fps` defaults to 24.

## What comes back

- `blender.dir`: the pack, `<motion>/blender/`.
  - `actors/<who>.glb`: each actor skinned, with its body's act `act:scene` and its face's take `face:scene`.
  - `scene.json`: the actors' places over time, the lines and the coverage.
  - `shots/`, `film_shots.py`: the cameras keyed every frame, cut at markers.
  - `actors.py`, `look.py`, `film_light.py`, `film_render.py`.
  - `SCENE.md`: the operator's page, with the director's notes.
- `notes`: the director's notes, e.g. a shot held too long, a speaker turned away, a cross that flips the line, many
  lines and no close-up. Each has `try`, a change to the script. They advise; none stops the film.
- `actors`: each part's GLB, its size, the seconds it took to mint and what it plays from. A realistic hero takes a
  minute or two the first time it is minted in a call; a second part on the same hero is quicker.
- `blender.command`: builds `film.blend` (cast, shots, look) and verifies the cameras where a Blender is found
  (`MOJULO_BLENDER`). Then `film_render.py -- --preset draft` (EEVEE) or `final` (Cycles) renders a PNG sequence and
  an H.264. The tool never launches Blender.

Re-forge with `recipe_ref` (or the edited `recipe.json` as `recipe`) after changing the script: the pack is written
again from the recipe.

## Not yet

- No web preview: the only form is the Blender pack, so a GIF or MP4 export is refused.
- No set: the actors stand on Blender's empty floor, at their marks.
- No recorded voice: lines are timed from their words, and the pack carries no audio and no captions.
- One scene per forge; cut several together in Blender's sequencer.
