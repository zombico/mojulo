/**
 * THE FOLK: a town's people, grown from its lots. A town already says who lives in it: each lot's use roots a person
 * (roles.js ROOTS: a shop its keeper, a tower its captain), and each person implies others: the people they GROW (the
 * household over the counter, the master's apprentice, the captain's watch) and the people they SEEK (a supplier for
 * the counter, a hall for the watch to answer to). Make one villager and one shopkeeper and the rest becomes obvious:
 * the egocube cast's fractal (egocube/cast.js, docs/egocube.md "The fractal") turned from story relations to the town's.
 *
 *   readFolk(spec)                                  → { seed?, cap, domicile?, domiciles? } or throws, naming the known words
 *     domicile   one house shape for every house ('D + 0', 'D + P', 'D of F (P + Cx)', 'D + Cx': domicile.js)
 *     domiciles  { <lot key>: shape } a house's own, over `domicile`
 *   folkOfTown(town, { seed?, setting?, folk? })    → the folk sheet
 *     town     a designed town (era/out-town.js designTown): its `lots` (use, route, side, s or front, band) and seed
 *     setting  the game's (egocube/setting.js): its era, tradition and lean load every roll
 *   placeholderLine(person, slot)                   → '[Keeper: greeting]': a line's slot, never its words
 *
 * The sheet: { seed, heartbeat?, people, domiciles, needs, gaps, unrooted, capped }
 *   people    [{ path, lot, use, role, title, as, parent, service, uniform, room, slots, sheet }] in lot order, a
 *             lot's first person then the people it grows. `sheet` is the person's Egocube (egocube.js rollEgocube).
 *   domiciles [{ lot, dweller, shape, notation, asked, partner, children }] each house whose dweller is in town: its
 *             shape rolled from the dweller's age on the house's own die (or asked), `partner` and `children` the paths
 *             of those the cap let in
 *   needs     [{ role, need, roles, why, met, who }] each role's seeks, read against the whole town; `who` the lots'
 *             first people who seek it. An unmet one is an OPEN NEED: advice, never a refusal.
 *   gaps      [{ service, missing, who }] the services in town whose work nothing runs yet (services.js)
 *   unrooted  [{ lot, use }] lots whose use roots no one (a castle's)
 *   capped    how many people the cap left out. Every lot's first person comes before anyone's household, so a
 *             cap leaves no counter unkept: it takes the grown, the last lots' first.
 *
 * THE FRACTAL. A person's path is their lot's key and their place under its first person (`lane:left:12.4/keeper`,
 * `…/townie/child-2`), and their Egocube is rolled on the folk seed and that path alone, so a person never depends on
 * another lot: a town only grows, and adding a lot changes no one already there (under a cap, it may take a
 * household's place). Children share their dweller's ancestry (the born channel); every other facet is the person's
 * own. Pure and deterministic.
 */
import { rollEgocube } from '../egocube/egocube.js';
import { mulberry32 } from '../vegetation/grow.js';
import { ROLES, ROOTS, RELATIONS, FOLK_PULL } from './roles.js';
import { SERVICES } from './services.js';
import { readDomicile, rollDomicile, notationOf, SHAPES, DWELLER, partnerLean, childLean } from './domicile.js';

export const FOLK_KEYS = Object.freeze(['seed', 'cap', 'domicile', 'domiciles']);
export const FOLK_CAP = Object.freeze({ default: 60, max: 400 });
// a household, a rank: at most this many grown under one person
const MAX_GROWN = 4;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const hash = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

