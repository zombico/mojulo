/**
 * meta_skills repository — read-only mirror of the host adapter's skills.
 *
 * A Skill is a Connected Service whose lifecycle lives on the host (the
 * synthesized .claude/skills/<name>/SKILL.md), not in mojulo. The host is
 * the source of truth; this table is a reflection the agent declares via
 * `declare_skills`.
 *
 * REPLACE semantics, exactly like meta_mcp_inventory: the latest declaration
 * is authoritative and wholly replaces the prior mirror in one transaction.
 * There is intentionally no addSkill / removeSkill — the point of the
 * primitive is that the host's current skill set is what's true, and mojulo
 * can't introspect the host, so the declaring agent is the trust anchor.
 *
 * SYNCHRONOUS, matching meta-context.js / mcp-inventory.js — better-sqlite3
 * requires transaction fns to be sync.
 *
 * See lite-template/integration/app-system/0527/CONNECTED_SERVICES_CANONIZATION_PLAN.md.
 */

import { createHash } from 'node:crypto';

import { getDb } from '../index.js';

// ref is deterministic from host_path so re-mirroring the same skill keeps a
// stable identity (viewer node identity / future links don't churn across
// declarations). A skill dir rename produces a new ref + drops the old row
// under replace — acceptable v1 trade-off (see plan open question on ref
// stability).
function refForHostPath(hostPath) {
  const digest = createHash('sha256').update(hostPath).digest('hex').slice(0, 12);
  return `skill_${digest}`;
}

function rowToSkill(row) {
  if (!row) return null;
  return {
    ref: row.ref,
    name: row.name,
    description: row.description,
    hostPath: row.host_path,
    hostAdapter: row.host_adapter || null,
    catalystId: row.catalyst_id || null,
    calls: row.calls_json ? JSON.parse(row.calls_json) : [],
    needs: row.needs_json ? JSON.parse(row.needs_json) : [],
    mirroredAt: row.mirrored_at,
  };
}

function validateSkills(skills) {
  if (!Array.isArray(skills)) {
    throw new Error('declare(skills) requires an array (use [] to wipe the mirror)');
  }
  const seenPaths = new Set();
  for (const s of skills) {
    if (!s || typeof s !== 'object') {
      throw new Error('every skill entry must be an object');
    }
    if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
      throw new Error('skill.name must be a non-empty string');
    }
    if (!s.hostPath || typeof s.hostPath !== 'string' || !s.hostPath.trim()) {
      throw new Error(`skill '${s.name}' requires a non-empty hostPath`);
    }
    const hostPath = s.hostPath.trim();
    if (seenPaths.has(hostPath)) {
      throw new Error(`duplicate skill hostPath '${hostPath}' — each skill must have a distinct path`);
    }
    seenPaths.add(hostPath);
    if (s.description !== undefined && s.description !== null && typeof s.description !== 'string') {
      throw new Error(`skill '${s.name}' description must be a string when provided`);
    }
    if (s.hostAdapter !== undefined && s.hostAdapter !== null && typeof s.hostAdapter !== 'string') {
      throw new Error(`skill '${s.name}' hostAdapter must be a string when provided`);
    }
    if (s.catalystId !== undefined && s.catalystId !== null && typeof s.catalystId !== 'string') {
      throw new Error(`skill '${s.name}' catalystId must be a string when provided`);
    }
    if (s.calls !== undefined && s.calls !== null) {
      if (!Array.isArray(s.calls)) {
        throw new Error(`skill '${s.name}' calls must be an array when provided`);
      }
      for (const c of s.calls) {
        if (!c || typeof c !== 'object' || !c.server || typeof c.server !== 'string') {
          throw new Error(`skill '${s.name}' every calls[] entry needs a non-empty server string`);
        }
        if (c.tools !== undefined && c.tools !== null) {
          if (!Array.isArray(c.tools) || c.tools.some((t) => typeof t !== 'string')) {
            throw new Error(`skill '${s.name}' calls[].tools must be an array of strings when provided`);
          }
        }
      }
    }
    if (s.needs !== undefined && s.needs !== null) {
      if (!Array.isArray(s.needs)) {
        throw new Error(`skill '${s.name}' needs must be an array when provided`);
      }
      for (const n of s.needs) {
        if (!n || typeof n !== 'object' || !n.capability || typeof n.capability !== 'string') {
          throw new Error(`skill '${s.name}' every needs[] entry needs a non-empty capability string`);
        }
        if (n.label !== undefined && n.label !== null && typeof n.label !== 'string') {
          throw new Error(`skill '${s.name}' needs[].label must be a string when provided`);
        }
      }
    }
  }
}

function normalizeCalls(calls) {
  if (!Array.isArray(calls)) return [];
  return calls.map((c) => {
    const out = { server: c.server.trim() };
    if (Array.isArray(c.tools)) out.tools = c.tools.map((t) => t.trim());
    return out;
  });
}

function normalizeNeeds(needs) {
  if (!Array.isArray(needs)) return [];
  return needs.map((n) => {
    const out = { capability: n.capability.trim() };
    if (n.label) out.label = n.label.trim();
    return out;
  });
}

export const SkillsRepository = {
  /**
   * Atomic replace. DELETE the whole mirror, INSERT the declared snapshot, in
   * one transaction. The only write path — the latest declaration is the
   * mirror. Pass `skills: [{ name, hostPath, description?, hostAdapter?,
   * catalystId?, calls?: [{ server, tools? }], needs?: [{ capability, label }] }]`.
   * Returns `{ replaced, inserted, mirroredAt }`.
   */
  declare(skills) {
    validateSkills(skills);
    const db = getDb();
    const mirroredAt = Math.floor(Date.now() / 1000);

    const run = db.transaction(() => {
      const before = db.prepare('SELECT COUNT(*) AS n FROM meta_skills').get().n;
      db.prepare('DELETE FROM meta_skills').run();
      const insert = db.prepare(
        `INSERT INTO meta_skills
           (ref, name, description, host_path, host_adapter, catalyst_id, calls_json, needs_json, mirrored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      let inserted = 0;
      for (const s of skills) {
        const hostPath = s.hostPath.trim();
        insert.run(
          refForHostPath(hostPath),
          s.name.trim(),
          s.description ?? null,
          hostPath,
          s.hostAdapter ?? null,
          s.catalystId ?? null,
          JSON.stringify(normalizeCalls(s.calls)),
          JSON.stringify(normalizeNeeds(s.needs)),
          mirroredAt,
        );
        inserted += 1;
      }
      return { replaced: before, inserted };
    });

    const { replaced, inserted } = run();
    return { replaced, inserted, mirroredAt };
  },

  /** All current mirror rows, newest declaration first. */
  list() {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM meta_skills ORDER BY mirrored_at DESC, name ASC')
      .all();
    return rows.map(rowToSkill);
  },

  /** Single-row lookup by ref. */
  getByRef(ref) {
    if (!ref || typeof ref !== 'string') return null;
    const db = getDb();
    const row = db.prepare('SELECT * FROM meta_skills WHERE ref = ?').get(ref);
    return rowToSkill(row);
  },

  /** True iff at least one skill has ever been mirrored. */
  hasSkills() {
    const db = getDb();
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM meta_skills').get();
    return n > 0;
  },
};

// Test seam.
export const _internals = { refForHostPath };
