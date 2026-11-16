// A BUILDING DESIGNED AS A FIGHTING MAP (era/programs.js FIGHT, program-core.js, stage.js, compose-dress.js layCover):
// each dial on one building whose plan has what the dial works on, chosen from the program table in code. The concepts:
// absence adds nothing (the plan's bytes as they were); the dials are seeded and repeat; a ring leaves no room behind one
// doorway and opens no doorway into a stair's room; the core's side doorways do not face; two stairs join every pair of
// storeys at different ends; a gallery stands at the upper storey's floor, entered from that storey and climbed to from
// the hall; cover is the hall's own stock, clear of its doorways and stairs and a lane off its walls.
import { describe, expect, it } from 'vitest';
import { PROGRAMS, PROGRAM_IDS, FIGHT_DIALS, readFight, planProgram, withProgram } from './programs.js';
import { planStage, assembleStageScene } from './stage.js';
import { keepOuts, footprintOf } from './compose-dress.js';
import { STOCK, HALL_COVER, roleOf } from './stocking.js';
import { catwalkLayout } from './bay.js';
import { CORE, ROOMY } from './program-core.js';
import { stageColliders } from './anchors.js';
import { buildingStage, buildingEnds } from '../gameworld/levels.js';

const C = (u) => PROGRAMS[u].core ?? {};
const pick = (f) => PROGRAM_IDS.find((u) => PROGRAMS[u].shape === 'core' && f(PROGRAMS[u], C(u)));
// (a hall tall enough to be overlooked from the storey over the ground, off a single-loaded wing: its gallery's wall clear)
const ANNEXED = pick((P, c) => P.annex && c.storeys >= 2 && c.loading === 'single' && P.annex.h >= 2 * c.h + 0.5);
const ONE_STOREY = pick((P, c) => c.storeys === 1 && c.loading === 'single' && !P.annex);
const OPPOSITE = pick((P, c) => c.wings === 'I' && c.storeys >= 2 && !P.annex);
const CORNER = pick((P, c) => c.wings === 'L' && c.storeys >= 2 && !P.annex);
const HOUSE = PROGRAM_IDS.find((u) => PROGRAMS[u].shape !== 'core');
const planned = (use, fight) => planStage(withProgram(buildingStage({ use, seed: 1, ...(fight === undefined ? {} : { fight }) })));
const lowered = (use, fight) => withProgram(buildingStage({ use, seed: 1, ...(fight === undefined ? {} : { fight }) }));
const isOf = (re) => (id) => re.test(id);
const service = isOf(/^(lobby|core-|corridor-|stair-)/);

describe('a building designed as a fighting map', () => {
  it('picks its buildings from the table', () => {
    for (const u of [ANNEXED, ONE_STOREY, OPPOSITE, CORNER, HOUSE]) expect(PROGRAM_IDS).toContain(u);
  });

  it('reads its dials: true is every one, an object the ones named, absent or all false is none; anything else is said', () => {
    expect(readFight(undefined)).toBe(null);
    expect(readFight(false)).toBe(null);
    expect(readFight({})).toBe(null);
    expect(Object.values(readFight(true)).every(Boolean)).toBe(true);
    expect(readFight({ rings: true })).toEqual(Object.fromEntries(FIGHT_DIALS.map((k) => [k, k === 'rings'])));
    expect(() => readFight({ moat: true })).toThrow(/fight is/);
    expect(() => readFight({ rings: 1 })).toThrow(/fight is/);
  });

  it.each([ANNEXED, ONE_STOREY, CORNER, HOUSE])('(%s) adds nothing where no dial is asked: the plan, its lowering and its stage the same bytes', (use) => {
    const a = JSON.stringify(lowered(use)), b = JSON.stringify(planned(use));
    for (const f of [false, {}, { rings: false, cover: false }]) {
      expect(JSON.stringify(lowered(use, f))).toBe(a);
      expect(JSON.stringify(planned(use, f))).toBe(b);
    }
  });

  it.each([ANNEXED, HOUSE])('(%s) is a function of its recipe: every dial, twice, the same', (use) => {
    expect(JSON.stringify(planned(use, true))).toBe(JSON.stringify(planned(use, true)));
  });
});

