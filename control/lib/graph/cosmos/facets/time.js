/**
 * TIME: the same world at a later point, and what moves it there. Shape as in reality.js.
 *
 * Story here is not text. It is progression: a world STATE (chapters, and the `passage` that aged the world between
 * them), the ADVANCE that moves play from one state to the next (a happening, a step, a quest), and the SHOT that
 * presents the move (a directed camera, its subjects, a background and a text box). A line is a slot,
 * `{ who, expression?, shot?, voice? }`, that the operator or another tool fills; mojulo supplies the speaker, the box,
 * the advance and the camera, never the words. Placeholder lines (`[Mayor: greeting]`) keep a story game playable.
 *
 * The camera you play through is Space's (`space.camera`); the camera that directs is Time's (`shots`, `framing`).
 * They hand off.
 *
 * Sized 10-11; chapters built 10-11 (playscape/ui/chapters.js). What exists: playscape cues (when → then) and menus
 * (`talk`, and `list` for a quest log), the cast's walks and spots (pose `talk`), stats epochs, the game store's level
 * gates, the tutorial step director, the pixelizer cutscene (a camera track, layers and typewriter captions, pixel
 * only) and the motion comic (click-gated scenes, type-on subtitles: time is the click). Flags carry a fact between levels by composition: a cue emits a bus event,
 * the level's `game.on` maps it to a `setFlag`, and the store opens the gate that waits on it.
 *
 * Built 10-12 (the story cascade's step 3): choices (a scene's `choose` beat sets flags and branches) and quests
 * (playscape/ui/quests.js: ordered steps done by flags, a journal, a word as one moves on; gameworld `quests` gate the
 * story's moments step by step, so the giver is a moment's cast member). Web only.
 *
 * Built 11-02 (the time map): Time is also the camera's clock. A shot shows the world's time on the screen's (shoot/time.js:
 * a stretch slowed and ramped, an instant held, the camera on the screen's clock while the world holds, the world on
 * twos), one map every channel of a rendered film reads: the shoot plan's cameras and world, a scene's actors, the
 * Blender pack. `tempo`, `replay` and `grain` say it.
 *
 * Built 11-04 (the main quest, gameworld/main-quest.js): the game's ARC, its acts (a beginning, a middle and an end) or
 * its chapters past an arc, a beat a time; the PERIODS it spans; how loose its SIDES are. A world's main quest sets them
 * in its cube (gameworld/intent.js cubeOfWorld), so its verdict says what a long game still waits on.
 *
 * Built 11-02 (the world clock): in play, a world's `tempo` moments fire on what happens (a blow, a foe down, the last foe
 * down, a dodge) and scale the world's step while the camera keeps real time (worlds/controllable/world-clock.js); a
 * game's tempo is laid on every level (gameworld/tempo.js), and a firing moment cues the live shoot plan's shot waiting on
 * it. Web only: Godot and Roblox step on real time. A replay in play waits on a recorded world clock.
 *
 * Built 11-09 (the flow runner, game/flow.js): the game's SEQUENCE, from the first screen to the credits, one thing the
 * play shell runs (`sequence`): Time sequencing over Space's graph, its level steps, doors and travel Space's links. And
 * screenplay scenes (playscape/ui/scene-script.js): a scene's shots chosen by the director's coverage (`shots: covered`),
 * its slow motion and freezes on the world clock (the scene fires `tempo`), its cast acting it (Soul's `acting`). Space
 * stays the stage; Time is the track the beats run on: what a world carries on (consequence) is Time's, how worlds join
 * (reachability) Space's. Still open: the world held through a cinematic (`sequence: held`).
 *
 * Built 11-13 (a game starts in play): the flow's `cutscene` step, a sequence made elsewhere and played whole, and a
 * gameworld's `flow: 'play'`, the default flow begun at that cutscene and straight into the game (`sequence: cutscene`,
 * `in-play`); a cutscene may be a film the animation studio made to the game's order (`sequence: film`). Built 11-14 (the game turn, game/turn.js): a level step is a turn, what the player picks before it loads,
 * the load, play, the pause, the results (`sequence: turn`). And what a world keeps to be read, never a mechanic
 * (`lore`, 11-10): its backdrop, the setting's lore before play as its text has it (lorecube/backdrop.js: it feeds the
 * pre-game, a place's starting state and what the cast remembers), and a level's library, publications on a shelf
 * (playscape/ui/library.js).
 */
