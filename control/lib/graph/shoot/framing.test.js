import { describe, it, expect } from 'vitest';
import { solveFraming, frameKey, readFraming, ANGLES, SIDES, DUTCH } from './framing.js';
import { SIZES, STEEP, frameRead, readFigure } from './frame.js';
import { normalizeShoot } from './plan.js';
import { applyShootOp } from './ops.js';
import { compileCamera, cameraAt } from './sample.js';

const walker = { id: 'walker:0', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: (t) => ({ pos: [t, t * 0.5, 0], heading: Math.atan2(0.5, 1) }) };
const subjects = new Map([[walker.id, walker]]);
const fig = { pos: [2, -1, 0.3], heading: 0.6, height: 1.75 };
// one size of each procedure the solver runs: a size that cuts the figure, one that shows it whole
const cutSize = SIZES.find((z) => z.cut != null && z.id !== 'ecu'), wholeSize = SIZES.find((z) => z.fill != null);
const offset = (s) => [s.pos[0] - fig.pos[0], s.pos[1] - fig.pos[1]];

describe('framing by words', () => {
  it('the read of a solved camera gives back the size it was asked for (a cut size, a whole one, from a steep angle)', () => {
    for (const z of [cutSize, wholeSize]) expect(solveFraming({ size: z.id }, fig).read.size).toBe(z.id);
    const steep = ANGLES.find((a) => Math.abs(a.deg) > STEEP);
    expect(solveFraming({ size: wholeSize.id, angle: steep.id }, fig).read.size).toBe(wholeSize.id);
  });
  it('a cut size lands the crown at its headroom and its edge on the figure where the size says', () => {
    const s = solveFraming({ size: cutSize.id }, fig);
    expect(s.read.top).toBeCloseTo(cutSize.headroom, 2);
    expect(s.read.cut).toBeCloseTo(cutSize.aim, 2);
  });
  it('the side is where the camera stands round the subject, from its facing (its left is +90°)', () => {
    const left = SIDES.find((x) => x.id === 'profile-left'), back = SIDES.find((x) => x.id === 'back');
    const o = offset(solveFraming({ size: 'ms', side: left.id }, fig)), l = Math.hypot(...o);
    expect((o[0] * -Math.sin(fig.heading) + o[1] * Math.cos(fig.heading)) / l).toBeGreaterThan(0.9);
    const b = offset(solveFraming({ size: 'ms', side: back.id }, fig));
    expect(b[0] * Math.cos(fig.heading) + b[1] * Math.sin(fig.heading)).toBeLessThan(0);
    expect(solveFraming({ size: 'ms', side: 'front' }, fig).read.facing).toBe('toward');
  });
  it('a high angle looks down from above the look point, a low one up from below it', () => {
    const hi = solveFraming({ size: 'ms', angle: 'high' }, fig), lo = solveFraming({ size: 'ms', angle: 'low' }, fig);
    expect(hi.pos[2]).toBeGreaterThan(hi.poi[2]);
    expect(lo.pos[2]).toBeLessThan(lo.poi[2]);
  });
  it('place puts the figure on a third; lead puts the room ahead of the way it faces', () => {
    expect(solveFraming({ size: 'ms', side: 'front', place: 'left' }, fig).read.u).toBeCloseTo(1 / 3, 2);
    expect(solveFraming({ size: 'ms', side: 'front', place: 'right third' }, fig).read.u).toBeCloseTo(2 / 3, 2);
    const lead = solveFraming({ size: 'ms', side: 'profile-left' }, fig);   // seen from its left it faces frame left
    expect(lead.read.facing).toBe('left');
    expect(lead.read.u).toBeCloseTo(2 / 3, 2);
  });
  it('dutch is roll; a lens said is the lens kept', () => {
    expect(solveFraming({ size: 'cu', dutch: true }, fig).roll).toBe(DUTCH);
    expect(solveFraming({ size: 'cu', lens: '35mm' }, fig).focal_mm).toBe(35);
    expect(solveFraming({ size: 'cu' }, fig).focal_mm).toBe(SIZES.find((z) => z.id === 'cu').lens);
  });
  it('a word it cannot read is warned and its default kept', () => {
    const r = readFraming({ size: 'portrait', angle: 'sideways' });
    expect(r.framing.size).toBe('ms');
    expect(r.framing.angle).toBe('eye');
    expect(r.warnings).toHaveLength(2);
  });
  it('deterministic', () => {
    expect(solveFraming({ size: 'mcu', angle: 'low', side: 'three-quarter-right' }, fig)).toEqual(solveFraming({ size: 'mcu', angle: 'low', side: 'three-quarter-right' }, fig));
  });
});

