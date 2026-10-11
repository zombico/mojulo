// structure/trades and the S-, E- and P-sheets. The laws: the frame read is the frame the world lowers, a mark on a
// sheet is a type in the key, the wiring names real rooms, the rainwater's counts are its report's, and the set binds
// the trades' sheets only when the recipe has them.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { sizeText, inchText, stockWidth, ROLES } from './trades.js';
import { framingSheets, frameSheets, framingKey } from './sheets/framing.js';
import { electricalSheets, drainageSheet, circuitTable } from './sheets/services.js';
import { drawingSet } from './sheets/index.js';

const HOUSES = {
  platform: { kind: 'floorplan', title: 'p', seed: 7, levels: [{ index: 0 }, { index: 1 }], stairs: true, roof: { style: 'gable' }, windows: true, framing: { system: 'platform' }, drainage: true },
  kigumi: { kind: 'floorplan', title: 'k', seed: 7, levels: [{ index: 0 }], roof: { style: 'hip' }, windows: true, framing: { system: 'kigumi' } },
  steel: { kind: 'floorplan', title: 's', seed: 4, levels: [{ index: 0 }], roof: { style: 'hip' }, windows: true, framing: { system: 'steel' } },
  rain: { kind: 'floorplan', title: 'r', seed: 5, storeys: 2, roof: 'gable', drainage: true },
  plain: { kind: 'floorplan', title: 'f', seed: 3, windows: true },
};
const reads = Object.fromEntries(Object.entries(HOUSES).map(([k, m]) => [k, readStructure(m)]));

describe('sizes, as a framer names them', () => {
  it('names dressed lumber nominally and anything else in inches', () => {
    expect(sizeText('2x6')).toBe('2x6');
    expect(sizeText([1.5 / 12, 11.25 / 12])).toBe('2x12');
    expect(sizeText([4.5 / 12, 12.45 / 12])).toBe('4 1/2 x 12 1/2');
    expect(inchText(13.25)).toBe('13 1/4');
    expect(inchText(0.375)).toBe('3/8');
    expect(stockWidth('2x6')).toBeCloseTo(1.5 / 12, 6);   // the narrow face; a plate lies on its wide face (`depth`)
  });
});

describe('the frame read', () => {
  it('is the frame the world lowers: every member but the sheathing, frame by frame', () => {
    for (const k of ['platform', 'kigumi', 'steel']) {
      const c = reads[k].construction;
      const sheets = (id) => c.report.frames.find((f) => f.id === id).members;
      for (const f of c.frames) {
        const skipped = sheets(f.id) - f.members.length;
        expect(skipped, `${k} ${f.id}`).toBeGreaterThanOrEqual(0);
        expect(f.members.every((m) => !ROLES[m.role]?.skip)).toBe(true);
      }
      expect(c.frames.map((f) => f.id)).toEqual(c.report.frames.map((f) => f.id));
    }
  });

  it('tags each singular member by type, every tag in the types, the same on a re-read', () => {
    const c = reads.platform.construction;
    const types = new Set(c.memberTypes.map((t) => t.tag));
    for (const f of c.frames) for (const m of f.members) {
      if (ROLES[m.role]?.tag) expect(types.has(m.tag), m.id).toBe(true);
      else expect(m.tag).toBeUndefined();
    }
    for (const t of c.memberTypes) expect(t.count).toBe(c.frames.flatMap((f) => f.members).filter((m) => m.tag === t.tag).length);
    expect(readStructure(HOUSES.platform).construction.memberTypes).toEqual(c.memberTypes);
  });

  it('reads the joists and rafters as fields at their spacing, and the studs by size', () => {
    const c = reads.platform.construction;
    const joists = c.frames.find((f) => f.id === 'foundation').fields.filter((x) => x.role === 'joist');
    expect(joists.length).toBeGreaterThan(0);
    for (const j of joists) expect(Math.round(j.spacing * 12)).toBe(16);
    expect(c.frames.find((f) => f.id === 'roof').fields.some((x) => x.role === 'rafter')).toBe(true);
    expect(c.frames.find((f) => f.id === 'storey-0').studs.map((s) => s.size).sort()).toEqual(['2x4', '2x6']);
  });

  it('is absent unframed', () => {
    expect(reads.rain.construction).toBeUndefined();
    expect(reads.rain.wiring).toBeUndefined();
  });
});

