// The shot light (worlds/controllable/shot-light.js): what shines in a fight, read off the world. The concepts: a quiet
// world has no lights; a round in flight is a light in its own colour, a bigger round reaching further; a burst is bright
// as it goes off and gone after its life; a muzzle's flash lasts a few frames; the pilot's charge grows as it fills, in
// the level reached's colour; past K, the strongest near the focus are kept; the function runs as the page runs it
// (its own source, import-free) and its numbers are SHOT_LIGHT's; the same world, the same lights.
import { describe, it, expect } from 'vitest';
import { shotLights, SHOT_LIGHT } from './shot-light.js';

const B = { max: 3, chest: 0.7, tap: { color: 0xfff2a8 }, levels: [{ at: 0.4, color: 0x5dff7a }, { at: 1, color: 0xffd23a }] };
const hero = (extra = {}) => ({ id: 'h', transform: { pos: [0, 2, 0], heading: 0 }, rule: { collideHeight: 1.6, buster: B }, ...extra });
const pellet = (pos, size, color) => ({ id: 'p' + size, pos, pellet: true, fxScale: size, fxColor: color });

describe('the shot light', () => {
  it('a quiet world has none', () => {
    expect(shotLights({ time: 3, entities: [hero()], projectiles: [], bursts: [] })).toEqual([]);
  });
  it('a round is a light in its colour, a bigger round reaching further', () => {
    const [a, b] = shotLights({ time: 1, entities: [], projectiles: [pellet([0, 3, 1], 0.08, 0xfff2a8), pellet([0, 6, 1], 0.3, 0xffd23a)] });
    expect(a.color[2]).toBeLessThan(a.color[0]);
    expect(b.reach).toBeGreaterThan(a.reach);
    expect(b.power).toBeGreaterThan(a.power);
    // (a foe's shell: its own colour)
    const [s] = shotLights({ time: 1, projectiles: [{ id: 's', pos: [0, 0, 1], fxColor: 0xff2020, fxScale: 2 }] });
    expect(s.color).toEqual([1, 0x20 / 255, 0x20 / 255]);
  });
  it('a burst is bright as it goes off and gone after its life; a flash lasts a few frames', () => {
    const burst = { seq: 0, pos: [0, 0, 1], t: 1, radius: 2, fxColor: 0xffa03c };
    const at = (time) => shotLights({ time, bursts: [burst] });
    expect(at(1)[0].power).toBeGreaterThan(at(1.2)[0].power);
    expect(at(1 + SHOT_LIGHT.burstLife + 0.01)).toEqual([]);
    const shot = (time) => shotLights({ time, entities: [hero({ lastShot: { t: 1, from: [0.5, 2, 1.1], charged: false } })] });
    expect(shot(1.02).length).toBe(1);
    expect(shot(1 + SHOT_LIGHT.flashLife + 0.01)).toEqual([]);
  });
  it('the charge grows as it fills, in the level reached\'s colour', () => {
    const at = (chargeFrac, chargeLevel) => shotLights({ time: 2, entities: [hero({ charging: true, busterOn: true, chargeFrac, chargeLevel })] })[0];
    const low = at(0.2, 0), full = at(1, 2);
    expect(full.reach).toBeGreaterThan(low.reach);
    expect(low.color).toEqual([1, 0xf2 / 255, 0xa8 / 255]);
    expect(full.color).toEqual([1, 0xd2 / 255, 0x3a / 255]);
    expect(full.pos[2]).toBeCloseTo(1.6 * 0.7, 6);
  });
  it('past K, the strongest near the focus are kept', () => {
    const ps = Array.from({ length: 10 }, (_, i) => pellet([0, i * 10, 1], 0.08, 0xffffff));
    const L = shotLights({ time: 0, projectiles: ps }, { focus: [0, 0, 1], k: 3 });
    expect(L.map((l) => l.pos[1])).toEqual([0, 10, 20]);
  });
  it('runs as the page runs it, with SHOT_LIGHT\'s numbers', () => {
    const src = shotLights.toString();
    expect(src).not.toMatch(/\bimport\b|\brequire\(/);
    const again = new Function(`return (${src})`)();
    const w = { time: 1, projectiles: [pellet([0, 3, 1], 0.2, 0x5dff7a)], bursts: [{ pos: [0, 1, 1], t: 0.9, radius: 1 }], entities: [hero({ charging: true, busterOn: true, chargeFrac: 0.5, chargeLevel: 1 })] };
    expect(again(w, { focus: [0, 0, 0] })).toEqual(shotLights(w, { focus: [0, 0, 0] }));
    const own = Object.fromEntries([...src.matchAll(/(\w+): (\[[^\]]+\]|0x\w+|[\d.]+)/g)].slice(0, Object.keys(SHOT_LIGHT).length).map(([, k, v]) => [k, JSON.parse(v.replace(/0x(\w+)/, (_, h) => String(parseInt(h, 16))))]));
    expect(own).toEqual({ ...SHOT_LIGHT });
  });
});
