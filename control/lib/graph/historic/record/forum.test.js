import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { POMPEII_READ_AT, POMPEII_STATES } from './pompeii.js';
import { FORUM_RECORD, FORUM_READ_AT, FORUM_STATES } from './forum.js';

describe('stage 1 record: the Forum Romanum', () => {
  const findings = checkRecord(FORUM_RECORD);
  const at = (y, kind) => inUseAt(FORUM_RECORD, y, kind).map((e) => e.id);
  const byId = (id) => FORUM_RECORD.find((e) => e.id === id);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(FORUM_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
  });
  it('is read at Pompeii\'s moment, with Pompeii\'s states', () => {
    expect(FORUM_READ_AT).toBe(POMPEII_READ_AT);
    expect(FORUM_STATES).toEqual(POMPEII_STATES);
    for (const t of FORUM_RECORD.filter((e) => e.kind === 'type')) expect(FORUM_STATES, t.id).toContain(t.state);
  });
  it('at 79: the Augustan and Tiberian forum stands, Vesta rebuilt after 64; no Temple of Vespasian, no later monuments', () => {
    const y = FORUM_READ_AT, types = at(y, 'type');
    expect(types).toEqual(expect.arrayContaining(['temple-saturn', 'temple-concord', 'tabularium', 'basilica-julia', 'basilica-aemilia', 'temple-castor', 'temple-divus-julius', 'arch-augustus', 'temple-vesta', 'atrium-vestae', 'regia', 'curia-julia', 'rostra-augusti', 'lacus-curtius', 'capitoline-jupiter', 'templum-pacis']));
    for (const late of ['temple-vespasian', 'consentes-portico', 'equus-domitiani', 'vesta-severan', 'umbilicus', 'saturn-late-porch', 'curia-diocletian', 'julia-brick-piers']) expect(types).not.toContain(late);
    expect(byId('temple-vesta').state).toBe('repaired');
    expect(at(y, 'form')).not.toContain('excavated-forum');
  });
  it('carries each temple\'s order and column numbers, and the orders are dated', () => {
    expect(byId('temple-castor').dims.columns).toEqual({ front: 8, flank: 11, h: 14.8, D: 1.45 });
    expect(byId('temple-castor').dims.columns.h / byId('temple-castor').dims.columns.D).toBeCloseTo(10.2, 1);
    for (const id of ['temple-saturn', 'temple-concord', 'temple-castor', 'temple-vesta']) expect(byId(id).methods).toContain('corinthian-order');
    expect(byId('temple-divus-julius').dims.order).toBe('ionic');
    expect(at(-200, 'method')).not.toContain('corinthian-order');
    expect(at(-42, 'method')).toContain('corinthian-order');
  });
});