describe('the wiring read', () => {
  it('names every circuit room and checked room by a room tag of the house', () => {
    const tags = new Set(reads.platform.rooms.map((r) => r.tag));
    for (const c of reads.platform.wiring.circuits) for (const r of c.rooms) expect(tags.has(r), r).toBe(true);
    for (const ch of reads.platform.wiring.checks) if (ch.room !== undefined) expect(tags.has(ch.room), ch.room).toBe(true);
  });
});

describe('the rainwater read', () => {
  it('counts what its report counts, framed or not', () => {
    for (const k of ['platform', 'rain']) {
      const d = reads[k].drainage;
      expect(d.downpipes.length).toBe(d.report.downpipes.count);
      expect(d.gutters.length).toBe(d.report.gutters.runs);
      expect(d.outlets.length).toBe(d.report.outlets.count);
    }
    expect(reads.kigumi.drainage).toBeUndefined();   // no `drainage` in the recipe
  });
});

describe('S-sheets', () => {
  it('one per frame, foundation first and roof last, at one scale', () => {
    const sh = framingSheets(reads.platform);
    expect(sh.map((s) => [s.id, s.frame])).toEqual([['S-101', 'foundation'], ['S-102', 'storey-0'], ['S-103', 'storey-1'], ['S-104', 'roof']]);
    expect(new Set(sh.map((s) => s.scale)).size).toBe(1);
    expect(frameSheets(reads.platform).map((s) => s.title)).toEqual(['Foundation plan', 'Second floor framing plan', 'Second floor wall framing plan', 'Roof framing plan']);
  });

  it('every mark on a sheet is a row of its key, and every keyed piece is counted', () => {
    for (const k of ['platform', 'kigumi', 'steel']) {
      for (const s of framingSheets(reads[k])) {
        const frame = reads[k].construction.frames.find((f) => f.id === s.frame);
        const key = framingKey(reads[k], frame);
        const keyed = new Set(key.rows.map((r) => r.mark));
        for (const m of s.marks) expect(keyed.has(m), `${k} ${s.id} ${m}`).toBe(true);
        const tagged = frame.members.filter((m) => m.tag).length;
        expect(key.rows.filter((r) => r.mark !== '—').reduce((a, r) => a + Number(r.qty), 0)).toBe(tagged);
        for (const m of s.marks) expect(s.svg).toContain(`class="s-tag member" data-tag="${m}"`);
      }
    }
  });

  it('draws a field arrow per field', () => {
    const r = reads.platform, s = framingSheets(r).find((x) => x.frame === 'roof');
    const fields = r.construction.frames.find((f) => f.id === 'roof').fields;
    expect(s.svg.split('class="s-field"').length - 1).toBe(fields.length);
  });
});

describe('E- and P-sheets', () => {
  it('an electrical plan per wired storey, every device drawn once, the circuits scheduled', () => {
    const r = reads.platform, sh = electricalSheets(r);
    expect(sh.map((s) => s.id)).toEqual(['E-101', 'E-102']);
    for (const s of sh) {
      const devs = r.wiring.devices.filter((d) => d.storey === s.storey);
      expect(s.svg.split('class="s-device ').length - 1 - 4).toBe(devs.length);   // less the legend's four symbols
      for (const row of circuitTable(r, s.storey).rows) expect(s.svg).toContain(`>${row.no}<`);
    }
    expect(electricalSheets(reads.rain)).toEqual([]);
  });

  it('a roof drainage plan numbering every downspout', () => {
    const p = drainageSheet(reads.rain);
    expect(p.id).toBe('P-101');
    expect(p.downspouts).toBe(reads.rain.drainage.report.downpipes.count);
    for (let i = 1; i <= p.downspouts; i++) expect(p.svg).toContain(`data-tag="DS${i}"`);
    expect(drainageSheet(reads.plain)).toBeNull();
  });
});

describe('the set with its trades', () => {
  it('binds civil, structural, architectural, plumbing, electrical, each only when the recipe has it', () => {
    const ids = (r) => drawingSet(r).map((s) => s.id);
    expect(ids(reads.platform)).toEqual(['S-101', 'S-102', 'S-103', 'S-104', 'A-101', 'A-102', 'A-201', 'A-202', 'A-301', 'A-601', 'P-101', 'E-101', 'E-102']);
    expect(ids(reads.rain).filter((x) => !x.startsWith('A-'))).toEqual(['P-101']);
    expect(ids(reads.plain).every((x) => x.startsWith('A-'))).toBe(true);
  });

  it('is the same bytes for the same recipe, and holds no clock or dice', () => {
    expect(drawingSet(readStructure(HOUSES.platform)).map((s) => s.svg).join('')).toBe(drawingSet(reads.platform).map((s) => s.svg).join(''));
  });
});
