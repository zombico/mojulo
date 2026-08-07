import { describe, expect, it } from 'vitest';

import { assembleBoxCityScene, assembleRoomScene, contactShadowDecals } from './scene-css3d.js';
import { getRoomFurnitureAsset } from '../architecture/room-assets.js';

describe('scene-css3d landmarks', () => {
  it('expands the CN Tower as a tall shaft with a wide observation pod', () => {
    const side = 6.2;
    const scene = assembleBoxCityScene({
      boxes: [{ x: -side / 2, y: -side / 2, w: side, d: side, z0: 0, shape: 'cn-tower' }],
      grounds: [{ x: -10, y: -10, w: 20, d: 20, z: 0, fill: '#bec4bc' }],
      cameras: [{ name: 'test', worldFraming: { cameraPosition: [-14, 18, 10], lookAt: [0, 0, 9.5] } }],
    });

    const landmarkFaces = scene.faces.slice(1);
    const points = landmarkFaces.flatMap((f) => f.corners);
    const maxZ = Math.max(...points.map((p) => p[2]));
    const podPoints = points.filter((p) => p[2] > side * 2 && p[2] < side * 2.35);
    const maxPodRadius = Math.max(...podPoints.map(([x, y]) => Math.hypot(x, y)));

    expect(landmarkFaces.length).toBeGreaterThan(120);
    expect(maxZ).toBeGreaterThan(side * 3.2);
    expect(maxPodRadius).toBeGreaterThan(side * 0.21);
  });

  it('expands Rogers Centre / SkyDome as a low oval stadium landmark', () => {
    const scene = assembleBoxCityScene({
      boxes: [{ x: -5, y: -3, w: 10, d: 6, z0: 0, shape: 'rogers-centre' }],
      grounds: [{ x: -10, y: -8, w: 20, d: 16, z: 0, fill: '#bec4bc' }],
      cameras: [{ name: 'test', worldFraming: { cameraPosition: [-12, 18, 7], lookAt: [0, 0, 2] } }],
    });

    const landmarkFaces = scene.faces.slice(1);
    const points = landmarkFaces.flatMap((f) => f.corners);
    const xSpan = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
    const ySpan = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
    const zSpan = Math.max(...points.map((p) => p[2])) - Math.min(...points.map((p) => p[2]));
    const roofFaces = landmarkFaces.filter((f) => {
      const z = f.corners.reduce((sum, p) => sum + p[2], 0) / f.corners.length;
      const r = Math.max(...f.corners.map(([x, y]) => Math.hypot(x / 5, y / 3)));
      return z > 2.8 && r < 0.38;
    });

    expect(landmarkFaces.length).toBeGreaterThan(120);
    expect(xSpan).toBeGreaterThan(ySpan);
    expect(zSpan).toBeLessThan(4.5);
    expect(roofFaces).toHaveLength(0);
  });

  it('expands the Taj Mahal as a wide, dome-dominated composition with corner minarets', () => {
    const side = 6;
    const scene = assembleBoxCityScene({
      boxes: [{ x: -side / 2, y: -side / 2, w: side, d: side, z0: 0, shape: 'taj' }],
      grounds: [{ x: -10, y: -10, w: 20, d: 20, z: 0, fill: '#bec4bc' }],
      cameras: [{ name: 'test', worldFraming: { cameraPosition: [-14, 18, 10], lookAt: [0, 0, 4] } }],
    });

    const landmarkFaces = scene.faces.slice(1);
    const points = landmarkFaces.flatMap((f) => f.corners);
    const xSpan = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
    const ySpan = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
    const zSpan = Math.max(...points.map((p) => p[2])) - Math.min(...points.map((p) => p[2]));
    // The tallest point is the central dome's finial, which sits over the centre.
    const top = points.reduce((acc, p) => (p[2] > acc[2] ? p : acc), points[0]);
    const topRadius = Math.hypot(top[0], top[1]);
    // The four minarets rise at the plinth corners — tall, but below the central dome.
    const cornerTall = points.filter((p) => p[2] > side * 0.45 && Math.hypot(p[0], p[1]) > side * 0.55);
    const maxCornerZ = Math.max(...cornerTall.map((p) => p[2]));

    // Threading cityBox through ctx is what makes this path distinct from the other landmarks.
    expect(landmarkFaces.length).toBeGreaterThan(500);
    expect(xSpan).toBeCloseTo(ySpan, 5); // square plan
    expect(xSpan).toBeGreaterThan(zSpan); // reads wider than it is tall
    expect(topRadius).toBeLessThan(side * 0.1); // dome finial is centred
    expect(cornerTall.length).toBeGreaterThan(0); // minarets present
    expect(maxCornerZ).toBeLessThan(top[2]); // central dome dominates the minarets
  });

  it('expands a colosseum as an open-top elliptical arcade with arched bays', () => {
    const scene = assembleBoxCityScene({
      boxes: [{ x: -4, y: -3.4, w: 8, d: 6.8, z0: 0, shape: 'colosseum' }],
      grounds: [{ x: -10, y: -10, w: 20, d: 20, z: 0, fill: '#bec4bc' }],
      cameras: [{ name: 'test', worldFraming: { cameraPosition: [-12, 16, 9], lookAt: [0, 0, 2] } }],
    });
    const faces = scene.faces.slice(1);
    const arches = faces.filter((f) => typeof f.radius === 'string'); // rounded arched openings
    const points = faces.flatMap((f) => f.corners);
    const xSpan = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
    const zSpan = Math.max(...points.map((p) => p[2])) - Math.min(...points.map((p) => p[2]));
    expect(faces.length).toBeGreaterThan(200);
    expect(arches.length).toBeGreaterThan(20);     // a ring of arcade openings
    expect(xSpan).toBeGreaterThan(zSpan * 2);       // reads as a low, wide amphitheatre
  });

  it('expands a domed arena as a low drum under a ribbed dome', () => {
    const scene = assembleBoxCityScene({
      boxes: [{ x: -4, y: -3.6, w: 8, d: 7.2, z0: 0, shape: 'arena' }],
      grounds: [{ x: -10, y: -10, w: 20, d: 20, z: 0, fill: '#bec4bc' }],
      cameras: [{ name: 'test', worldFraming: { cameraPosition: [-12, 16, 9], lookAt: [0, 0, 2] } }],
    });
    const faces = scene.faces.slice(1);
    const points = faces.flatMap((f) => f.corners);
    const maxZ = Math.max(...points.map((p) => p[2]));
    // the dome closes to a centred apex well above the drum
    const top = points.reduce((acc, p) => (p[2] > acc[2] ? p : acc), points[0]);
    expect(faces.length).toBeGreaterThan(200);
    expect(maxZ).toBeGreaterThan(7.2 * 0.5);
    expect(Math.hypot(top[0], top[1])).toBeLessThan(7.2 * 0.2); // apex over the centre
  });

  it('expands Tokyo Skytree as a tall lattice tower with two observation decks', () => {
    const side = 6;
    const scene = assembleBoxCityScene({
      boxes: [{ x: -side / 2, y: -side / 2, w: side, d: side, z0: 0, shape: 'skytree' }],
      grounds: [{ x: -10, y: -10, w: 20, d: 20, z: 0, fill: '#bec4bc' }],
      cameras: [{ name: 'test', worldFraming: { cameraPosition: [-14, 22, 13], lookAt: [0, 0, 14] } }],
    });

    const landmarkFaces = scene.faces.slice(1);
    const points = landmarkFaces.flatMap((f) => f.corners);
    const maxZ = Math.max(...points.map((p) => p[2]));
    const basePoints = points.filter((p) => p[2] < side * 0.16);
    const lowerDeckPoints = points.filter((p) => p[2] > side * 2.35 && p[2] < side * 2.68);
    const upperDeckPoints = points.filter((p) => p[2] > side * 3.24 && p[2] < side * 3.48);
    const maxBaseRadius = Math.max(...basePoints.map(([x, y]) => Math.hypot(x, y)));
    const maxLowerDeckRadius = Math.max(...lowerDeckPoints.map(([x, y]) => Math.hypot(x, y)));
    const maxUpperDeckRadius = Math.max(...upperDeckPoints.map(([x, y]) => Math.hypot(x, y)));

    expect(landmarkFaces.length).toBeGreaterThan(260);
    expect(maxZ).toBeGreaterThan(side * 4.8);
    expect(maxBaseRadius).toBeGreaterThan(side * 0.42);
    expect(maxLowerDeckRadius).toBeGreaterThan(side * 0.34);
    expect(maxUpperDeckRadius).toBeGreaterThan(side * 0.2);
    expect(maxLowerDeckRadius).toBeGreaterThan(maxUpperDeckRadius);
  });

});

