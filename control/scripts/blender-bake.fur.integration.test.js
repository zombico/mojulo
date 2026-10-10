// The fur finish's machine gate (scripts/blender-bake.mjs --fur): a character minted in a scratch home, furred by a
// real headless Blender, leaves its stills, its .blend and a fur.json naming what grew. Skipped where no Blender is
// installed (CI): an optional worker is never a dependency. The eyes gate (does it read as plush?) is the operator's.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CONTROL = path.resolve(import.meta.dirname, '..');
const BLENDER = process.env.MOJULO_BLENDER
  || ['/Applications/Blender.app/Contents/MacOS/Blender', '/opt/homebrew/bin/blender', '/usr/bin/blender'].find(existsSync);

const MINT = `
import path from 'node:path'; import { register } from 'node:module'; import { pathToFileURL } from 'node:url';
register(pathToFileURL(path.join(${JSON.stringify(CONTROL)}, 'scripts/mcp-stdio-loader.mjs')).href, import.meta.url);
const { resolveMojuloPaths } = await import(pathToFileURL(path.join(${JSON.stringify(CONTROL)}, 'scripts/mojulo-paths.mjs')).href);
resolveMojuloPaths(); process.chdir(${JSON.stringify(CONTROL)}); console.log = console.error;
const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character');
const r = await createCharacterHandler({ as: 'hero', ref: 'fur_gate', title: 'fur gate', spec: { cast: 'chibi', register: 'round', headScale: 1.4 } });
process.stdout.write(JSON.stringify({ ok: r.ok }) + '\\n'); process.exit(0);
`;

describe.skipIf(!BLENDER)('blender-bake --fur (real Blender)', () => {
  it('furs a minted character: stills, a .blend and fur.json, the eyes left bare', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'moj-fur-gate-'));
    const env = { ...process.env, MOJULO_HOME: home, MOJULO_OUTCOMES_DIR: path.join(home, 'outcomes') };
    try {
      const mint = spawnSync(process.execPath, ['--input-type=module', '-e', MINT], { env, encoding: 'utf8' });
      expect(mint.stdout, mint.stderr).toContain('"ok":true');
      const run = spawnSync(process.execPath, [
        path.join(CONTROL, 'scripts/blender-bake.mjs'), '--ref', 'fur_gate', '--fur', '--fur-short', 'Skin',
        '--samples', '4', '--res', '96x96', '--views', 'front:0', '--blend', '--blender', BLENDER,
      ], { cwd: CONTROL, env, encoding: 'utf8' });
      const result = JSON.parse(run.stdout.trim().split('\n').pop());
      expect(result.ok, run.stdout + run.stderr).toBe(true);
      expect(result.mode).toBe('fur');
      for (const p of [...result.stills, result.blend]) expect(existsSync(p), p).toBe(true);
      const record = JSON.parse(readFileSync(path.join(home, 'outcomes', 'fur_gate', 'fur', 'fur.json'), 'utf8'));
      expect(Object.keys(record.fur.colors)).toContain('Skin');
      expect(Object.keys(record.fur.colors)).not.toContain('Sclera');
      expect(record.fur.short).toEqual(['Skin']);
      expect(record.source_glb_sha256).toMatch(/^[0-9a-f]{64}$/);
      // what Blender grew, from its log: furred groups only, never an eye
      const grown = JSON.parse((run.stdout.match(/MOJ_FUR (\[.*\])/) || [])[1] || '[]').map((g) => g.mesh);
      expect(grown).toContain('fur:Skin');
      expect(grown.some((m) => /Sclera|Iris|Pupil/.test(m))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }, 600_000);
});
