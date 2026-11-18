/**
 * A TOUR'S CONTACT SHEET — every stop as a visitor meets it, on one sheet: what the person with the concept looks at
 * before the tour is finished, and what the agent looks at first. A row a stop: the stop seated on the exhibit's own
 * page (its view, its lit part, its caption on the plate), headed by what it is about and how much of the view its lit
 * part fills, in the camera's own words (shoot/frame.js OBJECT_SIZES), with the page audit's findings beside it.
 *
 * The page is the truth here: the exhibit's own page seats each stop and measures it (scene/channels/tour.js `view`,
 * page-audit.js `auditStops`), so nothing is re-derived from the recipe and no camera is solved a second time.
 *
 *   sizeWord(share)                → the OBJECT_SIZES word for how much of the view a lit part fills, or null
 *   tourContactRows(tour, audit)   → [{ shot, camera, about?, notes: [codes], frames: [{ at, world_t, size? }] }]
 *     the sheet's rows (motion/contact-sheet.js composeContactSheet), one frame a stop; `world_t` is how long the stop
 *     is held when the tour plays itself (audit.js holdSeconds). `tour` is the stored tour, `audit` auditStops' answer
 *
 * Pure: the frames are shot elsewhere (motion/tour-contact.js).
 */
import { holdSeconds } from './audit.js';
import { OBJECT_SIZES } from '../shoot/frame.js';

/** The most stops a sheet holds (a longer tour is its first ones; the sheet says so). */
export const MAX_STOPS = 24;
const HEAD_TITLE = 30;

export function sizeWord(share) {
  if (!(typeof share === 'number' && share >= 0)) return null;
  const row = OBJECT_SIZES.find((s) => share >= s.fill) ?? OBJECT_SIZES[OBJECT_SIZES.length - 1];
  return row.name;
}

export function tourContactRows(tour, audit) {
  const stops = Array.isArray(tour?.stops) ? tour.stops : [], read = Array.isArray(audit?.stops) ? audit.stops : [];
  const findings = Array.isArray(audit?.findings) ? audit.findings : [];
  return stops.slice(0, MAX_STOPS).map((s, i) => {
    const id = s.id || `s${i + 1}`, v = read.find((x) => x.at === i) ?? null;
    const size = v && v.framed !== null ? sizeWord(v.share) : null;
    const lit = Array.isArray(s.highlight) ? s.highlight : s.highlight ? [s.highlight] : [];
    // (the row's head is one line over one frame: a long title is cut, and the size is said under the frame)
    const title = String(s.title || id);
    return {
      shot: `${i + 1} ${title.length > HEAD_TITLE ? `${title.slice(0, HEAD_TITLE - 1)}…` : title}`, camera: 'seated',
      ...(lit.length ? { about: lit.join(', ') } : {}),
      notes: [...new Set(findings.filter((f) => f.at === id).map((f) => f.code)), ...(v && v.framed === null ? ['lights-nothing'] : [])],
      frames: [{ at: 'held', world_t: holdSeconds(s.caption), ...(size ? { size } : {}) }],
    };
  });
}