describe('assembleRoomScene (room → World payload)', () => {
  // minimal eligible two-point room: roomBasisFromPureMandala accepts an empty room (defaults)
  const room = (scene) => ({ cameraPrimitive: { kind: 'two-point' }, pureMandala: { room: {} }, ...(scene ? { scene } : {}) });
  const groups = (payload) => new Set(payload.faces.filter((f) => f.group).map((f) => f.group));

  it('returns null for a manifest that is not an eligible room', () => {
    expect(assembleRoomScene({})).toBeNull();
    expect(assembleRoomScene({ kind: 'fractal-city' })).toBeNull();
  });

  it('assembles a payload with tagged + normalled shell walls and at least one camera', () => {
    const p = assembleRoomScene(room());
    expect(p).toBeTruthy();
    expect(p.cameras.length).toBeGreaterThan(0);
    expect(p.faces.some((f) => f.group === 'shell:backWall' && Array.isArray(f.normal))).toBe(true);
    expect(groups(p).has('shell:frontWall')).toBe(false); // open-front by default (camera side)
  });

  it('immersive mode encloses the room (front wall present)', () => {
    expect(groups(assembleRoomScene(room({ roomMode: 'immersive' }))).has('shell:frontWall')).toBe(true);
  });

  it('showcase mode drops the right wall + ceiling, keeps the back corner', () => {
    const g = groups(assembleRoomScene(room({ roomMode: 'showcase' })));
    expect(g.has('shell:rightWall')).toBe(false);
    expect(g.has('shell:ceiling')).toBe(false);
    expect(g.has('shell:backWall')).toBe(true);
  });

  it('explicit scene.shellOmit overrides the mode presets', () => {
    const g = groups(assembleRoomScene(room({ shellOmit: ['ceiling'] })));
    expect(g.has('shell:ceiling')).toBe(false);
    expect(g.has('shell:frontWall')).toBe(true); // not omitted → present
  });

  it('places the rectangular modern couch as a tagged workbench room-furniture asset', () => {
    const p = assembleRoomScene({
      cameraPrimitive: { kind: 'two-point' },
      pureMandala: { room: { floor: { x: [0, 8], y: [0, 6] }, ceilingZ: 3 } },
      polygonizer: { roomConcept: { elements: [{ type: 'modern-couch', anchor: [0.5, 0.68] }] } },
      scene: { shellOmit: ['frontWall', 'ceiling'] },
    });
    const couchFaces = p.faces.filter((f) => f.group === 'asset:modern-couch');
    const asset = getRoomFurnitureAsset('modern-sofa');

    expect(asset.class).toBe('room-furniture');
    expect(asset.tags.rooms).toContain('living-room');
    expect(asset.tags.styles).toContain('modern');
    expect(couchFaces.length).toBeGreaterThan(30);
    expect(p.faces.some((f) => f.decal === 'shadow')).toBe(false);
  });
});

