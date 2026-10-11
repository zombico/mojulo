// Stairs through the stack. The laws: `stairs: true` joins every level from the ground (up to each floor, down to each
// basement), and a ground with its basement keeps the one flight it always had; a level no flight reaches is a check
// that advises and an Open entry naming the field; a flight is drawn wherever the set shows it.

import { describe, it, expect } from 'vitest';
import { structurizeHouse, FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { readStructure } from './read.js';
import { checkRows, unreachedLevels } from './tables.js';
import { openConcerns } from './book-html.js';
import { sectionSheet } from './sheets/section.js';
import { framingSheets } from './sheets/framing.js';

const flightsOf = (m) => structurizeHouse(m, { ...FLOORPLAN_DEFAULTS, ...m, view: 'cutaway', walk: false }).stairs.map((s) => [s.fromIndex, s.toIndex]);
const base = { kind: 'floorplan', seed: 7, windows: true };

describe('stairs: true', () => {
  it('runs up from the ground to each floor', () => {
    expect(flightsOf({ ...base, levels: [{ index: 0 }, { index: 1 }], stairs: true })).toEqual([[0, 1]]);
    expect(flightsOf({ ...base, levels: [{ role: 'ground' }, { role: 'second' }, { role: 'third' }], stairs: true })).toEqual([[0, 1], [1, 2]]);
  });

  it('runs down to a basement as it always did, and up as well when there are floors above', () => {
    expect(flightsOf({ ...base, levels: [{ role: 'basement' }, { role: 'ground' }], stairs: true })).toEqual([[0, -1]]);
    expect(flightsOf({ ...base, levels: [{ role: 'basement' }, { role: 'ground' }, { role: 'second' }], stairs: true })).toEqual([[0, -1], [0, 1]]);
  });

  it('cuts the void in the floor it rises into, never the one it stands on', () => {
    const r = readStructure({ ...base, levels: [{ index: 0 }, { index: 1 }], stairs: true });
    expect(r.elements.slabs.find((s) => s.storey === 0).holes).toEqual([]);
    expect(r.elements.slabs.find((s) => s.storey === 1).holes).toHaveLength(1);
  });

  it('a single floor has no flight to make', () => {
    expect(flightsOf({ ...base, levels: [{ index: 0 }], stairs: true })).toEqual([]);
  });
});

describe('a level no flight reaches', () => {
  const lost = readStructure({ ...base, levels: [{ index: 0 }, { index: 1 }] });
  const found = readStructure({ ...base, storeys: 2 });

  it('is a check that advises, and passes once a flight reaches it', () => {
    expect(unreachedLevels(lost).map((s) => s.index)).toEqual([1]);
    expect(checkRows(lost).find((c) => c.rule === 'stair-reach')).toMatchObject({ ok: false, subject: 'L2' });
    expect(checkRows(found).find((c) => c.rule === 'stair-reach')).toMatchObject({ ok: true });
    expect(checkRows(readStructure({ ...base })).some((c) => c.rule === 'stair-reach')).toBe(false);
  });

  it('is named in Open with the field that adds the flight', () => {
    expect(openConcerns({}, lost).find((o) => o.tab === 'Plan').field).toMatch(/^stairs: true/);
    expect(openConcerns({}, found).some((o) => o.tab === 'Plan')).toBe(false);
  });
});

describe('the flight on the sheets', () => {
  const r = readStructure({ ...base, roof: 'hip', storeys: 2, framing: { system: 'platform' } });
  const st = r.elements.stairs[0];

  it('reads the flights and landing the kernel builds, filling the void', () => {
    expect(st.switchback).toBe(true);
    expect(st.flights).toHaveLength(2);
    expect(st.flights.reduce((a, f) => a + f.steps, 0)).toBe(st.risers);
    expect(st.flights[0].z0).toBe(0);
    expect(st.flights[1].z1).toBeCloseTo(r.storeys[1].baseZ, 1);
    const area = st.flights.reduce((a, f) => a + f.rect.w * f.rect.h, 0) + st.landing.rect.w * st.landing.rect.h;
    expect(area).toBeLessThanOrEqual(st.slot.w * st.slot.h + 0.01);
  });

  it('draws in both sections, and as an opening on the framing plan of the floor it rises into', () => {
    const svg = sectionSheet(r).svg;
    expect(svg.split(`class="s-stair" data-tag="${st.tag}"`).length - 1).toBe(2);
    const sheets = framingSheets(r);
    expect(sheets.find((s) => s.frame === 'storey-0').svg).toContain(`class="s-opening" data-tag="${st.tag}"`);
    expect(sheets.find((s) => s.frame === 'foundation').svg).not.toContain('s-opening');
  });
});

describe('the walkway check', () => {
  it('each design finding is a check that advises, in the kernel\'s own words', () => {
    const r = readStructure({ ...base, storeys: 2, design: {} });
    const rows = checkRows(r).filter((c) => c.source === 'design');
    expect(rows.length).toBeGreaterThan(0);
    if (r.design.findings.length) expect(rows.map((c) => c.detail).join(' ')).toContain(r.design.findings[0].replace(/^[a-z]+:\s*/, '').slice(0, 30));
    else expect(rows[0]).toMatchObject({ ok: true });
  });
});
