/**
 * THE HERO'S DESIGN — a game's protagonist designed as a PERSON OF ITS WORLD, where nothing else designs it. The looks
 * pages (hero-looks.js) compose whatever they are given; given nothing, the hero is the door's stock body in the
 * setting's plain clothes, the one figure in the game nobody designed, beside a cast, a folk and a bestiary that are
 * each rolled and dressed by principle. So the hero is rolled as they are (the Egocube: egocube/egocube.js), in the
 * game's own setting (cast-setting.js: its tradition, its era, its ramps), as its PROTAGONIST, and its sheet's plan
 * (egocube/plan.js) fills the pages, each in the page's own words:
 *
 *   body        its cast and its build's proportions
 *   head        its face as the sheet reads it (its expression, its sculpt)
 *   hair        its hair, cut by how kept the sheet is
 *   colour      its skin and hair, and the shirt and the legs in the world's ramps (the setting's)
 *   underlayer  the cut the principles derive for it and the pieces they design over it (egocube/outfit.js: the role's
 *               gear, the archetype's one focal, the station, the trim repeated), in ONE colour that is the world's
 *
 * THE PROTAGONIST READS AGAINST ITS GROUND: a villager dresses in the world's materials, and so vanishes into them; the
 * hero's garment is the world's ACCENT (world-palette.js accentOf), the colour its scheme keeps apart from the ground, and every other role
 * of the outfit's palette (the secondary, the metal of its trim, its plates) follows from that garment by the palette's
 * own rules (outfit.js outfitPalette). A world with no palette keeps the archetype's own colour.
 *
 * The base wears its underlayer at ornament 0 (hero-looks.js underlayerFor), which takes the belt a cut closes on with
 * it: the belt is worn as a piece instead, so the tunic still breaks at the waist.
 *
 *   PROTAGONIST                 the facets a protagonist is rolled at (its role is the game's: ROLE_OF_VERB)
 *   heroDesign(G)               → { looks, sheet, garment, pieces, laws, read } | null
 *     G        a read world (readGameworld's) with its characters
 *     looks    { body, head, hair, colour, underlayer }: the pages, to lay as characters.hero.looks
 *     sheet    { facets, seed, path }: the roll, so the same hero is rolled again; { casting: 'anchor' } where the game
 *              has a casting page, whose anchor (the sheet its cast is rolled against: casting.js) IS the hero
 *     garment  the colour given the outfit (the world's accent), or null
 *     pieces   [{ kind, role?, why }]: what it wears over the cut and why
 *     laws     the outfit's visual-interest laws read over it (advisory: outfit-plan.js outfitLaws)
 *     read     what was decided, in lines a brief or a book says
 *   null where the game designs its hero another way: a body rail the game reads (game-bodies.js: a comic hero, a
 *   fighter, a mascot), an adopted hero, looks pages the creator has written, or a roll that is not a person.
 *
 * Pure and deterministic: the world's seed, nothing else rolled.
 */
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet } from '../egocube/plan.js';
import { outfitFromSheet, heroOutfitOf } from '../egocube/outfit.js';
import { settingOfGame } from './cast-setting.js';
import { accentOf } from './world-palette.js';
import { castingOf } from './casting.js';
import { bodyOfGame } from './hero-looks.js';
import { LOOKS_ELEMENTS } from './characters.js';

/** Who a game's protagonist is, before its world says more: the hero of its own story, young. */
export const PROTAGONIST = Object.freeze({ archetype: 'hero', age: 'youth' });
/** Its role by what it fights with (adornment.js BASIC_VERBS): a blow in the front line, a shot at range; none, no fighter. */
export const ROLE_OF_VERB = Object.freeze({ strike: 'frontline', shoot: 'ranged' });
const NO_FIGHT = 'non-combatant';
const pick = (spec, fields) => Object.fromEntries(fields.filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]));

