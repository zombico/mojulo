import { describe, it, expect } from 'vitest';
import {
  CAR_NETS, getCarNet, getCarCard, resolveCarNet, buildCarNetSceneShapes,
  SEDAN_BODY, greenhouse,
} from './vehicle-swept-net.js';

const PLACE = { cx: 4, noseY: 8 };
const camPos = [9, 12, 3.2];                          // 3/4 front so the front cap + near side face the camera
const projectPoint = (w) => [w[1] * 40, 400 - w[2] * 40];

describe('vehicle-swept-net — car family', () => {
  it('registers sedan / suv / limo / taxi and resolves their cards', () => {
    expect(Object.keys(CAR_NETS)).toEqual(['sedan', 'suv', 'limo', 'taxi']);
    const sedan = resolveCarNet('sedan');
    expect(sedan.body.id).toBe('sedan-body');
    expect(sedan.front.id).toBe('sedan-front');
    expect(sedan.seN).toBe(3.3);
    expect(sedan.accessories).toEqual([]);
    // taxi reuses sedan geometry verbatim
    const taxi = resolveCarNet('taxi');
    expect(taxi.length).toBe(sedan.length);
    expect(taxi.zTop).toEqual(sedan.zTop);
  });

  it('throws on an unknown net', () => {
    expect(() => resolveCarNet('hovercraft')).toThrow(/unknown net/);
  });

  it('builds depth-sorted, strokeless scene shapes for each registered car', () => {
    for (const id of Object.keys(CAR_NETS)) {
      const { resolved, shapes } = buildCarNetSceneShapes(id, { place: PLACE, projectPoint, cameraPosition: camPos, ns: 40, na: 40 });
      expect(resolved.body.id).toMatch(/-body$/);
      expect(shapes.length).toBeGreaterThan(100);
      for (const s of shapes) {
        expect(s.type).toBe('poly');
        expect(s.stroke).toBe('none');                 // pure vexar = strokeless
        expect(s.fill).toMatch(/^#[0-9a-f]{6}$/i);
      }
      // body cells culled to roughly the camera-facing half
      const body = shapes.filter((s) => s.role.startsWith(`${resolved.body.id}:`));
      expect(body.length).toBeLessThan(40 * 40);
      // front fascia + wheels present
      expect(shapes.some((s) => s.role.startsWith(`${resolved.front.id}:`))).toBe(true);
      expect(shapes.some((s) => s.role === 'wheel')).toBe(true);
    }
  });

  it('emits real accessory box faces (taxi roof sign, SUV roof rails)', () => {
    const taxi = buildCarNetSceneShapes('taxi', { place: PLACE, projectPoint, cameraPosition: camPos });
    expect(taxi.shapes.some((s) => s.role === 'accessory:roof-sign')).toBe(true);
    const suv = buildCarNetSceneShapes('suv', { place: PLACE, projectPoint, cameraPosition: camPos });
    expect(suv.shapes.some((s) => s.role.startsWith('accessory:roof-rail'))).toBe(true);
    // sedan has no accessories
    const sedan = buildCarNetSceneShapes('sedan', { place: PLACE, projectPoint, cameraPosition: camPos });
    expect(sedan.shapes.some((s) => s.role.startsWith('accessory:'))).toBe(false);
  });

  it('the limo lofts a longer body + 3rd axle vs the sedan', () => {
    const sedan = resolveCarNet('sedan'), limo = resolveCarNet('limo');
    expect(limo.length).toBeGreaterThan(sedan.length * 2);
    expect(limo.axles.length).toBe(3);
    expect(sedan.axles.length).toBe(2);
  });

  it('greenhouse() returns a closed (u,v) capsule outline; getCarCard resolves by id', () => {
    const pts = greenhouse(0.34, 0.2675);
    expect(pts.length).toBeGreaterThan(8);
    expect(pts.every((p) => typeof p.u === 'number' && typeof p.v === 'number')).toBe(true);
    expect(getCarCard('sedan-body')).toBe(SEDAN_BODY);
    expect(getCarCard(SEDAN_BODY)).toBe(SEDAN_BODY);
    expect(getCarCard('nope')).toBeNull();
    expect(getCarNet('sedan').label).toBe('Sedan');
  });
});
