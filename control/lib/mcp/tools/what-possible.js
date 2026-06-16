/**
 * MCP Ring 6 — sketch_what_possible.
 *
 * Scope: VISUAL ILLUSTRATION ONLY. Despite the name, this tool does not
 * brainstorm strategy, product direction, features, or any conceptual
 * "what could we do" question — it is the knob-resolution loop that
 * feeds `create_sketch` for scene/figure illustrations. Conceptual
 * ideation routes to `enter_research_mode` or `enter_plan_mode`.
 *
 * How it works (inverse-stable-diffusion retrieval loop): where stable
 * diffusion takes a vague prompt and hallucinates pixels, this tool runs
 * the inverse — the host agent calls it across turns with the user's
 * progressively-refined illustration intent, retrieves the methods
 * (family + knob + value records, source_kind='sketch_method') most
 * relevant to the current intent, and narrates them back to the user to
 * fill in underdetermined knobs. Once every knob is decided (chosen or
 * accepted-by-default), the agent composes them into a `create_sketch`
 * call — the renderer is deterministic given a complete spec.
 *
 * Each call is a thin wrapper over `EmbeddingsRepository.search` filtered
 * to source_kind='sketch_method', decorated with parsed family/knob/value
 * from each result's ref, grouped by knob for the agent's reading
 * convenience, and deduped against an `accumulated` list of already-
 * decided knobs (so the agent's context isn't polluted with methods it
 * has already committed to).
 *
 * Chart/infographic intents use `semantic_search({ kinds: ['sketch_vocab'] })`
 * instead — that rail carries the chart paradigms and the polygonizer's
 * render primitives.
 *
 * See lite-template/integration/0603/agent-mediated-routing-research.md
 * for the deliberation arc that landed here.
 */

import { registerTool } from '@/lib/mcp/server';
import { EmbeddingsRepository } from '@/lib/db/repositories/embeddings';
import { getSketchMethodCatalog } from '@/lib/graph/polygonizer/capabilities/loader';

function parseRef(ref) {
  // 'architecturalConstruction:family' OR 'architecturalConstruction:style:victorian'
  if (typeof ref !== 'string') return { family: null, knob: null, value: null };
  const parts = ref.split(':');
  if (parts.length === 2 && parts[1] === 'family') {
    return { family: parts[0], knob: null, value: null };
  }
  if (parts.length === 3) {
    return { family: parts[0], knob: parts[1], value: parts[2] };
  }
  return { family: parts[0] || ref, knob: null, value: null };
}

function isExcluded(ref, accumulated) {
  if (!Array.isArray(accumulated) || accumulated.length === 0) return false;
  const parsed = parseRef(ref);
  return accumulated.some(
    (a) =>
      a &&
      a.family === parsed.family &&
      (a.knob || null) === parsed.knob &&
      (a.value || null) === parsed.value,
  );
}

