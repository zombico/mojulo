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
 * the level's `game.on` maps it to a `setFlag`, and the store opens the gate that waits on it. Godot: cues stay on the
 * web and flag gates export as unlocked, so only linear progression survives an export.
 */
const CUES = 'lib/graph/playscape/ui/cues.js';
const MENUS = 'lib/graph/playscape/ui/menus.js';
const COMIC = 'lib/graph/motion-comic/motion-comic-manifest.js';
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
        gated: { status: 'built', ...WEB, lowers: 'lib/graph/game/store-kernel.js', note: 'a gate on a completed level, or on a flag a cue sets through game.on; no test runs the flag chain end to end' },
      },
    },
    chapters: {
      values: {
        none: { status: 'built' },
        overlays: { status: 'built', ...WEB, lowers: 'lib/graph/playscape/ui/chapters.js', note: 'play.chapters: a world difference turned by a happening, lowered to cues, carried between levels as a chapter flag; a menu presents the turn until shots exist' },
      },
    },
    passage: {
      values: {
        none: { status: 'built' },
        'day-night': { status: 'absent', effort: 'M', ...AGED, note: 'no time of day anywhere: the sky has weather, not hours' },
        seasons: { status: 'partial', effort: 'S', ...AGED, lowers: 'lib/graph/weather/weather.js', note: 'autumn and spring-blossom are climates of their own; nothing turns one world through them (snow seasoning is on the unmerged city-eras branch)' },
        growth: { status: 'partial', effort: 'S', ...AGED, lowers: 'lib/graph/vegetation/grow.js', note: 'a tree grows by `years`; no world ages its planting' },
        aftermath: { status: 'partial', effort: 'M', ...AGED, lowers: 'lib/graph/playscape/destruct/collapse.js', note: 'destruction happens live in play; no recipe records a world\'s damage as a state' },
        eras: { status: 'absent', effort: 'M', ...AGED, note: 'city eras live on the unmerged 1003-city-eras branch' },
      },
    },
    advance: {
      values: {
        none: { status: 'built' },
        cues: { status: 'built', lowers: CUES, ...WEB, note: 'a happening moves play on: use, take, arrive, down, a var crossing a line' },
        steps: { ...QUESTS, status: 'local', lowers: 'lib/graph/worlds/controllable/tutorial.js', note: 'the tutorial director orders steps, but its facts are arena maneuvers; playscape cues have no order' },
        quests: { ...QUESTS, requires: ['mind.social=talk'], lowers: MENUS, note: 'a giver (a talk menu), a log (a list menu) and a reward (cue effects) exist apart; nothing binds them to a character' },
      },
    },
    shots: {
      multi: true,
      values: {
        'in-world': { ...SHOT, lowers: 'lib/graph/playscape/ui/cast.js', note: 'the cast walks to its marks and poses; the camera cannot be taken over' },
        staged: { ...SHOT, lowers: 'lib/graph/pixelizer/cutscene.js', note: 'the grammar exists twice, neither in 3D: the pixel cutscene (cuts, a camera track, captions) and the click-gated motion comic' },
        banter: { status: 'partial', effort: 'S', ...WEB, lowers: COMIC, note: 'the motion comic steps a screen by the click with type-on subtitles, and a talk menu names who speaks; no two-up portrait screen in a game, no expression set' },
      },
    },
    framing: { multi: true, source: { module: 'lib/graph/era/floormap-cameras.js', table: 'SHOTS', ...SHOT, note: 'the floormap places these per region as fixed cameras; no shot directs them' } },
  },
});
