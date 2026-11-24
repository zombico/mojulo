/**
 * THE SCROLL STAGE, BUILT (Blaze Gunner): an airspace's `scroll` (skyscape/airspace.js hands it here), a stage flown
 * through space on a screen that scrolls on its own: the ship on the d-pad (worlds/controllable/scroll.js), the camera
 * carried down its track, and space in its layers behind and in front of the play (space-layers.js), the space map's
 * sky at infinity behind them all.
 *
 *   airspace { kind: 'airspace', scroll: {
 *     view?     'side' (left to right, the default) | 'top' (bottom to top, seen from above)
 *     ship?     { craft?: a space archetype off the craft shelf (CRAFT_ARCHETYPES), its measures the ship's size }
 *     track?    [leg]: { by: [du, dv] screens, pace?: screens a second } | { hold: s } | { hold: true, until: id }
 *               (a SCREEN along is the frame's along, across its across); [{ by: [12, 0] }] where none is given
 *     pace?     screens a second a leg without its own moves at (SCROLL_PACE)
 *     start?    [u, v] screens: where the screen starts (a shot down the stage)
 *     layers?   the space layers laid (SPACE_LAYER_IDS, all where none are named)
 *     hulls?    [{ capital: a fleet class, at: screens along, v?: screens across, depth?: camera distances back (HULL_DEPTH),
 *               heading?: 0 (the way the stage scrolls) | 180, seed? }]: capital ships going by behind the fight
 *     backdrop? false (stars alone) | { planets?, nebula?, suns?, worlds?, proximity?, seed? } (skyscape/backdrop.js),
 *               its large world set in the camera's view
 *     seed?
 *   } }
 *
 *   SCROLL_STAGE_KEYS, SCROLL_PACE, SCROLL_CRAFT, HULL_DEPTH
 *   readScrollStage(v)                → errors (strings); [] when it builds
 *   scrollStageOf(manifest)           → { cam, ship, track, start, extent }: the stage as numbers, no faces
 *   scrollStagePlay(manifest, { airframe? }) → { entities, camera, figures? }: the ship and the scroll camera, as a level
 *                                       puts them on its manifest (a page resolves a figure from the manifest only: the
 *                                       ship flies its airframe there; `airframe: false` the slab)
 *   assembleScrollStage(manifest, { title? }) → the World payload: faces (the layers, the hulls), sky, bg, cameras (a
 *                                       bookmark at the start), meta.scroll, and the play with the ship a slab (a payload
 *                                       resolves no figures: the space map's own convention, skyscape/airspace.js)
 *
 * Pure: the same stage the same bytes.
 */
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { assembleCraft } from '../../craft-shelf/index.js';
import { CAPITAL_CLASSES } from '../../fleet/classes.js';
import { layFleet } from '../../skyscape/space-fleet.js';
import { planBackdrop } from '../../skyscape/backdrop.js';
import { SPACE_STAR } from '../../skyscape/space.js';
import { SCROLL_VIEWS, SCROLL_VIEW_IDS, scrollCamera, toWorld, trackExtent } from './frame.js';
import { SPACE_LAYER_IDS, SPACE_VOID, layScrollSpace, hazeHulls } from './space-layers.js';

export const SCROLL_STAGE_KEYS = Object.freeze(['view', 'ship', 'track', 'pace', 'start', 'layers', 'hulls', 'backdrop', 'seed']);
/** A leg's pace where it names none: a tenth of a screen a second (an arcade scroll's unhurried crawl). */
export const SCROLL_PACE = 0.1;
/** The ship a stage flies where it names none: the craft shelf's arrowhead interceptor (a classic heroic profile: a long
 * nose, a raised fin, a hot drive), until Blaze Gunner's own. */
export const SCROLL_CRAFT = 'arrowInterceptor';
/** How far behind the play a hull stands where it names no depth (camera distances): back enough that a capital ship
 * reads whole and quiet behind the fight. */
export const HULL_DEPTH = -4;
const HULL_KEYS = ['capital', 'at', 'v', 'depth', 'heading', 'seed'];
const DEFAULT_TRACK = Object.freeze([Object.freeze({ by: Object.freeze([12, 0]) })]);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = Number.isFinite;
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const r2 = (v) => Math.round(v * 100) / 100;
const unit = (v) => { const L = Math.hypot(...v) || 1; return v.map((x) => Math.round((x / L) * 1e4) / 1e4); };

