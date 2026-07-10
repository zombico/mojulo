/**
 * ops_tags repository — a resource-grouping primitive.
 *
 * An ops tag is a tag_ref + a title + a descriptor + a set of bound members.
 * It began as the "operations mode" (Ring 11) domain-scoped deliberation
 * surface; that surface (the enter/forge/bind/get/list/revise MCP tools and
 * the /operations dashboard) was DEPRECATED as unused — nothing consumed the
 * descriptor/thesis semantics.
 *
 * This repository is retained as the grouping store for the MOTION subsystem:
 * forge_motion / stitch_motion (control/lib/mcp/tools/motion.js) forge one tag
 * per "Motion Project" and bind the subject stash + rendered motion outcome as
 * members; the /motion gallery groups by them via listTagsForMember. The
 * member_kind gate still accepts the original committed-reality kinds plus
 * 'motion', but in practice only 'motion' / 'stash' are written.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';

const VALID_MEMBER_KINDS = new Set([
  'bot',
  'app',
  'mcp_orbit',
  'cook',
  'catalyst',
  'trigger',
  'stash',
  // A rendered motion artifact (forge_motion) — a moving outcome, sibling to a
  // cook outcome. Bound into a tag so a "Motion Project" groups its subject
  // stash + its rendered shots under one descriptor. member_ref is the mo_<…>
  // ref whose outcome folder serves motion.gif / motion.svg.
  'motion',
]);

const VALID_STATUSES = new Set(['active', 'archived']);

function generateRef() {
  return `ops_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function rowToTag(row) {
  if (!row) return null;
  return {
    id: row.id,
    tagRef: row.tag_ref,
    title: row.title,
    descriptorMd: row.descriptor_md,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    tagRef: row.tag_ref,
    memberKind: row.member_kind,
    memberRef: row.member_ref,
    boundAt: row.bound_at,
  };
}

export const OpsTagRepository = {
  forge({ title, descriptorMd }) {
    if (!title || typeof title !== 'string') {
      throw new Error('title is required');
    }
    if (!descriptorMd || typeof descriptorMd !== 'string') {
      throw new Error(
        'descriptorMd is required (the thesis members are measured against)',
      );
    }
    const db = getDb();
    const tagRef = generateRef();
    const result = db
      .prepare(
        `INSERT INTO ops_tags (tag_ref, title, descriptor_md)
         VALUES (?, ?, ?)`,
      )
      .run(tagRef, title, descriptorMd);
    const row = db
      .prepare('SELECT * FROM ops_tags WHERE id = ?')
      .get(result.lastInsertRowid);
    return rowToTag(row);
  },

  getByRef(tagRef) {
    if (!tagRef || typeof tagRef !== 'string') return null;
    const db = getDb();
    const row = db.prepare('SELECT * FROM ops_tags WHERE tag_ref = ?').get(tagRef);
    return rowToTag(row);
  },

  list({ status } = {}) {
    const db = getDb();
    const clauses = [];
    const params = [];
    if (status) {
      if (!VALID_STATUSES.has(status)) {
        throw new Error(
          `status must be one of: ${[...VALID_STATUSES].join(', ')} (got '${status}')`,
        );
      }
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT * FROM ops_tags ${where} ORDER BY updated_at DESC, id DESC`,
      )
      .all(...params);
    return rows.map(rowToTag);
  },

  revise(tagRef, { title, descriptorMd, status } = {}) {
    if (!tagRef || typeof tagRef !== 'string') return null;
    if (
      title === undefined &&
      descriptorMd === undefined &&
      status === undefined
    ) {
      throw new Error('revise requires at least one of: title, descriptorMd, status');
    }
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      throw new Error(
        `status must be one of: ${[...VALID_STATUSES].join(', ')} (got '${status}')`,
      );
    }
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM ops_tags WHERE tag_ref = ?')
      .get(tagRef);
    if (!existing) return null;
    db.prepare(
      `UPDATE ops_tags
         SET title = ?, descriptor_md = ?, status = ?, updated_at = unixepoch()
       WHERE tag_ref = ?`,
    ).run(
      title !== undefined ? title : existing.title,
      descriptorMd !== undefined ? descriptorMd : existing.descriptor_md,
      status !== undefined ? status : existing.status,
      tagRef,
    );
    return rowToTag(
      db.prepare('SELECT * FROM ops_tags WHERE tag_ref = ?').get(tagRef),
    );
  },

  bind({ tagRef, memberKind, memberRef }) {
    if (!tagRef || typeof tagRef !== 'string') {
      throw new Error('tagRef is required');
    }
    if (!memberKind || !VALID_MEMBER_KINDS.has(memberKind)) {
      throw new Error(
        `memberKind must be one of: ${[...VALID_MEMBER_KINDS].join(', ')} (got '${memberKind}')`,
      );
    }
    if (!memberRef || typeof memberRef !== 'string') {
      throw new Error('memberRef is required');
    }
    const db = getDb();
    const tag = db.prepare('SELECT id FROM ops_tags WHERE tag_ref = ?').get(tagRef);
    if (!tag) throw new Error(`Ops tag '${tagRef}' not found`);
    // INSERT OR IGNORE so a re-bind is a no-op rather than an error.
    db.prepare(
      `INSERT OR IGNORE INTO ops_tag_members (tag_ref, member_kind, member_ref)
       VALUES (?, ?, ?)`,
    ).run(tagRef, memberKind, memberRef);
    // Touch updated_at on the tag so the inbox surfaces recent activity.
    db.prepare(
      'UPDATE ops_tags SET updated_at = unixepoch() WHERE tag_ref = ?',
    ).run(tagRef);
    const row = db
      .prepare(
        `SELECT * FROM ops_tag_members
         WHERE tag_ref = ? AND member_kind = ? AND member_ref = ?`,
      )
      .get(tagRef, memberKind, memberRef);
    return rowToMember(row);
  },

  unbind({ tagRef, memberKind, memberRef }) {
    if (!tagRef || !memberKind || !memberRef) {
      throw new Error('tagRef, memberKind, and memberRef are all required');
    }
    const db = getDb();
    const result = db
      .prepare(
        `DELETE FROM ops_tag_members
         WHERE tag_ref = ? AND member_kind = ? AND member_ref = ?`,
      )
      .run(tagRef, memberKind, memberRef);
    if (result.changes > 0) {
      db.prepare(
        'UPDATE ops_tags SET updated_at = unixepoch() WHERE tag_ref = ?',
      ).run(tagRef);
    }
    return result.changes > 0;
  },

  listMembers(tagRef, { memberKind } = {}) {
    if (!tagRef) return [];
    const db = getDb();
    const clauses = ['tag_ref = ?'];
    const params = [tagRef];
    if (memberKind) {
      if (!VALID_MEMBER_KINDS.has(memberKind)) {
        throw new Error(
          `memberKind must be one of: ${[...VALID_MEMBER_KINDS].join(', ')} (got '${memberKind}')`,
        );
      }
      clauses.push('member_kind = ?');
      params.push(memberKind);
    }
    const where = `WHERE ${clauses.join(' AND ')}`;
    const rows = db
      .prepare(
        `SELECT * FROM ops_tag_members ${where} ORDER BY bound_at DESC, id DESC`,
      )
      .all(...params);
    return rows.map(rowToMember);
  },

  /**
   * Reverse lookup: which tags own this resource? Surfaces the "shared
   * membership" signal flagged in operations-view.md ("a resource in 5+
   * buckets is a clue the buckets are tracking facets, not domains").
   */
  listTagsForMember({ memberKind, memberRef }) {
    if (!memberKind || !memberRef) return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT t.* FROM ops_tags t
         JOIN ops_tag_members m ON m.tag_ref = t.tag_ref
         WHERE m.member_kind = ? AND m.member_ref = ?
         ORDER BY t.updated_at DESC, t.id DESC`,
      )
      .all(memberKind, memberRef);
    return rows.map(rowToTag);
  },

  memberCounts(tagRef) {
    if (!tagRef) return {};
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT member_kind, COUNT(*) AS n FROM ops_tag_members
         WHERE tag_ref = ? GROUP BY member_kind`,
      )
      .all(tagRef);
    const out = {};
    for (const row of rows) out[row.member_kind] = row.n;
    return out;
  },
};

// Test seam.
export const _internals = { generateRef, VALID_MEMBER_KINDS, VALID_STATUSES };
