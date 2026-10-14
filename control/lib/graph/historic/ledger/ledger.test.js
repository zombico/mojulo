// The ledger: every record as one table, what is in reach at a place and year, and the anachronism check. One case per
// procedure, each chosen in code from the ledger and the cards, never a hand list of cultures.
import { describe, it, expect } from 'vitest';
import { LEDGER, RECORDS, TRADITIONS, SURFACES, ROOFS, REACHES, ledgerRow, availableAt, buildableAt, ledgerFindings, placeOf, cardSurfaces, cultureFindings } from './index.js';
import { HISTORIC_CULTURES } from '../cultures/index.js';
import { WALL_SKINS } from '../ground.js';
import { RECORD_KINDS } from '../lineage.js';
import { checkRecord } from '../record.js';
import { regionChain } from '../regions.js';
import { STYLES } from '../inventory/index.js';

const spanOf = (e) => (e.kind === 'type' ? e.built : e.attested);
const keys = (rows) => new Set(rows.map((r) => r.key));

describe('the ledger', () => {
  it('is every record, each row keyed by its record, the records sound', () => {
    expect(new Set(LEDGER.map((r) => r.key)).size).toBe(LEDGER.length);
    expect(LEDGER.length).toBe(Object.values(RECORDS).reduce((n, R) => n + R.entries.length, 0));
    for (const R of Object.values(RECORDS)) expect(checkRecord(R.entries).filter((f) => f.level === 'error')).toEqual([]);
  });
  it('every card names its record from the registry, in its own region', () => {
    for (const K of Object.values(HISTORIC_CULTURES)) if (K.record) {
      expect(RECORDS[K.record.id]).toBe(K.record);
      expect(K.record.region).toBe(K.region);
    }
  });
  it('every skin the renderer draws is made by ledger rows, and every maker is a row', () => {
    expect(Object.keys(SURFACES).sort()).toEqual(Object.keys(WALL_SKINS).sort());
    for (const t of [...Object.values(SURFACES), ...Object.values(ROOFS)]) for (const k of t.by) expect(ledgerRow(k), k).not.toBe(null);
  });
});

