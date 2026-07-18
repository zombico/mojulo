// The render handoff driven COLD through its tool handlers: mint an
// image-outcome → request → pull → submit → accept, exactly as a foreign
// worker would, asserting each response names the next action (the bicycle
// property) and that acceptance is a distinct, gated step.
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'irq-outcomes-'));

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db/index';
import { createSketchHandler } from '@/lib/mcp/tools/sketches';
import { cityBlockoutFixture } from '@/lib/graph/image-outcomes/fixtures';
import {
  requestImageRenderHandler,
  pullImageRenderHandler,
  submitImageRenderHandler,
  acceptImageRenderHandler,
  rejectImageRenderHandler,
} from '@/lib/mcp/tools/render-handoff.js';

// A minimal valid 1×1 PNG (magic bytes intact) — stands in for the render.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function mintOutcome() {
  const res = await createSketchHandler({ title: 'Neon street', manifest: cityBlockoutFixture() });
  return res.ref;
}

describe('render handoff — cold drive through the tools', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM image_render_requests; DELETE FROM sketches;');
  });

  it('parks a durable request per target and points at pull_image_render', async () => {
    const ref = await mintOutcome();
    const parked = await requestImageRenderHandler({ ref });
    expect(parked.ok).toBe(true);
    expect(parked.requests).toHaveLength(1); // image-outcome → one 'page' target
    expect(parked.requests[0].target).toBe('page');
    expect(parked.requests[0].status).toBe('pending');
    expect(parked.next).toMatch(/pull_image_render/);
  });

  it('pull returns the packet + request_id + submit tool, and claims the row', async () => {
    const ref = await mintOutcome();
    await requestImageRenderHandler({ ref });
    const pulled = await pullImageRenderHandler({ ref });
    expect(pulled.request_id).toMatch(/^irq_/);
    expect(pulled.submit_tool).toBe('submit_image_render');
    expect(pulled.target).toBe('page');
    expect(pulled.instructions).toBeTruthy();      // the reused packet body
    expect(pulled.workerProtocol).toBeInstanceOf(Array);
    expect(pulled.next).toMatch(/submit_image_render/);
    // Claimed → the queue is now empty for this ref.
    const again = await pullImageRenderHandler({ ref });
    expect(again.request).toBeNull();
  });

  it('drives request → pull → submit → accept and exposes final.png once every target is accepted', async () => {
    const ref = await mintOutcome();
    await requestImageRenderHandler({ ref });
    const pulled = await pullImageRenderHandler({ ref });

    const submitted = await submitImageRenderHandler({
      request_id: pulled.request_id,
      image_base64: TINY_PNG_B64,
      worker_audit: { conditioned: 'scaffold', invoked_generator: true, scaffold_echo: false },
    });
    expect(submitted.status).toBe('submitted');
    expect(submitted.n).toBe(1);
    expect(submitted.next).toMatch(/accept_image_render/);
    // Submitting is NOT acceptance.
    expect(submitted.status).not.toBe('accepted');

    const accepted = await acceptImageRenderHandler({
      request_id: pulled.request_id,
      accept_audit: { forms_ok: true, bubble_zones_clear: true },
    });
    expect(accepted.status).toBe('accepted');
    expect(accepted.remaining_targets).toEqual([]);
    expect(accepted.final_url).toContain(`/api/sketches/${encodeURIComponent(ref)}/final.png`);
  });

  it('rejects a bad render so the worker repaints against the same request', async () => {
    const ref = await mintOutcome();
    await requestImageRenderHandler({ ref });
    const pulled = await pullImageRenderHandler({ ref });
    await submitImageRenderHandler({ request_id: pulled.request_id, image_base64: TINY_PNG_B64 });
    const rejected = await rejectImageRenderHandler({
      request_id: pulled.request_id,
      accept_audit: { scaffold_echo: true, notes: 'returned the wireframe' },
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.next).toMatch(/[Rr]epaint/);
    // Re-submit is allowed against the same request.
    const resubmitted = await submitImageRenderHandler({ request_id: pulled.request_id, image_base64: TINY_PNG_B64 });
    expect(resubmitted.status).toBe('submitted');
    expect(resubmitted.n).toBe(2);
  });

  it('rejects a non-PNG payload (the traced-scaffold guard)', async () => {
    const ref = await mintOutcome();
    await requestImageRenderHandler({ ref });
    const pulled = await pullImageRenderHandler({ ref });
    await expect(
      submitImageRenderHandler({ request_id: pulled.request_id, image_base64: Buffer.from('<svg/>').toString('base64') }),
    ).rejects.toThrow(/not a PNG/);
  });
});

