// Live flames, the cheap kind (flames.js): every flame on a page one instanced quad whose shape is a formula of the
// clock; a room's torches in the form render carry them in the place of their two polygons (era/stage.js).
import { describe, it, expect } from 'vitest';
import { flamesScript, FLAME } from './flames.js';
import { assembleStageScene, torchFaces, TORCH_FLAME } from '../../era/stage.js';
import { emitThreeWorld } from '../scene-three.js';
import { readFinish } from '../page-light.js';

const ROOM = { kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 9, d: 8, h: 5 }] };

describe('live flames', () => {
  it('a page with none carries none; with some, one instanced mesh draws them all, writing the page\'s own depth', () => {
    expect(flamesScript([])).toBe('');
    expect(flamesScript(null)).toBe('');
    const two = flamesScript([{ at: [1, 2, 3], w: 0.3, h: 0.5 }, { at: [4, 5, 6], w: 0.3, h: 0.5, color: [1, 0.5, 0.2] }]);
    expect(two.match(/new THREE\.Mesh\(/g)).toHaveLength(1);
    expect(two).toContain('g.instanceCount = FL.length;');
    expect(two).toContain('#include <logdepthbuf_fragment>');
    // (as painted it adds its own colour; under a world's bloom it is drawn past white)
    expect(two).toContain('uHot: { value: 1 }');
    expect(flamesScript([{ at: [1, 2, 3], w: 0.3, h: 0.5 }], { hot: true })).toContain(`uHot: { value: ${FLAME.hot} }`);
  });

  it('in the form render a torch\'s flame is live and its polygons are gone, its bowl keeping the coals that carry its glow; elsewhere the polygons', () => {
    const torch = { at: [1, 1, 2], n: [0, 1], color: '#ffb060', fixture: 'torch' };
    const poly = torchFaces(torch), live = torchFaces(torch, false, true);
    // (two crossed cards of two quads each give way to one bed of coals, which still glows)
    expect(poly.filter((f) => f.emissive).length).toBe(4);
    expect(live.filter((f) => f.emissive).length).toBe(1);
    expect(live.find((f) => f.emissive).glow).toBeDefined();
    expect(live.filter((f) => !f.emissive)).toEqual(poly.filter((f) => !f.emissive));
    // (the stage: gen-7 carries a flame a torch, where the polygons stood; gen-6 and an engine's read carry none)
    const g7 = assembleStageScene(ROOM, { formLit: true }), g6 = assembleStageScene(ROOM, {}), hand = assembleStageScene(ROOM, { formLit: true, unshaded: true, handoff: true });
    expect(g7.flames.length).toBeGreaterThan(0);
    expect(g7.flames[0]).toMatchObject({ w: TORCH_FLAME.w, h: TORCH_FLAME.h });
    expect(g6.flames).toBeUndefined();
    expect(hand.flames).toBeUndefined();
    expect(JSON.stringify(assembleStageScene(ROOM, { formLit: true }).flames)).toBe(JSON.stringify(g7.flames));
  }, 120_000);

  it('the page draws them only when carried, hot only under a finish with its bloom', () => {
    const face = { corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888' }, flames = [{ at: [2, 2, 1], w: 0.3, h: 0.5 }];
    expect(emitThreeWorld({ faces: [face], inline: true })).not.toContain('__mojFlames');
    expect(emitThreeWorld({ faces: [face], inline: true, flames })).toContain('uHot: { value: 1 }');
    expect(emitThreeWorld({ faces: [face], inline: true, flames, finish: readFinish({ finish: true }) })).toContain(`uHot: { value: ${FLAME.hot} }`);
  });
});
