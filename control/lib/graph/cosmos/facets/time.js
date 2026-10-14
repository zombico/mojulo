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
 */
const CUES = 'lib/graph/playscape/ui/cues.js';
const QUEST_LOG = 'lib/graph/playscape/ui/quests.js';
const SCENES = 'lib/graph/playscape/ui/scenes.js';
const WEB = { godot: 'absent' };
// one change per package: quests (steps bound to a giver), the 3D shot
const QUESTS = { status: 'partial', effort: 'M', pkg: 'quests', ...WEB };
const SHOT = { status: 'partial', effort: 'L', pkg: 'shot', ...WEB };
// a passage ages the world between chapters, so it is built on them (built: playscape/ui/chapters.js)
const AGED = { requires: ['time.chapters=overlays'], ...WEB };

export const TIME = Object.freeze({
  id: 'time',
  asks: 'when, and what moves it on?',
  settings: {
    progression: {
      values: {
        none: { status: 'built', godot: 'built', note: 'one level' },
        linear: { status: 'built', godot: 'built', lowers: 'lib/graph/game/game-manifest.js', note: 'levels in play order; the shell records each completed' },
        gated: { status: 'built', godot: 'built', lowers: 'lib/graph/game/store-kernel.js', note: 'a gate on a completed level, or on a flag a cue sets through game.on; Godot carries the store (kernel/store.gd)' },
        // built 10-12: a game's `run` (the light shell): each run draws its levels from the pool in an order rolled from its
        // number, a death ends it, the store carries over, the deepest is kept; a quick game's run lays a pool of trails
        runs: { status: 'built', ...WEB, lowers: 'lib/graph/game/play-shell.js', note: 'a pool of made levels (a quick game\'s run: trails each its own seed), drawn anew each run; a level is not rolled at play time' },
      },
    },
    chapters: {
      values: {
        none: { status: 'built', godot: 'built' },
        overlays: { status: 'built', godot: 'built', lowers: 'lib/graph/playscape/ui/chapters.js', note: 'play.chapters: a world difference turned by a happening, lowered to cues, carried between levels as a chapter flag; a menu presents the turn until shots exist' },
      },
    },
    passage: {
      values: {
        none: { status: 'built', godot: 'built' },
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
        none: { status: 'built', godot: 'built' },
        // the cues run on the bus; what they do to the cast is drawn simpler (scene/bus-abi.js effect:cast, partial)
        cues: { status: 'built', godot: 'approximated', lowers: CUES, note: 'a happening moves play on: use, take, arrive, down, a var crossing a line; Godot runs them on its bus (kernel/bus.gd): zones, use, menus, the cast and the stats in; the HUD, menus, the cast and a forced sky out' },
        steps: { ...QUESTS, status: 'built', lowers: QUEST_LOG, note: 'a quest\'s steps in order, each done by a flag; the story\'s moments wait step by step (gameworld quests)' },
        quests: { ...QUESTS, status: 'built', requires: ['mind.social=talk'], lowers: QUEST_LOG, note: 'a giver (a moment\'s cast member; the player\'s answer begins it), a journal (J) and a word as it moves on; a reward is a cue on its flag' },
      },
    },
    // built 10-11 (the scene layer): playscape/ui/scenes.js plays a level's scenes, the camera's `shot` rule directs, the
    // page's runner paces lines and hands the camera back. Web only: Godot's bus carries no scenes yet.
    shots: {
      multi: true,
      values: {
        'in-world': { ...SHOT, status: 'built', lowers: SCENES, note: 'a scene takes the camera (the shot rule), moves the cast and hands the camera back' },
        staged: { ...SHOT, status: 'built', lowers: SCENES, note: 'beats in order: shots, the cast, waits, lines; letterboxed, input held, skippable to its end state' },
        // banter rides the shot (10-11: the sweep paired them in worlds neither made alone): one package, one build
        banter: { ...SHOT, status: 'built', effort: 'S', lowers: SCENES, note: 'two talk: a two-shot, then a cut to whoever speaks, the line typed on; words are a slot; no portraits or face set yet' },
      },
    },
    framing: { multi: true, source: { module: SCENES, table: 'SHOT_FRAMES', ...SHOT, godot: { all: 'absent' }, status: 'built', note: 'the shot rule frames its subjects by these words' } },
  },
});
