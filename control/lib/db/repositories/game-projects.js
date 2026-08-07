/**
 * Game-project repositories (GP0, game-developer.plan.md) — the project layer
 * over the game composer substrate.
 *
 * A project is a GROUPING object (like stashes / orbit compositions), not a
 * recipe: it gets its own tables, never a sketches row. Membership is by
 * typed ref with a role; member_ref is navigational (dangling tolerated — a
 * deleted artifact reads "missing" in the studio, it never breaks the
 * project). Doctrine: store only what isn't derivable — a bound game
 * manifest's own levels/music are IMPLIED members, derived at read time by
 * the tool layer, never rows here. Writes are MCP-only; the studio renders
 * and copies prompts.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../index.js';
import { EmbeddingsRepository } from './embeddings.js';

export const GAME_PROJECT_STATUSES = ['active', 'shipped', 'archived'];

// Repo-gated (a one-line change to extend — never a schema migration).
// member_kind names the namespace member_ref resolves in.
export const MEMBER_KINDS = ['sketch', 'motion', 'cook', 'stash'];

// The game-facing semantic of a member. `audio` is ONE role on purpose —
// soundtrack-vs-SFX is derived at read time from the member's own beats kind
// (a manifest fact, never duplicated here). `rules` is the deliverable game
// artifact; the ACTIVE rules member is the newest-bound one (prior rules
// members are history, kept not deleted).
export const MEMBER_ROLES = [
  'rules',
  'level',
  'character',
  'audio',
  'graphic',
  'animation',
  'reference',
];

function generateRef() {
  return `gp_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function parseJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function rowToProject(row) {
  if (!row) return null;
  return {
    ref: row.ref,
    title: row.title,
    charter: row.charter_md ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    memberKind: row.member_kind,
    memberRef: row.member_ref,
    role: row.role,
    label: row.label ?? null,
    meta: parseJSON(row.meta_json, {}),
    createdAt: row.created_at,
  };
}

function assertStatus(status) {
  if (!GAME_PROJECT_STATUSES.includes(status)) {
    throw new Error(
      `status '${status}' is not valid. Allowed: ${GAME_PROJECT_STATUSES.join(', ')}.`,
    );
  }
}

function requireProject(db, ref) {
  const row = db.prepare('SELECT id, ref FROM game_projects WHERE ref = ?').get(ref);
  if (!row) throw new Error(`Game project '${ref}' not found`);
  return row;
}

export const GameProjectRepository = {
  /** Mint a project. Returns the created project (gp_ ref). */
  create({ title, charter, status = 'active' } = {}) {
    if (!title || typeof title !== 'string') {
      throw new Error('title is required (string) — the project\'s working name');
    }
    if (charter !== undefined && charter !== null && typeof charter !== 'string') {
      throw new Error('charter must be a markdown string (the pitch: premise, register, scope)');
    }
    assertStatus(status);
    const db = getDb();
    const ref = generateRef();
    db.prepare(
      `INSERT INTO game_projects (ref, title, charter_md, status) VALUES (?, ?, ?, ?)`,
    ).run(ref, title, charter ?? null, status);
    return this.getByRef(ref);
  },

  /**
   * Create + mirror the charter into the semantic index inside one txn
   * (orbit's insertWithEmbedding posture). Embed failures are SOFT — the
   * project row always lands; a missing vector just means no recall row.
   */
  async createWithEmbedding(params) {
    const charter = params?.charter;
    if (
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1' ||
      typeof charter !== 'string' ||
      charter.length === 0
    ) {
      return this.create(params);
    }
    // No fixed ref pre-insert — compute the embedding once, upsert with the
    // post-insert ref inside the txn.
    const embedded = await EmbeddingsRepository.embed('game_project', '__pending__', charter, {
      skipUnchanged: false,
    });
    const db = getDb();
    let project;
    db.transaction(() => {
      project = this.create(params);
      EmbeddingsRepository.upsertSync({
        sourceKind: 'game_project',
        sourceRef: project.ref,
        bodyText: charter,
        hash: embedded.hash,
        vector: embedded.vector,
      });
    })();
    return project;
  },

  getByRef(ref) {
    const db = getDb();
    return rowToProject(db.prepare('SELECT * FROM game_projects WHERE ref = ?').get(ref));
  },

  /**
   * Update mutable fields (title / charter / status). Returns the updated
   * project, or throws if the ref is unknown. Charter re-embedding is the
   * async wrapper's concern (updateWithEmbedding).
   */
  update({ ref, title, charter, status } = {}) {
    const db = getDb();
    requireProject(db, ref);
    const sets = [];
    const params = [];
    if (title !== undefined) {
      if (!title || typeof title !== 'string') throw new Error('title must be a non-empty string');
      sets.push('title = ?');
      params.push(title);
    }
    if (charter !== undefined) {
      if (charter !== null && typeof charter !== 'string') {
        throw new Error('charter must be a markdown string (or null to clear)');
      }
      sets.push('charter_md = ?');
      params.push(charter);
    }
    if (status !== undefined) {
      assertStatus(status);
      sets.push('status = ?');
      params.push(status);
    }
    if (sets.length) {
      sets.push('updated_at = unixepoch()');
      db.prepare(`UPDATE game_projects SET ${sets.join(', ')} WHERE ref = ?`).run(...params, ref);
    }
    return this.getByRef(ref);
  },

  /** update + re-mirror a changed charter into the semantic index (soft). */
  async updateWithEmbedding(params) {
    const project = this.update(params);
    const charter = params?.charter;
    if (
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED !== '1' &&
      typeof charter === 'string' &&
      charter.length > 0
    ) {
      const embedded = await EmbeddingsRepository.embed('game_project', project.ref, charter);
      EmbeddingsRepository.upsertSync({
        sourceKind: 'game_project',
        sourceRef: project.ref,
        bodyText: charter,
        hash: embedded.hash,
        vector: embedded.vector,
      });
    }
    return project;
  },

  /**
   * Index rows for the gallery/list tool: projects (optionally filtered by
   * status) with per-role member counts, newest-updated first.
   */
  list({ status } = {}) {
    if (status !== undefined) assertStatus(status);
    const db = getDb();
    const projects = (
      status
        ? db.prepare('SELECT * FROM game_projects WHERE status = ? ORDER BY updated_at DESC, id DESC').all(status)
        : db.prepare('SELECT * FROM game_projects ORDER BY updated_at DESC, id DESC').all()
    ).map(rowToProject);
    if (!projects.length) return [];
    const counts = db
      .prepare(
        `SELECT p.ref AS ref, m.role AS role, COUNT(*) AS n
           FROM game_project_members m JOIN game_projects p ON p.id = m.project_id
          GROUP BY p.ref, m.role`,
      )
      .all();
    const byRef = new Map(projects.map((p) => [p.ref, p]));
    for (const p of projects) p.memberCounts = {};
    for (const c of counts) {
      const p = byRef.get(c.ref);
      if (p) p.memberCounts[c.role] = c.n;
    }
    return projects;
  },
};

