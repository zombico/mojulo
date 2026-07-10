/**
 * Glyph vocabulary loader — one card per FORM on the game-UI-language shelf
 * (game-ui-language.plan.md, U1). Like the kit cards, glyph cards are GENERATED
 * from the registry (glyph-forms.js) so the discoverable shelf can never drift
 * from the builders. Each card carries the form's routing phrases + semantics
 * (default tint, symmetry, idle rule, fit anchor) + the entity-body usage shape,
 * so an agent finds a form by intent (semantic_search({ kinds: ['game_glyph'] }))
 * and reads the manual (get_game_vocab({ id: 'glyph-<form>' })).
 */

import { GLYPH_FORMS, GLYPH_IDS, glyphFormFaces } from '../glyph-forms.js';

function renderCard(form) {
  const row = GLYPH_FORMS[form];
  const faceCount = glyphFormFaces(form).length;
  const spinNote = row.symmetry === 'radial' || row.symmetry.startsWith('radial-')
    ? `symmetry \`${row.symmetry}\` — rotation is ${row.symmetry === 'radial' ? 'invisible' : 'nearly invisible'} on this form; idle defaults to \`${row.idle}\` (spin-class effects belong on bilateral forms).`
    : `symmetry \`${row.symmetry}\` — rotation reads; idle defaults to \`${row.idle}\`.`;
  const body = [
    '## What it is', '',
    `${row.summary} Icon-grade procedural solid (${faceCount} faces), base at z=0, ~${row.fit.height} units tall, deterministic from (form, tint, scale).`, '',
    '## Semantics', '',
    `Default tint \`${row.tint}\` (the semantic color — override per instance with \`tint\`). ${spinNote}`, '',
    '## Effect anchor (fit)', '',
    `\`{ height: ${row.fit.height}, cz: ${row.fit.cz} }\` — aura/wisp effects anchor at cz above the entity transform; scale multiplies both.`, '',
    '## Use as an entity body', '',
    '```json',
    JSON.stringify({ id: `${form}-1`, transform: { pos: [8, 0, 0] }, body: { type: 'glyph', form, tint: row.tint } }, null, 2),
    '```', '',
    'Lowered at resolve time to a single-frame `figure-frames` body (no emitter changes; a world without glyph bodies emits byte-identical HTML). Optional body fields: `tint` (hex), `scale` (number, uniform), `yawOffset` (radians; default 0).',
  ].join('\n');
  return {
    id: `glyph-${form}`,
    name: `Glyph: ${row.name}`,
    summary: row.summary,
    when: row.when,
    body,
  };
}

let _catalog = null;
export function getGlyphVocabCatalog() {
  if (!_catalog) {
    _catalog = new Map();
    for (const form of GLYPH_IDS) {
      const card = renderCard(form);
      _catalog.set(card.id, card);
    }
  }
  return _catalog;
}
export function getGlyphVocabCard(id) { return getGlyphVocabCatalog().get(id) || null; }
export function listGlyphVocab() {
  return [...getGlyphVocabCatalog().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when }));
}
