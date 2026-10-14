// The ledger: every record as one table, what is in reach at a place and year, and the anachronism check. One case per
// procedure, each chosen in code from the ledger and the cards, never a hand list of cultures.
import { describe, it, expect } from 'vitest';
import { LEDGER, RECORDS, SURFACES, ROOFS, REACHES, ledgerRow, availableAt, buildableAt, ledgerFindings, placeOf, cardSurfaces, cultureFindings } from './index.js';
import { HISTORIC_CULTURES } from '../cultures/index.js';
import { WALL_SKINS } from '../ground.js';
import { RECORD_KINDS } from '../lineage.js';
import { checkRecord } from '../record.js';

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
    expect(REACHES).toEqual(['home', 'draws', 'region']);
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
