// THE CASTLE'S FABRIC: every closed part built as what it is, in the material its room's look names, the play untouched.
import { describe, it, expect } from 'vitest';
import { boxOf } from './scene.js';
import { buildFabric, fabricLaws, PATHS, LEDGES } from './fabric.js';
import { BOX_THEMES, roomLook, lookOf } from './themes.js';
import { vampireSonata } from './vampire-sonata.js';

const M = (words) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.63 });
const B = boxOf(M(vampireSonata())), F = B.dress.fabric, G = B.greybox;

describe('the castle\'s fabric', () => {
  it('builds every solid as its role, makes every doorway, frames every hole, slits every tower, crowns and founds the box', () => {
    const laws = B.laws.filter((l) => l.id.startsWith('fabric:'));
    expect(laws.map((l) => l.id)).toEqual(['fabric:built', 'fabric:doorways-made', 'fabric:holes-framed', 'fabric:paths-read', 'fabric:towers-slit', 'fabric:crowned']);
    expect(laws.filter((l) => !l.holds)).toEqual([]);
    expect(new Set(F.built.map((b) => b.i)).size).toBe(G.solids.length);
    // (a solid left as a block is said, by its room)
    const short = fabricLaws(B, { ...F, built: F.built.slice(1) }).find((l) => l.id === 'built');
    expect(short.holds).toBe(false);
    expect(short.rooms).toEqual([G.solids[F.built[0].i].room]);
  });

  it('lays a floor and a ledge in the material its room\'s look names: its locale\'s, else its ring\'s', () => {
    const asOf = new Map(F.built.map((b) => [b.i, b.as])), byRoom = (room, role) => G.solids.map((s, i) => [s, i]).filter(([s]) => s.room === room && s.role === role).map(([, i]) => asOf.get(i));
    const kinds = new Set();
    for (const [room, p] of Object.entries(B.dress.plan)) {
      const r = B.layout.rooms.find((x) => x.id === room), T = BOX_THEMES.castle, L = { ...lookOf(T, r.ring, B.layout.rings.length), ...(p.locale ? T.locales[p.locale] : {}) };
      for (const as of byRoom(room, 'floor')) expect(as).toBe(`path:${L.path ?? 'flags'}`);
      for (const as of byRoom(room, 'ledge')) expect(as).toBe(`ledge:${L.ledge ?? 'stone'}`);
      kinds.add(L.path ?? 'flags').add(L.ledge ?? 'stone');
      if (p.locale === 'library') expect(byRoom(room, 'floor')).toContain('path:boards');
    }
    // (the castle lays every path and every ledge it has a word for)
    for (const k of [...Object.keys(PATHS), ...Object.keys(LEDGES)]) expect(kinds).toContain(k);
  });

  it('crowns the open ring\'s top in machicolations, roofs its walks below in timber, and keeps the cornice inside', () => {
    const asOf = new Map(F.built.map((b) => [b.i, b.as])), H = G.screen.height, top = B.layout.box[1] * H;
    for (const [s, i] of G.solids.map((s, i) => [s, i]).filter(([s]) => s.role === 'ceiling')) {
      const open = !!B.dress.plan[s.room].open;
      expect(asOf.get(i)).toBe(open ? (Math.abs(s.z1 - top) < 1e-3 ? 'machicolations' : 'hoarding') : 'cornice');
    }
  });

  it('is pure, pushes faces only, and stands nowhere the play does not', () => {
    const ctx = { greybox: G, layout: B.layout, theme: BOX_THEMES.castle, lookRoom: new Map(B.layout.rooms.map((r) => [r.id, roomLook(BOX_THEMES.castle, r, B.layout.rings.length)])), cols: B.layout.box[0], rows: B.layout.box[1] };
    const a = [], b = [];
    expect(buildFabric(a, ctx)).toEqual(buildFabric(b, ctx));
    expect(a).toEqual(b);
    // (every face is drawn: a front, a top, an end, or the far reveal behind the lane; none a collider)
    for (const f of a) expect(f.corners.length).toBeGreaterThanOrEqual(3);
    expect(a.every((f) => !('min' in f))).toBe(true);
  });
});
