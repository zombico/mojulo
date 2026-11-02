# Cinematics

The studio's cinematics department directs scenes the way a film crew does. It casts actors to play a role from a script
in a style, sets them on their marks, decides where the camera stands and when it cuts, and hands the result to the
tools that finish it. This page is the department's craft, written as principles. Each principle names the code that
holds it, and the machine checks it gets.

Two gates, never conflated. The machine gate measures: the readings law by law, the coverage's rules, the director's
notes. The eyes gate is the director's: whether a take reads as acting, whether a cut lands. No check here claims it
looked.

## The actor

**There is only one kind of actor.** An actor is a hero playing a role from a script, in a style. The persona is that
actor (`create_character({ as: 'persona', spec: { hero, register, style, role, reads } })`), and so is every character
in a scene. The actor is not a separate engine. It is one interpretation stage that turns its role, its style and its
script into the words the face, the voice and the body already take (`control/lib/graph/actor/interpret.js`).

Three dials, kept apart so any combination holds:

- **The role** is who the character is under the lines: the state of mind it holds, its resting face, its **status**.
  After Keith Johnstone, a high-status player keeps the head up and still and the eyes where they are put; a low-status
  one drops the head and lets the eyes go. How it speaks is its delivery register (`persona/delivery.js`), a role of
  speech. (`actor/role.js`)
- **The style** is how much the actor does and when, whatever the role. Each style is a card: how strongly and how fast
  the face moves, how often a line opens with a brow flash, shows a tell or breaks for a glance, which moments a gesture
  marks and from which words, the voice's pace, and the body's dials. The cards are in `actor/style.js` `STYLES`.
- **The keying and the look** decide how the take is drawn: continuous or held on twos, film or anime. A thespian
  shaded anime is still a thespian.

The performance principles, each a law the readings measure (`actor/readings.js`):

1. **The joints arrive in turn.** In a gesture the shoulder leads, then the elbow, the wrist and the fingers: overlap,
   or successive breaking of joints. (law 1, `CHAIN` in `actor/body.js`)
2. **The stroke lands on the word.** A gesture's apex comes on or just before the stressed syllable it carries; speech
   and gesture are one act. (law 2, `LEAD`)
3. **Never still.** The stand shifts its weight every few seconds and breathes under everything; a still actor is a
   dead one. The stiller the style, the rarer the shift. (law 3)
4. **No two alike.** A gesture used twice is never a copy. (law 4)
5. **Listening is half of acting.** While the other speaks, an actor regards them, its face alive in the listening
   state, nodding on their stresses as its style nods. (law 5)
6. **Humanly possible.** No joint turns faster than a person's, or past its range. (law 6, `SPEED` and `RANGE` in
   `actor/tracks.js`)
7. **Absent adds nothing.** A persona with no style or role reads exactly as it did. (law 7, the persona's byte pins)

The thought leads: the eyes and brows move before the mouth, and a felt expression eases in where a posed one snaps
(`face-acting/perform.js`). Gestures are said as the body does them, as places for the hand on the body's own
landmarks, so one gesture fits any proportions (`actor/gestures.js`).

## The scene

A scene is a cast, the marks of a room and a screenplay (`actor/scene.js`, `actor/screenplay.js`):

```
MARA: You kept the *key*.
JON (worried): I kept everything.
Mara crosses to the table.
Jon turns to Mara.
```

- **Speak to someone, never the lens.** A speaker looks at whom it addresses; the others look at the speaker. Each
  eyeline is set from where the actors stand and which way they face.
- **Watch the mover.** While someone crosses, the others follow them with their eyes.
- **Motivate the move.** A cross belongs on the turn of a scene: a thought changing, a decision made. It gives the
  actors a new picture and the camera a reason for its wide.
- **Turn before you speak.** The eyes carry a line, and a head turns only so far. An actor speaking to someone behind
  it turns first.
- **A conversation's distance.** Speakers stand about a metre and a half to two and a half apart. Closer, they crowd
  each other; further, the conversation becomes a call across the room.
- **Walk, don't glide.** A cross turns the actor to its path and walks it with the hero's own walk cycle, phased by the
  ground covered, so a planted foot keeps its place on the floor.

## Coverage

What a director would shoot, in the shoot plan's own shape and the scenes card's own framings (`actor/coverage.js`):

- **Establish.** Open wide on everyone, so the audience has the room's map.
- **Over the shoulder for dialogue.** Shoot the speaker past the listener's shoulder: the audience sees the face and
  keeps the partner.
- **Close for the turn.** Save the close-up for the line that matters: one with a face of its own (a parenthetical).
- **Wide for movement.** Go back to the wide when someone crosses, so the move reads against the room.
- **One side of the line (the 180° rule).** Every camera stands on the side the opening wide took, so left stays left.
  As a cross turns the line, the side is carried with it.
- **Let a shot be read.** A cut that would hold for less than about a second is folded into the one before it.
- **Cut on the line.** Shots change as lines begin, so the cut lands on whoever is about to speak.

## The director's notes

Suggestions read off a scene and its coverage (`actor/notes.js` `directorsNotes`), each with its principle and a change
to the script that answers it. They suggest; they never refuse. A scene with none is free of these notes, not proven
good.

- **long-take**: a shot holding one framing over dialogue too long. Cut away: break the line with a beat of the listener.
- **back-turned**: a speaker facing away from whom it speaks to. Turn them first.
- **line-flips**: a cross that carries an actor across the line, trading left and right. End it on the same side, or
  let the wide show the new picture.
- **static**: a long scene where no one moves. Give the turn of the scene a move.
- **distance**: speakers standing too close or too far for a conversation. Set their marks a conversation apart.
- **no-close**: a scene of many lines with no close-up. Save one for the turn.
- **extra-speaks**: a speaking part played as an extra, its eyes off whoever speaks. Give it a style that regards its
  partner, unless it is meant to be background.

## The look

A scene goes to Blender as a film pack (`control/scripts/export-scene-blender.mjs`, `actor/scene-film.js`): each
actor's GLB with its face take and act, its place over time, and the coverage's cameras cut together. The look is built
in Blender, never baked:

- **film**: Principled shading with a little subsurface on the skin, rendered in Cycles.
- **anime**: cel bands shaded live from the scene's lights (Shader to RGB stepped by a constant ramp), a rim, and an ink
  outline, rendered in EEVEE.

The export is the lit one: the realistic body's smooth normals and no light baked into its colours, so either look
shades it.

## Where to look

- **The dailies** (`control/scripts/spikes/actor/dailies.mjs`): every take on one clock, its timeline and its readings
  law by law; scenes drawn from above.
- **The scene film** (`control/scripts/spikes/actor/scene-film.mjs`): both actors at once on a minted hero, cut by the
  coverage, with captions.
- **The hero-live viewer** (`/hero-live`): a take's face and body on the hero, as an engine plays the GLB.
- **Blender**: the film pack, built as its `SCENE.md` says.
