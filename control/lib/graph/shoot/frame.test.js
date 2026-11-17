import { describe, it, expect } from 'vitest';
import { projectPoint, readFigure, frameRead, sizeOf, SIZES, LANDMARKS } from './frame.js';
import { normalizeShoot } from './plan.js';
import { hfovForFocal } from './lens.js';

// one figure walking +x at a metre a second, and one standing still facing +y
const walker = { id: 'walker:0', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: (t) => ({ pos: [t, 0, 0], heading: 0 }) };
const stander = { id: 'walker:1', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: () => ({ pos: [0, 10, 0], heading: Math.PI / 2 }) };
const subjects = new Map([[walker.id, walker], [stander.id, stander]]);
const fig = { pos: [0, 0, 0], heading: Math.PI / 2, height: 1.75 };
// a level camera looking at the figure's chest from in front of it (it faces +y)
const level = (d, h = 1.3, focal = 50) => ({ pos: [0, d, h], look: [0, 0, h], hfov: hfovForFocal(focal), roll: 0 });
const plan = (raw) => normalizeShoot(raw, { subjects }).plan;
const codes = (r) => r.notes.map((n) => n.code);

describe('the frame', () => {
  it('a point at the look point is the middle of the frame; one behind the lens is not on it', () => {
    const c = level(3);
    const p = projectPoint(c, c.look);
    expect(p.u).toBeCloseTo(0.5, 9);
    expect(p.v).toBeCloseTo(0.5, 9);
    expect(projectPoint(c, [0, 5, 1.3])).toBeNull();
  });
  it('frame right is the camera\'s right, frame up is up, and a clockwise roll turns the frame with it', () => {
    const c = level(3);   // looking along −y: the camera's right is −x
    expect(projectPoint(c, [-0.5, 0, 1.3]).u).toBeGreaterThan(0.5);
    expect(projectPoint(c, [0, 0, 1.8]).v).toBeLessThan(0.5);
    const rolled = projectPoint({ ...c, roll: 20 }, [-0.5, 0, 1.3]);
    expect(rolled.v).toBeLessThan(0.5);
  });
});

describe('shot sizes by where the frame cuts the figure', () => {
  it('the size widens as the camera backs away, through the cut sizes and then the whole-figure ones', () => {
    const order = SIZES.map((z) => z.id), seen = [];
    let last = -1;
    for (let d = 0.4; d < 40; d *= 1.12) {
      const k = order.indexOf(readFigure(level(d, 1.6), fig).size);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
      if (!seen.includes(order[k])) seen.push(order[k]);
    }
    expect(seen.some((s) => SIZES.find((z) => z.id === s).cut != null)).toBe(true);
    expect(seen.some((s) => SIZES.find((z) => z.id === s).fill != null)).toBe(true);
  });
  it('the cut is the share of the figure the bottom edge lands on, and is 0 when the feet show', () => {
    const r = readFigure(level(1.2, 1.5), fig);
    expect(r.cut).toBeGreaterThan(0.3);
    expect(r.cut).toBeLessThan(1);
    expect(readFigure(level(12), fig).cut).toBe(0);
  });
  it('a crown out of the frame reads as a negative headroom', () => {
    expect(readFigure({ ...level(1.4, 1.2), look: [0, 0, 1.0] }, fig).top).toBeLessThan(0);
  });
  it('sizes are said in the words people use', () => {
    expect(sizeOf('close-up').id).toBe('cu');
    expect(sizeOf('Cowboy').id).toBe('mls');
    expect(sizeOf('medium close up').id).toBe('mcu');
    expect(sizeOf('portrait')).toBeNull();
  });
  it('a figure seen from straight above is sized by its length across the frame', () => {
    const r = readFigure({ pos: [0, 0.01, 6], look: [0, 0, 0.9], hfov: hfovForFocal(35), roll: 0 }, fig);
    expect(r.steep).toBe(true);
    expect(SIZES.map((z) => z.id)).toContain(r.size);
  });
});

