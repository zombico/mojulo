/**
 * versus arena — a fight's stage as a scapeshift set: one long, shallow room on a stage kit, its camera side left
 * open (a set seen from the open side), the fight plane a strip near that side, and the crowd behind it.
 *
 *   arenaManifest({ kit?, look?, width?, depth?, height?, crowd?, dress?, seed?, title?, roster?, rules? })
 *     → a `kind: 'stage'` recipe, a few words: the World page builds the rest on every read
 *
 * The room is the stage kind's own (era/stage.js: floor, walls, trim, lights, sky), so every kit and look it knows
 * dresses an arena. What the fight adds rides beside it:
 *   - `stands` (era/stands.js): tiers behind the plane and a crowd on them facing the open side, instanced.
 *   - `versus` (the World page's fight channel, scene/channels/versus.js): where the plane runs (y, m) and its walls
 *     (x, m), and, for the arena played on its own, the roster and rules it fights with (a versus game's front sends
 *     its own picks when it hosts the arena as a level).
 *   - a `fight` camera square to the plane, so the set opens framed as the fight will be.
 *
 * Stage coordinates are metres, z up; the plane runs along x at y = PLANE.
 */

export const ARENA_KITS = Object.freeze(['island-plaza', 'gothic-nave', 'gothic-stone', 'research-lab', 'catacomb']);
export const ARENA_DEFAULTS = Object.freeze({ kit: 'island-plaza', width: 18, depth: 14, height: 10, seed: 1 });
// where the fight plane runs (m in from the open side: the camera stands on the room's floor, in front of it), and the
// barrier in front of the stands (m behind the plane)
export const ARENA_PLANE = 6;
const BARRIER = 3;
// a kit lit by the sun needs a look that has one; the others take their own
const KIT_LOOK = { 'island-plaza': 'island-noon' };
// a kit whose dressing stands a set piece at the room's centre (the plaza's fountain) is dressed only when asked:
// the fight's floor is clear
const CENTRE_PIECE = new Set(['island-plaza']);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Read an arena's words; → the settled spec (throws naming what is wrong). */
export function readArena(spec = {}) {
  const A = { ...ARENA_DEFAULTS, ...spec };
  if (!ARENA_KITS.includes(A.kit)) throw new Error(`versus: arena kit '${A.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (!(A.width >= 12 && A.width <= 40)) throw new Error('versus: an arena is 12 to 40 m wide');
  if (!(A.depth >= 10 && A.depth <= 24)) throw new Error('versus: an arena is 10 to 24 m deep');
  if (!(A.height >= 5 && A.height <= 20)) throw new Error('versus: an arena is 5 to 20 m high');
  if (A.crowd !== undefined && A.crowd !== false && (typeof A.crowd !== 'object' || Array.isArray(A.crowd))) throw new Error('versus: crowd is false or { rows?, fill? }');
  return A;
}

/** An arena: a stage set with its camera side open, the stands behind the plane, the facts the fight reads. */
export function arenaManifest(spec = {}) {
  const A = readArena(spec);
  const crowd = A.crowd === false ? null : { rows: 3, fill: 0.8, ...(A.crowd ?? {}) };
  const camDist = 5.8;
  return {
    kind: 'stage',
    kit: A.kit,
    ...(A.look ?? KIT_LOOK[A.kit] ? { reference: A.look ?? KIT_LOOK[A.kit] } : {}),
    ...(A.title ? { title: A.title } : {}),
    ...((A.dress ?? !CENTRE_PIECE.has(A.kit)) ? {} : { dress: false }),
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'arena', x: r3(-A.width / 2), y: 0, w: A.width, d: A.depth, h: A.height, open: ['-y'] }],
    lights: 'auto',
    // the crowd a little darker than the light, so the fighters read in front of it
    ...(crowd ? { stands: { from: ARENA_PLANE + BARRIER, rows: crowd.rows, fill: crowd.fill, shade: 0.62, seed: A.seed } } : {}),
    camera: { name: 'fight', worldFraming: { cameraPosition: [0, r3(ARENA_PLANE - camDist), 1.5], lookAt: [0, ARENA_PLANE, 1.25], horizontalFov: 64, pictureCenter: [640, 360] } },
    versus: {
      plane: ARENA_PLANE,
      // the fight's walls: a body's width in from the room's side walls
      half: r3(A.width / 2 - 1),
      ...(A.roster ? { roster: A.roster } : {}),
      ...(A.rules ? { rules: A.rules } : {}),
    },
  };
}
