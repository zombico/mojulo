import { describe, it, expect } from 'vitest';
import { paintedFraming, plateBasis, project, lift, horizonOf, figureSpan } from './camera.js';
import { bakeFloor, components, walkable, bakeMask } from './bake.js';
import { readWalkmesh, cutsOf } from './walkmesh.js';
import { walkAdvice } from './laws.js';
import { plateMask } from './mask.js';
import { walkBoardHtml, walkPieceIds } from './board-html.js';

// a painted plate 1600×900: the ground meets the sky at y 400; the floor a trapezoid below it
const PAINT = (over = {}) => ({
  id: 'yard', painted: { image: 'yard.png', size: [1600, 900] }, ground: { horizon: 400, height: 1.6, fov: 60 },
  floor: [{ id: 'yard', poly: [[100, 500], [1500, 500], [1600, 900], [0, 900]] }],
  exits: [{ id: 'gate', edge: [[1550, 700], [1590, 860]], to: 'hall.door' }],
  spawns: [{ id: 'mid', at: [800, 700] }], ...over,
});
const HALL = { id: 'hall', painted: { image: 'hall.png', size: [1600, 900] }, ground: { horizon: 380 },
  floor: [[[200, 480], [1400, 480], [1500, 900], [100, 900]]], exits: [{ id: 'door', edge: [[120, 820], [190, 520]], to: 'yard.gate' }], spawns: [{ id: 'in', at: [700, 700] }] };
const WM = (plates = [PAINT(), HALL], more = {}) => readWalkmesh({ kind: 'walkmesh', title: 'Yard', start: 'yard.mid', plates, ...more });
const laws = (wm) => walkAdvice(wm).map((a) => a.law);

// a world payload: a 6×6 m floor of up faces, a wall across y = 3 with a 1 m gap, a decal, a pillar box at (1, 1)
const quad = (x0, y0, x1, y1, z = 0) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], normal: [0, 0, 1] });
const wallX = (x0, x1, y, h = 3) => ({ corners: [[x0, y, 0], [x1, y, 0], [x1, y, h], [x0, y, h]], normal: [0, -1, 0] });
const box = (x0, y0, x1, y1, h) => [wallX(x0, x1, y0, h), wallX(x0, x1, y1, h), { corners: [[x0, y0, 0], [x0, y1, 0], [x0, y1, h], [x0, y0, h]], normal: [-1, 0, 0] }, { corners: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], normal: [1, 0, 0] }, quad(x0, y0, x1, y1, h)];
const WORLD = (gap = true) => ({ faces: [quad(0, 0, 6, 6), wallX(0, gap ? 2.5 : 6, 3), ...(gap ? [wallX(3.5, 6, 3)] : []), { ...wallX(0, 6, 4.5), blend: true }] });

describe('the plate camera', () => {
  const size = [1600, 900], B = plateBasis(paintedFraming(size, { horizon: 400, height: 1.6, fov: 60 }), size);
  it('a painted fit puts the horizon where the plate says, and lift undoes project', () => {
    expect(horizonOf(B)).toBeCloseTo(400, 6);
    for (const px of [[100, 500], [800, 700], [1500, 880]]) {
      const m = lift(B, px);
      expect(m[2]).toBe(0);
      const back = project(B, m).px;
      expect(back[0]).toBeCloseTo(px[0], 6); expect(back[1]).toBeCloseTo(px[1], 6);
    }
  });
  it('at or above the horizon a ray never lands; behind the camera nothing projects', () => {
    expect(lift(B, [800, 400])).toBeNull();
    expect(lift(B, [800, 200])).toBeNull();
    expect(project(B, [0, -5, 0])).toBeNull();
  });
  it('the eye-level rule: a figure as tall as the eye has its head on the horizon at every depth', () => {
    for (const y of [480, 600, 880]) expect(figureSpan(B, lift(B, [800, y]), 1.6).head[1]).toBeCloseTo(400, 6);
  });
});

describe('readWalkmesh', () => {
  it('reads both spaces to one: painted px lift to metres, and the cut graph names both ends', () => {
    const wm = WM(), yard = wm.plates[0];
    expect(yard.floor[0].m.every(Boolean)).toBe(true);
    expect(yard.spawns[0].m[1]).toBeGreaterThan(0);
    expect(wm.plates[1].floor[0].id).toBe('floor-0');
    expect(cutsOf(wm)).toEqual([{ from: 'yard.gate', to: 'hall.door' }, { from: 'hall.door', to: 'yard.gate' }]);
    expect(wm.status).toEqual({ plates: 'proposed', ground: 'proposed', floor: 'proposed', occluders: 'proposed', exits: 'proposed', cuts: 'proposed' });
  });
  it('refuses a malformed shape with a sentence', () => {
    const bad = (p, re) => expect(() => WM([p])).toThrow(re);
    bad({ ...PAINT(), baked: { world: {} } }, /painted or baked/);
    bad(PAINT({ ground: {} }), /ground.horizon/);
    bad(PAINT({ id: 'Yard' }), /lower-case/);
    bad(PAINT({ exits: [{ id: 'a', edge: [[0, 0], [1, 1]], to: 'nowhere' }] }), /<plate>.<exit>/);
    bad(PAINT({ spawns: [{ id: 'a', at: [1, 1] }, { id: 'a', at: [2, 2] }] }), /two spawns/);
    expect(() => WM([{ id: 'nave', baked: { world: { kind: 'stage' }, camera: { at: [0, 0, 2], look: [0, 5, 1] } }, floor: [] }])).toThrow(/reads its floor off the world/);
    expect(() => WM([PAINT()], { direction: { floor: 'done' } })).toThrow(/proposed, approved, auto/);
  });
});

