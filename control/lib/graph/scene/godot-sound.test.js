// A level's sound travels to Godot: its action sounds as one-shot WAVs fired by the bus and the hero's moves, a fight
// score the tension brings in on the bar line, the game's stingers, and a bus layout where the sounds duck the music.
// LAWS over every mechanic's sounds; the meter itself is held equal to the page's by scripts/godot-sound-conformance.mjs
// (run here when MOJULO_GODOT names an engine, with a real level beside it).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { levelSound, soundFiles, SFX_VARIANTS, MOVE_SOUNDS } from './engine-sound.js';
import { extractEngineScore, extractBus } from './engine-score.js';
import { emitGodotProject, emitGodotGame, BUS_LAYOUT_TRES } from './godot-project.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { buildAdaptive } from '../beats/adaptive-music.js';
import { MECHANIC_KINDS, composeMechanics } from '../game/mechanics.js';

const KERNEL = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
const GODOT = process.env.MOJULO_GODOT;
const A = buildAdaptive();
const levelAudio = (spec, mechanics = []) => resolveWorldAudio(spec, { ref: 'lv', mechanics });

describe('levelSound: what a level\'s sound becomes', () => {
  it('is nothing without a channel, and the score carries no key', () => {
    expect(levelSound(null, 'lv')).toBeNull();
    expect(levelSound(levelAudio({ soundtrack: 'field:forest' }), 'lv')).toBeNull();
    expect(extractEngineScore({ ref: 'lv', manifest: {} }, { entities: [] })).not.toHaveProperty('audio');
    expect(extractEngineScore({ ref: 'lv', manifest: {} }, { entities: [], audio: levelAudio({ soundtrack: 'field:forest' }) })).not.toHaveProperty('audio');
  });

  it('every mechanic: each event the page sounds is a sound the pack ships, named for what it plays', () => {
    for (const kind of MECHANIC_KINDS) {
      const audio = levelAudio({ soundtrack: 'field:forest', sfx: 'auto' }, [kind]);
      const s = levelSound(audio, 'lv');
      const ids = new Set(s.score.sounds);
      // the same globs in the same order (the first match wins on both sides), each to the cue the page plays
      expect(Object.keys(s.score.on || {}), kind).toEqual(Object.keys(audio.on || {}));
      for (const [g, id] of Object.entries(s.score.on || {})) {
        expect(ids.has(id), `${kind} ${g}`).toBe(true);
        expect(s.sounds.find((x) => x.id === id).gestures).toEqual(audio.cues[audio.on[g]]);
      }
      for (const [key, moves] of Object.entries(MOVE_SOUNDS)) for (const mv of moves) {
        if (audio[key]?.[mv]?.length) expect(s.sounds.find((x) => x.id === s.score[key][mv]).gestures, `${kind} ${key}.${mv}`).toEqual(audio[key][mv]);
      }
      // one file per take of every sound, and nothing else
      expect(soundFiles({ audio: s.score })).toHaveLength(s.score.sounds.length * s.score.variants);
      expect(s.score.variants).toBe(audio.vary ? SFX_VARIANTS : 1);
    }
  });

  it('a sound\'s id is what it plays: equal cues share one, different cues never do', () => {
    const a = levelSound(levelAudio({ soundtrack: 'field:forest', sfx: 'auto' }, ['hp-pool']), 'a');
    const b = levelSound(levelAudio({ soundtrack: 'field:forest', sfx: 'auto' }, ['hp-pool']), 'b');
    expect(a.score.sounds).toEqual(b.score.sounds);
    const seen = new Map();
    for (const kind of MECHANIC_KINDS) for (const pal of ['arcade', 'foley', 'orchestral', 'synth']) {
      for (const s of levelSound(levelAudio({ soundtrack: 'field:forest', sfx: { auto: pal } }, [kind]), 'lv')?.sounds || []) {
        const k = JSON.stringify(s.gestures);
        if (seen.has(s.id)) expect(seen.get(s.id), s.id).toBe(k);
        seen.set(s.id, k);
        expect(s.id).toMatch(/^[a-z0-9-]+-[0-9a-f]{8}$/);
      }
    }
  });

  it('a fight score ships under the level, with both pieces\' bars and the tension the page reads', () => {
    const audio = levelAudio({ soundtrack: 'field:forest', combat: 'field:battle' }, ['hp-pool']);
    const s = levelSound(audio, 'crypt');
    expect(s.combat).toEqual({ id: 'crypt-combat', recipe: audio.combat });
    expect(s.score).toMatchObject({ combat: 'crypt-combat', bar: { explore: A.barSeconds(audio.soundtrack), combat: A.barSeconds(audio.combat) }, tension: audio.tension });
    expect(soundFiles({ audio: s.score })).toEqual(['audio/crypt-combat.wav']);
  });
});

