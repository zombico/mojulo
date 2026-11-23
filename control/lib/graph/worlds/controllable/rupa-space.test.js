import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { blockMatter } from '../../rupa/matter.js';
import { readMatterSpec } from '../../rupa/index.js';
import { buildCapital, placeFleet } from '../../fleet/build.js';

// ── rupa in space (rupa-space): weightless, held by welds back to an anchor, what is cut loose drifts ─────────────────
const CW = composeLive();
const block = (id, min, max, extra = {}) => ({ id, min, max, hp: 1, ...blockMatter({ min, max }, { matter: 'steel', fill: 0.05 }), ...extra });
const step = (w, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => -1e9 }); return w; };
const get = (w, id) => w.breakables.find((b) => b.id === id);

describe('rupa in space', () => {
  it('reads a world\'s gravity: 0 is space; a wrong one taught', () => {
    expect(readMatterSpec({ g: 0 })).toEqual({ g: 0 });
    expect(() => readMatterSpec({ g: -1 })).toThrow(/gravity/);
  });

  it('weightless: a chain welded to its anchor hangs in space, nothing falls, nothing crushed', () => {
    // (an anchor, a block welded to its side, one under that: on Earth the lower would fall, here it is held)
    const bs = [block('a', [0, 0, 100], [10, 10, 110], { anchor: true }), block('b', [10, 0, 100], [20, 10, 110]), block('c', [10, 0, 90], [20, 10, 100])];
    const w = CW.createWorld({ entities: [], breakables: bs, rupa: { g: 0 } });
    step(w, 120);
    for (const id of ['a', 'b', 'c']) { expect(get(w, id).broken, id).toBeNull(); expect(get(w, id).min[2], id).toBe(bs.find((x) => x.id === id).min[2]); }
  });

  it('cut loose, a section drifts off as a body, away from what held it', () => {
    const bs = [block('a', [0, 0, 100], [10, 10, 110], { anchor: true }), block('b', [10, 0, 100], [20, 10, 110]), block('c', [20, 0, 100], [30, 10, 110])];
    const w = CW.createWorld({ entities: [], breakables: bs, rupa: { g: 0 } });
    step(w);
    CW.strikeBlock(w, 'b', 1e13, 'burst', { from: [15, 5, 120] });
    step(w, 30);
    expect(get(w, 'b').broken).not.toBeNull();
    const c = get(w, 'c');
    expect(c.broken).toMatchObject({ how: 'strip' });
    expect(w.breaks.some((r) => r.id === 'c' && r.how === 'drift')).toBe(true);
    const body = w.rupa.bodies.find((q) => q.id === 'strip:c');
    expect(body).toBeTruthy();
    expect(body.vel[0]).toBeGreaterThan(0);                     // (away from the anchor, at x < 10)
    expect(get(w, 'a').broken).toBeNull();
  });

  it('what is cut loose goes as one piece: every block of it at one velocity, its breaks naming its pivot', () => {
    // (an anchor; a weak link; past it a section of three blocks, one hung under another)
    const bs = [block('a', [0, 0, 100], [10, 10, 110], { anchor: true }), block('b', [10, 0, 100], [20, 10, 110]),
      block('c', [20, 0, 100], [30, 10, 110]), block('d', [30, 0, 100], [40, 10, 110]), block('e', [30, 0, 90], [40, 10, 100])];
    const w = CW.createWorld({ entities: [], breakables: bs, rupa: { g: 0 } });
    step(w);
    CW.strikeBlock(w, 'b', 1e13, 'burst', { from: [15, 5, 120] });
    step(w);
    const at = (id) => w.rupa.bodies.find((q) => q.id === 'strip:' + id);
    const vs = ['c', 'd', 'e'].map((id) => at(id).vel);
    expect(vs[1]).toEqual(vs[0]);
    expect(vs[2]).toEqual(vs[0]);
    const D = w.breaks.filter((r) => r.how === 'drift');
    expect(D.map((r) => r.id).sort()).toEqual(['c', 'd', 'e']);
    expect(D.every((r) => r.drift.n === 3 && r.drift.pivot.join() === D[0].drift.pivot.join())).toBe(true);
    // (they keep their places to one another as they go)
    const gap0 = at('e').pos.map((v, k) => v - at('c').pos[k]);
    step(w, 120);
    expect(at('e').pos.map((v, k) => Math.round((v - at('c').pos[k]) * 1e6) / 1e6)).toEqual(gap0.map((v) => Math.round(v * 1e6) / 1e6));
    expect(at('c').pos[0]).toBeGreaterThan(25);
  });

  it('a capital ship: its hull the share of its core left, down when the core goes; a gun down with its mount', () => {
    const P = placeFleet(buildCapital('corvette'), { id: 'cv', at: [0, 0, 0] });
    const core = new Set(P.core), gun = P.hardpoints[0];
    const breakables = P.blocks.map((b) => ({ ...b, hp: 1, ...(P.anchor.includes(b.id) ? { anchor: true } : {}) }));
    const entities = [
      { id: 'cv', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [1, 1, 1], hittable: true, hp: 100 }, structure: { core: P.core }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'gun', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [1, 1, 1], hittable: true, hp: 3 }, onBlock: gun.block, transform: { pos: gun.at, heading: 0 } },
    ];
    const w = CW.createWorld({ entities, breakables, rupa: { g: 0 } }), e = (id) => w.entities.find((x) => x.id === id);
    step(w);
    expect(e('cv').body.hp).toBe(100);
    // a torpedo's blow holes the casing, and spends only the plug's work: one breach, the hull down a share
    const coreId = [...core][0], b = get(w, coreId), c = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
    const torpedo = (at) => { CW.strikeBlock(w, coreId, 3.3e10, 'burst', { from: at }); step(w); };
    torpedo([c[0], c[1], b.max[2] + 20]);
    expect(b.broken).toBeNull();
    expect(b.rupa.dents.some((d) => d.hole)).toBe(true);
    expect(e('cv').body.hp).toBeLessThan(100);
    expect(e('cv').downed).toBeFalsy();
    CW.strikeBlock(w, gun.block, 1e14, 'burst', { from: [0, 0, 60] });
    step(w);
    expect(e('gun').downed).toBe(true);
    // breached in enough places, the reactor goes, the ship with it
    for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [6, 6]]) torpedo([c[0] + dx, c[1] + dy, b.max[2] + 20]);
    expect(e('cv').downed).toBe(true);
  });
});
