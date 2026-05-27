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
 * - Glossary first: every mojulo-specific noun gets defined the first time it
 *   appears. The reviewer feedback that prompted this layout: the agent
 *   shouldn't have to read tool descriptions to disambiguate vocabulary.
 * - Tool index has to stay in sync with the actual tool registrations across
 *   build.js, jobs-tools.js, operate.js, fleet.js, catalysts.js, adapters.js,
 *   meta-context.js, and this file. If you add or remove a tool, update the
 *   relevant section here too.
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
// forward_context — register-aware composer
//
// The body is assembled from a small set of variant tables (axis 1 =
// vocabulary_register; axis 2 = procedural_disclosure) plus a large shared
// spine. Only the prose that actually carries register voice branches:
//   - Opening orientation paragraph (axis 1)
//   - Concept glossary prose (axis 1)
//   - Procedural disclosure directive inside the standing-rules block (axis 2)
// Everything else — lifecycle, tool index, two-faces, secrets, verification,
// catalyst texture, quick-orientation rules — is single-source. Concept
// *names* never branch (the agent uses them to call tools).
//
// See lite-template/integration/REGISTER_TUNING_PLAN.md.
// ---------------------------------------------------------------------------

const HEADER = '# Mojulo, oriented';

// Dual-purpose preamble — names forward_context's two readers (agent +
// system). Replaces the older "cognitive assistance" directive; the new
// register signal does that work better.
const DUAL_PURPOSE_PREAMBLE = `*This document plays two roles. As an **agent** you're reading it for orientation — the concept glossary, the lifecycle, and the tool index below tell you which mojulo surface to reach for and in what order. As a **system reader** (a contributor adding a tool, the future \`meta_context_arbitrate\` coherence pass) you're reading it as mojulo's canonical reference for what's in the surface, what isn't, and how the pieces are supposed to fit. Both readers see the same body; the dual purpose just means edits here are also edits to mojulo's self-description, not only its onboarding text.*`;

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
  return `*Active communication settings: \`vocabulary_register: ${register}\`, \`procedural_disclosure: ${disclosure}\` (${sourceNote}). The opening paragraph, concept glossary, and disclosure directive below reflect these settings. Concept names and tool descriptions themselves are invariant — only the prose around them branches.*`;
}

// --- Opening orientation paragraph variants (axis 1: vocabulary_register) ---

const OPENING_MIXED = `Mojulo is a control plane for solutions composed over the tools the user already runs (CRM, calendar, ticketing, drive, warehouse). It serves **two axes**, and the right path depends on whether the user wants a conversational surface in the picture:

- **Chatbot-based.** Build a chatbot, deploy it where users can reach it, let it collect conversations and form submissions, then turn what it captured into action via the user's installed destination MCPs (Gmail, Drive, the user's CRM, etc.). The mainline framing below — the Concepts, the Lifecycle (build → deploy → connect → operate), the Build / Operate / Catalysts tool sections — is shaped around this axis. **Most mojulo work lives here.**
- **MCP-orchestrated workflows (no chatbot in the picture).** When the user wants outcomes without a conversational surface — weekly Linear digests, signal-driven Gmail-to-Linear routing, scheduled report generation, MCP-to-MCP wiring of any kind — the **mcp-orbit composer** decomposes the workflow into five typed component kinds (\`mcp\` × \`trigger\` × \`pattern\` × \`idempotency\` × \`render\`) the agent assembles directly over the operator's installed MCPs. Each \`mcp\` component declares an \`affordances\` map (read / write / watch); \`source\` and \`destination\` are composition ROLES carried per-entry in \`component_refs\`, so the same Gmail MCP can play source in one composition and destination in another. Mojulo's role on this axis is the deliberation anchor and audit trail (operator KYC + composition log + contextmap commit), not the runtime. The flow starts at \`meta_context_declare_inventory\` (tell mojulo what MCPs are connected) → \`recommend_mcp_orbit_compositions\` (get ranked candidate compositions) → \`get_meta_catalyst\` + per-component bodies → assemble + dry-run + \`meta_context_commit\`. See the Deliberation (Ring 6) section below for the surface.

The two axes share downstream: both end in a host-adapter materialization (a Claude Code skill, a Codex automation, a generic workflow file) sealed via \`meta_context_commit\`. The difference is what flows in — a deployed bot's captured signal on the first axis, the operator's installed MCPs on the second.

**Recognize the axis from the user's framing.** Phrases like "build a bot," "deploy this for my customers," "what should this bot do," "what can I do with this bot" → chatbot axis. Phrases like "use mojulo without a bot," "MCP to MCP," "every Monday morning summarize X into Y," "when X happens in MCP-A, do Y in MCP-B" → mcp-orbit axis. When in doubt, ask the user whether the workflow needs a conversational surface; the answer routes the rest of the session.`;

