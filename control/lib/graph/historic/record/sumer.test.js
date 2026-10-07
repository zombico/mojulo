import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { SUMER_RECORD } from './sumer.js';

describe('stage 1 record: Sumer', () => {
  const findings = checkRecord(SUMER_RECORD);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(SUMER_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
    expect(gaps.length).toBeGreaterThan(0);
  });
  it('the materials in hand change across the periods', () => {
    const at = (y) => inUseAt(SUMER_RECORD, y).map((e) => e.id);
    expect(at(-5300)).toContain('mudbrick-ubaid');
    expect(at(-5300)).not.toContain('baked-brick');
    expect(at(-3300)).toEqual(expect.arrayContaining(['riemchen', 'clay-cone', 'gypsum-plaster']));
    expect(at(-2500)).toContain('plano-convex');
    expect(at(-2500)).not.toContain('clay-cone');
  });
});
