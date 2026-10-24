/**
 * MCP Ring 0 — worked examples (R2, orientation-ramp.plan.md).
 *
 * One annotated, hand-authored trace of a successful flight per paradigm:
 * the real call sequence with realistic args, abbreviated return shapes (the
 * fields the next call consumes), the commitment gates named in place, and
 * one deliberate refusal + recovery — so the first refusal an agent meets in
 * the wild is a recognized shape, not a dead end.
 *
 * Editing rules:
 * - Traces are ILLUSTRATIVE but must stay HONEST: every tool call is written
 *   as `tool_name({ ... })` (backticked, with parens). The honesty-gate test
 *   in worked-examples.test.js extracts exactly that shape and asserts each
 *   name resolves in the live registry — a trace may not rot into fiction
 *   when tools rename. Prose mentions without parens are not swept; use the
 *   paren form for anything that is a step in the flight.
 * - Return shapes are abbreviated to the fields the NEXT call consumes. Don't
 *   paste full payloads — the trace teaches the flow, not the schema (that's
 *   the tool description's job).
 * - Keep each trace in the ~600–900 token band. A trace that wants more is
 *   trying to become documentation; move the depth to the ring's own drawer.
 * - Token economics: this whole file is a drawer — zero context cost until
 *   pulled. Nothing here may leak into forward_context beyond its one-line
 *   directory row.
 */

import { registerTool } from '@/lib/mcp/server';

const EXAMPLE_INDEX = `# Worked examples — one successful flight per paradigm

Pass \`paradigm\` to read one annotated trace (real call sequence, gate moments marked, one refusal + recovery included):

- \`game\` — mint a level world → watch the promotion gate refuse it → prove it completable → mint the game. The flagship verification-gate trace.
- \`media\` — stash → gather typed items (one rejection shown) → cook a publication.

Each trace is illustrative (your refs and values will differ) but the call sequence, gate order, and refusal shapes are real.`;

const TRACE_GAME = `# Worked example — Game (the promotion-gate flagship)

**The shape:** a game = shell + typed store + levels that are worlds carrying a \`game:\` contract. The gate: **a level is refused until proven completable.** This trace deliberately walks into the refusal.

**1. Read the kit shelf first.** \`semantic_search({ query: 'dungeon loot carries between levels', kinds: ['game_kit'] })\` → \`dungeon-crawler\`. \`get_game_vocab({ id: 'kit-dungeon-crawler' })\` → ready store + level template + progression gates. Kits skip store design; this trace declares mechanics directly to show the gate.

**2. Mint a level as a world.** *(a sketch row — proposed as a level, not yet promoted)*
\`compose_world({ base: 'controllable', overrides: { …geometry… , game: { levelRef: 'crypt-1', mechanics: [{ kind: 'reach-exit', … }, { kind: 'hazard-damage', … }, { kind: 'fail-on-death' }] } } })\`
→ \`{ ref: 'sk_crypt1' }\` — the mechanics SYNTHESIZE the world behavior + store contract together (find the verbs via \`semantic_search({ kinds: ['game_mechanic'] })\`).

**3. Walk into the gate.**
\`create_game({ title: 'Crypt Run', store: { slices: [{ name: 'hero', kind: 'character' }, { name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'sk_crypt1' }] })\`
→ **REFUSED.** The level passed its contract dry-run but has no completability evidence. This is the promotion gate protecting the paradigm's guarantee: a shipped level that can't be beaten is a broken artifact, and mojulo won't mint one.

**4. Prove it.** *(the recovery — compile a run that reaches the win condition)*
\`forge_motion({ subject: { world_ref: 'sk_crypt1' }, shot: { motion: 'traversal', waypoints: [[12, 4], [22, 9], [30, 15]] } })\`
→ \`{ motion_ref: 'mo_…' }\` — each waypoint leg is COMPILED against the live walk rule; the final probe carries \`game.result: 'success'\`. If a leg reports \`{ stuck, atTick }\`, the level genuinely isn't completable from spawn — fix the geometry, not the audit. (For mechanic-declared levels, \`create_game({ auto_audit: true, … })\` compiles this proof itself.)

**5. Re-mint with evidence.** *(promotion — the level graduates)*
\`create_game({ title: 'Crypt Run', store: {…}, levels: [{ ref: 'sk_crypt1' }], audits: { 'sk_crypt1': { motion_ref: 'mo_…' } } })\`
→ \`{ ref: 'sk_cryptrun' }\` — playable at \`/sketches/<ref>\`. The shell renders the pre-level setup from each level's \`consumes\`, hosts it, applies its ONE outcome to the store; state carries between levels; **play data never enters mojulo**.

**6. What NOT to reach for:** \`allow_unaudited: true\` exists and is recorded per level — it's for prototyping, and the skip is sealed into the mint. Prefer the proof; it's one \`forge_motion\` call.`;

