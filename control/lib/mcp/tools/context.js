/**
 * MCP Ring 0 — orientation.
 *
 * The connecting model's first impression of mojulo is just the initialize
 * preamble in [server.js], which is deliberately short. Everything heavier —
 * the concept glossary, the capability model, the materialize lifecycle,
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
 * - The tool index, the form bodies and the pack menus are GENERATED from one line per tool in
 *   lib/mcp/tool-lines.js. A new tool needs its line there (and its form's `tools` here if creative);
 *   the registry-sweep test in context.test.js fails until every LISTED tool has exactly one line
 *   (unlisted deprecated aliases are exempt). The routing index below stays hand-written: its rows
 *   are measured recognizers, and the same test checks every tool it names has a line. A new
 *   create_view kind or compose_world base needs a view-vocab card, not a line.
 * - Creative-mint routing detail lives in ROUTING CARDS (lib/mcp/routing-cards/,
 *   retrieved via semantic_search({kinds:['routing']})), not in Create-things
 *   rows — the body names FORMS + entry tools only. A new creative capability
 *   needs a routing card + 1–2 rows in the routing eval fixture
 *   (routing-cards/routing-eval.integration.test.js); the body-ceiling test
 *   below the row lint makes body regrowth a conscious decision.
 */

import { registerTool, LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, SERVER_NAME, getServerVersion } from '@/lib/mcp/server';
import { getClientInfo } from '@/lib/mcp/client-bindings';
import { resolveAdapterId } from '@/lib/mcp/adapters/loader';
import { hostCapabilities } from '@/lib/mcp/hosts/registry';
import { buildRulesCard, overBudgetNotice } from '@/lib/mcp/tools/rules-card';
import { CREATIVE_FORMS } from '@/lib/mcp/creative-forms';
import { BOT_FACTORY_MOVED } from '@/lib/mcp/bot-factory-moved';
import { UI_PACKAGE_NAME, uiLaunchCommand } from '@/lib/version/ui-package';
import { distribution, mojuloCommand, npxMojulo, updateAdvice } from '@/lib/version/distribution';
import {
  getControlPlaneVersion,
  getControlPlanePackageName,
  isSourceClone,
} from '@/lib/version/local';
import { fetchLatestNpmVersion, compareSemver } from '@/lib/version/remote';
import { createHash } from 'node:crypto';
import { getDb } from '@/lib/db/index';
import { MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import { McpToolCallRepository } from '@/lib/db/repositories/mcpToolCalls';
import { getRoutingCardCatalog } from '@/lib/mcp/routing-cards/loader';
import { TOOL_LINES, RING_TITLES } from '@/lib/mcp/tool-lines';
import { homePackForTool } from '@/lib/mcp/packs';
import {
  PLUGIN_PROFILE_HIDDEN_TOOLS,
  pluginProfileActive,
  pluginProfileNotice,
  profileEdit,
  withPluginProfile,
  hiddenRowInPluginProfile,
  PLUGIN_PROFILE_HIDDEN_FORMS,
} from '@/lib/mcp/plugin-profile';
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
// entry tool), a drawer directory (where to go deeper), the standing safety
// one-liners, then the per-call tail: a one-line commitment floor, the
// settings notice and the active procedural-disclosure directive. The heavy prose drawerizes:
//   - concept glossary           → get_register_kit (active vocabulary_register)
//   - what mojulo is / self-description (phone home? my data? uninstall?) → get_substrate
//   - full one-line-per-tool idx → get_tool_index
//   - dashboard page map         → get_ui_map
// (get_deliberation_overview, the Ring 6 model, left the surface with the office wing in 3.1.0.)
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

// --- One body (3.1.0) ---
//
// forward_context had two wings, the STUDIO (default) and the OFFICE (connected
// services, apps, deliberation) behind `mode:'office'`. The office wing left the
// tool surface in 3.1.0 (RETIRED_PACKS in packs.js), so there is one body. A
// caller that still passes `mode:'office'` gets it, with one line saying where
// the office went; `mode` is otherwise stateless and selects nothing.
export const FORWARD_CONTEXT_MODES = ['studio'];
export const RETIRED_FORWARD_CONTEXT_MODES = ['office'];
export const DEFAULT_FORWARD_CONTEXT_MODE = 'studio';
const OFFICE_RETIRED_LINE = "*The office wing (apps, daemons, connected services, the contextmap) left the tool surface in 3.1.0. Its tools still answer by name; nothing routes to them. Workers and other MCPs are reached through Workflows: `pack_catalysts`.*";

// What mojulo makes, named by what people do with it — THE single source for
// the sweep test in context.test.js that asserts every orientation surface
// (initialize preamble, forward_context, get_substrate, register-kit glossary)
// names all of them. Adding an outcome: add it here and the sweep tells you
// every surface that needs the mention. A game is composition over the rest,
// so Play leads; Observe (motion: turntables, flythroughs, recorded runs)
// applies to all of them. Until 3.1.0 this list was the paradigms Media,
// Game, Connected Service and App; Bot left in 3.0.0.
export const PARADIGMS = ['Play', 'Print', 'Read', 'Hear', 'Observe'];

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

// --- Workshop pulse (R1, orientation-ramp.plan.md) ---
//
// One dynamic line appended to the opener so a cold agent knows whether to
// ONBOARD (empty workshop → propose a first win) or RESUME (counts + last
// activity → pick up where things left off). Budget: one line, ≤ ~40 tokens.
// Rows only, never reachability — no network, no daemon probes (running apps
// are deliberately omitted rather than reported as a false 0 when the runtime
// daemon is down). Fail-soft like readOperatorRegisterPrefs: any error → null
// → the body renders without the line. If this line ever wants to grow past
// one line, it is trying to become a drawer — stop it.

function readWorkshopPulse() {
  try {
    const db = getDb();
    const count = (sql) => {
      const row = db.prepare(sql).get();
      return row && Number.isFinite(row.n) ? row.n : 0;
    };
    // No bot count: the deployments table left with the chatbot factory (3.0.0),
    // and a fresh install has none, so reading it would drop the whole line.
    const sketches = count('SELECT COUNT(*) AS n FROM sketches');
    const stashes = count("SELECT COUNT(*) AS n FROM stashes WHERE status = 'open'");
    const cooks = count('SELECT COUNT(*) AS n FROM stash_cooks WHERE archived_at IS NULL');
    const unseenPlans = count('SELECT COUNT(*) AS n FROM plans WHERE seen = 0');

    // Last activity: max updated/created stamp across the mint surfaces.
    // Units may be mixed by table (ms or unixepoch seconds) — normalize to ms
    // before comparing.
    const toMs = (v) => (v == null ? 0 : v > 1e12 ? v : v * 1000);
    const maxStamp = (sql) => {
      try {
        const row = db.prepare(sql).get();
        return toMs(row && row.m);
      } catch {
        return 0;
      }
    };
    const lastActivityMs = Math.max(
      maxStamp('SELECT MAX(created_at) AS m FROM sketches'),
      maxStamp('SELECT MAX(updated_at) AS m FROM stashes'),
      maxStamp('SELECT MAX(created_at) AS m FROM stash_cooks'),
      maxStamp('SELECT MAX(updated_at) AS m FROM plans'),
    );

    return { sketches, stashes, cooks, unseenPlans, lastActivityMs };
  } catch {
    return null;
  }
}

// Coarse bucket so the line stays stable across near-identical calls.
function fmtPulseAge(lastActivityMs) {
  if (!lastActivityMs) return null;
  const days = Math.floor((Date.now() - lastActivityMs) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function buildWorkshopPulseLine(pulse) {
  if (!pulse) return null;
  const { sketches, stashes, cooks, unseenPlans, lastActivityMs } = pulse;
  const total = sketches + stashes + cooks + unseenPlans;
  if (total === 0) {
    return '*Workshop pulse: empty — nothing minted yet. The cheapest first proof is a sketch (`create_sketch`) or a cook (`mint_stash` → `gather` → `cook`).*';
  }
  const parts = [];
  if (sketches) parts.push(`${sketches} sketch${sketches === 1 ? '' : 'es'}`);
  if (stashes) parts.push(`${stashes} open stash${stashes === 1 ? '' : 'es'}`);
  if (cooks) parts.push(`${cooks} open cook${cooks === 1 ? '' : 's'}`);
  if (unseenPlans) parts.push(`${unseenPlans} unseen plan${unseenPlans === 1 ? '' : 's'} (\`list_plans\`)`);
  const age = fmtPulseAge(lastActivityMs);
  if (age) parts.push(`last activity ${age}`);
  return `*Workshop pulse: ${parts.join(' · ')}.*`;
}

// --- Substrate positioning (drawerized behind get_substrate) ---
//
// What mojulo is and what it can honestly claim, stated as operating facts
// the agent acts on: what to build with, which pipeline claims are true,
// where inference runs, what makes something always-on, and which cloud
// properties mojulo does NOT have. No framing devices, acronyms, or
// metaphors — a sentence here earns its place only if it changes what the
// agent says or does next. Posture answers (phone home / my data / pay /
// uninstall) derive from SUBSTRATE_FACTS below.

// How mojulo reaches Claude Code on the web. Under the Claude plugin the plugin already starts this
// server there, and `init` would only add a second registration, so it is not suggested.
const BOX_CLAUDE_CODE = distribution() === 'claude-plugin'
  ? 'where the mojulo plugin starts it'
  : `with \`${npxMojulo('init --yes --no-ui')}\``;

const SUBSTRATE_POSITIONING = `## What mojulo is — the working description

**The one-breath answer** (when the operator asks "what is mojulo?"): *a **3D factory with a media studio** for agents. An agent makes things by conversation, stored as editable recipes on your machine, things you can **Play** (games), **Print** (solids at true scale), **Read** (diagrams, illustrations, science views, publications), **Hear** (scores, sound effects, voices) and **Observe** (any of them watched: turntables, flythroughs, recorded runs). The recipe is the source; renders are derived.* Every tool creates, maintains, updates or composes one of those things. **Characters** are their own ring: a hero, a creature or an animal, rigged, made with \`create_character\`. A game is the composition: worlds, characters, gear and sound under rules (\`design_game\`). **Workflows** orchestrate the rest for batches and variations: plans that chain calls, sweeps, stash → cook, and catalysts that reach the operator's other workers and MCPs. If the operator asks "what is this really?", answer plainly: Node.js, SQLite and MCP on the operator's host, with the connecting agent supplying all judgment.

**Two pipelines, one honesty rule.** DIGITAL: a game plays in the browser, and that build is the game itself: \`export_game\` writes it as a self-contained folder, or with \`target: 'desktop'\` as an Electron app (offline, no web server; Electron is the folder's own devDependency). The engines get a translation of it with a portability report naming what did not travel: Godot the most complete (a real project plus a headless machine gate); the Unity and Unreal legs ship as a data pack plus an importer (Unreal adds a C++ kernel plugin), each with an advisory gate that runs only when \`MOJULO_UNITY\` / \`MOJULO_UNREAL\` names a binary; Roblox takes a Rojo project, its Luau kernel held equal to the web (a greybox, a Humanoid walking the player); Blender takes an art-pass pack and an optional GI bake into vertex colours. Ladder honestly ("plays in the browser or as a desktop app; Godot the fullest engine translation, Roblox the young one, Unity and Unreal as gated legs"), never "identical across all five." PHYSICAL: the literal profile (workbench / assembler / carved wordmark / turntable / vehicle) exports as print-purposed STL or 3MF at true scale — mm, z-up, slicer-ready; figures, worlds and views print as maquettes fit to a target size (default 120 mm), so say "true scale" only for the literal profile. Claim **"print-ready STL at true scale"**, NOT "guaranteed watertight manifold" (it emits honest triangle soup and relies on slicer repair, which is standard practice). Sharp edges live IN the recipe: \`exact: true\` on a workbench field or cut composes the same terms with Manifold instead of the sampled grid (a bore has a true circular lip in /world, the .glb, the engine packs and the print; curves are faceted by \`segments\`), and \`mint_solid kind:'scad'\` takes an OpenSCAD program AS the recipe, meshed in-process by OpenSCAD itself. Say **"an OpenSCAD program is a recipe"** and **"exact booleans in the recipe"**; never "mojulo replaces OpenSCAD", and never "parametric CAD" or "toleranced" (no B-rep, no threads, no fits — \`translate_modeler_lingo\` routes those to precision CAD). The seam runs both ways: \`mojulo_field("<id>")\` inside a scad source reaches a field solid for what OpenSCAD cannot say (a blend, a stroke, noise); \`format: 'scad'\` transpiles a workbench recipe into an OpenSCAD program with a coverage ledger naming any term that arrived as a frozen \`polyhedron()\` (a scad row returns its source verbatim); and \`bind_mesh_render\` takes an STL or 3MF made outside back into a world. The connective tissue is scale-honesty plus \`verify_machina\`, which checks work conservation, force capacity, rate and storage margins over a mechanism chain — statics, not collisions or joint limits.

**"3D" is a PIPELINE-POSITION claim, never a fidelity claim.** Mojulo is the agent-driven upstream that FEEDS the tools professionals already use; it does not rival them on rendering. Never enter a fidelity contest with a game engine — and never describe mojulo as "just an exporter" either: the recipe is where the thing is born and lives (and runs standalone in-browser); the engine or printer is where it is optionally *finished*. "Factory" names the output, not the fidelity: things come off the line as recipes, ready to finish elsewhere.

**Chatbots are not part of mojulo.** ${BOT_FACTORY_MOVED} The embedding model behind vector \`semantic_search\` is the one opt-in install group (\`recall\`, \`${mojuloCommand('install recall')}\`): without it search still answers, ranking lexically, and a result's \`mode\` says which ran. Everything else — the kernel, the studio and the workflows — is always present, on the operator's machine or in the agent's own temporary box (Claude Code on the web ${BOX_CLAUDE_CODE}, or a shell-only sandbox such as Grok chat's with \`${npxMojulo('call')}\`, at this server's version so a recipe re-mints identically; results handed back as files — every written export carries a \`handoff\` naming this host's door, and \`format: 'bundle'\` is the one-zip handoff). Do not describe mojulo as a bot factory, and do not offer to build apps, daemons or MCP-to-MCP automations: those left the tool surface in 3.1.0.

**Inference runs on you.** Mojulo holds state and recipes, and no LLM credentials of its own: photo references are read by your eyes (\`reference_protocol\`), cooks are agent-authored, games are verified by agent-compiled traversals, and work parked for an outside worker waits on the agent-task queue (\`pull_agent_task\` → \`submit_envelope_inference\`). Serve the operator's intent against the substrate; do not try to make mojulo run without you.

**Recipes are the source; renders and gates are how they prove out.** Everything the workshop mints is a tiny seeded deterministic recipe regenerated on render — diffable, replayable; the GIFs / PNGs / MP4s under \`data/outcomes/\` are derived files bound to it, disposable. Artifacts verify before promotion: a world's physics is probe-asserted tick by tick (\`forge_motion\` traversal returns the probe stream), and \`create_game\` refuses an unaudited level unless waived. With a skeptical operator, point at these gates instead of adjectives.

**Workers and other MCPs.** Optional workers (Blender, ComfyUI, TripoSR, Kokoro, a slicer, OpenSCAD, Godot, Unity, Unreal) are never dependencies: absence degrades a loop, never breaks one. Work for them is parked as a handoff (the render handoffs, the agent-task queue), and a flow that spans mojulo and another MCP on the host is a catalyst landed as a Skill (\`recommend_catalysts\` → \`get_catalyst\`), because the Skill runs where those MCPs live.

**Cloud comparison — what is and is not claimed.** Mojulo is not a cloud platform: no auto-scaling, multi-region, multi-tenancy, IAM or per-call billing; do not claim them. Shape mapping when asked: a recipe ~ infrastructure-as-code for media (the manifest is the source, the render is disposable); a game ~ a shipped build with save state; a catalyst ~ a function the host runs.
`;

// --- Substrate facts (self-description axioms, appended to get_substrate) ---
//
// Not an FAQ. A small set of falsifiable architecture invariants the agent
// DERIVES meta-answers from — privacy, data location, network posture, cost,
// uninstall — including questions nobody anticipated. Each fact names its own
// check where one exists, so a skeptical operator can verify instead of
// trusting a self-report. These restate invariants already enforced as golden
// rules (CLAUDE.md) and documented in the repo; the last fact points at the
// repo as the verification layer underneath. Keep facts, not answers: an
// answer here would rot; an invariant changes only when the architecture does.

const SUBSTRATE_FACTS = `## Substrate facts — derive posture answers from these

When the operator asks a meta-question about mojulo itself — "does it phone home?", "what does it log?", "where does my data live?", "is my customers' data safe?", "do I have to pay for anything?", "how do I uninstall?" — derive the answer from these invariants rather than guessing. Each names its own check.

1. **Process.** One local control-plane process; the dashboard and this MCP are two faces over the same state. Two MCP transports: stdio (the npm-package default) has no auth — the parent process is the boundary; the HTTP route \`/api/mcp\` is bearer-gated on \`CONTROL_PLANE_MCP_KEY\` and 404s while that key is unset, by design. The packaged dashboard entry binds 127.0.0.1; a repo checkout's \`npm run dev\` does not pin a host. Either way the dashboard refuses requests addressed to a non-loopback Host (unless \`MOJULO_UI_HOST\`, the bind address, or \`MOJULO_UI_ALLOWED_HOSTS\`, names it reaches it by, lists it) and writes from another origin. Runtime daemons are opt-in and off by default.
2. **State.** One SQLite under \`$MOJULO_HOME\` (\`~/.mojulo/\` on an npm install; \`version\` reports the active home), plus \`data/cookbook/\` (kept recipes, as plain files in a local git repo), \`data/outcomes/\` (derived renders and exports), the bake caches (\`data/scene-png/\`, \`data/turntable/\`, \`data/figure-specs/\`), a browser or ffmpeg fetched on demand (\`chromium/\`, \`ffmpeg/\`), \`secret.key\`, the opt-in recall runtime and model (\`recall/\`, \`models/\`), and \`data/storage/\` (stash media). A home a 2.x install used may also hold \`data/artifacts/\` (bot zips) and the chatbot factory's tables; 3.0 leaves them in place and never reads them. Outside it: work folders under the OS temp directory while an MP4 encode or a headless browser runs (removed afterwards; the Blender bake scripts leave their \`moj-bake-*\` / \`moj-worldgi-*\` folders), a folder the caller names when it asks for one, and the MCP host configs \`mojulo init\` edits after a yes (never from the Claude plugin). No launch agents, no system services.
3. **Network.** No external telemetry: nothing is sent to the maintainer or to any analytics service, and starting the server makes no network call unless the opt-in recall group is installed and its search model is missing from \`~/.mojulo/models\` (then the start downloads it from huggingface.co, ~130 MB). Outbound traffic happens only on these actions: \`check_for_updates\` (registry.npmjs.org, when called); the first explicit render that needs a browser on a host with no Chrome, Chromium, Edge or Brave (\`forge_motion\` on a world, \`export_game\` hangar portraits, \`create_game\` with \`auto_audit\`, the dashboard's PNG download: a one-time ~500 MB Chrome for Testing download from storage.googleapis.com, unpacked by running the system \`unzip\` (Windows: \`tar.exe\`, then PowerShell), named in the result's \`browser_download\`; mint-time previews and thumbnails never download it); the first MP4 encode with no ffmpeg installed (ffmpeg-static from github.com, SHA-256 pinned); \`${mojuloCommand('install recall')}\` (npm, then the embedding model from huggingface.co); launching the dashboard without the separate \`${UI_PACKAGE_NAME}\` package (a one-time npm download); an HTML export with \`cdn: true\` (the page loads three.js from cdn.jsdelivr.net when opened; the default page is self-contained); and \`mint_solid\` \`via:'prompt'\` (the LLM provider the caller names, fact 4). Whatever the apps and services the operator builds call is theirs. **The local tool-call log** stays in the SQLite under \`$MOJULO_HOME\`: per call the tool name, start time, duration, status, the argument key names and byte size (never their values, unless the operator sets the off-by-default debug flag \`MOJULO_MCP_TELEMETRY_CAPTURE=full\`, which also keeps arguments and results up to 4 KB each), truncated error text, the MCP client's name and version and the session id; rows older than 30 days or beyond 50,000 are pruned at startup, each call also writes one line to stderr (which the host may keep in its MCP log), \`get_tool_ledger\` and the dashboard read it, and \`MOJULO_MCP_TELEMETRY=off\` stops the row and the line (*check: \`get_tool_ledger\`*).
4. **The one LLM flow that leaves the machine** is an opt-in studio door: \`mint_solid\` \`via:'prompt'\` (and its retired alias \`create_polygonized_sketch\`) sends the prompt to the provider the caller names (\`provider\` is required, nothing is picked for you) with the operator's key for it; the polygonizer's \`via:'packet'\` door is key-free. Everything else parks inference on the connecting agent.
5. **Credentials.** The substrate stores nothing it isn't handed: provider keys the operator explicitly saves are AES-256-GCM encrypted at rest under a random per-install key in \`$MOJULO_HOME/secret.key\` (mode 0600), or under \`API_KEY_ENCRYPTION_KEY\` when that is set; deleting the key file makes saved keys unreadable. No artifact mojulo mints needs an LLM key of its own.
6. **Money.** Mojulo is free, Apache-2.0, no account, no subscription. Operating costs are the operator's: LLM provider usage when they use \`mint_solid\`'s prompt door (fact 4), and whatever their own agent host costs. The open-source mojulo stays open source with no external telemetry (its only log is the local one in fact 3); a separately offered mojulo cloud on standard hosted services may be explored if there is demand, as its own opt-in product that changes nothing about the local install (TERMS.md, "The open-source commitment").
7. **Artifacts.** Everything minted is a tiny seeded deterministic recipe; exports are plain files (zip, HTML, glb, stl, WAV, MIDI, a Godot project) that run without mojulo. Nothing is locked to the runtime. **A recipe that carries a \`program\`** (\`mint_solid\` kind \`code\`, a workbench \`program\`) is JavaScript that runs inside this process with the operator's privileges when it is minted, edited, rendered or exported: the \`node:vm\` realm it runs in keeps it deterministic, it is not a sandbox. Treat a shared recipe that carries a program as code.
8. **Keeping and sharing.** \`save_recipe\` promotes a tuned artifact into the operator's own COOKBOOK at \`data/cookbook/\` — plain \`card.md\` + \`recipe.json\` folders in a local git repo with **no remote**, recallable later by intent through \`semantic_search\` because the agent writes the card's \`when\` line from the conversation. Sharing is the operator's act with their own git; the substrate never pushes. The kind catalog is likewise extensible from disk: cloning the public recipe book (\`MOJULO_RECIPE_BOOK\`) adds recipes and whole new view kinds, strictly additive and read from the local clone, never fetched. Its Door-2 \`builder.js\` files are imported at startup and run in this process with the operator's privileges, like a dependency: point \`MOJULO_RECIPE_BOOK\` only at a book you trust (the cookbook takes recipes only and skips a builder). A cookbook IS a valid book — the two formats are identical, which is what makes sharing free (*check: \`get_view_vocab\` shows kept entries with \`source: 'cookbook'\`*).
9. **Removal.** Uninstall = remove the Claude plugin or unwire mojulo from the MCP host config, remove the npm package (for npx, its folder under the npm cache's \`_npx\`), delete \`$MOJULO_HOME\`, and remove any \`moj-bake-*\` / \`moj-worldgi-*\` temp folders a Blender bake left. That is the whole footprint. (Bot containers, images or Fly apps deployed from a 2.x install run on their own; removing mojulo does not remove them.)
10. **Tenancy.** Single-user, self-hosted. No mojulo account, no hosted counterpart today, no remote kill switch — capability and suitability judgments belong to the operator (TERMS.md, docs/responsibility-model.md).
11. **Depth & verification.** Source, README, SECURITY.md (threat model), TERMS.md, and docs/ live at https://github.com/zombico/mojulo; the installed tag (\`version\` reports it) is the one that matches what is running. For a question these facts don't settle, say so and point the operator at those docs at that tag; don't guess.
`;

// --- Standing safety rules (compressed one-liners) ---
//
// The full secrets body (deny-rule JSON, AES-GCM rationale) and the full
// verification body used to live inline; they're compressed here to two
// load-bearing one-liners. The secrets rule is also stated in the `initialize`
// preamble and the `list_env` description; the verification discipline is
// restated by each host adapter's dry-run step.

const SAFETY_ONELINERS = `## Standing safety rules

- **Secrets.** Never \`cat\` or \`Read\` a \`.env\` under \`$MOJULO_HOME\` or in any directory mojulo generated: it holds keys the operator set.
- **Synthesize ≠ certify.** Everything mojulo emits through you inherits LLM failure modes (a wrong field name, an optimistic mapping). Before a recipe, plan or catalyst graduates from a one-off to something run again: one dry run on a *real* input, read the result, only then promote. A machine gate that passed is not an eyes gate.`;

// --- Standing rule: floor (shared) + disclosure directive (axis 2) ---
//
// The floor — the four-gate distinction — is load-bearing at every register
// cell and must stay legible regardless of how the agent narrates around it.
// The disclosure directive that follows says HOW MUCH the agent narrates
// (terse / reflective / pedagogical); the floor still applies inside whichever
// disclosure variant is active.

const STANDING_RULE_FLOOR = `## Commitment-level vocabulary (standing rule)

Keep these distinctions legible in every register and disclosure cell — they track real state:

- *proposed* vs *made* → a plan, variation or design still under consideration vs a recipe that now exists at a ref
- *dry-run* vs *promoted* → a trial pass against one real input vs something run again, on a batch or a schedule
- *machine gate* vs *eyes gate* → measured and stamped by the server vs a person looked at it; never claim the eyes gate passed
- *advisory* vs *refused* → findings stamped and shipped anyway vs a no that changed nothing (the refusal legend says what it protects)

In \`plain\` register the right-hand-side phrasing is what the user hears; in \`mojulo\` register either side works.`;

// forward_context's one-line form of the floor; get_register_kit carries the full table and directive.
const STANDING_LINE = `**Standing rule.** Keep *proposed* vs *made*, *dry-run* vs *promoted*, *machine gate* vs *eyes gate* and *advisory* vs *refused* legible in every reply; never claim the eyes gate passed. The full vocabulary: \`get_register_kit\`.`;

const DISCLOSURE_TERSE = `**Procedural disclosure: terse.** Act and report — one-line summary at the end. Do not narrate intermediate state unless the user asks. The distinctions above still apply; when you cross one, name it in one short clause ("made — ref sk_…" / "dry run looks clean, running the batch") and move on.`;

const DISCLOSURE_REFLECTIVE = `**Procedural disclosure: reflective.** Name the state before each step that commits: say "still a proposal" / "now made" / "trial pass" / "running the batch" / "the machine gate passed; the eyes gate is yours" explicitly so the user can always point at the current state without having to ask. Don't lecture on what each state *means* — naming it is enough at this disclosure level.`;

const DISCLOSURE_PEDAGOGICAL = `**Procedural disclosure: pedagogical.** Before each step that commits, explain what crossing it means and why it matters: "right now this is a proposal — nothing is made yet"; "now it's made: a recipe at a ref you can revise, re-render and export"; "the machine gate measured it; only you can pass the eyes gate." Teach the model as you go — the user is building their picture of mojulo through your narration.`;

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

- **Play / Print / Read / Hear / Observe** — what mojulo makes, named by what people do with it. **Play**: a game (below), or a world walked as a level. **Print**: a solid exported at true scale (STL / 3MF, mm, z-up). **Read**: diagrams, illustrations, science views, covers and publications. **Hear**: scores, sound effects, voice registers. **Observe**: any of them watched over time (a turntable, a flythrough, a recorded traversal); the GIF or MP4 is a derived file. Entry by FORM via \`get_creative_toolset\`; painted images and WAVs are bound derived files with provenance, the recipe stays sovereign.
- **Recipe artifact** — any minting (sketch, view, world, figure, motion, beats, game level): a tiny deterministic manifest stored in the DB and regenerated on render — never a stored render. Seeded, diffable, replayable; viewable at \`/sketches/<ref>\`. Revise it in place (\`update_sketch\`); don't re-mint.
- **Game** — composition: worlds as levels, figures, gear and sound bound into a standalone playable artifact — a shell owning a typed store (five slice kinds: character / inventory / party / progression / flags) plus levels that are worlds carrying a \`game:\` contract. \`design_game\` is the rail: a gameworld designed top down, made through the other tools. State persists across levels; play data never enters mojulo.
- **Workflows** — orchestration over the rest, for batches and variations: a **plan** (\`forge_plan\` → \`compile_plan\` → \`execute_plan\`, a chain written once; a step takes an earlier step's result as \`{ $step, path }\`), a **sweep** (one recipe varied over a value, \`run_experiment_sweep\`), and **stash → cook**.
- **Stash / Gather / Cook** — \`mint_stash\` makes a typed bucket, \`gather\` binds typed items (validated at intake, rejected when malformed), \`cook\` nucleates ONE outcome per singular aim into a self-contained folder at \`/outcomes/<cook_ref>/\` (14 publication kinds, essay → comic → site): a Read outcome. The agent authors the prose — no server-side LLM.
- **Catalyst** — a host-neutral workflow recipe shipped with mojulo: a loop run in the session, or one that reaches past mojulo (another MCP, an outside worker) and lands as a Skill on the host. Read one with \`get_catalyst\`; it is a starting point — adapt freely, or skip it and synthesize from scratch.
- **Skill** — a catalyst materialized into the user's host, in whatever form that host uses (a skill file, a scheduled automation, a workflow file). It runs in the host, beside the operator's other MCPs. \`get_adapter\` names YOUR host's form; don't assume another host's.
- **Host adapter** — the bridge between a host-neutral catalyst and the host's runnable form. One card per host mojulo knows, plus \`generic\` as the fallback — \`list_adapters\` for the current set. Auto-resolved from your client's \`clientInfo.name\`; pass \`host\` (or \`clientInfoHint\`) when the resolver guessed wrong. Read your adapter once via \`get_adapter\` before making. The card is guidance, not a constraint: if your runtime has a better native form, use it and say what you chose.
- **Agent-task queue** — where work parked for an outside fulfiller waits (\`pull_agent_task\` → \`submit_envelope_inference\`, or \`cancel_agent_task\`): single-claim, in memory, lost on restart. The render handoffs are its durable sibling for image and mesh workers.`;

const GLOSSARY_PLAIN = `## Concepts

*Everything in this section is for your cognitive grounding — these are the nouns you use to call mojulo's tools. **Don't surface the bold terms to the user**; the parenthesized phrasing is what to say in their place.*

- **Play / Print / Read / Hear / Observe** *(to the user: "games, things to print, things to read, things to listen to, and videos of any of them")* — what mojulo makes, named by what people do with it.
- **Recipe artifact** *(to the user: "a drawing / object / world / tune mojulo can always remake")* — every piece is stored as a tiny recipe rather than a picture or audio file; mojulo remakes it identically on demand, which keeps it small, editable, and comparable. To change it, edit it; don't start over.
- **Game** *(to the user: "a playable game")* — a game composed from the other pieces (level worlds, characters, gear, music) plus rules and saved progress: levels are little 3D worlds, progress carries between levels, and a level isn't accepted until a recorded playthrough proves it can be beaten. What happens in play stays on the player's side.
- **Workflows** *(to the user: "doing many at once" or "a set of steps you can run again")* — a plan of steps written once and run together, a batch of variations of one thing, or collected material turned into a finished piece.
- **Stash / Gather / Cook** *(to the user: "collect material, then turn it into a finished piece")* — collect notes, images, and links into a bucket (the stash), then cook them into one finished thing — an essay, a slide deck, a picture book, a small website — saved as a folder the user can open, share, or host.
- **Catalyst** *(to the user: "a workflow recipe")* — a recipe shipped with mojulo, run in the session or saved into the user's own agent so it can reach their other connected tools. Adapt freely; the recipe is a starting point.
- **Skill** *(to the user: "a workflow you can run again")* — a recipe saved into the user's own agent, in whatever form that agent uses.
- **Host adapter** *(to the user: "how the workflow gets built for your setup" — then name the form YOUR host uses)* — \`list_adapters\` for the current set; auto-resolved from your client. Read your adapter once via \`get_adapter\` before making.
- **Agent-task queue** *(to the user: don't surface; say "a waiting job")* — work parked for an outside helper to pick up and answer.`;

const GLOSSARY_MOJULO = `## Concepts

- **Play / Print / Read / Hear / Observe** — the outcome rings (\`ring\` in packs.js): games / solids / read (2D, views, publications) / audio / kernel motion. Worlds are the testbed ring; workflows orchestrate. \`PARADIGMS\` in context.js is the list.
- **Recipe artifact** — a sketches-table row; the per-kind assembler regenerates geometry/audio deterministically on render (\`world-kinds.js\` dispatch seam; \`create_view\` kinds, beats/voice/figure/motion). Renders (.glb / GIF / MP4) are exports or caches under \`data/outcomes/<ref>/\`, never the source. Iterate via \`update_sketch\` patch.
- **Game** — \`create_game\`: shell + typed store (\`store.slices\` from character | inventory | party | progression | flags, 8 typed events, atomic outcome application) + promoted levels (worlds with a \`game:\` channel: \`{levelRef, consumes, produces}\`). Level audits at mint (\`audits\` / \`auto_audit:true\` / \`allow_unaudited:true\`). \`design_game\` fronts it: make / keep / remake by fingerprint. Play state stays client-side.
- **Workflows** — \`execute_plan\` (registry runner, confirm-gated; \`{ $step, path }\` JSON Pointer refs, lib/mcp/plan-refs.js), \`run_experiment_sweep\`, stash → cook, catalysts.
- **Stash / Gather / Cook** — \`mint_stash\` → \`gather\` (8 item types, intake-validated) → \`cook\` (ONE aim, ≥1 stash slice, 14 kinds; \`site\` is whole-stash) → \`/outcomes/<cook_ref>/\`. Multi-kind preview via \`forge_publications\`; \`recommend_kind\` is rules-based.
- **Catalyst** — host-neutral workflow recipe in \`control/lib/mcp/catalysts/\`; run in the session or materialized through the host adapter into a Skill that runs beside the host's other MCPs.
- **Skill** — host-adapter-materialized runnable artifact. Form is per-host (skill file / automation / workflow file) — \`get_adapter\` for yours.
- **Host adapter** — catalyst → runnable bridge, one card per known host + \`generic\` fallback (\`list_adapters\`). Auto-resolved from \`clientInfo.name\`; \`clientInfoHint\` to self-identify.
- **Agent-task queue** — in-memory FIFO single-claim; parked requests reject on restart with \`INFERENCE_PARKED_LOST\`. Kind: \`envelope_inference\`. Tools: \`pull_agent_task\` / \`submit_envelope_inference\` / \`cancel_agent_task\`.`;

const CONCEPT_GLOSSARY_VARIANTS = {
  plain: GLOSSARY_PLAIN,
  mixed: GLOSSARY_MIXED,
  mojulo: GLOSSARY_MOJULO,
};

// --- Refusal legend (R3b, orientation-ramp.plan.md) ---
//
// The substrate refuses ON PURPOSE — the refusals are its best feature, but
// each one is documented only at its own tool. This is the map: one row per
// refusal family — what it protects · what to do next. Lives in the register
// kit because refusals are vocabulary ("what does this no *mean*"); costs
// nothing unless the kit is pulled. Register-invariant: the refusal text the
// agent sees on the wire doesn't branch on vocabulary_register.

const REFUSAL_LEGEND = `## When mojulo says no

A refusal is state protection, not a dead end. The families:

| Refusal | Protects | Next move |
|---|---|---|
| **Typed-intake rejection** (\`gather\` / \`update_item\` reject malformed items) | The stash's per-type contract — cook slices cite items, so a corrupt item poisons every downstream outcome | Fix the listed fields and re-gather; nothing was stored |
| **Promotion gate** (\`create_game\` refuses an unproven level) | The paradigm's completability guarantee — a shipped level that can't be beaten is a broken artifact | Supply a \`forge_motion\` traversal that reaches the win condition in \`audits\`, use \`auto_audit:true\` for mechanic levels, or record the skip with \`allow_unaudited:true\` |
| **Compile failure** (\`compile_plan\` → \`unknown_tools\` / \`illegal_tools\` / malformed) | The Actionable status — an executable plan must resolve every call against the live registry | \`revise_plan\` to remove or replace the failing calls; \`unknown_tools\` is roadmap signal, not a bug |
| **Two-step confirm** (\`archive_item\` when referenced; \`execute_plan\` requires \`confirm:true\`) | Cited atoms and real side effects (a plan's steps mint, export and write) — the first call is a dry-run by design | Read the returned references / manifest, then re-call with \`confirm: true\` |
| **Diff refusal** (\`diff_sketches\` → \`too_different\`) | Diff legibility — a diagram of pure churn communicates nothing | Re-call with \`force: true\` if you really want it, or diff nearer revisions |

If a refusal you hit isn't in this table, the tool's own message carries the remediation — recent refusals end with a \`next:\` clause.`;

// --- Catalyst texture preview (shared) ---

// --- Tool index + creative toolsets: generated from lib/mcp/tool-lines.js ---
//
// One line per listed tool, written once in TOOL_LINES; the ring comes from the tool's home pack
// (packs.js), the order from TOOL_LINES. get_tool_index lists every tool by ring; a FORM is a list of
// tool names plus `notes` for rows that are not one tool (a kind-qualified call, a pointer to another
// form). A tool's description stays its manual. Under the Claude plugin profile a hidden tool drops
// out by name and a line naming a closed door serves its `plugin` variant: no prose edits here.

function lineFor(name, profile) {
  const entry = TOOL_LINES[name];
  if (!entry) return null;
  if (profile && PLUGIN_PROFILE_HIDDEN_TOOLS.includes(name)) return null;
  return (profile && entry.plugin) || entry.line;
}

function ringOf(name) {
  return homePackForTool(name)?.ring || 'orientation';
}

function buildToolIndex(profile) {
  const sections = Object.entries(RING_TITLES).map(([ring, title]) => {
    const rows = Object.keys(TOOL_LINES)
      .filter((name) => ringOf(name) === ring)
      .map((name) => {
        const line = lineFor(name, profile);
        return line ? `- \`${name}\` · ${TOOL_LINES[name].verb} — ${line}` : null;
      })
      .filter(Boolean);
    return rows.length ? `### ${title}\n${rows.join('\n')}` : null;
  });
  const body = [
    '## Tool index (one line each)',
    '',
    "Every listed tool, by ring: `name` · verb — what it is for. Verbs: create · update · compose · observe · maintain · orient. A tool's description is its manual; one FORM's tools: `get_creative_toolset({ form })`.",
    '',
    sections.filter(Boolean).join('\n\n'),
  ].join('\n');
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return `${body}\n\n_index ${hash}_\n`;
}

const TOOL_INDEX_BY_PROFILE = new Map();
function toolIndex(profile = pluginProfileActive()) {
  if (!TOOL_INDEX_BY_PROFILE.has(profile)) TOOL_INDEX_BY_PROFILE.set(profile, buildToolIndex(profile));
  return TOOL_INDEX_BY_PROFILE.get(profile);
}

// ---------------------------------------------------------------------------
// Creative toolsets — the tools re-cut by FORM, reached via get_creative_toolset and the studio pack
// unveils. The keys match the routing index FORMs (one taxonomy, two surfaces). Add a new creative tool
// to exactly one form's `tools`; its line comes from TOOL_LINES. A note is a string or { line, plugin }.
// ---------------------------------------------------------------------------

const FORM_DEFS = {
  'diagram': {
    title: 'Diagrams & charts',
    makes: 'flow charts + data charts + scene sketches you view in the dashboard',
    tools: ['create_sketch', 'update_sketch', 'get_sketch_vocab', 'get_style_vocab', 'diff_sketches'],
    notes: [{
      line: "- Natural-language → sketch (the polygonizer) is an authoring door of the 3D-solid mint in the \"object\" form: kind `manji-tree`, `via:'packet'` key-free or `via:'prompt'` with the user's LLM key and a `provider`.",
      plugin: "- Natural-language → sketch (the polygonizer) is an authoring door of the 3D-solid mint in the \"object\" form: kind `manji-tree` with `via:'packet'`, key-free.",
    }],
  },
  'illustration': {
    title: 'Scene & figure illustration',
    makes: 'painted scene sketches + publication covers',
    tools: ['sketch_what_possible', 'create_cover'],
    notes: ['- Posed human figures and the manji-tree IR are 3D solids: the "object" form (kinds `figure` / `manji-tree`); a creature, or any body with a rig, is the "character" form.'],
  },
  'reference': {
    title: 'Visual reference (from a photo)',
    makes: 'read a photo YOU can see into mojulo dials — scene or pose',
    tools: ['reference_protocol', 'capture_reference'],
  },
  'image-render': {
    title: 'AI-image render pipeline',
    makes: 'direct / queue / gate an externally-painted image, comic page or mesh',
    tools: [
      'get_image_render_packet', 'bind_character_sheet', 'bind_image_render', 'render_handoff',
    ],
  },
  'character': {
    title: 'Characters',
    makes: 'heroes, creatures and animals: bodies with a rig you can play, print or watch',
    tools: ['create_character', 'update_character'],
    notes: ["- `as: 'hero'` a person on the rest skeleton (cast, register, tune, face, hair, dress last) · `as: 'creature'` an invented body from a ring `plan` · `as: 'animal'` a species by id or common name. Manuals: `get_solid_vocab({ id: 'layered' })`, `({ id: 'animal' })`. Revise in place with `update_character`: a hero's `spec` by word, `target` (a resolution and framing: the rings each part's outline needs), `geocube` (the level's light); `patch` for `/plan/…`, `/dials/<name>`."],
  },
  'object': {
    title: '3D solids, figures & objects',
    makes: 'objects, posed figures, buildings, wordmarks — the unified 3D-solid mint (a character is its own form)',
    tools: ['mint_solid', 'edit_solid', 'measure_solid', 'fabricate_solid', 'get_solid_vocab', 'verify_machina'],
    notes: ["- On a `layered` row a drawn line is data: `set /strokes/-` stores a stroke; `{ op:'solve', from:'/strokes/<id>' }` turns it into dials (silhouette), a strip (contour) or a brush dial, with the residual it could not hold."],
  },
  'world': {
    title: 'Worlds (traversable)',
    makes: 'walkable/drivable/flyable three.js environments + glTF export',
    tools: ['compose_world', 'list_world_themes', 'export_model', 'bind_mesh_render', 'translate_modeler_lingo'],
    notes: ["- A house / apartment / cottage / one furnished room is NOT a base: it is `mint_building` (the building form)."],
  },
  'building': {
    title: 'Buildings (houses and shops)',
    makes: 'walkable houses, apartments, furnished rooms, stores, restaurants, malls, offices and school campuses, each with its structure book (concept, layout, drawings, build) or as a game level',
    tools: ['mint_building', 'design_interior'],
  },
  'view': {
    title: 'Views (science / math / bio study)',
    makes: 'animated 3D study objects that teach a phenomenon',
    tools: ['create_view', 'get_view_vocab', 'measure_view', 'save_recipe'],
  },
  'motion': {
    title: 'Motion & film',
    makes: 'add time to a static subject; stitch clips into a film',
    tools: ['forge_motion', 'get_motion_vocab', 'stitch_motion'],
  },
  'motion-comic': {
    title: 'Motion comic — click-gated comic presentation',
    makes: 'a comic pieced out click by click in a fixed box — the powerpoint of comics',
    // A form with no tools of its own: a new kind costs a vocab card, not a registration. The rows are
    // kind-qualified calls, so create_sketch keeps its one home (diagram).
    tools: [],
    notes: [
      "- `create_sketch { kind: 'motion-comic' }` — a comic as a CLICK-GATED story: a fixed `box`, scenes that each frame one panel crop, and `events` revealed one click at a time (show, say, swap, move, letter, focus, hold). Plays at `/api/sketches/<ref>/play`.",
      '- `update_sketch { ref, manifest }` — revise the story in place; same gates as the mint.',
      "- `get_sketch_vocab { id: 'motion-comic' }` — the manual (manifest, deltas, box discipline, a worked example); read before your first mint. The export is one self-contained HTML file: `/play?download=1`.",
    ],
  },
  'audio': {
    title: 'Audio — Mojulo Beats',
    makes: 'synthesized soundtracks / tunes / grooves / sfx as seeded recipes',
    tools: ['create_beats', 'get_beats_vocab', 'export_beats', 'get_beats', 'update_beats', 'annotate_beats', 'diff_beats'],
  },
  'voice': {
    title: 'Voice — Mojulo Voice',
    makes: 'voice registers — deterministic recipes for how a voice sounds, rendered by an external speech worker',
    tools: ['create_voice', 'get_voice', 'bind_voice_sample', 'get_voice_vocab'],
  },
  'game': {
    title: 'Game',
    makes: 'a playable standalone artifact — a typed store + levels that are worlds',
    tools: [
      'design_game', 'tune_ground', 'pick_palette', 'create_game', 'create_pixelizer_game', 'create_sprite_sheet', 'bake_sprite_sheet', 'get_game_vocab',
      'get_play_vocab', 'export_game',
    ],
  },
};

const FORM_FOOTER = "A tool's description is its full manual (through a pack: `pack_<x>({ manual: '<tool>' })`).";

function formBody(def, profile) {
  const rows = def.tools.map((name) => {
    const line = lineFor(name, profile);
    return line ? `- \`${name}\` — ${line}` : null;
  });
  const notes = (def.notes || []).map((note) => (typeof note === 'string' ? note : (profile && note.plugin) || note.line));
  return [...rows, ...notes].filter(Boolean).join('\n') + (def.tools.length ? `\n\n${FORM_FOOTER}` : '');
}

// The served shape ({ title, makes, body }); readers (get_creative_toolset, packs-tools.js, tests) see
// only this. A context.test.js pin asserts Object.keys(FORM_TOOLSETS) deep-equals CREATIVE_FORMS.
export const FORM_TOOLSETS = Object.fromEntries(
  Object.entries(FORM_DEFS).map(([key, def]) => [key, { title: def.title, makes: def.makes, tools: def.tools, body: formBody(def, false) }]),
);

// Re-exported from the shared enum module (single source of truth); the order
// here drives buildCreativeToolsetMap + the handler. A context.test.js pin
// asserts Object.keys(FORM_TOOLSETS) deep-equals this.
export { CREATIVE_FORMS };

function buildCreativeToolsetMap(profile = pluginProfileActive()) {
  const rows = CREATIVE_FORMS.filter((k) => !profile || !PLUGIN_PROFILE_HIDDEN_FORMS.includes(k)).map((k) => {
    const t = formToolset(k, profile);
    const n = (t.body.match(/^- `/gm) || []).length;
    return `- \`${k}\` — ${t.title}: ${t.makes} (${n} tool${n === 1 ? '' : 's'})`;
  });
  return `## Creative toolsets — pick a FORM, pull its tools\n\n${rows.join('\n')}\n\nCall \`get_creative_toolset({ form })\` to read one form in full.`;
}



// --- Studio body (forward-context-grammar.plan.md, phase 1) ---
//
// The creative wing's orientation, the DEFAULT read. GRAMMAR, NOT NARRATION:
// the body is a call grammar — six verbs over one store, a dispatch table for
// `mint`, outcome classes, and guards. The doctrine is encoded as invariants
// on the verbs (revise returns the SAME ref; export is advisory-only; keep/
// recall exist), never narrated — editing rule: a new sentence of philosophy
// here is a regression; put posture behind get_substrate and depth behind
// routing cards / vocab drawers. Recognizer quotes ("draw me X", "teach me
// fission", portrait/landscape) are the features the model routes on — do not
// purity-strip them (a dropped "landscape" was a measured miss). The dispatch
// FORM labels are recognizers; the get_creative_toolset enum in the drawers
// is the argument — the reachability sweep in context.test.js pins both, and
// gate 2b (body-routing-eval.integration.test.js) scores any edit against the
// recorded baseline. Standalone, not a delta: the studio body re-carries the
// shared spine so an agent that jumps straight here is never missing the
// standing rules.

const STUDIO_OPENER = `The **call grammar**, mojulo's routing index. A **3D factory with a media studio**: one store of refs, and every thing it makes IS its seeded deterministic recipe — renders are derived, byte-identical per read. Things to **Play** (browser or desktop app), **Print** (STL / 3MF at true scale), **Read**, **Hear** and **Observe**; **Workflows** orchestrate the rest. Inputs are words and images (a photo you can see → \`reference_protocol\`). Six verbs compose everything below; match the ask to a FORM in the mint dispatch and call the tool on that row.`;

const STUDIO_ROUTING_INDEX = `## Routing index — the call grammar

Verbs — a verb is the grammar; the TOOL on its row is what you call (verbs are never tool names):

  mint    : intent → ref              dispatch below
  render  : ref → url                 idempotent · /sketches/<ref> (audio: /beats/<ref>)
  revise  : ref × delta → SAME ref    \`update_sketch\`
  export  : ref → files × ledger      advisory — findings stamped, never blocked
  recall  : query → refs · cards      \`semantic_search\`
  keep    : ref → cookbook            \`save_recipe\` · recallable by intent next session

Verb overrides (closed list): audio revises via \`update_beats\` · voice never revises — re-\`create_voice\` · motion appends — \`stitch_motion\` composes clips, never edits one.

Outcomes — a call lands one of four ways (classes to recognize, not wire types): ok(ref, url) · advisory(ref, findings — stamped, shipped anyway) · needs-vocab(the reply names the \`get_*_vocab\` drawer to read) · no(reason + next move — \`get_register_kit\` legend).

mint dispatch — match the ask to a FORM:
  CHARACTER a hero / a person to play or print, a creature, a monster, a dragon, a plush toy, an animal, rigged → \`create_character\` (as hero | creature | animal); revise, its target resolution, a level's light → \`update_character\` · to reuse across games → \`egocube\` (\`create_sketch\`)
  GAME     a game designed top down (hero, powers, gear, systems) → \`design_game\` · a level's ground → \`tune_ground\` · its colours → \`pick_palette\` · made levels, one store → \`create_game\` · a match-3 saga → \`create_pixelizer_game\`
  PLAY     make a world interactive (a lever, a door that opens, a HUD) → \`get_play_vocab\`
  PICTURE  diagram / data chart ("draw me X", "chart these numbers") → \`create_sketch\` · scene / figure illustration ("illustrate X", a portrait, a landscape) → \`sketch_what_possible\` (its \`architecturalConstruction\` family draws a house's FACADE — a picture, not a place; a house to walk is HOUSE) · a posed person / figure (even asked for as "a picture of…") → \`mint_solid\` · build from a PHOTO you can see → \`reference_protocol\` · direct an AI-generated image / comic page → \`create_sketch\` kind 'image-outcome'/'sequential-art'
  OBJECT   3D at literal scale — an everyday object / part, an assembly, a carved wordmark / logo, a spinning convex solid → \`mint_solid\` (kinds workbench / assembler / carved-solid / solid-turntable) · paint / emote one → \`edit_solid\` · measure one → \`measure_solid\` · which screws / bearings / hinges it needs, what to buy → \`fabricate_solid\` · mechanical feasibility of a minted object (joints, clearances, will-it-spin) → \`verify_machina\` (level completability is MOTION traversal, below)
  WORLD    traversable — city / airport / drivable / flyable / platformer / walkable anything → \`compose_world\` (a BASE × a THEME) · a level's own look (rooms, an island) → a \`geocube\` first (\`create_sketch\`) · animated science / math / bio study object ("teach me nuclear fission") → \`create_view\`
  HOUSE    a house / apartment / cottage / townhouse / ONE furnished room / a store, restaurant, mall or school campus, its plans, drawing set, frame or IFC → \`mint_building\` (routing card \`house\`; NOT compose_world, NOT edifice) · decorating one room → \`design_interior\`
  BUILDING institutional / bespoke one-off (a terminal, a hall, a block of masses + concourses) → \`mint_solid\` kind edifice · a dwelling is HOUSE
  OBSERVE  animate / turntable / flythrough / slideshow deck / replay-a-run / walk-to-a-place-and-verify → \`forge_motion\` (families camera / deck / traversal / waypoints) · join clips into one film → \`stitch_motion\` · cameras keyed in a world, a shot list → \`forge_motion\` \`shoot\`
  MOTION COMIC  click-by-click reveal, one self-contained HTML file → \`create_sketch\` kind 'motion-comic'
  AUDIO    soundtrack / tune / beat / sfx → \`create_beats\` · revise → \`update_beats\` · notes → \`annotate_beats\` · what changed → \`diff_beats\`
  VOICE    how a voice SOUNDS (deeper, more confident, a Japanese narrator) → \`create_voice\` (an external worker speaks it)
  PUBLICATION  essay / picture book / deck / brief from gathered material → \`mint_stash\` → \`gather\` → \`cook\` · multi-kind preview → \`forge_publications\`
  WORKFLOW many at once: a chain written once, each step taking the last's ref (mint → export → measure) → \`enter_plan_mode\` → \`forge_plan\` → \`compile_plan\` → \`execute_plan\` · variations of one recipe over a value → \`run_experiment_sweep\` · a flow through another MCP or worker on this host (Blender, ComfyUI) → \`recommend_catalysts\` → \`get_catalyst\`

export dispatch: object/figure → \`export_model\` (print-ready 3MF | STL, mm, z-up | glTF | USD) · game/world → \`export_game\` (web folder or desktop app) · audio → \`export_beats\` (WAV/MIDI) · sprites → \`bake_sprite_sheet\` · a file's creator receipt, asked for → \`sign_asset\` / \`verify_asset\`

Guards:
  - revise the same ref — never re-mint to change a thing
  - underdetermined form → ask one question; the answer routes
  - speaks 3D-modeler ("retopo", "blockout", "kitbash") → \`translate_modeler_lingo\`
  - fuzzy ask → \`semantic_search({kinds:['routing'], query:'<the ask>'})\` returns the family card whole`;

const STUDIO_DRAWER_DIRECTORY = `## Drawers — pull on demand, don't front-load

- \`get_creative_toolset({ form })\` — the per-FORM tool list; form ∈ diagram · illustration · reference · image-render · character · object · world · building · view · motion · motion-comic · audio · voice · game (the dispatch FORMs above are recognizers; this enum is the argument). No arg → the form map with a tool count each.
- \`semantic_search({ kinds: ['routing'] })\` — a creative family's full routing card (recognizer quotes + forks + flow). Vocab manuals ride the same tool: kinds \`sketch_vocab\` / \`view_vocab\` / \`beats_vocab\` / \`game_vocab\` / \`game_mechanic\` / \`game_kit\` / \`manji_program\`, read in full via the \`get_*_vocab\` readers.
- \`get_worked_example({ paradigm: 'media' | 'game' })\` — an annotated end-to-end trace of one successful flight, the gate moments marked; pull before your FIRST mint of a kind: how the calls go, never what to make (a game on the rail reads its guide instead; the ask still routes to its FORM entry tool).
- \`get_tool_index\` (every tool), \`get_register_kit\` (the glossary and the refusal legend), \`get_ui_map\` (dashboard pages), \`get_adapter\` (your host's card — read once before making).
- \`get_substrate\` — mojulo's own positioning + the substrate facts. Pull for meta-questions about mojulo itself ("what is this really?", phone home? my data? pay? uninstall?) — answer those from its facts, never from guesswork.`;

// --- Deliberation overview (Ring 6 deep block, promoted to its own tool) ---
//
// The why-this-is-structured-this-way explainer for the seven Ring 6 surfaces
// plus the daemon runtime-gating posture. Most sessions never touch Ring 6, so
// this deep block lives behind get_deliberation_overview rather than in the
// forward_context body. forward_context keeps the one-liner per surface in the
// ring TOC + a single pointer here.

const DELIBERATION_OVERVIEW = `# Deliberation surfaces (Ring 6) + runtime gating

Mojulo separates *what fired* (an automation run, an inference — outcome-rate, never written to the contextmap) from *why it was bound this way* (a catalyst materialized through a host adapter into an artifact — deliberation-rate, append-only). It also separates both of those from *what materials the operator has available right now* (their installed MCPs — present-state, replaceable), and from *what gets composed from those materials* (mcp-orbit workflows — recommendation + composition log, replaceable in-flight, sealed at materialization). Rare-call by design — expect 0–3 contextmap calls per session; declare inventory when the user asks for connected-service work (and again only if the environment changes during it); research a vendor when the agent's first encounter with a provider warrants it; the composer fires whenever the user wants an MCP-to-MCP workflow, not on a lifecycle cadence.

- **contextmap** (\`meta_context_brief\` / \`meta_context_commit\`) — the writeable, durable layer for the *why*. Append-only structural decisions sealed via typed commits (\`operator_kyc\`, \`operator_workspace_setup\`, \`primitive_artifact_materialization\`, \`app_materialization\`, \`trigger_artifact_materialization\`; the 2.x bot-bound \`artifact_materialization\` now only answers with a notice, its earlier events stay readable). Commit ONLY AFTER materializing the artifact, never to declare an intention.
- **inventory** (\`meta_context_declare_inventory\`) — the present-state MCP environment via introspection. Replace-semantic: the latest declaration is authoritative; previously declared tools not in the new call are wiped. The entry point for connected-service work.
- **connected-service mirror** (\`declare_skills\`) — reflects the host adapter's skills into mojulo for observation (it never writes to your host). Replace-semantic sibling to inventory; the \`skill\` form plus the materialized mcp-orbit form make up the Connected Services paradigm.
- **capabilities** (\`record_mcp_capabilities\` / \`get_mcp_capabilities\`) — the research facet of a provider, written via primary-source research; transactional supersession preserves full history (\`asOf\` walks the chain). Both inventory and capabilities write into provider rows on a shared identity layer — one logical "Gmail" regardless of which path arrived at it.
- **composer** (\`recommend_mcp_orbit_compositions\` / \`get_meta_catalyst\` / \`list_mcp_orbit_components\` / \`get_mcp_orbit_component\`) — reads providers + capabilities + inventory through one consolidated view and decomposes an MCP-to-MCP workflow into five typed component kinds (\`mcp\` × \`trigger\` × \`pattern\` × \`idempotency\` × \`render\`). Each chosen provider surfaces one of five states (\`research\` / \`seed\` / \`inventory_only\` / \`capabilities_only\` / \`none\`) as a constraint warning that routes remediation.
- **primitive + trigger binding** (\`bind_primitives\`, \`bind_trigger\` / \`unbind_trigger\` / \`list_triggers\` / \`get_trigger\`) — composer-anchored binding surfaces that resolve a typed \`component_ref\` and materialize a session-scoped artifact. \`bind_primitives\` fills a primitive's role template with the actual bound tool names + schemas from the operator's installed MCP; \`bind_trigger\` parks a payload template into the agent-tasks queue on cron cadence.
- **semantic recall** (\`semantic_search\`) — fuzzy lookup over durable mojulo state (principles, capability bodies, orbit components/compositions/artifacts, declared inventory tools, catalysts, and the card libraries — sketch vocab/methods, view vocab, beats vocab, game vocab/mechanics, manji programs, painted-landscape glyphs) when you have an intent but not a specific ref. Pair the ranked refs with the structured readers above to pull full bodies.

**Runtime gating.** The pieces that actually *run* are opt-in daemons under the unified host (\`mojulo-daemons\`, gated by \`MOJULO_DAEMONS=enabled\`). Per-daemon gates: \`MOJULO_TRIGGER_RUNTIME=enabled\` (the scheduler that fires bound triggers) and \`MOJULO_APP_RUNTIME=enabled\` (the app runner that survives a control-plane restart). Without the host up, \`bind_trigger\` still persists durable rows but nothing fires until a later boot enables the runtime, and \`start_app\` / \`stop_app\` throw a clear error while reads degrade (\`list_running\` → \`[]\`, \`status_app\` → \`unknown\`). For App-paradigm inference the agent is the fulfiller (\`pull_agent_task\` → \`submit_envelope_inference\`), driven by your host's own repeat affordance; \`MOJULO_AGENT_RUNTIME=claude-code-headless\` swaps in an in-process node fulfiller for unattended runs (Claude-Code-only today — other hosts fulfil from a session). Mojulo holds no LLM credentials on the inference path. Each fire writes a \`trigger_firing\` principle and each inference an \`app_inference\` principle on the target artifact node — the alternating \`trigger_firing → app_inference\` chain is the operational signature of an autonomous run.`;

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

// The launch line names this server's exact version: the dashboard is its own npm package, and it
// runs only beside the mojulo version it was built with (lib/version/ui-package.js).
const dashboardUiMap = (version) => `# Mojulo dashboard (\`mojulo-ui\`) — page map

The dashboard is the human-shaped face of the same \`~/.mojulo/\` state this MCP drives (launch with \`${uiLaunchCommand(version)}\`, bound to 127.0.0.1; it is the separate \`${UI_PACKAGE_NAME}\` package, so its first launch downloads it from npm, and nothing on this list is served until the operator has started it). The dashboard is view only: nothing on it writes, and nothing on it hands the user a prompt to paste. You don't drive these pages, and neither does the user — you point the user at the right one when the visual surface beats reading tool output, and every change goes through your tools. The whole UI is fully internationalized — it ships in ~two dozen languages (including right-to-left scripts like Arabic, Farsi, and Urdu), switchable in \`/settings\`, so if the user isn't an English speaker, the dashboard almost certainly speaks their language. Current pages:

The nav names what you make by what it is, in four modes: **Make** (Worlds, Places, Characters, Objects, Elements, Library), **Media** (Motion, Beats, Voice, Images), **Play** (Play, Render Bay, Outputs) and **Ideate** (Research, Plans, Stashes).

- **\`/\`** — **WORKSHOP HOME**: the plate that opens \`/dashboard\` (the library's 3D and 2D tallies), the newest projects on a rail as cards (each outcome a bar of its concerns' states), every door, and the status bar (installed packs, render-queue depth, artifact count, 24h tool-call volume). Point the user here when they ask "where is X".
- **\`/sketches/<ref>\`** — one artifact. A recipe on a rail (a gameworld, a city, a building, a solid on its ladder, a game), or one that draws sheets (a stage's art or landform board, a floormap's board, a UI board), opens as its **PROJECT PAGE**: its outcomes down the left, each concern a dot (filled when given, a ring when open, amber when a law advises, dashed when waived; a reviewed part settled by the creator is solid, by the machine gate a ring round a fainter fill), a dot opening the book at its concern; the book, the World, the game or a sheet in the middle, which also opens in a tab of its own (a book or a sheet also downloads as one self-contained file). A gameworld shows both its bibles, the world's (\`/api/sketches/<ref>/bible\`: the map, the land, its civilizations' towns and castles, each level) and the characters' (\`…/bible?book=characters\`), a dot opening the one its part is in, and its own atlas: the land, flora, blocks, structures, fortified town, castle and technology sheets drawn in its kit (\`/api/sketches/<ref>/sheet/<id>\`); its parts on the right, each marked fresh, stale, edited, missing, waiting or taken (what a run made, a city's segment levels and doors' insides, a room's pieces by ref); below, everything it and its parts were exported as, folder by folder (a building's sheets, schedules and IFC; a game's page, levels and Godot pack), each page opening in its own tab. A game has no outcome dots: its levels are its parts. It re-reads on its own, so point the user at it after you change the recipe and they watch it move. Every other kind (and \`?print=1\`, \`?display=\`, \`?bare=1\`) is the bare frame with the **Wire / Shaded / Baked / Painted** display-mode control. The same reading is JSON at \`/api/sketches/<ref>/rail\`.
- **\`/elements\`** — what a world is built and styled from, on screen without a recipe: the **repertoire** (every sheet mojulo draws from its own tables: index, land, flora, blocks, structures, fortified town, castle, technology, in a chosen kit, each opening in its own tab; \`/api/sheets/<id>?kit=&seed=\`, \`/api/sheets\` lists them with their kits), then every **geocube**, **kit** and **city grammar** as a card of its own colours. \`/elements/<family>/<id>\` shows one live (a geocube's room and land, a kit's bare stage, a grammar's small city, massing or look; drawn from a recipe built there and never stored), with its colour ramps, the recipes that name it, and its document (\`/api/elements\`, \`/api/elements/<family>/<id>\`). Point here when the user asks what a style, a kit or a grammar looks like.
- **\`/worlds\`** and **\`/places\`** — the projects on a rail by what they are: gameworlds (\`design_game\`), and cities and buildings (\`compose_world\`'s city plan, \`mint_building\`), as cards with their outcome bars. A city's segment levels and its doors' insides are parts on the city's page, not cards here.
- **\`/play\`** — every playable game as a cabinet, grouped by where it came from (a gameworld's run, a quick game, a pixelizer game, a game project, \`create_game\` alone), each played at \`/api/sketches/<ref>/game\` in its own tab, linking to the game's page and marked with what export_game shipped (its self-contained \`game.html\`, its Godot project). A game a world made links to that world's page; a project's shelf is \`/games/<ref>\`. \`/arcade\` and \`/maker/games\` redirect here.
- **\`/library\`** — one browser over every artifact, with shelves — **Recent · Scenes · Turntables · Models · Views · Characters · Images · Diagrams · Materials** (\`?shelf=\` deep-links one; Characters, Objects and Images in the nav are its shelves). Characters the figure / character-sheet / sprite-sheet kinds, Diagrams the flows and charts (a gameworld is on Worlds, not here), Materials the procedural-material registry, not sketch rows. \`/sketches\`, \`/maker/illustrations\`, \`/maker/worlds\`, \`/maker/objects\` redirect to their shelf.
- **\`/outcomes/<ref>/\`** — an artifact's outcome folder: its \`index.html\` when it has one (a motion's, a publication's), else a listing of what is in it, every subfolder and file a link.
- **\`/dashboard\`** — the **SPLAYED FLOOR**: the library laid out as 3D and 2D zones of shelf strips under a live bench hero; \`?ref=<sketch ref>\` opens the bench deep view (outliner, the artifact live, its recipe and bound outcome files).
- **Media** — **Motion** (\`/maker/motion\`, movies and gifs), **Beats** (\`/maker/beats\`, the audio shelf; each track's \`/beats/<ref>\` studio plays any revision, shows what changed and its annotations, and renders WAV and MIDI), **Voice** (\`/maker/voice\`, the voice registers from \`create_voice\`, tuned on sliders against their bound samples), **Images** (the Library's Images shelf).
- **\`/render-bay\`** — the RENDER BAY: (1) the durable image-render queue (\`image_render_requests\`: request → pull → submit → accept), staged as **Queued / In flight / Awaiting the eyes gate / Settled**; (2) **GI bakes**, the machine gate's numbers shown as passed and the eyes gate as the operator's; (3) **cooks and exports**, what is on disk under \`data/outcomes/<ref>/\` and \`data/exports/\`. Read-only: accepting or rejecting a render (\`accept_image_render\` / \`reject_image_render\`), pulling one (\`pull_image_render\`) and re-baking (\`bake-world-gi.mjs\`) are yours. \`/outputs\` is the publication inbox with its filters.
- **\`/plan\`**, **\`/research\`**, **\`/stashes\`** — Ideate: the plan inbox (Ring 8), the research books (Ring 9), and each stash's drawers and items as \`mint_stash\` / \`gather\` left them.
- **\`/observability\`** — the local tool-call log (per-tool calls, error rate, p50/p95, recent errors); records argument names and sizes, never values, and never leaves the machine. The in-session equivalent is \`get_tool_ledger\`.
- **\`/settings\`** — provider keys (encrypted via AES-GCM, not plaintext \`.env\`) and the UI language picker (~two dozen locales, incl. RTL).

Default mode stays MCP — suggest a page only when the user wants to *look* or *browse*, or when a visual scan would catch in a second something several rounds of tool output haven't.`;

// ---------------------------------------------------------------------------
// The Claude plugin profile (lib/mcp/plugin-profile.js)
//
// Under distribution() === 'claude-plugin' these bodies leave out what that build does not carry:
// the image-render, mesh and voice handoffs, the sprite sheets and style presets, the painted
// sketch kinds, the skin op, the prompt door, the automatic downloads and the CDN page. Each body
// keeps its one source above; the edits here are applied to it once, at load, and served only
// under the profile, so every other distribution reads the source unchanged. An edit whose `from`
// stops matching is recorded by profileEdit and fails plugin-profile.test.js.
// ---------------------------------------------------------------------------

// The creative-form lists ("… · image-render · … · voice · game") without the hidden forms.
const HIDDEN_FORM_LIST_EDITS = [
  [/ · image-render(?= · )/g, ''],
  [/ · voice(?= · )/g, ''],
];

// The tool index and the form bodies need no edits: they are generated per profile from TOOL_LINES
// (hidden tools drop by name, a closed door's line has a `plugin` variant). Null for a hidden form.
const PROFILE_FORM_TOOLSETS = Object.fromEntries(
  Object.entries(FORM_DEFS).map(([key, def]) => [
    key,
    PLUGIN_PROFILE_HIDDEN_FORMS.includes(key) ? null : { title: def.title, makes: def.makes, tools: def.tools, body: formBody(def, true) },
  ]),
);

/** One creative form's { title, makes, tools, body }, as get_creative_toolset and the pack unveils serve it. */
export function formToolset(key, profile = pluginProfileActive()) {
  return profile ? PROFILE_FORM_TOOLSETS[key] ?? null : FORM_TOOLSETS[key] ?? null;
}

const PROFILE_STUDIO_ROUTING_INDEX = profileEdit(STUDIO_ROUTING_INDEX, [
  [' · voice never revises — re-`create_voice`', ''],
  [" · direct an AI-generated image / comic page → `create_sketch` kind 'image-outcome'/'sequential-art'", ''],
  [' · paint / emote one → `edit_solid`', ' · emote a figure → `edit_solid`'],
  [/\n {2}VOICE {4}[^\n]*/, ''],
  [' · sprites → `bake_sprite_sheet`', ''],
], 'STUDIO_ROUTING_INDEX');

const PROFILE_STUDIO_DRAWER_DIRECTORY = profileEdit(STUDIO_DRAWER_DIRECTORY, HIDDEN_FORM_LIST_EDITS, 'STUDIO_DRAWER_DIRECTORY');

const PROFILE_CONCEPT_GLOSSARY_VARIANTS = Object.fromEntries(
  Object.entries(CONCEPT_GLOSSARY_VARIANTS).map(([key, body]) => [
    key,
    profileEdit(body, key === 'mixed'
      ? [['scores, sound effects, voice registers', 'scores and sound effects'], ['painted images and WAVs are bound derived files', 'renders and WAVs are bound derived files']]
      : key === 'mojulo'
        ? [['beats/voice/figure/motion', 'beats/figure/motion']]
        : [], `CONCEPT_GLOSSARY.${key}`),
  ]),
);

// get_substrate: no bound meshes, no automatic downloads, no CDN page and no keyed LLM door. The
// chatbot factory paragraph and fact 11 need no edit: every build quotes BOT_FACTORY_MOVED and
// points the operator at the repo docs.
const PROFILE_SUBSTRATE_POSITIONING = profileEdit(SUBSTRATE_POSITIONING, [
  ['(a scad row returns its source verbatim); and `bind_mesh_render` takes an STL or 3MF made outside back into a world.', '(a scad row returns its source verbatim).'],
], 'SUBSTRATE_POSITIONING');

const PROFILE_SUBSTRATE_FACTS = profileEdit(SUBSTRATE_FACTS, [
  [', a browser or ffmpeg fetched on demand (`chromium/`, `ffmpeg/`),', ','],
  [
    'starting the server makes no network call unless the opt-in recall group is installed and its search model is missing from `~/.mojulo/models` (then the start downloads it from huggingface.co, ~130 MB).',
    'starting the server makes no network call. This build never downloads a helper on its own: renders use a Chrome, Chromium, Edge or Brave already installed (or `MOJULO_CHROMIUM`), MP4 encodes use an installed ffmpeg (or `MOJULO_FFMPEG`), and the opt-in search model is fetched only by the user-run `install recall`.',
  ],
  [/ the first explicit render that needs a browser on a host with no Chrome, Chromium, Edge or Brave \([^;]*; mint-time previews and thumbnails never download it\); the first MP4 encode with no ffmpeg installed \(ffmpeg-static from github\.com, SHA-256 pinned\);/, ''],
  ['; an HTML export with `cdn: true` (the page loads three.js from cdn.jsdelivr.net when opened; the default page is self-contained); and `mint_solid` `via:\'prompt\'` (the LLM provider the caller names, fact 4).', '. An exported World page is always the self-contained one.'],
  [
    /4\. \*\*The one LLM flow that leaves the machine\*\*[^\n]*/,
    "4. **No LLM flow leaves the machine.** The studio has no keyed LLM door in this build: `mint_solid`'s natural-language door is `via:'packet'`, key-free. Everything else parks inference on the connecting agent.",
  ],
  ["Operating costs are the operator's: LLM provider usage when they use `mint_solid`'s prompt door (fact 4), and whatever their own agent host costs.", "Operating costs are the operator's: whatever their own agent host costs."],
], 'SUBSTRATE_FACTS');

// get_ui_map: the dashboard is the same package under every distribution; the profile only stops
// pointing at the pages for what it leaves out.
const PROFILE_UI_MAP_EDITS = [
  [/, \*\*Voice\*\* \(`\/maker\/voice`[^)]*\)/, ''],
  ['Characters the figure / character-sheet / sprite-sheet kinds,', 'Characters the figure kinds,'],
  [/\(1\) the durable image-render queue \(`image_render_requests`[^;]*; \(2\) \*\*GI bakes\*\*/, '(1) **GI bakes**'],
  ['; (3) **cooks and exports**', '; (2) **cooks and exports**'],
  ['accepting or rejecting a render (`accept_image_render` / `reject_image_render`), pulling one (`pull_image_render`) and re-baking', 're-baking'],
];

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const SECTION_DIVIDER = '\n\n---\n\n';

// The body is register-INVARIANT except the disclosure directive — `register`
// only sets the communication-settings notice (so the agent knows which
// get_register_kit cell to expect). The glossary, opener, and substrate prose
// no longer branch here; they drawerize. `pulse` is resolved in the HANDLER
// (like the operator anchor), never here — this builder must stay pure so the
// module-load-time FORWARD_CONTEXT_BODY export never touches the DB.
export function buildForwardContextBody({ register, disclosure, source, pulse, mode, profile = pluginProfileActive() } = {}) {
  const r = VOCABULARY_REGISTERS.includes(register) ? register : DEFAULT_VOCABULARY_REGISTER;
  const d = PROCEDURAL_DISCLOSURES.includes(disclosure) ? disclosure : DEFAULT_PROCEDURAL_DISCLOSURE;
  // The static part leads and the per-call part (settings, retired-mode line, pulse) closes the body,
  // so every call shares one prefix. The floor's table lives in get_register_kit; the standing line
  // keeps its four distinctions and the eyes-gate rule here, and the operator's disclosure directive
  // rides along because it is their setting for this session.
  const pulseLine = buildWorkshopPulseLine(pulse);
  return [
    HEADER,
    '',
    STUDIO_OPENER,
    SECTION_DIVIDER.trim(),
    profile ? PROFILE_STUDIO_ROUTING_INDEX : STUDIO_ROUTING_INDEX,
    SECTION_DIVIDER.trim(),
    profile ? PROFILE_STUDIO_DRAWER_DIRECTORY : STUDIO_DRAWER_DIRECTORY,
    SECTION_DIVIDER.trim(),
    SAFETY_ONELINERS,
    SECTION_DIVIDER.trim(),
    STANDING_LINE,
    '',
    communicationSettingsNotice({ register: r, disclosure: d, source: source || 'defaults' }),
    '',
    DISCLOSURE_DIRECTIVE_VARIANTS[d],
    ...(RETIRED_FORWARD_CONTEXT_MODES.includes(mode) ? ['', OFFICE_RETIRED_LINE] : []),
    ...(pulseLine ? ['', pulseLine] : []),
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
  const mode = input?.mode;
  if (mode !== undefined && !FORWARD_CONTEXT_MODES.includes(mode) && !RETIRED_FORWARD_CONTEXT_MODES.includes(mode)) {
    throw new Error(
      `\`mode\` must be one of: ${FORWARD_CONTEXT_MODES.join(', ')} (got '${mode}')`,
    );
  }
  const { register, disclosure, source } = resolveRegisterPrefs(input);
  const body = buildForwardContextBody({
    register,
    disclosure,
    source,
    mode,
    pulse: readWorkshopPulse(),
  });
  // Plain text content (not JSON-stringified) so the agent reads it as prose.
  // The mode signal (routing-context-weaving.plan.md A1) is what lets the
  // first-hop cut in orientationGaps tell the reads apart (an 'office' read
  // since 3.1.0 is a caller that has not caught up); stripped from the wire by
  // instrumentedInvoke.
  const resolvedMode = RETIRED_FORWARD_CONTEXT_MODES.includes(mode) ? mode : DEFAULT_FORWARD_CONTEXT_MODE;
  return { content: [{ type: 'text', text: body }], _telemetrySignal: { mode: resolvedMode } };
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
    pluginProfileActive() ? PROFILE_CONCEPT_GLOSSARY_VARIANTS[r] : CONCEPT_GLOSSARY_VARIANTS[r],
    SECTION_DIVIDER.trim(),
    REFUSAL_LEGEND,
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

// The full index is ~48k. A host that declares an output cap below that gets a
// truncated read it can't see the edges of, so serve the rules card instead —
// disclosed in its first line, with `full: true` always returning the real body.
// Mitigate and tell; never refuse, never silently reshape. (Capability comes
// from the host profile, so a second capped host needs no change here.)
export async function toolIndexHandler(input, ctx) {
  const index = toolIndex();
  const fullBytes = Buffer.byteLength(index, 'utf8');
  if (input?.full === true) {
    return { content: [{ type: 'text', text: index }] };
  }
  const captured = ctx?.mcpSessionId ? getClientInfo(ctx.mcpSessionId) : null;
  const hostId = resolveAdapterId({ clientName: input?.clientInfoHint || captured?.name });
  // An explicit budget wins (any host can ask for the card); otherwise the cap
  // comes from the resolved host's profile, so a second capped host is a JSON edit.
  const budgetBytes =
    Number(input?.budget_bytes) || hostCapabilities(hostId).maxOutputBytes;
  if (!budgetBytes || fullBytes <= budgetBytes) {
    return { content: [{ type: 'text', text: index }] };
  }
  const card = buildRulesCard({
    budgetBytes,
    notice: overBudgetNotice({ fullBytes, budgetBytes, host: hostId === 'generic' ? null : hostId }),
  });
  return { content: [{ type: 'text', text: card.text }] };
}

// Ring 10 re-cut by FORM. No arg → the form map (~1.5K); { form } → that
// family's per-tool lines. Keeps a creative lookup at ~2–6K instead of the
// whole ~46K tool index. See creative-toolsets.plan.md.
export async function creativeToolsetHandler(input, _ctx) {
  const form = input?.form;
  if (form === undefined || form === null || form === '') {
    return {
      content: [{ type: 'text', text: buildCreativeToolsetMap() }],
      _telemetrySignal: { id_requested: false, found: true },
    };
  }
  const profile = pluginProfileActive();
  if (profile && PLUGIN_PROFILE_HIDDEN_FORMS.includes(form)) {
    throw new Error(pluginProfileNotice(`The '${form}' form`));
  }
  if (!CREATIVE_FORMS.includes(form)) {
    // "unknown form" keeps the miss visible to the orientation cut
    // (DRAWER_MISS_ERROR_RE in mcpToolCalls.js).
    const known = profile ? CREATIVE_FORMS.filter((k) => !PLUGIN_PROFILE_HIDDEN_FORMS.includes(k)) : CREATIVE_FORMS;
    throw new Error(
      `get_creative_toolset: unknown form '${form}'. Known: ${known.join(', ')}`,
    );
  }
  const t = formToolset(form, profile);
  return {
    content: [{ type: 'text', text: `## ${t.title}\n\n${t.body}` }],
    _telemetrySignal: { id_requested: true, found: true },
  };
}

export async function deliberationOverviewHandler(_input, _ctx) {
  return { content: [{ type: 'text', text: DELIBERATION_OVERVIEW }] };
}

export async function uiMapHandler(_input, _ctx) {
  const map = dashboardUiMap(getServerVersion());
  return { content: [{ type: 'text', text: pluginProfileActive() ? profileEdit(map, PROFILE_UI_MAP_EDITS, 'get_ui_map') : map }] };
}

export async function substrateHandler(_input, _ctx) {
  const text = pluginProfileActive()
    ? `${PROFILE_SUBSTRATE_POSITIONING}\n${PROFILE_SUBSTRATE_FACTS}`
    : `${SUBSTRATE_POSITIONING}\n${SUBSTRATE_FACTS}`;
  return { content: [{ type: 'text', text }] };
}

// Back-compat for any importer (mostly tests) that wants today's default body
// without going through the handler. Renders the `mixed + reflective` cell —
// matches the body shape the tool emitted before register tuning landed.
export const FORWARD_CONTEXT_BODY = buildForwardContextBody({
  register: DEFAULT_VOCABULARY_REGISTER,
  disclosure: DEFAULT_PROCEDURAL_DISCLOSURE,
  source: 'defaults',
});

// Reads at call time so a runtime env change (e.g. MOJULO_HOME) shows up
// without a process restart. Local only: no network call (until 3.0 it also
// reported the chatbot image pin and the offline-build flag; both left with
// the chatbot factory).

/** `version({ workers: true })`: the optional workers this host has (lib/workers/find.js). Loaded on demand. */
async function workersSection() {
  const [{ workersPresent }, { findSlicer }, { systemCandidates }, { cachedFfmpegPath }] = await Promise.all([
    import('@/lib/workers/find'), import('@/lib/graph/scene/print-gate'), import('@/lib/graph/scene/chromium'), import('@/lib/motion/ffmpeg'),
  ]);
  return {
    workers: workersPresent({ findSlicer, chromiumCandidates: systemCandidates(), ffmpegCached: cachedFfmpegPath() }),
    driven: 'Image models, image-to-mesh services and speech models are driven by the agent; mojulo never calls one. Their work arrives through render_handoff and bind_voice_sample.',
  };
}

export async function versionHandler(input, _ctx) {
  const payload = {
    server: { name: SERVER_NAME, version: getServerVersion() },
    // How this copy was installed ('claude-plugin' | 'source' | 'npm'); install and update advice follows it.
    distribution: distribution(),
    // The newest revision this server speaks; each session negotiates its own at initialize.
    protocolVersion: LATEST_PROTOCOL_VERSION,
    supportedProtocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
    node: process.version,
    platform: { os: process.platform, arch: process.arch },
    mojuloHome: process.env.MOJULO_HOME || null,
    ...(input?.workers ? await workersSection() : {}),
  };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function fmtMs(v) {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

function fmtAgo(startedAt) {
  if (!startedAt) return '';
  const diff = Date.now() - startedAt;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Ring-0 membership for the abandonment cut — a session that called one of
// these and then nothing else got oriented and went nowhere. Kept here (not in
// the repository) because ring knowledge is this file's concern.
const ORIENTATION_TOOLS = [
  'forward_context',
  'get_tool_index',
  'get_register_kit',
  'get_deliberation_overview',
  'get_ui_map',
  'get_substrate',
  'get_worked_example',
  'version',
  'check_for_updates',
  'get_tool_ledger',
];

function renderOrientationGaps(gaps, coverage) {
  const { sessions, lowScoreSearches, drawerMisses, firstHops = [], sinceDays } = gaps;
  const header = `## Orientation gaps — last ${sinceDays}d\n\nThe moments the ask-and-discover loop failed to reward the question.`;
  const abandonRate = sessions.oriented
    ? ` (${Math.round((sessions.abandoned / sessions.oriented) * 100)}%)`
    : '';
  const sessionBlock = `\n\n### Sessions\n- ${sessions.total} session(s) recorded · ${sessions.oriented} pulled orientation · **${sessions.abandoned} oriented then made no non-orientation call**${abandonRate}`;
  const hopBlock = firstHops.length
    ? `\n\n### First hops after a routing read (where the routing actually sent the agent)\n${firstHops
        .map(
          (h) =>
            `- \`${h.after}\` → ${h.tool ? `\`${h.tool}\`` : '**(went nowhere)**'} · ${h.count}`,
        )
        .join('\n')}`
    : '\n\n### First hops after a routing read\n- none recorded';
  const searchBlock = lowScoreSearches.length
    ? `\n\n### Weak searches (empty or top score < threshold)\n${lowScoreSearches
        .map(
          (s) =>
            `- ${fmtAgo(s.startedAt)}: ${s.signal.result_count} result(s)${
              typeof s.signal.top_score === 'number' ? `, top ${s.signal.top_score.toFixed(2)}` : ''
            }${s.signal.kinds ? ` [${[].concat(s.signal.kinds).join(', ')}]` : ''}`,
        )
        .join('\n')}`
    : '\n\n### Weak searches\n- none recorded';
  const missBlock = drawerMisses.length
    ? `\n\n### Drawer misses (an id was asked for that doesn't exist)\n${drawerMisses
        .map((m) => `- \`${m.tool}\` (${fmtAgo(m.startedAt)})`)
        .join('\n')}`
    : '\n\n### Drawer misses\n- none recorded';
  const coverageBlock = coverage
    ? coverage.neverRouted.length
      ? `\n\n### Routing-card coverage — ${coverage.covered}/${coverage.total} cards' entry tools saw calls; never called:\n${coverage.neverRouted
          .slice(0, 20)
          .map((c) => `- \`${c.id}\` → \`${c.entry}\``)
          .join('\n')}${coverage.neverRouted.length > 20 ? `\n- …and ${coverage.neverRouted.length - 20} more` : ''}`
      : `\n\n### Routing-card coverage\n- every card's entry tool was called at least once (${coverage.total} cards)`
    : '';
  return `${header}${sessionBlock}${hopBlock}${searchBlock}${missBlock}${coverageBlock}`;
}

// Routing-card coverage (routing-context-weaving.plan.md A3): which cards'
// entry tools saw ANY call in the window. A card whose entry tool was never
// called at all definitely never routed — the honest floor under "rows that
// never route", answerable without per-call attribution. Fail-soft: a loader
// or aggregate failure just drops the section (same posture as the pulse).
function readRoutingCardCoverage(sinceDays) {
  try {
    // The Claude plugin profile's hidden routing cards are not part of its lexicon (no-op elsewhere).
    const cards = [...getRoutingCardCatalog().values()].filter((c) => !hiddenRowInPluginProfile('routing', c.id));
    if (!cards.length) return null;
    const called = new Set(
      McpToolCallRepository.aggregates({ sinceDays }).map((a) => a.tool),
    );
    const neverRouted = cards
      .filter((c) => !called.has(c.entry))
      .map((c) => ({ id: c.id, entry: c.entry, wing: c.wing }));
    return { total: cards.length, covered: cards.length - neverRouted.length, neverRouted };
  } catch {
    return null;
  }
}

export async function getToolTelemetryHandler(input, _ctx) {
  const tool = typeof input?.tool === 'string' && input.tool.trim() ? input.tool.trim() : null;
  const sinceDays = Number.isFinite(input?.sinceDays) && input.sinceDays > 0 ? input.sinceDays : 7;

  // { orientation: true } mode → the orientation-gap cut (orientation-ramp R4)
  // + the first-hop/coverage cut (routing-context-weaving.plan.md A2/A3).
  if (input?.orientation === true) {
    const gaps = McpToolCallRepository.orientationGaps({
      sinceDays,
      orientationTools: ORIENTATION_TOOLS,
    });
    const coverage = readRoutingCardCoverage(sinceDays);
    return { content: [{ type: 'text', text: renderOrientationGaps(gaps, coverage) }] };
  }

  // { tool } mode → that tool's recent calls, newest first.
  if (tool) {
    const calls = McpToolCallRepository.recent({ tool, limit: input?.limit || 25 });
    if (!calls.length) {
      return { content: [{ type: 'text', text: `No recorded calls for \`${tool}\`.` }] };
    }
    const lines = calls.map((c) => {
      const err = c.errorMessage ? ` — ${c.errorMessage}` : '';
      return `- ${c.status.padEnd(11)} ${fmtMs(c.durationMs).padStart(6)}  via=${c.via}  ${fmtAgo(c.startedAt)}${err}`;
    });
    return {
      content: [{ type: 'text', text: `## \`${tool}\` — last ${calls.length} calls\n\n${lines.join('\n')}` }],
    };
  }

  // No-args mode → per-tool aggregate summary + the most recent errors.
  const aggregates = McpToolCallRepository.aggregates({ sinceDays });
  if (!aggregates.length) {
    return {
      content: [
        {
          type: 'text',
          text: `No MCP tool calls recorded in the last ${sinceDays} day(s). Telemetry is ${process.env.MOJULO_MCP_TELEMETRY === 'off' ? 'OFF (MOJULO_MCP_TELEMETRY=off)' : 'on'}.`,
        },
      ],
    };
  }

  const header = `## MCP tool telemetry — last ${sinceDays}d (${aggregates.length} tools)\n\ntool · calls · err% · p50 · p95 · last called`;
  const rows = aggregates.slice(0, 40).map((a) => {
    const errPct = `${Math.round(a.errorRate * 100)}%`;
    return `- \`${a.tool}\` · ${a.calls} · ${errPct} · ${fmtMs(a.p50)} · ${fmtMs(a.p95)} · ${fmtAgo(a.lastCalledAt)}`;
  });

  const recentErrors = McpToolCallRepository.recent({ status: 'error', limit: 10 });
  const timeoutRows = McpToolCallRepository.recent({ status: 'timeout', limit: 5 });
  const errorBlock = recentErrors.length
    ? `\n\n### Recent errors\n${recentErrors
        .map((c) => `- \`${c.tool}\` (${fmtAgo(c.startedAt)}): ${c.errorMessage || 'unknown'}`)
        .join('\n')}`
    : '';
  const timeoutBlock = timeoutRows.length
    ? `\n\n### Recent timeouts\n${timeoutRows
        .map((c) => `- \`${c.tool}\` (${fmtAgo(c.startedAt)}) — soft-timeout tripped; check for a paired late_settle`)
        .join('\n')}`
    : '';

  return {
    content: [{ type: 'text', text: `${header}\n${rows.join('\n')}${errorBlock}${timeoutBlock}` }],
  };
}

// One upstream read: the npm registry for this package. Until 3.0 it also listed
// the chatbot image's tags on GHCR; that image left with the chatbot factory.
export async function checkForUpdatesHandler(_input, _ctx) {
  const pkgName = getControlPlanePackageName();
  const localVersion = getControlPlaneVersion();
  const npmResult = await fetchLatestNpmVersion(pkgName);

  const warnings = [];
  if (npmResult.error) warnings.push(npmResult.error);

  const cpUpdate =
    npmResult.version !== null && compareSemver(localVersion, npmResult.version) < 0;

  const payload = {
    controlPlane: {
      package: pkgName,
      current: localVersion,
      latest: npmResult.version,
      updateAvailable: cpUpdate,
      sourceClone: isSourceClone(),
      distribution: distribution(),
      installHint: cpUpdate ? updateAdvice(npmResult.version) : null,
    },
    warnings,
  };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

export function registerContextTools() {
  registerTool(withPluginProfile({
    name: 'forward_context',
    description:
      "Forward the agent mojulo's routing index: what it makes, named by use (Play · Print · Read · Hear · Observe) as FORM recognizer rows → the tool to call, the export dispatch, the Workflows row (plans, sweeps, catalysts), the guards, and a drawer directory (`get_creative_toolset`, routing cards, `get_tool_index`, `get_register_kit`, `get_ui_map`, `get_substrate`). Call FIRST when unsure which tool fits. A thin map, not a manual. Optional per-call `register` / `disclosure` override the operator anchor for this read. Read-only, idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: FORWARD_CONTEXT_MODES,
          description:
            "'studio', the one body (the default). The office wing left in 3.1.0; 'office' still answers with this body and a line saying so.",
        },
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
  }));

  registerTool({
    name: 'get_tool_index',
    description:
      "One-line-per-tool index across every ring — call when a `forward_context` row isn't specific enough (the FORM mints live behind `get_creative_toolset`). **~48k**: a host declaring a smaller output cap gets the compact rules card fitted to that cap instead; `full: true` returns the whole index regardless. Read-only, idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        full: {
          type: 'boolean',
          description: 'Whole ~48k index even over your cap.',
        },
        budget_bytes: {
          type: 'integer',
          description: 'Rules card at this byte budget, any host.',
        },
      },
    },
    handler: toolIndexHandler,
  });

  registerTool(withPluginProfile({
    name: 'get_creative_toolset',
    description:
      "Return the tool list for ONE creative FORM — diagram · illustration · reference · image-render · object · world · view · motion · motion-comic · audio · voice · game. No arg → the FORM map (which form makes what, with a tool count each). Pull this instead of `get_tool_index` when the task is to MAKE something visual, audible, or playable; the routing index's Create-things rows point here. Read-only, idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        form: {
          type: 'string',
          enum: CREATIVE_FORMS,
          description:
            'Which creative form to expand. Omit to list all forms with a one-line description + tool count of each.',
        },
      },
    },
    handler: creativeToolsetHandler,
  }, {
    edits: HIDDEN_FORM_LIST_EDITS,
    schema: (schema) => {
      schema.properties.form.enum = schema.properties.form.enum.filter((f) => !PLUGIN_PROFILE_HIDDEN_FORMS.includes(f));
      return schema;
    },
  }));

  registerTool({
    name: 'get_register_kit',
    description:
      "Return just the register-tuning surface — the active communication-settings notice (which `vocabulary_register` / `procedural_disclosure` cell is active and where it came from), the active-cell concept glossary, the refusal legend (one row per family of refusal: what it protects · the next move — pull this when a tool said no and you're unsure what the no means), the active-cell disclosure directive, and the invariant commitment-level floor (the four gates). Resolves the operator anchor the same way `forward_context` does; optional per-call `register` / `disclosure` override it for this one read. Read it to define a term for the operator, after they revise their KYC anchor, or to decode a refusal. Read-only, idempotent.",
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
      "Return the why-it's-structured-this-way explainer for the Ring 6 deliberation surfaces (contextmap, inventory, connected-service mirror, capabilities, the mcp-orbit composer, primitive + trigger binding, semantic recall) plus the daemon runtime-gating posture (`MOJULO_DAEMONS` / `MOJULO_TRIGGER_RUNTIME` / `MOJULO_APP_RUNTIME` / `MOJULO_AGENT_RUNTIME`). Most sessions never touch Ring 6, so this deep block lives behind its own tool rather than in `forward_context`. Call when doing structural work (MCP-to-MCP wiring, scheduled triggers, apps) and you want the separation-of-concerns model before composing. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: deliberationOverviewHandler,
  });

  registerTool({
    name: 'get_ui_map',
    description:
      "Return the page-by-page map of the `mojulo-ui` dashboard (the human-shaped face of the same `~/.mojulo/` state this MCP drives): one line per page describing what it's for and when to point the user at it (`/apps`, `/map`, `/graph`, `/plan`, `/research`, `/sketches`, `/maker`, `/settings`, …). You don't drive these pages — call this when the user wants to *look*, *browse*, or *click*, or when a visual scan would beat several rounds of tool output, so you can name the right page. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: uiMapHandler,
  });

  registerTool({
    name: 'get_substrate',
    description:
      "Return what mojulo is and what it can honestly claim — a 3D factory with a media studio: things to Play, Print, Read, Hear and Observe, kept as re-runnable recipes on the operator's machine; the digital (Godot, Unity, Unreal, Blender) and physical (STL / 3MF) pipelines; where inference runs; how outside workers and MCPs are reached — PLUS the SELF-DESCRIPTION facts (process, state, network posture, credentials, costs, uninstall, source) to DERIVE meta-answers from. Call for 'what is this really?' or questions about mojulo ITSELF: 'does it phone home?', 'where does my data live?', 'do I have to pay?', 'how do I uninstall?'. Read-only, no inputs, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: substrateHandler,
  });

  registerTool({
    name: 'version',
    description:
      'Report runtime versions: server name + version (from package.json), how it was installed, MCP protocol version, Node version, platform os/arch, and the active MOJULO_HOME. `workers: true` adds the optional workers this host has (Blender, Godot, Unity, Unreal, a slicer, OpenSCAD, ffmpeg, Chromium): each one\'s path or null, the env var that points at it, and what still happens without it. Local only, no network call. Read-only, idempotent.',
    inputSchema: { type: 'object', properties: { workers: { type: 'boolean' } } },
    handler: versionHandler,
  });

  registerTool({
    name: 'check_for_updates',
    description:
      "Compare the running control-plane package (`mojulo` on npm) against its latest published version. Returns `{ controlPlane, warnings }` — `current`, `latest`, `updateAvailable`, and a one-line install/update hint when an upgrade exists. Read-only: never installs or restarts anything; surface the hint and let the user run it. Best-effort upstream calls — a registry timeout produces `latest: null` plus a warning, not a tool failure. Call this when the user asks 'am I up to date?', after a long gap between sessions, or before recommending a feature that depends on a recent version.",
    inputSchema: { type: 'object', properties: {} },
    handler: checkForUpdatesHandler,
  });

  registerTool({
    name: 'get_tool_ledger',
    description:
      "Read the ledger the substrate keeps of its own MCP tool calls — shapes and timings, one row per handler invocation across both call paths (rpc + plan-executor); nothing leaves the machine. Three modes: no args → a per-tool aggregate table (calls, error rate, p50/p95 latency, last-called) over the last `sinceDays` (default 7) plus the most recent errors and timeouts; `{ tool }` → that tool's recent calls newest-first with status + duration; `{ orientation: true }` → the orientation-gap cut (weak semantic searches, vocab-drawer misses, sessions that oriented then made no non-orientation call) — the measurement of whether the ask-and-discover loop is rewarding the question. This is the in-session answer to \"which tool broke?\" / \"what's slow?\" / \"is the lexicon working?\" without leaving the chat. Records SHAPES only — never input values or conversation content. Read-only, idempotent. Mirrors the `/observability` dashboard page.",
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'Filter to one tool by registration name → its recent calls. Omit for the aggregate summary.',
        },
        sinceDays: {
          type: 'number',
          description: 'Aggregate window in days (no-args and orientation modes). Default 7.',
        },
        limit: {
          type: 'number',
          description: 'Max recent calls to return in `{ tool }` mode. Default 25.',
        },
        orientation: {
          type: 'boolean',
          description: 'true → the orientation-gap cut: weak searches, drawer misses, oriented-then-abandoned sessions.',
        },
      },
    },
    handler: getToolTelemetryHandler,
  });
}
