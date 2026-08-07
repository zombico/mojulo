/**
 * Figure spec files — the propose → approve → build split for character-from-dream.
 *
 * A dream pass no longer mints a figure directly. It DRAFTS a spec file (gated on
 * a dream_audit — was it actually dreamed?), the OPERATOR approves it (the
 * dreaming agent must not self-approve), and only an approved spec can be BUILT
 * into the real figure (gated on status). Two independent gates: dream_audit
 * (dreamt?) and approval (blessed?).
 *
 * These tools are registered listed:false — the character-from-dream catalyst
 * documents the flow, so they stay out of the always-paid tools/list payload.
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';

import { registerTool } from '@/lib/mcp/server';
import { rasterizeSketchToPng } from '@/lib/graph/sketch/sketch-png';
import { renderFigureToSvg } from '@/lib/graph/polygonizer/figure-render';
import { normalizeDreamAudit } from '@/lib/graph/image-outcomes/dream-audit';
import {
  SPEC_STATUS, readSpec, writeSpec, listSpecs, previewPngPath, validSpecRef,
} from '@/lib/graph/image-outcomes/figure-spec-store';
import { createFigureHandler } from '@/lib/mcp/tools/figure';

const nowIso = () => new Date().toISOString();
const genRef = () => `fs_${randomBytes(5).toString('hex')}`;

// Collect the figure dials the spec carries (the create_figure args, minus the
// render-only knobs). motion is allowed so an emote/gait can ride the spec.
function collectDials(input) {
  const dials = {};
  for (const k of ['proto', 'fluffs', 'garment', 'pose', 'view', 'setup', 'motion', 'background']) {
    if (input[k] !== undefined && input[k] !== null) dials[k] = input[k];
  }
  return dials;
}

// ── draft_figure_spec ──────────────────────────────────────────────────────
export async function draftFigureSpecHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('draft_figure_spec requires { title, dream_audit, ... }');
  const { title, thesis, notes } = input;
  let { ref, dream_audit: dreamAudit } = input;
  if (typeof dreamAudit === 'string' && /^\s*[{[]/.test(dreamAudit)) {
    try { dreamAudit = JSON.parse(dreamAudit); } catch { /* validator will reject */ }
  }
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined && !validSpecRef(ref)) throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  ref = ref || genRef();
  if (await readSpec(ref)) throw new Error(`A figure spec '${ref}' already exists`);

  // Gate 1 (chained): a draft is the output of a DREAM pass — it must attest one.
  const provenance = normalizeDreamAudit(dreamAudit);

  const dials = collectDials(input);
  const manifest = { kind: 'figure', ...dials, title };
  // Validate the dials by rendering (a bad dial throws here, not at build time).
  try { renderFigureToSvg(manifest); }
  catch (err) { throw new Error(`figure spec render failed: ${err.message}`); }

  // Preview PNG the operator reviews (read it with your own eyes before approving).
  const png = await rasterizeSketchToPng({ manifest, ref: `${ref}__preview` }, { scale: 2 });
  const previewPath = previewPngPath(ref);
  await fs.writeFile(previewPath, png);

  const spec = {
    ref,
    kind: 'figure-spec',
    status: SPEC_STATUS.PENDING,
    created_at: nowIso(),
    title,
    ...(thesis ? { thesis: String(thesis) } : {}),
    ...(notes ? { notes: String(notes) } : {}),
    dials,
    dream_audit: provenance,
    preview_png: previewPath,
    approval: null,
    rejection: null,
  };
  await writeSpec(spec);

  return {
    ok: true,
    spec_ref: ref,
    status: spec.status,
    preview_png: previewPath,
    next: `PENDING APPROVAL. The operator reviews the preview (Read ${previewPath}) + the spec, then calls resolve_figure_spec({ ref: '${ref}', decision: 'approve' }). You (the dreaming agent) MUST NOT self-approve — surface the preview and get explicit operator sign-off. build_figure_spec is machine-refused until approved.`,
  };
}

