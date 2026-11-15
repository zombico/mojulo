/**
 * THE LOADOUT — what the hero CARRIES of the game's weapons (arsenal.js: the arsenal is what the game has). The weapons
 * the cycle steps through in play, in slot order, and the sidearm; chosen at points in the game, never all of the kit
 * at once. A stylish action game carries two melee weapons and switches between them.
 *
 *   gameworld.loadout: { slots?: { melee? }, start?: { melee?: ['<weapon id>', …], sidearm?: '<id>' | false } }
 *     slots.melee   how many melee weapons are carried at once (LOADOUT_SLOTS.melee, two, unsaid)
 *     start.melee   the ones carried from the start, in the order the cycle steps (the arsenal's first `slots.melee`
 *                   unsaid); start.sidearm: the one on S (the arsenal's own unsaid), or false: none carried
 *   A world that writes none carries every weapon of its arsenal, as it always did: not a byte changes.
 *
 *   readLoadout(v, arsenal?)  → v, checked (throws, teaching); with the arsenal, its weapons' ids are checked
 *   carriedOf(G, arsenal, picked?) → the arsenal as carried: its `weapons` the carried ones in slot order, its `ranged`
 *                              the carried sidearm; `picked`: { melee?, sidearm? } a choice made in play (a turn's pick)
 *                              over the start; the arsenal itself where the world writes no loadout and nothing is picked
 *   loadoutOf(G, arsenal)     → { slots, melee: [ids], sidearm: id | null, options: { melee: [{ id, name }], sidearm } }
 *                              what is carried and what there is to choose from, or null (no loadout written)
 *
 * Pure.
 */
export const LOADOUT_SLOTS = Object.freeze({ melee: 2 });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`gameworld: loadout${m}`); };

export function readLoadout(v, arsenal = null) {
  if (!isObj(v)) no(' is { slots?: { melee }, start?: { melee: [weapon ids], sidearm? } }: what the hero carries of the arsenal');
  for (const k of Object.keys(v)) if (!['slots', 'start'].includes(k)) no(` has no '${k}' (slots, start)`);
  const n = v.slots?.melee ?? LOADOUT_SLOTS.melee;
  if (v.slots !== undefined && (!isObj(v.slots) || Object.keys(v.slots).some((k) => k !== 'melee') || !(Number.isInteger(n) && n >= 1 && n <= 4))) no('.slots is { melee: 1 to 4 }: how many melee weapons are carried at once');
  const ids = arsenal ? arsenal.weapons.map((W) => W.id) : null, sides = arsenal ? (arsenal.ranged ?? []).map((R) => R.id) : null;
  if (v.start !== undefined) {
    if (!isObj(v.start)) no('.start is { melee?: [weapon ids], sidearm? }');
    for (const k of Object.keys(v.start)) if (!['melee', 'sidearm'].includes(k)) no(`.start has no '${k}' (melee, sidearm)`);
    const M = v.start.melee;
    if (M !== undefined) {
      if (!Array.isArray(M) || !M.length || M.some((id) => typeof id !== 'string' || !id) || new Set(M).size !== M.length) no('.start.melee is the weapons carried from the start, each once, in the order the cycle steps');
      if (M.length > n) no(`.start.melee names ${M.length} weapons for ${n} slot${n === 1 ? '' : 's'}`);
      if (ids) for (const id of M) if (!ids.includes(id)) no(`.start.melee: '${id}' is no weapon of the arsenal (${ids.join(', ')})`);
    }
    const S = v.start.sidearm;
    if (S !== undefined && S !== false && (typeof S !== 'string' || (sides && !sides.includes(S)))) no(`.start.sidearm is a sidearm of the arsenal${sides ? ` (${sides.join(', ') || 'it has none'})` : ''}, or false: none carried`);
  }
  return v;
}

export function loadoutOf(G, arsenal) {
  if (!isObj(G?.loadout) || !arsenal) return null;
  const L = G.loadout, n = L.slots?.melee ?? LOADOUT_SLOTS.melee, ids = arsenal.weapons.map((W) => W.id), sides = arsenal.ranged ?? [];
  const melee = (L.start?.melee ?? ids.slice(0, n)).filter((id) => ids.includes(id));
  const sidearm = L.start?.sidearm === false ? null : L.start?.sidearm ?? sides[0]?.id ?? null;
  return { slots: { melee: n }, melee, sidearm, options: { melee: arsenal.weapons.map((W) => ({ id: W.id, name: W.name ?? W.id })), sidearm: sides.map((R) => ({ id: R.id, name: R.name ?? R.id })) } };
}

export function carriedOf(G, arsenal, picked = null) {
  const L = loadoutOf(G, arsenal);
  if (!L && !picked) return arsenal;
  const n = L?.slots.melee ?? LOADOUT_SLOTS.melee, ids = arsenal.weapons.map((W) => W.id);
  const asked = Array.isArray(picked?.melee) && picked.melee.length ? picked.melee : L ? L.melee : ids;
  const melee = [...new Set(asked)].filter((id) => ids.includes(id)).slice(0, n);
  const weapons = (melee.length ? melee : ids.slice(0, n)).map((id) => arsenal.weapons.find((W) => W.id === id));
  const side = picked?.sidearm !== undefined ? picked.sidearm : L ? L.sidearm : (arsenal.ranged ?? [])[0]?.id ?? null;
  const ranged = (arsenal.ranged ?? []).filter((R) => R.id === side);
  const { ranged: _r, ...rest } = arsenal;
  return { ...rest, weapons, ...(ranged.length ? { ranged } : {}) };
}
