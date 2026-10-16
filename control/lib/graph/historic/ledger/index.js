/**
 * historic/ledger — every cited record read as one table, and what a builder had in reach at a place and year. The
 * records (../record/*.js, registered in ./records.js) stay the source; a ledger row is an entry with its record and
 * region, keyed `<record>/<id>` (two records may use one id for different things: Egypt's "travertine" is calcite).
 *
 * What is in reach at { region, year, record?, draws?, styles? }, nearest first (a row is taken once, by its nearest
 * reach):
 *   home     the place's own record: every kind in use that year
 *   draws    a relation on the card (../lineage.js): what its kind carries (RECORD_KINDS: a tradition travels as its
 *            materials and methods; types and forms only to the same ground or a version of the same town)
 *   style    a tradition record the card builds in (its `styles`, ./records.js TRADITIONS): every kind, since a place
 *            that took up a way of building took its houses with it
 *   region   the other place records of the same region: their materials and methods
 * In use means attested by that year and not ended before it; a tradition's row is dated for the place by its `spread`
 * for the nearest region in the place's chain (../regions.js `regionChain`), else by its own span.
 *
 * From what is in reach: the SURFACES a wall can show and the ROOFS a building can carry (./building.js), and the
 * storeys its houses rise to (the `dims.storeys` of the house types in reach). `ledgerFindings` is the anachronism
 * check: anything a scene uses that nothing in reach makes. It advises, never refuses. Pure.
 */
import { RECORDS, TRADITIONS } from './records.js';
import { regionChain } from '../regions.js';
import { SURFACES, ROOFS } from './building.js';
import { HISTORIC_CULTURES } from '../cultures/index.js';
import { RECORD_KINDS, yearOf } from '../lineage.js';
import { fmtYear } from '../record.js';

export { RECORDS, TRADITIONS, SURFACES, ROOFS };
export const REACHES = Object.freeze(['home', 'draws', 'style', 'region']);

const spanOf = (e) => (e.kind === 'type' ? e.built : e.attested);
/** A row's span at a place: its `spread` for the nearest region of the chain that names one, else its own. */
const spanAt = (e, chain) => { for (const r of chain) if (e.spread?.[r]) return e.spread[r]; return spanOf(e); };
const inUse = (e, year, chain = []) => { const s = spanAt(e, chain); return !!s && s.from <= year && (s.to === null || s.to === undefined || year <= s.to); };
const TRADITION = ['material', 'method'];

export const keyOf = (record, id) => `${record}/${id}`;
/** Every row: { key, record, region, entry }, in registry order. */
export const LEDGER = Object.freeze(Object.values(RECORDS).flatMap((R) => R.entries.map((entry) => Object.freeze({ key: keyOf(R.id, entry.id), record: R.id, region: R.region, entry }))));
const BY_KEY = new Map(LEDGER.map((r) => [r.key, r]));
/** A row by its key, or null. */
export const ledgerRow = (key) => BY_KEY.get(key) ?? null;

/** Where and when a culture is read: { region, year, record, draws }. */
export function placeOf(cultureId) {
  const K = HISTORIC_CULTURES[cultureId];
  if (!K) throw new Error(`ledger: no culture '${cultureId}' (${Object.keys(HISTORIC_CULTURES).join(', ')})`);
  return { region: K.region, year: yearOf(K), record: K.record?.id ?? null, draws: K.draws ?? [], ...(K.styles?.length ? { styles: K.styles } : {}) };
}

/** The rows in reach at a place and year: [{ key, record, region, entry, via: { reach, from?, kind? } }], nearest first. */
export function availableAt({ region, year, record = null, draws = [], styles = [] }) {
  if (!Number.isInteger(year) || year === 0) throw new Error('ledger: year is a whole year, BCE negative, never 0');
  if (record !== null && !RECORDS[record]) throw new Error(`ledger: no record '${record}' (${Object.keys(RECORDS).join(', ')})`);
  for (const s of styles) if (!TRADITIONS.includes(s)) throw new Error(`ledger: style '${s}' is not a tradition record (${TRADITIONS.join(', ')})`);
  const out = new Map(), chain = regionChain(region);
  const take = (rows, via) => { for (const r of rows) if (!out.has(r.key) && inUse(r.entry, year, chain)) out.set(r.key, { ...r, via }); };
  if (record) take(LEDGER.filter((r) => r.record === record), { reach: 'home' });
  for (const d of draws) {
    const from = HISTORIC_CULTURES[d.from]?.record?.id, kinds = RECORD_KINDS[d.kind] ?? TRADITION;
    if (from) take(LEDGER.filter((r) => r.record === from && kinds.includes(r.entry.kind)), { reach: 'draws', from: d.from, kind: d.kind });
  }
  for (const s of styles) take(LEDGER.filter((r) => r.record === s), { reach: 'style', from: s });
  take(LEDGER.filter((r) => r.region === region && r.record !== record && !RECORDS[r.record].tradition && TRADITION.includes(r.entry.kind)), { reach: 'region' });
  return [...out.values()];
}

