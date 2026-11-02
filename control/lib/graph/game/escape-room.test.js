// The escape room (escape-room.js): a space held sealed until its locks open, lowered onto the bus. The laws: it lowers
// to the verbs the other mechanics use, under names derived from its recipe; played through its zones, the way out is
// sealed (and turns the walker back) until every lock is open, a key held opens its lock and a lock tried without its
// key holds; a step lock opens on its predicate; the audit walks the keys, then the locks, then the way out, and a step
// lock with no hand-named audit leaves it unaudited; a malformed recipe says what is wrong.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { escapeNames } from './escape-room.js';
import { compileMechanicAudit } from './game-audit.js';
import { decorateMechanics } from './mechanic-decor.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const CELL = {
  kind: 'escape-room', id: 'cell',
  locks: [{ id: 'red', at: [12, 0, 0], key: { item: 'red-key', at: [4, 3, 0] } }, { id: 'blue', at: [13, 0, 0], key: { item: 'blue-key', at: [6, -3, 0] } }],
  at: [16, 0, 0], back: [10, 0, 0],
};
const ctx = { player: 'hero', spawn: [0, 0, 0], fall: 'none' };

// a walker at each spot in turn, a few frames each: the zone facts, the reactions, the watches, the warps it is given
function walk(composed, spots) {
  const ev = composed.events, s = B.createBusState(ev, ev.entities);
  let prev, warps = [];
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const at of spots) {
    for (let f = 0; f < 3; f++) {
      const z = B.deriveZoneEvents([{ id: 'hero', position: at }], prev, ev.sources);
      prev = z.prev;
      pump(z.events);
      if (s._ctrlWarps) { warps.push(s._ctrlWarps.hero); s._ctrlWarps = null; }
    }
  }
  return { s, warps, log: s.log.map((r) => r.type), on: (id) => s.byId[id]?.on };
}

