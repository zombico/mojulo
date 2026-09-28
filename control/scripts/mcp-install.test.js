// `mojulo install recall` with the embedding runtime already in place and its model missing: it
// fetches the model rather than reporting "nothing to do", because the Claude plugin build never
// fetches the model on its own (lib/embedder/local.js) and names this command as the way to get it.
// A failed fetch names a remedy that works under each distribution.
//
// The runtime is a stand-in shim in a throwaway $MOJULO_HOME/recall (the layout `install recall`
// writes): its `pipeline` writes the model file the fetch script checks for, or fails when
// STUB_FAIL is set. Nothing is downloaded.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STDIO = path.join(CONTROL_DIR, 'scripts', 'mcp-stdio.mjs');
const MODEL = ['Xenova', 'multilingual-e5-small', 'onnx', 'model_quantized.onnx'];

const STUB = `import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
export const env = {};
export async function pipeline() {
  if (process.env.STUB_FAIL) throw new Error('stub: the model host is unreachable');
  const dir = path.join(env.cacheDir, 'Xenova', 'multilingual-e5-small', 'onnx');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'model_quantized.onnx'), 'stub');
  return async () => ({ dims: [1, 384] });
}
`;

let home;
beforeEach(() => {
  home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-install-recall-'));
  const pkg = path.join(home, 'recall', 'node_modules', '@huggingface', 'transformers');
  mkdirSync(pkg, { recursive: true });
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@huggingface/transformers', version: '4.2.0' }));
  writeFileSync(path.join(home, 'recall', 'entry.mjs'), STUB);
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

function installRecall(distribution, extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
    !k.startsWith('MOJULO_') && !['SQLITE_PATH', 'STUB_FAIL'].includes(k)));
  Object.assign(env, { HOME: home, USERPROFILE: home, MOJULO_HOME: home, MOJULO_DISTRIBUTION: distribution }, extra);
  const r = spawnSync(process.execPath, [STDIO, 'install', 'recall'], { cwd: CONTROL_DIR, env, encoding: 'utf8', timeout: 60_000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('install recall with the runtime present and the model missing', () => {
  it('fetches the model, then has nothing left to do', { timeout: 120_000 }, () => {
    const first = installRecall('claude-plugin');
    expect(first.code, first.stderr).toBe(0);
    expect(first.stdout).toMatch(/The embedding runtime is installed, but its model is not in/);
    expect(first.stdout).toMatch(/Recall group installed\./);
    expect(existsSync(path.join(home, 'models', ...MODEL))).toBe(true);

    const again = installRecall('claude-plugin');
    expect(again.code).toBe(0);
    expect(again.stdout).toMatch(/already installed .* Nothing to do\./);
  });

  it('on a failed fetch under the plugin, says to run it again, not that the server will fetch it', { timeout: 120_000 }, () => {
    const r = installRecall('claude-plugin', { STUB_FAIL: '1' });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toMatch(/model fetch failed\. Run `npx -y mojulo@[^`]+ install recall` again to retry\./);
    expect(r.stderr).not.toMatch(/fetches it when it next starts/);
    expect(existsSync(path.join(home, 'models', ...MODEL))).toBe(false);
  });

  it('on a failed fetch from npm, also says the server fetches it at its next start', { timeout: 120_000 }, () => {
    const r = installRecall('npm', { STUB_FAIL: '1' });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toMatch(/again to retry; the MCP server also fetches it when it next starts/);
  });
});
