// THE STREET'S DRESS (brawl-dress.js): what stands along a belt beside the band. The concepts: it is laid outside the
// band, a set a screen, seeded, in the crew's colour where it is the crew's; absent it is nothing.
import { describe, it, expect } from 'vitest';
import { DRESS_PIECES, DRESS_SETS, readDress, dressPlan, dressFaces, dressSceneFaces, dressSets, dressCount, boxModels, dressLaws, DRESS_SETTINGS, DRESS_SETTING_IDS, settingOfKit } from './brawl-dress.js';
import { THINGS } from './brawl-things.js';
import { brawlYardData } from './brawl-page.js';
import { brawlLevel } from './brawl-levels.js';
import { readBelt } from './brawl-belt.js';

const belt = readBelt({ at: [10, 5], heading: 0, floor: 0.2, depth: [-2.5, 3], screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, gate: true }, { length: 16, boss: true }] }, 'belt');
const D = { far: [3.3, 6], wall: 6.1, near: [-6, -3.1], seed: 4, colour: '#1f4fa8' };

describe('the shelves', () => {
  it('a set draws only from the pieces, and its wall only from the wall\'s pieces', () => {
    for (const S of Object.values(DRESS_SETS)) {
      for (const k of [...Object.keys(S.far), ...Object.keys(S.near)]) { expect(DRESS_PIECES[k], k).toBeTruthy(); expect(DRESS_PIECES[k].wall, k).toBeFalsy(); }
      for (const k of Object.keys(S.wall)) expect(DRESS_PIECES[k].wall, k).toBe(true);
      // (the near side is between the camera and the fight: nothing on it stands over a body's waist)
      for (const k of Object.keys(S.near)) expect(DRESS_PIECES[k].tall, k).toBeLessThanOrEqual(1.1);
    }
  });
  it('a piece is built inside the size it says, on the ground', () => {
    // (one piece per way of building: boxes, drums, a canopy on posts, a mark on the wall)
    for (const id of ['crates', 'barrel', 'stall', 'tag']) {
      const P = DRESS_PIECES[id], F = P.build(() => 0.5, null), pts = F.flatMap((f) => f.corners);
      expect(Math.min(...pts.map((p) => p[2])), id).toBeGreaterThanOrEqual(0);
      expect(Math.max(...pts.map((p) => p[2])), id).toBeLessThanOrEqual(P.tall + 0.05);
      expect(Math.max(...pts.map((p) => Math.abs(p[0]))), id).toBeLessThanOrEqual(P.size[0] / 2 + 0.2);
      for (const f of F) expect(f.corners.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the layout', () => {
  const plan = dressPlan(D, belt);
  it('stands outside the band: the far pieces between it and the fronts, the near ones on the camera\'s side', () => {
    expect(plan.length).toBeGreaterThan(8);
    for (const p of plan) {
      const half = DRESS_PIECES[p.piece].size[1] / 2;
      if (p.side === 'far') { expect(p.n - half).toBeGreaterThanOrEqual(belt.depth[1]); expect(p.n + half).toBeLessThanOrEqual(D.far[1] + 1e-6); }
      if (p.side === 'near') expect(p.n + half).toBeLessThanOrEqual(belt.depth[0]);
      if (p.side === 'wall') expect(p.n).toBeLessThan(D.wall);
      expect(p.s).toBeGreaterThan(0); expect(p.s).toBeLessThan(belt.length);
    }
  });
  it('a set a screen: by its place unless said, the boss\'s the crew\'s corner; a bare screen takes nothing', () => {
    expect(dressSets(belt)[3]).toBe('turf');
    expect(new Set(plan.map((p) => p.set))).toEqual(new Set(dressSets(belt)));
    const bare = dressPlan({ ...D, sets: [null, 'market', null, null] }, belt);
    for (const p of bare) { expect(p.set).toBe('market'); expect(p.s).toBeGreaterThan(belt.screens[1].from); expect(p.s).toBeLessThan(belt.screens[1].to); }
  });
  it('is seeded: the same again, another seed another street', () => {
    expect(dressPlan(D, belt)).toEqual(plan);
    expect(dressPlan({ ...D, seed: 5 }, belt)).not.toEqual(plan);
    expect(dressFaces(D, belt)).toEqual(dressFaces(D, belt));
  });
  it('the crew\'s colour is on its marks, and nowhere when the street has none', () => {
    const hexes = (d) => new Set(dressFaces(d, belt).map((f) => f.hex));
    expect(hexes(D).has('#1f4fa8')).toBe(true);
    const { colour: _c, ...plainD } = D;
    expect(hexes(plainD).has('#1f4fa8')).toBe(false);
  });
  it('its faces are the page\'s: in the world on the belt\'s floor, wound to face out, filled', () => {
    const F = dressSceneFaces(D, belt);
    expect(F.length).toBe(dressCount(D, belt).faces);
    for (const f of F.slice(0, 60)) {
      expect(f.fill).toMatch(/^#[0-9a-f]{6}$/i);
      for (const c of f.corners) expect(c[2]).toBeGreaterThanOrEqual(belt.floor - 1e-6);
      const [a, b, d] = f.corners, n = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
      expect(n[0] * f.outNormal[0] + n[1] * f.outNormal[1] + n[2] * f.outNormal[2]).toBeGreaterThanOrEqual(0);
    }
  });
  it('a mark stands on a building: on a front wide enough for it, at that front\'s own line; an alley is dressed as one', () => {
    const fronts = [{ from: 0, to: 20, wall: 6.1 }, { from: 22.5, to: 40, wall: 7.4 }, { from: 40, to: belt.length, wall: 6.1 }];
    const P = dressPlan({ ...D, fronts }, belt), marks = P.filter((p) => p.side === 'wall'), alley = P.filter((p) => p.side === 'alley');
    expect(marks.length).toBeGreaterThan(3);
    for (const m of marks) {
      const half = DRESS_PIECES[m.piece].size[0] / 2, F = fronts.find((f) => m.s - half >= f.from && m.s + half <= f.to);
      expect(F, `${m.piece} at ${m.s}`).toBeTruthy();
      expect(m.n).toBeLessThan(F.wall); expect(m.n).toBeGreaterThan(F.wall - 0.5);
    }
    expect(alley.length).toBeGreaterThan(0);
    for (const a of alley) { expect(a.s).toBeGreaterThan(20); expect(a.s).toBeLessThan(22.5); expect(a.n).toBeGreaterThan(7.4); }
    // (no fronts said: no alley, as before)
    expect(dressPlan(D, belt).some((p) => p.side === 'alley')).toBe(false);
  });
  it('a fault is said', () => {
    expect(() => readDress({ ...D, far: [2, 6] }, belt)).toThrow(/outside the band/);
    expect(() => readDress({ ...D, sets: ['market'] }, belt)).toThrow(/a set a screen/);
    expect(() => readDress({ ...D, colour: 'blue' }, belt)).toThrow(/#rrggbb/);
  });
});

describe('on a level', () => {
  it('a town street is dressed unless it says not, in its angle; another level carries none', () => {
    const T = brawlLevel({ kind: 'town' });
    expect(T.brawl.dress.sets).toHaveLength(T.brawl.belt.screens.length);
    expect(T.brawl.belt.angle).toBe('street');
    expect(T.brawl.dress.far[0]).toBeGreaterThanOrEqual(T.brawl.belt.depth[1]);
    expect(brawlLevel({ kind: 'town', dress: false }).brawl.dress).toBeUndefined();
    expect(brawlLevel({ kind: 'town', dress: { colour: '#b3261e', sets: ['plain', 'yard', 'market', 'turf'] } }).brawl.dress).toMatchObject({ colour: '#b3261e', sets: ['plain', 'yard', 'market', 'turf'] });
    expect(() => brawlLevel({ kind: 'town', dress: { far: [0, 9] } })).toThrow(/not its word/);
    expect(brawlLevel({ kind: 'greybox', preset: 'street' }).brawl.dress).toBeUndefined();
    // (its town's shops are its dress's fronts; its fronts rough unless it says)
    expect(T.geotown.fronts).toBe('rough');
    expect(T.brawl.dress.fronts.length).toBeGreaterThan(2);
    expect(brawlLevel({ kind: 'town', fronts: 'broken' }).geotown.fronts).toBe('broken');
  });
});

describe('skandart on the street', () => {
  it('a group of vessels and a patch of debris are built on the ground, inside their piece, the same again', () => {
    // (one piece per shelf used: the vessels' old look, their industrial look, the debris shelf)
    for (const id of ['crates', 'drums', 'rubble']) {
      const P = DRESS_PIECES[id], dice = () => { let k = 7; return () => { k = (k * 16807) % 2147483647; return k / 2147483647; }; };
      const F = P.build(dice(), null), pts = F.flatMap((f) => f.corners);
      expect(F.length, id).toBeGreaterThan(10);
      expect(Math.min(...pts.map((p) => p[2])), id).toBeGreaterThanOrEqual(0);
      expect(Math.max(...pts.map((p) => p[2])), id).toBeLessThanOrEqual(P.tall + 0.4);
      for (const f of F.slice(0, 20)) expect(f.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(P.build(dice(), null)).toEqual(F);
    }
  });
  it('a breakable is drawn as its vessel and leaves a wreck; one with no vessel has no model; none laid, not a byte', () => {
    const M = boxModels(Object.keys(THINGS.box));
    const drawn = Object.keys(M);
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.length).toBeLessThan(Object.keys(THINGS.box).length);      // (a phone booth is the page's block)
    for (const m of Object.values(M)) for (const part of [m.whole, m.wreck]) {
      expect(part.pos.length).toBeGreaterThan(0); expect(part.pos.length % 9).toBe(0); expect(part.col.length).toBe(part.pos.length);
    }
    // (it stands on its own middle, within its row's breadth)
    const what = drawn[0], xs = M[what].whole.pos.filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(THINGS.box[what].w);
    expect(boxModels(drawn)).toEqual(M);
    const block = { belt, street: { players: [0], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }] } };
    expect(brawlYardData(block).boxes).toBeUndefined();
    expect(Object.keys(brawlYardData({ ...block, street: { ...block.street, things: [{ kind: 'box', what, at: 20 }] } }).boxes)).toEqual([what]);
  });
});

describe('the settings: a kind of place', () => {
  it('each names sets that exist, a turn among them, boxes the street can break, and its boss\'s set is held', () => {
    for (const id of DRESS_SETTING_IDS) {
      const S = DRESS_SETTINGS[id], T = S.turn;
      for (const n of [...S.sets, T.way, T.between, T.boss, ...T.held]) expect(DRESS_SETS[n], `${id}: ${n}`).toBeTruthy();
      for (const n of [T.way, T.between, T.boss, ...T.held]) expect(S.sets, `${id}: ${n}`).toContain(n);
      for (const b of S.boxes) expect(THINGS.box[b], `${id}: ${b}`).toBeTruthy();
      const B = DRESS_SETS[T.boss];
      expect([...Object.keys(B.far), ...Object.keys(B.wall)].some((p) => DRESS_PIECES[p].crew), id).toBe(true);
    }
  });
  it('a map laid in a setting takes its turn and keeps its laws; every piece a setting draws is built', () => {
    for (const id of DRESS_SETTING_IDS) {
      const Dm = { far: [3.3, 6], wall: 6.1, seed: 2, colour: '#b3261e', setting: id };
      expect(readDress(Dm, belt).sets).toEqual(dressSets(belt, id));
      for (const l of dressLaws(Dm, belt)) expect(l.ok, `${id}: ${l.law}: ${l.what}`).toBe(true);
      expect(dressFaces(Dm, belt).length, id).toBeGreaterThan(50);
    }
    expect(() => readDress({ ...D, setting: 'moon' }, belt)).toThrow(/kind of place/);
  });
  it('a stage kit with a setting of its own is dressed as it, framed as the street is; another kit takes one said', () => {
    const kit = DRESS_SETTING_IDS.flatMap((id) => DRESS_SETTINGS[id].kits)[0], id = settingOfKit(kit);
    const L = brawlLevel({ kind: 'stage', kit });
    expect(L.brawl.dress.setting).toBe(id);
    expect(L.brawl.belt.angle).toBe('street');
    expect(L.brawl.dress.far[0]).toBeGreaterThanOrEqual(L.brawl.belt.depth[1]);
    expect(brawlLevel({ kind: 'stage', kit, dress: false }).brawl.dress).toBeUndefined();
    const bare = 'gothic-stone';
    expect(settingOfKit(bare)).toBeNull();
    expect(brawlLevel({ kind: 'stage', kit: bare }).brawl.dress).toBeUndefined();
    expect(brawlLevel({ kind: 'stage', kit: bare }).brawl.belt.angle).toBe('classic');
    expect(brawlLevel({ kind: 'stage', kit: bare, dress: { setting: id } }).brawl.dress.setting).toBe(id);
    expect(() => brawlLevel({ kind: 'stage', kit, dress: { far: [0, 1] } })).toThrow(/not its word/);
  });
});

describe('a set of an agent\'s own', () => {
  const own = { says: 'a server room', far: { lockers: 4, generator: 1, cones: 1 }, wall: { panel: 3, duct: 1, exit: 1 }, gap: [0.4, 1.2], marks: [2.5, 4] };
  it('is said in a name\'s place and laid like a row', () => {
    const Dm = { ...D, sets: ['strip', own, 'yard', 'turf'] }, P = dressPlan(Dm, belt), mine = P.filter((p) => p.set === 'own-2');
    expect(mine.length).toBeGreaterThan(3);
    for (const p of mine) { expect(Object.keys({ ...own.far, ...own.wall })).toContain(p.piece); expect(p.s).toBeGreaterThan(belt.screens[1].from); expect(p.s).toBeLessThan(belt.screens[1].to); }
  });
  it('is read against the pieces: an unknown piece, a mark on the floor, a tall thing on the near side are said', () => {
    const at = (o) => () => readDress({ ...D, sets: ['strip', o, 'yard', 'turf'] }, belt);
    expect(at({ far: { hovercraft: 1 } })).toThrow(/no piece/);
    expect(at({ far: { panel: 1 } })).toThrow(/goes in `wall`/);
    expect(at({ far: { desk: 1 }, wall: { desk: 1 } })).toThrow(/goes in `far`/);
    expect(at({ far: { desk: 1 }, near: { racking: 1 } })).toThrow(/near side/);
    expect(at({ wall: { panel: 1 } })).toThrow(/set of its own/);
  });
});

describe('the laws of a side-scrolling map', () => {
  const law = (d, name) => dressLaws(d, belt).find((l) => l.law === name);
  it('the same set on two screens running is said; a boss\'s screen with nothing of its holder\'s is said', () => {
    expect(law({ ...D, sets: ['strip', 'market', 'market', 'turf'] }, 'a-place-a-screen').ok).toBe(false);
    expect(law({ ...D, sets: ['strip', 'market', 'yard', 'cafe'] }, 'the-boss-owns-it').ok).toBe(true);     // (its banner)
    expect(law({ ...D, sets: ['strip', 'market', 'yard', { far: { bench: 1 }, wall: { clock: 1 } }] }, 'the-boss-owns-it').ok).toBe(false);
  });
  it('a screen with one depth, or one thing over and over, is said', () => {
    expect(law({ ...D, sets: ['strip', { far: { bench: 1 } }, 'yard', 'turf'] }, 'two-depths').ok).toBe(false);
    expect(law({ ...D, sets: ['strip', { far: { bench: 1 }, wall: { clock: 1 } }, 'yard', 'turf'] }, 'variety').ok).toBe(false);
    expect(law({ ...D, sets: ['strip', { far: { bench: 1 }, wall: { clock: 1 }, gap: [12, 14], marks: [20, 22] }, 'yard', 'turf'] }, 'no-bare-run').ok).toBe(false);
  });
});

describe('on ground that rises', () => {
  it('a piece stands on the floor under its own middle; a town street climbs by its word and its belt follows its ground', () => {
    const up = readBelt({ at: [10, 5], heading: 0, floor: 0.2, depth: [-2.5, 3], screens: belt.screens.map(({ length, gate, boss }) => ({ length, ...(boss ? { boss } : gate ? { gate } : {}) })), rise: [[0, 0], [20, 0], [30, 2], [62, 2]] }, 'belt');
    const low = (b, from, to) => Math.min(...dressFaces(D, b).filter((f) => f.corners.every((c) => c[0] - 10 > from && c[0] - 10 < to)).flatMap((f) => f.corners.map((c) => c[2])));
    expect(low(up, 40, 60) - low(belt, 40, 60)).toBeCloseTo(2, 1);
    expect(low(up, 0, 18)).toBeCloseTo(low(belt, 0, 18), 3);
    const T = brawlLevel({ kind: 'town', climb: 0.06 }), B = T.brawl.belt;
    expect(B.rise.length).toBeGreaterThan(5);
    expect(B.rise[B.rise.length - 1][1]).toBeGreaterThan(1.5);
    expect(Object.keys(T.geotown.slope.streets)).toHaveLength(1);
    expect(brawlLevel({ kind: 'town' }).brawl.belt.rise).toBeUndefined();
    expect(() => brawlLevel({ kind: 'town', climb: 0.4 })).toThrow(/grade/);
  });
  it('a greybox street that rises is terraced: a ramp cut into steps, the road grown down to the ground, none floating', () => {
    const riseW = [[0, 0], [11, 0], [15, 1.4], [62, 1.4]];
    const G = brawlLevel({ kind: 'greybox', preset: 'street', belt: { rise: riseW } }), F = brawlLevel({ kind: 'greybox', preset: 'street' });
    expect(G.blocks.length).toBeGreaterThan(F.blocks.length);
    const tops = G.blocks.filter((b) => b.tone === 'floor').map((b) => b.at[2] + b.size[2]);
    expect(Math.max(...tops) - Math.min(...tops)).toBeCloseTo(1.4, 1);
    for (const b of G.blocks.filter((q) => q.tone === 'floor')) expect(b.at[2]).toBeLessThanOrEqual(0);
  });
});

describe('a level that turns', () => {
  it('a town street and a building\'s bays take a turn by word; a level that says none has none', () => {
    const turn = [[0, 0], [16, 0], [30, 35], [60, 35]];
    expect(brawlLevel({ kind: 'town', turn }).brawl.belt.turn).toEqual(turn);
    expect(brawlLevel({ kind: 'stage', kit: 'gothic-stone', turn }).brawl.belt.turn).toEqual(turn);
    expect(brawlLevel({ kind: 'town' }).brawl.belt.turn).toBeUndefined();
    expect(() => brawlLevel({ kind: 'town', turn: [[0, 0], [1, 50]] })).toThrow(/walked round/);
  });
});

describe('a level whose band drifts', () => {
  it('a greybox street runs on the band\'s diagonal, smooth: a block on it turned onto it, not stepped', () => {
    const drift = [[0, 0], [12, 0], [26, 9], [62, 9]], ang = (Math.atan2(9, 14) * 180) / Math.PI;
    const G = brawlLevel({ kind: 'greybox', preset: 'street', belt: { drift } }), F = brawlLevel({ kind: 'greybox', preset: 'street' });
    // (a long block is three pieces, one a stretch; a short one is still one: far fewer than a stepped street's)
    expect(G.blocks.length).toBeGreaterThan(F.blocks.length); expect(G.blocks.length).toBeLessThan(F.blocks.length * 3);
    const turned = G.blocks.filter((b) => b.turn);
    expect(turned.length).toBeGreaterThan(5);
    for (const b of turned) expect(b.turn).toBeCloseTo(ang, 1);
    // (before the diagonal as it was, past it moved across whole, on it centred on the band's line)
    const floor = (L, from, to) => L.blocks.filter((b) => b.tone === 'floor' && !b.turn && b.at[0] > from && b.at[0] < to).map((b) => b.at[1]);
    expect(floor(G, 26, 70)[0] - floor(F, -100, 200)[0]).toBeCloseTo(9, 3);
    expect(floor(G, -20, 12)[0]).toBeCloseTo(floor(F, -100, 200)[0], 3);
    const road = turned.find((b) => b.tone === 'floor');
    expect(road.at[0]).toBeCloseTo(19, 1); expect(road.at[1] - floor(F, -100, 200)[0]).toBeCloseTo(4.5, 1);
    expect(road.size[0]).toBeGreaterThanOrEqual(Math.hypot(14, 9));
  });
  it('a town\'s street runs on the diagonal too: its dress follows its ground, a thing moved whole, a mark sheared with its wall', () => {
    const drift = [[0, 0], [14, 0], [30, 10], [62, 10]];
    const T = brawlLevel({ kind: 'town', drift }), F = brawlLevel({ kind: 'town' });
    expect(T.brawl.belt.drift).toEqual(drift);
    expect(T.brawl.dress.follows).toBe(true); expect(F.brawl.dress.follows).toBeUndefined();
    // (the same dress, laid the same: nothing is left out for the drift, and the laws hold on the moved ground)
    expect(dressPlan(T.brawl.dress, T.brawl.belt)).toEqual(dressPlan({ ...F.brawl.dress, follows: true }, T.brawl.belt));
    for (const l of dressLaws(T.brawl.dress, T.brawl.belt)) expect(l.ok, `${l.law}: ${l.what}`).toBe(true);
    const ys = (L, from) => dressFaces(L.brawl.dress, L.brawl.belt).filter((f) => f.corners.every((c) => c[0] - L.brawl.belt.at[0] > from)).flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.min(...ys(T, 34)) - Math.min(...ys(F, 34))).toBeCloseTo(10, 3);
  });
  it('a ground that stands still under a drifting band: what would be left standing in the band is left out', () => {
    const up = readBelt({ at: [10, 5], heading: 0, floor: 0.2, depth: [-2.5, 3], screens: belt.screens.map(({ length, gate, boss }) => ({ length, ...(boss ? { boss } : gate ? { gate } : {}) })), drift: [[0, 0], [20, 0], [26, 2.4], [62, 2.4]] }, 'belt');
    expect(dressLaws(D, up).find((l) => l.law === 'outside-the-band').ok).toBe(true);
    expect(dressPlan(D, up).filter((p) => p.side === 'far').length).toBeLessThan(dressPlan(D, belt).filter((p) => p.side === 'far').length);
  });
});

describe('a room turns as a street does', () => {
  it('a building\'s bays take the walk\'s rise, turn and drift by the same words; its dress follows its ground', () => {
    const kit = DRESS_SETTING_IDS.flatMap((id) => DRESS_SETTINGS[id].kits)[0];
    const drift = [[0, 0], [14, 0], [30, 8], [62, 8]], rise = [[0, 0], [30, 0], [36, 1.5], [62, 1.5]], turn = [[0, 0], [40, 0], [50, 25], [62, 25]];
    const L = brawlLevel({ kind: 'stage', kit, drift, rise, turn }), B = L.brawl.belt;
    expect(B.drift).toEqual(drift); expect(B.rise).toEqual(rise); expect(B.turn).toEqual(turn);
    expect(L.brawl.dress.follows).toBe(true);
    for (const l of dressLaws(L.brawl.dress, B)) expect(l.ok, `${l.law}: ${l.what}`).toBe(true);
    expect(brawlLevel({ kind: 'stage', kit }).brawl.belt).not.toHaveProperty('drift');
  });
});
