/**
 * EQUIPMENT — the game book's gear, a concern of the world beside its ground and its characters: one row per base CLASS
 * of gear that can be equipped (the equipment kernel's held items). What the hero's adornment page conceived (an item
 * because a power needs it, and its tiers) is the TEMPLATE of its class; the classes nothing has conceived yet are
 * left empty, a table the creator fills in later. Equipment matters once the game's stats exist (`mechanics`, the
 * systems step), so its orders wait for them: until then the table is a design, not a mint list.
 *
 *   equipment?: {
 *     style?: <a style sample name or an inline card>,            // the world's gear language: every class wears it
 *     classes?: { <class>: { build, slot?, tiers? } | null },   // a class is an EQUIPMENT_ITEMS word; null: left empty
 *     populate?: true | { mirrors?, contrasts?, augment? },     // fill the starter gear from what the world says (world-gear.js)
 *   }
 *
 * Each row resolves as one of:
 *   authored   the world's own row (its build names its class)
 *   seeded     the first hero adornment item of the class: its build, slot and tiers (`from`), later ones in `also`
 *   empty      a task for the creator
 * An authored row, or a null, over an item that would have seeded it is ledgered. A row whose build names no style wears
 * the world's; a seeded template the style would break keeps its own build, and the row says why (`unstyled`).
 *
 * Pure. `readEquipment` reads the shape (the world reader calls it); `resolveEquipment(G)` makes the table of a read
 * world; `equipmentOrders(G, ready)` the mints, once the step is ready (character-review.js `characterReady`);
 * `equippedHero(G)` the composed hero holding the table's gear, a picture for the sheet.
 */
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { GEAR_SLOTS } from '../polygonizer/hero-gear.js';
import { readGearBuild, applyDiff, buildAt } from './adornment.js';
import { validateGear } from '../polygonizer/hero-gear.js';
import { composeHero } from './hero-looks.js';
import { STAGES } from './actions.js';

/** Where each class is carried unless its row says: the first hand it takes (adornment-kit.js prefers the same). */
export const CLASS_SLOTS = Object.freeze({ dagger: 'right', sword: 'right', greatsword: 'right', staff: 'right', bow: 'left', shield: 'left' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`equipment: ${m}`);

/** Read a world's equipment and say what is wrong; every build is judged by the equipment kernel. → { classes } */
export function readEquipment(E) {
  if (!isObj(E)) throw fail('equipment is { classes }: a row per class of gear (' + EQUIPMENT_ITEMS.join(', ') + ')');
  for (const k of Object.keys(E)) if (!['style', 'classes', 'populate'].includes(k)) throw fail(`${k} is not part of the equipment (style, classes, populate)`);
  // populate: fill the world's starter gear from what it says (world-gear.js): true, or which transforms to run
  if (E.populate !== undefined && E.populate !== true && !(isObj(E.populate) && Object.entries(E.populate).every(([k, v]) => ['mirrors', 'contrasts', 'augment'].includes(k) && typeof v === 'boolean'))) throw fail('populate is true, or { mirrors?, contrasts?, augment? } each true or false');
  const style = E.style;
  if (style !== undefined) {
    // the card is judged by the kernel on the plainest item that wears it
    const errs = validateGear({ right: { item: 'dagger', style } });
    if (errs.length) throw fail(`style: ${errs.join('; ')}`);
  }
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
    const named = isObj(row.build) && row.build.item === undefined ? { item: cls, ...row.build } : row.build;
    const build = style !== undefined && isObj(named) && named.style === undefined ? { ...named, style } : named;
    const read = readGearBuild({ build, tiers: row.tiers }, slot, at, fail);
    if (read.build.item !== cls) throw fail(`${at}.build.item is '${read.build.item}': a row's build is its own class ('${cls}')`);
    classes[cls] = { build: read.build, slot, ...(read.tiers ? { tiers: read.tiers } : {}) };
  }
  return { ...(style !== undefined ? { style } : {}), classes, ...(E.populate !== undefined ? { populate: E.populate } : {}) };
}

