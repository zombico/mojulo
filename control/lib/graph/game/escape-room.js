/**
 * THE ESCAPE ROOM (a terminal mechanic): a space you are held in, its way out sealed, until N locks are open. Each lock
 * is opened by a KEY (a thing lying in the room, carried to the lock) or by a STEP (a truth on the bus reaching a value:
 * a plate held, a foe down, a switch thrown). Walking into the sealed way out says so and, given `back`, puts the walker
 * back; once every lock is open the seal lifts, and the way out ends the level in success.
 *
 * Lowered onto the bus the other mechanics use (no runtime of its own): a zone and a marker per key and per lock, guarded
 * reactions chained one predicate at a time (as push's are), a watch per step lock and one for the seal, the exit's
 * zone. Its things are named from the recipe, so a handoff carries them by name:
 *   <room>-key-<lock>   a key's zone and its marker (taken: off)
 *   <room>-lock-<lock>  a lock's zone and its marker (opened: off)
 *   <room>-seal         the seal's marker on the way out (lifted: off)
 *   <room>-exit         the way out's zone
 *
 * Params:
 *   { id?: '<room>' ('room'),
 *     locks: [{ id?, at?, radius?, planar?, key?: { item?, at, radius?, planar? } | when?: { var, gte|gt|lte|lt|eq|ne } }],
 *     at, radius? | half?, planar?, via?, back?,          the way out, as reach-exit's (its zone, its waypoints)
 *     audit?: { kind: 'walkto', target, via? } }
 *   a lock is keyed (`key`: its key lies at `key.at`; the lock stands at `at`) or a step (`when`: it opens itself when
 *   the predicate holds, wherever the walker is). `back`: where a walker turned away at the seal is put.
 *
 * The audit: the walk to the way out by each key, then each lock, then its own `via` (keys reachable, then the
 * locks, then the way out). A step lock's producer cannot be known here (as win-when's): with one, only a hand-named
 * `audit` makes the level auto-auditable.
 *
 *   ESCAPE_EVENTS            the events it surfaces, for the sound table and the card
 *   escapeNames(room)        → { key(lock), lock(lock), seal, exit }   the names it gives its things
 *   lowerEscapeRoom(p, ctx)  → { world, on, emits, audit? }            (game/mechanics.js registers it)
 *
 * Pure, no dice.
 */

const ROOM = /^[a-z][a-z0-9-]{0,31}$/;
const LOCK = /^[a-z0-9][a-z0-9-]{0,15}$/;
const CMP = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne'];
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

export const ESCAPE_EVENTS = Object.freeze({
  key: 'key:<item>: a key taken',
  locked: 'lock:locked: a lock tried without its key',
  opened: 'lock:opened: a lock opens (its lock and room on the event)',
  open: 'escape:open:<room>: every lock is open, the seal lifts',
  sealed: 'escape:sealed:<room>: the way out tried while it is sealed',
  out: 'escape:out:<room>: out of the room (the level won)',
});

/** The names an escape room gives its things (zones and markers alike), from its room's id and its locks' ids. */
export const escapeNames = (room) => ({ key: (l) => `${room}-key-${l}`, lock: (l) => `${room}-lock-${l}`, seal: `${room}-seal`, exit: `${room}-exit` });

const xy = (p) => [p[0], p[1]];

