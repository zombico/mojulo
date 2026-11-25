import { describe, it, expect } from 'vitest';
import { layBox } from './box.js';
import { solveBox } from './solve.js';
import { greyboxOf } from './rooms.js';
import { boxLaws, BOX_LAWS } from './laws.js';
import { drawBox } from './drawing.js';
import { GATES } from './gates.js';
import { vampireSonata } from './vampire-sonata.js';

const lost = (L) => boxLaws(L).filter((l) => !l.holds).map((l) => l.id);

describe('the box solved', () => {
  it('walks Vampire Sonata to its throne: every room, its powers in the order of its rings, the way back short', () => {
    const L = layBox(vampireSonata()), S = solveBox(L);
    expect(S.done).toBe(true);
    expect(S.unreached).toEqual([]);
    expect(S.traps).toEqual([]);
    expect(S.got.filter((g) => g.kind === 'power').map((g) => g.what)).toEqual(['the second leap', 'the ram strike', 'the mist veil']);
    expect(S.wayBack).toBeLessThan(S.wayIn / 2);
  });

  it('stops at a gate whose opener is only found past it', () => {
    const W = vampireSonata();
    // the second leap moved into the halls: the outer wall's step in asks for it before it can be found
    delete W.rings[0].finds; W.rings[1].finds = 'second-leap'; W.powers.extra = { opens: 'wall-break' }; W.rings[2].finds = 'extra';
    W.rings[2].boss = 'the Bellkeeper'; delete W.rings[2].pockets;
    W.powers['mist-veil'] = { opens: 'form' };
    const L = layBox({ ...W, powers: { ...W.powers } }), S = solveBox(L);
    expect(S.done).toBe(false);
    expect(S.unreached.length).toBeGreaterThan(0);
    expect(lost(L)).toContain('solvable');
  });
});

describe('the box\'s laws', () => {
  it('names each law once, in order', () => {
    const L = layBox(vampireSonata());
    expect(boxLaws(L).map((l) => l.id)).toEqual([...BOX_LAWS]);
  });

  for (const turn of ['ccw', 'cw']) it(`hold over Vampire Sonata walked ${turn}`, () => {
    expect(lost(layBox(vampireSonata({ turn })))).toEqual([]);
  });

  it('say a power that opens nothing behind it (the box never walked again)', () => {
    const W = vampireSonata();
    W.rings[0].pockets = W.rings[0].pockets.filter((p) => p.gate !== 'double-jump');
    expect(lost(layBox(W))).toEqual(['revisits']);
  });

  it('say two steps in that ask the same thing', () => {
    const W = vampireSonata();
    W.rings[2].inward = 'wall-break';
    expect(lost(layBox(W))).toContain('one-new-thing');
  });
});

describe('the box in greybox', () => {
  it('climbs every door a jump at a time (or by a ladder), a double-jump gate by more than a jump and less than a double', () => {
    const L = layBox(vampireSonata()), G = greyboxOf(L);
    expect(G.chains.length).toBeGreaterThan(0);
    for (const c of G.chains) c.rises.forEach((r, k) => {
      if (c.ways?.[k] === 'ladder') { expect(G.ladders.some((l) => l.room === c.room && Math.abs(l.z1 - c.stands[k + 1]) < 1e-3)).toBe(true); return; }   // (a ladder climbs it)
      if (c.gate === 'double-jump' && k === c.rises.length - 1) { expect(r).toBeGreaterThan(G.hero.jump); expect(r).toBeLessThanOrEqual(G.hero.double); }
      else expect(r).toBeLessThanOrEqual(G.hero.jump);
    });
    // every door a doorway or a hole; every gate kind the box uses stands as a block
    for (const d of L.doors) expect(G.doorways.some((x) => x.door === d.id) || G.holes.some((x) => x.door === d.id)).toBe(true);
    const kinds = new Set(G.gates.map((g) => g.kind));
    for (const k of Object.keys(GATES)) expect(kinds.has(k)).toBe(true);
    // no shell stands in a doorway
    for (const w of G.doorways) {
      const blocked = G.solids.filter((s) => (s.role === 'wall' || s.role === 'floor') && s.s0 < w.s - 0.1 && s.s1 > w.s + 0.1 && s.z0 < w.z1 - 0.1 && s.z1 > w.z0 + 0.1);
      expect(blocked).toEqual([]);
    }
  });

  it('is drawn as an elevation with the walk numbered and the laws under it', () => {
    const L = layBox(vampireSonata()), G = greyboxOf(L), S = solveBox(L), laws = boxLaws(L, { solved: S, greybox: G });
    const svg = drawBox({ layout: L, greybox: G, laws, solved: S });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`>${L.walk.length - 1}</text>`);
    for (const g of Object.values(GATES)) expect(svg).toContain(g.colour);
    expect(svg).toContain('the Lord of the Keep');
  });
});