const TRACE_CREATIVE_MINT = `# Worked example — Creative mint (stash → gather → cook)

**The shape:** typed intake → one singular aim → a self-contained publication folder. The intake gate is strict on purpose; this trace walks into it once.

**1. Mint the corpus.**
\`mint_stash({ title: 'Q2 field notes' })\` → \`{ stash_ref: 'st_…' }\`
\`mint_drawer({ stash_ref: 'st_…', name: 'interviews' })\` — drawers map to chapters/sections in many kinds.

**2. Gather typed items — and hit the gate.**
\`gather({ stash_ref: 'st_…', type: 'markdown', body: '…' })\`
→ **REJECTED**: a \`markdown\` item requires \`body_md\`, not \`body\`. Nothing was stored — the intake gate protects the per-type contract because cook slices *cite* items; a corrupt atom poisons every downstream outcome. Recovery is mechanical:
\`gather({ stash_ref: 'st_…', type: 'markdown', body_md: '…', drawer: 'interviews', title: 'Grower interview #1' })\` → \`{ item_id }\`
Add a visual: \`create_sketch({ title: 'Yield by plot', manifest: { marks: […] } })\` → \`{ ref: 'sk_…' }\`, then
\`gather({ stash_ref: 'st_…', type: 'sketch', metadata: { sketch_ref: 'sk_…', label: 'Yield chart' } })\` — resolved live, so later sketch edits propagate into the cook.

**3. Pick the kind.** \`recommend_kind({ stash_ref: 'st_…' })\` → ranked publication kinds (rules-based, no LLM — a picture_book wants ≥1 sketch, a pamphlet peaks at exactly 4 markdown items). Unsure between two? \`forge_publications({ … })\` cooks 2–4 candidates at once and the operator picks the winner.

**4. Cook — ONE aim.** *(the binding vow: one aim per cook; two outcomes = two cooks)*
\`cook({ slices: [{ stash_ref: 'st_…' }], aim: 'What did Q2 teach us about drought-tolerant plots?', publication: { kind: 'field_guide' } })\`
→ \`{ cook_ref, outcome_url, outcome_dir }\` — a self-contained folder at \`/outcomes/<cook_ref>/\`. **You author \`report_md\`** — there is no server-side LLM; the slices are recombinator material for YOUR writing.

**5. Afterlife.** The cook is a first-class deliberation node: \`get_cook({ cook_ref })\` from any ring; if it later reads as tractable work, plan mode seeds from it (\`forge_plan({ source: { kind: 'cook', cook_ref } })\`) — a plan-side decision, not a cook outlet. Housekeeping: \`archive_cook({ cook_ref })\` clears the inbox without touching the folder.`;

const TRACES = {
  game: TRACE_GAME,
  media: TRACE_CREATIVE_MINT,
};

export const WORKED_EXAMPLE_PARADIGMS = Object.keys(TRACES);
const RETIRED_TRACES = ['connected-service', 'app'];

// Exported for the honesty-gate test: every `tool_name(...)` mention across
// all traces must resolve in the live registry.
export const ALL_TRACE_TEXT = [EXAMPLE_INDEX, ...Object.values(TRACES)].join('\n');

export async function workedExampleHandler(input, _ctx) {
  const paradigm = typeof input?.paradigm === 'string' ? input.paradigm.trim() : '';
  if (!paradigm) {
    return {
      content: [{ type: 'text', text: EXAMPLE_INDEX }],
      _telemetrySignal: { id_requested: false, found: true },
    };
  }
  // The connected-service and app traces left with the office wing in 3.1.0; say so.
  if (RETIRED_TRACES.includes(paradigm)) {
    return {
      content: [{ type: 'text', text: `No worked example for '${paradigm}' in this version: the office wing (apps, connected services) left the tool surface in 3.1.0. Available: ${WORKED_EXAMPLE_PARADIGMS.join(', ')}.` }],
      _telemetrySignal: { id_requested: true, found: false },
    };
  }
  // 'creative-mint' was the pre-1.0 name for the media paradigm's trace —
  // accepted as an alias so older prompts/plans keep resolving.
  const trace = TRACES[paradigm === 'creative-mint' ? 'media' : paradigm];
  if (!trace) {
    return {
      content: [
        {
          type: 'text',
          text: `No worked example for '${paradigm}'. Available: ${WORKED_EXAMPLE_PARADIGMS.join(
            ', ',
          )}. next: re-call with one of those, or omit \`paradigm\` for the index.`,
        },
      ],
      _telemetrySignal: { id_requested: true, found: false },
    };
  }
  return {
    content: [{ type: 'text', text: trace }],
    _telemetrySignal: { id_requested: true, found: true },
  };
}

export function registerWorkedExampleTools() {
  registerTool({
    name: 'get_worked_example',
    description:
      "Return one annotated end-to-end trace of a successful flight for a paradigm — the real call sequence with realistic args, abbreviated return shapes, the commitment gates named where they happen (proposed vs made, dry-run vs promoted, machine gate vs eyes gate), and one deliberate refusal + recovery so the first 'no' you meet in the wild is a recognized shape. Paradigms: `game` (the promotion-gate flagship: watch a level get refused, prove it completable, re-mint), `media` (stash → gather → cook). Omit `paradigm` for the index. Pull BEFORE your first build of a paradigm — one read replaces trial-and-error against per-tool descriptions. Traces are illustrative (refs and values will differ) but the call sequence, gate order, and refusal shapes are real. Read-only, idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        paradigm: {
          type: 'string',
          enum: WORKED_EXAMPLE_PARADIGMS,
          description: 'Which flight to read. Omit for the index of available traces.',
        },
      },
    },
    handler: workedExampleHandler,
  });
}