describe('the laws', () => {
  it('a well-made pair of plates holds every law', () => {
    expect(walkAdvice(WM())).toEqual([]);
  });
  it('a floor over the horizon, an exit inside the floor, a one-way cut, a lost spawn and start', () => {
    const wm = WM([PAINT({ floor: [{ id: 'yard', poly: [[100, 300], [1500, 500], [1600, 900], [0, 900]] }], exits: [{ id: 'gate', edge: [[700, 700], [900, 700]], to: 'hall.door' }], spawns: [{ id: 'mid', at: [30, 460] }] }),
      { ...HALL, exits: [{ id: 'door', edge: [[120, 820], [190, 520]], to: 'yard.nope' }] }], { start: 'yard.gone' });
    expect(laws(wm)).toEqual(expect.arrayContaining(['floor-below-horizon', 'exit-on-edge', 'exit-resolves', 'spawn-on-floor', 'start-resolves']));
  });
  it('an exit on a floor cut off from every spawn is unreachable; an occluder hanging in the sky is ungrounded', () => {
    const wm = WM([PAINT({ floor: [[[100, 500], [700, 500], [700, 900], [0, 900]], [[1000, 500], [1500, 500], [1600, 900], [1000, 900]]], spawns: [{ id: 'mid', at: [400, 700] }], occluders: [{ id: 'sign', poly: [[600, 100], [700, 100], [700, 200], [600, 200]] }] }), HALL]);
    expect(laws(wm)).toEqual(expect.arrayContaining(['reachable', 'occluder-grounded']));
  });
  it('a low eye over a near floor makes a giant at the front', () => {
    const wm = WM([PAINT({ ground: { horizon: 400, height: 0.4, fov: 60 } }), HALL]);
    expect(walkAdvice(wm).find((a) => a.law === 'figure-scale').advice).toMatch(/at the front/);
  });
});

describe('the mask', () => {
  it('a painted occluder hides the floor above its base line and nothing below it', () => {
    const plate = WM([PAINT({ occluders: [{ id: 'post', poly: [[780, 300], [820, 300], [820, 640], [780, 640]] }] }), HALL]).plates[0];
    const m = plateMask(plate, 160), at = (x, y) => m.cells[Math.floor((y / 900) * m.h) * m.w + Math.floor((x / 1600) * m.w)];
    expect(at(800, 560)).toBe(2);
    expect(at(800, 700)).toBe(1);
    expect(at(800, 200)).toBe(0);
  });
});

describe('the bake', () => {
  it('reads the floor off the world: a wall splits it unless it has a gap; a decal is not a wall', () => {
    const open = bakeFloor(WORLD(true)), shut = bakeFloor(WORLD(false));
    expect(components(open).count).toBe(1);
    expect(components(shut).count).toBe(2);
    expect(walkable(open, [3, 3])).toBe(true);
    expect(walkable(open, [1, 3.05])).toBe(false);
    expect(walkable(open, [3, 4.55])).toBe(true);
    expect(open.rects.length).toBeGreaterThan(1);
    expect(() => bakeFloor({ faces: [wallX(0, 1, 0)] })).toThrow(/no ground/);
  });
  it('the mask hides the floor behind a pillar and nothing else', () => {
    const payload = { faces: [quad(-4, 0, 4, 12), ...box(-0.4, 3.6, 0.4, 4.4, 3)] }, size = [400, 300];
    const B = plateBasis({ cameraPosition: [0, 0, 1.6], lookAt: [0, 10, 0.4], horizontalFov: 60, pictureCenter: [200, 150] }, size);
    const m = bakeMask(payload, B, size, bakeFloor(payload), 200);
    const behind = project(B, [0, 8, 0]).px, beside = project(B, [2, 8, 0]).px, cell = ([x, y]) => m.cells[Math.floor((y / 300) * m.h) * m.w + Math.floor((x / 400) * m.w)];
    expect(cell(behind)).toBe(2);
    expect(cell(beside)).toBe(1);
  });
});

describe('the board', () => {
  it('assembles its pieces, escapes what it is given, and is the same twice', () => {
    const wm = WM([PAINT(), HALL], { title: 'Yard <script>' });
    const html = walkBoardHtml(wm, { images: { hall: 'data:image/png;base64,AAAA' } });
    for (const id of walkPieceIds(wm)) expect(html).toContain(`data-piece="${id}"`);
    expect(html).not.toContain('<script>');
    expect(html).toContain('href="yard.png"');
    expect(html).toContain('every law holds');
    expect(walkBoardHtml(wm, { images: { hall: 'data:image/png;base64,AAAA' } })).toBe(html);
  });
});
