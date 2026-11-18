// A room's SHADE (era/stage.js `shade`, a geocube's `light.shade`): the share of the light a surface turned from every lamp
// keeps, asked of the form render's solve (form/room-light.js); its air darkened with it, its figures lit by its lamps
// where they stand (scene/channels/form.js lightAt, scene/channels/controllable `roomLit`). A room that asks none is as it was.
import { describe, it, expect } from 'vitest';
import { assembleStageScene, formLightFaces } from './stage.js';
import { readGeocube, lowerGeocube } from './geocube.js';
import { formScript, FORM_PAGE } from '../scene/channels/form.js';
import { controllableChannelScript } from '../scene/channels/controllable/index.js';

const ROOM = (over = {}) => ({ kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 12, h: 8 }], ...over });
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const grey = (hex) => lum([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));

describe('a room\'s shade', () => {
  it('the solve keeps the shade asked; the room\'s own stays its own', () => {
    const raw = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], tint: [0.6, 0.6, 0.6] }];
    const lamps = [{ at: [0.5, 0.5, 2], color: '#ffaa66', intensity: 1.5, radius: 6 }], amb = [0.3, 0.3, 0.32];
    const own = formLightFaces(raw, lamps, amb), asked = formLightFaces(raw, lamps, amb, undefined, { shade: 0.05 });
    expect(asked.light.contrast).toBe(0.05);
    expect(asked.light.own).toBe(own.light.contrast);
    expect(asked.light.dim).toBeLessThan(1);
    expect(own.light.dim).toBeUndefined();
    // (the ambient falls against the lamps)
    expect(lum(asked.light.ambient) / lum(asked.light.keys[0])).toBeLessThan(lum(own.light.ambient) / lum(own.light.keys[0]));
  });

  it('a stage that asks it: its air darkened, its figures lit by its lamps; one that asks none, as it was; out of range, refused', () => {
    const plain = assembleStageScene(ROOM(), { formLit: true }), dark = assembleStageScene(ROOM({ shade: 0.04 }), { formLit: true });
    expect(dark.form.room.figures).toBe(true);
    expect(plain.form.room.figures).toBeUndefined();
    expect(grey(dark.haze.color)).toBeLessThan(grey(plain.haze.color));
    expect(grey(dark.bg)).toBeLessThan(grey(plain.bg));
    expect(() => assembleStageScene(ROOM({ shade: 0.9 }), { formLit: true })).toThrow(/shade is the share/);
  }, 120_000);

  it('a geocube carries it into its inside; out of range, refused', () => {
    expect(lowerGeocube(readGeocube({ from: 'gothic-night', light: { shade: 0.06 } }), 'inside').shade).toBe(0.06);
    expect(lowerGeocube(readGeocube('gothic-night'), 'inside').shade).toBeUndefined();
    expect(() => readGeocube({ from: 'gothic-night', light: { shade: 1 } })).toThrow(/light.shade/);
  });

  it('the page: the room\'s light at a point only where its figures are lit by it, and the bodies take it only then', () => {
    const cfg = { ...FORM_PAGE, lights: [{ at: [0, 0, 3], key: [0.5, 0.5, 0.5], radius: 8, live: true }], ambient: [0.01, 0.01, 0.01], fall: 2, maps: {} };
    expect(formScript(cfg)).not.toMatch(/lightAt/);
    expect(formScript({ ...cfg, figures: true })).toMatch(/probe\.lightAt = /);
    const ent = [{ id: 'p', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'platform' }, body: { type: 'box', size: [0.5, 0.5, 1.8] }, pilotable: true }];
    expect(controllableChannelScript(ent, null, {}, {})).not.toMatch(/__roomLight/);
    expect(controllableChannelScript(ent, null, {}, { roomLit: true })).toMatch(/function __roomLight\(\)/);
  });
});
