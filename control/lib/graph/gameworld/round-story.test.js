// THE ROUND'S STORY (round-story.js): a party RPG's round composed with its starter story from what it is about: the
// opening in the town (the flow's opening cutscene, staged on the town's page), a line as the core begins, the ending in
// the core (a building: the flow's ending staged on the citadel's page); a world's own story stands in its place
import { describe, it, expect } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { roundStory, ROUND_LINES } from './round-story.js';
import { MOTIVATIONS } from './gmn.js';

describe('the round\'s story', () => {
  it('every motivation has its lines; a story of three moments, the core named in them', () => {
    for (const m of Object.keys(MOTIVATIONS)) expect(ROUND_LINES[m], m).toBeTruthy();
    const S = roundStory({ motivation: 'save-the-princess', hub: 'town', core: 'keep', coreName: 'the citadel' });
    expect(S.map((x) => [x.id, x.where.level, x.when])).toEqual([['round-opening', 'town', { slot: 'opening' }], ['round-core', 'keep', { start: true }], ['round-ending', 'keep', { slot: 'ending' }]]);
    expect(S[1].beats[0].line.say).toBe('The citadel. She is somewhere past these walls.');
  });

  it('a composed round opens and ends with it, its ending on the citadel\'s page; a world\'s own story stands', () => {
    const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 });
    expect(W.story.map((x) => x.id)).toEqual(['round-opening', 'round-core', 'round-ending']);
    const core = W.megaworld.rings.at(-1)[0], flow = runSteps(W, { ref: 'rs' }).find((s) => s.key === 'game').order.flow.steps;
    expect(Object.values(flow).find((s) => s.scene === 'round-opening')).toMatchObject({ kind: 'cutscene', stage: `rs-level-${W.hub}-0` });
    expect(Object.values(flow).find((s) => s.scene === 'round-ending')).toMatchObject({ stage: `rs-level-${core}-0` });
  });
});
