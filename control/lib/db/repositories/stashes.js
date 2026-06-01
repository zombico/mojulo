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

const ITEM_TYPES = new Set(['text', 'markdown', 'image', 'svg', 'script', 'pointer', 'link']);

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

  listItems(stashRef, { drawer } = {}) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) return [];
    if (drawer === undefined) {
      const rows = db
        .prepare('SELECT * FROM stash_items WHERE stash_id = ? ORDER BY created_at ASC, id ASC')
        .all(stash.id);
      return rows.map(rowToItem);
    }
    if (drawer === null) {
      const rows = db
        .prepare(
          'SELECT * FROM stash_items WHERE stash_id = ? AND drawer_id IS NULL ORDER BY created_at ASC, id ASC',
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
        'SELECT * FROM stash_items WHERE stash_id = ? AND drawer_id = ? ORDER BY created_at ASC, id ASC',
      )
      .all(stash.id, d.id);
    return rows.map(rowToItem);
  },

  countItems(stashRef) {
    const db = getDb();
    const stash = db.prepare('SELECT id FROM stashes WHERE stash_ref = ?').get(stashRef);
    if (!stash) return 0;
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM stash_items WHERE stash_id = ?')
      .get(stash.id);
    return row ? row.n : 0;
  },

  /** Full stash: stash row + drawers + items grouped by drawer name. */
  getFull(stashRef) {
    const stash = this.getByRef(stashRef);
    if (!stash) return null;
    const drawers = this.listDrawers(stashRef);
    const items = this.listItems(stashRef);
    const drawerNameById = new Map(drawers.map((d) => [d.id, d.name]));
    const itemsWithDrawer = items.map((it) => ({
      ...it,
      drawer: it.drawerId === null ? null : drawerNameById.get(it.drawerId) ?? null,
    }));
    return { stash, drawers, items: itemsWithDrawer };
  },
};

// Test seam.
export const _internals = { generateRef, ITEM_TYPES, SIZE_CAPS, SCRIPT_LANGUAGES };
