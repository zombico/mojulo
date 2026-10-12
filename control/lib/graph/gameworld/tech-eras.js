/**
 * TECH ERAS — how a civilization's crafted technology is drawn, as two separate things:
 *
 *   STYLE    what it looks like: Warcraft 3's chunky masses read at a glance, exaggerated where small things must read,
 *            the detail painted into one skin, a few strong silhouette breaks. StarCraft II is the same idea at its
 *            limit, a reference and not a target.
 *   DENSITY  how many triangles it spends, which follows the CAMERA, not the style. What low poly costs on screen is
 *            the FACET: how wide a flat face on a curved surface reads. The world's camera (gameworld/cameras.js) sets
 *            the distance each tier of tech is met at, and at that distance, on today's screen, the widest facet stays
 *            under the style's limit (chunky facets are the look; crude ones are not) and no facet is so narrow it is
 *            wasted. A walker beside a third-person hero rounds its masses more than the same walker seen top-down.
 *   USE      how the player meets it, which sets where it is designed and what it may spend. The games are first and
 *            third person: technology is designed to read at the hero's scale first, and an RTS camera is its LOD,
 *            re-fitted at the far distance, never the target. WATCHED tech (set pieces, structures, emplacements,
 *            machines, a siege engine you escort) is met at its tier's distance; HELD tech (a weapon in the hand) at
 *            the view model's, the nearest camera there is; DRIVEN tech (a vehicle you ride) from its chase boom, or
 *            in first person from its cockpit. Few units mill about at person scale, so each may spend more: the
 *            budget is by use and rank, and a typical scene of them adds up under one scene budget.
 *
 * Matching the hero's density per pixel was tried and dropped: the layered hero (22,232 triangles) draws ~345
 * visible triangles a kpx at 6 m, and a hero-scale vehicle covers so much more screen that matching it asks for tens of
 * thousands of triangles, where this style puts the detail in the paint. Numbers are starting points, tuned at the eyes
 * gate; none is a measured fact about a shipped game.
 *
 *   TECH_STYLES, TECH_CAMERAS, TECH_USES, PERSON_CAMERAS, HERO_REFERENCE, USE_BUDGET, PERSON_SCENE
 *   meetDistance(camera, tier, use?) → m   heroDistance(camera) → m   pxPerMetre(distance) → on today's screen
 *   triangleCeiling(rank, use?) → the most triangles a thing spends, in heroes' worth by its use and rank
 *   sceneLoad(counts?) → { triangles, budget, ok }: a scene's technology against the scene budget
 *   texelsPerMetre(distance) → texels a metre the paint needs at a distance, on today's screen
 *   atlasPage(faces, distance) → px       the square page a thing's paint needs, by its surface area
 *
 * Data and arithmetic only; nothing draws.
 */
export const TECH_STYLES = Object.freeze({
  wc3: Object.freeze({
    read: 'Warcraft 3: chunky masses read at a glance, exaggerated where small things must read, the detail painted into one skin',
    // how much a tier is scaled up so it reads beside the hero (1: true size); a hand weapon is the hero's own gear
    exaggeration: Object.freeze({ part: 1, held: 1.35, tool: 1.25, machine: 1.1, automation: 1.1, installation: 1, vessel: 1, landmark: 1 }),
    // the facets: the widest a curved surface's flat face may read on today's screen at the meet distance (px), and the
    // narrowest worth its triangles
    facetPx: Object.freeze([4, 40]),
    // smoothing groups (tech-shading.js): edges turning less than the crease are shaded smooth, and a smooth round is
    // held to how far its outline strays from the true curve (px), the only place its polygons still show
    crease: 40,
    outlinePx: 1.5,
  }),
});
export const TECH_STYLE_IDS = Object.freeze(Object.keys(TECH_STYLES));
export const DEFAULT_TECH_STYLE = 'wc3';

// where the hero is seen from and where each tier of tech is met, by camera (metres). Third person: the exported
// chase boom sits max(3.5 × eye, 2 × height) behind the hero (scene/godot-kernel/level.gd), about 6 m; the hero's own
// gear is seen from there. First person has no hero on screen: the hero's density at arm's reach is the standard.
const M = (part, held, tool, machine, automation, installation, vessel, landmark) => Object.freeze({ part, held, tool, machine, automation, installation, vessel, landmark });
export const TECH_CAMERAS = Object.freeze({
  'third-person': Object.freeze({ hero: 6, meet: M(6, 6, 6, 8, 8, 12, 16, 30) }),
  'first-person': Object.freeze({ hero: 2, meet: M(2, 1, 1.5, 5, 5, 8, 12, 25) }),
  side: Object.freeze({ hero: 8, meet: M(8, 8, 8, 9, 9, 12, 16, 25) }),
  'top-down': Object.freeze({ hero: 20, meet: M(20, 20, 20, 22, 22, 24, 26, 30) }),
});
export const TECH_CAMERA_IDS = Object.freeze(Object.keys(TECH_CAMERAS));
/** The cameras technology is designed at; the rest (top-down) see its LOD. */
export const PERSON_CAMERAS = Object.freeze(['third-person', 'first-person', 'side']);

