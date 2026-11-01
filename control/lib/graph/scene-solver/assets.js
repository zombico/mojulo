/**
 * THE ASSETS A SCENE MAY PLACE, annotated (the scene solver's vocabulary). Unlike mojulo's other solvers (the colour
 * theorist, cube-light, the feel lowering), the scene solver chooses among assets and concepts, not only numbers: each
 * asset carries a card of what it brings to a scene, so the solver, and an agent reading it, chooses by what an asset
 * does rather than by which biome it came from. A biome's assets are anyone's once their cards say what they are.
 *
 * A card holds only what judgement says and the code cannot: the climates an asset belongs to, the structure it brings
 * (how it closes over the walk, its silhouette, how it stands), and the words people say for it. What the code already
 * knows is read from the code, never copied here: an asset's heights, colours, evergreen leaf, fall colour, and above
 * all its REACH, how a gen-7 scene comes to place it (`reachOf`), from the registries that place it. An asset no scene
 * can reach yet is a GAP (`gaps`), named, never approximated.
 *
 *   ASSET_FAMILIES       family → { source: () => the registry's ids, card vocabulary }
 *   ASSET_CARDS          family → id → card
 *   assetCard(family, id) → the card joined with what the code knows (heights, colours, evergreen, autumn, reach)
 *   reachOf(family, id)  → { via, id? } | null: the recipe words that bring it into a gen-7 scene, or none
 *   gaps()               → [{ family, id }]: the assets no gen-7 scene reaches yet
 *   checkCard(family, card) throws on a word outside the family's vocabulary
 */
import { SPECIES } from '../vegetation/species.js';
import { GRASSES } from '../vegetation/grass.js';
import { WILDFLOWERS, WEEDS } from '../vegetation/wildflowers.js';
import { BUSH_HABITS } from '../form/bush-form.js';
import { FLORA_SPECIES, FLORA_DEFAULT, FLORA_BAMBOO, AUTUMN } from '../form/flora-read.js';
import { FLOWER_COLOURS } from '../form/grass-drifts.js';
import { GRASS_TIERS } from '../scene/channels/form-grass.js';
import { RELIEF_CARDS } from '../noise/relief.js';
import { WATER_FORMS } from '../era/out-water.js';
import { SNOW_DEPTHS } from '../era/snow.js';

const fz = Object.freeze;
/** The climates a card may name. */
export const CLIMATES = fz(['temperate', 'boreal', 'alpine', 'montane', 'tropical', 'subtropical', 'arid', 'coastal', 'wetland']);
/** How much one plant closes over the walk under it (its crown's shade), and how a plant stands. */
export const CANOPY = fz(['none', 'light', 'medium', 'dense']);
export const STANDS = fz(['solitary', 'grove', 'stand', 'clump', 'bed', 'avenue', 'waterside', 'understory', 'carpet', 'scatter']);
/** How far a ground asset raises the walk (the verticality read) and opens the view (the openness read). */
export const RISE = fz(['flat', 'low', 'medium', 'high']);
export const OPENS = fz(['closes', 'neutral', 'opens']);

const card = (climates, more, words) => fz({ climates: fz(climates), ...more, words: fz(words) });

