import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { EGYPT_RECORD } from './egypt.js';

describe('stage 1 record: New Kingdom Thebes', () => {
  const findings = checkRecord(EGYPT_RECORD);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(EGYPT_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
    expect(gaps.length).toBeGreaterThan(0);
  });
  it('a Ramesside town (1250 BCE) gets sandstone temples, not the Late Period Karnak', () => {
    const at = (y, kind) => inUseAt(EGYPT_RECORD, y, kind).map((e) => e.id);
    expect(at(-1250, 'material')).toEqual(expect.arrayContaining(['silsila-sandstone', 'mudbrick-nk', 'gypsum-plaster']));
    expect(at(-1250, 'material')).not.toContain('lime-plaster');
    expect(at(-1250, 'material')).not.toContain('talatat');
    expect(at(-1250, 'method')).toEqual(expect.arrayContaining(['nk-stone-masonry', 'battered-pylon', 'sunk-relief']));
    expect(at(-1250, 'method')).not.toContain('pan-bedding');
    expect(at(-1250, 'method')).not.toContain('standardized-courses');
    expect(at(-1250, 'type')).toEqual(expect.arrayContaining(['hypostyle-hall', 'karnak-second-pylon', 'deir-el-medina-house']));
    for (const late of ['karnak-first-pylon', 'nectanebo-enclosure', 'nectanebo-sphinx-avenue']) expect(at(-1250, 'type')).not.toContain(late);
    expect(at(-370, 'method')).toContain('pan-bedding');
    expect(at(-1340, 'material')).toContain('talatat');
  });
});
