/**
 * meta_embeddings repository — single semantic-search sidecar over durable
 * app state.
 *
 * One table covers eight source kinds (principles, mcp tools, capability
 * bodies, orbit components/compositions/provider artifacts, catalyst
 * markdown, sketch vocabulary cards). Each row is
 * `(source_kind, source_ref) -> (content_hash, body_text, embedding, model)`.
 * The agent reads through the
 * `semantic_search` MCP tool; writes are driven from the source-row write
 * paths via the split sync/async API documented below.
 *
 * ── Split API, why ───────────────────────────────────────────────────────
 *
 * better-sqlite3's db.transaction(fn) requires fn to be SYNCHRONOUS, and
 * generateEmbeddings(...) is async (the embedder loads ONNX and runs
 * inference). The split lets each source-table write follow the same
 * pattern:
 *
 *   compose body text(s) → await embed(...) → enter sync txn that writes
 *   the source row(s) + the embedding row(s) together
 *
 * Atomicity is preserved end-to-end: if the host write rolls back, the
 * embedding write rolls back with it. The embedding cost is paid before
 * the txn opens, so the txn itself stays narrow.
 *
 * ── Failure posture ──────────────────────────────────────────────────────
 *
 * Embed failures are SOFT everywhere. `embed`/`embedMany` log and return
 * `{ vector: null }` on failure so the host write still commits; the agent
 * loses recall on that specific row until the next reindex. Same posture
 * applies to bulk inventory replace — a network blip during embed leaves a
 * whole server's tools un-indexed, but the inventory write itself
 * succeeds.
 *
 * See lite-template/integration/SEMANTIC_INDEX_PLAN.md.
 */

import { createHash } from 'node:crypto';

import { getDb } from '../index.js';
import {
  generateEmbeddings,
  LOCAL_EMBEDDING_MODEL,
  LOCAL_EMBEDDING_DIM,
} from '../../embedder/local.js';

export const SOURCE_KINDS = [
  'principle',
  'mcp_tool',
  'mcp_capability',
  'orbit_component',
  'orbit_composition',
  'orbit_artifact',
  'catalyst',
  'sketch_vocab',
  'sketch_method',
  // manji-program-bearing cards (mandala-patterns + shot-glyphs whose card
  // declares a `manjiProgram` field). Discovered by intent and passed
  // straight to `create_manji_tree` as a `programRef`.
  'manji_program',
  // painted-landscape glyph cards (heartbeat / splatch / camera / scene / sky
  // markdown under painted-landscape-cards/). Discovered by intent and passed
  // as a named glyph to `compose_world` (base 'painted-landscape', via
  // `overrides`).
  'painted_landscape',
  // view-vocab cards — one per `create_view` kind / `compose_world` base
  // (markdown under lib/graph/views/view-vocab/). Each carries the depiction
  // prose, routing phrases, and parameter manual that used to live in the
  // retired per-kind tool's description. Discovered by intent; read in full
  // via `get_view_vocab`.
  'view_vocab',
  // beats-vocab cards — one per `create_beats` kind (markdown under
  // lib/graph/beats/beats-vocab/). Routing phrases + the recipe/patch/gesture
  // parameter manual for the audio mints. Discovered by intent; read in full
  // via `get_beats_vocab`.
  'beats_vocab',
  // game-vocab cards — one per store SLICE KIND + the typed-event family
  // (markdown under lib/graph/game/slice-cards/). Routing phrases + the store
  // schema manual for `create_game`. Discovered by intent; read in full via
  // `get_game_vocab`.
  'game_vocab',
  // game-mechanic cards — one per level MECHANIC (+ the fall policy + a guide)
  // under lib/graph/game/mechanic-cards/. Routing phrases + the parameter manual
  // for a level's `game.mechanics`. Discovered by intent; read via `get_game_vocab`.
  'game_mechanic',
  // game-kit cards — one per game KIT (generated from lib/graph/game/kits.js):
  // a curated store + level-template + progression bundle. Discovered by intent
  // ("a dungeon crawler", "a survival arena"); read via `get_game_vocab`.
  'game_kit',
];

const SNIPPET_MAX_CHARS = 280;

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function assertSourceKind(kind) {
  if (!SOURCE_KINDS.includes(kind)) {
    throw new Error(
      `Invalid source_kind '${kind}' (expected one of: ${SOURCE_KINDS.join(', ')})`,
    );
  }
}

