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
- **slowed-line**: a line spoken under slow motion or a freeze. Slow the move, the look or the silence round it; play
  the words in real time.

## Time

A shot shows the scene's time on the screen's time, and one map between the two (`shoot/time.js`, a shot's `time`,
`clock` and `grain`) is read by everything that plays: the camera, the actors' takes and faces, their places, the
captions. Presentation, not simulation: the map changes what the screen shows, never how the scene plays.

- **Slow the action, not the words.** Slow motion stretches the picture, not the voice. In the screenplay, `Slow
  motion.` (or `Slow motion 0.1.`) until `Real time.` slows a stretch of the scene; it takes no time of the scene's.
- **Hold the moment.** `Freeze.` (or `Freeze 2 seconds.`) holds the scene at an instant: the beat after a blow, the look
  that answers a line.
- **Ramp, don't jump.** A speed ramp (a stretch's `ramp`) eases into slow motion and out of it, so the change reads as
  the moment's weight rather than a jump in the film.
- **The camera keeps its own time.** In bullet time the camera moves at its own pace while the world holds or crawls
  (a shot's `clock: 'screen'`).
- **Twos for the anime register.** The world shown on twos or threes, the camera on ones, as limited animation is
  keyed (`grain`; `export-scene-blender.mjs --grain twos`).

The coverage carries the screenplay's slow motion and freezes onto the shots they fall in, and the film pack plays the
scene on the screen's clock: each take through an NLA strip whose time is keyed to it.

## The moment in play

In a game the world cannot be rendered ahead, so its big beats are MOMENTS on the world clock
(`worlds/controllable/world-clock.js`, a world's `tempo`). A moment fires on what happens in play:
- a blow landing;
- a foe going down;
- the last foe going down;
- a dodge.

It takes three things at once, on one envelope: the clock, the camera and the look.

- **Slow the world, not the camera.** The world steps slower or holds; the camera keeps real time, so it can move
  through the held beat. The HUD and the input keep real time too.
- **Frame the two it is about.** A moment knows whom it is about: the striker and the struck, the one who downed a foe
  and the downed. Its `cam` takes the camera with the scenes' own directing shot on those two (`two`, `close`,
  `profile`, `low`, a `push` or an `orbit`), easing in, and hands it back as the moment ends. It never takes the camera
  from a scene or the tackle cinematic.
- **Cap the beat, and cool it down.** A hold is short; a `cooldown` keeps a run of kills from ping-ponging the clock.
  A slower moment takes over a faster one.
- **Let the look carry the weight.** A moment's `look` lays the grade over the world's own, by the moment's weight:
  - the finisher drains the colour and draws the bars;
  - a blow lands on an inverted impact frame, a zoom toward the struck and a shake;
  - bullet time bleeds the colour and splits its channels.
- **Cut to the impact cam on the event.** A live shoot plan's shot waiting on `tempo:<what fired>` cuts in as the
  moment fires.

## Compositing

The World page's grade (`scene/channels/grade.js`) is its compositing stage, the last thing laid over the frame, on the
same full-frame pass that softens the far. A world sets its own `grade`: a word (`film`, `noir`, `bleach`, `vivid`,
`pastel`, `cold`, `warm`) or dials. A moment overlays its look on it.

- **Grade the world once, the moment on top.** The base grade is the world's register: film's gentle contrast, warmth
  and grain, noir's grey. A moment pushes from there and returns to it.
- **The dials**:
  - exposure, contrast, saturation;
  - warmth: a split tone, highlights to amber and shadows to blue, or the other way;
  - the vignette, film grain, chromatic aberration;
  - a zoom blur toward a point;
  - the letterbox bars, a flash, the impact frame, a shake.
- **Bars for the cinematic beat, not for play.** The letterbox says "watch": draw it while a moment plays, not while the
  player aims.
- **One frame is enough.** An impact frame is one or two frames; more reads as a glitch.
- **Free while unused.** The pass draws only while the grade is off its rest, and a page that asks for no grade carries
  none of it.

## The look

A scene goes to Blender as a film pack (`control/scripts/export-scene-blender.mjs`, `actor/scene-film.js`): each
actor's GLB with its face take and act, its place over time, and the coverage's cameras cut together. The look is built
in Blender, never baked:

- **film**: Principled shading with a little subsurface on the skin, rendered in Cycles.
- **anime**: cel bands shaded live from the scene's lights (Shader to RGB stepped by a constant ramp), a rim, and an ink
  outline, rendered in EEVEE.

The export is the lit one: the realistic body's smooth normals and no light baked into its colours, so either look
shades it.

## The scene in a game

In a level a scene plays live, on the page (`playscape/ui/scenes.js`, its runner `scene-runner.js`): the player's
input held, the bars drawn, a line in the box until a press. A scene's beats may be a screenplay (`{ script }`), and
then this department directs it (`playscape/ui/scene-script.js`), lowered at build into the beats the runner plays:

- **Blocked on the level's own places.** The names are the page's characters by id (MAYOR is `mayor`); the marks are
  its places (a stage's start, exit, pockets, landmarks, a spot) and where each character stands. The actor
  (`actor/scene.js`) blocks it there.
- **Covered as the film is.** The coverage's cuts (`actor/coverage.js` `sceneCuts`, the same cuts `coverScene` keys
  its cameras by) become the scene's `shot` beats, each on its side of the line; the directing camera on the page
  frames them live, with the scenes card's own framings. A cut that lands inside a line plays before it; one at a
  line's end, after it, so the opening wide holds through the first line as the coverage holds it.
- **Hit your mark.** The player is wherever it is when a scene starts, so the scene walks it to its mark first (a
  conversation from whom it meets, toward where it came from) and turns everyone to face as the blocking opens: the
  coverage is framed from the marks, so the marks are made true. As it ends every body is handed back to its rule.
- **A walk the level stops never stalls the scene**: it waits on the walk's arrive or its stuck.
- **The line's clock and the player's press.** The actor times each line; the box waits for the player. Each line
  carries its span on the scene's clock (`take`: its words and the gap after, never into the next line's), and the
  runner keeps that clock while the line is up: a press shows the words whole and the take plays on; left alone, the
  take plays out and the cast holds, listening, until the press; the next press goes on, and the next line's take
  starts at its own start. A held line or a hurried one never drifts the next, so the takes cut at build stay true.
- **What waits.** The actor's takes themselves (the face and the body, driven by that clock), `looks at`, and the
  screenplay's slow motion and freezes are lowered to nothing yet, so a scene reads as blocked and shot, not yet acted.

## Where to look

- **The dailies** (`control/scripts/spikes/actor/dailies.mjs`): every take on one clock, its timeline and its readings
  law by law; scenes drawn from above.
- **The scene film** (`control/scripts/spikes/actor/scene-film.mjs`): both actors at once on a minted hero, cut by the
  coverage, with captions, on the coverage's time map (`--script` for a screenplay of your own, `--grain 2`).
- **The hero-live viewer** (`/hero-live`): a take's face and body on the hero, as an engine plays the GLB.
- **Blender**: the film pack, built as its `SCENE.md` says.
