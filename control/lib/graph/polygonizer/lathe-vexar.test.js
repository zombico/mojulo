import { describe, it, expect } from 'vitest';
import { renderManjiTreeToSvg } from './manji-svg.js';

// Minimal 3D manji-tree with one lathe (a sphere via semicircle profile).
function scene(latheStyle) {
  return {
    kind: 'manji-tree', dimensions: '3d', showSlotMarkers: false,
    camera: { worldFraming: { cameraPosition: [3, -6, 3], lookAt: [0, 0, 0], horizontalFov: 46 }, viewBox: { width: 400, height: 400 } },
    roomBasis: { xRange: [-3, 3], yRange: [-3, 3], worldExtent: { width: 6, depth: 6, height: 6 } },
    tree: { id: 'world', spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.01 } }, anchor: { x: 0, y: 0, z: 0 }, slots: [], children: [] },
    physics: { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1, defaultSagFactor: 0 },
    lathes: [{ axisFrom: { x: 0, y: 0, z: -1 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 0 }, { t: 0.5, radius: 1 }, { t: 1, radius: 0 }], crossSections: 8, samples: 12, style: latheStyle }],
  };
}

describe('lathe vexar lighting', () => {
  it('a vexar-fill lathe paints shaded <polygon> faces (lit solid)', () => {
    const svg = renderManjiTreeToSvg(scene({ fill: 'vexar', fillColor: '#14b8a6' }));
    expect(svg).toContain('<polygon');
    expect(svg).toMatch(/<polygon[^>]*fill="#[0-9a-fA-F]{6}"/); // a shaded hex per face
  });

  it('a default (stroke) lathe still paints wireframe <line>, no polygon fill (additive)', () => {
    const svg = renderManjiTreeToSvg(scene({ stroke: '#777', width: 0.5 }));
    expect(svg).toContain('<line');
    expect(svg).not.toContain('<polygon');
  });
});
