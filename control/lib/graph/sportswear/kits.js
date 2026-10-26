/**
 * SPORTSWEAR — a sport's kit as a few words on the character designer (the hero door's `kit`), lowered on every read
 * into the dress the body already has: the authored body bare (`detail: 'swimsuit'`) with the kit painted on it as a
 * second skin (hero-dress.js PAINT_WORDS and paint entries, which fit every cast, core and pose), the realistic body in
 * the `athlete` outfit card (outfit/styles.js) in the kit's colours. A new sport is a card, a new pattern a row: no
 * geometry anywhere, so a kit costs nothing but colour and an edit to its words re-dresses the character in place.
 *
 *   kit: '<sport>' | { sport?, colours?: [main, second?, trim?], pattern?, trim?: [<trim>] | false, socks? }
 *     sport    a card below (soccer the default when only colours are given)
 *     colours  the main colour (the shirt), the second (the pattern, and the shorts or the socks where the card says),
 *              the trim (collar, cuffs, the shorts' stripe); each '#rrggbb', missing ones from the card
 *     pattern  plain | hoops | stripes | band | sleeves | yoke | sides (over the shirt, in the second colour)
 *     trim     the card's trims, or a list of collar | cuffs | hem | shortsStripe, or false for none
 *     socks    knee | ankle | none (the card's)
 *
 *   SPORT_KITS, KIT_PATTERNS, KIT_TRIMS     the cards and the rows
 *   readKit(kit) → [error]                  what is wrong with the words (empty when sound)
 *   resolveKit(kit) → K                     the words with the card's defaults filled in
 *   kitDress(kit, { realistic }) → { detail?, paint?, outfit?, tones }   the dress the words lower to; `tones` the palette
 *                                           groups it paints (Top, Bottom, Kit, Trim, Socks, Shoes, Swim, Glove)
 *   kitSportOf(word) → a card id            a sport's book id (contest/sports.js, a meet) to its card
 *
 * Pure and deterministic. Only parts every hero core has are named (torso, upperArm, foreArm, thigh, shank): a word
 * names the rest (bikeShorts the structured core's pelvis, socks the toes), lowered against the body's own parts.
 */

const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The cards: the shirt (a paint word: tee, tank or longSleeve), the bottom (shorts, longShorts, pants to the knee,
 * trousers), the socks, the gloves, the trims, the colours (main, second, trim) and which colour the shorts and the
 * socks take (0 main, 1 second, 2 trim). `whites`: the sport's clothes are its own colours whoever wears them (a player's
 * colour is the trim).
 */
export const SPORT_KITS = Object.freeze({
  soccer: { words: 'a football kit: a short-sleeved shirt, shorts, socks to the knee', top: 'tee', bottom: 'shorts', socks: 'knee', trim: ['collar', 'cuffs'], colours: ['#d23a2e', '#ffffff', '#1d2433'], shorts: 1, socksOf: 0 },
  keeper: { words: 'a goalkeeper: long sleeves, gloves, a colour of their own', top: 'longSleeve', bottom: 'shorts', socks: 'knee', gloves: true, trim: ['collar', 'cuffs'], colours: ['#2fb34a', '#1d2433', '#f2f2f2'], shorts: 1, socksOf: 0 },
  hockey: { words: 'a hockey jersey: long sleeves, pants to the knee, long socks, gloves', top: 'longSleeve', bottom: 'pants', socks: 'knee', gloves: true, trim: ['hem', 'cuffs'], colours: ['#1f4fa8', '#ffffff', '#c8102e'], shorts: 0, socksOf: 0 },
  tennis: { words: 'tennis whites: a short-sleeved shirt, shorts, ankle socks', top: 'tee', bottom: 'shorts', socks: 'ankle', trim: ['collar', 'cuffs'], colours: ['#ffffff', '#ffffff', '#1d6f42'], shorts: 0, socksOf: 1, whites: true },
  track: { words: 'a track singlet and shorts', top: 'tank', bottom: 'shorts', socks: 'ankle', trim: ['hem'], colours: ['#e4572e', '#1d2433', '#ffffff'], shorts: 1, socksOf: 2 },
  basketball: { words: 'a basketball vest and long shorts', top: 'tank', bottom: 'longShorts', socks: 'ankle', trim: ['hem', 'shortsStripe'], colours: ['#f2a03d', '#1d2433', '#ffffff'], shorts: 0, socksOf: 2 },
  volleyball: { words: 'a volleyball shirt and short shorts', top: 'tee', bottom: 'shorts', socks: 'ankle', trim: ['collar', 'cuffs'], colours: ['#2a9d8f', '#1d2433', '#ffffff'], shorts: 1, socksOf: 2 },
  golf: { words: 'a golfer: a polo and trousers', top: 'tee', bottom: 'trousers', socks: 'none', trim: ['collar'], colours: ['#f2efe6', '#2b3a55', '#2b3a55'], shorts: 1, socksOf: 1 },
  baseball: { words: 'a baseball uniform: a jersey with sleeves to the elbow, pants to the knee, long socks', top: 'tee', bottom: 'pants', socks: 'knee', trim: ['collar', 'cuffs'], colours: ['#f2efe6', '#1f3a68', '#c8102e'], shorts: 1, socksOf: 1, pattern: 'sleeves' },
  cricket: { words: 'cricket whites: a collared shirt and trousers, a county colour at the collar', top: 'tee', bottom: 'trousers', socks: 'none', trim: ['collar'], colours: ['#f4f1e8', '#f4f1e8', '#1d4f91'], shorts: 0, socksOf: 1, whites: true },
  bowling: { words: 'a bowling shirt and trousers', top: 'tee', bottom: 'trousers', socks: 'none', trim: ['collar', 'cuffs'], colours: ['#2a6f97', '#1d2433', '#f2c14e'], shorts: 1, socksOf: 1, pattern: 'yoke' },
});
export const KIT_SPORTS = Object.freeze(Object.keys(SPORT_KITS));

