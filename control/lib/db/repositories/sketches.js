import crypto from 'node:crypto';

import { getDb } from '../index.js';
import {
  bucketDerivationSignature,
  classifyBucket,
  manifestKind,
  sketchRenderMode,
} from '../../graph/sketch/sketch-manifest.js';
import { factsFromManifest, summaryKeepsManifest } from '../../graph/sketch/sketch-summary.js';
import { currentSpaceId } from '../../roles/scope.js';
import { refExistsRefusal } from '../../errors/tool-refusal.js';

// Workshop-space scope (roles-pack.plan.md Phase 4). A delegate's handlers
// run under their space (lib/roles/scope.js): creates stamp it, reads and
// mutations see only rows in it (a cross-space ref reads as not-found —
// 404-not-403). The operator / roles off is the null scope: no clause, no
// behavior change.
function spaceFilter() {
  const space = currentSpaceId();
  return space ? { sql: ' AND workshop_space_id = ?', params: [space] } : { sql: '', params: [] };
}

function shortRef() {
  // Short collision-resistant slug: 10 chars of base36 from crypto entropy.
  // ~52 bits — plenty for a single-user control plane that mints maybe
  // dozens of sketches a session. Prefix `sk_` so the agent can recognize
  // a sketch ref at a glance.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return `sk_${n.toString(36).padStart(10, '0').slice(-10)}`;
}

function parseManifest(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function rowToSketch(row) {
  if (!row) return null;
  const manifest = parseManifest(row.manifest_json);
  // Bucket override pins the sketch into a specific Maker gallery; absent it,
  // the bucket is derived from manifest.kind. The effective `bucket` is what
  // callers filter on; `bucketOverride` is surfaced so the UI can tell a pinned
  // bucket from a derived one (and offer "reset to derived"). Derived here from
  // the parsed manifest — not read back from `bucket_derived` — so a full row's
  // bucket is always the classifier's current answer.
  const bucketOverride = row.bucket || null;
  return {
    ref: row.ref,
    title: row.title,
    manifest,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    folderRef: row.folder_ref || null,
    bucket: bucketOverride || classifyBucket(manifest),
    bucketOverride,
  };
}

// ── persisted derived columns ────────────────────────────────────────────────
//
// `sketches.kind` and `sketches.bucket_derived` mirror what rowToSketch derives
// from the manifest, so bucket-scoped reads filter in SQL on
// COALESCE(bucket, bucket_derived) instead of parsing every manifest. The
// columns are added by lib/db/index.js; THIS module owns their contents:
// create/update stamp them, and `ensureDerivedColumns` backfills on the first
// use of each connection — every NULL row (rows written before the columns
// existed), or every row when the classifier's signature differs from the one
// stored in app_settings. Adding a kind to any list classifyBucket reads
// changes the signature, so the re-derive is automatic; a change to the
// classifier's logic bumps the revision inside the signature.

const DERIVATION_KEY = 'sketches.derivation';
const derivedReady = new WeakSet();   // per connection; tests open many

function derivationHash() {
  return crypto.createHash('sha1').update(bucketDerivationSignature()).digest('hex').slice(0, 16);
}

/** The two derived columns for a manifest (parsed object or its JSON text). */
export function deriveSketchColumns(manifestOrJson) {
  const manifest = typeof manifestOrJson === 'string' ? parseManifest(manifestOrJson) : manifestOrJson;
  return { kind: manifestKind(manifest), bucketDerived: classifyBucket(manifest) };
}

/**
 * Backfill `kind` / `bucket_derived` in one transaction. `all` re-derives every
 * row (classifier changed); otherwise only rows still NULL. Returns the count.
 */
export function backfillSketchDerivedColumns(db, { all = false } = {}) {
  const rows = db
    .prepare(`SELECT id, manifest_json FROM sketches${all ? '' : ' WHERE bucket_derived IS NULL'}`)
    .all();
  const stamp = db.prepare('UPDATE sketches SET kind = ?, bucket_derived = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) {
      const d = deriveSketchColumns(row.manifest_json);
      stamp.run(d.kind, d.bucketDerived, row.id);
    }
  })();
  return rows.length;
}

function ensureDerivedColumns(db) {
  if (derivedReady.has(db)) return;
  derivedReady.add(db);
  const want = derivationHash();
  const stored = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(DERIVATION_KEY)?.value ?? null;
  const stale = stored !== want;
  const holes = stale ? 0 : db.prepare('SELECT COUNT(*) AS n FROM sketches WHERE bucket_derived IS NULL').get().n;
  if (stale || holes > 0) backfillSketchDerivedColumns(db, { all: stale });
  if (stale) {
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(DERIVATION_KEY, want, Date.now());
  }
}

