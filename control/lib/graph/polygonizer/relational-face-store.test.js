// The realistic face rig's shapes on disk (relational-face-store.js): a head's shapes read back exactly as kept, keyed
// on the face the figure carries; a file that is not one reads as none; the newest kept; none under vitest unless a
// suite names its folder.
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, writeFileSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { faceStoreKey, readFaceStore, writeFaceStore, setFaceStoreDir, faceStoreDir, KEEP } from './relational-face-store.js';

const shapes = (s) => ({ V0: [[s, 0.1, 0.2], [0.3, s + 1e-17, 0.5]], D: { blink: Float64Array.from([1e-9, 2, 3, 4, 5, Math.PI * s]), smile: new Float64Array(6) } });
afterEach(() => setFaceStoreDir(null));

describe('the face rig\'s store', () => {
  it('is off under vitest unless a suite names its folder', () => {
    expect(faceStoreDir()).toBeNull();
    writeFaceStore('k', shapes(1)); expect(readFaceStore('k')).toBeNull();
  });
  it('reads a head\'s shapes back exactly; another face is another key; a file that is not one reads as none', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'face-store-')); setFaceStoreDir(dir);
    const key = faceStoreKey('rig', [{ face: 1 }]);
    expect(faceStoreKey('rig', [{ face: 2 }])).not.toBe(key);
    expect(readFaceStore(key)).toBeNull();
    writeFaceStore(key, shapes(0.7));
    const T = readFaceStore(key);
    expect(T.V0).toEqual(shapes(0.7).V0);
    expect(Object.keys(T.D)).toEqual(['blink', 'smile']);
    expect(Array.from(T.D.blink)).toEqual(Array.from(shapes(0.7).D.blink));
    writeFileSync(path.join(dir, `${key}.bin`), 'not a store'); expect(readFaceStore(key)).toBeNull();
  });
  it('keeps the newest heads', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'face-store-')); setFaceStoreDir(dir);
    for (let i = 0; i <= KEEP; i++) { writeFaceStore(`h${i}`, shapes(i)); utimesSync(path.join(dir, `h${i}.bin`), 1000 + i, 1000 + i); }
    writeFaceStore('last', shapes(9));
    const kept = readdirSync(dir);
    expect(kept).toHaveLength(KEEP); expect(kept).toContain('last.bin'); expect(kept).not.toContain('h0.bin'); expect(kept).not.toContain('h1.bin');
  });
});
