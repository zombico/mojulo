/**
 * The render handoff (render-handoff.plan.md) — the durable render-worker
 * seam, built as a bicycle (docs/bicycles.md).
 *
 * mojulo designs pictures but cannot paint them; an external image-capable
 * worker does. This is the durable loop that hands the job across and tracks
 * it to an audited finish, unifying stills / comic panels / character sheets
 * (and, at promotion, keyframe cels) under one drivable-cold loop:
 *
 *   request_image_render  → park durable rows, one per render target
 *   pull_image_render     → claim the oldest pending row, hand back the packet
 *   submit_image_render   → save the generated PNG, record the worker's audit
 *   accept_/reject_image_render → the gate; the same worker can't self-accept
 *
 * Every response names the NEXT action (bicycle property 1: self-documenting).
 * The rows are durable (survive a restart) — the property the in-memory
 * mcp_jobs long-poll cannot give, and the reason renders don't ride it.
 *
 * Reuses, rather than re-implements: get_image_render_packet (the pull
 * payload), render-store (the append-only PNG slots), renderTargets (the
 * target-expansion rule).
 */

import { promises as fs } from 'node:fs';
import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { RenderRequestRepository } from '@/lib/db/repositories/render-requests';
import {
  isImageOutcomesKind,
  normalizeImageOutcomesManifest,
  renderTargets,
  KIND_KEYFRAME_ANIMATION,
  KIND_SCENE_MOTION,
} from '@/lib/graph/image-outcomes/manifest';
import { meruAuditCelPng, faceHoldAuditPng } from '@/lib/graph/image-outcomes/keyframe-audit';
import { auditStagePlatePng } from '@/lib/graph/image-outcomes/scene-plate';
import { nextRenderPath, latestBoundRender } from '@/lib/graph/image-outcomes/render-store';
import { getImageRenderPacketHandler } from '@/lib/mcp/tools/sketches';
import { createHash } from 'node:crypto';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

// The head-manifest hash: idempotency key for a parked request + a staleness
// marker (a request against an edited manifest is a NEW row, not a stale one).
function manifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16);
}

// Resolve a sketch to its normalized image-outcomes manifest, or throw the
// same guidance get_image_render_packet gives.
function resolveOutcome(ref) {
  if (!ref || typeof ref !== 'string') throw new Error('requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!isImageOutcomesKind(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — not an image-outcome/sequential-art `
      + 'director packet. Mint one via create_sketch (read the sketch_vocab cards).',
    );
  }
  const manifest = normalizeImageOutcomesManifest(sketch.manifest);
  return { sketch, manifest, ref: sketch.ref || ref };
}

/** Which targets for `ref` have at least one accepted render. */
function acceptedTargets(ref) {
  const accepted = new Set();
  for (const req of RenderRequestRepository.listByRef(ref)) {
    if (req.status === 'accepted') accepted.add(req.target);
  }
  return accepted;
}

export async function requestImageRenderHandler(input) {
  const { ref, target } = input || {};
  const { manifest, ref: sketchRef } = resolveOutcome(ref);
  const hash = manifestHash(manifest);
  const targets = renderTargets(manifest);
  if (target && !targets.includes(target)) {
    throw new Error(`target '${target}' is not a render target of '${sketchRef}' (targets: ${targets.join(', ')})`);
  }
  const toPark = target ? [target] : targets;
  const requests = toPark.map((t) =>
    RenderRequestRepository.park({ ref: sketchRef, target: t, kind: manifest.kind, manifestHash: hash }),
  );
  return {
    ok: true,
    ref: sketchRef,
    kind: manifest.kind,
    manifestHash: hash,
    requests: requests.map((r) => ({ request_id: r.id, target: r.target, status: r.status })),
    next: `${requests.length} render target(s) parked. A worker drains them with `
      + `pull_image_render${target ? `({ ref: '${sketchRef}' })` : `({ ref: '${sketchRef}' })`} `
      + `— or pull_image_render({}) to drain the whole queue.`,
  };
}

