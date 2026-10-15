import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractEngineScore } from './engine-score.js';
import { emitGodotProject } from './godot-project.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { LOOKS, lookRGB } from '../playscape/elements/elements.js';

const KERNEL = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
const entities = [
  { id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'ghost', dormant: true, rule: { type: 'static' }, transform: { pos: [3, 0, 0.5] }, body: { type: 'mesh', shape: 'sphere', radius: 0.5 } },
];
const scoreOf = (then) => {
  const events = lowerPlay({ entities, play: { cues: [{ id: 'x', when: { start: true }, then }] } }, { player: 'hero' });
  return extractEngineScore({ ref: 'looks-test', manifest: {} }, { entities, events });
};

describe('the score carries the looks', () => {
  it('the looks a world\'s cues put on, in plain colours, the transits they play, and a ledger line', () => {
    const s = scoreOf([{ status: { who: 'hero', is: 'soaked', look: 'rain' } }, { status: { who: 'hero', is: 'struck', look: 'kokusen' } }, { status: { who: 'hero', is: 'cursed', look: { color: 'copper', coat: { k: 0.7 } } } }, { spawn: { who: 'ghost', with: 'hologram' } }]);
    expect(Object.keys(s.looks)).toEqual(['soaked', 'struck', 'cursed']);
    expect(s.looks.soaked).toEqual(lookRGB(LOOKS.rain));
    expect(s.looks.cursed.color).toEqual(expect.arrayContaining([expect.any(Number)]));
    expect(s.transits).toEqual(['hologram']);
    expect(s.ledger.looks_carried).toMatchObject({ count: 3, names: ['soaked', 'struck', 'cursed'], transits: ['hologram'], drawn: ['coat', 'motes', 'drift'], not_drawn: ['bolts'] });
    expect(s.ledger.looks_carried.note).toMatch(/no adapter wears a look yet/);
  });

  it('no looks, no key: a world that puts none on is unchanged', () => {
    const s = scoreOf({ kill: 'hero' });
    expect(s).not.toHaveProperty('looks');
    expect(s).not.toHaveProperty('transits');
    expect(s.ledger).not.toHaveProperty('looks_carried');
    const files = emitGodotProject({ ref: 'r', score: s, manifestHash: 'h', kernelVersion: '0.6.0' }).files;
    expect(files.find((f) => f.file === 'README.md').text).not.toContain('## Looks');
  });

  it('the README says how a script wears them', () => {
    const s = scoreOf([{ status: { who: 'hero', is: 'soaked', look: 'rain' } }, { vanish: { who: 'hero', with: 'scan' } }]);
    const readme = emitGodotProject({ ref: 'r', score: s, manifestHash: 'h', kernelVersion: '0.6.0' }).files.find((f) => f.file === 'README.md').text;
    expect(readme).toContain('## Looks');
    expect(readme).toContain('$Level.looks.wear($Level.find_child("hero"), "soaked")');
    expect(readme).toContain('$Level.looks.transit(node, "scan", "in")');
  });
});

describe('the kernel', () => {
  it('ships looks.gd and look_coat.gdshader (since 0.6.0), and level.gd makes the Looks node from the score', () => {
    // the kernel is at 0.22.0 (the cast's farthest spawn and spawn guard, 2026-10-15); looks arrived at 0.6.0
    expect(fs.readFileSync(path.join(KERNEL, 'VERSION'), 'utf8').trim()).toBe('0.22.0');
    const level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8'), looks = fs.readFileSync(path.join(KERNEL, 'looks.gd'), 'utf8');
    expect(level).toContain('load("res://kernel/looks.gd")');
    expect(level).toMatch(/score\.has\("looks"\) or score\.has\("transits"\)/);
    expect(looks).toContain('load("res://kernel/look_coat.gdshader")');
    for (const f of ['func wear(', 'func lift(', 'func transit(', 'material_overlay', 'add_animation_library("transits"']) expect(looks).toContain(f);
    expect(fs.readFileSync(path.join(KERNEL, 'look_coat.gdshader'), 'utf8')).toMatch(/shader_type spatial;/);
  });

  // the advisory gate: a real Godot wears every look, plays every transit and lifts them (MOJULO_GODOT names the binary)
  it.skipIf(!process.env.MOJULO_GODOT)('a headless Godot wears, transits and lifts (MOJULO_GODOT)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-looks-'));
    fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="looks-probe"\n');
    fs.writeFileSync(path.join(dir, 'looks.json'), JSON.stringify(Object.fromEntries(['orbit', 'rain', 'kokusen', 'twinkle', 'wind'].map((k) => [k, lookRGB(LOOKS[k])]))));
    const out = execFileSync(process.env.MOJULO_GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', path.join(process.cwd(), 'scripts', 'godot-looks-probe.gd'), '--', path.join(dir, 'looks.json')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = out.split('\n').filter((l) => l.startsWith('[mojulo-looks]'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/worn=5 overlays=1 lit=1 billboards=[1-9]\d* runs=5/);
    expect(lines[1]).toMatch(/worn=0 overlays=0 lit=0 billboards=0 runs=0 fade=0\.00 visible=true gone=4/);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 120000);
});

describe('the kernel plays the weather', () => {
  it('level.gd builds the weather node from score.weather, and weather.gd eases fog, colour and light through the timeline', () => {
    const level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8'), wx = fs.readFileSync(path.join(KERNEL, 'weather.gd'), 'utf8');
    expect(level).toContain('preload("res://kernel/weather.gd")');
    expect(level).toContain('score.get("weather")');
    for (const f of ['func state_at(', 'func look_at(', 'env.fog_density', 'env.fog_light_color', 'light_energy']) expect(wx).toContain(f);
  });
});
