import { describe, it, expect, beforeAll } from 'vitest';
import { validateBuild, expandBuild } from './furniture-builds.js';
import { lowerFrame, validateFrames, frameStamps } from './frame.js';
import { manualPlan } from './manual.js';
import { hardwarePart } from './hardware.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

const dresser = { id: 'dresser', unit: 'mm', build: { type: 'carcass', w: 800, h: 1000, d: 450, drawers: 4, drawerHeight: 230 } };
const cabinet = { id: 'cabinet', unit: 'mm', build: { type: 'carcass', w: 800, h: 1800, d: 400, doors: 2, shelves: 3 } };
const table = { id: 'table', unit: 'mm', build: { type: 'table', w: 1200, d: 750, h: 750, species: 'oak' } };
const chair = { id: 'chair', unit: 'mm', build: { type: 'chair' } };
const ids = (r) => r.members.map((m) => m.id);

describe('construction/furniture-builds — a piece from a few dials', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('validates its dials', () => {
    expect(validateBuild({ type: 'sofa' }, 'b')[0]).toMatch(/type: 'carcass' \| 'table' \| 'chair'/);
    expect(validateBuild({ type: 'carcass', w: 800, h: 0, d: 400 }, 'b')).toEqual(['b.h: a size in the frame\'s unit']);
    expect(validateBuild({ type: 'carcass', w: 800, h: 900, d: 400, doors: 3 }, 'b')[0]).toMatch(/doors: a whole number \(0, 1 or 2\)/);
    expect(validateFrames([{ build: { type: 'chair' }, unit: 'mm' }])).toEqual([]);
    expect(validateFrames([{ build: { type: 'table', w: 1 } }]).join('\n')).toMatch(/build.d/);
  });
  it('builds in the frame\'s unit: the same carcass in cm is the same boxes / 10', () => {
    const mm = expandBuild({ unit: 'mm', build: { type: 'carcass', w: 600, h: 900, d: 350 } });
    const cm = expandBuild({ unit: 'cm', build: { type: 'carcass', w: 60, h: 90, d: 35 } });
    expect(cm.members.map((m) => m.box.max.map((v) => v * 10))).toEqual(mm.members.map((m) => m.box.max));
  });
  it('builds a knock-down carcass that goes together, stands square and says what it built', () => {
    const { report } = lowerFrame(cabinet);
    expect(report.build.type).toBe('carcass');
    expect(report.build.dials).toMatchObject({ joinery: 'kd', back: 'groove', doors: 2, shelves: 3, partition: true });
    expect(report.build.expanded.members.length).toBe(report.members.length);
    expect(ids(report)).toEqual(expect.arrayContaining(['side-l', 'side-r', 'top', 'bottom', 'plinth', 'partition', 'back', 'door-l', 'door-r']));
    expect(report.assembly.order).not.toBeNull();
    const f = report.furniture;
    expect(f.racking.every((r) => r.resisted)).toBe(true);
    expect(f.interference).toEqual([]);
    expect(f.fasteners).toEqual([]);
    // two tall doors: four concealed hinges each, their plates screwed to the sides
    expect(report.joints.filter((j) => j.type === 'hinge').map((j) => j.hinges)).toEqual([4, 4]);
    const count = Object.fromEntries(f.hardware.map((h) => [h.code, h.count]));
    expect(count['hinge-35']).toBe(8);
    expect(count['wood-4x16']).toBe(16);
  });
  it('builds drawers as boxes on slides, each put together first and slid in, its front screwed on last', () => {
    const { report } = lowerFrame(dresser);
    const subs = report.assembly.subassemblies;
    expect(subs.map((s) => s.group)).toEqual(['drawer-1', 'drawer-2', 'drawer-3', 'drawer-4']);
    expect(subs[0].parts[subs[0].parts.length - 1]).toBe('d1-front');
    expect(subs[0].dir).toEqual([0, 1, 0]);
    const slides = report.joints.filter((j) => j.type === 'slide');
    expect(slides).toHaveLength(8);
    expect(slides[0]).toMatchObject({ slide: 'slide-400', gapMm: 12.7 });
    // the box is the opening less a slide each side
    const box = report.members.filter((m) => m.id === 'd1-box-front')[0];
    expect(box.lengthMm).toBeCloseTo(800 - 2 * 18 - 2 * 12.7 - 2 * 16, -0.5);
    expect(report.furniture.interference).toEqual([]);
    expect(report.furniture.fasteners).toEqual([]);
  });
  it('checks a chest with its drawers out and a child on the top one (after ASTM F2057-23)', () => {
    const { report } = lowerFrame(dresser);
    const d = report.furniture.tip.drawers;
    expect(d).toMatchObject({ count: 4, childKg: 22.7, onDrawer: 'drawer-4', tips: true });
    expect(d.outMm).toBe(Math.round((2 / 3) * 400));                // two-thirds of the 400 mm slide
    expect(frameStamps(report, 'd').join('\n')).toMatch(/tips forward with its 4 drawers out/);
    // a low, deep chest with one drawer does not
    const low = lowerFrame({ id: 'low', unit: 'mm', build: { type: 'carcass', w: 800, h: 650, d: 500, drawers: 1, doors: 1 } }).report.furniture.tip;
    expect(low.drawers).toBeUndefined();                         // under 686 mm: outside the standard's scope
    expect(manualPlan(dresser).steps.at(-1).kind).toBe('anchor');
  });
  it('builds a table whose tenons stop short of each other in the legs, and a chair that assembles', () => {
    const t = lowerFrame(table).report;
    expect(t.build.dials.tenonDepthMm).toBe(16);                 // 45 leg − 12 setback − 10 half-apron − 6 half-tenon − 1
    expect(t.furniture.interference).toEqual([]);
    expect(t.assembly.subassemblies.map((s) => s.parts)).toEqual([['leg-fl', 'apron-f', 'leg-fr']]);
    const c = lowerFrame(chair).report;
    expect(c.assembly.order).not.toBeNull();
    expect(c.furniture.interference).toEqual([]);
    expect(c.furniture.fasteners).toEqual([]);
    expect(c.furniture.tip.pull).toBeUndefined();                // a chair is not storage: no wall anchor
    expect(frameStamps(c, 'c')).toEqual([]);
  });
  it('keeps a partition out of a drawer stack', () => {
    const r = lowerFrame(dresser).report;
    expect(ids(r)).not.toContain('partition');
  });
  it('catalogs the hinge and the slide', () => {
    expect(hardwarePart('hinge-35')).toMatchObject({ cup: { d: 35, depth: 13 }, edgeDist: 21.5, setback: 37 });
    expect(hardwarePart('slide-400')).toMatchObject({ length: 400, t: 12.7 });
    expect(hardwarePart('slide-420')).toBeNull();
  });
});
