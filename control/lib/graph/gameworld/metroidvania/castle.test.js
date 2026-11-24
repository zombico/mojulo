import { describe, it, expect } from 'vitest';
import { layBox } from './box.js';
import { isCastle, readCastle, layCastle, castleLaws, portsOf, CONNECTOR_IDS, CASTLE_LAWS, BOX_SHARE } from './castle.js';
import { solveBox } from './solve.js';
import { bellTower, courtyard, vampireSonataCastle } from './vampire-sonata.js';

const lost = (C) => castleLaws(C).filter((l) => !l.holds).map((l) => l.id);
const words = () => vampireSonataCastle();

describe('a castle of boxes', () => {
  it('names its connectors, and refuses, teaching, what it cannot join', () => {
    expect(CONNECTOR_IDS).toEqual(['bridge', 'gatehouse']);
    expect(isCastle(words())).toBe(true);
    expect(isCastle(bellTower())).toBe(false);
    const w = words();
    expect(() => readCastle({ ...w, boxes: [{ ...w.boxes[0], powers: w.powers }, ...w.boxes.slice(1)] })).toThrow(/share its powers/);
    expect(() => readCastle({ ...w, joins: [{ ...w.joins[0], by: 'tunnel' }, w.joins[1]] })).toThrow(/by is a connector: bridge/);
    expect(() => readCastle({ ...w, joins: [w.joins[0], { ...w.joins[1], boss: undefined }] })).toThrow(/boss and its gate go together/);
    const twice = words(); twice.boxes[1].rings[2].finds = 'second-leap';
    expect(() => readCastle(twice)).toThrow(/found once in a castle/);
    // (a spiral is a destination: nothing is joined on from it)
    const after = words(); after.boxes = [after.boxes[2], after.boxes[1]]; after.joins = [{ from: 'keep', to: 'court', by: 'bridge' }];
    expect(() => layCastle(after)).toThrow(/a destination: it is never left/);
    // (a serpentine of an even number of rows leaves on its left)
    const even = words(); even.boxes[0].box = [8, 6];
    expect(() => layCastle(even)).toThrow(/odd number of rows leaves on its right/);
  });

  it('finds each shape\'s ports: every box entered on its left, a serpentine left where its top row runs, a hub at its top right', () => {
    const T = portsOf(layBox({ ...bellTower({ box: [8, 5] }) })), H = portsOf(layBox(courtyard()));
    expect(T.in).toMatchObject({ side: 'left', cell: [0, 0] });
    expect(T.out).toMatchObject({ side: 'right', cell: [7, 4] });
    expect(H.out).toMatchObject({ side: 'right', cell: [6, 7] });
  });

  it('lays Vampire Sonata\'s castle as one map: each box placed level with the last\'s out, its connector between', () => {
    const C = layCastle(words()), [tower, court, keep] = C.castle.boxes;
    expect(C.shape).toBe('castle');
    expect(court.rect[0]).toBe(tower.rect[0] + tower.out.cell[0] + 1 + 2);
    expect(court.in.cell[1]).toBe(tower.out.cell[1]);
    expect(keep.in.cell[1]).toBe(court.out.cell[1]);
    // (the walk: the tower's, the bridge, the courtyard's, the gatehouse, the keep's; one core, the keep's throne)
    expect(C.walk[0]).toBe(tower.in.room);
    expect(C.rings.filter((r) => r.core).map((r) => r.box)).toEqual(['keep']);
    // (the spire's way out sealed by its Great Bell; the gatehouse a save room and its Gatekeeper)
    expect(C.doors.find((d) => d.kind === 'port' && d.a === tower.out.room).gate).toBe('boss');
    const gh = C.castle.joins.find((J) => J.by === 'gatehouse');
    expect(C.rooms.find((r) => r.id === gh.rooms[0]).save).toBe(true);
    expect(C.rooms.find((r) => r.id === gh.rooms[1]).boss).toBe('the Gatekeeper');
    const S = solveBox(C);
    expect(S.done).toBe(true);
    expect(S.got.filter((g) => g.kind === 'power').map((g) => g.what)).toEqual(['the second leap', 'the ram strike', 'the mist veil']);
  });

  it('holds each box to its own shape and the castle walked whole, each law named once', () => {
    const C = layCastle(words()), laws = castleLaws(C);
    expect(laws.filter((l) => !l.id.includes(':')).map((l) => l.id)).toEqual([...CASTLE_LAWS]);
    expect(laws.filter((l) => l.id.startsWith('court:')).map((l) => l.id.split(':')[1])).toEqual([...BOX_SHARE]);
    expect(lost(C)).toEqual([]);
    // (a power found only past where it is needed: the castle's walk stops at it)
    const late = words(); late.boxes[0].rings[0].finds = undefined; late.boxes[2].rings[1].finds = 'second-leap';
    delete late.boxes[0].rings[0].finds;
    expect(lost(layCastle(late))).toEqual(expect.arrayContaining(['found-before', 'solvable']));
  });
});