/** A seeded template in the world's style, or its own build with the reason the style would break it. */
function styled(seed, style) {
  if (style === undefined || seed.build.style !== undefined) return { build: seed.build };
  const build = { ...seed.build, style };
  let grown = build;
  for (const t of Object.values(seed.tiers ?? {})) {
    grown = applyDiff(grown, t);
    const errs = validateGear({ [seed.slot]: grown });
    if (errs.length) return { build: seed.build, unstyled: errs.join('; ') };
  }
  const errs = validateGear({ [seed.slot]: build });
  return errs.length ? { build: seed.build, unstyled: errs.join('; ') } : { build };
}

/**
 * The table: `{ rows, ledger, tasks }`. `rows` one per class in EQUIPMENT_ITEMS order, `{ class, status, build?, slot?,
 * tiers?, from?, also?, unstyled? }`; `tasks` the empty classes, for the creator. A world with neither equipment nor an adornment
 * page has every row empty.
 */
export function resolveEquipment(G) {
  const own = G.equipment?.classes ?? {}, style = G.equipment?.style, items = G.characters?.hero?.adornment?.items ?? [], ledger = [];
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
      return { class: cls, status: 'seeded', ...styled(seed, style), slot: seed.slot, ...(seed.tiers ? { tiers: seed.tiers } : {}), from: `hero:${seed.id}`, ...(also.length ? { also } : {}) };
    }
    return { class: cls, status: 'empty' };
  });
  return { rows, ledger, tasks: rows.filter((r) => r.status === 'empty').map((r) => r.class) };
}

/**
 * The tool calls that realize the table, once the equipment step is ready (`ready`: characterReady's `equipment`):
 * one `mint_solid` of the equipment kind per filled class, at its template's build (its tiers ride on the row, for the
 * stats to scale). Until the step is ready, no mints: `waiting` says on what, and `planned` the mints it will make.
 * → { waiting, mints, planned? }
 */
export function equipmentOrders(G, ready) {
  const planned = resolveEquipment(G).rows.filter((r) => r.build).map((r) => ({
    tool: 'mint_solid', part: 'equipment', class: r.class,
    args: { kind: 'equipment', title: `${G.name} · ${r.class}`, spec: r.build },
  }));
  if (!ready?.ready) return { waiting: ready?.waiting ?? [], mints: [], planned };
  return { waiting: [], mints: planned };
}

/** The stand that shows a class in the hand; a class with none keeps the motion page's stand. A staff stands relaxed:
 * the guard stand raises the fist and the staff across the face, and the plant swing's ready key (hero-swing.js) takes
 * its head behind the torso. */
export const HOLD_STAND = Object.freeze({ staff: 'relaxed' });

/**
 * The composed hero as the adornment page carries it at a stage (default the last): each item in its hand, at the
 * table's build for its class when the item seeded that row (so it wears the world's gear language), grown by its tiers
 * up to the stage. One item per hand, the first; the body's powers carry nothing. The first item in the right hand
 * whose class has a stand (`HOLD_STAND`) sets `gesture`. A PICTURE for the sheet, never an order: the base stays bare,
 * and gear is equipped in play. → { spec, stage, carried: [{ id, slot, class }] } | null
 */
export function equippedHero(G, { stage = STAGES[STAGES.length - 1], composed } = {}) {
  const C = composed ?? composeHero(G), items = G.characters?.hero?.adornment?.items ?? [];
  if (!C || !items.length) return null;
  const rows = resolveEquipment(G).rows, style = G.equipment?.style, gear = {}, carried = [];
  for (const it of items) {
    if (gear[it.slot]) continue;
    const row = rows.find((r) => r.from === `hero:${it.id}`);
    gear[it.slot] = buildAt(row ? { build: row.build, tiers: row.tiers } : { ...styled(it, style), tiers: it.tiers }, stage);
    carried.push({ id: it.id, slot: it.slot, class: it.build.item });
  }
  const stand = carried.find((c) => c.slot === 'right' && HOLD_STAND[c.class]);
  return { spec: { ...C.spec, gear, ...(stand ? { gesture: HOLD_STAND[stand.class] } : {}) }, stage, carried };
}
