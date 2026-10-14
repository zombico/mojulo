// A world's behaviour travels to Godot as bus.json beside its score, and the kernel's level runs it: the walker's
// zones and the interact key in, the score's banners and readouts out. The Godot leg builds a chapter town as a pack,
// walks to the gate, presses E, and reads the chapter turning (MOJULO_GODOT names the engine).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractBus, extractEngineScore, BUS_VERSION } from './engine-score.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { chapterContract, chapterKey } from '../playscape/ui/chapters.js';
import { validateLevelContract } from '../game/level-contract.js';
import { emitGodotGame, emitGodotProject, GAME_HOOKS_GD } from './godot-project.js';
import { writePack, OWNED_DIR } from './godot-pack.js';
import { readWeather } from '../weather/weather.js';
import { assessPortability } from './engine-portability.js';
import { composeMechanics } from '../game/mechanics.js';

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
    expect(readme).toMatch(/- performed: `fact:use`, `fact:menu`, `effect:logic`, `effect:hud`, `effect:menus`/);
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
      // the menu as drawn: the talk's words, then its rows, the focused one marked
      expect(out).toMatch(/^\[mojulo-menu\] after Mayor: \[mayor: warning heard\] \/ ▸ Ring the bell \/   Arm the guard$/m);
      // a gamepad (the d-pad and A, as input events) and the pointer (the row's button) pick the same choice
      for (const how of ['pad', 'click']) {
        const o = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '4', '0', '30', how], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const last = o.split('\n').filter((l) => l.startsWith('[mojulo-bus]')).at(-1);
        expect(last, how).toMatch(/"guard":"armed"/);
        expect(last, how).toMatch(/"ui-menu-mayor":0/);
      }
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// the HUD (kernel 0.14.0): the page's widgets in their slots and the guide's look; a cue hides a part, restates one,
// moves the phase, and a banner and a toast fire on the bus
const HUD_PLAY = {
  phases: ['title', 'playing', 'won'],
  parts: [
    { part: 'readout', id: 'purse', variant: 'bar', bind: { var: 'gold' }, at: 'bottom-left', label: 'Gold', max: 10, color: 'value' },
    { part: 'readout', variant: 'clock', bind: { var: 'time' }, at: 'top', label: 'Time' },
    { part: 'readout', variant: 'counter', bind: { var: 'bells' }, at: 'top-right', label: 'Bells' },
    { part: 'legend', id: 'hint', text: 'Ring the bell', at: 'bottom' },
    { part: 'legend', text: 'Press start', when: ['title'] },
    { part: 'banner', bind: { on: 'cue:ring' }, text: 'Rung {bells}', when: ['playing'] },
    { part: 'toast', bind: { var: 'gold' }, at: 'top-right' },
  ],
  cues: [
    { id: 'go', when: { start: true }, then: [{ phase: 'playing' }, { set: 'gold', to: 3 }, { set: 'time', to: 75 }] },
    { id: 'ring', when: { use: { at: [4, 0], r: 1.5 }, prompt: 'ring' }, then: [{ hide: 'hint' }, { set: 'bells', to: 1 }, { state: 'purse', to: 'alert' }, { set: 'gold', to: 7 }] },
  ],
};
const hudTown = () => {
  const events = lowerPlay({ entities, play: HUD_PLAY }, { player: 'hero' });
  return { entities, events: { ...events, style: { accent: '#ff8800', font: 'serif' }, register: { frame: 'rule', plate: 'solid', motion: 'snap' } } };
};

