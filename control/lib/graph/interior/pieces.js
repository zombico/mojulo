/**
 * interior/pieces — what an interior can stand in a room, at true size. Each piece is a row of the house's furniture
 * roster (furnishings/roster.js: the words people say for it) and says how it is drawn:
 *
 *   composed  a furniture kind with forms and a finish (furnishings/forms.js), locked at the piece's own size, so a
 *             style card skins it and a resize re-derives it (a longer sofa takes another seat)
 *   mesh      a room asset (architecture/room-assets.js), recoloured by family from the scheme (`finish`)
 *
 *   size      [w, d, h] mm, the piece's default: w across its front, d front to back, h its height
 *   band      the width it may take, [min, max] mm (a piece asked outside it is clamped, and the readout says so)
 *   mount     'floor' (stands), 'skin' (a rug: walked over, under the pieces on it)
 *
 * A piece the library does not have yet is not faked: the solver names it as a gap.
 */

export const PIECES = Object.freeze({
  // ── seats ──
  sofa: { label: 'sofa', roster: 'sofa', render: 'composed', kind: 'sofa', like: 'sofa', size: [2130, 940, 820], band: [1400, 3300], mount: 'floor' },
  loveseat: { label: 'loveseat', roster: 'sofa', render: 'composed', kind: 'sofa', like: 'settee', size: [1520, 860, 780], band: [1200, 1700], mount: 'floor' },
  'lounge-chair': { label: 'lounge chair', roster: 'armchair', render: 'composed', kind: 'sofa', like: 'armchair', size: [840, 860, 780], band: [680, 1000], mount: 'floor' },
  'dining-chair': { label: 'dining chair', roster: 'dining-chair', render: 'composed', kind: 'chair', like: 'chair', size: [460, 520, 860], band: [420, 560], mount: 'floor' },
  'desk-chair': { label: 'desk chair', roster: 'desk-chair', render: 'composed', kind: 'chair', like: 'chair', size: [480, 520, 900], band: [440, 600], mount: 'floor' },
  bench: { label: 'bench', roster: 'bench', render: 'mesh', type: 'entry-bench', size: [1200, 400, 460], band: [800, 1800], mount: 'floor' },
  // ── tables ──
  'coffee-table': { label: 'coffee table', roster: 'coffee-table', render: 'composed', kind: 'table', like: 'coffee-table', size: [1220, 610, 420], band: [700, 1600], mount: 'floor' },
  'side-table': { label: 'side table', roster: 'coffee-table', render: 'composed', kind: 'table', like: 'coffee-table', size: [500, 500, 560], band: [380, 650], mount: 'floor' },
  'dining-table': { label: 'dining table', roster: 'dining-table', render: 'composed', kind: 'table', like: 'dining-table', size: [1830, 915, 750], band: [900, 3000], mount: 'floor' },
  desk: { label: 'desk', roster: 'study-table', render: 'mesh', type: 'study-table', size: [1300, 650, 750], band: [1000, 1800], mount: 'floor' },
  // ── sleeping ──
  bed: { label: 'bed', roster: 'bed', render: 'mesh', type: 'platform-bed', size: [1630, 2130, 500], band: [1000, 2000], mount: 'floor' },
  nightstand: { label: 'nightstand', roster: 'nightstand', render: 'composed', kind: 'casework', like: 'nightstand', size: [500, 420, 600], band: [400, 650], mount: 'floor' },
  dresser: { label: 'chest of drawers', roster: 'dresser', render: 'composed', kind: 'casework', like: 'chest', size: [1035, 490, 860], band: [800, 1800], mount: 'floor' },
  // ── storage ──
  bookcase: { label: 'bookcase', roster: 'bookcase', render: 'composed', kind: 'casework', like: 'bookcase', size: [900, 330, 1830], band: [600, 1200], mount: 'floor' },
  sideboard: { label: 'sideboard', roster: 'sideboard', render: 'composed', kind: 'casework', like: 'sideboard', size: [1525, 460, 800], band: [1000, 2200], mount: 'floor' },
  'media-console': { label: 'media console', roster: 'media-unit', render: 'composed', kind: 'casework', like: 'media-console', size: [1800, 450, 520], band: [1200, 2400], mount: 'floor' },
  // ── floor, light ──
  rug: { label: 'rug', roster: 'rug', render: 'mesh', type: 'bordered-rug', size: [2440, 3050, 12], band: [1200, 4300], mount: 'skin' },
  'floor-lamp': { label: 'floor lamp', roster: 'floor-lamp', render: 'mesh', type: 'floor-lamp', size: [380, 380, 1600], band: [300, 500], mount: 'floor' },
});

export const PIECE_NAMES = Object.freeze(Object.keys(PIECES));

/** Standard rug sizes, mm, smallest first (the placer takes the smallest that covers the group, else cuts one). */
export const RUG_SIZES = Object.freeze([[1520, 2440], [1700, 2400], [2000, 3000], [2440, 3050], [2740, 3660], [3050, 3960]]);

/** Mattress sizes, mm [w, l]; the bed is the mattress plus its frame. */
export const MATTRESSES = Object.freeze({ twin: [990, 1905], full: [1370, 1905], queen: [1525, 2030], king: [1930, 2030], 'eu-140': [1400, 2000], 'eu-160': [1600, 2000], 'eu-180': [1800, 2000] });
export const BED_FRAME = [110, 100];   // the frame past the mattress: each side, and the headboard plus foot
