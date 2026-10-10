/**
 * create_character — the Characters ring's door (3.1.0).
 *
 * A character is a body with a rig you can play, print or watch: a hero (a person), a creature (an
 * invented body) or an animal (a real species). Until 3.1.0 all three sat inside `mint_solid` beside
 * brackets and wordmarks, so "make me a character" landed in the object pack. This door names them
 * and dispatches to the SAME mints, so a character minted here is byte-identical to one minted by
 * `mint_solid` with the same spec (create-character.test.js), and `mint_solid` keeps every kind:
 *
 *   as 'hero'     → mint_solid kind 'layered' via 'hero'   (a cast word, a tune, face, hair, dress)
 *   as 'creature' → mint_solid kind 'layered' via 'plan' when spec.plan, else the layered recipe
 *   as 'animal'   → mint_solid kind 'animal'                (a species, or a bare archetype)
 *
 * Iteration is `update_sketch` on the stored recipe, as before. No kernel or recipe change.
 */

import { registerTool } from '@/lib/mcp/server';
import { mintSolidHandler } from '@/lib/mcp/tools/mint-solid';

// as → the mint_solid call it makes, and the card that is its manual.
export const CHARACTER_KINDS = {
  hero: { card: 'layered', route: () => ({ kind: 'layered', via: 'hero' }) },
  creature: { card: 'layered', route: (spec) => ({ kind: 'layered', ...(spec && spec.plan ? { via: 'plan' } : {}) }) },
  animal: { card: 'animal', route: () => ({ kind: 'animal' }) },
};

const AS_LIST = Object.keys(CHARACTER_KINDS);

export async function createCharacterHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error(`create_character requires an object: { as: ${AS_LIST.map((a) => `'${a}'`).join(' | ')}, spec, title?, ref?, folder_ref? }`);
  }
  const { as, spec, title, ref, folder_ref: folderRef } = input;
  const entry = CHARACTER_KINDS[as];
  if (!entry) {
    throw new Error(
      `create_character: unknown as '${as}'. Known: ${AS_LIST.join(', ')} (a person, an invented body, a real species). `
        + "Manuals: get_solid_vocab({ id: 'layered' }) for a hero or a creature, ({ id: 'animal' }) for an animal.",
    );
  }
  return mintSolidHandler({ ...entry.route(spec), spec, title, ref, folder_ref: folderRef });
}

export function registerCreateCharacterTools() {
  registerTool({
    name: 'create_character',
    description:
      "Make a CHARACTER: a body with a rig you can play, print or watch. `as: 'hero'`, a person (spec { cast: "
      + "'male' | 'female', register: 'round' | 'lowpoly' …, tune, face, hair, expression, detail, adorn }); "
      + "`as: 'creature'`, an invented body, a dragon, a monster, a plush toy (spec.plan, a ring plan, or a full "
      + "layered recipe); `as: 'animal'`, a real species (spec { species } or a bare { archetype }). A tiny "
      + 'deterministic recipe served as a still, an orbitable World that plays its clips, and a skinned `.glb`. '
      + "Iterate in place with `update_sketch`; never re-mint. Manual: get_solid_vocab({ id: 'layered' }) for a hero "
      + "or a creature, ({ id: 'animal' }) for an animal.",
    inputSchema: {
      type: 'object',
      properties: {
        as: { type: 'string', enum: AS_LIST, description: 'hero (a person) | creature (an invented body) | animal (a real species).' },
        spec: { type: 'object', description: "The body's own knobs, per its card (`layered` for hero and creature, `animal` for animal)." },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['as'],
    },
    handler: createCharacterHandler,
  });
}
