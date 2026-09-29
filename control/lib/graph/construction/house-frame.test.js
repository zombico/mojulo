import { describe, it, expect, beforeAll } from 'vitest';
import { FRAMING_SYSTEMS, planHouseFraming, validateFraming, clipFacesAtX } from './house-frame.js';
import { validateFrames } from './frame.js';
import { structurizeHouse, storeyLevels, FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { manifestWantsExact } from '../polygonizer/field-exact-reach.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

const M = { storeys: 2, seed: 4, tier: 'house', windows: true, roof: 'mission' };
const house = (extra = {}) => { const m = { ...M, ...extra }; return structurizeHouse({ ...m, ...storeyLevels(m) }, m); };
const IN = 1 / 12;

describe('construction/house-frame — the structure under a house', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('frames the house in every system as valid frames, from the foundation to the roof', () => {
    const h = house();
    for (const system of FRAMING_SYSTEMS) {
      const plan = planHouseFraming(h, { system }, { ...FLOORPLAN_DEFAULTS, ...M });
      expect(validateFrames(plan.frames), system).toEqual([]);
      expect(plan.frames.map((f) => f.id), system).toEqual(['foundation', 'storey-0', 'storey-1', 'roof']);
      expect(plan.roof).toEqual({ form: 'gable', framedAs: 'gable' });
    }
  });

  it('studs a platform wall at 16 in, with kings, jacks and a header at each opening', () => {
    const plan = planHouseFraming(house(), { system: 'platform' }, { ...FLOORPLAN_DEFAULTS, ...M });
    const s0 = plan.frames.find((f) => f.id === 'storey-0');
    // the front wall (y = 2, 44 ft): its commons stand on the 16 in layout from the end stud
    const front = s0.members.filter((m) => /^stud-/.test(m.id) && Math.abs(m.from[1] - 2) < 1e-6).map((m) => m.from[0]).sort((a, b) => a - b);
    const gaps = front.slice(1).map((x, i) => Math.round((x - front[i]) / IN * 100) / 100);
    expect(gaps.filter((g) => g === 16).length).toBeGreaterThan(front.length / 2);
    // four openings on that wall: two kings, two jacks and a header each
    const on = (re) => s0.members.filter((m) => re.test(m.id) && Math.abs(m.from[1] - 2) < 1e-6).length;
    expect(on(/^king-/)).toBe(8); expect(on(/^jack-/)).toBe(8); expect(on(/^header-/)).toBe(4);
  });

  it('trims the joists round the stair, with doubled trimmers and headers', () => {
    const h = house();
    const hole = h.levels.find((l) => l.index === 1).structure.slabHoles[0];
    const plan = planHouseFraming(h, { system: 'platform' }, { ...FLOORPLAN_DEFAULTS, ...M });
    const floor = plan.frames.find((f) => f.id === 'storey-0').members.filter((m) => /^joist-/.test(m.id));
    const inside = (m) => {
      const [x0, x1] = [Math.min(m.from[0], m.to[0]), Math.max(m.from[0], m.to[0])], [y0, y1] = [Math.min(m.from[1], m.to[1]), Math.max(m.from[1], m.to[1])];
      return x1 > hole.x0 + 0.01 && x0 < hole.x1 - 0.01 && y1 > hole.y0 + 0.01 && y0 < hole.y1 - 0.01;
    };
    expect(floor.length).toBeGreaterThan(40);
    expect(floor.filter(inside)).toEqual([]);
  });

  it('is absent unless asked for: no framing key, the same faces', () => {
    const plain = house();
    expect(plain.framing).toBeUndefined();
    expect(JSON.stringify(house({ framing: false }).faces)).toBe(JSON.stringify(plain.faces));
  });

  it('framed: the structure stands in for the walls, slabs and roof; cutaway: the finished house past the cut', () => {
    const plain = house();
    const framed = house({ framing: { system: 'platform' } });
    expect(framed.framing).toMatchObject({ system: 'platform', view: 'framed', roof: { framedAs: 'gable' } });
    expect(framed.framing.takeoff.timber.pieces).toBeGreaterThan(500);
    const skin = (fs) => fs.filter((f) => !String(f.group || '').startsWith('framing:'));
    expect(skin(framed.faces).length).toBeLessThan(plain.faces.length / 2);
    const cut = house({ framing: { system: 'steel', view: 'cutaway' } });
    const xc = 2 + 0.5 * 44;
    expect(skin(cut.faces).every((f) => f.corners.every((c) => c[0] >= xc - 1e-6))).toBe(true);
    expect(cut.faces.some((f) => String(f.group).startsWith('framing:') && f.corners.some((c) => c[0] < xc - 1))).toBe(true);
    expect(cut.framing.takeoff.steel.tonnes).toBeGreaterThan(1);
  });

  it('draws a masonry house at the level its cameras earn, its units and members stamped', () => {
    const h = house({ framing: { system: 'masonry' } });
    expect(h.framing.detail.foundation).toBe('sparse');
    expect(h.framing.drawn.faces).toBeLessThan(5000);
    expect(h.repeats.length).toBeGreaterThan(5);
    expect(h.faces.filter((f) => String(f.texture).startsWith('masonry:')).length).toBeGreaterThan(8);
    expect(h.framing.takeoff.masonry.units).toBeGreaterThan(20000);
    // every brick, stamped: the page carries a template per brick shape, not a face per brick
    const full = house({ framing: { system: 'masonry', detail: 'full' } });
    expect(full.repeats.reduce((a, r) => a + r.transforms.length, 0)).toBeGreaterThan(20000);
    expect(full.framing.drawn.faces).toBeLessThan(5000);
  });

  it('clips a face across the cut, carrying its uv', () => {
    const f = { corners: [[0, 0, 0], [2, 0, 0], [2, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], fill: '#fff' };
    const [c] = clipFacesAtX([f], 1);
    expect(c.corners.map((p) => p[0]).sort()).toEqual([1, 1, 2, 2]);
    expect(c.uv.map((p) => p[0]).sort()).toEqual([0.5, 0.5, 1, 1]);
    expect(clipFacesAtX([f], 3)).toEqual([]);
    expect(clipFacesAtX([f], -1)[0]).toBe(f);
  });

  it('validates, and asks for the kernel only when a system cuts or shapes', () => {
    expect(validateFraming({ system: 'adobe', view: 'xray' }).join('\n')).toMatch(/system: one of[\s\S]*view: one of/);
    expect(validateFraming(true)).toEqual([]);
    expect(manifestWantsExact({ kind: 'floorplan', framing: { system: 'steel' } })).toBe(true);
    expect(manifestWantsExact({ kind: 'floorplan', framing: { system: 'kigumi' } })).toBe(true);
    expect(manifestWantsExact({ kind: 'floorplan', framing: { system: 'kigumi', joints: false } })).toBe(false);
    expect(manifestWantsExact({ kind: 'floorplan', framing: { system: 'platform' } })).toBe(false);
    expect(manifestWantsExact({ kind: 'workbench', frames: [{ members: [{ id: 'c', section: 'HEA200' }] }] })).toBe(true);
  });
});
