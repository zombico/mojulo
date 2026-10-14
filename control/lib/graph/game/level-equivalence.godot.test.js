// THE FIXTURE MATRIX (npm run test:godot): every cosmos fixture made into a real game through design_game's quick
// path, exported to Godot, imported, and played by script in both engines (scripts/godot-fixture-matrix.mjs). The
// machine gate: what is minted exports and imports clean and holds still on the web, and a fixture whose export says
// it plays is web-equal frame by frame, its win won and its control held in both. The matrix prints as the run's log.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from '@/lib/mcp/tools/design-game.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { buildGodotGamePack } from '@/lib/graph/scene/godot-pack.js';
import { exportVerdict } from '@/lib/graph/scene/engine-portability.js';
import { FIXTURES } from '@/lib/graph/cosmos/fixtures.js';
import * as L from './level-equivalence.js';
import { fixtureRow, formatMatrix, FIXTURE_QUICK } from '../../../scripts/godot-fixture-matrix.mjs';

const GODOT = process.env.MOJULO_GODOT;

describe.skipIf(!GODOT)('the fixture matrix (MOJULO_GODOT)', () => {
  it('makes, exports, imports and plays every fixture the quick path says, in both engines', async () => {
    closeDb();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-matrix-'));
    const ctx = { designGameHandler, SketchRepository, resolveWorldScene, buildGodotGamePack, exportVerdict, L, godotBin: GODOT, out, seconds: 120, keep: false };
    const rows = [];
    try {
      for (const f of FIXTURES) rows.push(await fixtureRow(f.id, ctx));
    } finally {
      if (!process.env.MOJULO_KEEP_PACK) fs.rmSync(out, { recursive: true, force: true });
    }
    console.log(`\n${formatMatrix(rows)}\n`);
    expect(rows.map((r) => r.id)).toEqual(FIXTURES.map((f) => f.id));
    for (const r of rows) {
      if (!FIXTURE_QUICK[r.id]) { expect(r.note, r.id).toBeTruthy(); continue; }
      expect({ id: r.id, minted: r.minted, exports: r.exports, imports: r.imports, error: r.godotError ?? null }).toEqual({ id: r.id, minted: true, exports: true, imports: true, error: null });
      expect(r.control.web, `${r.id}: stay-put ends nothing on the web`).toBe(true);
      expect(['plays', 'plays-partly', 'hollow'], r.id).toContain(r.verdict);
      // a hero's figure ships skinned (IV1): one mesh, its clips, its face and its ink
      if (FIXTURE_QUICK[r.id].hero) expect(r.skinned.length, `${r.id}: the hero ships skinned`).toBeGreaterThan(0);
      // what the export says plays must play the same: the hollow-game catcher
      if (r.verdict === 'plays') expect({ id: r.id, win: r.win, control: r.control, equal: r.equal }).toEqual({ id: r.id, win: { web: true, webAt: r.win.webAt, godot: true }, control: { web: true, godot: true }, equal: true });
    }
  });
});
