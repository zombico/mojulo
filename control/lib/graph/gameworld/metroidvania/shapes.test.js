import { describe, it, expect } from 'vitest';
import { layBox, readBox } from './box.js';
import { solveBox } from './solve.js';
import { boxLaws, BOX_LAWS } from './laws.js';
import { SHAPE_IDS, shapeRects } from './shapes.js';
import { bellTower, courtyard } from './vampire-sonata.js';

const lost = (L) => boxLaws(L).filter((l) => !l.holds).map((l) => l.id);
const at = (L, c, r) => L.rooms.find((x) => x.cells.some((q) => q[0] === c && q[1] === r));

describe('a box\'s shapes', () => {
  it('names its shapes and refuses, teaching, a size a shape cannot fill', () => {
    expect(SHAPE_IDS).toEqual(['spiral', 'serpentine', 'hub']);
    expect(() => readBox({ ...bellTower(), shape: 'maze' })).toThrow(/shape is spiral/);
    expect(() => readBox({ ...bellTower(), turn: 'cw' })).toThrow(/turn is a spiral's word/);
    expect(() => shapeRects('serpentine', [8, 2], 3)).toThrow(/holds 2 bands/);
    expect(() => readBox({ ...courtyard(), box: [9, 8] })).toThrow(/odd too/);
    expect(() => readBox({ ...courtyard(), box: [7, 6] })).toThrow(/rows are 4, 8 or 12/);
    const W = courtyard(); W.rings[1].boss = 'a warden';
    expect(() => readBox(W)).toThrow(/never fought in/);
  });

  it('lays the bell tower as a serpentine: row by row, each run back, climbing a row a turn, a chute down its middle', () => {
    const L = layBox(bellTower());
    expect(L.shape).toBe('serpentine');
    expect(L.cells).toBe(8 * 6);
    // (each row crossed the other way from the one under it, never a row dropped on the walk)
    const rowOf = L.walk.map((id) => L.rooms.find((r) => r.id === id).rect[1]);
    expect(rowOf.every((r, k) => !k || r >= rowOf[k - 1])).toBe(true);
    expect(at(L, 0, 0).walk).toBeLessThan(at(L, 7, 0).walk);
    expect(at(L, 7, 1).walk).toBeLessThan(at(L, 0, 1).walk);
    // (the chute: a one-way drop from the top row to the bottom down the middle column)
    expect(L.doors.filter((d) => d.kind === 'shortcut' && d.oneWay && d.cells[0][0] === 4).length).toBe(5);
    // (and no band's climb out of a boss's chamber: it is fought in on its floor)
    for (const r of L.rooms.filter((x) => x.boss)) expect(L.doors.some((d) => d.kind === 'shortcut' && !d.oneWay && d.a === r.id)).toBe(false);
    expect(L.exit.cell[1]).toBe(5);
    expect(lost(L)).toEqual([]);
  });

  it('lays the courtyard as a hub: the approach up to it, each wing out from it and back, each prize opening the next', () => {
    const L = layBox(courtyard()), S = solveBox(L);
    expect(L.shape).toBe('hub');
    const hub = L.rings[1], wings = L.rings.slice(2);
    expect(hub.rect).toEqual([3, 3, 0, 7]);
    for (const w of wings) {
      expect(L.doors.some((d) => d.kind === 'step' && L.rooms.find((r) => r.id === d.a).ring === 1 && L.rooms.find((r) => r.id === d.b).ring === w.i)).toBe(true);
      expect(L.doors.some((d) => d.kind === 'return' && d.oneWay && L.rooms.find((r) => r.id === d.b).ring === 1 && L.rooms.find((r) => r.id === d.a).ring === w.i)).toBe(true);
    }
    // (a wing's boss seals its way back to the hub)
    expect(L.doors.find((d) => d.kind === 'return' && d.a.startsWith('chapel')).gate).toBe('boss');
    expect(S.done).toBe(true);
    expect(S.got.filter((g) => g.kind === 'power').map((g) => g.what)).toEqual(['the second leap', 'the ram strike']);
    expect(lost(L)).toEqual([]);
    expect(boxLaws(L).map((l) => l.id)).toEqual([...BOX_LAWS]);
  });

  it('says a hub wing that never returns, and a serpentine whose way back is the walk', () => {
    const H = layBox(courtyard());
    expect(lost({ ...H, doors: H.doors.filter((d) => !(d.kind === 'return' && d.a.startsWith('armoury'))) })).toContain('shape');
    const T = layBox(bellTower());
    expect(lost({ ...T, doors: T.doors.filter((d) => d.kind !== 'shortcut') })).toContain('shortcuts');
  });
});
