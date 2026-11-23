import { describe, it, expect } from 'vitest';
import { readBox, layBox, TURNS } from './box.js';
import { vampireSonata } from './vampire-sonata.js';

// the smallest box with a ring inside a ring: 7 × 5, its core what is left (3 × 1)
const small = (over = {}) => ({
  box: [7, 5],
  powers: { leap: { opens: 'double-jump' }, ram: { opens: 'wall-break' } },
  rings: [
    { id: 'wall', place: 'the wall', boss: 'the warden', finds: 'leap', inward: 'double-jump', pockets: [{ gate: 'wall-break', holds: 'a heart' }] },
    { id: 'halls', place: 'the halls', finds: 'ram', inward: 'wall-break' },
    { id: 'keep', place: 'the keep', boss: 'the lord' },
  ],
  ...over,
});
const touch = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

describe('the spiralling box: its words', () => {
  it('refuses, teaching, what it cannot lay', () => {
    expect(() => readBox({ ...small(), lanes: 2 })).toThrow(/lanes is not the map's word/);
    expect(() => readBox(small({ box: [7, 4] }))).toThrow(/a 7 × 4 box holds/);
    const unknown = small(); unknown.rings[1].finds = 'nope';
    expect(() => readBox(unknown)).toThrow(/rings\[1\]\.finds is a power's id/);
    const noOpener = small(); noOpener.rings[1].inward = 'form';
    expect(() => readBox(noOpener)).toThrow(/inward 'form' is opened by no power/);
    const coreStep = small(); coreStep.rings[2].inward = 'form';
    expect(() => readBox(coreStep)).toThrow(/the core is walked to its throne/);
    expect(() => readBox(small({ turn: 'zigzag' }))).toThrow(new RegExp(Object.keys(TURNS).join('.*')));
  });
});

describe('the spiralling box: laid', () => {
  for (const turn of Object.keys(TURNS)) {
    it(`walks every ring ${turn}, from its bottom-left corner, filling the box once`, () => {
      const L = layBox(small({ turn })), [cols, rows] = L.box, seen = new Set();
      for (const r of L.rooms) for (const c of r.cells) { const k = c.join(','); expect(seen.has(k)).toBe(false); seen.add(k); }
      expect(seen.size).toBe(cols * rows);
      // the walk never steps out to a ring it left, and each ring starts in its own bottom-left corner
      const rings = L.walk.map((id) => L.rooms.find((r) => r.id === id).ring);
      expect(rings).toEqual([...rings].sort((a, b) => a - b));
      for (const R of L.rings.filter((x) => !x.core)) expect(L.rooms.find((r) => r.ring === R.i).cells[0]).toEqual([R.rect[0], R.rect[2]]);
      // the first leg along the floor (ccw) or up the near side (cw)
      expect(L.rings[0].legs[1].dir).toBe(turn === 'ccw' ? 'right' : 'up');
      // every door joins two touching cells of its two rooms
      for (const d of L.doors) {
        const a = L.rooms.find((r) => r.id === d.a), b = L.rooms.find((r) => r.id === d.b);
        expect(touch(...d.cells)).toBe(true);
        expect(a.cells.some((c) => c.join() === d.cells[0].join())).toBe(true);
        expect(b.cells.some((c) => c.join() === d.cells[1].join())).toBe(true);
      }
    });
  }

  it('steps in through each ring\'s gate, and opens back out from a ring inside', () => {
    const L = layBox(small());
    expect(L.doors.filter((d) => d.kind === 'step').map((d) => d.gate)).toEqual(['double-jump', 'wall-break']);
    const out = L.doors.filter((d) => d.kind === 'shortcut');
    // the inner ring's floor dropped out (one way) and its top climbed out through what it finds
    expect(out.find((d) => d.oneWay)).toBeTruthy();
    expect(out.find((d) => !d.oneWay)?.gate).toBe('wall-break');
    // the boss's room seals its way on; the loop back to the gate corner is a drop
    expect(L.doors.find((d) => d.gate === 'boss').a).toBe(L.rooms.find((r) => r.boss === 'the warden').id);
    expect(L.doors.filter((d) => d.kind === 'loop').every((d) => d.oneWay)).toBe(true);
  });

  it('is laid from its words alone', () => {
    expect(layBox(vampireSonata())).toEqual(layBox(vampireSonata()));
  });
});
