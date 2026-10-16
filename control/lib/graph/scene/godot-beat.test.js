// THE BEAT (II2): the music's pulse said on the bus, the page's clock (scene/channels/audio.js) and Godot's (kernel
// level.gd _beat_tick) one function (beats/beat-clock.js). An on-beat level played by the same presses in both engines,
// at the harness's fixed step, is equal frame by frame on its bus: the same beats, the same hits and misses.
import { describe, it, expect } from 'vitest';
import { beatsDue } from '../beats/beat-clock.js';
import { composeMechanics } from '../game/mechanics.js';
import { playScript } from '../game/level-equivalence.js';
import { extractEngineScore } from './engine-score.js';
import { busCoverage } from './bus-abi.js';
import { BUS_MARKS } from './godot-marks.js';
import { playBoth } from './godot-harness.js';
import { mulberry32 } from '../vegetation/grow.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// the clock read at seeded, jumpy times (a hitch, a stall, a skip past several beats), seeds 1, 2, 3, 11 and 12: the
// stale beat and the four-a-reading cap are reached, which a steady step never does
export function clockReadings(seed) {
  const rand = mulberry32(seed), every = [0.5, 0.4, 0.375, 0.6, 0.45][seed % 5], out = [];
  let t = -0.2;
  for (let i = 0; i < 80; i++) { t += rand() < 0.1 ? rand() * 3 : rand() * 0.2; out.push(Math.round(t * 1e6) / 1e6); }
  return { every, readings: out };
}
const SEEDS = [1, 2, 3, 11, 12];
const webClock = ({ every, readings }) => { const c = { n: 0 }; return readings.map((t) => JSON.stringify(beatsDue(c, t, every).map((e) => e.n)) + `:${c.n}`); };
const KERNEL = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
function godotClock(runs, mutate = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-beatclock-'));
  try {
    fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
    if (mutate) { const p = path.join(dir, 'kernel', 'level.gd'), src = fs.readFileSync(p, 'utf8'); if (!src.includes(mutate.from)) throw new Error(`plant does not apply: ${mutate.from}`); fs.writeFileSync(p, src.replace(mutate.from, mutate.to)); }
    fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="beat-clock"\n');
    fs.writeFileSync(path.join(dir, 'runs.json'), JSON.stringify(runs));
    fs.writeFileSync(path.join(dir, 'probe.gd'), `extends SceneTree
const Level := preload("res://kernel/level.gd")
func _init() -> void:
	var runs = JSON.parse_string(FileAccess.get_file_as_string("res://runs.json"))
	for r in runs:
		var n := 0
		var line := []
		for t in r["readings"]:
			var due: Array = Level.beats_due(n, float(t), float(r["every"]))
			n = int(due[1])
			var ns := []
			for e in due[0]:
				ns.append(int(e["n"]))
			line.append("%s:%d" % [JSON.stringify(ns).replace(" ", ""), n])
		print("[beat] " + "|".join(line))
	quit(0)
`);
    const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--path', dir, '--script', 'res://probe.gd'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out.split('\n').filter((l) => l.startsWith('[beat] ')).map((l) => l.slice(7).split('|'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const GODOT = process.env.MOJULO_GODOT;
const quad = (z) => ({ corners: [[-20, -20, z], [20, -20, z], [20, 20, z], [-20, 20, z]] });
export function beatLevel() {
  const m = composeMechanics([{ kind: 'on-beat', misses: 3 }, { kind: 'score', points: [{ on: 'beat:hit', by: 1 }] }, { kind: 'reach-exit', at: [15, 0, 0] }], { player: 'hero', spawn: [0, 0, 0] });
  return {
    faces: [quad(0)],
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: Math.PI / 2 } }],
    events: m.events, game: { on: m.on, audits: m.audits },
    audio: { beat: { every: 0.5, lead: 0.15 } },
  };
}
// presses: on the beat (the window opens at each beat, 0.15 s early, for 0.3 s) and off it
const presses = (n) => Array.from({ length: n }, (_, i) => (i % 15 === 3 || i === 40 ? { keys: [' '] } : {}));

