import { describe, it, expect } from 'vitest';
import { readLibraryBody, libraryFaces } from './library.js';
import { solveClassical } from './classical/solve.js';
import { planClassicalWorld } from './classical/world.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { FLEET } from '../roads/fleet.js';
import { CLASS_MATTER, MATTER } from '../rupa/matter.js';

// A thing from the libraries as a classical body: one case per kind (a vehicle with a loft, a vehicle drawn as its box,
// a part from its class matter), the contact sphere, the drawing, the refusals.

const road = (bodies, duration = 1) => ({ bodies, laws: [{ law: 'gravity-uniform' }, { law: 'plane', mu: 0.5 }], duration });
const partWithShare = () => Object.keys(CLASS_MATTER).find((k) => CLASS_MATTER[k].fill !== undefined && CLASS_MATTER[k].fill < 1);

describe('science worlds: library things as classical bodies', () => {
  it('takes a vehicle\'s mass from the physics table and its size from the fleet, its contact sphere the box\'s diagonal', () => {
    const lib = readLibraryBody({ vehicle: 'sedan' }, 'as');
    expect(lib.mesh).toBe('loft');
    expect(lib.mass).toBe(PHYSICS[lib.fleet]?.mass ?? lib.mass);
    expect(lib.dims).toEqual([FLEET[lib.fleet].L, FLEET[lib.fleet].W, FLEET[lib.fleet].H]);
    expect(lib.R).toBeCloseTo(Math.hypot(...lib.dims) / 2, 12);
    const r = solveClassical({ model: road([{ id: 'car', as: { vehicle: 'sedan' }, at: [0, 0, lib.R], on_plane: undefined }]) });
    expect(r.model.bodies[0].radius).toBeCloseTo(lib.R, 12);
    expect(r.model.bodies[0].mass).toBe(lib.mass);
  });

  it('gives a part its class\'s matter and solid share, and its mass from both and its box', () => {
    const cls = partWithShare(), { matter, fill } = CLASS_MATTER[cls];
    const lib = readLibraryBody({ part: cls, size: [0.5, 0.4, '30 cm'] }, 'as');
    expect(lib.matter.id).toBe(matter);
    expect(lib.mass).toBeCloseTo(MATTER[matter].density * 0.5 * 0.4 * 0.3 * fill, 9);
    const r = solveClassical({ model: road([{ id: 'p', as: { part: cls, size: [0.5, 0.4, 0.3] }, at: [0, 0, 1] }]) });
    expect(r.matter.bodies.p.mass.from).toMatch(/× its box/);
  });

  it('draws a thing as itself, base down in its contact sphere, nose the way it first moves; a vehicle with no loft as its box', () => {
    const lib = readLibraryBody({ vehicle: 'sedan' }, 'as');
    const f = libraryFaces(lib, 0, '#888', 'g');
    expect(Math.min(...f.flatMap((q) => q.corners.map((p) => p[2])))).toBeCloseTo(-lib.R, 1);
    const turned = libraryFaces(lib, Math.PI / 2, '#888', 'g');
    const span = (fs, k) => Math.max(...fs.flatMap((q) => q.corners.map((p) => p[k]))) - Math.min(...fs.flatMap((q) => q.corners.map((p) => p[k])));
    expect(span(turned, 1)).toBeCloseTo(span(f, 0), 6);
    const boxed = Object.keys(PHYSICS).length && readLibraryBody({ vehicle: 'sports car' }, 'as');
    expect(boxed.mesh).toBe('box');
    const plan = planClassicalWorld({ kind: 'classical-view', model: road([{ id: 'car', as: { vehicle: 'sedan' }, at: [0, 0, 3], v: [0, 2, 0] }]) });
    expect(plan.faces.some((q) => q.group === 'body:car')).toBe(true);
    expect(plan.planets.some((q) => q.group === 'body:car')).toBe(false);
    expect(plan.drawn.some((d) => /drawn as the sedan/.test(d.what))).toBe(true);
  });

  it('refuses an unknown word, a radius beside it, and a vehicle whose mass no table holds', () => {
    expect(() => readLibraryBody({ vehicle: 'flying carpet' }, 'as')).toThrow(/no vehicle/);
    expect(() => readLibraryBody({ part: 'crate' }, 'as')).toThrow(/size/);
    expect(() => solveClassical({ model: road([{ id: 'c', as: { vehicle: 'sedan' }, radius: 1, at: [0, 0, 3] }]) })).toThrow(/its size is the/);
    expect(() => readLibraryBody({ vehicle: 'tank' }, 'as')).toThrow(/in no table yet/);
  });
});
