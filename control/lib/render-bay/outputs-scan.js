/**
 * The outputs lane's disk read — exports as they actually exist on the host.
 *
 * Unlike the queue (a table) and the bakes (a manifest field), exports have no
 * ledger: `export_model`, `export_game`, `bind_mesh_render`, `submit_image_render`
 * and the voice/skin stores all just WRITE, into `data/outcomes/<ref>/` for
 * anything bound to a sketch and `data/exports/` for beats renders. So the lane
 * reads the disk, which has the useful property that it can never disagree with
 * what the operator would find in the folder.
 *
 * Two scans, kept apart because they are two different things: an artifact folder
 * is one sketch's append-only outcome slot, while `data/exports/` is a flat pile
 * of beats WAV/MIDI named `<beats-ref>[.<cue>].<ext>`.
 *
 * Cook folders (`cook_…`) live in the same base directory but are NOT scanned
 * here — they have a real table and a real inbox, and the lane reads them through
 * CookRepository so a cook keeps its aim and its publication kind.
 *
 * Design: components/3d-factory-ui.plan.md §5.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { outcomesBaseDir, outcomeUrlFor } from '@/lib/outcomes-paths';
import { exportsBaseDir } from '@/lib/mcp/tools/exports-dir';

/** Files that are provenance rather than output — counted, never the headline. */
const SIDECAR = /^(README\.md|recipe\.json|manifest\.json|.*\.json)$/i;

async function readDirSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];   // an absent directory is an empty lane, not an error
  }
}

async function statSafe(file) {
  try {
    return await fs.stat(file);
  } catch {
    return null;
  }
}

/**
 * One row per sketch outcome folder: what is in it, how big, and when it last
 * moved. Sorted newest-first and capped, but `total` is the true count so the
 * surface can say what it is not showing rather than implying there is no more
 * (the Library's lesson, §8 phase 3).
 */
export async function scanArtifactExports({ limit = 40 } = {}) {
  const base = outcomesBaseDir();
  const entries = await readDirSafe(base);
  const rows = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('cook_') || entry.name.startsWith('.')) continue;
    const dir = path.join(base, entry.name);
    const files = [];
    let bytes = 0;
    let mtime = 0;
    for (const file of await readDirSafe(dir)) {
      if (!file.isFile()) continue;
      const stat = await statSafe(path.join(dir, file.name));
      if (!stat) continue;
      files.push({ name: file.name, bytes: stat.size, sidecar: SIDECAR.test(file.name) });
      bytes += stat.size;
      mtime = Math.max(mtime, Math.floor(stat.mtimeMs / 1000));
    }
    if (!files.length) continue;
    files.sort((a, b) => Number(a.sidecar) - Number(b.sidecar) || a.name.localeCompare(b.name));
    rows.push({ ref: entry.name, files, bytes, mtime, url: outcomeUrlFor(entry.name) });
  }
  rows.sort((a, b) => b.mtime - a.mtime);
  return { rows: rows.slice(0, limit), total: rows.length };
}

/**
 * One artifact's outcome folder — the bound artifacts the Inspector lists.
 *
 * Same read as `scanArtifactExports`, scoped to a ref, so the home and the bay
 * cannot disagree about what an artifact has produced. A ref with no folder
 * returns an empty row rather than null: "nothing bound yet" is a real answer.
 */
export async function scanOneOutcome(ref) {
  if (!ref) return { ref, files: [], bytes: 0, mtime: 0, url: null };
  const dir = path.join(outcomesBaseDir(), ref);
  const files = [];
  let bytes = 0;
  let mtime = 0;
  for (const entry of await readDirSafe(dir)) {
    if (!entry.isFile()) continue;
    const stat = await statSafe(path.join(dir, entry.name));
    if (!stat) continue;
    files.push({ name: entry.name, bytes: stat.size, sidecar: SIDECAR.test(entry.name) });
    bytes += stat.size;
    mtime = Math.max(mtime, Math.floor(stat.mtimeMs / 1000));
  }
  files.sort((a, b) => Number(a.sidecar) - Number(b.sidecar) || a.name.localeCompare(b.name));
  return { ref, files, bytes, mtime, url: files.length ? outcomeUrlFor(ref) : null };
}

