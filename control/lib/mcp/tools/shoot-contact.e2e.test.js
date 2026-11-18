process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { forgeMotionHandler } from './motion.js';

const WORLD = { kind: 'css3d-turntable', shape: 'dodecahedron', color: '#7a5fad', surface: 'vexar' };
const ON = { on: [0, 0, 0], heading: 90, height: 1.6 };

beforeEach(() => {
  process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(tmpdir(), 'contact-'));
  closeDb();
  SketchRepository.create({ ref: 'stage', title: 'stage', manifest: WORLD });
});

describe("a shoot plan's contact sheet", () => {
  it('renders a row a shot, a frame an instant, written beside the world and named by the plan', async () => {
    const plan = { cameras: [{ id: 'push', keys: [{ t: 0, move: { kind: 'push_in', ...ON, from: 'ws', to: 'ms', for: 2 } }] }, { id: 'low', keys: [{ t: 0, frame: { ...ON, size: 'fs', angle: 'low' } }] }] };
    const res = await forgeMotionHandler({ subject: { world_ref: 'stage' }, shoot: { plan, contact: 2 } });
    const sheet = res.shoot?.contact ?? res.contact;
    expect(sheet.rows.map((r) => r.frames.map((f) => f.at))).toEqual([['start', 'end'], ['start', 'end']]);
    expect(existsSync(sheet.path)).toBe(true);
    const meta = await sharp(sheet.path).metadata();
    expect(meta.width).toBeGreaterThan(600);
    // the same plan's sheet again, on the plan there: the same file
    const again = await forgeMotionHandler({ subject: { world_ref: 'stage' }, shoot: { contact: 2 } });
    expect((again.shoot?.contact ?? again.contact).path).toBe(sheet.path);
  }, 300000);
});
