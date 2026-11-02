### Game type layers: from a sentence to a game that plays as its type

The sentence door (`design_game({ compose: { prompt } })`) reads a genre and lays the same walks for most of them, while
the kernels that play each type sit behind other doors (a `quick` goal, a kit, the pixelizer). This theme makes the
door reach them, one layer at a time, measured on the door people use.

- **The yardstick: the door probes** (`lib/graph/gameworld/door-probes.js`). One probe a kernel family (race, shoot,
  defend, battle, contest, tabletop, pixel, platform, sneak, fly, seats, and a blocked type), never one a genre: a
  sentence a person says, the hillclimb genre it stands for, and the concept the made game must hold, read from what
  the run would make (`runner.js` `runSteps`: each level's `compose_world` order, nothing minted). Each probe records
  what the door makes `now`; when the probes landed every family's was `not`.
  - `door-probes.e2e.test.js` (the e2e tier) runs each sentence through `design_game`'s own `composedWorld` (exported for
    it) and the run's steps, and holds each probe to its `now`: a door that starts making a family's game, or stops,
    fails until the table says so.
  - `door-probes.test.js` holds each concept to the door that makes its family's game today (its `reference`, a book
    world or a quick goal) and against a bare walk, so a concept that could never hold is caught.
  - The hillclimb page's genre probes gain a **from a sentence** column beside the registry's verdict, read from the
    table (`npm run tool-surface`).
- **The door lays a genre's levels in its book form** (`lib/graph/gameworld/genre-forms.js`, read by `compose.js`). The
  quick door stays the one-level outcome door; a game sentence is laid as a book world, its levels in the form its
  kernel plays.
  - **Flight:** a flight sim, air combat or a space shooter is laid as airspace levels: a runway and a gate course, in
    a trainer, a jet or a space fighter (an asteroid field). No walk, no town. The brief says so (`brief.levelForm`).
  - **Hand-off:** a match-3 saga is said to be the pixelizer's (`create_pixelizer_game({ reducer: 'stone-saga' })`),
    and nothing is laid.
  - **Refusal:** a genre the registry cannot make yet (the cosmos dry run's verdict: co-op kitchen, party mash,
    split-screen deathmatch, driver and gunner, the co-op scroller) is refused with the values it waits on and the
    makeable genres the same words point at. Nothing is laid in its place; it used to be laid as single-player walks.
  - The genres the book lays in its own walks and buildings are laid as before.
  - **Racing waits on the vehicle registry's ride.** A runner, stealth and the seats wait on phase 2's hero.
- **A genre's own name is a clear read on its own** (`intent.js` `readGenre`): "metroidvania", "tennis" or "tower
  defence" said once writes the genre, ahead of another genre's plain words. Plain words still need two, and two
  genres' names said alike are a tie. "stealth guards and a race with cars" reads as stealth now.
- The fly, pixel and blocked probes hold (`now: 'type'`). The fly probe's reference is a book world. The hillclimb
  column says "refused" and "handed off" where that is the right answer.
- **A genre the book cannot lay from a sentence yet is refused until its form lands** (`genre-forms.js` `PENDING`), not
  laid as walks. Each refusal says what it waits on and the one level it plays alone today (`design_game({ quick: { goal } })`):
  - racing and kart racing: a ride the book drives
  - the shooters and the brawlers: the hero's weapon
  - tower defence, RTS, tactics, farming, rhythm, roguelike, the puzzles, the versus fighter and the sports: the
    kernel as a book level
  - the endless runner and the city stalker: a hero by default and their level form
  - Laid as before: the genres of the book's own walks and buildings (dungeon crawler, collectathon, top-down adventure,
    metroidvania, survival horror, story), and the ones a hero completes (stealth's guards, a co-op platformer's side
    camera and seats, a party's battles).
- **A genre on foot is laid with a hero, its camera and its screen** (`genre-forms.js` `heroFrameOf`, read by
  `compose.js`). Where the genre's cube asks a hero, the sentence's world has one, said in the brief (`brief.hero`):
  - its body the game's (`characters.direction.body: 'game'`, the body rails) in the world's own tradition, moving
    by the genre's vibe;
  - no powers, said: `actions: { none: true }`, an answer the actions page now takes (no system, idiom or
    progression; nothing open), so an autonomous run makes the hero and then its levels in one call;
  - the camera the cube asks (side for a metroidvania or a co-op platformer, fixed for survival horror; third person
    is the hero's own chase), with no climbs under a side camera and no side-scroller laid indoors;
  - a monitor's screen (16:9), except a runner's phone.
  A dungeon crawler, a collectathon, a metroidvania, survival horror, stealth, a party's battles and a co-op
  platformer's seats are now played by a body from their sentence, not by a bodiless first-person walker.
- **The endless runner and the city stalker are laid in their forms with that hero**: runner levels, and city levels
  played by the stalker with the wall and the line (`moves: ['wall', 'swinger']`). They are no longer refused.
- **A building level takes the world's camera**: top-down plays its rooms under the overhead camera, moving in the
  screen's frame; fixed stands a camera over each room; a side camera is refused there (no lane). Absent, the chase as
  before.
- **A city level carries the world's screen** (`city/plan/card.js` takes `screen` as a world channel); a city level
  with one was refused.
- **A guard holds a post it cannot see the start from** (`quick.js` `guardPosts`): guards stand only on the beats past a
  guard's sight from the spawn (its narrow beam, 14 m, and a step), where the way has any. On a short way the first
  guard faced the spawn from inside its beam, and the level was lost before the hero moved. A way whose beats all lie
  within it is posted as before.
- The battle, platform, sneak and seats probes hold. The battle probe reads a battle or a party's encounters (a level's
  bag is a play block too).
