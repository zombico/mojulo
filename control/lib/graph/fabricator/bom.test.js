import { describe, it, expect } from 'vitest';
import { bomOf, bomCsv, bomMarkdown, BOM_COLUMNS } from './bom.js';
import { fabricationPlan } from './plan.js';

const scadRow = (spec) => ({ kind: 'scad', source: 'cube(1);', fabricate: { ...spec, executor: 'scad', plan: fabricationPlan(spec) } });

describe('fabricator bill of materials', () => {
  const row = scadRow({ host: 'printed', needs: [
    { id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4, loadN: 400 },
    { id: 'gears', function: 'transmit', tags: ['print-only'], torqueNm: 0.5 },
    { id: 'pi', function: 'mount', to: 'board', board: 'rpi4' },
  ] });

  it('reads the frozen plan: what is bought, what is printed, the notices', () => {
    const bom = bomOf(row);
    expect(bom.source).toBe('fabricate (scad)');
    expect(bom.lines.map((l) => l.item)).toEqual(bom.lines.map((_, i) => i + 1));
    expect(bom.lines.find((l) => l.code?.endsWith('-socket') && l.for.includes('lid'))).toMatchObject({ kind: 'buy', count: 4, grade: '8.8', standard: 'ISO 4762' });
    expect(bom.lines.filter((l) => l.kind === 'print').map((l) => l.label)).toEqual(row.fabricate.plan.cuts.filter((c) => c.route === 'print').map((c) => c.call));
    expect(bom.notices.join(' ')).toMatch(/Raspberry Pi is a trademark/);
  });

  it('writes the same bytes every time, a CSV a spreadsheet opens and a page that carries the notices', () => {
    const csv = bomCsv(bomOf(row));
    expect(csv).toBe(bomCsv(bomOf(row)));
    const rows = csv.split('\r\n');
    expect(rows[0]).toBe(BOM_COLUMNS.join(','));
    expect(rows.slice(1, -1).every((r) => !/\n/.test(r))).toBe(true);
    expect(bomCsv({ lines: [{ item: 1, kind: 'buy', label: 'O-ring cord ⌀2.62 mm, 400 mm (the rim, plus "margin")' }] }))
      .toContain('"O-ring cord ⌀2.62 mm, 400 mm (the rim, plus ""margin"")"');
    const page = bomMarkdown(bomOf(row), { title: 'gearbox', ref: 'sk_x' });
    expect(page).toMatch(/^# Bill of materials: gearbox/);
    expect(page).toMatch(/## Buy[\s\S]*## Print[\s\S]*## Tools[\s\S]*## Notices/);
  });

  it('a row with nothing planned and no fittings has no bill of materials', () => {
    expect(bomOf({ kind: 'scad', source: 'cube(1);' })).toBeNull();
    expect(bomOf(null)).toBeNull();
  });
});