// the bottoms: a paint word, and entries that carry it further down the leg
const BOTTOMS = {
  shorts: { word: 'bikeShorts', more: [] },
  longShorts: { word: 'bikeShorts', more: [{ part: 'thigh', run: [0.5, 0.86], group: 'Bottom' }] },
  pants: { word: 'bikeShorts', more: [{ part: 'thigh', run: [0.5, 1], group: 'Bottom' }] },
  trousers: { word: 'leggings', more: [] },
};
// the socks over the shin (the shoes are the `socks` word's feet, its high collar cut back to a low one first)
const SOCKS = {
  knee: [{ part: 'shank', run: [0.08, 0.93], group: 'Socks' }],
  ankle: [{ part: 'shank', run: [0.8, 0.93], group: 'Socks' }],
  none: [],
};

/** The patterns: bands of the second colour over the shirt (`only` Top, so a scoop's skin and the sleeves' ends hold). */
const SHIRT = ['Top'];
export const KIT_PATTERNS = Object.freeze({
  plain: [],
  hoops: [[0.3, 0.8], [1.3, 1.8], [2.3, 2.8], [3.2, 3.5]].map((u) => ({ part: 'torso', u, group: 'Kit', only: SHIRT })).concat([{ part: 'upperArm', run: [0.12, 0.26], group: 'Kit', only: SHIRT }]),
  stripes: [[0, 0.08], [0.22, 0.34], [0.48, 0.6], [0.74, 0.86]].map((t) => ({ part: 'torso', t, group: 'Kit', only: SHIRT })),
  band: [{ part: 'torso', u: [1.9, 2.6], group: 'Kit', only: SHIRT }],
  sleeves: [{ part: ['upperArm', 'foreArm'], group: 'Kit', only: SHIRT }],
  yoke: [{ part: 'torso', u: [3, 4], group: 'Kit', only: SHIRT }, { part: 'upperArm', run: [0, 0.28], group: 'Kit', only: SHIRT }],
  sides: [{ part: 'torso', t: [0.4, 0.6], group: 'Kit', only: SHIRT }],
});
export const KIT_PATTERN_IDS = Object.freeze(Object.keys(KIT_PATTERNS));

/** The trims, in the trim colour: the collar (the back's rim and the front scoop's edge), the cuffs (where the sleeve
 * ends: a tee's half sleeve, a long sleeve's wrist), the shirt's hem, a stripe down the side of the shorts. */
const KIT_TRIM = {
  collar: () => [{ part: 'torso', u: [3.8, 4], group: 'Trim', only: SHIRT }, { part: 'torso', u: [3.36, 3.5], t: [0, 0.35], group: 'Trim', only: SHIRT }],
  cuffs: (top) => (top === 'tee' ? [{ part: 'upperArm', run: [0.36, 0.45], group: 'Trim', only: SHIRT }] : top === 'longSleeve' ? [{ part: 'foreArm', run: [0.86, 1], group: 'Trim', only: SHIRT }] : []),
  hem: () => [{ part: 'torso', u: [0, 0.22], group: 'Trim', only: SHIRT }],
  shortsStripe: () => [{ part: 'thigh', t: [0.44, 0.56], group: 'Trim', only: ['Bottom'] }],
};
export const KIT_TRIMS = Object.freeze(Object.keys(KIT_TRIM));
const KEYS = ['sport', 'colours', 'pattern', 'trim', 'socks'];
const SHOES = '#f0f0ee';

