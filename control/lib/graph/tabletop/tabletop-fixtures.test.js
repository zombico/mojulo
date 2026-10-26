import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { fieldDuel } from './fixtures/field-duel.js';
import { deckTurns } from './fixtures/deck-turns.js';
import { deckGame } from './fixtures/cards.js';
import { tabletopPageHtml } from './tabletop-page.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const names = (K, S) => T.legal(K, S).map((m) => m.name);
const named = (K, S, name) => {
  const m = T.legal(K, S).find((x) => x.name === name);
  if (!m) throw new Error(`no move ${name} among ${names(K, S).join(' | ')}`);
  return T.apply(K, S, m);
};
const kinds = (S, ids) => T.kindsOf(S, ids);
const cell = (K, n) => K.T.byName.get(n);
// a crafted board duel: summons standing on named cells (ready), hands, energy
function field(K, S, { on = [], hands = [[], []], energy = [9, 9] } = {}) {
  const s = clone(S);
  for (let p = 0; p < 2; p++) {
    for (const id of s.zones[p].hand) { s.pieces[id].zone = 'deck'; s.zones[p].deck.push(id); }
    s.zones[p].hand = hands[p].map((kind) => { s.pieces.push({ kind, side: p, at: -1, moved: 0, zone: 'hand' }); return s.pieces.length - 1; });
    s.pools[p].energy = energy[p];
  }
  const ids = on.map(([side, kind, name]) => {
    const c = cell(K, name);
    s.pieces.push({ kind, side, at: c, moved: 0, zone: 'field', t: s.pieces.length });
    const id = s.pieces.length - 1;
    s.board[c] = id;
    s.zones[side].field.push(id);
    return id;
  });
  return { s, ids };
}

describe('a summoning duel on a board', () => {
  it('a summon is cast onto an empty cell of its home row, and stands there', () => {
    const { K, S } = at(fieldDuel());
    const { s } = field(K, S, { hands: [['pikeman'], []], on: [[0, 'sentinel', 'A1']] });
    const casts = names(K, s).filter((n) => n.startsWith('cast pikeman'));
    expect(casts.sort()).toEqual(['B1', 'C1', 'D1', 'E1'].map((c) => `cast pikeman @${c}`));
    const t = named(K, s, 'cast pikeman @C1');
    const id = t.board[cell(K, 'C1')];
    expect(t.pieces[id]).toMatchObject({ kind: 'pikeman', zone: 'field', at: cell(K, 'C1'), ready: false });
  });

  it('a ready summon goes by its piece\'s rules, not answered, and is exhausted', () => {
    const { K, S } = at(fieldDuel());
    const { s, ids: [foot, leap, charge] } = field(K, S, { on: [[0, 'pikeman', 'B2'], [0, 'outrider', 'D1'], [0, 'lancer', 'E1']] });
    const goes = (id) => names(K, s).filter((n) => n.startsWith(`go ${s.pieces[id].kind}#${id} `)).map((n) => n.split('@')[1]).sort();
    expect(goes(foot)).toEqual(['A2', 'B1', 'B3', 'C2']);
    // the leaper's B2 and the lancer's sideways D1 are held by their own side
    expect(goes(leap)).toEqual(['C3', 'E3']);
    expect(goes(charge)).toEqual(['E2', 'E3']);
    const t = named(K, s, `go pikeman#${foot} @B3`);
    expect(t.links).toEqual([]);
    expect([t.board[cell(K, 'B3')], t.board[cell(K, 'B2')], t.pieces[foot].ready]).toEqual([foot, -1, false]);
    expect(names(K, t).some((n) => n.startsWith(`go pikeman#${foot}`))).toBe(false);
  });

  it('an attack goes on the chain: blows struck together; the attacker takes the cell of a defender that dies', () => {
    const { K, S } = at(fieldDuel());
    const { s, ids: [lancer] } = field(K, S, { on: [[0, 'lancer', 'C2'], [1, 'pikeman', 'C3']] });
    let t = named(K, s, `attack lancer#${lancer} @C3`);
    expect(t.zones[1].field).toEqual([]);
    expect(t.pieces[lancer]).toMatchObject({ at: cell(K, 'C3'), damage: 1 });
    expect(t.board[cell(K, 'C2')]).toBe(-1);
    // both survive: each stays where it stood
    const { s: s2, ids: [pike, wall] } = field(K, S, { on: [[0, 'pikeman', 'C2'], [1, 'sentinel', 'C3']] });
    t = named(K, s2, `attack pikeman#${pike} @C3`);
    expect([t.pieces[pike].at, t.pieces[wall].at, t.pieces[wall].damage]).toEqual([cell(K, 'C2'), cell(K, 'C3'), 1]);
  });

  it('the defender may answer an attack: the attacker bolted first strikes nothing', () => {
    const { K, S } = at(fieldDuel());
    const { s, ids: [rider, foe] } = field(K, S, { hands: [[], ['bolt']], on: [[0, 'outrider', 'B1'], [1, 'pikeman', 'C3']] });
    let t = named(K, s, `attack outrider#${rider} @C3`);
    expect(t.side).toBe(1);
    t = named(K, t, `cast bolt @outrider#${rider}`);
    expect(t.zones[0].field).toEqual([]);
    expect(t.board[cell(K, 'B1')]).toBe(-1);
    expect(t.pieces[foe].damage).toBeUndefined();
  });

  it('a summon strikes the foe only from the far row', () => {
    const { K, S } = at(fieldDuel());
    const { s, ids: [near, far] } = field(K, S, { on: [[0, 'pikeman', 'A4'], [0, 'pikeman', 'E5']] });
    expect(names(K, s)).not.toContain(`use pikeman#${near}`);
    expect(names(K, s)).toContain(`use pikeman#${far}`);
    expect(named(K, s, `use pikeman#${far}`).pools[1].life).toBe(9);
  });

  it('the computer beats a player choosing at random on the board, the same seed the same game', () => {
    const run = () => {
      const { K, S } = at(fieldDuel({ seed: 2 }));
      let s = S, n = 0, x = 7;
      const line = [];
      while (!s.over && n < 4000) {
        const L = T.legal(K, s);
        x = (x * 1103515245 + 12345) % 2147483648;
        const m = s.side === 1 ? M.think(K, s, { ...M.LEVELS.fair, seed: n }).move : L[Math.floor((x / 2147483648) * L.length)];
        line.push(m.name);
        s = T.apply(K, s, m);
        n += 1;
      }
      return { over: s.over, line };
    };
    const a = run();
    expect(a.over.winner).toBe(1);
    expect(run().line).toEqual(a.line);
  });
});