export const GameProjectMemberRepository = {
  /**
   * Bind one member edge. Idempotent on (project, kind, ref, role) — a
   * re-bind updates label/meta instead of duplicating. Dangling member_ref is
   * fine by design (navigational). Returns the member row.
   */
  bind({ projectRef, memberRef, role, memberKind = 'sketch', label, meta } = {}) {
    if (!MEMBER_KINDS.includes(memberKind)) {
      throw new Error(`member_kind '${memberKind}' is not valid. Allowed: ${MEMBER_KINDS.join(', ')}.`);
    }
    if (!MEMBER_ROLES.includes(role)) {
      throw new Error(`role '${role}' is not valid. Allowed: ${MEMBER_ROLES.join(', ')}.`);
    }
    if (!memberRef || typeof memberRef !== 'string') {
      throw new Error('member_ref is required (the target artifact ref)');
    }
    if (label !== undefined && label !== null && typeof label !== 'string') {
      throw new Error('label must be a string (an operator-facing slot name, e.g. "hero")');
    }
    if (meta !== undefined && meta !== null && (typeof meta !== 'object' || Array.isArray(meta))) {
      throw new Error('meta must be a plain object (small, role-specific — e.g. { slice: "party" })');
    }
    const db = getDb();
    const project = requireProject(db, projectRef);
    db.prepare(
      `INSERT INTO game_project_members (project_id, member_kind, member_ref, role, label, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, member_kind, member_ref, role)
       DO UPDATE SET label = excluded.label, meta_json = excluded.meta_json`,
    ).run(project.id, memberKind, memberRef, role, label ?? null, JSON.stringify(meta ?? {}));
    db.prepare('UPDATE game_projects SET updated_at = unixepoch() WHERE id = ?').run(project.id);
    const row = db
      .prepare(
        `SELECT * FROM game_project_members
          WHERE project_id = ? AND member_kind = ? AND member_ref = ? AND role = ?`,
      )
      .get(project.id, memberKind, memberRef, role);
    return rowToMember(row);
  },

  /** Remove one member edge. Returns true if a row was deleted. */
  unbind({ projectRef, memberRef, role, memberKind = 'sketch' } = {}) {
    if (!MEMBER_KINDS.includes(memberKind)) {
      throw new Error(`member_kind '${memberKind}' is not valid. Allowed: ${MEMBER_KINDS.join(', ')}.`);
    }
    if (!MEMBER_ROLES.includes(role)) {
      throw new Error(`role '${role}' is not valid. Allowed: ${MEMBER_ROLES.join(', ')}.`);
    }
    const db = getDb();
    const project = db.prepare('SELECT id FROM game_projects WHERE ref = ?').get(projectRef);
    if (!project) return false;
    const result = db
      .prepare(
        `DELETE FROM game_project_members
          WHERE project_id = ? AND member_kind = ? AND member_ref = ? AND role = ?`,
      )
      .run(project.id, memberKind, memberRef, role);
    if (result.changes > 0) {
      db.prepare('UPDATE game_projects SET updated_at = unixepoch() WHERE id = ?').run(project.id);
    }
    return result.changes > 0;
  },

  /** All members of a project, newest-first (the tool layer groups by role). */
  listByProject(projectRef) {
    const db = getDb();
    const project = db.prepare('SELECT id FROM game_projects WHERE ref = ?').get(projectRef);
    if (!project) return [];
    return db
      .prepare('SELECT * FROM game_project_members WHERE project_id = ? ORDER BY id DESC')
      .all(project.id)
      .map(rowToMember);
  },

  /**
   * Reverse lookup: which projects claim this artifact, and as what. Powers
   * the "part of <project>" chip on /sketches/<ref>.
   */
  listByMember({ memberKind = 'sketch', memberRef } = {}) {
    if (!MEMBER_KINDS.includes(memberKind)) {
      throw new Error(`member_kind '${memberKind}' is not valid. Allowed: ${MEMBER_KINDS.join(', ')}.`);
    }
    if (!memberRef || typeof memberRef !== 'string') {
      throw new Error('member_ref is required');
    }
    const db = getDb();
    return db
      .prepare(
        `SELECT m.role, m.label, p.ref AS project_ref, p.title, p.status
           FROM game_project_members m JOIN game_projects p ON p.id = m.project_id
          WHERE m.member_kind = ? AND m.member_ref = ?
          ORDER BY m.id DESC`,
      )
      .all(memberKind, memberRef)
      .map((row) => ({
        projectRef: row.project_ref,
        title: row.title,
        status: row.status,
        role: row.role,
        label: row.label ?? null,
      }));
  },

  /** The ACTIVE rules member — newest-bound wins; prior ones are history. */
  rulesMember(projectRef) {
    const db = getDb();
    const project = db.prepare('SELECT id FROM game_projects WHERE ref = ?').get(projectRef);
    if (!project) return null;
    const row = db
      .prepare(
        `SELECT * FROM game_project_members
          WHERE project_id = ? AND role = 'rules' ORDER BY id DESC LIMIT 1`,
      )
      .get(project.id);
    return rowToMember(row);
  },
};