describe('the beat clock', () => {
  it('says each beat once, passes a stale one, four at most a reading', () => {
    const c = { n: 0 };
    expect(beatsDue(c, 0, 0.5)).toEqual([{ type: 'beat', n: 0 }]);
    expect(beatsDue(c, 0.4, 0.5)).toEqual([]);
    expect(beatsDue(c, 0.5, 0.5)).toEqual([{ type: 'beat', n: 1 }]);
    expect(beatsDue(c, 2.2, 0.5)).toEqual([{ type: 'beat', n: 4 }]);   // 2 and 3 a period stale: passed over
    expect(c.n).toBe(5);
  });

  it('rides the score, feeds the level\'s own sim, and the bus row is built', () => {
    const p = beatLevel();
    expect(extractEngineScore({ ref: 'r', manifest: {} }, p).beat).toEqual({ every: 0.5, lead: 0.15 });
    expect(extractEngineScore({ ref: 'r', manifest: {} }, { ...p, audio: undefined })).not.toHaveProperty('beat');
    const run = playScript(p, presses(90));
    const last = JSON.parse(run.keys.at(-1).split('|')[0]);
    expect(last.log.filter((l) => l.type === 'beat').length).toBeGreaterThan(4);
    expect(last.vars.score).toBeGreaterThan(0);
    expect(last.log.some((l) => l.type === 'beat:miss')).toBe(true);
    expect(busCoverage(p.events).godot.built).toContain('fact:beat');
    expect(BUS_MARKS.facts.beat.godot).toBe('built');
  });

  it.skipIf(!GODOT)('a headless Godot keeps the beat: the same beats, hits and misses, frame by frame (MOJULO_GODOT)', () => {
    const { web, godot, compare } = playBoth(beatLevel(), presses(90), { godot: GODOT });
    expect(godot.error).toBe(null);
    const bus = (keys) => keys.map((k) => k.split('|')[0]);
    expect(godot.keys.length).toBe(90);
    expect(bus(godot.keys)).toEqual(bus(web.keys));
    expect(compare.frames).toBe(90);
  }, 300000);

  // each plant in the kernel's beat breaks the equality: the harness catches it
  const PLANTS = [
    { name: 'the lead dropped', from: 't += float(b.get("lead", 0.0))', to: 't += 0.0' },
    { name: 'a stale beat said', from: 'if t - n * every < every:', to: 'if true:' },
    { name: 'the cap of four lifted', from: 'while n * every <= t and k < 4:', to: 'while n * every <= t and k < 40:' },
    { name: 'off by one beat', from: 'var beat_n := 0', to: 'var beat_n := 1' },
    { name: 'the clock a frame late', from: '_beat_tick(float(sim_frame) * delta if sim else -1.0)', to: '_beat_tick(float(sim_frame - 1) * delta if sim else -1.0)' },
  ];
  it('the seeded clock corpus reaches a stale beat and the cap', () => {
    // per reading: how far the next beat moved, and how many were said
    const steps = SEEDS.flatMap((s) => { let prev = 0; return webClock(clockReadings(s)).map((x) => { const [ns, n] = x.split(':'); const r = { moved: Number(n) - prev, said: JSON.parse(ns).length }; prev = Number(n); return r; }); });
    expect(steps.some((r) => r.moved > r.said)).toBe(true);   // a stale beat passed over
    expect(steps.some((r) => r.moved === 4)).toBe(true);      // the cap: four a reading, the rest the next
  });

  it.skipIf(!GODOT)('the kernel\'s clock is the web\'s at every seeded reading (MOJULO_GODOT)', () => {
    const runs = SEEDS.map(clockReadings);
    expect(godotClock(runs)).toEqual(runs.map(webClock));
  }, 120000);

  // each plant in the kernel's beat breaks an equality: the level's bus, or the clock's seeded readings
  it.skipIf(!GODOT)('every planted bug in the beat is caught (MOJULO_GODOT)', () => {
    const bus = (keys) => keys.map((k) => k.split('|')[0]);
    const runs = SEEDS.map(clockReadings), want = runs.map(webClock);
    for (const p of PLANTS) {
      const clockCaught = JSON.stringify(godotClock(runs, p)) !== JSON.stringify(want);
      const levelCaught = clockCaught || (() => { const { web, godot } = playBoth(beatLevel(), presses(90), { godot: GODOT, mutate: [{ file: 'level.gd', from: p.from, to: p.to }] }); return JSON.stringify(bus(godot.keys)) !== JSON.stringify(bus(web.keys)); })();
      expect(levelCaught, p.name).toBe(true);
    }
  }, 900000);
});