const OPENING_PLAIN = `Mojulo helps the user turn the tools they already use — Gmail, their calendar, Drive, Linear, their CRM — into automated workflows they can audit. The user tells you what outcome they want; you wire it up against the tools they've connected; you try it on a real example before turning it on for keeps.

Two starting points to recognize:

- **A chatbot.** The user wants a chatbot that talks to their customers and captures what those customers need (questions, bookings, lead info). Then mojulo connects what the bot captured to the user's other tools.
- **A workflow without a chatbot.** The user wants one of their tools wired to another — every Monday, the new Linear issues land in a Drive doc; every Gmail thread about a refund opens a ticket; that kind of thing.

The full set of mojulo surfaces is in the tool index below.

*For your reasoning only — don't surface to the user:* the two starting points are mojulo's "chatbot vs mcp-orbit" axes. Listen for the user's framing — "build a bot / deploy this for my customers" → chatbot axis (mainline Build → Deploy → Connect → Operate tools below). "Every Monday / when X happens in Gmail" → mcp-orbit axis (\`meta_context_declare_inventory\` first, then \`recommend_mcp_orbit_compositions\` or \`bind_primitives\`). When unclear, ask the user whether the work needs a conversational surface; that answer routes the rest of the session. Both axes end the same way under the hood: a host-adapter materializes the runnable artifact, and \`meta_context_commit\` seals the decision — but don't say "host adapter" or "materialize" to the user; say "build the automation" and "save it to your audit trail."`;

const OPENING_MOJULO = `Mojulo is a control plane for solutions composed over installed MCPs. Two axes: chatbot-based (build → deploy → connect → operate, catalysts close the loop into destination MCPs) and mcp-orbit (composer over \`mcp × trigger × pattern × idempotency × render\` against declared inventory; \`bind_primitives\` for runtime-introspected primitive bindings). Both terminate in host-adapter materialization sealed via \`meta_context_commit\`.

Standing rules below. Tool index follows.`;

const OPENING_PARAGRAPH_VARIANTS = {
  plain: OPENING_PLAIN,
  mixed: OPENING_MIXED,
  mojulo: OPENING_MOJULO,
};

// --- Two faces (shared) ---

const TWO_FACES_ONE_STATE = `## Two faces, one state

Mojulo ships two binaries against the same \`~/.mojulo/\` state:

- **\`mojulo\`** — this MCP, the agent-shaped face. You're talking to it right now. Build via chat, drive operations programmatically.
- **\`mojulo-ui\`** — a local Next.js dashboard, the human-shaped face. Bound to 127.0.0.1, launched with \`npx -y -p mojulo mojulo-ui\`. Reads the same SQLite at \`~/.mojulo/data/mojulo-lite.db\` via WAL mode, so the two run side-by-side and a bot you minted via MCP shows up in the dashboard's fleet view immediately.

Suggest the dashboard when the user asks for something the visual surface does better:

- **Browse** conversations or submissions interactively (filter, scroll, scan) rather than paging through tool output.
- **Mint** a bot via the wizard form rather than chat-builder turn-taking — useful when the user wants to set fields directly without describing them.
- **Try** a bot they just built — \`mojulo-ui\` runs a live chat preview in the wizard before deploy, and once deployed, opening the bot's URL in a browser drops the user into the same widget their customers see. Suggest this right after \`save_modular_bot\` finishes — the natural next thing is "let me kick the tires."
- **Inspect** fleet analytics as charts rather than JSON tables.
- **Manage** deploys (re-build, rotate keys via Settings, manually trigger cloud-deploy) by clicking rather than orchestrating tool calls.

The default mode is still MCP — don't push the dashboard for tasks that work fine in chat. Suggest it when the user explicitly wants to *look*, *browse*, or *click*, or when you've exhausted a few rounds of tool output and they're still missing something a visual scan would catch in a second.`;

// --- Paradigms (shared) ---
//
// Pattern-recognition aid for the agent: three artifact kinds ship today,
// each with a distinct shape, runtime, and surface. The two-axes opening
// above describes mojulo's architectural axes (chatbot-based vs
// mcp-orbit); this section names the user-recognizable *things you can
// materialize* and the trigger phrases that map a user request onto each.
// Apps in particular don't fit cleanly into either axis — they're a third
// paradigm that arrived in 0.8.0, and agents miss them silently if they
// only know to recognize "bot" or "automation."

