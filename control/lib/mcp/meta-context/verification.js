/**
 * Adapter-delegated verification for `meta_context_commit({ type:
 * 'artifact_materialization' })`.
 *
 * The v2 design assumed every artifact was a file on disk, so verification was
 * just existsSync(skill_path). v3 had to absorb adapters whose artifacts may
 * be opaque automation handles (Codex automations) with no local path the
 * control plane can stat. This module routes verification through the bound
 * adapter:
 *
 *   - claude-code → existsSync(locator) — SKILL.md on disk
 *   - generic     → existsSync(locator) — workflow.md on disk
 *   - codex       → if locator looks like a filesystem path AND exists, ok;
 *                   otherwise accept-on-assertion (MVP relaxation, see v3 doc)
 *
 * Unknown adapter ids are rejected — the adapter loader is the source of
 * truth, and we never want to seal an artifact node whose host context we
 * can't even name.
 *
 * If/when post-MVP arbiter work adds a "verify" tool the adapter wires to its
 * host (e.g. Codex's automation_list), the codex branch graduates from
 * accept-on-assertion to a real round-trip. Until then, the agent that just
 * wrote the artifact IS the trust anchor.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { getAdapter } from '@/lib/mcp/adapters/loader';

function looksLikeFilesystemLocator(locator) {
  if (typeof locator !== 'string' || locator.length === 0) return false;
  // Absolute paths (POSIX or Windows-style) and relative paths beginning with
  // ./ or ../ are filesystem-shaped. A bare slug like "my-automation-handle"
  // is not — that's an opaque handle and gets accept-on-assertion on codex.
  if (isAbsolute(locator)) return true;
  if (locator.startsWith('./') || locator.startsWith('../')) return true;
  return false;
}

/**
 * Verify an artifact locator under a given adapter.
 *
 * Returns:
 *   - { ok: true }                         — artifact exists or accepted on assertion
 *   - { ok: true, note: '…' }              — accepted on assertion (with explanation)
 *   - { ok: false, reason: '…' }           — rejected; commit should not write
 */
export function verifyArtifact(adapterId, locator) {
  if (!adapterId || typeof adapterId !== 'string') {
    return { ok: false, reason: 'adapter_id is required' };
  }
  if (!locator || typeof locator !== 'string') {
    return { ok: false, reason: 'artifact.locator is required' };
  }
  const adapter = getAdapter(adapterId);
  if (!adapter) {
    return { ok: false, reason: `unknown adapter '${adapterId}'` };
  }

  switch (adapterId) {
    case 'claude-code':
    case 'generic':
      if (existsSync(locator)) return { ok: true };
      return {
        ok: false,
        reason: `${adapter.name} expects a filesystem path; nothing exists at '${locator}'`,
      };

    case 'codex':
      if (looksLikeFilesystemLocator(locator)) {
        if (existsSync(locator)) return { ok: true };
        return {
          ok: false,
          reason: `Codex workspace path '${locator}' does not exist`,
        };
      }
      // Opaque handle (automation id, etc.) — control plane has no way to
      // round-trip to Codex from here. Accept on the agent's assertion that
      // the artifact was just materialized; surface a note so consumers can
      // tell verification was relaxed.
      return {
        ok: true,
        note: 'codex_accept_on_assertion',
      };

    default:
      // Adapter exists in the catalog but we have no verification rule for
      // it yet. Safer to reject than to silently accept — forces an explicit
      // verifier addition when new adapters ship.
      return {
        ok: false,
        reason: `no verification rule registered for adapter '${adapterId}'`,
      };
  }
}

/**
 * App-paradigm spike verification — verifies the artifact locator the same
 * way `verifyArtifact` does, then additionally requires the scaffolded
 * `app-mcp/server.js` to exist inside the artifact directory.
 *
 * App materialization commits without a sidecar would leave the runner
 * unable to do its job (no MCP to lifecycle), and the Apps-pane App-MCP
 * panel would render an unloadable artifact. Refusing to commit is the
 * correct posture — the agent gets a clear diagnostic at deliberation
 * time rather than a runtime mystery later.
 *
 * The codex `accept-on-assertion` path stays open here too: opaque
 * automation handles don't have a filesystem to check, so the relaxation
 * carries through. claude-code/generic require both files to exist.
 *
 * See lite-template/integration/app-system/APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.
 */
export function verifyAppArtifact(adapterId, locator) {
  // Base verification handles adapter id validity, missing-locator,
  // codex-handle relaxation, and unknown-adapter rejection.
  const base = verifyArtifact(adapterId, locator);
  if (!base.ok) return base;

  // Codex with an opaque handle: already accepted on assertion; the sidecar
  // check would require a filesystem path we don't have. Carry the note
  // through so consumers can see the relaxation was applied.
  if (base.note === 'codex_accept_on_assertion') return base;

  // claude-code / generic / codex-with-filesystem-locator: require the
  // scaffolded sidecar at the conventional path. The runner's start_app
  // expects this entrypoint; if it's missing, materialization is incoherent.
  const sidecarPath = join(locator, 'app-mcp', 'server.js');
  if (existsSync(sidecarPath)) return { ok: true };
  return {
    ok: false,
    reason: `app-mcp scaffold missing — expected '${sidecarPath}' to exist. Run the scaffold copy helper before committing.`,
  };
}

// Test seam — exposed so tests can assert the locator heuristic in isolation
// without round-tripping through verifyArtifact + a real adapter id.
export const _looksLikeFilesystemLocatorForTests = looksLikeFilesystemLocator;
