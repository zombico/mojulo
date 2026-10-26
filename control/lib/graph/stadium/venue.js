/**
 * A GAME'S VENUE — any arena (a court, a pitch, a meet, a course, a hologram arena) stood inside a stadium instead of on
 * its stage set: the arena's room becomes the stadium's field, its camera stays its own, its channel key rides along,
 * and the bowl's camera side is set back just far enough that the camera stands inside the pitch wall.
 *
 *   venue: 'olympic' (a preset) | { preset?, surface?, palette?, look?, time?, ground?, livery?, colours?, bowl?,
 *          masts?, skyline?, seed? } (a stadium's words, the field the arena's)
 *
 *   readVenue(v, fail) → v checked (as given: a stored recipe keeps its words)
 *   venueManifest(v, { room, surface, camera, title, channel }) → a `kind: 'stadium'` recipe
 *
 * An arena without the word mints its stage recipe as before, to the byte.
 */
import { readStadium, STADIUM_PRESET_IDS } from './stadium-words.js';

export const VENUE_KEYS = Object.freeze(['preset', 'surface', 'palette', 'look', 'time', 'ground', 'livery', 'colours', 'bowl', 'masts', 'skyline', 'seed']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

const asStadium = (v, field) => {
  const { surface, ...rest } = typeof v === 'string' ? { preset: v } : v;
  return { ...rest, field: { ...field, ...(surface ? { surface } : {}) } };
};

/** The venue's words, checked against a stadium's (any refusal teaches in the arena's voice). */
export function readVenue(v, fail) {
  if (typeof v === 'string') {
    if (!STADIUM_PRESET_IDS.includes(v)) fail(`venue '${v}' is one of ${STADIUM_PRESET_IDS.join(', ')}, or { preset?, ${VENUE_KEYS.slice(1).join('?, ')}? }`);
    return v;
  }
  if (!isObj(v)) fail(`venue is a stadium preset (${STADIUM_PRESET_IDS.join(', ')}) or { ${VENUE_KEYS.join('?, ')}? }`);
  for (const k of Object.keys(v)) if (!VENUE_KEYS.includes(k)) fail(`venue has no '${k}' (${VENUE_KEYS.join(', ')}; the field is the arena's)`);
  try { readStadium(asStadium(v, { w: 20, d: 20 })); } catch (e) { fail(`venue: ${e.message.replace(/^stadium: /, '')}`); }
  return v;
}

/** How far the bowl's camera side must stand back for the camera at [px, py] to be inside the pitch wall, 3 m spare. */
function clearFor(S, [px, py]) {
  const F = S.field, cx = F.x + F.w / 2, cy = F.y + F.d / 2, p = S.bowl.shape, grow = 2 ** (1 / p);
  for (let clear = 0; clear < 80; clear++) {
    const hx = (F.w / 2) * grow + S.bowl.gap, hy = (F.d / 2 + clear / 2) * grow + S.bowl.gap, u = Math.abs(px - cx) / hx;
    if (u >= 1) return clear;   // beside the ring: nothing in front of it to clear
    if (cy - clear / 2 - hy * (1 - u ** p) ** (1 / p) <= py - 3) return clear;
  }
  return 80;
}

/** The arena in its stadium: the room as the field, the arena's camera, its channel key. */
export function venueManifest(v, { room, surface, camera, title, channel }) {
  const m = asStadium(v, { x: room.x, y: room.y, w: room.w, d: room.d, surface });
  const S = readStadium(m);
  const clear = S.bowl && S.bowl.clear === undefined ? clearFor(S, camera.worldFraming.cameraPosition) : 0;
  return {
    kind: 'stadium',
    ...m,
    ...(clear ? { bowl: { ...(m.bowl ?? {}), clear } } : {}),
    title,
    viewBox: { width: 1280, height: 720 },
    camera,
    ...channel,
  };
}
