/**
 * THE FOLK: a town's people, grown from its lots. A town already says who lives in it: each lot's use roots a person
 * (roles.js ROOTS: a shop its keeper, a tower its captain), and each person implies others: the people they GROW (the
 * household over the counter, the master's apprentice, the captain's watch) and the people they SEEK (a supplier for
 * the counter, a hall for the watch to answer to). Make one villager and one shopkeeper and the rest becomes obvious:
 * the egocube cast's fractal (egocube/cast.js, docs/egocube.md "The fractal") turned from story relations to the town's.
 *
 *   readFolk(spec)                                  → { seed?, cap } or throws, naming the known words
 *   folkOfTown(town, { seed?, setting?, folk? })    → the folk sheet
 *     town     a designed town (era/out-town.js designTown): its `lots` (use, route, side, s or front, band) and seed
 *     setting  the game's (egocube/setting.js): its era, tradition and lean load every roll
 *   placeholderLine(person, slot)                   → '[Keeper: greeting]': a line's slot, never its words
 *
 * The sheet: { seed, heartbeat?, people, needs, gaps, unrooted, capped }
 *   people    [{ path, lot, use, role, title, as, parent, service, uniform, room, slots, sheet }] in lot order, a
 *             lot's first person then the people it grows. `sheet` is the person's Egocube (egocube.js rollEgocube).
 *   needs     [{ role, need, roles, why, met, who }] each role's seeks, read against the whole town; `who` the lots'
 *             first people who seek it. An unmet one is an OPEN NEED: advice, never a refusal.
 *   gaps      [{ service, missing, who }] the services in town whose work nothing runs yet (services.js)
 *   unrooted  [{ lot, use }] lots whose use roots no one (a castle's)
 *   capped    how many people the cap left out. Every lot's first person comes before anyone's household, so a
 *             cap leaves no counter unkept: it takes the grown, the last lots' first.
 *
 * THE FRACTAL. A person's path is their lot's key and their place under its first person (`lane:left:12.4/keeper`,
 * `…/keeper/kin-2`), and their Egocube is rolled on the folk seed and that path alone, so a person never depends on
 * another lot: a town only grows, and adding a lot changes no one already there (under a cap, it may take a
 * household's place). Kin share their household's ancestry
 * (the born channel); every other facet is the person's own. Pure and deterministic.
 */
import { rollEgocube } from '../egocube/egocube.js';
import { mulberry32 } from '../vegetation/grow.js';
import { ROLES, ROOTS, RELATIONS, FOLK_PULL } from './roles.js';
import { SERVICES } from './services.js';

export const FOLK_KEYS = Object.freeze(['seed', 'cap']);
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
  return { ...(spec.seed !== undefined ? { seed: spec.seed } : {}), cap };
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

function personOf({ path, lot, key, roleId, as = null, parent = null }, { seed, setting }) {
  const role = ROLES[roleId], rel = as ? RELATIONS[as] : null, service = role.service ? SERVICES[role.service] : null;
  const facets = { ...role.facets, ...(rel?.born && parent ? { ancestry: parent.sheet.facets.ancestry } : {}) };
  const sheet = rollEgocube({ facets, seed, path: `folk/${path}`, ...(setting ? { setting } : {}), lean: leanOf(role.lean, rel?.lean), pull: { ...FOLK_PULL, ...role.pull } });
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
    // the lot's own die for how many it grows, apart from every roll
    const rand = mulberry32(hash(`${s}::folk::${key}::grows`));
    lots.push({ lot, key, roleId, grows: ROLES[roleId].grows.map((g) => ({ ...g, n: grownCount(g.n, lot, rand) })), first: null, grown: [] });
  }
  // every lot's first person, then the households in lot order, while the cap lasts; past it, only counted
  let room = F.cap, capped = 0;
  for (const L of lots) {
    if (room > 0) { L.first = personOf({ path: `${L.key}/${L.roleId}`, lot: L.lot, key: L.key, roleId: L.roleId }, ctx); room--; }
    else capped += 1 + L.grows.reduce((a, g) => a + g.n, 0);
  }
  for (const L of lots) {
    if (!L.first) continue;
    for (const g of L.grows) for (let i = 0; i < g.n; i++) {
      if (room <= 0) { capped++; continue; }
      L.grown.push(personOf({ path: `${L.first.path}/${g.as}-${i + 1}`, lot: L.lot, key: L.key, roleId: g.role, as: g.as, parent: L.first }, ctx));
      room--;
    }
  }
  const people = lots.flatMap((L) => (L.first ? [L.first, ...L.grown] : []));
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
  return { seed: s, ...(town.heartbeat ? { heartbeat: town.heartbeat } : {}), people, needs, gaps, unrooted, capped };
}
