/**
 * THE FIELD — where a frame fights: a geocube's own land at a frame's scale, drawn in the seventh generation's form render
 * (the gen-7 land: its relief, rock and scree, the land's rules, the scree's stones), with no trail (the frame has its
 * radar) and no blocks: pure terrain. The geocube's island specimen (era/geocube.js `show: 'land'`, local-meru/scene.js)
 * widened to a mech's field: its shore some 600 m out, its rim raised all round, its tiers a mesa and a rise, its ground a
 * painted landscape at real scale under a craggy relief.
 *
 *   FRAME_FIELDS               the field's forms by an operation's map: plain (a broad plain round a mesa), basin (a
 *                              crater's floor under a high rim); and the massif fields, sandstone country stood on the
 *                              floor (local-meru/massif.js): wadi (sheer jebels round an open floor), gorge (a canyon
 *                              through a plateau, a river down it), scree (a scarp over its fans and fallen blocks),
 *                              craters (a stony plain struck by meteorites), oasis (a lake among jebels); asteroid (a
 *                              rock in the belt, airless, its gravity the space ground's)
 *   frameFieldCube(form, { world? }) → the cube spec in the seventh generation, its outside the form's: a massif field's
 *                              own battlefield cube (assault-frame/geocubes.js) unless a world is named, else a Sol world's
 *                              (`mars` by default) with its air thinned for a field a kilometre wide
 *   frameFieldManifest(form, opts) → the stage manifest a frame level is drawn on: { kind: 'geocube', show: 'land', … }
 *   frameField(cube)           → { heightAt(x, y), landAt(x, y), waterAt(x, y), sea, centre, half }: the ground a frame
 *                              stands on (the land as the page lays it, with none of its faces built: local-meru/scene.js
 *                              localMeruHeight; or the water's sheet where the land lies under it: a frame hovers, it never
 *                              goes under), the land alone, where it is water, the water's line, its middle and the
 *                              half-width a frame keeps to; a works' field's (indoor) its works' colliders and decks;
 *                              kept per cube
 *
 * Pure: the same form, the same field.
 */
import { readGeocube, lowerGeocube } from '../era/geocube.js';
import { localMeruHeight } from '../local-meru/scene.js';
import { FIELD_GEOCUBES } from './geocubes.js';
import { readWorks, worksFaces } from '../local-meru/works.js';

const f = Object.freeze;
// (the island a field is grown from: its land 4 m quads, broad, a narrow strand, its rim raised the whole way round so
// the field reads as a bowl of country and its sea is never seen; open, its ground rolling right round, no trail's apron)
// (the massif fields' forms and the battlefield cube each is cut from)
export const MASSIF_FORMS = f({ wadi: 'sandstone-wadi', gorge: 'sandstone-gorge', scree: 'scree-scarp', craters: 'crater-plain', oasis: 'wadi-oasis', smelter: 'smelter-hall', refinery: 'refinery-works', asteroid: 'belt-asteroid' });
const ISLAND = f({ geology: true, walk: 'none', open: true, seabed: 'merged', cell: 4, scale: 3, cover: 'soil', beach: 10, sea: 2.1, depth: 9, shore: 560 });
export const FRAME_FIELDS = f({
  plain: f({
    island: f({ ...ISLAND, high: f({ height: 22, span: 360 }) }),
    tiers: f([f({ form: 'mound', height: 30, foot: 80, summit: 40 }), f({ form: 'mound', height: 14, foot: 30, summit: 14, up: f({ turns: 1 }) })]),
    ground: f({ from: f({ heartbeat: 'rocky-irregular', splatch: 'bone-trio', seed: 'tharsis' }), span: 1600, height: 32 }),
    relief: 'craggy',
  }),
  basin: f({
    island: f({ ...ISLAND, shore: 600, high: f({ height: 46, span: 360 }) }),
    tiers: f([f({ form: 'mound', height: 18, foot: 60, summit: 30 }), f({ form: 'mound', height: 10, foot: 24, summit: 10, up: f({ turns: 1 }) })]),
    ground: f({ from: f({ heartbeat: 'ridge-step', splatch: 'bone-trio', seed: 'gale' }), span: 1800, height: 24 }),
    relief: 'eroded',
  }),
  // THE MASSIF FIELDS: sandstone country stood on the floor, each the outside of its battlefield cube
  // (assault-frame/geocubes.js), its rock the massif's card (local-meru/massif.js); a form names its cube
  ...Object.fromEntries(Object.entries(MASSIF_FORMS).map(([form, cube]) => [form, FIELD_GEOCUBES[cube].outside])),
});
// (the cube's air thinned for a field: its fog was set for a specimen island a quarter of a kilometre wide)
const FIELD_FOG = 0.32;

const clone = (v) => JSON.parse(JSON.stringify(v));

export function frameFieldCube(form = 'plain', { world } = {}) {
  const F = FRAME_FIELDS[form];
  if (!F) throw new Error(`frame field: '${form}' is one of ${Object.keys(FRAME_FIELDS).join(', ')}`);
  // (a massif field is its battlefield cube's own unless a world is named; a battlefield cube's air is already a field's)
  const from = world ?? MASSIF_FORMS[form] ?? 'mars';
  return { from, era: 'gen-7', ...(FIELD_GEOCUBES[from] ? {} : { light: { outsideFog: FIELD_FOG } }), outside: clone(F) };
}

export function frameFieldManifest(form = 'plain', opts = {}) {
  // (its stones the lean set: a field's scree is a kilometre of it, every stone stood up would weigh the page down)
  // (a massif field's walls stand tens of metres on a 4 m grid: the page's rock relief, cut into each steep triangle and
  // pushed along its own face's normal, opens cracks along such walls, so they are drawn as their beds and bands stand)
  return { kind: 'geocube', show: 'land', parallax: MASSIF_FORMS[form] ? false : 'cliffs', cube: frameFieldCube(form, opts) };
}

const FIELDS = new Map();
export function frameField(cube) {
  const key = JSON.stringify(cube);
  if (FIELDS.has(key)) return FIELDS.get(key);
  if (FIELDS.size > 8) FIELDS.clear();
  const C = readGeocube(cube), H = localMeruHeight(lowerGeocube(C, 'outside'));
  if (!H) throw new Error('frame field: the cube\'s outside has no island to fight on');
  // (the half-width a frame keeps to: its square's corners inside the shore, on the rim's rise and short of the strand)
  const shore = C.outside.island.shore ?? 300, half = Math.round(shore * 0.68);
  // (a frame never goes under water: it hovers on it, so the ground it stands on is the land or the water's sheet over it,
  // as the page's probe finds the sea's surface first; `waterAt` says where it is water, for the hover's effects)
  const sea = H.island.sea, land = H.heightAt;
  // (a works' field, under a roof: indoor, its works' solids what stops a frame, local-meru/works.js)
  const W = C.outside.works ? worksFaces(readWorks(C.outside.works), H.centre, land) : null;
  const out = { heightAt: (x, y) => Math.max(land(x, y), sea), landAt: land, waterAt: (x, y) => land(x, y) < sea, sea, centre: H.centre.map((v) => Math.round(v * 100) / 100), half,
    ...(W ? { indoor: true, colliders: W.colliders, decks: W.decks } : {}) };
  FIELDS.set(key, out);
  return out;
}
