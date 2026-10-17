// The interior designer: a room of a house, read from its plan, solved, skinned and fitted out. One case per procedure.
import { describe, it, expect } from 'vitest';
import { roomShell, selectRoom } from './shell.js';
import { solveRoom, reviewRoom } from './solve.js';
import { compileInterior, interiorErrors } from './compile.js';
import { assembleInteriorWorldScene } from './scene.js';
import { skinPiece, styleCard } from './skin.js';
import { STRATEGIES } from './strategies.js';
import { FUNCTIONS, SOLVE_ORDER } from './functions.js';
import { PIECES } from './pieces.js';
import { STYLE_CARDS } from './styles.js';
import { LAWS, law } from './laws.js';
import { footprint, wayWhy } from './place.js';
import { lengthMm } from './units.js';
import { FURNITURE_STYLES } from '../furnishings/forms.js';
import { assembleFloorWorldScene, structurizeFloorplan } from '../polygonizer/floorplan-structure.js';

// a small house: a lounge, a hall, a bedroom; the lounge's one door opens to the hall
const HOUSE = {
  kind: 'floorplan', title: 'three rooms', windows: true, furnish: true,
  rooms: [{ x: 0, y: 0, w: 18, h: 14, glyph: 'L' }, { x: 18, y: 0, w: 5, h: 14, glyph: 'H' }, { x: 23, y: 0, w: 12, h: 14, glyph: 'B' }],
  doors: [{ x: 18, y: 10, edge: 'W' }, { x: 23, y: 4, edge: 'E' }, { x: 20, y: 14, edge: 'S', entry: true }],
};
const lounge = (extra = {}) => ({ kind: 'interior', house: HOUSE, room: 'lounge', style: 'japandi', ...extra });

describe('the shell is the house’s room', () => {
  it('selects a room by tag, name or glyph, and refuses naming the house’s rooms', () => {
    const s = roomShell(HOUSE, { room: '101' });
    expect(s.card.name).toBe('lounge');
    expect(roomShell(HOUSE, { room: 'L' }).card.tag).toBe('101');
    expect(() => roomShell(HOUSE, { room: 'kitchen' })).toThrow(/101 lounge \(L\).*103 bedroom/);
  });
  it('reads the plan’s own doors and windows onto the room’s walls', () => {
    const s = roomShell(HOUSE, { room: 'lounge' });
    const door = s.openings.find((o) => o.kind === 'door');
    expect(door).toMatchObject({ tag: '101A', wall: 'E', exterior: false });
    expect(door.connects[0]).toMatch(/hallway/);
    expect(new Set(s.openings.filter((o) => o.kind === 'window').map((o) => o.wall))).toEqual(new Set(['N', 'S', 'W']));
    expect(s.walls.E.exterior).toBe(false);
    expect(s.walls.N.exterior).toBe(true);
  });
});

