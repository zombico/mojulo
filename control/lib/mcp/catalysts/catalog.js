/**
 * Merged catalyst catalog (local-catalysts.plan.md, D4) — the single view the
 * MCP tools read: the memoized curated shelf (loader.js) plus a READ-THROUGH
 * query of the operator's active local shelf (no cache — the table is tens of
 * rows in a local SQLite; a dirty-flag cache is premature).
 *
 * Id policy, both directions:
 * - Mint time: `mint_catalyst` refuses ids that exist on the curated shelf
 *   (checked in the tool handler via getCatalystCatalog()).
 * - Upgrade time: a curated catalyst shipped later with an id the operator
 *   already minted ECLIPSES the local row — curated wins the bare id, the
 *   local row is kept, flagged `eclipsed: true` in list output, and excluded
 *   from get resolution until the operator re-slugs it (mint under a new id +
 *   archive the old). Never silently drop operator data; never let a local
 *   row shadow a shipped one.
 *
 * Kept separate from loader.js so the loader stays dep-free (node:fs only) —
 * this module pulls in the DB repository, and reindexAll imports it to source
 * both shelves.
 */

import { getCatalystCatalog } from './loader.js';
import { LocalCatalystRepository } from '../../db/repositories/local-catalysts.js';

/**
 * Every entry the tools can resolve by bare id: curated entries (annotated
 * `origin: 'curated'`) + active, non-eclipsed local entries. Returns a Map.
 */
export function getMergedCatalog() {
  const merged = new Map();
  for (const [id, catalyst] of getCatalystCatalog()) {
    merged.set(id, { ...catalyst, origin: 'curated' });
  }
  for (const local of LocalCatalystRepository.listActive()) {
    if (merged.has(local.id)) continue; // eclipsed — surfaced by listMergedCatalysts
    merged.set(local.id, local);
  }
  return merged;
}

/**
 * Index rows for list_catalysts: the resolvable shelf plus any eclipsed local
 * rows (flagged, so the operator learns a shipped catalyst took the id and
 * can re-slug theirs).
 */
export function listMergedCatalysts({ category, kind } = {}) {
  const curatedIds = new Set(getCatalystCatalog().keys());
  const out = [];
  const push = (catalyst, extra = {}) => {
    if (category && catalyst.category !== category) return;
    if (kind && catalyst.kind !== kind) return;
    out.push({
      id: catalyst.id,
      name: catalyst.name,
      summary: catalyst.summary,
      valueHook: catalyst.valueHook,
      kind: catalyst.kind,
      category: catalyst.category,
      requires: catalyst.requires,
      outputContract: catalyst.outputContract,
      origin: catalyst.origin || 'curated',
      ...(catalyst.origin === 'local' ? { rev: catalyst.rev } : {}),
      ...extra,
    });
  };
  for (const catalyst of getMergedCatalog().values()) push(catalyst);
  for (const local of LocalCatalystRepository.listActive()) {
    if (curatedIds.has(local.id)) {
      push(local, {
        eclipsed: true,
        note: `A curated catalyst now ships under '${local.id}'. Your local catalyst is preserved but unreachable — re-mint it under a new id (and archive this one) to keep using it.`,
      });
    }
  }
  return out;
}

/**
 * Resolve one catalyst by id — curated wins, then active local. `rev` reads a
 * historical revision (local ids only; curated history lives in git).
 * Returns null when unknown, archived, or eclipsed.
 */
export function getMergedCatalyst(id, { rev } = {}) {
  const curated = getCatalystCatalog().get(id);
  if (curated) {
    if (rev !== undefined) {
      throw new Error(`Catalyst '${id}' is curated — its history lives in git, not revisions. Omit rev.`);
    }
    const { _file, ...rest } = curated;
    return { ...rest, origin: 'curated' };
  }
  const local = LocalCatalystRepository.get(id);
  if (!local || local.status !== 'active') return null;
  if (rev === undefined) return local;
  const revision = LocalCatalystRepository.getRevision(id, rev);
  if (!revision) {
    throw new Error(`Local catalyst '${id}' has no revision ${rev}. Known revisions: ${LocalCatalystRepository.listRevisions(id).map((r) => r.rev).join(', ')}.`);
  }
  return {
    ...revision.meta,
    id,
    kind: revision.meta?.kind || local.kind,
    version: revision.rev,
    rev: revision.rev,
    headRev: local.rev,
    note: revision.note,
    status: local.status,
    origin: 'local',
    body: revision.body,
  };
}
