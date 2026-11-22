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

## Camera styles

The coverage above is one way of shooting a scene, the classical one. A screenplay's `camera` (a film's, or a scene's
own) names another, a card in `actor/camera-styles.js`, and the same cuts (on the lines, the crosses, the turns) are
shot as the card says:

- **A cut is the scene's; its framing is the style's.** Every style cuts where the scene turns. The card says what each
  cut is shot as: the opening (a wide, or straight in on the first speaker), a line (over the shoulder, a clean single,
  the two held), the turn (a close, a push, or nothing special), a move (back to the wide, or the mover followed).
- **The pace is a hold.** A card's `least` is how long a framing is held before the next cut is let in: a sooner cut
  waits until it has, and is dropped if the next comes first. A card's `react` breaks a long line with a cut to the
  listener.
- **Singles are said in words.** A style's singles are framed by size, angle, side and place (`shoot/framing.js`):
  a three-quarter on the scene's side of the line, or a frontal one in the middle that crosses it on purpose.
- **One camera can be a whole scene.** A oner glides to each framing in a short shot of its own and holds it, a single
  camera all scene.
- **The hand on the camera is the style's.** Each card names its shake, laid over every camera it keys.
- **A style answers its own notes.** A card's `quiet` names the director's notes it answers by design: a oner's long
  takes are its point, and a frontal style crosses the line on purpose.

- **Read in the frame it is filmed in.** A style's singles are solved in the film's 16:9 frame (`FILM_ASPECT`), and a
  scene's coverage is read there (`actor/frame-read.js` `sceneFrameRead`, the actors its subjects): the answer's
  `framing`, beside the director's notes. A single says whom it frames (its keys' `about`). The same actor twice in a
  row within a size is no cut, and a long take's glide is on its way between framings, not a composition. The read
  finds the classical coverage's closes and overs a little loose over the head: its eyes sit in the middle of the
  frame, not on the upper third.

