// A BUILDING'S EXHIBITS (exhibits.js): a collection a wing, each piece on a plinth in one of its wing's galleries, one
// stood life-size on its hall's dais. The concepts: the wings are the corridors' rooms (never the core, the lobby or a
// stair); every piece stands on its plinth's top inside its own wing; a life-size piece takes its wing's hall; what
// does not fit is said; a building with no exhibits lays nothing; a bad collection is refused.
import { describe, it, expect } from 'vitest';
import { layExhibits, readExhibits, EXHIBIT } from './exhibits.js';
import { PIECES } from './compose-dress.js';
import { planStage, assembleStageScene } from './stage.js';
import { withProgram } from './programs.js';

const MUSEUM = { kind: 'stage', kit: 'bay-everyday', program: { use: 'museum', seed: 1, scale: 1.5 }, level: { door: 'out' } };
const plan = planStage(withProgram(MUSEUM));
const refs = (n, p) => Array.from({ length: n }, (_, i) => `sk_${p}${i}`);
const COLLECTIONS = [{ title: 'Machines', pieces: [...refs(5, 'a'), { ref: 'sk_life', life: true }] }, { title: 'Nature', pieces: refs(2, 'b') }, { pieces: refs(3, 'c') }];

describe('a museum\'s exhibits', () => {
  const L = layExhibits(plan, COLLECTIONS), room = new Map(plan.rooms.map((r) => [r.id, r]));

  it('hangs a collection a wing, in the rooms off that wing\'s corridor, never its core, lobby or stair', () => {
    expect(L.wings.map((w) => w.letter)).toEqual(['a', 'b', 'c']);
    expect(L.wings.map((w) => w.title ?? null)).toEqual(['Machines', 'Nature', null]);
    const owner = new Map(L.wings.flatMap((w) => w.rooms.map((r) => [r, w.letter])));
    expect([...owner.keys()].some((r) => /^(core|lobby|stair|corridor)/.test(r))).toBe(false);
    for (const w of L.wings) for (const p of w.pieces) expect(owner.get(p.room)).toBe(w.letter);
  });

  it('stands every piece on the top of its own plinth, inside its room', () => {
    const plinths = new Map(L.props.map((p) => [`${p.at[0]},${p.at[1]}`, p]));
    expect(L.items).toHaveLength(COLLECTIONS.reduce((n, c) => n + c.pieces.length, 0));
    for (const it of L.items) {
      const P = plinths.get(`${it.center[0]},${it.center[1]}`), r = room.get(P.room);
      expect(it.z).toBeCloseTo(PIECES[P.kind].h, 6);
      expect(it.center[0] - it.size[0] / 2).toBeGreaterThan(r.x0);
      expect(it.center[0] + it.size[0] / 2).toBeLessThan(r.x1);
      expect(it.center[1] - it.size[1] / 2).toBeGreaterThan(r.y0);
      expect(it.center[1] + it.size[1] / 2).toBeLessThan(r.y1);
    }
  });

  it('stands a life-size piece whole on its wing\'s hall dais, the rest as models on plinths', () => {
    const life = L.items.find((i) => i.ref === 'sk_life'), dais = L.props.find((p) => p.kind === 'dais');
    expect(dais.room).toMatch(/^(hall|great-hall)/);
    expect(life.center).toEqual(dais.at);
    expect(life.size[0]).toBeGreaterThan(EXHIBIT.top * 2);
    expect(L.props.filter((p) => p.kind === 'plinth')).toHaveLength(L.items.length - 1);
  });

  it('says what does not fit, and lays nothing for a building with none', () => {
    // (a museum a bay deep: two rooms a wing, room for 2 × EXHIBIT.most)
    const small = planStage(withProgram({ ...MUSEUM, program: { ...MUSEUM.program, bays: 1 } }));
    const crowded = layExhibits(small, [{ pieces: refs(2 * EXHIBIT.most + 1, 'z') }]);
    expect(crowded.findings.some((f) => f.id === 'full')).toBe(true);
    expect(layExhibits(plan, undefined)).toEqual({ props: [], items: [], wings: [], findings: [] });
  });

  it('refuses a collection that is not one', () => {
    expect(() => readExhibits([])).toThrow(/list of collections/);
    expect(() => readExhibits([{ pieces: [{ ref: 'sk_a', colour: 'red' }] }])).toThrow(/not a piece's key/);
    expect(() => readExhibits([{}, {}, {}, {}])).toThrow(/3 wings/);
  });

  it('is laid by the stage: its plinths among its props, its pieces as the refs the world resolves', () => {
    const P = assembleStageScene({ ...MUSEUM, exhibits: COLLECTIONS.slice(0, 1) });
    expect(P.itemRefs.map((i) => i.ref)).toEqual(COLLECTIONS[0].pieces.map((p) => (typeof p === 'string' ? p : p.ref)));
    expect((P.anchors ?? []).filter((a) => /\/exhibit\//.test(a.id))).toHaveLength(COLLECTIONS[0].pieces.length);
    expect(P.exhibits.wings[0].title).toBe('Machines');
  }, 60_000);
});