export async function pullImageRenderHandler(input) {
  const { ref, request_id: requestId } = input || {};
  let request;
  if (requestId) {
    request = RenderRequestRepository.getById(requestId);
    if (!request) throw new Error(`render request '${requestId}' not found`);
  } else {
    request = RenderRequestRepository.claimNext({ ref: ref || undefined });
  }
  if (!request) {
    return { ok: true, request: null, next: 'No pending render requests. Nothing to paint.' };
  }
  // The pull payload IS the packet — reuse it wholesale, then wrap with the
  // row id + submit tool so the worker knows how to hand its PNG back.
  const packet = await getImageRenderPacketHandler({ ref: request.ref, target: request.target });
  return {
    ok: true,
    request_id: request.id,
    submit_tool: 'submit_image_render',
    status: request.status,
    ...packet,
    // Restate the loop for a cold worker (bicycle property 1).
    next: `Paint target '${request.target}' per workerProtocol/instructions (INVOKE your image `
      + `generator — the scaffold is INPUT, never the deliverable). Then hand it back with `
      + `submit_image_render({ request_id: '${request.id}', image_path, worker_audit }).`,
  };
}

export async function submitImageRenderHandler(input) {
  const { request_id: requestId, image_path: imagePath, image_base64: imageBase64, worker_audit: workerAudit, source } = input || {};
  if (!requestId) throw new Error('submit_image_render requires { request_id }');
  const request = RenderRequestRepository.getById(requestId);
  if (!request) throw new Error(`render request '${requestId}' not found`);
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('submit_image_render requires exactly one of image_path | image_base64');
  }
  // Validate the lifecycle state BEFORE any side effect. recordSubmit enforces
  // the same rule at the DB layer, but by then the PNG has already hit the
  // render store — a submit-from-'pending' used to deposit an orphan snapshot
  // on its way to the error (0813 first-contact probe). Fail here, pre-disk;
  // the repository check below stays as the backstop.
  if (!['in_flight', 'submitted', 'rejected'].includes(request.status)) {
    throw new Error(
      `render request '${requestId}' is '${request.status}' — pull it first (submit accepts in_flight | submitted | rejected)`,
    );
  }
  const bytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (bytes.length < 8 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the submitted image is not a PNG (submit the generated raster, not the SVG scaffold)');
  }
  const slot = nextRenderPath(request.ref, request.target);
  await fs.writeFile(slot.path, bytes);

  // Keyframe cels get the deterministic MERU gate on submit (the machine half of
  // the two-gate doctrine): the cel must keep the crown-to-ground unit so the
  // body never grows/shrinks between frames. A pure scale violation heals to a
  // whole-cel-normalized PNG (never a cut) which we re-store in place; the
  // numbers ride the worker audit, and a non-compliant cel returns a redo note.
  // The register/identity gate stays the accepting agent's eyes.
  let meru = null;
  let meruRetry = null;
  let plate = null;
  let plateRetry = null;
  const sketch = SketchRepository.getByRef(request.ref);
  if (sketch?.manifest?.kind === KIND_KEYFRAME_ANIMATION) {
    const canvas = sketch.manifest.canvas || { width: 832, height: 1216 };
    const result = await meruAuditCelPng(bytes, { canvas });
    if (result.healedPng) await fs.writeFile(slot.path, result.healedPng);
    meru = result.meru;
    meruRetry = result.meru.compliant ? null : result.retry;
    // Face variants additionally get the HELD-REGION gate: outside the face
    // band the variant must match its key's base cel (a face variant re-renders
    // the same pose — "only the expression changes" is a machine number, not a
    // promise). Skipped when the base cel hasn't been submitted yet.
    const faceMatch = /^(key-\d+)\/face\//.exec(request.target || '');
    if (faceMatch) {
      const baseBound = latestBoundRender(request.ref, faceMatch[1]);
      if (baseBound) {
        const stored = result.healedPng || bytes;
        const hold = await faceHoldAuditPng(stored, await fs.readFile(baseBound.path), { canvas });
        meru = { ...meru, hold: hold.hold };
        if (!hold.hold.compliant) meruRetry = [meruRetry, hold.retry].filter(Boolean).join(' ');
      }
    }
  } else if (sketch?.manifest?.kind === KIND_SCENE_MOTION && /^plate(-shot-\d+)?$/.test(request.target)) {
    // Every plate (the base 'plate' AND a cross-cut shot's 'plate-shot-<i>')
    // gets the deterministic STAGE gate on submit (the machine half): exact
    // dimensions, the magenta guide marks painted out, sky≠ground. The
    // register/scale READ (does the ground plane agree with the kernel) stays the
    // accepting agent's eyes over the stage overlay.
    const result = await auditStagePlatePng(bytes, normalizeImageOutcomesManifest(sketch.manifest), { target: request.target });
    plate = result.audit;
    plateRetry = result.retry;
  }
  const mergedAudit = meru ? { ...(workerAudit || {}), meru }
    : plate ? { ...(workerAudit || {}), plate }
      : (workerAudit || null);

  const updated = RenderRequestRepository.recordSubmit({
    id: requestId,
    renderN: slot.n,
    workerAudit: mergedAudit,
    source: source || null,
  });
  return {
    ok: true,
    request_id: updated.id,
    ref: updated.ref,
    target: updated.target,
    n: slot.n,
    path: slot.path,
    bytes: bytes.length,
    status: updated.status,
    ...(meru ? { meru } : {}),
    ...(plate ? { plate } : {}),
    next: (meruRetry || plateRetry)
      ? `Submitted, but the ${meruRetry ? 'MERU' : 'STAGE'} gate FAILED: ${meruRetry || plateRetry} Re-render target '${updated.target}' over its scaffold (get_image_render_packet target '${updated.target}') and submit again before accepting.`
      : `Submitted${meru ? ` (meru OK${meru.normalized ? ', auto-normalized to the unit' : ''})` : plate ? ' (plate gate OK — eyeball the stage overlay for recession)' : ''}. The render is NOT accepted until a separate accept pass verifies it — `
        + `accept_image_render({ request_id: '${updated.id}', accept_audit }) or `
        + `reject_image_render({ request_id: '${updated.id}', accept_audit }). The same worker `
        + `should not self-accept its own render.`,
  };
}

