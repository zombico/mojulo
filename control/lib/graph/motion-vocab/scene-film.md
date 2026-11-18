---
{
  "id": "scene-film",
  "name": "Scene film (a screenplay acted, shot by its coverage, storyboarded, filmed in mojulo or in Blender)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "A SCENE written as a screenplay, acted by its cast (personas or heroes) and shot the way a director covers it: first a STORYBOARD (a panel a shot, drawn with stand-ins, in seconds) and its ANIMATIC, then the FILM from the same plan: shot in mojulo (the cast acting on the set's own page, a video in minutes), or handed to Blender as a film pack for the high-end render: each actor a skinned GLB with its performance, the cameras cut together, a film (Cycles) or anime (EEVEE) look.",
  "when": "Reach for this on 'a short film of my two characters talking / storyboard this scene / an animatic / use my recorded lines / dub it in French / set it in my room / shoot this scene / film the dialogue / a video of the scene / an animated short / render the conversation in Blender / a scene with my personas / Cycles render of the scene'."
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
    // props: { car: { ref: 'sk_…', at: [4.5, 3], turn: 90 } },   anything mojulo made, stood in the scene
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
- **The camera** (`camera`): how the coverage shoots the scene's cuts, a card each (`actor/camera-styles.js`); none is
  `classical` (establish wide, over the shoulder, close for the turn, wide for a move, one side of the line):
  - `verite`: handheld singles on a long lens, no establishing wide, the mover followed;
  - `planimetric`: flat and frontal, each speaker centred facing the lens, a short lens, the line crossed;
  - `still`: low and level, nearly into the lens, long holds, no moves;
  - `oner`: one camera, no cuts, gliding to whoever speaks, on a stabilised rig;
  - `kinetic`: quick cuts, tight low singles, a push on the turn, a reaction cut on a long line, the camera running;
  - `observational`: from across the room on a long lens, the two held, few cuts.

  Words read too ('handheld', 'symmetrical', 'long take', 'action', 'surveillance'). A style answers some notes by
  design (a oner's long take is no `long-take` note). Each style's shake rides the Blender pack's and the native
  film's cameras; the in-game scene runner shoots classical.
- **shot.params**:
  - `look`: `film` (default) or `anime`;
  - `style`: a playing style for every part without one;
  - `grain`: `twos` | `threes`, the scene on twos with the camera on ones, as anime is keyed;
  - `grade`: a word (film, noir, bleach, vivid, pastel, cold, warm) or the dials;
  - `hero`: the spec every part without a body plays;
  - `contact`: `1` | `2` | `3` with `export: 'film'`: the film shot in mojulo at a few frames a shot, its CONTACT SHEET
    (each cut's start, middle and end on the set's own page, a row a shot, the thirds over each frame and the frame read
    under it: `contact.path`) instead of the whole take. Look at it before the film: about a minute for a short scene
    where the film is several.

  The answer's `framing` is the coverage read as a shoot plan is (each shot's actor and size, and the advice: a head
  cut, a joint cut, a jump cut, short-siding, a screen-direction flip), beside the director's notes. A style's
  framings are solved in the film's 16:9 frame. The read takes a figure as its height on its axis: hair stands a little
  over the crown it measures, and at under a metre from the lens a face draws larger than it reads.

  `shot.fps` defaults to 24.

## The set, the voice, the dub

- **`world_ref`: the set.** Anything mojulo made that has a form: a room, a hall, a trail, a stage, a game's level, a
  house, a city, a landscape, or a single object such as a table or a vehicle. The set does not have to say anything
  about itself.
  - **What stands in it is read from its form.** Wherever the set rises through the height of a body, a cross goes
    round it, each camera is brought to where it sees the cast past it, and the storyboard draws it as plain blocks.
    A kerb or a rug is stepped over; a lintel or a bough above a head is walked under.
  - **Trees, poles and parked cars count.** Things a world stands by repeating one model (a street's trees, its
    poles) and its parked vehicles are read with the set near the scene: a tree is its trunk, walked round and
    drawn as a post, its crown walked under.
  - **Only the world near the scene is read** (80 m about its marks), and in a film a set several scenes share is
    read once a call. A city's first read is still about a minute.
  - **A set that names no place** (an object, a city) still takes a cast: they stand on the clear ground nearest its
    middle, under the open sky where there is any, at a place called `ground`.
  - **Land that rises and falls** (a field, a hillside, a street on a slope) is walked as the world's own walk walks
    it. The cast, the cameras and the props stand on the ground under them in the Blender film, and a walk keeps its
    feet on it. Rising land is not read as something in the way; a bank too steep to step up, a wall or a cliff
    still is. The storyboard draws the land as low terraces the cast stands on, and a shot whose camera has a rise
    between it and the actors is advised (`set-blocks`).
  - **A place that is a building** (a town's `house-…`) is the ground before its front, a step off the wall. A
    place the scene uses that is inside a thing is moved to the clear ground nearest it, and parts with no mark stand
    in their line on clear ground.
  - **A geocube's world names more places than its own.** `start` is where its walk begins. A town has `street`,
    `street-2`… (the middle of each street) and `crossing` (where two meet). A city has `corner`, `corner-2`…, the
    street corners nearest its centre, on the pavement.
  - **A cross follows the path.** Between two places on a trail or a sidewalk, "Ada crosses to the lake." goes
    along it, not straight across country.
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
- **`hour`: the time of day the scene is shot at**, whatever hour its set was made at. A number from 0 up to 24 or
  a word: `dawn`, `morning`, `noon`, `afternoon`, `golden`, `dusk`, `night`. The Blender film is lit by it (day, dawn,
  dusk or night light; a set made as a geocube also gives its own sky at that hour), so one street can be shot at
  noon and at night with no second world. The set's form, the blocking and the storyboard are the same at any hour.
  A scene with no set is advised (`hour-unused`). Not yet: lamps a world lights only at night.
- **`weather`: what the sky is doing while the scene is shot.** One of `clear`, `haze`, `mist`, `fog`, `dust`,
  `overcast`, `drizzle`, `rain`, `downpour`, `thunderstorm`, `snow`, `blizzard`, `duststorm`. The Blender film is
  lit and aired by it, with its `hour`:
  - **The sky's cover.** Under cloud less sun gets through and its shadow goes soft; an overcast or stormy sky is one
    grey light from everywhere.
  - **The air.** A haze, a mist or a fog thins what is far (a world's own fog, where it is thicker, is kept).
  - **What falls.** Rain or snow about the cast, out to 30 m, falling for the whole scene.
  - The set's form, the blocking and the storyboard are the same in any weather. A scene with no set is advised
    (`weather-unused`).
  - Not yet: it rains through a roof (a porch, a room's ceiling is not read); wet ground, settled snow, lightning and
    wind in the trees are not made.
- **The set's lamps follow the hour.** Shot at night, at dusk or at dawn, the street lamps near the cast are lit in
  the Blender film, each a warm light under its own head, whatever hour the set was made at; by day they are dark.
  Nothing to ask for: it is the scene's `hour` (or the set's own). A set with no lamps near the cast has none lit.
- **`clouds`: the sky over the scene.** One of `clear`, `fair`, `overcast`, `storm`, `haze`, `high`, or
  `{ kind, cover?, seed? }` (`cover` 0 to 1, the sky's own at 0.5; another `seed` is another sky of the same kind).
  The Blender film's sky wears the world's own painted clouds, lit for the film's sun at the scene's `hour`, and the
  sun comes through them: fair cloud barely dims it, an overcast lets little through and softens every shadow.
  - It is the sky alone. `weather` is what the air does and what falls (fog, rain, snow); a scene may have both, and
    the darker and softer light of the two is the one it is shot in.
  - A scene with no set, or one set indoors, is advised (`clouds-unused`).
- **`wind`: how hard the air moves.** `still`, `breeze`, `fresh` or `gale`; a number 0 to 1; `'weather'` (the wind
  the scene's own `weather` blows); or `{ speed, gust?, from? }` (`from`: the bearing it blows from, degrees clockwise
  from north). In the Blender film the set's trees, bushes and hedges near the cast lean downwind and sway, more with
  height, their feet still, the leaves quivering; a gale bends them, a breeze stirs them.
  - Only plants move: no cloth, hair, rain or dust is blown. A set with no plants near the cast is left as it is.
  - A scene with no set is advised (`wind-unused`).
- **`life`: the set's own traffic drives through the scene.** `true`, or `{ clock?, reach?, most? }`. A city made as
  a metro has traffic of its own: lanes, signals, family cars, taxis, vans, trucks and buses. With `life` the Blender
  film has the vehicles that come near the cast, each driving its lane for the scene's length, stopping at a red
  light and pulling away on green, as the city's page drives them. A planned city (`kind: 'city'`) has its own cars,
  turning at its junctions, and people of its own, walking round their blocks and waiting at the crossings: with
  `life` the cars that come near the cast drive through the film and the people walk through it, each stepping as far as it goes and standing where it waits.
  - `clock`: the second of the city's clock the scene starts at (0 unless given). The lights and the queues differ
    from one second to another, so another `clock` is another moment of the same street.
  - `reach`: how far about the cast the traffic is read, in metres. `most`: how many vehicles at most, the nearest
    first (and as many people).
  - The lanes are the city's: nothing is steered round the cast. A vehicle driven through where a part stands is
    advised (`life-crosses`); stand the cast on the pavement (a `corner` place).
  - The storyboard and its animatic show it too: at each panel's moment the traffic near what the shot looks at is
    drawn as rounded blocks along its way and the people as grey stand-ins, and the blocking shows them from above.
  - A set that moves nothing of its own (a field, a street of houses, a room) is advised (`life-unused`): bring a
    thing in with a prop's `from` and `to`.
  - Not yet: people walking, animals, wind in the trees; the storyboard and the animatic do not show the traffic; a
    vehicle does not turn at a crossing; no sound of it.
- **`props`: things stood in the scene.** Write `{ <name>: { thing | ref, at, turn?, scale? } }`. `at` is `[x, y]` in
  metres or a mark's name; `turn` is degrees about the vertical; `scale` is how many times larger it stands than it
  was made.
  - **`thing`: a word off the shelves, nothing minted.** A vehicle the registry names (`sedan`, `city bus`,
    `motorcycle`, `helicopter`), a piece of furniture (`sofa`, `chesterfield`, `dining table`, `bookcase`) or a prop
    (`crate`, `barrel`, `planks`, `amphora`, `coffin`, `stones`, `boulder`). It stands at the size its shelf measures,
    so a vehicle needs no `scale`. A word no shelf has is refused with what the shelves have. Dress a set this way
    first: `props: { car: { thing: 'sedan', at: [3, 2], turn: 30 } }`.
  - **`ref`: anything mojulo made**, for a thing no shelf has.
  - **A thing that moves.** It ARRIVES: `from` (`[x, y]` or a mark's name) and `start?` (when it sets off; 0). It
    LEAVES: `to` and `leave?` (when; with none, as the last line begins, never before it has arrived). Both: it
    pulls up, waits, and goes. `speed?` is metres a second (a vehicle 6, anything else 1.4).
    - **A time is a second of the scene, or a line:** `{ line: 2 }` is as line 2 starts, `{ line: 2, at: 'end' }` as it
      ends. `car: { thing: 'sedan', at: [9.3, 50], from: [9.3, 6], start: { line: 1 }, to: [9.3, 68], leave: { line:
      4 } }` pulls up on the first line and drives on at the fourth.
    - **A route.** `from` and `to` take one point or a list of them, gone through in turn: `from: [[55, 9.3], [9.3,
      9.3]]` comes along one street and turns into the next. It faces along its way and turns into each corner. With
      no `turn` it rests facing the way it came in (or, only leaving, the way it goes); leaving, it turns to its way
      as it sets off.
    - The plan, the walks and the storyboard read it at its `at`; it moves in the Blender film, on the ground.
    - Not yet: a route found for it (along a street, round what stands); it is not kept off the cast or the set.
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

## The four forms (`export`), cheapest first

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
- `film`: the storyboard plus THE FILM, SHOT IN MOJULO (`mp4_path`, the motion's `motion.mp4`). The scene is played on
  its set's own World page and shot there by the same coverage. No other program runs. Minutes: about a minute for
  a hero, then the set's own page sets the pace: a city or a bare stage a few frames a second, a landscape a frame
  every few seconds (about a minute for each second of film). One forge shoots the whole scene; a film of scenes
  shoots within a budget and resumes (`film-studio`).
  - **The cast acts on the set.** Each actor is its hero playing the scene's take (the body's acting, the face on
    its lines), carried along its blocking. Actors who share a hero share one figure.
  - **What the world moves is in the picture**, with or without `life`: a city's traffic, its signals and its
    people, on the world's own clock (`life: { clock }` is the second the scene starts at).
  - **The sky is the world's own.** `weather` is performed by any world's page (its rain, its fog, its wet ground).
    `hour` and `clouds` are read by a set made as a geocube. On any other set they are said as advice
    (`native-unread`) and the set keeps its own light.
  - **The sound is the scene's:** its recorded lines the first audio track, each dub another, the captions beside
    them, as the animatic's are.
  - A scene with no set is played on a bare stage.
  - It is a motion like any other, so `stitch_motion` cuts several scenes' films into one. A film of scenes does this
    itself (`film: { ref, run: 'film' }`, the `film-studio` manual).
- `blender`: the storyboard plus the same film as a Blender pack: the high-end outcome, lit and rendered by
  Blender. Each actor is minted, which takes minutes, and the render is Blender's.

The stand-ins are drawn with a level eye: a high or low camera's tilt is drawn by moving the horizon, so those
frames are close but not exact.

## What comes back (film)

- `mp4_path`: the video, 1280 × 720 at the shot's `fps` (24).
- `film.shots`: each shot with a `still`, one frame of it a moment in. Look at these first.
- `film.cast`: what each part plays from and the figure it shares.
- `film.set.reads`: what of the scene's sky the set's page performed (`weather`, `hour`, `clouds`).
- `film.tracks`: the audio and subtitle tracks laid under it.
- `film.took`: the seconds each step took.
- `advice`: `native-unread` (what the scene asks that this film does not perform: its props, its wind, an hour or
  clouds on a set that is not a geocube) and `native-face` (a face that keeps its own blink: the anime face does not
  play its lines here yet). Each names the Blender film as what performs it.

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
  windows, with no door leaf, glass or finishes. Any other set, and every prop, is drawn as plain blocks at its heights: a car reads as a low box with a cabin, not as a car.
- A thing made in no real unit (a vehicle, for one) states no size: it is read as metres until the prop gives a `scale`.
- A house names no rooms as places yet: as a set, its cast is stood outside it.
- Marks are on the floor at the set's height under the lead's mark. A set of many levels is stood on that one floor.
- One scene per forge; a film of scenes cuts them (`film-studio`).
- The film shot in mojulo: the cast is drawn in its own light, not the set's, and casts no shadow on the ground;
  props are not stood in it; the anime face keeps its blink and does not play its lines; the wind is the world's own.