/** What is wrong with a kit's words. */
export function readKit(kit) {
  if (kit === undefined || kit === null) return [];
  const words = `kit: '<sport>' (${KIT_SPORTS.join(' | ')}) or { sport?, colours?: [main, second?, trim?], pattern?, trim?, socks? }`;
  if (typeof kit === 'string') return SPORT_KITS[kit] ? [] : [`kit: '${kit}' is not a sport's kit; ${words}`];
  if (!isObj(kit)) return [words];
  const errs = [];
  for (const k of Object.keys(kit)) if (!KEYS.includes(k)) errs.push(`kit.${k}: not a kit word (${KEYS.join(', ')})`);
  if (kit.sport !== undefined && !SPORT_KITS[kit.sport]) errs.push(`kit.sport: '${kit.sport}' is one of ${KIT_SPORTS.join(', ')}`);
  if (kit.colours !== undefined && !(Array.isArray(kit.colours) && kit.colours.length >= 1 && kit.colours.length <= 3 && kit.colours.every((c) => typeof c === 'string' && HEX.test(c)))) errs.push('kit.colours: 1 to 3 colours, each \'#rrggbb\': the main (the shirt), the second (the pattern), the trim');
  if (kit.pattern !== undefined && !KIT_PATTERNS[kit.pattern]) errs.push(`kit.pattern: one of ${KIT_PATTERN_IDS.join(', ')}`);
  if (kit.trim !== undefined && kit.trim !== false && !(Array.isArray(kit.trim) && kit.trim.every((t) => KIT_TRIM[t]))) errs.push(`kit.trim: false, or a list of ${KIT_TRIMS.join(', ')}`);
  if (kit.socks !== undefined && !SOCKS[kit.socks]) errs.push(`kit.socks: one of ${Object.keys(SOCKS).join(', ')}`);
  return errs;
}

/** The words with the card's defaults: { sport, colours: [main, second, trim], pattern, trim, socks, card }. */
export function resolveKit(kit) {
  const errs = readKit(kit);
  if (errs.length) throw new Error(`sportswear: ${errs.join('; ')}`);
  const own = typeof kit === 'string' ? { sport: kit } : kit;
  const sport = own.sport ?? 'soccer', card = SPORT_KITS[sport];
  const given = own.colours ?? [];
  const colours = [0, 1, 2].map((i) => given[i] ?? (i === 1 && given[0] && card.colours[0] === card.colours[1] ? given[0] : card.colours[i]));
  return { sport, colours, pattern: own.pattern ?? card.pattern ?? 'plain', trim: own.trim === false ? [] : own.trim ?? card.trim, socks: own.socks ?? card.socks, card };
}

/** The dress a kit lowers to, on the authored body (painted) or the realistic one (the athlete's outfit card). */
export function kitDress(kit, { realistic = false } = {}) {
  const K = resolveKit(kit), C = K.card, [main, second, trim] = K.colours;
  const tones = { Top: main, Kit: second, Trim: trim, Bottom: K.colours[C.shorts], Socks: K.colours[C.socksOf], Shoes: SHOES, ...(C.gloves ? { Glove: second } : {}) };
  if (realistic) return { outfit: { type: 'outfit', style: 'athlete' }, tones };
  const bottom = BOTTOMS[C.bottom];
  const paint = [
    C.top, bottom.word, ...bottom.more,
    // the feet in shoes, the shoe's collar cut back to a low one (to the skin, or to the trousers over it), then the socks
    'socks', { part: 'shank', run: [0.7, 0.93], group: C.bottom === 'trousers' ? 'Bottom' : 'Skin', only: ['Shoes'] }, ...SOCKS[K.socks],
    ...(C.gloves ? ['gloves'] : []),
    ...KIT_PATTERNS[K.pattern],
    ...K.trim.flatMap((t) => KIT_TRIM[t](C.top)),
  ];
  // (the bare body's swimwear, where the kit leaves a band of it, is the shorts' colour)
  return { detail: 'swimsuit', paint, tones: { ...tones, Swim: tones.Bottom } };
}

/** A sport's book id (contest/sports.js) or a meet's to its card; a sport written out by its shape. */
export function kitSportOf(word) {
  if (SPORT_KITS[word]) return word;
  return { meet: 'track', match: 'tennis', turns: 'golf', team: 'soccer', innings: 'baseball' }[word] ?? 'soccer';
}
