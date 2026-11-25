// The scroll stage's controls (scroll-stage/controls.js). The concepts: every action has its keys and its pad buttons;
// a pad's buttons are printed in its own layout (the bottom face fires: A, ✕, B); in a game's shell the menu is select,
// whose pause holds start, and Esc is not offered; a level's further keys are the keyboard's alone; the pause panel's rows
// are the same table; and a scroll page's pad reads the shmup's layout (the d-pad flies, never the suit switch) and
// answers the shell's controls panel with it, while any other page keeps its pad read byte for byte.
import { describe, it, expect } from 'vitest';
import { SCROLL_CONTROLS, PAD, scrollControls, scrollLegendRows } from './controls.js';
import { DEVICES } from '../../controls/devices.js';
import { scrollStagePlay } from './stage-scene.js';
import { stageManifest, STAGE_IDS } from './stages.js';
import { emitThreeWorld } from '../../scene/scene-three.js';

const LAYOUTS = Object.keys(DEVICES.gamepad.layouts);
const capsOf = (rows, label) => rows.find((r) => r.label === label).actions;

describe('the scroll stage\'s controls', () => {
  it('every action has its keys and its pad buttons, the pad read on standard-mapping buttons', () => {
    for (const r of SCROLL_CONTROLS) { expect(r.keys.length, r.id).toBeGreaterThan(0); expect(r.pad.length, r.id).toBeGreaterThan(0); }
    for (const k of ['fire', 'eject', 'pod', 'speed', 'menu', 'menuInShell']) for (const b of PAD[k]) { expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(17); }
    expect(PAD.fire).toEqual([DEVICES.gamepad.buttons.south]);
  });

  it('a pad is printed in its own layout: the bottom face fires, as each pad names it', () => {
    const C = scrollControls();
    for (const L of LAYOUTS) {
      expect(C.pad[L]).toHaveLength(SCROLL_CONTROLS.length);
      expect(capsOf(C.pad[L], 'fire')[0]).toBe(DEVICES.gamepad.layouts[L].south);
      expect(C.sheet.pad[L][0].caps).toEqual(['✚', 'L stick']);
    }
    expect(capsOf(C.pad.playstation, 'fire')).toEqual(['✕', 'R2']);
    expect(capsOf(C.keys, 'fire')).toEqual(['J', 'click']);
  });

  it('in a game\'s shell the menu is select (its pause holds start) and Esc is not offered; a level\'s further keys are the keyboard\'s', () => {
    expect(capsOf(scrollControls().keys, 'menu')).toEqual(['Enter', 'Esc']);
    const S = scrollControls({ shell: true, more: 'G  call · H / K  wave' });
    expect(capsOf(S.keys, 'menu')).toEqual(['Enter']);
    expect(capsOf(S.pad.xbox, 'menu')).toEqual(['select']);
    expect(S.keys.slice(-2)).toEqual([{ action: 'G', label: 'call' }, { actions: ['H', 'K'], label: 'wave' }]);
    expect(S.pad.xbox).toHaveLength(SCROLL_CONTROLS.length);
    expect(S.sheet.keys.at(-1)).toEqual({ does: 'wave', caps: ['H', 'K'] });
  });

  it('the pause panel\'s rows are the same table, per device', () => {
    expect(scrollLegendRows('keyboard')[1]).toEqual(['J / click', 'fire']);
    expect(scrollLegendRows('gamepad', 'nintendo')[1]).toEqual(['B / ZR', 'fire']);
    expect(scrollLegendRows('gamepad', 'xbox', { shell: true }).at(-1)).toEqual(['select', 'menu']);
  });

  it('a scroll page\'s pad reads the shmup\'s layout and answers the shell\'s panel with it; another page\'s pad read is as it was', () => {
    const P = scrollStagePlay(stageManifest(STAGE_IDS[0])), face = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], fill: '#888888' }];
    const page = emitThreeWorld({ faces: face, inline: false, cdn: true, entities: P.entities, camera: P.camera });
    expect(page).toContain('const __sP = ');
    expect(page).toContain("__pr.slot = 'next'");
    expect(page).toContain('__pr.swap = false');
    expect(page).toContain("pil.rule.type === 'scroll-ship') { const __sl");
    const other = emitThreeWorld({ faces: face, inline: false, cdn: true, entities: [{ ...P.entities[0], rule: { type: 'platform' } }], camera: { rule: 'follow', target: P.entities[0].id } });
    expect(other).not.toContain('__sP');
    expect(other).not.toContain('const __pr = ');
    expect(other).toContain('return {\n    moveX: mx, moveY: -my,');
  });
});
