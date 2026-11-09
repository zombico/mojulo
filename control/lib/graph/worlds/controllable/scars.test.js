import { describe, it, expect } from 'vitest';
import { composeLive, EMISSION, emissionSource } from './compose.js';
import { rupaPhysics, readScarsSpec } from '../../rupa/index.js';

// scars: cosmetic damage on a map that may not change. A blow paints what it would do (a crater, a scorch, a chip) and
// throws what it would throw, by the laws a physical world breaks by; the colliders and the floor stay as they were.
const CW = composeLive();
const SCARS = readScarsSpec(true);
const wall = { min: [3, -2, 0], max: [3.4, 2, 3] };
const world = (rupa = { scars: SCARS }, colliders = [wall]) => CW.createWorld({ entities: [], colliders, rupa });
const step = (w, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };
const burst = (w, pos, radius) => { w.bursts.push({ seq: w.burstSeq++, pos, t: w.time, radius }); };
const marks = (w) => w.rupa.scars.marks;
const snap = (w) => JSON.stringify(w.colliders) + JSON.stringify(w.breakables) + (w.breakFloor ?? 0);

describe('scars: a blow paints what it would do and changes nothing', () => {
  it('a burst near the floor paints the crater its coupled energy would dig, and throws its dirt', () => {
    const w = world(), before = snap(w);
    burst(w, [0, 0, 0.5], 2);
    step(w);
    const c = marks(w).find((m) => m.kind === 'crater');
    const J = rupaPhysics.blowJoules('burst', w.rupa, { radius: 2 });
    const want = rupaPhysics.craterSize(J * (1 - 0.5 / 2), SCARS.ground.dig);
    expect(c.radius).toBeCloseTo(want.radius, 9);
    expect(c.depth).toBeCloseTo(0.4 * want.radius, 9);
    expect(c.at).toEqual([0, 0, 0]);
    expect(c.debris.clumps.length + c.debris.spray.parcels.length).toBeGreaterThan(0);
    expect(snap(w)).toBe(before);   // the map is the map
    expect(w.breaks).toEqual([]);
  });

  it('a burst higher than its reach paints no crater', () => {
    const w = world();
    burst(w, [0, 0, 2.5], 2);
    step(w);
    expect(marks(w).some((m) => m.kind === 'crater')).toBe(false);
  });

  it('a wall in reach is scorched on the face toward the blast, and what spalls off flies; one out of reach is not', () => {
    const w = world();
    burst(w, [2, 0, 1], 2);
    step(w);
    const s = marks(w).find((m) => m.kind === 'scorch');
    expect(s.normal).toEqual([-1, 0, 0]);
    expect(s.at[0]).toBe(3);
    expect(s.radius).toBeGreaterThan(0.03);
    expect(s.debris.pieces.length).toBeGreaterThan(0);
    const far = world();
    burst(far, [-5, 0, 1], 2);
    step(far);
    expect(marks(far).some((m) => m.kind === 'scorch')).toBe(false);
  });

  it('a steel wall dents instead of scorching, and throws nothing', () => {
    const w = world({ scars: readScarsSpec({ wall: 'steel' }) });
    burst(w, [2.5, 0, 1], 2);
    step(w);
    expect(marks(w).find((m) => m.kind !== 'crater')).toMatchObject({ kind: 'dent', debris: null });
  });

  it('a round that stops on a wall chips it; one that stops on the floor pocks it', () => {
    const gun = { id: 'gun', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } };
    const w = CW.createWorld({ entities: [gun], colliders: [wall], rupa: { scars: SCARS } }), e = w.byId.gun;
    e.lastShot = { mode: 'miss', t: w.time, from: [0, 0, 1.4], to: [3, 0, 1.4] };
    step(w);
    expect(marks(w).find((m) => m.kind === 'chip')).toMatchObject({ normal: [-1, 0, 0] });
    expect(marks(w).find((m) => m.kind === 'chip').debris.pieces.length).toBeGreaterThan(0);
    e.lastShot = { mode: 'miss', t: w.time, from: [0, 0, 1.4], to: [1, 1, 0] };
    step(w);
    expect(marks(w).find((m) => m.kind === 'pock')).toBeTruthy();
  });

  it('walls of their own matter, side by side, by where each stands: steel dents beside a brick chip, the rest the world\'s', () => {
    const at = (y0) => ({ min: [3, y0, 0], max: [3.4, y0 + 1, 3] });
    const spec = readScarsSpec({ wall: 'brick', walls: [{ ...at(0), matter: 'steel' }, { ...at(2), matter: 'pine' }] });
    expect(spec.walls.map((q) => q.wall.id)).toEqual(['steel', 'pine']);
    const gun = { id: 'gun', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } };
    const w = CW.createWorld({ entities: [gun], colliders: [at(-2), at(0), at(2)], rupa: { scars: spec } }), e = w.byId.gun;
    const shoot = (y) => { e.lastShot = { mode: 'miss', t: w.time, from: [0, y, 1.4], to: [3, y, 1.4] }; step(w); return marks(w).at(-1); };
    const brick = shoot(-1.5), steel = shoot(0.5), pine = shoot(2.5);
    expect(brick.kind).toBe('chip');
    expect(steel.kind).toBe('dent');
    expect(pine.kind).toBe('chip');
    expect(pine.bowl).not.toBe(brick.bowl);   // pine's own strength, not the world's brick
    // without `walls` the spec is as it was
    expect(readScarsSpec({ wall: 'brick' })).not.toHaveProperty('walls');
    expect(() => readScarsSpec({ walls: [{ ...at(0), matter: 'water' }] })).toThrow(/water is a liquid/);
    expect(() => readScarsSpec({ walls: [] })).toThrow(/walls is/);
  });

  it('a round marks with its gun\'s blow: a heavier round a wider chip; a shot parts into its pellets\' chips', () => {
    const gun = { id: 'gun', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } };
    const mark = (shot) => { const w = CW.createWorld({ entities: [gun], colliders: [wall], rupa: { scars: SCARS } }), e = w.byId.gun; e.lastShot = { mode: 'miss', t: w.time, from: [0, 0, 1.4], to: [3, 0, 1.4], ...shot }; step(w); return marks(w); };
    const world = mark({})[0], pistol = mark({ blow: 500 })[0], sniper = mark({ blow: 6000 })[0];
    expect(pistol.bowl).toBeLessThan(world.bowl);   // the world's round is 2000 J
    expect(sniper.bowl).toBeGreaterThan(world.bowl);
    const shot = mark({ blow: 3200, pellets: 9 });
    expect(shot).toHaveLength(9);
    expect(shot.every((m) => m.kind === 'chip' && m.bowl < world.bowl)).toBe(true);
    expect(new Set(shot.map((m) => m.at.join())).size).toBe(9);   // a pattern, not one hole
    expect(JSON.stringify(mark({ blow: 3200, pellets: 9 }))).toBe(JSON.stringify(shot));   // the same shot, the same pattern
  });

  it('a mark is the bowl the blow would crush: a round chips centimetres, a harder matter less; a burst blackens its disc', () => {
    const chip = (wall) => rupaPhysics.scarOf([3, 0, 1.4], [-1, 0, 0], rupaPhysics.blowJoules('shot', {}), readScarsSpec({ wall }).wall, { how: 'shot', faceSize: 3 });
    const brick = chip('brick'), stone = chip('stone');
    expect(brick.radius).toBeGreaterThan(0.02);
    expect(brick.radius).toBeLessThan(0.1);
    expect(stone.radius).toBeLessThan(brick.radius);
    const kg = (d) => d.pieces.reduce((t, p) => t + p.kg, 0) + (d.dust ? d.dust.kg : 0);
    expect(kg(brick.debris)).toBeCloseTo(0.2 * Math.PI * brick.radius ** 3 * readScarsSpec({ wall: 'brick' }).wall.density, 1);   // the bowl's mass flies
    const s = rupaPhysics.scarOf([3, 0, 1], [-1, 0, 0], 5e4, SCARS.wall, { how: 'burst', faceSize: 3, reach: 1.2 });
    expect(s.radius).toBe(1.2);
    expect(s.bowl).toBeLessThan(s.radius);
  });

  it('the same blows paint the same marks', () => {
    const run = () => { const w = world(); burst(w, [2, 0.3, 0.4], 2.5); step(w, 3); return JSON.stringify(marks(w)); };
    expect(run()).toBe(run());
  });

  it('without scars nothing is kept and the page carries none of it', () => {
    const w = CW.createWorld({ entities: [], colliders: [wall] });
    burst(w, [0, 0, 0.5], 2);
    step(w);
    expect(w.rupa).toBeUndefined();
    expect(emissionSource({})).not.toContain('rupa-scars');
    expect(emissionSource({ ...EMISSION, rupa: true })).toContain('rupa-scars');
  });
});

describe('the level\'s scars', () => {
  it('true is loam and brick; a cube gives its own ground and walls; a named matter wins', () => {
    expect(SCARS.ground.id).toBe('loam');
    expect(SCARS.wall.id).toBe('brick');
    const cube = { ground: { matter: 'sand' }, wall: { matter: 'stone' } };
    expect(readScarsSpec(true, { cube })).toMatchObject({ ground: { id: 'sand' }, wall: { id: 'stone' } });
    expect(readScarsSpec({ wall: 'concrete' }, { cube }).wall.id).toBe('concrete');
  });

  it('a floor that is no soil digs by its toughness and throws chunks', () => {
    const s = readScarsSpec({ ground: 'stone' });
    expect(s.ground.dig).toBeGreaterThan(readScarsSpec(true).ground.dig);
  });

  it('refuses a liquid, an unknown key, and absence is null', () => {
    expect(() => readScarsSpec({ wall: 'water' })).toThrow(/liquid/);
    expect(() => readScarsSpec({ roof: 'brick' })).toThrow(/roof/);
    expect(readScarsSpec(undefined)).toBeNull();
    expect(readScarsSpec(false)).toBeNull();
  });
});
