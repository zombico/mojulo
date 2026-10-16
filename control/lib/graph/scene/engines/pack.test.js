// THE PACK PIPELINE's pieces (engines/pack.js), held to what every leg relies on. Whole packs are held byte for byte by
// each leg's own tests; here, the concepts: a bed rendered once per music and loop and written at every path asked
// for, a clean emit that keeps the developer's folder and their seed files, and the game's guards.
import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const renders = [];
vi.mock('../engine-audio.js', () => ({
  renderBed: async (id, { loop = true } = {}) => { renders.push(`${id}:${loop ? 'loop' : 'once'}`); return Buffer.from(`${id}:${loop ? 'loop' : 'once'}`); },
  renderSound: async () => [],
}));
const { bedWriter, emitFolder, refusePixelizer, gameLevels, packPosture, shellExtras, packHash } = await import('./pack.js');

describe('bedWriter', () => {
  it('renders a music once, writes it at every path asked for, and never hands a stinger a looped render', async () => {
    renders.length = 0;
    const binaries = [], beds = bedWriter({ binaries });
    expect(await beds.put('hum')).toBe('audio/hum.wav');
    expect(await beds.put('hum')).toBe('audio/hum.wav');
    // the menu bed lands at its fixed path even though a level already plays the same music
    expect(await beds.put('hum', 'audio/menu.wav')).toBe('audio/menu.wav');
    expect(await beds.put('hum', 'audio/stinger-victory.wav', { loop: false })).toBe('audio/stinger-victory.wav');
    expect(await beds.put(null)).toBeNull();
    expect(await beds.put(undefined, 'audio/menu.wav')).toBeNull();
    expect(renders).toEqual(['hum:loop', 'hum:once']);
    expect(binaries.map((b) => [b.rel, String(b.bytes)])).toEqual([
      ['audio/hum.wav', 'hum:loop'], ['audio/menu.wav', 'hum:loop'], ['audio/stinger-victory.wav', 'hum:once'],
    ]);
  });
});

describe('emitFolder', () => {
  it('clean-emits, keeps the folder the developer owns, and writes a seed file only where missing', async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-pack-'));
    await fs.mkdir(path.join(outDir, 'game'), { recursive: true });
    await fs.writeFile(path.join(outDir, 'game', 'hooks.gd'), 'mine');
    await fs.writeFile(path.join(outDir, 'stale.json'), 'old');
    const { written, writeOut } = await emitFolder({ outDir, keep: 'game', files: [
      { rel: 'score.json', data: '{}' }, { rel: 'game/hooks.gd', data: 'seed', seed: true }, { rel: 'game/new.gd', data: 'seed', seed: true },
    ] });
    await writeOut('portability.json', '[]');
    expect(written.map((w) => w.file)).toEqual(['score.json', 'game/new.gd', 'portability.json']);
    expect(await fs.readFile(path.join(outDir, 'game', 'hooks.gd'), 'utf8')).toBe('mine');
    await expect(fs.stat(path.join(outDir, 'stale.json'))).rejects.toThrow();
    await fs.rm(outDir, { recursive: true, force: true });
  });
});

describe('the guards', () => {
  it('refuses a pixelizer game with the leg\'s reason, and reads a game\'s levels and posture', () => {
    expect(() => refusePixelizer({ manifest: { engine: 'pixelizer', kind: 'game' } }, 'g', 'a 2D reducer is not a scene')).toThrow(/refused: 'g' is a pixelizer game — a 2D reducer is not a scene/);
    expect(refusePixelizer({ manifest: { kind: 'game' } }, 'g', 'x')).toEqual({ kind: 'game' });
    expect(() => gameLevels({ kind: 'world' }, 'w')).toThrow(/'w' is not a game/);
    expect(() => gameLevels({ kind: 'game', levels: [] }, 'g')).toThrow(/declares no levels/);
    expect(packPosture(null, { posture: 'greybox' })).toBe('greybox');
    expect(packPosture('final', { posture: 'greybox' })).toBe('final');
    expect(shellExtras({ menu: {}, front: {}, music: {} })).toEqual(['menu', 'front']);
    // the recipe's identity: a stamped quality grade never moves the hash
    expect(packHash({ kind: 'game', quality: 'A' })).toBe(packHash({ kind: 'game' }));
  });
});
