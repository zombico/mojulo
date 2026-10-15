// The supercar on the grid: a composed supercar as a vehicle rig and its rule. The concepts: four wheel bones at the
// design's hubs and the lamps' bones the page lights; the rule the sports class at the car's own frame; in a mood the
// paint lit again and the lamps as they shine, the headlamps brighter after dark; its mesh packed indexed and quantized
// (the soup decoded back within a step); its own light by the mood's dark (beams, trails) and wet (spray); junk refused;
// deterministic. One card, chosen from the library.
import { describe, it, expect } from 'vitest';
import { supercarFigure, supercarRule, readSupercarSpec } from './supercar-figure.js';
import { composeSupercar, SUPERCAR_LIBRARY } from './vehicle-library.js';
import { VEHICLES } from '../roads/vehicles.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';

const preset = Object.keys(SUPERCAR_LIBRARY)[0], spec = { preset, seed: 5 };
const fig = supercarFigure(spec), night = supercarFigure({ ...spec, mood: 'night' });
const design = composeSupercar({ preset, seed: 5, surface: { quality: 'game' } }).design;

describe('the supercar on the grid', () => {
  it('is a vehicle rig: four wheels at the design\'s hubs, the lamps\' bones, steering and a body that moves', () => {
    expect(fig).toMatchObject({ rig: true, model: 'vehicle' });
    const head = Object.fromEntries(fig.bones.map((b) => [b.id, b.head]));
    for (const w of ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']) expect(head[w]).toEqual(design.topology.anchors[w]);
    expect(Object.keys(head)).toEqual(expect.arrayContaining(['root', 'lampHead', 'lampBrake']));
    expect(fig.wheelRadius).toBeCloseTo(design.frame.wheelRadius, 4);
    expect(fig.live.steer).toEqual(['wheelFL', 'wheelFR']);
    expect(fig.juice.slots).toEqual({ head: 'lampHead', brake: 'lampBrake' });
    expect(fig.juice.anchors.filter((a) => a.kind === 'tip')).toHaveLength(2);
  });

  it('drives on the sports class at its own frame', () => {
    const rule = supercarRule(design, { tuning: 'arcade' });
    expect(rule).toMatchObject({ type: 'drive', vehicle: 'sports', tuning: 'arcade', mass: VEHICLES.sports.mass });
    expect(rule.wheelbase).toBeCloseTo(fig.wheelbase, 3);
    expect(rule.collideRadius).toBeCloseTo(design.frame.W / 2, 2);
  });

  it('in a mood: the paint lit again, the lamps as they shine, the headlamps up after dark', () => {
    expect(JSON.stringify(night.parts[0])).not.toBe(JSON.stringify(fig.parts[0]));
    const headIx = fig.bones.findIndex((b) => b.id === 'lampHead');
    expect(night.parts[headIx].col).toBe(fig.parts[headIx].col);
    const amount = (F) => F.juice.status.find((s) => s.id === 'headlamps').amount;
    expect(amount(night)).toBeGreaterThan(amount(fig));
  });

  it('packs its mesh indexed and quantized: the same triangles within a step, a fraction of the soup', () => {
    for (const p of fig.parts.filter(Boolean)) expect(p).toMatchObject({ q: expect.any(String), idx: expect.any(String) });
    // a part of a few faces, packed both ways: every triangle corner decoded back within the grid's step
    const faces = [[0, 0, 0], [1.3, 0, 0.2], [1.3, 2.1, 0.4], [0, 2.1, 0.7]].map((_, i, a) => ({ corners: [a[i], a[(i + 1) % 4], [0.6, 1, 1.1]], fill: '#a03020' }));
    const bones = [{ id: 'root', head: [0, 0, 0] }], buckets = new Map([['root', faces]]);
    const soup = packVehicleFigure(bones, buckets).parts[0], packed = packVehicleFigure(bones, buckets, { packed: true }).parts[0];
    const f32 = (b) => new Float32Array(Uint8Array.from(Buffer.from(b, 'base64')).buffer), u16 = (b) => new Uint16Array(Uint8Array.from(Buffer.from(b, 'base64')).buffer);
    const P = f32(soup.pos), q = u16(packed.q), ix = u16(packed.idx);
    expect(ix.length * 3).toBe(P.length);
    ix.forEach((u, i) => { for (let k = 0; k < 3; k++) expect(Math.abs(packed.o[k] + q[u * 3 + k] * packed.s[k] - P[i * 3 + k])).toBeLessThanOrEqual(packed.s[k] + 1e-4); });
    expect(packed.n).toBeLessThan(ix.length);
    expect(JSON.stringify(packVehicleFigure(bones, buckets))).toBe(JSON.stringify(packVehicleFigure(bones, buckets, { packed: false })));
  });

  it('its own light by the mood: beams in the dark, ribbons after dark, spray in the wet; none at noon', () => {
    const at = (mood) => supercarFigure({ ...spec, ...(mood ? { mood } : {}) }).juice;
    const lights = (J) => [!!J.beams, !!J.trails, J.rows.some((r) => r.id === 'rainSpray')];
    expect(lights(fig.juice)).toEqual([false, false, false]);
    expect(lights(at('golden'))).toEqual([false, false, false]);
    expect(lights(at('dusk'))).toEqual([true, false, false]);
    expect(lights(at('rain'))).toEqual([false, false, true]);
    const nr = at('night-rain');
    expect(lights(nr)).toEqual([true, true, true]);
    expect(nr.beams.amount).toBeGreaterThan(at('dusk').beams.amount);
    expect(nr.trails.at).toHaveLength(2);
    expect(nr.trails.at[0][0]).toBeLessThan(0); expect(nr.trails.at[1][0]).toBeGreaterThan(0);
    // the spray never brighter than the light it is seen in: darker at night than in the day's rain
    const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    const spray = (J) => J.rows.find((r) => r.id === 'rainSpray').colours[0];
    expect(lum(spray(nr))).toBeLessThan(lum(spray(at('rain'))));
  });

  it('refuses what is not a supercar, and is the same every time', () => {
    expect(() => readSupercarSpec({ preset: 'hatchback' })).toThrow(/preset is one of/);
    expect(() => readSupercarSpec({ mood: 'midnight' })).toThrow(/mood is one of/);
    expect(() => readSupercarSpec({ wings: 2 })).toThrow(/'wings' is not one of/);
    expect(JSON.stringify(supercarFigure(spec))).toBe(JSON.stringify(fig));
  });
});
