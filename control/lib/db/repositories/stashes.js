/**
 * Stash repository (Ring 9 — research mode v2).
 *
 * Replaces the flat research_sessions/research_items pair with a typed,
 * drawer-organized bucket. A Stash is a renameable user-facing entity with a
 * stable `st_<12hex>` ref. Items declare one of seven types on intake and the
 * gate validates required-per-type metadata; malformed items are rejected
 * rather than stored as junk. Drawers are optional sub-grouping inside a stash
 * (FK + unique-per-stash name).
 *
 * Coexists with research_* (migration option 3 — see
 * lite-template/integration/app-system/0531/GATHER_STASH_COOK.md): legacy
 * research sessions remain read-only via ResearchRepository; new Gathering
 * lands here. No cross-table imports.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';

const ITEM_TYPES = new Set([
  'text',
  'markdown',
  'image',
  'svg',
  'script',
  'pointer',
  'link',
  'sketch',
]);

// Sketch refs are minted by SketchRepository as `sk_<10 base36 chars>`. The
// gate checks the shape, not existence — dangling refs are tolerated by the
// same "navigational, not enforced" posture that stash_bindings uses (a
// sketch deleted out from under a stash item resolves to a clearly-labeled
// fallback in the renderer instead of vanishing the item).
const SKETCH_REF_RE = /^sk_[a-z0-9]+$/i;

// Size caps enforced at intake. SQLite happily stores megabytes, but the UI
// (and Cook's static template renderer) get unhappy past these; 5MB markdown
// blobs belong in storage, not in a row.
const SIZE_CAPS = {
  text_body: 64 * 1024,
  markdown_body: 256 * 1024,
  svg_body: 128 * 1024,
  script_body: 128 * 1024,
};

const SCRIPT_LANGUAGES = new Set(['js', 'ts', 'py', 'sh', 'sql']);

// Adjacency-layer kinds (the fixed set). New kinds are a one-line code change,
// not a schema migration — but resist `kind: 'anything'` here; freeform kinds
// is how the substrate accretes drift. See
// lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md.
const BINDING_KINDS = new Set(['bot', 'app', 'plan', 'cook', 'contextmap_node', 'sketch']);
const BINDING_ROLES = new Set(['corpus', 'working_memory', 'ingredient', 'reference']);

function parseJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToStash(row) {
  if (!row) return null;
  return {
    id: row.id,
    stashRef: row.stash_ref,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDrawer(row) {
  if (!row) return null;
  return {
    id: row.id,
    stashId: row.stash_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function rowToBinding(row, stashRef) {
  if (!row) return null;
  return {
    stashRef: stashRef ?? row.stash_ref ?? null,
    stashId: row.stash_id,
    boundKind: row.bound_kind,
    boundRef: row.bound_ref,
    role: row.role ?? null,
    createdAt: row.created_at,
  };
}

function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    stashId: row.stash_id,
    drawerId: row.drawer_id,
    type: row.type,
    title: row.title,
    sourceUrl: row.source_url,
    body: row.body,
    bodyMd: row.body_md,
    mediaRef: row.media_ref,
    metadata: parseJSON(row.metadata_json, {}),
    createdAt: row.created_at,
    archivedAt: row.archived_at ?? null,
  };
}

function generateRef() {
  return `st_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// ---------------------------------------------------------------------------
// the gate — typed item contract validation
// ---------------------------------------------------------------------------

/**
 * Validate an item payload against its declared type. Returns the columns to
 * insert ({ body, body_md, media_ref, metadata }). Throws with a precise
 * message on contract violation — the gate is opinionated on purpose.
 *
 * Required-per-type:
 *   text       — body (string, ≤64KB)
 *   markdown   — body_md (string, ≤256KB)
 *   image      — media_ref + metadata.mime (image/*), .width, .height, .content_hash
 *   svg        — body_svg (string, ≤128KB, looks-like-XML)
 *   script     — body (string, ≤128KB) + metadata.language ∈ js|ts|py|sh|sql
 *   pointer    — metadata.node_ref (a contextmap node-ref) + metadata.label
 *   link       — source_url + title
 */