export function readScrollStage(v) {
  if (!isObj(v)) return ['airspace.scroll is { view?, ship?, track?, pace?, start?, layers?, hulls?, backdrop?, seed? }: a stage on a screen that scrolls'];
  const e = [], at = (k) => `airspace.scroll.${k}`;
  for (const k of Object.keys(v)) if (!SCROLL_STAGE_KEYS.includes(k)) e.push(`${at(k)} is not a scroll stage's word (${SCROLL_STAGE_KEYS.join(', ')})`);
  if (v.view !== undefined && !SCROLL_VIEW_IDS.includes(v.view)) e.push(`${at('view')} is 'side' (left to right) or 'top' (bottom to top)`);
  if (v.ship !== undefined) {
    if (!isObj(v.ship) || Object.keys(v.ship).some((k) => k !== 'craft')) e.push(`${at('ship')} is { craft? }`);
    else if (v.ship.craft !== undefined && CRAFT_ARCHETYPES[v.ship.craft]?.realm !== 'space') e.push(`${at('ship.craft')} is a space craft off the shelf (${Object.keys(CRAFT_ARCHETYPES).filter((k) => CRAFT_ARCHETYPES[k].realm === 'space').join(', ')})`);
  }
  if (v.track !== undefined) {
    if (!Array.isArray(v.track) || !v.track.length) e.push(`${at('track')} is a list of legs: { by: [du, dv] screens, pace? } | { hold: s } | { hold: true, until: id }`);
    else v.track.forEach((L, k) => {
      const w = `${at('track')}[${k}]`;
      if (!isObj(L)) e.push(`${w} is a leg`);
      else if (L.by !== undefined) { if (!pair(L.by) || (L.by[0] === 0 && L.by[1] === 0)) e.push(`${w}.by is [du, dv] screens, not both 0`); if (L.pace !== undefined && !(isNum(L.pace) && L.pace > 0)) e.push(`${w}.pace is screens a second`); }
      else if (L.hold !== undefined) { if (!(L.hold === true ? typeof L.until === 'string' && L.until : isNum(L.hold) && L.hold > 0)) e.push(`${w}.hold is seconds, or true with until: the id of what must fall`); }
      else e.push(`${w} is { by, pace? } or { hold }`);
    });
  }
  if (v.pace !== undefined && !(isNum(v.pace) && v.pace > 0)) e.push(`${at('pace')} is screens a second`);
  if (v.start !== undefined && !pair(v.start)) e.push(`${at('start')} is [u, v] screens`);
  if (v.layers !== undefined && !(Array.isArray(v.layers) && v.layers.every((l) => SPACE_LAYER_IDS.includes(l)))) e.push(`${at('layers')} names space layers (${SPACE_LAYER_IDS.join(', ')})`);
  if (v.hulls !== undefined) {
    if (!Array.isArray(v.hulls)) e.push(`${at('hulls')} is a list of { capital, at, v?, depth?, heading?, seed? }`);
    else v.hulls.forEach((H, k) => {
      const w = `${at('hulls')}[${k}]`;
      if (!isObj(H)) { e.push(`${w} is { capital, at, … }`); return; }
      for (const f of Object.keys(H)) if (!HULL_KEYS.includes(f)) e.push(`${w}.${f} is not a hull's word (${HULL_KEYS.join(', ')})`);
      if (!CAPITAL_CLASSES[H.capital]) e.push(`${w}.capital is a fleet class (${Object.keys(CAPITAL_CLASSES).join(', ')})`);
      if (!isNum(H.at)) e.push(`${w}.at is screens along the stage`);
      if (H.v !== undefined && !isNum(H.v)) e.push(`${w}.v is screens across`);
      if (H.depth !== undefined && !(isNum(H.depth) && H.depth < 0)) e.push(`${w}.depth is camera distances behind the play (negative)`);
      if (H.heading !== undefined && ![0, 180].includes(H.heading)) e.push(`${w}.heading is 0 (the way the stage scrolls) or 180`);
      if (H.seed !== undefined && !Number.isInteger(H.seed)) e.push(`${w}.seed is a whole number`);
    });
  }
  if (v.backdrop !== undefined && v.backdrop !== false && !isObj(v.backdrop)) e.push(`${at('backdrop')} is false (stars alone) or { planets?, nebula?, suns?, worlds?, proximity?, seed? }`);
  if (isObj(v.backdrop) && v.backdrop.toward !== undefined) e.push(`${at('backdrop')}: its large world stands in the camera's view; toward is not a scroll stage's word`);
  if (v.seed !== undefined && !Number.isInteger(v.seed)) e.push(`${at('seed')} is a whole number`);
  return e;
}

/** The stage as numbers: its camera from its ship, its track and start in metres, the centres it sweeps. */
export function scrollStageOf(manifest) {
  const S = manifest.scroll || {}, errs = readScrollStage(S);
  if (errs.length) throw new Error(errs.join('; '));
  const view = S.view ?? 'side', craft = S.ship?.craft ?? SCROLL_CRAFT;
  const M = assembleCraft(craft, { attitude: 'level', pose: { gear: 0 } }).readout.measures;
  const ship = { craft, length: M.length, breadth: view === 'side' ? M.height : M.span };
  const cam = scrollCamera(ship.length, { view }), A = cam.screen.along, C = cam.screen.across;
  const track = (S.track ?? DEFAULT_TRACK).map((L) => (L.by ? { by: [r2(L.by[0] * A), r2(L.by[1] * C)], pace: r2((L.pace ?? S.pace ?? SCROLL_PACE) * A) } : { ...L }));
  const start = S.start ? [r2(S.start[0] * A), r2(S.start[1] * C)] : [0, 0];
  return { view, cam, ship, track, start, extent: trackExtent(track, start), seed: S.seed ?? manifest.seed ?? 1 };
}

