/**
 * SFX vocabulary loader — one card per VERB on the game-UI-language SFX shelf
 * (game-ui-language.plan.md, U4). Generated from the registry (glyph-sfx.js) so the discoverable
 * shelf can never drift from the composer. Each card carries the verb's routing phrases +
 * mechanism + default params + the manifest usage shape, so an agent finds an effect by intent
 * (semantic_search({ kinds: ['game_sfx'] })) and reads the manual (get_game_vocab({ id: 'sfx-<verb>' })).
 */

import { SFX_VERBS, SFX_VERB_IDS } from '../glyph-sfx.js';

const MECHANISM_NOTE = {
  bead: 'emission beads travelling a parametric path (a wisp with a comet trail)',
  field: 'an emission volume (a soft glow field)',
  extinction: 'extinction filaments — absorbs light, never emits (black negative-space)',
};

function renderCard(verb) {
  const v = SFX_VERBS[verb];
  const dflt = { ...v.defaults };
  const color = dflt.color;
  delete dflt.color;
  const body = [
    '## What it is', '', v.summary, '',
    `Mechanism: **${v.mechanism}** — ${MECHANISM_NOTE[v.mechanism]}. Animation rides \`uTime\` (deterministic under camera bakes). March-step floor \`${v.steps}\`.`, '',
    '## Default params', '',
    '```json',
    JSON.stringify({ color, ...dflt }, null, 2),
    '```',
    'Override any of these per layer via `params`, and `color` directly. A soft-knee gain budget caps the composed emission, so a hot `gain` brightens without white-out.', '',
    '## Use in a world manifest', '',
    '```json',
    JSON.stringify({ sfx: [{ verb, on: 'pickup-1' }, { verb, at: [4, 0, 0], color, params: {} }] }, null, 2),
    '```',
    'Anchor each layer at an entity (`on: \'<id>\'` → its transform.pos) or an explicit world point (`at: [x,y,z]`). All layers compose into ONE overlay pass; a `kokusen` in the mix raises the whole layer\'s march cost (step floor 240), so use it sparingly alongside others.',
  ].join('\n');
  return { id: `sfx-${verb}`, name: `SFX: ${verb}`, summary: v.summary, when: v.when, body };
}

let _catalog = null;
export function getSfxVocabCatalog() {
  if (!_catalog) {
    _catalog = new Map();
    for (const verb of SFX_VERB_IDS) {
      const card = renderCard(verb);
      _catalog.set(card.id, card);
    }
  }
  return _catalog;
}
export function getSfxVocabCard(id) { return getSfxVocabCatalog().get(id) || null; }
export function listSfxVocab() {
  return [...getSfxVocabCatalog().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when }));
}
