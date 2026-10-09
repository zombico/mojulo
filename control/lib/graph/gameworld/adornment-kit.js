/**
 * FROM THE LOOP TO THE KIT — what the main loop's final design implies for what the hero carries. The creator has laid
 * out the powers and their escalation (actions.js); this proposes the adornment page from them, deterministically and
 * with its reason, so a gated world shows it as the proposal and an autonomous one composes from it alone.
 *
 *   power verb / attack / look  →  an item word and its slot, or "the body carries it"    (RAILS, a table)
 *   the direction's primary     →  a staff's stone                                          (element-words.js)
 *   the direction's motif       →  the base ornament of every item
 *   the progression             →  each item's tiers (mass and ornament grow by stage)
 *
 * `suggestKit(actions, direction)` → `{ adornment, reasons, unread }`: `adornment` is the page's own shape (it reads and
 * resolves as an authored one would), `reasons` says why each power became what it did, and `unread` lists the powers
 * whose words the table does not know (they are left to the creator, never guessed). Pure: no dice, no clock.
 */
import { ELEMENT_GEM } from './element-words.js';

export { ELEMENT_GEM };

/**
 * The rails: a verb stem → the item it calls for, or "bodily" (no item). The verb's first word a rail knows decides
 * (whole words, with their -s, -ed and -ing forms: "dashes", "stabbing", "flies"; never "castle" for cast). The words are
 * conventions of how a thing is done, so a verb like "burn" or "throw" reads as a focus to channel through. A power the
 * rails do not read by verb falls to its attack (a focus), then its look (an effect on the body); else it is unread.
 */
export const RAILS = Object.freeze([
  { bodily: true, stems: ['dash', 'glide', 'rise', 'jump', 'leap', 'climb', 'vault', 'sprint', 'run', 'fly', 'float', 'hover', 'swim', 'blink', 'teleport', 'step', 'walk', 'slide'], why: 'it moves the body, so the body carries it' },
  { item: 'greatsword', stems: ['smash', 'cleave', 'crush', 'slam'], why: 'a heavy two-handed blow' },
  { item: 'sword', stems: ['slash', 'cut', 'strike', 'slice', 'hack', 'chop', 'sever'], why: 'a cutting blow' },
  { item: 'dagger', stems: ['stab', 'pierce', 'pry', 'sneak', 'pick', 'sting'], why: 'a close, quick edge' },
  { item: 'bow', stems: ['shoot', 'snipe', 'aim', 'volley', 'arrow'], why: 'a ranged shot' },
  { item: 'shield', stems: ['guard', 'deflect', 'block', 'ward', 'parry', 'shield', 'protect', 'reflect'], why: 'a defence held in front' },
  { item: 'staff', stems: ['cast', 'channel', 'conjure', 'summon', 'call', 'throw', 'hurl', 'fire', 'burn', 'freeze', 'shock', 'blast', 'beam', 'bolt', 'orb', 'ball', 'gust', 'whip'], why: 'a force sent out through a focus' },
]);

/** The item's hands, best first: a held item takes the first slot of its list that is free. */
const SLOTS = Object.freeze({ greatsword: ['right', 'back', 'hip'], sword: ['right', 'back', 'hip'], dagger: ['right', 'hip', 'back'], bow: ['left', 'back', 'hip'], shield: ['left', 'back', 'hip'], staff: ['right', 'back', 'hip'] });

/** How an item grows by stage: the ornament (0-3) and the mass, from the motif's base. Absolute, so a tier is a plain diff. */
const MASS = Object.freeze({ mid: 1.1, late: 1.25 });

const words = (verb) => String(verb).toLowerCase().split(/[^a-z]+/).filter(Boolean);
/** A stem's forms: itself, -s (-es after a hiss or an o), -ed (-d after an e), -ing (a final e dropped, a final consonant
 * doubled), and y → -ies/-ied. */
const forms = (s) => {
  const f = [s, `${s}s`, `${s}ed`, `${s}ing`, `${s}${s.at(-1)}ed`, `${s}${s.at(-1)}ing`];
  if (/(s|sh|ch|x|z|o)$/.test(s)) f.push(`${s}es`);
  if (s.endsWith('e')) f.push(`${s}d`, `${s.slice(0, -1)}ing`);
  if (s.endsWith('y')) f.push(`${s.slice(0, -1)}ies`, `${s.slice(0, -1)}ied`);
  return f;
};
const RAIL_OF_WORD = new Map(RAILS.flatMap((r) => r.stems.flatMap((s) => forms(s).map((w) => [w, r]))).reverse());

/** The rail a power reads as: by its verb, else its attack (a focus), else its look (an effect on the body). */
function railOf(p) {
  const byVerb = words(p.verb).map((w) => RAIL_OF_WORD.get(w)).find(Boolean);
  if (byVerb) return { rail: byVerb, why: `${p.verb} → ${byVerb.bodily ? 'bodily' : byVerb.item}: ${byVerb.why}` };
  if (p.attack) return { rail: RAILS.find((r) => r.item === 'staff'), why: `attack ${p.attack} → staff: a force sent out through a focus` };
  if (p.look) return { rail: RAILS[0], why: `look ${p.look} → bodily: an effect on the body` };
  return null;
}

/** Propose the adornment page from a resolved actions page and a resolved direction (resolveDirection's, or null). */
export function suggestKit(actions, direction = null) {
  const reasons = [], unread = [], bodily = [], byItem = new Map();
  for (const p of actions?.powers ?? []) {
    const hit = railOf(p);
    if (!hit) { unread.push({ id: p.id, verb: p.verb }); continue; }
    reasons.push(`${p.id}: ${hit.why}`);
    if (hit.rail.bodily) { bodily.push(p.id); continue; }
    if (!byItem.has(hit.rail.item)) byItem.set(hit.rail.item, []);
    byItem.get(hit.rail.item).push(p.id);
  }
  const taken = new Set(), items = [];
  const base = direction?.motif ? 1 : 0;
  const gem = direction?.primary ? ELEMENT_GEM[direction.primary.toLowerCase()] : undefined;
  for (const [item, serves] of byItem) {
    const slot = SLOTS[item].find((s) => !taken.has(s));
    if (!slot) { reasons.push(`${item}: every slot is taken; it is left out`); continue; }
    taken.add(slot);
    // a staff cradles the leading element's stone when there is one; otherwise it stays plain (a gemless head)
    const build = item === 'staff' ? (gem ? { item, parts: { head: 'claw' }, dials: { focus: 'head', ornament: base, mass: 1 }, gem } : { item, parts: { head: 'plain' }, dials: { ornament: base, mass: 1 } }) : { item, dials: { ornament: base, mass: 1 } };
    if (item === 'staff') reasons.push(gem ? `staff: the leading element ${direction.primary} → a ${gem}` : `staff: ${direction?.primary ? `no stone for '${direction.primary}'` : 'no leading element'} → a plain head`);
    items.push({
      id: item, slot, build, serves,
      tiers: { mid: { dials: { ornament: Math.min(3, base + 1), mass: MASS.mid } }, late: { dials: { ornament: Math.min(3, base + 2), mass: MASS.late } } },
    });
  }
  const adornment = { items, ...(bodily.length ? { bodily } : {}) };
  return { adornment, reasons, unread };
}
