/**
 * mcp_orbit_trigger_artifacts repository.
 *
 * Persisted declarations of bound activation triggers. Sibling to
 * mcp_orbit_provider_artifacts in shape — each row carries a composer
 * component_ref (e.g. 'trigger/scheduled@0.1.0') that resolves against the
 * loaded composer components at bind time + runtime, so the contextmap's
 * audit chain records *which* component each materialization referenced.
 *
 * Composer-anchored runtime is the load-bearing posture: adding a new
 * trigger kind = ship a typed component in mcp-orbit-components/trigger/,
 * not a string in a tool-internal enum. See
 * lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md.
 *
 * Phase 1 supports the schedule kind only (trigger/scheduled@0.1.0).
 * Webhook (Phase 2) and watch (Phase 3) reuse this table without schema
 * changes — they ship as new typed components, and bind_trigger resolves
 * them via the same path.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';

function rowToTrigger(row) {
  if (!row) return null;
  return {
    id: row.id,
    triggerRef: row.trigger_ref,
    componentRef: row.component_ref,
    bindingParams: JSON.parse(row.binding_params_json),
    payloadTemplate: JSON.parse(row.payload_template_json),
    compositionRef: row.composition_ref,
    artifactRef: row.artifact_ref,
    enabled: row.enabled === 1,
    supersededBy: row.superseded_by,
    createdAt: row.created_at,
  };
}

function generateRef() {
  // Short stable ref: `trig_<12-hex-chars>`. Mirrors the provider-artifact
  // shape so trigger refs are visually distinguishable from `prov_` refs at
  // a glance.
  return `trig_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export const TriggerArtifactRepository = {
  /**
   * Insert a new trigger artifact. Returns the inserted row with its
   * generated trigger_ref. The unique partial index on
   * (composition_ref, artifact_ref, component_ref) where superseded_by IS
   * NULL AND enabled = 1 enforces "no two active bindings against the same
   * target tuple" — the SQLite constraint surfaces a typed error the caller
   * can map to a clear agent-facing message.
   */
  insert({ componentRef, bindingParams, payloadTemplate, compositionRef, artifactRef }) {
    if (!componentRef || typeof componentRef !== 'string') {
      throw new Error('componentRef is required (e.g. "trigger/scheduled@0.1.0")');
    }
    if (!bindingParams || typeof bindingParams !== 'object' || Array.isArray(bindingParams)) {
      throw new Error('bindingParams must be an object');
    }
    if (
      !payloadTemplate ||
      typeof payloadTemplate !== 'object' ||
      Array.isArray(payloadTemplate)
    ) {
      throw new Error('payloadTemplate must be an object');
    }
    if (
      compositionRef !== undefined &&
      compositionRef !== null &&
      typeof compositionRef !== 'string'
    ) {
      throw new Error('compositionRef must be a string when provided');
    }
    if (
      artifactRef !== undefined &&
      artifactRef !== null &&
      typeof artifactRef !== 'string'
    ) {
      throw new Error('artifactRef must be a string when provided');
    }
    const db = getDb();
    const triggerRef = generateRef();
    const result = db
      .prepare(
        `INSERT INTO mcp_orbit_trigger_artifacts
           (trigger_ref, component_ref, binding_params_json, payload_template_json, composition_ref, artifact_ref)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        triggerRef,
        componentRef,
        JSON.stringify(bindingParams),
        JSON.stringify(payloadTemplate),
        compositionRef ?? null,
        artifactRef ?? null,
      );
    const row = db
      .prepare('SELECT * FROM mcp_orbit_trigger_artifacts WHERE id = ?')
      .get(result.lastInsertRowid);
    return rowToTrigger(row);
  },

  getByRef(triggerRef) {
    if (!triggerRef || typeof triggerRef !== 'string') return null;
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM mcp_orbit_trigger_artifacts WHERE trigger_ref = ?')
      .get(triggerRef);
    return rowToTrigger(row);
  },

  /**
   * Active triggers (enabled = 1, superseded_by IS NULL). The scheduler
   * daemon reads this on boot and on reload to know which triggers to
   * register. Filters narrow the result; absent filters return all active.
   */
  listActive({ componentRef, compositionRef, artifactRef } = {}) {
    const db = getDb();
    const clauses = ['enabled = 1', 'superseded_by IS NULL'];
    const params = [];
    if (componentRef) {
      clauses.push('component_ref = ?');
      params.push(componentRef);
    }
    if (compositionRef) {
      clauses.push('composition_ref = ?');
      params.push(compositionRef);
    }
    if (artifactRef) {
      clauses.push('artifact_ref = ?');
      params.push(artifactRef);
    }
    const rows = db
      .prepare(
        `SELECT * FROM mcp_orbit_trigger_artifacts
         WHERE ${clauses.join(' AND ')}
         ORDER BY created_at ASC, id ASC`,
      )
      .all(...params);
    return rows.map(rowToTrigger);
  },

  /**
   * Mark a trigger as disabled. Soft-delete: the row stays for audit; the
   * daemon skips disabled rows on its next reload. Used by `unbind_trigger`.
   * Returns true if a row was actually updated (false = no such trigger or
   * already disabled).
   */
  disable(triggerRef) {
    if (!triggerRef || typeof triggerRef !== 'string') return false;
    const db = getDb();
    const result = db
      .prepare(
        `UPDATE mcp_orbit_trigger_artifacts
         SET enabled = 0
         WHERE trigger_ref = ? AND enabled = 1`,
      )
      .run(triggerRef);
    return result.changes > 0;
  },
};

// Test seam.
export const _internals = { generateRef };
