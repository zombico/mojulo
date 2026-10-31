/**
 * THE COMIC HERO PACK'S GRUNTS: the faces a hero fights through, each FACTION a style pack of the hero door's own words
 * (outfit/styles.js cards and their language, outfit-plan.js pieces, headgear/cards.js heads, items.js gear), so a squad of
 * them reads as one crew and every member as a person. A faction names its KINDS (the corner boy and the shooter, the
 * soldier and the enforcer), each a dress, the builds and ages it is cast from, its gear, its heads and its stands; its
 * COLOURWAYS (a crew's colours: a gang's, a chapter's, a clan's), shared by a squad, with per-grunt `vary` so a crew is
 * not a row of clones; and the hair each pole wears. No franchise names: an archetype and a role, never a character.
 *
 * A squad is CAST, not drawn: of `count` grunts, round(`ratio` × count) are women (GRUNT_RATIO, 0.3 by default), which
 * ones a seeded shuffle decides; a single grunt asked with no pole draws one at that ratio. Everything else (the kind,
 * the build, the hair, the gear, the head, the stand, the colours) is seeded dice (mulberry32) over the faction's lists,
 * and the face and ancestry the egocube's own roll, so the same seed is the same squad.
 *
 *   GRUNT_STYLES                 { <id>: { name, reads, facets, ages, vibe, colourways: { <id>: { reads, palette,
 *                                  vary? } }, hair: { male, female }, kinds: { <id>: { reads, weight, builds, dress(pole,
 *                                  body), items: [[ids]…], heads?: [ids | null…], stands, swing? } } } }
 *   GRUNT_STYLE_IDS, GRUNT_RATIO, GRUNT_GAPS
 *   gruntOrders(style, look, { seed, index, kind, pole, colourway, words })
 *                                → { grunt: { style, kind, pole, colourway, index }, sheet, mint: { tool: 'mint_solid', args } }
 *   squadOrders(style, look, { count, seed, ratio, colourway, kinds })
 *                                → [gruntOrders …] the crew: `count` grunts, round(ratio × count) of them women
 * The heads are the tiered body's (headgear/cards.js): on the realistic body a grunt goes bareheaded. A sleeveless top (the
 * bruiser's tank, the punks') bares the arms on the realistic body only: the tiered body paints its skin under the cloth
 * in the top's colour. A grunt takes its stop's light as the heroes do (characters.js registerOf): the anime head at
 * the anime stop (its cut the anime family of the faction's, animeHair), the look's cube on it where the look bakes.
 */
import { rollEgocube } from '../../../egocube/egocube.js';
import { planFromSheet } from '../../../egocube/plan.js';
import { mulberry32 } from '../../../polygonizer/floorplan-glyphs.js';
import { SUIT_KEYS } from './suits.js';
import { HEADGEAR, withHeadgear } from '../../../headgear/cards.js';
import { withItems, swingOf, ITEMS } from './items.js';
import { bodyOf, registerOf, animeHair } from './characters.js';

export const GRUNT_RATIO = 0.3;
const STYLIZED_ONLY = ['detail', 'body', 'girth', 'paint'];

// ── the cloth, in the outfit grammar (outfit/styles.js): a build over a seeded card, its language and its pieces ──
const outfit = (style, language = {}, pieces = [], dials = {}) => ({ type: 'outfit', style, dials: { fit: 0.7, stylize: 0.35, coverage: 0.95, ornament: 1, ...dials }, language, pieces });
const KNIT = (sleeve, over = {}) => ({ family: 'knit', sleeve, hem: 'hip', ...over });
const JEANS = (over = {}) => ({ family: 'woven', leg: 'long', cut: 'straight', ...over });
const CAPE = (over = {}) => ({ kind: 'cloak', wrap: 0.55, hem: 'ankle', flare: 0.16, rigidity: 'soft', ...over });
// (a woman's suit closes left over right and is cut for her: the trouser suit, the skirt suit; a man's the card named)
const suitFor = (pole, male, female = 'trousersuit') => outfit(pole === 'female' ? female : male, {}, [], { fit: 0.35, stylize: 0.1, ornament: 3 });

