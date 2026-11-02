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
- **The body on the timeline.** The gestures a read already names played on the skinned hero, solved as hand targets in
  the body's own frame so they fit any proportions, their strokes on the stressed words, weight shifts and breath
  between, no two alike; a take exported as the GLB clip `act:<id>` beside the face's `face:<id>`.
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