async function resolveGate(input, accept) {
  const { request_id: requestId, accept_audit: acceptAudit, source } = input || {};
  if (!requestId) throw new Error(`${accept ? 'accept' : 'reject'}_image_render requires { request_id }`);
  const request = RenderRequestRepository.getById(requestId);
  if (!request) throw new Error(`render request '${requestId}' not found`);
  if (accept) {
    // The animation kinds get the enforced two-eyes contract (the Codex
    // talking-phone run self-accepted flat-vector cels — geometry gates can't
    // catch register, so the accept pass must be a DIFFERENT pair of eyes and
    // must attest to what it read).
    const kind = SketchRepository.getByRef(request.ref)?.manifest?.kind;
    if (kind === KIND_KEYFRAME_ANIMATION || kind === KIND_SCENE_MOTION) {
      // Machine gate first: the worker's OWN submit attestation. This path's
      // whole point is externally-generated paint — a cel whose worker_audit
      // swears no generator was invoked (the codex-local-svg-worker city-intro
      // run: procedural SVG/sharp frames disclosed honestly at submit, then
      // self-accepted under a second hat) is ineligible no matter whose eyes
      // run the accept. Re-render with a real generator, or use one of
      // mojulo's deterministic motion families instead of this kind.
      const wa = request.workerAudit;
      if (wa?.invoked_generator !== true || wa?.conditioned === 'prompt-only') {
        const attested = !wa ? 'no worker_audit at all'
          : wa.invoked_generator !== true ? `invoked_generator: ${JSON.stringify(wa.invoked_generator)}`
            : "conditioned: 'prompt-only'";
        throw new Error(
          `refusing to accept target '${request.target}': its submit attested ${attested} — `
          + 'the keyframe/scene kinds exist for externally-GENERATED paint, so acceptance requires the submit to have '
          + "attested worker_audit.invoked_generator: true (and conditioning on the scaffold, not 'prompt-only'). "
          + 'Re-render this target with an image generator conditioned on its scaffold and re-submit with an honest '
          + 'worker_audit; for procedural/vector frames use a deterministic forge_motion family '
          + '(figure/manji-tree/world) instead of keyframe-animation.',
        );
      }
      const register = typeof acceptAudit?.register === 'string' && acceptAudit.register.trim();
      if (!register) {
        throw new Error(
          "accept_image_render for a keyframe/scene render requires accept_audit.register — a one-line EYES attestation "
          + '(painted register not vector tracing, identity/facing holds, props read correctly). The machine gates cover geometry only.',
        );
      }
      const acceptor = source ? String(source).trim() : '';
      if (!acceptor) {
        throw new Error(
          "accept_image_render for a keyframe/scene render requires { source } — the accepting agent's identity. "
          + 'The same worker that submitted must not self-accept.',
        );
      }
      if (request.source && acceptor === request.source) {
        throw new Error(
          `refusing self-accept: '${acceptor}' both submitted and is accepting target '${request.target}'. `
          + 'A different pair of eyes (the driving agent or the operator) must run the accept pass.',
        );
      }
    }
  }
  const updated = accept
    ? RenderRequestRepository.recordAccept({ id: requestId, acceptAudit: acceptAudit ? { ...acceptAudit, ...(source ? { acceptedBy: String(source) } : {}) } : null })
    : RenderRequestRepository.recordReject({ id: requestId, acceptAudit: acceptAudit || null });
  const { manifest, ref } = resolveOutcome(updated.ref);
  const targets = renderTargets(manifest);
  if (!accept) {
    return {
      ok: true,
      request_id: updated.id,
      ref,
      target: updated.target,
      status: updated.status,
      next: `Rejected. Repaint target '${updated.target}' and submit again with `
        + `submit_image_render({ request_id: '${updated.id}', image_path, worker_audit }).`,
    };
  }
  const accepted = acceptedTargets(ref);
  const remaining = targets.filter((t) => !accepted.has(t));
  const isKeyframe = manifest.kind === KIND_KEYFRAME_ANIMATION;
  const isScene = manifest.kind === KIND_SCENE_MOTION;
  return {
    ok: true,
    request_id: updated.id,
    ref,
    target: updated.target,
    status: updated.status,
    remaining_targets: remaining,
    ...(remaining.length === 0
      ? (isKeyframe
          // A keyframe animation has no still page — the finished artifact is a
          // forge_motion `mo_` GIF/MP4 stitched from the accepted cels (A3).
          ? { next: `All cels accepted. Stitch the animation with forge_motion (subject: { cel_set: { ref: '${ref}' } }).` }
          : isScene
            // A scene composites its cast clips over the accepted plate into an mo_.
            ? { next: `Plate accepted. Composite the scene with forge_motion (subject: { scene_ref: '${ref}' }).` }
            : {
              final_url: `/api/sketches/${encodeURIComponent(ref)}/final.png`,
              next: `All targets accepted. The finished page composites at /api/sketches/${encodeURIComponent(ref)}/final.png — publish via gather + cook.`,
            })
      : { next: `Accepted. ${remaining.length} target(s) still need an accepted render: ${remaining.join(', ')}.` }),
  };
}

