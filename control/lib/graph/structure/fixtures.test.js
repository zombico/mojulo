// The book reads a fitted bathroom. The laws: each fixture is tagged by the mark a plumber reads and scheduled at its
// catalogue size; every fixture's clearance is checked, and a bathroom that cannot hold a tub or shower says so; a
// house that is not fitted has no fixture schedule and no fixture check.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { checkRows, allTables, fixtureClearance } from './tables.js';
import { structureBookHtml } from './book-html.js';

const FITTED = { kind: 'floorplan', title: 'f', seed: 21, storeys: 2, windows: true, furnish: true, furnishing: 'fitted' };
const CRAMPED = { kind: 'floorplan', title: 'c', seed: 3, width: 17.6, height: 14, furnish: true, furnishing: 'fitted', windows: true,
  rooms: [{ x: 0, y: 0, w: 12, h: 14, glyph: 'L' }, { x: 12, y: 0, w: 5.6, h: 8, glyph: 'B' }, { x: 12, y: 8, w: 5.6, h: 6, glyph: 'W' }] };

describe('the fitted bathroom in the book', () => {
  const r = readStructure(FITTED);
  it('tags each fixture by its plumbing mark and schedules it at its size', () => {
    const marks = r.objects.types.filter((t) => /^fixture-/.test(t.type)).map((t) => t.tag.split('-')[0]);
    expect(new Set(marks)).toEqual(new Set(['TUB', 'WC', 'LAV', 'MIR', 'SHR', 'TR']));
    const t = allTables(r).find((x) => x.id === 'fixtures');
    expect(t.title).toBe('Plumbing fixture schedule');
    expect(t.rows.find((x) => x.tag.startsWith('TUB')).size).toBe(`5'-0" × 2'-6" × 1'-8"`);
  });
  it('checks every fixture clearance, and passes a bathroom laid out by the rules', () => {
    expect(fixtureClearance(r)).toEqual([]);
    expect(checkRows(r).find((c) => c.rule === 'fixture-clearance')).toMatchObject({ ok: true, source: 'livability' });
    expect(structureBookHtml(FITTED, { ref: 'sk_f' })).toContain('Plumbing fixture schedule');
  });
  it('says what a cramped bathroom could not hold', () => {
    const c = readStructure(CRAMPED);
    const rows = checkRows(c).filter((x) => x.rule === 'fixture-clearance' && x.ok === false);
    expect(rows.map((x) => x.detail)).toContain('no bathtub or shower fits in this bathroom');
  });
  it('is absent from a house that is not fitted', () => {
    const plain = readStructure({ ...FITTED, furnishing: 'composed' });
    expect(allTables(plain).some((x) => x.id === 'fixtures')).toBe(false);
    expect(checkRows(plain).some((x) => x.rule === 'fixture-clearance')).toBe(false);
  });
});
