// The drawing set beyond the plans: elevations, sections, the site, the schedules. The laws: the same recipe draws
// the same bytes, each sheet draws what the read holds and names it by its tag, and the numbers are the read's.

import { describe, it, expect } from 'vitest';
import { readStructure } from '../read.js';
import { elevationsSheets, FACES, levelsOf } from './elevations.js';
import { sectionSheet, sectionCut } from './section.js';
import { siteSheet } from './site.js';
import { scheduleSheets, scheduleTables, tableCsv } from './schedules.js';
import { drawingSet, sheetIndex } from './index.js';

const HOUSES = {
  storeys: { kind: 'floorplan', title: 'Two storey', seed: 5, storeys: 2, roof: 'gable', furnish: true, windows: true, perimeter: true },
  hip: { kind: 'floorplan', title: 'Hip one storey', seed: 7, levels: [{ index: 0 }], roof: { style: 'hip' }, windows: true },
  flat: { kind: 'floorplan', title: 'Flat', seed: 3, windows: true },
};
const reads = Object.fromEntries(Object.entries(HOUSES).map(([k, m]) => [k, readStructure(m)]));

describe('the set', () => {
  it('binds in set order, and grows with the house', () => {
    expect(sheetIndex(drawingSet(reads.storeys)).map((s) => s.id)).toEqual(['C-101', 'A-101', 'A-102', 'A-201', 'A-202', 'A-301', 'A-601']);
    expect(sheetIndex(drawingSet(reads.flat)).map((s) => s.id)).toEqual(['A-101', 'A-201', 'A-202', 'A-301', 'A-601']);   // no lot, no C-101
  });

  it('is the same bytes for the same recipe', () => {
    const a = drawingSet(reads.storeys).map((s) => s.svg).join('');
    const b = drawingSet(readStructure(HOUSES.storeys)).map((s) => s.svg).join('');
    expect(a).toBe(b);
  });

  it('every sheet carries its id in its title block, on mm paper', () => {
    for (const sh of drawingSet(reads.storeys)) {
      expect(sh.svg).toContain(`>${sh.id}<`);
      expect(sh.svg).toMatch(/^<svg[^>]*width="431.8mm"/);
    }
  });
});

describe('A-20x — elevations', () => {
  it('draws each face as its viewer sees it: the north face has east on its left', () => {
    expect(FACES.N.u(10, 0)).toBeLessThan(FACES.N.u(0, 0));
    expect(FACES.S.u(10, 0)).toBeGreaterThan(FACES.S.u(0, 0));
    expect(FACES.E.u(0, 10)).toBeLessThan(FACES.E.u(0, 0));
    expect(FACES.W.u(0, 10)).toBeGreaterThan(FACES.W.u(0, 0));
  });

  it('every window on the envelope appears on exactly one face', () => {
    const r = reads.storeys;
    const svg = elevationsSheets(r).map((s) => s.svg).join('');
    const exteriorWalls = new Set(r.elements.walls.filter((w) => !w.interior).map((w) => w.tag));
    for (const w of r.elements.windows.filter((x) => exteriorWalls.has(x.host))) {
      expect(svg.split(`class="s-window" data-mark="${w.mark}"`).length - 1, w.mark).toBe(1);
    }
  });

  it('heads every floor and the top of the wall, measured from level 1', () => {
    const L = levelsOf(reads.storeys);
    expect(L.map((l) => l.name)).toEqual(['LEVEL 1', 'LEVEL 2', 'T.O. WALL']);
    expect(L[0].rel).toBe(0);
    const s1 = reads.storeys.storeys[1];
    expect(L[1].rel).toBeCloseTo(s1.baseZ - reads.storeys.storeys[0].baseZ, 6);
  });

  it('draws the roof when the house has one, and holds all four faces at one scale', () => {
    const [a, b] = elevationsSheets(reads.hip);
    expect(a.scale).toBe(b.scale);
    expect(a.svg).toMatch(/<polygon class="s-paper"/);
    expect(elevationsSheets(reads.flat)[0].svg).not.toMatch(/<polygon class="s-paper" style/);
  });
});

