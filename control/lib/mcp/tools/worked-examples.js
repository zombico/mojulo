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

- \`bot\` — build → compile → deploy-ready zip → operate. The chatbot paradigm end to end.
- \`connected-service\` — declare inventory → bind a primitive → dry-run → seal. MCP-to-MCP with no chatbot.
- \`app\` — scaffold → commit → start → fulfill parked inference. The local-runner paradigm.
- \`game\` — mint a level world → watch the promotion gate refuse it → prove it completable → mint the game. The flagship verification-gate trace.
- \`creative-mint\` — stash → gather typed items (one rejection shown) → cook a publication.

Each trace is illustrative (your refs and values will differ) but the call sequence, gate order, and refusal shapes are real.`;

const TRACE_BOT = `# Worked example — Bot (build → compile → operate)

**The shape:** conversation → structured intent → protocol configs → compiled zip on disk → a running bot that phones home. Everything before \`save_modular_bot\` is *proposed* — config accumulating in this MCP connection's builder session; nothing exists on disk yet.

**1. Read the intent.**
\`infer_intent({ userMessage: "a bot for my pottery studio that answers questions from our class PDF and signs students up for workshops" })\`
→ \`{ flowType, confidence, capabilities: ['knowledge', 'formGathering'] }\`

**2. Protocols + identity.** *(still proposed — builder-session state only)*
\`recommend_protocols({ ... })\` → confirms \`knowledge\` + \`formGathering\` for the selected model (the recommendation CLAMPS to what the model reliably supports — a small Ollama model would have dropped formGathering here; that clamp is a refusal-shaped kindness, not a bug).
\`compose_identity({ ... })\` → \`{ botName: "Kiln & Quill", persona, starterPrompts }\`
\`generate_form_schema({ ... })\` → the workshop-signup fields.

**3. Documents for the knowledge protocol.**
\`upload_document_from_url({ url: "https://…/class-guide.pdf" })\` → \`{ documentId }\`
\`process_documents({ documentIds: [documentId] })\` → \`{ jobId }\` — **async**; poll it:
\`poll_job({ jobId })\` → \`{ status: 'done' }\` (~10–30s per doc).

**4. The refusal + recovery.** Calling \`save_modular_bot({})\` before the builder session has an identity fails with a validation error naming the missing pieces. Recovery: the builder session is readable — \`get_builder_session({})\` shows exactly what's set and what's missing; fill the gap and retry. (Starting over is \`start_new_bot({})\`, which discards the in-progress config.)

**5. Compile.** *(the materialization gate — this writes to disk)*
\`save_modular_bot({ ... })\` → \`{ jobId }\`; \`poll_job({ jobId })\` → \`{ status: 'done', result: { deploymentId, artifactPath } }\`
**\`artifactPath\` is the value to hand the user** — the absolute path to the zip. Unzipped + \`npm install && npm start\`, the bot phones home and its deployment row goes live.

**6. Operate.** *(read-once vs watched — these are reads, not bindings)*
\`list_deployments({})\` → the fleet. \`get_deployment({ id: deploymentId })\` → identity, form schema, protocol configs. Conversations stay IN the bot: \`query_conversations({ id })\` → summaries, \`get_conversation({ id, conversationId })\` → turns. The bot's \`.env\` → \`inspect_bot_env({ deploymentId })\`, never \`cat\`.

**7. The after-life.** "What can this bot do for me now?" → \`recommend_catalysts({ deploymentId })\` — the entry to turning captured signal into action. That's a new flight (see the \`connected-service\` trace for the deliberation half).`;

const TRACE_CONNECTED_SERVICE = `# Worked example — Connected Service (inventory → primitive binding → seal)

**The shape:** no chatbot. The operator wants "every Friday, digest this week's invoices folder into a summary doc." Mojulo is the deliberation anchor + audit trail; the runtime is the operator's own MCPs + your host.

**1. Declare what's installed.** *(present-state, replace-semantic — the latest declaration is the whole truth)*
\`meta_context_declare_inventory({ servers: [{ name: 'claude_ai_Google_Drive', tools: [{ name: 'search_files', inputSchema: {…} }, …] }] })\`
→ canonicalized provider rows (\`google_drive\`). Declare with per-tool \`inputSchema\` (richer-snapshot mode) — thin declarations downgrade every later binding to \`names_only\` confidence.

**2. Find the shape.** \`semantic_search({ query: 'recurring folder digest into a document', kinds: ['catalyst'] })\` → ranked refs; or go straight to the primitive if you know it.

**3. Bind the primitive.** *(session-scoped artifact — still proposed)*
\`bind_primitives({ primitive: 'document-store', role: 'source', server: 'google_drive', bindings: { 'list-documents': 'search_files', 'read-document': 'read_file_content' } })\`
→ \`{ artifact: { ref: 'prov_…', body, manifest } }\` — **read \`body\` in full**: it carries the operator's actual tool names + schemas, not a curated guess. \`manifest.unbound\` flags what you left unbound (often fine).

**4. The refusal + recovery.** Sealing first — \`meta_context_commit({ type: 'primitive_artifact_materialization', … })\` with an \`artifact\` that doesn't exist yet — fails adapter verification. The contextmap seals *reality, never intention*. Recovery: materialize first. Read your adapter once (\`get_adapter({})\`), synthesize the skill/workflow file on the host, THEN commit.

**5. Dry-run before promoting.** *(dry-run vs promoted — the standing rule)* Run the synthesized workflow once against one real week of files; read the output yourself. Only then schedule it.

**6. Seal.** *(the audit gate — append-only, say so plainly)*
\`meta_context_commit({ type: 'primitive_artifact_materialization', adapter_id: 'claude-code', artifact: 'skill:invoice-digest', composition_intent: '…', provider_artifact_refs: ['prov_…'] })\`
→ the artifact → bound-tools audit chain is now durable. Mirror the skill for observation: \`declare_skills({ skills: [{ name: 'invoice-digest', calls: ['google_drive'] }] })\`.

**7. Cadence (optional).** \`bind_trigger({ component_ref: 'trigger/scheduled@0.1.0', binding_params: { cron: '0 8 * * FRI' }, payload_template: {…}, artifact_ref: '…' })\` → persists durably, **fires only when the scheduler daemon is enabled** — say that to the operator (watched vs read-once).`;

