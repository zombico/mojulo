import { describe, it, expect } from 'vitest';
import { assembleStageScene, STAGE_PAGE_BUDGET } from './stage.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { starter } from './entries.js';

// the page a level costs to open: each stage, closed and with every element on, under the budget; and the packed
// geometry (scene-three.js `pack`) is what keeps it there
const NAVE = { kind: 'stage', reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] };
const PLAZA = { kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12 }] };
const page = (p, o = {}) => emitThreeWorld({ ...p, ...o, textures: collectFaceTextures(p.faces), inline: true });

describe('the stage page budget', () => {
  it.each([
    ['the closed plaza with water, wind, a door and the key', { ...PLAZA, water: true, wind: true, doors: [{ id: 'church', at: { house: 1, side: '-x' }, to: { map: 'nave', door: 'west' } }], items: [{ id: 'key', at: [6, 13] }] }],
    ['the closed plaza at night with water and wind', { ...PLAZA, time: 'night', water: true, wind: true }],
    ['the research lab with its blast door', { kind: 'stage', reference: 'doom3', kit: 'research-lab', rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }], doors: [{ id: 'airlock', at: { portal: true }, to: { map: 'nave', door: 'west' } }] }],
    ['the research lab gone derelict, every event at full, with water', { kind: 'stage', reference: 'doom3', kit: 'research-lab', rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }], decay: 1, water: true }],
    ['the castle dungeon starter: six rooms, a tomb, real fire', { ...starter('gothic-stone'), reference: 'gothic-night' }],
    ['the catacomb starter: six rooms, an ossuary, real fire', { ...starter('catacomb'), reference: 'gothic-night' }],
    ['the nave with fire, wind and its doors', { ...NAVE, fire: true, wind: true, doors: [{ id: 'west', at: { portal: true }, to: { map: 'plaza', door: 'church' } }] }],
  ])('%s opens under the budget', (_, m) => {
    const p = assembleStageScene(m);
    expect(p.pack).toBe(true);
    expect(page(p).length).toBeLessThan(STAGE_PAGE_BUDGET);
  });

  it('packing welds the textured geometry and sends its colour in 8 bits: the page shrinks by more than a third', () => {
    const p = assembleStageScene(PLAZA), on = page(p), off = page(p, { pack: false });
    expect(on).toContain('__SRGB_LIN');
    expect(off).not.toContain('__SRGB_LIN');
    expect(on.length).toBeLessThan(off.length * 0.67);
  });
});