const PARADIGMS = `## Paradigms — three things mojulo materializes

Recognize the shape of the user's ask before reaching for any tool. Three
artifact kinds ship; they have different lifecycles, different runtimes, and
different surfaces.

- **Bot** — chatbot deployed as its own process (local Docker, or Fly.io). Owns its SQLite; conversation and submission data never leaves it. *Triggers:* "build a bot," "deploy this for my customers," "lead capture / triage / knowledge agent." Lifecycle: build → deploy → connect → operate (see *Lifecycle* below). Surfaces: Build, Operate, Catalysts.
- **Skill** — workflow synthesized into the user's host adapter as a runnable artifact (a \`SKILL.md\` under \`.claude/skills/\`, a Codex automation, a generic \`workflow.md\` + runner). Composed from a catalyst + the user's installed MCPs + (optionally) a deployed bot's captured signal. *Triggers:* "every Monday do X," "when a Gmail thread matches Y, file a ticket," "weekly digest of Z," "use mojulo without a bot." Surfaces: Catalysts, Deliberation (mcp-orbit, primitive-binding).
- **App** — local process the control plane spawns and lifecycle-manages, paired with its own MCP sidecar. Does work on the user's machine and parks inference back on the operator's agent via the agent-tasks queue — no per-app LLM credentials, no inference on the deployed runtime. *Triggers:* "build me a thing that watches X," "a tool on my machine that does Y in the background," "I want something that processes Z and asks me when it needs to think," "image extraction / batch processing / a local watcher / a long-running background job." Surfaces: Ring 7 runner (\`install_scaffold\`, \`start_app\`, \`stop_app\`), agent-tasks queue (\`pull_agent_task\`, \`submit_envelope_inference\`), and \`meta_context_commit({type:'app_materialization'})\`.

**Composition surface (for orientation).** The dashboard's \`/graph\` page renders the App creation map — every piece an app is composed of, every MCP tool that snaps the pieces together, in a friendly or technical register. Useful when the user asks "how does mojulo make apps?" or you want a structural picture of where the bindings (runner / durability / inference / mcp_self) live in the flow. The composition surface for bots and skills isn't dashboard-rendered yet; their shape lives in *Lifecycle* + the tool index below.`;

// --- Secrets handling (shared) ---

const SECRETS_HANDLING = `## Secrets handling (standing rule)

A compiled mojulo bot ships a \`.env\` containing the bot's auto-generated \`MOJULO_API_KEY\` (gates the bot's \`/api/conversations\` admin endpoints). After unzip, the user is expected to paste their LLM provider key (Anthropic / OpenAI / AWS / etc.) into the same \`.env\` before \`docker compose up\`. From that point on, the file holds two account-grade secrets.

**Never \`cat\` or \`Read\` those \`.env\` files.** A routine "let me check your .env to debug" reads the raw secret into your conversation context, where it gets persisted, forwarded to the next prompt, and out of the user's control.

Use \`inspect_bot_env\` instead. It returns \`{ key, value, masked }\` entries — sensitive values come through masked (first 4 + last 4), non-sensitive values (\`LLM_PROVIDER=anthropic\`, ports, webhook URLs) come through clear. You can still see which keys are present and whether the user has actually pasted a value, without the raw secret crossing into context.

Recommended defense-in-depth: the user can add a deny rule to \`.claude/settings.json\` so the harness blocks the routine \`cat\`/\`Read\` path even if an agent forgets the rule. The MCP doesn't enforce this — it's the user's choice — but suggesting it on first connect is a reasonable nudge:

\`\`\`json
{
  "permissions": {
    "deny": [
      "Read(~/.mojulo/**/.env)",
      "Read(~/.mojulo/**/.env.*)",
      "Bash(cat ~/.mojulo/**/.env*)"
    ]
  }
}
\`\`\`

This applies the same rule **control-plane API keys are already protected by**: \`mojulo-config\` writes provider keys into the encrypted \`api_keys\` table via the same AES-GCM path the Settings UI uses, never to plaintext \`.env\`. The container-side \`.env\` is the remaining surface, and \`inspect_bot_env\` is the safe affordance for it.`;

// --- Verification posture (shared) ---

const VERIFICATION_POSTURE = `## Verification posture (standing rule)

Mojulo **synthesizes; it does not certify.** Every artifact this MCP emits — bot configs from the build tools, catalyst recommendations, runnable workflow artifacts materialized via host adapters (Claude Code skills, Codex automations, generic workflow files) — is an LLM output and inherits LLM failure modes: hallucinated field names, optimistic destination mappings, assumptions about which MCPs are installed that don't match reality.

Before any artifact graduates from one-shot to recurring execution or fleet-wide fan-out:

1. **Dry-run on one real input.** Use an actual submission / conversation / bot, not a synthetic example.
2. **Inspect the result.** Validate field shapes, destination payloads, idempotency keys — by reading, not by trusting.
3. **Only then promote.** Schedule, loop, or fan out across the fleet.

This applies even when the user has run the same workflow before — schema drift, MCP version bumps, and bot config changes invalidate prior validation silently.`;

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
- **Catalyst** — a host-neutral workflow recipe shipped with mojulo. You read one with \`get_catalyst\`, then combine it with what a bot has captured + a destination MCP the user has installed + a **host adapter** (see below) to materialize a concrete runnable artifact that turns the captured signal into action. The catalyst itself is a starting point — adapt freely, or skip it and synthesize from scratch. *See the texture preview below.*
- **Host adapter** — bridge between a host-neutral catalyst recipe and the host-specific runnable artifact. Three ship today: \`claude-code\` (materializes as a skill under \`.claude/skills/\`, scheduled via \`/schedule\`), \`codex\` (materializes as a Codex automation via \`automation_update\`, or a workspace workflow file), and \`generic\` (materializes as \`workflow.md\` + runner script for any other agent). The adapter is auto-resolved from your client's \`clientInfo.name\` on first connect — pass an explicit \`host\` parameter to \`get_catalyst\` to override. Read your adapter once via \`get_adapter\` before synthesizing.`;

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
- **Catalyst** *(to the user: "workflow recipe" or "an automation")* — a workflow recipe shipped with mojulo. Read one with \`get_catalyst\`, combine it with what the bot has captured + a tool the user has connected (their CRM, Drive, calendar) → an automation that turns captured signal into action. Adapt freely; the recipe is a starting point.
- **Host adapter** *(to the user: "how the automation gets built for your setup" — or name the specific form: "as a Claude Code skill," "as a Codex automation," "as a workflow file")* — bridge from the host-neutral recipe to the host-specific runnable artifact. Three ship today: \`claude-code\`, \`codex\`, \`generic\`. Auto-resolved from your client; read your adapter once via \`get_adapter\` before building anything from a catalyst.`;

