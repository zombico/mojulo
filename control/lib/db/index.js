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
        'catalyst'
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
  `);

  migrateDeploymentColumns(db);
  migrateInventoryColumns(db);
  reapStaleMcpJobs(db);
  maybeBackfillEmbeddings(db);
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
function maybeBackfillEmbeddings(db) {
  if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') return;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM meta_embeddings').get();
  if (n > 0) return;
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
  if (!anyRows) return; // catalysts are filesystem-only and small; reindexing
                       // them on every fresh boot pre-source-write is wasteful.
                       // First write through any source path triggers the
                       // backfill on the next getDb() init — or the operator
                       // can run `scripts/reindex-embeddings.js` directly.
  // Fire-and-forget — failure is soft. The backfill logs internally; getDb()
  // returns immediately so the host call isn't blocked on model load.
  import('./repositories/embeddings.js')
    .then(({ reindexAll }) => reindexAll().catch((err) => {
      console.warn('[meta_embeddings] first-boot backfill failed:', err.message);
    }))
    .catch((err) => {
      console.warn('[meta_embeddings] backfill module load failed:', err.message);
    });
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
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_meta_mcp_inventory_provider ON meta_mcp_inventory(provider_id)'
  );
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
