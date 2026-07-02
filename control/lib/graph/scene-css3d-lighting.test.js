/**
 * Codifies the unified room LIGHTING model: a single `lighting` object on the room
 * path carries the whole layered stack, and — the consolidation's point — a LONE
 * room (not just a suite) can declare traced diffusion `sources` and get them baked
 * locally, with the legacy positional params still honoured.
 */

import { describe, it, expect } from 'vitest';
import { extractRoomSceneFaces, contactShadowDecals, resolveSceneLighting, extractRoomFacesFromManifest } from './scene/scene-css3d.js';
import { makeLight } from './polygonizer/vexar.js';

const ROOM = { worldExtent: { width: 5, depth: 5, height: 3 }, xRange: [0, 5], yRange: [0, 5], zRange: [0, 3] };
const ELEMENTS = [{ type: 'table', anchor: [0.5, 0.5], heightWorld: 0.76 }];
const bright = (hex) => { const n = parseInt(String(hex).slice(1), 16); return (n >> 16) + ((n >> 8) & 255) + (n & 255); };

describe('unified room lighting model', () => {
  it('resolves a single room with a traced diffusion source (the consolidation)', () => {
    const base = extractRoomSceneFaces({ elements: ELEMENTS, roomBasis: ROOM, lighting: { vexar: { ambient: 0.4 }, tint: [1, 1, 1] } });
    const lit = extractRoomSceneFaces({
      elements: ELEMENTS, roomBasis: ROOM,
      lighting: {
        vexar: { ambient: 0.4 }, tint: [1, 1, 1],
        sources: [{ at: [0.5, 0.5], height: 0.95, color: [1, 0.9, 0.7], intensity: 1.4, rays: 80, bounces: 2 }],
        diffusion: { gain: 1.2 },
      },
    });

    // the source was resolved from mandala fractions to a world position inside the room
    expect(lit.sources).toHaveLength(1);
    expect(lit.sources[0].pos).toHaveLength(3);
    expect(lit.sources[0].pos[2]).toBeCloseTo(3 * 0.95, 5);

    // a visible emissive fixture was added, and the bake brightened the floor (faces[0])
    expect(lit.faces.some((f) => typeof f.glow === 'string')).toBe(true);
    expect(lit.faces.length).toBeGreaterThan(base.faces.length);
    expect(bright(lit.faces[0].fill)).toBeGreaterThan(bright(base.faces[0].fill));
  });

  it('defers the bake when asked, returning resolved sources for a larger scene', () => {
    const deferred = extractRoomSceneFaces({
      elements: ELEMENTS, roomBasis: ROOM, deferDiffusion: true,
      lighting: { sources: [{ at: [0.5, 0.5], height: 0.9, intensity: 1 }] },
    });
    expect(deferred.sources).toHaveLength(1);
    expect(deferred.faces.some((f) => typeof f.glow === 'string')).toBe(false); // no fixture yet (caller bakes)
  });

  it('still honours the legacy positional params (back-compat)', () => {
    const out = extractRoomSceneFaces({ elements: ELEMENTS, roomBasis: ROOM, light: makeLight({ ambient: 0.5 }), tint: [1, 1, 1], gravityDarken: true });
    expect(out.faces.length).toBeGreaterThan(0);
    expect(out.sources).toEqual([]);
  });

  it('contact shadows — a dark under-object decal per footprint, fainter when taller', () => {
    const fp = [[1, 1, 0], [2, 1, 0], [2, 2, 0], [1, 2, 0]];
    const [low] = contactShadowDecals([{ corners: fp, height: 0.5 }]);
    const [high] = contactShadowDecals([{ corners: fp, height: 3 }]);
    expect(low.bg).toContain('rgba(0,0,0');
    expect(low.corners[0][2]).toBeCloseTo(0.02, 5); // lifted just above the floor
    const alpha = (d) => parseFloat(d.bg.match(/rgba\(0,0,0,([\d.]+)\)/)[1]);
    expect(alpha(high)).toBeLessThan(alpha(low)); // taller piece → fainter contact shadow
  });

  it('emits a contact decal under each elevated piece (independent of light sources)', () => {
    const out = extractRoomSceneFaces({
      elements: [{ type: 'stool', anchor: [0.5, 0.5], heightWorld: 0.8 }, { type: 'rug', anchor: [0.5, 0.5] }],
      roomBasis: ROOM, lighting: { diffusion: { contact: true } },
    });
    expect(out.contactFootprints).toHaveLength(1); // the stool, not the flat rug
    expect(out.faces.filter((f) => typeof f.bg === 'string' && f.bg.includes('rgba(0,0,0')).length).toBe(1);
  });
});

describe('declarative scene lighting (the model-facing dials)', () => {
  const ROOM_MANIFEST = (scene) => ({
    cameraPrimitive: { kind: 'two-point', worldFraming: { cameraPosition: [-6, 27, 8.5], lookAt: [12, 7, 5.2], horizontalFov: 80 } },
    polygonizer: { pureMandala: { room: { floor: { x: [0, 24], y: [0, 18] }, ceilingZ: 11 } }, roomConcept: { elements: [{ type: 'table', anchor: [0.5, 0.5] }] } },
    scene,
  });

  it('resolveSceneLighting: a `time` preset, with explicit fields overriding it', () => {
    expect(resolveSceneLighting({}).lighting).toBeNull();           // nothing declared → keep defaults
    const night = resolveSceneLighting({ scene: { time: 'night' } });
    expect(night.sky.preset).toBe('night');
    expect(night.lighting.vexar.ambient).toBeLessThan(0.4);          // night is dim
    const custom = resolveSceneLighting({ scene: { time: 'day', lighting: { tint: [1, 0.5, 0.5], sources: [{ at: [0.5, 0.5], intensity: 1 }] } } });
    expect(custom.lighting.tint).toEqual([1, 0.5, 0.5]);             // explicit tint wins
    expect(custom.lighting.sources).toHaveLength(1);                 // sources passed through
    expect(custom.sky.preset).toBe('day');                          // sky still from the preset
  });

  it("`flat` mode is the technical default — even shade, no gravity / atmosphere / sky", () => {
    const flat = resolveSceneLighting({ scene: { lighting: 'flat' } });
    expect(flat.sky).toBeNull();                          // no atmosphere
    expect(flat.lighting.gravity).toBe(false);            // no contact shadow
    expect(flat.lighting.vexar.ambient).toBeGreaterThan(0.7); // high ambient = flat/even, form-legible
    expect(flat.lighting.sources).toBeUndefined();        // no pools/shadows
    // artistic `time` is the opposite end: dim + a sky
    expect(resolveSceneLighting({ scene: { time: 'night' } }).sky.preset).toBe('night');
  });

  it('a room manifest authored with `scene.time` renders with that lighting + sky', () => {
    const def = extractRoomFacesFromManifest(ROOM_MANIFEST(undefined));
    const night = extractRoomFacesFromManifest(ROOM_MANIFEST({ time: 'night' }));
    expect(def.sky).toBeNull();                                      // no time → default bg
    expect(night.sky.preset).toBe('night');                         // time → a night sky
    expect(night.faces.length).toBeGreaterThan(0);
  });
});
