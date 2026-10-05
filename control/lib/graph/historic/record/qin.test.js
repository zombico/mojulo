import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { QIN_RECORD, QIN_READ_AT, QIN_DATES } from './qin.js';

describe('stage 1 record: Qin Xianyang and Lishan', () => {
  const findings = checkRecord(QIN_RECORD);
  const at = (y, kind) => inUseAt(QIN_RECORD, y, kind).map((e) => e.id);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(QIN_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
    expect(gaps.length).toBeGreaterThan(0);
  });
  it('at 212 BCE: the palace stands, Epang is begun, Lishan and its pit are building; no Han analogue, no glaze, no curve, no fire', () => {
    expect(QIN_READ_AT).toBe(QIN_DATES.epangBegun);
    const y = QIN_READ_AT;
    expect(at(y, 'type')).toEqual(expect.arrayContaining(['xianyang-palace-1', 'epang-front-hall', 'lishan-mound', 'lishan-enclosures', 'lishan-triple-que', 'army-pit-1', 'zhengguo-canal', 'wei-bridge']));
    for (const han of ['gaoyi-que', 'han-pottery-tower', 'han-market-brick']) expect(at(y, 'type')).not.toContain(han);
    expect(at(y, 'material')).toEqual(expect.arrayContaining(['loess-hangtu', 'grey-tile', 'wadang-round', 'wadang-kui', 'timber-post']));
    expect(at(y, 'material')).not.toContain('glazed-tile');
    expect(at(y, 'form')).toContain('xianyang-capital');
    for (const late of ['curved-eaves', 'xianyang-burned']) expect(at(y, 'form')).not.toContain(late);
  });
  it('dates the rest: before 246 no Lishan; Epang only from 212; after 206 Xianyang burned; the analogues in their own centuries', () => {
    expect(at(-250, 'type')).not.toContain('lishan-mound');
    expect(at(-213, 'type')).not.toContain('epang-front-hall');
    expect(at(-205, 'type')).not.toContain('xianyang-palace-1');
    expect(at(-205, 'form')).toContain('xianyang-burned');
    expect(at(210, 'type')).toEqual(expect.arrayContaining(['gaoyi-que', 'han-pottery-tower', 'han-market-brick']));
    expect(at(600, 'form')).toContain('curved-eaves');
  });
});
