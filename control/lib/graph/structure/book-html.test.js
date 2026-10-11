// structure/book-html — the structure book. The laws: pure; a tab per concern the recipe reaches and an Open entry
// for each it does not; every link lands on an id; a room links the elements that bound it and back; every sheet of
// the set is a plate; the sheets stay paper in the dark.

import { describe, it, expect } from 'vitest';
import { structureBookHtml, openConcerns, anchors } from './book-html.js';
import { readStructure } from './read.js';
import { drawingSet } from './sheets/index.js';

const HOUSES = {
  full: { kind: 'floorplan', title: 'Full', seed: 7, levels: [{ index: 0 }, { index: 1 }], stairs: true, roof: { style: 'hip' }, windows: true, furnish: true, perimeter: true, framing: { system: 'platform' }, drainage: true },
  layout: { kind: 'floorplan', title: 'Layout', seed: 5, storeys: 2, roof: 'hip', furnish: true, windows: true },
  bare: { kind: 'floorplan', title: 'Bare', seed: 3, windows: true },
};
const books = Object.fromEntries(Object.entries(HOUSES).map(([k, m]) => [k, structureBookHtml(m, { ref: `sk_${k}` })]));
const tabsOf = (html) => [...html.slice(html.indexOf('<nav class="tabs"'), html.indexOf('</nav>')).matchAll(/href="#([a-z]+)"/g)].map((x) => x[1]);
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));

describe('structureBookHtml', () => {
  it('is pure: the same recipe gives the same page, with no clock in it', () => {
    expect(structureBookHtml(HOUSES.full, { ref: 'sk_full' })).toBe(books.full);
    expect(books.full).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  it('throws for a row that is not a house', () => {
    expect(() => structureBookHtml({ kind: 'store' })).toThrow(/not a house/);
  });

  it('shows a tab per concern the recipe reaches, and names each one it does not in Open', () => {
    expect(tabsOf(books.full)).toEqual(['cover', 'site', 'massing', 'plan', 'rooms', 'elements', 'objects', 'structure', 'services', 'quantities', 'checks', 'walk', 'open']);
    expect(tabsOf(books.layout)).toEqual(['cover', 'massing', 'plan', 'rooms', 'elements', 'objects', 'checks', 'walk', 'open']);
    expect(tabsOf(books.bare)).toEqual(['cover', 'massing', 'plan', 'rooms', 'elements', 'checks', 'walk', 'open']);
    const open = openConcerns(HOUSES.bare, readStructure(HOUSES.bare)).map((o) => o.tab);
    for (const t of ['Site', 'Massing', 'Objects', 'Structure', 'Services', 'Quantities']) expect(open).toContain(t);
    for (const o of openConcerns(HOUSES.bare, readStructure(HOUSES.bare))) expect(books.bare).toContain(`<code>${o.field}</code>`);
    expect(openConcerns(HOUSES.full, readStructure(HOUSES.full))).toEqual([]);
  });

  it('every in-page link lands on an id, and no id is used twice', () => {
    for (const [k, html] of Object.entries(books)) {
      const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
      expect(all.length, k).toBe(new Set(all).size);
      const ids = idsOf(html);
      for (const [, h] of html.matchAll(/href="#([^"]+)"/g)) expect(ids.has(h), `${k} #${h}`).toBe(true);
    }
  });

  it('a room links the walls that bound it, its doors and its objects, and each of those links back', () => {
    const r = readStructure(HOUSES.full), html = books.full;
    for (const room of r.rooms) {
      const card = html.slice(html.indexOf(`id="${anchors.room(room.tag)}"`), html.indexOf('</article>', html.indexOf(`id="${anchors.room(room.tag)}"`)));
      for (const w of room.walls) expect(card, `${room.tag} ${w}`).toContain(`href="#${anchors.wall(w)}"`);
      for (const d of room.doors) expect(card).toContain(`href="#${anchors.door(d)}"`);
      // the wall's row names the room it bounds
      for (const w of room.walls) {
        const row = html.slice(html.indexOf(`id="${anchors.wall(w)}"`), html.indexOf('</tr>', html.indexOf(`id="${anchors.wall(w)}"`)));
        expect(row, `${w} → ${room.tag}`).toContain(`href="#${anchors.room(room.tag)}"`);
      }
    }
    for (const t of r.objects.types) expect(html).toContain(`id="${anchors.objectType(t.tag)}"`);
    for (const t of r.construction.memberTypes) expect(html).toContain(`id="${anchors.member(t.tag)}"`);
  });

  it('carries every sheet of the set as a plate, linked from the sheet index', () => {
    for (const [k, m] of Object.entries(HOUSES)) {
      for (const s of drawingSet(readStructure(m), { project: m.title })) {
        expect(books[k], `${k} ${s.id}`).toContain(`<!--plate:${s.id}-->`);
        expect(books[k]).toContain(`href="#sh-${s.id}"`);
      }
    }
  });

  it('keeps the sheets as paper when the frame goes dark', () => {
    expect(books.full).toMatch(/@media \(prefers-color-scheme:dark\)/);
    expect(books.full).toMatch(/\.sheet svg\{[^}]*--paper:#fff;--ink:#111/);
  });

  it('frames the World when given one, and says how to get it when not', () => {
    expect(structureBookHtml(HOUSES.bare, { ref: 'sk_b', world: { src: '/api/sketches/sk_b/world' } })).toContain('src="/api/sketches/sk_b/world"');
    expect(books.bare).toContain("format: 'html'");
    expect(books.bare).toContain("levels: [{ ref: 'sk_bare' }]");
  });

  it('a ref piece links its own page, titled by the lookup', () => {
    const m = { kind: 'floorplan', title: 'h', width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L', items: [{ ref: 'sk_chair', at: [0.5, 0.6], size: [2, 2] }] }], view: 'cutaway', seed: 7 };
    const html = structureBookHtml(m, { ref: 'sk_h', lookup: (r) => (r === 'sk_chair' ? { title: 'Oak chair' } : null) });
    expect(html).toContain('<a href="/sketches/sk_chair">Oak chair</a>');
  });
});
