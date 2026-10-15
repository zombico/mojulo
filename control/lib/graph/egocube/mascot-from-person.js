/**
 * A PERSON, OUTPUT AS A MASCOT: the Egocube's mascot tuning applied to a person's sheet (egocube.js), so the same
 * character can be made at RPG proportions through the hero door and as its mascot (docs/mascot.md, The person as a
 * mascot). The person's sheet is not rolled again: its facets are READ, each into the mascot facet that plays the same
 * part, and the mascot sheet is rolled from them on the person's own seed, so the pair stays one character.
 *
 *   mascotFacetsOfPerson(sheet) → { facets, mapping: [{ facet, value, from, because }] }
 *   mascotOfPerson(sheet)       → the mascot sheet (rollMascot), with `person` (the facets it was read from) and `mapping`
 *
 * What a life wrote (wear, the face at rest set by years, the dress a role chose) has no mascot channel: a mascot does not
 * age (law 1), and its piece is one signature, not a kit (Ad1). Pure and deterministic.
 */
import { rollMascot, SKINS } from './mascot.js';

/** the archetype's light is the promise a mascot makes (law 1: a promise, not a life) */
export const ARCHETYPE_PROMISE = Object.freeze({ innocent: 'cheer', explorer: 'speed', sage: 'wonder', hero: 'might', outlaw: 'mischief', magician: 'wonder', everyman: 'cheer', jester: 'mischief', lover: 'comfort', caregiver: 'comfort', creator: 'cheer', ruler: 'pride' });
/** the colour each archetype owns (law 7) */
export const ARCHETYPE_HUE = Object.freeze({ innocent: 'yellow', explorer: 'green', sage: 'blue', hero: 'red', outlaw: 'brown', magician: 'purple', everyman: 'blue', jester: 'orange', lover: 'pink', caregiver: 'pink', creator: 'teal', ruler: 'purple' });
/** the reading (light, turning, shadow) as the face at rest; a few archetypes read their own way */
export const READING_EXPRESSION = Object.freeze({ light: 'happy', turning: 'determined', shadow: 'smirk' });
const OWN_EXPRESSION = Object.freeze({ 'sage/light': 'content', 'ruler/light': 'content', 'hero/light': 'determined', 'hero/shadow': 'angry', 'ruler/shadow': 'angry', 'jester/light': 'grin', 'innocent/light': 'grin' });
/** the role as the one signature piece (Ad1, Ad5) and as the idle (law 9) */
export const ROLE_ADORN = Object.freeze({ frontline: 'belt', flanker: 'bandana', ranged: 'scarf', caster: 'medal', controller: 'pack', support: 'pack', 'non-combatant': 'none' });
export const ROLE_ENERGY = Object.freeze({ frontline: 'sturdy', flanker: 'zippy', ranged: 'swaying', caster: 'floaty', controller: 'swaying', support: 'bouncy', 'non-combatant': 'bouncy' });
/** the order as the accent's family (law 5): bound is square, free is spiky, between is round */
const orderAccent = (o) => (o < 1 / 3 ? 'block' : o > 2 / 3 ? 'spike' : 'round');
/** the build (and a child's age) as the form (law 3): every person is head-heavy here */
export const BUILD_FORM = Object.freeze({ lithe: 'sprout', canonical: 'toon', heroic: 'toon', stout: 'sprout', brute: 'toon' });
/** a lineage as the animal that plays it (docs/mascot-animals.md), or a person with a hook */
export const LINEAGE_MASCOT = Object.freeze({
  feline: { animal: 'houseCat' }, lupine: { animal: 'wolf' }, ursine: { animal: 'brownBear' }, avian: { animal: 'greatHornedOwl' },
  draconic: { being: 'critter', hook: 'spines', hue: 'green' }, insectoid: { being: 'critter', hook: 'antenna', hue: 'teal' },
  undead: { being: 'critter', hue: 'white', eyes: 'dots' }, infernal: { being: 'human', hook: 'ears', accent: 'spike' },
  sylvan: { being: 'human', hook: 'ears', accent: 'spike' }, dwarven: { being: 'human', hook: 'moustache' }, orcish: { being: 'human', skin: 'olive' },
});

const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** the mascot skin nearest a person's own (by lightness: a mascot's skins are a short owned set) */
export const nearestSkin = (hex) => Object.entries(SKINS).reduce((best, [id, s]) => (Math.abs(lum(s.skin) - lum(hex)) < Math.abs(lum(SKINS[best].skin) - lum(hex)) ? id : best), 'peach');

/** A person's sheet read into mascot facets, each with the reason it was read so. */
export function mascotFacetsOfPerson(sheet) {
  if (!sheet || sheet.tuning === 'mascot' || !sheet.facets?.archetype) throw new Error('mascot: a person\'s sheet (rollEgocube) is read here; a mascot sheet is already one');
  const f = sheet.facets, reads = sheet.reading?.reads ?? 'light', mapping = [], out = {};
  const set = (facet, value, from, because) => { if (value === undefined) return; out[facet] = value; mapping.push({ facet, value, from, because }); };
  set('promise', ARCHETYPE_PROMISE[f.archetype], `archetype.${f.archetype}`, 'the archetype\'s light is the promise');
  set('hue', ARCHETYPE_HUE[f.archetype], `archetype.${f.archetype}`, 'the colour the archetype owns');
  set('expression', OWN_EXPRESSION[`${f.archetype}/${reads}`] ?? READING_EXPRESSION[reads], `reading.${reads}`, 'how far toward its shadow the archetype reads, as the face at rest');
  set('adorn', ROLE_ADORN[f.role], `role.${f.role}`, 'the role\'s kit as one signature piece');
  set('energy', ROLE_ENERGY[f.role], `role.${f.role}`, 'how the role moves, as the idle');
  set('accent', orderAccent(f.order), `order ${f.order}`, 'bound is square, free is spiky, between is round');
  set('form', f.age === 'child' ? 'sprout' : BUILD_FORM[f.build], f.age === 'child' ? 'age.child' : `build.${f.build}`, 'the build as a head-heavy form (a mascot never ages)');
  const lin = LINEAGE_MASCOT[f.ancestry];
  if (lin) for (const [k, val] of Object.entries(lin)) set(k, val, `ancestry.${f.ancestry}`, k === 'animal' ? 'the lineage played by its animal' : 'the lineage\'s mark');
  else {
    set('being', 'human', `ancestry.${f.ancestry}`, 'a person stays a person, in a mascot\'s proportions');
    if (sheet.ancestry?.colours?.Skin) set('skin', nearestSkin(sheet.ancestry.colours.Skin), `ancestry.${f.ancestry}`, 'the nearest of the mascot\'s skins to their own');
  }
  if ((out.being ?? 'human') === 'human' && !out.animal) set('extremities', 'gloves', 'being.human', 'a person has hands: gloved, as mascots are');
  return { facets: out, mapping };
}

/** The person's mascot: the mascot sheet rolled from the read facets on the person's own seed (one character, two tunings). */
export function mascotOfPerson(sheet) {
  const { facets, mapping } = mascotFacetsOfPerson(sheet);
  const m = rollMascot({ facets, seed: sheet.seed, path: `${sheet.path ?? 'hero'}/mascot`, ...(sheet.setting ? { setting: sheet.setting } : {}) });   // in the game it was made for
  return { ...m, person: { facets: sheet.facets, reads: sheet.reads }, mapping };
}
