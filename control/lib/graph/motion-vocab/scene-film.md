---
{
  "id": "scene-film",
  "name": "Scene film (a screenplay acted, shot by its coverage, storyboarded, filmed in Blender)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "A SCENE written as a screenplay, acted by its cast (personas or heroes) and shot the way a director covers it: first a STORYBOARD (a panel a shot, drawn with stand-ins, in seconds) and its ANIMATIC, then the film from the same plan, handed to Blender as a film pack: each actor a skinned GLB with its performance, the cameras cut together, a film (Cycles) or anime (EEVEE) look.",
  "when": "Reach for this on 'a short film of my two characters talking / storyboard this scene / an animatic / use my recorded lines / dub it in French / set it in my room / shoot this scene / film the dialogue / an animated short / render the conversation in Blender / a scene with my personas / Cycles render of the scene'."
}
---

The cinematics department's film (`docs/cinematics.md`): one kind of actor, a hero playing a role from a script in a
style, blocked on one clock, shot by the director's coverage. The pack is written by the same core as
`scripts/export-scene-blender.mjs`, so the two agree byte for byte.

## Forge

```
forge_motion({ title: 'The key', export: 'storyboard',
  subject: { screenplay: {
    marks: { door: [-1.3, 0.2], window: [1.1, 0.7], table: [0.1, 0.35] },
    cast: { mara: { persona: 'sk_…', mark: 'door' }, jon: { hero: 'sk_…', register: 'documentary', mark: 'window' } },
    script: 'MARA: You kept the *key*.\nJON (worried): I kept everything. [pause] That was the trouble.\nMara crosses to the table.\nJon turns to Mara.\nMARA (determined): Then send one *now*.' } },
  shot: { motion: 'coverage', params: { look: 'film' } } })
```

