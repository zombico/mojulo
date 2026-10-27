// The form render indoors (room-form.js, era/stage.js, scene/channels/form.js): a room read in gen-7 keeps no light in
// its corners, sends its placed lights to the page, and has its tiles read as material; anything else is as it was.
import { describe, expect, it } from 'vitest';
import { formMaterialOf, formRoomMaps, readFormLight } from './room-form.js';
import { tileFamilyOf } from '../era/tile-specs.js';
import { assembleStageScene } from '../era/stage.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { eraReading } from '../era/era-marks.js';

const ROOM = { kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 6, d: 6, h: 4 }], dress: false, lights: [{ at: [3, 0.4, 2.6], intensity: 1.5, radius: 7 }] };

describe('a tile read as material', () => {
  it('a dressed family from its relief, a stock tile from its light, a card not at all; the same bytes each read', () => {
    const fam = tileFamilyOf({ gen: 'dressed', cut: 'fluted', stone: [170, 160, 140], mortar: [90, 86, 80], scale: 1 }, 'test');
    const relief = formMaterialOf(`${fam}-a`);
    expect(relief.read).toBe('relief');
    for (const m of ['base', 'normal', 'orm']) expect(relief[m]).toMatch(/^data:image\/png;base64,/);
    expect(formMaterialOf('stucco').read).toBe('luminance');
    expect(formMaterialOf('card:leaf')).toBe(null);
    const { textures, maps } = formRoomMaps(['stucco', `${fam}-a`, 'stucco']);
    expect(Object.keys(maps)).toEqual([`${fam}-a`, 'stucco']);
    expect(textures.stucco).toBe(formMaterialOf('stucco').base);
  });

  it('the page\'s lights: colour 0..1, the bake\'s intensity and radius; a pool lights and never casts', () => {
    const [torch, pool] = readFormLight([{ at: [1, 2, 3], color: '#ff8040', intensity: 1.5, radius: 7, fixture: 'torch' }, { at: [0, 0, 0.1], color: '#ffffff', intensity: 0.6, radius: 4, fixture: 'pool' }]);
    expect(torch).toEqual({ at: [1, 2, 3], rgb: [1, 0.502, 0.251], intensity: 1.5, radius: 7, cast: true });
    expect(pool.cast).toBe(false);
  });
});

describe('a room in the form render', () => {
  const formed = assembleStageScene(ROOM, { form: true }), painted = assembleStageScene(ROOM, {});

  it('its corners hold its material\'s colour, never light: a light turned up moves the paint, not the form', () => {
    const lamp = (intensity) => ({ ...ROOM, lights: [{ at: [3, 0.4, 2.6], intensity, radius: 7 }] });
    const fills = (m, ctx) => assembleStageScene(m, ctx).faces.map((f) => f.cornerFills ? f.cornerFills.join() : f.fill);
    expect(fills(lamp(3), { form: true })).toEqual(fills(lamp(1), { form: true }));
    expect(fills(lamp(3), {})).not.toEqual(fills(lamp(1), {}));
    expect(painted.form).toBeUndefined();
  });

  it('its placed lights go to the page, one for each the bake would have laid', () => {
    expect(formed.form.lights).toHaveLength(1);
    expect(formed.form.lights[0]).toMatchObject({ at: [3, 0.4, 2.6], intensity: 1.5, radius: 7 });
    expect(formed.form.lights.every((l) => l.cast)).toBe(true);
    expect(formed.form.ambient).toHaveLength(3);
  });

  it('a toned room is lit as form: its ramps ride in its corners, the page\'s tone pass is not drawn', () => {
    const toned = { ...ROOM, tone: 'noir' }, P = assembleStageScene(toned, { form: true });
    expect(P.form.lights.length).toBeGreaterThan(0);
    expect(P.tone).toBeUndefined();
    expect(assembleStageScene(toned, {}).tone).toBeDefined();
  });

  it('a sunlit stage stays paint', () => {
    expect(assembleStageScene({ kind: 'stage', kit: 'island-plaza', reference: 'island-noon', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 6 }] }, { form: true }).form).toBeUndefined();
  });

  it('the page draws it only when carried, and the era marks read its faces as material', () => {
    const tiny = { faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#808080', group: 'stage:floor' }], inline: true };
    expect(emitThreeWorld(tiny)).not.toContain('__mojForm');
    const page = emitThreeWorld({ ...tiny, form: { lights: [{ at: [0, 0, 2], rgb: [1, 0.7, 0.4], intensity: 1.5, radius: 6, cast: true }], ambient: [0.2, 0.2, 0.2], maps: {} } });
    expect(page).toContain('__mojForm');
    expect(page).toContain('THREE.NeutralToneMapping');
    expect(eraReading({ faces: tiny.faces }, 'gen-7').approximated.map((r) => r.input)).toContain('faces');
    expect(eraReading({ faces: tiny.faces, form: { lights: [] } }, 'gen-7').approximated.map((r) => r.input)).not.toContain('faces');
  });
});
