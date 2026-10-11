// A world's behaviour travels to Godot as bus.json beside its score, and the kernel's level runs it: the walker's
// zones and the interact key in, the score's banners and readouts out. The Godot leg builds a chapter town as a pack,
// walks to the gate, presses E, and reads the chapter turning (MOJULO_GODOT names the engine).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractBus, extractEngineScore, BUS_VERSION } from './engine-score.js';
import { emitGodotProject } from './godot-project.js';
import { lowerPlay } from '../playscape/ui/direction.js';

const KERNEL = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
const PLAY = {
  cues: [{ id: 'siege-says', when: { on: 'chapter-siege' }, then: { say: 'The siege begins' } }],
  chapters: [
    { id: 'warned', when: { use: { at: [4, 0], r: 1.5 }, prompt: 'warn the mayor' }, world: { set: { gate: 'shut' } } },
    { id: 'siege', when: { after: 'warned' }, world: { set: { alarm: 'ringing' } } },
  ],
};
const town = () => {
  const events = lowerPlay({ entities, play: PLAY }, { player: 'hero' });
  events.hud = [...(events.hud || []), { var: 'gate', label: 'gate' }];
  return { entities, events };
};

describe('the bus beside the score', () => {
  it('carries a world\'s behaviour, versioned, in recipe units, with a ledger line', () => {
    const payload = town(), bus = extractBus(payload);
    expect(bus).toMatchObject({ version: BUS_VERSION, metersPerUnit: 1 });
    expect(bus.fragment.sources[0]).toMatchObject({ type: 'zone', use: 'cue-chapter-warned-ask', prompt: 'warn the mayor', at: [4, 0, 0] });
    expect(Object.keys(bus.fragment)).not.toContain('hud');
    expect(extractBus({ ...payload, metersPerUnit: 0.3048 }).metersPerUnit).toBe(0.3048);
    const s = extractEngineScore({ ref: 'town', manifest: {} }, payload);
    expect(s.ledger.bus_carried).toMatchObject({ reactions: bus.fragment.reactions.length, watches: bus.fragment.watches.length, version: 'bus/1' });
    expect(s).not.toHaveProperty('bus');
  });

  it('the README says what the kernel performs and how a script hears it', () => {
    const s = extractEngineScore({ ref: 'town', manifest: {} }, town());
    const readme = emitGodotProject({ ref: 'town', score: s, manifestHash: 'h', kernelVersion: '0.8.0' }).files.find((f) => f.file === 'README.md').text;
    expect(readme).toContain('## Behaviour');
    expect(readme).toMatch(/- performed: `fact:use`, `effect:logic`/);
    expect(readme).toContain('$Level.bus_event.connect(');
    const plain = emitGodotProject({ ref: 'r', score: extractEngineScore({ ref: 'r', manifest: {} }, { entities }), manifestHash: 'h', kernelVersion: '0.8.0' }).files.find((f) => f.file === 'README.md').text;
    expect(plain).not.toContain('## Behaviour');
  });

  it('is absent for a world with no behaviour, and its score is unchanged', () => {
    expect(extractBus({ entities })).toBe(null);
    expect(extractBus({ entities, events: { hud: [{ text: 'hi' }] } })).toBe(null);
    expect(extractEngineScore({ ref: 'r', manifest: {} }, { entities }).ledger).not.toHaveProperty('bus_carried');
  });
});

describe('the kernel runs it', () => {
  it('level.gd reads bus.json exactly and steps the bus from the walker (kernel 0.8.0)', () => {
    expect(fs.readFileSync(path.join(KERNEL, 'VERSION'), 'utf8').trim()).toBe('0.8.0');
    const level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8');
    for (const f of ['preload("res://kernel/bus.gd")', 'preload("res://kernel/json_exact.gd")', '"bus.json"', 'signal bus_event', 'func _step_bus(', 'derive_zone_events', '"use-"', 'KEY_E']) expect(level).toContain(f);
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot turns the chapter at the gate (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-bus-level-'));
    try {
      const payload = town();
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="bus-level-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'town', manifest: {} }, payload), null, 2));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-bus-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '4', '0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const lines = out.split('\n').filter((l) => l.startsWith('[mojulo-bus]'));
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^\[mojulo-bus\] start events=\d+ vars=\{\}/);
      expect(lines[1]).not.toMatch(/gate/);
      expect(lines[2]).toMatch(/"alarm":"ringing"/);
      expect(lines[2]).toMatch(/"chapter-siege":1/);
      expect(lines[2]).toMatch(/"gate":"shut"/);
      expect(lines[2]).toMatch(/banner=The siege begins$/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
