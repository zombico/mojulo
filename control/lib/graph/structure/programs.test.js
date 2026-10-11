// structure/programs — a store, a restaurant and a mall read as the buildings they are. The laws: each carries its
// occupancy and is a building, never a home; its rooms are named by role; no residential judgment (egress windows,
// adjacency, a home, a bathroom's fixtures) is made of it; it is graded by reachability and its program's rules; its
// fit-out is tagged objects, each in a room; a two-level mall is reached by its escalators and lifts; the book, the
// sheets and the tables read it; and reading it changes nothing a kernel returns or a World draws.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { checkRows, allTables, unreachedLevels } from './tables.js';
import { openConcerns, nextSteps, COMMERCIAL_CARD } from './open.js';
import { structureBookHtml } from './book-html.js';
import { drawingSet } from './sheets/index.js';
import { STRUCTURE_KINDS, OCCUPANCIES, programGrade, roleName } from './programs.js';
import { BOOK_KINDS } from '../sketch/display-modes.js';
import { buildRestaurant } from '../polygonizer/floorplan-restaurant.js';
import { buildMallTwoLevel } from '../polygonizer/floorplan-mall.js';

const BUILDINGS = {
  store: { kind: 'store', title: 'Pages', card: 'bookstore' },
  apparel: { kind: 'store', title: 'Threads', card: 'apparel', width: 30, depth: 50 },
  restaurant: { kind: 'restaurant', title: 'Corner café' },
  mall: { kind: 'mall', title: 'Arcade' },
  mall2: { kind: 'mall', title: 'Atrium', levels: 2 },
};
const reads = Object.fromEntries(Object.entries(BUILDINGS).map(([k, m]) => [k, readStructure(m)]));
const HOUSE_WORDS = /^(lounge|storage|bathroom|hallway|dining|bedroom|living)$/;   // the glyphs' house names (a restaurant's kitchen is a kitchen)

describe('the programs the book reads', () => {
  it('are the house and the three commercial kinds, the same list the dashboard opens as a book', () => {
    expect([...STRUCTURE_KINDS].sort()).toEqual(['floorplan', 'mall', 'restaurant', 'store']);
    expect([...BOOK_KINDS].sort()).toEqual([...STRUCTURE_KINDS].sort());
    expect(OCCUPANCIES.restaurant.group).toBe('A-2');
    expect(readStructure({ kind: 'condo-complex' })).toBeNull();
  });
});

