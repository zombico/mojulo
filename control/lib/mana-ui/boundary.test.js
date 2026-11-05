import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manaUiSource } from './kernel.js';

// The boundary: mana-ui imports nothing outside its own folder, so an engine's backend can read the same spec and the
// folder can become a package of its own unchanged. What it needs from mojulo comes in through the host (read, act) and
// the page's tokens, never an import. (Tests may import anything: they hold the folder to the rest.)
const DIR = path.dirname(fileURLToPath(import.meta.url));

describe('mana-ui: the boundary', () => {
  it('every module imports only its siblings', () => {
    const mods = fs.readdirSync(DIR).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
    expect(mods.length).toBeGreaterThan(0);
    for (const f of mods) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      const specs = [...src.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm), ...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
      for (const s of specs) expect(/^\.\/[^/]+\.js$/.test(s), `${f} imports ${s}`).toBe(true);
    }
  });
  // a view, never a controller: the page's one input paradigm (controls/: the schemes, their drivers, the seats kernel)
  // reads the devices and hands the runtime intents (controls/mana-host.js); the kernel names no key and polls no pad
  it('the runtime reads no device', () => {
    const src = manaUiSource();
    for (const w of ['getGamepads', 'keydown', 'keyup', 'KeyboardEvent', 'inputSources', 'navigator.'] ) expect(src.includes(w), `the kernel reads a device: ${w}`).toBe(false);
  });
});
