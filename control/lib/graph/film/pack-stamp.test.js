// a scene pack's stamp: of what a build and a render read, never of what they write
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { packStamp } from './pack-stamp.js';

const dir = mkdtempSync(path.join(tmpdir(), 'pack-stamp-'));

describe('a scene pack\'s stamp', () => {
  it('is null where there is no pack', () => expect(packStamp(dir)).toBeNull());

  it('holds through a build and a render, and moves when the scene, a script, an actor or the set is made again', () => {
    for (const d of ['shots', 'actors', 'set']) mkdirSync(path.join(dir, d));
    const put = (f, text) => writeFileSync(path.join(dir, f), text);
    put('scene.json', '{"frames":10}'); put('shots/a.json', '{}'); put('actors.py', 'a'); put('actors/ada.glb', 'glb'); put('set/world.glb', 'set');
    const made = packStamp(dir);
    expect(made).toMatch(/^[0-9a-f]{12}$/);
    mkdirSync(path.join(dir, 'film', 'frames-draft'), { recursive: true });
    put('film.blend', 'blend'); put('film/frames-draft/0001.png', 'png'); put('render.json', '{}'); put('film-gate.json', '{}'); put('set/gate.json', '{}');
    expect(packStamp(dir)).toBe(made);
    const moved = [];
    for (const [f, text] of [['scene.json', '{"frames":12}'], ['actors.py', 'b'], ['actors/ada.glb', 'glb2'], ['set/world.glb', 'set2']]) { put(f, text); moved.push(packStamp(dir)); }
    expect(new Set([made, ...moved]).size).toBe(5);
  });
});
