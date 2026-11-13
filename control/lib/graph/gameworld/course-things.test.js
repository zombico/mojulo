import { describe, expect, it } from 'vitest';
import { courseOf, courseAudit, courseOfLevel, blockLen, PRIMITIVES, LANES } from './roll-course.js';
import { DRESS_THEMES, dressOf } from './course-dress.js';
import { askDrawing, jumpTell, steerTell, endDrawing, ASK_THINGS } from './course-things.js';
import { courseSheetHtml } from './course-sheet.js';
import { readRoll, rolledIds } from '../game/roll.js';
import { standBlocks } from '../playscape/terrain.js';
import { POLES } from './feel/cards.js';
import { feelRule } from './feel/lower.js';

// WHAT A COURSE'S THINGS ARE: a theme's premise, and the shapes it gives the asks, the tells and the end.
const poles = Object.keys(POLES), MOMENTUM = poles.find((p) => POLES[p].base === 'pinball'), FOOT = poles.find((p) => !feelRule(p).airJumps && feelRule(p).jumpSpeed < 4);
const C = courseOf({ feel: MOMENTUM }, { slots: 6 }), col = C.dress.palette, T = DRESS_THEMES['last-train'];
const block = (id) => C.blocks.find((b) => b.id === `s1-${id}`);
const colours = new Set(Object.values(col));

describe('the premise: one sentence every thing answers to', () => {
  it('the last train says who runs and toward what, and names every thing on the screen', () => {
    expect(T.premise).toMatch(/last train home/);
    for (const k of ['lanes', 'hurdle', 'block', 'posts', 'tell-jump', 'tell-steer', 'a', 'b', 'backdrop', 'end']) expect(T.things[k], k).toEqual(expect.any(String));
    expect(dressOf('last-train').laws.find((l) => l.law === 'premise')).toMatchObject({ holds: true, says: expect.stringContaining(T.premise) });
    for (const thing of Object.values(T.asks)) expect(ASK_THINGS[thing]).toBeDefined();
    const html = courseSheetHtml(C, { title: 'Dash' });
    expect(html).toContain('<h2>The premise</h2>');
    expect(html).toContain(T.things.posts);
    expect(courseSheetHtml(courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'rail-yard' }))).not.toContain('<h2>The premise</h2>');
  });
});

describe('an ask is drawn as the thing it is, over the box that is met', () => {
  it('one box a thing, whatever it is drawn as: the drawing stays inside it and uses the dress\'s own colours', () => {
    for (const id of C.prims) {
      const b = block(id), P = PRIMITIVES[id];
      expect(b.form).toBe('crate');
      expect(b.size).toEqual([P.ask === 'steer' ? 4 : 6.6, C.lens[id], P.h]);
      const drawn = b.marks.filter((m) => m.corners.some((c) => c[2] > 0.05) && m.corners.every((c) => c[1] >= b.at[1] - b.size[1] / 2 - 0.05));
      expect(drawn.length, id).toBeGreaterThan(4);
      for (const m of drawn) for (const c of m.corners) {
        expect(Math.abs(c[0] - b.at[0])).toBeLessThanOrEqual(b.size[0] / 2 + 0.03);
        expect(c[1]).toBeLessThanOrEqual(b.at[1] + b.size[1] / 2 + 0.03);
        expect(c[2]).toBeLessThanOrEqual(P.h + 0.03);
      }
    }
    // (rolled as one thing: the drawing goes when the ask does, and its box is the one collider)
    const read = readRoll(C.roll, { blocks: C.blocks }), B = standBlocks(C.blocks, { rolled: rolledIds(read) });
    expect(Object.keys(B.things)).toHaveLength(C.blocks.length);
    expect(B.faces.every((f) => /^roll:s\d+-/.test(f.group))).toBe(true);
    expect(B.things['s1-posts-left'].max[1] - B.things['s1-posts-left'].min[1]).toBeCloseTo(C.lens['posts-left'], 2);
  });

  it('a barrier is striped, crates are five, wagons are two with a gap, a lamp and a roof each', () => {
    const box = { x0: -3.3, x1: 3.3, y0: 10, y1: 10.7, h: 0.75 };
    expect(askDrawing('barrier', box, col).filter((m) => m.fill === col['tell-jump'] && m.corners.every((c) => Math.abs(c[1] - (10 - 0.012)) < 1e-6))).toHaveLength(5);
    // (five crates: a stencil and a brace each, every other one a shade deeper, six gaps)
    const K = askDrawing('crates', { ...box, y1: 11.4, h: 1 }, col);
    expect(K.filter((m) => m.fill === col['tell-jump'])).toHaveLength(5);
    expect(K.filter((m) => new Set(m.corners.map((c) => c[0].toFixed(3))).size === 4)).toHaveLength(5);
    expect(K.filter((m) => m.fill === col.iron && m.corners.every((c) => c[2] <= 1 && c[1] < 10))).toHaveLength(6);
    const W = askDrawing('wagon', { x0: -1, x1: 3, y0: 10, y1: 13.2, h: 3 }, col);
    expect(W.filter((m) => m.fill === col.lamp)).toHaveLength(2);
    expect(W.some((m) => m.fill === col.iron && m.corners.every((c) => Math.abs(c[0] - 1) < 0.12))).toBe(true);
    expect(askDrawing('nothing', box, col)).toEqual([]);
    for (const m of [...askDrawing('barrier', box, col), ...W]) expect(m.fill).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a wagon is as long as it is drawn, and the course is sized for it: the rest after it is still the rest', () => {
    expect(C.lens['posts-left']).toBe(T.lens['posts-left']);
    expect(C.lens.hurdle).toBe(PRIMITIVES.hurdle.len);
    expect(blockLen(block('posts-left'))).toBe(3.2);
    expect(blockLen(courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'rail-yard' }).blocks.find((b) => b.id === 's1-posts-left'))).toBe(PRIMITIVES['posts-left'].len);
    // (fair for a hero of momentum and for one on its feet, whose segment is a third the length)
    for (const feel of [MOMENTUM, FOOT]) expect(courseAudit(courseOf({ feel }, { slots: 6 }), { seeds: 6 }).laws.filter((l) => !l.holds), feel).toEqual([]);
  });
});

