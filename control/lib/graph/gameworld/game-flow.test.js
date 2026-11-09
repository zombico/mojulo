import { describe, it, expect } from 'vitest';
import { storyCinematics, worldFlow, flowToRefs, flowStoryboard } from './game-flow.js';
import { readGameworld } from './world.js';
import { chaptersOfPath, chapterOfPart, chapterOfCard } from './chapters.js';
import { gameworldCards } from './gameworld-cards.js';

// THE GAME'S FLOW IN THE STUDIO: the game director's page. A world's own flow is read in its level ids and taught; a
// world that says none has the default with the story's cinematics (its slots, and the main quest's ending when that
// beat is a story moment); the flow maps onto a game's refs; the review shows it as a storyboard.
const line = [{ line: { who: 'hero', say: 'On.' } }];
const moment = (id, level, slot) => ({ id, where: { level }, beats: line, when: slot ? { slot } : { on: 'staged' } });
const G = (more = {}) => ({ ids: ['gate', 'cave'], levels: { gate: {}, cave: {} }, front: {}, ...more });

describe('the story\'s cinematics and the flow they make', () => {
  it('the story\'s slots, and the main quest\'s ending played as a moment when the story has no ending', () => {
    const mainQuest = { acts: [{ id: 'one', goal: 'Go home.', beats: [{ id: 'last', goal: 'Get home.', as: { scene: 'home' } }] }], ending: { beat: 'last' } };
    expect(storyCinematics(G({ story: [moment('dawn', 'gate', 'opening'), moment('home', 'cave')], mainQuest }))).toEqual({
      opening: { scene: 'dawn', level: 'gate' }, ending: { scene: 'home', level: 'cave' },
    });
    // the story's own ending wins
    expect(storyCinematics(G({ story: [moment('home', 'cave'), moment('fin', 'gate', 'ending')], mainQuest })).ending).toEqual({ scene: 'fin', level: 'gate' });
    expect(storyCinematics(G())).toEqual({});
    // as the world reads it: the beat kept as { kind: 'scene', at }
    const read = readGameworld({ id: 'w', seed: 8, levels: { gate: { walk: { nodes: { path: { trail: true } } } } }, story: [moment('home', 'gate')], mainQuest });
    expect(storyCinematics(read).ending).toEqual({ scene: 'home', level: 'gate' });
  });
  it('a world\'s flow: its own, else the default with its cinematics, else none to say', () => {
    const own = { start: 'title', steps: { title: { kind: 'screen', screen: 'title', on: { play: 'gate' } }, gate: { kind: 'level', level: 'gate', on: { won: 'title' } } } };
    expect(worldFlow(G({ flow: own }))).toEqual({ flow: own, source: 'own' });
    const D = worldFlow(G({ story: [moment('dawn', 'gate', 'opening')] }));
    expect(D.source).toBe('default');
    expect(D.flow.steps.opening).toEqual({ kind: 'cinematic', scene: 'dawn', stage: 'gate', next: 'title' });
    expect(worldFlow(G())).toBeNull();
  });
  it('maps onto a game\'s refs, and says which levels it could not find', () => {
    const own = { start: 'intro', steps: { intro: { kind: 'cinematic', scene: 'dawn', stage: 'gate', next: 'any' }, any: { kind: 'level', level: '$any', on: { won: 'cave' } }, cave: { kind: 'level', level: 'cave', on: { won: 'intro' } } } };
    const refs = { gate: 'gw-gate-0' };
    const m = flowToRefs(own, (id) => refs[id] || null);
    expect(m.flow.steps.intro.stage).toBe('gw-gate-0');
    expect(m.flow.steps.any.level).toBe('$any');
    expect(m.missing).toEqual(['cave']);
  });
  it('the storyboard: each step in the order the start reaches it, whose it is, what it waits on, where it goes', () => {
    const F = worldFlow(G({ story: [moment('dawn', 'gate', 'opening'), moment('off', 'gate', 'prologue')] })).flow;
    const B = flowStoryboard(F);
    expect(B.map((b) => b.step).slice(0, 3)).toEqual(['opening', 'title', 'prologue']);
    expect(B[0]).toMatchObject({ kind: 'cinematic', department: 'cinematics', what: 'the scene dawn, on gate', waits: 'its scene to end', goes: { next: 'title' } });
    expect(B.find((b) => b.step === 'title')).toMatchObject({ department: 'interface', waits: expect.stringMatching(/^the player \(.*play.*\), or 45 s left alone$/) });
    expect(B.find((b) => b.step === 'prologue').what).toBe('the scene off, on gate, kept into play');
  });
});

describe('the flow in the studio', () => {
  const W = (more) => ({ id: 'w', seed: 8, levels: { gate: { walk: { nodes: { path: { trail: true } } } }, cave: { walk: { nodes: { mouth: { trail: true } } } } }, links: [{ from: 'gate', to: 'cave' }], ...more });
  it('a world says its flow in its level ids, and is taught its faults', () => {
    const flow = { start: 'title', steps: { title: { kind: 'screen', screen: 'title', on: { play: 'gate' } }, gate: { kind: 'level', level: 'gate', on: { won: 'title' } } } };
    expect(readGameworld(W({ flow })).flow).toEqual(flow);
    expect(() => readGameworld(W({ flow: { ...flow, steps: { ...flow.steps, gate: { kind: 'level', level: 'moon', on: { won: 'title' } } } } }))).toThrow(/gameworld: flow.steps.gate.level is a level \(gate, cave\)/);
    expect(() => readGameworld(W({ flow: { start: 'intro', steps: { intro: { kind: 'cinematic', scene: 'nowhere', stage: 'gate', next: 'title' }, title: flow.steps.title, gate: flow.steps.gate } } }))).toThrow(/scene: no scene 'nowhere'/);
  });
  it('the flow chapter is production\'s, read by the build; its card teaches the game director\'s page, the studio card keeps it the main agent\'s', () => {
    expect(chaptersOfPath('/flow').map((c) => c.id)).toEqual(['flow']);
    expect(chapterOfPart('flow:sequence')).toMatchObject({ id: 'flow', department: 'production' });
    expect(chapterOfCard('gameworld-flow').id).toBe('flow');
    const cards = gameworldCards();
    expect(cards.get('gameworld-flow').body).toMatch(/YOURS \(the main agent's,\s*never a subagent's/);
    expect(cards.get('gameworld-studio').body).toMatch(/THE FLOW \(production\) is the game director's, yours/);
  });
});
