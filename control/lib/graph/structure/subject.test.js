// A room and a house are different things. The laws: one space (halls aside) is a room, read as a room everywhere
// (its book, its checks, its open steps) and never judged as a home; a house is livable only with a kitchen, a bathroom
// and a bedroom, and says what it lacks.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { checkRows } from './tables.js';
import { openConcerns, nextSteps } from './open.js';
import { structureBookHtml } from './book-html.js';

const ROOM = { kind: 'floorplan', title: 'Showroom', seed: 7, width: 24, height: 20, rooms: [{ x: 2, y: 2, w: 20, h: 16, glyph: 'L' }], furnish: true, view: 'cutaway', windows: true };
const HOME = { kind: 'floorplan', title: 'Home', seed: 5, storeys: 2, windows: true };
const ROOMS = { kind: 'floorplan', title: 'Rooms', seed: 3, windows: true };   // the single-floor generator: no kitchen, no bath

describe('a room', () => {
  const r = readStructure(ROOM);
  it('is a room, with no dwelling verdict and no adjacency advice', () => {
    expect(r.subject).toBe('room');
    expect(r.dwelling).toBeUndefined();
    const rows = checkRows(r);
    expect(rows.some((c) => c.rule === 'dwelling')).toBe(false);
    expect(rows.some((c) => c.rule === 'grade:adjacency' || /mustTouch/.test(c.detail))).toBe(false);
  });
  it('is offered only what a room takes: furnishing, windows, drawings', () => {
    const ids = nextSteps({ ...ROOM, furnish: undefined, view: undefined, windows: undefined }, readStructure({ ...ROOM, furnish: undefined, view: undefined, windows: undefined })).map((s) => s.id);
    for (const id of ids) expect(['furnishing', 'windows', 'sheets']).toContain(id);
    expect(ids).toContain('sheets');
  });
  it('reads as a Room book that says it is not a house', () => {
    const html = structureBookHtml(ROOM, { ref: 'sk_room' });
    expect(html).toContain('<b>Room book</b>');
    expect(html).toContain('A room, not a house');
    expect(html).not.toContain('Livability ·');
  });
});

describe('a house', () => {
  it('with a kitchen, a bathroom and a bedroom is a home', () => {
    const r = readStructure(HOME);
    expect(r.subject).toBe('house');
    expect(r.dwelling).toMatchObject({ kitchen: true, bathroom: true, bedroom: true, missing: [] });
    expect(checkRows(r).find((c) => c.rule === 'dwelling')).toMatchObject({ ok: true });
    expect(structureBookHtml(HOME, { ref: 'sk_home' })).toContain('<b>Structure book</b>');
  });
  it('without one is not livable, says what it lacks, and names the step', () => {
    const r = readStructure(ROOMS);
    expect(r.subject).toBe('house');
    expect(r.dwelling.missing.length).toBeGreaterThan(0);
    expect(checkRows(r).find((c) => c.rule === 'dwelling')).toMatchObject({ ok: false, detail: expect.stringMatching(/^not livable as a home: it has no /) });
    expect(openConcerns(ROOMS, r).find((c) => c.id === 'dwelling')).toMatchObject({ outcome: 'layout', tab: 'Plan' });
    expect(structureBookHtml(ROOMS, { ref: 'sk_rooms' })).toContain('A house, not yet a home: no ');
  });
});

describe('a house that is not a home is never ok', () => {
  it('cannot be waived into a home', () => {
    const waived = { ...ROOMS, design: { waive: ['dwelling'] } };
    const row = checkRows(readStructure(waived)).find((c) => c.rule === 'dwelling');
    expect(row).toMatchObject({ ok: false });
    expect(row.waived).toBeUndefined();
    expect(openConcerns(waived, readStructure(waived)).some((c) => c.id === 'dwelling')).toBe(true);
  });
  it('shows "a home: no" beside the plan grade', () => {
    const html = structureBookHtml(ROOMS, { ref: 'sk_rooms' });
    expect(html).toMatch(/<b class="advise">no<\/b><span>a home: no /);
    expect(html).toContain('plan grade (rooms, not the home)');
  });
});
