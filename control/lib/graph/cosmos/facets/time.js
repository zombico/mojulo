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
 * the level's `game.on` maps it to a `setFlag`, and the store opens the gate that waits on it. Godot runs the cues on its
 * bus (kernel/bus.gd; scene/bus-abi.js says what it feeds and draws) and carries the store (kernel/store.gd): flag gates
 * and chapters travel. Quests, shots, banter and passage stay web-only until they are built.
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
 * Built 11-02 (the world clock): in play, a world's `tempo` moments fire on what happens (a blow, a foe down, the last foe
 * down, a dodge) and scale the world's step while the camera keeps real time (worlds/controllable/world-clock.js); a
 * game's tempo is laid on every level (gameworld/tempo.js), and a firing moment cues the live shoot plan's shot waiting on
 * it. Web only: Godot and Roblox step on real time. A replay in play waits on a recorded world clock.
 */
const CUES = 'lib/graph/playscape/ui/cues.js';
const QUEST_LOG = 'lib/graph/playscape/ui/quests.js';
const SCENES = 'lib/graph/playscape/ui/scenes.js';
const WEB = { godot: 'absent' };
// one change per package: quests (steps bound to a giver), the 3D shot
// Godot: the scenes and the journal travel (kernel/scenes.gd, quests.gd, the shot rule in kernel/rules.gd: III-d)
// Roblox: the scenes' beats and lines run (kernel/scenes.luau, quests.luau) as words; no shot directs Roblox's camera
const QUESTS = { status: 'partial', effort: 'M', pkg: 'quests', godot: 'built', roblox: 'approximated' };
const SHOT = { status: 'partial', effort: 'L', pkg: 'shot', godot: 'built' };
// the time map (11-02): built in a rendered film and a shoot plan's page; in play it waits on the world clock scale
const TIME_MAP = 'lib/graph/shoot/time.js';
const WORLD_CLOCK = 'lib/graph/worlds/controllable/world-clock.js';
const CLOCK = { status: 'built', lowers: WORLD_CLOCK, godot: 'absent', roblox: 'absent' };
const REPLAY = { status: 'partial', effort: 'M', pkg: 'replay', lowers: TIME_MAP, godot: 'absent', roblox: 'absent' };
const KEYED = { status: 'partial', effort: 'M', pkg: 'keying', lowers: TIME_MAP, godot: 'absent', roblox: 'absent' };
// a passage ages the world between chapters, so it is built on them (built: playscape/ui/chapters.js)
const AGED = { requires: ['time.chapters=overlays'], ...WEB };