describe('a key framed in words', () => {
  it('rides its subject: the same size later in its walk', () => {
    const { key } = frameKey({ size: 'mcu', side: 'three-quarter-left' }, { pos: walker.at(0).pos, heading: walker.at(0).heading, height: 1.75 }, { follow: walker.id });
    expect(key.pos.frame).toBe('subject');
    const p = normalizeShoot({ cameras: [{ id: 'a', keys: [key] }] }, { subjects }).plan;
    const cam = cameraAt(compileCamera(p.cameras[0], { subjects }), 5), at = walker.at(5);
    expect(readFigure(cam, { pos: at.pos, heading: at.heading, height: 1.75 }).size).toBe('mcu');
  });
  it('a plan key with `frame` is solved by normalizeShoot, keeps its words and what it is about, and normalizes to itself', () => {
    const { plan, warnings } = normalizeShoot({ cameras: [{ id: 'a', keys: [{ t: 1, frame: { on: 'walker:0', size: 'cu', angle: 'low' }, ease: 'easy ease' }] }] }, { subjects });
    expect(warnings).toEqual([]);
    const k = plan.cameras[0].keys[0];
    expect(k.about).toBe('walker:0');
    expect(k.framing.size).toBe('cu');
    expect(k.ease).toBe('easy_ease');
    expect(k.pos.follow).toBe('walker:0');
    expect(normalizeShoot(plan, { subjects }).plan).toEqual(plan);
  });
  it('`follow: false` stands the camera where the subject was; a point with a heading is framed too', () => {
    const fixed = normalizeShoot({ cameras: [{ id: 'a', keys: [{ t: 2, frame: { on: 'walker:0', size: 'ws', follow: false } }] }] }, { subjects }).plan;
    expect(Array.isArray(fixed.cameras[0].keys[0].pos)).toBe(true);
    const pt = normalizeShoot({ cameras: [{ id: 'a', keys: [{ t: 0, frame: { on: [5, 5, 0], heading: 90, size: 'fs' } }] }] }, { subjects }).plan;
    expect(pt.cameras[0].keys[0].pos[1]).toBeGreaterThan(5);   // in front of a figure facing +y
  });
  it('a key that frames nothing it can find is dropped with a warning', () => {
    const { plan, warnings } = normalizeShoot({ cameras: [{ id: 'a', keys: [{ t: 0, pos: [0, -5, 2], poi: [0, 0, 1] }, { t: 2, frame: { on: 'car:9', size: 'cu' } }] }] }, { subjects });
    expect(plan.cameras[0].keys).toHaveLength(1);
    expect(warnings.join(' ')).toMatch(/car:9/);
  });
  it('a plan framed by words reads as its words and is advised nothing', () => {
    const p = normalizeShoot({ cameras: [{ id: 'a', keys: [{ t: 0, frame: { on: 'walker:0', size: 'mcu', side: 'three-quarter-left' } }, { t: 4, frame: { on: 'walker:0', size: 'mcu', side: 'three-quarter-left' } }] }] }, { subjects }).plan;
    const r = frameRead(p, { subjects });
    expect(r.shots[0]).toMatchObject({ about: 'walker:0', size: 'mcu' });
    expect(r.notes).toEqual([]);
  });
});

describe('the frame op', () => {
  const base = () => normalizeShoot({ cameras: [{ id: 'a', keys: [{ t: 0, pos: [0, -5, 2], poi: [0, 0, 1] }] }] }, { subjects }).plan;
  it('adds a camera framing a subject, with a shot for it', () => {
    const { plan } = applyShootOp(base(), { op: 'frame', camera: 'close', t: 0, on: 'walker:0', size: 'cu' });
    const p = normalizeShoot(plan, { subjects }).plan;
    expect(p.cameras.map((c) => c.id)).toEqual(['a', 'close']);
    expect(p.shots.map((s) => s.camera)).toContain('close');
    expect(p.cameras[1].keys[0].framing.size).toBe('cu');
  });
  it('reframes a key at its time; moving a framed key by hand forgets its words', () => {
    let p = normalizeShoot(applyShootOp(base(), { op: 'frame', camera: 'a', t: 0, on: 'walker:0', size: 'ms' }).plan, { subjects }).plan;
    expect(p.cameras[0].keys).toHaveLength(1);
    expect(p.cameras[0].keys[0].about).toBe('walker:0');
    p = normalizeShoot(applyShootOp(p, { op: 'set_key', camera: 'a', t: 0, pos: [0, -9, 2] }).plan, { subjects }).plan;
    expect(p.cameras[0].keys[0].about).toBeUndefined();
    expect(p.cameras[0].keys[0].framing).toBeUndefined();
  });
});