`classical` is the coverage with no style, byte for byte. A new style is a card. The in-game scene runner still shoots
classical (its directing camera frames by the scenes card's words).

## The frame

Where a camera stands is the clearance gate's; what it puts in its frame is the frame read's (`shoot/frame.js`), and a
camera can be placed from the same words (`shoot/framing.js`, a shoot-plan key's `frame` or the op `frame`).

- **Size by the cut.** A shot's size is where the frame's bottom edge cuts the figure, read off its landmarks (the eyes,
  the chin, the chest, the waist, the knees): extreme close-up to medium long shot. A figure shown whole is sized by
  how much of the frame it fills: full, wide, extreme wide. From far above or below a figure is sized by its length
  across the frame. The sizes are rows (`SIZES`), each with the lens it reaches for.
- **The dials apart.** Size, angle (the lens's tilt: eye, high, low, overhead, worm), side (where the camera stands round
  the subject, from its facing), place (a third, the centre, or lead) and dutch combine freely. A framed key on a
  subject rides it, so the framing holds as it moves.
- **Headroom and the upper third.** A medium shot or wider keeps the crown in; the eyes sit near the upper third.
- **Never cut at a joint.** The bottom edge falls between the knees and the ankles, not on them.
- **Lead room.** A figure facing across the frame sits on the side it faces away from, its room ahead of it.
- **Thirty degrees or two sizes.** The next shot of the same subject turns 30° or more round it, or changes its size by
  two steps; less, and the cut jumps.
- **Screen direction.** A mover going frame right keeps going frame right after the cut, unless a shot along its path
  (toward or away) turns it.

The read rides the shoot door's answer as `composition`: each shot's subject, size, headroom, eyes, place and facing, and
advice with its fix. It reads; the eyes gate (LOOK THROUGH on the World page) is the person's.

## The moves

A move is said by its name and laid as keys framed in those words (`shoot/moves.js`, a key's `move`, the op `move`), so
it rides a subject that walks and reads back as its sizes. Each is a row of `MOVES`.

- **Dolly or zoom, never confused.** A push in keeps its lens and moves the camera; a crash zoom keeps the camera and
  changes the lens; a dolly zoom does both against each other so the subject holds its size while the place round it
  stretches. Framing from where a camera stands (`framing.js` `solveFromStand`) is how a zoom or a pan frames.
- **A zoom keeps its subject framed on the way.** A crash zoom lays a key at each size between, timed by the lens, so
  the aim follows the closing frame.
- **A crane bows.** The boom swings on its arm: a key between, at the mean tilt, so the path arcs.
- **A whip is a blur.** Between its keys a whip pan leaves its subject on purpose, and the frame read does not call it
  lost; inside a whip or a crash zoom it reads no composition.
- **The hand that holds it.** A camera's `shake` (`shoot/shake.js`) is a style (handheld, steadicam, run, rumble) laid
  over its keyed path by the sampler from seeded dice, so every reader of the camera shakes the same; a camera without
  one is sampled exactly as before.

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
`pastel`, `cold`, `warm`, `night`) or dials. A moment overlays its look on it.

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

The agent asks for it at `forge_motion`: a `screenplay` subject (a cast, marks and a script), shot by its `coverage`,
with `export: 'blender'`. Each part plays from a persona (its hero, register, style and role; the part's own words win),
from a minted hero, or from a hero spec. The door and the script write through one core
(`control/lib/mcp/tools/scene-film.js`), so the same scene makes the same pack byte for byte. The tool never launches
Blender: its answer names the command that builds the pack (`export-scene-blender.mjs --build <dir>`). The manual is
the `scene-film` motion-vocab card.

Before the film there is the storyboard, the default form, which mints no actor (`actor/storyboard.js`). It has a
panel for each coverage shot. Each panel has:

- its frame: stand-in mannequins drawn by the book press (`book/drawn-plate.js`, a wash), seen from the shot's
  camera. The plate's eye is level, so a pitched camera is drawn by moving the horizon. On a set with a walled room
  (a decorated room), `roomForms` stands the room round them: its four walls, each door and window cut through its wall
  (the room's `openings`: a span along a wall, a sill and a head), and each piece that stands on its floor, as upright
  blocks at their heights, lit from above. Any other set is drawn as open ground, as before;
- the blocking from above, with the camera. A set's rooms are drawn in it, and in a furnished room each standing
  piece too, a door as a gap in the wall and a window as a thin line across one, with only the places a cross goes
  to named;
- its span, its lens, its move, its lines and crosses, and its notes.

`export: 'mp4'` adds the animatic: the panels held on the screen's clock, with the line spoken under each. A panel
is a shot of the same coverage the Blender pack cuts, so the board and the film never disagree.

**The set** (`world_ref`, `actor/set.js`): a stored world's named places are marks the script can name.
- Each room's middle is `room-<id>`, and each side of a door has a stand.
- A part with no mark stands in the largest room.
- The coverage is still framed from the marks, so a wall between a camera and the actors is advised by
  `shoot/clearance.js` `shootSightlines`.
- A decorated room (`interior/places.js`) is a set: its payload carries the room (`walled`, its ceiling `h`, the tall
  pieces as `solids`, and `stand`, the open floor a cast with no marks is put on) and an anchor by each piece, feature,
  door and window, named by the piece's word (`sofa`, `fireplace`, `door`).
  - In a `walled` room every camera is kept inside (`actor/coverage.js` `fitRoom`): brought back along its line of
    sight to the wall or to the first tall piece, its lens opened to hold the framing.
  - A cross is routed (`actor/route.js` `routeWalk`): the room's `blocks` (every standing piece) and the other actors
    are walked round over their corners, the shortest clear way inside the room. The walk's `via` holds the corners;
    its root keys turn onto each leg in its first steps. A set with no `blocks`, or a cross with no way round, is
    the straight line.
- **Any world is a set, with nothing said by it** (`actor/ground.js`). Every world resolves to faces
  (`worlds/world-scene.js`), and the scene reads those:
  - `standingOf(faces, { about })` reads the ground about the marks the scene uses on a grid: a cell is taken where a
    face passes between `STEP` and `HEAD` above the floor. The taken cells are gathered into `blocks`, the same shape
    a decorated room gives, so `routeWalk` and the storyboard need no second path. A world that states its own
    `blocks` is taken at its word.
  - `fitSight(framing, sight)` (`actor/coverage.js`) brings each camera along its line of sight past whatever stands
    between it and its subject, with `faceSight(faces)` (`shoot/clearance.js`) as the line of sight. It runs after
    `fitRoom` on every set.
  - A world that names no place gets one, `ground`: `openGround` finds the clear ground nearest the world's middle,
    under the open sky first, and the floor is the ground under that spot (`floorUnder`).
  - An object's own page stands it on a studio floor (faces marked `studio`); the scene leaves those out.
- **A window, and what stands by instancing** (`mcp/tools/scene-film.js` `setFaces`, `standingExtras`). On a set
  with no walled room only the faces with a corner within `WINDOW` of the scene's marks are read. With them, within
  `NEAR`: each instance of `payload.repeats` (its template through its place and scale, the faces within a body's
  height of its foot, capped per instance) and each collider box nothing names (a parked vehicle's:
  `vehicle-registry/parked.js`). They join the set's faces before the ground is read, so they are blocks to the
  routes, the cameras and the board; they are not part of the relief. `playFilm` hands `prepareScreenplay` a map of
  the worlds it has read (`worlds`), for the one call.
- **Ground that is not flat** (`actor/relief.js`). A scene is planned on a level floor; where the land about its marks
  rises or falls by more than a step, the film keeps that plan and carries the land beside it.
  - The land is walked outward from the scene's marks with the world's own ground probe (`network/walk-gate.js`
    `walk.ground`): a cell at a time, a step taken within a riser up or a drop down. What the walk never reaches (the
    inside of a house, a roof, past a cliff) takes the height of the nearest ground it did.
  - The set is then read with that ground laid level (`levelled`), so a hillside is clear ground to `standingOf`,
    the routes and the cameras, and what stands on it still stands.
  - The set carries the lift as `relief` (heights over its `floor`). The Blender pack keys each actor's root in `z`,
    keys a walk along its way, and lifts each camera, its point of interest, each setup's lights and each prop by the
    ground under it. A level set has no `relief` and is written as before.
  - The storyboard draws it (`storyboard.js` `landForms`): the land out to where the cast stands as low terraces
    over the lowest ground in view, which is the plate's ground; the camera, what it looks at, the cast and the
    blocks are each raised by the ground under them. Terraces step 0.3 m at the finest and coarsen past thirty.
  - A rise between a camera and what it looks at is read from the land itself (`landBetween`), since the planned
    sightlines see the ground laid level; it is advised as `set-blocks`.
- **Standing places in an open world** (`actor/set.js`, `mcp/tools/scene-film.js`). An anchor with a `box` and a
  front (`N`), a town's house, is stood before its front. In a world with no rooms, a mark the scene uses that is
  not on clear ground is moved to the nearest that is, and the parts with no mark stand in their line on clear ground.
  A geocube's world is read for the places it knows and does not name (`setPlaces`): `start` from its walk's spawn,
  a town's `street`s and `crossing` from its ports, a city's `corner`s from the signals nearest its seat (each at
  the height its walker goes, a hint the relief reads the ground from). Its walkers' paths are carried as
  `floor_plan.paths`, and a cross whose two ends stand by one path follows it (`route.js` `pathWalk`).
- **A prop that moves** (`props.<name>.from`, `start`, `to`, `leave`, `speed`; `ARRIVE_SPEED`, `arrivalKeys`). It is
  placed and read at its `at` (its faces join the set there), turned along its way in, or its way out when it only
  leaves, unless it names a turn. `set.props` carries `move: { from?, start?, to?, leave?, speed }` as written; the
  pack lowers it with the played scene to `keys` ([{ t, x, y, z? }], a couple of metres apart): a time is a second
  or a line's start or end (`S.turns`), a leaving with no time sets off as the last line begins, never before the
  arrival ends. `from` and `to` are routes (a point or a list); each key carries `turn`, the heading of the stretch
  it is on (the key at a corner the next stretch's), unwrapped so no key is more than a half turn from the one
  before. The relief takes every point of a prop's `at`, `from` and `to` as seeds, so the keys are on the ground
  along the way. `actors.py` keys the prop's empty on them, place and turn, linear.
- **Dressing by word** (`mcp/tools/set-things.js`). A prop's `thing` is a word read on the shelves in order: the
  corner props (`era/props.js`), the furniture styles and kinds (`furnishings/forms.js`, and a room piece's word
  through `furnishings/roster.js`), the vehicle registry (`vehicle-registry/roster.js`, lowered as the vehicle door
  shows it parked, its realistic build first). `thingPayload` resolves a recipe held in memory, never stored, and
  `thingScale` stands it at the shelf's measure (`dimsOf`). A thing a film wants that no shelf has is a row on that
  shelf, not a film's own object. The Sets department owns `/scenes/*/props`.
- **Props** (`screenplay.props`, `mcp/tools/scene-film.js` `placeProp`): anything mojulo made, resolved to faces the
  same way, stood with its lowest point on the floor and its middle at `at`, turned and scaled. Its faces join the
  set's, so the ground, the cameras and the board treat it like the rest. Its name becomes a mark on the clear ground
  beside it. The plan plays the screenplay without `props`; the recipe keeps them as written. With no `world_ref`
  the set's kind is `props` and the cast get marks of their own. The Blender pack carries each as its own
  model, `props/<name>.glb` (`scene.json` `props`: its place, its turn, its size as read), and `actors.py` stands it
  under an empty `prop:<name>` at that size, whatever unit the model came in.
- The storyboard draws every set: `groundForms(blocks)` stands the nearest blocks as boxes in each panel. When a set
  is drawn, `panelStation(framing, { square: true })` turns the world by quarter turns only, so the blocks stay
  axis-aligned boxes (cheap for the plate), and the station takes the rest of the angle.
- The world's own Blender pack goes under the actors, lowered so its floor is the scene's.

**The voice** (`voice`): recorded lines set the scene's clock.
- A recorded line lasts its recording, and its read is fitted to it: its rate is tuned until the read meets the
  recording's length, and its words come from the alignment.
- So the face, the stresses and the listener's nods land on the recording, and the line's first beat speaks it (the
  mouth from its phonemes).
- The voice track and captions are on the screen's clock: a slowed stretch never drags a word.

**The dub** (`dub`, `actor/dub.js`): to picture.
- The timing, the blocking, the bodies and the acting are the original's. Only the mouths are re-solved, as
  `face:dub-<locale>`.
- A dub that runs into the next line is advised.
- The animatic carries each language as its own audio and subtitle track. In Blender, `dub.py` switches the faces and
  `film_render.py -- --locale` the sound.

## The film

Several scenes make a FILM (`control/lib/graph/film/`), the animation studio's recipe: one cast, its sets, one look
and an edit, stored as a sketch of kind `film` whose page is its book. Each scene is a screenplay played by the same
core as one forged alone (`film.js` `sceneScreenplay`).

- **Departments** (`departments.js`), in the game studio's chapters' shape: script, casting, set, performance, camera,
  voice, look, edit and render. Each owns paths in the recipe and the advice it answers; every director's note has
  exactly one home. The waves are read from what each department reads.
- **The readout** (`readout.js`) gives each scene, each department's state, all advice and what to do next. A scene
  that does not play is said by name, and the film reads on.
- **The eyes gate is the person's, per scene.** An approval of a scene's board is stamped with what the board was
  drawn from, so a later edit reads as stale.
- **The door is `forge_motion`'s `film`** (`lib/mcp/tools/film.js`): write, patch, approve, run.
  - `storyboard` boards every scene.
  - `animatic` cuts them into one MP4 with the film's voice and dub tracks laid end to end.
  - `film` shoots each scene in mojulo and joins them into one MP4 with the film's sound (below). Resumable.
  - `blender` writes each scene's pack and `cut.py`, which joins their renders: the high-end outcome. It is
    resumable: a run works until its budget and leaves the rest `pending`.
- **The book** is `book.js`. The manual is the `film-studio` motion-vocab card.
- **The film shot in mojulo** (`film/native.js`, `mcp/tools/scene-film.js` `writeNativeFilm`; a screenplay's
  `export: 'film'`, a film's `run: 'film'`). The scene is played on its set's own World page and shot by the page's
  capture (`motion/world-frames.js`), so nothing is written for what the world already does: its traffic, signals
  and people, its weather, a geocube's hour and clouds (`nativeSet` lays the scene's ask on the set's recipe).
  - The cast is each hero's page figure with the scene's take packed as a clip (`worlds/world-scene.js` `heroFigure`
    `takes`, the path a game's cutscene uses), previewed once per actor (`figure.preview` as a list) and carried along
    its blocking by the rig preview's `travel` (`scene/channels/rig-preview.js`): the place every frame, the take
    read once on the scene's clock. Actors on one hero share a figure.
  - The cameras are `nativeShots`: the coverage's program a frame at a time, in the page's units, lifted by the
    set's floor and ground; the page's clock is the world's at the scene's start plus the scene's time.
  - The page is tens of megabytes, so it is written to disk and read from the file, and the frames are written as
    they are shot (`renderWorldFrames` `file`, `sink`), then encoded (`encode-mp4.js` `encodeFrameDirMp4`).
  - A long take is resumed: `writeNativeFilm`'s `budgetMs` and `stamp` keep the frames shot so far on disk
    (`frames/take.json`), and the next call shoots from the next frame. The page's picture at a frame is its clock's
    alone, so a take shot over several calls is the take shot in one.
  - The viewer's own stand-in (a walker the page follows) is left out, as `film/life.js` leaves it out.
  - A film's run shoots each scene silent (`scenes/<id>/film.mp4`, its record `film.json`), then joins them without
    another encode and lays the sound with the animatic's own `cutSound`. `made.native` keeps each scene's stamp and
    the cut's; `filmVideoOf` serves it over the animatic. An order's event is `shot`.
  - Known limits: the cast is drawn unlit by the set (its own baked light, no ground shadow), props are not stood,
    the anime face plays no take on the page, the wind is the world's own.
- **The scene's hour** (`screenplay.hour`, `mcp/tools/scene-film.js` `hourPreset`; a film's `scenes/*/hour`, the
  look and light department's). Read with `era/geocube-hours.js` `readHour`. It is taken out of what the plan plays
  (`set.hour`), so the blocking, the coverage and the board do not move. When the pack is written the set's
  atmosphere takes the hour's preset (`day`, `dawn`, `dusk`, `night`: what `film_light.py` lights by); a geocube set
  is resolved at that hour for its own sky (its faces are the same at every hour). `scene.json`'s `set` records
  `hour` and `lit`. The lamps ride the set's own pack, made at the set's own hour, so a night's street lamps are
  only there if the world was made with them.
- **The scene's weather** (`screenplay.weather`, `film/weather.js` `weatherSpec`; a film's `scenes/*/weather`, the
  look and light department's). One of the world's weather states (`matte-paint/sky.js` `CLOUDS_OF_WEATHER`, less the
  two that are things on the wind), lowered to `{ cover, sun, soften, sky?, air?, rain?, snow?, about, reach }` and
  written into the set's `atmosphere.json` as `weather`. `film_light.py` performs it: the sun's energy times `sun`
  and its angle `soften`; under cloud the world's background is the cover's grey, not the sky model; `air` is the
  fog volume, in metres, unless the world declares a thicker fog; `rain` and `snow` are geometry nodes over one
  plane about the cast (`precip`), each point's height a function of the scene's time alone, so a frame renders the
  same alone or in order and nothing is simulated or baked. Like the hour it is taken out of what the plan plays.
- **The set's lamps by the hour** (`film/lamps.js`; no key: the light's preset decides). Most worlds stand their
  lamps as form only, so `lampHeads` finds them in the lit payload: a face or a repeated thing whose `group` ends in a
  lamp word, the faces of one lamp those within a step of each other, an instanced lamp's head its template's through
  the instance's place, scale and turn. At night, dusk and dawn the nearest to the cast ride `scene.json` `set.posts`
  and `actors.py` `posts` stands a point light under each head. By day a world's declared lamps (`payload.lights`)
  are put out: `atmosphere.json` `lamps_lit: false`, read by `film_light.py`.
- **The scene's clouds** (`screenplay.clouds`, `film/clouds.js` `cloudsSpec`, `cloudsPng`; a film's
  `scenes/*/clouds`, the look and light department's). One of the world's skies (`matte-paint/sky.js` `WEATHERS`, read
  by `readClouds`). Two things reach the pack: `atmosphere.json`'s `clouds` (the weather's own cover table slid by
  `cover`: `sun`, `soften`, a grey `sky` at a full cover, and the band's `top` and `gain`) and `clouds.png`, the band a
  geocube's dome wears (`paintCloudBand`), painted for the film's sun (its bearing, its height at the hour's preset).
  `film_light.py` `clouded` lays it round the world's background over the sky model or the cover's grey: azimuth from
  +x toward +y, the horizon up to `top` degrees, its alpha the mix; `gain` stands a painted colour against a physical
  sky. With `weather` the light is the darker and softer of the two. An interior preset has no sky: advised.
- **The scene's wind** (`screenplay.wind`, `film/wind.js` `windSpec`; a film's `scenes/*/wind`, the look and light
  department's). A word, a number, the weather's own (`weather/weather.js` `STATES` `wind`, `gust`) or its speed, gust
  and bearing, lowered into `atmosphere.json`'s `wind`: `lean` and `sway` as shares of a plant's height (by the speed
  squared), `hz` for an 8 m tree, `flutter` in metres, and `plants`, the whole words a plant's object is known by (the
  shelves' own and the grower's species, `vegetation/species.js`). `film_light.py` `wind` takes the nearest plants
  within reach of the cast and gives each a geometry-nodes modifier: a vertex moved by its world height up the plant
  squared, along the wind, on the scene's time; no simulation, so a frame renders alone. Each plant has a small node
  group of its own round the shared one, since a modifier's properties are not settable in every Blender.
- **The set's life** (`screenplay.life`, `film/life.js` `flowLife`; a film's `scenes/*/life`, the set
  department's). A metro's traffic is a plan its page drives (`geocity/flow.js`, `scene/channels/flow.js`): a lane a
  signalised model (`traffic-model.js`). The film reads the same plan with the same model: each lane within reach of
  the cast stepped on the world's clock from `clock`, each vehicle that comes within reach keyed every quarter second
  on the road's height, facing along its lane. A vehicle is built as the parked ones are (`geotown/cars.js`
  `carModel`, its paint the plan's tint) and written as `life/<model>-<n>.glb`; it rides `scene.json`'s `props` as a
  thing that moves (its `keys`), so `actors.py` needs nothing new. A vehicle that wraps round its lane's ring during
  the scene is left out. Advice: `life-unused` (the set has no traffic), `life-crosses` (a vehicle within half its
  width and 0.4 m of a part's root at the same second). A planned city's people (`walkLife`: its `walkers`, each read
  on the world's clock as a camera follows it, `shoot/subjects.js`, in metres) are written once a figure as
  `life/<figure>.glb` with its walk clip and ride `props` the same way, each key also carrying `p`, the cycles of
  the gait gone by (ground covered over the stride, the page's rule): `actors.py` reads each of the figure's curves
  again a frame at a time at that phase, so a walker held at a kerb stands. The walker a view follows is left out.
  The planned city's cars (`carLife`: its `cars` on the same subjects, the signalised model and its turns at the
  junctions) are written once a baked mesh as `life/<car>.glb` (`carFaces`: the bake's triangles, its linear
  colours as sRGB fills, turned to face +y) at the size the bake measured. On the board (`lifeOf`, `actor/storyboard.js`
  `lifeForms`): the world that moves rides the prepared set unlisted, and each panel stands what is near its look-at
  at its moment, a vehicle as capsules along its heading (a box lies along the axes only), a walker as a mannequin.
- **A location in words** (`film/film.js` `setErrors`, `setRef`, `setAsk`; the door's write step). A film's set is a
  stored world's ref, or a place asked for: `{ words, seed? }` or `{ cube, show, seed? }`, the geocube kind's own
  keys. The door makes it into a geocube sketch once (`createSketchHandler`), writes its `ref` beside the ask in the
  recipe, and on a later write compares the ask with the film as it was last written: the same ask keeps the place,
  another changes the same world in place (`updateSketchHandler`). `sceneScreenplay` plays the scene on that ref. The
  readout's `sets` carries the geocube's own `brief` (what its words read, which nothing read); an unread word is
  advised as `words-unread` in the set department. An order's `places` take the same.
- **The set department's jobs** (`film/location.js`, `film/readout.js`, `film/film.js` `SET_KEYS`). LOCATION:
  `proposeLocation(text)` reads a scene's words (an order's event notes, else its script) by two small tables
  (`SHOW_WORDS`: what asks for a neighbourhood or a metro; `LAND_HINTS`: land words the geocube's table does not
  read) and the geocube's own (`sceneOfWords`), and gives a set ask, the hour and the words that decided. A scene
  with no set whose words name a place is advised `no-set` with the patch that takes the proposal. CONSTRUCTION: a
  set ask carries the geocube's `style`, `geotown`, `geocity` and `town` to the geocube as given; the readout's
  `sets` says the style. DRESSING: a prop's `thing` (above). INDOORS: a set ask with `room` (`film.js` `SET_ROOMS`, `isRoomAsk`) is made by
  the interior designer's door (`designInteriorHandler`: a house section drafted, the room fitted out); the same room
  is redecorated when only its style or brief changes; `ROOM_WORDS` proposes one for a scene indoors.
- **A film made to order** (`film/order.js`, the door's `order`, `deliver` and `ordered_by`): a client studio's
  characters, places and event notes written as a film (`filmOfOrder`), the brief kept in the recipe's `order`. An
  event with notes and no script holds the notes in its scene (`draftScript`) and reads `unwritten`, advised in the
  script department, until it is written. `orderReadout` derives each event's state from the film's stamps and runs.
  `deliver` records the hand-back in the row's `made.delivered` (the film, its book, the animatic and its file, the
  rendered cut where there is one), stamped by every scene's stamp so a later change reads as not current.
  `ordered_by` finds a client's films by `order.from`.
- **A game plays a film as a cutscene** (`game/flow.js`, `game/flow-films.js`, `game/play-cine.js`). A flow's
  cinematic step takes `film` (a film's ref) or `video` (an address) in place of a scene on a stage. The recipe keeps
  the ref; `withFlowVideos` gives the step its video when the game is served (the `/game` route) or exported
  (`export_game` copies it to `assets/cutscenes/<ref>.mp4`), from `filmVideoOf` (`tools/film.js`: the rendered cut,
  else the animatic). The play shell inlines the player only where a flow has such a step; a game with none carries
  not a byte of it. It plays over the game, is skipped with Esc, Enter, Space or its button unless `skip: false`,
  and a step with no video or one that will not play goes straight on.
- **Light per setup** (`film/setup-light.js`, opt-in with `render.light: 'setups'`): each shot is lit as a crew relights
  a setup, in the cast rig's colours and ratios.
  - The key goes on the short side of the face: in front of where it is turned, away from the lens.
  - The fill goes across the lens. The rim comes from behind.
  - They jump on the cut (`light.py`).
- **Focus and blur:** `render.dof` puts the focus on the subject the camera looks at. `render.motion_blur` and
  `render.samples` go to `film_render.py`.
- **The render worker** (`scripts/render-film.mjs`, `film/render-plan.js`) renders a pack, or a whole film:
  - it builds once and renders chunks that never cross a cut, under a budget, resumable from the frames on disk;
  - it encodes each scene with its voice, then `cut.py` joins the scenes;
  - it writes `render.json`, which the film's readout reads back. The tools never launch Blender;
  - a pack made again since its render (the scene edited) is another pack (`film/pack-stamp.js`): it is built and
    rendered again, the other scenes are kept, and the film is cut again.
- **A set's light** is its world's: the pack carries the world's `atmosphere.json` and `film_light.py` performs it
  after `set.py` (the sky, a sun or none indoors, the lamps at their power). `render.light: 'setups'` adds each setup's
  key, fill and rim over it.
- **House lights:** a walled set whose world declares no sky and no lamp gets one area light under each ceiling
  (`scene.json` `set.house`, made by `actors.py`), so a room of a house does not render black.
- **A dub's frames** are its own (`film/frames-<preset>-<locale>`): the worker gives the faces the locale's mouths, or
  the scene's own back, before it draws. A scene with no dub in the locale keeps its own frames and voice.
- **The stage:** a scene with no set plays on a bare stage (`actors.py`): a matte floor, a soft sky and, where the
  setups are not lit, one key. `film.blend` starts empty, and a hero's page (its view cameras, its ground) stays out
  of the film.

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
- **The takes on the page.** Each actor of a script plays its take there (`playscape/ui/scene-takes.js`): blocked on
  the very stage the beats are lowered on, so its clock is the lines' clock. Its body's act is packed on its own rig as a
  one-shot clip named for its script (`scene:<id>:<k>`, `worlds/world-kinds.js` `ctx.takes`), and a realistic face, the
  one face the page plays, gets the take's performance track under the same name: the eyes and brows on the read, the
  gaze on its partners, `looks at` among it. While a line plays, the scene channel names the take and its phase
  (`world.take`) and every figure that carries it plays it, the listener as much as the speaker; held for the press,
  between lines and after, each goes back to its own clips, the idle's breath and blink. An act a rig cannot stand (a
  beast, a mascot) is left out and that figure plays the scene as blocked; a head with no face on the page plays its
  body alone.
- **What it costs.** A take is about 16 kB a scene-second for a realistic hero (its face about 3 of that) and 11 for a
  plain one, as the page ships it; `TAKE_BUDGET` and `TAKES_PAGE` say when a page's takes are advised against.
- **The screenplay's time on the world clock.** In a level the world clock (`worlds/controllable/world-clock.js`) plays
  the script's time: `Slow motion.` is a moment of the script's own (`{ tempo }`, `<clip>:slow:<n>`) that slows the world
  until `Real time.`, the next slow motion or the script's end, eased in and out; `Freeze.` holds the world, and the
  scene with it, for its seconds, and a slow stretch it fell in takes the clock back after it. The camera, the box and
  the takes keep real time, so the action slows and the words never do. The page's clock is composed for a scene's own
  moments (`scenes.js` `sceneMoments`), beside the world's tempo; a skip fires none of them, and a scene that ends with
  one going ends it, so the world is never left slowed. A hand-written scene may fire one of the world's own moments by
  name the same way.

- **How each acts, and the notes.** A character's `actor` (`characters.cast.<id>.actor`, `characters.hero.actor`: its
  `style`, `role` and `register`, the actor's own words) reaches a stage's page as `play.actors`, so the lines, the
  blocking's clock and the takes are played in it. The story's report (`design_game`'s `story.notes`, the bible's
  moment cards) carries each script's director's notes as it is blocked on its stage: advice with its fix, never a
  refusal.

## Where to look

- **The contact sheet** (a shoot plan's `contact`, `shoot/contact.js`, `motion/contact-sheet.js`): each shot at its
  start, middle and end on the world's own page, the thirds drawn over, the frame read under each frame. A scene's
  (a screenplay's `shot.params.contact` with `export: 'film'`) is the film shot in mojulo at those frames only. The skill
  `/direct` is the director's loop round it: the words, the why, the read, the sheet, three rounds at most.

- **The dailies** (`control/scripts/spikes/actor/dailies.mjs`): every take on one clock, its timeline and its readings
  law by law; scenes drawn from above.
- **The scene film** (`control/scripts/spikes/actor/scene-film.mjs`): both actors at once on a minted hero, cut by the
  coverage, with captions, on the coverage's time map (`--script` for a screenplay of your own, `--grain 2`).
- **The hero-live viewer** (`/hero-live`): a take's face and body on the hero, as an engine plays the GLB.
- **Blender**: the film pack, built as its `SCENE.md` says.
