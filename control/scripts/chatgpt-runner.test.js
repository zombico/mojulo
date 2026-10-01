import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VERSION, parseArgs, locations, status, runnerEnv, nodeSupported, install, checkpoint, readCapsule } from '../../plugins/mojulo-chatgpt/skills/mojulo/scripts/runner.mjs';

const runner = fileURLToPath(new URL('../../plugins/mojulo-chatgpt/skills/mojulo/scripts/runner.mjs', import.meta.url));
const dirs = [];
const workspace = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-runner-')); dirs.push(dir); return dir; };
const options = (dir, command = 'status', extra = []) => parseArgs([command, '--workspace', dir, ...extra]);
function fakePackage(opts) {
  const loc = locations(opts);
  fs.mkdirSync(path.join(loc.packageRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(loc.packageRoot, 'package.json'), JSON.stringify({ name: 'mojulo', version: opts.version }));
  fs.writeFileSync(path.join(loc.packageRoot, 'scripts/mcp-stdio.mjs'), `process.stdout.write(JSON.stringify({ args:process.argv.slice(2), home:process.env.MOJULO_HOME, db:process.env.SQLITE_PATH, host:process.env.MOJULO_HOST, surface:process.env.MOJULO_SURFACE }));`);
}
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('ChatGPT Work runner', () => {
  it('keeps the default runtime pin aligned with the release package', () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
    expect(DEFAULT_VERSION).toBe(pkg.version);
  });
  it('status creates no workspace, state or database', () => {
    const dir = path.join(workspace(), 'not-created');
    const report = status(options(dir));
    expect(report.ok).toBe(false);
    expect(report.installed).toBeNull();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('requires a pinned version and explicit workspace; rejects stdio/installer passthrough', () => {
    for (const version of ['latest', '^3.0.0', '2.1.0', '3']) expect(() => options('/tmp/example', 'status', ['--version', version])).toThrow(/exact/);
    expect(() => options('relative')).toThrow(/absolute/);
    expect(() => options('/tmp/example', 'exec', ['--', 'init'])).toThrow(/exec requires/);
    expect(() => options('/tmp/example', 'install', ['--package-root', '/existing'])).toThrow(/cannot modify/);
    expect(nodeSupported('22.11.0')).toBe(false);
    expect(nodeSupported('22.13.1')).toBe(false);   // better-sqlite3 crashes below 22.14
    expect(nodeSupported('22.14.0')).toBe(true);
    expect(nodeSupported('24.0.0')).toBe(true);
  });

  it('isolates inherited database, storage, renderer cache and host identity', () => {
    const opts = options(workspace());
    const env = runnerEnv(opts, { SQLITE_PATH: '/operator/db', MOJULO_OUTCOMES_DIR: '/operator/exports', MOJULO_CONTROL_DIR: '/old/package', MOJULO_DISTRIBUTION: 'claude-plugin', MOJULO_HOST: 'codex', PATH: '/usr/bin' });
    const loc = locations(opts);
    expect(env.SQLITE_PATH).toBe(path.join(loc.home, 'data/mojulo-lite.db'));
    expect(env.MOJULO_OUTCOMES_DIR).toBe(path.join(loc.home, 'data/outcomes'));
    expect(env.MOJULO_CONTROL_DIR).toBe(loc.packageRoot);
    expect(env.MOJULO_HOST).toBe('chatgpt');
    expect(env.MOJULO_SURFACE).toBe('box');
    expect(env.MOJULO_DISTRIBUTION).toBe('npm');
    expect(env.PATH).toBe('/usr/bin');
  });

  it('exec forwards CLI arguments intact through a fresh process', () => {
    const dir = workspace();
    fakePackage(options(dir));
    const args = ['call', 'create_sketch', '--json', '{"title":"literal $(no-shell)"}'];
    const result = spawnSync(process.execPath, [runner, 'exec', '--workspace', dir, '--', ...args], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.args).toEqual(args);
    expect(out.host).toBe('chatgpt');
    expect(out.home).toBe(locations(options(dir)).home);
    const relative = spawnSync(process.execPath, [runner, 'exec', '--workspace', dir, '--', 'call', 'create_sketch', '--json', '@args.json'], { encoding: 'utf8' });
    expect(relative.status).toBe(0);
    expect(JSON.parse(relative.stdout).args.at(-1)).toBe('@' + path.join(dir, 'args.json'));
  });

  it('installs only the exact source, reuses it, and refuses replacement with different bytes', () => {
    const dir = workspace();
    const tarball = path.join(dir, 'branch.tgz');
    fs.writeFileSync(tarball, 'first build');
    const opts = options(dir, 'install', ['--tarball', tarball]);
    const spawn = vi.fn(() => { fakePackage(opts); return { status: 0 }; });
    const installed = install(opts, spawn);
    expect(installed.reused).toBe(false);
    expect(spawn.mock.calls[0][1].at(-1)).toBe(tarball);
    expect(spawn.mock.calls[0][1]).toContain('--save-exact');
    expect(install(opts, spawn).reused).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
    fs.writeFileSync(tarball, 'second build');
    expect(() => install(opts, spawn)).toThrow(/different or unrecorded/);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('does not report success or write a receipt when npm fails', () => {
    const opts = options(workspace(), 'install');
    expect(() => install(opts, () => ({ status: 1 }))).toThrow(/npm install failed/);
    expect(fs.existsSync(locations(opts).receipt)).toBe(false);
  });

  it('checkpoints exact manifest bytes semantically and rejects overwrite/tampering/version drift', () => {
    const dir = workspace();
    fakePackage(options(dir));
    const recipe = path.join(dir, 'recipe.json');
    const out = path.join(dir, 'resume.json');
    const manifest = { kind: 'fractal-city', seed: 42 };
    fs.writeFileSync(recipe, JSON.stringify(manifest));
    const opts = options(dir, 'checkpoint', ['--recipe', recipe, '--out', out, '--ref', 'sk_resume', '--title', 'City']);
    expect(checkpoint(opts).ok).toBe(true);
    expect(() => checkpoint(opts)).toThrow(/EEXIST/);
    const restoreOpts = options(dir, 'restore', ['--capsule', out]);
    expect(readCapsule(restoreOpts)).toEqual({ title: 'City', ref: 'sk_resume', manifest });
    expect(() => readCapsule({ ...restoreOpts, version: '3.0.1' })).toThrow(/needs Mojulo 3.0.0/);
    const edited = JSON.parse(fs.readFileSync(out));
    edited.restore.manifest.seed = 99;
    fs.writeFileSync(out, JSON.stringify(edited));
    expect(() => readCapsule(restoreOpts)).toThrow(/hash mismatch/);
  });

  it('the Work-box guide says restore itself runs a recipe\'s program, so it is read before restoring', () => {
    const guide = fs.readFileSync(new URL('../../plugins/mojulo-chatgpt/skills/mojulo/references/work-box.md', import.meta.url), 'utf8');
    expect(guide).toMatch(/so restore itself runs it\. Before restoring a capsule or recipe received from\s+elsewhere, read `capsule\.restore\.manifest\.program` as code\./);
    expect(guide).not.toMatch(/before rendering a recipe received from elsewhere/);
  });

  it('requires the same development tarball for recovery, even at the same version', () => {
    const dir = workspace();
    const tarball = path.join(dir, 'branch.tgz');
    fs.writeFileSync(tarball, 'build');
    install(options(dir, 'install', ['--tarball', tarball]), () => { fakePackage(options(dir)); return { status: 0 }; });
    const recipe = path.join(dir, 'recipe.json');
    const out = path.join(dir, 'resume.json');
    fs.writeFileSync(recipe, '{"kind":"fractal-city","seed":1}');
    checkpoint(options(dir, 'checkpoint', ['--recipe', recipe, '--out', out, '--ref', 'city', '--title', 'City']));
    expect(readCapsule(options(dir, 'restore', ['--capsule', out])).ref).toBe('city');
    const other = workspace();
    fakePackage(options(other));
    expect(() => readCapsule(options(other, 'restore', ['--capsule', out]))).toThrow(/original development tarball/);
  });
});