describe('deck building on the turn engine', () => {
  // one turn scripted in each engine from the same hand and the same deck order: play everything, buy the dearest
  // card the coins reach, end
  const scripted = (engine) => {
    const hand = ['draw-one-act-two', 'coin2', 'coin1', 'coin1', 'acre1'], deck = ['coin1', 'acre1', 'coin1', 'coin2', 'coin3', 'coin1'];
    const card = engine === 'card';
    const { K, S } = at(card ? deckGame() : deckTurns());
    const s = clone(S), Z = s.zones[0];
    const mk = (kind, zone) => { s.pieces.push({ kind, side: 0, at: -1, moved: 0, zone }); return s.pieces.length - 1; };
    for (const id of Z.hand.concat(Z.deck)) s.pieces[id].zone = 'gone';
    Z.hand = hand.map((k) => mk(k, 'hand'));
    Z.deck = deck.map((k) => mk(k, 'deck'));
    let t = s, m;
    const play = (x) => x.type === (card ? 'play' : 'cast');
    while ((m = T.legal(K, t).find(play))) t = T.apply(K, t, m);
    const coins = card ? t.act.coins : t.pools[0].coin;
    const buys = T.legal(K, t).filter((x) => x.type === 'buy' && x.card);
    const price = (k) => (card ? K.defs[k].cost || 0 : K.defs[k].price.coin);
    const best = buys.sort((a, b) => price(b.card) - price(a.card) || (a.card < b.card ? -1 : 1))[0];
    t = T.apply(K, t, best);
    t = T.apply(K, t, T.legal(K, t).find((x) => x.type === 'end'));
    return { coins, bought: best.card, discard: kinds(t, t.zones[0].discard).sort(), hand: t.zones[0].hand.length };
  };

  it('a scripted turn comes out the same in both engines: coins, the buy, the discard, the next hand', () => {
    const a = scripted('card'), b = scripted('turns');
    expect(b).toEqual(a);
    expect(a.coins).toBe(5);
  });

  it('the discard becomes the deck when it runs out; owned cards score; an emptied pile ends it', () => {
    const { K, S } = at(deckTurns());
    let s = clone(S);
    const Z = s.zones[0];
    for (const id of Z.deck) { s.pieces[id].zone = 'discard'; Z.discard.push(id); }
    Z.deck = [];
    s = named(K, s, 'end');
    expect(s.zones[0].hand).toHaveLength(5);
    expect(s.zones[0].deck.length + s.zones[0].hand.length + s.zones[0].discard.length).toBe(10);
    expect(T.roundScores(K, s, false)).toEqual([3, 3]);
    const last = clone(S);
    last.supply.acre6 = 1;
    last.pools[0].coin = 8;
    const over = named(K, named(K, last, 'buy acre6'), 'end');
    expect(over.over).toMatchObject({ winner: 0, reason: 'score', scores: [3 + 6, 3] });
  });

  it('the computer beats a player choosing at random', () => {
    const { K, S } = at(deckTurns({ seed: 2 }));
    let s = S, n = 0, x = 7;
    while (!s.over && n < 6000) {
      const L = T.legal(K, s);
      x = (x * 1103515245 + 12345) % 2147483648;
      s = T.apply(K, s, s.side === 1 ? M.think(K, s, { ...M.LEVELS.fair, seed: n }).move : L[Math.floor((x / 2147483648) * L.length)]);
      n += 1;
    }
    expect(s.over.winner).toBe(1);
  });

  it('the pages carry both', () => {
    for (const G of [fieldDuel(), deckTurns()]) {
      const html = tabletopPageHtml(G);
      expect(html).toContain('function tabletopRoundClient(D, T, M, TV)');
      expect(tabletopPageHtml(G)).toBe(html);
    }
  });
});
