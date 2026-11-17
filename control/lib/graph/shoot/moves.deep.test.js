// the sweep over every named move on a walking figure: each lays keys that read back as the sizes its words framed,
// and the frame read finds nothing lost and no composition to advise on a move left to its defaults
import { describe, it, expect } from 'vitest';
import { MOVES } from './moves.js';
import { normalizeShoot } from './plan.js';
import { frameRead } from './frame.js';

const walker = { id: 'walker:0', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: (t) => ({ pos: [t, 0.3 * t, 0], heading: Math.atan2(0.3, 1) }) };
const other = { id: 'walker:1', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: () => ({ pos: [2, 8, 0], heading: -1.5 }) };
const subjects = new Map([[walker.id, walker], [other.id, other]]);
const held = [{ t: 0, frame: { on: 'walker:0', size: 'ms', side: 'three-quarter-left' } }, { t: 5, frame: { on: 'walker:0', size: 'ms', side: 'three-quarter-left' } }];

describe('named moves, swept', () => {
  it('every move lays its keys without a warning and reads clean', () => {
    const misses = [];
    for (const m of MOVES) {
      const keys = m.shake ? [...held, { t: 0.5, move: { kind: m.id, for: 3 } }] : [{ t: 0.5, move: { kind: m.id, on: 'walker:0', ...(m.id === 'whip_pan' ? { to: 'walker:1' } : {}) } }];
      const { plan, warnings } = normalizeShoot({ cameras: [{ id: 'a', keys }] }, { subjects });
      if (!plan || warnings.length) { misses.push(`${m.id}: ${warnings.join('; ') || 'no plan'}`); continue; }
      const notes = frameRead(plan, { subjects }).notes;
      if (notes.length) misses.push(`${m.id}: ${notes.map((n) => n.code).join(', ')}`);
      if (m.shake ? !plan.cameras[0].shake : plan.cameras[0].keys.some((k) => k.framing?.move !== m.id)) misses.push(`${m.id}: not laid as itself`);
    }
    expect(misses).toEqual([]);
  });
});