export const GRUNT_STYLES = Object.freeze({
  // ── THE STREET GANG: a corner crew in its colour, the colour worn where it is seen ──
  streetGang: {
    name: 'Street gang', reads: 'a corner crew: sweatshirts, tanks and jeans, the crew colour on most tops and the bandannas; knives, a machete and a pistol',
    facets: { archetype: 'outlaw', role: 'flanker', motivation: 0.75, order: 0.3 }, ages: ['youth', 'adult'], vibe: 'loose',
    hair: { male: ['buzz', 'crop', 'taper', 'undercut'], female: ['ponytail', 'braid', 'bun', 'pixie'] },
    colourways: {
      red: { reads: 'the reds', palette: { Mask: '#b3261e', OutfitSecond: '#b3261e', Trim: '#b3261e', Shoes: '#f1f1f1' }, vary: { Top: ['#b3261e', '#b3261e', '#8b919b', '#f0efe9', '#2b2b2e'], Bottom: ['#3d5a80', '#2f3d57', '#4a4f57'] } },
      blue: { reads: 'the blues', palette: { Mask: '#1f4fa8', OutfitSecond: '#1f4fa8', Trim: '#1f4fa8', Shoes: '#f1f1f1' }, vary: { Top: ['#1f4fa8', '#1f4fa8', '#8b919b', '#f0efe9', '#2b2b2e'], Bottom: ['#3d5a80', '#2f3d57', '#3b4552'] } },
      green: { reads: 'the greens', palette: { Mask: '#2e7d32', OutfitSecond: '#2e7d32', Trim: '#2e7d32', Shoes: '#1c1c1c' }, vary: { Top: ['#2e7d32', '#2e7d32', '#5b6442', '#f0efe9', '#2b2b2e'], Bottom: ['#3d5a80', '#3a3d33', '#2f3d57'] } },
      purple: { reads: 'the purples', palette: { Mask: '#5e2b8a', OutfitSecond: '#5e2b8a', Trim: '#5e2b8a', Shoes: '#f1f1f1' }, vary: { Top: ['#5e2b8a', '#5e2b8a', '#8b919b', '#f0efe9'], Bottom: ['#3d5a80', '#2f3d57'] } },
    },
    kinds: {
      corner: { reads: 'the corner boy: a loose sweatshirt and jeans, a bandanna over the face or not', weight: 3, builds: ['lithe', 'canonical'],
        dress: () => outfit('streetwear', { top: KNIT('long', { fit: 'loose' }), bottom: JEANS({ fit: 'eased' }), feet: 'shoes' }),
        items: [[], ['combatKnife'], ['drawnKnife']], heads: [null, 'bandanna'], stands: ['relaxed', 'guard'] },
      bruiser: { reads: 'the bruiser: a tank top over jeans and boots, mass in the shoulders', weight: 2, builds: ['heroic', 'brute'],
        dress: () => outfit('biker', { top: KNIT('none', { fit: 'fitted' }), bottom: JEANS(), outer: false, feet: 'boots' }),
        items: [[], ['drawnKnife'], ['machete']], heads: [null, null, 'bandanna'], stands: ['guard'], swing: 0.4 },
      shooter: { reads: 'the shooter: a bomber jacket closed over the sweatshirt, a pistol at low ready', weight: 1, builds: ['canonical', 'lithe'],
        dress: () => outfit('streetwear', { top: KNIT('long'), bottom: JEANS({ cut: 'tapered' }), outer: { family: 'woven', sleeve: 'long', hem: 'waist', open: false, fit: 'eased', collar: true }, feet: 'shoes' }),
        items: [['drawnPistol']], heads: [null], stands: ['relaxed'] },
    },
  },
  // ── THE CRIME FAMILY: suits, a pistol under the jacket, the heavies with a shotgun ──
  crimeFamily: {
    name: 'Crime family', reads: 'the made men and women: dark tailored suits and polished shoes, pistols, a shotgun for the heavies',
    facets: { archetype: 'outlaw', role: 'frontline', motivation: 0.8, order: 0.75 }, ages: ['adult', 'seasoned'], vibe: 'menacing',
    hair: { male: ['swept', 'taper', 'crew', 'quiff'], female: ['bun', 'bob', 'wavy', 'angled'] },
    colourways: {
      charcoal: { reads: 'charcoal and black, a red tie', palette: { Outer: '#2e3036', Bottom: '#2e3036', Waistcoat: '#2e3036', Top: '#f2f2ef', Tie: '#7a1f24', Shoes: '#121212', Trim: '#2e3036' }, vary: { Tie: ['#7a1f24', '#1d2b4a', '#141414'] } },
      navy: { reads: 'navy with a white shirt', palette: { Outer: '#1d2840', Bottom: '#1d2840', Waistcoat: '#1d2840', Top: '#f6f7f9', Tie: '#1d1d22', Shoes: '#2a1a10', Trim: '#1d2840' }, vary: { Top: ['#f6f7f9', '#cfdcec'] } },
      black: { reads: 'black on black', palette: { Outer: '#121316', Bottom: '#121316', Waistcoat: '#121316', Top: '#1d1f24', Tie: '#121316', Shoes: '#0b0b0b', Trim: '#121316' } },
      cream: { reads: 'the summer suits: cream linen, an open collar', palette: { Outer: '#e6dcc6', Bottom: '#e6dcc6', Waistcoat: '#e6dcc6', Top: '#2b2622', Tie: '#6b4a2a', Shoes: '#5a3a22', Trim: '#e6dcc6' } },
    },
    kinds: {
      soldier: { reads: 'the soldier: a two-button suit, a pistol at the hip or in the hand', weight: 3, builds: ['canonical', 'heroic'],
        dress: (pole) => suitFor(pole, 'business'), items: [['holster'], ['drawnPistol']], stands: ['relaxed', 'hand-on-hip'] },
      enforcer: { reads: 'the enforcer: a double-breasted suit on a big frame, a shotgun', weight: 2, builds: ['heroic', 'brute', 'stout'],
        dress: (pole) => suitFor(pole, 'doublebreasted'), items: [['shotgun'], ['drawnPistol']], stands: ['guard', 'relaxed'] },
      gunner: { reads: 'the gunner: a three-piece suit, a carbine for the job', weight: 1, builds: ['canonical'],
        dress: (pole) => suitFor(pole, 'threepiece', 'skirtsuit'), items: [['carbine']], stands: ['relaxed'] },
    },
  },
  // ── THE SHADOW CLAN: close dark suits, a sash, wrapped forearms, the face wrapped; blades and a staff ──
  shadowClan: {
    name: 'Shadow clan', reads: 'ninjas: a close suit in the clan colour, a sash, wrapped forearms and shins, the face wrapped or masked; katanas, knives and the bo staff',
    facets: { archetype: 'outlaw', role: 'flanker', motivation: 0.6, order: 0.85 }, ages: ['youth', 'adult'], vibe: 'peppy',
    hair: { male: ['crop', 'taper', 'buzz'], female: ['ponytail', 'bun', 'braid'] },
    colourways: {
      night: { reads: 'black, a red sash', palette: { Top: '#17181c', Bottom: '#17181c', Shoes: '#0e0f12', Gloves: '#0e0f12', OutfitBase: '#17181c', OutfitSecond: '#8f1d1d', Mask: '#17181c', MaskMouth: '#0f1013' } },
      midnight: { reads: 'midnight blue, a grey sash', palette: { Top: '#1a2236', Bottom: '#1a2236', Shoes: '#10141f', Gloves: '#10141f', OutfitBase: '#1a2236', OutfitSecond: '#5d6470', Mask: '#1a2236', MaskMouth: '#10141f' } },
      crimson: { reads: 'crimson, a black sash', palette: { Top: '#7a1b1b', Bottom: '#7a1b1b', Shoes: '#16100f', Gloves: '#16100f', OutfitBase: '#7a1b1b', OutfitSecond: '#16100f', Mask: '#7a1b1b', MaskMouth: '#16100f' } },
      snow: { reads: 'snow white, an ash sash', palette: { Top: '#e9e9e6', Bottom: '#e9e9e6', Shoes: '#9a9c9e', Gloves: '#c9cbcc', OutfitBase: '#e9e9e6', OutfitSecond: '#6c7074', Mask: '#e9e9e6', MaskMouth: '#9a9c9e' } },
    },
    kinds: {
      blade: { reads: 'the blade: a katana at the ready', weight: 3, builds: ['lithe', 'canonical'],
        dress: () => outfit('athlete', { fit: 'skin', top: KNIT('long'), bottom: { family: 'knit', leg: 'long', cut: 'straight' }, feet: 'boots' }, [{ kind: 'sash' }, { kind: 'wraps' }, { kind: 'bracers' }], { fit: 1, ornament: 0 }),
        items: [['katana']], heads: ['ninjaWrap', 'ninjaPanels', 'shinobi'], stands: ['guard', 'relaxed'], swing: 0.5 },
      scout: { reads: 'the scout: the blade across the back, a knife at the hip', weight: 2, builds: ['lithe'],
        dress: () => outfit('athlete', { fit: 'skin', top: KNIT('long'), bottom: { family: 'knit', leg: 'long', cut: 'straight' }, feet: 'boots' }, [{ kind: 'sash' }, { kind: 'wraps' }], { fit: 1, ornament: 0 }),
        items: [['slungKatana', 'combatKnife'], ['slungKatana', 'drawnKnife']], heads: ['ninjaWrap', 'wraithWrap'], stands: ['relaxed', 'guard'] },
      staff: { reads: 'the staff fighter: the bo staff, a hood over the wrap', weight: 1, builds: ['canonical', 'heroic'],
        dress: () => outfit('athlete', { fit: 'skin', top: KNIT('long'), bottom: { family: 'woven', leg: 'long', cut: 'wide', fit: 'loose' }, feet: 'boots' }, [{ kind: 'sash' }, CAPE({ hood: true, wrap: 0.35, hem: 'hip' })], { fit: 0.9, ornament: 0 }),
        items: [['boStaff']], heads: ['ninjaWrap'], stands: ['relaxed'], swing: 0.6 },
    },
  },
  // ── THE MOTORCYCLE CLUB: leather, denim, a cut over the jacket, a helmet in the hand's reach ──
  motorcycleClub: {
    name: 'Motorcycle club', reads: 'bikers: open leather jackets or sleeveless cuts over tees, jeans and boots, a helmet on some; knives, a shotgun',
    facets: { archetype: 'outlaw', role: 'frontline', motivation: 0.7, order: 0.45 }, ages: ['adult', 'seasoned'], vibe: 'heavy',
    hair: { male: ['long', 'swept', 'buzz', 'undercut', 'crew'], female: ['long', 'braid', 'ponytail', 'angled'] },
    colourways: {
      chapterRed: { reads: 'black leather, the chapter in red', palette: { Outer: '#1e1b19', Leather: '#1e1b19', Bottom: '#2f3d57', Shoes: '#1a1612', Trim: '#a3241e', Helmet: '#1e1b19', HelmetTrim: '#a3241e' }, vary: { Top: ['#d9d5cc', '#2b2b2e', '#7a1f1f'], Bottom: ['#2f3d57', '#3b4552', '#202225'] } },
      chapterBone: { reads: 'brown leather, bone and black', palette: { Outer: '#4a2f1f', Leather: '#4a2f1f', Bottom: '#2f3d57', Shoes: '#2b1c12', Trim: '#d8cfb8', Helmet: '#d8cfb8', HelmetTrim: '#1e1b19' }, vary: { Top: ['#d9d5cc', '#2b2b2e'] } },
      chapterOrange: { reads: 'black leather, the chapter in orange', palette: { Outer: '#1e1b19', Leather: '#1e1b19', Bottom: '#25272b', Shoes: '#1a1612', Trim: '#d9711e', Helmet: '#1e1b19', HelmetTrim: '#d9711e' }, vary: { Top: ['#d9d5cc', '#2b2b2e', '#d9711e'] } },
    },
    kinds: {
      rider: { reads: 'the rider: the leather jacket open over a tee', weight: 3, builds: ['canonical', 'heroic', 'stout'],
        dress: () => outfit('biker'), items: [[], ['combatKnife'], ['holster']], heads: [null, null, 'bikerHelmet'], stands: ['relaxed', 'hand-on-hip'] },
      patch: { reads: 'the patch: a sleeveless cut over a long-sleeved tee, the chapter on it', weight: 2, builds: ['heroic', 'brute', 'stout'],
        dress: () => outfit('biker', { top: KNIT('long'), outer: { family: 'woven', sleeve: 'none', hem: 'hip', open: true, fit: 'fitted', collar: false } }, [{ kind: 'belt' }]),
        items: [['drawnKnife'], ['machete'], ['shotgun']], heads: [null, 'bandanna'], stands: ['guard', 'relaxed'], swing: 0.3 },
    },
  },
  // ── PRIVATE MILITARY: the contractor in a plate carrier, a helmet or a balaclava, a carbine ──
  privateMilitary: {
    name: 'Private military', reads: 'contractors: tactical shirts and trousers, a rig or a plate carrier, kneepads, helmets and balaclavas; carbines and sidearms',
    facets: { archetype: 'everyman', role: 'ranged', motivation: 0.7, order: 0.8 }, ages: ['adult', 'seasoned'], vibe: 'heavy',
    hair: { male: ['buzz', 'crew', 'taper'], female: ['bun', 'ponytail', 'braid'] },
    colourways: {
      blackOps: { reads: 'black', palette: { Top: '#1d1f22', Bottom: '#1d1f22', Shoes: '#121212', OutfitSecond: '#2a2c30', Leather: '#151515', Helmet: '#24262a', HelmetTrim: '#151515' } },
      desert: { reads: 'coyote and tan', palette: { Top: '#8a7a5c', Bottom: '#b19f7a', Shoes: '#5a4a35', OutfitSecond: '#7b6b4e', Leather: '#4a3c2b', Helmet: '#8a7a5c', HelmetTrim: '#5a4a35' } },
      woodland: { reads: 'olive and ranger green', palette: { Top: '#4f5638', Bottom: '#5b6442', Shoes: '#231d17', OutfitSecond: '#3f4436', Leather: '#2b2622', Helmet: '#4f5638', HelmetTrim: '#2f2f26' } },
      urban: { reads: 'urban grey', palette: { Top: '#4a4f57', Bottom: '#5d636c', Shoes: '#1d1f22', OutfitSecond: '#3a3e45', Leather: '#1d1f22', Helmet: '#4a4f57', HelmetTrim: '#26292e' } },
    },
    kinds: {
      rifleman: { reads: 'the rifleman: a chest rig and kneepads, a carbine', weight: 3, builds: ['canonical', 'heroic'],
        dress: () => outfit('tactical', {}, [{ kind: 'vest', cut: 'rig' }, { kind: 'kneepads' }], { fit: 0.85 }),
        items: [['carbine', 'holster'], ['carbine']], heads: ['tacticalHelmet', 'skullBalaclava', null], stands: ['relaxed'] },
      breacher: { reads: 'the breacher: a plate carrier, a shotgun, a gas mask', weight: 1, builds: ['heroic', 'brute'],
        dress: () => outfit('tactical', {}, [{ kind: 'vest' }, { kind: 'kneepads' }, { kind: 'thighPouch' }], { fit: 0.85 }),
        items: [['shotgun', 'holster']], heads: ['gasMask', 'tacticalHelmet'], stands: ['guard'] },
      sentry: { reads: 'the sentry: the carbine slung, a sidearm at the thigh, night-vision up', weight: 2, builds: ['canonical', 'lithe'],
        dress: () => outfit('fatigues', {}, [{ kind: 'pouches', at: 'waist', count: 4 }], { fit: 0.8 }),
        items: [['slungCarbine', 'holster'], ['slungCarbine', 'drawnPistol']], heads: ['nightVision', null], stands: ['relaxed', 'hand-on-hip'] },
    },
  },
  // ── THE CULT: robes under hooded cloaks, a sash, the face a skull or a porcelain mask; knives and the high priest's staff ──
  cult: {
    name: 'Cult', reads: 'the faithful: a robe to the ankle under a hooded cloak, a sash, a skull or porcelain face; ritual knives, the priest\'s sceptre',
    facets: { archetype: 'magician', role: 'caster', motivation: 0.85, order: 0.9 }, ages: ['youth', 'adult', 'seasoned'], vibe: 'menacing',
    hair: { male: ['crop', 'swept', 'buzz'], female: ['long', 'bun', 'braid'] },
    colourways: {
      crimson: { reads: 'crimson robes, black cloaks', palette: { OutfitBase: '#6e1414', OutfitSecond: '#121214', OutfitTrim: '#c9a24a', Top: '#121214', Bottom: '#121214', Shoes: '#0d0d0f' } },
      ash: { reads: 'ash-grey robes, white cloaks', palette: { OutfitBase: '#5f6166', OutfitSecond: '#e6e3dc', OutfitTrim: '#2a2a2e', Top: '#2a2a2e', Bottom: '#2a2a2e', Shoes: '#1a1a1c' } },
      violet: { reads: 'violet robes, black cloaks, gold', palette: { OutfitBase: '#3b1d5a', OutfitSecond: '#121214', OutfitTrim: '#d4ab4c', Top: '#121214', Bottom: '#121214', Shoes: '#0d0d0f' } },
    },
    kinds: {
      acolyte: { reads: 'the acolyte: the robe, the hooded cloak, a ritual knife', weight: 4, builds: ['lithe', 'canonical', 'stout'],
        dress: () => outfit('athlete', { fit: 'skin', top: KNIT('long'), bottom: { family: 'knit', leg: 'long', cut: 'straight' }, feet: 'shoes' }, [{ kind: 'robe' }, CAPE({ hood: true, wrap: 0.65 }), { kind: 'sash' }], { fit: 1, ornament: 0 }),
        items: [[], ['drawnKnife']], heads: ['hoodedMask', 'boneSkull', 'nohPorcelain', 'paintedSkull'], stands: ['rest', 'relaxed'] },
      priest: { reads: 'the priest: the robe and a mantle, the sceptre', weight: 1, builds: ['canonical', 'stout'],
        dress: () => outfit('athlete', { fit: 'skin', top: KNIT('long'), bottom: { family: 'knit', leg: 'long', cut: 'straight' }, feet: 'shoes' }, [{ kind: 'wizardRobe' }, { kind: 'mantle', claspColour: 'trim' }, { kind: 'sash' }], { fit: 1, ornament: 1 }),
        items: [['sceptre']], heads: ['boneSkull', 'sugarSkull'], stands: ['rest'] },
    },
  },
  // ── STREET PUNKS: cropped jackets, studs and straps, the hair the colour; knives and fists ──
  punks: {
    name: 'Street punks', reads: 'punks: a cropped jacket or a leather one over a tank, skinny jeans, a studded strap, the hair dyed; knives',
    facets: { archetype: 'jester', role: 'flanker', motivation: 0.65, order: 0.2 }, ages: ['youth', 'adult'], vibe: 'cocky',
    hair: { male: ['undercut', 'quiff', 'crop', 'buzz'], female: ['pixie', 'angled', 'undercut', 'bob'] },
    colourways: {
      neon: { reads: 'black and neon pink', palette: { Outer: '#141519', Top: '#141519', Bottom: '#141519', Shoes: '#141519', Leather: '#141519', Trim: '#e8318a' }, vary: { Hair: ['#e8318a', '#29c4d8', '#141414', '#f2e14a'], Top: ['#141519', '#e8318a', '#f0efe9'] } },
      acid: { reads: 'denim and acid yellow', palette: { Outer: '#3a4a6a', Top: '#141519', Bottom: '#2f3d57', Shoes: '#141519', Leather: '#141519', Trim: '#d7e23a' }, vary: { Hair: ['#d7e23a', '#2fb36a', '#141414', '#c02a2a'] } },
      ice: { reads: 'white leather, electric blue', palette: { Outer: '#e8eaee', Top: '#141519', Bottom: '#25272b', Shoes: '#e8eaee', Leather: '#e8eaee', Trim: '#2f6bff' }, vary: { Hair: ['#2f6bff', '#e8eaee', '#9b3bd6'] } },
    },
    kinds: {
      brawler: { reads: 'the brawler: a cropped jacket, a studded strap across the chest, a knife', weight: 3, builds: ['lithe', 'canonical'],
        dress: () => outfit('runner', { top: KNIT('none', { fit: 'fitted' }) }, [{ kind: 'baldric' }]),
        items: [[], ['drawnKnife']], heads: [null, null, 'motoGoggles'], stands: ['guard', 'hand-on-hip'], swing: 0.3 },
      leather: { reads: 'the leather punk: the biker jacket open over a tank, arm rings', weight: 2, builds: ['canonical', 'heroic'],
        dress: () => outfit('biker', { top: KNIT('none', { fit: 'fitted' }), bottom: JEANS({ cut: 'skinny', fit: 'fitted' }) }, [{ kind: 'armRings', pair: true }]),
        items: [[], ['combatKnife']], heads: [null, 'bandanna'], stands: ['relaxed', 'guard'] },
    },
  },
  // ── CORPORATE SECURITY: dark suits and an earpiece's calm; the response team in black tactical ──
  corporateSecurity: {
    name: 'Corporate security', reads: 'the company\'s guards: dark suits or long coats, sidearms; the response team in black tactical with carbines and visors',
    facets: { archetype: 'everyman', role: 'frontline', motivation: 0.6, order: 0.9 }, ages: ['adult', 'seasoned'], vibe: 'bold',
    hair: { male: ['crew', 'taper', 'buzz', 'swept'], female: ['bun', 'bob', 'ponytail'] },
    colourways: {
      black: { reads: 'black suits, white shirts', palette: { Outer: '#15171b', Bottom: '#15171b', Top: '#f2f3f5', Tie: '#15171b', Shoes: '#0b0b0b', Trim: '#15171b', OutfitSecond: '#1d1f24', Helmet: '#1d1f24', HelmetTrim: '#0e0f12' } },
      white: { reads: 'the white company: pale coats, a blue line', palette: { Outer: '#e8eaee', Bottom: '#2a2e36', Top: '#2a2e36', Tie: '#2f6bff', Shoes: '#e8eaee', Trim: '#2f6bff', OutfitSecond: '#e8eaee', Helmet: '#e8eaee', HelmetTrim: '#2f6bff' } },
      graphite: { reads: 'graphite and amber', palette: { Outer: '#3a3d42', Bottom: '#3a3d42', Top: '#1d1f24', Tie: '#d08a1e', Shoes: '#141414', Trim: '#d08a1e', OutfitSecond: '#2a2c30', Helmet: '#3a3d42', HelmetTrim: '#d08a1e' } },
    },
    kinds: {
      guard: { reads: 'the guard: a suit, a sidearm', weight: 3, builds: ['canonical', 'heroic'],
        dress: (pole) => suitFor(pole, 'business'), items: [['holster'], ['drawnPistol']], heads: [null, null, 'visorBand'], stands: ['relaxed', 'hand-on-hip'] },
      agent: { reads: 'the agent: a long coat over a dark suit, a pistol at low ready', weight: 1, builds: ['canonical', 'lithe'],
        dress: () => outfit('corporate'), items: [['drawnPistol']], heads: [null, 'opticVisor'], stands: ['relaxed'] },
      response: { reads: 'the response team: black tactical, a plate carrier, a carbine, a helmet', weight: 2, builds: ['heroic', 'canonical'],
        dress: () => outfit('tactical', {}, [{ kind: 'vest' }, { kind: 'kneepads' }], { fit: 0.85 }),
        items: [['carbine', 'holster']], heads: ['tacticalHelmet', 'tacticalMask'], stands: ['guard', 'relaxed'] },
    },
  },
});
export const GRUNT_STYLE_IDS = Object.freeze(Object.keys(GRUNT_STYLES));

