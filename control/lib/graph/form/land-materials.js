/**
 * THE LAND'S MATERIALS (a geocube's `outside.materials`, opt-in): the four natural layers the form render's land blends
 * (rock, scree, soil, sand: form/land-layers.js) dressed as another place's materials, so a works' floor is the same
 * land, its bands, its wear and its tiling, made of steel, slag, concrete and ash. A set names, for each layer, the cut
 * the layer is painted in (matte-paint/dressed.js), its tile in metres, the cube colour it takes (a role: era/cube-light.js
 * solves it) and how metal it is (the page's metalness, blended by the layers' weights).
 *
 *   MATERIAL_SETS             the sets: foundry, refinery, hangar
 *   readMaterials(spec)       a set's name or { from?, rock?, scree?, soil?, sand? } → the set, checked (null when absent)
 *
 * A layer's words: { cut, metres, role, metal (0..1), rough? (0..1, over the cut's own) }.
 *
 * Which land class lays which layer is the land's own (cliff and rock: rock; scree; soil and ground: soil; sand), so a
 * works' walls and decks built as rock are its steel, its aprons of spoil its slag, its floor its concrete.
 */
const f = Object.freeze;
const L = (cut, metres, role, metal, rough) => f({ cut, metres, role, metal, ...(rough !== undefined ? { rough } : {}) });

export const MATERIAL_SETS = f({
  // a smelter's hall: walls and machines of riveted steel plate, slag in heaps and drifts, a poured concrete floor (its
  // slabs, joints and pours the works' floor plan's, local-meru/works-floor.js: the layer only its grain), ash and dust
  // settling everywhere the traffic does not reach
  foundry: f({ id: 'foundry', reads: 'Riveted steel plate, black slag, slabbed concrete, settled ash',
    rock: L('plate', 5, 'stone', 0.65, 0.75), scree: L('scree', 3, 'trim', 0, 0.95), soil: L('powder', 3, 'floor', 0, 0.9), sand: L('powder', 2, 'sand', 0, 1) }),
  // a refinery's superstructure: open steel grating and deck plate, gravel, concrete (its pads the floor plan's), oily grime
  refinery: f({ id: 'refinery', reads: 'Steel grating and tread plate, gravel ballast, concrete pads, oily grime',
    rock: L('tread', 2.5, 'stone', 0.75, 0.5), scree: L('scree', 2.5, 'trim', 0, 0.95), soil: L('powder', 3, 'floor', 0, 0.85), sand: L('powder', 1.6, 'sand', 0, 0.7) }),
  // a hangar: plate walls, a sealed epoxy floor in bays, grit and rubber in the lanes
  hangar: f({ id: 'hangar', reads: 'Steel wall plate, a sealed epoxy floor, grit in the lanes',
    rock: L('plate', 4, 'stone', 0.7, 0.5), scree: L('scree', 2, 'trim', 0, 0.95), soil: L('epoxy', 8, 'floor', 0, 0.45), sand: L('powder', 1.6, 'sand', 0, 0.9) }),
});
export const MATERIAL_LAYERS = f(['rock', 'scree', 'soil', 'sand']);
const CUTS = f(['strata', 'scree', 'soil', 'sand', 'powder', 'clay', 'plate', 'tread', 'block', 'panel', 'epoxy', 'grating', 'corrugated', 'sheetpile', 'decking', 'membrane', 'perforated', 'precast', 'terrazzo', 'studded', 'seam', 'matte', 'pavement']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (m) => { throw new Error(`materials${m}`); };

/** A set's name or { from?, …layers } → the set (each layer whole), or null when absent. */
export function readMaterials(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (typeof spec === 'string') {
    if (!MATERIAL_SETS[spec]) bad(` '${spec}' is not a set (sets: ${Object.keys(MATERIAL_SETS).join(', ')})`);
    return MATERIAL_SETS[spec];
  }
  if (!isObj(spec)) bad(` is a set's name (${Object.keys(MATERIAL_SETS).join(', ')}) or { from?, rock?, scree?, soil?, sand? }`);
  for (const k of Object.keys(spec)) if (k !== 'from' && !MATERIAL_LAYERS.includes(k)) bad(`.${k} is not a layer (layers: ${MATERIAL_LAYERS.join(', ')})`);
  if (spec.from !== undefined && !MATERIAL_SETS[spec.from]) bad(`.from '${spec.from}' is not a set (sets: ${Object.keys(MATERIAL_SETS).join(', ')})`);
  const base = spec.from ? MATERIAL_SETS[spec.from] : MATERIAL_SETS.foundry, out = { id: spec.from ? `${spec.from}*` : 'own' };
  for (const k of MATERIAL_LAYERS) {
    const Ly = { ...base[k], ...(spec[k] ?? {}) };
    if (!CUTS.includes(Ly.cut)) bad(`.${k}.cut is one of ${CUTS.join(', ')}`);
    if (!(typeof Ly.metres === 'number' && Ly.metres >= 0.5 && Ly.metres <= 40)) bad(`.${k}.metres is the tile in metres, 0.5..40`);
    if (!(typeof Ly.role === 'string' && /^[a-z]{3,16}$/.test(Ly.role))) bad(`.${k}.role is one of the cube's colours by its role ('stone', 'floor', 'sand', 'trim', …)`);
    if (!(typeof Ly.metal === 'number' && Ly.metal >= 0 && Ly.metal <= 1)) bad(`.${k}.metal is 0..1`);
    if (Ly.rough !== undefined && !(typeof Ly.rough === 'number' && Ly.rough >= 0.02 && Ly.rough <= 1)) bad(`.${k}.rough is 0.02..1`);
    out[k] = f(Ly);
  }
  return f(out);
}