describe('contactShadowDecals options', () => {
  const fp = (height) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], height });

  it('fades alpha with height by default, but holds it flat when fade:false (city buildings)', () => {
    const tall = fp(8);
    expect(contactShadowDecals([tall], { strength: 0.5 })[0].shadowAlpha).toBeLessThan(0.1);        // furniture fade
    expect(contactShadowDecals([tall], { strength: 0.5, fade: false })[0].shadowAlpha).toBeCloseTo(0.5, 5);
  });

  it('translates the decal quad by a per-footprint offset (directional cast)', () => {
    const [d0] = contactShadowDecals([fp(3)]);
    const [d1] = contactShadowDecals([{ ...fp(3), offset: [5, -2] }]);
    const cx = (q) => q.reduce((s, p) => s + p[0], 0) / 4, cy = (q) => q.reduce((s, p) => s + p[1], 0) / 4;
    expect(cx(d1.corners) - cx(d0.corners)).toBeCloseTo(5, 5);
    expect(cy(d1.corners) - cy(d0.corners)).toBeCloseTo(-2, 5);
  });
});

describe('assembleBoxCityScene groundShadows (opt-in)', () => {
  const city = (groundShadows) => assembleBoxCityScene({
    boxes: [{ x: 0, y: 0, w: 4, d: 4, z0: 0, z1: 8 }, { x: 8, y: 0, w: 3, d: 3, z0: 0, z1: 5 }],
    grounds: [{ x: -4, y: -4, w: 20, d: 16, z: 0, fill: '#888' }],
    sources: [{ pos: [30, -10, 36], dir: [-0.34, 0.43, -0.83], spread: 40, color: [1, 0.95, 0.82], intensity: 2.5, rays: 40, fixture: false }],
    diffusion: { soft: true, gain: 1.5, shadows: true },
    cameras: [{ name: 't', worldFraming: { cameraPosition: [-8, 20, 12], lookAt: [4, 2, 2] } }],
    groundShadows,
  });

  it('emits no per-building shadow decal when off (default)', () => {
    expect(city(false).faces.filter((f) => f.decal === 'shadow')).toHaveLength(0);
  });

  it('emits one tagged ground decal per building when on, offset along the light', () => {
    const decals = city(true).faces.filter((f) => f.decal === 'shadow');
    expect(decals).toHaveLength(2);                 // one per building footprint
    expect(decals.every((d) => d.shadowAlpha > 0.2)).toBe(true); // not faded to nothing (fade:false)
    // offset downstream of the light dir (+x is negative, +y positive) → centroid shifts off the base
    const c = decals[0].corners.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    expect(c[1]).toBeGreaterThan(2); // building base spans y∈[0,4] (centre 2); shadow pushed +y
  });
});
