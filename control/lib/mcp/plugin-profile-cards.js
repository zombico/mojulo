/**
 * The kept vocab cards and catalysts the Claude plugin profile serves with lines left out.
 *
 * The profile (./plugin-profile.js) does not serve the cards and catalysts that exist to drive an
 * image, mesh or voice generator (PLUGIN_PROFILE_HIDDEN_ROWS). The cards it keeps still point at
 * those loops here and there: a painted skin seam, a dreamed reference, a hidden catalyst, the keyed
 * prompt door. This table leaves those lines out, per source kind, card id and field. Every reader
 * of a card applies it (get_sketch_vocab, get_solid_vocab, get_catalyst, list_catalysts) and so does
 * semantic_search, whose snippets are recomposed from the edited card, so no surface serves the
 * unedited text.
 *
 * Only under the profile: outside it profiledCard returns the card it was given, so every other
 * distribution reads the source unchanged. An edit whose `from` stops matching is recorded by
 * profileEdit and fails plugin-profile.test.js.
 */

import { pluginProfileActive, profileEdit } from './plugin-profile.js';

// Per source kind → card id → field → ordered [from, to] edits. `parameters` (catalysts) maps a
// parameter name to the edits on its description.
export const PROFILE_CARD_EDITS = Object.freeze({
  sketch_vocab: {
    // The manuals of the painted kinds are not served; this one loses the line that sends a
    // picture to an image generator.
    'panel-depiction-recipes': {
      when: [['; for an AI-PAINTED comic or manga page use the sequential-art kind instead', '']],
      body: [[/ When the user wants an AI-painted comic or\nmanga page[\s\S]*?for the external image worker\./, '']],
    },
    'wardrobe-construction': {
      summary: [['on a create_figure / character-sheet body', 'on a create_figure body']],
      when: [[' or character-sheet,', ','], [' reconstruct a dreamed outfit as a garment spec,', '']],
      body: [
        ['each a closed vocabulary an LLM can\nemit *from looking at a dreamed character*. A garment', 'each a closed vocabulary an LLM can\nemit. A garment'],
        ['Feed it to `create_figure.garment` or a\ncharacter-sheet `outfit.garment`.', 'Feed it to `create_figure.garment`.'],
        [
          "The image model's native construction register is CUT-AND-SEW panels, not ring\nwireframes — so target this vocabulary directly when reading a dream. A garment",
          'The construction register is CUT-AND-SEW panels, not ring\nwireframes. A garment',
        ],
        ['Prefer the cut/panel forms when a\n  dream shows clear seams.', 'Prefer the cut/panel forms when a\n  reference shows clear seams.'],
        ['### The creatability gate (dreaming a NEW drape)', '### The creatability gate (a NEW drape)'],
        ["When a dream shows a cape whose fold pattern isn't a preset", "When a reference shows a cape whose fold pattern isn't a preset"],
        ['reproduces the dreamed folds:', 'reproduces the folds:'],
        [
          'no freehand\ngeometry from a dream. The garment spec is the sovereign recipe; a painted sheet\nor skin is a bound derived render. Slim-vs-baggy',
          'no freehand\ngeometry. The garment spec is the sovereign recipe. Slim-vs-baggy',
        ],
        ['reaches the dreamed folds (and the waves are the recipe)', 'reaches the folds (and the waves are the recipe)'],
        ['from a drawing, a\nbook, or a dream read as pieces', 'from a drawing or a\nbook'],
      ],
    },
    // The mech method's last step is a painted skin bake through the skin op.
    'mobile-suit': {
      summary: [[', then a skin bake for the finished-prop layer', '']],
      body: [
        ['machine from lathe-turned segments, then bake a prop skin over it. Full method', 'machine from lathe-turned segments. Full method'],
        [/## Step 6 — Skin bake \(coequal, not garnish\)\n[\s\S]*?\n\n(?=## )/, ''],
        [
          'Pairs with [[compositional-balance]] for mass-check and [[image-outcome]] for the\nskin-bake camera set. Function-first',
          'Pairs with [[compositional-balance]] for mass-check. Function-first',
        ],
      ],
    },
    'mobile-worker': {
      body: [
        ['(silhouette, palette taxonomy,\nskin bake)', '(silhouette, palette taxonomy)'],
        [
          'family. Assembled workers take the polygomer skin seam (`get_skin_packet` →\npaint decals/wear flat over the scaffold → `skin_polygomer`) — hazard stripes\nand unit markings without touching the geometry recipe.',
          'family.',
        ],
      ],
    },
    'reploid': {
      body: [[
        '\n- **Skin seam:** the assembled unit takes the polygomer skin seam\n  (`get_skin_packet` → paint → `skin_polygomer`) for decals and finish;\n  single-view limitation applies (front/¾ strong, side/back weak).',
        '',
      ]],
    },
    'figure-fluff': {
      body: [[
        '\n- The dream loop (`reconstruct-from-dream` catalyst) — a dreamed stylized\n  character in a simple register decomposes DIRECTLY into this vocabulary; this\n  is the figure-register build target.',
        '',
      ]],
    },
    'veh-engine': {
      body: [[' The dream loop supplies shape reference;\nthe BOM audit only needs', ' The BOM audit only needs']],
    },
    // A motion comic is kept; its painted pages, its trick card and the painted animation kinds are not.
    'motion-comic': {
      body: [
        ['the box; the sequential-art page is where panels come from', 'the box; the comic page is where panels come from'],
        [
          '= jump-cut reframe. The full trick protocol (approach,\n        //     recede, quick-cut beat, impact frame, expression swap,\n        //     held flurry, …) is the `motion-comic-tricks` card.',
          '= jump-cut reframe.',
        ],
        [
          "composites them ABOVE the art — the image worker NEVER\n        //     letters; placement and treatment are the composer's job.",
          "composites them ABOVE the art; placement and treatment\n        //     are the composer's job.",
        ],
        [
          'one panel out of a sequential-art page (scaffold crop when unbound,\n  final.png crop when painted) — gate-checked',
          'one panel out of a comic page — gate-checked',
        ],
        [' (the nēmu look is a legitimate fidelity — a worker-less page\n  still plays);', ';'],
        ["resolves a sequential-art page's", "resolves the page's"],
        [
          ' — nothing textual is ever asked of the image worker, so\n  worker renders can never misspell, drift, or bake in lettering that a\n  re-time would have to repaint.',
          '.',
        ],
        ['- a PRINTED comic page / book → kind `sequential-art`, published via `cook`.\n', ''],
        ['\n- animated CHARACTERS (blinks, lip flaps, staged clips) → `keyframe-animation`\n  / `scene-motion` — a motion comic moves the READER, not the drawing.', ''],
      ],
    },
  },
  solid_vocab: {
    // The painted skin seam and the character-from-dream attestation (both refused under the profile).
    'figure': {
      body: [
        ['  dream_audit?: { source, invoked_generator, prompt, <generation id> }\n', ''],
        ["['tank', {…dreamPants}, 'jacketCut']", "['tank', {…pants}, 'jacketCut']"],
        ["Skin seam: the figure's filled control scaffold can be painted and bound so the figure then WEARS the paint deterministically at its `/skin.png`.\n\n", ''],
        [/\n- `dream_audit` — character-from-dream PROVENANCE[^\n]*/, ''],
      ],
    },
    // No keyed prompt door, and no skin step between the scaffold and the .glb.
    'manji-tree': {
      summary: [['Four authoring doors (via): ir / parts / prompt / packet.', 'Three authoring doors (via): ir / parts / packet.']],
      body: [
        ['serves a rendered SVG, and — once skinned — a turnable 3D model / `.glb`.', 'serves a rendered SVG and a turnable 3D model / `.glb`.'],
        ['There are FOUR authoring doors', 'There are THREE authoring doors'],
        ['the render/skin/export path downstream', 'the render/export path downstream'],
        ['`detail` (dial 1–4; use 2 before skinning)', '`detail` (dial 1–4)'],
        ['then hand the scaffold to the skin → export path for a turnable `.glb`.', 'then export it for a turnable `.glb`.'],
        [/### via: 'prompt'\n[\s\S]*?(?=### via: 'packet')/, ''],
        ["It is the same polygonizer discipline as `'prompt'`, handed to you as data.", "It is the polygonizer's own discipline, handed to you as data."],
        ['then follow the returned `next` hint through the skin → export path to a turnable `.glb`.', 'then follow the returned `next` hint to a turnable `.glb`.'],
      ],
    },
    'layered': {
      body: [['; the\n`creature-from-plan` catalyst carries the spec forms a worker fills; the `create-hero`', '; the `create-hero`']],
    },
    // outcomeRef reads an image-outcome sketch's bound render: a painted kind.
    'workbench': {
      body: [
        ['`{ source: { svg | dataUrl | sketchRef | outcomeRef }, band?: { tFrom, tTo }, seam?: number }`', '`{ source: { svg | dataUrl | sketchRef }, band?: { tFrom, tTo }, seam?: number }`'],
        [" `outcomeRef` uses an image-outcome sketch's latest bound render PNG as the skin. PNG sources (dataUrl PNG / outcomeRef) also export", ' A dataUrl PNG source also exports'],
        ['`{ source: { svg | dataUrl | sketchRef | outcomeRef }, seam?, repeat?, lit? }`', '`{ source: { svg | dataUrl | sketchRef }, seam?, repeat?, lit? }`'],
      ],
    },
    'code': {
      body: [['ledger line, skin seam, assembler part slot', 'ledger line, assembler part slot']],
    },
  },
  catalyst: {
    'create-hero': {
      parameters: {
        intent: [[' a creature or invented body is creature-from-plan,', ''], [' is the figure kind (character-from-dream).', ' is the figure kind.']],
      },
      body: [
        ['A creature is `creature-from-plan`; a real species', 'A real species'],
        [' is the figure kind (`character-from-dream`).', ' is the figure kind.'],
      ],
    },
  },
});

/** True under the profile when `id` of `sourceKind` has edits. */
export function hasProfileCardEdits(sourceKind, id, env = process.env) {
  return Boolean(PROFILE_CARD_EDITS[sourceKind]?.[id]) && pluginProfileActive(env);
}

/**
 * A card or catalyst as the profile serves it: a shallow copy with its edited fields, or the same
 * object outside the profile and for a card with no edits. Fields a row does not carry are skipped.
 */
export function profiledCard(sourceKind, card, env = process.env) {
  const edits = card && hasProfileCardEdits(sourceKind, card.id, env) ? PROFILE_CARD_EDITS[sourceKind][card.id] : null;
  if (!edits) return card;
  const out = { ...card };
  for (const [field, list] of Object.entries(edits)) {
    if (field === 'parameters') {
      if (!Array.isArray(out.parameters)) continue;
      out.parameters = out.parameters.map((p) => (list[p?.name] && typeof p.description === 'string'
        ? { ...p, description: profileEdit(p.description, list[p.name], `${sourceKind}.${card.id}.parameters.${p.name}`) }
        : p));
    } else if (typeof out[field] === 'string') {
      out[field] = profileEdit(out[field], list, `${sourceKind}.${card.id}.${field}`);
      // A sectioned solid card is served as its base (solid-vocab/loader.js splitSections): its body edits land
      // there too. They must target lines the base keeps; scad-ladder.test.js / workbench-ladder.test.js check that.
      if (field === 'body' && typeof out.base === 'string') {
        out.base = profileEdit(out.base, list, `${sourceKind}.${card.id}.base`);
      }
    }
  }
  return out;
}
