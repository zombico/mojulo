import { describe, expect, it } from 'vitest';
import { courseOf, readObstacles, obstacleStage } from './roll-course.js';
import { dressOf, readDress, DRESS_THEMES, DRESS_ROLES } from './course-dress.js';
import { sceneryOf, sceneryLaws, readWalls, readBackdrop, SLICES, BACKDROPS, WALL_ROLES, FAR } from './course-scenery.js';
import { courseFrame, sliceElevation, courseSheetHtml } from './course-sheet.js';
import { rollRoom, rollRoomMeasured, courseDressOf } from './roll-room.js';
import { practiceHtml } from './practice-room-page.js';
import { rhythmFaults } from '../era/wall-rhythm.js';
import { POLES } from './feel/cards.js';

// THE COURSE'S SCENERY: the walls beside a rolled course and the backdrop behind it, one dress with the way and the asks.
const MOMENTUM = 'commuter-rail-runner';
const FOOT = Object.keys(POLES).find((p) => POLES[p].base !== 'pinball');
const C = courseOf({ feel: MOMENTUM }, { slots: 6 });
const law = (laws, id) => laws.find((l) => l.law === id);

describe('the walls: a slice a segment, each side in its own order', () => {
  it('every card is slices of boxes off the kerb in the walls\' roles; a theme names an A more complex than its B', () => {
    for (const s of Object.values(SLICES)) for (const p of s.parts) { expect(p.box[1]).toBeGreaterThanOrEqual(0); expect(WALL_ROLES).toContain(p.role); }
    for (const T of Object.values(DRESS_THEMES)) expect(SLICES[T.walls.a].parts.length, T.name).toBeGreaterThan(SLICES[T.walls.b].parts.length);
    expect(DRESS_ROLES).toEqual(expect.arrayContaining(['flank', 'flank2', 'trim', 'land', 'far', 'horizon']));
  });

  it('laid from behind the start to past the exit, by the walls\' rule, the two sides differently; seen, never met', () => {
    for (const side of ['left', 'right']) {
      const cells = C.scenery.cells.filter((c) => c.side === side);
      expect(cells[0].y0).toBeLessThanOrEqual(0);
      expect(cells[cells.length - 1].y1).toBeGreaterThanOrEqual(C.exit[1]);
      expect(cells.map((c) => c.kind).join('')).toBe(C.scenery[side]);
      expect(rhythmFaults(C.scenery[side])).toEqual([]);
      expect(cells.every((c) => Math.abs(c.y1 - c.y0 - C.gap) < 0.02)).toBe(true);
    }
    expect(C.scenery.left).not.toBe(C.scenery.right);
    const walls = C.faces.filter((f) => f.group === 'scenery:walls');
    expect(walls.length).toBeGreaterThan(0);
    // (beyond the kerbs: nothing of a wall stands over the way; and the course's colliders are the lane's own four)
    expect(walls.every((f) => f.corners.every((p) => Math.abs(p[0]) >= 4.8 - 1e-6))).toBe(true);
    expect(C.colliders).toHaveLength(4);
    expect(courseOf({ feel: MOMENTUM }, { slots: 6 }).faces).toEqual(C.faces);
  });

  it('a game\'s seed gives its sides their own order; a written order is kept, the other side read from its far end', () => {
    const orders = new Set([1, 2, 3, 4, 5, 6].map((seed) => courseOf({ feel: MOMENTUM, seed }, { slots: 6 }).scenery.left));
    expect(orders.size).toBeGreaterThan(1);
    const W = courseOf({ feel: MOMENTUM }, { slots: 6, dress: { walls: { order: 'AABAB' } } });
    expect(W.scenery.left.startsWith('AABAB')).toBe(true);
    expect(W.scenery.right).toBe([...W.scenery.left].reverse().join(''));
  });
});

describe('the overhead: what stands in the top third near at hand', () => {
  it('the last train\'s line: a portal at every slice\'s end, over any jump, and a wire over each outer track from end to end', () => {
    const over = C.faces.filter((f) => f.group === 'scenery:overhead');
    expect(over.length).toBeGreaterThan(4 * C.scenery.cells.length / 2);
    // (iron, and under a sun ahead each beam's shadow across the way, a bar on the ground)
    const bars = over.filter((f) => f.fill !== C.dress.palette.iron);
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every((f) => f.corners.every((c) => c[2] < 0.05 && Math.abs(c[0]) <= 3.3 + 1e-9))).toBe(true);
    // (nothing of it over the way lower than 6 m: a hero's jump never meets it; its posts stand off the way)
    for (const f of over) if (f.corners.some((c) => Math.abs(c[0]) < 3.3)) expect(Math.min(...f.corners.map((c) => c[2]))).toBeGreaterThan(6);
    const wires = over.filter((f) => Math.max(...f.corners.map((c) => c[1])) - Math.min(...f.corners.map((c) => c[1])) > C.length);
    expect(wires.map((f) => Math.round((f.corners[0][0] + f.corners[1][0]) / 2)).sort()).toEqual([-2, 2]);
    expect(courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'rail-yard' }).faces.filter((f) => f.group === 'scenery:overhead')).toEqual([]);
  });
});

