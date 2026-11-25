// A STORY IN A BUILDING (story.js bindStory, levels.js buildingSpots): a moment binds to a building's stage, its places
// its way in, its goal room, its boss's spot and its rooms on the way, so a citadel keeps its ending and a moment in a
// room; the game's flow stages the ending on the building's page
import { describe, it, expect } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { buildingSpots } from './levels.js';

const line = (say) => ({ line: { who: 'hero', say } });

describe('a story in a building', () => {
  it('its places: the way in, the goal room, the boss\'s spot, its rooms by order and by name', () => {
    const ends = { spawn: [0, 0, 0], exit: [9, 9, 1.7], beats: [{ beat: 'hall', at: [3, 3, 0] }, { beat: 'gate/cell-1', at: [6, 6, 0] }] };
    Object.defineProperty(ends, 'bossAt', { value: [9, 8, 0], enumerable: false });
    expect(buildingSpots(ends)).toEqual([{ id: 'start', at: [0, 0, 0] }, { id: 'exit', at: [9, 8, 0] }, { id: 'goal', at: [9, 8, 0] }, { id: 'boss', at: [9, 8, 0] },
      { id: 'room', at: [3, 3, 0] }, { id: 'hall', at: [3, 3, 0] }, { id: 'room-2', at: [6, 6, 0] }, { id: 'cell-1', at: [6, 6, 0] }]);
  });

  it('a citadel keeps its ending and a moment in a room; the flow stages the ending on its page', () => {
    const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 }), core = W.megaworld.rings.at(-1)[0];
    W.story = [
      { id: 'ending', where: { level: core }, when: { slot: 'ending' }, beats: [line('It is over.')] },
      { id: 'first-room', where: { level: core, place: 'room' }, when: { reach: 3 }, once: true, beats: [line('Cold in here.')] },
    ];
    const S = runSteps(W, { ref: 'sb' }), M = S.find((s) => s.key === `level-${core}-0`).order.manifest, game = S.find((s) => s.key === 'game').order;
    expect(M.play.scenes.map((x) => x.id)).toEqual(expect.arrayContaining(['ending', 'first-room']));
    expect(M.play.scenes.find((x) => x.id === 'first-room').when.enter).toMatchObject({ r: 3 });
    const end = Object.values(game.flow.steps).find((s) => s.scene === 'ending');
    expect(end).toMatchObject({ stage: `sb-level-${core}-0` });
    // (a whole game run, its levels laid: past the default 30 s on a slow runner, as round-story's is)
  }, 300000);
});
