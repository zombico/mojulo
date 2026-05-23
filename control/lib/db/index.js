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

    -- mcp-orbit component store. Decomposes the monolithic mcp-orbit catalyst
    -- pattern into a small set of typed components that combine
    -- multiplicatively (sources × destinations × triggers × patterns ×
    -- idempotency × render). The agent composes; the server provides
    -- components + constraint validation. Server-stored, agent-composed.
    -- See lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md.
    CREATE TABLE IF NOT EXISTS mcp_orbit_components (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('source','destination','trigger','pattern','idempotency','render')),
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
  `);

  migrateDeploymentColumns(db);
  reapStaleMcpJobs(db);
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
