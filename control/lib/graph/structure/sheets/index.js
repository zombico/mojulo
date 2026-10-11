/**
 * structure/sheets — the drawing set, bound in the NCS discipline order: civil, structural, architectural (plans,
 * elevations, sections, schedules), plumbing, electrical. Each sheet is present when the recipe has what it draws (no
 * lot, no C-101; unframed, no S-sheets; no gutters, no P-101), so the set grows as the house does.
 */

import { planSheet } from './plan.js';
import { elevationsSheets } from './elevations.js';
import { sectionSheet } from './section.js';
import { siteSheet } from './site.js';
import { scheduleSheets } from './schedules.js';
import { framingSheets } from './framing.js';
import { electricalSheets, drainageSheet } from './services.js';

/** Every sheet the read can draw → [{ id, title, scale, svg }], in set order. */
export function drawingSet(read, opts = {}) {
  if (!read || !read.footprint) return [];
  const sheets = [];
  const site = siteSheet(read, opts);
  if (site) sheets.push(site);
  sheets.push(...framingSheets(read, opts));
  for (const s of [...read.storeys].sort((a, b) => a.index - b.index)) {
    const sh = planSheet(read, s.index, opts);
    if (sh) sheets.push(sh);
  }
  sheets.push(...elevationsSheets(read, opts));
  const sec = sectionSheet(read, opts);
  if (sec) sheets.push(sec);
  sheets.push(...scheduleSheets(read, opts));
  const rain = drainageSheet(read, opts);
  if (rain) sheets.push(rain);
  sheets.push(...electricalSheets(read, opts));
  return sheets;
}

/** The sheet index a cover lists: id and title, in set order. */
export const sheetIndex = (sheets) => sheets.map((s) => ({ id: s.id, title: s.title }));

export { planSheet, elevationsSheets, sectionSheet, siteSheet, scheduleSheets, framingSheets, electricalSheets, drainageSheet };
