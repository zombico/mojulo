// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { compileInterior } from './compile.js';
import { assembleInteriorWorldScene } from './scene.js';
import { interiorPlaces } from './places.js';
import { setPlaces, castOnSet } from '../actor/set.js';
import { actScene, placeOn } from '../actor/scene.js';
import { SQUEEZE } from '../actor/route.js';
import { MM_PER_FT } from './units.js';

// a small house: a lounge, a hall, a bedroom; the lounge's one door opens to the hall
const HOUSE = {
  kind: 'floorplan', title: 'three rooms', windows: true, furnish: true,
  rooms: [{ x: 0, y: 0, w: 18, h: 14, glyph: 'L' }, { x: 18, y: 0, w: 5, h: 14, glyph: 'H' }, { x: 23, y: 0, w: 12, h: 14, glyph: 'B' }],
  doors: [{ x: 18, y: 10, edge: 'W' }, { x: 23, y: 4, edge: 'E' }, { x: 20, y: 14, edge: 'S', entry: true }],
};
const lounge = (extra = {}) => ({ kind: 'interior', house: HOUSE, room: 'lounge', style: 'japandi', ...extra });
// (the fireplace stands on a wall with no window: the same house without its windows)
const BARE = { ...HOUSE, windows: false };
const hearth = { surface: { features: [{ type: 'fireplace', wall: 'W' }] } };

// a place in the payload's frame (feet, y north) → the placer's (mm, y south)
const inRoom = (c, at) => [(at[0] - c.shell.origin[0]) * MM_PER_FT, (-at[1] - c.shell.origin[1]) * MM_PER_FT];
const inside = (r, [x, y], pad = 0) => x > r.x0 - pad && x < r.x1 + pad && y > r.y0 - pad && y < r.y1 + pad;

describe('a decorated room’s places', () => {
  it('names a place by each piece, the hearth, the door and the windows, in the words a script says', () => {
    const c = compileInterior(lounge(hearth), HOUSE);
    const { rooms, anchors } = interiorPlaces(c);
    const ids = anchors.map((a) => a.id);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe('lounge');
    expect(ids).toEqual(expect.arrayContaining(['sofa', 'door', 'window']));
    const bare = interiorPlaces(compileInterior({ ...lounge(hearth), house: BARE }, BARE)).anchors.map((a) => a.id);
    expect(bare).toEqual(expect.arrayContaining(['sofa', 'fireplace', 'door']));
    expect(bare.some((id) => /^window/.test(id))).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_-]+$/);
  });

  it('stands nobody inside a piece, a feature or a wall', () => {
    const c = compileInterior({ ...lounge(hearth), house: BARE }, BARE);
    expect(c.solved.R.features).toHaveLength(1);
    const { rooms, anchors } = interiorPlaces(c), R = c.solved.R;
    const solid = [...R.placed.filter((p) => p.mount !== 'skin').map((p) => p.rect), ...R.features.map((f) => f.rect)];
    for (const at of [...anchors.map((a) => a.at), rooms[0].stand]) {
      const p = inRoom(c, at);
      expect(inside({ x0: 0, y0: 0, x1: R.W, y1: R.D }, p, -200)).toBe(true);
      for (const r of solid) expect(inside(r, p, 200)).toBe(false);
    }
  });

  it('is deterministic', () => {
    expect(interiorPlaces(compileInterior(lounge(hearth), HOUSE))).toEqual(interiorPlaces(compileInterior(lounge(hearth), HOUSE)));
  });

  it('rides the World payload, so the room is a set: its places in metres, its cast on open floor', () => {
    const payload = assembleInteriorWorldScene(lounge(hearth), HOUSE);
    expect(payload.metersPerUnit).toBeCloseTo(0.3048);
    const set = setPlaces(payload);
    expect(Object.keys(set.marks)).toEqual(expect.arrayContaining(['room-lounge', 'sofa', 'door']));
    // the lounge is 18 ft × 14 ft: every place is within it, read in metres
    const [room] = set.rooms;
    expect(room.max[0] - room.min[0]).toBeLessThan(18 * 0.3048);
    for (const [x, y] of Object.values(set.marks)) {
      expect(x).toBeGreaterThan(room.min[0]); expect(x).toBeLessThan(room.max[0]);
      expect(y).toBeGreaterThan(room.min[1]); expect(y).toBeLessThan(room.max[1]);
    }
    // a cast with no marks stands about the room's open floor, not its middle (where the coffee table is)
    const { screenplay } = castOnSet({ cast: { ada: {}, jon: {} }, script: 'ADA: Hi.' }, set);
    const mid = set.marks['room-lounge'];
    expect(screenplay.marks['ada-mark'][1]).toBe(mid[1]);
    expect((screenplay.marks['ada-mark'][0] + screenplay.marks['jon-mark'][0]) / 2).toBeCloseTo(mid[0], 2);
    const c = compileInterior(lounge(hearth), HOUSE);
    for (const w of ['ada-mark', 'jon-mark']) {
      const p = inRoom(c, [screenplay.marks[w][0] / 0.3048, screenplay.marks[w][1] / 0.3048]);
      for (const q of c.solved.R.placed.filter((x) => x.mount !== 'skin')) expect(inside(q.rect, p)).toBe(false);
    }
  });
  it('is walked round: a cross between its places goes round the furniture, never through a piece', () => {
    const set = setPlaces(assembleInteriorWorldScene(lounge(hearth), HOUSE));
    const [room] = set.rooms;
    expect(room.blocks.length).toBeGreaterThan(2);
    // (each says how high it stands, for a storyboard to draw it)
    for (const B of room.blocks) expect(B.h).toBeGreaterThan(0.2);
    // (and its doors and windows lie on its walls, the door from the floor up)
    expect(room.openings.some((O) => O.kind === 'door' && O.sill === 0 && O.head > 1.8)).toBe(true);
    for (const O of room.openings) expect([O.min[0] - room.min[0], room.max[0] - O.max[0], O.min[1] - room.min[1], room.max[1] - O.max[1]].some((d) => Math.abs(d) < 0.02)).toBe(true);
    const places = Object.keys(set.marks).filter((id) => !id.startsWith('room-'));
    const script = ['ADA: I will look round.', ...places.map((id) => `Ada crosses to the ${id}.`)].join('\n');
    const on = castOnSet({ cast: { ada: {}, jon: {} }, script }, set);
    expect(on.floor_plan.blocks).toEqual(room.blocks);
    const S = actScene({ ...on.screenplay, floor_plan: on.floor_plan });
    const walks = S.actors.ada.walks;
    expect(walks.some((W) => W.via)).toBe(true);
    const off = (B, p) => Math.hypot(Math.max(B.min[0] - p[0], 0, p[0] - B.max[0]), Math.max(B.min[1] - p[1], 0, p[1] - B.max[1]));
    for (const W of walks) for (let t = W.start; t <= W.end; t += 0.05) {
      const p = placeOn(S.actors.ada.root, t);
      for (const B of room.blocks) expect(off(B, [p.x, p.y])).toBeGreaterThan(SQUEEZE.at(-1) - 0.03);
    }
    // (and as written with no floor plan: straight lines)
    expect(actScene(on.screenplay).actors.ada.walks.some((W) => W.via)).toBe(false);
  });
});