const CUES = 'lib/graph/playscape/ui/cues.js';
const QUEST_LOG = 'lib/graph/playscape/ui/quests.js';
const SCENES = 'lib/graph/playscape/ui/scenes.js';
// one change per package: quests (steps bound to a giver), the 3D shot
const QUESTS = { status: 'partial', effort: 'M', pkg: 'quests' };
const SHOT = { status: 'partial', effort: 'L', pkg: 'shot' };
// the time map (11-02): built in a rendered film and a shoot plan's page; in play it waits on the world clock scale
const TIME_MAP = 'lib/graph/shoot/time.js';
const WORLD_CLOCK = 'lib/graph/worlds/controllable/world-clock.js';
const CLOCK = { status: 'built', since: '2026-11-02', lowers: WORLD_CLOCK };
const REPLAY = { status: 'partial', effort: 'M', pkg: 'replay', lowers: TIME_MAP };
// keying in play (11-23): a level's bodies posed on their layer's key, the world and the camera on ones
const KEYED = { status: 'built', since: '2026-11-23', lowers: 'lib/graph/worlds/controllable/keying.js' };
// the main quest (11-04): a chapter's turn waits on its overlay; side quests placed by the quest wait on their package
const MAIN_QUEST = 'lib/graph/gameworld/main-quest-lay.js';
const QUEST_TURNS = { status: 'partial', effort: 'M', pkg: 'quest-turns' };
const SIDES = { status: 'partial', effort: 'M', pkg: 'side-quests', lowers: 'lib/graph/gameworld/main-quest.js' };
// a passage ages the world between chapters, so it is built on them (built: playscape/ui/chapters.js)
const AGED = { requires: ['time.chapters=overlays'] };