/**
 * One artifact's outcome folder, ALL of it: every file down to `maxDepth` folders, grouped by the folder it sits in
 * at the top (`''` for the folder itself), so a building's `sheets/` and `schedules/` and a game's `levels/`, `godot/`
 * and `assets/` show as what they are. `scanOneOutcome` reads the top only; an export that writes into subfolders
 * would otherwise be invisible. Sidecars (the receipts and recipes) are left out. Each folder lists at most
 * `perGroup` files (a Godot pack holds thousands); its `total` and the tree's are the true counts.
 *
 * → { ref, url, total, bytes, groups: [{ dir, total, bytes, files: [{ path, bytes, page }] }] }
 *   `page` marks an HTML file: it opens to be looked at, where any other file is taken.
 */
export async function scanOutcomeTree(ref, { maxDepth = 3, perGroup = 60 } = {}) {
  const empty = { ref, url: null, total: 0, bytes: 0, groups: [] };
  if (!ref) return empty;
  const root = path.join(outcomesBaseDir(), ref);
  const groups = new Map();
  let total = 0;
  let bytes = 0;
  const walk = async (dir, rel, depth) => {
    const entries = (await readDirSafe(dir)).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;   // the host's own (.DS_Store), never an output
      const at = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (depth < maxDepth) await walk(path.join(dir, entry.name), at, depth + 1);
        continue;
      }
      if (!entry.isFile() || SIDECAR.test(entry.name)) continue;
      const stat = await statSafe(path.join(dir, entry.name));
      if (!stat) continue;
      const top = rel ? rel.split('/')[0] : '';
      const g = groups.get(top) ?? { dir: top, total: 0, bytes: 0, files: [] };
      g.total += 1;
      g.bytes += stat.size;
      if (g.files.length < perGroup) g.files.push({ path: at, bytes: stat.size, page: /\.html?$/i.test(entry.name) });
      groups.set(top, g);
      total += 1;
      bytes += stat.size;
    }
  };
  await walk(root, '', 0);
  if (!total) return empty;
  // the folder's own files first, then its subfolders by name
  const ordered = [...groups.values()].sort((a, b) => (a.dir === '' ? -1 : b.dir === '' ? 1 : a.dir.localeCompare(b.dir)));
  return { ref, url: outcomeUrlFor(ref), total, bytes, groups: ordered };
}

/**
 * Beats renders, grouped by the ref that minted them. `export_beats` writes
 * `<ref>.wav` / `<ref>.mid` for a loop or score and `<ref>.<cue>.wav` per SFX cue,
 * so the first dot-segment is the ref and one groove with nine cues reads as one
 * row of ten files rather than ten unrelated rows.
 */
export async function scanBeatsExports({ limit = 40 } = {}) {
  const base = exportsBaseDir();
  const groups = new Map();
  for (const entry of await readDirSafe(base)) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const stat = await statSafe(path.join(base, entry.name));
    if (!stat) continue;
    const ref = entry.name.split('.')[0];
    const group = groups.get(ref) || { ref, files: [], bytes: 0, mtime: 0, url: null };
    group.files.push({ name: entry.name, bytes: stat.size, sidecar: false });
    group.bytes += stat.size;
    group.mtime = Math.max(group.mtime, Math.floor(stat.mtimeMs / 1000));
    groups.set(ref, group);
  }
  const rows = [...groups.values()];
  for (const row of rows) row.files.sort((a, b) => a.name.localeCompare(b.name));
  rows.sort((a, b) => b.mtime - a.mtime);
  return { rows: rows.slice(0, limit), total: rows.length };
}