// a grunt's weapon the equipment library has no builder for: said, never approximated
export const GRUNT_GAPS = Object.freeze({
  bat: 'no bat or club: the staff is a staff\'s length (its `mace` head a club on a pole)',
  pipe: 'no lead pipe, crowbar or wrench: no short rigid bar is a held build',
  chain: 'no chain or whip: a held build is rigid on its bone',
  knuckles: 'no brass knuckles: the hand holds, it wears nothing over the fist but gloves',
  nunchaku: 'no flail or nunchaku: a held build is one rigid piece',
  shuriken: 'no thrown item: a throw is a game\'s motion, not a held build',
  smg: 'no submachine gun: the carbine stands in (crimeFamily gunner, privateMilitary)',
});

// ── the dice ──
const hash = (...xs) => xs.reduce((h, x) => Math.imul(h ^ (typeof x === 'number' ? x : [...String(x)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261)), 2654435761) >>> 0, 0x9e3779b9);
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const pickWeighted = (r, entries) => { const total = entries.reduce((s, [, w]) => s + w, 0); let x = r() * total; for (const [k, w] of entries) { x -= w; if (x < 0) return k; } return entries[entries.length - 1][0]; };

function styleOf(id) {
  const S = GRUNT_STYLES[id];
  if (!S) throw new Error(`comic-hero: no grunt style '${id}' (known: ${GRUNT_STYLE_IDS.join(', ')})`);
  return S;
}

