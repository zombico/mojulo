import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents } from '../../worlds/event-bus.js';
import { lowerPlay } from './direction.js';
import { readQuests, questProgram, questView, questNews } from './quests.js';
import { sceneContract } from './scenes.js';
import { questScript } from '../../scene/channels/quest-channel.js';
import { eventsChannelScript } from '../../scene/channels/events.js';

const ENTITIES = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
const CAVE = { id: 'clear-the-cave', starts: 'took-job', steps: [{ log: 'Find the cave', done: 'found-cave' }, { done: 'cave-cleared' }] };

// the bus alone: a level's quests over its flags (a cue's emit sets one, as a scene's sets would)
function level(play) {
  const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
  const bus = createBusState(ev, []);
  const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  return { ev, bus, fire, view: () => questView(ev.quests, bus.vars) };
}

describe('quests', () => {
  it('read: a name, steps in order; placeholders for unwritten steps', () => {
    const [q] = questProgram({ quests: [CAVE] });
    expect(q).toEqual({ id: 'clear-the-cave', name: 'Clear The Cave', starts: 'took-job', steps: [{ text: 'Find the cave', flag: 'found-cave' }, { text: '[Clear The Cave: step 2]', flag: 'cave-cleared' }] });
  });

  it('kept over the flags: begun by its flag, a step shows once those before it are done, then done', () => {
    const L = level({ quests: [CAVE, { id: 'gather', name: 'Gather herbs', steps: [{ log: 'Pick three herbs', done: 'herbs' }] }] });
    expect(L.ev.vars['flag-found-cave']).toBe(0);
    expect(L.view().map((q) => q.id)).toEqual(['gather']);   // the cave waits for its start
    L.fire('flag:took-job');
    expect(L.view()[0]).toEqual({ id: 'clear-the-cave', name: 'Clear The Cave', state: 'on', steps: [{ text: 'Find the cave', done: false }] });
    L.fire('flag:cave-cleared');   // out of order: the first is still to do
    expect(L.view()[0].steps).toHaveLength(1);
    L.fire('flag:found-cave');
    expect(L.view()[0]).toMatchObject({ state: 'done', steps: [{ done: true }, { done: true }] });
    L.fire('flag-carried:herbs');
    expect(L.view()[1].state).toBe('done');
  });

  it('news: a quest begun, a step done, a quest complete (for flags set just now)', () => {
    const P = questProgram({ quests: [CAVE] });
    expect(questNews(P, ['took-job', 'found-cave', 'cave-cleared', 'other'])).toEqual([
      { kind: 'begun', name: 'Clear The Cave' }, { kind: 'step', name: 'Clear The Cave', text: 'Find the cave' }, { kind: 'done', name: 'Clear The Cave' },
    ]);
  });

  it('carried as the scenes\' flags are: written to the slice as they are set, pushed in at start; no scenes needed', () => {
    const g = sceneContract({ levelRef: 'l', produces: { events: [] } }, { carry: 'story', quests: [CAVE] });
    expect(Object.keys(g.on).sort()).toEqual(['flag:cave-cleared', 'flag:found-cave', 'flag:took-job']);
    expect(g.flags.names).toEqual(['cave-cleared', 'found-cave', 'took-job']);
  });

  it('the page carries the journal only when the events have quests', () => {
    const L = level({ quests: [CAVE] });
    expect(eventsChannelScript(L.ev)).toContain('__stepQuests(dtSec)');
    const { quests: _, ...none } = L.ev;
    expect(eventsChannelScript(none)).not.toContain('__QV');
    expect(() => new Function(questScript())).not.toThrow();
  });

  it('teaches a bad quest', () => {
    const bad = (q) => () => readQuests({ quests: [q] });
    expect(bad({ id: 'a', steps: [] })).toThrow(/steps is 1 to 12 steps/);
    expect(bad({ id: 'a', steps: [{ log: 'x' }] })).toThrow(/steps\[0\]\.done is the flag/);
    expect(bad({ id: 'a', reward: 3, steps: [{ done: 'x' }] })).toThrow(/reward is not part of a quest/);
    expect(bad({ id: 'a', starts: 'Bad', steps: [{ done: 'x' }] })).toThrow(/starts is the flag/);
    expect(() => readQuests({ quests: [{ id: 'a', steps: [{ done: 'x' }] }, { id: 'a', steps: [{ done: 'y' }] }] })).toThrow(/'a' appears twice/);
  });
});