// Float32Array <-> Buffer round-trip. Stored as a raw little-endian f32 blob;
// no JSON, no header — the BLOB column owns the layout and the dimension is
// fixed by LOCAL_EMBEDDING_DIM. Reading uses .buffer / .byteOffset / .byteLength
// to avoid copying when the source buffer is already aligned.
function vectorToBuffer(vector) {
  if (!Array.isArray(vector) && !(vector instanceof Float32Array)) {
    throw new Error('vectorToBuffer: expected array or Float32Array');
  }
  const f32 = vector instanceof Float32Array ? vector : Float32Array.from(vector);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

function bufferToVector(buf) {
  // SQLite hands back a Node Buffer; reinterpret as Float32 view.
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  // Return a copy so callers can mutate freely without touching the row.
  return Array.from(f32);
}

function cosine(a, b) {
  // Both populations come out of generateEmbeddings normalized (L2=1), so
  // cosine reduces to dot product. We don't re-normalize on read — the column
  // contract is "store the normalized vector" and any future model swap pays
  // for normalization there.
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function snippetOf(bodyText) {
  if (typeof bodyText !== 'string') return '';
  if (bodyText.length <= SNIPPET_MAX_CHARS) return bodyText;
  return bodyText.slice(0, SNIPPET_MAX_CHARS - 1) + '…';
}

export const EmbeddingsRepository = {
  /**
   * Compute an embedding for one body text. Returns `{ hash, vector }`. When
   * a row at `(sourceKind, sourceRef)` already exists with the same content
   * hash, returns `{ hash, vector: null }` so the sync upsert can no-op
   * without re-embedding. On embed failure, logs and returns
   * `{ hash, vector: null, error }` — host writes never throw on this path.
   *
   * Pass `{ skipUnchanged: false }` for write paths whose host transaction
   * deletes the prior embedding row before upserting (e.g. inventory
   * replace). The hash-skip optimization is unsafe there — the skipped
   * vector would never make it back to the row.
   */
  async embed(sourceKind, sourceRef, bodyText, { skipUnchanged = true } = {}) {
    assertSourceKind(sourceKind);
    if (typeof bodyText !== 'string' || bodyText.length === 0) {
      throw new Error('embed: bodyText must be a non-empty string');
    }
    const hash = sha256(bodyText);
    if (skipUnchanged) {
      const db = getDb();
      const existing = db
        .prepare(
          'SELECT content_hash FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?',
        )
        .get(sourceKind, sourceRef);
      if (existing && existing.content_hash === hash) {
        return { hash, vector: null };
      }
    }
    try {
      const [vector] = await generateEmbeddings([bodyText], {
        inputType: 'search_document',
      });
      return { hash, vector };
    } catch (err) {
      console.warn(
        `[meta_embeddings] embed failed for ${sourceKind}:${sourceRef} — ${err.message}`,
      );
      return { hash, vector: null, error: err.message };
    }
  },

  /**
   * Batched embed for the bulk path (inventory replace, first-install
   * reindex). One model load + one tensor pass. Returns an array parallel to
   * the input: each element is `{ sourceKind, sourceRef, bodyText, hash,
   * vector }`. Hash-skip semantics apply per entry — entries whose hash
   * matches an existing row come back with `vector: null` and are pulled out
   * of the batch before the model call.
   *
   * Pass `{ skipUnchanged: false }` for the inventory-replace path (the
   * host txn deletes the prior embedding row before upserting; a skipped
   * vector there would never make it back into storage).
   */
  async embedMany(items, { skipUnchanged = true } = {}) {
    if (!Array.isArray(items)) {
      throw new Error('embedMany: items must be an array');
    }
    if (items.length === 0) return [];
    const db = getDb();
    const prepped = items.map((it) => {
      assertSourceKind(it.sourceKind);
      if (typeof it.bodyText !== 'string' || it.bodyText.length === 0) {
        throw new Error('embedMany: every item requires a non-empty bodyText');
      }
      const hash = sha256(it.bodyText);
      let skip = false;
      if (skipUnchanged) {
        const existing = db
          .prepare(
            'SELECT content_hash FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?',
          )
          .get(it.sourceKind, it.sourceRef);
        skip = !!(existing && existing.content_hash === hash);
      }
      return {
        sourceKind: it.sourceKind,
        sourceRef: it.sourceRef,
        bodyText: it.bodyText,
        hash,
        vector: null,
        skip,
      };
    });
    const toEmbed = prepped.filter((p) => !p.skip);
    if (toEmbed.length > 0) {
      try {
        const vectors = await generateEmbeddings(
          toEmbed.map((p) => p.bodyText),
          { inputType: 'search_document' },
        );
        for (let i = 0; i < toEmbed.length; i++) {
          toEmbed[i].vector = vectors[i];
        }
      } catch (err) {
        console.warn(
          `[meta_embeddings] embedMany failed (${toEmbed.length} items) — ${err.message}`,
        );
        // Leave .vector = null on every toEmbed entry; the caller treats the
        // batch as a soft loss and the source write still commits.
      }
    }
    return prepped.map((p) => ({
      sourceKind: p.sourceKind,
      sourceRef: p.sourceRef,
      bodyText: p.bodyText,
      hash: p.hash,
      vector: p.vector,
    }));
  },

  /**
   * Synchronous upsert. Call from inside a host write's `db.transaction(fn)`
   * so the embedding row commits or rolls back with the source row.
   *
   * `vector: null` is the soft-failure signal — the upsert is skipped and the
   * caller continues. Existing rows are NOT deleted on soft failure: a prior
   * good embedding stays in place even if the latest embed failed, so recall
   * doesn't regress below the previous state until the row is overwritten or
   * reindexed.
   */
  upsertSync({ sourceKind, sourceRef, bodyText, hash, vector, model = LOCAL_EMBEDDING_MODEL }) {
    assertSourceKind(sourceKind);
    if (typeof sourceRef !== 'string' || sourceRef.length === 0) {
      throw new Error('upsertSync: sourceRef must be a non-empty string');
    }
    if (vector === null || vector === undefined) {
      // No-op on soft-failure / hash-skip. Caller decides whether to log.
      return { written: false, reason: 'no_vector' };
    }
    if (!Array.isArray(vector) && !(vector instanceof Float32Array)) {
      throw new Error('upsertSync: vector must be an array of numbers');
    }
    if (vector.length !== LOCAL_EMBEDDING_DIM) {
      throw new Error(
        `upsertSync: vector length ${vector.length} != expected ${LOCAL_EMBEDDING_DIM}`,
      );
    }
    if (typeof bodyText !== 'string' || bodyText.length === 0) {
      throw new Error('upsertSync: bodyText must be a non-empty string');
    }
    if (typeof hash !== 'string' || hash.length === 0) {
      throw new Error('upsertSync: hash must be a non-empty string');
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO meta_embeddings (source_kind, source_ref, content_hash, body_text, embedding, model)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_kind, source_ref) DO UPDATE SET
         content_hash = excluded.content_hash,
         body_text = excluded.body_text,
         embedding = excluded.embedding,
         model = excluded.model,
         created_at = unixepoch()`,
    ).run(sourceKind, sourceRef, hash, bodyText, vectorToBuffer(vector), model);
    return { written: true };
  },

  /** Sync delete for a single (kind, ref). */
  deleteByRefSync(sourceKind, sourceRef) {
    assertSourceKind(sourceKind);
    const db = getDb();
    const result = db
      .prepare('DELETE FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?')
      .run(sourceKind, sourceRef);
    return result.changes;
  },

  /**
   * Sync delete for every row whose source_ref starts with prefix. Used by
   * the inventory replace path to drop a server's tools in one shot
   * (`deleteByRefPrefixSync('mcp_tool', '${server}::')`).
   */
  deleteByRefPrefixSync(sourceKind, prefix) {
    assertSourceKind(sourceKind);
    if (typeof prefix !== 'string' || prefix.length === 0) {
      throw new Error('deleteByRefPrefixSync: prefix must be a non-empty string');
    }
    const db = getDb();
    // LIKE-escape the prefix's wildcards so a server name with `_` or `%`
    // doesn't widen the delete. The ESCAPE clause makes `\` the escape char
    // and we escape only the LIKE metacharacters; backslash itself is
    // double-escaped for the LIKE pattern.
    const escaped = prefix.replace(/\\/g, '\\\\').replace(/[%_]/g, (m) => `\\${m}`);
    const result = db
      .prepare(
        "DELETE FROM meta_embeddings WHERE source_kind = ? AND source_ref LIKE ? ESCAPE '\\'",
      )
      .run(sourceKind, `${escaped}%`);
    return result.changes;
  },

  /**
   * Cosine top-k. Loads the (optionally kind-filtered) rows into memory,
   * scores against the query embedding, sorts, slices. Acceptable to ~10k
   * rows; past that, swap in sqlite-vec without changing the row shape.
   *
   * Returns `[{ source_kind, source_ref, score, snippet }]`. The caller
   * (`semantic_search` MCP tool) is responsible for re-checking row
   * relevance against current state — e.g. filtering out superseded
   * capability rows by joining against meta_mcp_capabilities.
   */
  async search(query, { kinds, limit = 8 } = {}) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('search: query must be a non-empty string');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error('search: limit must be an integer in [1, 50]');
    }
    let kindFilter = null;
    if (kinds !== undefined && kinds !== null) {
      if (!Array.isArray(kinds) || kinds.length === 0) {
        throw new Error('search: kinds must be a non-empty array when provided');
      }
      for (const k of kinds) assertSourceKind(k);
      kindFilter = kinds;
    }

    let queryVector;
    try {
      const [v] = await generateEmbeddings([query], { inputType: 'search_query' });
      queryVector = v;
    } catch (err) {
      console.warn(`[meta_embeddings] search embed failed: ${err.message}`);
      return [];
    }

    const db = getDb();
    let rows;
    if (kindFilter) {
      const placeholders = kindFilter.map(() => '?').join(',');
      rows = db
        .prepare(
          `SELECT id, source_kind, source_ref, body_text, embedding
           FROM meta_embeddings WHERE source_kind IN (${placeholders})`,
        )
        .all(...kindFilter);
    } else {
      rows = db
        .prepare(
          'SELECT id, source_kind, source_ref, body_text, embedding FROM meta_embeddings',
        )
        .all();
    }

    // Capability rows are append-with-supersession; filter out anything whose
    // backing row is no longer the current capability for its provider. The
    // join goes through meta_mcp_providers because source_ref keys on
    // provider_ref, not capability id. A row in meta_embeddings without a
    // current capability entry is silently dropped — exactly the "never
    // return stale vendor knowledge" property the plan calls for.
    let validCapabilityRefs = null;
    const hasCapabilityRows = rows.some((r) => r.source_kind === 'mcp_capability');
    if (hasCapabilityRows) {
      const currentRows = db
        .prepare(
          `SELECT p.provider_ref
           FROM meta_mcp_capabilities c
           JOIN meta_mcp_providers p ON p.id = c.provider_id
           WHERE c.superseded_by IS NULL`,
        )
        .all();
      validCapabilityRefs = new Set(currentRows.map((r) => r.provider_ref));
    }

    const scored = [];
    for (const r of rows) {
      if (
        validCapabilityRefs &&
        r.source_kind === 'mcp_capability' &&
        !validCapabilityRefs.has(r.source_ref)
      ) {
        continue;
      }
      const vec = bufferToVector(r.embedding);
      const score = cosine(queryVector, vec);
      scored.push({
        source_kind: r.source_kind,
        source_ref: r.source_ref,
        score,
        snippet: snippetOf(r.body_text),
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  },

  /** Read-only inspector used by tests + the integration suite. */
  findByRef(sourceKind, sourceRef) {
    assertSourceKind(sourceKind);
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, source_kind, source_ref, content_hash, body_text, model, created_at
         FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?`,
      )
      .get(sourceKind, sourceRef);
    if (!row) return null;
    return {
      id: row.id,
      sourceKind: row.source_kind,
      sourceRef: row.source_ref,
      contentHash: row.content_hash,
      bodyText: row.body_text,
      model: row.model,
      createdAt: row.created_at,
    };
  },
};

// ── Body composition helpers ──────────────────────────────────────────────
//
// Each source kind has a canonical body shape; the plan's "Body composition
// per source kind" table is enforced here. Write-site callers pick the right
// helper before handing the result to `embed`/`embedMany`. Centralizing the
// composition keeps the index consistent with the plan when source-row
// shapes evolve, and the reindex CLI rides the same helpers.

export const ToolRefSeparator = '::';

export function composeMcpToolRef(server, toolName) {
  return `${server}${ToolRefSeparator}${toolName}`;
}

export function composeMcpToolBody({ server, toolName, description }) {
  // Body = "${server}.${toolName}\n${description ?? ''}". server.tool dotted
  // alone is still useful signal even when description is null — the plan
  // accepts that asymmetry. Note: the ref keys on `::` (so a `.` inside a
  // server name doesn't split badly), but the body uses `.` so tool-name
  // tokens cluster naturally.
  const head = `${server}.${toolName}`;
  if (description && typeof description === 'string' && description.trim()) {
    return `${head}\n${description.trim()}`;
  }
  return head;
}

export function composeOrbitComponentRef({ kind, ref, version }) {
  return `${kind}/${ref}@${version}`;
}

export const BodyComposition = {
  principle(principle) {
    return principle.body_md ?? principle.bodyMd;
  },
  capability(capability) {
    return capability.body_md ?? capability.bodyMd;
  },
  orbitComponent(component) {
    return component.body_md ?? component.bodyMd;
  },
  orbitComposition(composition) {
    return composition.intent_md ?? composition.intentMd;
  },
  orbitArtifact(artifact) {
    return artifact.body_md ?? artifact.bodyMd;
  },
  catalyst(catalyst) {
    // Full markdown — body + frontmatter recomposed so a search for `id`
    // metadata still hits. Loader strips the frontmatter and exposes
    // structured fields, so we round-trip into a serialized form here. This
    // matches the plan's "full markdown file contents" wording.
    const lines = [];
    lines.push(`# ${catalyst.name}`);
    if (catalyst.summary) lines.push('', catalyst.summary);
    if (catalyst.valueHook) lines.push('', `*${catalyst.valueHook}*`);
    if (catalyst.category) lines.push('', `Category: ${catalyst.category}`);
    if (catalyst.body) {
      lines.push('', '---', '', catalyst.body);
    }
    return lines.join('\n');
  },
  sketchVocab(card) {
    // The retrieval signal is the "when" line + summary + body (layout math).
    // Lead with name/summary/when so a query phrased as an intent ("show
    // proportions of a whole") matches the card before the geometry prose.
    // Tier is surfaced so tier-shaped intents ("render primitive for fire")
    // also pull the right tier slice.
    const lines = [];
    lines.push(`# ${card.name}`);
    if (card.tier) lines.push('', `Tier: ${card.tier}`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
  viewVocab(card) {
    // Same shape as sketchVocab: lead with name / family / summary / when so
    // an intent-phrased query ("show my student nuclear fission") matches
    // before the parameter manual does. The body (depiction prose + params)
    // is the strongest signal for structurally-phrased queries.
    const lines = [];
    lines.push(`# ${card.name} (${card.family})`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
  beatsVocab(card) {
    // Same shape as viewVocab: lead with the intent-phrased fields so "give
    // this world a soundtrack" / "make a pickup sound" match before the
    // recipe manual does.
    const lines = [];
    lines.push(`# ${card.name}`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
  gameVocab(card) {
    // Same shape as beatsVocab: lead with the intent-phrased fields so "a
    // customizable army that persists" / "loot carried between levels" match
    // before the store-schema manual does.
    const lines = [];
    lines.push(`# ${card.name}`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
  gameMechanic(card) {
    // Same shape: lead with intent phrases so "reach the exit" / "collect coins" /
    // "don't die from falling" match the mechanic card before its param manual.
    const lines = [];
    lines.push(`# ${card.name}`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
  gameKit(card) {
    // Same shape: lead with intent phrases so "make a dungeon crawler" / "a survival
    // arena" match the kit card before its store/level-template recipe.
    const lines = [];
    lines.push(`# ${card.name}`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
  sketchMethod(method) {
    // Lead with the categorical name (family . knob . value) so a query
    // phrased structurally ("style: victorian") also matches the slot, then
    // the descriptive prose so visual cues ("steep mansard roof, ornate
    // trim") match. Family-root records have no knob/value — they anchor
    // the family's existence in retrieval so a vague intent ("a house")
    // pulls the family along with whatever knob values score above it.
    const lines = [];
    if (method.knob && method.value) {
      const tag = method.isDefault ? ' (default)' : '';
      lines.push(`# ${method.family} → ${method.knob} → ${method.value}${tag}`);
    } else {
      lines.push(`# ${method.family} (family)`);
    }
    if (method.describe) lines.push('', method.describe);
    return lines.join('\n');
  },
  manjiProgram(card) {
    // Recursive helper: walks a manjiProgram.children list (and any
    // nested children of bindings) collecting leaf-mark specs of the
    // requested kind. Used to bridge the recipe-template → callable-
    // preset migration so the indexed body looks the same either way.
    function collectLeafMarks(children, kind) {
      const found = [];
      if (!Array.isArray(children)) return found;
      for (const child of children) {
        if (!child || typeof child !== 'object') continue;
        if (child.kind === kind) found.push(child);
        if (Array.isArray(child.children)) {
          found.push(...collectLeafMarks(child.children, kind));
        }
        if (child.node) {
          if (child.node.kind === kind) found.push(child.node);
          if (Array.isArray(child.node.children)) {
            found.push(...collectLeafMarks(child.node.children, kind));
          }
        }
      }
      return found;
    }
    // Cards that carry a `manjiProgram` field — discovered by intent and
    // passed straight to `create_manji_tree` as a `programRef`. Front-load
    // the strongest retrieval signals (label, aliases, family, intents,
    // reasoningUse) and tail with the slot vocabulary so structural-intent
    // queries ("hall with floor and ceiling corners", "axis-mundi center")
    // also hit. Works for both mandala-pattern cards and shot-glyph cards.
    const lines = [];
    lines.push(`# ${card.label || card.id}`);
    lines.push('', `Ref: ${card.id}`);
    if (Array.isArray(card.aliases) && card.aliases.length) {
      lines.push('', `Aliases: ${card.aliases.join(', ')}`);
    }
    if (card.family) lines.push('', `Family: ${card.family}`);
    if (Array.isArray(card.intents) && card.intents.length) {
      lines.push('', `Intents: ${card.intents.join(', ')}`);
    }
    if (Array.isArray(card.reasoningUse) && card.reasoningUse.length) {
      lines.push('', 'Use when:', ...card.reasoningUse.map((line) => `- ${line}`));
    }
    if (card.topology && typeof card.topology === 'object') {
      const topologyLines = Object.entries(card.topology)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
      if (topologyLines.length) lines.push('', 'Topology:', ...topologyLines);
    }
    if (card.boundaryContract?.slots?.length) {
      lines.push('', `Slots: ${card.boundaryContract.slots.join(', ')}`);
    }
    if (card.boundaryContract?.depthBands?.length) {
      lines.push('', `Depth bands: ${card.boundaryContract.depthBands.join(', ')}`);
    }
    // Slot ids from the manjiProgram itself — these are what `create_manji_tree`
    // children actually bind to. Include both 2D-shape (slotLabels) and 3D-shape
    // (slots[].id) so either authoring direction matches.
    const programSlotIds = [];
    if (Array.isArray(card.manjiProgram?.slotLabels)) {
      programSlotIds.push(...card.manjiProgram.slotLabels);
    }
    if (card.manjiProgram?.centerSlotId) {
      programSlotIds.push(card.manjiProgram.centerSlotId);
    }
    if (Array.isArray(card.manjiProgram?.slots)) {
      for (const slot of card.manjiProgram.slots) {
        if (slot?.id) programSlotIds.push(slot.id);
      }
    }
    if (programSlotIds.length) {
      lines.push('', `Bind slots: ${programSlotIds.join(', ')}`);
    }
    // Wave-field / connection summary — same prose surface whether the
    // card carries the recipe as a top-level `waveField` / `connections`
    // field (recipe-template shape) OR inside `manjiProgram.children` as
    // in-tree `kind: 'wave-field' | 'connection'` leaf marks (callable-
    // preset shape, the migration target). Both shapes are walked here
    // so the indexed body text stays intent-aligned across the
    // transition. See lite-template/integration/0605/wave-and-line-in-tree.plan.md.
    const inTreeWaveFields = collectLeafMarks(card.manjiProgram?.children, 'wave-field');
    const inTreeConnections = collectLeafMarks(card.manjiProgram?.children, 'connection');
    const inTreeWaveManji = collectLeafMarks(card.manjiProgram?.children, 'wave-manji');
    const inTreeLathes = collectLeafMarks(card.manjiProgram?.children, 'lathe');
    const recipeWaveField = card.waveField && typeof card.waveField === 'object'
      ? [card.waveField]
      : [];
    const recipeConnections = Array.isArray(card.connections) ? card.connections : [];
    const recipeWaveManji = Array.isArray(card.waveManji) ? card.waveManji : [];
    const allWaveFields = [...recipeWaveField, ...inTreeWaveFields];
    const allConnections = [...recipeConnections, ...inTreeConnections];
    const allWaveManji = [...recipeWaveManji, ...inTreeWaveManji];

    for (const field of allWaveFields) {
      lines.push('', 'Primitive: wave-field (areal surface)');
      const waves = Array.isArray(field.waves) ? field.waves : [];
      if (waves.length === 0) {
        lines.push('Waves: flat (no displacement) — sampled as a grid');
      } else {
        lines.push(`Waves: ${waves.length} component${waves.length === 1 ? '' : 's'}`);
        const amps = waves
          .map((w) => Number(w?.amplitude))
          .filter((a) => Number.isFinite(a));
        if (amps.length) {
          const maxAmp = Math.max(...amps);
          lines.push(`Peak amplitude: ${maxAmp.toFixed(2)}`);
        }
      }
      if (field.style?.stroke) {
        lines.push(`Stroke: ${field.style.stroke}`);
      }
    }
    for (const conn of allConnections) {
      lines.push('', 'Primitive: connection (sine/cosine line between two points)');
      if (Number.isFinite(conn.sag)) {
        lines.push(`Sag: ${conn.sag.toFixed(2)} world units (${conn.sag < 0 ? 'against' : 'with'} gravity)`);
      } else if (Number.isFinite(conn.relativeSag)) {
        const pct = (conn.relativeSag * 100).toFixed(0);
        lines.push(`Relative sag: ${pct}% of span (${conn.relativeSag < 0 ? 'against' : 'with'} gravity)`);
      } else {
        lines.push('Sag: gravity-default (auto from physics)');
      }
      const wl = Number.isFinite(conn.wavelengths) ? conn.wavelengths : 0.5;
      if (wl === 0.5) {
        lines.push('Wave: single half-cycle (arc / catenary)');
      } else {
        lines.push(`Wave: ${wl} full cycles (oscillation)`);
      }
      if (conn.style?.stroke) lines.push(`Stroke: ${conn.style.stroke}`);
    }
    for (const la of inTreeLathes) {
      lines.push('', 'Primitive: lathe (surface of revolution along an axis)');
      const profile = Array.isArray(la.profile) ? la.profile : [];
      if (profile.length === 1) {
        lines.push('Profile: single point (cylinder)');
      } else if (profile.length > 1) {
        const radii = profile.map((p) => p?.radius).filter(Number.isFinite);
        if (radii.length) {
          lines.push(`Profile: ${profile.length} control points, radius range ${Math.min(...radii).toFixed(2)} to ${Math.max(...radii).toFixed(2)}`);
        }
      }
      const harmonics = Array.isArray(la.harmonics) ? la.harmonics : [];
      if (harmonics.length) {
        const orders = harmonics.map((h) => h?.n).filter(Number.isFinite);
        if (orders.length) {
          lines.push(`Chisel: ${orders.length} harmonic${orders.length === 1 ? '' : 's'} (n = ${orders.join(', ')})`);
        }
      } else {
        lines.push('Chisel: none (smooth surface)');
      }
      if (la.style?.stroke) lines.push(`Stroke: ${la.style.stroke}`);
    }
    for (const wm of allWaveManji) {
      lines.push('', 'Primitive: wave-manji (closed-loop printer around a singularity)');
      if (typeof wm.script === 'string') {
        lines.push(`Script: ${wm.script}`);
      }
      if (Number.isFinite(wm.bending)) {
        const where = wm.bending < 1 ? 'looser / disperses' : wm.bending > 1 ? 'tighter / contained' : 'neutral basin';
        lines.push(`Bending: ${wm.bending.toFixed(2)} (${where})`);
      }
      if (Number.isFinite(wm.density)) {
        lines.push(`Density target: ${wm.density} passes`);
      }
      const phaseStep = wm.params?.phaseStep;
      if (phaseStep === 'golden') {
        lines.push('Rotation: Golden Spin (Golden Angle phase step, maximally non-repeating)');
      }
      if (wm.params?.precess === false) {
        lines.push('Plane: fixed (flat, one rotation axis)');
      } else if (wm.script === 'tusk' || wm.script === 'rasengan-sphere') {
        lines.push('Plane: precessing (volumetric, two rotation axes)');
      }
      if (wm.style?.stroke) lines.push(`Stroke: ${wm.style.stroke}`);
    }
    // Shelf cards (markdown-authored) carry their prose body alongside the
    // structural fields. That body is the highest-signal retrieval surface —
    // appending it here lets semantic_search rank against the per-card
    // "Use when" / "Slot semantics" / "Composition examples" prose instead
    // of just the metadata. In-code cards have no body; they contribute
    // only the structured fields above.
    if (typeof card.body === 'string' && card.body.length > 0) {
      lines.push('', '---', '', card.body);
    }
    return lines.join('\n');
  },
  paintedLandscape(card) {
    // Painted-landscape glyph cards — one *.md per glyph under
    // painted-landscape-cards/, across five families (heartbeat geometry /
    // splatch palette / camera / scene / sky). Retrieved by intent and passed
    // as a named glyph to `create_painted_landscape`. Lead with id + family so
    // a slot-shaped query ("a stormy sky", "autumn palette") hits the right
    // family, then intent + aliases, then the prose body (strongest signal —
    // the per-card "when to reach for it" documentation).
    const lines = [];
    lines.push(`# ${card.id} (${card.family})`);
    if (card.intent) lines.push('', card.intent);
    if (Array.isArray(card.aliases) && card.aliases.length) {
      lines.push('', `Aliases: ${card.aliases.join(', ')}`);
    }
    if (typeof card.body === 'string' && card.body.length > 0) {
      lines.push('', '---', '', card.body);
    }
    return lines.join('\n');
  },
};

// ── reindexAll ────────────────────────────────────────────────────────────
//
// One-shot backfill across every source kind. Idempotent — re-running on a
// populated index is a no-op (hash-skip on every row). Run on first boot
// (wired via maybeBackfillEmbeddings in db/index.js) and re-invocable via
// scripts/reindex-embeddings.js.

export async function reindexAll({ verbose = false } = {}) {
  const log = (msg) => {
    if (verbose) console.log(`[reindex-embeddings] ${msg}`);
  };

  const db = getDb();
  const items = [];

  // 1. Principles
  const principleRows = db
    .prepare('SELECT id, body_md FROM meta_principles')
    .all();
  for (const r of principleRows) {
    items.push({
      sourceKind: 'principle',
      sourceRef: String(r.id),
      bodyText: r.body_md,
    });
  }
  log(`principles: ${principleRows.length}`);

  // 2. MCP tools (inventory)
  const toolRows = db
    .prepare('SELECT server, tool_name, description FROM meta_mcp_inventory')
    .all();
  for (const r of toolRows) {
    items.push({
      sourceKind: 'mcp_tool',
      sourceRef: composeMcpToolRef(r.server, r.tool_name),
      bodyText: composeMcpToolBody({
        server: r.server,
        toolName: r.tool_name,
        description: r.description,
      }),
    });
  }
  log(`mcp_tools: ${toolRows.length}`);

  // 3. Current capability rows
  const capabilityRows = db
    .prepare(
      `SELECT p.provider_ref, c.body_md
       FROM meta_mcp_capabilities c
       JOIN meta_mcp_providers p ON p.id = c.provider_id
       WHERE c.superseded_by IS NULL`,
    )
    .all();
  for (const r of capabilityRows) {
    items.push({
      sourceKind: 'mcp_capability',
      sourceRef: r.provider_ref,
      bodyText: r.body_md,
    });
  }
  log(`mcp_capabilities: ${capabilityRows.length}`);

  // 4. Orbit components
  const componentRows = db
    .prepare('SELECT kind, ref, version, body_md FROM mcp_orbit_components')
    .all();
  for (const r of componentRows) {
    items.push({
      sourceKind: 'orbit_component',
      sourceRef: composeOrbitComponentRef({
        kind: r.kind,
        ref: r.ref,
        version: r.version,
      }),
      bodyText: r.body_md,
    });
  }
  log(`orbit_components: ${componentRows.length}`);

  // 5. Orbit compositions
  const compositionRows = db
    .prepare('SELECT ref, intent_md FROM mcp_orbit_compositions')
    .all();
  for (const r of compositionRows) {
    items.push({
      sourceKind: 'orbit_composition',
      sourceRef: r.ref,
      bodyText: r.intent_md,
    });
  }
  log(`orbit_compositions: ${compositionRows.length}`);

  // 6. Orbit provider artifacts
  const artifactRows = db
    .prepare('SELECT ref, body_md FROM mcp_orbit_provider_artifacts')
    .all();
  for (const r of artifactRows) {
    items.push({
      sourceKind: 'orbit_artifact',
      sourceRef: r.ref,
      bodyText: r.body_md,
    });
  }
  log(`orbit_artifacts: ${artifactRows.length}`);

  // 7. Catalysts — filesystem markdown via the loader.
  const { getCatalystCatalog } = await import('../../mcp/catalysts/loader.js');
  const catalog = getCatalystCatalog();
  for (const cat of catalog.values()) {
    items.push({
      sourceKind: 'catalyst',
      sourceRef: cat.id,
      bodyText: BodyComposition.catalyst(cat),
    });
  }
  log(`catalysts: ${catalog.size}`);

  // 8. Sketch vocabulary — filesystem markdown via the loader. The cards
  // span three tiers: chart paradigms (the /sketch skill's vocabulary),
  // render primitives (composed by the polygonizer's system prompt), and
  // recipes (authoring shorthand). All three are indexed under
  // `source_kind:'sketch_vocab'`; callers filter by tier client-side.
  // Repo-curated, like catalysts.
  const { getSketchVocabCatalog } = await import('../../graph/sketch-vocab/loader.js');
  const vocab = getSketchVocabCatalog();
  for (const card of vocab.values()) {
    items.push({
      sourceKind: 'sketch_vocab',
      sourceRef: card.id,
      bodyText: BodyComposition.sketchVocab(card),
    });
  }
  log(`sketch_vocab: ${vocab.size}`);

  // 9. Sketch methods — per-knob-value records for the inverse-stable-diffusion
  // `sketch_what_possible` loop. Loader flattens per-family capability
  // catalogs (architecturalConstruction, …) into retrievable records the
  // agent assembles into a `create_sketch` call by asking the user for
  // unfilled knobs. Scope: scene/figure illustration only. Charts/info-
  // graphics retrieve from sketch_vocab instead.
  const { getSketchMethodCatalog } = await import('../../graph/polygonizer/capabilities/loader.js');
  const methods = getSketchMethodCatalog();
  for (const method of methods.values()) {
    items.push({
      sourceKind: 'sketch_method',
      sourceRef: method.id,
      bodyText: BodyComposition.sketchMethod(method),
    });
  }
  log(`sketch_method: ${methods.size}`);

  // 10. Manji-program-bearing cards. Two sources:
  //   (a) In-code mandala-patterns + shot-glyphs whose card declares a
  //       `manjiProgram` field.
  //   (b) Markdown shelf at `lib/graph/manji-programs/` — frontmatter +
  //       prose body. The body is the strongest retrieval signal and is
  //       appended to the indexed text by BodyComposition.manjiProgram.
  // See lite-template/integration/0605/manji-program-library-expansion.plan.md.
  const { mandalaPatternLibrary, shotGlyphLibrary } = await import(
    '../../graph/polygonizer/mandala-patterns.js'
  );
  let manjiProgramCount = 0;
  const seenManjiProgramRefs = new Set();
  // A card is indexable under `manji_program` if it declares ANY of the
  // three scenic primitives: manjiProgram (anchor scaffolding), waveField
  // (areal surface), or connections (organic curves). The kind name is
  // historical; the kind itself now carries scenic-primitive cards more
  // broadly. See lite-template/integration/0605/wave-field-plan-revision.plan.md.
  const hasIndexablePrimitive = (card) =>
    Boolean(card?.manjiProgram || card?.waveField || card?.connections || card?.waveManji);
  const addManjiProgramCard = (card) => {
    if (!hasIndexablePrimitive(card)) return;
    if (seenManjiProgramRefs.has(card.id)) return;
    seenManjiProgramRefs.add(card.id);
    items.push({
      sourceKind: 'manji_program',
      sourceRef: card.id,
      bodyText: BodyComposition.manjiProgram(card),
    });
    manjiProgramCount += 1;
  };
  for (const card of mandalaPatternLibrary()) addManjiProgramCard(card);
  for (const card of shotGlyphLibrary()) addManjiProgramCard(card);
  const { getManjiProgramCatalog } = await import(
    '../../graph/manji-programs/loader.js'
  );
  for (const card of getManjiProgramCatalog().values()) addManjiProgramCard(card);
  log(`manji_program: ${manjiProgramCount}`);

  // 11. Painted-landscape glyph cards — heartbeat / splatch / camera / scene /
  // sky cards under painted-landscape-cards/, each a named glyph the agent
  // passes to `create_painted_landscape`. Indexed by intent so "a stormy sky"
  // / "autumn palette" / "a top-down survey camera" surfaces the right glyph
  // before composing the recipe. Repo-curated markdown, like sketch_vocab.
  const { getPaintedLandscapeCardCatalog } = await import(
    '../../graph/painted-landscape-cards/loader.js'
  );
  const paintedCards = getPaintedLandscapeCardCatalog();
  for (const card of paintedCards.values()) {
    items.push({
      sourceKind: 'painted_landscape',
      sourceRef: card.ref,
      bodyText: BodyComposition.paintedLandscape(card),
    });
  }
  log(`painted_landscape: ${paintedCards.size}`);

  // 12. View-vocab cards — one *.md per `create_view` kind / `compose_world`
  // base under lib/graph/views/view-vocab/. Each carries the depiction prose
  // + routing phrases + parameter manual of a retired per-kind tool, so the
  // agent discovers a kind by intent and reads the full card via
  // `get_view_vocab` before composing params. Repo-curated markdown, like
  // sketch_vocab. See tool-list-drawerization.plan.md.
  const { getViewVocabCatalog } = await import('../../graph/views/view-vocab/loader.js');
  const viewVocab = getViewVocabCatalog();
  for (const card of viewVocab.values()) {
    items.push({
      sourceKind: 'view_vocab',
      sourceRef: card.id,
      bodyText: BodyComposition.viewVocab(card),
    });
  }
  log(`view_vocab: ${viewVocab.size}`);

  // 13. Beats-vocab cards — one *.md per `create_beats` kind under
  // lib/graph/beats/beats-vocab/. Routing phrases + the recipe / patch-shelf /
  // gesture parameter manual for the audio mints, so "give this world music" /
  // "make a pickup sound" surfaces the right kind before composing params.
  // Repo-curated markdown, like sketch_vocab. See lib/graph/beats/beats.plan.md.
  const { getBeatsVocabCatalog } = await import('../../graph/beats/beats-vocab/loader.js');
  const beatsVocab = getBeatsVocabCatalog();
  for (const card of beatsVocab.values()) {
    items.push({
      sourceKind: 'beats_vocab',
      sourceRef: card.id,
      bodyText: BodyComposition.beatsVocab(card),
    });
  }
  log(`beats_vocab: ${beatsVocab.size}`);

  // 14. Game-vocab cards — one *.md per store slice KIND plus the typed-events
  // family under lib/graph/game/slice-cards/. Routing phrases + the store-schema
  // manual for `create_game`, so "a tactics game with a persistent army" /
  // "inventory carried between levels" surfaces the right slice before composing
  // the schema. Repo-curated markdown. See lib/graph/game-metacontext.plan.md.
  const { getGameVocabCatalog } = await import('../../graph/game/slice-cards/loader.js');
  const gameVocab = getGameVocabCatalog();
  for (const card of gameVocab.values()) {
    items.push({
      sourceKind: 'game_vocab',
      sourceRef: card.id,
      bodyText: BodyComposition.gameVocab(card),
    });
  }
  log(`game_vocab: ${gameVocab.size}`);

  // 15. Game-mechanic cards — one *.md per level mechanic (+ the fall policy + a guide) under
  // lib/graph/game/mechanic-cards/. Routing phrases + the parameter manual for a level's
  // `game.mechanics`, so "reach the exit" / "collect coins" / "don't die from falling" surfaces
  // the right mechanic before composing a level. Repo-curated markdown. See game-mechanics.plan.md.
  const { getMechanicVocabCatalog } = await import('../../graph/game/mechanic-cards/loader.js');
  const mechanicVocab = getMechanicVocabCatalog();
  for (const card of mechanicVocab.values()) {
    items.push({
      sourceKind: 'game_mechanic',
      sourceRef: card.id,
      bodyText: BodyComposition.gameMechanic(card),
    });
  }
  log(`game_mechanic: ${mechanicVocab.size}`);

  // 16. Game-kit cards — one per game KIT, GENERATED from lib/graph/game/kits.js (store + level
  // template + progression + a worked example), so "make a dungeon crawler" / "a survival arena"
  // surfaces a ready game shape. See game-mechanics.plan.md (M4).
  const { getKitVocabCatalog } = await import('../../graph/game/kit-cards/loader.js');
  const kitVocab = getKitVocabCatalog();
  for (const card of kitVocab.values()) {
    items.push({
      sourceKind: 'game_kit',
      sourceRef: card.id,
      bodyText: BodyComposition.gameKit(card),
    });
  }
  log(`game_kit: ${kitVocab.size}`);

  if (items.length === 0) {
    log('nothing to index');
    return { totalSeen: 0, written: 0, skipped: 0, failed: 0 };
  }

  const embedded = await EmbeddingsRepository.embedMany(items);

  let written = 0;
  let skipped = 0;
  let failed = 0;
  const txn = db.transaction(() => {
    for (const e of embedded) {
      if (e.vector === null) {
        // Hash-skip OR soft-fail. We can't distinguish from the return shape
        // alone; the hash-skip case is benign and we just count the row as
        // skipped. embedMany already logged any actual failures.
        const existing = EmbeddingsRepository.findByRef(e.sourceKind, e.sourceRef);
        if (existing && existing.contentHash === e.hash) {
          skipped += 1;
        } else {
          failed += 1;
        }
        continue;
      }
      const res = EmbeddingsRepository.upsertSync({
        sourceKind: e.sourceKind,
        sourceRef: e.sourceRef,
        bodyText: e.bodyText,
        hash: e.hash,
        vector: e.vector,
      });
      if (res.written) written += 1;
      else skipped += 1;
    }
  });
  txn();
  log(`written=${written} skipped=${skipped} failed=${failed}`);
  return { totalSeen: items.length, written, skipped, failed };
}

export const _internals = {
  sha256,
  vectorToBuffer,
  bufferToVector,
  cosine,
  snippetOf,
  SNIPPET_MAX_CHARS,
};
