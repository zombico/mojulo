/**
 * TIME: the story, and how the game changes as it goes. Shape as in reality.js.
 *
 * A STUB (10-10): no time or story game has been built. What exists is plumbing, recorded here honestly so the
 * dry run reads it. This facet is built on its own branch; that branch owns this file and may rename or add settings.
 * The closest seed in the tree is the tutorial step director (worlds/controllable/tutorial.js): ordered steps whose
 * goals are edge-detected facts, effects on entry, optional bonus phases.
 */
export const TIME = Object.freeze({
  id: 'time',
  asks: 'when, and why does it change?',
  settings: {
    progression: {
      values: {
        none: { status: 'built' },
        linear: { status: 'partial', lowers: 'lib/graph/game/game-manifest.js', note: 'levels run in order; no progression model' },
        gated: { status: 'partial', lowers: 'lib/graph/game/game-manifest.js', note: 'level gates on completed or flag; no progression model' },
      },
    },
    stages: { source: { module: 'lib/graph/gameworld/actions.js', table: 'STAGES', status: 'partial', note: 'early, mid and late order the actions; no stage changes the game' } },
    objectives: {
      values: {
        none: { status: 'built' },
        steps: { status: 'partial', lowers: 'lib/graph/worlds/controllable/tutorial.js', note: 'the tutorial step director: the seed for quests' },
      },
    },
    story: {
      values: {
        none: { status: 'built' },
        beats: { status: 'absent' },
        quests: { status: 'absent' },
      },
    },
    flags: {
      values: {
        none: { status: 'built' },
        flags: { status: 'partial', lowers: 'lib/graph/game/store-kernel.js', note: 'the store has a flags slice; nothing writes story state' },
      },
    },
    cutscenes: {
      values: {
        none: { status: 'built' },
        scripted: { status: 'partial', lowers: 'lib/graph/pixelizer/cutscene.js', note: 'pixelizer cutscenes only' },
      },
    },
  },
});
