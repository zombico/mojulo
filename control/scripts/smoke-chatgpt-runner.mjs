#!/usr/bin/env node
// Package + CLI smoke: two isolated homes, no browser; network only for npm.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = path.resolve(control, '../plugins/mojulo-chatgpt/skills/mojulo/scripts/runner.mjs');
const [flag, workDir] = process.argv.slice(2);
if (flag !== '--work-dir' || !workDir || !path.isAbsolute(workDir) || process.argv.length !== 4) throw new Error('Use --work-dir /absolute/scratch-directory');
fs.mkdirSync(workDir, { recursive: true });
const root = fs.mkdtempSync(path.join(workDir, 'chatgpt-smoke-'));
const version = JSON.parse(fs.readFileSync(path.join(control, 'package.json'))).version;
const env = { ...process.env, MOJULO_DISABLE_SCENE_WARM: '1', MOJULO_SEMANTIC_INDEX_DISABLED: '1' };
function execute(binary, args, cwd = root) {
  const r = spawnSync(binary, args, { cwd, env, encoding: 'utf8', timeout: 600000, maxBuffer: 20 * 1024 * 1024 });
  fs.appendFileSync(path.join(root, 'smoke.log'), `$ ${binary} ${args.join(' ')}\n${r.stderr || ''}\n`);
  if (r.error || r.status !== 0) throw new Error(`Failed (${r.status}): ${args.join(' ')}\n${r.error?.message || ''}\n${r.stderr}\n${r.stdout}`);
  return r.stdout;
}
function run(workspace, command, args = [], raw = false) {
  const out = execute(process.execPath, [runner, command, '--workspace', workspace, '--version', version, ...args]);
  return raw ? out : JSON.parse(out);
}
const call = (workspace, tool, input = {}) => run(workspace, 'exec', ['--', 'call', tool, '--json', JSON.stringify(input)]);
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const first = path.join(root, 'first'), second = path.join(root, 'second'), ref = 'sk_chatgpt_resume';
console.log(`Packing branch into ${root}`);
const packed = execute('npm', ['pack', '--json', '--silent', '--pack-destination', root], control);
const tarball = path.join(root, JSON.parse(packed.slice(packed.indexOf('[')))[0].filename);
console.log('Installing tarball into the first workspace');
assert.equal(run(first, 'status').installed, null);
assert.equal(fs.existsSync(first), false);
run(first, 'install', ['--tarball', tarball]);
assert.equal(run(first, 'install', ['--tarball', tarball]).reused, true);
assert.match(run(first, 'exec', ['--', 'orient'], true), /chatgpt/);
assert.equal(call(first, 'get_adapter').id, 'chatgpt');
call(first, 'version');
console.log('Minting, exporting, editing the same ref, and checkpointing');
call(first, 'compose_world', { base: 'city', seed: 91, ref, title: 'Resume smoke', overrides: { context: { depth: 2 }, region: { x: 0, y: 0, w: 16, d: 16 } } });
const before = call(first, 'export_model', { ref, format: 'glb' });
const beforeHash = digest(before.path);
call(first, 'update_sketch', { ref, patch: [{ op: 'set', path: '/seed', value: 92 }] });
const model = call(first, 'export_model', { ref, format: 'glb' });
assert.notEqual(digest(model.path), beforeHash, 'editing seed changes geometry');
assert.equal(model.handoff.host, 'chatgpt');
assert.equal(model.handoff.door, 'session-file');
const exported = call(first, 'export_model', { ref, format: 'bundle' });
const recipe = path.join(exported.dir, 'recipe.json'), capsule = path.join(root, 'resume.json');
run(first, 'checkpoint', ['--recipe', recipe, '--ref', ref, '--title', 'Resume smoke', '--out', capsule]);
console.log('Installing into a fresh home and restoring through create_sketch');
run(second, 'install', ['--tarball', tarball]);
run(second, 'restore', ['--capsule', capsule]);
const restored = call(second, 'export_model', { ref, format: 'bundle' });
assert.notEqual(exported.dir, restored.dir);
for (const name of ['recipe.json', 'model.glb', 'world.html']) assert.equal(digest(path.join(exported.dir, name)), digest(path.join(restored.dir, name)), `${name} survives recovery byte-for-byte`);
assert.equal(digest(exported.path), digest(restored.path), 'bundle survives recovery byte-for-byte');
const duplicate = spawnSync(process.execPath, [runner, 'restore', '--workspace', second, '--version', version, '--capsule', capsule], { env, encoding: 'utf8', timeout: 180000 });
assert.notEqual(duplicate.status, 0);
assert.match(duplicate.stdout + duplicate.stderr, /exists|REF_EXISTS/i);
const again = call(second, 'export_model', { ref, format: 'glb' });
assert.equal(digest(again.path), digest(model.path));
const report = { ok: true, version, tarball: path.basename(tarball), tarballSha256: digest(tarball), ref, recipeSha256: digest(recipe), modelSha256: digest(model.path), bundleSha256: digest(exported.path), checks: ['pinned install and reuse', 'shell adapter selection', 'edit in place', 'checkpoint', 'fresh-home restore', 'byte-identical recipe/model/page/bundle', 'duplicate-ref refusal'], chatgptFieldTest: false };
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, workDir: root }, null, 2));
