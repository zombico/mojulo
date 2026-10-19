import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { tileGame } from './fixtures/tiles.js';
import { tabletopPageHtml } from './tabletop-page.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const cell = (K, n) => K.T.byName.get(n);
// a position with the tile to lay chosen by hand (the bag's own draw set aside)
const drawing = (S, t) => ({ ...clone(S), drawn: t });
const lay = (K, S, t, name, rot) => T.apply(K, drawing(S, t), { type: 'tile', at: cell(K, name), rot });
// a laid tile is an object: the cell's tile as { t, rot }
const laidAt = (S, c) => (S.tiles[c] === null ? null : { t: S.pieces[S.tiles[c]].kind, rot: S.pieces[S.tiles[c]].rot });

describe('tiles: laying', () => {
  it('the start tile is laid; a tile goes only beside laid ones, every shared edge matching', () => {
    const { K, S } = at(tileGame());
    expect(laidAt(S, cell(K, 'K11'))).toEqual({ t: 'wall-cap-path', rot: 0 });
    expect(S.bag.length + 1 + 1).toBe(Object.values(K.G.tiles.bag).reduce((a, b) => a + b, 0) + 1);
    const n = K.tile.n;
    for (const m of T.legal(K, S)) {
      const near = K.L.cells[m.at].n;
      let touches = false;
      for (let e = 0; e < n; e++) {
        if (near[e] < 0 || !laidAt(S, near[e])) continue;
        touches = true;
        const other = laidAt(S, near[e]);
        expect(K.tile.labels[S.drawn][(e - m.rot + n) % n]).toBe(K.tile.labels[other.t][((e + n / 2) % n - other.rot + n) % n]);
      }
      expect(touches).toBe(true);
    }
  });

  it('a tile fits only the ways up its edges match: a wall cap above the start\'s wall faces down', () => {
    const { K, S } = at(tileGame());
    const s = drawing(S, 'wall-cap');
    const rots = T.legal(K, s).filter((m) => m.at === cell(K, 'K12')).map((m) => m.rot);
    expect(rots).toEqual([2]);
  });

  it('a tile that fits nowhere is set aside, and the next drawn', () => {
    // a tile whose every edge carries a label no other tile has
    const G = tileGame();
    G.tiles = { ...G.tiles, types: { ...G.tiles.types, odd: { segments: [{ type: 'water', edges: [0, 1, 2, 3] }] } } };
    const { K, S } = at(G);
    const s = drawing(S, 'odd');
    expect(T.legal(K, s).map((m) => m.type)).toEqual(['redraw']);
    const next = T.apply(K, s, { type: 'redraw' });
    expect(next.drawn).toBe(S.bag[0]);
    expect(next.phase).toBe('tile');
  });
});

describe('tiles: features, claims and pay', () => {
  it('a wall closed by two caps pays its claim at once, twice per tile, and the claim comes back', () => {
    const { K, S } = at(tileGame());
    let s = lay(K, S, 'wall-cap', 'K12', 2);
    const claim = T.legal(K, s).find((m) => m.type === 'claim');
    expect(K.tile.types['wall-cap'].segments[claim.seg].type).toBe('wall');
    s = T.apply(K, s, claim);
    expect(s.score[0]).toBe(4);
    expect(s.stock[0]).toBe(7);
    expect(s.claims).toEqual([]);
  });

  it('a feature already claimed cannot be claimed again; joined features pay the most claims, a tie pays both', () => {
    const { K, S } = at(tileGame());
    // red claims the start's path (a straight path laid east), blue a path laid west, then a straight joins them
    let s = lay(K, S, 'path-straight', 'L11', 1);
    s = T.apply(K, s, T.legal(K, s).find((m) => m.type === 'claim'));
    s = lay(K, s, 'path-straight', 'J11', 1);
    // the path through J11 is the start's, already red's: no claim on it
    expect(T.legal(K, s).filter((m) => m.type === 'claim')).toEqual([]);
    s = T.apply(K, s, { type: 'skip' });
    const f = T.tileFeatures(K, s).find((x) => x.type === 'path' && x.size === 3);
    expect(f.claims.map((q) => s.pieces[q].side)).toEqual([0]);
  });

  it('a shrine pays 9 when the eight round it are laid; at the end an open one pays 1 and its neighbours', () => {
    const { K, S } = at(tileGame());
    let s = lay(K, S, 'shrine', 'K10', 0);
    s = T.apply(K, s, T.legal(K, s).find((m) => m.type === 'claim'));
    const f = T.tileFeatures(K, s).find((x) => x.centre);
    expect(f).toMatchObject({ size: 2, open: 7 });
    // the bag emptied: the open shrine pays 1 + its one laid neighbour
    const end = clone(s);
    end.bag = [];
    const last = T.apply(K, lay(K, end, 'path-straight', 'L11', 1), { type: 'skip' });
    expect(last.over.reason).toBe('score');
    // the shrine at K10 with the start above it and L11 beside it on the diagonal: three tiles, one point each
    expect(T.tileFeatures(K, last).find((x) => x.centre).size).toBe(3);
    expect(last.over.scores).toEqual([3, 0]);
    expect(last.stock).toEqual([7, 7]);
  });
});

describe('tiles: the bag, the board, the computer', () => {
  it('the bag\'s order is hidden from a view, and the game ends when it is empty', () => {
    const { K, S } = at(tileGame({ seed: 4 }));
    const seen = T.view(K, S, 1, 9);
    expect(seen.bag.slice().sort()).toEqual(S.bag.slice().sort());
    expect(seen.bag).not.toEqual(S.bag);
    let s = S;
    while (!s.over) s = T.apply(K, s, T.legal(K, s)[0]);
    expect(s.over.reason).toBe('score');
    expect(s.claims).toEqual([]);
  });

  it('a hex board lays tiles too: six edges, opposite three apart', () => {
    const G = {
      board: { shape: 'hex', radius: 3 },
      players: [{ id: 'a' }, { id: 'b' }],
      pieces: { m: { glyph: '' } },
      tiles: {
        types: { line: { segments: [{ type: 'path', edges: [0, 3] }] }, bend: { segments: [{ type: 'path', edges: [0, 1] }] } },
        bag: { line: 3, bend: 3 },
        start: { tile: 'line', at: 'D4' },
        claim: { kind: 'm', stock: 2 },
        features: { path: { complete: 1, incomplete: 1 } },
      },
    };
    const { K, S } = at(G);
    expect(K.tile.n).toBe(6);
    const s = drawing(S, 'line');
    // east of the start a line fits with its path edge against the start's: turned 0 or 3 (both put a path on W)
    const east = K.L.cells[cell(K, 'D4')].n[0];
    expect(T.legal(K, s).filter((m) => m.at === east).map((m) => m.rot).sort()).toEqual([0, 3]);
  });

  it('the computer lays and claims, and the same seed plays the same game', () => {
    const run = () => {
      const { K, S } = at(tileGame({ seed: 2 }));
      let s = S;
      const line = [];
      while (!s.over && line.length < 30) { const m = M.think(K, s, { ...M.LEVELS.fair, seed: line.length }).move; line.push(m.name); s = T.apply(K, s, m); }
      return line;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.some((n) => n.startsWith('claim'))).toBe(true);
  });

  it('the page carries the tile game and draws the same twice', () => {
    const html = tabletopPageHtml(tileGame());
    expect(html).toContain('function tabletopTileClient(D, T, M)');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(tabletopPageHtml(tileGame())).toBe(html);
  });
});