export const ASSET_CARDS = fz({
  // the trees, palms, bamboos and conifers (vegetation/species.js): a crown's silhouette in a word, how it closes over
  // the walk, how it stands
  species: fz({
    oak: card(['temperate'], { crown: 'broad dome', canopy: 'dense', stands: 'solitary' }, ['oak', 'old tree', 'broad crown', 'pastoral']),
    beech: card(['temperate'], { crown: 'tall dome', canopy: 'dense', stands: 'grove' }, ['beech', 'beech wood', 'cathedral canopy', 'smooth bark']),
    fir: card(['boreal', 'alpine'], { crown: 'narrow cone', canopy: 'dense', stands: 'stand' }, ['fir', 'mountain forest', 'christmas tree']),
    schefflera: card(['tropical', 'montane'], { crown: 'umbrella', canopy: 'medium', stands: 'grove' }, ['umbrella tree', 'cloud forest']),
    banyan: card(['tropical'], { crown: 'spreading on pillar roots', canopy: 'dense', stands: 'solitary' }, ['banyan', 'sacred tree', 'aerial roots']),
    strangler: card(['tropical'], { crown: 'emergent', canopy: 'medium', stands: 'solitary' }, ['strangler fig', 'rainforest giant', 'lattice roots']),
    rubberfig: card(['tropical'], { crown: 'buttressed dome', canopy: 'dense', stands: 'grove' }, ['rubber fig', 'buttress roots', 'rainforest']),
    cherry: card(['temperate'], { crown: 'wide dome', canopy: 'medium', stands: 'avenue' }, ['cherry', 'blossom', 'sakura', 'spring']),
    willow: card(['temperate', 'wetland'], { crown: 'weeping curtain', canopy: 'medium', stands: 'waterside' }, ['willow', 'weeping', 'riverside']),
    maple: card(['temperate'], { crown: 'round', canopy: 'dense', stands: 'grove' }, ['maple', 'autumn red', 'park']),
    coconut: card(['tropical', 'coastal'], { crown: 'fan on a leaning trunk', canopy: 'light', stands: 'grove' }, ['coconut palm', 'beach palm', 'island']),
    date: card(['arid'], { crown: 'fan', canopy: 'light', stands: 'grove' }, ['date palm', 'oasis', 'desert palm']),
    washingtonia: card(['arid', 'subtropical'], { crown: 'tall fan', canopy: 'light', stands: 'avenue' }, ['fan palm', 'boulevard palm', 'california']),
    treefern: card(['tropical', 'montane'], { crown: 'fern crown', canopy: 'light', stands: 'understory' }, ['tree fern', 'fern gully']),
    moso: card(['subtropical', 'temperate'], { crown: 'culm grove', canopy: 'dense', stands: 'grove' }, ['bamboo forest', 'bamboo grove', 'zen']),
    vulgaris: card(['tropical'], { crown: 'arching culm clump', canopy: 'dense', stands: 'clump' }, ['tropical bamboo', 'bamboo clump']),
    reed: card(['wetland'], { crown: 'stem tuft', canopy: 'none', stands: 'bed' }, ['reed', 'reed bed', 'marsh']),
    spruce: card(['boreal', 'alpine'], { crown: 'spire', canopy: 'dense', stands: 'stand' }, ['spruce', 'taiga', 'mountain']),
    silverfir: card(['alpine'], { crown: 'spire', canopy: 'dense', stands: 'stand' }, ['silver fir', 'alpine forest']),
    pine: card(['boreal', 'temperate', 'alpine'], { crown: 'open crown high on the trunk', canopy: 'medium', stands: 'stand' }, ['pine', 'pine wood', 'scots pine']),
  }),
  // the bushes, by the habit a leaf form takes as one (form/bush-form.js BUSH_HABITS; its outline is the code's)
  bush: fz({
    spray: card(['temperate'], { canopy: 'none', stands: 'scatter' }, ['bush', 'shrub', 'hedge']),
    plate: card(['temperate', 'boreal'], { canopy: 'none', stands: 'clump' }, ['mound bush', 'low spreading shrub']),
    weep: card(['temperate', 'wetland'], { canopy: 'none', stands: 'waterside' }, ['fountain bush', 'arching shrub']),
    tuft: card(['temperate', 'arid'], { canopy: 'none', stands: 'scatter' }, ['upright shrub', 'broom']),
    whorl: card(['tropical', 'subtropical'], { canopy: 'none', stands: 'understory' }, ['rosette', 'broad leaves', 'tropical understory']),
    spire: card(['boreal', 'alpine'], { canopy: 'none', stands: 'scatter' }, ['young conifer', 'cone shrub']),
  }),
  // the sward's lengths, the form render's own grass (scene/channels/form-grass.js GRASS_TIERS)
  sward: fz({
    tall: card(['temperate', 'tropical'], { stands: 'carpet' }, ['tall grass', 'meadow', 'long grass', 'wild']),
    medium: card(['temperate'], { stands: 'carpet' }, ['grass', 'field', 'pasture']),
    short: card(['temperate', 'alpine', 'coastal'], { stands: 'carpet' }, ['short grass', 'lawn', 'grazed', 'turf', 'alpine turf']),
  }),
  // the grass kinds (vegetation/grass.js GRASSES), placed in a gen-7 scene as drifts
  grass: fz({
    fescue: card(['temperate', 'alpine'], { stands: 'clump' }, ['fescue', 'blue-green tufts', 'wiry grass']),
    meadow: card(['temperate'], { stands: 'carpet' }, ['meadow grass', 'soft grass', 'hay']),
    tussock: card(['alpine', 'montane'], { stands: 'clump' }, ['tussock', 'bunchgrass', 'paramo']),
    needlegrass: card(['arid'], { stands: 'scatter' }, ['needlegrass', 'steppe', 'feather grass', 'silver awns']),
    sedge: card(['wetland'], { stands: 'carpet' }, ['sedge', 'wet meadow', 'bog']),
    fountain: card(['subtropical'], { stands: 'clump' }, ['fountain grass', 'red grass', 'ornamental']),
    pampas: card(['subtropical', 'temperate'], { stands: 'clump' }, ['pampas', 'plumes', 'tall plumes']),
    lawn: card(['temperate'], { stands: 'carpet' }, ['lawn', 'mown', 'short turf']),
    marram: card(['coastal'], { stands: 'clump' }, ['marram', 'dune grass', 'beach grass']),
    elephant: card(['tropical'], { stands: 'carpet' }, ['elephant grass', 'savanna', 'very tall grass']),
    wheat: card(['temperate'], { stands: 'carpet' }, ['wheat', 'field', 'crop', 'golden']),
    chaff: card(['temperate', 'arid'], { stands: 'scatter' }, ['chaff', 'straw', 'stubble', 'dry']),
  }),
  // the flowers and the weeds (vegetation/wildflowers.js; their colours are the form render's, form/grass-drifts.js)
  flower: fz({
    daisy: card(['temperate'], { stands: 'scatter' }, ['daisy', 'white flowers', 'meadow flowers']),
    buttercup: card(['temperate'], { stands: 'scatter' }, ['buttercup', 'yellow flowers']),
    clover: card(['temperate'], { stands: 'scatter' }, ['clover', 'pink flowers', 'pasture']),
    lupine: card(['temperate', 'alpine'], { stands: 'clump' }, ['lupine', 'purple spikes']),
    poppy: card(['temperate', 'arid'], { stands: 'scatter' }, ['poppy', 'red flowers', 'field edge']),
    dandelion: card(['temperate'], { stands: 'scatter' }, ['dandelion', 'weeds', 'yellow']),
    speedwell: card(['temperate'], { stands: 'scatter' }, ['speedwell', 'tiny blue flowers', 'weeds']),
    yarrow: card(['temperate', 'alpine'], { stands: 'scatter' }, ['yarrow', 'white umbels', 'roadside']),
    plantain: card(['temperate'], { stands: 'scatter' }, ['plantain', 'weeds', 'trampled ground']),
  }),
  // the ground: the plain's relief (noise/relief.js RELIEF_CARDS), the water (era/out-water.js), dunes, snow
  relief: fz({
    rolling: card(['temperate'], { rise: 'low', opens: 'opens' }, ['rolling', 'downs', 'gentle hills']),
    craggy: card(['alpine', 'montane', 'boreal'], { rise: 'medium', opens: 'neutral' }, ['craggy', 'rocky', 'rough']),
    eroded: card(['arid', 'montane'], { rise: 'high', opens: 'neutral' }, ['eroded', 'badlands', 'gullies']),
    terraced: card(['temperate', 'subtropical'], { rise: 'medium', opens: 'opens' }, ['terraced', 'benches', 'old fields']),
    dune: card(['arid', 'coastal'], { rise: 'low', opens: 'opens' }, ['dune', 'wind-laid', 'sand crests']),
  }),
  water: fz({
    lake: card(['temperate', 'boreal', 'alpine'], { opens: 'opens' }, ['lake', 'pond', 'tarn', 'lakeside']),
    coast: card(['coastal'], { opens: 'opens' }, ['beach', 'coast', 'sea', 'shore']),
    river: card(['temperate', 'tropical', 'wetland'], { opens: 'neutral' }, ['river', 'stream', 'brook', 'creek']),
    falls: card(['montane', 'tropical', 'temperate'], { opens: 'neutral' }, ['waterfall', 'falls', 'cascade']),
  }),
  snow: fz({
    dusting: card(['temperate', 'alpine'], {}, ['frost', 'a dusting of snow', 'early winter']),
    cover: card(['alpine', 'boreal', 'temperate'], {}, ['snowy', 'snow', 'winter']),
    deep: card(['alpine', 'boreal'], {}, ['deep snow', 'snowbound', 'midwinter']),
  }),
});

