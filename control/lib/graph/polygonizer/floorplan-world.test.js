// Handedness: a plan (x east, y south, as the plan card draws it) is built north-up in the right-handed world, and
// every picture of that world — the still's projector, the CSS-3D camera, the three.js World, the IFC model — shows
// the house the way round the plan draws it, never its mirror.
import { describe, expect, it } from 'vitest';

import { reflectFace, planToWorld } from './floorplan-world.js';
import { assembleFloorWorldScene, assembleFloorplanScene, assembleHouseWorldScene, renderFloorplanPlanSvg, structurizeFloorplan } from './floorplan-structure.js';
import { projectTwoPoint } from './pure-mandala.js';
import { manifestToIfc } from '../construction/ifc.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; };

// A lounge down the west half, a bedroom in the north-east corner, a kitchen south-east of it.
const ROOMS = [{ x: 0, y: 0, w: 24, h: 30, glyph: 'L' }, { x: 24, y: 0, w: 16, h: 12, glyph: 'B' }, { x: 24, y: 12, w: 16, h: 18, glyph: 'K' }];
const PLAN = { width: 40, height: 30, rooms: ROOMS, doors: [{ x: 12, y: 30, room: 0, edge: 'S' }] };
const CENTRE = { L: [12, 15], B: [32, 6], K: [32, 21] };            // plan frame

// A right-handed camera (what three.js and every engine draw): screen-x along forward × up.
const physical = (cam) => {
  const { cameraPosition: P, lookAt: T } = cam.worldFraming;
  const f = unit(sub(T, P)), r = unit(cross(f, [0, 0, 1])), u = cross(r, f);
  return (p) => { const d = sub(p, P); return [dot(d, r) / dot(d, f), dot(d, u) / dot(d, f)]; };
};