describe('rings', () => {
  const doorsOf = (P, id) => P.links.filter((l) => l.from === id || l.to === id);
  it.each([ANNEXED, ONE_STOREY, CORNER])('(%s) leaves no room behind one doorway, and opens none onto a stair', (use) => {
    const P = planned(use, { rings: true }), before = planned(use);
    const annex = PROGRAMS[use].annex?.role;
    for (const r of P.rooms.filter((q) => !service(q.id) && q.id !== annex)) expect(doorsOf(P, r.id).length, r.id).toBeGreaterThanOrEqual(2);
    expect(doorsOf(P, 'lobby').length).toBeGreaterThanOrEqual(2);
    // (every doorway the ring added: between rooms of one storey, neither holding a stair, and inside the wall they share)
    const old = new Set(before.links.map((l) => `${l.from}>${l.to}`));
    const added = P.links.filter((l) => !old.has(`${l.from}>${l.to}`));
    expect(added.length).toBeGreaterThan(0);
    const byId = new Map(P.rooms.map((r) => [r.id, r]));
    for (const l of added) {
      // (a doorway into a room a stair stands in opens onto its floor, never onto the flight: its approach clear of it)
      for (const st of P.stairs ?? []) for (const id of [l.from, l.to]) if (st.lower === id || st.upper === id) {
        const X0 = l.wall.endsWith('x'), into = (id === l.to) === l.wall.startsWith('+') ? 1 : -1, d = [l.at, l.at + into * 2.7].sort((p, q) => p - q);
        const [mn, mx] = X0 ? [[d[0], l.lo], [d[1], l.hi]] : [[l.lo, d[0]], [l.hi, d[1]]], R = st.rect;
        expect(mn[0] < R[2] && mx[0] > R[0] && mn[1] < R[3] && mx[1] > R[1], `${l.from}>${l.to} onto the stair in ${id}`).toBe(false);
      }
      const a = byId.get(l.from), b = byId.get(l.to), X = l.wall.endsWith('x');
      expect(a.storey ?? 0).toBe(b.storey ?? 0);
      expect(l.lo).toBeGreaterThanOrEqual(Math.max(X ? a.y0 : a.x0, X ? b.y0 : b.x0) - 1e-6);
      expect(l.hi).toBeLessThanOrEqual(Math.min(X ? a.y1 : a.x1, X ? b.y1 : b.x1) + 1e-6);
      expect(l.hi - l.lo).toBeGreaterThanOrEqual(P.kit.door.width - 1e-6);
    }
  });

  it('a house\'s leaf rung onto its neighbour, or a second doorway into its own room', () => {
    const use = PROGRAM_IDS.find((u) => PROGRAMS[u].shape !== 'core' && planned(u, { rings: true }).links.length > planned(u).links.length);
    const P = planned(use, { rings: true }), B = planned(use);
    expect(P.links.length).toBeGreaterThan(B.links.length);
    const one = (Q) => Q.rooms.filter((r) => Q.links.filter((l) => l.from === r.id || l.to === r.id).length === 1).length;
    expect(one(P)).toBeLessThan(one(B));
  });
});

describe('stagger', () => {
  const span = (l) => [l.lo, l.hi];
  it(`(${OPPOSITE}) the core's two side doorways do not face across it`, () => {
    const side = (P, w) => P.links.find((l) => l.from === 'core-1' && l.wall === w && /^corridor-/.test(l.to));
    const B = planned(OPPOSITE), S = planned(OPPOSITE, { stagger: true });
    const [a, b] = [side(B, '+x'), side(B, '-x')].map(span), [c, d] = [side(S, '+x'), side(S, '-x')].map(span);
    expect(a[0] < b[1] && b[0] < a[1]).toBe(true);
    expect(c[0] < d[1] && d[0] < c[1]).toBe(false);
  });

  it(`(${CORNER}) a wing off the core's back takes the lobby's doorway to the other end of its front`, () => {
    const S = planned(CORNER, { stagger: true }), lobby = S.links.find((l) => l.from === 'lobby'), back = S.links.find((l) => l.from === 'core-1' && l.wall === '+y');
    expect(lobby.lo < back.hi && back.lo < lobby.hi).toBe(false);
  });
});

describe('a second stair', () => {
  it.each([OPPOSITE, CORNER])('(%s) joins every pair of storeys twice, at the far end of a wing from the core\'s', (use) => {
    const P = planned(use, { stairs: true }), z = P.storeys.map((s) => s.z0);
    for (let s = 1; s < z.length; s++) {
      const up = P.stairs.filter((x) => x.z0 === z[s - 1] && x.z1 === z[s]);
      expect(up.length, `storey ${s}`).toBeGreaterThanOrEqual(2);
      const core = up.find((x) => /^core-/.test(x.lower)), far = up.filter((x) => /^stair-/.test(x.lower));
      expect(core && far.length).toBeTruthy();
      // (built as the core's is: the building's switchback, the same rise, its flights and landing)
      for (const x of far) {
        expect(x.profile).toBe(core.profile);
        expect(x.rise).toBe(core.rise);
        expect(x.flights.length).toBe(core.flights.length);
        const c = (q) => [(q.rect[0] + q.rect[2]) / 2, (q.rect[1] + q.rect[3]) / 2];
        expect(Math.hypot(c(x)[0] - c(core)[0], c(x)[1] - c(core)[1])).toBeGreaterThan(CORE.w);
      }
    }
  });
});