// a table's rows (SURFACES or ROOFS) → those in reach, each with the rows that make it there
const madeOf = (table, inReach) => Object.entries(table).flatMap(([id, t]) => {
  const by = t.by.filter((k) => inReach.has(k));
  return by.length ? [{ id, read: t.read, by }] : [];
});

/** What can be built at a place and year: { year, surfaces, roofs, storeys: { range, by } | null }. */
export function buildableAt(at) {
  const rows = availableAt(at), inReach = new Map(rows.map((r) => [r.key, r]));
  const houses = rows.filter((r) => r.entry.kind === 'type' && Array.isArray(r.entry.dims?.storeys));
  const storeys = houses.length
    ? { range: [Math.min(...houses.map((r) => r.entry.dims.storeys[0])), Math.max(...houses.map((r) => r.entry.dims.storeys[1]))], by: houses.map((r) => r.key) }
    : null;
  return { year: at.year, surfaces: madeOf(SURFACES, inReach), roofs: madeOf(ROOFS, inReach), storeys };
}

/** The earliest any of a table row's makers is attested anywhere, for a finding to say what would bring it in. */
function earliest(by) {
  let best = null;
  for (const k of by) { const r = BY_KEY.get(k), s = r && spanOf(r.entry); if (s && (!best || s.from < best.from)) best = { key: k, from: s.from }; }
  return best;
}

/**
 * The anachronism check: what a scene uses ({ surfaces?: [skin], roofs?: [form], rows?: [key] }) that nothing in reach
 * at its place and year makes → [{ level: 'warn', what, id, message }]. A skin or roof no row makes is its own finding.
 */
export function ledgerFindings(at, uses) {
  const rows = availableAt(at), inReach = new Set(rows.map((r) => r.key)), out = [], when = `${fmtYear(at.year)} in ${at.region}`;
  const check = (what, table, ids) => {
    for (const id of new Set(ids ?? [])) {
      const t = table[id];
      if (!t) { out.push({ level: 'warn', what, id, message: `no ledger row makes the ${what} '${id}': name what does in ./building.js` }); continue; }
      if (t.by.some((k) => inReach.has(k))) continue;
      const e = earliest(t.by);
      out.push({ level: 'warn', what, id, message: `the ${what} '${id}' (${t.read}) is used, but nothing that makes it is in reach at ${when}${e ? `: the earliest is ${e.key}, from ${fmtYear(e.from)}` : ''}` });
    }
  };
  check('surface', SURFACES, uses.surfaces);
  check('roof', ROOFS, uses.roofs);
  for (const key of new Set(uses.rows ?? [])) {
    if (inReach.has(key)) continue;
    const r = BY_KEY.get(key);
    out.push({ level: 'warn', what: 'row', id: key, message: r ? `${key} (${r.entry.name}) is used, but is not in reach at ${when}` : `${key} is not a ledger row` });
  }
  return out;
}

/** The skins a culture card puts on its masses: its kinds, its whitewash, its bare share, its per-asset overrides. */
export function cardSurfaces(K) {
  const S = K.skins ?? {};
  return [...new Set([...Object.values(S.kinds ?? {}), ...(S.whitewash ? [S.whitewash] : []), ...(S.bare?.skin ? [S.bare.skin] : []), ...Object.values(S.assets ?? {}).flatMap((a) => Object.values(a))])];
}

/** The anachronism check over a registered culture's card, at its own place and year. */
export const cultureFindings = (cultureId) => ledgerFindings(placeOf(cultureId), { surfaces: cardSurfaces(HISTORIC_CULTURES[cultureId]) });