export function heroDesign(G) {
  const hero = G?.characters?.hero;
  // (a base pinned is not a page written: it is the made hero's revision)
  const written = Object.keys(hero?.looks ?? {}).some((k) => k !== 'base');
  if (!G?.characters || hero?.ref || written || bodyOfGame(G)) return null;
  const verbs = (hero?.adornment?.items ?? []).flatMap((it) => it.serves ?? []);
  const role = Object.entries(ROLE_OF_VERB).find(([v]) => verbs.includes(v))?.[1] ?? NO_FIGHT;
  const roll = { facets: { ...PROTAGONIST, role }, seed: Number.isInteger(G.seed) ? G.seed : 1, path: 'hero' };
  // (a game with a casting page has its hero as a sheet already, the ANCHOR its cast was rolled against (casting.js): the
  // hero is that person, not a second roll beside it)
  const cast = G.characters.casting ? castingOf(G) : null;
  const sheet = cast ? cast.sheet.members[cast.sheet.anchor].sheet : rollEgocube({ ...roll, setting: settingOfGame(G) });
  const P = planFromSheet(sheet, { dress: 'designed' }), spec = P.create?.spec;
  // (a blind roll is human, so it is a person on the hero door; a setting that leans it otherwise is not this page's)
  if (!spec || P.create.as !== 'hero' || P.beast) return null;
  const garment = accentOf(G);
  // (a person the principles clothed: the same cut and pieces, the garment in the world's accent; one in its era's
  // armour or its rolled look keeps what the plan gave it)
  const designed = spec.outfit?.style?.id === 'designed' ? outfitFromSheet(sheet, { coat: sheet.ancestry.colours.Skin, garment }) : null;
  const worn = designed ? heroOutfitOf(designed.outfit) : spec.outfit ?? null;
  const pieces = [...(designed?.outfit.pieces ?? [])];
  if (worn && designed?.outfit.cut.language.focal === 'belt' && !pieces.some((p) => ['belt', 'sash'].includes(p.kind))) {
    const belt = { kind: 'belt', why: 'the belt its cut closes on, worn as a piece: the base wears its cloth plain' };
    pieces.push(belt);
    worn.pieces = [...(worn.pieces ?? []), { kind: 'belt' }];
    if (!worn.intent) worn.intent = { palette: designed.outfit.intent.palette };
  }
  const looks = {
    body: pick(spec, LOOKS_ELEMENTS.body.fields),
    head: pick(spec, LOOKS_ELEMENTS.head.fields),
    ...(spec.hair !== undefined ? { hair: { hair: spec.hair } } : {}),
    ...(spec.palette ? { colour: { palette: { ...spec.palette } } } : {}),
    ...(worn ? { underlayer: worn } : {}),
  };
  for (const k of ['body', 'head']) if (!Object.keys(looks[k]).length) delete looks[k];
  const f = sheet.facets, L = designed?.outfit.cut.language;
  const read = [
    `the protagonist ${cast ? 'the cast\'s anchor, a person of this world' : `rolled as a person of this world (seed ${roll.seed})`}: a ${f.age} ${f.pole}, ${f.build}, ${sheet.ancestry.reads ?? f.ancestry}, the ${f.archetype}, ${f.role}`,
    ...(L ? [`its cut by the principles: ${[L.outer ? `a ${L.outer.sleeve === 'none' ? 'sleeveless ' : ''}${L.outer.hem} outer layer` : null, L.top ? `a ${L.top.sleeve}-sleeved ${L.top.family} top` : null, L.bottom ? `${L.bottom.leg} ${L.bottom.family} ${L.bottom.kind === 'skirt' ? 'skirt' : 'legs'}` : null, L.feet && L.feet !== 'none' ? L.feet : null].filter(Boolean).join(', ')}`] : []),
    ...(pieces.length ? [`over it: ${pieces.map((p) => `${p.kind}${p.role === 'focal' ? ' (the focal)' : ''}`).join(', ')}`] : []),
    garment && designed ? `its garment the world's accent (${garment}), so it reads against the ground the world is painted in; the shirt and the legs in the world's ramps` : designed ? 'its garment the archetype\'s own colour: the world names no palette' : 'dressed as its era\'s look',
  ];
  return { looks, sheet: cast ? { casting: 'anchor' } : roll, garment: designed ? garment : null, pieces: pieces.map(({ kind, role: r, why }) => ({ kind, ...(r ? { role: r } : {}), ...(why ? { why } : {}) })), laws: designed?.laws ?? [], read };
}
