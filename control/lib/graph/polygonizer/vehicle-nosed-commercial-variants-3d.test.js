/**
 * Nosed commercial vehicle 3D output generator.
 *
 * Folds ambulance, moving van, delivery truck, conventional tractor-trailer,
 * and school bus T-map variants into projected 3/4 SVGs.
 *
 * Output:
 *   lite-template/integration/0608/spike-output/vehicle-nosed-commercial-variants-3d/
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFaceNetSceneShapes, serializePlateShape } from './vehicle-face-net.js';
import { makeVehicleFaceNetVariant } from './vehicle-face-net-variants.js';
import { projectTwoPoint } from './pure-mandala.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUTPUT_DIR = path.join(
  REPO_ROOT,
  'lite-template',
  'integration',
  '0608',
  'spike-output',
  'vehicle-nosed-commercial-variants-3d',
);

const VIEW = { width: 1200, height: 760 };
const ROOM_BASIS = {
  worldExtent: { width: 34, depth: 22, height: 18 },
  xRange: [0, 34],
  yRange: [0, 22],
  frontY: 22,
  backY: 0,
  verticalUnit: 18,
};
const CAMERA = {
  kind: 'two-point',
  viewBox: VIEW,
  worldFraming: {
    cameraPosition: [40, 31, 11],
    lookAt: [15, 9, 3],
    horizontalFov: 80,
    pictureCenter: [600, 410],
  },
};

function projectPoint(p) {
  const [x, y] = projectTwoPoint(p, CAMERA, ROOM_BASIS);
  return { x, y };
}

function fmt(n) {
  return Number(n).toFixed(2);
}

function poly(points, attrs) {
  const pts = points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
  return `<polygon points="${pts}" ${attrs}/>`;
}

function text(x, y, copy, attrs = '') {
  return `<text x="${fmt(x)}" y="${fmt(y)}" ${attrs}>${copy}</text>`;
}

function roadQuad(x0, y0, x1, y1, attrs) {
  return poly([
    projectPoint([x0, y0, 0]),
    projectPoint([x1, y0, 0]),
    projectPoint([x1, y1, 0]),
    projectPoint([x0, y1, 0]),
  ], attrs);
}

function boxFor(net, { x, y, z = 0.0, scale = 0.5 }) {
  const { length: L, width: W, height: H } = net.proportions;
  return { x, y, z, width: L * scale, length: W * scale, height: H * scale };
}

function vehicleMarks(net, box) {
  const scene = buildFaceNetSceneShapes(net, {
    box,
    axis: 'x',
    projectPoint,
    faces: ['body-underlay', 'side-far', 'top', 'hood', 'side', 'front'],
  });
  return scene.shapes.map(serializePlateShape);
}

function frame(title, subtitle, bodyMarks, footer) {
  const marks = [
    `<rect x="0" y="0" width="${VIEW.width}" height="${VIEW.height}" fill="#f6f4ed"/>`,
    text(44, 46, title, 'font-size="24" fill="#243040" font-weight="700"'),
    text(44, 72, subtitle, 'font-size="13" fill="#64748b"'),
    ...bodyMarks,
    text(44, VIEW.height - 24, footer, 'font-size="12" fill="#64748b"'),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="${VIEW.width}" height="${VIEW.height}">
  <title>${title}</title>
  ${marks.join('\n')}
</svg>`;
}

function renderCommercial({ commercialClass, seed, variant, x = 6.8, y = 8.2, scale = 1.25 }) {
  const net = makeVehicleFaceNetVariant('truck', { seed, variant, commercialClass });
  const box = boxFor(net, { x, y, scale });
  const road = roadQuad(0.5, 4.5, 33.5, 15.0, 'fill="#dce3ea" stroke="#9fb0c0" stroke-width="1"');
  return frame(
    `${net.label} - projected from folded stickers`,
    'nosed commercial net: body-underlay -> top -> hood -> side -> front',
    [road, ...vehicleMarks(net, box)],
    `scene: ${commercialClass} 3/4 | seed=${seed} variant=${variant} | explicit hood/nose folded in 3D`,
  );
}

describe('nosed commercial vehicle 3D variants output', () => {
  it('writes projected nosed commercial SVGs', async () => {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const cases = [
      { file: '1-ambulance-3q.svg', commercialClass: 'ambulance', seed: 'nosed-roll', variant: 0, scale: 1.40 },
      { file: '2-moving-van-3q.svg', commercialClass: 'movingVan', seed: 'nosed-roll', variant: 1, scale: 1.35 },
      { file: '3-delivery-truck-3q.svg', commercialClass: 'deliveryTruck', seed: 'nosed-roll', variant: 2, scale: 1.42 },
      { file: '4-nosed-tractor-trailer-3q.svg', commercialClass: 'tractorNosed', seed: 'nosed-roll', variant: 3, x: 4.5, scale: 1.08 },
      { file: '5-schoolbus-3q.svg', commercialClass: 'schoolbus', seed: 'nosed-roll', variant: 4, scale: 1.25 },
    ];
    const written = [];
    for (const entry of cases) {
      await fs.writeFile(path.join(OUTPUT_DIR, entry.file), renderCommercial(entry), 'utf8');
      written.push(entry.file);
    }

    const ambulance = makeVehicleFaceNetVariant('truck', { seed: 'nosed-roll', variant: 0, commercialClass: 'ambulance' });
    const scene = buildFaceNetSceneShapes(ambulance, {
      box: boxFor(ambulance, { x: 6.8, y: 8.2, scale: 1.40 }),
      axis: 'x',
      projectPoint,
      faces: ['body-underlay', 'side-far', 'top', 'hood', 'side', 'front'],
    });
    expect(scene.shapes.some((s) => s.role?.includes('sedan-hood'))).toBe(true);
    expect(scene.shapes.some((s) => s.role === 'body-underlay:near')).toBe(true);

    const summary = [
      '# Nosed Commercial Vehicle 3D Outputs',
      '',
      ...written.map((file) => `- ${file}`),
      '',
      'Projected 3/4 views for the nosed commercial T-map variants.',
      'Each view folds the generated side/top/hood/front cards over a body-colored underlay.',
    ].join('\n');
    await fs.writeFile(path.join(OUTPUT_DIR, 'summary.md'), summary, 'utf8');
    expect(written).toHaveLength(cases.length);
  });
});