describe('floorplan → world: one reflection', () => {
  it('a face reflects with its winding turned, so its winding keeps the side its normal names', () => {
    const s = structurizeFloorplan(PLAN, {});
    let checked = 0;
    for (const f of s.faces) {
      const n = f.normal || f.outNormal;
      if (!n || f.corners.length < 3) continue;
      const before = newell(f.corners);
      if (Math.hypot(...before) < 1e-9) continue;
      const side = dot(unit(before), n);
      if (Math.abs(side) < 0.99) continue;                     // a face wound along its normal, or against it
      const g = reflectFace(f);
      const m = g.normal || g.outNormal;
      expect(m).toEqual([n[0], -n[1], n[2]]);
      expect(dot(unit(newell(g.corners)), m) * Math.sign(side)).toBeGreaterThan(0.99);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('keeps a triangle carried as four corners (the last repeating the first) in that encoding, and re-measures a clip', () => {
    const tri = reflectFace({ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]], fill: '#fff' });
    expect(tri.corners[3]).toEqual(tri.corners[0]);
    const clipped = reflectFace({ corners: [[0, 0, 0], [2, 0, 0], [2, 1, 1], [0, 1, 1]], clip: 'polygon(0% 0%,100% 0%,50% 100%,0% 100%)' });
    expect(clipped.clip).toMatch(/^polygon\(/);
    expect(clipped.clip).not.toBe('polygon(0% 0%,100% 0%,50% 100%,0% 100%)');
  });

  it('mirrors an explicit uv in u, so a texture reads the right way round', () => {
    const g = reflectFace({ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    expect(g.uv).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);   // reordered [1,0,3,2] then u → 1 − u
  });

  it('reflects cameras, spawn, yaw, lights and item refs; leaves what it does not name', () => {
    const p = planToWorld({
      cameras: [{ name: 'a', worldFraming: { cameraPosition: [1, 2, 3], lookAt: [4, 5, 6], horizontalFov: 60 } }],
      walk: { spawn: [1, 2], yaw: 0.5, eye: 5 }, lights: [{ position: [1, 2, 3] }],
      itemRefs: [{ ref: 'r', center: [3, 4], facing: 'E', turn: 30 }], metersPerUnit: 0.3048, structure: { keep: [1, 2] },
    });
    expect(p.cameras[0].worldFraming).toMatchObject({ cameraPosition: [1, -2, 3], lookAt: [4, -5, 6], horizontalFov: 60 });
    expect(p.walk).toEqual({ spawn: [1, -2], yaw: -0.5, eye: 5 });
    expect(p.lights[0].position).toEqual([1, -2, 3]);
    expect(p.itemRefs[0]).toMatchObject({ center: [3, -4], turn: 30, facingAngle: -Math.PI / 2 });   // turn: the ref's own frame
    expect(p.structure).toEqual({ keep: [1, 2] });
  });
});

describe('the house is the plan, not its mirror', () => {
  it('builds north-up: the plan’s north-east bedroom stands north-east of the lounge in the world', () => {
    const w = assembleFloorWorldScene(PLAN, {});
    const ys = w.faces.flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.max(...ys)).toBeLessThan(1);            // plan y 0…30 (south) → world y 0…−30
    expect(Math.min(...ys)).toBeGreaterThan(-31);
  });

  it('the plan card still draws the plan as authored (north at the top)', () => {
    const svg = renderFloorplanPlanSvg(structurizeFloorplan(PLAN, {}));
    const rect = (glyph) => { const s = structurizeFloorplan(PLAN, {}).cells.find((c) => c.glyph === glyph); return s; };
    expect(rect('B').y).toBeLessThan(rect('K').y);         // B above K on the card
    expect(svg).toMatch(/<svg/);
  });

  it('the default aerial, still and World alike, reads as the plan card: bedroom upper right, kitchen lower right, lounge left', () => {
    for (const w of [assembleFloorWorldScene(PLAN, {}), assembleFloorplanScene(PLAN, {})]) {
      const cam = w.cameras.find((c) => c.name === 'aerial');
      const at = (k) => [CENTRE[k][0], -CENTRE[k][1], 0];
      const P = physical(cam);
      const still = (p) => { const r = projectTwoPoint(p, { viewBox: { width: 1000, height: 1000 }, worldFraming: { ...cam.worldFraming, pictureCenter: [500, 500] } }, {}); return [r[0] - 500, 500 - r[1]]; };
      for (const proj of [P, still]) {
        const L = proj(at('L')), B = proj(at('B')), K = proj(at('K'));
        expect(B[0]).toBeGreaterThan(L[0]);
        expect(K[0]).toBeGreaterThan(L[0]);
        expect(B[1]).toBeGreaterThan(K[1]);
      }
    }
  });

  it('a stacked house builds north-up too', () => {
    const w = assembleHouseWorldScene({ kind: 'floorplan', stairs: false, levels: [{ index: 0, rooms: ROOMS }, { index: 1, rooms: ROOMS }] }, { view: 'cutaway' });
    const ys = w.faces.flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.max(...ys)).toBeLessThan(1);
  });

  it('the IFC model stands where the World does: every space in the north-up frame, the bedroom north-east', () => {
    const { text } = manifestToIfc({ kind: 'floorplan', stairs: false, levels: [{ index: 0, rooms: ROOMS }, { index: 1, rooms: ROOMS }] });
    const ent = new Map(text.split('\n').filter((l) => /^#\d+=/.test(l)).map((l) => [/^#(\d+)=/.exec(l)[1], l]));
    const args = (id) => ent.get(id).slice(ent.get(id).indexOf('(') + 1);
    const point = (id) => /\(\(([^)]*)\)\)/.exec(ent.get(id))[1].split(',').map(Number);
    const spaces = [...ent.values()].filter((l) => l.includes('=IFCSPACE('));
    const corners = spaces.map((l) => {
      const pl = /,'[^']*',\$,\$,#(\d+),/.exec(l)[1];                                   // the IFCLOCALPLACEMENT
      const ax = /#\d+,#(\d+)\)/.exec(args(pl))[1];                                      // its IFCAXIS2PLACEMENT3D
      return point(/#(\d+)/.exec(args(ax))[1]);                                          // its location
    });
    expect(corners.length).toBeGreaterThan(0);
    for (const c of corners) expect(c[1]).toBeLessThanOrEqual(1e-9);                     // south of the north wall line
    const FT = 0.3048;
    expect(corners.some((c) => Math.abs(c[0] - 24 * FT) < 1e-6 && Math.abs(c[1] + 12 * FT) < 1e-6)).toBe(true);   // the bedroom's SW corner
  });
});

describe('the still camera is right-handed', () => {
  it('from +y looking at the origin, +x is on screen-left (as three.js draws it)', () => {
    const cam = { viewBox: { width: 1000, height: 1000 }, worldFraming: { cameraPosition: [0, 10, 0], lookAt: [0, 0, 0], horizontalFov: 60, pictureCenter: [500, 500] } };
    expect(projectTwoPoint([1, 0, 0], cam, {})[0]).toBeLessThan(500);
    expect(physical(cam)([1, 0, 0])[0]).toBeLessThan(0);
  });
});
