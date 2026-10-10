import { describe, it, expect } from 'vitest';
import { findBlender, findGodot, findUnity, findUnreal, workersPresent, BLENDER_APP, GODOT_APP } from './find.js';
import { findSlicer } from '../graph/scene/print-gate.js';

// a host made of the paths that exist, the PATH names that resolve, and the env
const host = ({ files = [], path: onPath = {}, env = {}, dirs = {} } = {}) => ({
  env, exists: (p) => files.includes(p), which: (n) => onPath[n] ?? null, readdir: (d) => dirs[d] ?? [],
});

describe('the worker finders', () => {
  it('an env var wins, then the app, then PATH', () => {
    expect(findBlender(host({ env: { MOJULO_BLENDER: '/x/blender' }, files: [BLENDER_APP] }))).toBe('/x/blender');
    expect(findBlender(host({ files: [BLENDER_APP], path: { blender: '/usr/bin/blender' } }))).toBe(BLENDER_APP);
    expect(findBlender(host({ path: { blender: '/usr/bin/blender' } }))).toBe('/usr/bin/blender');
    expect(findBlender(host())).toBe(null);
    expect(findGodot(host({ files: [GODOT_APP] }))).toBe(GODOT_APP);
    expect(findGodot(host())).toBe(null);
  });

  it('Unity and Unreal take the newest installed version', () => {
    const unity = (v) => `/Applications/Unity/Hub/Editor/${v}/Unity.app/Contents/MacOS/Unity`;
    expect(findUnity(host({ dirs: { '/Applications/Unity/Hub/Editor': ['2022.3.1f1', '6000.2.13f1', 'notes'] }, files: [unity('2022.3.1f1'), unity('6000.2.13f1')] }))).toBe(unity('6000.2.13f1'));
    const ue = (v) => `/Users/Shared/Epic Games/${v}/Engine/Binaries/Mac/UnrealEditor-Cmd`;
    expect(findUnreal(host({ dirs: { '/Users/Shared/Epic Games': ['UE_5.4', 'UE_5.8', 'Launcher'] }, files: [ue('UE_5.4')] }))).toBe(ue('UE_5.4'));
    expect(findUnreal(host({ env: { MOJULO_UNREAL: '/x/ue' } }))).toBe('/x/ue');
  });

  it('every worker says its env var, what it runs and what still happens without it; an empty host finds none it must find', () => {
    const W = workersPresent({ host: host(), findSlicer, chromiumCandidates: ['/c/chrome'], ffmpegCached: '/cache/ffmpeg' });
    expect(W.map((w) => w.id)).toEqual(['blender', 'godot', 'unity', 'unreal', 'slicer', 'openscad', 'ffmpeg', 'chromium']);
    for (const w of W) {
      expect(w.uses, w.id).toBeTruthy();
      expect(w.without, w.id).toBeTruthy();
      if (w.id !== 'openscad') expect(w.found, w.id).toBe(null);
    }
    const some = workersPresent({ host: host({ files: ['/c/chrome', '/cache/ffmpeg'], env: { MOJULO_SLICER: '/x/OrcaSlicer' } }), findSlicer, chromiumCandidates: ['/c/chrome'], ffmpegCached: '/cache/ffmpeg' });
    const by = Object.fromEntries(some.map((w) => [w.id, w.found]));
    expect(by).toMatchObject({ chromium: '/c/chrome', ffmpeg: '/cache/ffmpeg', slicer: '/x/OrcaSlicer' });
  });
});
