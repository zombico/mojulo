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
  - **Next**: the take exported as the GLB clip `act:<id>` beside the face's `face:<id>`.
- **Two actors in a scene.** Marks, walking to them, looking at each other, the one not speaking listening, and cameras
  that frame actors.
- **Blender film export.** A scene's actors, their takes and its cameras as a Blender pack, in a film look or an anime
  look shaded live rather than baked.
- **The dailies.** One page (`control/scripts/spikes/actor/dailies.mjs`) shows the takes side by side on one clock,
  each with its timeline and its readings law by law (`control/lib/graph/actor/readings.js`). The readings cover how
  much the face moves, the blinks, the pace, where the eyes rest, the gestures, and whether a gesture lands on its
  stressed word. In a scene they also cover how much each actor regards its partner and stays live while the other
  speaks. The baseline is the persona alone, with one speech for one speaker (`actor/baseline.js`) and a short scene
  for two, and its outputs are pinned. In that scene the persona never looks at its partner.
- **Opt-in, byte for byte.** A hero or persona with no actor data, and every clip minted before, is unchanged.