const GLOSSARY_MOJULO = `## Concepts

- **Bot** — deployed chatbot service; own process, own SQLite. Conversation data never leaves the bot.
- **Deployment** — control-plane row: id, botName, status, url, lastSeenAt, configHash. Metadata only.
- **Protocol** — stackable bot capability composed into \`instructions.txt\`. Five ship: \`knowledge\`, \`formGathering\`, \`appointments\`, \`triage\`, \`opticalRead\`. Toggled via \`enabledProtocols\`; gated per provider/model in \`getAllowedProtocolsForModel\`.
- **Chain** — \`content_hash\` + \`chain_hash\` per turn; \`verify_chain\` walks; federated handoffs extend the chain across bots via tip-of-chain on the URL.
- **Catalyst** — host-neutral workflow recipe in \`control/lib/mcp/catalysts/\`. Combined with bot shape (from \`get_deployment\`) + a destination MCP + a host adapter body → runnable artifact materialized via \`meta_context_commit({type:'artifact_materialization'})\`.
- **Host adapter** — catalyst → runnable bridge. \`claude-code\` (skill under \`.claude/skills/\`), \`codex\` (automation_update or workspace workflow), \`generic\` (workflow.md + runner). Auto-resolved from \`clientInfo.name\`; \`get_adapter\` for the full body.`;

const CONCEPT_GLOSSARY_VARIANTS = {
  plain: GLOSSARY_PLAIN,
  mixed: GLOSSARY_MIXED,
  mojulo: GLOSSARY_MOJULO,
};

// --- Catalyst texture preview (shared) ---

const CATALYST_TEXTURE_PREVIEW = `## Catalyst texture preview

To set expectations, here is the opening of the canonical \`qualify-lead-to-crm\` catalyst body — every catalyst is shaped like this:

> **Materialization**
>
> 1. Call \`get_deployment(deploymentId)\` to read the bot's form schema. The mapping is derived from this schema — never guess field names.
> 2. Ask the user the three \`parameters\` questions in one round.
> 3. Inspect the bound destination MCP to learn its contact-create surface (field names, required props, search-by-property tool). Field mapping is the catalyst's value-add — don't assume it's \`name\`/\`email\`/\`phone\` everywhere; HubSpot uses \`firstname\`/\`lastname\`, Salesforce uses \`FirstName\`/\`LastName\`, Attio uses object/attribute pairs.
> 4. Hand the resolved workflow (inputs, mapping table, idempotency strategy) to your host adapter to materialize the runnable artifact.

That density runs through the whole body — mapping rules per field type, pitfalls (PII through the LLM, idempotency, irreversible writes), and calibration tips. The host adapter contributes the artifact target, scheduling, and dry-run encoding. Plan to read the entire catalyst plus the adapter section before materializing; don't skim.`;

// --- Lifecycle (shared) ---