export function lowerEscapeRoom(p, ctx) {
  const where = `escape-room[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const room = p.id === undefined ? 'room' : p.id;
  if (typeof room !== 'string' || !ROOM.test(room)) fail('id is the room\'s name, lower-case (letters, digits, hyphens)');
  const locks = Array.isArray(p.locks) ? p.locks : [];
  if (!locks.length || locks.length > 8) fail('needs locks: [{ at, key: { at, item? } } | { when: { var, gte } }], one to eight');
  const E = p;
  if (!isVec(E.at)) fail('needs at: [x, y, z] (radius?, via?, back?): the way out it seals');
  if (E.back !== undefined && !isVec(E.back)) fail('back is [x, y, z]: where a walker turned away at the seal stands');
  const N = escapeNames(room), open = `__er_${room}_open`, n = locks.length;
  const world = { vars: { [open]: 0 }, entities: [], sources: [], reactions: [], watches: [], hud: [] };
  const zone = (id, at, radius, planar) => world.sources.push({ type: 'zone', zone: id, at, radius, planar, watch: ctx.player });
  const ids = new Set(), walk = { keys: [], locks: [] };
  let steps = 0;
  locks.forEach((L, k) => {
    const at = `locks[${k}]`;
    if (!L || typeof L !== 'object') fail(`${at} is { at, key } or { when }`);
    const id = L.id === undefined ? String(k + 1) : L.id;
    if (typeof id !== 'string' || !LOCK.test(id)) fail(`${at}.id is a short lower-case name`);
    if (ids.has(id)) fail(`${at}.id '${id}' names two locks`);
    ids.add(id);
    if ((L.key === undefined) === (L.when === undefined)) fail(`${at} is opened by a key ({ key: { at } }) or by a step ({ when: { var, gte } }), one of them`);
    const flag = `__er_${room}_${id}`, tryT = `__er_${room}_${id}:try`, openT = `__er_${room}_${id}:open`;
    world.vars[flag] = 0;
    if (L.key !== undefined) {
      const K = L.key;
      if (!K || !isVec(K.at)) fail(`${at}.key is { at: [x, y, z], item?, radius? }: where its key lies`);
      if (!isVec(L.at)) fail(`${at}.at is [x, y, z]: where a keyed lock stands`);
      const item = K.item === undefined ? 'key' : K.item;
      if (typeof item !== 'string' || !/^[a-z][a-z-]{0,23}$/.test(item)) fail(`${at}.key.item is one lower-case word (a key, a rune-key, a keycard)`);
      const held = `__er_${room}_${id}_key`, kz = N.key(id), lz = N.lock(id), takeT = `__er_${room}_${id}:take`;
      world.vars[held] = 0;
      // the key: taken once (its marker off, the key held), whoever walks over it again
      world.entities.push({ id: kz, type: 'key', on: true, position: K.at.slice(), radius: 0.35, color: '#e8c35a' });
      zone(kz, K.at.slice(), Number.isFinite(K.radius) ? K.radius : 1.4, K.planar !== false);
      world.reactions.push(
        { on: 'enter', match: { zone: kz }, if: { var: held, eq: 0 }, do: 'emit', type: takeT },
        { on: takeT, do: 'set', var: held, to: 1 },
        { on: takeT, do: 'toggle', target: kz, to: false },
        { on: takeT, do: 'emit', type: `key:${item}`, room, lock: id },
      );
      // the lock: tried with its key held, opened once; tried without, it says so
      world.entities.push({ id: lz, type: 'lock', on: true, position: L.at.slice(), radius: 0.45, color: '#b8322a' });
      zone(lz, L.at.slice(), Number.isFinite(L.radius) ? L.radius : 1.6, L.planar !== false);
      world.reactions.push(
        { on: 'enter', match: { zone: lz }, if: { var: held, gte: 1 }, do: 'emit', type: tryT },
        { on: 'enter', match: { zone: lz }, if: { var: held, lt: 1 }, do: 'emit', type: 'lock:locked', room, lock: id },
      );
      walk.keys.push(xy(K.at)); walk.locks.push(xy(L.at));
    } else {
      const w = L.when;
      if (!w || typeof w !== 'object' || typeof w.var !== 'string' || !CMP.some((c) => w[c] !== undefined)) fail(`${at}.when is { var: '<name>', ${CMP.join('|')}: <n> }: the step that opens it`);
      // a step: its predicate's edge tries the lock (the try guards a second edge)
      world.watches.push({ type: tryT, when: { ...w } });
      if (isVec(L.at)) world.entities.push({ id: N.lock(id), type: 'lock', on: true, position: L.at.slice(), radius: 0.45, color: '#b8322a' });
      steps++;
    }
    world.reactions.push(
      { on: tryT, if: { var: flag, eq: 0 }, do: 'emit', type: openT },
      { on: openT, do: 'set', var: flag, to: 1 },
      { on: openT, do: 'inc', var: open, by: 1 },
      { on: openT, do: 'toggle', target: N.lock(id), to: false },
      { on: openT, do: 'emit', type: 'lock:opened', room, lock: id },
    );
  });
  // the seal: lifted when every lock is open
  const openE = `escape:open:${room}`, outE = `escape:out:${room}`, sealedE = `escape:sealed:${room}`;
  world.entities.push({ id: N.seal, type: 'seal', on: true, position: E.at.slice(), radius: 0.9, color: '#7a1f1a' });
  world.watches.push({ type: openE, when: { var: open, gte: n } });
  world.reactions.push({ on: openE, do: 'toggle', target: N.seal, to: false });
  // the way out: through it once every lock is open; sealed, turned away (put back, given where)
  const shape = Array.isArray(E.half) ? { half: E.half } : { radius: Number.isFinite(E.radius) ? E.radius : 2 };
  world.sources.push({ type: 'zone', zone: N.exit, at: E.at.slice(), ...shape, planar: E.planar !== false, watch: ctx.player });
  world.reactions.push(
    { on: 'enter', match: { zone: N.exit }, if: { var: open, gte: n }, do: 'emit', type: outE },
    { on: 'enter', match: { zone: N.exit }, if: { var: open, lt: n }, do: 'emit', type: sealedE },
    ...(E.back ? [{ on: sealedE, do: 'move', target: ctx.player, to: E.back.slice() }] : []),
  );
  world.hud.push(
    { var: open, label: 'Locks', as: 'counter', max: n },
    { on: sealedE, text: 'sealed: open its locks', as: 'toast', ttl: 1.4 },
    { on: 'lock:locked', text: 'locked: find its key', as: 'toast', ttl: 1.2 },
    { on: 'lock:opened', text: 'a lock opens', as: 'toast', ttl: 1.2 },
    { on: openE, text: 'the way out is open', as: 'toast', ttl: 1.8 },
  );
  const out = { world, on: { [outE]: { end: 'success' } }, emits: ['lock:opened', openE] };
  if (p.audit !== undefined) {
    const a = p.audit;
    if (!(a && a.kind === 'walkto' && Array.isArray(a.target))) fail("audit is { kind: 'walkto', target: [x, y, z], via? }: a walk by its keys, then its locks, to the way out");
    out.audit = { ...a };
  } else if (!steps) {
    // keys reachable, then the locks, then the way out
    out.audit = { kind: 'walkto', target: E.at.slice(), via: [...walk.keys, ...walk.locks, ...(Array.isArray(E.via) ? E.via.map(xy) : [])] };
  }
  return out;
}
