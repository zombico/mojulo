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

// Exported for tests.
export const FORWARD_CONTEXT_BODY = `# Mojulo, oriented

Mojulo is a control plane for **chatbot-based solutions**. You build a chatbot, deploy it where users can reach it, let it collect conversations and form submissions, then turn what it captured into action in the tools the user already runs — typically via the other MCP servers they already have installed (Gmail, Google Drive, Google Calendar, plus whichever CRM / ticketing / warehouse MCPs they use).

---

## Two faces, one state

Mojulo ships two binaries against the same \`~/.mojulo/\` state:

- **\`mojulo\`** — this MCP, the agent-shaped face. You're talking to it right now. Build via chat, drive operations programmatically.
- **\`mojulo-ui\`** — a local Next.js dashboard, the human-shaped face. Bound to 127.0.0.1, launched with \`npx -y -p mojulo mojulo-ui\`. Reads the same SQLite at \`~/.mojulo/data/mojulo-lite.db\` via WAL mode, so the two run side-by-side and a bot you minted via MCP shows up in the dashboard's fleet view immediately.

Suggest the dashboard when the user asks for something the visual surface does better:

- **Browse** conversations or submissions interactively (filter, scroll, scan) rather than paging through tool output.
- **Mint** a bot via the wizard form rather than chat-builder turn-taking — useful when the user wants to set fields directly without describing them.
- **Try** a bot they just built — \`mojulo-ui\` runs a live chat preview in the wizard before deploy, and once deployed, opening the bot's URL in a browser drops the user into the same widget their customers see. Suggest this right after \`save_modular_bot\` finishes — the natural next thing is "let me kick the tires."
- **Inspect** fleet analytics as charts rather than JSON tables.
- **Manage** deploys (re-build, rotate keys via Settings, manually trigger cloud-deploy) by clicking rather than orchestrating tool calls.

The default mode is still MCP — don't push the dashboard for tasks that work fine in chat. Suggest it when the user explicitly wants to *look*, *browse*, or *click*, or when you've exhausted a few rounds of tool output and they're still missing something a visual scan would catch in a second.

---

## Secrets handling (standing rule)

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

This applies the same rule **control-plane API keys are already protected by**: \`mojulo-config\` writes provider keys into the encrypted \`api_keys\` table via the same AES-GCM path the Settings UI uses, never to plaintext \`.env\`. The container-side \`.env\` is the remaining surface, and \`inspect_bot_env\` is the safe affordance for it.

---

## Verification posture (standing rule)

Mojulo **synthesizes; it does not certify.** Every artifact this MCP emits — bot configs from the build tools, catalyst recommendations, runnable workflow artifacts materialized via host adapters (Claude Code skills, Codex automations, generic workflow files) — is an LLM output and inherits LLM failure modes: hallucinated field names, optimistic destination mappings, assumptions about which MCPs are installed that don't match reality.

Before any artifact graduates from one-shot to recurring execution or fleet-wide fan-out:

1. **Dry-run on one real input.** Use an actual submission / conversation / bot, not a synthetic example.
2. **Inspect the result.** Validate field shapes, destination payloads, idempotency keys — by reading, not by trusting.
3. **Only then promote.** Schedule, loop, or fan out across the fleet.

This applies even when the user has run the same workflow before — schema drift, MCP version bumps, and bot config changes invalidate prior validation silently.

---

## Concepts

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
- **Host adapter** — bridge between a host-neutral catalyst recipe and the host-specific runnable artifact. Three ship today: \`claude-code\` (materializes as a skill under \`.claude/skills/\`, scheduled via \`/schedule\`), \`codex\` (materializes as a Codex automation via \`automation_update\`, or a workspace workflow file), and \`generic\` (materializes as \`workflow.md\` + runner script for any other agent). The adapter is auto-resolved from your client's \`clientInfo.name\` on first connect — pass an explicit \`host\` parameter to \`get_catalyst\` to override. Read your adapter once via \`get_adapter\` before synthesizing.

---

## Catalyst texture preview

To set expectations, here is the opening of the canonical \`qualify-lead-to-crm\` catalyst body — every catalyst is shaped like this:

> **Materialization**
>
> 1. Call \`get_deployment(deploymentId)\` to read the bot's form schema. The mapping is derived from this schema — never guess field names.
> 2. Ask the user the three \`parameters\` questions in one round.
> 3. Inspect the bound destination MCP to learn its contact-create surface (field names, required props, search-by-property tool). Field mapping is the catalyst's value-add — don't assume it's \`name\`/\`email\`/\`phone\` everywhere; HubSpot uses \`firstname\`/\`lastname\`, Salesforce uses \`FirstName\`/\`LastName\`, Attio uses object/attribute pairs.
> 4. Hand the resolved workflow (inputs, mapping table, idempotency strategy) to your host adapter to materialize the runnable artifact.

That density runs through the whole body — mapping rules per field type, pitfalls (PII through the LLM, idempotency, irreversible writes), and calibration tips. The host adapter contributes the artifact target, scheduling, and dry-run encoding. Plan to read the entire catalyst plus the adapter section before materializing; don't skim.

---

## Lifecycle: build → deploy → connect → operate

1. **Build.** Pick which protocols (capabilities) the bot needs, generate their configs, upload any documents the bot should know, compose the bot's identity. Either drive this step-by-step through the build tools, or just describe the user's goal and let the build tools sequence themselves starting from \`infer_intent\`.

   *Builder-session scope.* Build tools share state via a **builder session** keyed on the \`mcp-session-id\` header your client sends. The session row persists in the control plane's SQLite, but the header→session binding is held in process memory. So: the same client reconnecting during a single control-plane process lifetime resumes its in-progress config, while a **control-plane restart drops the binding** and the user's next build tool call starts a fresh bot (the orphaned row stays in SQLite). Inside the same connection, \`start_new_bot\` deliberately discards in-progress config and starts over.
2. **Deploy.** \`save_modular_bot\` compiles the configured bot into a zip artifact on disk and returns its absolute path in \`artifactPath\`. The user runs it locally (\`unzip\` + \`docker compose up\`) or in the cloud (Fly.io). Over stdio MCP the zip lives under \`$MOJULO_HOME/data/artifacts/\` (default \`~/.mojulo/data/artifacts/\`) — hand the user the \`artifactPath\` value verbatim. The legacy \`downloadUrl\` field in the response is a Next.js-route path; ignore it over stdio. The container image is bot-agnostic — per-bot config is injected at start time, so the same image runs every bot the user has. Once the bot is reachable at \`\${botUrl}\`, it exposes \`/widget\` — dropping \`<script src="\${botUrl}/widget"></script>\` onto any page mounts a floating chat launcher (bottom-right by default). That's the customer-facing install path; hand the user that snippet when they ask "how do I put this on my site?". The same \`\${botUrl}\` opened directly in a browser is the quickest way for the user to test the bot themselves before installing the widget anywhere — same UI an end customer gets.
3. **Connect.** Once the bot starts, it phones home to the control plane with its URL. From then on the control plane can reach it through a bearer-authenticated proxy. **Conversation data stays in the bot's SQLite forever** — the control plane only stores \`url\` and \`last_seen_at\`. Any tool that needs transcript data proxies through to the bot in real time.
4. **Operate.** Use the operate tools to read what bots have captured. Use the catalyst tools to turn that captured signal into action via the user's other installed MCPs.
5. **Operate the fleet.** Once multiple bots are connected, fleet-level questions ("how is the whole fleet doing?", "which bots saw the most activity?", "find any conversation across every bot that mentioned X") have their own surface — the \`fleet_*\` tools. They fan out across every connected bot and aggregate in process memory; conversation content still stays on each bot. The natural two-step pattern is **fleet-locate** with \`fleet_query_conversations\` → **per-bot-read** with \`get_conversation\`. Same posture as single-bot operate, just batched. Cross-bot catalysts (the new category fleet aggregation enables) come from \`recommend_catalysts\` with \`scope: 'fleet'\`.

---

## Tool index (one line each)

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

### Deliberation (Ring 6 — record WHY structural decisions were made, register WHAT is available outside mojulo)

Mojulo separates *what fired* (a conversation, an automation run — outcome-rate, never written here) from *why it was bound this way* (a catalyst materialized through a host adapter into an artifact — deliberation-rate, append-only). It also separates both of those from *what materials the operator has available right now* (their installed MCPs — present-state, replaceable). \`meta_context\` is the writeable, durable layer for the second; \`meta_context_declare_inventory\` is the present-state cache for the third. Rare-call by design — expect 0–3 contextmap calls per session; declare inventory once at session start (and again only if the environment changes).

- \`meta_context_brief\` — read the contextmap subgraph + principles for a scope (\`{ kind: 'fleet' }\` for the whole graph, or \`{ kind: 'bot' | 'catalyst' | 'adapter' | 'artifact', ref: '<id>' }\` for a 1-hop neighborhood). Call when wondering *"has the fleet already committed to something related to what I'm about to do?"* or when the user asks "why does bot-3 route field X to tool Y?" / "why is this a Codex automation and not a skill?" — the \`materialized_by\` and \`binds\` edges carry principles that record the reasoning. The fleet brief response also includes \`inventory\` (the operator's currently declared MCP environment, see \`meta_context_declare_inventory\` below) plus \`meta: { empty, suggest_kyc, capped }\` hints. An empty fleet brief with no operator anchor → surface the KYC. Do NOT call for routine orientation (that's \`forward_context\`), operational metrics (\`fleet_*\`), or content questions (\`operate.*\`).
- \`meta_context_commit\` — seal a structural decision. Two event types in MVP: (1) \`operator_kyc\` — optional one-time bootstrap (role + primary_goal + locked-in constraints) that anchors future suggestions; subsequent commits need \`revise: true\` to attach a new principle. (2) \`artifact_materialization\` — atomic per-materialization seal recording which catalyst was materialized into which artifact via which host adapter for which bot, plus the bindings and any principles capturing the reasoning. Adapter-delegated verification runs BEFORE the write (claude-code/generic → existsSync; codex accepts opaque locators on assertion). Call ONLY AFTER materializing the artifact — never to declare an intention. If commit fails, roll back the artifact by the host adapter's own affordance (delete file / cancel automation).
- \`meta_context_declare_inventory\` — **the entry point for using mojulo without deploying a chatbot.** Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot). This primitive activates the other axis: MCP-orchestrated workflows synthesized over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. **Call this first** when the user wants outcomes that don't need a conversational layer — operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations — or asks to use mojulo without bots. Also call at session start if your environment has changed since the last declaration. REPLACE semantics — mojulo can't introspect your client, so the latest declaration is authoritative and previously declared tools not in the new call are wiped. The snapshot rides on \`meta_context_brief({kind:'fleet'})\` (\`inventory.declaredAt\`, \`inventory.ageSeconds\`) so freshness is always visible.

---

## Quick orientation rules

- User wants to **build a new bot**: start with \`infer_intent\`, or jump straight to the specific \`generate_*\` tool if the user already knows what they need.
- User wants to **preview a bot mid-design** ("can I see what this looks like?", "show me a preview", "what would it feel like?", "let me try it before I deploy"): point them at the \`mojulo-ui\` wizard's live preview pane. Same \`~/.mojulo/\` state, so an in-progress config built via these MCP tools shows up in the wizard preview immediately. This is the answer while the user is still *designing* — no real container is running yet, the preview is a stand-in.
- User wants to **test the deployed artifact** (kick the tires on the running bot, sanity-check the live thing, verify the build behaves as designed): open \`\${botUrl}\` in a browser — that's the same widget end customers see. No MCP tool covers this on purpose; the right surface is the bot URL itself. Distinct from preview — preview is pre-deploy on a draft; this is post-deploy on the real artifact.
- User wants to **see what bots exist**: \`list_deployments\`.
- User wants to **understand state across multiple bots** ("how is the fleet doing?", "which bots are busiest this week?"): \`fleet_analytics_summary\`. For finding specific conversations across the fleet: \`fleet_query_conversations\` to locate, then \`get_conversation\` against the named bot to read content. For auditing chain integrity across every bot at once: \`verify_fleet_chains\`. The fleet tools never expose conversation content — they're the "where to look" surface; per-bot \`get_conversation\` is the "read it" surface.
- User wants to **do something with what a bot has collected** OR is asking "what can this bot unlock for me?": \`recommend_catalysts\` with the bot's deployment id. Surface suggestions in consultation form — including catalysts whose destination MCP isn't installed yet, framed as opt-in upgrades. Then \`get_catalyst\` to read the recipe (the response includes the host adapter section that tells you how to materialize the runnable artifact on your substrate).
- User wants to **automate something that spans multiple bots** ("digest leads from every bot", "audit all my appointment bookings together"): \`recommend_catalysts\` with \`scope: 'fleet'\`. Fleet-applicable catalysts come back with \`applicableDeployments\` so the synthesized skill knows which bots to iterate over; \`crossBot: true\` flags the patterns that only make sense across multiple bots.
- User wants to **automate something that doesn't involve a deployed chatbot** ("every morning, summarize yesterday's Linear issues into a Drive doc", "when a Gmail thread matches X, file a Notion ticket", "use mojulo without the bot") — i.e. wiring MCP to MCP rather than capturing through a bot first: \`meta_context_declare_inventory\` is the entry point. Declare what MCPs are connected, then synthesize a local skill that orchestrates them; mojulo's role here is the deliberation anchor (operator KYC + audit trail), not the runtime. Distinct from the bot-shaped flow above — when there's no conversational surface in the picture, the bot/catalyst path doesn't fit; reach for inventory + direct synthesis instead.
- User wants to **browse the catalyst library** without a specific bot in mind: \`list_catalysts\`.
- User wants to **contribute a new catalyst** (write / propose / add one to mojulo's shipped library): \`custom_catalyst\`. This returns an author's guide. If the user only wants to automate something for themselves and isn't trying to contribute, do *not* call \`custom_catalyst\` — synthesize a local skill from \`get_catalyst\` or from intent instead.
- User wants to **extend what the bot does inside a conversation** ("I want my bot to recognize a new intent and track new state", "can my bot read X from the user?", "I want to add a new capability to mojulo"): \`custom_protocol\`. Returns the protocol design guide. Critical disambiguation up front: if the work happens *after* the conversation (sync to CRM, weekly digest, ticket on signal), that's a catalyst, not a protocol — route to \`recommend_catalysts\` instead. Protocols fire during the agent loop, on every reply, in the LLM's envelope. The guide walks the posture-check first.
- User wants to **audit** a conversation's integrity: \`verify_chain\`.
- User asks **"why was X bound this way?"** ("why does bot-3 route field X to tool Y?", "why is this a Codex automation instead of a Claude Code skill?", "what catalysts have I materialized across the fleet?"): \`meta_context_brief\` with the relevant scope — the \`materialized_by\` and \`binds\` edges carry principles that record the reasoning. Distinct from \`fleet_*\` (operational rollups) and \`operate.*\` (content) — this is the deliberation surface.
- Conversation and submission data are never copied into the control plane. If you need transcript content, fetch it through the operate tools — don't try to cache it server-side.
`;