const LIFECYCLE = `## Lifecycle: build → deploy → connect → operate

1. **Build.** Pick which protocols (capabilities) the bot needs, generate their configs, upload any documents the bot should know, compose the bot's identity. Either drive this step-by-step through the build tools, or just describe the user's goal and let the build tools sequence themselves starting from \`infer_intent\`.

   *Builder-session scope.* Build tools share state via a **builder session** keyed on the \`mcp-session-id\` header your client sends. The session row persists in the control plane's SQLite, but the header→session binding is held in process memory. So: the same client reconnecting during a single control-plane process lifetime resumes its in-progress config, while a **control-plane restart drops the binding** and the user's next build tool call starts a fresh bot (the orphaned row stays in SQLite). Inside the same connection, \`start_new_bot\` deliberately discards in-progress config and starts over.
2. **Deploy.** \`save_modular_bot\` compiles the configured bot into a zip artifact on disk and returns its absolute path in \`artifactPath\`. The user runs it locally (\`unzip\` + \`docker compose up\`) or in the cloud (Fly.io). Over stdio MCP the zip lives under \`$MOJULO_HOME/data/artifacts/\` (default \`~/.mojulo/data/artifacts/\`) — hand the user the \`artifactPath\` value verbatim. The legacy \`downloadUrl\` field in the response is a Next.js-route path; ignore it over stdio. The container image is bot-agnostic — per-bot config is injected at start time, so the same image runs every bot the user has. Once the bot is reachable at \`\${botUrl}\`, it exposes \`/widget\` — dropping \`<script src="\${botUrl}/widget"></script>\` onto any page mounts a floating chat launcher (bottom-right by default). That's the customer-facing install path; hand the user that snippet when they ask "how do I put this on my site?". The same \`\${botUrl}\` opened directly in a browser is the quickest way for the user to test the bot themselves before installing the widget anywhere — same UI an end customer gets.
3. **Connect.** Once the bot starts, it phones home to the control plane with its URL. From then on the control plane can reach it through a bearer-authenticated proxy. **Conversation data stays in the bot's SQLite forever** — the control plane only stores \`url\` and \`last_seen_at\`. Any tool that needs transcript data proxies through to the bot in real time.
4. **Operate.** Use the operate tools to read what bots have captured. Use the catalyst tools to turn that captured signal into action via the user's other installed MCPs.
5. **Operate the fleet.** Once multiple bots are connected, fleet-level questions ("how is the whole fleet doing?", "which bots saw the most activity?", "find any conversation across every bot that mentioned X") have their own surface — the \`fleet_*\` tools. They fan out across every connected bot and aggregate in process memory; conversation content still stays on each bot. The natural two-step pattern is **fleet-locate** with \`fleet_query_conversations\` → **per-bot-read** with \`get_conversation\`. Same posture as single-bot operate, just batched. Cross-bot catalysts (the new category fleet aggregation enables) come from \`recommend_catalysts\` with \`scope: 'fleet'\`.`;

// --- Tool index (shared, ring-organized) ---
//
// Tool descriptions are agent-facing and stay in mojulo idiom regardless of
// the operator's vocabulary_register — the agent uses them to disambiguate
// which tool to call. Register branching applies to user-facing prose only.