describe('beyond the walls: layers behind, and a train that moves', () => {
  it('two houses a slice a side in the mid role, a viaduct along the left, a train on it the page slides the other way', () => {
    const beyond = C.faces.filter((f) => f.group === 'scenery:beyond'), train = C.faces.filter((f) => f.group === 'scenery:train');
    expect(beyond.length).toBeGreaterThan(C.scenery.cells.length * 2 * 3);
    // (all of it behind the walls: further off the way than any slice reaches)
    expect(beyond.every((f) => f.corners.every((p) => Math.abs(p[0]) >= 4.8 + 7.5))).toBe(true);
    expect(train.length).toBeGreaterThan(20);
    expect(train.every((f) => f.corners.every((p) => p[0] < 0 && p[2] > 5))).toBe(true);
    const [mv] = C.scenery.movers;
    expect(mv).toMatchObject({ group: 'scenery:train', loop: true, basePos: [0, 0, 0] });
    expect(mv.path[1][1]).toBeLessThan(-C.length);   // toward the start: against the runner
    expect(mv.period).toBeGreaterThan(8);
    // (a made level carries it for the page's mover; a theme with nothing beyond has neither)
    expect(obstacleStage({ feel: MOMENTUM }, { slots: 6 }).sceneryMovers).toEqual(C.scenery.movers);
    const plain = courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'rail-yard' });
    expect(plain.faces.filter((f) => /beyond|train/.test(f.group))).toEqual([]);
    expect(plain.scenery.movers).toEqual([]);
    expect(obstacleStage({ feel: MOMENTUM }, { slots: 6, dress: 'rail-yard' }).sceneryMovers).toBeUndefined();
  });
});

describe('the backdrop: the sky in steps, a skyline, the land, far past the end', () => {
  it('stands FAR past the course\'s end in the far, land and sky roles; the sky runs from the horizon\'s colour to the zenith\'s', () => {
    const back = C.faces.filter((f) => f.group === 'scenery:backdrop'), D = C.dress;
    expect(C.scenery.far).toBeCloseTo(C.length + FAR, 1);
    expect(back.filter((f) => f.fill === D.palette.far)).toHaveLength(D.backdrop.skyline.filter((s) => s.role !== 'lamp').length);
    // (a light on the skyline: the terminus's clock, near the top of its tower and a little before it)
    const clock = back.filter((f) => f.fill === D.palette.lamp);
    expect(clock).toHaveLength(1);
    expect(Math.max(...clock[0].corners.map((p) => p[2]))).toBeLessThan(Math.max(...D.backdrop.skyline.map((s) => s.tall)));
    expect(back.filter((f) => f.fill === D.palette.land)).toHaveLength(3);
    const sky = back.filter((f) => f.corners.every((p) => p[1] > C.scenery.far + 1));
    expect(sky).toHaveLength(D.backdrop.bands);
    expect(sky[0].fill).toBe(D.palette.horizon);
    expect(sky[sky.length - 1].fill).toBe(D.palette.sky);
    expect(courseOf({ feel: MOMENTUM }, { slots: 6, dress: { backdrop: 'open' } }).faces.filter((f) => f.fill === D.palette.far)).toEqual([]);
  });
});

