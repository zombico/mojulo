### The scene actor: one kind of actor plays a role from a script, in a style

In progress. One actor for every character a scene shows: a hero that plays a role from a script in a playing style,
its face, body and later its hands directed together on one clock, and its take played outside any game engine.

- **One actor, three dials.** A role (who the character is: its resting state, its status, how it speaks; the
  persona's delivery registers are roles of speech), a style (how much it does and when: `thespian`, `action-star`,
  `anime-mocap`, `extra`, each a card tuned as `{ from, …overrides }`), and the keying and the look (continuous or on
  twos, film or anime), kept apart so any style can be shaded either way.
- **The persona is the actor.** A persona's spec takes a `style` and a `role`, for the whole persona or for one read
  (`create_character({ as: 'persona', spec: { hero, register, style: 'action-star', role: { status: 'high' }, reads }
  })`; `control/lib/graph/actor/`).
  - **The style** tunes the voice's rate and articulation and sets how strongly and how fast the face moves (eased in,
    or snapped into place). It decides how often a line opens with a brow flash, shows a tell or breaks for a glance
    off and back, and which moments a gesture marks, from which words. The extra never meets the lens.
  - **The role** sets the state of mind held under every line, a resting face, and a status: high keeps the head up
    and the eyes still, low drops the head and lets the eyes go.
  - **Absent, nothing changes.** A persona with neither reads byte for byte as before.
  - **The body waits.** Each style's body dials are carried, but the body plays them only from the next phase.
- **The body on the timeline.** The gestures a read names are played on the hero's rig
  (`control/lib/graph/actor/body.js`, `gestures.js`).
  - **The gestures**: a beat, an offered palm, a point, a shrug, a cheer, a clap, a hand to the chin, a nod, a
    headshake and a bow. Each is said as where the hand goes on the body (the chest, the belly, the chin), which way
    the fingers point and the palm faces, and the hand's shape, and is solved on the rig it plays on, so one word fits
    any proportions.
  - **The timing**: each gesture peaks just before its stressed word. It is wound up and let go at the style's pace,
    but never so fast that a joint turns faster than its limit. The shoulder, elbow, wrist and fingers arrive one
    after another. No two uses of a gesture are alike, and a gesture too close to the last on the same limbs is
    dropped or carries straight on from it.
  - **Near the trunk**: a hand there (a shrug, a hand to the chin, a clap, an offered palm) says where its elbow goes,
    so the arm goes round the chest rather than through it (`holdArm` takes the elbow's place, `elbowAt`). An arm keeps
    the place its solve found, whatever the style. A bigger style carries further past it at the apex and moves the
    head and the trunk more.
  - **The stand**: the actor stands with the preset's trunk and legs and its arms hanging at the sides, found on the
    rig it plays on (`standOf`). Between gestures it shifts its carriage every few seconds, less often the stiller the
    style.
  - **The machine gate**: the dailies read each body take law by law (the joints in order, the stroke on its word,
    the stand's life, the variation, the speeds and ranges). A dailies run beside a minted hero plays each take's body
    under its face in the hero-live viewer.
  - **The export**: a skinned export of a persona (`export_model({ format: 'glb', skinned: true })`) writes each read
    played in a style as `act:<read>` beside the face's `face:<read>`, on the same clock. It carries the joints alone,
    one-shot, with `moj:act` naming its style and each gesture's word, cause, hand and timing. The cue sheet names both
    clips, and the export's answer lists the acts. A read with no style is not acted, and the World page's payload is
    unchanged. The hero-live viewer plays a GLB's acts under their face takes.
  - **The vocabulary**: a style's gestures are the body's ten: `beat` and `offer` join the eight emote words, and a
    stressed word takes the baton where the register names none the style has.
- **Actors in a scene** (`control/lib/graph/actor/scene.js`, `screenplay.js`). A scene is a cast, the marks of a room
  and a screenplay.
  - **The screenplay**: `NAME: the line` (with the persona's markup), `NAME (worried): the line` for that line's face,
    and directions such as "Mara crosses to the table.", "Jon turns to Mara.", "Mara looks at the door.",
    "Jon waits 2 seconds.". Anything else is a note.
  - **The clock**: every line and direction is played in order on one clock.
  - **Looking and listening**: a speaker talks to whom it addresses, not to the lens. The others look at the speaker,
    listening, and nod on its stressed words as their style nods. While someone crosses, the others watch them go.
  - **Walking**: a cross turns the actor to its path and walks it with the hero's own walk cycle, the feet keeping
    their place on the floor, then the actor stands at the mark. A turn faces its target.
  - **Where it can be seen**: each actor's position and facing over time come with its take. The dailies draw the
    blocking from above and play each actor walking the floor in the hero-live viewer.
  - **Coverage** (`control/lib/graph/actor/coverage.js`): a scene comes with the shots a director would take. An
    establishing wide; over the listener's shoulder onto each speaker; a close on a line with a face of its own; the
    wide again for a cross. Every camera stays on one side of the actors' line as it turns. It is written as a shoot
    plan (cameras keyed in time, shots that cut between them), in the scenes card's own framings.
  - **Preview**: `control/scripts/spikes/actor/scene-film.mjs` plays a blocked scene beside a minted hero: both actors
    at once, each with its body and face, cut by its coverage, with captions.
- **Blender film export** (`control/scripts/export-scene-blender.mjs`, `control/lib/graph/actor/scene-film.js`). A scene
  is written as a Blender film pack:
  - **The actors**: each a skinned GLB of its hero with the scene's face take and act, a cross walked. The act's
    `moj:act` carries the actor's place over time.
  - **The cameras**: the coverage's cameras, keyed every frame and cut together as a world's film pack cuts a shoot
    plan's shots.
  - **The scripts**: `actors.py` hangs each actor under an empty keyed on its place and facing and binds its takes.
    `look.py` builds the look in Blender: `film` (Principled shading, a little subsurface on the skin, Cycles) or
    `anime` (cel bands shaded live from the scene's lights by Shader to RGB, a rim, an ink outline, EEVEE).
  - **The gate**: with a Blender found the export builds the film and verifies its cameras (advisory); without one it
    writes the pack and says the gate was skipped.
- **The dailies.** One page (`control/scripts/spikes/actor/dailies.mjs`) shows the takes side by side on one clock,
  each with its timeline and its readings law by law (`control/lib/graph/actor/readings.js`). The readings cover how
  much the face moves, the blinks, the pace, where the eyes rest, the gestures, and whether a gesture lands on its
  stressed word. In a scene they also cover how much each actor regards its partner and stays live while the other
  speaks. The baseline is the persona alone, with one speech for one speaker (`actor/baseline.js`) and a short scene
  for two, and its outputs are pinned. In that scene the persona never looks at its partner.
- **Opt-in, byte for byte.** A hero or persona with no actor data, and every clip minted before, is unchanged.
