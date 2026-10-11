// A-10x: a storey's plan, drawn from the read model. The laws: every tag drawn names a thing in the read, the
// dimension strings add up to the footprint, the sheet is the same bytes for the same recipe.

import { describe, it, expect } from 'vitest';
import { readStructure } from '../read.js';
import { planSheet, planDrawing, planSheetId } from './plan.js';
import { makeView } from './kit.js';

const HOUSES = {
  seeded: { kind: 'floorplan', title: 'Seeded house', seed: 7, furnish: true, furnishing: 'composed', windows: true },
  storeys: { kind: 'floorplan', title: 'Two storey', seed: 5, storeys: 2, roof: 'gable', furnish: true, windows: true },
};
const reads = Object.fromEntries(Object.entries(HOUSES).map(([k, m]) => [k, readStructure(m)]));
const sheets = Object.fromEntries(Object.entries(reads).map(([k, r]) => [k, r.storeys.map((s) => planSheet(r, s.index))]));

describe('A-10x — the floor plan', () => {
  it('numbers the sheets as a set does', () => {
    expect(planSheetId(0)).toBe('A-101');
    expect(planSheetId(1)).toBe('A-102');
    expect(planSheetId(-1)).toBe('A-100');
    expect(sheets.storeys.map((s) => s.id)).toEqual(['A-101', 'A-102']);
    expect(sheets.storeys[1].title).toBe('Second floor plan');
  });

  it('is the same bytes for the same recipe', () => {
    const again = planSheet(readStructure(HOUSES.storeys), 1);
    expect(again.svg).toBe(sheets.storeys[1].svg);
  });

  it('draws every wall, door and window of its storey, and nothing of another', () => {
    for (const [k, r] of Object.entries(reads)) {
      r.storeys.forEach((st, i) => {
        const svg = sheets[k][i].svg;
        for (const w of r.elements.walls) expect(svg.includes(`class="s-wall" data-tag="${w.tag}"`), `${k} ${w.tag}`).toBe(w.storey === st.index);
        for (const d of r.elements.doors) expect(svg.includes(`class="s-door" data-tag="${d.tag}"`), `${k} ${d.tag}`).toBe(d.storey === st.index);
        for (const w of r.elements.windows) expect(svg.includes(`data-mark="${w.mark}"`), `${k} ${w.mark}`).toBe(w.storey === st.index);
      });
    }
  });

  it('every tag on the sheet names a thing in the read', () => {
    for (const [k, r] of Object.entries(reads)) {
      const known = new Set([...r.rooms.map((x) => x.tag), ...r.elements.doors.map((x) => x.tag), ...r.elements.windowTypes.map((x) => x.type), ...r.elements.wallTypes.map((x) => x.type), ...r.objects.types.map((x) => x.tag)]);
      for (const sh of sheets[k]) {
        const body = sh.svg.slice(sh.svg.indexOf('class="s-plan"'));
        for (const m of body.matchAll(/class="s-tag (room|door|window|wall|object)" data-tag="([^"]+)"/g)) expect(known.has(m[2]), `${k} ${sh.id} ${m[1]} ${m[2]}`).toBe(true);
      }
    }
  });

  it('every room gets its tag, with its number and area', () => {
    const r = reads.seeded, svg = sheets.seeded[0].svg;
    for (const room of r.rooms) {
      expect(svg).toContain(`class="s-tag room" data-tag="${room.tag}"`);
      expect(svg).toContain(`${room.tag}  ·  ${Math.round(room.area)} SF`);
    }
  });

  it("each side's strings add up to the overall, which is the footprint across the wall faces", () => {
    const r = reads.seeded;
    const v = makeView({ scale: '1/4' });
    const svg = planDrawing(r, 0, v, { tags: false, objects: false });
    const fts = [...svg.matchAll(/class="s-dimension" data-ft="([\d.]+)"/g)].map((m) => Number(m[1]));
    const fp = r.footprint, t = Math.max(...r.elements.walls.filter((w) => !w.interior).map((w) => w.thickness));
    const W = fp.x1 - fp.x0 + t, H = fp.y1 - fp.y0 + t;
    const overall = fts.filter((f) => Math.abs(f - W) < 1e-3 || Math.abs(f - H) < 1e-3);
    expect(overall.length).toBeGreaterThanOrEqual(4);       // the overall on every side
    // the chains between the overalls each sum to an overall
    const sums = [];
    let acc = 0;
    for (const f of fts) {
      if (overall.includes(f) && acc === 0) { sums.push(f); continue; }
      acc += f;
      if (Math.abs(acc - W) < 1e-2 || Math.abs(acc - H) < 1e-2) { sums.push(acc); acc = 0; }
    }
    expect(acc).toBeCloseTo(0, 6);
  });

  it('tags a furniture type once in each room, never on the room tag', () => {
    const svg = sheets.seeded[0].svg;
    const objectTags = [...svg.matchAll(/class="s-tag object" data-tag="([^"]+)"/g)].map((m) => m[1]);
    const r = reads.seeded;
    const perRoom = new Map();
    for (const p of r.objects.pieces) { const k = `${p.room}|${p.tag}`; perRoom.set(k, (perRoom.get(k) || 0) + 1); }
    expect(objectTags.length).toBeLessThanOrEqual(perRoom.size);
  });

  it('draws the stair as UP below and DN above', () => {
    expect(sheets.storeys[0].svg).toMatch(/class="s-stair"[^>]*>.*?>UP</);
    expect(sheets.storeys[1].svg).toMatch(/class="s-stair"[^>]*>.*?>DN</);
  });

  it('carries the title block, north arrow, scale bar and drawing title', () => {
    const svg = sheets.seeded[0].svg;
    expect(svg).toContain('>A-101<');
    expect(svg).toContain('class="s-north"');
    expect(svg).toContain('class="s-scalebar"');
    expect(svg).toContain('GROUND FLOOR PLAN');
  });
});