/** getDb() with the derived columns guaranteed populated for this connection. */
function db() {
  const handle = getDb();
  ensureDerivedColumns(handle);
  return handle;
}

const EFFECTIVE_BUCKET = "COALESCE(bucket, bucket_derived, 'diagram')";

// ── summaries ────────────────────────────────────────────────────────────────
//
// A summary is the list row that leaves the manifest at home (the wire shape and
// the one rule about when `manifest` rides along are stated in
// lib/graph/sketch/sketch-summary.js). Built WITHOUT parsing big manifests: the
// identity columns come from a light SELECT, the badge facts from json_extract
// (SQLite parses in C, and skips the rows whose manifest we do parse), and the
// manifest itself is fetched by ref only for the rows that need it — the
// diagram/voice rows the client renders from, and `manji-tree` rows, whose
// render mode (svg still vs turnable polygomer World) is the one branch of
// sketchRenderMode that reads past the kind.

const LIGHT_COLS = 'id, ref, title, created_at, updated_at, folder_ref, bucket, bucket_derived, kind';

// Last-touched order: the recipe's edit time when it has one, its mint time
// otherwise (rows older than the column read as touched when minted).
const TOUCHED_ORDER = 'COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC';
const IN_CHUNK = 400;   // well under SQLite's bound-variable limit

function lightRow(row) {
  const kind = row.kind ?? null;
  return {
    ref: row.ref,
    title: row.title,
    kind,
    // Decided from the kind alone here; hydrateSummaries settles manji-tree.
    renderMode: kind === 'manji-tree' ? null : sketchRenderMode({ kind: kind ?? undefined }),
    bucket: row.bucket || row.bucket_derived || 'diagram',
    bucketOverride: row.bucket || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    folderRef: row.folder_ref || null,
  };
}

function chunks(items, size = IN_CHUNK) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fetchManifests(handle, refs) {
  const out = new Map();
  for (const chunk of chunks(refs)) {
    const marks = chunk.map(() => '?').join(',');
    for (const row of handle
      .prepare(`SELECT ref, manifest_json FROM sketches WHERE ref IN (${marks})`)
      .all(...chunk)) {
      out.set(row.ref, parseManifest(row.manifest_json));
    }
  }
  return out;
}

// JS truthiness of `manifest.<path>`, evaluated by SQLite. Objects and arrays
// are truthy without being extracted (a `game` binding can be a sizeable
// object); scalars follow JS: false / 0 / '' / null are falsy.
function truthySql(path) {
  const t = `json_type(manifest_json, '${path}')`;
  const v = `json_extract(manifest_json, '${path}')`;
  return `CASE ${t}
    WHEN 'object' THEN 1 WHEN 'array' THEN 1 WHEN 'true' THEN 1
    WHEN 'integer' THEN (${v} != 0) WHEN 'real' THEN (${v} != 0)
    WHEN 'text' THEN (${v} != '')
    ELSE 0 END`;
}

const FACTS_SQL = `SELECT ref,
    json_extract(manifest_json, '$.seed') AS seed,
    ${truthySql('$.giBake')} AS gi_bake,
    json_extract(manifest_json, '$.giBake.adapter') AS gi_adapter,
    ${truthySql('$.game')} AS game,
    ${truthySql('$.audio')} AS audio
  FROM sketches
  WHERE json_valid(manifest_json) AND ref IN `;

function fetchFacts(handle, refs) {
  const out = new Map();
  for (const chunk of chunks(refs)) {
    const marks = chunk.map(() => '?').join(',');
    for (const row of handle.prepare(`${FACTS_SQL}(${marks})`).all(...chunk)) {
      out.set(row.ref, {
        seed: row.seed ?? null,
        giBake: Boolean(row.gi_bake),
        giAdapter: typeof row.gi_adapter === 'string' ? row.gi_adapter : null,
        game: Boolean(row.game),
        audio: Boolean(row.audio),
      });
    }
  }
  return out;
}