export function validateItemContract({ type, title, sourceUrl, body, bodyMd, bodySvg, mediaRef, metadata }) {
  if (!ITEM_TYPES.has(type)) {
    throw new Error(`type '${type}' is not a valid stash item type. Allowed: ${[...ITEM_TYPES].join(', ')}.`);
  }
  const meta = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  const out = { body: null, body_md: null, media_ref: null, metadata: meta };

  switch (type) {
    case 'text': {
      if (typeof body !== 'string' || body.length === 0) {
        throw new Error("text items require a non-empty `body` string");
      }
      if (body.length > SIZE_CAPS.text_body) {
        throw new Error(`text body exceeds ${SIZE_CAPS.text_body} bytes; store large bodies as documents`);
      }
      out.body = body;
      break;
    }
    case 'markdown': {
      if (typeof bodyMd !== 'string' || bodyMd.length === 0) {
        throw new Error("markdown items require a non-empty `body_md` string");
      }
      if (bodyMd.length > SIZE_CAPS.markdown_body) {
        throw new Error(`markdown body exceeds ${SIZE_CAPS.markdown_body} bytes; split it or store as a document`);
      }
      out.body_md = bodyMd;
      break;
    }
    case 'image': {
      if (!mediaRef || typeof mediaRef !== 'string') {
        throw new Error("image items require `media_ref` pointing into stored media");
      }
      if (!meta.mime || typeof meta.mime !== 'string' || !meta.mime.startsWith('image/')) {
        throw new Error("image items require metadata.mime starting with 'image/'");
      }
      if (!Number.isInteger(meta.width) || meta.width <= 0) {
        throw new Error("image items require metadata.width (positive integer)");
      }
      if (!Number.isInteger(meta.height) || meta.height <= 0) {
        throw new Error("image items require metadata.height (positive integer)");
      }
      if (!meta.content_hash || typeof meta.content_hash !== 'string') {
        throw new Error("image items require metadata.content_hash (sha256 or similar)");
      }
      out.media_ref = mediaRef;
      // Optional caption — used by the photojournal outcome template as the
      // text below the photograph. Absent on plain pinned images. Mirrors the
      // sketch case's caption channel.
      if (bodyMd !== undefined && bodyMd !== null) {
        if (typeof bodyMd !== 'string') {
          throw new Error("image items: body_md must be a string when provided");
        }
        if (bodyMd.length > SIZE_CAPS.markdown_body) {
          throw new Error(`image caption body_md exceeds ${SIZE_CAPS.markdown_body} bytes`);
        }
        out.body_md = bodyMd;
      }
      break;
    }
    case 'svg': {
      if (typeof bodySvg !== 'string' || bodySvg.length === 0) {
        throw new Error("svg items require a non-empty `body_svg` string");
      }
      if (bodySvg.length > SIZE_CAPS.svg_body) {
        throw new Error(`svg body exceeds ${SIZE_CAPS.svg_body} bytes`);
      }
      if (!/^\s*<(\?xml|svg)\b/i.test(bodySvg)) {
        throw new Error("svg body must start with <?xml or <svg (rejected at the gate, not silently stored)");
      }
      out.body = bodySvg;
      break;
    }
    case 'script': {
      if (typeof body !== 'string' || body.length === 0) {
        throw new Error("script items require a non-empty `body` string");
      }
      if (body.length > SIZE_CAPS.script_body) {
        throw new Error(`script body exceeds ${SIZE_CAPS.script_body} bytes`);
      }
      if (!meta.language || typeof meta.language !== 'string' || !SCRIPT_LANGUAGES.has(meta.language)) {
        throw new Error(`script items require metadata.language ∈ ${[...SCRIPT_LANGUAGES].join('|')}`);
      }
      out.body = body;
      break;
    }
    case 'pointer': {
      if (!meta.node_ref || typeof meta.node_ref !== 'string') {
        throw new Error(
          "pointer items require metadata.node_ref (a contextmap node-ref). Sketches/plans/bots are not valid pointer targets — only metacontext nodes.",
        );
      }
      if (!meta.label || typeof meta.label !== 'string') {
        throw new Error("pointer items require metadata.label (the human display name at intake time)");
      }
      break;
    }
    case 'link': {
      if (!sourceUrl || typeof sourceUrl !== 'string') {
        throw new Error("link items require `source_url`");
      }
      if (!title || typeof title !== 'string') {
        throw new Error("link items require a `title`");
      }
      break;
    }
    case 'sketch': {
      if (!meta.sketch_ref || typeof meta.sketch_ref !== 'string') {
        throw new Error(
          "sketch items require metadata.sketch_ref (a sk_… ref from create_sketch).",
        );
      }
      if (!SKETCH_REF_RE.test(meta.sketch_ref)) {
        throw new Error(
          `metadata.sketch_ref '${meta.sketch_ref}' is not shaped like 'sk_<…>'`,
        );
      }
      if (!meta.label || typeof meta.label !== 'string') {
        throw new Error(
          "sketch items require metadata.label (the human display name at intake time)",
        );
      }
      // Optional caption — used by the picture-book outcome template as the
      // per-page text below the illustration. Absent on plain pinned sketches.
      if (bodyMd !== undefined && bodyMd !== null) {
        if (typeof bodyMd !== 'string') {
          throw new Error("sketch items: body_md must be a string when provided");
        }
        if (bodyMd.length > SIZE_CAPS.markdown_body) {
          throw new Error(`sketch caption body_md exceeds ${SIZE_CAPS.markdown_body} bytes`);
        }
        out.body_md = bodyMd;
      }
      break;
    }
    default:
      throw new Error(`unhandled type '${type}'`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// repository
// ---------------------------------------------------------------------------

export const StashRepository = {
  mint({ title }) {
    if (!title || typeof title !== 'string') {
      throw new Error('title is required to mint a stash');
    }
    const db = getDb();
    const stashRef = generateRef();
    const result = db
      .prepare('INSERT INTO stashes (stash_ref, title) VALUES (?, ?)')
      .run(stashRef, title);
    const row = db.prepare('SELECT * FROM stashes WHERE id = ?').get(result.lastInsertRowid);
    return rowToStash(row);
  },

  getByRef(stashRef) {
    if (!stashRef || typeof stashRef !== 'string') return null;
    const db = getDb();
    return rowToStash(db.prepare('SELECT * FROM stashes WHERE stash_ref = ?').get(stashRef));
  },

  list({ status } = {}) {
    const db = getDb();
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    const rows = db
      .prepare(`SELECT * FROM stashes ${where} ORDER BY updated_at DESC, id DESC`)
      .all(...params);
    return rows.map(rowToStash);
  },

  rename(stashRef, newTitle) {
    if (!newTitle || typeof newTitle !== 'string') {
      throw new Error('new title is required');
    }
    const db = getDb();
    const result = db
      .prepare('UPDATE stashes SET title = ?, updated_at = unixepoch() WHERE stash_ref = ?')
      .run(newTitle, stashRef);
    if (result.changes === 0) return null;
    return this.getByRef(stashRef);
  },

  archive(stashRef) {
    const db = getDb();
    const result = db
      .prepare(
        "UPDATE stashes SET status = 'archived', updated_at = unixepoch() WHERE stash_ref = ? AND status = 'open'",
      )
      .run(stashRef);
    return result.changes > 0;
  },

  /** Flip an archived stash back to open. Idempotent on open stashes. */
  unarchive(stashRef) {
    const db = getDb();
    const result = db
      .prepare(
        "UPDATE stashes SET status = 'open', updated_at = unixepoch() WHERE stash_ref = ? AND status = 'archived'",
      )
      .run(stashRef);
    return result.changes > 0;
  },

  // -------------------------------------------------------------------------
  // drawers
  // -------------------------------------------------------------------------

  mintDrawer({ stashRef, name }) {
    if (!name || typeof name !== 'string') {
      throw new Error('drawer name is required');
    }
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) throw new Error(`Stash '${stashRef}' not found`);
    // Idempotent on name within a stash — surfacing the existing drawer is
    // friendlier than throwing UNIQUE constraint failures up the agent stack.
    const existing = db
      .prepare('SELECT * FROM stash_drawers WHERE stash_id = ? AND name = ?')
      .get(stash.id, name);
    if (existing) return rowToDrawer(existing);
    const result = db
      .prepare('INSERT INTO stash_drawers (stash_id, name) VALUES (?, ?)')
      .run(stash.id, name);
    return rowToDrawer(
      db.prepare('SELECT * FROM stash_drawers WHERE id = ?').get(result.lastInsertRowid),
    );
  },

  listDrawers(stashRef) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) return [];
    const rows = db
      .prepare('SELECT * FROM stash_drawers WHERE stash_id = ? ORDER BY name ASC')
      .all(stash.id);
    return rows.map(rowToDrawer);
  },

  /**
   * Rename a drawer scoped to (stashRef, oldName). Collides on UNIQUE(stash_id, name)
   * if newName already exists — surfaced as a clean error rather than a raw
   * SQL exception. No-op if no drawer matches.
   */
  renameDrawer({ stashRef, oldName, newName }) {
    if (!newName || typeof newName !== 'string') {
      throw new Error('newName is required');
    }
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) throw new Error(`Stash '${stashRef}' not found`);
    const existing = db
      .prepare('SELECT * FROM stash_drawers WHERE stash_id = ? AND name = ?')
      .get(stash.id, oldName);
    if (!existing) return null;
    if (oldName === newName) return rowToDrawer(existing);
    const collision = db
      .prepare('SELECT id FROM stash_drawers WHERE stash_id = ? AND name = ?')
      .get(stash.id, newName);
    if (collision) {
      throw new Error(
        `A drawer named '${newName}' already exists in this stash.`,
      );
    }
    db.prepare('UPDATE stash_drawers SET name = ? WHERE id = ?').run(newName, existing.id);
    db.prepare('UPDATE stashes SET updated_at = unixepoch() WHERE id = ?').run(stash.id);
    return rowToDrawer(
      db.prepare('SELECT * FROM stash_drawers WHERE id = ?').get(existing.id),
    );
  },

  /**
   * Move an item between drawers in the same stash (or to root with drawer
   * = null). The target drawer must belong to the same stash as the item —
   * enforced in JS to avoid relying on FK edge cases.
   */
  moveItem({ stashRef, itemId, drawer }) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) throw new Error(`Stash '${stashRef}' not found`);
    const item = db.prepare('SELECT * FROM stash_items WHERE id = ?').get(itemId);
    if (!item) throw new Error(`Stash item '${itemId}' not found`);
    if (item.stash_id !== stash.id) {
      throw new Error(`Item '${itemId}' does not belong to stash '${stashRef}'`);
    }
    let drawerId = null;
    if (drawer !== null && drawer !== undefined) {
      if (typeof drawer !== 'string') {
        throw new Error('drawer must be a string (the drawer name) or null');
      }
      const d = db
        .prepare('SELECT id FROM stash_drawers WHERE stash_id = ? AND name = ?')
        .get(stash.id, drawer);
      if (!d) {
        throw new Error(
          `Drawer '${drawer}' does not exist in stash '${stashRef}'. Mint it with mint_drawer first, or pass drawer: null to move to the root.`,
        );
      }
      drawerId = d.id;
    }
    db.prepare('UPDATE stash_items SET drawer_id = ? WHERE id = ?').run(drawerId, itemId);
    db.prepare('UPDATE stashes SET updated_at = unixepoch() WHERE id = ?').run(stash.id);
    return rowToItem(db.prepare('SELECT * FROM stash_items WHERE id = ?').get(itemId));
  },

  // -------------------------------------------------------------------------
  // items — the Gather verb
  // -------------------------------------------------------------------------

  /**
   * Bind a typed item to a stash (and optionally a drawer). Validates the
   * contract first; throws if malformed. Touches the stash's updated_at so the
   * index sorts by recent activity.
   */
  gather({ stashRef, drawer, type, title, sourceUrl, body, bodyMd, bodySvg, mediaRef, metadata }) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) throw new Error(`Stash '${stashRef}' not found`);

    let drawerId = null;
    if (drawer) {
      if (typeof drawer !== 'string') throw new Error('drawer must be a string (the drawer name)');
      const d = db
        .prepare('SELECT id FROM stash_drawers WHERE stash_id = ? AND name = ?')
        .get(stash.id, drawer);
      if (!d) {
        throw new Error(
          `Drawer '${drawer}' does not exist in stash '${stashRef}'. Mint it with mint_drawer first, or omit drawer to gather into the stash root.`,
        );
      }
      drawerId = d.id;
    }

    const cols = validateItemContract({ type, title, sourceUrl, body, bodyMd, bodySvg, mediaRef, metadata });

    const result = db
      .prepare(
        `INSERT INTO stash_items
           (stash_id, drawer_id, type, title, source_url, body, body_md, media_ref, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        stash.id,
        drawerId,
        type,
        title ?? null,
        sourceUrl ?? null,
        cols.body,
        cols.body_md,
        cols.media_ref,
        JSON.stringify(cols.metadata),
      );

    db.prepare('UPDATE stashes SET updated_at = unixepoch() WHERE id = ?').run(stash.id);

    return rowToItem(db.prepare('SELECT * FROM stash_items WHERE id = ?').get(result.lastInsertRowid));
  },

  listItems(stashRef, { drawer, includeArchived = false } = {}) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) return [];
    const archivedClause = includeArchived ? '' : ' AND archived_at IS NULL';
    if (drawer === undefined) {
      const rows = db
        .prepare(
          `SELECT * FROM stash_items WHERE stash_id = ?${archivedClause} ORDER BY created_at ASC, id ASC`,
        )
        .all(stash.id);
      return rows.map(rowToItem);
    }
    if (drawer === null) {
      const rows = db
        .prepare(
          `SELECT * FROM stash_items WHERE stash_id = ? AND drawer_id IS NULL${archivedClause} ORDER BY created_at ASC, id ASC`,
        )
        .all(stash.id);
      return rows.map(rowToItem);
    }
    const d = db
      .prepare('SELECT id FROM stash_drawers WHERE stash_id = ? AND name = ?')
      .get(stash.id, drawer);
    if (!d) return [];
    const rows = db
      .prepare(
        `SELECT * FROM stash_items WHERE stash_id = ? AND drawer_id = ?${archivedClause} ORDER BY created_at ASC, id ASC`,
      )
      .all(stash.id, d.id);
    return rows.map(rowToItem);
  },

  countItems(stashRef, { includeArchived = false } = {}) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) return 0;
    const archivedClause = includeArchived ? '' : ' AND archived_at IS NULL';
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM stash_items WHERE stash_id = ?${archivedClause}`)
      .get(stash.id);
    return row ? row.n : 0;
  },

  /**
   * Fetch a single item by its integer id. Always returns the row regardless
   * of archived state — the citable-atoms posture means callers (cook slices,
   * live cite resolution) MUST be able to resolve an item by id even after it
   * was archived. Hiding archived rows is a list-view concern, not a lookup
   * concern.
   */
  getItemById(itemId) {
    if (!Number.isInteger(itemId)) return null;
    const db = getDb();
    return rowToItem(db.prepare('SELECT * FROM stash_items WHERE id = ?').get(itemId));
  },

  /**
   * Mutate a stash item in place. Re-runs the per-type contract gate against
   * the MERGED state (existing row + patch fields), so a partial update can
   * never corrupt the contract for the item's declared type — e.g. you can't
   * empty out an image's content_hash by sending `metadata: {}` without the
   * required keys. Touches `updated_at` on the parent stash.
   *
   * Type is intentionally NOT mutable: items are citable atoms, and changing
   * the type would break the rendering and slicing contract for any place the
   * id is already cited. Archive + re-gather instead.
   */
  updateItem({ itemId, title, sourceUrl, body, bodyMd, bodySvg, mediaRef, metadata }) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM stash_items WHERE id = ?').get(itemId);
    if (!existing) throw new Error(`Stash item '${itemId}' not found`);

    // Merge: undefined means "leave as-is"; explicit null means "clear".
    const mergedTitle = title === undefined ? existing.title : title;
    const mergedSourceUrl = sourceUrl === undefined ? existing.source_url : sourceUrl;
    const mergedBody = body === undefined ? existing.body : body;
    const mergedBodyMd = bodyMd === undefined ? existing.body_md : bodyMd;
    const mergedMediaRef = mediaRef === undefined ? existing.media_ref : mediaRef;
    const existingMetadata = parseJSON(existing.metadata_json, {});
    const mergedMetadata = metadata === undefined ? existingMetadata : metadata;

    // Per-type re-validation. The gate's input shape distinguishes svg's body
    // (bodySvg) from text/script's body (body); on the table both live in
    // `body`, so we route the merged body to whichever the type expects.
    const gateInput = {
      type: existing.type,
      title: mergedTitle,
      sourceUrl: mergedSourceUrl,
      body: existing.type === 'svg' ? undefined : mergedBody,
      bodyMd: mergedBodyMd,
      bodySvg: existing.type === 'svg' ? (bodySvg === undefined ? existing.body : bodySvg) : undefined,
      mediaRef: mergedMediaRef,
      metadata: mergedMetadata,
    };
    const cols = validateItemContract(gateInput);

    // Write the gate-canonicalized columns, not the merged inputs — the gate
    // is the single source of truth for which content column a type uses
    // (body for text/script/svg, body_md for markdown, media_ref for image,
    // none for pointer/link). Stray inputs for the wrong type are dropped.
    db.prepare(
      `UPDATE stash_items
         SET title = ?, source_url = ?, body = ?, body_md = ?, media_ref = ?, metadata_json = ?
       WHERE id = ?`,
    ).run(
      mergedTitle ?? null,
      mergedSourceUrl ?? null,
      cols.body,
      cols.body_md,
      cols.media_ref,
      JSON.stringify(cols.metadata),
      itemId,
    );

    db.prepare('UPDATE stashes SET updated_at = unixepoch() WHERE id = ?').run(existing.stash_id);

    return rowToItem(db.prepare('SELECT * FROM stash_items WHERE id = ?').get(itemId));
  },

  /**
   * Soft-delete an item. Sets archived_at; the row stays so cook slices and
   * other downstream citations continue to resolve to its last content. Idempotent —
   * archiving an already-archived item is a no-op and reports archived=false.
   * Hard delete is sweep-only, never user-triggered (see STASH_RELATIONAL_ATOMS.md).
   */
  archiveItem({ itemId }) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM stash_items WHERE id = ?').get(itemId);
    if (!existing) throw new Error(`Stash item '${itemId}' not found`);
    if (existing.archived_at !== null) return { archived: false, alreadyArchived: true };
    const result = db
      .prepare('UPDATE stash_items SET archived_at = unixepoch() WHERE id = ? AND archived_at IS NULL')
      .run(itemId);
    db.prepare('UPDATE stashes SET updated_at = unixepoch() WHERE id = ?').run(existing.stash_id);
    return { archived: result.changes > 0, alreadyArchived: false };
  },

  /**
   * Count downstream references to a stash item. Used to inform the
   * warn-and-proceed UX in archive_item. The substrate is single-operator and
   * scan target is small, so we just walk stash_cooks rows in-process instead
   * of maintaining a reference index. See
   * lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md.
   */
  scanItemReferences(itemId) {
    if (!Number.isInteger(itemId)) return { cooks: [] };
    const db = getDb();
    const cookRows = db.prepare('SELECT cook_ref, slices_json FROM stash_cooks').all();
    const cookHits = [];
    for (const row of cookRows) {
      const slices = parseJSON(row.slices_json, []);
      if (!Array.isArray(slices)) continue;
      const cited = slices.some(
        (s) => s && Array.isArray(s.item_ids) && s.item_ids.includes(itemId),
      );
      if (cited) cookHits.push(row.cook_ref);
    }
    return { cooks: cookHits };
  },

  // -------------------------------------------------------------------------
  // bindings — the adjacency layer
  // -------------------------------------------------------------------------

  /**
   * Link a stash to another substrate resource (bot / app / plan / cook /
   * contextmap_node). bound_ref is NOT validated against the target repo —
   * dangling refs are tolerated by design (the navigational chip will surface
   * "linked resource removed"). Idempotent on the PK; calling bind twice with
   * the same (stash, kind, ref) updates the role only.
   */
  bind({ stashRef, boundKind, boundRef, role }) {
    if (!BINDING_KINDS.has(boundKind)) {
      throw new Error(
        `bound_kind '${boundKind}' is not valid. Allowed: ${[...BINDING_KINDS].join(', ')}.`,
      );
    }
    if (!boundRef || typeof boundRef !== 'string') {
      throw new Error('bound_ref is required (the target resource ref)');
    }
    if (role !== undefined && role !== null && !BINDING_ROLES.has(role)) {
      throw new Error(
        `role '${role}' is not valid. Allowed: ${[...BINDING_ROLES].join(', ')} (or omit).`,
      );
    }
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) throw new Error(`Stash '${stashRef}' not found`);

    db.prepare(
      `INSERT INTO stash_bindings (stash_id, bound_kind, bound_ref, role)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(stash_id, bound_kind, bound_ref) DO UPDATE SET role = excluded.role`,
    ).run(stash.id, boundKind, boundRef, role ?? null);

    const row = db
      .prepare(
        'SELECT * FROM stash_bindings WHERE stash_id = ? AND bound_kind = ? AND bound_ref = ?',
      )
      .get(stash.id, boundKind, boundRef);
    return rowToBinding(row, stashRef);
  },

  /** Remove a stash binding. Returns true if a row was deleted, false otherwise. */
  unbind({ stashRef, boundKind, boundRef }) {
    if (!BINDING_KINDS.has(boundKind)) {
      throw new Error(
        `bound_kind '${boundKind}' is not valid. Allowed: ${[...BINDING_KINDS].join(', ')}.`,
      );
    }
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) return false;
    const result = db
      .prepare(
        'DELETE FROM stash_bindings WHERE stash_id = ? AND bound_kind = ? AND bound_ref = ?',
      )
      .run(stash.id, boundKind, boundRef);
    return result.changes > 0;
  },

  /**
   * Query bindings in either direction. Pass `stashRef` for "what is this
   * stash linked to"; pass `boundKind` + `boundRef` for "what stashes link to
   * this resource"; pass `boundKind` alone for "all bindings of this kind".
   * No filter at all returns every binding (operator audit view).
   */
  listBindings({ stashRef, boundKind, boundRef } = {}) {
    if (boundKind && !BINDING_KINDS.has(boundKind)) {
      throw new Error(
        `bound_kind '${boundKind}' is not valid. Allowed: ${[...BINDING_KINDS].join(', ')}.`,
      );
    }
    const db = getDb();
    const where = [];
    const params = [];
    let stashRefById = null;

    if (stashRef) {
      const stash = db.prepare('SELECT id, stash_ref FROM stashes WHERE stash_ref = ?').get(stashRef);
      if (!stash) return [];
      where.push('b.stash_id = ?');
      params.push(stash.id);
      stashRefById = new Map([[stash.id, stash.stash_ref]]);
    }
    if (boundKind) {
      where.push('b.bound_kind = ?');
      params.push(boundKind);
    }
    if (boundRef) {
      where.push('b.bound_ref = ?');
      params.push(boundRef);
    }

    const sql = `
      SELECT b.*, s.stash_ref AS stash_ref
        FROM stash_bindings b
        JOIN stashes s ON s.id = b.stash_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY b.created_at ASC, b.bound_kind ASC, b.bound_ref ASC
    `;
    const rows = db.prepare(sql).all(...params);
    return rows.map((row) => rowToBinding(row, row.stash_ref));
  },

  /** Full stash: stash row + drawers + items grouped by drawer name. */
  getFull(stashRef, { includeArchived = false } = {}) {
    const stash = this.getByRef(stashRef);
    if (!stash) return null;
    const drawers = this.listDrawers(stashRef);
    const items = this.listItems(stashRef, { includeArchived });
    const drawerNameById = new Map(drawers.map((d) => [d.id, d.name]));
    const itemsWithDrawer = items.map((it) => ({
      ...it,
      drawer: it.drawerId === null ? null : drawerNameById.get(it.drawerId) ?? null,
    }));
    return { stash, drawers, items: itemsWithDrawer };
  },
};

// Test seam.
export const _internals = {
  generateRef,
  ITEM_TYPES,
  SIZE_CAPS,
  SCRIPT_LANGUAGES,
  BINDING_KINDS,
  BINDING_ROLES,
};