// ── get_figure_spec ────────────────────────────────────────────────────────
export async function getFigureSpecHandler(input = {}) {
  const { ref, status } = input || {};
  if (ref) {
    const spec = await readSpec(ref);
    if (!spec) throw new Error(`Figure spec '${ref}' not found`);
    return { ok: true, spec };
  }
  const specs = await listSpecs(status ? { status } : { status: SPEC_STATUS.PENDING });
  return {
    ok: true,
    filter: status || SPEC_STATUS.PENDING,
    specs: specs.map((s) => ({ ref: s.ref, title: s.title, status: s.status, created_at: s.created_at, preview_png: s.preview_png })),
  };
}

// ── resolve_figure_spec (approve / reject) ─────────────────────────────────
export async function resolveFigureSpecHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('resolve_figure_spec requires { ref, decision }');
  const { ref, decision, note } = input;
  if (!validSpecRef(ref)) throw new Error('`ref` must be a figure spec ref');
  if (decision !== 'approve' && decision !== 'reject') throw new Error("`decision` must be 'approve' or 'reject'");
  const spec = await readSpec(ref);
  if (!spec) throw new Error(`Figure spec '${ref}' not found`);
  if (spec.status !== SPEC_STATUS.PENDING) {
    throw new Error(`Figure spec '${ref}' is already '${spec.status}' — only a pending spec can be resolved`);
  }
  if (decision === 'approve') {
    spec.status = SPEC_STATUS.APPROVED;
    spec.approval = { at: nowIso(), ...(note ? { note: String(note) } : {}) };
  } else {
    spec.status = SPEC_STATUS.REJECTED;
    spec.rejection = { at: nowIso(), ...(note ? { reason: String(note) } : {}) };
  }
  await writeSpec(spec);
  return {
    ok: true,
    spec_ref: ref,
    status: spec.status,
    next: decision === 'approve'
      ? `APPROVED. build_figure_spec({ ref: '${ref}' }) will now mint the figure.`
      : 'REJECTED. Re-dream and draft a new spec; this one will not build.',
  };
}

// ── build_figure_spec ──────────────────────────────────────────────────────
export async function buildFigureSpecHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('build_figure_spec requires { ref }');
  const { ref, sketch_ref: sketchRef, folder_ref: folderRef } = input;
  if (!validSpecRef(ref)) throw new Error('`ref` must be a figure spec ref');
  const spec = await readSpec(ref);
  if (!spec) throw new Error(`Figure spec '${ref}' not found`);
  // THE GATE: no build without an operator approval.
  if (spec.status === SPEC_STATUS.PENDING) {
    throw new Error(`Refused — figure spec '${ref}' is pending approval. The operator must resolve_figure_spec({ ref: '${ref}', decision: 'approve' }) first; the dreaming agent must not self-approve.`);
  }
  if (spec.status === SPEC_STATUS.REJECTED) {
    throw new Error(`Refused — figure spec '${ref}' was rejected. Re-dream and draft a new spec.`);
  }
  if (spec.status === SPEC_STATUS.BUILT) {
    throw new Error(`Figure spec '${ref}' was already built into '${spec.built?.sketch_ref}'.`);
  }
  if (spec.status !== SPEC_STATUS.APPROVED) throw new Error(`Figure spec '${ref}' has unexpected status '${spec.status}'`);

  const outRef = sketchRef || `${ref}_fig`;
  // Promote: mint the real figure through the canonical path, carrying the
  // spec's dials + the dream_audit provenance (the create_figure gate re-checks
  // both the dials and the audit).
  const result = await createFigureHandler({
    title: spec.title,
    ...spec.dials,
    dream_audit: spec.dream_audit,
    ref: outRef,
    ...(folderRef ? { folder_ref: folderRef } : {}),
  });

  spec.status = SPEC_STATUS.BUILT;
  spec.built = { at: nowIso(), sketch_ref: result.ref };
  await writeSpec(spec);
  return { ok: true, spec_ref: ref, built_from_approval: true, ...result };
}