// the ship on the d-pad, a quarter of a screen back of the middle, and the camera carried down the track
function playOf(G, { airframe = true } = {}) {
  const { view, cam, ship, track, start } = G, V = SCROLL_VIEWS[view], at = [-cam.screen.along / 4, 0];
  const body = airframe ? { type: 'figure-rig', figure: 'craft' } : { type: 'mesh', shape: 'box', size: view === 'side' ? [r2(ship.breadth / 3), ship.length, ship.breadth] : [ship.breadth, ship.length, r2(ship.breadth / 3)], color: '#e9eef4' };
  return {
    entities: [{ id: 'player', pilotable: true, rule: { type: 'scroll-ship', size: [ship.length, ship.breadth], at }, ambient: { type: 'static' }, body,
      transform: { pos: toWorld(view, [start[0] + at[0], start[1] + at[1], 0]).map(r2), heading: Math.atan2(V.along[1], V.along[0]) } }],
    camera: { rule: 'scroll', target: 'player', view, dist: cam.dist, screen: [cam.screen.along, cam.screen.across], start, track },
    ...(airframe ? { figures: { craft: { craft: { archetype: ship.craft, flying: true, gear: 'up' } } } } : {}),
  };
}

/** The ship and the scroll camera, as a level puts them on its manifest. */
export const scrollStagePlay = (manifest, { airframe = true } = {}) => playOf(scrollStageOf(manifest), { airframe });

/** The World payload of a scroll stage. */
export function assembleScrollStage(manifest, { title = 'Blaze Gunner' } = {}) {
  const S = manifest.scroll || {}, G = scrollStageOf(manifest), { view, cam, ship, track, start, extent, seed } = G, V = SCROLL_VIEWS[view];
  // the key: from behind the camera, over the ship and a little ahead, so the profiles turned to the camera are lit (the
  // side map's key, never the cube's own bearing); the star the backdrop's worlds are lit by
  const sun = unit(V.toward.map((t, i) => t * 0.6 + V.up[i] * 0.7 + V.along[i] * 0.35));
  const space = layScrollSpace(cam, extent, { seed, ...(S.layers ? { layers: S.layers } : {}) });
  const hulls = (S.hulls ?? []).map((H, k) => {
    const d = (H.depth ?? HULL_DEPTH) * cam.dist, pos = toWorld(view, [H.at * cam.screen.along, (H.v ?? 0) * cam.screen.across, d]).map(r2);
    const laid = layFleet([{ id: `hull-${k}`, capital: H.capital, at: {}, heading: H.heading ?? 0, seed: H.seed ?? seed }], { pos, heading: Math.atan2(V.along[1], V.along[0]) }, { sun });
    return { faces: hazeHulls(laid.faces, cam, d), report: laid.report[0] };
  });
  // the sky at infinity: the space map's stars, and its backdrop's large world set in the camera's view, a little ahead
  // and over it
  const look = unit(V.toward.map((t, i) => -t + V.along[i] * 0.22 + V.up[i] * 0.16));
  const B = S.backdrop === false ? null : planBackdrop({ star: sun, seed: S.backdrop?.seed ?? seed, toward: look, ...Object.fromEntries(['planets', 'nebula', 'suns', 'worlds', 'proximity'].filter((k) => S.backdrop?.[k] !== undefined).map((k) => [k, S.backdrop[k]])) });
  const hfov = 2 * Math.atan(Math.tan((cam.vfov * Math.PI) / 360) * cam.aspect) * (180 / Math.PI);
  const look0 = toWorld(view, [start[0], start[1], 0]), eye0 = toWorld(view, [start[0], start[1], cam.dist]);
  return {
    faces: [...space.faces, ...hulls.flatMap((h) => h.faces)],
    sky: { space: true, seed: 7, center: [0, 0, 0], radius: 7000, follow: true, sun: { dir: sun, size: SPACE_STAR.size, glow: SPACE_STAR.glow }, ...(B ? { backdrop: B } : {}) },
    bg: SPACE_VOID,
    ...playOf(G, { airframe: false }),
    cameras: [{ name: 'start', worldFraming: { cameraPosition: eye0.map(r2), lookAt: look0.map(r2), horizontalFov: r2(hfov) } }],
    viewBox: { width: 1280, height: Math.round(1280 / cam.aspect) },
    title,
    meta: { scroll: { view, screen: cam.screen, dist: cam.dist, ship, track, extent, layers: space.report, hulls: hulls.map((h) => h.report) } },
  };
}