- **The script**: `NAME: the line` (the persona's markup: `*stress*`, `[pause]`, `[pause 1.5]`, `(aside)`),
  `NAME (worried): the line` for that line's face, and directions: "Mara crosses to the table." (or "to Jon": up to
  him, a conversation's distance short), "Jon turns to Mara.", "Mara looks at the door.", "Jon waits 2 seconds.",
  "Slow motion.", "Real time.", "Freeze.". Anything else is a note.
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

## The set, the voice, the dub

- **`world_ref`: the set.** A stored world, such as a geocube `room`, `hall` or `trail`, a stage, or a game's level.
  - **Its named places are marks.** Each room's middle is `room-<id>`, there is a stand on each side of a door
    (`<door>-<room>`), and its anchors (a pocket, a landmark) are marks too. Write them in the script as they are
    named: "Ana crosses to the room-reveal-1."
  - **A part with no mark** stands in the set's largest room.
  - **Advice:** a shot whose camera has a wall between it and the actors is advised (`set-blocks`). Move the cast or
    pick a larger room.
  - **In Blender,** the world's own pack is put under the actors (`set/`, `set.py`). The storyboard draws the set's
    rooms in its overhead plan.
  - **A decorated room** (an `interior`, from `design_interior`) is a set too.
    - Its marks are the room's open floor (`room-<name>`) and a place by each thing in it, named by its word:
      `sofa`, `coffee-table`, `chair-2`, `bookcase`, `fireplace`, `door`, `window`. "Ada crosses to the fireplace."
    - The cameras stay inside its walls, on a wider lens, and stop in front of tall furniture.
    - With no lamps of its own it is lit by a soft light under the ceiling.
    - A cross goes round the furniture and round the others, a body's width off each, by the shortest way. With no
      way round, it is walked straight, as on any other set.
- **`voice`: recorded lines.** Write `{ <line number>: '<path>.wav' | { audio, text? } }`. The number counts spoken
  lines, 1 the first, in script order.
  - **They set the clock.** A recorded line lasts its recording. The read is fitted to it, so the face, the gestures on
    stressed words and the listener's nods land on the recording. The mouth follows the recording's phonemes.
  - **How they are kept and timed.** They are stored by content, so a re-forge needs no path. Each is timed by the
    worker's `.timings.json` sidecar beside the WAV, else aligned to its words, else by its loudness.
  - **Advice:** a recording made for other words (`voice-words`).
  - **To make them,** run the local voice worker (`docs/local-voice-worker.md`): `speak.py --text '<the line>' --voice
    '<the persona's voiceArg>' --out <n>.wav --timings`. Or record a person.
- **`dub`: other languages, to picture.** Write `{ <locale>: { <n>: { audio, text } } }`.
  - **The picture stays.** The timing, the blocking, the bodies and the face's acting are the original's. Only the
    mouth is re-solved: each actor gets the take `face:dub-<locale>`.
  - **Advice:** a dub line that runs into the next line, with how far over (`dub-over`).
- **What comes back** (`sound`):
  - the voice track, a dub's tracks and the captions (`.srt`, `.vtt`), all on the screen's clock;
  - the animatic carries each as a tagged audio track and subtitle track;
  - the Blender pack carries them under `audio/`, plus `dub.py -- --locale <l>`;
  - `film_render.py` lays the voice under the film, or a dub's with `--locale <l>`.

## The render (`shot.params.render`, Blender's)

`{ light: 'setups', dof: 2.8, motion_blur: true, samples: 256 }`, each optional:

- **`light: 'setups'`** lights each shot as a crew relights a setup. Each shot gets a key on the short side of the
  face, a fill across the lens and a rim from behind, in the cast rig's colours. They are area lights placed from that
  shot's camera and subject, and they jump on the cut (`light.py`).
- **`dof`** is an f-stop. The focus follows the subject the camera looks at.
- **`motion_blur`** turns on motion blur.
- **`samples`** sets Cycles' samples for the final render.

Render the pack with the render worker, on a machine with Blender. It works chunk by chunk and is resumable:
`node scripts/render-film.mjs <the pack> --preset final [--budget-min 60]`. It writes `render.json`. The tool never
launches Blender.

## The three forms (`export`), cheapest first

- `storyboard` (the default): no mint, no Blender, seconds. `storyboard.page` is one page with a panel for each shot
  of the coverage. Each panel has:
  - its frame, drawn by the book press with stand-in mannequins where the actors stand at that moment, seen from the
    shot's camera. In a decorated room the room is drawn round them: its walls, with each door and window as an opening
    in its wall, and each piece of furniture, as plain blocks at their heights;
  - the blocking from above, with the camera and its field of view, and in a decorated room the furniture, the doors and
    windows, and the way each cross goes round the furniture;
  - its span, its time on screen, its lens and its move;
  - the lines and crosses inside it;
  - the director's notes that fall in it.

  `storyboard.json` holds the panels' data. Approve the cut here before the film is made.
- `mp4`: the storyboard plus its ANIMATIC (`mp4_path`): each panel held for its shot's length, the spoken line under
  it. It is a motion like any other, so `stitch_motion` cuts several scenes' animatics into one.
- `blender`: the storyboard plus the film from the same plan, in a Blender pack. Each actor is minted, which takes
  minutes.

The stand-ins are drawn with a level eye: a high or low camera's tilt is drawn by moving the horizon, so those
frames are close but not exact.

## What comes back (blender)

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

- The storyboard's stand-ins are mannequins, not the cast's own bodies. Its panels cannot be edited and written back
  to the scene yet.
- A dub is to picture only: a locale whose lines need more time cannot re-time the scene yet.
- The storyboard's frames draw a decorated room as plain blocks: its walls, furniture and bare openings for the doors and
  windows, with no door leaf, glass or finishes. On any other set they draw the actors on open ground, and only the overhead plan shows the set.
- Marks are on the floor at the set's height under the lead's mark. A set of many levels is stood on that one floor.
- One scene per forge; cut several together in Blender's sequencer.
