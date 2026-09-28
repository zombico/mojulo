// update_sketch under the Claude plugin profile (lib/mcp/plugin-profile.js). The painted kinds are
// refused on every path there: a full `manifest`, a `patch` that sets /kind (the patch is applied to
// the stored manifest before the kind gates, so the check has to see the resolved one), and a row an
// npm install on the same home already minted with a painted kind. A voice register is refused
// without naming the voice tools. Every other distribution keeps the edits it always allowed.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { cityBlockoutFixture } from '@/lib/graph/image-outcomes/fixtures';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { diffSketchesHandler } from './sketch-diff-tool.js';

const saved = process.env.MOJULO_DISTRIBUTION;
const DIAGRAM = {
  title: 'd',
  viewBox: { width: 400, height: 300 },
  stations: [{ id: 'a', kind: 'input', x: 10, y: 10, w: 80, h: 40, label: 'A' }],
  edges: [],
};
// Every top-level key of the painted fixture as a set op, and the diagram's own keys removed: the
// patch the review used to turn a diagram into an image-outcome row.
const toPainted = () => [
  ...Object.entries(cityBlockoutFixture()).map(([k, v]) => ({ op: 'set', path: `/${k}`, value: v })),
  { op: 'remove', path: '/stations' },
  { op: 'remove', path: '/edges' },
];
const notice = (what) => `${what} is not part of the Claude plugin build of mojulo.`;

beforeAll(async () => {
  closeDb();
  process.env.MOJULO_DISTRIBUTION = 'npm';
  await createSketchHandler({ title: 'd', ref: 'pp-diag', manifest: DIAGRAM });
  await createSketchHandler({ title: 'painted', ref: 'pp-painted', manifest: cityBlockoutFixture() });
  SketchRepository.create({ title: 'v', ref: 'pp-voice', manifest: { kind: 'voice-register', axes: {} } });
});

afterAll(() => {
  if (saved === undefined) delete process.env.MOJULO_DISTRIBUTION;
  else process.env.MOJULO_DISTRIBUTION = saved;
  closeDb();
});

describe('update_sketch under the Claude plugin profile', () => {
  it('refuses a patch that sets a painted kind, and stores nothing', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    await expect(updateSketchHandler({ ref: 'pp-diag', patch: toPainted() })).rejects.toThrow(notice("update_sketch kind 'image-outcome'"));
    await expect(updateSketchHandler({ ref: 'pp-diag', patch: [{ op: 'set', path: '/kind', value: 'sequential-art' }] }))
      .rejects.toThrow(notice("update_sketch kind 'sequential-art'"));
    expect(SketchRepository.getByRef('pp-diag').manifest.kind).not.toBe('image-outcome');
  });

  it('refuses any edit of a painted row minted elsewhere on the same home', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    await expect(updateSketchHandler({ ref: 'pp-painted', title: 'renamed' })).rejects.toThrow(notice("update_sketch kind 'image-outcome'"));
    await expect(updateSketchHandler({ ref: 'pp-painted', patch: [{ op: 'set', path: '/intent', value: 'a dragon' }] }))
      .rejects.toThrow(notice("update_sketch kind 'image-outcome'"));
    expect(SketchRepository.getByRef('pp-painted').title).toBe('painted');
  });

  it('refuses a voice register without naming a voice tool', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const err = await updateSketchHandler({ ref: 'pp-voice', title: 'x' }).catch((e) => e);
    expect(err.message).toBe(notice("Editing the voice register 'pp-voice'"));
    const diff = await diffSketchesHandler({ left_ref: 'pp-voice', right_ref: 'pp-diag' }).catch((e) => e);
    expect(diff.message).toBe(notice('Comparing voice registers'));
    const preload = await createSketchHandler({ title: 'x', manifest: DIAGRAM, preload: 'pp-missing' }).catch((e) => e);
    expect(preload.message).toMatch(/not found — mint it via create_sketch first/);
  });

  it('still edits a kept kind in place', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const r = await updateSketchHandler({ ref: 'pp-diag', title: 'renamed' });
    expect(r.ok).toBe(true);
    expect(SketchRepository.getByRef('pp-diag').title).toBe('renamed');
  });

  it('changes nothing under the npm distribution', async () => {
    process.env.MOJULO_DISTRIBUTION = 'npm';
    const err = await updateSketchHandler({ ref: 'pp-voice', title: 'x' }).catch((e) => e);
    expect(err.message).toMatch(/re-mint a variant with create_voice/);
    const diff = await diffSketchesHandler({ left_ref: 'pp-voice', right_ref: 'pp-diag' }).catch((e) => e);
    expect(diff.message).toMatch(/get_voice/);
    const preload = await createSketchHandler({ title: 'x', manifest: DIAGRAM, preload: 'pp-missing' }).catch((e) => e);
    expect(preload.message).toMatch(/create_sketch \/ create_polygonized_sketch first/);
    const r = await updateSketchHandler({ ref: 'pp-painted', title: 'renamed' });
    expect(r.ok).toBe(true);
  });
});
