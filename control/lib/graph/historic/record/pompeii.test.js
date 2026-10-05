import { describe, it, expect } from 'vitest';
import { checkRecord, inUseAt } from '../record.js';
import { POMPEII_RECORD, POMPEII_READ_AT, POMPEII_DATES, POMPEII_STATES } from './pompeii.js';

describe('stage 1 record: Pompeii', () => {
  const findings = checkRecord(POMPEII_RECORD);
  const at = (y, kind) => inUseAt(POMPEII_RECORD, y, kind).map((e) => e.id);
  const byId = (id) => POMPEII_RECORD.find((e) => e.id === id);
  it('has no errors: every entry cited, dated, and built only from what was attested by then', () => {
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('reports its unverified entries as warnings (the known gaps)', () => {
    const gaps = findings.filter((f) => f.level === 'warn').map((f) => f.id).sort();
    expect(gaps).toEqual(POMPEII_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
    expect(gaps.length).toBeGreaterThan(0);
  });
  it('at 79 CE: the forum, the theatres, the baths and the houses stand; no eruption, no Gran Cono, no ruins', () => {
    expect(POMPEII_READ_AT).toBe(POMPEII_DATES.eruption);
    const y = POMPEII_READ_AT;
    expect(at(y, 'type')).toEqual(expect.arrayContaining(['forum-square', 'capitolium', 'basilica', 'temple-apollo', 'temple-venus', 'macellum', 'eumachia', 'forum-baths', 'stabian-baths', 'central-baths', 'triangular-forum', 'large-theatre', 'odeon', 'temple-isis', 'atrium-house', 'taberna', 'bakery', 'porta-marina']));
    for (const late of ['maiuri-rebuilds', 'theatre-modern-seating']) expect(at(y, 'type')).not.toContain(late);
    expect(at(y, 'material')).toEqual(expect.arrayContaining(['sarno-limestone', 'nocera-tuff', 'lava-stone', 'lime-concrete', 'fired-brick', 'roof-tile', 'painted-plaster', 'marble-veneer']));
    expect(at(y, 'material')).not.toContain('pappamonte-tuff');
    expect(at(y, 'method')).toContain('fourth-style');
    expect(at(y, 'method')).not.toContain('first-style');
    expect(at(y, 'form')).toEqual(expect.arrayContaining(['walled-town', 'lava-spur', 'vesuvius-before', 'post-quake-repairs']));
    for (const late of ['eruption', 'gran-cono', 'modern-coast', 'excavated-ruins', 'bomb-damage-1943']) expect(at(y, 'form')).not.toContain(late);
  });
  it('every building carries its state at 79, and the earthquake\'s work is drawn as unfinished', () => {
    for (const t of POMPEII_RECORD.filter((e) => e.kind === 'type')) expect(POMPEII_STATES, t.id).toContain(t.state);
    expect(byId('capitolium').state).toBe('damaged');
    expect(byId('macellum').state).toBe('damaged');
    for (const id of ['temple-venus', 'central-baths', 'forum-portico-travertine']) expect(byId(id).state).toBe('unfinished');
    for (const id of ['temple-apollo', 'eumachia', 'forum-square']) expect(byId(id).state).toBe('under-repair');
    expect(byId('temple-isis').state).toBe('repaired');
    expect(byId('doric-temple').state).toBe('relic');
  });
  it('dates the rest: before 62 no repairs; before the colony no Odeon; after 79 the eruption and the cone', () => {
    expect(at(60, 'form')).not.toContain('post-quake-repairs');
    expect(at(60, 'type')).not.toContain('central-baths');
    expect(at(-90, 'type')).not.toContain('odeon');
    expect(at(-90, 'type')).not.toContain('forum-baths');
    expect(at(-500, 'type')).toContain('walls-pappamonte');
    expect(at(-500, 'type')).not.toContain('walls-quadratum');
    expect(at(80, 'form')).toEqual(expect.arrayContaining(['eruption', 'gran-cono']));
    expect(at(80, 'form')).not.toContain('vesuvius-before');
    expect(at(1950, 'type')).toContain('maiuri-rebuilds');
  });
});
