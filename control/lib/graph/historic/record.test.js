import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt, fmtYear } from './record.js';

const src = [{ author: 'A. Author', title: 'A Title', year: 1999 }];
const brick = { id: 'mudbrick', name: 'mudbrick', kind: 'material', confidence: 'read', attested: { from: -5400, to: null, where: ['Eridu'] }, supply: 'river clay', role: ['wall'], colour: ['#a88d6a'], sources: src };
const bitumen = { id: 'bitumen', name: 'bitumen', kind: 'material', confidence: 'read', attested: { from: -5000, to: null, where: ['Hit'] }, supply: 'seeps', role: ['mortar', 'waterproofing'], sources: src };
const house = { id: 'house', name: 'house', kind: 'type', confidence: 'secondary', built: { from: -5000, to: -3000 }, materials: ['mudbrick', 'bitumen'], sources: src };

describe('historic record: the machine check', () => {
  it('a sound record has no findings', () => {
    expect(checkRecord([brick, bitumen, house])).toEqual([]);
  });
  it('every entry must cite sources, have a name, a known kind and a start year', () => {
    const bad = { id: 'x', kind: 'material', attested: {}, role: ['wall'] };
    const msgs = checkRecord([bad]).map((f) => f.message);
    expect(msgs).toEqual(expect.arrayContaining(['no name', 'no sources', 'no attested.from year']));
    expect(checkRecord([{ ...brick, kind: 'gizmo' }]).map((f) => f.message)).toContain("unknown kind 'gizmo'");
    expect(checkRecord([{ ...brick, sources: [{ title: 't' }] }]).map((f) => f.message)).toContain('a source lacks author, title or year');
  });
  it('confidence is required; unverified entries are allowed but always reported', () => {
    expect(checkRecord([{ ...brick, confidence: undefined }])[0]).toMatchObject({ level: 'error', message: 'confidence must be one of read, secondary, unverified' });
    expect(checkRecord([{ ...brick, confidence: 'unverified' }])).toEqual([{ level: 'warn', id: 'mudbrick', message: 'unverified: no source in hand confirms it' }]);
  });
  it('a type cannot use a material before it is attested, nor an unknown one', () => {
    const early = { ...house, built: { from: -6000, to: null } };
    expect(checkRecord([brick, bitumen, early]).map((f) => f.message)).toEqual([
      "uses 'mudbrick' (from 5400 BCE) before it is attested (6000 BCE)",
      "uses 'bitumen' (from 5000 BCE) before it is attested (6000 BCE)",
    ]);
    expect(checkRecord([brick, { ...house, materials: ['cedar'] }]).map((f) => f.message)).toContain("references unknown 'cedar'");
  });
  it('spans, colours, roles and ids are checked', () => {
    expect(checkRecord([{ ...brick, attested: { from: -3000, to: -4000 } }])[0].message).toBe('span ends before it starts');
    expect(checkRecord([{ ...brick, colour: ['brown'] }])[0].message).toBe("colour 'brown' is not #rrggbb");
    expect(checkRecord([{ ...brick, role: ['magic'] }])[0]).toMatchObject({ level: 'warn' });
    expect(checkRecord([brick, brick])[0].message).toBe('duplicate id');
    expect(checkRecord([{ ...brick, attested: { from: 0 } }]).map((f) => f.message)).toContain('no attested.from year');
  });
  it('lists what is in use at a year', () => {
    expect(inUseAt([brick, bitumen], -5200).map((e) => e.id)).toEqual(['mudbrick']);
    expect(inUseAt([brick, bitumen, house], -4000, 'type').map((e) => e.id)).toEqual(['house']);
    expect(inUseAt([brick, bitumen, house], -2000, 'type')).toEqual([]);
    expect(fmtYear(-5400)).toBe('5400 BCE');
    expect(fmtYear(1930)).toBe('1930 CE');
  });
});