const TOOL_INDEX = `## Tool index (one line each)

### Orientation
- \`forward_context\` — (you are reading its output) glossary, lifecycle, tool index.
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

### Deliberation (Ring 6 — the substrate for structural reasoning: contextmap, inventory, capabilities, composer)

Mojulo separates *what fired* (a conversation, an automation run — outcome-rate, never written here) from *why it was bound this way* (a catalyst materialized through a host adapter into an artifact — deliberation-rate, append-only). It also separates both of those from *what materials the operator has available right now* (their installed MCPs — present-state, replaceable). And it separates *what gets composed from those materials* (mcp-orbit workflows — recommendation + composition log, replaceable in-flight, sealed at materialization). \`meta_context\` is the writeable, durable layer for the why; \`meta_context_declare_inventory\` records the present-state MCP environment via introspection; \`record_mcp_capabilities\` records vendor knowledge via primary-source research. Both write into provider rows on a shared identity layer (one logical "Gmail" in mojulo regardless of which path arrived at it), and the composer reads both as one consolidated picture. Rare-call by design — expect 0–3 contextmap calls per session; declare inventory once at session start (and again only if the environment changes); research a vendor when the agent's first encounter with a provider warrants it; the composer fires whenever the user wants a non-bot workflow, not on a lifecycle cadence.

- \`meta_context_brief\` — read the contextmap subgraph + principles for a scope (\`{ kind: 'fleet' }\` for the whole graph, or \`{ kind: 'bot' | 'catalyst' | 'adapter' | 'artifact', ref: '<id>' }\` for a 1-hop neighborhood). Call when wondering *"has the fleet already committed to something related to what I'm about to do?"* or when the user asks "why does bot-3 route field X to tool Y?" / "why is this a Codex automation and not a skill?" — the \`materialized_by\` and \`binds\` edges carry principles that record the reasoning. The fleet brief response also includes \`inventory\` (the operator's currently declared MCP environment, see \`meta_context_declare_inventory\` below) plus \`meta: { empty, suggest_kyc, capped }\` hints. An empty fleet brief with no operator anchor → surface the KYC. Do NOT call for routine orientation (that's \`forward_context\`), operational metrics (\`fleet_*\`), or content questions (\`operate.*\`).
- \`meta_context_commit\` — seal a structural decision. Two event types in MVP: (1) \`operator_kyc\` — optional one-time bootstrap (role + primary_goal + locked-in constraints) that anchors future suggestions; subsequent commits need \`revise: true\` to attach a new principle. (2) \`artifact_materialization\` — atomic per-materialization seal recording which catalyst was materialized into which artifact via which host adapter for which bot, plus the bindings and any principles capturing the reasoning. Adapter-delegated verification runs BEFORE the write (claude-code/generic → existsSync; codex accepts opaque locators on assertion). Call ONLY AFTER materializing the artifact — never to declare an intention. If commit fails, roll back the artifact by the host adapter's own affordance (delete file / cancel automation).
- \`meta_context_declare_inventory\` — **the entry point for using mojulo without deploying a chatbot.** Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot). This primitive activates the other axis: MCP-orchestrated workflows synthesized over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. **Call this first** when the user wants outcomes that don't need a conversational layer — operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations — or asks to use mojulo without bots. Also call at session start if your environment has changed since the last declaration. REPLACE semantics — mojulo can't introspect your client, so the latest declaration is authoritative and previously declared tools not in the new call are wiped. Each declared server is canonicalized (e.g. \`claude_ai_Gmail\` → \`gmail\`) and upserts a row on the providers identity layer; the snapshot rides on \`meta_context_brief({kind:'fleet'})\`.
- \`record_mcp_capabilities\` / \`get_mcp_capabilities\` — **the research facet** of a provider, sibling to inventory's introspection facet. \`record_mcp_capabilities\` writes a vendor knowledge body (frontmatter + prose + cited URLs) for one canonical \`provider_ref\`; supersedes any prior current row in one transaction, preserving full history (\`asOf\` walks the chain). \`get_mcp_capabilities\` reads the current row (or a historical one via \`asOf\`). The agent-side methodology lives in the \`research-mcp-vendor\` catalyst — fetch via \`get_catalyst('research-mcp-vendor')\` for source-discipline, triangulation rules, and the canonical body shape. Mojulo ships four seeded vendor bodies on first install (gmail, notion, linear, google_drive) honestly attributed via \`source_urls[0]=mojulo://CHANGELOG#v0.5.0\`; the catalyst refreshes them when drift bites, and the composer's warning tags (\`seed_capabilities\` / \`no_capabilities_recorded\`) tell the agent when to run it.
- \`recommend_mcp_orbit_compositions\` / \`get_meta_catalyst\` / \`list_mcp_orbit_components\` / \`get_mcp_orbit_component\` — **the mcp-orbit composer** reads providers + capabilities + inventory through a consolidated view, enumerating every MCP mojulo knows about (whichever path put it there). Five composer states per chosen provider — \`research\` (both facets, agent-researched body), \`seed\` (both facets, build-time seed body), \`inventory_only\` (installed but no body recorded), \`capabilities_only\` (body recorded but not installed), \`none\` (defensive). Each non-\`research\` state surfaces as a constraint warning tagged with the provider_ref so the agent can route remediation: \`seed_capabilities:<ref>\` and \`no_capabilities_recorded:<ref>\` point at the research catalyst; \`not_installed:<ref>\` points at \`meta_context_declare_inventory\`. The five typed component kinds (\`mcp\` × \`trigger\` × \`pattern\` × \`idempotency\` × \`render\`) still describe the composition shape; non-mcp kinds ship through the component loader, the \`mcp\` kind is served from the providers identity layer. The flow is fixed: \`recommend_mcp_orbit_compositions\` (logs candidates as audit-able \`proposed\` rows; surfaces \`rationale.catalystHint\` when any chosen provider isn't research-grade) → \`get_meta_catalyst\` (composition rulebook, read once per session) → \`get_mcp_orbit_component\` per chosen ref → assemble + dry-run + \`meta_context_commit\`.
- \`semantic_search\` — **fuzzy recall over durable mojulo state** (principles, capability bodies, mcp-orbit components / compositions / provider artifacts, declared MCP inventory tools, and the shipped catalyst library). Use when you have an intent or topic but not a specific ref — \`meta_context_brief\` and the other Ring 6 readers answer "give me the full row at this ref"; \`semantic_search\` answers "which refs are relevant to this intent at all?" Returns ranked \`{ source_kind, source_ref, score, snippet }\` rows; snippets cap at ~280 chars and the agent is expected to pair this with the typed structured readers to pull full bodies for any row worth the context cost. Optional \`kinds\` filter restricts to one or more of \`principle | mcp_tool | mcp_capability | orbit_component | orbit_composition | orbit_artifact | catalyst\`. Capability rows that have been superseded never appear — the index quietly filters against the current row per provider. Backed by an in-process embedding model; first call after a control-plane restart pays ~2–4s of model load, subsequent calls are sub-50ms at expected corpus size. Read-only.
- \`bind_primitives\` — **the primitive-binding composer for MCP-to-MCP workflows.** Given a vendor-agnostic primitive (\`document-store\`, \`structured-record-store\`, \`messaging-channel\`, \`message-thread\`, ...), a composition role (\`source\` | \`destination\`), and a server from declared inventory, runs a deterministic generator that fills a role-specific template with the **actual bound tool names + schemas from the operator's installed MCP**. Returns a session-scoped provider artifact (\`prov_<id>\`) + structured binding manifest (which affordances mapped to which tools, with confidence labels). Use when inventory was declared in "richer-snapshot mode" (per-tool \`inputSchema\` + \`introspectionConfidence\`); thin inventory declarations downgrade to \`names_only\` confidence with no schemas in the generated artifact. The bound provider artifacts then graduate via \`meta_context_commit({type:'primitive_artifact_materialization', adapter_id, artifact, composition_intent, provider_artifact_refs:[...]})\` — recording the audit chain (artifact → bound MCP tools, with per-binding payloads) without requiring a bot or catalyst. This is the runtime-introspected composer mojulo recommends for MCP-to-MCP workflows — the generated artifact reflects the operator's actual installed MCP rather than a curated guess. The vendor-shaped \`recommend_mcp_orbit_compositions\` flow remains as a seed-reasoning surface for first-encounter scaffolding when the agent lacks confident tool-schema knowledge.`;

