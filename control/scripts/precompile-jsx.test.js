// The published stdio server loads CreationMap.jsx from its prepack twin, never through
// @swc/core (a devDependency). Install surface: if the twin stops shipping or stops being
// served, every diagram SVG render on an npm install fails.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { precompileJsx, shippedJsx } from './precompile-jsx.mjs';
import { load, readPrecompiled, PRECOMPILED_SUFFIX } from './mcp-stdio-loader.mjs';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8'));

describe('precompiled JSX — packaging', () => {
  it('ships a twin for every .jsx it ships, and runs the precompile at prepack', () => {
    const jsx = shippedJsx(pkg);
    expect(jsx).toContain('components/graph/CreationMap.jsx');
    for (const f of jsx) expect(pkg.files).toContain(f + PRECOMPILED_SUFFIX);
    expect(pkg.scripts.prepack).toMatch(/node scripts\/precompile-jsx\.mjs/);
  });

  it('keeps @swc/core out of the installed dependencies', () => {
    expect(pkg.dependencies).not.toHaveProperty('@swc/core');
    expect(pkg.optionalDependencies ?? {}).not.toHaveProperty('@swc/core');
    expect(pkg.devDependencies).toHaveProperty('@swc/core');
  });
});

describe('precompiled JSX — the loader', () => {
  let tmp;
  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'mojulo-jsx-'));
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('serves a fresh twin, and ignores one compiled from a different source', async () => {
    const file = path.join(tmp, 'Widget.jsx');
    writeFileSync(file, 'export default function Widget() { return <b>fresh</b>; }\n');
    precompileJsx(file);
    const twin = readFileSync(file + PRECOMPILED_SUFFIX, 'utf8');
    expect(readPrecompiled(file, readFileSync(file, 'utf8'))).toBe(twin);

    const url = pathToFileURL(file).href;
    const served = await load(url, {}, () => { throw new Error('nextLoad must not run for .jsx'); });
    expect(served).toMatchObject({ format: 'module', shortCircuit: true, source: twin });

    // An edit after prepack (a dev checkout) leaves the twin stale: it is not served, and the
    // .jsx is compiled from its current source instead.
    writeFileSync(file, 'export default function Widget() { return <i>edited</i>; }\n');
    expect(readPrecompiled(file, readFileSync(file, 'utf8'))).toBe(null);
    const recompiled = await load(url, {}, () => null);
    expect(recompiled.source).toContain('edited');
    expect(recompiled.source).not.toMatch(/^\/\/ mojulo-precompiled/);
  });

  // The real component, loaded through the real loader in a child process where @swc/core
  // cannot be resolved in any thread. The tree mirrors the package layout: the loader's `@/`
  // alias resolves against its own parent directory.
  it('loads and renders CreationMap from its twin with @swc/core unresolvable', () => {
    const root = path.join(tmp, 'pkg');
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'components', 'graph'), { recursive: true });
    mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    copyFileSync(path.join(CONTROL_DIR, 'scripts', 'mcp-stdio-loader.mjs'), path.join(root, 'scripts', 'mcp-stdio-loader.mjs'));
    const jsx = path.join(root, 'components', 'graph', 'CreationMap.jsx');
    copyFileSync(path.join(CONTROL_DIR, 'components', 'graph', 'CreationMap.jsx'), jsx);
    symlinkSync(path.join(CONTROL_DIR, 'lib'), path.join(root, 'lib'), 'dir');
    for (const dep of ['react', 'react-dom']) {
      symlinkSync(path.join(CONTROL_DIR, 'node_modules', dep), path.join(root, 'node_modules', dep), 'dir');
    }
    const entry = path.join(root, 'entry.mjs');
    writeFileSync(entry, [
      "import { register } from 'node:module';",
      "register('./scripts/mcp-stdio-loader.mjs', import.meta.url);",
      "const [{ createElement }, { renderToStaticMarkup }, { default: CreationMap }] = await Promise.all([",
      "  import('react'), import('react-dom/server'), import('@/components/graph/CreationMap')]);",
      "const manifest = { viewBox: { width: 200, height: 80 }, marks: [{ kind: 'text', x: 10, y: 40, value: 'TWIN' }] };",
      'process.stdout.write(renderToStaticMarkup(createElement(CreationMap, { manifest })));',
    ].join('\n'));
    const run = () => spawnSync(process.execPath, ['--require', path.join(CONTROL_DIR, 'scripts', 'boot-guard-hook.cjs'), entry], {
      cwd: root,
      env: { ...process.env, MOJULO_BLOCK_MODULES: '@swc/core' },
      encoding: 'utf8',
    });

    precompileJsx(jsx);
    const ok = run();
    expect(ok.stderr).not.toMatch(/\[boot-guard\] blocked/);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/^<svg[\s>]/);
    expect(ok.stdout).toContain('TWIN');

    // Without a usable twin the loader reaches for swc, and says what is missing.
    writeFileSync(jsx + PRECOMPILED_SUFFIX, '// not a twin\nexport default null;\n');
    const stale = run();
    expect(stale.status).not.toBe(0);
    expect(stale.stderr).toMatch(/\[boot-guard\] blocked @swc\/core/);
    expect(stale.stderr).toMatch(/has no up-to-date precompiled twin \(CreationMap\.jsx\.mjs/);
  });
});
