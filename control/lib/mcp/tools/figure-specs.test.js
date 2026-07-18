// The propose → approve → build split for character-from-dream. Two gates:
// draft requires a dream_audit (was it dreamed?), build requires approval (was
// it blessed?). This test covers the store + the gate semantics without the
// heavy render/DB path (the approved→mint success path is exercised live).
// Isolate the DB before anything imports db/index.js (same pattern as
// tool-descriptions.test.js) so the happy-path build can mint a real figure.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'figspec-'));
  process.env.MOJULO_FIGURE_SPECS_DIR = dir;
});
afterAll(async () => { await fs.rm(dir, { recursive: true, force: true }); });

const { writeSpec, readSpec, listSpecs, SPEC_STATUS } = await import('@/lib/graph/image-outcomes/figure-spec-store');
const { resolveFigureSpecHandler, buildFigureSpecHandler, draftFigureSpecHandler } = await import('@/lib/mcp/tools/figure-specs');

const AUDIT = { source: 'local:comfyui@127.0.0.1:8188', invoked_generator: true, prompt: 'a wizard in a green cloak, character sheet', job_id: 'abc-123' };
const pendingSpec = (ref) => ({
  ref, kind: 'figure-spec', status: SPEC_STATUS.PENDING, created_at: '2026-07-15T00:00:00.000Z',
  title: 'wizard', dials: { proto: { sex: 'male' }, garment: 'gown' }, dream_audit: { kind: 'dream-reconstruction', ...AUDIT },
  preview_png: path.join(dir, `${ref}.preview.png`), approval: null, rejection: null,
});

describe('figure spec store + gates', () => {
  it('writes and reads a spec file roundtrip', async () => {
    await writeSpec(pendingSpec('fs_a'));
    const s = await readSpec('fs_a');
    expect(s.status).toBe(SPEC_STATUS.PENDING);
    expect(s.dials.garment).toBe('gown');
  });

  it('draft REFUSES without a valid dream_audit (gate 1, chained)', async () => {
    await expect(draftFigureSpecHandler({ title: 'x', proto: { sex: 'male' }, dream_audit: { source: 'native', invoked_generator: false, prompt: 'imagined it' } }))
      .rejects.toThrow(/invoked_generator/);
    await expect(draftFigureSpecHandler({ title: 'x', proto: { sex: 'male' } }))
      .rejects.toThrow(/dream_audit|attesting the dream/);
  });

  it('build is REFUSED while pending (gate 2)', async () => {
    await writeSpec(pendingSpec('fs_b'));
    await expect(buildFigureSpecHandler({ ref: 'fs_b' })).rejects.toThrow(/pending approval|must not self-approve/);
  });

  it('the operator approves; status flips to approved', async () => {
    await writeSpec(pendingSpec('fs_c'));
    const r = await resolveFigureSpecHandler({ ref: 'fs_c', decision: 'approve', note: 'reads as the wizard' });
    expect(r.status).toBe(SPEC_STATUS.APPROVED);
    expect((await readSpec('fs_c')).approval.note).toMatch(/wizard/);
  });

  it('a rejected spec never builds', async () => {
    await writeSpec(pendingSpec('fs_d'));
    await resolveFigureSpecHandler({ ref: 'fs_d', decision: 'reject', note: 'off-model' });
    await expect(buildFigureSpecHandler({ ref: 'fs_d' })).rejects.toThrow(/rejected/);
  });

  it('only a pending spec can be resolved (no re-approving)', async () => {
    await writeSpec(pendingSpec('fs_e'));
    await resolveFigureSpecHandler({ ref: 'fs_e', decision: 'approve' });
    await expect(resolveFigureSpecHandler({ ref: 'fs_e', decision: 'reject' })).rejects.toThrow(/already 'approved'/);
  });

  it('lists pending specs (not resolved ones)', async () => {
    const pend = await listSpecs({ status: SPEC_STATUS.PENDING });
    const refs = pend.map((s) => s.ref);
    expect(refs).toContain('fs_b');       // still pending
    expect(refs).not.toContain('fs_c');   // approved
  });

  it('HAPPY PATH: draft (renders preview) → approve → build mints a figure with provenance', async () => {
    const draft = await draftFigureSpecHandler({
      ref: 'fs_wizard', title: 'wizard from dream',
      proto: { sex: 'male', height: 1.06 },
      garment: [{ id: 'mantle', color: { cloth: '#1f5a52' }, pieces: [{ fit: 'drape', coverage: ['torso', 'seat', 'legs'], anchor: 'shoulders', clearance: 0.4 }] }],
      thesis: 'shrine-keeper; column silhouette; the cloak is the hook',
      dream_audit: AUDIT,
    });
    expect(draft.status).toBe(SPEC_STATUS.PENDING);
    expect(existsSync(draft.preview_png)).toBe(true);   // the reviewer's preview really rendered

    // Build refused before approval...
    await expect(buildFigureSpecHandler({ ref: 'fs_wizard' })).rejects.toThrow(/pending approval/);

    await resolveFigureSpecHandler({ ref: 'fs_wizard', decision: 'approve' });
    const built = await buildFigureSpecHandler({ ref: 'fs_wizard' });
    expect(built.ok).toBe(true);
    expect(built.provenance).toBe('dream-reconstruction');   // the create_figure gate stamped it
    expect(built.ref).toBe('fs_wizard_fig');
    expect((await readSpec('fs_wizard')).status).toBe(SPEC_STATUS.BUILT);

    // Can't double-build.
    await expect(buildFigureSpecHandler({ ref: 'fs_wizard' })).rejects.toThrow(/already built/);
  });
});