describe('an escape room on the bus', () => {
  it('lowers to zones, guarded reactions and watches, its things named from its recipe', () => {
    const c = composeMechanics([CELL], ctx), N = escapeNames('cell');
    expect(c.on).toEqual({ 'escape:out:cell': { end: 'success' } });
    expect(c.events.entities.map((e) => e.id)).toEqual([N.key('red'), N.lock('red'), N.key('blue'), N.lock('blue'), N.seal]);
    expect(c.events.sources.map((z) => z.zone)).toEqual(['cell-key-red', 'cell-lock-red', 'cell-key-blue', 'cell-lock-blue', 'cell-exit']);
    // only the bus's own verbs, each guard one predicate
    expect([...new Set(c.events.reactions.map((r) => r.do))].sort()).toEqual(['emit', 'inc', 'move', 'set', 'toggle']);
    expect(c.events.reactions.every((r) => !r.if || typeof r.if.var === 'string')).toBe(true);
    // the same recipe, the same lowering
    expect(composeMechanics([CELL], ctx)).toEqual(c);
  });

  it('holds the way out sealed until every lock is open, then lets the walker out', () => {
    const c = composeMechanics([CELL], ctx);
    // straight to the way out: sealed, and put back
    const shut = walk(c, [[0, 0, 0], [16, 0, 0]]);
    expect(shut.log).toContain('escape:sealed:cell');
    expect(shut.log).not.toContain('escape:out:cell');
    expect(shut.warps).toEqual([[10, 0, 0]]);
    expect(shut.on('cell-seal')).toBe(true);
    // a lock tried without its key holds
    const bare = walk(c, [[12, 0, 0]]);
    expect(bare.log).toContain('lock:locked');
    expect(bare.s.vars.__er_cell_open).toBe(0);
    // one key, its lock: one of two open, still sealed
    const half = walk(c, [[4, 3, 0], [12, 0, 0], [16, 0, 0]]);
    expect(half.s.vars.__er_cell_open).toBe(1);
    expect(half.on('cell-key-red')).toBe(false);
    expect(half.on('cell-lock-red')).toBe(false);
    expect(half.log).toContain('escape:sealed:cell');
    // both keys, both locks (walked twice: a lock opens once), then out
    const won = walk(c, [[4, 3, 0], [6, -3, 0], [12, 0, 0], [13, 0, 0], [12, 0, 0], [16, 0, 0]]);
    expect(won.s.vars.__er_cell_open).toBe(2);
    expect(won.log.filter((t) => t === 'lock:opened')).toHaveLength(2);
    expect(won.log).toContain('escape:open:cell');
    expect(won.on('cell-seal')).toBe(false);
    expect(won.log).toContain('escape:out:cell');
    expect(won.log).not.toContain('escape:sealed:cell');
  });

  it('opens a step lock on its predicate, wherever the walker is', () => {
    const room = { kind: 'escape-room', locks: [{ id: 'plates', when: { var: 'held', gte: 2 } }], at: [10, 0, 0] };
    const c = composeMechanics([room], ctx);
    const s = B.createBusState(c.events, c.events.entities);
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    s.vars.held = 1; pump([]);
    expect(s.vars.__er_room_open).toBe(0);
    s.vars.held = 2; pump([]);
    expect(s.vars.__er_room_open).toBe(1);
    // a second edge opens nothing twice
    s.vars.held = 0; pump([]); s.vars.held = 3; pump([]);
    expect(s.vars.__er_room_open).toBe(1);
    expect(s.log.map((r) => r.type)).toContain('escape:open:room');
  });

  it('is audited by a walk to its keys, then its locks, then the way out; a step lock leaves it to a hand-named audit', () => {
    const c = composeMechanics([{ ...CELL, via: [[14, 1]] }], ctx);
    expect(c.audits).toEqual([{ mechanic: 'escape-room', kind: 'walkto', target: [16, 0, 0], via: [[4, 3], [6, -3], [12, 0], [13, 0], [14, 1]] }]);
    expect(compileMechanicAudit(c).plan.waypoints).toEqual([[4, 3], [6, -3], [12, 0], [13, 0], [14, 1], [16, 0]]);
    // that walk, played, wins
    const won = walk(c, compileMechanicAudit(c).plan.waypoints.map(([x, y]) => [x, y, 0]));
    expect(won.log).toContain('escape:out:cell');
    const step = { kind: 'escape-room', locks: [{ when: { var: 'held', gte: 1 } }], at: [10, 0, 0] };
    expect(composeMechanics([step], ctx).audits).toEqual([]);
    expect(composeMechanics([{ ...step, audit: { kind: 'walkto', target: [10, 0, 0] } }], ctx).audits).toHaveLength(1);
  });

  it('is decorated: a glyph for each key, its marker hidden; the locks and seal keep theirs', () => {
    const d = decorateMechanics([CELL]);
    expect(d.suppress).toEqual(['cell-key-red', 'cell-key-blue']);
    expect(d.entities.filter((e) => e.body.form === 'key')).toHaveLength(2);
    expect(d.fx.on['cell-key-red']).toEqual({ gesture: 'burst', target: 'dec_cell-key-red' });
  });

  it('says what is wrong with a malformed room', () => {
    const bad = (m, re) => expect(() => composeMechanics([{ ...CELL, ...m }], ctx)).toThrow(re);
    bad({ locks: [] }, /needs locks/);
    bad({ at: undefined }, /needs at/);
    bad({ id: 'Cell' }, /id is the room's name/);
    bad({ locks: [{ at: [1, 0, 0] }] }, /a key .* or by a step/);
    bad({ locks: [{ at: [1, 0, 0], key: { at: [0, 0, 0] } }, { at: [2, 0, 0], key: { at: [0, 0, 0] } }].map((l) => ({ ...l, id: 'a' })) }, /names two locks/);
    bad({ locks: [{ key: { at: [0, 0, 0] } }] }, /where a keyed lock stands/);
    bad({ locks: [{ when: { var: 'x' } }] }, /when is/);
  });
});
