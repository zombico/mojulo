/**
 * The character target's extraction protocol: how the agent reads a picture the person gave it (a drawing, a photo, a
 * figure, a turnaround) into the hero door's own words. The agent is the vision adapter: no image reaches mojulo and
 * nothing is generated. The read lands in a look (character-looks.js) and a register, told by the person or picked
 * from the picture, and the hero it makes is the hero those words make, sculpted afterwards like any other.
 *
 * Likeness is the model's judgment (the `likeness` lines): an identifiably trademarked character is offered as an
 * "X-like" build, negotiated with the person. Nothing in code refuses, and nothing here gates the sculpting that
 * follows.
 */

import { CHARACTER_MENUS, CHARACTER_LOOK_DEFAULT, REGISTER_DEFAULT, characterLookTable, characterRegisterTable } from './character-looks.js';

const MANUAL = "get_solid_vocab({ id: 'layered', section: '<name>' })";

export const CHARACTER_PROTOCOL = Object.freeze({
  target: 'character',
  summary:
    "Read a picture of a CHARACTER (a drawing, a photo, a figure, a turnaround) into the hero door's own words, in a LOOK and a REGISTER, and make the hero those words make. You are the vision adapter: you read the picture, nothing is sent and nothing is generated. Read the design, not the paint: the silhouette, the proportions, the hair, the clothes and the palette, in that order; what no word reaches is a gap you name, never geometry you invent. The hero is a starting point the person sculpts afterwards, word by word.",
  choosing: [
    "A look or a register the person NAMES wins ('make her anime', 'low-poly'): set `chosen: { look: 'told' | 'picked', register: 'told' | 'picked' }`.",
    "Otherwise PICK from the picture's own rendering: the look whose `suits` reads like the picture, and the register whose `reads` matches its forms. Say why in one line (`chosen.why`), so the person can overrule it.",
    `When nothing calls for one, the look is '${CHARACTER_LOOK_DEFAULT}' and the register '${REGISTER_DEFAULT}'.`,
    "A look's `sets` are the words it IS; its `choose` are the choices inside it, each against a menu below. A look `refuses` what the door refuses; say so before you read for it.",
  ],
  looks: characterLookTable(),
  registers: characterRegisterTable(),
  key_lines: [
    "THESIS first, before any word: the role, the outline letter (one of the stylism outlines), the emotional read, the one HOOK (the detail that makes it this character: a scarf, a scar, a hair shape), and the material story (dark body, bright focus, an accent).",
    "PROPORTIONS in head-heights: count the heads from crown to heel. That gives the cast pole and build (`cast: { pole, build }`), `tune.stature` and `headScale`. Read the shoulders against the hips for the build before any single tune.",
    "DRESS BEFORE BODY: a baggy coat's bulk is the outfit's (`stylism`, an outfit card, its ease), not a wider torso. Chasing clothes with body tunes is the classic first-pass error.",
    `HAIR, FACE and EXPRESSION by the head's own words: the landmark head's in ${MANUAL.replace('<name>', 'hero-hair')} and 'hero-face'; the anime head's \`look\` words in 'hero-looks', its cast in 'hero-anime-style'.`,
    "CLOTHES as words: `stylism: { genre, register, silhouette, canon }` (a designer's brief the door solves), or an outfit card (`outfit: { type: 'outfit', style }`); `headgear` for what is on the head; `gear` for what is held; `adorn` for armour; `kit` for a sport's kit. Manuals: 'hero-outfit', 'hero-dress', 'hero-headgear', 'hero-gear'.",
    "PALETTE from the picture's regions, as hex: `palette: { Skin, Top, Bottom, Shoes, Hair, … }`. Read flat colour, not lighting: the colour a region is, not the colour its shadow is.",
    "VIEW and UNSEEN: say which side the picture shows (`view`), and what it does not show (`unseen`: the back, the feet, the hands). What you fill in for those is invented, and the read says so.",
    "GAPS: whatever no word reaches (a shape, a material, a detail) goes in `gaps`, plainly. A gap named is a finding; a gap papered over with the nearest word is a wrong read.",
  ],
  likeness: [
    "Likeness and IP are YOUR judgment, made in conversation; mojulo classifies nothing and refuses nothing.",
    "An original character, or the person themselves: `likeness: 'original'`, read as faithfully as the words reach.",
    "An identifiably trademarked or copyrighted character (a franchise's named character, its logo or emblem, the signature combination of costume details that makes it that character): OFFER an X-like build and negotiate it with the person. Keep the look, the register, the silhouette family, the palette family, the spirit; change the name, every logo and emblem, and enough of the signature details that it reads X-like, not X. Say what you changed (`changed`). The person may push back; where it lands is your call. Record `likeness: 'x-like', like: '<what it is like>'`.",
    "A named hero's name is its own on this machine; an X-like hero takes a name of its own.",
    "This covers the read. After it the hero is an ordinary hero, shaped prompt by prompt with update_character like any hero made from words.",
  ],
  input_schema: {
    look: `one of the looks' ids (default '${CHARACTER_LOOK_DEFAULT}')`,
    register: `one of the registers' ids (default '${REGISTER_DEFAULT}')`,
    chosen: "{ look: 'told' | 'picked', register: 'told' | 'picked', why: '<one line>' }",
    thesis: "the one line: role · outline · read · hook · material story",
    likeness: "{ verdict: 'original' | 'x-like', like?: '<what it is like>', changed?: ['<what you changed>', …] }",
    view: "'front' | 'three-quarter' | 'side' | 'back' | 'turnaround'",
    unseen: "['back', 'feet', …] — what the picture does not show",
    gaps: "['<what no word reaches>', …]",
    words: "the hero door's words you read (cast, tune, headScale, palette, hair, face, expression, look, stylism, outfit, headgear, gear, adorn, kit, gesture, name, and a look's choices); the manual is get_solid_vocab({ id: 'layered' }), the Hero door and its hero-* sections",
  },
  vocabulary: CHARACTER_MENUS,
  fidelity_contract: {
    likeness:
      "DEFAULT. Reads as the character at a normal distance: the silhouette, the proportions, the hair shape, the palette and the hook. Stop there; the person sculpts the rest.",
    faithful:
      'Ask for a second picture (the back, a turnaround) and keep moving one word at a time until nothing moves. Closer, never a copy: the words are a closed vocabulary.',
  },
  ceiling: [
    "A closed vocabulary: the hero READS AS the character; it is never a copy of the drawing. Paint, fabric weave, lighting and line quality are not read.",
    "One picture shows one side: the back, and anything the picture hides, is invented. Say which.",
    "A look is a head family and a form, not a franchise's style: the anime look is the door's anime head, whichever anime the picture came from.",
  ],
  multipass_hint:
    "A second picture (the back, a turnaround, a close-up of the face or a costume detail) refines the read by word, never the words the person has already changed by hand.",
  capture_call:
    "create_character({ as: 'hero', spec: { ...the look's `sets`, register, ...your `words` }, title }) — the read's own capture (capture_reference target 'character') is not built yet, so mint through the hero door, then tell the person your thesis, the look and register and why, the likeness verdict, the unseen and the gaps.",
  next:
    "Sculpt from there with update_character({ ref, spec: { <a word> } }): one word at a time, the person's words over the picture's.",
});
