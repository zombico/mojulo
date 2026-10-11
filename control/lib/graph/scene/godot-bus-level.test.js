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
import { chapterContract, chapterKey } from '../playscape/ui/chapters.js';
import { validateLevelContract } from '../game/level-contract.js';
import { emitGodotGame } from './godot-project.js';

const KERNEL = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
const PLAY = {
  menus: [{ id: 'mayor', kind: 'talk', who: 'Mayor', lines: ['[mayor: warning heard]'], choices: [{ say: 'Ring the bell' }, { say: 'Arm the guard', then: { set: 'guard', to: 'armed' } }] }],
  cues: [{ id: 'siege-says', when: { on: 'chapter-siege' }, then: { say: 'The siege begins' } }],
  chapters: [
    { id: 'warned', when: { use: { at: [4, 0], r: 1.5 }, prompt: 'warn the mayor' }, world: { set: { gate: 'shut' } }, open: 'mayor' },
    { id: 'siege', when: { after: 'warned' }, world: { set: { alarm: 'ringing' } } },
  ],
};
const town = (play = PLAY) => {
  const events = lowerPlay({ entities, play }, { player: 'hero' });
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
    expect(readme).toMatch(/- performed: `fact:use`, `fact:menu`, `effect:logic`/);
    expect(readme).toMatch(/- in part: `effect:hud`, `effect:menus`/);
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
  it('level.gd reads bus.json exactly and steps the bus from the walker (since kernel 0.8.0)', () => {
    const level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8');
    for (const f of ['preload("res://kernel/bus.gd")', 'preload("res://kernel/json_exact.gd")', '"bus.json"', 'signal bus_event', 'func _step_bus(', 'derive_zone_events', '"use-"', 'KEY_E', 'func _sync_menus(', 'func menu_do(', '"menu-pick:%s:%d"']) expect(level).toContain(f);
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
      expect(lines).toHaveLength(4);
      expect(lines[0]).toMatch(/^\[mojulo-bus\] start events=\d+ vars=\{[^}]*\} menu= banner=$/);
      expect(lines[1]).not.toMatch(/"gate"/);
      expect(lines[2]).toMatch(/"alarm":"ringing"/);
      expect(lines[2]).toMatch(/"chapter-siege":1/);
      expect(lines[2]).toMatch(/"gate":"shut"/);
      // the warning opens the mayor's talk: the menu is up (focus 0) and the banner shows
      expect(lines[2]).toMatch(/"ui-menu-mayor":1/);
      expect(lines[2]).toMatch(/menu=mayor:0 banner=The siege begins$/);
      // down, accept: the second choice's effect lands on the bus and the menu closes
      expect(lines[3]).toMatch(/"guard":"armed"/);
      expect(lines[3]).toMatch(/"ui-menu-mayor":0/);
      expect(lines[3]).toMatch(/menu= /);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// a two-level game: the town turns its chapters and ends on the siege's word; the walls open on the chapter's flag and
// start with the town's world carried in. The store travels (kernel 0.9.0).
const STORE = { slices: [{ name: 'campaign', kind: 'progression' }, { name: 'world', kind: 'flags' }] };
const CARRY = { ...PLAY, carry: 'world' };
const contractOf = (ref) => chapterContract({ levelRef: ref, produces: { events: [] }, on: { 'cue:siege-says': { end: 'success' } } }, CARRY);
const LEVELS = [{ ref: 'town', title: 'Town' }, { ref: 'walls', title: 'Walls', gate: { flag: chapterKey('siege') } }];

describe('the store travels', () => {
  it('each level ships its contract, valid against the game\'s store, and the game ledger says so', () => {
    for (const { ref } of LEVELS) expect(validateLevelContract(contractOf(ref), STORE), ref).toMatchObject({ ok: true });
    const lv = LEVELS.map((l) => ({ ...l, score: extractEngineScore({ ref: l.ref, manifest: {} }, town()) }));
    const withStore = emitGodotGame({ ref: 'g', title: 'G', manifestHash: 'h', levels: lv, kernelVersion: '0.9.0', store: true });
    expect(withStore.ledger).toHaveProperty('store_carried');
    expect(withStore.ledger).not.toHaveProperty('gate_approximated');
    expect(withStore.files.find((f) => f.file === 'README.md').text).toContain('unlocks on the flag `chapter:siege`');
    const without = emitGodotGame({ ref: 'g', title: 'G', manifestHash: 'h', levels: lv, kernelVersion: '0.9.0' });
    expect(without.ledger).toHaveProperty('skipped_store');
    expect(without.ledger).toHaveProperty('gate_approximated');
  });

  it('the kernel carries the store (since 0.9.0)', () => {
    expect(fs.readFileSync(path.join(KERNEL, 'VERSION'), 'utf8').trim()).toBe('0.11.0');
    const game = fs.readFileSync(path.join(KERNEL, 'game.gd'), 'utf8'), level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8');
    for (const f of ['preload("res://kernel/store.gd")', 'func level_finish(', 'func params_for(', 'eval_gate(', '"user://store.json"']) expect(game).toContain(f);
    for (const f of ['"contract.json"', 'func outcome_envelope(', 'level_finish(outcome_envelope(', 'bus_pending']) expect(level).toContain(f);
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot plays the town, saves the flag, opens the walls and carries the chapter in (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-game-'));
    try {
      // the bus and the contract come from the same play, as a level's export does
      const payload = town(CARRY);
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-game-probe.gd'), path.join(dir, 'probe.gd'));
      fs.writeFileSync(path.join(dir, 'project.godot'), `config_version=5\n\n[application]\nconfig/name="game-probe-${path.basename(dir)}"\nrun/main_scene="res://menu.tscn"\n\n[autoload]\nGame="*res://kernel/game.gd"\nProbe="*res://probe.gd"\n`);
      fs.writeFileSync(path.join(dir, 'menu.tscn'), '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://kernel/menu.gd" id="m"]\n\n[node name="Menu" type="Control"]\nscript = ExtResource("m")\n');
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ kind: 'game', title: 'Siege', store: STORE, levels: LEVELS }));
      for (const { ref } of LEVELS) {
        const lv = path.join(dir, 'levels', ref);
        fs.mkdirSync(lv, { recursive: true });
        fs.writeFileSync(path.join(lv, 'level.tscn'), `[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://kernel/level.gd" id="k"]\n\n[node name="Level" type="Node3D"]\nscript = ExtResource("k")\nscore_path = "res://levels/${ref}/score.json"\n`);
        fs.writeFileSync(path.join(lv, 'score.json'), JSON.stringify(extractEngineScore({ ref, manifest: {} }, payload)));
        fs.writeFileSync(path.join(lv, 'bus.json'), JSON.stringify(extractBus(payload)));
        fs.writeFileSync(path.join(lv, 'contract.json'), JSON.stringify(contractOf(ref)));
      }
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--', '4', '0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const lines = out.split('\n').filter((l) => l.startsWith('[mojulo-game]'));
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('[mojulo-game] start gates=town:true,walls:false');
      expect(lines[1]).toMatch(/^\[mojulo-game\] played state=complete events=\[.*"key":"chapter:warned".*"key":"chapter:siege".*\]$/);
      expect(lines[2]).toMatch(/after gates=town:true,walls:true store=.*"completed":\{"town":"success"\}.*"chapter:siege":true.* saved=true/);
      expect(lines[3]).toMatch(/carried vars=.*"alarm":"ringing".*"gate":"shut"/);
      expect(lines[3]).toMatch(/"chapter-siege-n":100/);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// the cast: the warning wakes a sleeping soldier at the gate, who walks to his post and is felled there; the merchant
// is sent away. The bus hears it all back: spawned, arrive, down, gone (kernel 0.11.0, kernel/cast.gd)
const CAST_ENTITIES = [
  ...entities,
  { id: 'soldier-1', dormant: true, rule: { type: 'static' }, transform: { pos: [6, 2, 0.5] }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7], hp: 30 } },
  { id: 'merchant', rule: { type: 'static' }, transform: { pos: [3, -2, 0.5] }, body: { type: 'mesh', shape: 'sphere', radius: 0.5 } },
];
const CAST_PLAY = {
  spots: [{ id: 'gate', at: [4, 0] }, { id: 'post', at: [8, 8] }],
  cues: [
    { id: 'posted', when: { arrive: { who: 'soldier-1', at: 'post' } }, then: [{ set: 'posted', to: 1 }, { hurt: { who: 'soldier-1', by: 30 } }] },
    { id: 'fell', when: { down: 'soldier-*' }, then: { set: 'fallen', to: 1 } },
    { id: 'left', when: { gone: 'merchant' }, then: { set: 'merchant-left', to: 1 } },
    { id: 'woke', when: { spawned: 'soldier-1' }, then: { set: 'woke', to: 1 } },
  ],
  chapters: [{ id: 'warned', when: { use: { at: [4, 0], r: 1.5 }, prompt: 'warn the mayor' }, world: { spawn: [], do: [{ spawn: { who: 'soldier-1', at: 'gate' } }, { walk: { who: 'soldier-1', to: 'post', speed: 20 } }, { vanish: 'merchant' }] } }],
};

describe('the cast travels', () => {
  const payload = () => ({ entities: CAST_ENTITIES, events: lowerPlay({ entities: CAST_ENTITIES, play: CAST_PLAY }, { player: 'hero' }) });

  it('bus.json carries the cast rows in the bus\'s units, and the contract marks the character rows built', () => {
    const bus = extractBus(payload());
    expect(bus.cast.map((r) => r.id)).toEqual(['hero', 'soldier-1', 'merchant']);
    expect(bus.cast[1]).toEqual({ id: 'soldier-1', pos: [6, 2, 0.5], dormant: true, hp: 30 });
    const s = extractEngineScore({ ref: 'r', manifest: {} }, payload());
    expect(s.ledger.bus_carried.godot.built).toEqual(expect.arrayContaining(['fact:cast']));
    expect(s.ledger.bus_carried.godot.partial).toEqual(expect.arrayContaining(['effect:cast']));
    expect(extractBus(town())).not.toHaveProperty('cast');
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot wakes, walks, fells and sends away, and hears it back (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-cast-'));
    try {
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="cast-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'town', manifest: {} }, payload())));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload())));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-bus-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '4', '0', '90'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const cast = out.split('\n').filter((l) => l.startsWith('[mojulo-cast]'));
      const bus = out.split('\n').filter((l) => l.startsWith('[mojulo-bus]'));
      expect(cast[0]).toMatch(/start .*soldier-1:gone\(6\.00,2\.00\):hp30 merchant:here\(3\.00,-2\.00\)/);
      // he stops within reach (0.3) of the post at (8, 8), and lies there
      expect(cast.at(-1)).toMatch(/soldier-1:here:down\([78]\.\d\d,[78]\.\d\d\):hp0 merchant:gone/);
      expect(bus.at(-1)).toMatch(/"fallen":1/);
      expect(bus.at(-1)).toMatch(/"merchant-left":1/);
      expect(bus.at(-1)).toMatch(/"posted":1/);
      expect(bus.at(-1)).toMatch(/"woke":1/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