describe('the HUD travels', () => {
  it('the score carries the widgets with their gates and the HUD\'s look; no look declared, no key', () => {
    const s = extractEngineScore({ ref: 'hud', manifest: {} }, hudTown());
    expect(s.hud.find((w) => w.id === 'hint')).toMatchObject({ kind: 'legend', slot: 'bottom' });
    expect(s.hud.find((w) => w.text === 'Press start')).toMatchObject({ when: [0] });
    expect(s.hudStyle).toMatchObject({ accent: '#ff8800', ink: '#ffffff', font: 'serif', register: { frame: 'rule', plate: 'solid', motion: 'snap' } });
    expect(extractEngineScore({ ref: 'hud', manifest: {} }, town())).not.toHaveProperty('hudStyle');
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot draws it, and the cue moves it (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-hud-'));
    try {
      const payload = hudTown();
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="hud-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'hud', manifest: {} }, payload), null, 2));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-bus-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '4', '0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      expect(out).not.toMatch(/SCRIPT ERROR|Parse Error/);
      const hud = Object.fromEntries(out.split('\n').filter((l) => l.startsWith('[mojulo-hud]')).map((l) => { const [, tag, ...rest] = l.split(' '); return [tag, rest.join(' ').split(' | ')]; }));
      // the start: the phase is playing (the title's legend is down), the hint stands, the bar, the clock, the counter
      expect(hud.start).toEqual(['bottom-left:readout#purse:Gold=3/10', 'top:readout:Time=1:15', 'top-right:readout:Bells=0', 'bottom:legend#hint:Ring the bell']);
      // rung: the hint goes, the purse is restated to alert, the banner fills its var, the gold's change rises
      expect(hud.after).toEqual(['bottom-left:readout#purse:Gold=7/10@alert', 'top:readout:Time=1:15', 'top-right:readout:Bells=1', 'center:banner:Rung 1', 'top-right:toast:+4']);
      expect(out).toMatch(/\[mojulo-bus\] after .* banner=Rung 1$/m);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// the stats (kernel 0.15.0): a use gives xp and gold, the level-up fires its cue, the HUD reads the holder's vars, and
// the player's pace is bound to a stat
const STATS_PLAY = {
  stats: {
    holders: ['hero'],
    stats: [{ id: 'pace', from: { stat: 'level', base: 5 } }],
    bodies: { speed: 'pace' },
    resources: [{ id: 'gold', start: 10 }],
    level: { start: 1, xp: [100, 300], each: { grant: { gold: 5 } } },
  },
  parts: [
    { part: 'readout', bind: { var: 'hero.gold' }, label: 'Gold', at: 'top-left' },
    { part: 'banner', bind: { on: 'cue:up' }, text: 'Level {hero.level}' },
  ],
  cues: [
    { id: 'shrine', when: { use: { at: [4, 0], r: 1.5 }, prompt: 'pray' }, then: [{ xp: { by: 150 } }, { grant: { res: 'gold', by: 20 } }] },
    { id: 'up', when: { levelled: 'hero' }, then: { set: 'blessed', to: 1 } },
  ],
};

describe('the stats travel', () => {
  it('bus.json carries the stats beside the fragment, their vars in it', () => {
    const bus = extractBus({ entities, events: lowerPlay({ entities, play: STATS_PLAY }, { player: 'hero' }) });
    expect(bus.stats).toMatchObject({ holders: ['hero'], bodies: { speed: 'pace' } });
    expect(bus.fragment.vars).toMatchObject({ 'hero.gold': 10, 'hero.level': 1 });
    expect(extractBus(town())).not.toHaveProperty('stats');
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot levels the hero at the shrine (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-stats-'));
    try {
      const payload = { entities, events: lowerPlay({ entities, play: STATS_PLAY }, { player: 'hero' }) };
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="stats-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'shrine', manifest: {} }, payload), null, 2));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-bus-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '4', '0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      expect(out).not.toMatch(/SCRIPT ERROR|Parse Error/);
      const line = (k, tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-${k}] ${tag} `));
      expect(line('stats', 'start')).toBe('[mojulo-stats] start pace=6.00');
      expect(line('hud', 'start')).toBe('[mojulo-hud] start top-left:readout:Gold=10');
      // prayed: 150 xp is one level (its 5 gold) and the 20 granted; the cue on the level-up; the pace follows the level
      expect(line('bus', 'after')).toMatch(/"blessed":1/);
      expect(line('bus', 'after')).toMatch(/"hero.level":2/);
      expect(line('bus', 'after')).toMatch(/"hero.xp":150/);
      expect(line('hud', 'after')).toBe('[mojulo-hud] after top-left:readout:Gold=35 | center:banner:Level 2');
      expect(line('stats', 'after')).toBe('[mojulo-stats] after pace=7.00');
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// what an exported game needs to be played, found exporting a minted chapter town (kernel 0.16.0): a primitive body
// (a box, a sphere) bakes no geometry, so the score carries it and the kernel builds it; a level whose behaviour rides
// the bus wins through its contract, and a flag gate is the store's, so neither is flagged as lost
describe('a minted game, exported', () => {
  const ents = [...entities, { id: 'mayor', rule: { type: 'static' }, transform: { pos: [4, 0, 0.9] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.8], color: '#d9b44a' } },
    { id: 'bell', rule: { type: 'static' }, transform: { pos: [0, 4, 3] }, body: { type: 'mesh', shape: 'sphere', radius: 0.5 } }];

  it('the score carries each primitive body; other bodies carry none', () => {
    const s = extractEngineScore({ ref: 'town', manifest: {} }, { entities: ents });
    const by = Object.fromEntries(s.entities.map((e) => [e.id, e.primitive]));
    expect(by.mayor).toEqual({ shape: 'box', size: [0.6, 0.6, 1.8], color: '#d9b44a' });
    expect(by.bell).toEqual({ shape: 'sphere', radius: 0.5 });
    expect(extractEngineScore({ ref: 'town', manifest: {} }, { entities: ents, metersPerUnit: 0.5 }).entities.find((e) => e.id === 'mayor').primitive.size).toEqual([0.3, 0.3, 0.9]);
    expect(fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8')).toContain('func _build_primitive(');
  });

  it('a bus level and a store\'s flag gate are not flagged as lost', () => {
    const score = extractEngineScore({ ref: 'town', manifest: {} }, town());
    const game = { kind: 'game', store: STORE, levels: LEVELS };
    const p = assessPortability({ manifest: game, levels: [{ ref: 'town', score }], engine: 'godot' });
    expect(p.flags.join('\n')).not.toMatch(/no completion mechanic|approximated as unlocked/);
    // Unity and Unreal run no bus and carry no store: for them both are still lost
    const other = assessPortability({ manifest: game, levels: [{ ref: 'town', score }] });
    expect(other.flags.join('\n')).toMatch(/no completion mechanic/);
    expect(other.flags.join('\n')).toMatch(/approximated as unlocked/);
    const bare = assessPortability({ manifest: { ...game, store: undefined }, levels: [{ ref: 'town', score: extractEngineScore({ ref: 'town', manifest: {} }, { entities }) }], engine: 'godot' });
    expect(bare.flags.join('\n')).toMatch(/no completion mechanic/);
    expect(bare.flags.join('\n')).toMatch(/approximated as unlocked/);
  });
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
    expect(fs.readFileSync(path.join(KERNEL, 'VERSION'), 'utf8').trim()).toBe('0.19.0');
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
    // foot: half its box, where a beam lands (since 0.18.0)
    expect(bus.cast[1]).toEqual({ id: 'soldier-1', pos: [6, 2, 0.5], dormant: true, hp: 30, foot: 0.85 });
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

// the fight (kernel 0.17.0): a platform hero's melee rides bus.json `combat`; kernel/combat.gd swings it over the cast,
// each hit is a hit:<id> fact, hp-pool counts them down and defeat-all ends the level through its contract
const CRAWL = [
  { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeDur: 0.5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'grub-1', rule: { type: 'static' }, transform: { pos: [1.8, 0.3, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 0.8], hittable: true, hp: 4, poise: 20, radius: 0.5 } },
  { id: 'grub-2', rule: { type: 'static' }, transform: { pos: [1.8, -0.3, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 0.8], hittable: true, hp: 6, radius: 0.5 } },
  { id: 'far', rule: { type: 'static' }, transform: { pos: [9, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 0.8], hittable: true, hp: 4, radius: 0.5 } },
];
const crawl = () => {
  const m = composeMechanics([{ kind: 'hp-pool', entities: [{ id: 'grub-1', hp: 2 }, { id: 'grub-2', hp: 2 }] }, { kind: 'defeat-all' }]);
  return { payload: { entities: CRAWL, events: m.events }, on: m.on };
};

describe('the fight travels', () => {
  it('bus.json carries the hero\'s swings and what it can hit, with a ledger line', () => {
    const { payload } = crawl(), bus = extractBus(payload);
    expect(bus.combat).toMatchObject({ version: 'combat/1', hero: 'hero', eye: 0, strike: { dur: 0.5, cooldown: 0, combo: 0 } });
    expect(Object.keys(bus.combat.strike.swings)).toEqual(['neutral', 'forward', 'back', 'left', 'right']);
    expect(bus.combat.strike.swings.left.params.aimYaw).toBeCloseTo((50 * Math.PI) / 180);
    // a reacting body carries its poise and the reaction's timings as the web normalizes them
    expect(bus.combat.bodies['grub-1']).toMatchObject({ radius: 0.5, hpMax: 4, poise: 20, poiseMax: 20, staggerDur: 1.3, downPause: 2 });
    expect(bus.combat.bodies['grub-2']).toEqual({ radius: 0.5, hpMax: 6 });
    expect(bus.combat.bodies.far).toEqual({ radius: 0.5, hpMax: 4 });
    expect(bus.cast.map((r) => r.id)).toEqual(['hero', 'grub-1', 'grub-2', 'far']);
    const s = extractEngineScore({ ref: 'crawl', manifest: {} }, payload);
    expect(s.ledger.combat_carried).toMatchObject({ hero: 'hero', bodies: 3, version: 'combat/1' });
    // a walking hero swings nothing on the web (the strike is the platform rule's), and nothing travels
    const walking = CRAWL.map((e) => (e.id === 'hero' ? { ...e, rule: { ...e.rule, type: 'walk' } } : e));
    expect(extractBus({ entities: walking, events: {} })).toBeNull();
  });

  it('the pack\'s ledger runs hp-pool and defeat-all on the bus, not as lost; without a bus they stay unknown', () => {
    const mechanics = [{ kind: 'hp-pool' }, { kind: 'defeat-all' }];
    const pack = (payload) => emitGodotProject({ ref: 'crawl', score: extractEngineScore({ ref: 'crawl', manifest: { game: { mechanics } } }, payload), manifestHash: 'h', kernelVersion: '0.18.0' }).ledger;
    const on = pack(crawl().payload);
    expect(on.bus_mechanics).toMatchObject({ count: 2, kinds: ['hp-pool', 'defeat-all'] });
    expect(on).not.toHaveProperty('unknown_mechanics');
    const off = pack({ entities: CRAWL.map((e) => (e.id === 'hero' ? { ...e, rule: { ...e.rule, type: 'walk' } } : e)) });
    expect(off.unknown_mechanics).toMatchObject({ kinds: ['hp-pool', 'defeat-all'] });
    expect(off).not.toHaveProperty('bus_mechanics');
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot swings, counts the hits, fells a reacting body and ends the level (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-fight-'));
    try {
      const { payload, on } = crawl();
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="fight-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'crawl', manifest: {} }, payload)));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.writeFileSync(path.join(dir, 'contract.json'), JSON.stringify({ on }));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-combat-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '0', '0', '1.8', '0', '3'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (process.env.MOJULO_KEEP_PACK) console.log(out);
      const fight = (tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-combat] ${tag} `));
      const cast = (tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-cast] ${tag} `));
      expect(fight('start')).toMatch(/swings=0 dealt=0 .*grub-1:hits0:hittable grub-2:hits0:hittable far:hits0:hittable/);
      // one swing meets both grubs in front, never the one far off
      expect(fight('swing-1')).toMatch(/swings=1 dealt=2 .*grub-1:hits1:hittable grub-2:hits1:hittable far:hits0:hittable/);
      expect(cast('swing-1')).toMatch(/grub-1:here\([^)]*\):hp2 grub-2:here\([^)]*\):hp4/);
      // the second fells the reacting grub (poise) at 0; the other stands at 0 hp, as on the web
      expect(cast('swing-2')).toMatch(/grub-1:here:down\([^)]*\):hp0 grub-2:here\([^)]*\):hp2/);
      // hp-pool counted every hit: both pools (two hits each) ran out on the second swing, defeat-all fired, the
      // contract ended the level, and nothing swings after it
      expect(out).toMatch(/^moj: level complete$/m);
      expect(out.indexOf('moj: level complete')).toBeLessThan(out.indexOf('[mojulo-combat] swing-2 '));
      expect(fight('end')).toMatch(/swings=2 dealt=4/);
      const bus = out.split('\n').filter((l) => l.startsWith('[mojulo-bus] '));
      expect(bus.at(-1)).toMatch(/"__hp_grub-1":0/);
      expect(bus.at(-1)).toMatch(/"__hp_grub-2":0/);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot fires a rifle: the nearest body on the line takes the rounds and falls (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-rifle-'));
    try {
      const shooter = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, weapon: { fireClass: 'sight', damage: 2, cooldown: 0.3, magazine: 8, eye: 0.5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
      const payload = { entities: [shooter, ...CRAWL.slice(1).map((e) => (e.id === 'grub-1' ? { ...e, transform: { pos: [4, 0, 0] } } : e.id === 'grub-2' ? { ...e, transform: { pos: [7, 0, 0] } } : e))], events: {} };
      const bus = extractBus(payload);
      expect(bus.combat).toMatchObject({ hero: 'hero', weapon: { fireClass: 'sight', damage: 2, magazine: 8, ammo: 8 } });
      expect(bus.combat).not.toHaveProperty('strike');
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="rifle-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'range', manifest: {} }, payload)));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(bus));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-combat-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '0', '0', '4', '0', '3'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (process.env.MOJULO_KEEP_PACK) console.log(out);
      const fight = (tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-combat] ${tag} `));
      const cast = (tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-cast] ${tag} `));
      // grub-1 stands in front of grub-2 on the line: it takes every round, and falls on the second (hp 4, 2 a round)
      expect(fight('swing-1')).toMatch(/grub-1:hits1:hittable grub-2:hits0:hittable/);
      expect(cast('swing-2')).toMatch(/grub-1:here:down\([^)]*\):hp0/);
      expect(cast('end')).toMatch(/grub-2:here\([^)]*\):hp6/);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// the systems (kernel 0.18.0): a game's powers, resource, levels and status page lower to stats, cues, HUD and menus
// the kernel already runs; what it lacked was the keys. bus.json carries events.inputs (a key, a click) and level.gd
// feeds them to the bus as the page does
const systemsWorld = async () => {
  const G = await import('../gameworld/index.js');
  const B = G.resolveBook({ ...G.MEADOWMARK_HERO, mechanics: {} }), m = G.mechanicsOrders(B.G, B.mechanics).args.manifest;
  return { entities: m.entities, events: { ...lowerPlay(m, { player: m.entities[0].id }), inputs: m.events.inputs } };
};

describe('the systems travel', () => {
  it('bus.json carries the keys a game binds; a pick or a shot stays the page\'s', async () => {
    const payload = await systemsWorld(), bus = extractBus(payload);
    expect(bus.inputs).toEqual([
      { on: 'key', key: '1', emit: { type: 'power-gust-step' } }, { on: 'key', key: '2', emit: { type: 'power-wind-orb' } },
      { on: 'key', key: '3', emit: { type: 'power-cyclone' } }, { on: 'key', key: 'i', emit: { type: 'status' } },
    ]);
    const s = extractEngineScore({ ref: 'sys', manifest: {} }, payload);
    expect(s.ledger.bus_carried.godot.built).toContain('fact:input');
    expect(s.ledger.bus_carried.godot.absent).toEqual([]);
    const aimed = { ...payload, events: { ...payload.events, inputs: [{ on: 'pick', emit: { type: 'chose' } }] } };
    expect(extractBus(aimed)).not.toHaveProperty('inputs');
    expect(extractEngineScore({ ref: 'sys', manifest: {} }, aimed).ledger.bus_carried.godot.absent).toEqual(['fact:aim']);
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot fires a power on its key and opens the status page on i (MOJULO_GODOT)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-keys-'));
    try {
      const payload = await systemsWorld();
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="keys-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'sys', manifest: {} }, payload)));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-keys-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '1@10', '9@40', 'i@70'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (process.env.MOJULO_KEEP_PACK) console.log(out);
      const line = (k, tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-${k}] ${tag} `)) || '';
      const events = (tag) => Number(line('bus', tag).match(/events=(\d+)/)[1]);
      // the power's key reaches the bus: its cue fires and its toast shows
      expect(events('after-1')).toBeGreaterThan(events('start'));
      expect(line('hud', 'after-1')).toMatch(/gust-step/);
      // a key nothing binds does nothing
      expect(events('after-9')).toBe(events('after-1'));
      // i opens the status page
      expect(line('bus', 'after-i')).toMatch(/"ui-menu-status":1/);
      expect(line('bus', 'after-i')).toMatch(/menu=status:0/);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// beams and explosions (kernel 0.18.0): a cue's beam is a moment that lands after its distance and its target hears
// struck; a blast is moments (a chain scattered and staggered) and a shake. Held equal by the combat corpus; here a
// real level fires them from cues and hears the struck
const SHOW = [
  { id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'caster', rule: { type: 'static' }, transform: { pos: [2, 3, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'target', rule: { type: 'static' }, transform: { pos: [8, 3, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hp: 10 } },
];
const SHOW_PLAY = { cues: [
  { id: 'open', when: { start: true }, then: [{ beam: { who: 'caster', to: 'target', is: 'orb' } }, { explode: { at: [4, -2], is: 'chain' } }] },
  { id: 'ow', when: { struck: 'target' }, then: [{ set: 'struck', to: 1 }, { hurt: { who: 'target', by: 4 } }] },
] };

describe('beams and explosions travel', () => {
  it('bus.json carries where each character stands below its pos, and the contract marks struck built', () => {
    const payload = { entities: SHOW, events: lowerPlay({ entities: SHOW, play: SHOW_PLAY }, { player: 'hero' }) };
    expect(extractBus(payload).cast.map((r) => r.foot)).toEqual([0.85, 0.85, 0.85]);
    expect(extractEngineScore({ ref: 'show', manifest: {} }, payload).ledger.bus_carried.godot.built).toEqual(expect.arrayContaining(['fact:struck']));
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot fires a beam and a chain from a cue, and the target hears struck when it lands (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-show-'));
    try {
      const payload = { entities: SHOW, events: lowerPlay({ entities: SHOW, play: SHOW_PLAY }, { player: 'hero' }) };
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="show-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'show', manifest: {} }, payload)));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-keys-probe.gd'), path.join(dir, 'probe.gd'));
      // no key matters here: the probe runs to frame 130 (a key nothing binds) and dumps
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', 'z@110'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (process.env.MOJULO_KEEP_PACK) console.log(out);
      const line = (k, tag) => out.split('\n').find((l) => l.startsWith(`[mojulo-${k}] ${tag} `)) || '';
      expect(line('bus', 'start')).not.toMatch(/"struck":1/);
      expect(line('bus', 'end')).toMatch(/"struck":1/);
      expect(line('cast', 'end')).toMatch(/target:here\([^)]*\):hp6/);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// forced weather: the warning darkens the sky to a thunderstorm (a cue's weather), eased in over its blend and held; the
// web's newest-force-wins rule (kernel 0.12.0, weather.gd force())
describe('a cue forces the sky', () => {
  const WX_PLAY = { chapters: [{ id: 'warned', when: { use: { at: [4, 0], r: 1.5 } }, world: { weather: { is: 'thunderstorm', blend: 0 } } }] };
  const payload = () => ({ entities, haze: { color: '#b4d8f0', density: 0.012 }, weather: { weather: readWeather('temperate'), seed: 4 }, events: lowerPlay({ entities, play: WX_PLAY }, { player: 'hero' }) });

  it('the score carries the states a cue can force, and the contract marks the weather built', () => {
    const s = extractEngineScore({ ref: 'r', manifest: {} }, payload());
    expect(s.weather.states.map((x) => x.name)).toContain('thunderstorm');
    expect(s.ledger.bus_carried.godot.built).toContain('effect:weather');
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot eases to the forced storm (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-wx-'));
    try {
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="wx-probe"\n');
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'town', manifest: {} }, payload())));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload())));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-bus-probe.gd'), path.join(dir, 'probe.gd'));
      const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '4', '0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const wx = out.split('\n').filter((l) => l.startsWith('[mojulo-weather]'));
      expect(wx[0]).toMatch(/start .* forced=$/);
      // a blend of 0: the storm at once, its fog thicker and its light dimmer than the schedule's
      expect(wx.at(-1)).toMatch(/->thunderstorm mix=1\.00 .* forced=thunderstorm$/);
      const num = (l, k) => Number(l.match(new RegExp(`${k}=([\\d.]+)`))[1]);
      expect(num(wx.at(-1), 'fog')).toBeGreaterThan(num(wx[0], 'fog'));
      expect(num(wx.at(-1), 'dim')).toBeGreaterThan(num(wx[0], 'dim'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});

// the developer's folder: game/ survives a re-mint, its seed is written once; the kernel attaches game/hooks.gd to every
// level and its named signals fire (kernel 0.13.0)
const PRINT_HOOKS = `extends Node
func attach(l: Node) -> void:
	l.chapter_turned.connect(func(id, carried): print("[mojulo-hooks] chapter %s %s" % [id, carried]))
	l.cue_fired.connect(func(id): print("[mojulo-hooks] cue %s" % id))
	l.menu_opened.connect(func(id): print("[mojulo-hooks] menu %s" % id))
	l.menu_picked.connect(func(id, n): print("[mojulo-hooks] pick %s %d" % [id, n]))
	l.line_requested.connect(func(who, text, menu, i): print("[mojulo-hooks] line %s|%s|%s|%d" % [who, text, menu, i]))
	l.character_event.connect(func(type, id, event): print("[mojulo-hooks] character %s %s" % [type, id]))
`;

describe('the developer\'s folder', () => {
  it('a re-mint keeps game/ whole and seeds hooks.gd only where it is missing', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-owned-'));
    const kernelSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-kernel-'));
    try {
      fs.writeFileSync(path.join(kernelSrc, 'VERSION'), '0.13.0\n');
      const emitted = emitGodotProject({ ref: 'town', score: extractEngineScore({ ref: 'town', manifest: {} }, town()), manifestHash: 'h', kernelVersion: '0.13.0' });
      expect(emitted.files.find((f) => f.file === 'game/hooks.gd')).toMatchObject({ seed: true, text: GAME_HOOKS_GD });
      await writePack({ outDir: out, binaries: [{ rel: 'score.json', bytes: '{}' }], emitted, kernelSrc });
      expect(fs.readFileSync(path.join(out, OWNED_DIR, 'hooks.gd'), 'utf8')).toBe(GAME_HOOKS_GD);
      fs.writeFileSync(path.join(out, OWNED_DIR, 'hooks.gd'), '# mine\n');
      fs.writeFileSync(path.join(out, OWNED_DIR, 'boss.tscn'), '[gd_scene]\n');
      fs.writeFileSync(path.join(out, 'stale.txt'), 'gone after a re-mint');
      await writePack({ outDir: out, binaries: [{ rel: 'score.json', bytes: '{}' }], emitted, kernelSrc });
      expect(fs.readFileSync(path.join(out, OWNED_DIR, 'hooks.gd'), 'utf8')).toBe('# mine\n');
      expect(fs.existsSync(path.join(out, OWNED_DIR, 'boss.tscn'))).toBe(true);
      expect(fs.existsSync(path.join(out, 'stale.txt'))).toBe(false);
      expect(fs.readFileSync(path.join(out, 'README.md'), 'utf8')).toContain('## Yours: `game/`');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
      fs.rmSync(kernelSrc, { recursive: true, force: true });
    }
  });

  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot attaches game/hooks.gd and fires the named signals (MOJULO_GODOT)', () => {
    const run = (payload, args) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-hooks-'));
      try {
        fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'game'));
        fs.writeFileSync(path.join(dir, 'game', 'hooks.gd'), PRINT_HOOKS);
        fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="hooks-probe"\n');
        fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(extractEngineScore({ ref: 'town', manifest: {} }, payload)));
        fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
        fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-bus-probe.gd'), path.join(dir, 'probe.gd'));
        const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return out.split('\n').filter((l) => l.startsWith('[mojulo-hooks]'));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };
    const town = run({ entities, events: lowerPlay({ entities, play: PLAY }, { player: 'hero' }) }, ['4', '0']);
    expect(town).toEqual(expect.arrayContaining([
      '[mojulo-hooks] chapter warned false', '[mojulo-hooks] chapter siege false', '[mojulo-hooks] cue siege-says',
      '[mojulo-hooks] menu mayor', '[mojulo-hooks] line Mayor|[mayor: warning heard]|mayor|0', '[mojulo-hooks] pick mayor 1',
    ]));
    const cast = run({ entities: CAST_ENTITIES, events: lowerPlay({ entities: CAST_ENTITIES, play: CAST_PLAY }, { player: 'hero' }) }, ['4', '0', '90']);
    expect(cast).toEqual(expect.arrayContaining(['[mojulo-hooks] character spawned soldier-1', '[mojulo-hooks] character gone merchant', '[mojulo-hooks] character arrive soldier-1', '[mojulo-hooks] character down soldier-1']));
  }, 120000);
});
