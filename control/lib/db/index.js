import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Resolved lazily at first getDb() call (not at module load) so test files can
// set SQLITE_PATH after their `import` block has hoisted — ESM evaluates imports
// before the test file's body, so a top-level `process.env.SQLITE_PATH = …`
// would otherwise lose the race.
function resolveDbPath() {
  return process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'mojulo-lite.db');
}

let _db = null;

function init(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Single-user app preferences. First user-selectable persisted "mode" in
    -- the control plane. Key/value so new settings are additive without a
    -- migration. Absence of a key IS its fresh-install default (resolved in
    -- the repository), so no seed row. See app-system/0528/agent-routed-chat.md.
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      parsed_text TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      bot_name TEXT NOT NULL,
      flow_type TEXT NOT NULL,
      status TEXT NOT NULL,
      config TEXT NOT NULL,
      config_hash TEXT,
      last_built_hash TEXT,
      artifact_path TEXT,
      document_ids TEXT,
      api_key TEXT NOT NULL,
      error TEXT,
      url TEXT,
      last_seen_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modular_sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      preloaded_context TEXT,
      messages TEXT,
      inferred_intent TEXT,
      intent_confidence REAL,
      recommended_protocols TEXT,
      enabled_protocols TEXT,
      core_config TEXT,
      identity_config TEXT,
      protocol_data TEXT,
      generated_configs TEXT,
      deployment_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_jobs (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER,
      result TEXT,
      error TEXT,
      mcp_session_id TEXT,
      builder_session_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_jobs_created_at ON mcp_jobs(created_at);

    -- MCP tool-call telemetry. One row per handler invocation across both call
    -- paths (rpc tools/call + plan-mode executor). Describes the CALL — never
    -- the conversation: input_keys is top-level key NAMES only, input_bytes /
    -- result_bytes are serialized sizes, values are never stored unless the
    -- operator opts into MOJULO_MCP_TELEMETRY_CAPTURE=full (input_json /
    -- result_json, truncated). Writes are fire-and-forget from telemetry.js —
    -- a failure here must never fail a tool call. See lib/mcp/telemetry.js and
    -- lib/mcp/observability.plan.md.
    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool TEXT NOT NULL,
      via TEXT NOT NULL,
      session_id TEXT,
      client_name TEXT,
      client_version TEXT,
      started_at INTEGER NOT NULL,
      duration_ms REAL,
      status TEXT NOT NULL,
      error_message TEXT,
      input_keys TEXT,
      input_bytes INTEGER,
      result_bytes INTEGER,
      input_json TEXT,
      result_json TEXT,
      signal_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool ON mcp_tool_calls(tool, started_at);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_status ON mcp_tool_calls(status, started_at);

    CREATE TABLE IF NOT EXISTS meta_nodes (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('bot', 'mcp_tool', 'catalyst', 'adapter', 'artifact', 'operator')),
      ref TEXT,
      label TEXT NOT NULL,
      payload_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(kind, ref)
    );

    CREATE TABLE IF NOT EXISTS meta_edges (
      id INTEGER PRIMARY KEY,
      src_id INTEGER NOT NULL REFERENCES meta_nodes(id) ON DELETE CASCADE,
      dst_id INTEGER NOT NULL REFERENCES meta_nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('binds', 'seeded', 'materialized_by', 'runs_for')),
      payload_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(src_id, dst_id, kind)
    );

    CREATE TABLE IF NOT EXISTS meta_principles (
      id INTEGER PRIMARY KEY,
      scope_kind TEXT NOT NULL CHECK(scope_kind IN ('node', 'edge')),
      scope_id INTEGER NOT NULL,
      body_md TEXT NOT NULL,
      source_event TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_meta_nodes_kind_ref ON meta_nodes(kind, ref);
    CREATE INDEX IF NOT EXISTS idx_meta_edges_src ON meta_edges(src_id);
    CREATE INDEX IF NOT EXISTS idx_meta_edges_dst ON meta_edges(dst_id);
    CREATE INDEX IF NOT EXISTS idx_meta_principles_scope ON meta_principles(scope_kind, scope_id);

    -- Current-state cache of the connecting agent's MCP inventory. Sits
    -- alongside the append-only contextmap (meta_nodes/edges/principles) on
    -- purpose: inventory is the operator's present environment, not a sealed
    -- decision, so it gets replace semantics (DELETE + INSERT in one txn)
    -- instead of append. See lite-template/integration/MCP_INVENTORY_PLAN.md.
    CREATE TABLE IF NOT EXISTS meta_mcp_inventory (
      id INTEGER PRIMARY KEY,
      server TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_ref TEXT NOT NULL,
      description TEXT,
      declared_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(server, tool_name)
    );
    CREATE INDEX IF NOT EXISTS idx_meta_mcp_inventory_tool_ref ON meta_mcp_inventory(tool_ref);

    -- Identity layer for MCP providers. One row per logical MCP (e.g. "gmail",
    -- "notion", "linear"), keyed on a canonical lowercase provider_ref derived
    -- by the canonicalizer at write time. Inventory rows (introspection facet)
    -- and capability rows (research facet) both FK here, so both paths to
    -- knowing an MCP converge on the same provider entity. Mojulo never
    -- asserts a provider directly; rows are upserted as a side-effect of
    -- facet writes. display_name is first-writer-wins (no repair tool in v0).
    -- See lite-template/integration/MCP_DECURATION_PLAN.md.
    CREATE TABLE IF NOT EXISTS meta_mcp_providers (
      id INTEGER PRIMARY KEY,
      provider_ref TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Vendor knowledge facet of a provider. Agent-authored body (via the
    -- research-mcp-vendor catalyst); ships with a small seed set on first
    -- install. Append-with-supersession semantics: a new write for an
    -- existing provider inserts a new row and sets the prior current row's
    -- superseded_by, all in one transaction. The unique partial index
    -- enforces at most one current row (superseded_by IS NULL) per provider —
    -- supersession is mandatory, not optional.
    CREATE TABLE IF NOT EXISTS meta_mcp_capabilities (
      id INTEGER PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES meta_mcp_providers(id) ON DELETE CASCADE,
      version_tag TEXT,
      body_md TEXT NOT NULL,
      source_urls TEXT,
      discovered_at INTEGER NOT NULL DEFAULT (unixepoch()),
      superseded_by INTEGER REFERENCES meta_mcp_capabilities(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_mcp_capabilities_current
      ON meta_mcp_capabilities(provider_id)
      WHERE superseded_by IS NULL;
    CREATE INDEX IF NOT EXISTS idx_meta_mcp_capabilities_by_provider
      ON meta_mcp_capabilities(provider_id, discovered_at DESC);

    -- mcp-orbit component store. Decomposes the monolithic mcp-orbit catalyst
    -- pattern into a small set of typed components that combine
    -- multiplicatively. Five kinds: mcp (per-MCP affordance: read, write,
    -- watch), trigger, pattern, idempotency, render. source and destination
    -- are composition ROLES carried on each mcp entry in component_refs,
    -- not component kinds — the same Gmail MCP can play source role in one
    -- composition and destination role in another. The agent composes; the
    -- server provides components + constraint validation. Server-stored,
    -- agent-composed. See lite-template/integration/MCP_ORBIT_V1_PLAN.md for
    -- the role refinement and MCP_ORBIT_COMPONENT_STORE_PLAN.md for the v0
    -- substrate.
    CREATE TABLE IF NOT EXISTS mcp_orbit_components (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('mcp','trigger','pattern','idempotency','render')),
      ref TEXT NOT NULL,
      version TEXT NOT NULL,
      body_md TEXT NOT NULL,
      payload_json TEXT,
      source TEXT NOT NULL CHECK(source IN ('builtin','custom')) DEFAULT 'builtin',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(kind, ref, version)
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_components_kind ON mcp_orbit_components(kind);
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_components_ref ON mcp_orbit_components(ref);

    -- Compositions as first-class rows. Same reasoning as meta-context's
    -- typed graph: structure earned upfront is cheaper than retrofitting.
    -- The v1+ trajectory (templates, analytics, sharing) all needs
    -- compositions queryable.
    CREATE TABLE IF NOT EXISTS mcp_orbit_compositions (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      intent_md TEXT NOT NULL,
      component_refs TEXT NOT NULL,
      knobs_json TEXT NOT NULL,
      ranking_score REAL,
      status TEXT NOT NULL CHECK(status IN ('proposed','dry_run','materialized','retired')) DEFAULT 'proposed',
      artifact_ref TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_compositions_status ON mcp_orbit_compositions(status);
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_compositions_artifact ON mcp_orbit_compositions(artifact_ref);

    -- Generated provider artifacts from the primitive-binding generator. Each
    -- row is a session-scoped markdown body produced by filling a primitive's
    -- role-specific template against a capability snapshot for one MCP. Stored
    -- so the agent can reference a stable ref between bind_primitives and the
    -- subsequent commit; also makes the artifact auditable as the durable
    -- link between primitive + snapshot + bound tool names + confidence.
    -- See lite-template/integration/MCP_PRIMITIVE_BINDING_PLAN.md.
    CREATE TABLE IF NOT EXISTS mcp_orbit_provider_artifacts (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      primitive_ref TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('source','destination')),
      server TEXT NOT NULL,
      introspected_at INTEGER,
      snapshot_confidence TEXT,
      body_md TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      bindings_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_provider_artifacts_server ON mcp_orbit_provider_artifacts(server);
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_provider_artifacts_primitive ON mcp_orbit_provider_artifacts(primitive_ref, role);

    -- Trigger artifacts — persisted declarations of bound activation triggers.
    -- Sibling shape to mcp_orbit_provider_artifacts: every binding references
    -- a typed composer component by versioned ref (component_ref), so the
    -- contextmap's audit chain records which component each materialization
    -- resolved against. Composer-anchored runtime is load-bearing here —
    -- adding a new trigger kind means shipping a typed component first, then
    -- this row's component_ref points at it. No parallel enum inside the
    -- bind tool. See lite-template/integration/app-system/0526/
    -- TRIGGER_BINDING_PLAN.md.
    CREATE TABLE IF NOT EXISTS mcp_orbit_trigger_artifacts (
      id INTEGER PRIMARY KEY,
      trigger_ref TEXT NOT NULL UNIQUE,
      component_ref TEXT NOT NULL,
      binding_params_json TEXT NOT NULL,
      payload_template_json TEXT NOT NULL,
      composition_ref TEXT,
      artifact_ref TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      superseded_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_orbit_trigger_artifacts_component
      ON mcp_orbit_trigger_artifacts(component_ref);
    -- Reject two active bindings against the same (composition_ref,
    -- artifact_ref, component_ref) tuple. COALESCE on the nullable refs is
    -- load-bearing: SQLite's default UNIQUE treats NULL as distinct from
    -- NULL, which would let two triggers with the same artifact_ref but
    -- both null composition_ref coexist — exactly the duplicate we want to
    -- block. Mapping NULL → '' makes the tuple comparison work as intended.
    -- The agent must explicitly unbind before rebinding the same target.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_orbit_trigger_artifacts_current
      ON mcp_orbit_trigger_artifacts(
        COALESCE(composition_ref, ''),
        COALESCE(artifact_ref, ''),
        component_ref
      )
      WHERE superseded_by IS NULL AND enabled = 1;

    -- Unified semantic-search sidecar across durable app state. One row per
    -- (source_kind, source_ref) — principles, mcp tools, capabilities,
    -- orbit components/compositions/provider artifacts, catalysts. Read
    -- shape (the agent wants relevant text, regardless of which table holds
    -- it) is uniform; each source table keeps its own write discipline, and
    -- this sidecar mirrors via the embeddings repository helpers. The
    -- model column is in v0 specifically to enable future model swaps
    -- without a destructive rebuild. See lite-template/integration/
    -- SEMANTIC_INDEX_PLAN.md.
    CREATE TABLE IF NOT EXISTS meta_embeddings (
      id INTEGER PRIMARY KEY,
      source_kind TEXT NOT NULL CHECK(source_kind IN (
        'principle',
        'mcp_tool',
        'mcp_capability',
        'orbit_component',
        'orbit_composition',
        'orbit_artifact',
        'catalyst',
        'sketch_vocab',
        'sketch_method',
        'manji_program',
        'painted_landscape',
        'view_vocab',
        'beats_vocab',
        'game_vocab',
        'game_mechanic',
        'game_kit',
        'game_glyph',
        'game_sfx',
        'routing'
      )),
      source_ref TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      body_text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(source_kind, source_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_meta_embeddings_kind ON meta_embeddings(source_kind);

    -- Agent-minted dynamic sketches. The operator agent (Claude Code / Codex
    -- driving the MCP) POSTs a manifest via the create_sketch tool; the row
    -- is rendered on demand at /sketches/<ref> by the same SVG renderer that
    -- powers /graph. Sibling, not integration: sketches are scratch
    -- visualizations, not structural commits — kept off the contextmap so
    -- they don't compete with append-only deliberation surfaces. See
    -- lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md.
    CREATE TABLE IF NOT EXISTS sketches (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_sketches_created_at ON sketches(created_at DESC);

    -- Optional folder grouping for sketches. NULL folder_ref on a sketch row =
    -- root; a non-null folder_ref points at a sketch_folders.ref. Folders are
    -- a flat list (no nesting) — the surface is a scratch space, not a
    -- filesystem. Deleting a folder moves its sketches back to root rather
    -- than cascading the delete (sketches outlive folders).
    CREATE TABLE IF NOT EXISTS sketch_folders (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_sketch_folders_created_at ON sketch_folders(created_at DESC);

    -- Plan mode (Ring 8). The PROPOSED layer of the deliberation model — the
    -- speculative counterpart to contextmap's committed reality. A plan is a
    -- sealed cognitive unit drawing the schematic of one vertical slice (a
    -- "spike"); when its manifest is tractable (every call resolves to a live
    -- MCP tool) it compiles to status='actionable' and the operator can run
    -- it under per-execution approval. Deliberately NOT a contextmap commit
    -- type: contextmap is sealed reality, a plan is pre-reality, so it lives
    -- in its own table. The seen column is the light read/unread inbox gate
    -- (not a formal review workflow). The lens column records which of the
    -- four latent shapes the frame settled into; null while still undecided.
    -- manifest_json / frame_json / analysis_json carry the projected shadow
    -- scratchpad. No cross-plan context in v0 — subplans live inside the
    -- prime plan's manifest, not as sibling rows. See
    -- lite-template/integration/app-system/0527/plan-feature/PLAN_MODE.md.
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY,
      plan_ref TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      goal_md TEXT NOT NULL,
      lens TEXT CHECK(lens IN ('spike','segment_expansion','vertical_reinforcement','collider')),
      status TEXT NOT NULL CHECK(status IN ('draft','actionable','executing','executed','failed')) DEFAULT 'draft',
      seen INTEGER NOT NULL DEFAULT 0,
      frame_json TEXT,
      manifest_json TEXT,
      analysis_json TEXT,
      revision_log_json TEXT NOT NULL DEFAULT '[]',
      execution_log_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
    CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at DESC);

    -- Research mode (Ring 9). The ACCRETIVE / exploratory layer that sits
    -- upstream of the proposed layer (plans). A research session is a durable,
    -- book-like context with no goal but to assist; starting one auto-saves it.
    -- Broad items bind to it (links, articles, summaries, screencaps, notes),
    -- and synthesize_abstract distills the book into a thesis sent (via
    -- POST /api/plans/from-abstract) to plan mojulo for evaluation — optionally
    -- forging a Draft plan. An optional drawer, deliberately not woven into
    -- forward_context (posture-sibling to sketches). One-way coupling:
    -- research depends on plans, plans never import research. See
    -- lite-template/integration/app-system/0528/research-mode.md.
    CREATE TABLE IF NOT EXISTS research_sessions (
      id INTEGER PRIMARY KEY,
      research_ref TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','archived')) DEFAULT 'open',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_research_sessions_status ON research_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_research_sessions_created_at ON research_sessions(created_at DESC);

    -- Broad items bound to a research session. kind is intentionally a
    -- freeform string (a book holds anything); the bind tool validates against
    -- a known-but-broad set so adding a kind is a one-line tool change, not a
    -- schema migration. media_ref points into stored media (documents) for
    -- screencaps. Append-semantic — a book accretes; deletion is a later
    -- affordance, not v0.
    CREATE TABLE IF NOT EXISTS research_items (
      id INTEGER PRIMARY KEY,
      research_ref TEXT NOT NULL REFERENCES research_sessions(research_ref) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT,
      body_md TEXT,
      source_url TEXT,
      media_ref TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_research_items_session ON research_items(research_ref, created_at);

    -- Synthesized abstracts. Append-only history: each synthesis is a snapshot
    -- of the book at that moment, so the thesis's evolution is auditable.
    -- plan_ref / assessment_json are backfilled when the abstract is evaluated
    -- by plan mojulo and (optionally) forges a Draft plan.
    CREATE TABLE IF NOT EXISTS research_abstracts (
      id INTEGER PRIMARY KEY,
      research_ref TEXT NOT NULL REFERENCES research_sessions(research_ref) ON DELETE CASCADE,
      body_md TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      plan_ref TEXT,
      assessment_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_research_abstracts_session ON research_abstracts(research_ref, created_at);

    -- Stash / Gather / Cook (Ring 9 — research mode v2). Sharper edges than the
    -- original research_* schema: a Stash is a renameable user-facing bucket
    -- with optional drawers; items declare a typed contract on intake (rejected
    -- at the gate if malformed) so the UI can dispatch by type and Cook can
    -- treat items as ingredients. Coexists with research_* (migration option 3
    -- in lite-template/integration/app-system/0531/GATHER_STASH_COOK.md): new
    -- gathers land here; legacy research_sessions remain read-only until they
    -- go quiet. Drawer ids scope by stash (uniqueness on (stash_id, name)).
    CREATE TABLE IF NOT EXISTS stashes (
      id INTEGER PRIMARY KEY,
      stash_ref TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','archived')) DEFAULT 'open',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_stashes_status ON stashes(status);
    CREATE INDEX IF NOT EXISTS idx_stashes_updated_at ON stashes(updated_at DESC);

    CREATE TABLE IF NOT EXISTS stash_drawers (
      id INTEGER PRIMARY KEY,
      stash_id INTEGER NOT NULL REFERENCES stashes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(stash_id, name)
    );

    -- Typed leaves bound to a stash (and optionally a drawer). The seven types
    -- are the entire intake contract: validated by the gather tool, never
    -- mutated to a freeform kind. body / body_md / media_ref are sparse columns
    -- chosen by type; per-type required fields beyond those live in
    -- metadata_json (mime/width/height/language/node_ref/etc.).
    CREATE TABLE IF NOT EXISTS stash_items (
      id INTEGER PRIMARY KEY,
      stash_id INTEGER NOT NULL REFERENCES stashes(id) ON DELETE CASCADE,
      drawer_id INTEGER REFERENCES stash_drawers(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK(type IN ('text','markdown','image','svg','script','pointer','link')),
      title TEXT,
      source_url TEXT,
      body TEXT,
      body_md TEXT,
      media_ref TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_stash_items_stash ON stash_items(stash_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_stash_items_drawer ON stash_items(drawer_id);

    -- The adjacency layer: many-to-many edges from a stash to other substrate
    -- resources (bot / app / plan / cook / contextmap_node). What turns "stash
    -- inbox" into "this bot's knowledge corpus, this plan's working memory".
    -- bound_ref is NOT a foreign key — deletion of a bound resource leaves
    -- the binding as a "linked resource removed" chip (stashes survive the
    -- resources they're linked to). Purely navigational in v0 — no automatic
    -- context injection mid-conversation. See
    -- lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md.
    CREATE TABLE IF NOT EXISTS stash_bindings (
      stash_id INTEGER NOT NULL REFERENCES stashes(id) ON DELETE CASCADE,
      bound_kind TEXT NOT NULL CHECK(bound_kind IN ('bot','app','plan','cook','contextmap_node','sketch')),
      bound_ref TEXT NOT NULL,
      role TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (stash_id, bound_kind, bound_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_stash_bindings_reverse ON stash_bindings(bound_kind, bound_ref);

    -- Cook output rows. The row is the index; the actual artifact is a folder
    -- under control/data/outcomes/<cook_ref>/ (report.md + index.html +
    -- manifest.json + optional visuals). slices_json is the CLEAVED SLICE
    -- MANIFEST — an ordered array of { stash_ref, item_ids? } objects. Each
    -- slice is a deliberate cut from a stash; omitting item_ids means
    -- "whole stash" (lazy default). The slices are what the agent held in
    -- superposition while nucleating the singular outcome. The aim column
    -- is the dismantling question the agent aimed the nucleation arrow at —
    -- ONE target per cook (the binding vow). See
    -- lite-template/integration/app-system/0531/GATHER_STASH_COOK.md.
    CREATE TABLE IF NOT EXISTS stash_cooks (
      id INTEGER PRIMARY KEY,
      cook_ref TEXT NOT NULL UNIQUE,
      slices_json TEXT NOT NULL,
      aim TEXT NOT NULL,
      additional_context_json TEXT NOT NULL DEFAULT '[]',
      outcome_dir TEXT NOT NULL,
      suggested_lens TEXT,
      template_version TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_stash_cooks_created_at ON stash_cooks(created_at DESC);

    -- Connected Services: skills mirrored from the host adapter. A Skill is
    -- a "workflow synthesized into the host adapter" (.claude/skills/<name>/
    -- SKILL.md) — the host owns its lifecycle; mojulo keeps a read-only
    -- reflection so it can be observed/visualized alongside the orbit
    -- (mcp_orbit_compositions) form of a Connected Service. REPLACE-semantic,
    -- declared by the agent via declare_skills — same posture as
    -- meta_mcp_inventory (present environment, not a sealed contextmap
    -- decision), which is why it sits here and not as a meta_context commit.
    -- ref is deterministic from host_path so re-mirroring is idempotent.
    -- calls_json = [{ server, tools? }] (concrete MCP servers it calls);
    -- needs_json = [{ capability, label }] (unbound abstract slots). See
    -- lite-template/integration/app-system/0527/CONNECTED_SERVICES_CANONIZATION_PLAN.md.
    CREATE TABLE IF NOT EXISTS meta_skills (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      host_path TEXT NOT NULL,
      host_adapter TEXT,
      catalyst_id TEXT,
      calls_json TEXT NOT NULL DEFAULT '[]',
      needs_json TEXT NOT NULL DEFAULT '[]',
      mirrored_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_meta_skills_mirrored_at ON meta_skills(mirrored_at DESC);

    -- Ops tags: a resource-grouping primitive (a tag_ref + title + descriptor
    -- + a set of bound members). Originally the "operations view" (Ring 11)
    -- deliberation surface; that surface (enter/forge/bind/get/list/revise MCP
    -- tools + the /operations dashboard) was deprecated as unused. The tables
    -- and OpsTagRepository are retained as the grouping store for the MOTION
    -- subsystem: forge_motion / stitch_motion forge a tag per "Motion Project"
    -- and bind the subject stash + rendered motion as members (member_kind
    -- 'motion' / 'stash'). See lib/mcp/tools/motion.js.
    CREATE TABLE IF NOT EXISTS ops_tags (
      id INTEGER PRIMARY KEY,
      tag_ref TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      descriptor_md TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','archived')) DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_ops_tags_status ON ops_tags(status);
    CREATE INDEX IF NOT EXISTS idx_ops_tags_updated_at ON ops_tags(updated_at DESC);

    -- Polymorphic member binding. member_kind is validated at the repo gate
    -- (committed-reality only: bot / app / mcp_orbit / cook / catalyst /
    -- trigger / stash) so adding a kind is a one-line repo change, not a
    -- schema migration. UNIQUE on (tag_ref, member_kind, member_ref) prevents
    -- duplicate bindings; the reverse index supports "which tags own this
    -- resource" lookups (used by the /motion gallery). member_ref is opaque to
    -- this table — refs into the per-kind primary table (deployments.id for
    -- bot, motion outcome folder name for motion, etc.).
    CREATE TABLE IF NOT EXISTS ops_tag_members (
      id INTEGER PRIMARY KEY,
      tag_ref TEXT NOT NULL REFERENCES ops_tags(tag_ref) ON DELETE CASCADE,
      member_kind TEXT NOT NULL,
      member_ref TEXT NOT NULL,
      bound_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(tag_ref, member_kind, member_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_ops_tag_members_by_tag ON ops_tag_members(tag_ref);
    CREATE INDEX IF NOT EXISTS idx_ops_tag_members_reverse ON ops_tag_members(member_kind, member_ref);

    -- Beats revisions (B9, beats.plan.md). Beats artifacts stay rows in
    -- sketches (the universal recipe store); sovereignty is the DOMAIN layer,
    -- not a table move. create_beats writes rev 1, every update_beats appends —
    -- the sketches row always holds the HEAD manifest (world beatsRef
    -- resolution, player, export all read it unchanged); revisions are history,
    -- not the live pointer. note is the revision's commit message.
    CREATE TABLE IF NOT EXISTS beats_revisions (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL,
      rev INTEGER NOT NULL,
      manifest_json TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(ref, rev)
    );
    CREATE INDEX IF NOT EXISTS idx_beats_revisions_ref ON beats_revisions(ref, rev DESC);

    -- Beats annotations (B9.1): commentary anchored to a beats ref in MUSICAL
    -- terms — the mark-it half of the listen → mark → revise → compare loop.
    -- anchor_json is a small union: { scope:'artifact' } | { scope:'track',
    -- track } | { scope:'time', bar, step?, track?, timeSec? } | { scope:'cue',
    -- cue }. Time anchors are meaningful even for generative ambient because
    -- performances are seeded — bar N is reproducible. rev records which
    -- revision the mark was made against; resolved_rev the one that answered it.
    CREATE TABLE IF NOT EXISTS beats_annotations (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL,
      rev INTEGER NOT NULL,
      anchor_json TEXT NOT NULL,
      body_md TEXT NOT NULL,
      author TEXT NOT NULL CHECK(author IN ('operator','agent')) DEFAULT 'operator',
      status TEXT NOT NULL CHECK(status IN ('open','resolved')) DEFAULT 'open',
      resolved_rev INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_beats_annotations_ref ON beats_annotations(ref, status);
  `);

  migrateDeploymentColumns(db);
  migrateInventoryColumns(db);
  migratePlanColumns(db);
  migrateResearchColumns(db);
  migrateSketchColumns(db);
  migrateStashItemColumns(db);
  migrateStashItemTypeCheck(db);
  migrateStashBindingKindCheck(db);
  migrateStashCookColumns(db);
  migrateStashCookArchivedAt(db);
  migrateEmbeddingsSourceKinds(db);
  migrateMcpToolCallColumns(db);
  reapStaleMcpJobs(db);
  pruneMcpToolCalls(db);
  maybeBackfillEmbeddings(db);
  maybeStartNodeFulfiller();
  maybeStartTriggerDaemons();
}

// Opt-in Node fulfiller boot. When MOJULO_AGENT_RUNTIME resolves to a
// registered runtime adapter, the in-process fulfiller starts a long-lived
// poll loop against the agent-tasks queue — fulfilling app inference
// requests via headless subprocess invocations without an external
// Claude Code worker session. When the env var is unset (default), this
// is a no-op and the /loop + run-inference-worker catalyst remains the
// only fulfillment path. See AGENT_TASKS_NODE_DRIVEN_PLAN.md.
//
// Pulled in via dynamic import to keep db/index.js free of the runtime-
// adapter dependency chain at module load. startNodeFulfiller is itself
// idempotent, so re-entrant init() calls are safe.
function maybeStartNodeFulfiller() {
  if (!process.env.MOJULO_AGENT_RUNTIME) return;
  if (process.env.MOJULO_AGENT_RUNTIME === 'disabled') return;
  import('@/lib/agent-tasks/node-fulfiller.js')
    .then(({ startNodeFulfiller }) => {
      try { startNodeFulfiller(); } catch (err) {
        console.warn('[node-fulfiller] start failed:', err?.message || err);
      }
    })
    .catch((err) => {
      console.warn('[node-fulfiller] module load failed:', err?.message || err);
    });
}

// Opt-in trigger-daemon boot. When MOJULO_TRIGGER_RUNTIME=enabled, start
// the scheduler daemon (and future webhook / watch daemons in their own
// phases). When unset or 'disabled', this is a no-op — bind_trigger calls
// still succeed (the binding row is durable), but nothing fires until a
// later boot enables the runtime. Symmetric with MOJULO_AGENT_RUNTIME's
// opt-in posture so an operator who hasn't configured automation doesn't
// get background daemons running by default. If MOJULO_DAEMONS=enabled, the
// runtime daemon host owns the scheduler and this in-process boot is skipped
// to avoid duplicate fires.
//
// SIGTERM wiring lives here too — installed once, defers to the daemon's
// own drain. Process.on('SIGTERM', ...) is idempotent against re-entrant
// init() because we check a module-local sentinel.
let _sigtermInstalled = false;
function maybeStartTriggerDaemons() {
  if (process.env.MOJULO_DAEMONS === 'enabled') return;
  const v = process.env.MOJULO_TRIGGER_RUNTIME;
  if (!v || v === 'disabled') return;
  if (v !== 'enabled') {
    console.warn(
      `[trigger-daemons] MOJULO_TRIGGER_RUNTIME='${v}' not recognized; expected 'enabled' or 'disabled'. Skipping daemon start.`,
    );
    return;
  }
  import('@/lib/triggers/scheduler.js')
    .then(({ startScheduler, stopScheduler }) => {
      try {
        startScheduler();
      } catch (err) {
        console.warn('[scheduler] start failed:', err?.message || err);
      }
      if (!_sigtermInstalled) {
        _sigtermInstalled = true;
        const handler = async () => {
          try {
            await stopScheduler();
          } catch (err) {
            console.warn('[scheduler] drain failed on SIGTERM:', err?.message || err);
          }
        };
        process.once('SIGTERM', handler);
        process.once('SIGINT', handler);
      }
    })
    .catch((err) => {
      console.warn('[scheduler] module load failed:', err?.message || err);
    });
}

// First-boot backfill of the semantic index. The plan is: on a fresh install
// (or an upgrade that just added meta_embeddings), populate the sidecar across
// every source kind from the current state of the source tables + the shipped
// catalyst markdown. Subsequent boots find the table populated and short-
// circuit. Set MOJULO_SEMANTIC_INDEX_DISABLED=1 to skip entirely.
//
// Pulled in via dynamic import so this file stays free of @huggingface/
// transformers at module load — the embedder lazy-loads its native model on
// first call, and an unconfigured environment shouldn't pay for it just by
// touching getDb().
// Fire-and-forget reindex. Failure is soft (reindexAll logs internally); getDb()
// returns immediately so the host call isn't blocked on the model load.
function triggerReindex(reason) {
  import('./repositories/embeddings.js')
    .then(({ reindexAll }) =>
      reindexAll().catch((err) => {
        console.warn(`[meta_embeddings] ${reason} failed:`, err.message);
      }),
    )
    .catch((err) => {
      console.warn('[meta_embeddings] backfill module load failed:', err.message);
    });
}

function maybeBackfillEmbeddings(db) {
  if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') return;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM meta_embeddings').get();
  if (n > 0) {
    // Table already populated — but an upgrade may have shipped a NEW source
    // kind whose rows the schema migration didn't add (migrations preserve
    // existing rows only). sketch_vocab is the first such kind: the cards live
    // on disk and are reindexed lazily here. reindexAll is idempotent
    // (content-hash skip leaves every existing row untouched; only the missing
    // sketch_vocab cards get embedded), so this fires at most once after the
    // upgrade and then no-ops on subsequent boots.
    const { sv } = db
      .prepare("SELECT COUNT(*) AS sv FROM meta_embeddings WHERE source_kind = 'sketch_vocab'")
      .get();
    if (sv === 0) triggerReindex('sketch_vocab backfill');
    return;
  }
  // Detect whether at least one source row exists across the corpus — saves
  // the model-load cost on a truly empty DB (e.g. first run before any
  // contextmap commit / inventory declare).
  const have = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM meta_principles)               AS principles,
      (SELECT COUNT(*) FROM meta_mcp_inventory)            AS inventory,
      (SELECT COUNT(*) FROM meta_mcp_capabilities WHERE superseded_by IS NULL) AS capabilities,
      (SELECT COUNT(*) FROM mcp_orbit_components)          AS components,
      (SELECT COUNT(*) FROM mcp_orbit_compositions)        AS compositions,
      (SELECT COUNT(*) FROM mcp_orbit_provider_artifacts)  AS artifacts
  `).get();
  const anyRows =
    have.principles + have.inventory + have.capabilities +
    have.components + have.compositions + have.artifacts > 0;
  if (!anyRows) return; // catalysts + sketch_vocab are filesystem-only and small;
                       // reindexing them on every fresh boot pre-source-write is
                       // wasteful. First write through any source path triggers
                       // the backfill on the next getDb() init — or the operator
                       // can run `scripts/reindex-embeddings.js` directly.
  triggerReindex('first-boot backfill');
}

// Extend meta_mcp_inventory with the columns needed for richer capability
// snapshots (per-tool input schema + per-tool introspection confidence) and
// the provider identity FK (provider_id, populated by the canonicalizer at
// inventory-write time so introspection rows can be joined back to the
// providers identity layer). Backward-compatible — existing rows have NULL
// for the new columns; provider_id is back-filled lazily on next inventory
// declare for that server.
function migrateInventoryColumns(db) {
  const cols = db.prepare('PRAGMA table_info(meta_mcp_inventory)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('input_schema_json')) {
    db.exec('ALTER TABLE meta_mcp_inventory ADD COLUMN input_schema_json TEXT');
  }
  if (!have.has('introspection_confidence')) {
    db.exec('ALTER TABLE meta_mcp_inventory ADD COLUMN introspection_confidence TEXT');
  }
  if (!have.has('provider_id')) {
    db.exec(
      'ALTER TABLE meta_mcp_inventory ADD COLUMN provider_id INTEGER REFERENCES meta_mcp_providers(id)'
    );
  }
  // App paradigm spike: partition the inventory between agent-declared vendor
  // MCPs and runner-managed app MCPs. server_kind distinguishes the two;
  // running_ref links app rows back to the runner's in-memory lifecycle state
  // so stop_app can remove the inventory entries by ref. Existing rows
  // default to 'vendor' — the inventory before this migration was vendor-only.
  // See lite-template/integration/app-system/APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.
  if (!have.has('server_kind')) {
    db.exec(
      "ALTER TABLE meta_mcp_inventory ADD COLUMN server_kind TEXT NOT NULL DEFAULT 'vendor'"
    );
  }
  if (!have.has('running_ref')) {
    db.exec('ALTER TABLE meta_mcp_inventory ADD COLUMN running_ref TEXT');
  }
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_meta_mcp_inventory_provider ON meta_mcp_inventory(provider_id)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_meta_mcp_inventory_server_kind ON meta_mcp_inventory(server_kind)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_meta_mcp_inventory_running_ref ON meta_mcp_inventory(running_ref)'
  );
}

function migrateMcpToolCallColumns(db) {
  // signal_json (orientation-ramp.plan.md R4): an optional handler-attached
  // outcome signal — numbers and enums only, never values (same discipline as
  // input_keys). First emitters: semantic_search ({ top_score, result_count,
  // kinds }) and the vocab/worked-example drawers ({ id_requested, found }).
  // Read by McpToolCallRepository.orientationGaps.
  const cols = db.prepare('PRAGMA table_info(mcp_tool_calls)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('signal_json')) {
    db.exec('ALTER TABLE mcp_tool_calls ADD COLUMN signal_json TEXT');
  }
}

function migratePlanColumns(db) {
  // Close-the-loop columns: when a plan's executed manifest materializes an
  // artifact into the contextmap, the plan is graduated — a `plan_release`
  // principle lands on the artifact node and the plan is archived. `archived`
  // is orthogonal to `status` (an archived plan stays status='executed'); the
  // /plan inbox semi-hides archived plans. `release_json` carries the
  // bidirectional link back to the artifact(s) the plan released.
  // See lite-template/integration/app-system/0527/plan-feature/PLAN_MODE.md.
  const cols = db.prepare('PRAGMA table_info(plans)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('archived')) {
    db.exec('ALTER TABLE plans ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }
  if (!have.has('archived_at')) {
    db.exec('ALTER TABLE plans ADD COLUMN archived_at INTEGER');
  }
  if (!have.has('release_json')) {
    db.exec('ALTER TABLE plans ADD COLUMN release_json TEXT');
  }
  // sketch_ref links a plan to a diagram (a sk_<…> sketch row). Two ways it's
  // set: ad hoc (operator pins a hand-authored sketch via forge/revise →
  // sketch_pinned=1) or posterity (compile_plan auto-mints a pipeline diagram
  // from the compiled manifest when not pinned). The pin flag is why both
  // mechanisms coexist on one column: auto-mint regenerates freely but never
  // clobbers an operator pin. Sketches stay scratch siblings — this is a
  // pointer, not contextmap integration.
  if (!have.has('sketch_ref')) {
    db.exec('ALTER TABLE plans ADD COLUMN sketch_ref TEXT');
  }
  if (!have.has('sketch_pinned')) {
    db.exec('ALTER TABLE plans ADD COLUMN sketch_pinned INTEGER NOT NULL DEFAULT 0');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_plans_archived ON plans(archived)');
}

// Add folder_ref to existing sketches tables on upgrade. NULL = root; a
// non-null value points at sketch_folders.ref. No FK constraint — we want
// folder deletion to soft-detach (move-to-root) rather than cascade-delete,
// and SQLite FKs would force a CASCADE / RESTRICT choice we don't want.
function migrateSketchColumns(db) {
  const cols = db.prepare('PRAGMA table_info(sketches)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('folder_ref')) {
    db.exec('ALTER TABLE sketches ADD COLUMN folder_ref TEXT');
  }
  // Mojulo Maker bucket override. NULL = derive the bucket (draft vs
  // illustration) from manifest.kind at read time; a non-null value pins the
  // sketch into a specific Maker gallery. See classifyBucket() in
  // lib/graph/sketch-manifest.js. An illustration is still a sketch — this is a
  // lens, not a new primitive.
  if (!have.has('bucket')) {
    db.exec('ALTER TABLE sketches ADD COLUMN bucket TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_sketches_folder_ref ON sketches(folder_ref)');
}

// stash_items gains archived_at to support soft-delete (the operator-facing
// archive verb; hard delete is sweep-only). Archived rows stay in the table so
// downstream citations (cook slices, future plan refs) can still resolve to
// last-known content — the citable-atoms posture in
// lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md.
function migrateStashItemColumns(db) {
  const cols = db.prepare('PRAGMA table_info(stash_items)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('archived_at')) {
    db.exec('ALTER TABLE stash_items ADD COLUMN archived_at INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_stash_items_archived_at ON stash_items(archived_at)');
}

// stash_items.type and stash_bindings.bound_kind both ship with CHECK
// constraints — adding a value (here: 'sketch') requires rebuilding the table
// because SQLite cannot ALTER a CHECK in place. Both migrations are guarded
// by a sql-text probe so re-runs are no-ops, and the COPY is identity (no
// transform) so the table contents are preserved.
function migrateStashItemTypeCheck(db) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stash_items'")
    .get();
  if (!row || !row.sql) return; // bootstrap will create the new shape
  if (row.sql.includes("'sketch'")) return; // already migrated
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE stash_items_new (
        id INTEGER PRIMARY KEY,
        stash_id INTEGER NOT NULL REFERENCES stashes(id) ON DELETE CASCADE,
        drawer_id INTEGER REFERENCES stash_drawers(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK(type IN ('text','markdown','image','svg','script','pointer','link','sketch')),
        title TEXT,
        source_url TEXT,
        body TEXT,
        body_md TEXT,
        media_ref TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        archived_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    db.exec(
      `INSERT INTO stash_items_new
         (id, stash_id, drawer_id, type, title, source_url, body, body_md, media_ref, metadata_json, archived_at, created_at)
       SELECT id, stash_id, drawer_id, type, title, source_url, body, body_md, media_ref, metadata_json, archived_at, created_at
         FROM stash_items`,
    );
    db.exec('DROP TABLE stash_items');
    db.exec('ALTER TABLE stash_items_new RENAME TO stash_items');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stash_items_stash ON stash_items(stash_id, created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stash_items_drawer ON stash_items(drawer_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stash_items_archived_at ON stash_items(archived_at)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function migrateStashBindingKindCheck(db) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stash_bindings'")
    .get();
  if (!row || !row.sql) return;
  if (row.sql.includes("'sketch'")) return;
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE stash_bindings_new (
        stash_id INTEGER NOT NULL REFERENCES stashes(id) ON DELETE CASCADE,
        bound_kind TEXT NOT NULL CHECK(bound_kind IN ('bot','app','plan','cook','contextmap_node','sketch')),
        bound_ref TEXT NOT NULL,
        role TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (stash_id, bound_kind, bound_ref)
      );
    `);
    db.exec(
      `INSERT INTO stash_bindings_new (stash_id, bound_kind, bound_ref, role, created_at)
       SELECT stash_id, bound_kind, bound_ref, role, created_at FROM stash_bindings`,
    );
    db.exec('DROP TABLE stash_bindings');
    db.exec('ALTER TABLE stash_bindings_new RENAME TO stash_bindings');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stash_bindings_reverse ON stash_bindings(bound_kind, bound_ref)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// stash_cooks gains archived_at to support soft-delete (the operator-facing
// archive verb mirrors archive_item for stash items). Additive ALTER, safe to
// re-run; no row-level migration needed since archived_at is nullable and
// every existing row stays "open" (NULL).
function migrateStashCookArchivedAt(db) {
  const cols = db.prepare('PRAGMA table_info(stash_cooks)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('archived_at')) {
    db.exec('ALTER TABLE stash_cooks ADD COLUMN archived_at INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_stash_cooks_archived_at ON stash_cooks(archived_at)');
}

// stash_cooks shipped first with (stash_refs_json NOT NULL, query NOT NULL).
// The v0 reshape moves to (slices_json, aim) — a richer manifest plus the
// singularity-vow rename. SQLite cannot drop a NOT NULL constraint on an
// existing column, so when legacy columns are detected we rebuild the table:
// copy rows over with the slice/aim shape, drop the old, rename. Standard
// SQLite drop-column-via-rebuild pattern. Inside a transaction so a partial
// migration can never leave the row layer half-renamed.
function migrateStashCookColumns(db) {
  const cols = db.prepare('PRAGMA table_info(stash_cooks)').all();
  const have = new Set(cols.map((c) => c.name));
  const hasLegacy = have.has('stash_refs_json') || have.has('query');
  if (!hasLegacy) return; // fresh schema, nothing to do

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE stash_cooks_new (
        id INTEGER PRIMARY KEY,
        cook_ref TEXT NOT NULL UNIQUE,
        slices_json TEXT NOT NULL,
        aim TEXT NOT NULL,
        additional_context_json TEXT NOT NULL DEFAULT '[]',
        outcome_dir TEXT NOT NULL,
        suggested_lens TEXT,
        template_version TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    // Copy + transform. Each legacy stash_ref becomes a whole-stash slice;
    // query (the catalyst) becomes aim (the singular target). Same row count.
    const rows = db.prepare('SELECT * FROM stash_cooks').all();
    const insert = db.prepare(
      `INSERT INTO stash_cooks_new
         (id, cook_ref, slices_json, aim, additional_context_json, outcome_dir, suggested_lens, template_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of rows) {
      let slices = [];
      if (have.has('slices_json') && row.slices_json) {
        try { slices = JSON.parse(row.slices_json); } catch { slices = []; }
      }
      if ((!slices || slices.length === 0) && row.stash_refs_json) {
        try {
          const legacy = JSON.parse(row.stash_refs_json);
          slices = Array.isArray(legacy) ? legacy.map((ref) => ({ stash_ref: ref })) : [];
        } catch { slices = []; }
      }
      const aim = (have.has('aim') && row.aim) ? row.aim : (row.query || '');
      insert.run(
        row.id,
        row.cook_ref,
        JSON.stringify(slices),
        aim,
        row.additional_context_json || '[]',
        row.outcome_dir,
        row.suggested_lens,
        row.template_version,
        row.created_at,
      );
    }

    db.exec('DROP TABLE stash_cooks');
    db.exec('ALTER TABLE stash_cooks_new RENAME TO stash_cooks');
    db.exec('CREATE INDEX IF NOT EXISTS idx_stash_cooks_created_at ON stash_cooks(created_at DESC)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function migrateResearchColumns(db) {
  // sketch_ref on a synthesized abstract: synthesize_abstract auto-mints a
  // hub-spoke diagram of the book at synthesis time (the "posterity" form for
  // research). Abstracts are append-only, so each thesis snapshot carries its
  // own diagram — no pin flag needed (no single column to contend over, unlike
  // plans). Ad hoc research diagrams ride the existing freeform item path
  // (bind_research_item kind='sketch', sk_ ref in media_ref), so no column for
  // those.
  const cols = db.prepare('PRAGMA table_info(research_abstracts)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('sketch_ref')) {
    db.exec('ALTER TABLE research_abstracts ADD COLUMN sketch_ref TEXT');
  }
}

// meta_embeddings carries a CHECK(source_kind IN (...)) that can't be ALTERed.
// When a new indexed source kind ships (sketch_vocab, then sketch_method,
// manji_program, then painted_landscape, …), an existing DB's table still has
// the old constraint and would reject the new rows. The table is a pure derived
// sidecar, so we rebuild it preserving every existing row (no re-embed) and let
// the widened CHECK take effect. Detection is on the stored DDL — idempotent
// once the constraint already names the newest kind (bump the guard token below
// to the newest kind whenever you widen the CHECK).
function migrateEmbeddingsSourceKinds(db) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='meta_embeddings'")
    .get();
  if (!row || !row.sql) return;
  if (row.sql.includes("'routing'")) return;
  db.exec(`
    BEGIN;
    CREATE TABLE meta_embeddings_new (
      id INTEGER PRIMARY KEY,
      source_kind TEXT NOT NULL CHECK(source_kind IN (
        'principle',
        'mcp_tool',
        'mcp_capability',
        'orbit_component',
        'orbit_composition',
        'orbit_artifact',
        'catalyst',
        'sketch_vocab',
        'sketch_method',
        'manji_program',
        'painted_landscape',
        'view_vocab',
        'beats_vocab',
        'game_vocab',
        'game_mechanic',
        'game_kit',
        'game_glyph',
        'game_sfx',
        'routing'
      )),
      source_ref TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      body_text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(source_kind, source_ref)
    );
    INSERT INTO meta_embeddings_new
      (id, source_kind, source_ref, content_hash, body_text, embedding, model, created_at)
      SELECT id, source_kind, source_ref, content_hash, body_text, embedding, model, created_at
      FROM meta_embeddings;
    DROP TABLE meta_embeddings;
    ALTER TABLE meta_embeddings_new RENAME TO meta_embeddings;
    CREATE INDEX IF NOT EXISTS idx_meta_embeddings_kind ON meta_embeddings(source_kind);
    COMMIT;
  `);
}

function reapStaleMcpJobs(db) {
  // Job runner is in-process; a control-plane restart kills running jobs.
  // Mark anything still in pending / running as errored on startup so
  // clients polling stale jobIds get a clear failure instead of an
  // indefinite "pending" state.
  db.prepare(
    `UPDATE mcp_jobs
     SET status = 'error', error = COALESCE(error, 'Control plane restarted while job was in flight'), updated_at = ?
     WHERE status IN ('pending', 'running')`
  ).run(Date.now());
}

// Telemetry retention caps. Keep at most MCP_TELEMETRY_MAX_DAYS of history and
// at most MCP_TELEMETRY_MAX_ROWS rows, whichever bounds tighter. Exported so the
// startup sweep here and scripts/cleanup-stale-artifacts.js prune identically.
export const MCP_TELEMETRY_MAX_DAYS = 30;
export const MCP_TELEMETRY_MAX_ROWS = 50_000;

// Bound the telemetry table without a cron: age out old rows, then trim to the
// row cap by dropping the oldest ids. Runs on startup init and is also invoked
// by the artifact-cleanup script. Returns the number of rows deleted.
export function pruneMcpToolCalls(db) {
  const cutoff = Date.now() - MCP_TELEMETRY_MAX_DAYS * 24 * 60 * 60 * 1000;
  const byAge = db.prepare('DELETE FROM mcp_tool_calls WHERE started_at < ?').run(cutoff);
  const byCap = db.prepare(
    `DELETE FROM mcp_tool_calls
     WHERE id NOT IN (
       SELECT id FROM mcp_tool_calls ORDER BY id DESC LIMIT ?
     )`
  ).run(MCP_TELEMETRY_MAX_ROWS);
  const deleted = (byAge.changes || 0) + (byCap.changes || 0);
  if (deleted > 0) {
    console.error(
      `[mcp] telemetry prune: removed ${deleted} row(s) (age>${MCP_TELEMETRY_MAX_DAYS}d or beyond ${MCP_TELEMETRY_MAX_ROWS} cap)`
    );
  }
  return deleted;
}

function migrateDeploymentColumns(db) {
  const cols = db.prepare('PRAGMA table_info(deployments)').all();
  const have = new Set(cols.map((c) => c.name));
  if (!have.has('config_hash')) {
    db.exec('ALTER TABLE deployments ADD COLUMN config_hash TEXT');
  }
  if (!have.has('last_built_hash')) {
    db.exec('ALTER TABLE deployments ADD COLUMN last_built_hash TEXT');
  }
  if (!have.has('url')) {
    db.exec('ALTER TABLE deployments ADD COLUMN url TEXT');
  }
  if (!have.has('last_seen_at')) {
    db.exec('ALTER TABLE deployments ADD COLUMN last_seen_at INTEGER');
  }
  // Vector RAG: per-deployment embeddings live alongside the row. No separate
  // table — embeddings are 1:1 with deployments and ride the same lifecycle.
  if (!have.has('rag_mode')) {
    db.exec("ALTER TABLE deployments ADD COLUMN rag_mode TEXT NOT NULL DEFAULT 'keyword'");
  }
  if (!have.has('embedding_storage_key')) {
    db.exec('ALTER TABLE deployments ADD COLUMN embedding_storage_key TEXT');
  }
  if (!have.has('embedding_model')) {
    db.exec('ALTER TABLE deployments ADD COLUMN embedding_model TEXT');
  }
  if (!have.has('embedding_chunk_count')) {
    db.exec('ALTER TABLE deployments ADD COLUMN embedding_chunk_count INTEGER');
  }
  // Cloud deploy state. Cloud orchestration runs the published GHCR image on
  // a remote provider (Fly.io first) using user-supplied credentials. The
  // existing artifact-build state above is independent: cloud deploys reuse
  // the staged config files but don't replace the local-ZIP path.
  if (!have.has('cloud_provider')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_provider TEXT');
  }
  if (!have.has('cloud_app_name')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_app_name TEXT');
  }
  if (!have.has('cloud_status')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_status TEXT');
  }
  if (!have.has('cloud_url')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_url TEXT');
  }
  if (!have.has('cloud_progress')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_progress TEXT');
  }
  if (!have.has('cloud_options')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_options TEXT');
  }
  if (!have.has('cloud_error')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_error TEXT');
  }
  if (!have.has('cloud_last_deployed_at')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_last_deployed_at INTEGER');
  }
  if (!have.has('cloud_machine_id')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_machine_id TEXT');
  }
  if (!have.has('cloud_volume_id')) {
    db.exec('ALTER TABLE deployments ADD COLUMN cloud_volume_id TEXT');
  }
}

export function getDb() {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  _db = new Database(dbPath);
  init(_db);
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
