/**
 * figure-spec-store — the reviewable SPEC FILE between a dream pass and the
 * build. The character-from-dream loop is split into three gated steps so the
 * operator holds go/no-go:
 *
 *   draft_figure_spec  → writes a spec FILE (status pending_approval) + a preview
 *   resolve_figure_spec → the OPERATOR approves / rejects (the dreaming agent
 *                         must not self-approve — 'a worker cannot self-accept')
 *   build_figure_spec   → machine-refused unless the file is approved; only then
 *                         does the real figure get minted
 *
 * The spec is a plain JSON file on disk (data/figure-specs/<ref>.json) so the
 * operator can open and read it directly; the preview is a sibling PNG the
 * driving agent reads with its own eyes. No DB table — the file IS the artifact.
 *
 * Where: $MOJULO_FIGURE_SPECS_DIR, which the bins seed to
 * $MOJULO_DATA_DIR/figure-specs. Before that seed the store sat at
 * <package>/data/figure-specs — under npx, inside the _npx cache, where a new
 * version or a cache purge lost the pending specs. First use copies that legacy
 * folder across (see migrateLegacySpecs); the old folder is never deleted.
 */

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';

export const SPEC_STATUS = Object.freeze({
  PENDING: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  BUILT: 'built',
});

const REF_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function figureSpecsDir() {
  return process.env.MOJULO_FIGURE_SPECS_DIR || path.join(process.cwd(), 'data', 'figure-specs');
}
export function specPath(ref) { return path.join(figureSpecsDir(), `${ref}.json`); }
export function previewPngPath(ref) { return path.join(figureSpecsDir(), `${ref}.preview.png`); }

export function validSpecRef(ref) { return typeof ref === 'string' && REF_RE.test(ref); }

// Where earlier versions kept the store: <package>/data/figure-specs, and the
// dashboard's copy under .next/standalone (it chdirs there). Only a bin exports
// MOJULO_CONTROL_DIR, so tests and `next dev` never read a legacy folder.
function legacySpecsDirs() {
  const pkg = process.env.MOJULO_CONTROL_DIR;
  if (!pkg) return [];
  const target = path.resolve(figureSpecsDir());
  return [
    path.join(pkg, 'data', 'figure-specs'),
    path.join(pkg, '.next', 'standalone', 'data', 'figure-specs'),
  ].filter((dir) => path.resolve(dir) !== target);
}

const hasSpecs = async (dir) => existsSync(dir) && (await fs.readdir(dir)).some((f) => f.endsWith('.json'));

/**
 * Copy legacy specs into the current store, once, and only while the store has
 * no specs of its own, so a spec deleted later never comes back. Copies, never
 * moves: the legacy folder is left exactly as it was. A copied spec's
 * preview_png is repointed at the copied preview so it survives the old folder.
 */
async function migrateLegacySpecs(target) {
  if (await hasSpecs(target)) return;
  for (const legacy of legacySpecsDirs()) {
    if (!(await hasSpecs(legacy))) continue;
    for (const name of await fs.readdir(legacy)) {
      const from = path.join(legacy, name);
      const to = path.join(target, name);
      if (existsSync(to) || !(await fs.stat(from)).isFile()) continue;
      if (!name.endsWith('.json')) {
        await fs.copyFile(from, to);
        continue;
      }
      const raw = await fs.readFile(from, 'utf8');
      let out = raw;
      try {
        const spec = JSON.parse(raw);
        if (typeof spec.preview_png === 'string' && path.dirname(spec.preview_png) === legacy) {
          spec.preview_png = path.join(target, path.basename(spec.preview_png));
          out = `${JSON.stringify(spec, null, 2)}\n`;
        }
      } catch { /* not a spec we can read: copy the bytes as they are */ }
      await fs.writeFile(to, out, 'utf8');
    }
  }
}

let prepared = null;

/** Create the store (and run the one-time legacy copy) before the first read or write. */
export function prepareFigureSpecsDir() {
  const dir = figureSpecsDir();
  if (prepared?.dir !== dir) {
    const done = (async () => {
      await fs.mkdir(dir, { recursive: true });
      await migrateLegacySpecs(dir);
    })();
    prepared = { dir, done };
    // A failed attempt is retried on the next use instead of being cached.
    done.catch(() => { if (prepared?.done === done) prepared = null; });
  }
  return prepared.done;
}

export async function writeSpec(spec) {
  if (!validSpecRef(spec?.ref)) throw new Error('writeSpec: invalid spec.ref');
  await prepareFigureSpecsDir();
  await fs.writeFile(specPath(spec.ref), `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  return spec;
}

export async function readSpec(ref) {
  if (!validSpecRef(ref)) throw new Error(`readSpec: invalid ref '${ref}'`);
  await prepareFigureSpecsDir();
  const p = specPath(ref);
  if (!existsSync(p)) return null;
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

export async function listSpecs({ status } = {}) {
  await prepareFigureSpecsDir();
  const dir = figureSpecsDir();
  if (!existsSync(dir)) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const s = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      if (!status || s.status === status) out.push(s);
    } catch { /* skip a malformed file rather than fail the whole list */ }
  }
  // Newest first (created_at is an ISO string).
  return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