export async function whatPossibleHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('sketch_what_possible requires an input object');
  }
  const { intent, accumulated, limit } = input;
  if (typeof intent !== 'string' || intent.trim().length === 0) {
    throw new Error('intent is required (non-empty string)');
  }
  const effectiveLimit = Number.isInteger(limit) && limit >= 1 && limit <= 40 ? limit : 12;
  const catalog = getSketchMethodCatalog();

  // Pull a wider net than we'll return so dedup against `accumulated`
  // doesn't shrink the surface below the requested limit.
  const overscan = Math.min(50, Math.max(effectiveLimit * 2, 24));
  const raw = await EmbeddingsRepository.search(intent, {
    kinds: ['sketch_method'],
    limit: overscan,
  });

  const decorated = [];
  for (const r of raw) {
    if (isExcluded(r.source_ref, accumulated)) continue;
    const parsed = parseRef(r.source_ref);
    const method = catalog.get(r.source_ref) || null;
    decorated.push({
      ref: r.source_ref,
      family: parsed.family,
      knob: parsed.knob,
      value: parsed.value,
      isDefault: method ? method.isDefault : false,
      score: r.score,
      describe: method ? method.describe : r.snippet || '',
    });
    if (decorated.length >= effectiveLimit) break;
  }

  const families = decorated.filter((d) => d.knob === null);
  const byKnob = {};
  for (const d of decorated) {
    if (!d.knob) continue;
    if (!byKnob[d.knob]) byKnob[d.knob] = [];
    byKnob[d.knob].push(d);
  }

  // Hint surface: name the most-likely family (top family-root hit, falling
  // back to the family of the top knob result), enumerate the knobs that
  // surfaced this turn, and call out the family's catalog knobs that have
  // NOT surfaced (so the agent knows what to probe for next).
  const mostLikelyFamily =
    (families[0] && families[0].family) || (decorated[0] && decorated[0].family) || null;
  const knobsSurfaced = Object.keys(byKnob);

  let knobsDecided = [];
  if (Array.isArray(accumulated)) {
    knobsDecided = [...new Set(accumulated.map((a) => a && a.knob).filter(Boolean))];
  }

  let familyKnobs = [];
  if (mostLikelyFamily) {
    familyKnobs = [
      ...new Set(
        [...catalog.values()]
          .filter((m) => m.family === mostLikelyFamily && m.knob)
          .map((m) => m.knob),
      ),
    ];
  }
  const knobsUnderdetermined = familyKnobs.filter(
    (k) => !knobsSurfaced.includes(k) && !knobsDecided.includes(k),
  );

  return {
    intent,
    results: decorated,
    grouped: { families, byKnob },
    hint: {
      most_likely_family: mostLikelyFamily,
      family_knobs: familyKnobs,
      knobs_surfaced: knobsSurfaced,
      knobs_decided: knobsDecided,
      knobs_underdetermined: knobsUnderdetermined,
      ready_to_create_sketch:
        Boolean(mostLikelyFamily) &&
        familyKnobs.length > 0 &&
        knobsUnderdetermined.length === 0 &&
        knobsSurfaced.every((k) => knobsDecided.includes(k)),
      accumulated_count: Array.isArray(accumulated) ? accumulated.length : 0,
    },
  };
}

export function registerWhatPossibleTools() {
  registerTool({
    name: 'sketch_what_possible',
    description:
      "**Visual illustration tool ONLY.** This is the knob-resolution loop that feeds `create_sketch` for scene/figure illustrations (recipe families like `architecturalConstruction`, `portraitBust`). The name reads like open-ended ideation but it is NOT — it does not brainstorm strategy, product direction, possible features, or any conceptual 'what could we do' question. For those, use `enter_research_mode` (broad gathering) or `enter_plan_mode` (concretizing a direction) instead. How it works (when the intent IS visual): retrieve the *methods* (family + knob values) most relevant to the user's current illustration intent, narrate them back to the user one underdetermined knob at a time, accumulate their answers, and only call `create_sketch` once every knob is decided — the renderer is deterministic given a complete spec. Call each turn as the intent refines; pass already-decided knobs as `accumulated` so they're filtered out and don't re-pollute context. Read `hint.knobs_underdetermined` to know what to ask the user about next. When `hint.ready_to_create_sketch === true`, compose the accumulated knobs into a `create_sketch` call. Chart/infographic intents go through `semantic_search({ kinds: ['sketch_vocab'] })` and `get_sketch_vocab` instead. Returns `{ intent, results, grouped, hint }`. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description:
            "The user's current ask, phrased the way they phrased it. Vague is fine on turn 1 (\"a house\") — refines across turns as the conversation accumulates knob decisions. The embedding match runs against the methods' prose descriptions, so both natural framing (\"a quiet victorian on a foggy morning\") and structural framing (\"style victorian, roof mansard\") work.",
        },
        accumulated: {
          type: 'array',
          description:
            'Knobs the user has already decided in this conversation (or that earlier turns of this tool surfaced and the agent committed to). Pass on every call so they\'re filtered from the retrieval results and don\'t re-enter the agent\'s context. Each entry: `{ family, knob, value }`. The family-root record uses `knob: null, value: null`.',
          items: {
            type: 'object',
            properties: {
              family: { type: 'string' },
              knob: { type: ['string', 'null'] },
              value: { type: ['string', 'null'] },
            },
            required: ['family'],
          },
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 40,
          default: 12,
          description:
            'Maximum methods to return after dedup against `accumulated`. Default 12 — enough to cover a family + several knob candidates without flooding context.',
        },
      },
      required: ['intent'],
    },
    handler: whatPossibleHandler,
  });
}