export const acceptImageRenderHandler = (input) => resolveGate(input, true);
export const rejectImageRenderHandler = (input) => resolveGate(input, false);

export function registerRenderHandoffTools() {
  registerTool({
    name: 'request_image_render',
    description:
      "Park a DURABLE render request for a minted `image-outcome` / `sequential-art` sketch — the start of the render handoff (a bicycle: request → pull → submit → accept). One row per render target (page, or one per panel), idempotent per (ref, target, head-manifest). Unlike the ad-hoc bind path, a parked request survives a control-plane restart until a worker fulfils it. Pass `target` to park just one; omit it to park every target of the sketch's render strategy. Returns the parked `request_id`s and the next action (a worker drains them with `pull_image_render`).",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The minted image-outcome / sequential-art sketch ref (`sk_…`).' },
        target: { type: 'string', description: "Optional single target ('page' or a panel id). Omit to park every target." },
      },
      required: ['ref'],
    },
    handler: requestImageRenderHandler,
  });

  registerTool({
    name: 'pull_image_render',
    description:
      "Worker-mode claim: take the oldest pending render request off the durable queue (marks it in_flight so concurrent workers don't double-claim) and get everything needed to paint it — the render packet (instructions, workerProtocol, scaffold URLs, localParams, character sheets), plus the `request_id` and the submit tool. Pass `ref` to drain one sketch's requests, or omit it to take from the whole queue; pass `request_id` to re-pull a specific one. Returns `{ request: null }` when nothing is pending. INVOKE your image generator conditioned on the scaffold — a returned wireframe is traced, not generated — then call `submit_image_render`.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Optional: only claim requests for this sketch ref.' },
        request_id: { type: 'string', description: 'Optional: re-pull a specific parked request by id.' },
      },
    },
    handler: pullImageRenderHandler,
  });

  registerTool({
    name: 'submit_image_render',
    description:
      "Hand a worker-generated PNG back for a pulled render request. The PNG is snapshotted append-only into the sketch's outcome folder (via the render store), the request moves to `submitted`, and the worker's audit claim is recorded. Provide exactly one of `image_path` (same-host file, primary) or `image_base64` (remote fallback). `worker_audit` is what the worker attests — e.g. `{ conditioned: 'scaffold'|'prompt-only', invoked_generator: true, scaffold_echo: false, notes }` (for keyframe cels it also carries the deterministic meru numbers). Submitting does NOT accept the render — a separate `accept_image_render` pass gates it.",
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The `request_id` from `pull_image_render`.' },
        image_path: { type: 'string', description: 'Absolute path to the generated PNG on this host (primary).' },
        image_base64: { type: 'string', description: 'Base64-encoded PNG bytes (remote-worker fallback). Exactly one of image_path | image_base64.' },
        worker_audit: { type: 'object', description: "The worker's own audit claim (recorded, not trusted as acceptance).", additionalProperties: true },
        source: { type: 'string', description: 'Optional worker/harness id for provenance.' },
      },
      required: ['request_id'],
    },
    handler: submitImageRenderHandler,
  });

  registerTool({
    name: 'accept_image_render',
    description:
      "The audit gate: accept a submitted render after verifying it against the non-overlayable surface (did the panel carry its beat/pose, are strict forms placed, is the bubble zone still blank, does identity hold). Records `accept_audit` under its own author — the same worker that submitted should not self-accept. Only `accepted` renders feed the final composite; once every target of a page is accepted, `/api/sketches/<ref>/final.png` is the finished page. Returns the remaining unaccepted targets (or the final_url when none remain).",
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The submitted request to accept.' },
        accept_audit: { type: 'object', description: "The accepting agent's verification, e.g. `{ beats_ok, forms_ok, bubble_zones_clear, identity_ok, notes }`. For keyframe/scene renders `register` is REQUIRED — a one-line eyes attestation (painted register not tracing, identity/facing, props).", additionalProperties: true },
        source: { type: 'string', description: "The accepting agent's identity. REQUIRED for keyframe/scene renders and must differ from the submit's `source` — the same worker must not self-accept." },
      },
      required: ['request_id'],
    },
    handler: acceptImageRenderHandler,
  });

  registerTool({
    name: 'reject_image_render',
    description:
      "The audit gate's other verdict: reject a submitted render (records `accept_audit` with the reason) so the worker repaints and re-submits against the same request. Use when the render fails the non-overlayable checks (wrong beat, traced scaffold, moved strict form, painted-in bubble text, identity drift).",
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The submitted request to reject.' },
        accept_audit: { type: 'object', description: 'Why it failed, e.g. `{ scaffold_echo: true, notes: "returned the wireframe" }`.', additionalProperties: true },
      },
      required: ['request_id'],
    },
    handler: rejectImageRenderHandler,
  });
}
