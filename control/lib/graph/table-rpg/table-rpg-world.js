/**
 * THE TABLE RPG'S WORLD — a point-crawl: places (a town, the wild, a landmark, the mouth of a dungeon) and the roads
 * between them, each so many days with the table rolled on each day of it (table-rpg-kernel.js `world`). Read here for
 * whether it plays, and lowered to the EPOCH MAP's spec (board/board-map.js), so the same world is the hub a 3D game is
 * travelled from: a town a town, a dungeon a battle, the rest story stops.
 *
 *   checkWorld(world, { dungeons? }) → { ok, reach: [place ids from the start], findings: [{ level, text }] }
 *   toEpochMap(world) → { dots, roads, start }   board-map's readMapSpec takes it as it is
 */
const words = (s) => String(s).replace(/[-_]/g, ' ');
const DOT_KIND = { town: 'town', dungeon: 'battle', lair: 'battle', wild: 'story', landmark: 'story' };

export function checkWorld(world, { dungeons = {} } = {}) {
  const findings = [];
  const ids = new Set((world.places ?? []).map((p) => p.id));
  const adj = new Map([...ids].map((id) => [id, []]));
  for (const r of world.routes ?? []) { adj.get(r.a)?.push(r.b); adj.get(r.b)?.push(r.a); }
  const seen = new Set([world.start]), reach = [world.start];
  for (let i = 0; i < reach.length; i++) for (const n of adj.get(reach[i]) ?? []) if (!seen.has(n)) { seen.add(n); reach.push(n); }
  for (const p of world.places ?? []) {
    if (!seen.has(p.id)) findings.push({ level: 'error', text: `no road reaches ${p.name ?? words(p.id)} from ${words(world.start)}` });
    if (p.dungeon !== undefined && !dungeons[p.dungeon]) findings.push({ level: 'error', text: `${p.name ?? words(p.id)} opens on '${p.dungeon}', which is no dungeon` });
    if (p.kind === 'dungeon' && p.dungeon === undefined) findings.push({ level: 'advice', text: `${p.name ?? words(p.id)} is a dungeon with no dungeon written for it` });
  }
  for (const id of Object.keys(dungeons)) if (!(world.places ?? []).some((p) => p.dungeon === id)) findings.push({ level: 'advice', text: `the dungeon '${id}' opens from no place` });
  if (!(world.places ?? []).some((p) => p.kind === 'town')) findings.push({ level: 'advice', text: 'no town: a safe place to rest, buy and hear rumours anchors a world' });
  return { ok: !findings.some((f) => f.level === 'error'), reach, findings };
}

export function toEpochMap(world) {
  const dots = (world.places ?? []).map((p) => ({ id: p.id, name: p.name ?? words(p.id), kind: DOT_KIND[p.kind] ?? 'story' }));
  if (dots.length > 24) throw new Error(`table rpg: an epoch map holds 24 places; this world has ${dots.length}`);
  return { dots, roads: (world.routes ?? []).map((r) => [r.a, r.b]), start: world.start };
}