describe('what is in reach', () => {
  it('home: a row is in reach from its first year to its last, not after', () => {
    const r = LEDGER.find((x) => spanOf(x.entry).to != null && spanOf(x.entry).to < 1000);
    const { from, to } = spanOf(r.entry), at = { region: r.region, record: r.record };
    expect(keys(availableAt({ ...at, year: from })).has(r.key)).toBe(true);
    expect(keys(availableAt({ ...at, year: to + 1 === 0 ? 1 : to + 1 })).has(r.key)).toBe(false);
    expect(availableAt({ ...at, year: from }).find((x) => x.key === r.key).via.reach).toBe('home');
  });
  it('draws: a relation carries what its kind carries, and nearer reach wins over the region', () => {
    let seen = 0;
    for (const [id, K] of Object.entries(HISTORIC_CULTURES)) for (const d of K.draws ?? []) {
      const src = HISTORIC_CULTURES[d.from].record?.id;
      if (!src || src === K.record?.id) continue;
      const drawn = availableAt({ ...placeOf(id), draws: [d] }).filter((x) => x.record === src);
      for (const x of drawn) expect(x.via.reach === 'draws' ? RECORD_KINDS[d.kind] : ['material', 'method']).toContain(x.entry.kind);
      if (K.region === HISTORIC_CULTURES[d.from].region) for (const x of drawn) expect(x.via.reach).toBe('draws');
      seen += drawn.length;
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('region: the other records of the region lend their tradition, never their buildings', () => {
    const region = Object.values(RECORDS).find((R) => Object.values(RECORDS).filter((O) => O.region === R.region).length > 1).region;
    const rows = availableAt({ region, year: 100 });
    expect(rows.length).toBeGreaterThan(0);
    for (const x of rows) { expect(x.via.reach).toBe('region'); expect(['material', 'method']).toContain(x.entry.kind); }
    expect(REACHES).toEqual(['home', 'draws', 'style', 'region']);
  });
  it('refuses a year that is not one, and a record that is not registered', () => {
    expect(() => availableAt({ region: 'egypt', year: 0 })).toThrow(/never 0/);
    expect(() => availableAt({ region: 'egypt', year: -100, record: 'atlantis' })).toThrow(/no record/);
  });
});

describe('what can be built', () => {
  it('storeys come from the house types in reach', () => {
    const t = LEDGER.find((x) => x.entry.kind === 'type' && Array.isArray(x.entry.dims?.storeys));
    const b = buildableAt({ region: t.region, record: t.record, year: spanOf(t.entry).from });
    expect(b.storeys.by).toContain(t.key);
    expect(b.storeys.range[1]).toBeGreaterThanOrEqual(t.entry.dims.storeys[1]);
  });
  it('a surface or roof is in reach when a row that makes it is, and names those rows', () => {
    const [id, t] = Object.entries(ROOFS)[0], r = ledgerRow(t.by[0]);
    const b = buildableAt({ region: r.region, record: r.record, year: spanOf(r.entry).from });
    expect(b.roofs.find((x) => x.id === id).by).toContain(r.key);
  });
});

describe('the anachronism check', () => {
  // a surface whose every maker begins after some year: used before it, it is a finding naming the earliest maker
  const late = Object.entries(SURFACES).find(([, t]) => t.by.every((k) => spanOf(ledgerRow(k).entry).from > -500));
  it('a surface used before anything makes it is a finding; once in reach it is not', () => {
    const [id, t] = late, first = ledgerRow(t.by[0]);
    const before = ledgerFindings({ region: first.region, record: first.record, year: -3000 }, { surfaces: [id] });
    expect(before).toHaveLength(1);
    expect(before[0].message).toMatch(/earliest is/);
    expect(ledgerFindings({ region: first.region, record: first.record, year: spanOf(first.entry).from }, { surfaces: [id] })).toEqual([]);
  });
  it('a skin or roof nothing makes, and a row out of reach, are findings; it advises, it never throws', () => {
    const at = { region: 'egypt', year: -1250, record: 'egypt' };
    expect(ledgerFindings(at, { surfaces: ['chrome'], roofs: ['geodesic'] }).map((f) => f.what)).toEqual(['surface', 'roof']);
    const future = LEDGER.find((x) => x.record === 'egypt' && spanOf(x.entry).from > -1250);
    expect(ledgerFindings(at, { rows: [future.key] })[0].id).toBe(future.key);
  });
  it('reads a card: its skins, at its own place and year', () => {
    const id = Object.keys(HISTORIC_CULTURES).find((c) => HISTORIC_CULTURES[c].skins?.whitewash);
    expect(cardSurfaces(HISTORIC_CULTURES[id])).toContain(HISTORIC_CULTURES[id].skins.whitewash);
    for (const f of cultureFindings(id)) expect(f.level).toBe('warn');
  });
});

describe('a style: a tradition record a card builds in', () => {
  const style = TRADITIONS[0], R = RECORDS[style];
  // a row that came to one land later than to the tradition at large, and one the tradition carries as a type
  const late = R.entries.find((e) => Object.entries(e.spread ?? {}).some(([, s]) => s.from > spanOf(e).from));
  const [land] = Object.entries(late.spread).find(([, s]) => s.from > spanOf(late).from), at = late.spread[land].from - 10;
  const type = R.entries.find((e) => e.kind === 'type');
  it('is reached only by naming it, with every kind it holds: a way of building brings its houses', () => {
    expect(REACHES).toContain('style');
    const year = Math.max(...R.entries.map((e) => spanOf(e).from)) + 5;
    expect(keys(availableAt({ region: R.region, year })).has(`${style}/${type.id}`)).toBe(false);
    const rows = availableAt({ region: R.region, year, styles: [style] });
    expect(rows.find((r) => r.key === `${style}/${type.id}`)?.via).toEqual({ reach: 'style', from: style });
  });
  it('is dated for the place: a row reaches a land at that land\'s date, read up its region chain', () => {
    expect(regionChain(land)).toContain(R.region);
    expect(keys(availableAt({ region: R.region, year: at, styles: [style] })).has(`${style}/${late.id}`)).toBe(true);
    expect(keys(availableAt({ region: land, year: at, styles: [style] })).has(`${style}/${late.id}`)).toBe(false);
    expect(keys(availableAt({ region: land, year: late.spread[land].from, styles: [style] })).has(`${style}/${late.id}`)).toBe(true);
  });
  it('a style the ledger lacks is refused by name; a tradition never reaches a place by region alone', () => {
    expect(() => availableAt({ region: R.region, year: 1500, styles: ['brutalism'] })).toThrow(/style 'brutalism' is not a tradition record/);
    expect(availableAt({ region: R.region, year: 1500 }).some((r) => r.record === style)).toBe(false);
  });
  it('what it brings is buildable: its house types give the storeys', () => {
    const b = buildableAt({ region: R.region, year: spanOf(type).from + 1, styles: [style] });
    expect(b.storeys.by).toContain(`${style}/${type.id}`);
  });
  it('an inventory style built from it cites rows the ledger has, all reached through it', () => {
    const [id, st] = Object.entries(STYLES).find(([, s]) => s.record === style);
    const rows = keys(availableAt({ region: R.region, year: 1500, styles: [st.record] }));
    for (const k of st.cites) { expect(ledgerRow(k), `${id}: ${k}`).not.toBe(null); expect(rows.has(k), k).toBe(true); }
  });
});