describe('a commercial building, read as what it is', () => {
  for (const [k, r] of Object.entries(reads)) {
    it(`${k}: a building with its occupancy, never a home`, () => {
      expect(r.subject).toBe('building');
      expect(r.occupancy.id).toBe(BUILDINGS[k].kind);
      expect(r.dwelling).toBeUndefined();
      expect(r.program).toBeUndefined();
      expect(r.schedules.egress).toEqual([]);
      expect(r.schedules.adjacency).toEqual([]);
      expect(r.elements.roof).toBeNull();
      expect(r.site).toBeUndefined();
      expect(r.construction).toBeUndefined();
      const rules = new Set(checkRows(r).map((c) => c.rule));
      for (const house of ['dwelling', 'egress', 'fixture-clearance', 'walkway']) expect(rules.has(house), house).toBe(false);
    });

    it(`${k}: rooms named by role, the costume glyph never shown`, () => {
      for (const room of r.rooms) {
        expect(room.name, room.tag).not.toMatch(HOUSE_WORDS);
        expect(room.name).toBe(roleName(room.role, room.name));
      }
    });

    it(`${k}: graded by reachability and its program, never as a house`, () => {
      expect(Object.keys(r.grade.breakdown)).toEqual(['reachability', OCCUPANCIES[BUILDINGS[k].kind].program || 'store']);
      expect(r.grade.violations).toEqual(r.grade.findings.map((f) => f.detail));
      for (const f of r.grade.findings) expect(f.detail).not.toMatch(/egress|bathroom|bedroom|lounge|house has/);
    });

    it(`${k}: its fit-out is tagged objects, each standing in a room`, () => {
      expect(r.objects.pieces.length).toBeGreaterThan(0);
      const rooms = new Map(r.rooms.map((x) => [x.tag, x]));
      for (const p of r.objects.pieces) {
        const room = rooms.get(p.room);
        expect(room, `${p.mark} ${p.type}`).toBeTruthy();
        const cx = p.rect.x + p.rect.w / 2, cy = p.rect.y + p.rect.h / 2;
        expect(cx >= room.rect.x - 0.01 && cx <= room.rect.x + room.rect.w + 0.01 && cy >= room.rect.y - 0.01 && cy <= room.rect.y + room.rect.h + 0.01, p.mark).toBe(true);
      }
      expect(r.objects.types.reduce((a, t) => a + t.count, 0)).toBe(r.objects.pieces.length);
    });
  }

  it('a restaurant: its dining room, kitchen and restroom, each with what is built in it', () => {
    const r = reads.restaurant;
    expect(r.rooms.map((x) => x.name)).toEqual(['dining room', 'kitchen', 'restroom']);
    const codes = (name) => new Set(r.objects.pieces.filter((p) => r.rooms.find((x) => x.tag === p.room).name === name).map((p) => p.tag.split('-')[0]));
    expect(codes('dining room')).toEqual(new Set(['BB', 'BR', 'ST', 'SC', 'BQ', 'TB', 'CH']));
    expect(codes('kitchen')).toEqual(new Set(['CL', 'RF', 'PL', 'IS', 'PS']));
    expect(codes('restroom')).toEqual(new Set(['LAV', 'WC']));
  });

  it('a two-level mall: its upper floor reached by escalator and lift, so no level is left unreached', () => {
    const r = reads.mall2;
    expect(r.storeys.map((s) => s.index)).toEqual([0, 1]);
    expect(r.elements.stairs).toEqual([]);
    expect(r.elements.verticals.map((v) => v.kind)).toEqual(['escalator', 'elevator']);
    expect(unreachedLevels(r)).toEqual([]);
    expect(checkRows(r).find((c) => c.rule === 'stair-reach')).toMatchObject({ ok: true, detail: '1 escalator, 1 lift reach every level' });
  });

  it("a carded mall's shop keeps its own restroom: it is not a unit without a storefront", () => {
    expect(reads.mall.grade.findings.filter((f) => f.id === 'storefront-on-concourse')).toEqual([]);
  });
});

describe('the program rules advise', () => {
  // a kitchen with no door of its own to the outside, and a restroom reached only through it
  const space = (id, role, connects) => ({ id, role, connects, storey: 'storey:0', footprint: { x: 0, y: 0, w: 10, h: 10 }, name: roleName(role) });
  const model = {
    building: { footprint: { x0: 0, y0: 0, x1: 30, y1: 10 } }, storeys: [{ id: 'storey:0', index: 0 }],
    spaces: [space('d', 'dining', ['k']), space('k', 'kitchenBOH', ['d', 'w']), space('w', 'restroom', ['k'])],
    openings: [{ type: 'door', exterior: true, connects: ['d'] }],
  };
  it('names each finding in words and lowers the grade, never refusing', () => {
    const g = programGrade(model, { reachability: [] }, OCCUPANCIES.restaurant);
    expect(g.findings.map((f) => f.id).sort()).toEqual(['foh-boh-separation', 'kitchen-service-exit']);
    expect(g.breakdown.restaurant).toBeLessThan(1);
    expect(g.violations).toContain('restroom is only reachable by walking through the kitchen');
  });
  it('counts a space no door reaches', () => {
    const g = programGrade(model, { reachability: [{ storey: 0, isolated: [{ id: 'w', name: 'restroom' }] }] }, OCCUPANCIES.restaurant);
    expect(g.findings[0]).toMatchObject({ id: 'reachability', detail: 'restroom on level 1 has no door into the restaurant' });
    expect(g.breakdown.reachability).toBeCloseTo(2 / 3, 2);
  });
});

