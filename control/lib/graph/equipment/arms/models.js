// equipment/arms/models — the arms' MODELS: per item, the archetypes it can be drawn as, each with its tunable parts
// (the words a slot takes) and its defaults. PURE DATA but the builder each row names (arms/index.js BUILDERS).
//
// A part is a word from its slot's list; `barrel` (and a knife's `length`) is a word from the model's own lengths or
// a length in centimetres. The future line (laws.js law 7) changes the defaults it names (`future`): the muzzle an
// emitter, the magazine a cell; the near line (law 9) its own (`near`): a smart sight. A model drawn in the near line
// by default names it (`line`). A build's own parts always win.

const BARREL = ['short', 'standard', 'long'];
const PISTOL_TAKES = { barrel: BARREL, magazine: ['flush', 'extended', 'cell'], optic: ['irons', 'reddot', 'smart'], muzzle: ['plain', 'suppressor', 'emitter'], underbarrel: ['none', 'light'] };
const REVOLVER_TAKES = { barrel: BARREL, optic: ['irons', 'reddot', 'smart'], muzzle: ['plain', 'emitter'] };
const LONG_TAKES = { barrel: BARREL, stock: ['fixed', 'collapsible', 'folding', 'skeleton', 'none'], magazine: ['box', 'curved', 'drum', 'cell'], optic: ['irons', 'reddot', 'holo', 'scope', 'smart', 'none'],
  muzzle: ['plain', 'flash', 'brake', 'suppressor', 'emitter'], rail: ['none', 'top', 'full'], underbarrel: ['none', 'grip', 'light', 'bipod'] };
const BULLPUP_TAKES = { barrel: BARREL, magazine: ['box', 'curved', 'cell'], optic: ['irons', 'reddot', 'holo', 'scope', 'smart', 'none'], muzzle: ['plain', 'flash', 'brake', 'suppressor', 'emitter'], underbarrel: ['none', 'grip', 'light'] };
const SHOTGUN_TAKES = { barrel: BARREL, stock: ['fixed', 'collapsible', 'folding', 'none'], magazine: ['tube', 'box', 'drum', 'cell'], optic: ['irons', 'reddot', 'holo', 'smart', 'none'], muzzle: ['plain', 'brake', 'emitter'],
  rail: ['none', 'top'], underbarrel: ['none', 'light'], grip: ['straight', 'pistol'] };
const KNIFE_TAKES = { blade: ['clip', 'drop', 'tanto', 'spear', 'hawkbill'], length: ['short', 'standard', 'long'], guard: ['cross', 'choil', 'none'], handle: ['ridged', 'cord', 'slab'], serrations: [false, true] };
const FUT_GUN = { muzzle: 'emitter', magazine: 'cell' };
const NEAR_GUN = { optic: 'smart' };
const PDW_TAKES = { barrel: BARREL, optic: ['smart', 'reddot', 'holo', 'irons', 'none'], muzzle: ['plain', 'flash', 'brake', 'suppressor', 'emitter'], underbarrel: ['none', 'light'] };
const CASELESS_TAKES = { barrel: BARREL, optic: ['smart', 'reddot', 'holo', 'scope', 'none'], muzzle: ['plain', 'brake', 'suppressor', 'emitter'], underbarrel: ['none', 'grip'] };
const COIL_TAKES = { barrel: BARREL, optic: ['smart', 'reddot', 'holo', 'scope', 'none'], muzzle: ['plain', 'brake', 'emitter'], underbarrel: ['none', 'grip', 'bipod'] };

