import { describe, expect, it } from 'vitest';
import { dressOf, dressLaws, DRESS_THEMES, DRESS_ROLES, ASK_ROLE } from './course-dress.js';
import { courseOf, playCourse, PRIMITIVES, LANES } from './roll-course.js';
import { rollRoomMeasured } from './roll-room.js';
import { POLES } from './feel/cards.js';
import { standBlocks } from '../playscape/terrain.js';
import { readRoll, rolledIds } from '../game/roll.js';
import { hexToRgb, lchOf, hueGap } from '../color-theorist/oklab.js';

// THE COURSE'S DRESS: colour by role, tells on the way, and the laws that keep a look from costing the course its read.
const MOMENTUM = Object.keys(POLES).find((p) => POLES[p].base === 'pinball');

describe('a dress, by role', () => {
  it('every theme names every role; a primitive has its ask\'s role', () => {
    for (const T of Object.values(DRESS_THEMES)) expect(Object.keys(T.palette).sort()).toEqual([...DRESS_ROLES].sort());
    expect(Object.keys(ASK_ROLE).sort()).toEqual(Object.keys(PRIMITIVES).sort());
    expect(() => dressOf('neon')).toThrow(/dress is one of last-train, rail-yard, greybox/);
  });

  it('the last train holds every law, as written and in each game\'s own shade of it; the rail yard, parts with no premise, loses that one', () => {
    for (const seed of [1, 2, 9, 40, 177]) expect(dressOf('last-train', seed).laws.filter((l) => !l.holds), `seed ${seed}`).toEqual([]);
    expect(dressOf().theme).toBe('last-train');
    expect(dressOf('rail-yard').laws.find((l) => l.law === 'premise').says).toMatch(/Rail yard is parts with no premise/);
    expect(dressOf('rail-yard').palette).toEqual(DRESS_THEMES['rail-yard'].palette);
    for (const seed of [1, 2, 9, 40, 177]) {
      const D = dressOf('rail-yard', seed);
      expect(D.laws.map((l) => l.law)).toEqual(['readable', 'distinct', 'quiet', 'told', 'premise']);
      expect(D.laws.filter((l) => !l.holds).map((l) => l.law), `seed ${seed}`).toEqual(['premise']);
      expect(dressOf('rail-yard', seed)).toEqual(D);
    }
    // a seed turns the asks' hues a little, never the way's
    const a = dressOf('rail-yard', 1).palette, b = dressOf('rail-yard', 9).palette;
    expect(b.jump).not.toBe(a.jump);
    expect(hueGap(lchOf(hexToRgb(a.jump))[2], lchOf(hexToRgb(b.jump))[2])).toBeLessThan(12);
    expect(hueGap(lchOf(hexToRgb(a.ground))[2], lchOf(hexToRgb(b.ground))[2])).toBeLessThan(4);
  });

  it('the laws bite: a course with no look loses them, and each fault is said', () => {
    const G = dressOf('greybox');
    expect(G.laws.filter((l) => !l.holds).map((l) => l.law)).toEqual(['readable', 'distinct', 'quiet', 'told', 'premise']);
    const P = { ...DRESS_THEMES['rail-yard'].palette };
    // an ask the colour of the ground; the two kinds of ask one hue; a vivid kerb; a tell in the other kind's hue
    expect(dressLaws({ ...P, jump: P.ground }).find((l) => l.law === 'readable')).toMatchObject({ holds: false, says: expect.stringMatching(/jump is too like the ground/) });
    expect(dressLaws({ ...P, steer: P.jump2 }).find((l) => l.law === 'distinct')).toMatchObject({ holds: false, says: expect.stringMatching(/too alike/) });
    expect(dressLaws({ ...P, kerb: '#ff2020' }).find((l) => l.law === 'quiet')).toMatchObject({ holds: false, says: expect.stringMatching(/the kerb is as vivid as an ask/) });
    expect(dressLaws({ ...P, 'tell-steer': P['tell-jump'] }).find((l) => l.law === 'told')).toMatchObject({ holds: false, says: expect.stringMatching(/tell-steer is not in its ask's hue/) });
  });
});

describe('the course, dressed', () => {
  // (the rail yard: a theme with no premise stands plain things and paints plain tells)
  const C = courseOf({ feel: MOMENTUM }, { dress: 'rail-yard' }), col = C.dress.palette;
  it('the way is coloured by role and its lanes drawn flat; the asks wear their role\'s colour', () => {
    expect(C.bg).toBe(col.sky);
    expect(new Set(C.faces.filter((f) => f.group === 'room:floor').map((f) => f.fill))).toEqual(new Set([col.ground, col.ground2]));
    const lanes = C.faces.filter((f) => f.group === 'room:lanes');
    expect(new Set(lanes.map((f) => f.fill))).toEqual(new Set([col.sleeper, col.rail, col.exit]));
    // paint, never a thing in the way: every face of the lanes lies flat within a hand of the ground
    expect(lanes.every((f) => f.corners.every((c) => c[2] >= 0 && c[2] < 0.05))).toBe(true);
    for (const b of C.blocks) expect(b.tint).toEqual(hexToRgb(col[ASK_ROLE[b.id.replace(/^s\d+-/, '')]]).map((v) => Math.round((v / 255) * 1e4) / 1e4));
    // the greybox draws no lanes
    expect(courseOf({ feel: MOMENTUM }, { dress: 'greybox' }).faces.filter((f) => f.group === 'room:lanes').every((f) => f.fill === DRESS_THEMES.greybox.palette.exit)).toBe(true);
  });

  it('a jump\'s tell is its window painted: from the earliest place a jump clears it to the latest', () => {
    const b = C.blocks.find((x) => x.id === 's1-hurdle'), y = C.slots[0].y, L = C.pace.lead.hurdle, [strip] = b.marks;
    expect(b.marks).toHaveLength(1);
    expect(strip.fill).toBe(col['tell-jump']);
    const ys = strip.corners.map((c) => c[1]);
    expect(Math.min(...ys)).toBeCloseTo(y - L.early * C.pace.top, 1);
    expect(Math.max(...ys)).toBeCloseTo(y - L.late * C.pace.top, 1);
  });

  it('posts\' tell is arrows in the lanes they stand in, pointing at the open one, from where the change must begin', () => {
    for (const [id, open] of [['posts-left', 0], ['posts-right', 2]]) {
      const b = C.blocks.find((x) => x.id === `s1-${id}`), y = C.slots[0].y, heads = b.marks.filter((m) => m.corners.length === 3);
      expect(heads).toHaveLength(4);   // two lanes, two arrows each
      for (const h of heads) {
        const tip = h.corners[1][0], base = h.corners[0][0];
        expect(Math.sign(tip - base)).toBe(Math.sign(LANES[open]));           // it points at the open lane
        expect(Math.abs(base - LANES[open])).toBeGreaterThan(1);               // and stands in a lane that is shut
        expect(h.fill).toBe(col['tell-steer']);
      }
      expect(Math.min(...heads.map((h) => h.corners[1][1]))).toBeCloseTo(y - C.pace.top * C.pace.laneTime[2], 1);
    }
  });

  it('a tell is part of its ask\'s rolled thing: on the way only when the ask is; the dress moves no collider', () => {
    const read = readRoll(C.roll, { blocks: C.blocks }), B = standBlocks(C.blocks, { rolled: rolledIds(read) });
    const marks = B.faces.filter((f) => f.fill === col['tell-jump'] || f.fill === col['tell-steer']);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((f) => /^roll:s\d+-/.test(f.group))).toBe(true);
    // the same course, undressed, plays the same: a dress is seen, never run into
    const grey = courseOf({ feel: MOMENTUM }, { dress: 'greybox' });
    expect(grey.colliders).toEqual(C.colliders);
    expect(playCourse(grey, { seed: 4 })).toEqual(playCourse(C, { seed: 4 }));
  });

  it('a block with no colour of its own is as it was', () => {
    const plain = [{ id: 'a', form: 'wall', at: [0, 0, 0], N: [0, -1], length: 2, height: 1, thick: 0.5 }];
    const was = standBlocks(plain).faces;
    expect(was.every((f) => f.fill === undefined && f.tint[0] === f.tint[1])).toBe(true);
    const tinted = standBlocks([{ ...plain[0], tint: [0.9, 0.5, 0.1] }]).faces;
    expect(tinted).toHaveLength(was.length);
    expect(tinted.every((f) => /^#[0-9a-f]{6}$/.test(f.fill) && f.tint[0] > f.tint[2])).toBe(true);
  });

  it('the roll room\'s readout carries the dress\'s gate', () => {
    expect(rollRoomMeasured({ id: 'g', feel: MOMENTUM, roll: true }).dress).toMatchObject({ theme: 'last-train', name: 'Last train', lost: [] });
  });
});
