/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// Vocabulary drawers for the sketch + style surfaces.


import { STYLE_VOCAB, STYLE_PRESETS, isStylePreset, resolveStyle } from '@/lib/graph/image-outcomes/styles';
import {
  getSketchVocabCard,
  listSketchVocab,
} from '@/lib/graph/sketch-vocab/loader';
import { hiddenRowInPluginProfile, pluginProfileActive, pluginProfileNotice, profileEdit } from '@/lib/mcp/plugin-profile';

// Under the Claude plugin profile (lib/mcp/plugin-profile.js) the manuals of the painted kinds are not
// served (nor the motion-comic tricks built on painted pages), and two kept cards lose the lines that
// send a picture to an image generator. Per card,
// per field: the edits apply to the list row and the card alike.
const PROFILE_CARD_EDITS = {
  'panel-depiction-recipes': {
    when: [['; for an AI-PAINTED comic or manga page use the sequential-art kind instead', '']],
    body: [[/ When the user wants an AI-painted comic or\nmanga page[\s\S]*?for the external image worker\./, '']],
  },
  'wardrobe-construction': {
    summary: [['on a create_figure / character-sheet body', 'on a create_figure body']],
    when: [[' or character-sheet,', ','], [' reconstruct a dreamed outfit as a garment spec,', '']],
    body: [[
      "The image model's native construction register is CUT-AND-SEW panels, not ring\nwireframes — so target this vocabulary directly when reading a dream. A garment",
      'The construction register is CUT-AND-SEW panels, not ring\nwireframes. A garment',
    ]],
  },
};

function profiledCard(card) {
  const edits = pluginProfileActive() && PROFILE_CARD_EDITS[card.id];
  if (!edits) return card;
  const out = { ...card };
  for (const [field, list] of Object.entries(edits)) {
    if (typeof out[field] === 'string') out[field] = profileEdit(out[field], list, `sketch_vocab.${card.id}.${field}`);
  }
  return out;
}

function servedCards() {
  return listSketchVocab().filter((c) => !hiddenRowInPluginProfile('sketch_vocab', c.id)).map(profiledCard);
}

export async function getSketchVocabHandler(input) {
  const id = input && typeof input === 'object' ? input.id : undefined;
  if (id === undefined || id === null || id === '') {
    return { cards: servedCards(), _telemetrySignal: { id_requested: false, found: true } };
  }
  if (typeof id !== 'string') {
    throw new Error('`id` must be a string (a sketch_vocab source_ref)');
  }
  if (hiddenRowInPluginProfile('sketch_vocab', id)) throw new Error(pluginProfileNotice(`The '${id}' card`));
  const card = getSketchVocabCard(id);
  if (!card) {
    const available = servedCards().map((c) => c.id);
    // "unknown card" keeps the miss visible to the orientation cut
    // (DRAWER_MISS_ERROR_RE in mcpToolCalls.js).
    throw new Error(
      `get_sketch_vocab: unknown card '${id}'. Known: ${available.join(', ') || '(none)'}. Find one by intent via semantic_search({ kinds: ['sketch_vocab'], query: '<your ask>' }).`,
    );
  }
  return { card: profiledCard(card), _telemetrySignal: { id_requested: true, found: true } };
}

const STYLE_AUTHOR_NOTE =
  'Presets are TEMPLATES, not a closed gate. Author a style on renderBrief three ways: '
  + '(1) preset (+ dials); (2) preset + overrides { style?, mood?, lighting?, lock:[extra lines], negative:[extra lines] } to FORK a template; '
  + '(3) a fully inline custom style { id, style, mood, lighting, lock:[...], negative:[...] } with no preset. '
  + 'Applying the SAME style to a scene’s cast clips and its plate is what makes the scene cohesive (the plate inherits the cast style by default).';

export async function getStyleVocabHandler(input) {
  const id = input && typeof input === 'object' ? input.id : undefined;
  if (id === undefined || id === null || id === '') {
    return {
      note: STYLE_AUTHOR_NOTE,
      presets: STYLE_PRESETS.map((p) => ({
        preset: p,
        name: STYLE_VOCAB[p].name,
        style: STYLE_VOCAB[p].style,
        dials: Object.keys(STYLE_VOCAB[p].dials),
      })),
      _telemetrySignal: { id_requested: false, found: true },
    };
  }
  if (typeof id !== 'string') throw new Error('`id` must be a style preset name (string)');
  if (!isStylePreset(id)) {
    // "unknown card" keeps the miss visible to the orientation cut
    // (DRAWER_MISS_ERROR_RE in mcpToolCalls.js).
    throw new Error(`get_style_vocab: unknown card '${id}'. Known: ${STYLE_PRESETS.join(', ')} (or author a custom style — see note).`);
  }
  const resolved = resolveStyle(id); // default dials
  return {
    preset: id,
    name: resolved.name,
    style: resolved.style,
    mood: resolved.mood,
    lighting: resolved.lighting,
    lock: resolved.lock,
    negative: resolved.negative,
    dials: STYLE_VOCAB[id].dials, // full dial spec (kinds, poles/values, defaults, bands/phrases)
    fork: STYLE_AUTHOR_NOTE,
    _telemetrySignal: { id_requested: true, found: true },
  };
}