export const ARM_MODELS = Object.freeze({
  pistol: { default: 'service', models: {
    service: { build: 'pistol', frame: 'polymer', grip: 11, barrel: { short: 9.5, standard: 11.4, long: 13.5 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'irons', muzzle: 'plain', underbarrel: 'none' }, future: FUT_GUN, near: NEAR_GUN },
    compact: { build: 'pistol', frame: 'polymer', grip: 9.4, barrel: { short: 8.4, standard: 9.5, long: 11.4 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'irons', muzzle: 'plain', underbarrel: 'none' }, future: FUT_GUN, near: NEAR_GUN },
    heavy: { build: 'pistol', frame: 'steel', grip: 11.4, barrel: { short: 10.8, standard: 12.7, long: 15.2 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'irons', muzzle: 'plain', underbarrel: 'none' }, future: FUT_GUN, near: NEAR_GUN },
    smart: { build: 'pistol', frame: 'polymer', shroud: true, line: 'near', grip: 10.8, barrel: { short: 9.5, standard: 11.4, long: 13.5 }, takes: PISTOL_TAKES,
      parts: { barrel: 'standard', magazine: 'flush', optic: 'smart', muzzle: 'plain', underbarrel: 'light' }, future: FUT_GUN },
    revolver: { build: 'revolver', barrel: { short: 7.6, standard: 10.2, long: 15.2 }, takes: REVOLVER_TAKES,
      parts: { barrel: 'standard', optic: 'irons', muzzle: 'plain' }, future: { muzzle: 'emitter' }, near: NEAR_GUN },
  } },
  carbine: { default: 'assault', models: {
    assault: { build: 'long', layout: 'assault', barrel: { short: 26.7, standard: 36.8, long: 50.8 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'collapsible', magazine: 'curved', optic: 'reddot', muzzle: 'flash', rail: 'top', underbarrel: 'none' }, future: FUT_GUN, near: NEAR_GUN },
  } },
  rifle: { default: 'assault', models: {
    assault: { build: 'long', layout: 'assault', barrel: { short: 36.8, standard: 50.8, long: 61 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'curved', optic: 'holo', muzzle: 'flash', rail: 'top', underbarrel: 'grip' }, future: FUT_GUN, near: NEAR_GUN },
    marksman: { build: 'long', layout: 'marksman', barrel: { short: 50.8, standard: 61, long: 71 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'box', optic: 'scope', muzzle: 'brake', rail: 'top', underbarrel: 'bipod' }, future: FUT_GUN, near: NEAR_GUN },
    caseless: { build: 'caseless', line: 'near', barrel: { short: 44, standard: 54, long: 62 }, takes: CASELESS_TAKES,
      parts: { barrel: 'standard', optic: 'smart', muzzle: 'plain', underbarrel: 'none' }, future: { muzzle: 'emitter' } },
    coilgun: { build: 'coilgun', line: 'near', barrel: { short: 46, standard: 58, long: 70 }, takes: COIL_TAKES,
      parts: { barrel: 'standard', optic: 'smart', muzzle: 'plain', underbarrel: 'grip' }, future: { muzzle: 'emitter' } },
    bullpup: { build: 'bullpup', barrel: { short: 40, standard: 50.8, long: 61 }, takes: BULLPUP_TAKES,
      parts: { barrel: 'standard', magazine: 'curved', optic: 'reddot', muzzle: 'flash', underbarrel: 'none' }, future: FUT_GUN, near: NEAR_GUN },
  } },
  smg: { default: 'compact', models: {
    pdw: { build: 'pdw', line: 'near', barrel: { short: 20, standard: 26, long: 32 }, takes: PDW_TAKES,
      parts: { barrel: 'standard', optic: 'smart', muzzle: 'flash', underbarrel: 'none' }, future: { muzzle: 'emitter' } },
    compact: { build: 'long', layout: 'smg', barrel: { short: 11.5, standard: 15, long: 22.5 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'folding', magazine: 'box', optic: 'reddot', muzzle: 'plain', rail: 'top', underbarrel: 'grip' }, future: FUT_GUN, near: NEAR_GUN },
  } },
  shotgun: { default: 'pump', models: {
    pump: { build: 'shotgun', barrel: { short: 35.5, standard: 47, long: 61 }, takes: SHOTGUN_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'tube', optic: 'irons', muzzle: 'plain', rail: 'none', underbarrel: 'none', grip: 'straight' }, future: { muzzle: 'emitter', magazine: 'cell' }, near: NEAR_GUN },
    breacher: { build: 'long', layout: 'breacher', line: 'near', barrel: { short: 33, standard: 43, long: 51 }, takes: LONG_TAKES,
      parts: { barrel: 'standard', stock: 'fixed', magazine: 'drum', optic: 'smart', muzzle: 'brake', rail: 'top', underbarrel: 'grip' }, future: FUT_GUN },
    tactical: { build: 'shotgun', barrel: { short: 35.5, standard: 47, long: 61 }, takes: SHOTGUN_TAKES,
      parts: { barrel: 'standard', stock: 'collapsible', magazine: 'tube', optic: 'reddot', muzzle: 'brake', rail: 'top', underbarrel: 'light', grip: 'pistol' }, future: { muzzle: 'emitter', magazine: 'cell' }, near: NEAR_GUN },
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