describe('the book, the sheets and the tables read it', () => {
  for (const [k, m] of Object.entries(BUILDINGS)) {
    it(`${k}: a book in its own words, every link landing on an id`, () => {
      const html = structureBookHtml(m, { read: reads[k], ref: `sk_${k}` });
      expect(html).toContain(`A ${reads[k].occupancy.label}: ${reads[k].occupancy.name} occupancy (${reads[k].occupancy.group})`);
      expect(html).toContain(`A ${reads[k].occupancy.label}, not a home`);
      expect(html).toContain('<h4>Exits</h4>');
      expect(html).not.toMatch(/<h4>Egress<\/h4>|A house, not yet a home|a home: no/);
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
      for (const [, h] of html.matchAll(/href="#([^"]+)"/g)) expect(ids.has(h), `${k} #${h}`).toBe(true);
      const tabs = [...html.slice(html.indexOf('<nav class="tabs"'), html.indexOf('</nav>')).matchAll(/href="#([a-z]+)"/g)].map((x) => x[1]);
      for (const house of ['site', 'structure', 'services', 'quantities']) expect(tabs).not.toContain(house);
    });
  }

  it('a sheet set with its plans per level, titled by the building when the row has no title', () => {
    const sheets = drawingSet(reads.mall2);
    expect(sheets.filter((s) => /^A-10/.test(s.id)).length).toBe(2);
    const untitled = drawingSet(readStructure({ kind: 'store', card: 'bookstore' }));
    expect(untitled[0].svg).toContain('>mojulo store<');
  });

  it('an FF&E schedule with every piece, by its tag', () => {
    const ffe = allTables(reads.restaurant).find((t) => t.id === 'objects');
    expect(ffe.rows.length).toBe(reads.restaurant.objects.types.length);
  });
});

describe('Open and next: what the program adds, taught by one card', () => {
  it('a one-level mall offers its upper floor; a bare mall its cards; a store its cast; all the drawing set', () => {
    expect(nextSteps(BUILDINGS.mall, reads.mall).map((s) => s.id)).toEqual(['upper-floor', 'sheets']);
    expect(nextSteps(BUILDINGS.mall2, reads.mall2).map((s) => s.id)).toEqual(['sheets']);
    const bare = { ...BUILDINGS.mall, cards: false };
    expect(openConcerns(bare, readStructure(bare)).map((c) => c.id)).toContain('fit-out');
    const noCast = { ...BUILDINGS.apparel, cast: false };
    expect(openConcerns(noCast, readStructure(noCast)).map((c) => c.id)).toContain('cast');
    for (const s of nextSteps(BUILDINGS.store, reads.store)) expect(s.card).toBe(COMMERCIAL_CARD);
  });
});

describe('reading changes nothing a kernel builds', () => {
  const faces = (r) => JSON.stringify(r.faces);
  it('a restaurant built for the read returns the same building and faces', () => {
    const plain = buildRestaurant({ seed: 3 }, { seed: 3 });
    const held = {};
    const read = buildRestaurant({ seed: 3 }, { seed: 3, _read: held });
    expect(Object.keys(read)).toEqual(Object.keys(plain));
    expect(faces(read)).toBe(faces(plain));
    expect(held.structure.wallGraph).toBeTruthy();
    expect(held.objects.length).toBeGreaterThan(0);
  });
  it("a two-level mall's structure rides beside the same faces", () => {
    const b = buildMallTwoLevel({}, {});
    expect(b.levels.map((l) => l.index)).toEqual([0, 1]);
    expect(b.levels[1].structure.slabHoles.length).toBe(3);   // the atrium void and the two lift shafts
  });
});
