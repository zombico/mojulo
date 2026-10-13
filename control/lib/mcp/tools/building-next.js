/**
 * A building's readout: what mint_building, create_sketch and update_sketch answer with for a house, read from the
 * recipe as stored. `next` is the house's open concerns by outcome (Concept, Layout, Drawings, Build), each naming the
 * field that adds it, or the export that takes it out, and the outcome card that teaches it (structure/open.js, the
 * table the structure book's Open tab reads, so the readout and the book name the same steps). `design` gains the
 * stair clearance beside the walkway. Never stored.
 */

import { readStructure } from '@/lib/graph/structure/read';
import { nextSteps, clearanceReadout, OUTCOME_CARDS } from '@/lib/graph/structure/open';
import { STRUCTURE_KINDS } from '@/lib/graph/structure/programs';

export { OUTCOME_CARDS };

// a house and the commercial programs the structure book reads (structure/programs.js)
export const BUILDING_KINDS = STRUCTURE_KINDS;

export function isBuildingManifest(manifest) {
  return !!manifest && typeof manifest === 'object' && BUILDING_KINDS.includes(manifest.kind);
}

/** The structure read of a building, or null for any other recipe (or one the reader cannot read). Never throws. */
export function buildingRead(manifest) {
  if (!isBuildingManifest(manifest)) return null;
  try { return readStructure(manifest); } catch { return null; }
}

/** The steps open from here, or undefined for anything that is not a building. */
export function buildingNext(manifest, read = buildingRead(manifest)) {
  if (!isBuildingManifest(manifest) || !read) return undefined;
  return nextSteps(manifest, read);
}

/** What a building says in every reply: a room or a house (and what a house lacks to be a home), or, for a store,
 *  restaurant or mall, its occupancy and its program's grade with the findings in words. */
export function buildingSays(read) {
  if (!read) return {};
  if (read.occupancy) {
    const g = read.grade || {};
    return {
      subject: read.subject, occupancy: read.occupancy.id,
      grade: { score: g.score, ...(g.violations?.length ? { findings: g.violations.slice(0, 6), ...(g.violations.length > 6 ? { more: g.violations.length - 6 } : {}) } : {}) },
      ...(read.capacity?.seats ? { seats: read.capacity.seats, occupantLoad: read.capacity.occupantLoad } : {}),
      rooms: read.rooms.length,
    };
  }
  return { subject: read.subject, ...(read.dwelling?.missing.length ? { notAHome: `no ${read.dwelling.missing.join(', no ')}` } : {}) };
}

/** The stair clearance for the design readout, or null where there is no stair. */
export function buildingClearance(read) {
  if (!read) return null;
  try { return clearanceReadout(read); } catch { return null; }
}