/** The families: where each one's ids come from (its registry), and the words its cards may use. */
export const ASSET_FAMILIES = fz({
  species: fz({ source: () => Object.keys(SPECIES), vocab: fz({ canopy: CANOPY, stands: STANDS }) }),
  bush: fz({ source: () => Object.keys(BUSH_HABITS), vocab: fz({ canopy: CANOPY, stands: STANDS }) }),
  sward: fz({ source: () => GRASS_TIERS.map((t) => t.sward), vocab: fz({ stands: STANDS }) }),
  grass: fz({ source: () => Object.keys(GRASSES), vocab: fz({ stands: STANDS }) }),
  flower: fz({ source: () => Object.keys(WILDFLOWERS), vocab: fz({ stands: STANDS }) }),
  relief: fz({ source: () => Object.keys(RELIEF_CARDS), vocab: fz({ rise: RISE, opens: OPENS }) }),
  water: fz({ source: () => [...WATER_FORMS], vocab: fz({ opens: OPENS }) }),
  snow: fz({ source: () => Object.keys(SNOW_DEPTHS), vocab: fz({}) }),
});

/** A card's words checked against its family's vocabulary and the climates; throws naming the word. */
export function checkCard(family, c) {
  const F = ASSET_FAMILIES[family]; if (!F) throw new Error(`scene-solver: '${family}' is not an asset family (${Object.keys(ASSET_FAMILIES).join(', ')})`);
  if (!Array.isArray(c.climates) || !c.climates.length) throw new Error(`scene-solver: a ${family} card names its climates`);
  for (const k of c.climates) if (!CLIMATES.includes(k)) throw new Error(`scene-solver: '${k}' is not a climate (${CLIMATES.join(', ')})`);
  for (const [k, allowed] of Object.entries(F.vocab)) if (c[k] !== undefined && !allowed.includes(c[k])) throw new Error(`scene-solver: a ${family} card's ${k} '${c[k]}' is not one of ${allowed.join(', ')}`);
  if (!Array.isArray(c.words) || !c.words.length) throw new Error(`scene-solver: a ${family} card names the words people say for it`);
  return c;
}
for (const [f, cards] of Object.entries(ASSET_CARDS)) for (const c of Object.values(cards)) checkCard(f, c);

