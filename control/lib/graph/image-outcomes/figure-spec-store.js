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

export async function writeSpec(spec) {
  if (!validSpecRef(spec?.ref)) throw new Error('writeSpec: invalid spec.ref');
  await fs.mkdir(figureSpecsDir(), { recursive: true });
  await fs.writeFile(specPath(spec.ref), `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  return spec;
}

export async function readSpec(ref) {
  if (!validSpecRef(ref)) throw new Error(`readSpec: invalid ref '${ref}'`);
  const p = specPath(ref);
  if (!existsSync(p)) return null;
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

export async function listSpecs({ status } = {}) {
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
