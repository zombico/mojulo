import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { touchLayout, touchScript } from './controllable/touch.js';
import { terrainChannelScript } from './terrain-lod.js';

// ── one page, one scope ──────────────────────────────────────────────────────────────────────────────────────────
// The channel scripts are spliced into one module script, so a top-level name two of them declare is a SyntaxError
// that blanks the whole page before a frame is drawn. The touch pad rides every game made for a screen and the terrain
// LOD every airspace and terrain world, so a flight game carries both: the pair that once collided (`__tShown`). The
// emit fixture matrix (emit-parse.test.js) has no terrain or screen fixture; this holds the pair on its own.

const TOP = /^(?:const|let|var|function\*?|class|async function)\s+([A-Za-z_$][\w$]*)/;
const topNames = (src) => src.split('\n').map((l) => TOP.exec(l)?.[1]).filter(Boolean);

const parses = (src) => {
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    return String(e.stderr || e.message).slice(0, 400);
  }
};

const touch = touchScript(touchLayout([{ id: 'p', pilotable: true, rule: { type: 'platform' } }], { mode: 'follow' }, {}));
const terrain = terrainChannelScript({ kernel: 'function () { return {}; }', K: { grids: {} } });

describe('channel scripts spliced into one page share its scope', () => {
  it('the touch pad and the terrain LOD declare no top-level name in common', () => {
    const mine = new Set(topNames(touch));
    expect(mine.size).toBeGreaterThan(5);
    expect(topNames(terrain).filter((n) => mine.has(n))).toEqual([]);
  });

  it('the two together parse as one module', () => {
    // (the page defines these before the channels; stubbed so the check is about the pair, not the host)
    const host = 'const THREE = {}; const scene = {}; const camera = {}; const renderer = {};\n';
    expect(parses(host + touch + '\n' + terrain)).toBeNull();
  });
});
