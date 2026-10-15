/**
 * THE GODOT HARNESS — a level as a payload (faces, entities, events, a game contract), made into a Godot world pack
 * and played by the same input in both engines (lib/graph/game/level-equivalence.js; scripts/godot-level-sim.gd), so a
 * kernel part is held to its web twin frame by frame on a level small enough to say what it tests. The fixture matrix
 * (scripts/godot-fixture-matrix.mjs) does the same on whole minted games.
 *
 *   writeHarnessPack(dir, payload, { ref })  → the pack: score.json, bus.json, contract.json, model.glb, the kernel,
 *                                               and the harness autoload; imported once
 *   playInGodot(dir, payload, frames, godot) → { keys: [key], states: [state], error }
 *   playBoth(payload, frames, { godot, dir?, mutate?, params? })→ { web, godot, compare }   (compare: level-equivalence.js compareKeys)
 *                                            params: the session's (game-init's) params, both engines start with them
 *
 * PLANTED BUGS: `mutate: [{ file, from, to }]` edits the pack's copy of the kernel (never the source) before it runs,
 * so a test can hold that each plant (a flipped comparison, a dropped key, an off-by-one tick) breaks the equality.
 * A plant whose `from` is not in the file throws: a plant that no longer applies is a hole, not a pass.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractEngineScore, extractBus } from './engine-score.js';
import { emitGodotProject } from './godot-project.js';
import { facesToGlb } from './scene-gltf.js';
import { bakeFps, bakeImport } from './godot-bake.js';
import { normalizeLevelContract } from '../game/level-contract.js';
import { playScript, keyEntities, compareKeys } from '../game/level-equivalence.js';

const KERNEL = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
const SIM_GD = () => path.join(process.cwd(), 'scripts', 'godot-level-sim.gd');
const SCRIPT_ERR = /SCRIPT ERROR|Parse Error|Failed to load script|Cannot open file|Failed loading resource/;

export function writeHarnessPack(dir, payload, { ref = 'harness', godot, mutate = [] } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const score = extractEngineScore({ ref, manifest: {} }, payload);
  const bus = extractBus(payload);
  const { files } = emitGodotProject({ ref, score, manifestHash: 'harness', kernelVersion: 'harness' });
  for (const f of files) {
    const text = f.file === 'project.godot' ? `${f.text}\n[autoload]\n\nMojuloSim="*res://sim/godot-level-sim.gd"\n` : f.text;
    fs.mkdirSync(path.dirname(path.join(dir, f.file)), { recursive: true });
    fs.writeFileSync(path.join(dir, f.file), text);
  }
  const glb = facesToGlb(payload, { generator: `mojulo ${ref}` }).bytes, fps = bakeFps(glb);
  fs.writeFileSync(path.join(dir, 'model.glb'), glb);
  // the bake rate the GLB's clips' keys land on, as a pack writes it (godot-pack.js writePack)
  if (fps != null) fs.writeFileSync(path.join(dir, 'model.glb.import'), bakeImport(fps));
  fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(score, null, 2));
  if (bus) fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(bus));
  // the level's contract as the shell reads it; a hand-made payload's own on and audits, with what a level produces
  if (payload.game) fs.writeFileSync(path.join(dir, 'contract.json'), JSON.stringify(normalizeLevelContract({ levelRef: ref, produces: { events: [], results: ['success', 'fail', 'abort'] }, consumes: [], ...payload.game })));
  fs.cpSync(KERNEL(), path.join(dir, 'kernel'), { recursive: true });
  for (const { file, from, to } of mutate) {
    const p = path.join(dir, 'kernel', file), src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) throw new Error(`plant does not apply: kernel/${file} has no '${from}'`);
    fs.writeFileSync(p, src.replace(from, to));
  }
  fs.mkdirSync(path.join(dir, 'sim'), { recursive: true });
  fs.copyFileSync(SIM_GD(), path.join(dir, 'sim', 'godot-level-sim.gd'));
  if (godot) spawnSync(godot, ['--headless', '--path', dir, '--import'], { encoding: 'utf8', timeout: 300000 });
  return { score, bus };
}

export function playInGodot(dir, payload, frames, godot, { params = null } = {}) {
  const ids = keyEntities(payload);
  const feet = Object.fromEntries((payload.entities || []).filter((e) => ids.includes(e.id) && Number.isFinite(e.rule?.eye)).map((e) => [e.id, e.rule.eye]));
  const file = path.join(dir, 'sim', `run-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({ ref: 'harness', frames, ids, feet, ...(params ? { params } : {}) }));
  const r = spawnSync(godot, ['--headless', '--fixed-fps', '30', '--path', dir, '--', `--mojulo-sim=${file}`], { encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 30 });
  const text = `${r.stdout || ''}${r.stderr || ''}`, keys = [], states = [];
  for (const l of text.split('\n')) {
    const m = /^\[mojulo-sim\] (\d+) (\w+) (.*)$/.exec(l);
    if (m) { keys[+m[1]] = m[3]; states[+m[1]] = m[2]; }
  }
  const err = SCRIPT_ERR.exec(text);
  return { keys, states, error: err ? `${err[0]}: ${text.split('\n').find((l) => SCRIPT_ERR.test(l))}` : r.status !== 0 ? `exit ${r.status ?? r.error?.code ?? r.signal}` : null, text };
}

export function playBoth(payload, frames, { godot, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-harness-')), keep = false, mutate = [], params = null } = {}) {
  try {
    writeHarnessPack(dir, payload, { godot, mutate });
    const web = playScript(payload, frames, { params });
    const gd = playInGodot(dir, payload, frames, godot, { params });
    return { web, godot: gd, compare: compareKeys(web.keys, gd.keys) };
  } finally {
    if (!keep && !process.env.MOJULO_KEEP_PACK) fs.rmSync(dir, { recursive: true, force: true });
  }
}
