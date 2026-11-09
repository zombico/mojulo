// THE WORLD MAP, WALKED (an e2e suite: a real browser, skipped when none is installed): the sample's four zones built to
// a folder (scripts/worldmap.mjs), served and walked gate by gate in headless Chrome, every crossing loading the zone
// across and setting the walker down at that gate's arrival.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { resolveChromium } from '../scene/chromium.js';

describe('the world map test bed', () => {
  it('crosses every gate of the sample, each into the zone across, set down at its arrival', async () => {
    try { await resolveChromium({ allowFetch: false }); } catch { return; }
    const out = path.join(os.tmpdir(), `mojulo-worldmap-test-${process.pid}`);
    const r = spawnSync(process.execPath, ['scripts/worldmap.mjs', '--walk', '--out', out, '--port', String(4500 + (process.pid % 400))], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    const said = `${r.stdout}\n${r.stderr}`;
    expect(said).toMatch(/walk: 10 crossings, 0 set down far from their gate; page errors: none/);
    expect(r.status, said).toBe(0);
  }, 660000);
});