describe('a gallery', () => {
  it(`(${ANNEXED}) stands at the upper storey's floor, on the wall the wing meets, entered from that storey and climbed to from the hall`, () => {
    const P = planned(ANNEXED, { gallery: true }), G = P.galleries.find((g) => !g.lost), H = P.rooms.find((r) => r.id === G.hall), F = P.rooms.find((r) => r.id === G.from);
    expect(G).toBeTruthy();
    expect(G.z).toBeCloseTo(F.z0 - H.z0, 6);
    expect(F.storey).toBe(H.storey + 1);
    // (its doorway: a sill at the deck's height in the hall's wall, the upper room's own at its floor, onto the deck)
    expect(H.openings[G.side].some((o) => o.sill === G.z && o.lo === G.lo)).toBe(true);
    const fs = { '-x': '+x', '+x': '-x', '-y': '+y', '+y': '-y' }[G.side];
    expect(F.openings[fs].some((o) => !o.sill && o.lo === G.lo)).toBe(true);
    expect(G.lo).toBeGreaterThanOrEqual(G.deck[0] - 1e-6);
    expect(G.hi).toBeLessThanOrEqual(G.deck[1] + 1e-6);
    // (the builder's layout and the plan's are one reckoning: the catwalk fits at that height)
    const L = catwalkLayout(H, P.kit, G.side, G.z, true);
    expect(L && L.landU).toBeGreaterThan(0);
    // (its stairs: the near one along the wall, its foot off the deck's end; a long deck a second, square to it)
    expect(G.near[1] - G.near[0]).toBeGreaterThan(0);
    // (the hall's wall stands whole under its sill: a collider there, from the floor, or from the head of a doorway on
    // the same span under it, which stays open: a gallery's doorway over the floor's)
    const cols = stageColliders({ ...P, rooms: [H] }, {}, []), X = G.side.endsWith('x'), on = (c) => (X ? c.min[1] <= G.lo + 1e-6 && c.max[1] >= G.hi - 1e-6 : c.min[0] <= G.lo + 1e-6);
    const under = H.openings[G.side].find((o) => !o.sill && o.lo < G.hi && o.hi > G.lo);
    expect(cols.some((c) => c.min[2] === (under ? under.top : 0) && c.max[2] === G.z && on(c))).toBe(true);
    if (under) expect(cols.some((c) => c.min[2] < under.top - 1e-6 && c.max[2] > 0.1 && (X ? c.min[1] < under.hi - 1e-6 && c.max[1] > under.lo + 1e-6 : c.min[0] < under.hi - 1e-6 && c.max[0] > under.lo + 1e-6) && Math.abs((X ? c.min[0] : c.min[1]) - (X ? H.box[G.side === '-x' ? 0 : 2] : H.box[G.side === '-y' ? 1 : 3]) + P.kit.wall / 2) < 1e-6)).toBe(false);
  });

  it('is said lost, never refused, where its building has no hall to lay it round', () => {
    const P = lowered(ONE_STOREY, { gallery: true });
    expect(P._program.findings.some((f) => f.id === 'fight')).toBe(true);
    expect(planned(ONE_STOREY, { gallery: true }).galleries).toBeUndefined();
  });
});

describe('cover', () => {
  it('a hall is covered from its own stock: each piece one of the rows its HALL_COVER entry names', () => {
    for (const [hall, rows] of Object.entries(HALL_COVER)) for (const [piece, row] of rows) expect(STOCK[row].some(([k]) => k === piece), `${hall}: ${piece} of ${row}`).toBe(true);
  });

  it(`(${ANNEXED}) stands in its hall's middle, clear of its doorways and stairs and a lane off its walls, and nowhere else`, () => {
    const P = planned(ANNEXED, { cover: true, gallery: true }), cover = P.props.filter((it) => it.id.includes('/cover/'));
    expect(cover.length).toBeGreaterThan(0);
    expect(planned(ANNEXED).props ?? []).toEqual([]);
    const keep = keepOuts(P).filter((k) => k.kind !== 'sight');
    for (const it of cover) {
      const r = P.rooms.find((q) => q.id === it.room), f = footprintOf(it);
      expect(HALL_COVER[roleOf(r.id)].map(([k]) => k)).toContain(it.kind);
      expect(f.min[0] >= r.x0 + 1.2 - 1e-6 && f.max[0] <= r.x1 - 1.2 + 1e-6 && f.min[1] >= r.y0 + 1.2 - 1e-6 && f.max[1] <= r.y1 - 1.2 + 1e-6, it.id).toBe(true);
      for (const k of keep.filter((q) => q.room === it.room)) expect(f.min[0] < k.max[0] && f.max[0] > k.min[0] && f.min[1] < k.max[1] && f.max[1] > k.min[1], `${it.id} in a ${k.kind}`).toBe(false);
    }
    // (a baffle off each doorway into the hall)
    expect(cover.some((it) => it.id.includes('/cover/baffle'))).toBe(true);
  });
});

