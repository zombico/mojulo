import { describe, it, expect } from 'vitest';
import { facilityMapSvg, buildingMaps, facilityBook, facilityBookHtml, facilityMapsFor, HIDES } from './facility-maps.js';
import { FACILITIES, FACILITY_IDS } from '../era/facilities.js';
import { PROGRAMS } from '../era/programs.js';
import { MEADOWMARK } from './index.js';
import { gameworldBibleHtml } from './bible-html.js';

// THE FACILITY MAPS (facility-maps.js): a building's floors drawn from above, every piece by what it hides; the book
// of them a stealth or action game's interiors are read in. One facility with a hall stands for the shelf.

const withHall = FACILITY_IDS.find((id) => PROGRAMS[FACILITIES[id].use].annex);
const world = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, base: { name: 'The depot', building: { facility: withHall, seed: 2 } } } };

describe('facility maps', () => {
  it('a storey drawn: a box a room, a doorway a gold bar, a piece the colour of what it hides; the same for the same recipe', () => {
    const M = buildingMaps({ facility: withHall });
    const svg = M.storeys[0].svg, ground = M.plan.rooms.filter((r) => (r.storey ?? 0) === M.storeys[0].storey);
    for (const r of ground) expect(svg, r.id).toContain(`>${r.id}</text>`);
    expect(svg).toContain('#e8c46a');
    for (const h of HIDES.slice(0, 2)) expect(svg, h.id).toContain(h.fill);
    expect(buildingMaps({ facility: withHall }).storeys[0].svg).toBe(svg);
    expect(M.layouts[PROGRAMS[FACILITIES[withHall].use].annex.role].laws.every((l) => l.holds)).toBe(true);
    expect(facilityMapSvg(M.plan, { path: [[1, 1], [2, 2]], patrol: [[0, 0], [3, 0]], title: 'x' })).toMatch(/polyline[\s\S]*stroke-dasharray="5 3"/);
  });

  it('the book: this game\'s buildings drawn with their laws, and the whole shelf, each with how a recipe names it', () => {
    const B = facilityBook(world);
    expect(B.levels.map((L) => L.id)).toEqual(['base']);
    expect(B.shelf.map((F) => F.id)).toEqual([...FACILITY_IDS]);
    const html = facilityBookHtml(world);
    expect(html).toContain('The depot');
    expect(html).toContain("building: { facility: '");
    expect(html).toContain('the gaze broken');
  });

  it('the book is a world\'s to read when it has a building level, a dungeon or a rail of interiors; a meadow has none', () => {
    expect(facilityMapsFor(world)).toBe(true);
    expect(facilityMapsFor({ ...MEADOWMARK, levels: Object.fromEntries(Object.entries(MEADOWMARK.levels).filter(([, L]) => !L.building)) })).toBe(false);
  });

  it('the world book draws a facility level as its map, not its plan of rooms', () => {
    const html = gameworldBibleHtml(world);
    expect(html).toContain('#1c1f22');
    expect(html).toContain(HIDES[0].fill);
  });
});