describe('the tells, as the premise has them, lie where the course was measured', () => {
  it('a jump\'s window is hatching between two lines: its first edge the earliest jump, its last the latest', () => {
    const L = C.pace.lead.hurdle, y = C.slots[0].y, ground = block('hurdle').marks.filter((m) => m.corners.every((c) => c[2] < 0.05));
    expect(ground.length).toBeGreaterThan(4);
    const ys = ground.flatMap((m) => m.corners.map((c) => c[1]));
    expect(Math.min(...ys)).toBeCloseTo(y - L.early * C.pace.top, 1);
    expect(Math.max(...ys)).toBeCloseTo(y - L.late * C.pace.top, 1);
    expect(ground.every((m) => m.fill === col['tell-jump'] && m.corners.every((c) => Math.abs(c[0]) <= 3.3 + 1e-9))).toBe(true);
    expect(jumpTell(null, { ya: 1, yb: 4, half: 3.3 }, col)).toHaveLength(1);
  });

  it('posts\' arrows lie in the closed lanes, and a lit indicator on each kerb points at the clear track', () => {
    for (const [id, open] of [['posts-left', 0], ['posts-right', 2]]) {
      const marks = block(id).marks, to = Math.sign(LANES[open]), from = C.slots[0].y - C.pace.top * C.pace.laneTime[2];
      const heads = marks.filter((m) => m.corners.length === 3 && m.corners.every((c) => c[2] < 0.05)), lit = marks.filter((m) => m.corners.length === 3 && m.corners.some((c) => c[2] > 2));
      expect(heads).toHaveLength(4);
      expect(lit).toHaveLength(2);
      for (const h of lit) {
        expect(h.fill).toBe(col['tell-steer']);
        expect(Math.sign(h.corners[1][0] - h.corners[0][0])).toBe(to);
        expect(Math.abs(h.corners[0][0])).toBeGreaterThan(3.3);                 // on a kerb, off the way
        expect(h.corners[0][1]).toBeCloseTo(from, 1);                           // where the change must begin
      }
    }
    expect(steerTell(null, { ys: [1, 2], to: 1, lanes: [-2, 0], half: 3.3 }, col).every((m) => m.corners.every((c) => c[2] < 0.05))).toBe(true);
  });
});

describe('the end: where the line goes', () => {
  it('a gantry showing clear over every track, buffer stops, the train past the last of the way; seen, never met', () => {
    const end = C.faces.filter((f) => f.group === 'scenery:end');
    expect(end.length).toBeGreaterThan(20);
    expect(end.filter((f) => f.fill === col.exit && f.corners.every((c) => Math.abs(c[1] - C.exit[1]) < 0.1))).toHaveLength(LANES.length);
    expect(end.some((f) => f.fill === col.lamp && f.corners.every((c) => c[1] > C.length + 4))).toBe(true);
    // (the train shed over the end of the line: taller than anything on the way, its board lit, so it is seen from the start)
    const top = Math.max(...end.flatMap((f) => f.corners.map((c) => c[2])));
    expect(top).toBeGreaterThan(10);
    expect(top).toBeGreaterThan(2 * Math.max(...C.faces.filter((f) => f.group === 'scenery:walls').flatMap((f) => f.corners.map((c) => c[2]))));
    expect(end.some((f) => f.fill === col.lamp && Math.min(...f.corners.map((c) => c[2])) > 7 && Math.abs(f.corners[0][0] - f.corners[1][0]) > 4)).toBe(true);
    // (the gantry's beam is over the camera: it stands in the top third as the course ends)
    expect(Math.max(...end.flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThan(C.camera.height);
    for (const f of end) expect(colours.has(f.fill) || /^#[0-9a-f]{6}$/.test(f.fill)).toBe(true);
    expect(C.colliders).toHaveLength(4);
    expect(endDrawing(null, { exit: C.exit, length: C.length, half: 3.3, lanes: LANES }, col)).toEqual([]);
    expect(courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'rail-yard' }).faces.filter((f) => f.group === 'scenery:end')).toEqual([]);
  });
});

describe('a made level reads back as the course it was laid as', () => {
  it('its slots and its things\' lengths, from the blocks as they were laid', () => {
    const back = courseOfLevel({ entities: [{ id: 'hero', pilotable: true, rule: C.rule }], blocks: C.blocks, roll: C.roll, colliders: C.colliders, obstacles: { gap: C.gap, need: C.need, rest: C.rest, sight: C.sight, react: C.react, exit: C.exit, start: C.start, asks: C.prims } });
    expect(back.slots).toEqual(C.slots);
    expect(back.lens).toEqual(C.lens);
  });
});