export const TIME = Object.freeze({
  id: 'time',
  asks: 'when, and what moves it on?',
  settings: {
    progression: {
      values: {
        none: { status: 'built', note: 'one level' },
        linear: { status: 'built', lowers: 'lib/graph/game/game-manifest.js', note: 'levels in play order; the shell records each completed' },
        gated: { status: 'built', lowers: 'lib/graph/game/store-kernel.js', note: 'a gate on a completed level, or on a flag a cue sets through game.on' },
        // built 10-12: a game's `run` (the light shell): each run draws its levels from the pool in an order rolled from its
        // number, a death ends it, the store carries over, the deepest is kept; a quick game's run lays a pool of trails
        runs: { status: 'built', lowers: 'lib/graph/game/play-shell.js', note: 'a pool of made levels (a quick game\'s run: trails each its own seed), drawn anew each run; a level is not rolled at play time' },
        // built 10-19 (the strategy board): a tactics book is travelled from its map, a diorama of dots
        map: { status: 'built', requires: ['space.board=spots'], lowers: 'lib/graph/board/board-map.js', note: 'a map level: a diorama with a dot a level, roads between, a dot open once the one before it is won; the party walks there and the game travels by the dot (the map mechanic); skirmishes to fight again' },
        // local 10-19 (mobile genres): the match-3 saga's map (a level a time, each a move budget for a goal, three stars)
        saga: { status: 'local', effort: 'M', lowers: 'lib/graph/pixelizer/philosophers-stone-saga.js', note: 'Stone Saga\'s map: levels generated from its seed, opened one at a time, three stars each kept in the browser; a world game\'s levels do not take stars or a map yet' },
      },
    },
    // built 11-09 (the flow runner, game/flow.js): the game's whole order, from the first screen to the credits, run by the
    // play shell's flow runner; Time sequencing over Space's graph (a level step, a door, a travel are Space's links)
    sequence: {
      multi: true,
      values: {
        screens: { status: 'built', lowers: 'lib/graph/game/play-shell.js', note: 'the order the shell has always made: its title, its levels, a result, the end card (game/flow.js defaultFlow), stepped on events, never timers' },
        own: { status: 'built', since: '2026-11-09', lowers: 'lib/graph/game/flow.js', note: 'a game\'s own flow: screens, cinematics, levels and holds, each left by what the player picks, its outcome or its idle, with guarded alternatives (complete, unseen); how it starts (cutscene, in-play) and what a level step asks (turn) are values of their own' },
        cinematics: { status: 'built', since: '2026-11-09', requires: ['time.shots=staged'], lowers: 'lib/graph/gameworld/story.js', note: 'a cinematic step staged on a level\'s page; the story\'s opening (first boot, the attract), prologue (after New Game, kept into play) and ending (the first full clear) placed in the flow' },
        held: { status: 'partial', effort: 'M', requires: ['time.sequence=cinematics'], lowers: 'lib/graph/worlds/controllable/world-clock.js', note: 'the world held through a cinematic, its foes and hazards still while the scene\'s cast and camera move: the world freeze stops the clock the scene runs on, so it waits on a narrower freeze (the opening cutscene of a game that starts in play runs before play, not over a held world)' },
        // built 11-13 (a game starts in play): the cutscene step, a sequence made elsewhere and played whole, and a
        // gameworld's `flow: 'play'` (flow.js startInPlay): the default flow begun at its opening cutscene and straight into
        // the game, the title only where quitting goes back to
        cutscene: { status: 'built', since: '2026-11-13', lowers: 'lib/graph/game/flow.js', note: 'a cutscene step: a sequence made elsewhere and played whole, a video over the shell or a directed scene staged as a cinematic is, skipped by a key or a tap once it has been up a moment; with neither, the slot holds its place and is passed at once; a bare video is an address the page can reach; one that is a film\'s is found and carried by the game (sequence: film)' },
        'in-play': { status: 'built', since: '2026-11-13', requires: ['time.sequence=cutscene'], lowers: 'lib/graph/gameworld/game-flow.js', note: 'a world\'s flow: play: the game starts in play, its opening a cutscene (the story\'s opening moment where it has one, else the empty slot), then the save\'s level, else the first, with no attract, title or prologue before it; the title stays, where quitting goes; what the sentence door writes' },
        // built 11-13 (the animation studio, film/; game/flow-films.js): a cutscene that is a FILM, made to the game's order
        // (film/order.js: the game studio hands over its characters, its places and its notes on each event, and the film
        // is handed back). The flow keeps the film's ref, so the cutscene made again is the one that plays. The order is a
        // rail between two studios, not a value; what a game can ask for is the film in its flow
        film: { status: 'built', since: '2026-11-13', lowers: 'lib/graph/game/flow-films.js', note: 'a cutscene that is a film of the animation studio\'s, named by its ref as the game\'s opening, prologue, ending or any cinematic step: its video plays over the game and can be skipped, is found each time the game is served or exported (an exported game carries it), and a film with no video yet is passed over, the export saying which' },
        'moment-film': { status: 'partial', effort: 'M', requires: ['time.sequence=film', 'time.sequence=cinematics'], lowers: 'lib/graph/film/order.js', note: 'a story moment filmed to order: the animation studio takes a cutscene order (the cast, the places, notes on each event; an event with notes only waits on its script) and hands the film back with how far each event has got; the game studio fills the order in by hand: naming a story moment does not fill it, and a cutscene cannot yet take a moment\'s place by its name' },
        // built 11-14 (the game turn, game/turn.js; a world's set-up, gameworld/setup.js): one level session in phases, the
        // one path a play-shell game's levels share. The arena shell and versus still keep their own set-up
        turn: { status: 'built', since: '2026-11-14', lowers: 'lib/graph/game/turn.js', note: 'a level step is a turn: what the player picks before it loads (a world\'s setup: difficulty in the engine\'s tiers, picks from the game\'s own options or a slice the level consumes, asked before every level or kept for the game), the load, play, the pause, the results, a scene or a video as play starts and as it ends; the picks drawn by mana-ui, a retry keeping them; the arena shell and versus keep their own set-up, and an end trigger that is a scene, a locked row and a quit recorded are not yet' },
      },
    },
    // what a world keeps to be read (11-10: the lorecube's backdrop, lorecube/backdrop.js; publications, publication/):
    // the setting's lore before play, extracted from its text and never authored, kept on the game and handed to its
    // book chapter by chapter; and books on a shelf in a level, the same pages that print. Neither is a mechanic
    lore: {
      multi: true,
      values: {
        none: { status: 'built', note: 'a world with no history said and nothing to read' },
        backdrop: { status: 'built', since: '2026-11-10', lowers: 'lib/graph/lorecube/backdrop.js', note: 'a gameworld\'s backdrop: the setting\'s lore as its text has it (who is in it, what happened in order and from what, how the world stands where the text stops, what each side wants and believes, what is open or unsaid), each reading with its basis, more added in later drops; shown in the game book, each chapter handed its own part (the world the places, the cast the people, the story what happened before play, the main quest the open conflicts); it feeds the story\'s timing and the world\'s starting state, never a mechanic' },
        library: { status: 'partial', effort: 'M', lowers: 'lib/graph/playscape/ui/library.js', note: 'a level\'s shelf of books (play.library: a grimoire, a bestiary, a manual, a notebook, a comic), each there from the start or found on a flag, opened with L and turned a spread at a time, its pages the ones that print; written into a level\'s recipe: a designed gameworld has no word for it, no door mints a publication, and a book is found by a flag, not as a thing in the world' },
      },
    },
    chapters: {
      values: {
        none: { status: 'built' },
        overlays: { status: 'built', lowers: 'lib/graph/playscape/ui/chapters.js', note: 'play.chapters: a world difference turned by a happening, lowered to cues, carried between levels as a chapter flag; a menu presents the turn until shots exist' },
        // built 10-19 (the strategy board): FFT's shape, a book cut into chapters each travelled from its own map
        epochs: { status: 'built', requires: ['time.progression=map'], lowers: 'lib/graph/gameworld/board-levels.js', note: 'battles.board.epochs: a map each; an epoch\'s last stage leads to the next map, the party and bag carried; the final epoch\'s last stage the game\'s final, its map left open; begin and end story slots' },
      },
    },
    passage: {
      values: {
        none: { status: 'built' },
        // built 10-12 (the world dial): a level's clock (game mechanic `clock`: minute, hour, day, season on the bus) is the
        // one number they read: the weather channel darkens the sky at night and swaps its climate by season; crops grow a
        // stage each dawn. A world's baked night (manifest.time) and a planting's age between chapters stay as they were.
        'day-night': { status: 'built', lowers: 'lib/graph/game/mechanics.js', note: 'a level\'s clock: night darkens the sky and its air from 20:00 to 05:00, dusk and dawn two hours each (the weather channel); cues read hour' },
        seasons: { status: 'built', lowers: 'lib/graph/game/mechanics.js', note: 'the clock\'s seasons (days each): season on the bus, the sky\'s climate swapped (spring-blossom, temperate, autumn, alpine, or its own four)' },
        growth: { status: 'built', lowers: 'lib/graph/game/mechanics.js', note: 'crops grow a stage each dawn on the clock (planted, grown, ripe); a tree\'s planting age between chapters is still the bake\'s (grow.js years)' },
        // built 10-12: the aftermath mechanic keeps each break as a flag the game carries and restores it on entry
        aftermath: { status: 'built', lowers: 'lib/graph/game/mechanics.js', note: 'what broke stays broken: each break a flag (broke:<id>) the game carries, taken away at the start on entry (a gameworld with destruction); a map that may not change still shows its blows (mechanics.scars: craters, scorches and chips painted, debris thrown); a chapter turning a whole level to ruin is not built' },
        eras: { status: 'absent', effort: 'L', ...AGED, note: 'no era dial: city eras are only a changelog plan on 1003-city-eras; lib/graph/era is art styles, historic one period per culture (priced 10-12)' },
      },
    },
    advance: {
      values: {
        none: { status: 'built' },
        cues: { status: 'built', lowers: CUES, note: 'a happening moves play on: use, take, arrive, down, a var crossing a line' },
        steps: { ...QUESTS, status: 'built', lowers: QUEST_LOG, note: 'a quest\'s steps in order, each done by a flag; the story\'s moments wait step by step (gameworld quests)' },
        quests: { ...QUESTS, status: 'built', requires: ['mind.social=talk'], lowers: QUEST_LOG, note: 'a giver (a moment\'s cast member; the player\'s answer begins it), a journal (J) and a word as it moves on; a reward is a cue on its flag' },
      },
    },
    // built 11-04 (the main quest): the game's spine, its beginning, middle and end, or its chapters past an arc; a beat
    // a time, each played on a level, a goal-only beat laid its own (gameworld/main-quest.js, main-quest-lay.js)
    arc: {
      values: {
        none: { status: 'built', note: 'no spine: a game of levels in play order' },
        acts: { status: 'built', since: '2026-11-04', lowers: MAIN_QUEST, note: 'a main quest\'s acts, a beginning, a middle and an end, a beat at a time: each beat played on its level, a goal-only beat laid its own, the game in the quest\'s order; an act a stage of the hero\'s progression' },
        chapters: { ...QUEST_TURNS, requires: ['time.chapters=overlays'], lowers: MAIN_QUEST, note: 'a main quest told chapter on chapter, past an arc: read and laid as acts are; a chapter\'s turn (what a happening changes) is said, not yet lowered to its world overlay' },
      },
    },
    // the times a main quest spans: one, a period on maps of its own, or the same maps at another period (eras)
    periods: {
      values: {
        one: { status: 'built', note: 'the quest in one time' },
        'new-maps': { status: 'built', since: '2026-11-04', lowers: MAIN_QUEST, note: 'a period a part of the quest on levels of its own: each beat its own level' },
        'same-maps': { status: 'absent', effort: 'L', requires: ['time.passage=eras'], note: 'the same maps at another period: a world aged between periods waits on eras' },
      },
    },
    // how far a main quest's side quests stand from its path
    sides: {
      values: {
        none: { status: 'built', note: 'the main path alone' },
        tight: { ...SIDES, requires: ['time.advance=quests'], note: 'side quests that branch from the path\'s beats: the main quest records it; nothing yet hangs a side quest on a beat' },
        loose: { ...SIDES, requires: ['time.advance=quests'], note: 'side quests near the path: the quest open world\'s quests (after) and the errands lay them; nothing yet places one by the quest' },
        free: { ...SIDES, requires: ['time.advance=quests', 'space.topology=open'], note: 'side quests anywhere on the map: an open world\'s own' },
      },
    },
    // built 10-11 (the scene layer): playscape/ui/scenes.js plays a level's scenes, the camera's `shot` rule directs, the
    // page's runner paces lines and hands the camera back.
    shots: {
      multi: true,
      values: {
        'in-world': { ...SHOT, status: 'built', lowers: SCENES, note: 'a scene takes the camera (the shot rule), moves the cast and hands the camera back' },
        staged: { ...SHOT, status: 'built', lowers: SCENES, note: 'beats in order: shots, the cast, waits, lines; letterboxed, input held, skippable to its end state' },
        // banter rides the shot (10-11: the sweep paired them in worlds neither made alone): one package, one build
        banter: { ...SHOT, status: 'built', effort: 'S', lowers: SCENES, note: 'two talk: a two-shot, then a cut to whoever speaks, the line typed on; words are a slot; a portrait beside them on a board (shots board); no face set yet' },
        // built 11-09 (screenplay scenes): a scene written as a screenplay, blocked on the level's places and covered by the
        // cinematics department's rules (actor/coverage.js), lowered into the staged beats
        covered: { ...SHOT, status: 'built', since: '2026-11-09', requires: ['time.shots=staged'], lowers: 'lib/graph/playscape/ui/scene-script.js', note: 'a screenplay blocked on the level\'s places and shot by the director\'s coverage: a wide to open, over the shoulder, close on a line with a face, the wide on a cross, one side of the line; the hero walks to its mark; each line on its take\'s clock, held for the press' },
        // built 11-02 (the impact cam): a moment of the world clock takes the camera and the look as it takes the clock
        moment: { ...SHOT, status: 'built', since: '2026-11-02', requires: ['time.tempo=slow'], lowers: WORLD_CLOCK, note: 'a tempo moment takes the camera and the look with the clock (world-clock.js cam, look): the finisher\'s push in, the kill cam, a heavy blow\'s impact frame, a dodge\'s bullet time, each handed back as the clock returns; a game\'s tempo lays them on every level' },
        // built 10-19 (the strategy board): a scene told on the board itself, its slots before and after a battle
        // priced 10-25 (the comic hero pack): the comic panel, a shot held still with a border and a caption
        panel: { ...SHOT, status: 'absent', effort: 'S', pkg: 'comic-panel', requires: ['time.shots=staged'], note: 'a beat held as a still: the frame drawn in a border, a caption box, an onomatopoeia over the blow; cut back to play' },
        board: { ...SHOT, status: 'built', requires: ['space.board=spots'], lowers: 'lib/graph/board/board-page.js', note: 'the tactical camera cut to whoever the shot names, from the front; the words over the speaker; a speaking figure gestures; a close portrait beside (talk.portrait); a battle held for its before and after slots' },
      },
    },
    // the screen's clock over the world's (the time map): how fast the world plays on screen
    tempo: {
      multi: true,
      values: {
        'real-time': { status: 'built', note: 'a screen second a world second' },
        slow: { ...CLOCK, note: 'the world slowed: offline a shot\'s time ({ span, speed }: a film, an actor scene, a shoot plan\'s page); in play a tempo moment ({ on, scale, hold }: the finisher, the kill cam) while the camera keeps real time; a scene\'s script fires it (scenes.js tempo beats: Slow motion until Real time, Freeze n)' },
        ramp: { ...CLOCK, note: 'a speed ramp, eased down and back: offline time: { span, speed, ramp }; in play a moment\'s ramp' },
        freeze: { ...CLOCK, note: 'the world held: offline time: { at, hold } (the screenplay\'s Freeze.); in play a moment at scale 0 (impact: a heavy blow holds the world for a beat), beside the per-body hitstop; a scene\'s script fires it (scenes.js tempo beats: Slow motion until Real time, Freeze n)' },
        bullet: { ...CLOCK, requires: ['time.tempo=slow'], note: 'the camera free while the world crawls: offline a shot\'s clock: \'screen\'; in play a dodge slows the world (tempo bullet), the camera on real time' },
      },
    },
    // the order and frequency of what the screen shows: the same world time again
    replay: {
      multi: true,
      values: {
        none: { status: 'built' },
        angles: { status: 'built', lowers: 'lib/graph/shoot/plan.js', note: 'shots over the same span of the world: one action covered from several cameras, cut together' },
        replay: { ...REPLAY, note: 'a moment shown again, slowed, after it played (a shot over world time already shown, with a speed); a live world cannot rewind (liveNotes): in play it waits on a recorded world clock' },
      },
    },
    // the world's keying on screen: limited animation's ones, twos and threes
    grain: {
      values: {
        ones: { status: 'built', note: 'the world on every frame' },
        twos: { ...KEYED, note: 'the world shown on twos, the camera on ones: offline a shot\'s grain (a rendered film, an actor scene); in play a level\'s keying, each animated body posed twelve times a second and held between, its place on ones (a world\'s `keying`, \'auto\' on the cel look)' },
        threes: { ...KEYED, note: 'the world on threes, the camera on ones; as twos, eight poses a second' },
        mixed: { ...KEYED, note: 'each layer its own grain: in play a level\'s keying by layer ({ hero, cast }: the hero on ones and the cast on twos, or both on threes), the camera, the ground and the effects on ones' },
      },
    },
    framing: { multi: true, source: { module: SCENES, table: 'SHOT_FRAMES', ...SHOT, status: 'built', note: 'the shot rule frames its subjects by these words' } },
  },
});
