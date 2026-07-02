/**
 * MCP Ring 0 — orientation.
 *
 * The connecting model's first impression of mojulo is just the initialize
 * preamble in [server.js], which is deliberately short. Everything heavier —
 * the concept glossary, the capability model, the deploy/connect lifecycle,
 * the per-tool one-liners — lives here, behind the `forward_context` tool,
 * so the agent only pays the context cost when the user actually asks about
 * mojulo or seems disoriented about which tools to pick.
 *
 * Editing rules:
 * - Index, not glossary. `forward_context` is a routing index: it maps a user
 *   request onto an entry tool and points at drawers for depth. The concept
 *   glossary lives behind `get_register_kit` — don't reintroduce it here. The
 *   agent routes from the outer layers (the `initialize` preamble + the per-tool
 *   descriptions in tools/list + this index) and pulls a drawer on demand.
 * - The routing index and tool index have to stay in sync with the actual tool
 *   registrations across build.js, jobs-tools.js, operate.js, fleet.js,
 *   catalysts.js, adapters.js, meta-context.js, mcp-inventory.js, skills.js,
 *   mcp-capabilities.js, mcp-orbit.js, mcp-primitive-binding.js,
 *   mcp-trigger-binding.js, semantic-search.js, agent-tasks.js, runner.js,
 *   runtime-daemons.js, agent-ui.js, plan-mode.js, research-mode.js,
 *   stash-mode.js, cook.js, sketches.js, what-possible.js, manji-trees.js,
 *   figure.js, carved-solid.js, solid-turntable-tool.js, scene-city.js,
 *   scene-transport-hub.js, visual-reference.js, motion.js,
 *   painted-landscape.js, operations-mode.js, and this file. If you add or
 *   remove a tool, update the relevant rows here (and `get_tool_index`).
 */

