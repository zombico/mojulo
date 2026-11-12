// A room's heaps as loose things (skandart.js skandartLoose): under a game that lets things break, each stamped heap its
// own faces (its instance's turn and light baked in) and a walk-through breakable; without one, the page as it was.
import { describe, it, expect } from 'vitest';
import { skandartLoose, landLoose, SKANDART_BURST } from './skandart.js';
import { starter } from './entries.js';

describe('the room\'s heaps as loose things', () => {
  it('lays each stamp out as its own faces, turned, placed and lit as the instance was, its box their bounds', () => {
    const template = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 0.5, 0.3]], normal: [1, 0, 0], fill: '#808080' }];
    const L = skandartLoose([{ group: 'skandart:foot-0a', template, transforms: [{ pos: [10, 5, 0], rotZ: Math.PI / 2, scale: 1, tint: [0.5, 0.5, 0.5] }] }, { group: 'stage:other', template, transforms: [] }]);
    expect(L.loose).toEqual([{ id: 'heap-1', min: [9.5, 5, 0], max: [10, 6, 0.3], cut: SKANDART_BURST }]);
    expect(L.faces[0]).toMatchObject({ group: 'break:heap-1', node: 'heap-1', normal: [0, 1, 0] });
    expect(L.faces[0].corners[1]).toEqual([10, 6, 0]);
    // (lit as the instance: half the light, in linear)
    expect(parseInt(L.faces[0].fill.slice(1, 3), 16)).toBeLessThan(0x80);
    expect(L.repeats.map((r) => r.group)).toEqual(['stage:other']);
    expect(skandartLoose([{ group: 'stage:other', template, transforms: [] }])).toBe(null);
  });

  it('turns a ruined crypt\'s heaps into loose things in a game that lets things break; without one, nothing of it', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ title: 'crypt', manifest: { ...starter('gothic-ashlar'), condition: 'ruined', entities: [hero], ...extra } });
    const plain = (await resolveWorldScene(level({}))).payload;
    expect(plain.loose).toBeUndefined();
    expect((plain.repeats || []).some((r) => r.group.startsWith('skandart:'))).toBe(true);
    expect(emitThreeWorld(plain)).not.toContain('buildLoose');
    const { payload } = await resolveWorldScene(level({ destruction: 'objects' }));
    expect(payload.loose.length).toBeGreaterThan(5);
    expect((payload.repeats || []).some((r) => r.group.startsWith('skandart:'))).toBe(false);
    for (const b of payload.loose) expect(payload.breakPieces[b.id]).toBeDefined();
    expect((payload.colliders || []).some((c) => String(c.of).startsWith('heap-'))).toBe(false);
    const page = emitThreeWorld(payload);
    expect(page).toContain('buildLoose');
    expect(page).toContain('__updateBreaks');
  }, 180_000);

  it('takes a land\'s named debris as loose things: a trail\'s rockfall and its trees\' fallen wood, a snowy trail\'s drifts', async () => {
    const tri = (node, x) => ({ corners: [[x, 0, 0], [x + 1, 0, 0], [x, 1, 0.4]], node, group: 'isekai:rock' });
    const L = landLoose([tri('skl-rock-1', 0), tri('skl-rock-1', 1), tri('skl-wood-1', 5), { corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], group: 'isekai:ground' }]);
    expect(L.loose).toEqual([{ id: 'skl-rock-1', min: [0, 0, 0], max: [2, 1, 0.4], cut: SKANDART_BURST }, { id: 'skl-wood-1', min: [5, 0, 0], max: [6, 1, 0.4], cut: SKANDART_BURST }]);
    expect(L.faces.map((f) => f.group)).toEqual(['break:skl-rock-1', 'break:skl-rock-1', 'break:skl-wood-1', 'isekai:ground']);
    expect(landLoose([{ corners: [[0, 0, 0]], group: 'isekai:ground' }])).toBe(null);
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee' }, transform: { pos: [20, 4, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const kinds = (P) => [...new Set((P.loose || []).map((b) => b.id.split('-')[1]))].sort();
    const trail = (await resolveWorldScene({ title: 't', manifest: { kind: 'stage', trail: {}, seed: 3, skandart: 1, entities: [hero], destruction: 'objects', geocube: { from: 'island-noon', biocube: { from: 'meadow' } } } })).payload;
    expect(kinds(trail)).toEqual(['rock', 'wood']);
    expect((trail.colliders || []).some((c) => String(c.of).startsWith('skl-'))).toBe(false);
    const snow = (await resolveWorldScene({ title: 't', manifest: { kind: 'stage', trail: {}, seed: 3, skandart: 1, entities: [hero], destruction: 'objects', geocube: { from: 'island-noon', snow: 'deep', wind: { dir: 0 } } } })).payload;
    expect(kinds(snow)).toEqual(['drift']);
  }, 240_000);
});
