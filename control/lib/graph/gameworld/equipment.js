/**
 * EQUIPMENT — the game book's gear, a concern of the world beside its ground and its characters: one row per base CLASS
 * of gear that can be equipped (the equipment kernel's held items). What the hero's adornment page conceived (an item
 * because a power needs it, and its tiers) is the TEMPLATE of its class; the classes nothing has conceived yet are
 * left empty, a table the creator fills in later. Equipment matters once the game's stats exist (`mechanics`, the
 * systems step), so its orders wait for them: until then the table is a design, not a mint list.
 *
 *   equipment?: {
 *     classes?: { <class>: { build, slot?, tiers? } | null },   // a class is an EQUIPMENT_ITEMS word; null: left empty
 *   }
 *
 * Each row resolves as one of:
 *   authored   the world's own row (its build names its class)
 *   seeded     the first hero adornment item of the class: its build, slot and tiers (`from`), later ones in `also`
 *   empty      a task for the creator
 * An authored row, or a null, over an item that would have seeded it is ledgered.
 *
 * Pure. `readEquipment` reads the shape (the world reader calls it); `resolveEquipment(G)` makes the table of a read
 * world; `equipmentOrders(G, ready)` the mints, once the step is ready (character-review.js `characterReady`).
 */
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { GEAR_SLOTS } from '../polygonizer/hero-gear.js';
import { readGearBuild } from './adornment.js';

/** Where each class is carried unless its row says: the first hand it takes (adornment-kit.js prefers the same). */
export const CLASS_SLOTS = Object.freeze({ dagger: 'right', sword: 'right', greatsword: 'right', staff: 'right', bow: 'left', shield: 'left' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`equipment: ${m}`);

/** Read a world's equipment and say what is wrong; every build is judged by the equipment kernel. → { classes } */
export function readEquipment(E) {
  if (!isObj(E)) throw fail('equipment is { classes }: a row per class of gear (' + EQUIPMENT_ITEMS.join(', ') + ')');
  for (const k of Object.keys(E)) if (k !== 'classes') throw fail(`${k} is not part of the equipment (classes)`);
  const C = E.classes ?? {};
  if (!isObj(C)) throw fail(`classes is { <class>: { build, slot?, tiers? } | null } (${EQUIPMENT_ITEMS.join(', ')})`);
  const classes = {};
  for (const [cls, row] of Object.entries(C)) {
    const at = `classes.${cls}`;
    if (!EQUIPMENT_ITEMS.includes(cls)) throw fail(`'${cls}' is not a class of gear (${EQUIPMENT_ITEMS.join(', ')})`);
    if (row === null) { classes[cls] = null; continue; }
    if (!isObj(row)) throw fail(`${at} is { build, slot?, tiers? }, or null to leave it empty`);
    for (const k of Object.keys(row)) if (!['build', 'slot', 'tiers'].includes(k)) throw fail(`${at}.${k} is not part of a class (build, slot, tiers)`);
    const slot = row.slot ?? CLASS_SLOTS[cls];
    if (!GEAR_SLOTS.includes(slot)) throw fail(`${at}.slot is ${GEAR_SLOTS.map((s) => `'${s}'`).join(', ')}`);
    const build = isObj(row.build) && row.build.item === undefined ? { item: cls, ...row.build } : row.build;
    const read = readGearBuild({ build, tiers: row.tiers }, slot, at, fail);
    if (read.build.item !== cls) throw fail(`${at}.build.item is '${read.build.item}': a row's build is its own class ('${cls}')`);
    classes[cls] = { build: read.build, slot, ...(read.tiers ? { tiers: read.tiers } : {}) };
  }
  return { classes };
}

/**
 * The table: `{ rows, ledger, tasks }`. `rows` one per class in EQUIPMENT_ITEMS order, `{ class, status, build?, slot?,
 * tiers?, from?, also? }`; `tasks` the empty classes, for the creator. A world with neither equipment nor an adornment
 * page has every row empty.
 */
export function resolveEquipment(G) {
  const own = G.equipment?.classes ?? {}, items = G.characters?.hero?.adornment?.items ?? [], ledger = [];
  const rows = EQUIPMENT_ITEMS.map((cls) => {
    const conceived = items.filter((it) => it.build.item === cls);
    const seed = conceived[0], also = conceived.slice(1).map((it) => `hero:${it.id}`);
    const mine = own[cls];
    if (mine) {
      if (seed) ledger.push({ scope: 'equipment', at: `equipment.classes.${cls}`, key: cls, world: `hero:${seed.id}`, local: 'authored' });
      return { class: cls, status: 'authored', ...mine };
    }
    if (seed && mine === null) ledger.push({ scope: 'equipment', at: `equipment.classes.${cls}`, key: cls, world: `hero:${seed.id}`, local: 'left empty' });
    if (seed && mine !== null) {
      return { class: cls, status: 'seeded', build: seed.build, slot: seed.slot, ...(seed.tiers ? { tiers: seed.tiers } : {}), from: `hero:${seed.id}`, ...(also.length ? { also } : {}) };
    }
    return { class: cls, status: 'empty' };
  });
  return { rows, ledger, tasks: rows.filter((r) => r.status === 'empty').map((r) => r.class) };
}

/**
 * The tool calls that realize the table, once the equipment step is ready (`ready`: characterReady's `equipment`):
 * one `mint_solid` of the equipment kind per filled class, at its template's build (its tiers ride on the row, for the
 * stats to scale). Until the step is ready, no mints: `waiting` says on what. → { waiting, mints }
 */
export function equipmentOrders(G, ready) {
  if (!ready?.ready) return { waiting: ready?.waiting ?? [], mints: [] };
  const mints = resolveEquipment(G).rows.filter((r) => r.build).map((r) => ({
    tool: 'mint_solid', part: 'equipment', class: r.class,
    args: { kind: 'equipment', title: `${G.name} · ${r.class}`, ...r.build },
  }));
  return { waiting: [], mints };
}