describe('the functional solver graph', () => {
  it('every strategy names a function, pieces in the library and laws that exist; every function solves in order', () => {
    for (const s of STRATEGIES) {
      expect(FUNCTIONS[s.fn], s.id).toBeTruthy();
      for (const p of s.uses) expect(PIECES[p] || p === 'tv', `${s.id}: ${p}`).toBeTruthy();
      for (const f of [...(s.suggest || []), ...(s.covers || [])]) expect(FUNCTIONS[f], s.id).toBeTruthy();
    }
    expect(new Set(SOLVE_ORDER)).toEqual(new Set(Object.keys(FUNCTIONS)));
    expect(() => law('no-such-law')).toThrow(/no law/);
  });
  it('is deterministic: the same room and brief lay the same room', () => {
    const a = compileInterior(lounge(), HOUSE).readout, b = compileInterior(lounge(), HOUSE).readout;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('lays a living room round its focal wall, keeps every way open and every piece out of the door’s approach', () => {
    const { solved, readout } = compileInterior(lounge(), HOUSE);
    expect(readout.resolved.map((r) => r.fn)).toEqual(expect.arrayContaining(['media', 'converse']));
    const sofa = solved.placed.find((p) => p.id === 'conversation.sofa');
    expect(sofa.facing).toBe(readout.focal.wall);                       // the sofa faces the focal wall
    expect(wayWhy(solved.R)).toBeNull();
    const approach = solved.R.keep.find((k) => k.door);
    for (const p of solved.placed.filter((x) => x.mount !== 'skin')) {
      const r = p.rect, k = approach.rect;
      expect(Math.min(r.x1, k.x1) > Math.max(r.x0, k.x0) && Math.min(r.y1, k.y1) > Math.max(r.y0, k.y0), p.id).toBe(false);
      expect(r.x0 >= -1 && r.y0 >= -1 && r.x1 <= solved.R.W + 1 && r.y1 <= solved.R.D + 1, p.id).toBe(true);
    }
  });
  it('sizes by the laws: a coffee table about two thirds the sofa, a rug under every seat’s front', () => {
    const { solved } = compileInterior(lounge(), HOUSE);
    const sofa = solved.placed.find((p) => p.id === 'conversation.sofa');
    const table = solved.placed.find((p) => p.id === 'conversation.coffee-table');
    const rug = solved.placed.find((p) => p.piece === 'rug');
    expect(table.w / sofa.w).toBeCloseTo(LAWS['coffee-length'].ratio, 1);
    for (const seat of solved.placed.filter((p) => p.fn === 'converse' && p.piece !== 'coffee-table' && p.piece !== 'side-table')) {
      const front = { N: [(seat.rect.x0 + seat.rect.x1) / 2, seat.rect.y0 + 50], S: [(seat.rect.x0 + seat.rect.x1) / 2, seat.rect.y1 - 50], E: [seat.rect.x1 - 50, (seat.rect.y0 + seat.rect.y1) / 2], W: [seat.rect.x0 + 50, (seat.rect.y0 + seat.rect.y1) / 2] }[seat.facing];
      expect(front[0] > rug.rect.x0 && front[0] < rug.rect.x1 && front[1] > rug.rect.y0 && front[1] < rug.rect.y1, seat.id).toBe(true);
    }
  });
  it('refuses a strategy with why and falls to the next; a function nothing fills is a gap, never a faked piece', () => {
    const tight = { ...HOUSE, rooms: [{ x: 0, y: 0, w: 9, h: 9, glyph: 'L' }, { x: 9, y: 0, w: 5, h: 9, glyph: 'H' }], doors: [{ x: 9, y: 6, edge: 'W' }, { x: 11, y: 9, edge: 'S', entry: true }] };
    const { readout } = compileInterior({ kind: 'interior', house: tight, room: 'lounge' }, tight);
    const conv = readout.resolved.find((r) => r.fn === 'converse');
    if (conv) expect(conv.refused?.length).toBeGreaterThan(0);
    for (const g of readout.gaps) expect(g.why).toBeTruthy();
  });
  it('lays a dining room: chairs tucked under the table on both long sides, as many as the seats asked', () => {
    const dining = { kind: 'floorplan', title: 'dining', windows: true, rooms: [{ x: 0, y: 0, w: 14, h: 20, glyph: 'D' }], doors: [{ x: 7, y: 20, edge: 'S', entry: true }] };
    const chairs = (brief) => compileInterior({ kind: 'interior', house: dining, room: 'dining', ...(brief ? { brief } : {}) }, dining).solved.placed.filter((p) => p.piece === 'dining-chair');
    const laid = chairs();
    expect(new Set(laid.map((c) => c.facing)).size).toBe(2);
    expect(chairs({ seats: 8 })).toHaveLength(8);
  });
  it('lays a bedroom: the bed’s head to a wall and a nightstand beside it', () => {
    const { solved } = compileInterior({ kind: 'interior', house: HOUSE, room: 'bedroom' }, HOUSE);
    const bed = solved.placed.find((p) => p.id === 'sleep.bed');
    expect(bed).toBeTruthy();
    expect(solved.placed.some((p) => p.piece === 'nightstand')).toBe(true);
  });
});

describe('the operator’s word wins', () => {
  it('a size is asked before the group lays round it; a piece is left out or moved by id', () => {
    const big = compileInterior(lounge({ pieces: [{ id: 'conversation.sofa', size: ['2400mm', null, null] }] }), HOUSE).solved;
    expect(big.placed.find((p) => p.id === 'conversation.sofa').w).toBe(2400);
    const out = compileInterior(lounge({ pieces: [{ id: 'conversation.lamp', omit: true }] }), HOUSE).solved;
    expect(out.placed.some((p) => p.id === 'conversation.lamp')).toBe(false);
    const moved = compileInterior(lounge({ pieces: [{ id: 'conversation.coffee-table', at: [2000, 2000] }] }), HOUSE).solved;
    expect(moved.placed.find((p) => p.id === 'conversation.coffee-table')).toMatchObject({ x: 2000, y: 2000 });
  });
  it('a size out of a piece’s band is clamped and said', () => {
    const { readout } = compileInterior(lounge({ pieces: [{ id: 'conversation.sofa', size: ['30ft', null, null] }] }), HOUSE);
    expect(readout.notes.join(' ')).toMatch(/conversation\.sofa: 9144 mm is outside a sofa's 1400–3300 mm/);
  });
  it('reads lengths the way people write them', () => {
    expect(lengthMm('2400')).toBe(2400);
    expect(lengthMm('14ft')).toBeCloseTo(4267.2);
    expect(lengthMm("14'6\"")).toBeCloseTo(4419.6);
    expect(lengthMm('2.4m')).toBe(2400);
    expect(lengthMm('wide')).toBeNull();
  });
});

describe('the skin: a style card worn', () => {
  it('every card resolves its pieces through the house’s furniture grammar', () => {
    const p = { id: 'conversation.sofa', piece: 'sofa', w: 2130, d: 940, h: 820 };
    for (const id of [Object.keys(STYLE_CARDS)[0], 'industrial']) {
      const { compose } = skinPiece(p, styleCard(id));
      expect(FURNITURE_STYLES[compose.like].kind).toBe('sofa');
    }
  });
  it('two styles dress one room apart, the accent card dresses the chairs', () => {
    const sofaOf = (style) => compileInterior(lounge({ style }), HOUSE).house.fitOut.items.find((i) => i.name === 'conversation.sofa').compose;
    expect(JSON.stringify(sofaOf('japandi'))).not.toBe(JSON.stringify(sofaOf('maximalism')));
    const mixed = compileInterior(lounge({ style: { name: 'japandi', accent: 'mid-century' } }), HOUSE).house.fitOut.items;
    const chair = mixed.find((i) => /chair/.test(i.name) && i.compose);
    if (chair) expect(chair.compose.finish.timber).toBe(STYLE_CARDS['mid-century'].timber);
  });
  it('a plain cloth asked by name changes the cloth and keeps the scheme’s colour; a patterned one keeps its own', () => {
    const p = { id: 'conversation.sofa', piece: 'sofa', w: 2130, d: 940, h: 820 };
    const card = styleCard({ name: 'modern-farmhouse', palette: { upholstery: 'rust' } });
    const plain = skinPiece(p, card).compose.finish.fabric;
    const velvet = skinPiece(p, card, { finish: { fabric: 'velvet' } }).compose.finish.fabric;
    expect(velvet).toEqual({ preset: 'velvet', warp: plain.warp });
    expect(skinPiece(p, card, { finish: { fabric: 'tartan' } }).compose.finish.fabric).toBe('tartan');
  });
});

describe('the fit-out, on the house kernel', () => {
  it('a house without a fit-out builds as it always did, and the fit-out changes only its room', () => {
    const plain = structurizeFloorplan(HOUSE, HOUSE);
    const again = structurizeFloorplan(HOUSE, { ...HOUSE, fitOut: undefined });
    expect(again.faces.length).toBe(plain.faces.length);
    const { house } = compileInterior(lounge(), HOUSE);
    const fitted = structurizeFloorplan(house, house);
    // the bedroom's generated furniture is the house's, untouched
    const inBedroom = (faces) => faces.filter((f) => typeof f.group === 'string' && /^asset:|^item:/.test(f.group) && f.corners.every((c) => c[0] > 23)).length;
    expect(inBedroom(fitted.faces)).toBe(inBedroom(plain.faces));
    expect(fitted.faces.some((f) => f.group === 'asset:composed-furniture:conversation.sofa')).toBe(true);
  });
  it('the section is the room with a step of its neighbours; the house view is the whole house', () => {
    const section = assembleInteriorWorldScene(lounge(), HOUSE);
    const whole = assembleInteriorWorldScene(lounge({ view: 'house' }), HOUSE);
    expect(section.faces.length).toBeLessThan(whole.faces.length);
    expect(section.cameras.map((c) => c.name)).toEqual(expect.arrayContaining(['dollhouse', 'corner', 'plan']));
  });
  it('names what a malformed recipe lacks', () => {
    expect(interiorErrors({ kind: 'interior' }).join(' ')).toMatch(/interior\.house.*interior\.room/);
    expect(interiorErrors({ kind: 'interior', house: 'sk_x', room: 'L', style: 'baroque' }).join(' ')).toMatch(/not a style/);
    expect(() => compileInterior({ kind: 'interior', house: HOUSE, room: 'attic' }, HOUSE)).toThrow(/no room 'attic'/);
  });
});

describe('the review', () => {
  it('says what the laws measure, advisory', () => {
    const { solved } = compileInterior(lounge(), HOUSE);
    const r = reviewRoom(solved);
    expect(r.openShare).toBeGreaterThan(0);
    expect(Array.isArray(r.findings)).toBe(true);
    // a piece dropped in the doorway is said
    const R = solved.R;
    const k = R.keep.find((x) => x.door).rect;
    R.placed.push({ id: 'x', piece: 'bookcase', mount: 'floor', h: 1800, rect: footprint((k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2, 900, 900, 'N') });
    expect(wayWhy(R)).toMatch(/narrow the way/);
  });
});

// a solver that only ever lays the same room reads nothing of it: sanity on selectRoom's ambiguity
it('names the other rooms a word also matched', () => {
  const two = { ...HOUSE, rooms: [{ x: 0, y: 0, w: 12, h: 14, glyph: 'B' }, { x: 12, y: 0, w: 5, h: 14, glyph: 'H' }, { x: 17, y: 0, w: 12, h: 14, glyph: 'B' }], doors: [{ x: 12, y: 4, edge: 'W' }, { x: 17, y: 4, edge: 'E' }, { x: 14, y: 14, edge: 'S', entry: true }] };
  const s = roomShell(two, { room: 'B' });
  expect(s.alsoMatched?.length).toBe(1);
  expect(selectRoom(s.read, 'B').card.tag).toBe(s.card.tag);
});

describe('a room from scratch: the floor plan first', () => {
  it('drafts the room inside a house: neighbours past its inside walls, outside only where its windows are, a hall with the front door', async () => {
    const { draftSection, sectionErrors } = await import('./section.js');
    const d = draftSection({ room: 'living', size: ['14ft', '18ft'], windows: ['S'], doors: [{ wall: 'W', to: 'hall' }] });
    const area = d.house.rooms.reduce((a, r) => a + r.w * r.h, 0);
    const W = Math.max(...d.house.rooms.map((r) => r.x + r.w)), H = Math.max(...d.house.rooms.map((r) => r.y + r.h));
    expect(area).toBeCloseTo(W * H, 5);                                          // one rectangle, no gaps
    expect(d.rect.y + d.rect.h).toBeCloseTo(H, 5);                              // the window wall is the house's outside
    expect(d.house.doors.some((x) => x.entry)).toBe(true);
    const { readout } = compileInterior({ kind: 'interior', house: d.house, room: 'L' }, d.house);
    expect(readout.room.doors.some((x) => /hallway/.test(x.to))).toBe(true);
    expect(sectionErrors({ room: 'living', size: ['14ft'] }).join(' ')).toMatch(/section\.size.*section\.doors/);
  });
  it('a fixed feature slides clear of a doorway on its wall, or is refused', () => {
    const doored = { ...HOUSE, windows: false, doors: [...HOUSE.doors, { x: 9, y: 0, edge: 'N', leadsTo: 'terrace' }] };
    const { readout } = compileInterior(lounge({ house: doored, surface: { features: [{ type: 'fireplace', wall: 'N', at: 0.5 }] } }), doored);
    const door = roomShell(doored, { room: 'lounge' }).openings.find((o) => o.wall === 'N' && o.kind === 'door');
    const f = readout.features[0];
    expect(door).toBeTruthy();
    expect(f.at + 760 <= door.a || f.at - 760 >= door.b).toBe(true);
    expect(readout.notes.join(' ')).toMatch(/fireplace-1: moved/);
    // a wall with no stretch clear of its openings refuses the feature, and says so
    const crowded = compileInterior(lounge({ surface: { features: [{ type: 'fireplace', wall: 'N', w: 5000 }] } }), HOUSE).readout;
    expect(crowded.features).toEqual([]);
    expect(crowded.notes.join(' ')).toMatch(/surface\.features: the fireplace on the N wall/);
  });
});
