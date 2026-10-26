/**
 * THE COMIC HERO PACK'S ENSEMBLES: the body that answers a head. A helmet or a mask (headgear.js) sets an archetype's
 * language (its segments, its plates, its glow, its trim) and its colours; an ensemble dresses the rest of the figure in
 * the same language from the hero door's own words: an undersuit and its cloth (an outfit build: a bodysuit, a tunic, a
 * long coat, a cape, a sash), and over it the armour (the hardsuit with its archetype words, armor/hardsuit.js
 * HARD_WORDS, or a whole family: the lamellar ronin, the themed plate knight), coloured FROM THE HEAD: the helmet's shell
 * becomes the plates, its trim the trim, its seams the undersuit, its glow the lights. The head is worn over the suit
 * (the armour build's `with`), so the suit's own helm gives way to it. An ensemble invents no garment and no geometry;
 * a new answer to a head is a row here. The tiered body only, as the headgear is.
 *
 *   ENSEMBLES                     { <id>: { reads, outfit?, paint?, armor?, tones(P) } }
 *   HARMONY                       { <headgear id>: <ensemble id> } the ensemble each head calls for
 *   ensembleOf(id, headgear?)     → { palette, outfit?, paint?, adorn? } a spec fragment (suits.js SUIT_KEYS), its colours
 *                                 read off the headgear card's palette (its own defaults where the head names none);
 *                                 a group SKIN_TONE is bare: the wearer's own skin
 */
import { HEADGEAR } from './headgear.js';