/** A recipe's `folk`, checked. `true` or absent is every default. */
export function readFolk(spec) {
  if (spec === undefined || spec === true) return { cap: FOLK_CAP.default };
  if (!isObj(spec)) throw new Error(`folk: give true or { ${FOLK_KEYS.join(', ')} }`);
  for (const k of Object.keys(spec)) if (!FOLK_KEYS.includes(k)) throw new Error(`folk: '${k}' is not a folk word (${FOLK_KEYS.join(', ')})`);
  if (spec.seed !== undefined && !(Number.isInteger(spec.seed) && spec.seed > 0)) throw new Error('folk: seed is a whole number above 0 (the town\'s, when left out)');
  const cap = spec.cap ?? FOLK_CAP.default;
  if (!(Number.isInteger(cap) && cap >= 1 && cap <= FOLK_CAP.max)) throw new Error(`folk: cap is a whole number from 1 to ${FOLK_CAP.max} (how many people at most; ${FOLK_CAP.default} when left out)`);
  const domicile = spec.domicile !== undefined ? readDomicile(spec.domicile) : undefined;
  if (spec.domiciles !== undefined && !isObj(spec.domiciles)) throw new Error('folk: domiciles is { <lot key>: a domicile } (a house\'s own shape, over domicile)');
  const domiciles = spec.domiciles ? Object.fromEntries(Object.entries(spec.domiciles).map(([k, d]) => [k, readDomicile(d)])) : undefined;
  return { ...(spec.seed !== undefined ? { seed: spec.seed } : {}), cap, ...(domicile ? { domicile } : {}), ...(domiciles ? { domiciles } : {}) };
}

/** A lot's key: its frontage and where along it (the farm's and the square's, where they stand). */
export function lotKey(l) {
  const at = Number.isFinite(l.s) ? l.s : Array.isArray(l.front) ? l.front.join(',') : null;
  if (at === null) throw new Error('folk: a lot names where it stands (s along its route, or its front)');
  return `${l.route}:${l.side}:${at}`;
}

/** Two leans as one: each value's weights multiplied. */
function leanOf(...leans) {
  const out = {};
  for (const L of leans) for (const [facet, w] of Object.entries(L ?? {})) {
    out[facet] ??= {};
    for (const [v, x] of Object.entries(w)) out[facet][v] = (out[facet][v] ?? 1) * x;
  }
  return out;
}

/** How many a grow makes on this lot: a number, or by its storeys (`band`, the heartbeat's), on the lot's own die. */
function grownCount(n, lot, rand) {
  if (Number.isInteger(n)) return Math.min(MAX_GROWN, n);
  const [lo, hi] = Array.isArray(lot.band) ? lot.band : [1, 1];
  return Math.min(MAX_GROWN, Math.max(0, lo - 1 + Math.floor(rand() * (hi - lo + 2))));
}

/** A line's slot as the box shows it until the operator gives the words. */
export const placeholderLine = (person, slot) => `[${person.title}: ${slot}]`;

function personOf({ path, lot, key, roleId, as = null, parent = null, lean = null }, { seed, setting }) {
  const role = ROLES[roleId], rel = as ? RELATIONS[as] : null, service = role.service ? SERVICES[role.service] : null;
  const facets = { ...role.facets, ...(rel?.born && parent ? { ancestry: parent.sheet.facets.ancestry } : {}) };
  const sheet = rollEgocube({ facets, seed, path: `folk/${path}`, ...(setting ? { setting } : {}), lean: leanOf(role.lean, rel?.lean, lean), pull: { ...FOLK_PULL, ...role.pull } });
  return {
    path, lot: key, use: lot.use, role: roleId, title: role.title, as, parent: parent?.path ?? null,
    service: role.service ?? null, uniform: service?.uniform ? role.service : null, room: service?.room ?? (isObj(role.room) ? role.room[lot.use] : role.room) ?? null,
    slots: [...role.slots, ...(service?.slots ?? [])], sheet,
  };
}

