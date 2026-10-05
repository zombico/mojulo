import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { LINDOS_RECORD, LINDOS_YEAR } from './lindos.js';

describe('stage 1 record: Hellenistic Lindos', () => {
  const findings = checkRecord(LINDOS_RECORD);
  const at = (y, kind) => inUseAt(LINDOS_RECORD, y, kind).map((e) => e.id);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(LINDOS_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
    expect(gaps.length).toBeGreaterThan(0);
  });
  it('Lindos at c. 180 BCE has the whole Hellenistic sanctuary, the theatre and the town, and nothing later', () => {
    const y = LINDOS_YEAR;
    expect(y).toBe(-180);
    expect(at(y, 'material')).toEqual(expect.arrayContaining(['lindian-limestone', 'lardos-stone', 'imported-marble', 'lime-stucco', 'terracotta-tile', 'timber', 'bronze', 'mudbrick-socle', 'pebble-mosaic']));
    expect(at(y, 'method')).toEqual(expect.arrayContaining(['ashlar-masonry', 'rock-cutting', 'stucco-over-poros', 'terracing-analemmata', 'doric-order', 'apyra-hiera']));
    expect(at(y, 'type')).toEqual(expect.arrayContaining(['athena-temple', 'athena-altar', 'propylaia', 'grand-stair', 'great-stoa', 'ship-relief', 'rock-exedra', 'theatre', 'tetrastoon', 'acropolis-walls-hellenistic', 'archokrateion', 'kleoboulos-tomb', 'lindos-house']));
    expect(at(y, 'form')).toEqual(expect.arrayContaining(['acropolis-sea-cliff', 'town-between-harbours', 'axial-climb']));
    for (const late of ['archaic-temple', 'terrace-vaults', 'lindian-chronicle', 'psithyros-stoa', 'roman-temple', 'church-st-john', 'knights-castle', 'captains-houses', 'choklaki-courtyards', 'italian-restoration']) {
      expect(at(y, 'type')).not.toContain(late);
    }
    expect(at(y, 'material')).not.toContain('whitewash-modern');
    expect(at(y, 'material')).not.toContain('reinforced-concrete');
    expect(at(y, 'form')).not.toContain('whitewashed-village');
  });
  it('records the fireless sacrifices to Athena Lindia, and her altar carries them', () => {
    const rite = LINDOS_RECORD.find((e) => e.id === 'apyra-hiera');
    expect(rite).toBeTruthy();
    expect(rite.notes).toMatch(/fire/i);
    expect(rite.sources.some((s) => s.author === 'Pindar')).toBe(true);
    expect(LINDOS_RECORD.find((e) => e.id === 'athena-altar').methods).toContain('apyra-hiera');
  });
  it('dates the rest of the sequence', () => {
    expect(at(-400, 'type')).toContain('archaic-temple');
    expect(at(-400, 'type')).not.toContain('athena-temple');
    expect(at(-250, 'type')).toContain('propylaia');
    expect(at(-250, 'type')).not.toContain('great-stoa');
    expect(at(-190, 'type')).not.toContain('ship-relief');
    expect(at(-50, 'type')).toContain('lindian-chronicle');
    expect(at(1400, 'type')).toEqual(expect.arrayContaining(['knights-castle', 'church-st-john']));
    expect(at(1400, 'type')).not.toContain('italian-restoration');
    expect(at(1950, 'type')).toContain('italian-restoration');
  });
});
