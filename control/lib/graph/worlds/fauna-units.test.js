// A level's herds lowered onto its world (fauna-units.js): each species' rig built once, its bodies after the world's own.
import { describe, expect, it } from 'vitest';
import { animalFigure, lowerFaunaUnits } from './fauna-units.js';
import { unitOf } from '../era/biocube-fauna.js';
import { controllableChannelScript } from '../scene/channels/controllable/index.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const SPEC = { species: 'sheep', gait: unitOf('sheep').gait, behaviors: ['eat'] };

describe('fauna units', () => {
  it('builds a species\' rig once: its gait the runtime\'s forward, its eating graze', async () => {
    const F = await animalFigure(SPEC);
    expect(F.rig).toBe(true);
    expect(F.clips.forward).toBe(F.clips[SPEC.gait]);
    expect(F.clips.graze).toBe(F.clips.eat);
    expect(await animalFigure({ ...SPEC })).toBe(F);
  }, 60000);

  it('a killable one\'s rig carries its reactions as the runtime\'s stagger, topple and getup', async () => {
    const R = unitOf('sheep').reacts, F = await animalFigure({ ...SPEC, reactions: R });
    expect(R).toEqual(['flinch', 'fall', 'rise']);
    expect([F.clips.stagger, F.clips.topple, F.clips.getup]).toEqual([F.clips.flinch, F.clips.fall, F.clips.rise]);
    expect((await animalFigure(SPEC)).clips.stagger).toBeUndefined();
  }, 60000);

  it('lays the units after the world\'s own and takes them off the payload; none leaves it as it was', async () => {
    const own = { id: 'hero', rule: { type: 'walk' } }, sheep = { id: 'fauna:sheep:0:0', fauna: true, transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'ai', mind: { motivation: 'forage', aggressiveness: 'passive' } }, body: { type: 'figure-rig', figure: 'fauna:sheep' } };
    const P = await lowerFaunaUnits({ entities: [own], figures: { hero: { rig: true } }, faunaUnits: { entities: [sheep], figures: { 'fauna:sheep': SPEC } } });
    expect(P.entities.map((e) => e.id)).toEqual(['hero', 'fauna:sheep:0:0']);
    expect(Object.keys(P.figures)).toEqual(['hero', 'fauna:sheep']);
    expect('faunaUnits' in P).toBe(false);
    expect(P.nonBakeable).toBe(true);
    const bare = { faces: [] };
    expect(await lowerFaunaUnits(bare)).toEqual({ faces: [] });
  }, 60000);

  it('the page lets a pettable animal be petted, and only then carries the petting', () => {
    const at = { transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'none' }, rule: { type: 'ai', mind: { motivation: 'wander', aggressiveness: 'passive' } }, fauna: true };
    const marker = '// --- fauna pets';
    expect(emitThreeWorld({ faces: [], entities: [{ id: 'a', ...at }] })).not.toContain(marker);
    const html = emitThreeWorld({ faces: [], entities: [{ id: 'a', ...at, pet: { reach: 2, hold: 3, species: 'sheep' } }] });
    expect(html).toContain(marker);
    expect(html).toContain('"a":{"reach":2,"hold":3,"species":"sheep"}');
  });

  it('a level whose only minds are its fauna has no AI-attack button; any other mind keeps it', () => {
    const body = { type: 'none' }, at = { transform: { pos: [0, 0, 0], heading: 0 }, body };
    const fauna = { id: 'f', fauna: true, rule: { type: 'ai', mind: { motivation: 'wander', aggressiveness: 'passive' } }, ...at };
    const foe = { id: 'g', rule: { type: 'ai', mind: { motivation: 'hunt' } }, ...at };
    expect(controllableChannelScript([fauna], null, {})).not.toContain('AI attack: ON');
    expect(controllableChannelScript([fauna, foe], null, {})).toContain('AI attack: ON');
  });
});
