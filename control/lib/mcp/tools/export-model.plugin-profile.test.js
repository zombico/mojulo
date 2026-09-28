// Under the Claude plugin profile (lib/mcp/plugin-profile.js) an exported World page is always the
// self-contained one: `cdn: true` is ignored, `world.html` is written, and the result says so in one
// line. Under every other distribution `cdn: true` still writes world.cdn.html.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-profile-outcomes-'));

import { composeWorld } from './compose-world.js';
import { exportModelHandler } from './sketch-model-export.js';

const saved = process.env.MOJULO_DISTRIBUTION;
afterEach(() => {
  if (saved === undefined) delete process.env.MOJULO_DISTRIBUTION;
  else process.env.MOJULO_DISTRIBUTION = saved;
});

const TOWN = { base: 'city', seed: 7, overrides: { context: { depth: 2 }, region: { x: 0, y: 0, w: 16, d: 16 } } };

describe('export_model format:html under the Claude plugin profile', () => {
  it('ignores cdn: true, writes the self-contained world.html, and says so', async () => {
    const minted = composeWorld({ ...TOWN, ref: 'sk_profile_town' });
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const r = await exportModelHandler({ ref: minted.ref, format: 'html', cdn: true });
    expect(r.ok).toBe(true);
    expect(r.cdn).toBe(false);
    expect(path.basename(r.path)).toBe('world.html');
    expect(r.note).toMatch(/`cdn: true` was ignored: the Claude plugin build of mojulo writes only this self-contained page\./);
    const html = readFileSync(r.path, 'utf8');
    expect(html).not.toMatch(/cdn\.jsdelivr\.net/);
    expect(existsSync(path.join(path.dirname(r.path), 'world.cdn.html'))).toBe(false);

    const plain = await exportModelHandler({ ref: minted.ref, format: 'html' });
    expect(plain.note).not.toMatch(/cdn/);
  });

  it('still writes world.cdn.html for cdn: true under the npm distribution', async () => {
    const minted = composeWorld({ ...TOWN, ref: 'sk_npm_town' });
    process.env.MOJULO_DISTRIBUTION = 'npm';
    const r = await exportModelHandler({ ref: minted.ref, format: 'html', cdn: true });
    expect(r.cdn).toBe(true);
    expect(path.basename(r.path)).toBe('world.cdn.html');
  });
});