describe('one gate over every layer', () => {
  it('the last train holds every law, on any seed\'s shade of it; the greybox loses the far read\'s and says so', () => {
    expect(C.dress.laws.map((l) => l.law)).toEqual(['readable', 'distinct', 'quiet', 'told', 'premise', 'receding', 'interest', 'rhythm', 'banded']);
    for (const seed of [1, 7, 23, 64]) expect(courseOf({ feel: MOMENTUM, seed }, { slots: 6 }).dress.laws.filter((l) => !l.holds)).toEqual([]);
    expect(courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'greybox' }).dress.laws.filter((l) => !l.holds).map((l) => l.law)).toEqual(expect.arrayContaining(['readable', 'distinct']));
  });

  it('a wall as vivid as an ask, a skyline that shouts, equal slices, a skyline off the frame: each is said', () => {
    const lost = (dress) => courseOf({ feel: MOMENTUM }, { slots: 6, dress }).dress.laws.filter((l) => !l.holds).map((l) => l.law);
    expect(lost({ palette: { flank: '#d9541e' } })).toEqual(expect.arrayContaining(['quiet']));
    expect(lost({ palette: { flank: '#f2a31b' } })).toEqual(expect.arrayContaining(['readable']));
    expect(lost({ palette: { far: '#101010' } })).toEqual(['receding']);
    expect(lost({ walls: { a: 'bank', b: 'fence' } })).toEqual(['interest']);
    // (a slice or a backdrop written in place is named in the premise, or the premise says it is not)
    expect(lost({ walls: { b: { parts: [{ box: [0, 1, 0, 1, 2, 1], role: 'flank' }] } } })).toEqual(['premise']);
    expect(lost({ walls: { b: { name: 'A siding', parts: [{ box: [0, 1, 0, 1, 2, 1], role: 'flank' }] } } })).toEqual([]);
    expect(lost({ backdrop: { name: 'One tower', skyline: [{ at: 0, wide: 60, tall: 190 }] } })).toEqual(['banded']);
    expect(lost({ walls: { order: 'AAAB' } })).toEqual(['rhythm']);
    const said = law(courseOf({ feel: MOMENTUM }, { slots: 6, dress: { palette: { far: '#101010' } } }).dress.laws, 'receding').says;
    expect(said).toMatch(/the far end, where what is coming is read, is as busy as the sides/);
  });
});