export const TIME = Object.freeze({
  id: 'time',
  asks: 'when, and what moves it on?',
  settings: {
    progression: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built', note: 'one level' },
        linear: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/game/game-manifest.js', note: 'levels in play order; the shell records each completed' },
        gated: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/game/store-kernel.js', note: 'a gate on a completed level, or on a flag a cue sets through game.on; Godot carries the store (kernel/store.gd)' },
        // built 10-12: a game's `run` (the light shell): each run draws its levels from the pool in an order rolled from its
        // number, a death ends it, the store carries over, the deepest is kept; a quick game's run lays a pool of trails
        // Godot: kernel/game.gd draws a run with the web shell's own roll and keeps the deepest (III-c)
        runs: { status: 'built', godot: 'built', roblox: 'absent', lowers: 'lib/graph/game/play-shell.js', note: 'a pool of made levels (a quick game\'s run: trails each its own seed), drawn anew each run; a level is not rolled at play time' },
        // built 10-19 (the strategy board): a tactics book is travelled from its map, a diorama of dots
        map: { status: 'built', ...WEB, requires: ['space.board=spots'], lowers: 'lib/graph/board/board-map.js', note: 'a map level: a diorama with a dot a level, roads between, a dot open once the one before it is won; the party walks there and the game travels by the dot (the map mechanic); skirmishes to fight again' },
        // local 10-19 (mobile genres): the match-3 saga's map (a level a time, each a move budget for a goal, three stars)
        saga: { status: 'local', ...WEB, effort: 'M', lowers: 'lib/graph/pixelizer/philosophers-stone-saga.js', note: 'Stone Saga\'s map: levels generated from its seed, opened one at a time, three stars each kept in the browser; a world game\'s levels do not take stars or a map yet' },
      },
    },
    chapters: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built' },
        overlays: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/playscape/ui/chapters.js', note: 'play.chapters: a world difference turned by a happening, lowered to cues, carried between levels as a chapter flag; a menu presents the turn until shots exist' },
        // built 10-19 (the strategy board): FFT's shape, a book cut into chapters each travelled from its own map
        epochs: { status: 'built', ...WEB, requires: ['time.progression=map'], lowers: 'lib/graph/gameworld/board-levels.js', note: 'battles.board.epochs: a map each; an epoch\'s last stage leads to the next map, the party and bag carried; the final epoch\'s last stage the game\'s final, its map left open; begin and end story slots' },
      },
    },
    passage: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built' },
        // Godot (II6): night and the season's climate on the clock dial (kernel/weather.gd clock()), as the fog, colour and
        // light the kernel plays: approximated, as the weather is. Growth waits on crops' markers (built) and the clock.
        // built 10-12 (the world dial): a level's clock (game mechanic `clock`: minute, hour, day, season on the bus) is the
        // one number they read: the weather channel darkens the sky at night and swaps its climate by season; crops grow a
        // stage each dawn. A world's baked night (manifest.time) and a planting's age between chapters stay as they were.
        'day-night': { status: 'built', godot: 'approximated', lowers: 'lib/graph/game/mechanics.js', note: 'a level\'s clock: night darkens the sky and its air from 20:00 to 05:00, dusk and dawn two hours each (the weather channel); cues read hour' },
        seasons: { status: 'built', godot: 'approximated', lowers: 'lib/graph/game/mechanics.js', note: 'the clock\'s seasons (days each): season on the bus, the sky\'s climate swapped (spring-blossom, temperate, autumn, alpine, or its own four)' },
        growth: { status: 'built', godot: 'built', lowers: 'lib/graph/game/mechanics.js', note: 'crops grow a stage each dawn on the clock (planted, grown, ripe); a tree\'s planting age between chapters is still the bake\'s (grow.js years)' },
        // built 10-12: the aftermath mechanic keeps each break as a flag the game carries and restores it on entry
        aftermath: { status: 'built', ...WEB, lowers: 'lib/graph/game/mechanics.js', note: 'what broke stays broken: each break a flag (broke:<id>) the game carries, taken away at the start on entry (a gameworld with destruction); a chapter turning a whole level to ruin is not built' },
        eras: { status: 'absent', effort: 'L', ...AGED, note: 'no era dial: city eras are only a changelog plan on 1003-city-eras; lib/graph/era is art styles, historic one period per culture (priced 10-12)' },
      },
    },
    advance: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built' },
        // the cues run on the bus; what they do to the cast is drawn simpler (scene/bus-abi.js effect:cast, partial)
        cues: { status: 'built', godot: 'approximated', roblox: 'approximated', lowers: CUES, note: 'a happening moves play on: use, take, arrive, down, a var crossing a line; Godot runs them on its bus (kernel/bus.gd): zones, use, menus, the cast and the stats in; the HUD, menus, the cast and a forced sky out' },
        steps: { ...QUESTS, status: 'built', lowers: QUEST_LOG, note: 'a quest\'s steps in order, each done by a flag; the story\'s moments wait step by step (gameworld quests)' },
        quests: { ...QUESTS, status: 'built', requires: ['mind.social=talk'], lowers: QUEST_LOG, note: 'a giver (a moment\'s cast member; the player\'s answer begins it), a journal (J) and a word as it moves on; a reward is a cue on its flag' },
      },
    },
    // built 10-11 (the scene layer): playscape/ui/scenes.js plays a level's scenes, the camera's `shot` rule directs, the
    // page's runner paces lines and hands the camera back. Web only: Godot's bus carries no scenes yet.
    shots: {
      multi: true,
      values: {
        'in-world': { ...SHOT, roblox: 'absent', status: 'built', lowers: SCENES, note: 'a scene takes the camera (the shot rule), moves the cast and hands the camera back' },
        staged: { ...SHOT, roblox: 'approximated', status: 'built', lowers: SCENES, note: 'beats in order: shots, the cast, waits, lines; letterboxed, input held, skippable to its end state' },
        // banter rides the shot (10-11: the sweep paired them in worlds neither made alone): one package, one build
        banter: { ...SHOT, roblox: 'approximated', status: 'built', effort: 'S', lowers: SCENES, note: 'two talk: a two-shot, then a cut to whoever speaks, the line typed on; words are a slot; a portrait beside them on a board (shots board); no face set yet' },
        // built 10-19 (the strategy board): a scene told on the board itself, its slots before and after a battle
        // priced 10-25 (the comic hero pack): the comic panel, a shot held still with a border and a caption
        panel: { ...SHOT, ...WEB, status: 'absent', effort: 'S', pkg: 'comic-panel', requires: ['time.shots=staged'], note: 'a beat held as a still: the frame drawn in a border, a caption box, an onomatopoeia over the blow; cut back to play' },
        board: { ...SHOT, ...WEB, status: 'built', requires: ['space.board=spots'], lowers: 'lib/graph/board/board-page.js', note: 'the tactical camera cut to whoever the shot names, from the front; the words over the speaker; a speaking figure gestures; a close portrait beside (talk.portrait); a battle held for its before and after slots' },
      },
    },
    // the screen's clock over the world's (the time map): how fast the world plays on screen
    tempo: {
      multi: true,
      values: {
        'real-time': { status: 'built', godot: 'built', roblox: 'built', note: 'a screen second a world second' },
        slow: { ...CLOCK, note: 'the world slowed: offline a shot\'s time ({ span, speed }: a film, an actor scene, a shoot plan\'s page); in play a tempo moment ({ on, scale, hold }: the finisher, the kill cam) while the camera keeps real time' },
        ramp: { ...CLOCK, note: 'a speed ramp, eased down and back: offline time: { span, speed, ramp }; in play a moment\'s ramp' },
        freeze: { ...CLOCK, note: 'the world held: offline time: { at, hold } (the screenplay\'s Freeze.); in play a moment at scale 0 (impact: a heavy blow holds the world for a beat), beside the per-body hitstop' },
        bullet: { ...CLOCK, requires: ['time.tempo=slow'], note: 'the camera free while the world crawls: offline a shot\'s clock: \'screen\'; in play a dodge slows the world (tempo bullet), the camera on real time' },
      },
    },
    // the order and frequency of what the screen shows: the same world time again
    replay: {
      multi: true,
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built' },
        angles: { status: 'built', godot: 'absent', roblox: 'absent', lowers: 'lib/graph/shoot/plan.js', note: 'shots over the same span of the world: one action covered from several cameras, cut together' },
        replay: { ...REPLAY, note: 'a moment shown again, slowed, after it played (a shot over world time already shown, with a speed); a live world cannot rewind (liveNotes): in play it waits on a recorded world clock' },
      },
    },
    // the world's keying on screen: limited animation's ones, twos and threes
    grain: {
      values: {
        ones: { status: 'built', godot: 'built', roblox: 'built', note: 'the world on every frame' },
        twos: { ...KEYED, note: 'the world shown on twos, the camera on ones (a shot\'s grain); a rendered film and an actor scene; in play a body\'s clips run continuous (the face reads on twos, anime-read.js)' },
        threes: { ...KEYED, note: 'the world on threes, the camera on ones; as twos' },
        mixed: { status: 'absent', effort: 'M', pkg: 'keying', godot: 'absent', roblox: 'absent', note: 'characters on twos, the camera and the ground on ones, each layer its own grain: the map steps the whole world' },
      },
    },
    framing: { multi: true, source: { module: SCENES, table: 'SHOT_FRAMES', ...SHOT, godot: { all: 'built' }, roblox: { all: 'absent' }, status: 'built', note: 'the shot rule frames its subjects by these words' } },
  },
});