describe('the frame read of a plan', () => {
  it('a shot is about the subject its camera follows, and says its size and facing', () => {
    const r = frameRead(plan({ cameras: [{ id: 'a', keys: [{ t: 0, pos: { follow: 'walker:0', offset: [0, -5, 1.5] }, poi: { follow: 'walker:0', offset: [0, 0, 1.3] } }, { t: 4, pos: { follow: 'walker:0', offset: [0, -5, 1.5] }, poi: { follow: 'walker:0', offset: [0, 0, 1.3] } }] }] }), { subjects });
    expect(r.shots[0].about).toBe('walker:0');
    expect(['fs', 'ws']).toContain(r.shots[0].size);
    expect(r.shots[0].facing).toBe('right');   // walking +x, seen from −y: the camera's right is +x
  });
  it('short-sided: a mover placed toward the side it faces is advised lead room', () => {
    // seen from −y the camera's right is +x, so the walker faces frame right; a look point behind it puts it on the right
    const cam = (dx) => ({ id: 'a', keys: [{ t: 0, pos: { follow: 'walker:0', offset: [dx, -4, 1.4] }, poi: { follow: 'walker:0', offset: [dx, 0, 1.2] } }, { t: 3, pos: { follow: 'walker:0', offset: [dx, -4, 1.4] }, poi: { follow: 'walker:0', offset: [dx, 0, 1.2] } }] });
    const behind = frameRead(plan({ cameras: [cam(-0.8)] }), { subjects });
    expect(behind.shots[0].facing).toBe('right');
    expect(codes(behind)).toContain('short-sided');
    const ahead = frameRead(plan({ cameras: [cam(0.8)] }), { subjects });
    expect(codes(ahead)).not.toContain('short-sided');
  });
  it('a head cut off at the top of a medium shot is advised', () => {
    const r = frameRead(plan({ cameras: [{ id: 'a', keys: [{ t: 0, pos: [0, 11.4, 0.9], poi: [0, 10, 0.9] }] }] }), { subjects });
    expect(r.shots[0].about).toBe('walker:1');
    expect(codes(r)).toContain('head-cut');
  });
  it('a subject that walks out of a locked-off frame is lost', () => {
    const r = frameRead(plan({ cameras: [{ id: 'a', keys: [{ t: 0, pos: { follow: 'walker:0', offset: [0, -4, 1.4] }, poi: [0, 0, 1.2] }, { t: 6, pos: [0, -4, 1.4], poi: [0, 0, 1.2] }] }], shots: [{ camera: 'a', span: [0, 6] }] }), { subjects });
    expect(codes(r)).toContain('lost');
  });
  it('a jump cut: the same subject, the same size, a few degrees round; none at 60°', () => {
    const at = (deg, d = 4) => [Math.cos(deg * Math.PI / 180) * d, 10 + Math.sin(deg * Math.PI / 180) * d, 1.4];
    const two = (a, b) => plan({ cameras: [{ id: 'a', keys: [{ t: 0, pos: at(a), poi: [0, 10, 1.2] }] }, { id: 'b', keys: [{ t: 0, pos: at(b), poi: [0, 10, 1.2] }] }], shots: [{ camera: 'a', span: [0, 2] }, { camera: 'b', span: [2, 4] }] });
    expect(codes(frameRead(two(80, 90), { subjects }))).toContain('jump-cut');
    expect(codes(frameRead(two(30, 90), { subjects }))).not.toContain('jump-cut');
  });
  it('a direction flip: a mover crossing frame right, then frame left after the cut', () => {
    const side = (y) => ({ pos: { follow: 'walker:0', offset: [0, y, 1.4] }, poi: { follow: 'walker:0', offset: [0, 0, 1.2] } });
    const p = plan({ cameras: [{ id: 'a', keys: [{ t: 0, ...side(-5) }, { t: 4, ...side(-5) }] }, { id: 'b', keys: [{ t: 0, ...side(5) }, { t: 4, ...side(5) }] }], shots: [{ camera: 'a', span: [0, 2] }, { camera: 'b', span: [2, 4] }] });
    expect(codes(frameRead(p, { subjects }))).toContain('direction-flip');
  });
  it('a shot of nothing in particular is read but advised nothing', () => {
    const r = frameRead(plan({ cameras: [{ id: 'a', keys: [{ t: 0, pos: [50, 50, 30], poi: [60, 60, 0] }] }] }), { subjects });
    expect(r.shots[0].about).toBeUndefined();
    expect(r.notes).toEqual([]);
  });
  it('the landmarks run from the crown down to the feet', () => {
    const v = Object.values(LANDMARKS);
    expect(v.every((x, i) => i === 0 || x < v[i - 1])).toBe(true);
  });
});