describe('A-301 — sections', () => {
  it('cuts through the middle by default, along and across', () => {
    const r = reads.storeys, fp = r.footprint;
    expect(sectionCut(r)).toMatchObject({ axis: 'x', at: (fp.y0 + fp.y1) / 2 });
    expect(sectionCut(r, { axis: 'y', at: 0.25 }).at).toBeCloseTo(fp.x0 + 0.25 * (fp.x1 - fp.x0), 6);
  });

  it('cuts every wall the plane crosses, and every storey slab', () => {
    const r = reads.storeys, sh = sectionSheet(r);
    const C = sectionCut(r);
    const long = sh.svg.slice(sh.svg.indexOf('data-axis="x"'), sh.svg.indexOf('data-axis="y"'));
    for (const w of r.elements.walls.filter((x) => x.orientation === 'v' && x.along[0] <= C.at && C.at <= x.along[1])) {
      expect(long).toContain(`class="s-wall" data-tag="${w.tag}"`);
    }
    for (const s of r.elements.slabs) expect(long).toContain(`data-tag="${s.tag}"`);
  });

  it('names the rooms it passes through', () => {
    const r = reads.storeys, sh = sectionSheet(r), C = sectionCut(r);
    for (const room of r.rooms.filter((x) => x.rect.y < C.at && C.at < x.rect.y + x.rect.h)) expect(sh.svg).toContain(`>${room.tag}<`);
  });
});

describe('C-101 — the site', () => {
  it('is drawn only when the recipe has a lot', () => {
    expect(siteSheet(reads.flat)).toBeNull();
    const sh = siteSheet(reads.storeys);
    expect(sh.svg).toContain('STREET');
    expect(sh.svg).toContain('class="s-house"');
  });

  it('dimensions the setbacks the perimeter set', () => {
    const r = reads.storeys, lot = r.site.lot, fp = r.footprint, svg = siteSheet(r).svg;
    for (const ft of [fp.y0 - lot.y0, lot.y1 - fp.y1, fp.x0 - lot.x0]) expect(svg).toContain(`data-ft="${Math.round(ft * 1000) / 1000}"`);
  });
});

describe('A-60x — schedules', () => {
  it('a row per room, door, window type and wall type; the FF&E schedule when the house is furnished', () => {
    const r = reads.storeys, t = Object.fromEntries(scheduleTables(r).map((x) => [x.id, x]));
    expect(t.rooms.rows.map((x) => x.tag)).toEqual(r.rooms.map((x) => x.tag));
    expect(t.doors.rows.length).toBe(r.elements.doors.length);
    expect(t.windows.rows.reduce((a, x) => a + Number(x.count), 0)).toBe(r.elements.windows.length);
    expect(t.walls.rows.length).toBe(r.elements.wallTypes.length);
    expect(t.objects.rows.map((x) => x.tag)).toEqual(r.objects.types.map((x) => x.tag));
    expect(scheduleTables(reads.hip).some((x) => x.id === 'objects')).toBe(false);
  });

  it('every schedule row reaches a sheet, broken across columns and sheets with its header repeated', () => {
    const r = reads.storeys;
    const svg = scheduleSheets(r).map((s) => s.svg).join('');
    for (const t of scheduleTables(r)) for (const row of t.rows) expect(svg, `${t.id} ${row[t.columns[0].key]}`).toContain(`>${row[t.columns[0].key]}<`);
  });

  it('writes CSV as RFC 4180 does', () => {
    const csv = tableCsv({ columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], rows: [{ a: 'x,y', b: 'say "hi"' }] });
    expect(csv).toBe('A,B\n"x,y","say ""hi"""\n');
    const rooms = tableCsv(scheduleTables(reads.storeys)[0]);
    expect(rooms.split('\n')[0]).toBe('NO.,NAME,LEVEL,AREA');
    expect(rooms).toContain('GROSS');
  });
});
