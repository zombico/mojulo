import { describe, it, expect } from 'vitest';
import {
  resolveSmoothBoxNet,
  buildSmoothBoxNetSceneShapes,
  getSmoothBoxCard,
  SMOOTH_BOX_NETS,
  BUS_BODY,
} from './vehicle-smooth-box-net.js';

const PLACE = { cx: 4, noseY: 7.5 };
const camPos = [10, 12, 4.4];   // 3/4 front, so the front cap faces the camera (not culled)
const projectPoint = (w) => [w[1] * 40, 400 - w[2] * 40];

describe('vehicle-smooth-box-net', () => {
  it('registers bus / van / truck and resolves their cards', () => {
    expect(Object.keys(SMOOTH_BOX_NETS)).toEqual(['city-bus', 'box-van', 'box-truck', 'delivery-truck', 'streetcar']);
    const bus = resolveSmoothBoxNet('city-bus');
    expect(bus.body.id).toBe('bus-body');
    expect(bus.front.id).toBe('bus-front');
    expect(bus.geo.seN).toBe(6);
    expect(bus.profile).toBeNull();                       // uniform section
    const truck = resolveSmoothBoxNet('box-truck');
    expect(truck.profile).toBeTruthy();                   // cab→box loft
  });

  it('throws on an unknown net', () => {
    expect(() => resolveSmoothBoxNet('hovercraft')).toThrow(/unknown net/);
  });

  it('builds depth-sorted, strokeless scene shapes for each registered net', () => {
    for (const id of Object.keys(SMOOTH_BOX_NETS)) {
      const { resolved, shapes } = buildSmoothBoxNetSceneShapes(id, { place: PLACE, projectPoint, cameraPosition: camPos, ns: 40, na: 40 });
      expect(resolved.body.id).toMatch(/-body$/);
      expect(shapes.length).toBeGreaterThan(100);
      for (const s of shapes) {
        expect(s.type).toBe('poly');
        expect(s.stroke).toBe('none');                    // pure vexar = strokeless
        expect(s.fill).toMatch(/^#[0-9a-f]{6}$/i);
      }
      // body cells get culled to roughly the camera-facing half
      const body = shapes.filter((s) => s.role.startsWith(`${resolved.body.id}:`));
      expect(body.length).toBeLessThan(40 * 40);
      // front + rear fascia present; wheels too EXCEPT the rail-borne streetcar (no axles)
      expect(shapes.some((s) => s.role.startsWith(`${resolved.front.id}:`))).toBe(true);
      expect(shapes.some((s) => s.role === 'wheel')).toBe(resolved.axles.length > 0);
    }
  });

  it('the box truck loft plants the belly and steps the roofline up (cab < box)', () => {
    // cab cross-section (front) is shorter than the box (rear): compare half-heights via the geo+profile
    const t = resolveSmoothBoxNet('box-truck');
    const hCab = t.geo.halfH * t.profile[0].h;
    const hBox = t.geo.halfH * t.profile[t.profile.length - 1].h;
    expect(hCab).toBeLessThan(hBox);
  });

  it('the streetcar is long, BUS-WIDTH, with curved (tapered) ends and a roof pantograph', () => {
    const bus = resolveSmoothBoxNet('city-bus'), tram = resolveSmoothBoxNet('streetcar');
    expect(tram.geo.length).toBeGreaterThan(bus.geo.length * 2);   // ~2.5× the bus, long + articulated
    expect(tram.geo.halfW).toBe(bus.geo.halfW);                    // exactly as wide as the bus
    expect(tram.wid).toBeTruthy();                                // nose/tail taper → curved ends
    expect(tram.wid[0].h).toBeLessThan(1);                        // pinched at the very nose
    expect(tram.accessories.some((a) => a.role === 'pantograph')).toBe(true);
    // the taper actually narrows the body: a nose facet is thinner than a mid facet
    const { shapes } = buildSmoothBoxNetSceneShapes('streetcar', { place: PLACE, projectPoint, cameraPosition: camPos, ns: 20, na: 20, cull: false });
    expect(shapes.some((s) => s.role === 'accessory:pantograph')).toBe(true);
  });

  it('getSmoothBoxCard resolves by id and passes objects through', () => {
    expect(getSmoothBoxCard('bus-front').id).toBe('bus-front');
    expect(getSmoothBoxCard(BUS_BODY)).toBe(BUS_BODY);
    expect(getSmoothBoxCard('nope')).toBeNull();
  });
});
