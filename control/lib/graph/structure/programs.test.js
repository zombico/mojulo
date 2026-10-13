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
import { planFractalSchoolComplex } from '../architecture/fractal-school.js';

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
    expect([...STRUCTURE_KINDS].sort()).toEqual(['floorplan', 'mall', 'office', 'restaurant', 'school-complex', 'store']);
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

    it(`${k}: rooms named by role (a mall's by its bay and card too), the costume glyph never shown`, () => {
      for (const room of r.rooms) {
        expect(room.name, room.tag).not.toMatch(HOUSE_WORDS);
        const role = roleName(room.role, room.name);
        expect(room.name).toBe(room.unit ? `${room.unit.card.toLowerCase()} ${role} (bay ${room.unit.bay})` : role);
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

describe('what the cold agents could not see, said', () => {
  it("a fit-out that gave fixtures up to fit says so: the grade advises, never a silent 100%", () => {
    const fit = reads.mall.grade.findings.filter((f) => f.id === 'fit-out');
    expect(fit.length).toBeGreaterThan(0);
    expect(fit[0].detail).toMatch(/^bay \d+: .+ (left out|downsized to .+|shortened|split in two) to fit \(|^bay \d+: the .+ cell did not fit$/);
    expect(reads.mall.grade.score).toBeLessThan(1);
  });

  it("a mall's rooms say whose they are: the bay `cards` takes, its kind and its card", () => {
    const anchors = reads.mall.rooms.filter((r) => r.unit?.kind === 'anchor');
    expect(new Set(anchors.map((r) => r.unit.bay))).toEqual(new Set([0, 1]));
    const wine = readStructure({ ...BUILDINGS.mall, cards: { 3: 'wine-bar' } }).rooms.filter((r) => r.unit?.bay === 3);
    expect(wine.length).toBeGreaterThan(0);
    for (const r of wine) expect(r.unit.card).toBe('Wine bar');
  });

  it('a two-level mall draws its escalators, lifts and atrium, tagged, and lists them with its elements', () => {
    const r = reads.mall2;
    expect(r.elements.verticals.map((v) => v.rects.length)).toEqual([2, 2]);
    expect(r.elements.voids).toMatchObject([{ tag: 'AT1', from: 0, to: 1 }]);
    const [l1, l2] = drawingSet(r).filter((s) => /^A-10/.test(s.id));
    for (const sh of [l1, l2]) expect(sh.svg).toMatch(/data-tag="ES1"[\s\S]*data-tag="EL2"/);
    expect(l1.svg).toContain('>UP<');
    expect(l2.svg).toContain('AT1 OPEN TO BELOW');
    expect(structureBookHtml(BUILDINGS.mall2, { read: r })).toContain('Slabs, voids, escalators and lifts');
  });

  it("a storefront is drawn as a cased opening, not a leaf that swings across the floor", () => {
    const entry = reads.store.elements.doors.find((d) => d.width > 8);
    expect(entry.cased).toBe(true);
    const plan = drawingSet(reads.store).find((s) => s.id === 'A-101').svg;
    expect(plan).toContain(`class="s-door s-cased" data-tag="${entry.tag}"`);
  });

  it('a restaurant says its seats as laid and the occupant load, and the lot its walls stand in from', () => {
    const r = reads.restaurant;
    expect(r.capacity.seats).toBeGreaterThan(0);
    expect(r.capacity.occupantLoad).toBeGreaterThan(r.capacity.seats);
    expect(r.parcel).toEqual({ width: 48, height: 64, inset: 2 });
    const html = structureBookHtml(BUILDINGS.restaurant, { read: r });
    expect(html).toContain(`${r.capacity.seats} seats as laid`);
    expect(html).toContain('lot, the walls 2&#39;-0&quot; in from it'.replace('&#39;', "'"));
  });

  it("a commercial book offers no IFC, and a room that needs no window is never told it needs one", () => {
    const html = structureBookHtml(BUILDINGS.store, { read: reads.store });
    expect(html).not.toContain("format: 'ifc'");
    expect(html).not.toContain('needs one');
  });

  it('fixtures carry one mark each and are named in words', () => {
    const r = readStructure({ kind: 'store', card: 'wine-bar' });
    const marks = new Map(r.objects.types.map((t) => [t.type, t.tag.split('-')[0]]));
    expect(marks.get('back-bar')).toBe('BB');
    expect(marks.get('banquette')).toBe('BQ');
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
    expect(nextSteps(BUILDINGS.mall, reads.mall).map((s) => s.id)).toEqual(['upper-floor', 'program-rules', 'sheets']);   // its small bays gave fixtures up
    expect(nextSteps(BUILDINGS.mall2, reads.mall2).map((s) => s.id)).toEqual(['program-rules', 'sheets']);
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

describe('a school: a campus read by its own plan', () => {
  const SCHOOLS = { cluster: { kind: 'school-complex', seed: 1 }, courtyard: { kind: 'school-complex', seed: 2, pattern: 'courtyard' }, spine: { kind: 'school-complex', seed: 3, pattern: 'spine' } };
  const sr = Object.fromEntries(Object.entries(SCHOOLS).map(([k, m]) => [k, readStructure(m)]));
  const plans = Object.fromEntries(Object.entries(SCHOOLS).map(([k, m]) => [k, planFractalSchoolComplex(m)]));

  for (const [k, r] of Object.entries(sr)) {
    it(`${k}: educational, a building of its campus's rooms, each named by kind`, () => {
      expect(r.occupancy).toMatchObject({ id: 'school', group: 'E' });
      expect(r.subject).toBe('building');
      const kinds = new Set(plans[k].rooms.map((x) => roleName(x.kind)));
      for (const name of kinds) expect(r.rooms.some((x) => x.name === name), name).toBe(true);
      expect(r.rooms.filter((x) => x.storey === 0 && x.role !== 'circulation').length).toBe(plans[k].rooms.length);
    });

    it(`${k}: each building's floor is tiled exactly by its rooms and corridors, and each upper floor by one shell`, () => {
      for (const bd of plans[k].buildings) {
        const R = bd.rect, area = (R.x1 - R.x0) * (R.y1 - R.y0);
        for (let L = 0; L < (bd.floors ?? 1); L++) {
          const inside = r.rooms.filter((x) => x.storey === L && x.rect.x >= R.x0 - 0.01 && x.rect.x + x.rect.w <= R.x1 + 0.01 && x.rect.y >= R.y0 - 0.01 && x.rect.y + x.rect.h <= R.y1 + 0.01);
          expect(inside.reduce((a, x) => a + x.rect.w * x.rect.h, 0), `${bd.id} L${L}`).toBeCloseTo(area, 0);
          if (L > 0) expect(inside.map((x) => x.role)).toEqual(['unplanned']);
        }
      }
      // a storey's slab is the buildings standing on it
      expect(r.elements.slabs[0].area).toBeCloseTo(plans[k].buildings.reduce((a, b) => a + (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0), 0), 0);
    });

    it(`${k}: one tag per door, even where two walks meet a wall at one point`, () => {
      const tags = r.elements.doors.map((d) => d.tag);
      expect(new Set(tags).size).toBe(tags.length);
    });

    it(`${k}: every room has a door, and every level is reached by a stair core`, () => {
      for (const room of r.rooms.filter((x) => x.storey === 0)) expect(room.doors.length, `${room.tag} ${room.name}`).toBeGreaterThan(0);
      expect(unreachedLevels(r)).toEqual([]);
      for (const v of r.elements.verticals) expect(v).toMatchObject({ kind: 'stair', from: 0 });
    });

    it(`${k}: graded by the school's own assessors, said by tag and name, never by the kernel's ids`, () => {
      expect(Object.keys(r.grade.breakdown)).toEqual(['reachability', 'school']);
      for (const v of r.grade.violations) expect(v).not.toMatch(/room:|building:/);
    });
  }

  it('has the windows its facade paints, so its rooms are daylit and scheduled', () => {
    for (const r of Object.values(sr)) {
      expect(r.elements.windows.length).toBeGreaterThan(0);
      const classrooms = r.rooms.filter((x) => x.role === 'classroom');
      expect(classrooms.filter((x) => x.windows.length > 0).length).toBeGreaterThan(classrooms.length / 2);
      // one whose window wall a walk's doorway takes is dark in the World too, and the grade says so
      for (const x of classrooms.filter((y) => !y.windows.length)) expect(r.grade.findings.some((f) => f.id === 'no-daylight' && f.detail.startsWith(`${x.tag} `))).toBe(true);
    }
  });

  it('names what its pattern leaves out of the program, and rooms under common planning sizes', () => {
    const spine = sr.spine.grade.findings;
    expect(spine.filter((f) => f.id === 'program-space').map((f) => f.detail)).toEqual(expect.arrayContaining([expect.stringMatching(/^no library/), expect.stringMatching(/^no cafeteria/)]));
    expect(sr.courtyard.grade.findings.some((f) => f.id === 'program-space' && /^no gym/.test(f.detail))).toBe(true);
    expect(spine.some((f) => f.id === 'classroom-size')).toBe(true);
    expect(sr.spine.grade.score).toBeLessThan(0.9);
  });

  it('says where its entrance and cores land when they land in a room', () => {
    const ids = new Set(sr.cluster.grade.findings.map((f) => f.id));
    expect(ids.has('entry-into-room') || ids.has('core-in-room')).toBe(true);
    for (const f of sr.cluster.grade.findings.filter((x) => x.id === 'core-in-room')) expect(f.detail).toMatch(/^the stair core of the .+ building stands in \d{3} /);
  });

  it('titles a shell floor as a shell and draws the covered walks between the buildings', () => {
    const sheets = drawingSet(sr.cluster);
    expect(sheets.find((x) => x.id === 'A-102').title).toBe('Second floor plan (shell, not planned)');
    expect(sheets.find((x) => x.id === 'A-101').svg).toContain('COVERED WALK');
  });

  it("names what it cannot plan: the upper floors are the school's shells", () => {
    expect(openConcerns(SCHOOLS.cluster, sr.cluster).map((c) => c.id)).toContain('upper-floors');
  });

  it('a book and a drawing set: a plan per level at a campus scale, its stair cores drawn and tagged', () => {
    const sheets = drawingSet(sr.cluster);
    const plansA = sheets.filter((s) => /^A-10/.test(s.id));
    expect(plansA.length).toBe(sr.cluster.storeys.length);
    expect(plansA[0].svg).toMatch(/data-tag="ST1"/);
    const html = structureBookHtml(SCHOOLS.cluster, { read: sr.cluster, ref: 'sk_school' });
    expect(html).toContain('A school: educational occupancy (E)');
    expect(html).toContain('campus (elementary) of 5 buildings');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
    for (const [, h] of html.matchAll(/href="#([^"]+)"/g)) expect(ids.has(h), h).toBe(true);
  });
});
