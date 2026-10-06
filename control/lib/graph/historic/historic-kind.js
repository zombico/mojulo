/**
 * historic-kind — the `historic` world kind: a culture at its period, minted from a manifest.
 *
 *   { kind: 'historic', culture: 'thebes', scene: 'city' | 'region' | 'farm' | 'works', seed?, season?, view? }
 *
 * The scenes are the builders that already exist (the town, the town in its land, a farmstead, the works),
 * each taken to the World page as the town is (`assembleHistoricWorld`): the faces' tiles resolved into the
 * texture map and the culture's style card sky as the dome. Nothing is built here, and nothing a builder
 * draws changes: a manifest names what the builders already take.
 *
 * A manifest is checked before anything is built: an unknown culture, scene, season or view is refused with
 * the ids on offer (a builder alone falls back to Sumer, which a recipe must never do silently).
 */
import { HISTORIC_CULTURES, assembleHistoricWorld, planHistoricCity } from './historic-city.js';
import { landOf } from './cultures/index.js';
import { REGION_CULTURES, assembleRegionScene, planRegion } from './historic-region.js';
import { FARM_CULTURES, assembleFarmsteadScene, planFarmstead } from './farmstead.js';
import { WORKS_CULTURES, assembleWorksScene, planWorks } from './workshops.js';
import { HISTORIC_STYLES } from './style/index.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { deriveSky } from '../polygonizer/painted-landscape.js';
import { validateStatues } from './statues.js';

// the farm and works builders key their cultures by the land (`landOf`: a card's `land`, else its id)
const SEASONS = { region: (c) => Object.keys(REGION_CULTURES[c].crops), farm: (c) => Object.keys(FARM_CULTURES[landOf(c)].seasons || { harvest: 1, sowing: 1 }) };
const having = (table) => Object.keys(HISTORIC_CULTURES).filter((c) => table[landOf(c)]);

/**
 * Each scene: which cultures have it, its plan (for the views it offers) and its World payload.
 * `region`, `farm` and `works` go out as CSS-3D-shaped scenes; `toWorld` gives them the town's World dress.
 */
export const HISTORIC_SCENES = {
  city: {
    get cultures() { return Object.keys(HISTORIC_CULTURES); },
    plan: (o) => planHistoricCity(o),
    world: (o) => assembleHistoricWorld(o),
  },
  region: {
    get cultures() { return Object.keys(REGION_CULTURES).filter((c) => HISTORIC_CULTURES[c]); },
    plan: (o) => planRegion(o),
    world: (o) => toWorld(assembleRegionScene(o), o.culture),
  },
  farm: {
    get cultures() { return having(FARM_CULTURES); },
    plan: (o) => planFarmstead({ ...o, culture: landOf(o.culture) }),
    world: (o) => toWorld(assembleFarmsteadScene({ ...o, culture: landOf(o.culture) }), o.culture),
  },
  works: {
    get cultures() { return having(WORKS_CULTURES); },
    plan: (o) => planWorks({ ...o, culture: landOf(o.culture) }),
    world: (o) => toWorld(assembleWorksScene({ ...o, culture: landOf(o.culture) }), o.culture),
  },
};

/** A CSS-3D-shaped scene in the town's World dress: its tiles in the texture map, the culture's sky as the dome. */
function toWorld(scene, culture) {
  const style = HISTORIC_STYLES[culture];
  const card = style && style.sky && style.sky.palette ? deriveSky(style.sky.palette, { x: 0, y: 0, z: style.sky.sunElev }) : null;
  return { ...scene, textures: collectFaceTextures(scene.faces, { ...(scene.textures || {}) }),
    ...(card ? { sky: { zenith: card.zenith.map(Math.round), horizon: card.horizon.map(Math.round), day: 1, stars: 0, seed: 1 } } : {}) };
}

const list = (a) => a.map((x) => `'${x}'`).join(', ');

/**
 * A manifest's options for its scene's builder, checked: `{ scene, opts }`. Throws on an unknown culture,
 * scene, season or view, naming the ids on offer.
 */
export function historicOptions(m = {}) {
  const culture = m.culture;
  if (!HISTORIC_CULTURES[culture]) throw new Error(`historic: unknown culture '${culture}' — one of ${list(Object.keys(HISTORIC_CULTURES))}`);
  const scene = m.scene ?? 'city', S = HISTORIC_SCENES[scene];
  if (!S) throw new Error(`historic: unknown scene '${scene}' — one of ${list(Object.keys(HISTORIC_SCENES))}`);
  if (!S.cultures.includes(culture)) {
    const has = Object.keys(HISTORIC_SCENES).filter((k) => HISTORIC_SCENES[k].cultures.includes(culture));
    throw new Error(`historic: ${culture} has no '${scene}' scene — it has ${list(has)}`);
  }
  const opts = { culture, seed: Number.isInteger(m.seed) ? m.seed : 1 };
  if (m.season !== undefined) {
    const seasons = SEASONS[scene] ? SEASONS[scene](culture) : [];
    if (!seasons.includes(m.season)) throw new Error(`historic: ${culture} ${scene} has no season '${m.season}'${seasons.length ? ` — one of ${list(seasons)}` : ' (it has no seasons)'}`);
    opts.season = m.season;
  }
  if (m.view !== undefined) {
    const views = historicViews({ scene, ...opts });
    if (!views.includes(m.view)) throw new Error(`historic: ${culture} ${scene} has no view '${m.view}' — one of ${list(views)}`);
    opts.view = m.view;
  }
  // `statues` (historic/statues.js): stored statues stood on the city's statue slots, in the World; absent ⇒ none
  if (m.statues !== undefined) {
    const errs = validateStatues(m.statues); if (errs.length) throw new Error(`historic: ${errs.join('; ')}`);
    if (scene !== 'city') throw new Error(`historic: statues stand on a city's statue slots; the '${scene}' scene has none`);
    if (m.statues === 'carved' || m.statues.length) opts.statues = m.statues;
  }
  return { scene, opts };
}

/** The views a scene opens on: the aerial, the town's approach, and the plan's own eye-level views. */
export function historicViews({ scene = 'city', ...opts }) {
  const plan = HISTORIC_SCENES[scene].plan(opts);
  return ['aerial', ...(scene === 'city' ? ['approach'] : []), ...Object.keys(plan.views || {})];
}

/** The `historic` world kind's payload: the checked manifest's scene on the World page. */
export function assembleHistoricKindScene(m = {}, { title } = {}) {
  const { scene, opts } = historicOptions(m);
  const payload = HISTORIC_SCENES[scene].world(opts);
  return title ? { ...payload, title } : payload;
}
