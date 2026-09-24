import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { orbitCamera, worldFramingCamera, projectVertices, weldFaces, wireRuns, wireSvg, frameSource } from './wire-svg.js';
import { projectTwoPointPinhole } from '../polygonizer/pure-mandala.js';

const EX = path.resolve(process.cwd(), '../docs/examples/raccoon-head-wire');
const HEAD = JSON.parse(readFileSync(path.join(EX, 'head-source.json'), 'utf8'));
const REFERENCE_SVG = readFileSync(path.join(EX, 'head-three-quarter.svg'), 'utf8');   // the Python reference generator's output, committed
const RACCOON = { features: ['Eyes', 'Nose', 'Eye mask', 'Muzzle', 'Ear inset'] };
const cam150 = orbitCamera({ azimuthDegrees: 150, elevationDegrees: 10, target: [0, 0, 1.60], distance: 1.35, focalPixels: 1400, size: 900 });
const sha = (s) => createHash('sha256').update(s).digest('hex');
const parsePaths = (svg) => [...svg.matchAll(/<path([^>]*)\/>/g)].map(([, attrs]) => Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])));

describe('wire-svg — pinned against the Python reference generator (docs/examples/raccoon-head-wire)', () => {
  it('draws the same runs as build-wire.py at the three-quarter view: same edges, roles, visibility, intervals, pixels', () => {
    const ref = parsePaths(REFERENCE_SVG); const ours = parsePaths(wireSvg(HEAD, cam150, { ...RACCOON, title: 'Detailed raccoon head — spatial wire drawing' }));
    expect(ours.length).toBe(ref.length);
    for (let i = 0; i < ref.length; i++) {
      expect(ours[i]['data-spatial-edge']).toBe(ref[i]['data-spatial-edge']);
      expect(ours[i]['data-edge-role']).toBe(ref[i]['data-edge-role']);
      expect(ours[i]['data-visible']).toBe(ref[i]['data-visible']);
      const tr = ref[i]['data-source-t'].split(' ').map(Number); const to = ours[i]['data-source-t'].split(' ').map(Number);
      expect(Math.abs(tr[0] - to[0])).toBeLessThan(1e-9); expect(Math.abs(tr[1] - to[1])).toBeLessThan(1e-9);
      const nr = ref[i].d.match(/-?[\d.]+/g).map(Number); const no = ours[i].d.match(/-?[\d.]+/g).map(Number);
      for (let k = 0; k < 4; k++) expect(Math.abs(nr[k] - no[k])).toBeLessThan(0.0015);
    }
  });
  it('matches the reference on all four fixed views and the construction view by run census', () => {
    const census = (az, hidden) => { const runs = wireRuns(HEAD, orbitCamera({ ...cam150.meta, azimuthDegrees: az, size: 900 }), RACCOON); return { total: runs.length, visible: runs.filter((r) => r.visible).length, byType: Object.fromEntries(['outline', 'feature', 'plane'].map((t) => [t, runs.filter((r) => r.visible && r.type === t).length])) }; };
    expect(census(150).visible).toBe(139); expect(census(150).total).toBe(277);        // validation.json: three-quarter 139 paths, construction 277
    expect(census(180).visible).toBe(134); expect(census(90).visible).toBe(118); expect(census(0).visible).toBe(93);
    expect(census(150).byType).toEqual({ outline: 57, feature: 44, plane: 38 });
  });
  it('emits byte-identically (hash pin) for the clean and construction drawings', () => {
    const clean = wireSvg(HEAD, cam150, RACCOON); const construction = wireSvg(HEAD, cam150, { ...RACCOON, hidden: true });
    expect(clean).toBe(wireSvg(HEAD, cam150, RACCOON));
    expect(sha(clean)).toMatchSnapshot(); expect(sha(construction)).toMatchSnapshot();
    expect(clean).toContain('<metadata id="spatial-source">'); expect(clean).toContain('&quot;sourceHash&quot;');
    expect(clean).toContain('<metadata id="projection">'); expect(clean).toContain('&quot;basis&quot;:&quot;physical');
  });
});

describe('wire-svg — camera basis', () => {
  it('a worldFraming camera through the physical basis is the orbit camera (same pixels)', () => {
    const wf = { worldFraming: { cameraPosition: cam150.position, lookAt: [0, 0, 1.60], horizontalFov: 2 * Math.atan(450 / 1400) * 180 / Math.PI }, viewBox: { width: 900, height: 900 } };
    const a = projectVertices(HEAD.vertices, cam150); const b = projectVertices(HEAD.vertices, worldFramingCamera(wf));
    for (let i = 0; i < a.length; i++) for (let k = 0; k < 3; k++) expect(Math.abs(a[i][k] - b[i][k])).toBeLessThan(1e-9);
  });
  it('is the horizontal mirror of resolveCameraBasis (the legacy CSS3D / scaffold picture), documented on purpose', () => {
    const wf = { worldFraming: { cameraPosition: cam150.position, lookAt: [0, 0, 1.60], horizontalFov: 2 * Math.atan(450 / 1400) * 180 / Math.PI }, viewBox: { width: 900, height: 900 } };
    const ours = projectVertices(HEAD.vertices, worldFramingCamera(wf));
    for (let i = 0; i < HEAD.vertices.length; i++) { const legacy = projectTwoPointPinhole(HEAD.vertices[i], wf, {}); expect(Math.abs((900 - legacy[0]) - ours[i][0])).toBeLessThan(2e-3); expect(Math.abs(legacy[1] - ours[i][1])).toBeLessThan(2e-3); }
  });
  it('refuses a source behind the camera', () => {
    expect(() => projectVertices([[0, 0, 1.6], [0, 5, 1.6]], cam150)).toThrow(/behind camera/);
  });
});

describe('wire-svg — welding a face list', () => {
  const box = (() => { const c = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]; const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]; return quads.map((q, i) => ({ corners: q.map((k) => c[k]), group: i < 2 ? 'cap' : 'side' })); })();
  it('welds shared corners, fans n-gons, and keeps groups', () => {
    const src = weldFaces(box); expect(src.vertices.length).toBe(8); expect(src.faces.length).toBe(12); expect(new Set(src.groups)).toEqual(new Set(['cap', 'side']));
  });
  it('a generic view of a cube shows nine visible edges and three hidden, and coplanar diagonals are suppressed', () => {
    const src = weldFaces(box); const { target, distance } = frameSource(src, { distanceMultiplier: 4 });
    const runs = wireRuns(src, orbitCamera({ azimuthDegrees: 35, elevationDegrees: 22, target, distance, size: 900 }));
    const edges = new Set(runs.map((r) => r.edge.join('|'))); expect(edges.size).toBe(12);
    expect(runs.filter((r) => r.visible).length).toBe(9); expect(runs.filter((r) => !r.visible).length).toBe(3);
  });
});