// --- Quick orientation rules (shared) ---

const QUICK_ORIENTATION_RULES = `## Quick orientation rules

- User wants to **build a new bot**: start with \`infer_intent\`, or jump straight to the specific \`generate_*\` tool if the user already knows what they need.
- User wants to **preview a bot mid-design** ("can I see what this looks like?", "show me a preview", "what would it feel like?", "let me try it before I deploy"): point them at the \`mojulo-ui\` wizard's live preview pane. Same \`~/.mojulo/\` state, so an in-progress config built via these MCP tools shows up in the wizard preview immediately. This is the answer while the user is still *designing* — no real container is running yet, the preview is a stand-in.
- User wants to **test the deployed artifact** (kick the tires on the running bot, sanity-check the live thing, verify the build behaves as designed): open \`\${botUrl}\` in a browser — that's the same widget end customers see. No MCP tool covers this on purpose; the right surface is the bot URL itself. Distinct from preview — preview is pre-deploy on a draft; this is post-deploy on the real artifact.
- User wants to **see what bots exist**: \`list_deployments\`.
- User wants to **understand state across multiple bots** ("how is the fleet doing?", "which bots are busiest this week?"): \`fleet_analytics_summary\`. For finding specific conversations across the fleet: \`fleet_query_conversations\` to locate, then \`get_conversation\` against the named bot to read content. For auditing chain integrity across every bot at once: \`verify_fleet_chains\`. The fleet tools never expose conversation content — they're the "where to look" surface; per-bot \`get_conversation\` is the "read it" surface.
- User wants to **do something with what a bot has collected** OR is asking "what can this bot unlock for me?": \`recommend_catalysts\` with the bot's deployment id. Surface suggestions in consultation form — including catalysts whose destination MCP isn't installed yet, framed as opt-in upgrades. Then \`get_catalyst\` to read the recipe (the response includes the host adapter section that tells you how to materialize the runnable artifact on your substrate).
- User wants to **automate something that spans multiple bots** ("digest leads from every bot", "audit all my appointment bookings together"): \`recommend_catalysts\` with \`scope: 'fleet'\`. Fleet-applicable catalysts come back with \`applicableDeployments\` so the synthesized skill knows which bots to iterate over; \`crossBot: true\` flags the patterns that only make sense across multiple bots.
- User wants a **long-running local tool on their machine that calls back to the agent for inference** ("watch this folder and extract data from anything new", "a thing on my laptop that does X in the background and asks me when it needs to think", "batch process Y and have the agent handle the LLM work", "image extraction app"): this is **app-shaped**, not bot- or skill-shaped. The path is Ring 7: \`install_scaffold\` lays the starter files, \`meta_context_commit({type:'app_materialization'})\` records the app in the contextmap with its four bindings (runner / durability / inference / mcp_self), then \`start_app\` spawns the process. Inference round-trips park on the agent-tasks queue (\`pull_agent_task\` / \`submit_envelope_inference\`) so the operator's session does the LLM work without per-app API keys. Distinct from a skill (one-shot synthesized into the host adapter) and a bot (chat-shaped, deployed runtime). See the *Paradigms* section above for trigger phrases; the dashboard's \`/graph\` page renders the App composition map.
- User wants to **automate something that doesn't involve a deployed chatbot** ("every morning, summarize yesterday's Linear issues into a Drive doc", "when a Gmail thread matches X, file a Notion ticket", "use mojulo without the bot") — i.e. wiring MCP to MCP rather than capturing through a bot first: \`meta_context_declare_inventory\` is the entry point (declare what MCPs are connected), then \`recommend_mcp_orbit_compositions\` with the operator's intent. The mcp-orbit composer returns ranked candidate compositions assembled from five typed component kinds (mcp / trigger / pattern / idempotency / render); each \`mcp\` entry in a composition carries a \`role: 'source' | 'destination'\` tag, with the role chosen per the mcp's declared affordances. Read the meta-catalyst once per session, then pull each component body in full before assembling. Mojulo's role here is the deliberation anchor (operator KYC + composition log + audit trail), not the runtime. Distinct from the bot-shaped flow above — when there's no conversational surface in the picture, the bot/catalyst path doesn't fit; reach for inventory + mcp-orbit instead.
- User wants to **browse the catalyst library** without a specific bot in mind: \`list_catalysts\`.
- User wants to **contribute a new catalyst** (write / propose / add one to mojulo's shipped library): \`custom_catalyst\`. This returns an author's guide. If the user only wants to automate something for themselves and isn't trying to contribute, do *not* call \`custom_catalyst\` — synthesize a local skill from \`get_catalyst\` or from intent instead.
- User wants to **extend what the bot does inside a conversation** ("I want my bot to recognize a new intent and track new state", "can my bot read X from the user?", "I want to add a new capability to mojulo"): \`custom_protocol\`. Returns the protocol design guide. Critical disambiguation up front: if the work happens *after* the conversation (sync to CRM, weekly digest, ticket on signal), that's a catalyst, not a protocol — route to \`recommend_catalysts\` instead. Protocols fire during the agent loop, on every reply, in the LLM's envelope. The guide walks the posture-check first.
- User wants to **audit** a conversation's integrity: \`verify_chain\`.
- User asks **"why was X bound this way?"** ("why does bot-3 route field X to tool Y?", "why is this a Codex automation instead of a Claude Code skill?", "what catalysts have I materialized across the fleet?"): \`meta_context_brief\` with the relevant scope — the \`materialized_by\` and \`binds\` edges carry principles that record the reasoning. Distinct from \`fleet_*\` (operational rollups) and \`operate.*\` (content) — this is the deliberation surface.
- Conversation and submission data are never copied into the control plane. If you need transcript content, fetch it through the operate tools — don't try to cache it server-side.`;

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const SECTION_DIVIDER = '\n\n---\n\n';