const TRACE_APP = `# Worked example — App (scaffold → commit → start → fulfill)

**The shape:** a long-running local process with its own MCP sidecar, parking inference back on YOU. No per-app LLM key exists anywhere in this flight.

**1. Scaffold.** *(files on disk — materialized, not yet recorded)*
\`install_scaffold({ artifact_ref: 'app:receipt-watcher', app_name: 'receipt-watcher', materialization_ref: '…' })\`
→ \`{ scaffold_dir, env_path, bearer_generated: true }\` — the bearer is in the \`.env\` on disk, deliberately NOT in this tool output.

**2. The refusal + recovery.** Committing BEFORE scaffolding fails: \`meta_context_commit({ type: 'app_materialization', … })\` runs adapter verification that requires \`<locator>/app-mcp/server.js\` to exist. The commit gate is ordered on purpose — scaffold first, then seal. Recovery: step 1, then re-commit.

**3. Seal the materialization.** *(audit gate)*
\`meta_context_commit({ type: 'app_materialization', adapter_id: 'claude-code', artifact: 'app:receipt-watcher', app_name: 'receipt-watcher', bindings: { runner: 'local', durability: '…', inference: 'agent-tasks', mcp_self: '…' } })\`

**4. Start.** *(now it's running — a watched thing, not a read)*
\`start_app({ artifact_ref: 'app:receipt-watcher', app_name: 'receipt-watcher', materialization_ref: '…' })\`
→ \`{ running_ref, url, mcp_url }\` — app + sidecar spawned atomically; the app's MCP is auto-declared to inventory under this \`running_ref\`.
If this throws "runtime daemon not available": that's the daemon-down family, not a broken app — the host isn't up (\`MOJULO_DAEMONS=enabled\`). \`list_daemons({})\` / \`start_daemon({ name: 'app-runtime' })\`, then retry.

**5. Fulfill inference.** *(you ARE the inference layer)*
The app POSTs an envelope request; you drain the queue:
\`pull_agent_task({ wait_ms: 25000 })\` → \`{ task_id, kind: 'envelope_inference', payload }\` (single-claim)
…reason about \`payload\` yourself…
\`submit_envelope_inference({ task_id, envelope: {…} })\` → validated against the schema in the payload, resolves the app's parked HTTP, and records an \`app_inference\` principle. The canonical loop body is the \`run-inference-worker\` catalyst — \`get_catalyst({ id: 'run-inference-worker' })\` and wrap it in a loop.

**6. Lifecycle.** \`status_app({ running_ref })\` / \`stop_app({ running_ref })\` (idempotent; removes the running_ref's inventory rows). Per-app config: \`set_env({ artifact_ref: 'app:receipt-watcher', key: 'WATCH_DIR', value: '/Users/…/receipts' })\` then restart.`;

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
  bot: TRACE_BOT,
  'connected-service': TRACE_CONNECTED_SERVICE,
  app: TRACE_APP,
  game: TRACE_GAME,
  'creative-mint': TRACE_CREATIVE_MINT,
};

export const WORKED_EXAMPLE_PARADIGMS = Object.keys(TRACES);

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
  const trace = TRACES[paradigm];
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
      "Return one annotated end-to-end trace of a successful flight for a paradigm — the real call sequence with realistic args, abbreviated return shapes, the commitment gates named where they happen (proposed vs materialized, dry-run vs promoted, sealed vs not recorded), and one deliberate refusal + recovery so the first 'no' you meet in the wild is a recognized shape. Paradigms: `bot` (build → compile → operate), `connected-service` (inventory → primitive binding → seal), `app` (scaffold → commit → start → fulfill inference), `game` (the promotion-gate flagship: watch a level get refused, prove it completable, re-mint), `creative-mint` (stash → gather → cook). Omit `paradigm` for the index. Pull BEFORE your first build of a paradigm — one read replaces trial-and-error against per-tool descriptions. Traces are illustrative (refs and values will differ) but the call sequence, gate order, and refusal shapes are real. Read-only, idempotent.",
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