// The enforced two-eyes contract for the animation kinds (the Codex
// talking-phone run self-accepted flat-vector cels): accepting a keyframe/scene
// render requires a register attestation AND an acceptor identity that differs
// from the submitter's.
describe('accept gate — no self-accept on animation kinds', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM image_render_requests; DELETE FROM sketches;');
  });

  async function submitKeyframeCel(workerAudit = { invoked_generator: true, conditioned: 'scaffold' }) {
    const minted = await createSketchHandler({
      title: 'Gatecheck wave',
      manifest: {
        kind: 'keyframe-animation', title: 'Gatecheck wave', motion: 'wave', keys: 1,
        characters: [{ id: 'g', description: 'gate check figure' }],
      },
    });
    await requestImageRenderHandler({ ref: minted.ref, target: 'key-0' });
    const pulled = await pullImageRenderHandler({ ref: minted.ref });
    await submitImageRenderHandler({
      request_id: pulled.request_id, image_base64: TINY_PNG_B64, source: 'codex-image-worker',
      ...(workerAudit ? { worker_audit: workerAudit } : {}),
    });
    return pulled.request_id;
  }

  it('requires accept_audit.register (the eyes attestation)', async () => {
    const requestId = await submitKeyframeCel();
    await expect(acceptImageRenderHandler({ request_id: requestId, source: 'claude-code' }))
      .rejects.toThrow(/accept_audit\.register/);
  });

  it('requires an acceptor identity and refuses the submitter', async () => {
    const requestId = await submitKeyframeCel();
    await expect(acceptImageRenderHandler({
      request_id: requestId, accept_audit: { register: 'painted, on-model' },
    })).rejects.toThrow(/requires \{ source \}/);
    await expect(acceptImageRenderHandler({
      request_id: requestId, accept_audit: { register: 'painted, on-model' }, source: 'codex-image-worker',
    })).rejects.toThrow(/self-accept/);
  });

  it('a different pair of eyes accepts, and the acceptor is recorded', async () => {
    const requestId = await submitKeyframeCel();
    const accepted = await acceptImageRenderHandler({
      request_id: requestId,
      accept_audit: { register: 'painted register, identity holds, front-facing' },
      source: 'claude-code',
    });
    expect(accepted.status).toBe('accepted');
  });

  // The generator attestation gate (the codex-local-svg-worker city-intro run:
  // procedural SVG/sharp cels, honestly attested invoked_generator:false at
  // submit, then self-accepted under a second hat). The accept pass now
  // CONSUMES the submit's own attestation: animation cels are ineligible
  // unless the worker affirmatively attested invoked_generator: true and
  // scaffold conditioning — a different pair of eyes cannot accept around it.
  it('refuses a cel whose submit attested invoked_generator: false, even with distinct eyes', async () => {
    const requestId = await submitKeyframeCel({
      invoked_generator: false, conditioned: 'prompt-only',
      notes: 'Generated raster cel from local SVG/Sharp frame',
    });
    await expect(acceptImageRenderHandler({
      request_id: requestId,
      accept_audit: { register: 'painted register, identity holds' },
      source: 'claude-code',
    })).rejects.toThrow(/invoked_generator/);
  });

  it("refuses a cel conditioned 'prompt-only' even when a generator was invoked", async () => {
    const requestId = await submitKeyframeCel({ invoked_generator: true, conditioned: 'prompt-only' });
    await expect(acceptImageRenderHandler({
      request_id: requestId,
      accept_audit: { register: 'painted register, identity holds' },
      source: 'claude-code',
    })).rejects.toThrow(/prompt-only/);
  });

  it('refuses a cel submitted with NO worker attestation (omission is not a dodge)', async () => {
    const requestId = await submitKeyframeCel(null); // the meru numbers still ride, but nothing was attested
    await expect(acceptImageRenderHandler({
      request_id: requestId,
      accept_audit: { register: 'painted register, identity holds' },
      source: 'claude-code',
    })).rejects.toThrow(/invoked_generator: undefined/);
  });

  it('non-animation kinds keep the honor-system accept (unchanged contract)', async () => {
    const ref = await mintOutcome();
    await requestImageRenderHandler({ ref });
    const pulled = await pullImageRenderHandler({ ref });
    await submitImageRenderHandler({ request_id: pulled.request_id, image_base64: TINY_PNG_B64, source: 'codex-image-worker' });
    const accepted = await acceptImageRenderHandler({
      request_id: pulled.request_id, accept_audit: { forms_ok: true },
    });
    expect(accepted.status).toBe('accepted');
  });
});
