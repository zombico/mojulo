// equipment/arms/models — the arms' MODELS: per item, the archetypes it can be drawn as, each with its tunable parts
// (the words a slot takes) and its defaults. PURE DATA but the builder each row names (arms/index.js BUILDERS).
//
// A part is a word from its slot's list; `barrel` (and a knife's `length`) is a word from the model's own lengths or
// a length in centimetres. The future line (laws.js law 7) changes the defaults it names (`future`): the muzzle an
// emitter, the magazine a cell. A build's own parts always win.

const BARREL = ['short', 'standard', 'long'];
const PISTOL_TAKES = { barrel: BARREL, magazine: ['flush', 'extended', 'cell'], optic: ['irons', 'reddot'], muzzle: ['plain', 'suppressor', 'emitter'], underbarrel: ['none', 'light'] };
const REVOLVER_TAKES = { barrel: BARREL, optic: ['irons', 'reddot'], muzzle: ['plain', 'emitter'] };
const LONG_TAKES = { barrel: BARREL, stock: ['fixed', 'collapsible', 'folding', 'skeleton', 'none'], magazine: ['box', 'curved', 'drum', 'cell'], optic: ['irons', 'reddot', 'holo', 'scope', 'none'],
  muzzle: ['plain', 'flash', 'brake', 'suppressor', 'emitter'], rail: ['none', 'top', 'full'], underbarrel: ['none', 'grip', 'light', 'bipod'] };
const BULLPUP_TAKES = { barrel: BARREL, magazine: ['box', 'curved', 'cell'], optic: ['irons', 'reddot', 'holo', 'scope', 'none'], muzzle: ['plain', 'flash', 'brake', 'suppressor', 'emitter'], underbarrel: ['none', 'grip', 'light'] };
const SHOTGUN_TAKES = { barrel: BARREL, stock: ['fixed', 'collapsible', 'folding', 'none'], magazine: ['tube', 'box', 'cell'], optic: ['irons', 'reddot', 'holo', 'none'], muzzle: ['plain', 'brake', 'emitter'],
  rail: ['none', 'top'], underbarrel: ['none', 'light'], grip: ['straight', 'pistol'] };
const KNIFE_TAKES = { blade: ['clip', 'drop', 'tanto', 'spear', 'hawkbill'], length: ['short', 'standard', 'long'], guard: ['cross', 'choil', 'none'], handle: ['ridged', 'cord', 'slab'], serrations: [false, true] };
const FUT_GUN = { muzzle: 'emitter', magazine: 'cell' };

export const ARM_MODELS = Object.freeze({
  pistol: { default: 'service', models: {
    service: { build: 'pistol', frame: 'polymer', grip: 11, barrel: { short: 9.5, standard: 11.4, long: 13.5 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'irons', muzzle: 'plain', underbarrel: 'none' }, future: FUT_GUN },
    compact: { build: 'pistol', frame: 'polymer', grip: 9.4, barrel: { short: 8.4, standard: 9.5, long: 11.4 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'irons', muzzle: 'plain', underbarrel: 'none' }, future: FUT_GUN },
    heavy: { build: 'pistol', frame: 'steel', grip: 11.4, barrel: { short: 10.8, standard: 12.7, long: 15.2 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'irons', muzzle: 'plain', underbarrel: 'none' }, future: FUT_GUN },
    revolver: { build: 'revolver', barrel: { short: 7.6, standard: 10.2, long: 15.2 }, takes: REVOLVER_TAKES,
      parts: { barrel: 'standard', optic: 'irons', muzzle: 'plain' }, future: { muzzle: 'emitter' } },
  } },
  carbine: { default: 'assault', models: {
    assault: { build: 'long', layout: 'assault', barrel: { short: 26.7, standard: 36.8, long: 50.8 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'collapsible', magazine: 'curved', optic: 'reddot', muzzle: 'flash', rail: 'top', underbarrel: 'none' }, future: FUT_GUN },
  } },
  rifle: { default: 'assault', models: {
    assault: { build: 'long', layout: 'assault', barrel: { short: 36.8, standard: 50.8, long: 61 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'curved', optic: 'holo', muzzle: 'flash', rail: 'top', underbarrel: 'grip' }, future: FUT_GUN },
    marksman: { build: 'long', layout: 'marksman', barrel: { short: 50.8, standard: 61, long: 71 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'box', optic: 'scope', muzzle: 'brake', rail: 'top', underbarrel: 'bipod' }, future: FUT_GUN },
    bullpup: { build: 'bullpup', barrel: { short: 40, standard: 50.8, long: 61 }, takes: BULLPUP_TAKES,
      parts: { barrel: 'standard', magazine: 'curved', optic: 'reddot', muzzle: 'flash', underbarrel: 'none' }, future: FUT_GUN },
  } },
  smg: { default: 'compact', models: {
    compact: { build: 'long', layout: 'smg', barrel: { short: 11.5, standard: 15, long: 22.5 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'folding', magazine: 'box', optic: 'reddot', muzzle: 'plain', rail: 'top', underbarrel: 'grip' }, future: FUT_GUN },
  } },
  shotgun: { default: 'pump', models: {
    pump: { build: 'shotgun', barrel: { short: 35.5, standard: 47, long: 61 }, takes: SHOTGUN_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'tube', optic: 'irons', muzzle: 'plain', rail: 'none', underbarrel: 'none', grip: 'straight' }, future: { muzzle: 'emitter', magazine: 'cell' } },
    tactical: { build: 'shotgun', barrel: { short: 35.5, standard: 47, long: 61 }, takes: SHOTGUN_TAKES,
      parts: { barrel: 'standard', stock: 'collapsible', magazine: 'tube', optic: 'reddot', muzzle: 'brake', rail: 'top', underbarrel: 'light', grip: 'pistol' }, future: { muzzle: 'emitter', magazine: 'cell' } },
  } },
  knife: { default: 'combat', models: {
    combat: { build: 'knife', length: { short: 14, standard: 17.8, long: 22 }, takes: KNIFE_TAKES, parts: { blade: 'clip', length: 'standard', guard: 'cross', handle: 'ridged', serrations: false } },
    tanto: { build: 'knife', length: { short: 12, standard: 15.5, long: 19 }, takes: KNIFE_TAKES, parts: { blade: 'tanto', length: 'standard', guard: 'choil', handle: 'cord', serrations: false } },
    dagger: { build: 'knife', length: { short: 11, standard: 14, long: 17.8 }, takes: KNIFE_TAKES, parts: { blade: 'spear', length: 'standard', guard: 'cross', handle: 'slab', serrations: false } },
    karambit: { build: 'knife', length: { short: 6, standard: 7.5, long: 9.5 }, takes: { ...KNIFE_TAKES, blade: ['hawkbill'], guard: ['none'] }, parts: { blade: 'hawkbill', length: 'standard', guard: 'none', handle: 'slab', serrations: false }, ring: true },
  } },
});

/** the items the arms kernel alone draws (the firearm samples' items open it by naming a model, a line or a part) */
export const ARMS_ONLY_ITEMS = Object.freeze(['rifle', 'smg', 'knife']);
export const ARM_ITEMS = Object.freeze(Object.keys(ARM_MODELS));
/** an item's class for holding it (polygonizer/hero-gear.js): a knife is a blade, every other arm a firearm */
export const armClass = (item) => (item === 'knife' ? 'blade' : 'firearm');
