// The form render indoors (room-form.js, room-light.js, era/stage.js, scene/channels/form.js): a room read in gen-7 is
// baked with its colour and its light apart (the light solved from its palette, each lamp's shadow tested), its lamps
// sent to the page to light the relief, its tiles read as material; anything else is as it was.
import { describe, expect, it } from 'vitest';
import { formMaterialOf, formRoomMaps, readFormLight, ROOM_MAPS } from './room-form.js';
import { tileFamilyOf } from '../era/tile-specs.js';
import { assembleStageScene, formLightFaces } from '../era/stage.js';
import { makePointShadow } from '../era/sun.js';
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
    const { textures, maps } = formRoomMaps(['stucco', `${fam}-a`, 'stucco', 'card:leaf']);
    expect(Object.keys(maps)).toEqual(['card:leaf', `${fam}-a`, 'stucco']);
    expect(textures.stucco).toBe(formMaterialOf('stucco').base);
    // (a card keeps its paint: only its mean goes to the page, which divides it by that)
    expect(textures['card:leaf']).toBeUndefined();
    expect(maps['card:leaf'].read).toBe('paint');
    // its relief's height packed for the parallax, its depth within the bounds, its mean the colour's
    expect(relief.depth).toBeGreaterThan(0);
    expect(maps.stucco.mean.every((v) => v > 0 && v < 1)).toBe(true);
  });

  it('past its maps\' budget a page draws its relief smaller and keeps its colour whole; under it, nothing changes', () => {
    const fam = tileFamilyOf({ gen: 'dressed', cut: 'plate', stone: [90, 100, 110], mortar: [150, 152, 150], cols: 2, rows: 2, scale: 2 }, 'test'), key = `${fam}-a`;
    const W = (uri) => Buffer.from(uri.slice(22), 'base64').readUInt32BE(16);
    const whole = formRoomMaps([key]), tight = formRoomMaps([key], { budget: 1 });
    expect(whole.reliefSize).toBeUndefined();
    expect(tight.reliefSize).toBe(ROOM_MAPS.small);
    expect(W(tight.maps[key].normal)).toBe(ROOM_MAPS.small);
    expect(W(tight.textures[key])).toBe(W(whole.textures[key]));
    expect(W(whole.maps[key].normal)).toBeGreaterThan(ROOM_MAPS.small);
  });

  it('the page\'s lamps: each its solved key and radius; a pool is baked only, never lit live', () => {
    const [torch, pool] = readFormLight([{ at: [1, 2, 3], color: '#ff8040', intensity: 1.5, radius: 7, fixture: 'torch' }, { at: [0, 0, 0.1], color: '#ffffff', intensity: 0.6, radius: 4, fixture: 'pool' }], [[2, 1, 0.5], [0.3, 0.3, 0.3]]);
    expect(torch).toEqual({ at: [1, 2, 3], key: [2, 1, 0.5], radius: 7, live: true });
    expect(pool.live).toBe(false);
  });
});

describe('a room in the form render', () => {
  const formed = assembleStageScene(ROOM, { formLit: true }), painted = assembleStageScene(ROOM, {});

  it('its corners carry its colour and its light apart: the light falls off from the lamp, the colour does not', () => {
    const lit = formed.faces.filter((f) => f.cornerLight && f.group === 'stage:floor');
    expect(lit.length).toBeGreaterThan(0);
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], d = (c) => Math.hypot(c[0] - 3, c[1] - 0.4);
    const corners = lit.flatMap((f) => f.corners.map((c, k) => [d(c), lum(f.cornerLight[k])])).sort((a, b) => a[0] - b[0]);
    expect(corners[0][1]).toBeGreaterThan(corners[corners.length - 1][1]);
    expect(painted.form).toBeUndefined();
    expect(painted.faces.some((f) => f.cornerLight)).toBe(false);
  });

  it('a lamp lights only the corners it can see: behind a wall, the ambient alone', () => {
    const quad = (z, group) => ({ corners: [[0, 0, z], [2, 0, z], [2, 2, z], [0, 2, z]], normal: [0, 0, 1], tint: [0.6, 0.6, 0.6], group });
    const floor = quad(0, 'stage:floor'), lid = { ...quad(1, 'stage:prop'), normal: [0, 0, -1] };
    const lamp = { at: [1, 1, 2], color: '#ffa850', intensity: 1.5, radius: 7, fixture: 'torch' };
    const run = (faces, shadowed) => formLightFaces(faces, [shadowed ? { ...lamp, shadow: makePointShadow(faces, lamp.at, { radius: 7 }) } : lamp], [0.2, 0.2, 0.25]);
    const open = run([floor], true), shut = run([floor, lid], true);
    expect(shut.faces[0].cornerLight[0]).toEqual(shut.light.ambient.map((v) => Math.round(v * 1e4) / 1e4));
    expect(open.faces[0].cornerLight[0][0]).toBeGreaterThan(open.light.ambient[0]);
    // (and the colour is the same either way: the base its palette asks for)
    expect(shut.faces[0].cornerFills).toEqual(open.faces[0].cornerFills);
  });

  it('its lamps go to the page with their solved light, one for each the bake laid', () => {
    expect(formed.form.room.lights).toHaveLength(1);
    expect(formed.form.room.lights[0]).toMatchObject({ at: [3, 0.4, 2.6], radius: 7, live: true });
    expect(formed.form.room.lights[0].key.every((v) => v > 0)).toBe(true);
    expect(formed.form.room.ambient).toHaveLength(3);
    expect(formed.form.room.fall).toBeGreaterThan(0);
  });

  it('a toned room is lit as form: its ramps ride in its corners, the page\'s tone pass is not drawn', () => {
    const toned = { ...ROOM, tone: 'noir' }, P = assembleStageScene(toned, { formLit: true });
    expect(P.form.room.lights.length).toBeGreaterThan(0);
    expect(P.tone).toBeUndefined();
    expect(assembleStageScene(toned, {}).tone).toBeDefined();
  });

  it('a sunlit stage stays paint', () => {
    expect(assembleStageScene({ kind: 'stage', kit: 'island-plaza', reference: 'island-noon', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 6 }] }, { formLit: true }).form).toBeUndefined();
  });

  it('the page draws it only when carried, and the era marks read its faces as material', () => {
    const tiny = { faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#808080', group: 'stage:floor' }], inline: true };
    expect(emitThreeWorld(tiny)).not.toContain('__mojForm');
    const page = emitThreeWorld({ ...tiny, form: { room: { lights: [{ at: [0, 0, 2], key: [2, 1.4, 0.7], radius: 6, live: true }], ambient: [0.05, 0.05, 0.06], fall: 2, maps: {} } } });
    expect(page).toContain('__mojForm');
    expect(page).toContain('THREE.NeutralToneMapping');
    // (no shadow maps of its own: the lamps' shadows are baked)
    expect(page).not.toContain('castShadow = true');
    expect(eraReading({ faces: tiny.faces }, 'gen-7').approximated.map((r) => r.input)).toContain('faces');
    expect(eraReading({ faces: tiny.faces, form: { room: { lights: [] } } }, 'gen-7').approximated.map((r) => r.input)).not.toContain('faces');
  });
});