export async function forwardContextHandler(_input, _ctx) {
  // Plain text content (not JSON-stringified) so the agent reads it as prose.
  return { content: [{ type: 'text', text: FORWARD_CONTEXT_BODY }] };
}

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
      "Forward the agent the full mojulo orientation: concept glossary (bot, deployment, protocol, chain, catalyst), the build → deploy → connect → operate lifecycle, and a one-line description of every tool in this MCP. Call this FIRST whenever the user asks what mojulo is, how it works, or which tool to pick — or whenever you (the agent) feel uncertain about mojulo's vocabulary or which entry point fits the user's intent. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
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
      "Return an author's guide for designing a new mojulo PROTOCOL — a bot capability that fires inside a conversation (every turn, in the LLM's envelope). Use this when the user wants to extend what their bot does *during a turn*: recognize a new intent class, collect a new shape of structured data across turns, render a new UI affordance via the envelope, read a new modality. Do NOT call this when the user wants something that happens *after* the conversation (CRM sync, weekly digests, log scans, ticket-on-signal) — that's catalyst-shaped, route to recommend_catalysts / custom_catalyst instead. The guide opens with a posture check disambiguating protocol vs. catalyst vs. identity-prompt-tweak (the most common misfire is calling this when the user actually wants a catalyst), then walks the mental model (stackable cartridges + composed response envelope, prove the intent loop on hand-authored instructions before wiring), then the touch-point map (cartridge file, registry entry, response attributes, envelope schema mirror, builder hooks). The output of this workflow is a design the user takes to a fork or an upstream PR — not a single file like custom_catalyst produces. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: customProtocolHandler,
  });
}