export function buildForwardContextBody({ register, disclosure, source } = {}) {
  const r = VOCABULARY_REGISTERS.includes(register) ? register : DEFAULT_VOCABULARY_REGISTER;
  const d = PROCEDURAL_DISCLOSURES.includes(disclosure) ? disclosure : DEFAULT_PROCEDURAL_DISCLOSURE;
  const standingRulesSection = `${STANDING_RULE_FLOOR}\n\n${DISCLOSURE_DIRECTIVE_VARIANTS[d]}`;
  return [
    HEADER,
    '',
    DUAL_PURPOSE_PREAMBLE,
    '',
    communicationSettingsNotice({ register: r, disclosure: d, source: source || 'defaults' }),
    '',
    OPENING_PARAGRAPH_VARIANTS[r],
    SECTION_DIVIDER.trim(),
    TWO_FACES_ONE_STATE,
    SECTION_DIVIDER.trim(),
    PARADIGMS,
    SECTION_DIVIDER.trim(),
    SECRETS_HANDLING,
    SECTION_DIVIDER.trim(),
    VERIFICATION_POSTURE,
    SECTION_DIVIDER.trim(),
    standingRulesSection,
    SECTION_DIVIDER.trim(),
    CONCEPT_GLOSSARY_VARIANTS[r],
    SECTION_DIVIDER.trim(),
    CATALYST_TEXTURE_PREVIEW,
    SECTION_DIVIDER.trim(),
    LIFECYCLE,
    SECTION_DIVIDER.trim(),
    TOOL_INDEX,
    SECTION_DIVIDER.trim(),
    QUICK_ORIENTATION_RULES,
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

export async function forwardContextHandler(input, _ctx) {
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

  // Override > anchor > defaults, per axis independently. An override on only
  // one axis combines with the anchor's value on the other axis — same
  // composition rule we'd want if we ever add `set_register` as its own tool.
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

  const body = buildForwardContextBody({ register, disclosure, source });
  // Plain text content (not JSON-stringified) so the agent reads it as prose.
  return { content: [{ type: 'text', text: body }] };
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
      "Forward the agent the full mojulo orientation: concept glossary (bot, deployment, protocol, chain, catalyst), the build → deploy → connect → operate lifecycle, and a one-line description of every tool in this MCP. Call this FIRST whenever the user asks what mojulo is, how it works, or which tool to pick — or whenever you (the agent) feel uncertain about mojulo's vocabulary or which entry point fits the user's intent. The body's opening paragraph, concept glossary, and disclosure directive branch on the operator's `vocabulary_register` and `procedural_disclosure` (set via `operator_kyc`); concept names and tool descriptions never branch. Optional per-call `register` / `disclosure` override the operator anchor for this one read — useful when switching modes mid-session without committing a new kyc revision. Read-only, idempotent.",
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