export function registerFigureSpecTools() {
  registerTool({
    name: 'draft_figure_spec',
    listed: false,
    description:
      "PROPOSE a character-from-dream figure as a reviewable SPEC FILE (does NOT build). Step 1 of the gated split: draft → operator approves → build. Takes the reconstructed figure dials (proto|fluffs, garment, pose, view, setup, motion) plus a REQUIRED dream_audit (the same attestation create_figure gates on — a spec is the output of a DREAM pass). Writes data/figure-specs/<ref>.json (status pending_approval) + a preview PNG the operator reads. Returns spec_ref + preview_png. The figure is NOT minted until build_figure_spec runs on an APPROVED spec.",
    inputSchema: {
      type: 'object',
      required: ['title', 'dream_audit'],
      properties: {
        title: { type: 'string', description: 'Title for the figure.' },
        proto: { type: 'object', description: 'Body dials (see create_figure.proto).' },
        fluffs: { type: 'array', description: 'Stylized body register (see create_figure.fluffs); replaces proto.' },
        garment: { type: ['string', 'object', 'array', 'null'], description: 'Wardrobe (see create_figure.garment): key(s) or inline spec(s).' },
        pose: { type: 'object', description: 'Pose dials (see create_figure.pose).' },
        motion: { type: ['string', 'object'], description: 'Optional motion/emote (see create_figure.motion).' },
        view: { description: "Camera (see create_figure.view)." },
        setup: { type: ['string', 'null'], description: 'Studio setup (see create_figure.setup).' },
        background: { type: 'boolean', description: 'Backdrop (see create_figure.background).' },
        thesis: { type: 'string', description: 'One-line character thesis (role / silhouette / hook) for the reviewer.' },
        notes: { type: 'string', description: 'What the dream dictated vs. what the vocabulary reached (reviewer context + named gaps).' },
        dream_audit: { type: 'object', description: "REQUIRED. The dream attestation (see create_figure.dream_audit): { source, invoked_generator:true, prompt, and one of job_id|image_sha256|seed|token }. A spec with a malformed audit is refused." },
        ref: { type: 'string', description: 'Optional explicit spec ref (1-64 chars [A-Za-z0-9_-]).' },
      },
    },
    handler: draftFigureSpecHandler,
  });

  registerTool({
    name: 'get_figure_spec',
    listed: false,
    description: "Read a figure spec (with `ref`) or list specs (omit `ref` → pending; pass `status` to filter). The full record carries the dials, the dream_audit, and the preview_png path (Read it to SEE the proposal). Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'A figure spec ref. Omit to list.' },
        status: { type: 'string', enum: ['pending_approval', 'approved', 'rejected', 'built'], description: 'When listing, filter by status (default pending_approval).' },
      },
    },
    handler: getFigureSpecHandler,
  });

  registerTool({
    name: 'resolve_figure_spec',
    listed: false,
    description: "The OPERATOR's approval gate: approve or reject a pending figure spec. approve → build_figure_spec may mint it; reject → it will never build. The dreaming agent MUST NOT self-approve — surface the preview + spec to the operator and act only on their explicit decision (a worker cannot self-accept). Only a pending spec can be resolved.",
    inputSchema: {
      type: 'object',
      required: ['ref', 'decision'],
      properties: {
        ref: { type: 'string', description: 'The figure spec ref.' },
        decision: { type: 'string', enum: ['approve', 'reject'], description: "The operator's decision." },
        note: { type: 'string', description: 'Optional approval note / rejection reason.' },
      },
    },
    handler: resolveFigureSpecHandler,
  });

  registerTool({
    name: 'build_figure_spec',
    listed: false,
    description: "BUILD the figure from an APPROVED spec (step 3). Machine-refused unless the spec's status is approved — a pending or rejected spec cannot build. Mints the real figure through create_figure with the spec's dials + dream_audit provenance, then marks the spec built. Returns the figure sketch ref.",
    inputSchema: {
      type: 'object',
      required: ['ref'],
      properties: {
        ref: { type: 'string', description: 'The APPROVED figure spec ref.' },
        sketch_ref: { type: 'string', description: 'Optional ref for the minted figure sketch (default `<spec>_fig`).' },
        folder_ref: { type: 'string', description: 'Optional sketch folder.' },
      },
    },
    handler: buildFigureSpecHandler,
  });
}