import { registerTool, PROTOCOL_VERSION, SERVER_NAME, getServerVersion } from '@/lib/mcp/server';
import {
  getControlPlaneVersion,
  getControlPlanePackageName,
  getBotImagePin,
  parseImageRef,
  isSourceClone,
} from '@/lib/version/local';
import { fetchLatestNpmVersion, fetchLatestGhcrTag, compareSemver } from '@/lib/version/remote';
import { MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import {
  VOCABULARY_REGISTERS,
  PROCEDURAL_DISCLOSURES,
  DEFAULT_VOCABULARY_REGISTER,
  DEFAULT_PROCEDURAL_DISCLOSURE,
} from '@/lib/mcp/tools/meta-context';

// ---------------------------------------------------------------------------
// forward_context — the routing index
//
// A thin map, not a manual: a lean opener, the routing index (user framing →
// entry tool), a drawer directory (where to go deeper), the commitment-level
// floor + the active procedural-disclosure directive, and two standing safety
// one-liners. The heavy prose drawerizes:
//   - concept glossary           → get_register_kit (active vocabulary_register)
//   - substrate / PLAYful Cloud  → get_substrate
//   - full one-line-per-tool idx → get_tool_index
//   - Ring 6 structural model    → get_deliberation_overview
//   - dashboard page map         → get_ui_map
// The body is register-INVARIANT except the disclosure directive (axis 2 =
// procedural_disclosure) — an index is agent-facing routing and needs no
// register voice. The communication-settings notice still reports the active
// vocabulary_register so the agent knows which get_register_kit cell to expect.
//
// See lite-template/integration/FORWARD_CONTEXT_INDEX_PLAN.md (supersedes the
// "everything at orientation" stance of FORWARD_CONTEXT_REFRAME_PLAN.md) and
// REGISTER_TUNING_PLAN.md for the disclosure/register machinery that remains.
// ---------------------------------------------------------------------------

const HEADER = '# Mojulo, oriented';

// Communication settings notice — tells the agent which register/disclosure
// cells are active for this session. Generated per call from operator anchor
// + per-call override.
function communicationSettingsNotice({ register, disclosure, source }) {
  const sourceNote =
    source === 'override'
      ? 'set via this call'
      : source === 'operator_anchor'
        ? 'read from the operator anchor'
        : 'defaults — no operator anchor and no per-call override';
  return `*Active communication settings: \`vocabulary_register: ${register}\`, \`procedural_disclosure: ${disclosure}\` (${sourceNote}). \`procedural_disclosure\` shapes how you narrate state gates (the disclosure directive below); \`vocabulary_register\` shapes the concept glossary's user-facing phrasing — that glossary lives in \`get_register_kit\`, pull it when you need to define a term. Concept names and tool descriptions are invariant.*`;
}

// --- Lean opener (register-invariant) ---
//
// One paragraph. What mojulo is + a pointer into the routing index. The three
// creatable artifacts and their entry tools were already named in the
// `initialize` preamble; we don't re-enumerate them, we route them below.

const LEAN_OPENER = `Mojulo is a control plane for solutions composed over the operator's installed MCPs (CRM, calendar, drive, ticketing, warehouse). Its tool calls mutate mojulo's own SQLite + graph state and supervise processes, so what you build keeps running after the chat ends. The \`initialize\` preamble already named the three creatable artifacts (Bot / Connected Service / App) and their entry tools — this is the **routing index** that maps a request onto the right entry point, plus a directory of drawers to pull when a task needs depth. Recognize the path from the user's framing, reach for the entry tool, and read a drawer only when you need it. When unsure whether the work needs a conversational surface, ask — that answer routes the session.`;

// --- PLAYful Cloud (drawerized behind get_substrate) ---
//
// Substrate positioning. Names what mojulo IS at the layer below the
// paradigms: PLAY = Persistent, Local, Agent-Yoked, on a cloud-shape
// substrate that borrows verbs that travel and drops the ones that don't.
// Decision-shaping, not marketing — each property ties to which tools the
// agent reaches for and which posture the agent takes. 

const PLAYFUL_CLOUD = `## PLAYful Cloud — what mojulo is at the substrate

The substrate has a name: **PLAYful Cloud.** "Cloud" because mojulo borrows cloud's *verbs that travel*; "PLAYful" because **apps play with each other** through typed bindings and a shared audit chain. **PLAY = Persistent, Local, Agent-Yoked.** These three properties name what mojulo *is*, not just what it does.

- **Persistent.** Bindings keep running while the operator sleeps. Triggers fire on cadence; the agent-tasks queue drains; the contextmap records motion as alternating \`trigger_firing → app_inference\` principles on artifact nodes — that alternation IS the operational signature of apps playing with each other. When the operator asks for "always-on" / "scheduled" / "daily" / "every N", reach for trigger bindings + the agent-tasks pull loop, not a one-shot.
- **Local.** Cloud-shaped substrate on the operator's host (or a single-operator remote host — the wire shape is location-invariant). Same MCP-over-HTTP composition discipline regardless of where mojulo runs. "Local" in technique names (e.g. \`local-storage\`) refers to **mojulo's host**, not the operator's laptop. The locality law's zero point is the operator+agent, not the substrate.
- **Agent-Yoked.** You (the connecting agent) are the grip in the middle of the staff; the operator swings intent through you. Not subordinate, not autonomous — *yoked*, coupling with shared direction. For App-paradigm inference, you ARE the fulfiller (\`pull_agent_task\` → \`submit_envelope_inference\`); mojulo holds no LLM credentials on the inference path. Don't try to make mojulo autonomous of you; serve the operator's intent against the substrate.

**Cloud is borrowed as mental-model practice, not physics.** Verbs that travel and are claimed: *composition*, *always-on*, *typed surfaces*, *audit trail*, *vendor-interchangeable-behind-a-shape*. Verbs that don't and are deliberately not claimed: *auto-scaling*, *multi-region*, *multi-tenancy*, *IAM*, *per-call billing*. When users compare mojulo to cloud primitives, acknowledge the shape parallel, name which verbs travel, and don't oversell physics mojulo doesn't have. The local-cloud oxymoron is acknowledged, not hidden — "real cloud" is one wire-hop away when that's what the operator actually needs.

**The substrate is a tri-staff — three sections of one continuous surface:**
- *Substrate primitives* — typed runtime bindings via \`bind_primitives\` (\`local-storage\` ships today; \`http-api\` and \`local-sql\` pending). The operator-self-serviceable slice of ops.
- *Catalyst-anchored generation* — workflow and technique catalysts in the library, surfaced via \`recommend_catalysts\` / \`get_catalyst\`. The operator-self-serviceable slice of architecture.
- *App builder assistant* — you, composing the operator's intent against the substrate. The operator-self-serviceable slice of dev.

When the operator's ask is shaped "bind a folder / database / API" → primitives. "Do this kind of workflow" → catalyst. "Help me build a thing that does X" → assistant slice; you compose. The operator's role is to swing intent through the middle; the ends do the cutting.

**Honest naming.** Substrate parts are Node.js, sqlite, MCP, and a small set of trigger bindings duct-taping them together. The framing isn't a layer over the parts — it names what the parts are doing together. If the operator asks "what is this really?", answer plainly: commodity tools composed by typed bindings and an audit trail, on the operator's host, with the agent as the grip.

**Mapping shapes when asked.** Bot ~ a persistent service; Skill ~ a function; App ~ a local worker with an inverted inference fabric (closest cloud analog: Temporal's durable execution + parked steps). Acknowledge the parallel, name which verbs travel, and don't oversell physics mojulo doesn't have — "real cloud" is one wire-hop away when that's what the operator actually needs.
`;

// --- Standing safety rules (compressed one-liners) ---
//
// The full secrets body (deny-rule JSON, AES-GCM rationale) and the full
// verification body used to live inline; they're compressed here to two
// load-bearing one-liners. The secrets rule is also stated in the `initialize`
// preamble and the `inspect_bot_env` description; the verification discipline
// is restated by each host adapter's dry-run step.

const SAFETY_ONELINERS = `## Standing safety rules

- **Secrets.** A compiled bot's \`.env\` holds account-grade secrets (the bot's \`MOJULO_API_KEY\` + the operator's pasted LLM key). Never \`cat\` or \`Read\` a \`.env\` under \`$MOJULO_HOME\` or inside an unzipped bot — use \`inspect_bot_env\`, which masks sensitive values.
- **Synthesize ≠ certify.** Every artifact mojulo emits is LLM output and inherits LLM failure modes (hallucinated field names, optimistic mappings). Before any artifact graduates from one-shot to recurring / fleet-wide: dry-run on one *real* input → inspect the result by reading → only then promote. Re-validate even a workflow you've run before — schema drift invalidates prior passes silently.`;

// --- Standing rule: floor (shared) + disclosure directive (axis 2) ---
//
// The floor — the four-gate distinction — is load-bearing at every register
// cell and must stay legible regardless of how the agent narrates around it.
// The disclosure directive that follows says HOW MUCH the agent narrates
// (terse / reflective / pedagogical); the floor still applies inside whichever
// disclosure variant is active.

const STANDING_RULE_FLOOR = `## Commitment-level vocabulary (standing rule)

Whatever register and disclosure cell you've been set to, these distinctions must stay legible — they track real state, and the user needs them to course-correct at each gate:

- *proposed* vs *materialized* → candidate workflow under consideration vs workflow now wired up and running
- *dry-run* vs *promoted* → trial pass against one real input vs live, recurring
- *watched* vs *read-once* → ongoing observation going forward vs read right now
- *recorded in the audit trail* vs *not recorded* → when you write to contextmap, say so plainly so the user knows the decision is sealed and durable

Blur these and the user loses visibility into what's been committed versus what's still a suggestion. In \`plain\` register the right-hand-side phrasing is what the user hears; in \`mojulo\` register either side works. The distinction itself is preserved at every register.`;

const DISCLOSURE_TERSE = `**Procedural disclosure: terse.** Act and report — one-line summary at the end. Do not narrate intermediate state unless the user asks. The four gates above still apply; when you cross one, name the gate in one short clause ("done, sealed in the audit trail" / "dry-run looks clean — going live now") and move on. Don't elaborate on what the gate means in the absence of a user question.`;

const DISCLOSURE_REFLECTIVE = `**Procedural disclosure: reflective.** Name the gate before each commit step. Say "still a suggestion" / "now wired up" / "trial pass" / "live, recurring" / "sealed in the audit trail" explicitly so the user can always point at the current state without having to ask. Don't lecture on what each gate *means* — naming it is enough at this disclosure level.`;

const DISCLOSURE_PEDAGOGICAL = `**Procedural disclosure: pedagogical.** Before each gate, explain what crossing it means and why it matters. Reference the *proposed vs materialized* distinction explicitly: "right now this is a candidate — nothing's wired up yet"; "now I'm sealing it as materialized, which means a real artifact lives on disk and the decision lands in the audit trail." Teach the model as you go — the user is building their mental model of mojulo through your narration, and crossing a gate without naming its meaning leaves them less able to course-correct next time.`;

const DISCLOSURE_DIRECTIVE_VARIANTS = {
  terse: DISCLOSURE_TERSE,
  reflective: DISCLOSURE_REFLECTIVE,
  pedagogical: DISCLOSURE_PEDAGOGICAL,
};

// --- Concept glossary variants (axis 1: vocabulary_register) ---
//
// Concept *names* are invariant across variants — the agent uses them to call
// tools, and the names are part of mojulo's wire surface. Only the prose
// around the names branches.

const GLOSSARY_MIXED = `## Concepts

- **Bot** — a deployed chatbot service. Runs as its own process (local Docker container or Fly.io app). Owns its own SQLite database; **every conversation and submission lives there and never leaves**.
- **Deployment** — the control plane's row for a bot: id, name, status, URL, enabled capabilities, last_seen_at. The deployment ≠ the bot itself — it's the metadata that lets the control plane locate and describe the bot.
- **Protocol** — a capability a bot can have turned on. Five of them ship today:
  - \`knowledge\` — answers questions from documents the user uploads (in-process RAG; no external embedding API calls at runtime).
  - \`formGathering\` — collects structured fields conversationally and writes a submission row.
  - \`appointments\` — books slots against a configured schedule.
  - \`triage\` — routes a conversation to a specialist bot via a federated handoff (the audit chain extends across bots).
  - \`opticalRead\` — extracts data from photos / screenshots (vision-capable models only).
- **Chain** — every bot turn is hash-linked to the previous one, so the transcript is tamper-evident. \`verify_chain\` walks the chain for any conversation.
- **App** — a local long-running process the control plane spawns on the operator's machine, paired with its own MCP sidecar. Runner-managed (one shipping runner: \`local\`). Parks inference back on the operator's agent via the agent-tasks queue — no per-app LLM credentials, no inference on the deployed runtime. Distinct from a Bot (chat-shaped, deployed) and a Skill (one-shot, synthesized into the host adapter). Lifecycle: \`install_scaffold\` → \`meta_context_commit({type:'app_materialization'})\` → \`start_app\`.
- **Running ref** — the runner's handle for a currently-running app instance. Issued by \`start_app\`; used by \`status_app\` / \`stop_app\` to address one specific running instance. Distinct from the artifact ref (the app's durable identity in the contextmap) — a single artifact can be started and stopped many times, each getting a new running ref. App MCP inventory rows FK to it via \`running_ref\` so \`stop_app\` knows which inventory entries to remove.
- **Agent-tasks queue** — in-memory FIFO single-claim queue where running apps park inference requests for the operator's agent to fulfill. The app POSTs to \`/api/app-inference/envelope\`; the parked promise resolves when an agent calls \`submit_envelope_inference\`. One task kind ships today (\`envelope_inference\`); the substrate generalizes. Parked promises reject with \`INFERENCE_PARKED_LOST\` on control-plane restart.
- **Skill** — a workflow synthesized into the user's host adapter as a runnable artifact (a \`SKILL.md\` under \`.claude/skills/\`, a Codex automation, a generic \`workflow.md\` + runner script). Composed from a catalyst body + the user's installed MCPs + (optionally) a deployed bot's captured signal. The host-neutral catalyst is the recipe; the host adapter is the bridge that materializes it on the user's substrate.
- **Catalyst** — a host-neutral workflow recipe shipped with mojulo. Two kinds: **workflow catalysts** (the original; combine with bot signal + destination MCP + host adapter to materialize a Skill) and **technique catalysts** (bind a runtime substrate to an artifact — e.g. \`local-storage\` binds a filesystem folder as a document-store primitive). Read one with \`get_catalyst\`; the catalyst is a starting point — adapt freely, or skip it and synthesize from scratch. *See the texture preview below.*
- **Host adapter** — bridge between a host-neutral catalyst recipe and the host-specific runnable artifact (Skill). Three ship today: \`claude-code\` (materializes as a skill under \`.claude/skills/\`, scheduled via \`/schedule\`), \`codex\` (materializes as a Codex automation via \`automation_update\`, or a workspace workflow file), and \`generic\` (materializes as \`workflow.md\` + runner script for any other agent). The adapter is auto-resolved from your client's \`clientInfo.name\` on first connect — pass an explicit \`host\` parameter to \`get_catalyst\` to override. Read your adapter once via \`get_adapter\` before synthesizing.`;

const GLOSSARY_PLAIN = `## Concepts

*Everything in this section is for your cognitive grounding — these are the nouns you use to call mojulo's tools. **Don't surface the bold terms to the user**; the parenthesized phrasing is what to say in their place.*

- **Bot** *(to the user: "the chatbot" or "the bot you deployed")* — a deployed chatbot service; own process, own SQLite database. Conversation and submission data lives in the bot's database and never leaves it.
- **Deployment** *(to the user: just "the bot," or "the bot's record")* — mojulo's row for a bot (id, name, status, URL, last seen). Metadata only — not the bot itself.
- **Protocol** *(to the user: "capability," or name the specific thing — "answer questions from documents," "collect form fields," "book appointments," "hand off to another bot," "read from photos")* — a capability a bot can have turned on. Five ship today:
  - \`knowledge\` *("answer from documents")* — answers questions from documents the user uploads (in-process; no external API calls at runtime).
  - \`formGathering\` *("collect form data")* — collects structured fields conversationally and writes a submission row.
  - \`appointments\` *("book appointments")* — books slots against a configured schedule.
  - \`triage\` *("hand off to another bot")* — routes a conversation to a specialist bot (the audit trail extends across bots).
  - \`opticalRead\` *("read from photos")* — extracts data from photos / screenshots (vision-capable models only).
- **Chain** *(to the user: "the audit trail" or "the tamper-evident record")* — every bot turn is hash-linked to the previous one, so the transcript is tamper-evident. Use \`verify_chain\` to walk it.
- **App** *(to the user: "a tool that runs on your computer" or "a local app")* — a process mojulo spawns on the user's machine with its own little MCP. Does work in the background; when it needs you (the agent) to do some thinking, it parks the question on a queue and you pick it up. Different from a chatbot (which is deployed somewhere customers can reach) and from an automation (which is one workflow your Claude Code runs on demand).
- **Running ref** *(to the user: just "the running app" or "the live instance")* — the handle for a running app, issued each time it starts. Different from the app's permanent record — same app, multiple starts, different running refs each time. You use it to stop the right instance or check its status.
- **Agent-tasks queue** *(to the user: "where the app asks for the agent's help" — or don't surface; just say "the app needs me to do some thinking")* — when an app on the user's machine needs you (the agent) to reason about something, it leaves the question on a queue. You pick it up, answer, the app continues. No separate LLM credentials needed because you're the inference.
- **Skill** *(to the user: "an automation" or "a workflow you can run again")* — a workflow built from a recipe and saved into the user's Claude Code (or Codex, or as a generic workflow file) so they can run it again later. The recipe (catalyst) plus the tools they've connected = the saved automation.
- **Catalyst** *(to the user: "workflow recipe" or "an automation")* — a workflow recipe shipped with mojulo. Read one with \`get_catalyst\`, combine it with what the bot has captured + a tool the user has connected (their CRM, Drive, calendar) → an automation that turns captured signal into action. Adapt freely; the recipe is a starting point.
- **Host adapter** *(to the user: "how the automation gets built for your setup" — or name the specific form: "as a Claude Code skill," "as a Codex automation," "as a workflow file")* — bridge from the host-neutral recipe to the host-specific runnable artifact. Three ship today: \`claude-code\`, \`codex\`, \`generic\`. Auto-resolved from your client; read your adapter once via \`get_adapter\` before building anything from a catalyst.`;

const GLOSSARY_MOJULO = `## Concepts

- **Bot** — deployed chatbot service; own process, own SQLite. Conversation data never leaves the bot.
- **Deployment** — control-plane row: id, botName, status, url, lastSeenAt, configHash. Metadata only.
- **Protocol** — stackable bot capability composed into \`instructions.txt\`. Five ship: \`knowledge\`, \`formGathering\`, \`appointments\`, \`triage\`, \`opticalRead\`. Toggled via \`enabledProtocols\`; gated per provider/model in \`getAllowedProtocolsForModel\`.
- **Chain** — \`content_hash\` + \`chain_hash\` per turn; \`verify_chain\` walks; federated handoffs extend the chain across bots via tip-of-chain on the URL.
- **App** — local process; runner-managed; own MCP sidecar; inference parked on agent-tasks queue. \`kind='artifact'\` row in \`meta_nodes\` with \`payload.app.{name, bindings}\`. Four bindings: \`runner\` / \`durability\` / \`inference\` / \`mcp_self\`. Materialized via \`meta_context_commit({type:'app_materialization'})\` after \`install_scaffold\`; lifecycled by \`start_app\` / \`stop_app\`.
- **Running ref** — runner handle for a live app instance. FK from \`meta_mcp_inventory.running_ref\`; distinct from \`meta_nodes.ref\` (durable artifact identity). Issued by \`start_app\`; consumed by \`status_app\` / \`stop_app\`.
- **Agent-tasks queue** — in-memory FIFO single-claim. Parked HTTPs reject on restart with \`INFERENCE_PARKED_LOST\`. Kinds: \`envelope_inference\` (today). Tools: \`pull_agent_task\` / \`submit_envelope_inference\` / \`cancel_agent_task\`.
- **Skill** — host-adapter-materialized runnable artifact synthesized from a catalyst body + bound destination MCP(s) + (optionally) bot signal. \`claude-code\` → SKILL.md; \`codex\` → automation; \`generic\` → workflow.md.
- **Catalyst** — host-neutral workflow recipe in \`control/lib/mcp/catalysts/\`. Two kinds: \`workflow\` (combined with bot shape + destination MCP + host adapter → Skill via \`meta_context_commit({type:'artifact_materialization'})\` or \`primitive_artifact_materialization\`) and \`technique\` (binds runtime substrate to artifact — \`local-storage\` ships).
- **Host adapter** — catalyst → runnable bridge. \`claude-code\` (skill under \`.claude/skills/\`), \`codex\` (automation_update or workspace workflow), \`generic\` (workflow.md + runner). Auto-resolved from \`clientInfo.name\`; \`get_adapter\` for the full body.`;

const CONCEPT_GLOSSARY_VARIANTS = {
  plain: GLOSSARY_PLAIN,
  mixed: GLOSSARY_MIXED,
  mojulo: GLOSSARY_MOJULO,
};

// --- Catalyst texture preview (shared) ---

// --- Tool index (shared, ring-organized) ---
//
// Tool descriptions are agent-facing and stay in mojulo idiom regardless of
// the operator's vocabulary_register — the agent uses them to disambiguate
// which tool to call. Register branching applies to user-facing prose only.

const TOOL_INDEX = `## Tool index (one line each)

### Orientation
- \`forward_context\` — the routing index: a lean opener, user-framing → entry-tool rows, a drawer directory, and the standing safety + commitment rules. Call FIRST when unsure what mojulo is or which tool fits. A thin map, not a manual — depth lives in the drawers below.
- \`get_tool_index\` — (you are reading its output) the full one-line-per-tool index across every ring. Call when \`forward_context\`'s routing index isn't specific enough.
- \`get_register_kit\` — the concept glossary (Bot, Deployment, Protocol, Chain, Catalyst, App, …) in the operator's active \`vocabulary_register\`, plus the active disclosure directive and the invariant commitment-level floor. **This is where the vocabulary lives** — pull it to define a term or phrase something for the user. Optional per-call \`register\` / \`disclosure\` override.
- \`get_deliberation_overview\` — the why-it's-structured-this-way explainer for the Ring 6 deliberation surfaces plus the daemon runtime-gating posture. Call only when doing structural / non-bot work.
- \`get_ui_map\` — the page-by-page map of the \`mojulo-ui\` dashboard (one line per page + when to point the user there). Call when the user wants to look / browse / click and you need to name the right page.
- \`get_substrate\` — the PLAYful Cloud substrate positioning (Persistent · Local · Agent-Yoked) and the cloud-verbs-that-travel framing. Call when the user compares mojulo to cloud primitives (Lambda / Cloud Run / Temporal) or asks "what is this really?".
- \`version\` — runtime versions: server, MCP protocol, Node, platform, pinned bot image tag, offline-build flag, MOJULO_HOME. Use to diagnose version mismatches.
- \`check_for_updates\` — compare the running control-plane package (\`mojulo\` on npm) and the pinned bot image (\`ghcr.io/zombico/mojulo-bot\`) against their latest published versions. Returns \`{ controlPlane, botImage, warnings }\` with current, latest, \`updateAvailable\`, and a one-line install hint per surface. Read-only; never performs the upgrade. Call when the user asks "am I up to date?" or after a long gap between sessions.
- \`list_adapters\` — list host adapters mojulo ships (\`claude-code\`, \`codex\`, \`generic\`). An adapter tells you how to materialize a catalyst on your specific substrate. Read once per session before synthesizing from any catalyst.
- \`get_adapter\` — full body of one adapter: artifact target, parameter collection, tool discovery, dry-run as a concrete first step, scheduling, state, output reporting, secrets posture. Pass \`id\` explicitly or let the server resolve from clientInfo.

### Build, synchronous
- \`infer_intent\` — read a free-text description of what the user wants and produce a structured intent the rest of the build tools can act on.
- \`recommend_protocols\` — given the intent, suggest which protocols to enable (clamped to what the selected model can reliably support).
- \`compose_identity\` — generate the bot's name, persona, and starter prompts.
- \`generate_form_schema\` — produce the form-field schema for \`formGathering\`.
- \`generate_appointment_config\` — produce booking config for \`appointments\`.
- \`generate_triage_config\` — produce routing config for \`triage\`.
- \`generate_optical_read_config\` — produce extraction config for \`opticalRead\`.
- \`set_suggested_prompts\` — overwrite the starter prompts shown in the bot UI.
- \`generate_bot_summary\` — produce the one-line summary stored on the deployment.
- \`get_builder_session\` — read the in-progress bot config for this MCP connection.
- \`start_new_bot\` — discard the in-progress config and start fresh in this MCP connection.

### Build, documents and artifact compilation
- \`upload_document_from_url\` — **sync**, ~1–5s. Upload a PDF / DOCX / TXT / MD / HTML the bot should learn from. Accepts a URL, base64, or pre-extracted text. → returns \`{ documentId, originalName, mimeType, sizeBytes, message }\`. Pass \`documentId\` into \`process_documents\`.
- \`process_documents\` — **async**, returns \`{ jobId }\`. ~10–30s **per document** (parse + chunk + embed + per-doc LLM summary). Many or large docs can run minutes. Makes documents available to the \`knowledge\` protocol.
- \`save_modular_bot\` — **async**, returns \`{ jobId }\`. ~10–60s in prebuilt-image mode (compose cartridges + write config + zip); longer when the control plane is in offline-build mode (\`MOJULO_OFFLINE_BUILD=1\` bundles full bot source). Compiles the configured bot into a zip on disk. Polled result: \`{ deploymentId, status, botName, artifactPath, buildError, ... }\`. \`artifactPath\` is the absolute path to the zip — that's the value to surface to the user.
- \`poll_job\` — **sync**. Check the status of any async job. → returns \`{ jobId, tool, status: "pending" | "running" | "done" | "error", progress, result, error }\`. Reasonable polling cadence is every 2–5s.

### Operate (fleet)

Aggregates and metadata only. For conversation content, use \`get_conversation\` against a specific bot — \`fleet_query_conversations\` exists to *locate which bot* a conversation lives on; it does not return turn content. All fleet tools return a consistent \`unreachable: [{ botId, botName, reason }]\` field so you can tell at a glance whether the answer reflects the whole fleet.

- \`fleet_analytics_summary\` — fleet-wide totals + daily breakdown + top bots + protocol mix + per-bot breakdown. → returns \`{ totals, daily, heatmap, topBots, protocolMix, perBot, unreachable, cache }\`. Hits a 60s in-process cache; check \`cache.fromCache\` before answering "is this current?". Warm ~1–3s, cold up to ~30s.
- \`fleet_query_conversations\` — locate conversations across every connected bot. → returns \`{ conversations: [{ botId, botName, conversationId, startedAt, lastActivity, turnCount }], pagination, fleet, unreachable }\`. **Pair with \`get_conversation(id, conversationId)\` for content** — that's the second step of the fleet-locate → per-bot-read pattern.
- \`verify_fleet_chains\` — walk the tamper-evident hash chain across every reachable bot. → returns \`{ valid, totalTurns, invalidTurns, conversationsVerified, failed, perBot, fleet, unreachable }\`. \`valid: true\` requires zero invalid turns **AND** zero unreachable bots — a dark bot can't be audited. This is the one fleet operation that's uniquely agent-shaped; humans won't manually audit chains.

### Operate (read what deployed bots have captured)
- \`list_deployments\` — list bots known to the control plane. → returns \`{ total, limit, offset, deployments: [{ id, botName, status, url, lastSeenAt, configHash, lastBuiltHash, ragMode, embeddingChunkCount, cloud, createdAt, updatedAt }] }\`. No transcript data.
- \`get_deployment\` — full row for one bot. → returns the list-shape fields above, **plus** \`config\` (the bot's identity, suggested prompts, enabled protocols, generated form/appointment/triage/optical-read configs — credentials redacted), \`botSummary\`, \`documentIds\`. **The identity prompt, form schema, and per-protocol configs all live under \`config\`** — this is the tool to call when a catalyst says "read the bot's identity" or "read the form schema."
- \`inspect_bot_env\` — read the bot's container \`.env\` with sensitive values masked. → returns \`{ path, vars: [{ key, value, masked, valueLength? }], maskedCount, note }\`. **Use this instead of \`cat .env\`** — see the Secrets handling standing rule above. Takes \`deploymentId\` (resolves under \`$MOJULO_HOME\`) or an explicit \`path\` if the user unzipped elsewhere.
- \`query_conversations\` — conversation summaries on a connected bot (proxied — conversation data lives in the bot's SQLite, not here). → returns \`{ botName, total, conversations: [{ conversationId, startedAt, lastActivity, turnCount }] }\`. No turn content; call \`get_conversation\` or \`export_conversations\` for that.
- \`get_conversation\` — full turn list for one conversation. → returns \`{ conversationId, turnCount, turns, verification }\`. Turn fields: \`id, conversationId, turn, timestamp, userPrompt, llmResponse, machineState, ragContext, contentHash, chainHash, eventType, handoffHash\`.
- \`export_conversations\` — bulk export full conversations and turns. → returns \`{ botName, conversations: [{ conversationId, startedAt, lastActivity, turnCount, turns }] }\`. Same turn shape as \`get_conversation\`.
- \`query_submissions\` — list form-gathering submissions. → returns \`{ botName, submissions: [{ id, conversationId, formData, metadata, schemaFingerprint, isComplete, submittedAt, webhookStatus, webhookError }], count, total }\`. \`formData\` is an object keyed by form-field id — call \`get_deployment\` to read the field schema you'll be mapping from.
- \`verify_chain\` — walk the tamper-evident hash chain for one conversation. → returns the bot's verification result (valid / invalid + per-turn details). See \`docs/turn-hashing.md\` for chain semantics.

### Designing a new protocol

- \`custom_protocol\` — author's guide for designing a new mojulo protocol (a new bot capability that fires inside a conversation). Returns posture-check rules, the mental model (stackable cartridges + composed response template), the intent-loop-first validation discipline, and the touch-point map. Call this when the user says they want to **extend what their bot does during a turn** — recognize a new intent class, collect a new shape of structured data, render a new UI affordance via the envelope, read a new modality. Do NOT call this for after-the-conversation work (CRM sync, digests, audits) — that's catalyst-shaped; route to \`recommend_catalysts\` / \`custom_catalyst\` instead. The guide explicitly disambiguates protocol vs. catalyst vs. skill; the most common misfire is calling it when the user actually wants a catalyst.

### Catalysts (consult on outcomes; turn captured signal into action)

Mojulo is a **consultation surface**, not a strict executor. When the user asks what to do with a deployed bot, you should be ready to suggest workflows even when they require an integration the user doesn't yet have installed — framed as opt-in upgrades, never as blockers.

- \`recommend_catalysts\` — given a \`deploymentId\` (single-bot mode) OR \`scope: 'fleet'\` / \`deploymentIds: [...]\` (fleet mode), return catalysts whose shape matches the bot(s), each annotated with a \`valueHook\` (one-sentence user-outcome), \`destinationCategory\` (kind of MCP needed), and \`destinationExamples\` (named MCPs that satisfy it). Single-bot mode adds \`missingProtocols\`; fleet mode adds \`applicableDeployments: [{ id, botName }]\` plus \`crossBot: true\` when a catalyst spans ≥2 bots — those are the cross-bot patterns fleet aggregation unlocks (e.g., "weekly digest of qualified leads across every intake bot into one CRM"). Response includes a \`consultationPosture\` block with framing rules — read it. **This is the entry point for "what can I do with this bot?" or "what can I do across all my bots?"** Cross-reference \`destinationExamples\` against MCPs available in this session: examples installed → "you can do this now"; examples not installed → soft suggestion.
- \`list_catalysts\` — flat catalog of every shipped recipe, filterable by category. Use when the user wants to browse what mojulo offers in general, or when no specific bot is in scope.
- \`get_catalyst\` — read one recipe's full body. The response composes three parts: a host-neutral catalyst-core preamble (posture, vocabulary, safety defaults), the bound **host adapter** body (artifact target, scheduling, dry-run encoding, secrets), and the catalyst's host-neutral recipe (mapping intent, idempotency, pitfalls). Pass \`host\` to override the auto-resolved adapter.
- \`custom_catalyst\` — author's guide for **contributing a new catalyst back to the mojulo library**. Use when the user wants to propose / write / contribute a catalyst (not when they want to automate something just for themselves — that's a local skill, synthesized from \`get_catalyst\` or from intent directly).

### Deliberation (Ring 6 — the substrate for structural reasoning: contextmap, inventory, capabilities, composer, primitive + trigger binding, semantic recall)

Mojulo separates *what fired* (a conversation, an automation run — outcome-rate, never written here) from *why it was bound this way* (a catalyst materialized through a host adapter into an artifact — deliberation-rate, append-only). It also separates both of those from *what materials the operator has available right now* (their installed MCPs — present-state, replaceable). And it separates *what gets composed from those materials* (mcp-orbit workflows — recommendation + composition log, replaceable in-flight, sealed at materialization). \`meta_context\` is the writeable, durable layer for the why; \`meta_context_declare_inventory\` records the present-state MCP environment via introspection; \`record_mcp_capabilities\` records vendor knowledge via primary-source research. Both write into provider rows on a shared identity layer (one logical "Gmail" in mojulo regardless of which path arrived at it), and the composer reads both as one consolidated picture. Rare-call by design — expect 0–3 contextmap calls per session; declare inventory once at session start (and again only if the environment changes); research a vendor when the agent's first encounter with a provider warrants it; the composer fires whenever the user wants a non-bot workflow, not on a lifecycle cadence.

- \`meta_context_brief\` — read the contextmap subgraph + principles for a scope (\`{ kind: 'fleet' }\` for the whole graph, or \`{ kind: 'bot' | 'catalyst' | 'adapter' | 'artifact', ref: '<id>' }\` for a 1-hop neighborhood). Call when wondering *"has the fleet already committed to something related to what I'm about to do?"* or when the user asks "why does bot-3 route field X to tool Y?" / "why is this a Codex automation and not a skill?" — the \`materialized_by\` and \`binds\` edges carry principles that record the reasoning. The fleet brief response also includes \`inventory\` (the operator's currently declared MCP environment, see \`meta_context_declare_inventory\` below) plus \`meta: { empty, suggest_kyc, capped }\` hints. An empty fleet brief with no operator anchor → surface the KYC. Do NOT call for routine orientation (that's \`forward_context\`), operational metrics (\`fleet_*\`), or content questions (\`operate.*\`).
- \`meta_context_commit\` — seal a structural decision. **Six event types ship:** (1) \`operator_kyc\` — optional one-time bootstrap (role + primary_goal + locked-in constraints) that anchors future suggestions; subsequent commits need \`revise: true\` to attach a new principle. (2) \`operator_workspace_setup\` — append-only flat principles on the operator node recording \`workspace_root\` (absolute path) and optional \`workspace_conventions\`. Required for technique catalysts (e.g. \`local-storage\`) that bind a filesystem sub-path. Rejects relative paths and \`..\` segments. (3) \`artifact_materialization\` — atomic per-materialization seal for a Skill: which catalyst was materialized into which artifact via which host adapter for which bot, plus bindings and reasoning principles. (4) \`primitive_artifact_materialization\` — sibling for runtime-introspected primitive-binding artifacts (no bot in the picture); records the artifact → bound MCP tools audit chain with per-binding payloads. (5) \`app_materialization\` — atomic seal for an App: adapter_id + artifact + app_name + the four bindings (\`runner\` / \`durability\` / \`inference\` / \`mcp_self\`). Verification additionally requires the scaffolded \`<locator>/app-mcp/server.js\` to exist — call \`install_scaffold\` FIRST. Adapter-delegated verification runs BEFORE the write (claude-code/generic → existsSync; codex accepts opaque locators on assertion). (6) \`trigger_artifact_materialization\` — atomic seal for an activation binding. Resolves a \`trigger_ref\` returned by \`bind_trigger\` and attaches an audit principle to the target artifact node summarizing the binding (component_ref, binding_params, payload_template). Phase 1 requires the trigger to carry an \`artifact_ref\`; composition-only triggers are deferred. **Call ONLY AFTER materializing the artifact** — never to declare an intention. If commit fails, roll back via the host adapter's own affordance (delete file / cancel automation / \`stop_app\` then remove the scaffold dir / \`unbind_trigger\` to disable an orphan binding).
- \`meta_context_declare_inventory\` — **the entry point for using mojulo without deploying a chatbot.** Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot). This primitive activates the other axis: MCP-orchestrated workflows synthesized over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. **Call this first** when the user wants outcomes that don't need a conversational layer — operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations — or asks to use mojulo without bots. Also call at session start if your environment has changed since the last declaration. REPLACE semantics — mojulo can't introspect your client, so the latest declaration is authoritative and previously declared tools not in the new call are wiped. Each declared server is canonicalized (e.g. \`claude_ai_Gmail\` → \`gmail\`) and upserts a row on the providers identity layer; the snapshot rides on \`meta_context_brief({kind:'fleet'})\`.
- \`declare_skills\` — **mirror the host adapter's skills into mojulo as Connected Services** (sibling to \`meta_context_declare_inventory\`, same replace-semantic posture, for the \`skill\` member rather than the MCP environment). A Skill is a workflow synthesized into your host (e.g. \`.claude/skills/<name>/SKILL.md\`); the host owns it, mojulo only reflects it for observation — it never writes to your host. Call after synthesizing/changing a skill (e.g. after \`get_catalyst\` materializes one) or at session start if your skill set changed. Declare the MCP servers each skill \`calls\` (resolved against declared inventory so the viewer marks wired vs missing) and any unbound capability \`needs\`. REPLACE semantics — the latest declaration is the whole mirror; skills not in the call are dropped (you are the trust anchor, mojulo can't introspect the host). The \`skill\` form plus the materialized mcp-orbit form make up the Connected Services paradigm.
- \`record_mcp_capabilities\` / \`get_mcp_capabilities\` — **the research facet** of a provider, sibling to inventory's introspection facet. \`record_mcp_capabilities\` writes a vendor knowledge body (frontmatter + prose + cited URLs) for one canonical \`provider_ref\`; supersedes any prior current row in one transaction, preserving full history (\`asOf\` walks the chain). \`get_mcp_capabilities\` reads the current row (or a historical one via \`asOf\`). The agent-side methodology lives in the \`research-mcp-vendor\` catalyst — fetch via \`get_catalyst('research-mcp-vendor')\` for source-discipline, triangulation rules, and the canonical body shape. Mojulo ships four seeded vendor bodies on first install (gmail, notion, linear, google_drive) honestly attributed via \`source_urls[0]=mojulo://CHANGELOG#v0.5.0\`; the catalyst refreshes them when drift bites, and the composer's warning tags (\`seed_capabilities\` / \`no_capabilities_recorded\`) tell the agent when to run it.
- \`recommend_mcp_orbit_compositions\` / \`get_meta_catalyst\` / \`list_mcp_orbit_components\` / \`get_mcp_orbit_component\` — **the mcp-orbit composer** reads providers + capabilities + inventory through a consolidated view, enumerating every MCP mojulo knows about (whichever path put it there). Five composer states per chosen provider — \`research\` (both facets, agent-researched body), \`seed\` (both facets, build-time seed body), \`inventory_only\` (installed but no body recorded), \`capabilities_only\` (body recorded but not installed), \`none\` (defensive). Each non-\`research\` state surfaces as a constraint warning tagged with the provider_ref so the agent can route remediation: \`seed_capabilities:<ref>\` and \`no_capabilities_recorded:<ref>\` point at the research catalyst; \`not_installed:<ref>\` points at \`meta_context_declare_inventory\`. The five typed component kinds (\`mcp\` × \`trigger\` × \`pattern\` × \`idempotency\` × \`render\`) still describe the composition shape; non-mcp kinds ship through the component loader, the \`mcp\` kind is served from the providers identity layer. The flow is fixed: \`recommend_mcp_orbit_compositions\` (logs candidates as audit-able \`proposed\` rows; surfaces \`rationale.catalystHint\` when any chosen provider isn't research-grade) → \`get_meta_catalyst\` (composition rulebook, read once per session) → \`get_mcp_orbit_component\` per chosen ref → assemble + dry-run + \`meta_context_commit\`.
- \`semantic_search\` — **fuzzy recall over durable mojulo state** (principles, capability bodies, mcp-orbit components / compositions / provider artifacts, declared MCP inventory tools, shipped catalysts, and sketch vocabulary cards). Use when you have an intent or topic but not a specific ref — \`meta_context_brief\` and the other Ring 6 readers answer "give me the full row at this ref"; \`semantic_search\` answers "which refs are relevant to this intent at all?" Returns ranked \`{ source_kind, source_ref, score, snippet }\` rows; snippets cap at ~280 chars and the agent is expected to pair this with the typed structured readers to pull full bodies for any row worth the context cost. Optional \`kinds\` filter restricts to one or more of \`principle | mcp_tool | mcp_capability | orbit_component | orbit_composition | orbit_artifact | catalyst | sketch_vocab | sketch_method | manji_program | painted_landscape\`. Capability rows that have been superseded never appear — the index quietly filters against the current row per provider. Backed by an in-process embedding model; first call after a control-plane restart pays ~2–4s of model load, subsequent calls are sub-50ms at expected corpus size. Read-only.
- \`bind_primitives\` — **the primitive-binding composer for MCP-to-MCP workflows.** Given a vendor-agnostic primitive (\`document-store\`, \`structured-record-store\`, \`messaging-channel\`, \`message-thread\`, ...), a composition role (\`source\` | \`destination\`), and a server from declared inventory, runs a deterministic generator that fills a role-specific template with the **actual bound tool names + schemas from the operator's installed MCP**. Returns a session-scoped provider artifact (\`prov_<id>\`) + structured binding manifest (which affordances mapped to which tools, with confidence labels). Use when inventory was declared in "richer-snapshot mode" (per-tool \`inputSchema\` + \`introspectionConfidence\`); thin inventory declarations downgrade to \`names_only\` confidence with no schemas in the generated artifact. The bound provider artifacts then graduate via \`meta_context_commit({type:'primitive_artifact_materialization', adapter_id, artifact, composition_intent, provider_artifact_refs:[...]})\` — recording the audit chain (artifact → bound MCP tools, with per-binding payloads) without requiring a bot or catalyst. This is the runtime-introspected composer mojulo recommends for MCP-to-MCP workflows — the generated artifact reflects the operator's actual installed MCP rather than a curated guess. The vendor-shaped \`recommend_mcp_orbit_compositions\` flow remains as a seed-reasoning surface for first-encounter scaffolding when the agent lacks confident tool-schema knowledge.
- \`bind_trigger\` / \`unbind_trigger\` / \`list_triggers\` / \`get_trigger\` — **composer-anchored activation binding** (sibling to \`bind_primitives\`, same shape for the \`trigger\` axis). \`bind_trigger\` takes a typed \`component_ref\` from the composer (Phase 1 ships \`trigger/scheduled@0.1.0\`; webhook + watch components may exist in \`mcp-orbit-components/trigger/\` but their runtimes are deferred to later phases), \`binding_params\` validated against the component (cron parsed via croner upfront so invalid expressions reject at bind time, not at first fire), a \`payload_template\` parked into the agent-tasks queue at fire time with flat-key substitution (\`{{fired_at}}\` / \`{{fired_at_date}}\` / \`{{scheduled_at}}\` / \`{{fired_at_unix}}\`), and an \`artifact_ref\` to a materialized contextmap node (Phase 1 requirement). Returns \`{ trigger_ref, component_ref, artifact_ref, principle_id, next_fire_at }\`. Persists in \`mcp_orbit_trigger_artifacts\`; graduates via \`meta_context_commit({type:'trigger_artifact_materialization', trigger_ref})\`. The scheduler daemon fires registered triggers when the runtime host is up (\`mojulo-daemons\` with \`MOJULO_DAEMONS=enabled\`, per-daemon gate \`MOJULO_TRIGGER_RUNTIME=enabled\`); without that, bind calls still succeed and the binding rows stay durable but nothing fires until a later boot enables the runtime. Each fire writes a \`trigger_firing\` principle on the target artifact node — walking the principles yields a \`trigger_firing → app_inference → trigger_firing → app_inference\` chain telling the full story of each autonomous run. Same composer-anchored discipline as \`bind_primitives\` — adding a new trigger kind means shipping a typed component + its runtime daemon; the bind tool needs no per-kind code branch.

### Ring 7 — Apps (local runner + agent-tasks queue)

The app paradigm: local long-running processes the control plane spawns on the operator's machine, paired with their own MCP sidecar, parking inference back on the operator's agent via an in-process queue. **No per-app LLM credentials, no inference on the deployed runtime.** Distinct from a Bot (chat-shaped, deployed to Fly/Docker) and a Connected Service (one-shot Skill synthesized into the host adapter, or a materialized mcp-orbit composition). Call after recognizing an app-shaped ask — the Quick orientation rules in \`forward_context\` list the trigger phrases; the dashboard's \`/graph\` page renders the App composition map.

The shipping path: \`install_scaffold\` (lay down the starter files) → \`meta_context_commit({type:'app_materialization'})\` (record the app with its four bindings) → \`start_app\` (spawn the process + sidecar atomically). Once running, the app POSTs inference requests to \`/api/app-inference/envelope\`, the agent pulls them via \`pull_agent_task\`, and submits responses via \`submit_envelope_inference\`. The canonical pull → dispatch → submit loop body is the \`run-inference-worker\` catalyst — call \`get_catalyst('run-inference-worker')\` and wrap it in \`/loop\` for continuous fulfillment, or set \`MOJULO_AGENT_RUNTIME=claude-code-headless\` for an in-process Node fulfiller that spawns one-shot \`claude --print\` subprocesses.

#### Runner — app lifecycle
- \`install_scaffold\` — write the \`app-mcp/server.js\` template + bearer-bearing \`.env\` into an artifact directory. Returns \`{ scaffold_dir, env_path, bearer_generated, reused }\`. Call BEFORE \`meta_context_commit({type:'app_materialization'})\` — the commit's adapter verification requires the scaffold to exist. Bearer NOT returned (it's in the .env on disk; read via \`list_env\` if needed).
- \`start_app\` — spawn the app + its sidecar atomically (10s startup timeout); parse URLs from stdout (\`APP_URL=...\` and either \`APP_MCP_URL=...\` or Vite's "Local: ..."); auto-declare the app's MCP to inventory under \`server_kind='app'\` with a \`running_ref\` FK. Requires the app-runtime daemon (\`mojulo-daemons\` or standalone \`mojulo-app-runtime\`). Returns \`{ running_ref, url, mcp_url, inventory_tools_registered }\`. Bearer intentionally NOT returned in tool output to avoid surfacing a secret in agent transcripts.
- \`stop_app\` — kill both processes by \`running_ref\`; remove inventory entries tied to that running_ref (FK delete); drop in-memory runner state. Idempotent — stopping an unknown running_ref returns a no-op result.
- \`status_app\` — read the runner's current state for one running_ref: \`{ status, url, mcp_url, artifact_ref, started_at }\`. \`status\` ∈ \`'running' | 'crashed' | 'stopped' | 'unknown'\`. \`unknown\` means the runtime daemon has no record (or is down).
- \`list_running\` — list all running_refs known to the runtime daemon: \`[{ running_ref, artifact_ref, status, url, mcp_url, started_at }]\`. When the daemon is down, the list is empty.
- \`list_runners\` — list available runner implementations (one ships: \`local\`). Forward-compatible affordance for Fly / Docker / Vercel substitutes that may land later; not pluggable yet.

#### Runner — per-app env management
- \`list_env\` / \`set_env\` / \`delete_env\` — read/write the artifact's \`.env\` file. Comments and blank lines preserved on round-trip. Use \`set_env\` to inject operator-set values the app reads at startup (API keys for services the app calls, runtime config). The bearer is written once at scaffold-time by \`install_scaffold\`; **don't rotate it through these tools** unless you also restart the app and re-declare the MCP inventory entry. \`list_env\` returns values clear (no masking) — this is a writer's surface, not a reader's. For bot \`.env\` files use \`inspect_bot_env\` instead, which masks.

#### Runtime daemons — host lifecycle
- \`list_daemons\` — list runtime daemons managed by the unified host: \`[{ name, status, detail? }]\`.
- \`status_daemon\` — read one daemon's status (e.g. \`scheduler\`, \`app-runtime\`).
- \`start_daemon\` / \`stop_daemon\` / \`restart_daemon\` — lifecycle the daemon host's services. The host must be running (\`mojulo-daemons\` with \`MOJULO_DAEMONS=enabled\`).

#### Agent-tasks queue
- \`pull_agent_task\` — long-poll for parked inference tasks from running apps. Optional \`wait_ms\` (default 0 = return immediately if empty) and \`kinds\` filter (one shipping kind: \`envelope_inference\`). Returns \`{ task_id, kind, payload }\` or null. Single-claim — each task goes to at most one puller. The canonical loop body is the \`run-inference-worker\` catalyst.
- \`submit_envelope_inference\` — deliver a response envelope for one parked \`envelope_inference\` task. Validates the response against the envelope schema embedded in the task payload before resolving the parked HTTP. Records an \`app_inference\` principle on the calling app's artifact node so future audit walks can recover what each inference cost / produced.
- \`cancel_agent_task\` — release a parked HTTP with a typed error (\`INFERENCE_CANCELLED\`). Escape hatch when the agent can't or won't fulfill — the app receives the error and can decide what to do (retry, fall back, surface to the user). Use sparingly; the loop body should handle most failure modes by submitting an envelope with appropriate machine_state, not by canceling.

#### Agent-routed chat (web chat builder)
When you fulfill a \`chat_turn\` task (the control plane's own web chat builder, \`caller_ref.kind = 'builder_chat'\`), these two tools let you talk to the operator *mid-turn* instead of being a black box until you submit. Both take the builder \`session_id\` from the pulled task's \`caller_ref.sessionId\`. Only reachable from the interactive worker (the headless node-fulfiller has no MCP connection). The canonical loop body is the \`run-chat-builder-worker\` catalyst.
- \`emit_chat_signal\` — narrate progress. Fire-and-forget. \`kind:'note'\` streams a short \`text\` line into the reply bubble; \`kind:'phase'\` sets the avatar state (\`thinking\`/\`speaking\`/\`success\`/\`concerned\`/\`celebrating\`/\`idle\`). Returns \`{ delivered }\` — \`false\` means the chat stream is closed; stop emitting.
- \`request_chat_decision\` — ask the operator a structured question and get the answer back. Use ONLY when a choice genuinely needs them (ambiguous intent, a destructive/deploy action, a fork); otherwise just answer. First call: \`{ session_id, question, options:[{id,label,description?}], allow_text? }\` (two options like allow/deny = an approval). Renders an inline card and long-polls up to \`wait_ms\` (≤45000). Returns \`{ status:'answered', selected?, text? }\`, or \`{ status:'waiting', prompt_id }\` (re-call with that \`prompt_id\`), or \`{ status:'expired' }\` / \`{ status:'no_listener' }\` (fall back to a sensible default and proceed — never hang).

### Ring 8 — Plan mode (deliberation → execution)

The PROPOSED layer of the deliberation model — the speculative counterpart to the contextmap's committed reality. Most sessions stay sessions; a few accumulate enough signal to become **Plans**: sealed cognitive units that draw the schematic of one vertical slice (a "spike") and, once tractable, compile to a manifest of tool calls the operator can execute under per-execution approval. A plan is NOT a contextmap commit — contextmap is sealed reality, a plan is pre-reality. Call \`enter_plan_mode\` to load the deliberation discipline (four lenses, shadow scratchpad, introspection-on-signal, the frame). v0: no cross-plan context; subplans live inside the prime plan's manifest. The dashboard's \`/plan\` page is a read-only inbox view; New Plan opens a fresh host-agent session that drives these tools.

- \`enter_plan_mode\` — return the plan-mode discipline (the four lenses held loosely: spike / segment-expansion / vertical-reinforcement / collider; the shadow-scratchpad step-0 where you DRAFT but never FIRE tool calls while deliberating; introspection-on-signal that grounds the frame against committed reality only once the gem reveals; the frame-for-approval moment; the forge → revise → compile → execute lifecycle). Call FIRST when the operator wants to plan non-trivial work — it primes you to push gently toward an outcome. Read-only.
- \`forge_plan\` — seal a Draft plan from a session: \`{ title, goal, lens?, frame?, manifest?, analysis?, source? }\`. \`manifest\` is the ordered candidate \`{ tool, args, note? }\` calls (the projected shadow scratchpad); \`analysis\` is the un-shared provenance (lens weights, discarded lenses, introspection refs). A plan can start goal-only and accrete its manifest via \`revise_plan\`. Optional \`source: { kind: 'cook', cook_ref }\` seeds the plan from a previously-materialized Cook outcome (the cook's aim → seeded goal, suggested_lens → seeded lens; source ref recorded in analysis for the triangle backlink). Returns \`{ plan_ref, status:'draft', lens, has_manifest, source? }\`. Forging executes nothing.
- \`revise_plan\` — append a \`{ note, revised_at }\` to the revision log and optionally patch goal / lens / frame / manifest / analysis. Mode-switching ("this is a reinforcement, not a spike") is a normal revision. ALWAYS resets status to \`draft\` — touching the schematic un-commits the compile. Returns \`{ plan_ref, status:'draft', lens, revisions }\`.
- \`sketch_plan\` — preview the current manifest as a pipeline diagram WITHOUT compiling (same derivation \`compile_plan\` auto-mints). Links the sketch to the plan as the current diagram (unpinned — a later compile will redraw it). No status change. Refuses if a hand-authored sketch is pinned or the manifest is empty. Returns \`{ ok, plan_ref, sketch_ref, sketch_url, steps, message }\`.
- \`compile_plan\` — attempt Draft → Actionable. A COMPILE STEP, not a status flip: validates the manifest against the LIVE tool registry. Tractable iff every call resolves to a shipped tool (none plan-mode meta-tools, none malformed). Success → \`status:'actionable'\`. Failure → stays Draft with a structured reason: \`unknown_tools\` (mojulo can't do this deterministically yet → roadmap signal), \`illegal_tools\`, or malformed \`errors\`. Returns \`{ ok, compiled, status, steps?, unknown_tools?, illegal_tools?, errors?, message }\`.
- \`execute_plan\` — run an Actionable plan's manifest. THE PER-EXECUTION GATE: requires \`confirm:true\` and \`status:'actionable'\`. Runs each call in order through the same handler path a remote tools/call hits (executed steps behave identically to operator-typed calls), re-validating the manifest first. STOPS ON FIRST FAILURE — completed steps recorded, plan marked \`failed\`, operator re-forges the remainder; full success marks \`executed\`. Returns \`{ ok, status, steps_run, steps_total, execution_log, message }\`. Manifest calls can be mutating (deploys, env writes) — the confirm gate is the only thing between Actionable and real side effects.
- \`list_plans\` — list plans (the inbox); optional \`status\` filter. Returns \`{ total, plans: [{ plan_ref, title, lens, status, seen, steps, revisions, created_at, updated_at }] }\`. Read-only; does not flip read/unread.
- \`get_plan\` — fetch one plan in full (goal, lens, frame, manifest, analysis, revision_log, execution_log). Opening flips its \`seen\` flag to read — the light inbox gate, not a formal review.

### Ring 9 — Stash · Gather · Cook (typed-intake → publication outcomes, plus legacy research)

The publication paradigm: typed items into stashes, then nucleate them into a self-contained outcome folder filed at \`/outcomes/<cook_ref>/\` (essay / picture_book / slide_deck / flyer / brief / resume / newsletter / field_guide / pamphlet / textbook / novel / visual_guide / comic). Stash is the typed corpus; Cook is the singular-aim collider; the AGENT authors \`report_md\` (no server-side LLM). **Cook stops at cook** — plan mode can later seed from a cook via \`forge_plan({ source: { kind: 'cook', cook_ref } })\`, but that's a plan-side decision. The legacy diffuse-research tools (\`start_research\` etc.) still ship alongside under \`enter_research_mode\` — option-3 coexistence with stash mode.

#### Stash + Gather (the typed corpus)
- \`mint_stash\` — mint a renameable bucket. → \`{ stash_ref, title, status }\`. The successor to \`start_research\` with a strict per-item type contract.
- \`gather\` — the GATHER verb: bind a typed item into a stash. Types: \`text\` / \`markdown\` / \`image\` / \`svg\` / \`script\` / \`pointer\` / \`link\` / \`sketch\`. Per-type required fields are validated at intake — malformed items are REJECTED, not silently stored. \`pointer\` targets must be contextmap node-refs; \`sketch\` items reference a \`sk_…\` ref minted by \`create_sketch\` (resolved live, so edits propagate).
- \`mint_drawer\` — idempotently mint a drawer (sub-grouping) inside a stash. Drawers map to chapters / sections in many publication kinds.
- \`rename_stash\` — relabel a stash; \`stash_ref\` is stable.
- \`list_stashes\` — list stashes (optional \`status: open | archived\`), most-recently-active first.
- \`get_stash\` — fetch a stash in full (drawers + every gathered item grouped by drawer). Items carry their typed contract fields; the UI dispatches on \`type\` to render.
- \`update_item\` — mutate an item in place. Items are citable atoms across cook slices and future plan refs, so edits propagate live; the intake gate **re-runs on merged state** so the type contract can't be corrupted. \`type\` is not mutable — archive + re-gather to change kind.
- \`archive_item\` — soft-delete an item. Two-step gate when referenced by any cook: first call returns a dry-run \`{ pending_confirm: true, references }\`; re-call with \`confirm: true\` to proceed. Idempotent.
- \`bind_stash\` / \`unbind_stash\` / \`list_stash_bindings\` — adjacency layer linking a stash to \`bot\` / \`app\` / \`plan\` / \`cook\` / \`contextmap_node\` with an optional \`role\` (\`corpus\` / \`working_memory\` / \`ingredient\` / \`reference\`). v0 navigational only — agents do NOT auto-read linked stashes mid-conversation; \`bound_ref\` is not validated against the target repo (dangling refs are tolerated).
- \`sketch_stash\` — vibe-to-items scaffold: given a free-form intent + optional target publication kind, return a PROPOSED stash structure (drawers + item slots) plus an executable script (\`mint_stash\` → \`mint_drawer\` → \`create_sketch\`/\`gather\` → \`cook\`). Companion to \`sketch_plan\`; no DB writes; no LLM call.

#### Cook + publish (the collider)
- \`recommend_kind\` — rules-based recommendation (no LLM): scan a stash, return ranked publication kinds for \`cook()\`. Scores against per-kind rules from PUBLISHER.plan.md (picture_book needs ≥1 sketch; resume rewards an \`identity\` drawer; pamphlet hits its ideal at exactly 4 markdown items). Use BEFORE \`cook\` when the operator's intent doesn't pin a kind.
- \`cook\` — the COOK verb: nucleate one Outcome Artifact from ≥1 stash slice + ONE singular aim. The binding vow: one aim per cook; refuse to compound. Returns \`{ cook_ref, outcome_url, outcome_dir, template_version, file_count, suggested_lens?, message }\`. The static \`index.html\` is self-contained. Publication kinds + their ideal shapes are documented inline in the tool description.
- \`forge_publications\` — cook the same stash into 2–4 candidate publication kinds in one call. Convenience verb for the multi-kind preview pattern (gather → forge candidates → operator picks the winner → \`archive_cook\` the rejects). Each forged cook is a real DB row + outcome folder grouped by \`forge_id\`.
- \`get_cook\` — fetch a cook row (the index pointing at its outcome folder). Any ring can read this — it's a first-class deliberation node.
- \`list_cooks\` — list cooks (most-recent first), optional \`status: open | archived | all\`. The outcomes inbox.
- \`archive_cook\` — soft-delete a cook row (removes from default \`/outputs\` inbox). The outcome folder on disk is NOT touched — citations still resolve. \`unarchive: true\` to restore.

#### Research (legacy track — option-3 coexistence with stash mode)
- \`enter_research_mode\` — return the light research discipline: no goal but to assist; bind broadly; trust your natural research strength; never force convergence. Optional drawer, NOT main flow. Call only when the user explicitly asks to research / gather / look into something. Read-only.
- \`start_research\` — auto-save a research book. Low-ceremony: the book exists the moment research begins. Bind items with \`bind_research_item\`.
- \`bind_research_item\` — core accretion verb. Kinds: \`link\` / \`article\` / \`summary\` / \`screencap\` / \`note\` / \`quote\` / \`snippet\` / \`sketch\`. Bind summaries you generate as their own items so the book remembers what it concluded.
- \`synthesize_abstract\` — distill the book into a tight thesis. Records the abstract (append-only history) AND auto-mints a hub-spoke DIAGRAM of the book (items → thesis). With \`evaluate: true\`, sends to plan mojulo for evaluation against the plans paradigm: supply \`suggested_lens\` + \`recommendation\` (\`forge\` or \`keep_researching\` with \`missing\` list).
- \`sketch_research\` — preview the book as a hub-spoke diagram WITHOUT synthesizing. Standalone (not bound to the book or any abstract). Useful while gathering. Refuses on empty book.
- \`get_research\` — fetch a full research book: session + all bound items + all synthesized abstracts (with \`plan_ref\` / \`assessment\` if evaluated).
- \`list_research\` — list research sessions (optional \`status\` filter), most-recently-active first.

### Ring 10 — Visualization (sketches, illustrations, painted landscapes)

The drawing surface — orthogonal to contextmap (sketches are scratch visualizations, not structural decisions). Mintings persist at \`/sketches/<ref>\` and can be embedded into picture-book / comic / field-guide / visual-guide cook outcomes via \`sketch\`-typed stash items. The dashboard's \`/sketches\` page browses them.

- \`reference_protocol\` — Visual Reference (step 1): get the extraction protocol for reading a photo YOU can see into mojulo's dials. \`target:'scene'\` (perspective: horizon / vanishing points / floor → two-point camera) or \`'pose'\` (gesture: skeletal key lines → figure pose dials). You are the vision adapter — no key, no image sent to mojulo. Returns key lines, dial schema, fidelity contract (thematic/gesture default vs faithful), expressive ceiling, multi-pass hint, and the \`capture_reference\` call to make next.
- \`capture_reference\` — Visual Reference (step 2): file the \`insights\` you extracted from a photo into a stash. Mints a CAGE sketch you can see/preload/re-camera (scene → a perspective-frame diagram; pose → a posed figure dummy) and gathers it as a \`sketch\` item carrying \`metadata.insights\`. Pass \`stash_ref\` to REFINE with a second view (multi-pass triangulation — one photo is the normalized anchor, not the creation driver). Consume via preload / \`create_figure({pose})\` / \`forge_motion\` / \`cook\`; anchor with \`bind_stash({role:'reference'})\`. Returns \`{ stash_ref, cage_ref, cage_url, item_id, passes }\`.
- \`create_sketch\` — mint a flow-chart / data-chart / scene illustration the operator can view in the dashboard. Manifest accepts \`stations[]\` + \`edges[]\` (flow vocab), \`marks[]\` (chart primitives — stacked bars, donut/ring, KPI tile, polygon, blob, sphere, cylinder, plane, solid, partition, array, cubieLattice, form, text), and/or \`recipe: { kind, ...knobs }\` (deterministic family compilation — \`architecturalConstruction\` / \`portraitBust\` / others). Optional \`grid\`, \`depiction\`, \`scene.perspective\`. Before chart work: \`semantic_search({ kinds: ['sketch_vocab'] })\` then read the matched card via \`get_sketch_vocab\` for layout math. Returns \`{ ok, ref, url }\`.
- \`update_sketch\` — revise an existing sketch in place (rename, replace manifest, move folder) so the Sketches index doesn't accumulate near-duplicate refs. Same validation as \`create_sketch\`.
- \`get_sketch_vocab\` — read a sketch-vocab card in full (layout math + example marks for one paradigm: \`donut-ring\`, \`stacked-bar\`, \`stat-tile\`, \`grid-layout\`, \`z-layering\`, \`pipeline\`, …). Pair with \`semantic_search({ kinds: ['sketch_vocab'] })\`. Omit \`id\` to list available cards.
- \`diff_sketches\` — scratch visual diff between two sketch refs. Matches stations/marks structurally; highlights green (added) / red (removed) / amber (changed) / blue (moved). Returns \`{ ok, ref, url, verdict, similarity, summary }\` or \`verdict: 'too_different'\` (refuses to mint without \`force: true\`).
- \`create_polygonized_sketch\` — generate a sketch from a natural-language visual prompt. \`mode: 'one-trip'\` (default; flat scenes — portraits, charts, single figures) or \`'plan-then-skin'\` (two-turn; perspective / multi-figure / architectural — plans + scaffolds before marks). Calls a provider LLM (defaults to the saved key, or ollama).
- \`sketch_what_possible\` — **VISUAL ONLY** despite the name. The inverse-stable-diffusion knob-resolution loop that feeds \`create_sketch\` for scene/figure illustrations (recipe families like \`architecturalConstruction\`). Retrieves methods (family + knob values) for the current intent, narrates underdetermined knobs to the user, accumulate decisions across turns, only call \`create_sketch({ recipe: { kind, ...accumulated } })\` when \`hint.ready_to_create_sketch === true\`. Conceptual ideation routes to \`enter_research_mode\` / \`enter_plan_mode\` instead. Charts/infographics go through \`semantic_search({ kinds: ['sketch_vocab'] })\` + \`get_sketch_vocab\`.
- \`create_manji_tree\` — author a manji-program tree directly (the polygonizer's cardinal-grammar IR). 2D walks via \`walkManjiTree\`; 3D walks via \`walkManjiTree3D\` and projects through pure-mandala's two-point perspective camera. Composes structurally without going through recipe-compiler family paths — supports limb-chains (forward-kinematic joint chains with hinge constraints), node-level rotation, connections (sine/cosine curves between named landmarks), wave-fields (2D height-field grids), wave-manji (closed-loop printer scripts: ouroboros / mandala / wind-chime / rasengan / rasengan-sphere / smoke-ring / celtic / cloud / tusk / helix), lathes, fields, and library-backed \`programRef\` shelf cards (figure-posture cards, surface presets via \`pathBindings\`).
- \`create_figure\` — mint a POSED human figure: the protoform (a sculpted, vexar-lit male/female body over a manji armature) put into a pose and rendered to a sketch. Reach for "pose a figure / a person reaching / a walking figure / a male|female body in a stance / a figure wearing X". Four optional dial-sets: \`pose\` (per-joint DOF + a \`spine\` sagittal/lateral/axial that makes contrapposto/slump read alive — joint limits clamp every value so a pose can't break the form), \`proto\` (sex + per-region build morphs lean↔heavy, male↔female), \`garment\` (skinSuit / wetsuit / tee / tank / dress), \`view\` (camera azimuth), plus a \`setup\` studio (incl. \`blueprint-wire\` construction view). \`motion:'walk'|'sprint'|'wave'|{keyframes}\` also renders a looping gait GIF. Persisted kind \`figure\`; returns \`{ ok, ref, url, svgUrl, gifUrl? }\`. (Contrast: a flat diagram → create_sketch; a metal wordmark → create_carved_solid; a manji-tree subject in motion → forge_motion.)
- \`create_painted_landscape\` — mint a painterly Lambert-shaded landscape by picking one named glyph per family: \`heartbeat\` (geometry; \`[sine-stack]\` periodic or \`[fbm]\` irregular), \`splatch\` (3-color seed → 4-stop palette via luminance-sorted interpolation), optional \`structures\` (obelisks/boxes scattered on the elevated surface). Plus optional \`seed\` (deterministic within-recipe variation), \`light\`, \`camera\` (e.g. \`top-down-survey\`, \`low-angle-hero\`, \`wide-cinematic\`), \`renderStyle\` (\`painterly\` / \`topographic\` / \`wireframe\`), and fine-grained \`heartbeatOverrides\` / \`paletteOverrides\`. Closed-vocabulary discipline — model never authors raw waves or hex.
- \`create_carved_solid\` — mint a CARVED, metalified 3D solid from any vector outline or text — a chrome/gold wordmark, an extruded logo, a beveled badge/icon. Reach for "3D metal logo / extruded chrome text / carved wordmark / beveled icon / metalify this shape". The outline (an SVG path \`d\` or \`text\` carved from a font) is EXTRUDED with a rounded bevel and shaded as smooth metal; holes (letter counters) carve through. FOUR stacking layers: \`material\` (a shading MODEL, not just a tint — metal / matte / glass / neon / cel presets, a \`#rrggbb\`, or a fine-tune object), \`inner\` glow, \`fx\` outer effect(s) routed along the contour (overgrow / electric / ice / flame), and \`camera\`. Animated effects auto-render a looping GIF. Persisted kind \`carved-solid\`. (Contrast: flat diagrams/charts → create_sketch; a painterly terrain → create_painted_landscape.)
- \`create_solid_turntable\` — mint a SINGLE convex solid that spins LIVE in the browser (a lit ball, a crystal / coordination polyhedron, a gem, a planet, a single atom or orbital lobe). Stores only a tiny recipe (\`kind: 'css3d-turntable'\`: shape + color + surface); rendered on demand at \`/api/sketches/<ref>/scene\` as a dependency-free CSS preserve-3d turntable with the highlight FIXED in the viewport (vexar re-shaded per frame). Single convex solids only — the class CSS renders exactly; interpenetrating molecules / self-folding chiral helices use the BAKED \`forge_motion\` turntable instead.
- \`create_fractal_city\` — mint a 3D cityscape from a tiny seed + knobs RECIPE (the fractal-generation path: the substrate stores ONLY the recipe — no geometry — and regenerates the whole city deterministically on render, so it costs almost no tokens and the same seed always rebuilds the same city). Recursively subdivides a coherent street grid into non-square blocks (sidewalks, 2-lane mains, stoplights, crosswalks, power lines), fills each block by a composition rule (megatower / large / mediums / building+lot / parking), and skins every building with a randomized facade. A live, dependency-free CSS preserve-3d HTML scene served at \`/api/sketches/<ref>/scene\` (open it / embed in an \`<iframe>\`); persists with \`manifest.kind === 'fractal-city'\`.
- \`create_transportation_hub\` — sibling of \`create_fractal_city\` tuned to transit: a \`mode\` + seed RECIPE → a 3D hub organized around an anchor terminal sprouting concourse FINGERS fractally filled with the mode's repeated unit. Modes: \`airport\` (glass terminal + control tower + jet-bridge gates + apron + taxiway + runways), \`train-station\` (head-house + platforms + canopies + rail + trains + footbridge), \`bus-terminal\` (sawtooth bus bays + drive lanes), and \`subway\` (the INTERIOR sibling — an enclosed island-platform hall with a parked train; persists as a \`subway-station\` scene kind, /scene + PNG. Add \`building:true\` for the 2-level station+concourse \`subway-building\` /world kind — fare line + turnstiles + booth + escalators; and \`atmosphere:true\` for the moody traced-light relight). Same recipe-only, regenerate-on-render path; exterior modes serve a live CSS preserve-3d scene at \`/api/sketches/<ref>/scene\`; persists with \`manifest.kind === 'transportation-hub'\`. Reach for "make an airport / train station / bus terminal / subway station / a transit hub".
- \`create_workbench\` — the OBJECT-scale sibling of \`create_fractal_city\`: instead of a traversable environment, render ONE everyday object on a measured grid at LITERAL scale, for FORM accuracy (neutral studio light, no mood). Build it as a POLYGOMER — a set of revolution primitives (\`lathes\`, each an axisFrom→axisTo + a radius \`profile\`, optional N-fold \`harmonics\`) bonded by literal placement: candlestick = foot+stem+cup, bottle = one capped lathe, dumbbell = bar+two bells; also vases, lamps, wheels, plates, spindles. Recipe-only, regenerate-on-render; served traversable at \`/api/sketches/<ref>/world\` (three.js orbit) + preset CSS-3D shots at \`/scene\`; persists with \`manifest.kind === 'workbench'\`. Reach for "render an object / a mechanical part / an everyday object from primitives / a turntable of a <object> / block out a <object> in solids". Rotational-only today (boxes/extrusions are a coming monomer).
- \`create_controllable_world\` — mint a LIVE, INTERACTIVE world the user DRIVES (walk a figure, fly a drone, a self-playing figure). Stores ONLY a recipe (\`kind: 'controllable'\`): a list of ENTITIES, each a transform + a RULE (how it moves each frame) + a BODY; the camera is an entity too. Rules: \`glide\` (free flight) / \`walk\` (ground-locked, drives a gait) / \`platform\` (a tuned PLATFORMER controller — gravity + jump, variable height, coyote time, air control; also a 2.5D side-scroller via \`strafe:0\` + fixed heading) / \`follow\` (chase camera) / \`clock\` (autonomous playback). Bodies: \`mesh\` / \`figure-frames\` (a baked human figure declared in \`figures\`) / \`none\`. Regenerated deterministically and served traversable at \`/api/sketches/<ref>/world\` (W/S move · A/D turn · Space jump · mouse look). Reach for "walk a character through X / fly a drone / a platformer / jump-and-run / a playable / controllable / first-person world / move a thing around a scene". Contrast: a STATIC look-at scene → \`create_fractal_city\` / \`create_sketch\`; a world with RULES/score → \`create_action_world\`.
- \`create_action_world\` — the CONSEQUENCE sibling of \`create_controllable_world\`: mint a LIVE world where THINGS HAPPEN with rules — a GAME (moles that pop, shots that score, a timed round that ends, items you collect). Stores ONLY a recipe (\`kind: 'controllable'\` + a lowered \`events\` block + \`walk\`); the RULES are a declarative IDIOM RECIPE (\`idioms\`: [{ kind, ...params }] — \`scoreCounter\` / \`countdownClock\` / \`gameOverFreeze\` / \`spawnOnHeartbeat\` / \`ephemeralTarget\` / \`deed\` / \`hitConfirm\` / \`onContact\` / \`pickup\` / \`onRest\`) composed to the in-world event bus server-side. \`entities\` are the BUS PROPS the rules act on; \`faces\` are stage walls (walk-colliders AND shot-occluders); \`walk\` defaults true. Input-driven ⇒ non-bakeable; served live at \`/api/sketches/<ref>/world\` (/svg + /scene show frame zero). Reach for "make a game where… / a shooting range / whack-a-mole / a scene with a score and a timer / things that pop up and you click them / a coin-pickup level".
- \`forge_motion\` — put a mojulo subject IN MOTION and render an animated artifact (self-contained CSS flipbook SVG + GIF). An OUTPUT concern, sibling to illustration/cook: it CONSUMES static subjects and adds time. TWO families behind one door: (1) CAMERA motions (\`turntable\` / \`orbit\` / \`push_in\` / \`dolly_zoom\` / \`flythrough\`) over a single manji-tree (figure rig, terrain world, or stored \`sk_…\` sketch) — the subject's own camera is the base shot, the motion perturbs it; (2) DECK motion (\`deck\`) over an ORDERED set of sketches/charts played as a SLIDESHOW — the info-transfer path for content that needs no figure/scene animation (chart decks, KPI walkthroughs, explainers, a report in motion). Deck slides via \`subject.deck\` (ordered sketch refs and/or inline manifests, ≥2) or \`subject.stash_ref\` (a stash's \`sketch\`-typed items, in gather order). Filed as a "Motion Project" resource group — an ops tag binds a subject/recipe stash + the rendered motion outcome folder. Returns \`{ motion_ref, tag_ref, stash_ref, url }\`; the \`.svg\` is durable, the \`.gif\` is a cache.
- \`stitch_motion\` — concatenate N already-forged motions (\`mo_…\` refs) end-to-end into ONE long-form, downloadable MP4/H.264. The multi-clip sibling of \`forge_motion\` (forge makes one clip; stitch plays many as a film). A stitch is itself a motion outcome (its own \`mo_…\` folder, same Motion Project ops tag, same /motion gallery) but plays as \`<video>\`. Snapshot-at-build (clip frames baked in, survives source deletion); differently-sized clips letterbox into one canvas; each clip resampled to the output fps keeping real-time duration. CUT-only transitions; MP4-only (no GIF); WARNS but never refuses on large builds. Returns \`{ motion_ref, url, mp4_path, clips, frames, duration_seconds, warning }\`.

### Ring 11 — Operations mode (domain-scoped consultation)

Far-range, domain-shaped view ("the marketing operation", "is finance serving its concern?") — distinct from workbench (close-range, single-artifact tuning) and from plan / research (effort-shaped, pre-reality). An ops tag = title + descriptor + members drawn from committed reality. The descriptor is the THESIS (rubric); members are measured against it. **Consulted, not driving** — no execute / deploy / mutate from this mode. Members are committed reality only (\`bot\` / \`app\` / \`mcp_orbit\` / \`cook\` / \`catalyst\` / \`trigger\` / \`stash\`); plans + research remain reachable as provenance THROUGH bound members but aren't themselves taggable.

- \`enter_operations_mode\` — return the operations-mode discipline. Call FIRST when the operator says things like "show me the marketing operation", "how do these efforts relate?", or "is bot X still serving its domain?". Read-only.
- \`forge_ops_tag\` — mint a new ops tag with \`title\` (domain label, e.g. "Marketing") + \`descriptor\` (markdown thesis — be precise; a vague descriptor disables every downstream move). Returns \`{ tag_ref, title, status: 'active', created_at }\`. Members bound separately.
- \`bind_to_ops_tag\` — attach a committed-reality resource as a member. \`member_kind\` ∈ \`bot\` / \`app\` / \`mcp_orbit\` / \`cook\` / \`catalyst\` / \`trigger\` / \`stash\`. Idempotent (re-binding is a no-op). Plans + research are intentionally NOT bindable.
- \`unbind_from_ops_tag\` — detach a member. Does NOT delete the resource (operations mode never owns its members). Idempotent (returns \`ok: true, removed: false\` when the binding doesn't exist).
- \`get_ops_tag\` — the bounded-context READ: descriptor + status + per-kind member counts + full member list. The centerpiece read of operations mode; call before reasoning about a domain.
- \`list_ops_tags\` — list ops tags (optional \`status: active | archived\`). The inbox.
- \`revise_ops_tag\` — patch \`title\` / \`descriptor\` / \`status\`. Sharpening the descriptor is the most common revision (the rubric changes). Archiving stops the tag from scoping; members keep running and can be re-tagged elsewhere.`;

// --- Routing index (the core) ---
//
// User framing → entry tool. The single largest block in the old body
// (QUICK_ORIENTATION_RULES, ~1.9K tok) compressed into a terse table. The
// entry tool is the START of a flow, not the whole flow — `get_tool_index`
// carries the full ring-grouped list when this isn't specific enough.

const ROUTING_INDEX = `## Routing index — recognize the path, reach for the entry tool

Match the user's framing to a row. The named tool is the starting point; pull \`get_tool_index\` for the full ring-grouped list when a row isn't specific enough.

**Create things**
- Build a chatbot ("build a bot", "deploy this for my customers") → \`infer_intent\` (or jump straight to a \`generate_*\` tool if the shape is known). Flow: build → deploy (\`save_modular_bot\` → \`poll_job\`, hand the user \`artifactPath\`) → bot phones home → operate. The same \`\${botUrl}\` opened in a browser is the quickest self-test; \`<script src="\${botUrl}/widget">\` is the customer install snippet.
- Automate over installed MCPs with **no chatbot** ("every Monday summarize X into Y", "when X in MCP-A do Y in MCP-B", "use mojulo without a bot") → \`meta_context_declare_inventory\` first, then \`recommend_mcp_orbit_compositions\` or \`bind_primitives\` (runtime-introspected). A host-adapter Skill via \`get_catalyst\` is the other Connected-Service form. Mojulo is the deliberation anchor + audit trail here, not the runtime.
- A long-running local tool that calls back to **you** for inference ("watch this folder", "process Z in the background and ask me when it needs to think", "image-extraction app") → \`install_scaffold\` → \`meta_context_commit({type:'app_materialization'})\` → \`start_app\`; inference parks on the agent-tasks queue (\`pull_agent_task\` / \`submit_envelope_inference\`), no per-app LLM key.
- Schedule / activate an existing artifact ("every morning", "on a cadence") → \`bind_trigger\` (binding persists; it only *fires* when the trigger runtime daemon is enabled).
- **Publish an outcome from gathered material** ("turn this into an essay / picture book / slide deck / flyer / brief / resume / newsletter / field guide / pamphlet / textbook / novel / visual guide / comic") → \`mint_stash\` → \`gather\` typed items (text / markdown / image / svg / script / pointer / link / sketch) → optional \`recommend_kind\` → \`cook\` (one singular aim, ≥1 stash slice; AGENT authors report_md). Multi-kind preview: \`forge_publications\` cooks 2–4 candidate kinds at once. Outcomes file at \`/outcomes/<cook_ref>/\` as self-contained folders; browse from the \`/outputs\` page. Vibe-to-shape scaffold via \`sketch_stash\`. Cook stops at cook — \`forge_plan({source:{kind:'cook',cook_ref}})\` is a plan-side handoff, not a cook outlet.
- **Reference a PHOTO you can see** ("use this image/photo as a reference", "match this pose / gesture", "rebuild this room's perspective", "copy the composition / camera", "base it on this picture") → \`reference_protocol({ target:'scene'|'pose' })\` to get HOW to read it (you are the vision adapter — no key, no image sent to mojulo), then \`capture_reference\` to file what you extracted as a reusable cage + insights in a stash. \`scene\` recovers PERSPECTIVE (horizon / vanishing points / floor) into a two-point camera; \`pose\` recovers the GESTURE into the figure dummy's pose dials. A single photo is the normalized anchor; pass \`stash_ref\` with a second view to GROUND it (multi-pass triangulation). Then build inside it (preload the cage / \`create_figure({pose})\` / \`forge_motion\` a turntable or pose keyframe) and \`bind_stash({role:'reference'})\` to anchor a build. (Contrast: "draw me X" → \`create_sketch\`; "make X move" → \`forge_motion\`.)
- **Mint a visual** (flow chart, data chart, scene illustration, painterly landscape, posed figure, carved 3D solid, generated city / transit hub) → \`create_sketch\` for diagrams (chart vocab via \`semantic_search({kinds:['sketch_vocab']})\` + \`get_sketch_vocab\`); \`update_sketch\` to iterate in place. Scene/figure illustration → \`sketch_what_possible\` knob-resolution loop → \`create_sketch({recipe:{kind,...}})\`, or single-shot \`create_polygonized_sketch\` for natural-language prompts. Cardinal-grammar structural illustration → \`create_manji_tree\` (2D or 3D). Painted landscape from glyph choices → \`create_painted_landscape\` (find a sky/palette/geometry glyph by intent via \`semantic_search({kinds:['painted_landscape']})\`). **Pose a human body** ("pose a figure / a person reaching / a walking figure / a male\\|female body in a stance / a figure wearing X") → \`create_figure\` (pose / build / garment / view dials; \`motion:'walk'\` adds a gait GIF). **A 3D metal/carved wordmark, logo, or badge** ("chrome text / extruded logo / beveled icon / metalify this shape") → \`create_carved_solid\`. **A generated 3D city / skyline** → \`create_fractal_city\`; **an airport / train station / bus terminal / subway / transit hub** → \`create_transportation_hub\` (tiny seed recipe → a live CSS preserve-3d scene at \`/api/sketches/<ref>/scene\`). **A single everyday OBJECT / mechanical part rendered from primitives at literal scale** ("render/turntable a candlestick / bottle / dumbbell / vase / lamp; block out an object in solids") → \`create_workbench\` (a polygomer of \`lathes\` → a measured object served traversable at \`/world\` + preset shots at \`/scene\`). **A LIVE world the user can DRIVE** ("walk a character through X / fly a drone / a platformer / jump-and-run / a controllable, playable, first-person world / move a thing around a scene") → \`create_controllable_world\` (entities = transform + rule + body — incl. a \`platform\` rule for gravity+jump platformers; the camera is an entity; served traversable at \`/world\`). **A LIVE world with RULES where things HAPPEN — a GAME** ("make a game where… / a shooting range / whack-a-mole / a score and a timer / things that pop up you click / a coin-pickup level") → \`create_action_world\` (an \`idioms\` recipe — scoreCounter / countdownClock / spawnOnHeartbeat / ephemeralTarget / hitConfirm / pickup / … — composed to the in-world event bus; \`entities\` are the bus props; served live at \`/world\`). Compare two diagrams → \`diff_sketches\`. Sketches persist at \`/sketches/<ref>\` and embed into picture-book / comic / field-guide / visual-guide cooks via \`sketch\`-typed stash items.
- **Make a visual MOVE** ("animate / make it move / turn it into a gif / spin it / a turntable / fly through / fly between / zoom in on / orbit it") → \`forge_motion\` CAMERA family over a manji-tree subject (stored \`sk_…\` sketch or inline): \`turntable\` / \`orbit\` / \`push_in\` / \`dolly_zoom\` / \`flythrough\`. Contrast: "draw me X" → \`create_sketch\`/\`create_manji_tree\` (static); motion adds time on top.
- **Put info in motion / EXPLAIN A CONCEPT visually** ("play these charts / make a slideshow / a deck / an explainer / explain how X works / a walkthrough / a report in motion / animate the dashboard") → \`forge_motion\` DECK family: \`subject.deck\` (ordered \`sk_…\` sketch refs and/or inline sketch manifests, ≥2) or \`subject.stash_ref\` (a stash's \`sketch\`-typed items, in gather order) with \`shot.motion:'deck'\`. A slide's marks carry \`reveal:{step,enter,from,dwell}\` to BUILD in sequence — a concept explainer (ladder / process-flow from marks / labeled-structure / formal): graduated, paced disclosure. The right reach for charts / diagrams / text — INFO TRANSFER, not a moving figure or world. FORK: a concept that IS a 3D object needing rotation (molecule / lattice / mechanism) → the CAMERA family (manji-tree turntable), not the deck. Ball-and-stick = lathes (ball = dome-profile lathe, rod = constant-radius lathe); set \`style.fill:'vexar'\` per lathe for LIT shaded solids (default wireframe). The bond is the \`vajra\` primitive (o-o-o, two spheres + hub); chirality / double-helix / DNA is the \`taiji\` primitive (a SIGNED \`twist\` = handedness) — both INTERPENETRATE / self-fold so they stay BAKED. A SINGLE convex solid that doesn't self-occlude (lit ball / crystal polyhedron / gem / single atom) instead spins LIVE via \`create_solid_turntable\` (CSS-3D, no bake). SMOOTH 2D MOTION: a SINGLE animate-annotated slide (a mark carries \`animate:{channel:'spin'|'grow'|'orbit'|'slide'|'fade'|'pulse',…}\`) renders Regime A — rendered once + CSS transform (the .svg plays live, the .gif is the bake); reach for it for a rotating/growing/orbiting diagram. LIMITS: no sound (timing narrates); smooth motion across a MULTI-slide deck + draw-on + continuous 3D are still staged/turntable. Renders into \`/outcomes/<motion_ref>/\`, filed as a Motion Project ops tag.
- **Stitch clips into one long video** ("stitch these together / combine the gifs / join the clips / make one long video / a movie out of these motions / concatenate them / play them back-to-back / one downloadable file") → \`stitch_motion({ title, clips:[mo_…, mo_…] })\`. Forge the pieces with \`forge_motion\` first, then pass their \`mo_…\` refs in play order. Outputs a long-form MP4 (broadly playable + downloadable) as its own Motion Project member at \`/outcomes/<motion_ref>/\`, played as \`<video>\`. Cut-only, MP4-only; warns (never refuses) on very long builds.

**Operate what exists**
- Turn a bot's captured signal into action / "what can this bot do for me?" → \`recommend_catalysts\` → \`get_catalyst\` (read the host-adapter section to materialize the runnable artifact). Across the fleet: \`recommend_catalysts({scope:'fleet'})\`.
- Read a deployed bot → \`list_deployments\` / \`get_deployment\` (identity, form schema, protocol configs) / \`query_conversations\` → \`get_conversation\`; form data via \`query_submissions\`. The bot's \`.env\` → \`inspect_bot_env\` (never \`cat\`).
- Fleet-wide questions ("how's the whole fleet?", "busiest bots", "find any conversation that mentioned X") → \`fleet_analytics_summary\`; \`fleet_query_conversations\` to **locate**, then per-bot \`get_conversation\` to **read**. Audit chains across bots → \`verify_fleet_chains\`; one conversation → \`verify_chain\`.
- **Scope a domain operation** ("show me the marketing operation", "how do these efforts in finance relate?", "is bot X still serving its concern?") → \`enter_operations_mode\` → \`forge_ops_tag\` (title + a precise descriptor — the THESIS members are measured against) → \`bind_to_ops_tag\` for each committed-reality member (\`bot\` / \`app\` / \`mcp_orbit\` / \`cook\` / \`catalyst\` / \`trigger\` / \`stash\`); the bounded read is \`get_ops_tag\`. Operations is **consulted, not driving** — no execute / deploy / mutate from this mode; plans + research stay reachable as provenance through bound members but aren't themselves taggable.

**Reason about structure**
- "Why was X bound this way?" / "what have I materialized?" → \`meta_context_brief\` (the \`materialized_by\` / \`binds\` edges carry the reasoning principles). Distinct from \`fleet_*\` (metrics) and the operate tools (content).
- Have an intent but not a ref → \`semantic_search\`, then pull full bodies with the structured readers.
- Plan non-trivial work → \`enter_plan_mode\`. For publication-shaped gathering use stash mode (see "Publish an outcome" above — \`mint_stash\` → \`gather\` → \`cook\`); for the older diffuse-research drawer → \`enter_research_mode\` (legacy track: \`start_research\` / \`bind_research_item\` / \`synthesize_abstract\`; option-3 coexistence with stash mode). A cook outcome can later seed plan mode via \`forge_plan({ source: { kind: 'cook', cook_ref } })\` — cook stops at cook; the bridge is plan-side.

**Extend mojulo itself**
- New capability that fires *inside a conversation* → \`custom_protocol\`. Contribute a recipe to the shipped library → \`custom_catalyst\`. (Automating just for yourself is a Skill — synthesize from \`get_catalyst\` or intent; don't call \`custom_catalyst\`.)`;

// --- Drawer directory (where to go deeper) ---

const DRAWER_DIRECTORY = `## Drawers — pull on demand, don't front-load

- \`get_tool_index\` — the full one-line-per-tool index across every ring (incl. document/build tools, daemons, agent-routed chat). When a routing row isn't specific enough.
- \`get_register_kit\` — the **concept glossary** (Bot, Deployment, Protocol, Chain, Catalyst, App, …) in the operator's active \`vocabulary_register\`, plus your narration disclosure + the commitment floor. The vocabulary lives here — pull it to define a term or phrase something for the user.
- \`get_deliberation_overview\` — the why-it's-structured model for the Ring 6 surfaces + daemon runtime gating. Pull before structural / non-bot work.
- \`get_ui_map\` — the \`mojulo-ui\` dashboard page map; pull when the user wants to look / browse / click and you need to name the right page.
- \`get_substrate\` — the PLAYful Cloud substrate positioning; pull when the user compares mojulo to cloud primitives or asks "what is this really?".`;

// --- Deliberation overview (Ring 6 deep block, promoted to its own tool) ---
//
// The why-this-is-structured-this-way explainer for the seven Ring 6 surfaces
// plus the daemon runtime-gating posture. Most sessions never touch Ring 6, so
// this deep block lives behind get_deliberation_overview rather than in the
// forward_context body. forward_context keeps the one-liner per surface in the
// ring TOC + a single pointer here.

const DELIBERATION_OVERVIEW = `# Deliberation surfaces (Ring 6) + runtime gating

Mojulo separates *what fired* (a conversation, an automation run — outcome-rate, never written to the contextmap) from *why it was bound this way* (a catalyst materialized through a host adapter into an artifact — deliberation-rate, append-only). It also separates both of those from *what materials the operator has available right now* (their installed MCPs — present-state, replaceable), and from *what gets composed from those materials* (mcp-orbit workflows — recommendation + composition log, replaceable in-flight, sealed at materialization). Rare-call by design — expect 0–3 contextmap calls per session; declare inventory once at session start (and again only if the environment changes); research a vendor when the agent's first encounter with a provider warrants it; the composer fires whenever the user wants a non-bot workflow, not on a lifecycle cadence.

- **contextmap** (\`meta_context_brief\` / \`meta_context_commit\`) — the writeable, durable layer for the *why*. Append-only structural decisions sealed via typed commits (\`operator_kyc\`, \`operator_workspace_setup\`, \`artifact_materialization\`, \`primitive_artifact_materialization\`, \`app_materialization\`, \`trigger_artifact_materialization\`). Commit ONLY AFTER materializing the artifact, never to declare an intention.
- **inventory** (\`meta_context_declare_inventory\`) — the present-state MCP environment via introspection. Replace-semantic: the latest declaration is authoritative; previously declared tools not in the new call are wiped. The entry point for using mojulo without deploying a chatbot.
- **connected-service mirror** (\`declare_skills\`) — reflects the host adapter's skills into mojulo for observation (it never writes to your host). Replace-semantic sibling to inventory; the \`skill\` form plus the materialized mcp-orbit form make up the Connected Services paradigm.
- **capabilities** (\`record_mcp_capabilities\` / \`get_mcp_capabilities\`) — the research facet of a provider, written via primary-source research; transactional supersession preserves full history (\`asOf\` walks the chain). Both inventory and capabilities write into provider rows on a shared identity layer — one logical "Gmail" regardless of which path arrived at it.
- **composer** (\`recommend_mcp_orbit_compositions\` / \`get_meta_catalyst\` / \`list_mcp_orbit_components\` / \`get_mcp_orbit_component\`) — reads providers + capabilities + inventory through one consolidated view and decomposes a non-bot workflow into five typed component kinds (\`mcp\` × \`trigger\` × \`pattern\` × \`idempotency\` × \`render\`). Each chosen provider surfaces one of five states (\`research\` / \`seed\` / \`inventory_only\` / \`capabilities_only\` / \`none\`) as a constraint warning that routes remediation.
- **primitive + trigger binding** (\`bind_primitives\`, \`bind_trigger\` / \`unbind_trigger\` / \`list_triggers\` / \`get_trigger\`) — composer-anchored binding surfaces that resolve a typed \`component_ref\` and materialize a session-scoped artifact. \`bind_primitives\` fills a primitive's role template with the actual bound tool names + schemas from the operator's installed MCP; \`bind_trigger\` parks a payload template into the agent-tasks queue on cron cadence.
- **semantic recall** (\`semantic_search\`) — fuzzy lookup over durable mojulo state (principles, capability bodies, orbit components/compositions/artifacts, declared inventory tools, catalysts, and the visual card libraries — sketch vocab/methods, manji programs, painted-landscape glyphs) when you have an intent but not a specific ref. Pair the ranked refs with the structured readers above to pull full bodies.

**Runtime gating.** The pieces that actually *run* are opt-in daemons under the unified host (\`mojulo-daemons\`, gated by \`MOJULO_DAEMONS=enabled\`). Per-daemon gates: \`MOJULO_TRIGGER_RUNTIME=enabled\` (the scheduler that fires bound triggers) and \`MOJULO_APP_RUNTIME=enabled\` (the app runner that survives a control-plane restart). Without the host up, \`bind_trigger\` still persists durable rows but nothing fires until a later boot enables the runtime, and \`start_app\` / \`stop_app\` throw a clear error while reads degrade (\`list_running\` → \`[]\`, \`status_app\` → \`unknown\`). For App-paradigm inference the agent is the fulfiller (\`pull_agent_task\` → \`submit_envelope_inference\`); \`MOJULO_AGENT_RUNTIME=claude-code-headless\` swaps in an in-process node fulfiller. Mojulo holds no LLM credentials on the inference path. Each fire writes a \`trigger_firing\` principle and each inference an \`app_inference\` principle on the target artifact node — the alternating \`trigger_firing → app_inference\` chain is the operational signature of an autonomous run.`;

// --- Dashboard UI map (shared, promoted to its own tool) ---
//
// The page-by-page map of the `mojulo-ui` dashboard. The compressed TWO_FACES
// section above is the *trigger* ("there's a dashboard, suggest it when the
// user wants to look/browse/click"); this is the *reference* the agent loads
// on demand to point the user at the right page. The dashboard's relationship
// to the agent is "know when to point there," so this stays out of the
// always-paid forward_context body and lives behind get_ui_map.
//
// HAND-MAINTAINED: this map is not introspected from the route tree — update
// it when you add / rename / remove a dashboard page (the page set lives under
// control/app/*/page.jsx). Same staleness contract as the tool index.

const DASHBOARD_UI_MAP = `# Mojulo dashboard (\`mojulo-ui\`) — page map

The dashboard is the human-shaped face of the same \`~/.mojulo/\` state this MCP drives (launch with \`npx -y -p mojulo mojulo-ui\`, bound to 127.0.0.1). You don't drive these pages — you point the user at the right one when the visual surface beats reading tool output. The whole UI is fully internationalized — it ships in ~two dozen languages (including right-to-left scripts like Arabic, Farsi, and Urdu), switchable in \`/settings\`, so if the user isn't an English speaker, the dashboard almost certainly speaks their language. Current pages:

- **\`/\`** — home / agent-status landing. Where the operator lands; shows whether the host agent is connected and working.
- **\`/bots\`** — the bot fleet. Every saved bot config, its status/URL, build-to-ZIP, and the wizard form for minting a bot by setting fields directly (vs chat-builder turn-taking). \`/dashboard\` redirects here.
- **\`/chat-builder\`** — the conversational bot builder (Claude tool-use over SSE). The chat face of the same build tools this MCP exposes in Ring 1.
- **\`/apps\`** — the Apps pane. App-paradigm processes the agent materialized: lifecycle, per-app env vars, live MCP-sidecar introspection — read from the contextmap + local runner. Point here when the user asks "what apps are running?"
- **\`/data\`** — Fleet Data: Explorer / Analytics / SQL Explorer tabs over the fleet's rollups (conversation content never leaves each bot). Point here for "let me browse/scan the data" or ad-hoc SQL.
- **\`/map\`** — the whole fleet on two planes: apps + bots on the ground, MCP servers + connected services in the air. The big-picture "what do I have" view.
- **\`/graph\`** — App Creation Map: how an app comes together, each box a piece and each arrow what causes what. Point here for "how does mojulo make apps?" or to see where the four bindings live.
- **\`/plan\`** — Plan inbox (Ring 8): proposed work — sessions that became spikes. Read-only; New Plan opens a fresh host-agent session.
- **\`/research\`** — Research (Ring 9): books — broad material gathered to assist, accreted from the host agent.
- **\`/sketches\`** — the Sketches concern: diagrams, flows, charts, and scientific explanation. A tuned surface over the sketch primitive (\`create_sketch\` mints them); each is viewable at \`/sketches/<ref>\`.
- **\`/maker\`** — Mojulo Maker, the illustration concern and a sibling to Sketches (its own tuned, opinionated renderer). Two rails: **Illustrations** (\`/maker/illustrations\` — landscapes, figures, and complicated perspective/css3d/painterly renders) and **Motion** (\`/maker/motion\` — movies & gifs; \`/motion\` redirects here). An illustration is the SAME sketch primitive as a diagram, bucketed by \`manifest.kind\` — you can still stash, reference, and diff it. The bucket only decides which sibling concern owns it.
- **\`/mcp-skills\`** — MCP + Skills orchestration. **Coming soon** — don't over-promise this one to the user yet.
- **\`/settings\`** — provider keys (encrypted via AES-GCM, not plaintext \`.env\`), the UI language picker (~two dozen locales, incl. RTL), and builder config.

Default mode stays MCP — suggest a page only when the user wants to *look*, *browse*, or *click*, or when a visual scan would catch in a second something several rounds of tool output haven't.`;

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const SECTION_DIVIDER = '\n\n---\n\n';

// The body is register-INVARIANT except the disclosure directive — `register`
// only sets the communication-settings notice (so the agent knows which
// get_register_kit cell to expect). The glossary, opener, and substrate prose
// no longer branch here; they drawerize.
export function buildForwardContextBody({ register, disclosure, source } = {}) {
  const r = VOCABULARY_REGISTERS.includes(register) ? register : DEFAULT_VOCABULARY_REGISTER;
  const d = PROCEDURAL_DISCLOSURES.includes(disclosure) ? disclosure : DEFAULT_PROCEDURAL_DISCLOSURE;
  const standingRulesSection = `${STANDING_RULE_FLOOR}\n\n${DISCLOSURE_DIRECTIVE_VARIANTS[d]}`;
  return [
    HEADER,
    '',
    communicationSettingsNotice({ register: r, disclosure: d, source: source || 'defaults' }),
    '',
    LEAN_OPENER,
    SECTION_DIVIDER.trim(),
    ROUTING_INDEX,
    SECTION_DIVIDER.trim(),
    DRAWER_DIRECTORY,
    SECTION_DIVIDER.trim(),
    standingRulesSection,
    SECTION_DIVIDER.trim(),
    SAFETY_ONELINERS,
    '',
  ].join('\n');
}

// Resolve the operator anchor's register prefs once per call. Sync (better-
// sqlite3) and cheap (single PK lookup by `kind, ref`). Returns null if the
// DB isn't initialized (tests) or no anchor exists yet — caller falls back to
// per-call override → defaults.
function readOperatorRegisterPrefs() {
  try {
    const operator = MetaNodeRepository.findByRef('operator', 'self');
    if (!operator || !operator.payload || typeof operator.payload !== 'object') return null;
    return {
      vocabulary_register: operator.payload.vocabulary_register,
      procedural_disclosure: operator.payload.procedural_disclosure,
    };
  } catch {
    return null;
  }
}

// Resolve the active register/disclosure cell for a call: override > anchor >
// defaults, per axis independently. Shared by forward_context and
// get_register_kit so both honor the same operator anchor and the same
// per-call override semantics. Throws on an invalid override value.
function resolveRegisterPrefs(input) {
  const overrideRegister = input?.register;
  const overrideDisclosure = input?.disclosure;
  if (overrideRegister !== undefined && !VOCABULARY_REGISTERS.includes(overrideRegister)) {
    throw new Error(
      `\`register\` must be one of: ${VOCABULARY_REGISTERS.join(', ')} (got '${overrideRegister}')`,
    );
  }
  if (overrideDisclosure !== undefined && !PROCEDURAL_DISCLOSURES.includes(overrideDisclosure)) {
    throw new Error(
      `\`disclosure\` must be one of: ${PROCEDURAL_DISCLOSURES.join(', ')} (got '${overrideDisclosure}')`,
    );
  }

  // An override on only one axis combines with the anchor's value on the other
  // axis — same composition rule we'd want if we ever add `set_register` as its
  // own tool.
  const anchor = readOperatorRegisterPrefs();
  const register = overrideRegister ?? anchor?.vocabulary_register ?? DEFAULT_VOCABULARY_REGISTER;
  const disclosure =
    overrideDisclosure ?? anchor?.procedural_disclosure ?? DEFAULT_PROCEDURAL_DISCLOSURE;
  const source =
    overrideRegister !== undefined || overrideDisclosure !== undefined
      ? 'override'
      : anchor && (anchor.vocabulary_register || anchor.procedural_disclosure)
        ? 'operator_anchor'
        : 'defaults';
  return { register, disclosure, source };
}

export async function forwardContextHandler(input, _ctx) {
  const { register, disclosure, source } = resolveRegisterPrefs(input);
  const body = buildForwardContextBody({ register, disclosure, source });
  // Plain text content (not JSON-stringified) so the agent reads it as prose.
  return { content: [{ type: 'text', text: body }] };
}

// Register kit — the isolated register-tuning surface. Returns just the active
// communication-settings notice, the active-cell concept glossary, the
// active-cell disclosure directive, and the invariant commitment-level floor.
// The standalone tool exists for agents that want only the register surface
// without rereading the whole orientation; forward_context still mirrors the
// glossary + floor + disclosure inline.
export function buildRegisterKitBody({ register, disclosure, source } = {}) {
  const r = VOCABULARY_REGISTERS.includes(register) ? register : DEFAULT_VOCABULARY_REGISTER;
  const d = PROCEDURAL_DISCLOSURES.includes(disclosure) ? disclosure : DEFAULT_PROCEDURAL_DISCLOSURE;
  return [
    '# Mojulo register kit',
    '',
    communicationSettingsNotice({ register: r, disclosure: d, source: source || 'defaults' }),
    SECTION_DIVIDER.trim(),
    CONCEPT_GLOSSARY_VARIANTS[r],
    SECTION_DIVIDER.trim(),
    STANDING_RULE_FLOOR,
    '',
    DISCLOSURE_DIRECTIVE_VARIANTS[d],
    '',
  ].join('\n');
}

export async function registerKitHandler(input, _ctx) {
  const { register, disclosure, source } = resolveRegisterPrefs(input);
  return { content: [{ type: 'text', text: buildRegisterKitBody({ register, disclosure, source }) }] };
}

export async function toolIndexHandler(_input, _ctx) {
  return { content: [{ type: 'text', text: TOOL_INDEX }] };
}

export async function deliberationOverviewHandler(_input, _ctx) {
  return { content: [{ type: 'text', text: DELIBERATION_OVERVIEW }] };
}

export async function uiMapHandler(_input, _ctx) {
  return { content: [{ type: 'text', text: DASHBOARD_UI_MAP }] };
}

export async function substrateHandler(_input, _ctx) {
  return { content: [{ type: 'text', text: PLAYFUL_CLOUD }] };
}

// Back-compat for any importer (mostly tests) that wants today's default body
// without going through the handler. Renders the `mixed + reflective` cell —
// matches the body shape the tool emitted before register tuning landed.
export const FORWARD_CONTEXT_BODY = buildForwardContextBody({
  register: DEFAULT_VOCABULARY_REGISTER,
  disclosure: DEFAULT_PROCEDURAL_DISCLOSURE,
  source: 'defaults',
});

// Returned by `custom_protocol`. Synthesized from docs/protocol-composition.md
// for the MCP audience — a Claude Code session connected to mojulo whose user
// wants to think through a new bot capability that fires inside a turn. The
// audience doesn't have the mojulo repo, the composer, or the existing
// cartridges on disk; this body has to carry the mental model self-contained.
//
// Exported for tests.
export const CUSTOM_PROTOCOL_GUIDE = `# Designing a mojulo protocol — author's guide

You are about to help the user think through a new mojulo **protocol** — a bot capability that fires inside a conversation, on every reply, in the LLM's envelope. Five ship today (\`knowledge\`, \`formGathering\`, \`appointments\`, \`triage\`, \`opticalRead\`). A new one is a code change to mojulo, not a config tweak, and it ripples through the cartridge composer, the response envelope, the wizard, and the chat builder.

If you're unclear on protocol vs. catalyst vs. skill, call \`forward_context\` first — those three terms overlap, and protocol design goes sideways fast if they're not kept distinct.

---

## Step 0 — Posture check (push back here, before designing anything)

Protocols are a heavier commitment than catalysts. Many requests that *sound* protocol-shaped are actually catalysts; a few are identity-prompt tweaks. Walk these before drafting.

**A protocol is the wrong tool if any apply:**

1. **The work happens after the conversation.** Pushing form submissions to a CRM, summarizing a week of chats, scanning logs for signal — these run on already-captured data; the bot has nothing to do with them during a turn. → **catalyst.**
2. **The work is operator- or scheduler-initiated.** "Once a week, email me a digest", "when someone fills the form, file a ticket" — the end user shouldn't have to trigger it by talking to the bot. → **catalyst.**
3. **The work touches external systems with credentials.** CRM, ticketing, calendar, Slack, docs. Mojulo deliberately keeps integration credentials in Claude Code (where the user's MCP servers live), not in the bot's runtime — adding them to a protocol would invert that architecture for one capability. → **catalyst.**
4. **The capability is bespoke to one client, vertical, or workflow.** Upstream protocols have to clear a broader-applicability bar (the existing five did). One-off needs belong in a fork or as catalyst-synthesized skills. → **fork or skill.**
5. **The work is purely about how the bot phrases something.** "Be more empathetic", "ask a follow-up before answering" — that's the identity prompt or the objective string, not a new protocol. → **\`compose_identity\` or bot objective.**

If any apply, name it explicitly to the user and route them — don't try to fit the request into a protocol shape.

**Example pushback:**

> User: "I want a protocol that emails me whenever someone fills out the form."
>
> You: That's catalyst-shaped, not protocol-shaped — the work happens *after* the conversation, it's operator-initiated, and it touches an external system with credentials. The \`formGathering\` protocol you already have captures the submission; a catalyst is what routes the captured data outward. Want me to walk you through \`recommend_catalysts\` instead? If you want to *contribute* a new catalyst back to mojulo's library, that's \`custom_catalyst\`.

---

## The mental model — three properties that drive the design

If your protocol idea violates any of these, the design is probably wrong. Test against all three before drafting.

1. **Stackable, not switched.** Bots are rarely "just knowledge" or "just forms." A clinic bot wants knowledge + forms + appointments; a concierge wants knowledge + triage. The composer takes an \`{ knowledge, formGathering, appointments, triage, opticalRead, <yours> }\` toggle map and **concatenates** the matching cartridges. Adding a sixth capability is a new file + a registry entry, not a refactor.
2. **Prose AND response shape come out together.** Every protocol that asks the LLM to *do* something also adds *fields the LLM must return*. Forms need \`formTracker\`. Appointments need \`calendarId\`. Triage needs \`deploymentId\`. Optical-read needs \`extractedFields\`. If your protocol adds new behavior but no envelope fields, you don't have a protocol — you have an identity-prompt tweak. If it adds new fields, both halves get composed from the same toggle map and ship as one document.
3. **The artifact is the contract.** The wizard and chat builder are convenience layers; they produce the same \`instructions.txt\` + envelope a hand-author would. So the engineering question for a new protocol is narrow: **can you get an LLM to emit your new top-level envelope field reliably, given a hand-crafted prompt?** If yes, the wiring through the composer and builders is mechanical. If no, no amount of plumbing fixes flaky prose.

---

## Step 1 — Validate the intent loop on hand-authored instructions, BEFORE touching the composer

This is the single most load-bearing piece of protocol design and the step that gets skipped most often. Steps 2-onward wire a *working* cartridge into the system; they do not make a flaky cartridge less flaky.

**What "the intent loop" means:** a turn comes in, the LLM reads \`instructions.txt\`, matches the user's input against your protocol's inline data, and emits an envelope with your new top-level field (\`yourField\`, \`appointment.calendarId\`, \`triage.deploymentId\`) **populated when expected and empty otherwise**.

Validate this **without** the composer, **without** the wizard, **without** the chat builder, on an unzipped \`lite-template/\`:

1. Hand-author \`config/instructions.txt\`: start with the contents of \`00_base.txt\` (the safety floor every bot ships with), append your cartridge prose, then your inline data pasted under a \`## <YOUR_PROTOCOL>\` header, then a \`## RESPONSE FORMAT PROTOCOL\` block listing your new field alongside \`answer\` and \`suggestions\`.
2. Point \`config/config.json\` at an **OpenAI or Ollama** provider. **Do NOT use Anthropic for this step.** Anthropic's forced tool use enforces the canonical envelope schema with \`additionalProperties: false\` and silently drops fields you haven't added there yet — you'll think your protocol is broken when actually the wire layer is filtering it. OpenAI and Ollama extract via prose, so they pass new fields through unchanged.
3. \`npm install && npm start\`, POST to \`/api/chat\`, inspect responses. Tune cartridge prose and inline-data shape until your field fires consistently on the inputs you expect and stays empty on the ones you don't.

Encourage the user to do this **before** any composer/wizard wiring. If they can't get the intent firing here, every other step is wasted work. The composer just hands the same prompt to the same model.

---

## Step 2 — Design the inline data shape

Each existing protocol ships per-deploy data alongside its prose, **stripped to the minimum the LLM needs**:

- \`formGathering\` → form structure stripped to \`id, label, condition, required\`. Field types, validation, UI hints stay on the frontend.
- \`appointments\` → calendar destinations as-is (small shape, no leakable secrets).
- \`triage\` → routes stripped to \`deploymentId, name, description\`. The \`url\` field is **deliberately excluded** — it's a client-side redirect handle, and keeping it out of the prompt prevents the LLM from emitting raw URLs in \`answer\` text.
- \`opticalRead\` → extraction fields stripped to \`idName, label, hint\`. Wizard widget metadata stays out.

For the user's protocol, design a \`build<Name>Section()\` helper that takes per-deploy config and returns either a header + JSON section or an empty string on missing/invalid input. **Strip aggressively.** Never leak URLs, credentials, or rendering-side metadata into the prompt — they cost tokens and tempt the LLM to leak them back out in \`answer\`.

---

## Step 3 — Design the response attribute group

If the protocol adds envelope fields (it almost certainly does — that's the engineering question of step 1), it adds a \`<NAME>_ATTRIBUTES\` group to the response-builder. **Use inline descriptions as values**, not a separate description block:

\`\`\`js
const YOUR_ATTRIBUTES = {
  yourField: 'description of what the LLM should put here',
  yourFlag: 'true/false',
  // ...
};
\`\`\`

The LLM sees the field name AND a hint about what to put there in one place. Easier to keep in sync than two parallel documents.

Watch for the \`suggestions\` collision pattern: \`formGathering\` and \`triage\` both override the core \`suggestions\` description with one specific to that protocol. Last write wins in protocol order. If the user's protocol has its own preferred phrasing for \`suggestions\`, mention this — they may want to override.

Knowledge protocol adds **no** response attributes — it shapes how \`answer\` should be written (paragraph length, RAG anchoring) but doesn't introduce new fields. That's a legitimate shape too, but rarer; most useful protocols emit at least one new envelope field.

---

## Step 4 — Map the touch points

A new protocol, end to end, touches these files:

| File | What to add |
|---|---|
| \`control/lib/composer/protocols/XT_<name>.txt\` | The cartridge prose. Imperative voice, blunt, no preamble — written for the LLM, not for a human reader. |
| \`control/lib/composer/composer.js\` | Entries in \`PROTOCOL_FILES\` (the toggle-to-file map) and \`PROTOCOL_ORDER\` (the deterministic stacking order). If the protocol needs inline data, write a \`build<Name>Section()\` helper here too. |
| \`control/lib/composer/response-builder.js\` | The \`<NAME>_ATTRIBUTES\` group from step 3 + a conditional \`Object.assign\` in \`buildResponseFormatSection\` keyed on the toggle. |
| \`lite-template/helper/envelope-schema.js\` | Add the new top-level fields to the canonical envelope. **Without this, Anthropic forced tool use silently drops them at the wire.** |
| \`control/lib/envelope-schema.js\` | **Mirror the same change.** This file is duplicated by hand — there is no shared layer between control plane and bot runtime. Missing the mirror is a common rake. |
| Wizard step + chat-builder tool | Both write to the same \`enabledProtocols.<name>\` toggle and the same \`protocolData.<name>\` bucket so the composer doesn't care which builder produced the config. |
| \`control/lib/llm-providers.js\` (maybe) | Decide whether \`RESTRICTED_OLLAMA_MODELS\` (qwen3, mistral-nemo) can run the new protocol. If it's tool-use-heavy (multi-step state tracking like forms / appointments / triage / optical-read), leave the allowlist alone and it's implicitly gated off for small Ollama models. If it's knowledge-style (RAG + free text, no multi-step state), add the protocol ID to the allowlist. |

What you do **not** touch: the deployer, the bot runtime, the prompt assembler, the response parser. Past \`composeInstructions\`, nothing branches on which protocols are on. The composed \`instructions.txt\` is the contract, and a new file with a new toggle is enough.

---

## Step 5 — Hand off

When you've walked the user through the design, tell them:

- This is a **code change to mojulo**, not a config — there are two paths:
  - **Fork.** Keep the protocol in the user's fork; deploy bots from there. Right path for bespoke / client-specific capabilities.
  - **Upstream PR** against https://github.com/zombico/mojulo. The bar is "broader applicability than one workflow." The existing five cleared it; a sixth has to too.
- The most likely failure mode is **skipping step 1** (validating the intent loop on hand-authored instructions). Encourage the user to prove the intent fires on OpenAI or Ollama before wiring anything else.
- The second most likely failure mode is **forgetting the envelope-schema mirror**. Both files have to change in lockstep, or Anthropic deploys silently drop the new fields.
- If the user is not confident their idea clears the upstream bar, point them at the catalyst path instead — local skills synthesized from catalysts cover the "I want this for my specific bot" case without changing mojulo's runtime.

---

## Anti-patterns — things NOT to do

- **Don't add credentials or destination URLs to the cartridge prose or inline data.** Those belong in catalysts, not protocols. The architecture deliberately keeps the bot runtime free of integration credentials so the bot stays portable.
- **Don't add a protocol that only rewords the bot's answer.** Identity prompts and the objective string handle phrasing. A protocol is justified by *new envelope state* or *new multi-turn structure*, not by tone.
- **Don't propose a protocol when you mean a catalyst.** Walk Step 0 carefully. "I want my bot to send X to Y" is almost always a catalyst.
- **Don't skip the envelope-schema mirror.** Update both \`lite-template/helper/envelope-schema.js\` AND \`control/lib/envelope-schema.js\`. Anthropic enforces the canonical schema at the wire; missing fields are dropped silently and the bot looks broken with no error.
- **Don't ship a protocol whose intent loop only works on one model.** A capability that fires reliably on gpt-5 but flakes on Claude Sonnet 4.5 isn't ready. Tune the cartridge prose until it works across the providers mojulo supports — or scope the protocol to the providers that can carry it.

---

## Final reminders

- **The cartridge prose is read by an LLM, not a human.** Short lines, imperative voice, no preamble. Look at the existing five cartridges for the texture — bluntness is a feature.
- **Stripping is a discipline.** Every byte in the prompt either earns its tokens by helping the LLM make a decision, or it doesn't. Inline-data helpers exist to strip aggressively.
- **The artifact is the contract.** A bot whose \`instructions.txt\` was written by hand is indistinguishable at runtime from one the wizard produced. The composer, wizard, and chat builder exist for ergonomics; they don't improve how reliably the intent fires.
`;

export async function customProtocolHandler(_input, _ctx) {
  // Plain text content (not JSON-stringified) so the agent reads it as prose.
  return { content: [{ type: 'text', text: CUSTOM_PROTOCOL_GUIDE }] };
}

// Reads at call time so a runtime env change (e.g. user toggles
// MOJULO_OFFLINE_BUILD) shows up without a process restart. The BOT_IMAGE
// default mirrors lib/deployers/docker.js — when that pin moves, this one
// should too, but a stale display here just means the tool reports the
// older tag; deploys still use the docker.js value.
const DEFAULT_BOT_IMAGE = 'ghcr.io/zombico/mojulo-bot:0.5.1';

export async function versionHandler(_input, _ctx) {
  const payload = {
    server: { name: SERVER_NAME, version: getServerVersion() },
    protocolVersion: PROTOCOL_VERSION,
    node: process.version,
    platform: { os: process.platform, arch: process.arch },
    botImage: process.env.BOT_IMAGE || DEFAULT_BOT_IMAGE,
    offlineBuild: process.env.MOJULO_OFFLINE_BUILD === '1',
    mojuloHome: process.env.MOJULO_HOME || null,
  };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function controlPlaneInstallHint(latest, sourceClone) {
  if (sourceClone) {
    return `Running from a source clone — \`git pull\` (and \`npm install\` in control/) to pick up ${latest}.`;
  }
  return `Run \`npm i -g mojulo@${latest}\` (or restart with \`npx -y mojulo@${latest}\`) to upgrade.`;
}

function botImageUpdateHint(repo, latestTag) {
  return `Bump \`BOT_IMAGE\` in control/.env to \`${repo}:${latestTag}\` (and the matching constant in control/lib/deployers/docker.js), then rebuild affected bots.`;
}

export async function checkForUpdatesHandler(_input, _ctx) {
  const pkgName = getControlPlanePackageName();
  const localVersion = getControlPlaneVersion();
  const { image, source } = getBotImagePin();
  const { repo, tag: localTag } = parseImageRef(image);
  // Strip the leading registry host so the GHCR API receives just `owner/name`.
  // E.g. `ghcr.io/zombico/mojulo-bot` → `zombico/mojulo-bot`.
  const ghcrRepo = repo.startsWith('ghcr.io/') ? repo.slice('ghcr.io/'.length) : repo;

  const [npmResult, ghcrResult] = await Promise.all([
    fetchLatestNpmVersion(pkgName),
    fetchLatestGhcrTag(ghcrRepo),
  ]);

  const warnings = [];
  if (npmResult.error) warnings.push(npmResult.error);
  if (ghcrResult.error) warnings.push(ghcrResult.error);

  const cpUpdate =
    npmResult.version !== null && compareSemver(localVersion, npmResult.version) < 0;
  const botUpdate =
    ghcrResult.tag !== null && localTag !== null && compareSemver(localTag, ghcrResult.tag) < 0;

  const payload = {
    controlPlane: {
      package: pkgName,
      current: localVersion,
      latest: npmResult.version,
      updateAvailable: cpUpdate,
      sourceClone: isSourceClone(),
      installHint: cpUpdate ? controlPlaneInstallHint(npmResult.version, isSourceClone()) : null,
    },
    botImage: {
      currentPin: image,
      pinSource: source,
      repo,
      currentTag: localTag,
      latestTag: ghcrResult.tag,
      updateAvailable: botUpdate,
      updateHint: botUpdate ? botImageUpdateHint(repo, ghcrResult.tag) : null,
    },
    warnings,
  };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

export function registerContextTools() {
  registerTool({
    name: 'forward_context',
    description:
      "Forward the agent mojulo's routing index: a lean opener, a `user-framing → entry-tool` table that maps a request onto its starting tool, a directory of drawers to pull for depth (`get_tool_index` full per-tool index, `get_register_kit` concept glossary + register, `get_deliberation_overview` Ring 6, `get_ui_map` dashboard pages, `get_substrate` cloud positioning), and the standing safety + commitment-level rules. A thin map, not a manual — the glossary, lifecycle detail, and substrate philosophy live in the drawers, not here. Call this FIRST whenever the user asks what mojulo is or which tool to pick, or whenever you feel uncertain which entry point fits — then drill into one drawer if the task needs it. The disclosure directive branches on the operator's `procedural_disclosure`; the body is otherwise register-invariant (the active `vocabulary_register` is reported in the settings notice, and the glossary that varies on it lives in `get_register_kit`). Optional per-call `register` / `disclosure` override the operator anchor for this one read. Read-only, idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        register: {
          type: 'string',
          enum: VOCABULARY_REGISTERS,
          description:
            "Override the operator's `vocabulary_register` for this one call. 'plain' (everyday tool names, no mojulo jargon to the user), 'mixed' (default), 'mojulo' (full idiom). Omit to use the operator anchor's setting or the system default.",
        },
        disclosure: {
          type: 'string',
          enum: PROCEDURAL_DISCLOSURES,
          description:
            "Override the operator's `procedural_disclosure` for this one call. 'terse' (act and report), 'reflective' (default — name each gate), 'pedagogical' (explain what each gate means). Omit to use the operator anchor's setting or the system default.",
        },
      },
    },
    handler: forwardContextHandler,
  });

  registerTool({
    name: 'get_tool_index',
    description:
      "Return the full one-line-per-tool index across every ring (orientation, build, operate, fleet, catalysts, deliberation, apps + daemons, plan mode). `forward_context` carries only a compact `user-framing → entry-tool` routing index to keep its body small; call this when a routing row isn't specific enough and you need to know exactly which tools exist and what each one does. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: toolIndexHandler,
  });

  registerTool({
    name: 'get_register_kit',
    description:
      "Return just the register-tuning surface — the active communication-settings notice (which `vocabulary_register` / `procedural_disclosure` cell is active and where it came from), the active-cell concept glossary, the active-cell disclosure directive, and the invariant commitment-level floor (the four gates). Resolves the operator anchor the same way `forward_context` does; optional per-call `register` / `disclosure` override it for this one read. Call once after orientation, or whenever the operator revises their KYC anchor and you want the refreshed glossary phrasing without rereading the whole briefing. Read-only, idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        register: {
          type: 'string',
          enum: VOCABULARY_REGISTERS,
          description:
            "Override the operator's `vocabulary_register` for this one call. 'plain', 'mixed' (default), 'mojulo'. Omit to use the operator anchor's setting or the system default.",
        },
        disclosure: {
          type: 'string',
          enum: PROCEDURAL_DISCLOSURES,
          description:
            "Override the operator's `procedural_disclosure` for this one call. 'terse', 'reflective' (default), 'pedagogical'. Omit to use the operator anchor's setting or the system default.",
        },
      },
    },
    handler: registerKitHandler,
  });

  registerTool({
    name: 'get_deliberation_overview',
    description:
      "Return the why-it's-structured-this-way explainer for the Ring 6 deliberation surfaces (contextmap, inventory, connected-service mirror, capabilities, the mcp-orbit composer, primitive + trigger binding, semantic recall) plus the daemon runtime-gating posture (`MOJULO_DAEMONS` / `MOJULO_TRIGGER_RUNTIME` / `MOJULO_APP_RUNTIME` / `MOJULO_AGENT_RUNTIME`). Most sessions never touch Ring 6, so this deep block lives behind its own tool rather than in `forward_context`. Call when doing structural / non-bot work (MCP-to-MCP wiring, scheduled triggers, apps) and you want the separation-of-concerns model before composing. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: deliberationOverviewHandler,
  });

  registerTool({
    name: 'get_ui_map',
    description:
      "Return the page-by-page map of the `mojulo-ui` dashboard (the human-shaped face of the same `~/.mojulo/` state this MCP drives): one line per page describing what it's for and when to point the user at it (`/bots`, `/chat-builder`, `/apps`, `/data`, `/map`, `/graph`, `/plan`, `/research`, `/sketches`, `/maker`, `/settings`, …). You don't drive these pages — call this when the user wants to *look*, *browse*, or *click*, or when a visual scan would beat several rounds of tool output, so you can name the right page. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: uiMapHandler,
  });

  registerTool({
    name: 'get_substrate',
    description:
      "Return mojulo's substrate positioning — the PLAYful Cloud framing (PLAY = Persistent · Local · Agent-Yoked), which cloud verbs mojulo borrows (composition, always-on, typed surfaces, audit trail, vendor-interchangeable-behind-a-shape) versus the ones it deliberately doesn't claim (auto-scaling, multi-region, multi-tenancy, IAM, per-call billing), the tri-staff (primitives / catalysts / app-builder assistant), and how the three artifacts map to cloud shapes (Bot ~ service, Skill ~ function, App ~ Temporal-style durable worker). Most sessions never need this; call it when the user compares mojulo to cloud primitives (Lambda / Cloud Run / Kubernetes / Heroku / Temporal), asks 'is this self-hosted cloud?', or asks 'what is this really?'. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: substrateHandler,
  });

  registerTool({
    name: 'version',
    description:
      'Report runtime versions: server name + version (from package.json), MCP protocol version, Node version, platform os/arch, the pinned bot container image tag, whether MOJULO_OFFLINE_BUILD is on, and the active MOJULO_HOME. Use this to diagnose version mismatches between a user-reported issue and what their control plane is actually running, or to confirm a version bump landed after a publish. Read-only, no inputs, idempotent.',
    inputSchema: { type: 'object', properties: {} },
    handler: versionHandler,
  });

  registerTool({
    name: 'check_for_updates',
    description:
      "Compare the running control-plane package (`mojulo` on npm) and the pinned bot image (`ghcr.io/zombico/mojulo-bot`) against their latest published versions. Returns `{ controlPlane, botImage, warnings }` — each surface reports `current`, `latest`, `updateAvailable`, and a one-line install/update hint when an upgrade exists. Read-only: never installs or restarts anything; surface the hint and let the user run it. Best-effort upstream calls — a registry timeout produces `latest: null` plus a warning, not a tool failure. Call this when the user asks 'am I up to date?', after a long gap between sessions, or before recommending a feature that depends on a recent version.",
    inputSchema: { type: 'object', properties: {} },
    handler: checkForUpdatesHandler,
  });

  registerTool({
    name: 'custom_protocol',
    description:
      "Author's guide for designing a new mojulo PROTOCOL — a bot capability that fires inside a conversation (every turn, in the LLM's envelope). Use when the user wants to extend what their bot does *during a turn*: new intent class, new structured-data collection shape, new envelope-driven UI affordance, new modality. Do NOT call for *after-conversation* work (CRM sync, digests, scans, ticket-on-signal) — that's catalyst-shaped, route to `recommend_catalysts` / `custom_catalyst`. The guide opens with a posture check (protocol vs. catalyst vs. identity-prompt-tweak — the common misfire is calling this when the user wants a catalyst), then the mental model and touch-point map. Output is a design the user takes to a fork or upstream PR — not a single file like `custom_catalyst` produces.",
    inputSchema: { type: 'object', properties: {} },
    handler: customProtocolHandler,
  });
}