// the leaf forms each species is grown for in the form render (form/flora-read.js FLORA_SPECIES), inverted
const LEAF_FORM_OF = Object.fromEntries(Object.entries(FLORA_SPECIES).map(([form, sp]) => [sp, form]));

/** How a gen-7 scene comes to place an asset: the recipe words that bring it, read from the registries that place it,
 *  or null (a gap). */
export function reachOf(family, id) {
  switch (family) {
    case 'species':
      if (LEAF_FORM_OF[id]) return { via: 'flora.trees.kinds', form: LEAF_FORM_OF[id] };
      if (FLORA_DEFAULT.includes(id)) return { via: 'default' };
      if (id === FLORA_BAMBOO) return { via: 'bamboo card' };
      return null;
    case 'bush': return BUSH_HABITS[id] ? { via: 'flora.bushes.kinds', form: id } : null;
    case 'sward': return { via: 'flora.grass.sward', id };
    case 'grass': return GRASSES[id] ? { via: 'flora.grass.drifts', id } : null;
    case 'flower': return WILDFLOWERS[id] ? (WEEDS.includes(id) ? { via: 'weeds', also: 'flora.flowers.mix' } : { via: 'flora.flowers.mix', id }) : null;
    case 'relief': return RELIEF_CARDS[id] ? { via: 'cube.outside.relief', id } : null;
    case 'water': return WATER_FORMS.includes(id) ? { via: 'cube.outside.water', id } : null;
    case 'snow': return SNOW_DEPTHS[id] !== undefined ? { via: 'cube.snow', depth: id } : null;
    default: return null;
  }
}

/** The card joined with what the code knows of the asset. */
export function assetCard(family, id) {
  const c = ASSET_CARDS[family]?.[id]; if (!c) return null;
  const known = {};
  if (family === 'species') {
    const S = SPECIES[id];
    Object.assign(known, { kind: S.kind, heights: S.heights, evergreen: S.kind === 'conifer' || S.kind === 'palm' || (S.leafLife ?? 0) >= 3, autumn: !!AUTUMN.colours[id], bloom: !!S.bloom });
  }
  if (family === 'bush') known.shape = BUSH_HABITS[id].shape;
  if (family === 'grass') Object.assign(known, { heights: GRASSES[id].heights, habit: GRASSES[id].habit, label: GRASSES[id].label });
  if (family === 'flower') Object.assign(known, { colour: FLOWER_COLOURS[id]?.petal ?? null, weed: WEEDS.includes(id), label: WILDFLOWERS[id].label });
  if (family === 'relief') known.reads = RELIEF_CARDS[id].reads;
  if (family === 'snow') known.depth = SNOW_DEPTHS[id];
  return { family, id, ...c, ...known, reach: reachOf(family, id) };
}

/** The assets no gen-7 scene reaches yet. */
export const gaps = () => Object.keys(ASSET_CARDS).flatMap((f) => Object.keys(ASSET_CARDS[f]).filter((id) => !reachOf(f, id)).map((id) => ({ family: f, id })));