export function gruntOrders(styleId, lookId, { seed = 1, index = 0, kind: kindIn, pole: poleIn, colourway: cwIn, ratio = GRUNT_RATIO, words = false } = {}) {
  const S = styleOf(styleId), body = bodyOf(lookId);
  // (every draw taken in a fixed order, whatever is asked, so naming one choice never moves the others)
  const r = mulberry32(hash(styleId, seed, index));
  const kindRoll = pickWeighted(r, Object.entries(S.kinds).map(([k, K]) => [k, K.weight])), poleRoll = r();
  const kind = kindIn ?? kindRoll;
  const K = S.kinds[kind];
  if (!K) throw new Error(`comic-hero: the ${S.name} has no kind '${kind}' (known: ${Object.keys(S.kinds).join(', ')})`);
  const cwId = cwIn ?? Object.keys(S.colourways)[0], CW = S.colourways[cwId];
  if (!CW) throw new Error(`comic-hero: the ${S.name} has no colourway '${cwId}' (known: ${Object.keys(S.colourways).join(', ')})`);
  const pole = poleIn ?? (poleRoll < ratio ? 'female' : 'male');
  const build = pick(r, K.builds), age = pick(r, S.ages), hairStyle = pick(r, S.hair[pole]), itemIds = pick(r, K.items);
  const head = body === 'tiered' && K.heads ? pick(r, K.heads) : null, stand = pick(r, K.stands), swingRoll = r();
  const vary = Object.fromEntries(Object.entries(CW.vary || {}).map(([g, list]) => [g, pick(r, list)]));

  const R = registerOf(lookId);
  const sheet = rollEgocube({ brief: `${S.name}: ${K.reads}`, facets: { ...S.facets, pole, build, age }, seed: hash(styleId, seed, index, 'face') % 2147483647, path: 'hero', ...(R.setting ? { setting: R.setting } : {}) });
  const title = `${S.name} · ${kind} ${index + 1}`;
  const plan = planFromSheet(sheet, { dress: 'designed', title });
  if (plan.create.as !== 'hero') throw new Error(`comic-hero: a ${S.name} grunt rolled a ${plan.create.as}, not a person`);
  const spec = { ...plan.create.spec };
  for (const k of SUIT_KEYS) delete spec[k];
  spec.outfit = K.dress(pole, body);
  // (the faction's cut, in the anime head's family where the stop draws that head)
  spec.hair = { style: R.setting ? animeHair(hairStyle, pole) : hairStyle };
  // (the guard's rear fist opened on a woman's frame, where its values sink the forearm: the rival's fix, cast.js)
  spec.gesture = stand === 'guard' && pole === 'female' ? ['guard', { elbowR: 130 }] : stand;
  if (body === 'realistic') { spec.form = 'realistic'; for (const k of STYLIZED_ONLY) delete spec[k]; }
  const worn = head ? withHeadgear({ ...spec }, body, head) : spec;
  // (the crew's colours over the head's: a bandanna, a wrap, a helmet in the colourway; the face's own groups kept)
  worn.palette = { ...(spec.palette || {}), ...(worn.palette || {}), ...CW.palette, ...vary };
  if (itemIds.length) worn.gear = withItems(worn, itemIds, body).gear;
  const swing = K.swing && swingRoll < K.swing ? swingOf(itemIds) : null;
  if (swing && ITEMS[itemIds.find((i) => ITEMS[i].swing === swing)]?.slot === 'right') worn.gesture = swing;
  if (R.geocube) worn.geocube = R.geocube;
  delete worn.toon;
  // (with `words`, the head as the hero door's word over the spec before it (the dress and the hair a card changes), so
  // the grunt keeps it editable by word: the crew's colours stay over the head's, the card's own left to the word, which
  // lays them beneath)
  if (words && head) {
    const own = HEADGEAR[head].palette || {}, palette = Object.fromEntries(Object.entries(worn.palette).filter(([g, v]) => own[g] !== v));
    const { adorn: _a, ...rest } = worn;
    for (const k of Object.keys(worn)) delete worn[k];
    Object.assign(worn, rest, { hair: spec.hair, outfit: spec.outfit, ...(spec.adorn !== undefined ? { adorn: spec.adorn } : {}), palette, headgear: head });
  }
  return {
    grunt: { style: styleId, kind, pole, colourway: cwId, index, build, age, head, items: itemIds },
    sheet: { facets: sheet.facets, reading: sheet.reading, seed: sheet.seed },
    mint: { tool: 'mint_solid', args: { kind: 'layered', via: 'hero', title, spec: { ...worn, vibe: S.vibe } } },
  };
}

/** the crew: `count` grunts of one faction in one colourway, round(ratio × count) of them women (which ones, a seeded
 * shuffle); `kinds` a list to cast from in place of the faction's weights */
export function squadOrders(styleId, lookId, { count = 6, seed = 1, ratio = GRUNT_RATIO, colourway, kinds = null } = {}) {
  const S = styleOf(styleId);
  if (!(Number.isInteger(count) && count >= 1 && count <= 64)) throw new Error('comic-hero: a squad is 1 to 64 grunts');
  if (!(ratio >= 0 && ratio <= 1)) throw new Error('comic-hero: ratio is the women\'s share of a squad, 0 to 1');
  for (const k of kinds || []) if (!S.kinds[k]) throw new Error(`comic-hero: the ${S.name} has no kind '${k}' (known: ${Object.keys(S.kinds).join(', ')})`);
  const r = mulberry32(hash(styleId, seed, 'squad')), women = Math.round(ratio * count);
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const female = new Set(order.slice(0, women));
  return Array.from({ length: count }, (_, i) => gruntOrders(styleId, lookId, { seed, index: i, pole: female.has(i) ? 'female' : 'male', colourway, ...(kinds ? { kind: kinds[i % kinds.length] } : {}) }));
}
