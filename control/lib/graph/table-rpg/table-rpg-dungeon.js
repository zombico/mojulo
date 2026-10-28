/**
 * THE TABLE RPG'S DUNGEONS — a dungeon as a graph of rooms and links (table-rpg-kernel.js), read for whether it plays:
 * which rooms the party can reach and in what order its keys open them, a key shut behind its own lock, a lock with no
 * key and no force, the goal out of reach, a room with no way back, and the shape (its loops, its dead ends). Findings
 * advise, as every mojulo gate does; `ok` is false only when a room or the goal cannot be reached.
 * A dungeon drawn from a building's program is table-rpg-program.js's.
 *
 *   checkDungeon(dungeon, { items?, goal? }) → { ok, reach: [room ids in the order reached], keys: [item ids in the
 *     order found], loops, deadEnds: [room ids], findings: [{ level: 'error' | 'advice', text }] }
 *     goal: a room id (the module's goal room, or the room holding its goal item)
 */

const PASS = new Set(['open', 'door', 'stair', 'secret']);
const words = (s) => String(s).replace(/[-_]/g, ' ');

/** The rooms reached from the entry with the keys found on the way, a link left out when `without` names it. */
function reachOf(d, keyRooms, without = null) {
  const reached = [d.entry], seen = new Set(reached), keys = [], held = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const r of [...seen]) for (const k of keyRooms.get(r) ?? []) if (!held.has(k)) { held.add(k); keys.push(k); changed = true; }
    for (const l of d.links ?? []) {
      if (l === without) continue;
      const kind = l.kind ?? 'open';
      const can = PASS.has(kind) || (kind === 'locked' && ((l.key !== undefined && held.has(l.key)) || l.force !== undefined));
      if (!can) continue;
      for (const [x, y] of l.oneWay ? [[l.a, l.b]] : [[l.a, l.b], [l.b, l.a]]) {
        if (seen.has(x) && !seen.has(y)) { seen.add(y); reached.push(y); changed = true; }
      }
    }
  }
  return { reached, seen, keys };
}

export function checkDungeon(d, { items = {}, goal } = {}) {
  const findings = [];
  const rooms = (d.rooms ?? []).map((r) => r.id);
  const keyRooms = new Map();
  for (const r of d.rooms ?? []) for (const x of r.items ?? []) {
    const id = typeof x === 'string' ? x : x.item;
    if (items[id]?.kind === 'key' || (d.links ?? []).some((l) => l.key === id)) keyRooms.set(r.id, [...(keyRooms.get(r.id) ?? []), id]);
  }
  const { reached, seen, keys } = reachOf(d, keyRooms);
  for (const r of rooms) if (!seen.has(r)) findings.push({ level: 'error', text: `${words(r)} cannot be reached from ${words(d.entry)}` });
  const placed = new Set([...keyRooms.values()].flat());
  for (const l of d.links ?? []) {
    if ((l.kind ?? 'open') !== 'locked') continue;
    if (l.key !== undefined && !placed.has(l.key)) findings.push({ level: l.force === undefined ? 'error' : 'advice', text: `the lock between ${words(l.a)} and ${words(l.b)} wants ${words(l.key)}, which lies in no room${l.force !== undefined ? ' (it can be forced)' : ''}` });
    if (l.key !== undefined && placed.has(l.key) && l.force === undefined) {
      const at = [...keyRooms].find(([, ks]) => ks.includes(l.key))[0];
      const without = reachOf(d, keyRooms, l);
      if (!without.seen.has(at)) findings.push({ level: 'error', text: `${words(l.key)} lies behind the lock it opens (in ${words(at)})` });
    }
  }
  if (goal !== undefined && !seen.has(goal)) findings.push({ level: 'error', text: `the goal, ${words(goal)}, cannot be reached` });
  // a room the party walks into and cannot walk back from (a one-way link with no way round)
  const back = (from) => { const t = { ...d, entry: from }; return reachOf(t, new Map([...keyRooms].map(([r, k]) => [r, k])), null).seen.has(d.entry); };
  for (const r of reached) if (r !== d.entry && !back(r)) findings.push({ level: 'advice', text: `from ${words(r)} there is no way back to ${words(d.entry)}` });
  // the shape: loops are links beyond a spanning tree (one graph), dead ends rooms of one way
  const E = (d.links ?? []).length, V = rooms.length;
  const loops = Math.max(0, E - V + 1);
  const degree = Object.fromEntries(rooms.map((r) => [r, 0]));
  for (const l of d.links ?? []) { degree[l.a] += 1; degree[l.b] += 1; }
  const deadEnds = rooms.filter((r) => r !== d.entry && degree[r] === 1);
  if (!loops && V > 3) findings.push({ level: 'advice', text: 'a line of rooms with no loop: one more way round (a stair, a hidden way) gives the party a choice and a retreat' });
  if (!(d.links ?? []).some((l) => l.kind === 'secret') && V > 5) findings.push({ level: 'advice', text: 'nothing hidden: a secret way rewards a search' });
  return { ok: !findings.some((f) => f.level === 'error'), reach: reached, keys, loops, deadEnds, findings };
}
