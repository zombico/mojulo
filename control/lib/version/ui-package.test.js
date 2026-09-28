// The dashboard ships as its own package at core's exact version (ui-package.js says why). A
// release packs both from one checkout, so the two manifests must agree before either is packed:
// a dashboard built against 3.0.0's schema and published as 3.0.1, or one pinned to a core it
// was not built with, would open the operator's database with different code than the stdio
// server. The stager refuses to pack when this test would fail.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME, UI_STANDALONE_DIR } from './ui-package.js';
import {
  CONTROL_DIR,
  UI_PACKAGE_DIR,
  derivedUiFields,
  readJson,
  uiManifestProblems,
} from '../../scripts/ui-package-manifest.mjs';

const core = readJson(path.join(CONTROL_DIR, 'package.json'));
const ui = readJson(path.join(UI_PACKAGE_DIR, 'package.json'));

describe('dashboard package manifest', () => {
  it('is in step with core (else run `npm run ui:sync` in control/)', () => {
    expect(uiManifestProblems(core, ui)).toEqual([]);
    expect(ui.name).toBe(UI_PACKAGE_NAME);
    expect(ui.version).toBe(core.version);
    expect(ui.dependencies.mojulo).toBe(core.version);
  });

  it('ships its bin and its standalone build, and no bot template (it left with the chatbot factory)', () => {
    expect(existsSync(path.join(UI_PACKAGE_DIR, ui.bin[UI_PACKAGE_BIN]))).toBe(true);
    expect(ui.files).toContain(`${UI_STANDALONE_DIR}/`);
    expect(ui.files.filter((entry) => entry.includes('lite-template'))).toEqual([]);
  });

  it('does not reuse a core bin name, which would collide in one node_modules/.bin', () => {
    expect(Object.keys(core.bin)).not.toContain(UI_PACKAGE_BIN);
    expect(core.bin['mojulo-ui']).toBe('./scripts/mcp-ui.mjs');
  });

  it('declares each shared package with core\'s range, in the same field', () => {
    const derived = derivedUiFields(core, ui);
    expect(derived.dependencies['better-sqlite3']).toBe(core.dependencies['better-sqlite3']);
    for (const [name, range] of Object.entries(derived.optionalDependencies ?? {})) {
      expect(core.optionalDependencies[name]).toBe(range);
    }
  });
});

describe('core package manifest', () => {
  it('ships no dashboard build and no bot template', () => {
    const leaked = core.files.filter((entry) => /(^|!)(\.next|lite-template)\//.test(entry));
    expect(leaked).toEqual([]);
    expect(core.files).toContain('scripts/ui-launch.mjs');
  });

  it('keeps `open` off its runtime dependencies (only the dashboard opens a browser)', () => {
    expect(core.dependencies.open).toBeUndefined();
    expect(ui.dependencies.open).toBeTruthy();
  });
});
