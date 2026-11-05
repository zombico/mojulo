import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { IDIOMS, IDIOM_IDS, withIdioms } from './idioms.js';
import { SAMPLE_STATE } from './samples.js';

// The sweep over the idioms (a catalog, so deep): each says what it reads and emits, and its example draws on the
// sample state. A screen can be moved through and left; a HUD part takes no focus.
const read = (p) => manaUi.readPath(SAMPLE_STATE, p);

describe('mana-ui: every idiom', () => {
  for (const id of IDIOM_IDS) {
    it(id, () => {
      const I = IDIOMS[id];
      for (const k of ['about', 'reads', 'emits']) expect(typeof I[k], `${id}.${k}`).toBe('string');
      const use = { use: id, props: I.example };
      if (I.kind === 'hud') {
        const rt = manaUi.runtime(withIdioms({ hud: { use: 'hud', children: [use] }, screens: {} }), { read });
        expect(rt.state().focusables).toBe(0);
        expect(rt.view(), `${id} draws something on its example`).not.toContain('<div class="mana-hud"></div>');
      } else {
        const S = JSON.parse(JSON.stringify(SAMPLE_STATE)), at = (p) => manaUi.readPath(S, p);
        const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: use } }), { read: at, act: () => {} });
        if (I.waits) {
          // nothing to press while it waits; something once the game says it is ready
          const path = I.example[I.waits].bind, k = path.split('.'), last = k.pop();
          k.reduce((o, x) => o[x], S)[last] = false; rt.tick();
          expect(rt.state().focusables, `${id} waits`).toBe(0);
          k.reduce((o, x) => o[x], S)[last] = true; rt.tick();
        }
        expect(rt.state().focusables, `${id} has something to press`).toBeGreaterThan(0);
        for (const a of ['down', 'right', 'tabNext', 'up', 'left', 'tabPrev']) rt.press(a);
        rt.press('back');
        expect(rt.state().screen, `${id} lets the player out`).toBe(null);
      }
    });
  }
});
