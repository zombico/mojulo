// A level held as an escape room (escape.js; a level goal's `escape`). The laws: it reads and refuses like any level
// goal, read to its locks and its room (the level's id); on a trail stage and on a building stage it lays the escape-room
// mechanic in place of the exit, its keys where the audit's walk passes them before its locks, so the walk the audit takes
// wins and a walk straight to the way out is turned back; only the level's last stage is held; a walled-core dungeon's
// keys gate reads it; the book says what is locked and where its keys lie; and the prompt's word asks for it.
import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from './index.js';
import { gameStages, stageLevelOrder, gameStore } from './levels.js';
import { levelGoalMechanics } from './quick.js';
import { readEscapeGoal, escapeRoomOf } from './escape.js';
import { escapePage } from './escape-page.js';
import { esc } from './bible-html.js';
import { composeGameworld } from './compose.js';
import { withBuildingLevel } from '../structure/level.js';
import { composeMechanics } from '../game/mechanics.js';
import { compileMechanicAudit } from '../game/game-audit.js';
import { readWcd } from '../wcd/wcd.js';
import { buildBus } from '../worlds/event-bus.js';

const W = {
  ...MEADOWMARK, review: undefined, links: [],
  levels: {
    cell: { name: 'The cell', walk: { nodes: { trailhead: { trail: true } } }, goal: { escape: 2 } },
    inn: { name: 'The inn', building: { use: 'tavern', seed: 2 }, goal: { escape: true } },
  },
};
const G = readGameworld(W);
const B = buildBus();
const stage = (level) => gameStages(W).find((s) => s.level === level);
const made = (level) => {
  const st = stage(level), o = stageLevelOrder(G, st, { ref: `lv_${level}`, goal: (ends) => levelGoalMechanics(G.levels[level].goal, ends, { last: true }) });
  const m = o.args.manifest;
  return { ...o, game: (m.game ? m : withBuildingLevel(m, `lv_${level}`)).game };
};
// a walker along points (a step each 0.4 m), its zone facts played on the bus; `z`: the walker's height (an eye)
function walk(composed, points, z = 0) {
  const ev = composed.events, s = B.createBusState(ev, ev.entities), spots = [];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
    for (let k = 0; k <= n; k++) spots.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, z]);
  }
  let prev;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const at of spots) { const r = B.deriveZoneEvents([{ id: 'p', position: at }], prev, ev.sources); prev = r.prev; pump(r.events); }
  return s.log.map((r) => r.type);
}

describe('a level goal held as an escape room', () => {
  it('reads to its locks and its room, and refuses what it cannot be', () => {
    expect(G.levels.cell.goal.escape).toEqual({ locks: 2, room: 'cell' });
    expect(G.levels.inn.goal.escape).toEqual({ locks: 2, room: 'inn' });
    expect(readEscapeGoal(G.levels.cell.goal.escape, 'cell')).toEqual({ locks: 2, room: 'cell' });
    const withGoal = (goal) => ({ ...W, levels: { ...W.levels, cell: { ...W.levels.cell, goal } } });
    expect(() => readGameworld(withGoal({ escape: 5 }))).toThrow(/1 to 4/);
    expect(() => readGameworld(withGoal({ escape: 'yes' }))).toThrow(/goal.escape is true/);
    expect(() => readGameworld(withGoal({ escape: true, boss: true }))).toThrow(/one or the other/);
  });

  it('on a trail stage: the exit held by its locks, the keys on the beats; the audit\'s walk wins, a walk straight out is turned back', () => {
    const L = made('cell'), M = L.game.mechanics;
    expect(M.map((m) => m.kind)).not.toContain('reach-exit');
    const E = M.find((m) => m.kind === 'escape-room');
    expect(E.id).toBe('cell');
    expect(E.locks.map((l) => l.id)).toEqual(['1', '2']);
    expect(E.at).toEqual(L.ends.exit);
    // it composes against the game's own store, one success terminal
    const c = composeMechanics(M, { storeSchema: gameStore(W, null), player: 'p', fall: 'none' });
    expect(c.on['escape:out:cell']).toEqual({ end: 'success' });
    // the audit: the keys, then the locks, then the way out
    const plan = compileMechanicAudit(c).plan;
    expect(plan.waypoints).toEqual([...E.locks.map((l) => l.key.at.slice(0, 2)), ...E.locks.map((l) => l.at.slice(0, 2)), E.at.slice(0, 2)]);
    const won = walk(c, [L.ends.spawn, ...plan.waypoints]);
    expect(won).toContain('escape:out:cell');
    expect(won.filter((t) => t === 'lock:opened')).toHaveLength(2);
    const shut = walk(c, [L.ends.spawn, L.ends.exit]);
    expect(shut).toContain('escape:sealed:cell');
    expect(shut).not.toContain('escape:out:cell');
  });

  it('on a building stage: its keys on the route through its rooms, its locks at the goal room\'s door, the route the audit', () => {
    const L = made('inn'), M = L.game.mechanics, E = M.find((m) => m.kind === 'escape-room');
    expect(M.map((m) => m.kind)).not.toContain('reach-exit');
    expect(E.id).toBe('inn');
    expect(E).toMatchObject({ at: L.ends.exit, planar: false });
    expect(E.audit.via).toEqual(L.ends.via.map((p) => p.slice(0, 2)));
    const c = composeMechanics(M, { storeSchema: gameStore(W, null), player: 'p', fall: 'none' });
    const eye = L.ends.exit[2];
    // the route walked at the walker's eye passes the keys, then the locks, then reaches the goal
    const won = walk(c, [L.ends.spawn, ...compileMechanicAudit(c).plan.waypoints], eye);
    expect(won.filter((t) => t === 'key:key')).toHaveLength(E.locks.length);
    expect(won.indexOf('lock:opened')).toBeGreaterThan(won.lastIndexOf('key:key'));
    expect(won).toContain('escape:out:inn');
    // straight to the goal room's door, no keys: sealed
    const shut = walk(c, [E.back, L.ends.exit], eye);
    expect(shut).toContain('escape:sealed:inn');
    expect(shut).not.toContain('escape:out:inn');
  });

  it('holds the level\'s last stage only: a stage before it keeps its exit', () => {
    const ends = { spawn: [0, 0, 0], exit: [40, 0, 0], planar: true, beats: [{ beat: 'a', at: [10, 0, 0] }, { beat: 'b', at: [20, 0, 0] }] };
    expect(levelGoalMechanics({ escape: { locks: 2, room: 'x' } }, ends, { last: false }).map((m) => m.kind)).toEqual(['reach-exit']);
    expect(levelGoalMechanics({ escape: { locks: 2, room: 'x' } }, ends, { last: true }).map((m) => m.kind)).toEqual(['escape-room']);
    // as many locks as the way has beats for keys
    expect(escapeRoomOf({ locks: 4, room: 'x' }, ends).locks).toHaveLength(2);
  });
});

