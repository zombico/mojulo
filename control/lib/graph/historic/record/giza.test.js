import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { GIZA_RECORD, GIZA_REIGNS } from './giza.js';

describe('stage 1 record: Old Kingdom Giza', () => {
  const findings = checkRecord(GIZA_RECORD);
  const at = (y, kind) => inUseAt(GIZA_RECORD, y, kind).map((e) => e.id);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(GIZA_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
    expect(gaps.length).toBeGreaterThan(0);
  });
  it('Menkaure\'s Giza (c. 2515 BCE) has three cased pyramids and the Sphinx, but no brick finish and nothing later', () => {
    const y = -2515;
    expect(y).toBeGreaterThanOrEqual(GIZA_REIGNS.menkaure.from);
    expect(y).toBeLessThanOrEqual(GIZA_REIGNS.menkaure.to);
    expect(at(y, 'material')).toEqual(expect.arrayContaining(['giza-limestone', 'tura-limestone', 'aswan-granite', 'basalt-widan', 'travertine', 'gypsum-mortar', 'mudbrick-ok']));
    expect(at(y, 'type')).toEqual(expect.arrayContaining(['khufu-pyramid', 'khafre-pyramid', 'menkaure-pyramid', 'great-sphinx', 'sphinx-temple', 'khafre-valley-temple', 'menkaure-mortuary-temple', 'wall-of-the-crow', 'gallery-complex', 'khentkawes-basin']));
    for (const late of ['menkaure-brick-completion', 'khentkawes-town', 'sphinx-beard', 'dream-stele', 'sphinx-nk-enclosure', 'amenhotep-ii-sphinx-temple', 'ramesside-sphinx-stelae', 'saite-sphinx-repairs', 'roman-sphinx-restoration']) {
      expect(at(y, 'type')).not.toContain(late);
    }
    expect(at(y, 'form')).not.toContain('casing-stripped');
  });
  it('dates the rest of the sequence: Khufu\'s Giza lacks Khafre\'s works; Shepseskaf\'s brick and the medieval stripping come later', () => {
    expect(at(-2575, 'type')).toContain('khufu-pyramid');
    expect(at(-2575, 'type')).not.toContain('khafre-pyramid');
    expect(at(-2575, 'type')).not.toContain('great-sphinx');
    expect(at(-2500, 'type')).toContain('menkaure-brick-completion');
    expect(at(-1300, 'type')).toEqual(expect.arrayContaining(['dream-stele', 'sphinx-beard']));
    expect(at(-1300, 'type')).not.toContain('gallery-complex');
    expect(at(1400, 'form')).toContain('casing-stripped');
  });
});
