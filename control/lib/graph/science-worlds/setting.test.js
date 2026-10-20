import { describe, it, expect } from 'vitest';
import { placeScience, readScienceSetting, groundUnder, checkScienceSetting } from './setting.js';

// A science world stood in a world, on a small made-up world (a grass square at 0.5 m and a stone wall at x = 6): one
// case per procedure (1:1 with and without the world's ground, a wall, the setting's gravity and air, a bench prop).

const GROUND = { corners: [[-20, -20, 0.5], [20, -20, 0.5], [20, 20, 0.5], [-20, 20, 0.5]], fill: '#556b2f', material: 'grass' };
const WALL = { corners: [[6, -5, 0.5], [6, 5, 0.5], [6, 5, 4], [6, -5, 4]], fill: '#8b8b8b', material: 'stone' };
const world = () => ({ faces: [GROUND, WALL], cameras: [{ name: 'world', worldFraming: { cameraPosition: [30, 30, 30], lookAt: [0, 0, 0], horizontalFov: 46 } }], viewBox: { width: 1120, height: 780 } });
const BALL = { bodies: [{ id: 'ball', mass: 0.45, radius: 0.11, at: [0, 0, 1.5], v: [1, 0, 4] }], laws: [{ law: 'gravity-uniform' }], duration: 2 };
const gate = (r, id) => r.gates.find((g) => g.id === id);
const panel = (p, head) => p.science.honesty.sections.find((s) => s.head === head).items;

describe('science worlds: a demo stood in a world', () => {
  it('stands a classical demo 1:1 at `at`, opens the page on it, and says when a body falls through the ground', () => {
    const p = world();
    const r = placeScience(p, { kind: 'classical', model: BALL, at: [0, 0, 0.5] });
    expect(r.oneToOne).toBe(true);
    expect(p.cameras.map((c) => c.name)).toEqual(['demo', 'world']);
    expect(p.movers[0].path[0]).toEqual([0, 0, 2]);   // the ball starts 1.5 m above `at`
    expect(p.movers[0].group).toBe('sci:body:ball');
    expect(gate(r, 'scenery-clear').ok).toBe(false);
    expect(gate(r, 'scenery-clear').value.crossings[0]).toMatch(/ball through grass/);
  });

  it('makes the world\'s ground a plane law at its height, says so, and catches a wall no law covers', () => {
    const p = world();
    const r = placeScience(p, { kind: 'classical', model: { ...BALL, bodies: [{ ...BALL.bodies[0], v: [5, 0, 4] }] }, at: [0, 0, 0.5], ground: 'from-world' });
    expect(gate(r, 'scenery-clear').value.crossings[0]).toMatch(/ball through stone/);
    expect(panel(p, 'Left out (assumptions)').some((i) => /world's own surface under the demo \(grass\)/.test(i.text))).toBe(true);
    expect(p.faces.filter((f) => f.group === 'sci:scene')).toEqual([]);   // the world draws its ground; the plane's patch is dropped
    const clear = placeScience(world(), { kind: 'classical', model: BALL, at: [0, 0, 0.5], ground: 'from-world' });
    expect(gate(clear, 'scenery-clear').ok).toBe(true);
    expect(() => placeScience(world(), { kind: 'classical', model: BALL, at: [30, 30, 0.5], ground: 'from-world' })).toThrow(/no surface of the world lies under/);
    expect(groundUnder([GROUND, { corners: [[-1, -1, 3], [1, -1, 3], [1, 1, 3], [-1, 1, 3]] }], [0, 0, 0.5]).z).toBe(0.5);   // a roof above is not the ground
  });

  it('holds the model\'s gravity and air to the setting, and never sets them itself', () => {
    expect(gate(checkScienceSetting({ kind: 'classical', model: BALL, at: [0, 0, 0], setting: 'moon' }), 'setting-agrees').ok).toBe(false);
    expect(gate(checkScienceSetting({ kind: 'classical', model: { ...BALL, frame: { g: 'moon' } }, at: [0, 0, 0], setting: 'moon' }), 'setting-agrees').ok).toBe(true);
    const drag = checkScienceSetting({ kind: 'classical', model: { ...BALL, frame: { g: 'moon' }, laws: [...BALL.laws, { law: 'drag-quadratic', cd: 0.47 }] }, at: [0, 0, 0], setting: 'moon' });
    expect(gate(drag, 'setting-air').ok).toBe(false);
    expect(checkScienceSetting({ kind: 'classical', model: BALL, at: [0, 0, 0] }).standsAs).toBe('1:1');
  });

  it('stands anything else as a bench prop in a glass case, its true magnification on the panel', () => {
    const p = world();
    const r = placeScience(p, { kind: 'microscopic', at: [3, 3, 0.5], model: { box: { size: ['5 µm', '5 µm', '5 µm'] }, species: [{ id: 'bead', radius: '0.2 µm', count: 10 }], laws: [{ law: 'brownian' }], duration: '1 s' } });
    expect(r.oneToOne).toBe(false);
    expect(p.faces.filter((f) => f.group === 'sci:case')).toHaveLength(72);   // twelve edges, six sides each
    const drawn = panel(p, 'Drawn, not real').map((i) => i.text);
    expect(drawn.filter((t) => /glass case 1 m across: magnified/.test(t))).toHaveLength(1);
    expect(drawn.filter((t) => /^magnified/.test(t))).toEqual([]);   // the case's magnification replaces the box's own
    for (const m of p.movers) for (const q of m.path) expect(Math.hypot(q[0] - 3, q[1] - 3, q[2] - 1)).toBeLessThan(0.5 + 1e-9);
  });

  it('reads the spec, and teaches what cannot stand', () => {
    expect(() => readScienceSetting({ kind: 'classical', model: BALL, at: [0, 0, 0], colour: 'red' })).toThrow(/unknown field 'colour'/);
    expect(() => readScienceSetting({ kind: 'relativistic', model: { system: 'light', laws: [] }, at: [0, 0, 0] })).toThrow(/cannot stand in a world/);
    expect(() => readScienceSetting({ kind: 'quantum', model: {}, at: [0, 0, 0], ground: 'from-world' })).toThrow(/bench prop stands in its case/);
    expect(readScienceSetting({ kind: 'classical', model: BALL, at: ['2 m', 0, 0], yaw: '90°' })).toMatchObject({ at: [2, 0, 0], yaw: Math.PI / 2, setting: 'earth', caseSize: 1 });
  });
});