export const SketchRepository = {
  create({ title, manifest, ref, folderRef, bucket }) {
    const handle = db();
    const finalRef = ref || shortRef();
    const derived = deriveSketchColumns(manifest);
    try {
      handle.prepare(
        `INSERT INTO sketches (ref, title, manifest_json, folder_ref, bucket, kind, bucket_derived, workshop_space_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
      ).run(
        finalRef, title, JSON.stringify(manifest), folderRef || null, bucket || null,
        derived.kind, derived.bucketDerived, currentSpaceId(),
      );
    } catch (err) {
      // One refusal for every mint: code + the ref + the revision tool to call
      // next, instead of a bare UNIQUE-constraint message per call site.
      if (err && /UNIQUE constraint failed: sketches\.ref/.test(err.message || '')) {
        throw refExistsRefusal({ ref: finalRef, kind: manifest && manifest.kind });
      }
      throw err;
    }
    return this.getByRef(finalRef);
  },

  getByRef(ref) {
    const handle = db();
    const scope = spaceFilter();
    const row = handle
      .prepare(`SELECT * FROM sketches WHERE ref = ?${scope.sql}`)
      .get(ref, ...scope.params);
    return rowToSketch(row);
  },

  // In-place update of an existing sketch. Any of title/manifest/folderRef
  // may be passed; missing fields are left untouched. Pass folderRef=null
  // explicitly to move the sketch to root. Returns the refreshed sketch row,
  // or null if no row matches `ref`. Used by the rename UI, the move-to-
  // folder affordance, and the update_sketch MCP tool.
  update({ ref, title, manifest, folderRef, bucket }) {
    if (!ref) return null;
    const existing = this.getByRef(ref);
    if (!existing) return null;
    const handle = db();
    const nextTitle = title === undefined ? existing.title : title;
    const nextManifest =
      manifest === undefined ? existing.manifest : manifest;
    const nextFolderRef =
      folderRef === undefined ? existing.folderRef : folderRef || null;
    // bucket override: undefined leaves it as-is; null clears it (back to
    // derived); a string pins the Maker gallery. existing.bucketOverride is the
    // pinned value (null when derived).
    const nextBucket =
      bucket === undefined ? existing.bucketOverride : bucket || null;
    const derived = deriveSketchColumns(nextManifest);
    const scope = spaceFilter();
    // A retitle or a recipe edit touches the artifact (it rises on the
    // dashboard); a folder move or a bucket pin is filing, and does not.
    const touched = title !== undefined || manifest !== undefined;
    handle.prepare(
      `UPDATE sketches
          SET title = ?, manifest_json = ?, folder_ref = ?, bucket = ?, kind = ?, bucket_derived = ?${
            touched ? ', updated_at = unixepoch()' : ''
          }
        WHERE ref = ?${scope.sql}`,
    ).run(
      nextTitle, JSON.stringify(nextManifest), nextFolderRef, nextBucket,
      derived.kind, derived.bucketDerived, ref, ...scope.params,
    );
    return this.getByRef(ref);
  },

  // Bulk move: set folder_ref on every row whose ref is in `refs`. Pass
  // folderRef=null to move to root. Returns the number of rows updated.
  // Used by the multi-select "move to folder" affordance.
  moveMany({ refs, folderRef }) {
    if (!Array.isArray(refs) || refs.length === 0) return 0;
    const handle = db();
    const scope = spaceFilter();
    const placeholders = refs.map(() => '?').join(',');
    const result = handle
      .prepare(
        `UPDATE sketches SET folder_ref = ? WHERE ref IN (${placeholders})${scope.sql}`,
      )
      .run(folderRef || null, ...refs, ...scope.params);
    return result.changes;
  },

  deleteByRef(ref) {
    if (!ref) return 0;
    const handle = db();
    const scope = spaceFilter();
    const result = handle
      .prepare(`DELETE FROM sketches WHERE ref = ?${scope.sql}`)
      .run(ref, ...scope.params);
    return result.changes;
  },

  deleteMany({ refs }) {
    if (!Array.isArray(refs) || refs.length === 0) return 0;
    const handle = db();
    const scope = spaceFilter();
    const placeholders = refs.map(() => '?').join(',');
    const result = handle
      .prepare(`DELETE FROM sketches WHERE ref IN (${placeholders})${scope.sql}`)
      .run(...refs, ...scope.params);
    return result.changes;
  },

  // Returns every folder-tagged sketch plus the most recent `rootLimit`
  // root sketches, newest first overall. Used by the index page; the
  // client filters by title/ref substring and by folder context. Folder
  // sketches are always included so navigating into a folder never shows
  // an empty list just because root has crowded them past the cap.
  //
  // Full sketch objects, manifests included — the arcade, the MCP tools and
  // scripts read this. The gallery reads `listSummary()` instead.
  list({ rootLimit = 200, bucket = null } = {}) {
    const handle = db();
    const scope = spaceFilter();
    // Bucket-scoped queries (the Arcade, the Maker galleries) must see EVERY
    // sketch in the bucket, so the root cap does not apply. The effective bucket
    // is a persisted column (bucket_derived, stamped from the classifier on
    // every write), so this is one indexed filter and only the bucket's own
    // manifests are ever parsed.
    if (bucket) {
      return handle
        .prepare(
          `SELECT * FROM sketches WHERE ${EFFECTIVE_BUCKET} = ?${scope.sql}
            ORDER BY created_at DESC, id DESC`,
        )
        .all(bucket, ...scope.params)
        .map(rowToSketch);
    }
    // Delegate scope: their space is small — one flat scoped query, no root cap.
    if (scope.sql) {
      return handle
        .prepare(`SELECT * FROM sketches WHERE 1=1${scope.sql} ORDER BY created_at DESC, id DESC`)
        .all(...scope.params)
        .map(rowToSketch);
    }
    return handle
      .prepare(
        `SELECT * FROM sketches WHERE folder_ref IS NOT NULL
         UNION ALL
         SELECT * FROM (
           SELECT * FROM sketches WHERE folder_ref IS NULL
            ORDER BY created_at DESC, id DESC LIMIT ?
         )
         ORDER BY created_at DESC, id DESC`,
      )
      .all(rootLimit)
      .map(rowToSketch);
  },

  /**
   * `list()`'s scope and order, as SUMMARIES (lib/graph/sketch/sketch-summary.js):
   * no manifest except for the diagram/voice rows the client renders from. The
   * gallery's read. Costs one light SELECT plus json_extract facts over the
   * bucket's rows; a manifest is parsed only where the rule keeps it.
   */
  listSummary({ rootLimit = 200, bucket = null } = {}) {
    const handle = db();
    const scope = spaceFilter();
    let rows;
    if (bucket) {
      rows = handle
        .prepare(
          `SELECT ${LIGHT_COLS} FROM sketches WHERE ${EFFECTIVE_BUCKET} = ?${scope.sql}
            ORDER BY created_at DESC, id DESC`,
        )
        .all(bucket, ...scope.params);
    } else if (scope.sql) {
      rows = handle
        .prepare(`SELECT ${LIGHT_COLS} FROM sketches WHERE 1=1${scope.sql} ORDER BY created_at DESC, id DESC`)
        .all(...scope.params);
    } else {
      rows = handle
        .prepare(
          `SELECT ${LIGHT_COLS} FROM sketches WHERE folder_ref IS NOT NULL
           UNION ALL
           SELECT ${LIGHT_COLS} FROM (
             SELECT ${LIGHT_COLS} FROM sketches WHERE folder_ref IS NULL
              ORDER BY created_at DESC, id DESC LIMIT ?
           )
           ORDER BY created_at DESC, id DESC`,
        )
        .all(rootLimit);
    }
    return this.hydrateSummaries(rows.map(lightRow));
  },

  /**
   * Finish light rows into summaries: settle the render mode of manji-tree rows,
   * attach `facts`, and attach `manifest` where the rule keeps it. Takes the
   * light rows `newestByBucket()` returns (or any objects carrying `ref`, `kind`,
   * `bucket`, `renderMode`) and returns new objects with the same extra fields —
   * a caller that folds rows first (the floor's strips) hydrates only the faces
   * it draws, instead of paying json_extract over the whole table.
   */
  hydrateSummaries(rows = []) {
    if (rows.length === 0) return [];
    const handle = db();
    const needManifest = rows.filter((r) => r.kind === 'manji-tree' || summaryKeepsManifest(r));
    const manifests = fetchManifests(handle, needManifest.map((r) => r.ref));
    const parsed = new Set(needManifest.map((r) => r.ref));
    const facts = fetchFacts(handle, rows.filter((r) => !parsed.has(r.ref)).map((r) => r.ref));
    const EMPTY = factsFromManifest(null);
    return rows.map((row) => {
      if (!parsed.has(row.ref)) return { ...row, facts: facts.get(row.ref) || EMPTY };
      const manifest = manifests.get(row.ref) ?? null;
      const out = {
        ...row,
        renderMode: row.kind === 'manji-tree' ? sketchRenderMode(manifest) : row.renderMode,
        facts: factsFromManifest(manifest),
      };
      if (summaryKeepsManifest(out)) out.manifest = manifest;
      return out;
    });
  },

  /**
   * The newest N sketches, flat.
   *
   * `list()` cannot answer "what did I just make": its root query UNIONs in EVERY
   * foldered sketch regardless of `rootLimit`, because a gallery must not lose an
   * artifact to a folder. The viewport home wants the opposite — the head of the
   * store and nothing else — so it gets its own read rather than paying for the
   * whole gallery to find one row.
   */
  recent({ limit = 40 } = {}) {
    const handle = db();
    const scope = spaceFilter();
    const cap = Math.max(1, Math.min(500, Number(limit) || 40));
    const where = scope.sql ? `WHERE 1=1${scope.sql}` : '';
    return handle
      .prepare(`SELECT * FROM sketches ${where} ORDER BY ${TOUCHED_ORDER} LIMIT ?`)
      .all(...scope.params, cap)
      .map(rowToSketch)
      .filter(Boolean);
  },

  /**
   * Effective-bucket tallies over the WHOLE table, plus per-kind tallies for the
   * kinds a caller needs to sub-split a bucket (the Library's Characters shelf).
   * Two GROUP BYs over the persisted columns — no manifest is read — and a tiny
   * payload, so a chip row can show true totals without shipping every manifest.
   */
  bucketCounts() {
    const handle = db();
    const scope = spaceFilter();
    const where = scope.sql ? `WHERE 1=1${scope.sql}` : '';
    const buckets = {};
    let total = 0;
    for (const row of handle
      .prepare(`SELECT ${EFFECTIVE_BUCKET} AS bucket, COUNT(*) AS n FROM sketches ${where} GROUP BY 1`)
      .all(...scope.params)) {
      buckets[row.bucket] = row.n;
      total += row.n;
    }
    const kinds = {};
    for (const row of handle
      .prepare(`SELECT kind, COUNT(*) AS n FROM sketches ${where ? `${where} AND` : 'WHERE'} kind IS NOT NULL GROUP BY kind`)
      .all(...scope.params)) {
      kinds[row.kind] = row.n;
    }
    return { total, buckets, kinds };
  },

  /**
   * The newest `perBucket` sketches of EACH effective bucket, plus the same
   * whole-table tallies `bucketCounts()` computes — in one light scan.
   *
   * The splayed-floor home draws a strip per shelf. Rows come back as LIGHT
   * summaries (identity, kind, bucket, kind-decided renderMode; no facts, no
   * manifest) — the route folds them, then calls `hydrateSummaries` on the faces
   * it draws. "Light" is a payload concern, so the route decides what survives
   * to the wire.
   */
  newestByBucket({ perBucket = 48 } = {}) {
    const handle = db();
    const scope = spaceFilter();
    const where = scope.sql ? `WHERE 1=1${scope.sql}` : '';
    const rows = handle
      .prepare(`SELECT ${LIGHT_COLS} FROM sketches ${where} ORDER BY ${TOUCHED_ORDER}`)
      .all(...scope.params);
    const byBucket = {};
    const buckets = {};
    const kinds = {};
    for (const raw of rows) {
      const row = lightRow(raw);
      buckets[row.bucket] = (buckets[row.bucket] || 0) + 1;
      if (row.kind) kinds[row.kind] = (kinds[row.kind] || 0) + 1;
      const head = byBucket[row.bucket] || (byBucket[row.bucket] = []);
      if (head.length < perBucket) head.push(row);
    }
    return { byBucket, tallies: { total: rows.length, buckets, kinds } };
  },

  /**
   * Every sketch carrying a GI bake, newest bake first.
   *
   * `bake-world-gi.mjs` records its result in the manifest itself — an
   * `inline-faces` bake stamps `giBake` on the world it recoloured, a
   * `generated-mesh` bake stamps it on the `<ref>_gi` variant it minted — so the
   * bake ledger IS the sketch store and needs no table of its own.
   *
   * Filtered in SQL: bakes are a handful of rows in a store of thousands, and
   * json_extract lets the whole-table read stay a whole-table read without
   * parsing every manifest to find seven.
   */
  giBakes() {
    const handle = db();
    const scope = spaceFilter();
    return handle
      .prepare(
        `SELECT * FROM sketches
         WHERE json_extract(manifest_json, '$.giBake') IS NOT NULL${scope.sql}
         ORDER BY json_extract(manifest_json, '$.giBake.bakedAt') DESC, created_at DESC`,
      )
      .all(...scope.params)
      .map(rowToSketch)
      .filter(Boolean);
  },

  // Pin (or clear) a sketch's Maker gallery without touching its content. Pass
  // bucket=null to drop back to the derived bucket. Returns the refreshed row,
  // or null if no row matches `ref`.
  setBucket({ ref, bucket }) {
    if (!ref) return null;
    return this.update({ ref, bucket: bucket || null });
  },
};
