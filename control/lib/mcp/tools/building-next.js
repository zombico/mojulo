/**
 * The building ladder's `next`: the steps a stored house can take from here,
 * computed from what its recipe already has. Names and card ids only — the card
 * teaches the step, so a call that never climbs never pays for it. Returned by
 * mint_building and by update_sketch on a building; never stored.
 *
 * Kept dependency-free so both doors can import it without a cycle.
 */

// The card that teaches each step. One map, so splitting the house card per
// step changes only this.
export const RUNG_CARDS = Object.freeze({
  layout: 'house-layout',
  dwelling: 'house-dwelling',
  storeys: 'house-storeys',
  construction: 'house-construction',
  bim: 'house-bim',
});

export const BUILDING_KINDS = Object.freeze(['floorplan']);

export function isBuildingManifest(manifest) {
  return !!manifest && typeof manifest === 'object' && BUILDING_KINDS.includes(manifest.kind);
}

const present = (v) => v !== undefined && v !== null && v !== false;

export function buildingNext(manifest) {
  if (!isBuildingManifest(manifest)) return undefined;
  const m = manifest;
  const next = [];
  if (!present(m.furnish) && !present(m.furnishing) && m.view !== 'cutaway') {
    next.push({ add: 'furnishing', card: RUNG_CARDS.dwelling });
  }
  if (!present(m.storeys) && !present(m.floors) && !(Array.isArray(m.levels) && m.levels.length)) {
    next.push({ add: 'storeys', card: RUNG_CARDS.storeys });
  }
  if (!present(m.framing)) {
    next.push({ add: 'framing', card: RUNG_CARDS.construction });
  } else {
    if (!present(m.roof?.covering)) next.push({ add: 'roof', card: RUNG_CARDS.construction });
    if (!present(m.drainage)) next.push({ add: 'drainage', card: RUNG_CARDS.construction });
  }
  next.push({ export: 'ifc', card: RUNG_CARDS.bim });
  return next;
}
