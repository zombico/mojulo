// forge_motion export:'blender' — the Blender film pack door (lib/motion/blender-film.js).
// The refusals land before any render, so they need no browser; the pack itself is
// covered by lib/motion/blender-film.test.js and the CLI's machine gate.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { afterAll, describe, expect, it } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { forgeMotionHandler } from './motion.js';

afterAll(() => closeDb());

describe("forge_motion export:'blender'", () => {
  it('refuses a non-world subject, pointing at the drawer card', async () => {
    await expect(forgeMotionHandler({
      title: 'not a world', subject: { sketch_ref: 'sk_nope' }, shot: { motion: 'orbit' }, export: 'blender',
    })).rejects.toThrow(/WORLD camera shots.*blender-film/);
  });

  it('refuses a traversal — an input script, not a camera path', async () => {
    await expect(forgeMotionHandler({
      title: 'a run', subject: { world_ref: 'sk_nope' }, shot: { motion: 'traversal', ticks: [{}] }, export: 'blender',
    })).rejects.toThrow(/input script, not a camera path/);
  });
});