// (a colour stepped toward black, `f` of the way: an undersuit a shade under the shell)
const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, '0')).join('');
// (a colour stepped toward a mid grey, `f` of the way: a black shell lifted a value off a black undersuit)
const lift = (hex, f) => '#' + [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (110 - v) * f).toString(16).padStart(2, '0'); }).join('');
const SKIN = { fit: 'skin', feet: 'boots', top: { family: 'knit', sleeve: 'long', hem: 'hip' }, bottom: { family: 'knit', leg: 'long', cut: 'skinny' } };
const TACTICAL = { fit: 'fitted', feet: 'boots', top: { family: 'woven', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long', cut: 'tapered' } };
const build = (style, language, pieces = [], dials = {}) => ({ type: 'outfit', style, dials: { fit: 1, stylize: 0.5, coverage: 0.95, ornament: 0, ...dials }, language, pieces });
const CAPE = (over = {}) => ({ kind: 'cloak', wrap: 0.55, hem: 'calf', flare: 0.16, rigidity: 'soft', ...over });
// the HARDSUIT as an inline card: no helm (the head is the ensemble's), the archetype's words, its lights full-bright
const SUIT = (language, dials = {}) => ({ type: 'armor', style: { id: 'ensemble', family: 'hardsuit', dials: { stylize: 0.5, mass: 0.6, coverage: 1, ornament: 1, ...dials }, language: { helm: 'none', ...language }, emissive: ['Lens', 'Reactor'] } });
// (SKIN_TONE: the body bare there, the tiered body's Top or Bottom in the figure's own skin; memberOrders reads it)
export const SKIN_TONE = 'skin';
// the undersuit's groups all in one colour (the bodysuit, the outfit's base, the boots and gloves)
const UNDER = (c) => ({ Suit: c, Top: c, Bottom: c, Shoes: c, Gloves: c, OutfitBase: c });

export const ENSEMBLES = Object.freeze({
  // ── SEGMENTED: the cyborg's ribbed limbs and glowing lines, the guardians' plates and cloaks, the ronin's lacquer ──
  cyborg: { reads: 'the cyborg: segmented plates over a dark undersuit, every limb in three panels, glowing lines down the forearms and shins, a high collar',
    outfit: build('athlete', SKIN), armor: SUIT({ pauldron: 'segmented', segments: 3, glow: 'lines', collar: 'high' }, { mass: 0.55 }),
    tones: (P) => ({ ...UNDER(P.HelmetSeam ?? '#1c1f24'), Plate: P.Helmet, Trim: P.HelmetTrim, Lens: P.EyeGlow ?? '#ff2a2a', Reactor: P.EyeGlow ?? '#ff2a2a' }) },
  hunter: { reads: 'the hunter guardian: light plates on the chest and shins, a glowing gadget on each forearm, a cloak to the knee',
    outfit: build('tactical', TACTICAL, [CAPE({ wrap: 0.5, hem: 'knee' })], { fit: 0.9 }), armor: SUIT({ pauldron: 'cap', chest: 'plates', arms: 'gadget', legs: 'greaves', segments: 2 }, { mass: 0.5 }),
    tones: (P) => ({ ...UNDER(shade(P.Helmet, 0.55)), Plate: P.Helmet, Trim: P.HelmetTrim, Lens: P.HelmetTrim, OutfitSecond: shade(P.Helmet, 0.3) }) },
  titan: { reads: 'the titan guardian: heavy plate, great domed shoulders, an emblem on one, plates over the hips',
    armor: SUIT({ pauldron: 'dome', chest: 'plain', skirt: 'tassets', segments: 2, focal: 'pauldron', focalSide: 'L' }, { mass: 1.0, stylize: 0.6 }),
    tones: (P) => ({ ...UNDER(P.HelmetSeam ?? '#1c1f24'), Plate: P.Helmet, Trim: P.HelmetTrim, Emblem: P.HelmetTrim, Lens: P.HelmetTrim }) },
  warlock: { reads: 'the warlock guardian: a long open coat over light chest plates and greaves, a high collar, the coat in the shell\'s colour',
    outfit: { ...build('tactical', { ...TACTICAL, outer: { family: 'woven', sleeve: 'long', hem: 'knee', open: true, fit: 'fitted', collar: true } }), pieces: [{ kind: 'sash' }] },
    armor: SUIT({ pauldron: 'none', chest: 'plates', legs: 'greaves', collar: 'high', segments: 1 }, { mass: 0.5 }),
    tones: (P) => ({ ...UNDER(shade(P.HelmetSeam ?? '#2a2e35', 0.2)), Outer: P.Helmet, Plate: P.Faceplate ?? P.HelmetTrim, Trim: P.HelmetTrim, OutfitSecond: P.HelmetTrim }) },
  ronin: { reads: 'the ronin: the lamellar suit, lacquered in the helmet\'s colour, laced in its faceplate\'s, its fittings in the trim',
    armor: { type: 'armor', style: 'aka', dials: { stylize: 0.3, coverage: 1 } },
    tones: (P) => ({ ...UNDER(shade(P.Helmet, 0.3)), Lacquer: P.Helmet, Odoshi: P.Faceplate ?? P.HelmetTrim, Kanamono: P.HelmetTrim, Crest: P.HelmetTrim }) },
  // ── THE ARENA: bare to the waist, the sword arm in lames, one greave; the hoplite's bronze and the legion's bands ──
  gladiator: { reads: 'the gladiator: bare to the waist, a red sash and a broad belt, the sword arm in lames from shoulder to wrist, one tall greave on the lead leg',
    outfit: build('athlete', { fit: 'skin', feet: 'boots', top: false, bottom: { family: 'woven', leg: 'brief' } }, [{ kind: 'sash' }]), armor: SUIT({ chest: 'none', pauldron: 'none', arms: 'manica', fnSide: 'R', legs: 'ocrea', leadSide: 'L', collar: 'none', segments: 1 }, { mass: 0.5, coverage: 0.75 }),
    tones: (P) => ({ ...UNDER(P.HelmetSeam ?? '#5e3f1c'), Top: SKIN_TONE, Bottom: SKIN_TONE, OutfitBase: '#7a2a20', OutfitSecond: '#7a2a20', Plate: P.Helmet, Trim: P.HelmetTrim }) },
  hoplite: { reads: 'the hoplite: a bronze cuirass over a red tunic, leather strips hanging from the belt, greaves, a red cloak',
    outfit: build('athlete', { fit: 'fitted', feet: 'boots', top: { family: 'woven', sleeve: 'short', hem: 'hip' }, bottom: { family: 'woven', leg: 'short' } }, [CAPE({ hem: 'calf' })]),
    armor: SUIT({ chest: 'plain', pauldron: 'none', arms: 'none', legs: 'greaves', skirt: 'pteruges', collar: 'none', segments: 1 }, { mass: 0.6, coverage: 0.75 }),
    tones: (P) => ({ ...UNDER(P.Plume ?? '#b3261e'), Shoes: P.HelmetTrim, Plate: P.Helmet, Trim: P.HelmetTrim, OutfitSecond: P.Plume ?? '#b3261e' }) },
  legion: { reads: 'the legionary: the cuirass in steel bands, lames down the shoulders, leather strips at the belt, greaves, a red tunic and cloak',
    outfit: build('athlete', { fit: 'fitted', feet: 'boots', top: { family: 'woven', sleeve: 'short', hem: 'hip' }, bottom: { family: 'woven', leg: 'short' } }, [CAPE({ hem: 'knee', wrap: 0.5 })]),
    armor: SUIT({ chest: 'bands', pauldron: 'lames', arms: 'none', legs: 'greaves', skirt: 'pteruges', collar: 'none', segments: 2 }, { mass: 0.55, coverage: 0.75 }),
    tones: (P) => ({ ...UNDER(P.Plume ?? '#b3261e'), Shoes: '#3a2a1e', Plate: P.Helmet, Trim: P.HelmetTrim, OutfitSecond: P.Plume ?? '#b3261e' }) },
  // ── REGAL: the peaked helm's master in a bodysuit in its colours, a long cape in its trim ──
  regal: { reads: 'the master of metals: a bodysuit in the helm\'s colour, gloves, boots and a long cape in its trim, a belt',
    paint: ['catsuit', 'gloves'], outfit: build('athlete', SKIN, [CAPE({ hem: 'ankle', wrap: 0.6, flare: 0.2 }), { kind: 'belt', at: 'waist' }], { stylize: 0.7 }),
    tones: (P) => ({ Top: P.Helmet, Bottom: P.Helmet, OutfitBase: P.Helmet, Shoes: P.HelmetTrim, Gloves: P.HelmetTrim, OutfitSecond: P.HelmetTrim, OutfitTrim: P.HelmetSeam, Trim: P.HelmetSeam }) },
  // ── THE BOUNTY HUNTER: plates on a flight suit, a jet pack, gadgets, a cape ──
  bountyHunter: { reads: 'the bounty hunter: plates on the chest, one shoulder and the shins over a flight suit, gadgets on the forearms, a jet pack, a cape',
    outfit: build('tactical', TACTICAL, [CAPE({ wrap: 0.45, hem: 'calf' }), { kind: 'pouches', at: 'waist', count: 4 }], { fit: 0.9 }),
    armor: SUIT({ chest: 'plates', pauldron: 'cap', pauldronSide: 'L', arms: 'gadget', legs: 'greaves', pack: 'jet', collar: 'none', segments: 1 }, { mass: 0.5 }),
    tones: (P) => ({ ...UNDER('#3f4238'), Plate: P.Helmet, Trim: P.HelmetTrim, Lens: P.EyeGlow ?? P.HelmetTrim, OutfitSecond: '#4a3c30' }) },
  // ── THE STRUCTURED MASKS' BODIES: the tyrant's iron over a green tunic and hooded cloak, the dark lord's black shell ──
  tyrant: { reads: 'the tyrant: iron plate over a green tunic, a hooded green cloak, a belt; the mask\'s iron and rivets carried down the suit',
    outfit: build('tactical', { ...TACTICAL, top: { family: 'woven', sleeve: 'long', hem: 'hip' } }, [{ kind: 'tunic' }, CAPE({ hood: true, hem: 'ankle', wrap: 0.6 }), { kind: 'belt', at: 'waist' }]),
    armor: SUIT({ pauldron: 'cap', chest: 'plain', collar: 'high', segments: 1 }, { mass: 0.55, coverage: 1 }),
    tones: (P) => ({ ...UNDER(shade(P.Helmet, 0.5)), OutfitBase: '#2f5a2c', OutfitSecond: '#2f5a2c', Plate: P.Helmet, Trim: P.HelmetTrim }) },
  darkLord: { reads: 'the dark lord: a black shell, a chest box of lights, a high collar, gauntlets, a long black cape open at the front',
    outfit: build('athlete', SKIN, [CAPE({ hem: 'ankle', wrap: 0.45, flare: 0.2 }), { kind: 'belt', at: 'waist' }]),
    armor: SUIT({ pauldron: 'cap', chest: 'box', collar: 'high', segments: 1 }, { mass: 0.5, coverage: 1 }),
    tones: (P) => ({ ...UNDER('#08090a'), OutfitSecond: '#0d0e10', Leather: '#0d0e10', Plate: lift(P.Helmet, 0.14), Trim: P.MaskTrim ?? P.HelmetSeam, Reactor: '#e53935', Lens: '#e53935' }) },
  assassin: { reads: 'the masked assassin: a long open coat over fitted dark clothes, bracers, a belt and a crossing strap, the mask\'s brass in the trim',
    outfit: build('streetwear', { ...TACTICAL, outer: { family: 'woven', sleeve: 'long', hem: 'knee', open: true, fit: 'fitted', collar: true } }, [{ kind: 'belt', at: 'waist' }, { kind: 'bracers' }, { kind: 'baldric' }], { fit: 0.9 }),
    tones: (P) => ({ ...UNDER('#1d2028'), Outer: '#2b2f3a', Trim: P.HelmetTrim, OutfitTrim: P.HelmetTrim, Leather: '#3a2a1e' }) },
  // ── SKULLS: the reaper's robe, the death knight's themed plate, the operator's kit ──
  reaper: { reads: 'the reaper: a black robe to the ankle under a hooded black cloak, a sash; the skull the only light thing',
    outfit: build('athlete', SKIN, [{ kind: 'robe' }, CAPE({ hood: true, hem: 'ankle', wrap: 0.65 }), { kind: 'sash' }]),
    tones: () => ({ ...UNDER('#121214'), OutfitSecond: '#18181b', OutfitTrim: '#2a2a2e' }) },
  deathKnight: { reads: 'the death knight: plate in the helm\'s dark iron, skulls and ribs carried down it, fur at the cuffs',
    armor: { type: 'armor', style: 'knight', theme: 'death-knight', dials: { coverage: 1 } },
    tones: (P) => ({ ...UNDER('#16171a'), Plate: P.Helmet, Trim: P.HelmetTrim, Bone: '#d8d2c4', Socket: P.EyeGlow ?? '#ff2a1a' }) },
  operator: { reads: 'the operator: a plate carrier with pouches, a thigh rig, kneepads, tactical gloves, all in the hood\'s drab',
    outfit: build('tactical', TACTICAL, [{ kind: 'vest', cut: 'rig' }, { kind: 'thighPouch' }, { kind: 'kneepads' }], { fit: 0.85 }),
    tones: (P) => ({ ...UNDER(P.Helmet), OutfitBase: P.Helmet, OutfitSecond: shade(P.Helmet, 0.3), Leather: '#1a1a17' }) },
  // ── PORCELAIN: the shinobi, dark and close, a sash in the mask's paint ──
  shinobi: { reads: 'the shinobi: a close dark suit, a sash in the mask\'s paint, wrapped forearms and shins',
    outfit: build('athlete', SKIN, [{ kind: 'sash' }, { kind: 'wraps' }, { kind: 'bracers' }]),
    tones: (P) => ({ ...UNDER('#17181c'), OutfitSecond: P.MaskStitch ?? '#b3261e', OutfitTrim: P.MaskStitch ?? '#b3261e', Trim: P.HelmetTrim ?? '#d8d2c7' }) },
});
export const ENSEMBLE_IDS = Object.freeze(Object.keys(ENSEMBLES));

export const HARMONY = Object.freeze({
  cyborgNinja: 'cyborg', ventedNinja: 'cyborg', monoEye: 'cyborg', hunterGuardian: 'hunter', titanGuardian: 'titan', warlockGuardian: 'warlock', roninHelmet: 'ronin',
  fishGladiator: 'gladiator', griffinGladiator: 'gladiator', chaserGladiator: 'gladiator', hopliteHelm: 'hoplite', legionHelm: 'legion',
  peakedHelm: 'regal', ironPeaked: 'regal', crownPeaked: 'regal',
  tVisorHelm: 'bountyHunter', bronzeTVisor: 'bountyHunter', nightTVisor: 'bountyHunter', heavyTVisor: 'bountyHunter', hunterHelmet: 'bountyHunter',
  ironTyrant: 'tyrant', gildedTyrant: 'tyrant', darkRespirator: 'darkLord', chromeRespirator: 'darkLord', clockworkSkull: 'assassin', whalerMask: 'assassin',
  boneSkull: 'reaper', paintedSkull: 'reaper', sugarSkull: 'reaper', skullKnight: 'deathKnight', skullBalaclava: 'operator',
  foxPorcelain: 'shinobi', kabukiPorcelain: 'shinobi', nohPorcelain: 'shinobi', oniPorcelain: 'shinobi', kintsugiMask: 'shinobi',
});

export function ensembleOf(id, headgear = null) {
  const E = ENSEMBLES[id];
  if (!E) throw new Error(`comic-hero: no ensemble '${id}' (known: ${ENSEMBLE_IDS.join(', ')})`);
  // (the head's colours over the kit's defaults, so an ensemble reads a group the card leaves to its kit)
  const P = { HelmetSeam: '#2a2e35', HelmetTrim: '#1b1d22', Helmet: '#d0d3d8', ...(headgear ? HEADGEAR[headgear]?.palette || {} : {}) };
  const tones = Object.fromEntries(Object.entries(E.tones(P)).filter(([, v]) => typeof v === 'string'));
  return { palette: tones, ...(E.outfit ? { outfit: E.outfit } : {}), ...(E.paint ? { paint: E.paint } : {}), ...(E.armor ? { adorn: E.armor } : {}) };
}