describe('room', () => {
  it(`(${ANNEXED}) every storey a metre taller and the corridors wide, its stair still finding its run; absent, the sizes as they were`, () => {
    const A = planned(ANNEXED, { room: true }), B = planned(ANNEXED), cor = (P) => { const c = P.rooms.find((r) => /^corridor-1/.test(r.id)); return Math.min(c.box[2] - c.box[0], c.box[3] - c.box[1]); }, core = (P) => P.rooms.find((r) => /^core-1/.test(r.id));
    expect(core(A).h - core(B).h).toBeCloseTo(ROOMY.rise, 6);
    expect(cor(A)).toBeGreaterThanOrEqual(ROOMY.corridor);
    expect(cor(A)).toBeGreaterThan(cor(B));
    expect(A.rooms.find((r) => r.id === 'lobby').h).toBeGreaterThan(B.rooms.find((r) => r.id === 'lobby').h);
    // (the taller storey is climbed: a stair for every pair of storeys, as the plan without the dial has)
    expect(A.stairs.length).toBe(B.stairs.length);
    expect(A.stairs.every((x) => x.z1 - x.z0 > B.stairs[0].z1 - B.stairs[0].z0)).toBe(true);
    expect(planned(ANNEXED, { room: false, rings: true }).rooms.find((r) => /^core-1/.test(r.id)).h).toBe(core(B).h);
  });
});

describe('a house', () => {
  it(`(${HOUSE}) takes rings and cover; the core's dials are said, and lay nothing`, () => {
    const P = planProgram({ use: HOUSE, seed: 1, fight: { stagger: true, stairs: true, gallery: true } }, 'gothic-stone');
    expect(P.findings.filter((f) => f.id === 'fight').length).toBe(3);
    expect(JSON.stringify(P.rooms)).toBe(JSON.stringify(planProgram({ use: HOUSE, seed: 1 }, 'gothic-stone').rooms));
  });
});

describe('the building still a level', () => {
  it(`(${ANNEXED}) builds with every dial: its gallery a walkway railed on its open side, no doorway stood in, the way to the goal walked`, () => {
    const B = { use: ANNEXED, seed: 1, fight: true }, S = assembleStageScene(buildingStage(B));
    const ways = S.bay.rooms.flatMap((r) => r.walkways), G = ways.find((w) => w.gallery);
    expect(G).toBeTruthy();
    expect(G.railed.front && G.railed.far).toBe(true);
    expect(G.entries.length).toBeGreaterThanOrEqual(1);
    expect(S.bay.laws.filter((l) => !l.ok)).toEqual([]);
    // (no thing laid stands in a doorway's way through)
    const things = S.colliders.filter((c) => typeof c.of === 'string' && c.of.includes('/'));
    for (const d of S.anchors.filter((a) => a.kind === 'doorway')) for (const c of things) {
      const t = d.trigger;
      expect(c.min[0] < t.max[0] && c.max[0] > t.min[0] && c.min[1] < t.max[1] && c.max[1] > t.min[1] && c.min[2] < t.max[2] && c.max[2] > t.min[2], `${c.of} in ${d.id}`).toBe(false);
    }
    // (the gallery's doorway is floored through the wall's thickness at the deck's height: a body walks through level)
    const P = planned(ANNEXED, true), Gp = P.galleries.find((g) => !g.lost), H = P.rooms.find((r) => r.id === Gp.hall), X = Gp.side.endsWith('x');
    const line = X ? H.box[Gp.side === '-x' ? 0 : 2] : H.box[Gp.side === '-y' ? 1 : 3], zf = (H.z0 ?? 0) + Gp.z, mid = (Gp.lo + Gp.hi) / 2;
    const sill = S.faces.filter((f) => f.normal[2] > 0.99 && f.corners.every((c) => Math.abs(c[2] - zf) < 1e-3)).some((f) => {
      const a = f.corners.map((c) => c[X ? 0 : 1]), u = f.corners.map((c) => c[X ? 1 : 0]);
      return Math.min(...a) <= line + 1e-6 && Math.max(...a) >= line - 1e-6 && Math.min(...u) <= mid && Math.max(...u) >= mid;
    });
    expect(sill).toBe(true);
    // (the level's route still runs from the way in to the goal room)
    const E = buildingEnds({ manifest: buildingStage(B), building: B });
    expect(E.via.length).toBeGreaterThan(1);
    expect(E.exit[2]).toBeGreaterThan(0);
  });
});
