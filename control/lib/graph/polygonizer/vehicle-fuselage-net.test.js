import { describe, it, expect } from 'vitest';
import {
  resolveFuselageNet,
  buildFuselageNetSceneShapes,
  sampleStickerCard,
  stickerContext,
  getAircraftCard,
  AIRCRAFT_LIVERY,
} from './vehicle-fuselage-net.js';

const BODY = { center: [4, 4], axisZ: 2.4, noseY: 8, length: 6, radius: 0.6 };
// simple side-on orthographic-ish projector: world [x,y,z] → screen [x', y']
const camPos = [13, 5, 4.1];
const projectPoint = (w) => [w[1] * 40, 400 - w[2] * 40];

describe('vehicle-fuselage-net', () => {
  it('resolves the jet net with its livery + appendage cards', () => {
    const net = resolveFuselageNet('jet');
    expect(net.conceptId).toBe('vehicle.aircraft.narrowbody-jet');
    expect(net.fuselage.livery.id).toBe('aircraft-livery');
    expect(net.appendages.map((a) => a.card.id)).toEqual(['aircraft-wing', 'aircraft-stab', 'aircraft-fin']);
  });

  it('throws on an unknown net', () => {
    expect(() => resolveFuselageNet('zeppelin')).toThrow(/unknown net/);
  });

  it('samples the livery card: lengthwise bands, encircling wraps, window repeats', () => {
    const ctx = stickerContext(AIRCRAFT_LIVERY, BODY.length, 2 * Math.PI * BODY.radius);
    expect(sampleStickerCard(AIRCRAFT_LIVERY, 0.4, 0.0, ctx)).toBe('#123c7a');  // belly band (v=0, wraps)
    expect(sampleStickerCard(AIRCRAFT_LIVERY, 0.4, 0.25, ctx)).toBe('#27333c'); // starboard window row
    expect(sampleStickerCard(AIRCRAFT_LIVERY, 0.4, 0.5, ctx)).toBe('#eef1f4');  // bare roof = base white
    // encircling tail wrap: same station hits at every v (it goes all the way around)
    expect(sampleStickerCard(AIRCRAFT_LIVERY, 0.85, 0.1, ctx)).toBe('#c0392b');
    expect(sampleStickerCard(AIRCRAFT_LIVERY, 0.85, 0.6, ctx)).toBe('#c0392b');
  });

  it('builds depth-sorted scene shapes (fuselage + appendages) as projected polys', () => {
    const { resolved, shapes } = buildFuselageNetSceneShapes('jet', { body: BODY, projectPoint, cameraPosition: camPos, stations: 40, angles: 40 });
    expect(resolved.fuselage.livery.id).toBe('aircraft-livery');
    expect(shapes.length).toBeGreaterThan(100);
    for (const s of shapes) { expect(s.type).toBe('poly'); expect(s.points).toHaveLength(4); expect(s.fill).toMatch(/^#[0-9a-f]{6}$/i); }
    // back-face culling keeps roughly the camera-facing half of the fuselage cells
    const fuse = shapes.filter((s) => s.role.startsWith('aircraft-livery:'));
    expect(fuse.length).toBeLessThan(40 * 40);
    // every appendage card shows up
    for (const id of ['aircraft-wing', 'aircraft-stab', 'aircraft-fin']) {
      expect(shapes.some((s) => s.role.startsWith(`${id}:`))).toBe(true);
    }
  });

  it('getAircraftCard resolves by id and passes objects through', () => {
    expect(getAircraftCard('aircraft-fin').id).toBe('aircraft-fin');
    expect(getAircraftCard(AIRCRAFT_LIVERY)).toBe(AIRCRAFT_LIVERY);
    expect(getAircraftCard('nope')).toBeNull();
  });
});
