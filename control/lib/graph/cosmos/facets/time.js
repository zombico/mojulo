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
const WEB = { godot: false };
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
        none: { status: 'built', note: 'one level' },
        linear: { status: 'built', lowers: 'lib/graph/game/game-manifest.js', note: 'levels in play order; the shell records each completed' },
        gated: { status: 'built', lowers: 'lib/graph/game/store-kernel.js', note: 'a gate on a completed level, or on a flag a cue sets through game.on; Godot carries the store (kernel/store.gd)' },
      },
    },
    chapters: {
      values: {
        none: { status: 'built' },
        overlays: { status: 'built', lowers: 'lib/graph/playscape/ui/chapters.js', note: 'play.chapters: a world difference turned by a happening, lowered to cues, carried between levels as a chapter flag; a menu presents the turn until shots exist' },
      },
    },
    passage: {
      values: {
        none: { status: 'built' },
        'day-night': { status: 'partial', effort: 'M', ...AGED, lowers: 'lib/graph/scene/sky-css.js', note: 'worlds pick day or night (manifest.time, sky presets, night style cards); no chapter or flag turns a level to its night bake (priced 10-12)' },
        seasons: { status: 'partial', effort: 'S', ...AGED, lowers: 'lib/graph/weather/weather.js', note: 'autumn and spring-blossom are climates; a chapter forces a weather state but cannot swap the climate (snow seasoning unmerged on 1003-city-eras)' },
        growth: { status: 'partial', effort: 'S', ...AGED, lowers: 'lib/graph/vegetation/grow.js', note: 'a tree grows by `years` (grow.js; the jungle hardcodes 22 to 24); no level or chapter sets its planting\'s age' },
        aftermath: { status: 'partial', effort: 'M', ...AGED, lowers: 'lib/graph/playscape/destruct/collapse.js', note: 'destruction runs live (a level\'s destruction degree); no chapter or flag records or restores a world\'s damage' },
        eras: { status: 'absent', effort: 'L', ...AGED, note: 'no era dial: city eras are only a changelog plan on 1003-city-eras; lib/graph/era is art styles, historic one period per culture (priced 10-12)' },
      },
    },
    advance: {
      values: {
        none: { status: 'built' },
        cues: { status: 'built', lowers: CUES, note: 'a happening moves play on: use, take, arrive, down, a var crossing a line; Godot runs them on its bus (kernel/bus.gd): zones, use, menus, the cast and the stats in; the HUD, menus, the cast and a forced sky out' },
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
    framing: { multi: true, source: { module: SCENES, table: 'SHOT_FRAMES', ...SHOT, status: 'built', note: 'the shot rule frames its subjects by these words' } },
  },
});