/** How the player meets a crafted thing. */
export const TECH_USES = Object.freeze({
  watched: 'you watch it, or walk beside it: set pieces, structures, emplacements, machines, a siege engine escorted',
  held: 'you pick it up: a weapon in the hand, worked in front of the camera',
  driven: 'you ride it: a vehicle, seen from its chase boom or its cockpit',
});
export const TECH_USE_IDS = Object.freeze(Object.keys(TECH_USES));
// where a used thing is designed, where its use comes nearer than its tier: in first person a held weapon is the view
// model (0.55 m from the eye) and a driven vehicle is its own hull seen from the cockpit (a machine's bonnet; a
// vessel's deck, its hull below the eye); in third person both are seen from the chase boom, as their tier is
const USE_MEET = Object.freeze({ 'first-person': Object.freeze({ held: 0.55, driven: Object.freeze({ machine: 2.5, vessel: 6 }) }) });
/** A gameworld with a hero and no camera plays third person (gameworld/cameras.js). */
export const DEFAULT_TECH_CAMERA = 'third-person';

/** The hero the tech stands beside: the layered female anime hero (tech-readout.test.js re-counts it). */
export const HERO_REFERENCE = Object.freeze({ hero: 'layered female anime round', triangles: 22232 });
/** The most triangles a thing spends, in heroes' worth, by its use and rank: a driven vehicle may spend up to two
 * heroes (it is met as near as the hero, walked up to and boarded, and has several times the hero's surface), a held
 * weapon half (it fills a corner of the screen the whole game), a watched focus one, and the rest stay quiet. Starting
 * numbers, tuned at the eyes gate; a typical scene of them still fits PERSON_SCENE. */
const R = (filler, prop, interactable, focus) => Object.freeze({ filler, prop, interactable, focus });
export const USE_BUDGET = Object.freeze({ watched: R(0.05, 0.15, 0.3, 1), held: R(0.5, 0.5, 0.5, 0.5), driven: R(0.5, 0.5, 1.5, 2) });
/** A typical person-scale scene: how many of each are in view at once, and the technology budget they share (the
 * hero's own triangles and the level's are apart). */
export const PERSON_SCENE = Object.freeze({
  heroes: 10,
  counts: Object.freeze({ driven: Object.freeze({ focus: 2 }), held: Object.freeze({ interactable: 1 }), watched: Object.freeze({ focus: 2, interactable: 3, prop: 10, filler: 20 }) }),
});

// today's screen, where the paint is judged: at most `texelsPerPixel` texels across a pixel at the meet distance
export const PAINT_FRAME = Object.freeze({ width: 2560, height: 1440, fovY: 55, texelsPerPixel: 1.25 });
export const ATLAS_PAGES = Object.freeze([256, 512, 1024, 2048]);

const cam = (camera) => {
  const C = TECH_CAMERAS[camera];
  if (!C) throw new Error(`tech eras: '${camera}' is not a camera (${TECH_CAMERA_IDS.join(', ')})`);
  return C;
};
export function meetDistance(camera, tier, use = 'watched') {
  useOk(use);
  const u = USE_MEET[camera]?.[use], near = typeof u === 'object' ? u[tier] : u;
  if (near !== undefined) return near;
  const d = cam(camera).meet[tier];
  if (d === undefined) throw new Error(`tech eras: '${tier}' is not a tier (${Object.keys(cam(camera).meet).join(', ')})`);
  return d;
}
export const heroDistance = (camera) => cam(camera).hero;

const useOk = (use) => { if (!TECH_USES[use]) throw new Error(`tech eras: '${use}' is not a use (${TECH_USE_IDS.join(', ')})`); return use; };
export function triangleCeiling(rank = 'interactable', use = 'watched') {
  const k = USE_BUDGET[useOk(use)][rank];
  if (k === undefined) throw new Error(`tech eras: '${rank}' is not an interest rank (${Object.keys(USE_BUDGET.watched).join(', ')})`);
  return Math.round(HERO_REFERENCE.triangles * k);
}
/** A scene's technology, each at its ceiling, against the scene's budget. */
export function sceneLoad(counts = PERSON_SCENE.counts) {
  let triangles = 0;
  for (const [use, ranks] of Object.entries(counts)) for (const [rank, n] of Object.entries(ranks)) triangles += n * triangleCeiling(rank, use);
  const budget = Math.round(HERO_REFERENCE.triangles * PERSON_SCENE.heroes);
  return { triangles, budget, ok: triangles <= budget };
}

/** Pixels a metre covers at a distance, on today's screen. */
export const pxPerMetre = (distance) => PAINT_FRAME.height / (2 * distance * Math.tan((PAINT_FRAME.fovY * Math.PI) / 360));

/** Texels per metre the paint needs to hold its texels-per-pixel at a distance, on today's screen. */
export function texelsPerMetre(distance) {
  return Math.round(pxPerMetre(distance) * PAINT_FRAME.texelsPerPixel);
}

/** The square atlas page a thing's paint needs at a distance: its surface area at that density, packed with room to
 * spare (islands and gutters take about a third), rounded up to a page, 2048 at most. */
export function atlasPage(faces, distance) {
  let area = 0;
  for (const f of faces) {
    const c = f.corners;
    if (!c || c.length < 3 || f.tile) continue;
    for (let i = 1; i + 1 < c.length; i++) {
      const u = [0, 1, 2].map((k) => c[i][k] - c[0][k]), w = [0, 1, 2].map((k) => c[i + 1][k] - c[0][k]);
      area += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
    }
  }
  // the era's habit: a symmetric thing paints one side and mirrors it (half its area), packed at a third to spare
  const need = Math.sqrt(area * 0.5 * 1.35) * texelsPerMetre(distance);
  return ATLAS_PAGES.find((p) => p >= need) ?? ATLAS_PAGES.at(-1);
}