describe('the takes', () => {
  it('render as WAVs, and a varied sound\'s takes differ from each other', async () => {
    const { renderSound } = await import('./engine-audio.js');
    const s = levelSound(levelAudio({ soundtrack: 'field:forest', sfx: 'auto' }, ['hp-pool']), 'lv');
    const one = s.sounds.find((x) => x.id === s.score.on['hit:*']);
    const takes = await renderSound(one, s.score.variants);
    expect(takes).toHaveLength(SFX_VARIANTS);
    for (const w of takes) expect(Buffer.from(w).subarray(0, 4).toString()).toBe('RIFF');
    expect(new Set(takes.map((w) => Buffer.from(w).toString('base64'))).size).toBe(SFX_VARIANTS);
  }, 60000);
});

describe('the pack', () => {
  const withSound = extractEngineScore({ ref: 'lv', manifest: {} }, { entities: [], audio: levelAudio({ soundtrack: 'field:forest', combat: 'field:battle', sfx: 'auto' }, ['hp-pool']) });
  const without = extractEngineScore({ ref: 'lv', manifest: {} }, { entities: [] });

  it('ships the bus layout and a Sound section only with sound; without it, every file as before', () => {
    const files = (score) => emitGodotProject({ ref: 'lv', score, manifestHash: 'h', kernelVersion: '0.19.0' }).files;
    const on = files(withSound), off = files(without);
    expect(on.find((f) => f.file === 'default_bus_layout.tres').text).toBe(BUS_LAYOUT_TRES);
    expect(off.map((f) => f.file)).not.toContain('default_bus_layout.tres');
    expect(on.find((f) => f.file === 'README.md').text).toMatch(/## Sound[\s\S]*fight score \(`audio\/lv-combat\.wav`\)/);
    expect(off.find((f) => f.file === 'README.md').text).not.toContain('## Sound');
    expect(withSound.ledger).toHaveProperty('sfx_carried');
    expect(withSound.ledger).toHaveProperty('combat_music_carried');
    expect(without.ledger).not.toHaveProperty('sfx_carried');
  });

  it('the layout: Music, SFX and UI under Master, the music ducked by the sounds', () => {
    expect(BUS_LAYOUT_TRES).toMatch(/bus\/1\/name = &"Music"[\s\S]*bus\/1\/effect\/0\/effect = SubResource\("duck"\)/);
    expect(BUS_LAYOUT_TRES).toMatch(/sidechain = &"SFX"/);
    for (const [i, n] of [[2, 'SFX'], [3, 'UI']]) expect(BUS_LAYOUT_TRES).toContain(`bus/${i}/name = &"${n}"`);
  });

  it('a game with stingers ships the layout and says so; one without, as before', () => {
    const lv = { ref: 'a', title: 'A', gate: null, score: without };
    const game = (music) => emitGodotGame({ ref: 'g', title: 'G', manifestHash: 'h', levels: [lv], music, kernelVersion: '0.19.0' });
    const on = game({ stingers: ['victory', 'defeat'] }), off = game({});
    expect(on.files.map((f) => f.file)).toContain('default_bus_layout.tres');
    expect(on.ledger.stingers_carried.kinds).toEqual(['victory', 'defeat']);
    expect(on.files.find((f) => f.file === 'README.md').text).toContain('`audio/stinger-victory.wav`');
    expect(off.files.map((f) => f.file)).not.toContain('default_bus_layout.tres');
    expect(off.files.find((f) => f.file === 'README.md').text).not.toContain('## Sound');
  });

  it('the kernel: the level makes its Sound from the score and feeds it the bus; the game plays the stingers', () => {
    const level = fs.readFileSync(path.join(KERNEL, 'level.gd'), 'utf8'), game = fs.readFileSync(path.join(KERNEL, 'game.gd'), 'utf8');
    expect(level).toContain('const SoundScript := preload("res://kernel/sound.gd")');
    expect(level).toMatch(/bus_event\.emit\(String\(e\["type"\]\), e\)\n\t\tif sound != null:\n\t\t\tsound\.hear\(/);
    expect(game).toMatch(/func level_finish[\s\S]*play_stinger\("victory" if success else "defeat"\)/);
  });
});

// a mono 16-bit WAV of `seconds` of silence: the Godot leg tests the kernel, not the render
function silentWav(seconds, rate = 22050) {
  const n = Math.max(1, Math.round(seconds * rate)), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

const CRAWL = [
  { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeDur: 0.5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'grub-1', rule: { type: 'static' }, transform: { pos: [1.8, 0.3, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 0.8], hittable: true, hp: 40, radius: 0.5 } },
  { id: 'grub-2', rule: { type: 'static' }, transform: { pos: [1.8, -0.3, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 0.8], hittable: true, hp: 40, radius: 0.5 } },
];

describe.skipIf(!GODOT)('the Godot kernel (MOJULO_GODOT)', () => {
  it('runs the meter and the change equal to the page\'s', async () => {
    const { soundCorpus, runWeb, runGodotSound, compare } = await import('../../../scripts/godot-sound-conformance.mjs');
    const corpus = soundCorpus();
    const web = runWeb(corpus);
    // the corpus reaches both changes, so equality means something
    expect(web.traces.flat().some((r) => r[3] === 'combat') && web.traces.flat().some((r) => r[3] === 'explore')).toBe(true);
    const { out, errors } = runGodotSound(corpus, GODOT);
    expect(errors).toEqual([]);
    expect(compare(web, out).filter((r) => !r.equal)).toEqual([]);
  }, 120000);

  it('a fight in a real level: the hits sound, the fight score comes in, and calm takes it back out', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-sound-'));
    try {
      const m = composeMechanics([{ kind: 'hp-pool', entities: [{ id: 'grub-1', hp: 40 }, { id: 'grub-2', hp: 40 }] }, { kind: 'defeat-all' }]);
      const audio = resolveWorldAudio({ soundtrack: 'field:forest', combat: 'field:battle', sfx: 'auto', tension: { decay: 1 } }, { ref: 'crawl', mechanics: ['hp-pool', 'defeat-all'] });
      const payload = { entities: CRAWL, events: m.events, audio };
      const score = extractEngineScore({ ref: 'crawl', manifest: {} }, payload);
      fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="sound-probe"\n');
      fs.writeFileSync(path.join(dir, 'default_bus_layout.tres'), BUS_LAYOUT_TRES);
      fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(score));
      fs.writeFileSync(path.join(dir, 'bus.json'), JSON.stringify(extractBus(payload)));
      fs.writeFileSync(path.join(dir, 'contract.json'), JSON.stringify({ on: m.on }));
      fs.mkdirSync(path.join(dir, 'audio', 'sfx'), { recursive: true });
      for (const f of soundFiles(score)) fs.writeFileSync(path.join(dir, f), silentWav(f.includes('/sfx/') ? 0.1 : 4 * score.audio.bar.combat));
      fs.writeFileSync(path.join(dir, 'audio', 'explore.wav'), silentWav(4 * score.audio.bar.explore));
      fs.copyFileSync(path.join(process.cwd(), 'scripts', 'godot-sound-probe.gd'), path.join(dir, 'probe.gd'));
      execFileSync(GODOT, ['--headless', '--import', '--path', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const out = execFileSync(GODOT, ['--headless', '--fixed-fps', '60', '--path', dir, '--script', 'res://probe.gd', '--', '0', '0', '1.8', '0', '3', '1500'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (process.env.MOJULO_KEEP_PACK) console.log(out);
      const lines = out.split('\n').filter((l) => l.startsWith('[mojulo-sound] '));
      expect(lines[0]).toMatch(/start buses=Master,Music,SFX,UI duck=AudioEffectCompressor sounds=\d+ fight=true music_bus=Music/);
      // every swing has its sound (the hero's own move), and every landed swing is a hit on the bus with its sound: two
      // grubs struck in one frame sound once (one sound at most every 60 ms of game time, the page's rule)
      const hit = score.audio.on['hit:*'], played = (id) => lines.filter((l) => l.startsWith(`[mojulo-sound] played ${id} `)).length;
      expect(played(score.audio.strike.swing)).toBe(3);
      expect(played(hit)).toBe(3);
      // two hits (0.35 each) pass enter: the fight score comes in, after the first hit and within a bar and a quarter
      const frame = (l) => Number(/ f=(\d+)/.exec(l)[1]);
      const firstHit = frame(lines.find((l) => l.startsWith(`[mojulo-sound] played ${hit} `)));
      const toCombat = lines.find((l) => l.startsWith('[mojulo-sound] music combat '));
      expect(toCombat).toBeTruthy();
      expect(frame(toCombat)).toBeGreaterThan(firstHit);
      // then the tension leaks under exit, holds there two bars, and the explore score comes back
      const toExplore = lines.find((l) => l.startsWith('[mojulo-sound] music explore '));
      expect(toExplore).toBeTruthy();
      expect((frame(toExplore) - frame(toCombat)) / 60).toBeGreaterThanOrEqual(2 * score.audio.bar.combat);
      expect(lines.at(-1)).toMatch(/end active=explore/);
      expect(out).not.toMatch(/SCRIPT ERROR|Parse Error/);
    } finally {
      if (process.env.MOJULO_KEEP_PACK) console.log('pack kept at', dir); else fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 180000);
});
