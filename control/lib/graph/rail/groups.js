// The dashboard's project shelves: which rail recipes are projects of their own, by what they are. A world is a game
// designed top down; a place is a city or a building. What a project made for itself (a city's segment levels, the
// insides of its doors) is a part of that project and is shown on its page, not on the shelf. Pure.
import { STRUCTURE_KINDS } from '../structure/programs.js';

export const PROJECT_GROUPS = Object.freeze({
  worlds: Object.freeze(['gameworld']),
  places: Object.freeze(['city', ...STRUCTURE_KINDS]),
});
export const PROJECT_KINDS = Object.freeze([...new Set(Object.values(PROJECT_GROUPS).flat())]);

/** Is this row a part another project made (a city's segment level, a door's inside), rather than a project? */
export function isPart(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (manifest.kind === 'city' && typeof manifest.city === 'string') return true;
  return STRUCTURE_KINDS.includes(manifest.kind) && manifest.level?.door === 'out';
}

/** The group a project sits in, or null. */
export function groupOf(manifest) {
  for (const [g, kinds] of Object.entries(PROJECT_GROUPS)) if (kinds.includes(manifest?.kind)) return g;
  return null;
}

/** The projects among rows ({ ref, title, manifest, updatedAt }), as the shelf lists them. `group` null: every group. */
export function projectsOf(rows, { group = null, limit = 48 } = {}) {
  const kinds = group ? PROJECT_GROUPS[group] ?? [] : PROJECT_KINDS;
  return rows
    .filter((r) => kinds.includes(r.manifest?.kind) && !isPart(r.manifest))
    .slice(0, limit)
    .map((r) => ({ ref: r.ref, title: r.title || r.ref, kind: r.manifest.kind, group: groupOf(r.manifest), updatedAt: r.updatedAt ?? null }));
}