describe('a dress as written: a theme\'s name, or every layer in one place', () => {
  it('each part left out is the theme\'s; a colour written is kept as written on any seed', () => {
    expect(readDress('rail-yard')).toMatchObject({ theme: 'rail-yard', own: false, walls: { a: { id: 'shed' }, b: { id: 'fence' } }, backdrop: { id: 'yard' } });
    expect(readDress()).toMatchObject({ theme: 'last-train', walls: { a: { id: 'platform' }, b: { id: 'cutting' } }, backdrop: { id: 'terminus' } });
    const own = { walls: { a: 'stacks', b: { name: 'Kerb stones', parts: [{ box: [0, 0.5, 0, 1, 1, 0.6], role: 'flank2' }] } }, backdrop: { bands: 4 }, palette: { flank: '#3b4a3f' } };
    const D = dressOf(own, 9);
    expect(D).toMatchObject({ theme: 'last-train', own: true, walls: { a: { id: 'stacks' }, b: { id: 'own', name: 'Kerb stones' } }, backdrop: { bands: 4 } });
    expect(D.palette.flank).toBe('#3b4a3f');
    expect(D.backdrop.skyline).toEqual(BACKDROPS.terminus.skyline);
    expect(readObstacles({ dress: own }).dress).toEqual(own);
  });

  it('the malformed teach', () => {
    expect(() => readDress('neon')).toThrow(/dress is one of last-train, rail-yard, greybox, or \{ theme\?, palette\?, walls\?, backdrop\? \}/);
    expect(() => readDress({ sky: '#000000' })).toThrow(/dress\.sky is not a dress's word/);
    expect(() => readDress({ palette: { roof: '#000000' } })).toThrow(/palette\.roof is not a role/);
    expect(() => readDress({ palette: { flank: 'brown' } })).toThrow(/'#rrggbb'/);
    expect(() => readWalls({ a: 'castle' })).toThrow(/a slice's name \(shed, stacks, fence, platform, cutting, bank\)/);
    expect(() => readWalls({ a: { parts: [{ box: [0, -1, 0, 1, 2, 3], role: 'flank' }] } })).toThrow(/a slice never stands on the way/);
    expect(() => readWalls({ a: { parts: [{ box: [0, 1, 0, 1, 2, 3], role: 'jump' }] } })).toThrow(/role is one of flank, flank2, trim, iron, lamp/);
    expect(() => readWalls({ order: 'ABC' })).toThrow(/order in A and B/);
    expect(() => readBackdrop('city')).toThrow(/a backdrop's name \(yard, terminus, open\)/);
    expect(() => readBackdrop({ skyline: [{ at: 2, wide: 10, tall: 10 }] })).toThrow(/at: −1…1/);
    expect(() => readObstacles({ dress: { walls: { c: 'shed' } } })).toThrow(/walls\.c is not a wall's word/);
  });
});

describe('the course sheet: the layers seen together', () => {
  it('the frame is the course\'s own faces through its camera, one roll standing, its thirds ruled and named', () => {
    const F = courseFrame(C, { seed: 1 });
    expect(F.width / F.height).toBeCloseTo(1120 / 780, 1);
    expect(F.drawn).toBeGreaterThan(200);
    for (const role of ['far', 'horizon', 'ground', 'kerb']) expect(F.svg).toContain(`fill="${C.dress.palette[role]}"`);
    expect(F.svg).toMatch(/where stuff comes from · the backdrop/);
    expect(F.svg).toMatch(/where it comes to view · the walls, the asks/);
    expect(F.svg).toMatch(/where you react · the character/);
    expect(F.svg.match(/stroke-dasharray="5 4"/g)).toHaveLength(2);
    // (another roll stands other things; an upright frame is drawn upright)
    expect(courseFrame(C, { seed: 2 }).svg).not.toBe(F.svg);
    const up = courseFrame(C, { aspect: 9 / 16, vfov: 65.8, width: 300 });
    expect(up.height).toBeGreaterThan(up.width);
    expect(courseFrame(C, { seed: 1 }).svg).toBe(F.svg);
  });

  it('a slice in elevation, to scale; the page says every layer and every law', () => {
    const E = sliceElevation(C.dress.walls.a, { gap: C.gap, palette: C.dress.palette });
    expect(E.width).toBe(Math.round(C.gap * 14));
    expect(E.svg.match(/<rect /g).length).toBe(C.dress.walls.a.parts.length + 2);
    const html = courseSheetHtml(C, { title: 'Dash' });
    for (const h of ['The frame', 'The walls', 'The backdrop', 'The palette, by layer', 'The laws']) expect(html).toContain(`<h2>${h}`);
    for (const l of C.dress.laws) expect(html).toContain(`<b>${l.law}</b> holds`);
    expect(html).toContain(`left ${C.scenery.left} · right ${C.scenery.right}`);
    expect(courseSheetHtml(courseOf({ feel: MOMENTUM }, { slots: 6, dress: { palette: { far: '#101010' } } }))).toMatch(/<li class="lost"><b>receding<\/b> does not hold/);
  });
});

describe('in the design loop: the room, its map and its sheet wear the level\'s dress', () => {
  const dress = { walls: { a: 'stacks', b: 'fence' }, palette: { flank: '#3b4a3f' } };
  const world = (extra = {}) => ({ id: 'dash', name: 'Dash', feel: MOMENTUM, roll: true, levels: { one: { name: 'A', obstacles: { slots: 6, dress } }, two: { name: 'B', obstacles: true } }, start: 'one', ...extra });

  it('the first course level\'s, or the one named; the readout says its layers and where its sheet is', () => {
    expect(courseDressOf(world())).toEqual(dress);
    expect(courseDressOf(world(), 'two')).toBeUndefined();
    expect(() => courseDressOf(world(), 'nine')).toThrow(/level 'nine' is not an obstacle course of this world \(one, two\)/);
    expect(rollRoom(world()).course.dress.walls.a.id).toBe('stacks');
    expect(rollRoom(world(), { level: 'two' }).course.dress.walls.a.id).toBe('platform');
    const M = rollRoomMeasured(world());
    expect(M.dress).toMatchObject({ theme: 'last-train', own: true, walls: { a: 'Container stacks', b: 'Fence and embankment' }, backdrop: 'The terminus', sheet: 'bible?book=practice&room=roll&view=sheet', lost: [] });
    expect(M.dress.says).toHaveLength(9);
    // (kept by the dress as well as the feel: a world with another dress is measured anew)
    expect(rollRoomMeasured({ ...world(), levels: { one: { obstacles: { dress: { palette: { far: '#101010' } } } } } }).dress.lost).toEqual(['receding']);
  });

  it('the sheet is a page of the practice book, framed for the game\'s own screen', async () => {
    const wide = (await practiceHtml(world(), 'roll', { view: 'sheet' })).html;
    expect(wide).toMatch(/Dash · course sheet/);
    expect(wide).toContain('Container stacks');
    const up = (await practiceHtml(world({ screen: 'phone' }), 'roll', { view: 'sheet' })).html;
    const [, w, h] = up.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(Number(h)).toBeGreaterThan(Number(w));
    await expect(practiceHtml({ id: 'g', feel: FOOT, roll: true }, 'roll', { view: 'sheet' })).rejects.toThrow(/the course sheet is a running game's/);
  });
});