export function folkOfTown(town, { seed, setting, folk } = {}) {
  if (!isObj(town) || !Array.isArray(town.lots)) throw new Error('folk: give a designed town (era/out-town.js designTown): its lots root its people');
  const F = readFolk(folk);
  const s = F.seed ?? seed ?? town.seed ?? 1;
  const ctx = { seed: s, setting };
  const unrooted = [], lots = [];
  for (const lot of town.lots) {
    const key = lotKey(lot), roleId = ROOTS[lot.use];
    if (!roleId) { unrooted.push({ lot: key, use: lot.use }); continue; }
    const role = ROLES[roleId];
    // the lot's own die for how many it grows, apart from every roll
    const rand = mulberry32(hash(`${s}::folk::${key}::grows`));
    const grows = role.grows.map((g) => ({ ...g, n: grownCount(g.n, lot, rand) }));
    // a house's dweller is rolled first: their age says what the house can be (domicile.js), on the house's own die
    const first = personOf({ path: `${key}/${roleId}`, lot, key, roleId, lean: role.house ? DWELLER : null }, ctx);
    const asked = role.house ? F.domiciles?.[key] ?? F.domicile : undefined;
    const house = role.house ? { ...(asked ?? rollDomicile(first.sheet.facets.age, mulberry32(hash(`${s}::folk::${key}::domicile`)), lot.band)), asked: !!asked } : null;
    const members = house ? [...(SHAPES[house.shape].partner ? [{ as: 'partner', path: 'partner' }] : []), ...Array.from({ length: house.children }, (_, i) => ({ as: 'child', path: `child-${i + 1}` }))] : [];
    lots.push({ lot, key, roleId, first, house, members, grows, kept: false, grown: [] });
  }
  // every lot's first person, then the households in lot order, while the cap lasts; past it, only counted
  let room = F.cap, capped = 0;
  for (const L of lots) {
    if (room > 0) { L.kept = true; room--; }
    else capped += 1 + L.members.length + L.grows.reduce((a, g) => a + g.n, 0);
  }
  const lean = { partner: partnerLean, child: childLean };
  for (const L of lots) {
    if (!L.kept) continue;
    const age = L.first.sheet.facets.age;
    const wants = [...L.members.map((m) => ({ ...m, role: 'townie', lean: lean[m.as](age) })), ...L.grows.flatMap((g) => Array.from({ length: g.n }, (_, i) => ({ as: g.as, path: `${g.as}-${i + 1}`, role: g.role })))];
    for (const w of wants) {
      if (room <= 0) { capped++; continue; }
      L.grown.push(personOf({ path: `${L.first.path}/${w.path}`, lot: L.lot, key: L.key, roleId: w.role, as: w.as, parent: L.first, lean: w.lean }, ctx));
      room--;
    }
  }
  const people = lots.flatMap((L) => (L.kept ? [L.first, ...L.grown] : []));
  const domiciles = lots.filter((L) => L.kept && L.house).map((L) => ({
    lot: L.key, dweller: L.first.path, shape: L.house.shape, notation: notationOf(L.house), asked: L.house.asked,
    partner: L.grown.find((p) => p.as === 'partner')?.path ?? null, children: L.grown.filter((p) => p.as === 'child').map((p) => p.path),
  }));
  // what each role seeks, read against everyone the town holds
  const held = new Set(people.map((p) => p.role));
  const needs = [];
  for (const [roleId, role] of Object.entries(ROLES)) {
    const who = people.filter((p) => p.role === roleId && !p.parent).map((p) => p.path);
    if (!who.length) continue;
    for (const k of role.seeks) needs.push({ role: roleId, need: k.need, roles: k.roles, why: k.why, met: k.roles.some((r) => held.has(r)), who });
  }
  const gaps = [];
  for (const [id, svc] of Object.entries(SERVICES)) {
    if (svc.status !== 'gap') continue;
    const who = people.filter((p) => p.service === id).map((p) => p.path);
    if (who.length) gaps.push({ service: id, missing: svc.missing, who });
  }
  return { seed: s, ...(town.heartbeat ? { heartbeat: town.heartbeat } : {}), people, domiciles, needs, gaps, unrooted, capped };
}
