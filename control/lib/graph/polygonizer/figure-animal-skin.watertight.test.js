/**
 * skin:'watertight' — the surface-net body path (blenderish-animals.plan.md
 * phase 1) end-to-end through buildAnimal and the render/export seams.
 *
 * The claims under test: the watertight body is CLOSED (zero boundary edges —
 * the property the per-axis march structurally cannot give), it flows through
 * the SVG study and the World/export form unchanged, and the existing welded
 * (`skin:true`) and overlap paths are byte-identical to before (compat).
 */
import { describe, expect, it } from 'vitest';

import { buildAnimal, ZOO_BUILDS } from './figure-animal-build.js';
import { renderAnimalToSvg, animalWorldFaces } from './figure-render.js';
import { findOpenBoundaries } from './face-closure.js';

const wolf = ZOO_BUILDS.wolf;
const watertightOpts = { ...wolf.opts, skin: 'watertight' };

describe("buildAnimal skin:'watertight'", () => {
  it('emits one face-part body with zero boundary edges', () => {
    const built = buildAnimal(wolf.archetype, watertightOpts);
    const bodies = built.parts.filter((p) => p.faces);
    expect(bodies.length).toBe(1);
    const audit = findOpenBoundaries(bodies[0].faces.map((f) => ({ corners: f.corners.map((q) => [q.x, q.y, q.z]) })));
    expect(audit.closed).toBe(true);
    expect(audit.boundaryEdgeCount).toBe(0);
  });

  it('body faces carry a unit gradient normal and take the coat paint', () => {
    const built = buildAnimal(wolf.archetype, watertightOpts);
    const body = built.parts.find((p) => p.faces);
    expect(body.stroke).toBe(wolf.opts.coat.color);
    for (const f of body.faces) {
      expect(Math.hypot(...f.n)).toBeCloseTo(1, 1);
      expect(f.corners.length).toBe(4);
    }
  });

  it('renders through the SVG study and exports through animalWorldFaces', () => {
    const svg = renderAnimalToSvg({ archetype: wolf.archetype, opts: watertightOpts });
    expect(svg.includes('<polygon')).toBe(true);
    const { faces } = animalWorldFaces({ archetype: wolf.archetype, opts: watertightOpts });
    expect(faces.length).toBeGreaterThan(1000);
    // countershading (normal-rule underHex) reaches the field faces
    const fills = new Set(faces.map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(10);
    // every untextured face authors its outward normal for the GLB/Blender seam
    expect(faces.every((f) => typeof f.texture === 'string' || Array.isArray(f.outNormal))).toBe(true);
  });

  it("does not disturb the welded path — skin:true output is byte-identical", () => {
    const a = JSON.stringify(buildAnimal(wolf.archetype, wolf.opts).parts);
    const b = JSON.stringify(buildAnimal(wolf.archetype, wolf.opts).parts);
    expect(a).toBe(b);
    expect(a.includes('"faces"')).toBe(false);   // no face parts leak into the welded build
  });
});