describe('the walled-core dungeon reads it', () => {
  const spec = { core: 'core', spaces: { cells: { kind: 'inner', depth: 0, level: 'cell' }, core: { kind: 'inner', depth: 1, level: 'inn' } }, doors: [{ from: 'cells', to: 'core', via: 'door', gate: { keys: true } }] };
  it('a door gated by keys: the keys found in the space it leaves, an escape room', () => {
    const R = readWcd(spec, { levels: ['cell', 'inn'], escapes: ['cell'] });
    expect(R.doors[0].gate).toEqual({ keys: true });
    expect(R.laws.find((l) => l.law === 'keys-inside')).toMatchObject({ holds: true });
    expect(R.laws.find((l) => l.law === 'gated').holds).toBe(true);
    expect(readWcd(spec, { levels: ['cell', 'inn'] }).laws.find((l) => l.law === 'keys-inside')).toMatchObject({ holds: false, says: expect.stringMatching(/no escape room/) });
    expect(() => readWcd({ ...spec, doors: [{ ...spec.doors[0], gate: { keys: 2 } }] })).toThrow(/keys is true/);
    // a dungeon with no keyed door holds it, saying so
    expect(readWcd({ ...spec, doors: [{ ...spec.doors[0], gate: { clearance: 2 } }] }).laws.find((l) => l.law === 'keys-inside')).toMatchObject({ holds: true, says: 'no door is opened by keys' });
    // in a world: its escape levels are what the gate is read by
    expect(readGameworld({ ...W, wcd: spec }).wcd.laws.find((l) => l.law === 'keys-inside').holds).toBe(true);
  });
});

describe('the book and the prompt', () => {
  it('the book says what is locked and where its keys lie; a world with none draws nothing', () => {
    const html = escapePage(readGameworld({ ...W, wcd: { core: 'core', spaces: { cells: { kind: 'inner', depth: 0, level: 'cell' }, core: { kind: 'inner', depth: 1, level: 'inn' } }, doors: [{ from: 'cells', to: 'core', via: 'door', gate: { keys: true } }] } }), esc);
    expect(html).toMatch(/The escape rooms/);
    expect(html).toMatch(/The cell/);
    expect(html).toMatch(/cell-key-1 → cell-lock-1/);
    expect(html).toMatch(/along the trail's beats/);
    expect(html).toMatch(/tavern's rooms/);
    expect(html).toMatch(/door cells → core/);
    expect(escapePage(readGameworld(MEADOWMARK), esc)).toBe('');
  });

  it('the prompt\'s word holds every level the boss does not end', () => {
    const w = composeGameworld({ prompt: 'an escape room in a haunted forest with a boss', seed: 1 });
    const ids = Object.keys(w.levels);
    expect(w.brief.read.find((r) => r.word === 'escape').decides).toEqual(['goal.escape']);
    for (const id of ids) expect(w.levels[id].goal).toEqual(id === ids.at(-1) ? { boss: true } : { escape: true });
    expect(() => readGameworld(w)).not.toThrow();
  });
});
