/**
 * The arcade leg (godot-arcade.js): a pixelizer game becomes a Godot pack —
 * data + the separate arcade kernel — instead of a refusal. The replay
 * fixture is the parity contract with kernel/brickster.gd; here we pin what
 * the JS side promises (the fixture exercises every action, clears lines, and
 * the parse/compare round trip that the driver runs on the kernel's line).
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, it, expect, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportGameHandler } from '@/lib/mcp/tools/export-game';
import { buildPixelizerGameManifest } from '@/lib/graph/pixelizer/pixelizer-games';
import { BANK, LEGEND } from '@/lib/graph/pixelizer/brickster-skin';
import { newGame, step } from '@/lib/graph/pixelizer/brickster-core';
import { buildReplayFixture, digest, parseReplayLine, compareReplay, parsePerfLine, REPLAY_SEED } from '@/lib/graph/pixelizer/brickster-replay';
import { emitGodotArcade, buildGodotArcadePack } from './godot-arcade.js';
import { buildGodotGamePack, buildGodotWorldPack } from './godot-pack.js';

const OUT = mkdtempSync(path.join(tmpdir(), 'godot-arcade-test-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;
afterAll(() => { rmSync(OUT, { recursive: true, force: true }); closeDb(); });

const fileText = (files, name) => files.find((f) => f.file === name)?.text ?? '';

describe('replay fixture — the parity contract', () => {
  const fixture = buildReplayFixture();

  it('is deterministic, clears lines, climbs a level, and touches every action kind', () => {
    expect(buildReplayFixture()).toEqual(fixture);
    expect(fixture.seed).toBe(REPLAY_SEED);
    expect(fixture.steps).toBe(fixture.actions.length);
    expect(fixture.expected.lines).toBeGreaterThanOrEqual(10);   // level ≥ 1 ⇒ the scoring multiplier is exercised
    const kinds = new Set(fixture.actions);
    for (const k of ['left', 'right', 'cw', 'ccw', 'softDrop', 'hardDrop', 'hold', 'tick', 'restart']) expect(kinds.has(k)).toBe(true);
    expect(fixture.expected).toEqual(digest(fixture.actions.reduce(step, newGame(fixture.seed))));
  });

  it('round-trips through the kernel line format the driver parses', () => {
    const e = fixture.expected;
    const line = `[mojulo-replay] seed=${fixture.seed} steps=${fixture.steps} board=${e.board} score=${e.score} lines=${e.lines} hold=${e.hold} queue=${e.queue} active=${e.active} over=${e.over}`;
    const got = parseReplayLine(`noise\n${line}\n[mojulo-perf] process_ms=0.120 physics_ms=0.000 nodes=17 objects=120 static_kb=4096\n`);
    expect(compareReplay(e, got).ok).toBe(true);
    const drifted = compareReplay(e, { ...got, score: e.score + 1 });
    expect(drifted.ok).toBe(false);
    expect(drifted.checks.score.ok).toBe(false);
    expect(compareReplay(e, null).ok).toBe(false);
    expect(parsePerfLine('[mojulo-perf] process_ms=0.120 nodes=17')).toEqual({ process_ms: 0.12, nodes: 17 });
    expect(parseReplayLine('nothing')).toBeNull();
  });
});

describe('emitGodotArcade — the text stubs', () => {
  it('emits a 2D project at the shell\'s native size, nearest filtering, and the ledger', () => {
    const out = emitGodotArcade({ ref: 'r', title: 'Brickster', reducer: 'brickster', manifestHash: 'h', kernelVersion: '0.1.0', audio: { music: 'audio/groove.wav', sfx: ['lock', 'rotate'] } });
    expect(out.files.map((f) => f.file).sort()).toEqual(['.gitignore', 'README.md', 'arcade.tscn', 'export_presets.cfg', 'project.godot']);
    const project = fileText(out.files, 'project.godot');
    expect(project).toContain('run/main_scene="res://arcade.tscn"');
    expect(project).toContain('window/size/viewport_width=616');
    expect(project).toContain('window/size/viewport_height=752');
    expect(project).toContain('textures/canvas_textures/default_texture_filter=0');
    const stub = fileText(out.files, 'arcade.tscn');
    expect(stub).toContain('path="res://kernel/arcade.gd"');
    expect(stub).toContain('music_path = "res://audio/groove.wav"');
    expect(stub).toContain('sfx_dir = "res://audio/sfx"');
    expect(out.ledger.sfx_carried.count).toBe(2);
    expect(fileText(out.files, 'README.md')).toContain('--mojulo-replay=res://probe/replay.json');
    expect(emitGodotArcade({ ref: 'r', title: 'B', reducer: 'brickster', manifestHash: 'h', audio: { music: null, sfx: [] } })).toEqual(
      emitGodotArcade({ ref: 'r', title: 'B', reducer: 'brickster', manifestHash: 'h', audio: { music: null, sfx: [] } }),
    );
  });

  it('music:false emits no audio lines at all', () => {
    const out = emitGodotArcade({ ref: 'r', title: 'B', reducer: 'brickster', manifestHash: 'h', audio: { music: null, sfx: [] } });
    expect(fileText(out.files, 'arcade.tscn')).not.toContain('music_path');
    expect(fileText(out.files, 'arcade.tscn')).not.toContain('sfx_dir');
    expect(out.ledger.music_absent).toBeTruthy();
    expect(out.ledger.sfx_carried).toBeUndefined();
  });
});

describe('buildGodotArcadePack — data + arcade kernel', () => {
  it('ships the skin, the replay fixture, the recipe and the arcade kernel; byte-identical on re-mint', async () => {
    const manifest = buildPixelizerGameManifest({ reducer: 'brickster', music: false });
    SketchRepository.create({ title: 'Brickster', manifest, ref: 'sk_ga_brick' });
    const dir = path.join(OUT, 'sk_ga_brick', 'godot');
    const pack = await buildGodotArcadePack({ ref: 'sk_ga_brick', outDir: dir });
    expect(pack.scope).toBe('arcade');
    expect(pack.reducer).toBe('brickster');
    expect(pack.kernelVersion).toMatch(/^\d+\.\d+\.\d+$/);
    const files = pack.written.map((f) => f.file).sort();
    for (const f of ['arcade.tscn', 'game.json', 'skin.json', 'probe/replay.json', 'recipe/game.json', 'kernel/arcade.gd', 'kernel/brickster.gd', 'kernel/VERSION', 'README.md', 'project.godot']) {
      expect(files).toContain(f);
    }
    expect(files.some((f) => f.startsWith('audio/'))).toBe(false);
    expect(existsSync(path.join(dir, 'portability.json'))).toBe(false);
    const skin = JSON.parse(readFileSync(path.join(dir, 'skin.json'), 'utf8'));
    expect(skin.bank).toEqual(BANK);
    expect(skin.legend).toEqual(LEGEND);
    const replay = JSON.parse(readFileSync(path.join(dir, 'probe/replay.json'), 'utf8'));
    expect(replay).toEqual(buildReplayFixture());
    expect(pack.replay.expected).toEqual(replay.expected);
    expect(JSON.parse(readFileSync(path.join(dir, 'recipe/game.json'), 'utf8'))).toEqual(manifest);
    // the kernel copied verbatim
    expect(readFileSync(path.join(dir, 'kernel/brickster.gd'), 'utf8')).toBe(readFileSync(path.join(process.cwd(), 'lib/graph/scene/godot-arcade-kernel/brickster.gd'), 'utf8'));

    const snapshot = Object.fromEntries(readdirSync(dir, { recursive: true }).filter((f) => !f.startsWith('.godot')).map((f) => {
      const abs = path.join(dir, f);
      try { return [f, readFileSync(abs).toString('base64')]; } catch { return [f, null]; }
    }));
    await buildGodotArcadePack({ ref: 'sk_ga_brick', outDir: dir });
    for (const [f, b64] of Object.entries(snapshot)) {
      if (b64 === null) continue;
      expect(readFileSync(path.join(dir, f)).toString('base64'), f).toBe(b64);
    }
  });

  it('refuses a reducer without a port, naming the one that travels', async () => {
    SketchRepository.create({ title: 'PS', manifest: buildPixelizerGameManifest({ reducer: 'philosophers-stone', music: false }), ref: 'sk_ga_ps' });
    await expect(buildGodotArcadePack({ ref: 'sk_ga_ps', outDir: path.join(OUT, 'ps') })).rejects.toThrow(/philosophers-stone.*no Godot kernel yet.*brickster/);
  });

  it('routes through buildGodotGamePack; the world pack still refuses a reducer', async () => {
    const viaGame = await buildGodotGamePack({ ref: 'sk_ga_brick', outDir: path.join(OUT, 'via-game') });
    expect(viaGame.scope).toBe('arcade');
    await expect(buildGodotWorldPack({ ref: 'sk_ga_brick', outDir: path.join(OUT, 'via-world') })).rejects.toThrow(/arcade leg/);
  });

  it("export_game { target: 'godot' } on a pixelizer row emits the arcade pack", async () => {
    const result = await exportGameHandler({ ref: 'sk_ga_brick', target: 'godot' });
    expect(result.ok).toBe(true);
    expect(result.target).toBe('godot');
    expect(result.arcade).toEqual({ reducer: 'brickster', replay: 'probe/replay.json', replay_steps: buildReplayFixture().steps });
    expect(result.portability).toEqual({ portable: true, flags: [] });
    expect(result.ledger.reducer_ported).toBeTruthy();
    expect(existsSync(path.join(result.dir, 'kernel', 'arcade.gd'))).toBe(true);
  });
});
