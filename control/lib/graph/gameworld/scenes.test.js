import { describe, it, expect } from 'vitest';

import { MEADOWMARK_HERO } from './examples.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder, gameStore, STORY_SLICE } from './levels.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { sceneContract } from '../playscape/ui/scenes.js';

// A gameworld level's scenes (playscape/ui/scenes.js): placed in the level's first stage unless `stage` names another,
// the stage's places named as spots, and a story flags slice when the world's scenes read or set flags.
const { review, ...base } = MEADOWMARK_HERO;
const W = (scenes) => ({
  ...base,
  levels: {
    hub: { name: 'The hub', seed: 8, walk: { nodes: { gate: { trail: true }, yard: { trail: true } } }, ...(scenes ? { scenes } : {}) },
    cave: { name: 'The cave', seed: 8, walk: { nodes: { mouth: { trail: true } } } },
  },
  links: [{ from: 'hub', to: 'cave' }],
});
const LOOK = { id: 'look', when: { start: true }, if: { not: 'saw-exit' }, sets: ['saw-exit'], beats: [{ shot: { frame: 'wide', on: ['exit'] }, for: 1.5 }, { line: { who: 'hero', say: 'There. The way on.' } }] };
const YARD = { id: 'yard-pause', stage: 'yard', when: { enter: { anchor: 'pocket', r: 3 } }, beats: [{ shot: { frame: 'close', on: ['hero'] } }, { line: { who: 'hero' } }] };
const orderFor = (world) => {
  const G = readGameworld(world), stages = gameStages(world), refs = stages.map((s) => `w-${s.level}-${s.node}`);
  return { G, stages, orders: stages.map((s, i) => stageLevelOrder(G, s, { ref: refs[i], heroRef: 'h' })) };
};

describe('scenes in a gameworld', () => {
  const { stages, orders } = orderFor(W([LOOK, YARD]));
  const at = (lvl, node) => stages.findIndex((s) => s.level === lvl && s.node === node);
  const playOf = (lvl, node) => orders[at(lvl, node)].args.manifest.play;

  it('a scene plays in its level\'s first stage, or the stage it names; other stages and levels carry none', () => {
    expect(playOf('hub', 'gate').scenes.map((s) => s.id)).toEqual(['look']);
    expect(playOf('hub', 'yard').scenes.map((s) => s.id)).toEqual(['yard-pause']);
    expect(playOf('hub', 'yard').scenes[0].stage).toBeUndefined();
    expect(playOf('cave', 'mouth')).toBeUndefined();
  }, 120_000);

  it('the stage\'s places are spots to frame and walk to: its start, its exit, its pockets and landmarks', () => {
    const o = orders[at('hub', 'gate')], { spots } = o.args.manifest.play, ends = o.ends;
    expect(spots.slice(0, 2)).toEqual([{ id: 'start', at: ends.spawn }, { id: 'exit', at: ends.exit }]);
    for (const s of spots.slice(2)) expect(s.id).toMatch(/^(pocket|landmark)(-\d+)?$/);
    // the shot on 'exit' lowers to a framed point
    const ev = lowerPlay(o.args.manifest, { player: 'hero' });
    expect(ev.scenes[0].beats[0].shot).toEqual({ frame: 'wide', on: [], at: [ends.exit] });
  }, 120_000);

  it('flags: a story slice in the store, carried by the stages that have scenes; the contract writes and reads it', () => {
    expect(STORY_SLICE).toBe('story');
    expect(gameStore(W([LOOK]), null).slices.map((s) => `${s.name}:${s.kind}`)).toContain('story:flags');
    const play = playOf('hub', 'gate');
    expect(play.carry).toBe('story');
    const g = sceneContract({ levelRef: 'x', produces: { events: [] } }, play);
    expect(g.flags).toEqual({ slice: 'story', names: ['saw-exit'] });
    expect(g.on['flag:saw-exit'].emit).toMatchObject({ type: 'setFlag', slice: 'story', key: 'saw-exit' });
    // the start scene waits for the carried flags
    const ev = lowerPlay(orders[at('hub', 'gate')].args.manifest, { player: 'hero' });
    expect(ev.reactions.some((r) => r.on === 'flag-carried:saw-exit' && r.var === 'flag-saw-exit')).toBe(true);
  }, 120_000);

  it('scenes without flags carry nothing, and a world without scenes is as it was', () => {
    expect(gameStore(W([YARD]), null).slices.map((s) => s.name)).not.toContain('story');
    const { orders: none } = orderFor(W(null));
    expect(none.every((o) => o.args.manifest.play === undefined)).toBe(true);
  }, 120_000);

  it('teaches a bad stage and a bad scene, by the level', () => {
    expect(() => readGameworld(W([{ ...YARD, stage: 'cellar' }]))).toThrow(/levels\.hub\.scenes\[0\]\.stage names one of the level's stages \(gate, yard\)/);
    expect(() => readGameworld(W([{ ...LOOK, beats: [{ wait: 0 }] }]))).toThrow(/levels\.hub\.scenes\[0\]\.beats\[0\]\.wait is seconds/);
    expect(() => readGameworld(W('look'))).toThrow(/levels\.hub\.scenes is a list of scenes/);
  });
});
