// THE INPUT MAP: a hero's actions on each device, read from the pilot scheme (never a key written by hand).
import { describe, it, expect } from 'vitest';
import { inputMap, movesetLegend } from './input-map.js';
import { SCHEMES } from '../controls/schemes.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { DEVICES } from '../controls/devices.js';

describe('the input map', () => {
  const K = buildControlsKernel();
  it('names each action by the scheme\'s own binding, on keys or the mouse and on a pad', () => {
    const rows = inputMap({ moveset: true, sidearm: 'bow', sprint: true, dodge: true, lock: true });
    const B = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad });
    for (const r of rows) expect(SCHEMES.pilot.actions.some((a) => a.id === r.id), r.id).toBe(true);
    const guard = rows.find((r) => r.id === 'guard');
    expect(guard.keys).toBe(K.label(DEVICES, 'keyboard', B.bind.keyboard.guard[0]));
    expect(guard.pad).toBe(K.label(DEVICES, 'gamepad', B.bind.gamepad.guard[0], 'xbox'));
    // (an attack has no key: it is the mouse's)
    expect(rows.find((r) => r.id === 'light').keys).toBe('click');
    expect(rows.find((r) => r.id === 'special').what).toBe('bow (hold)');
    // (the special has a key: not every mouse has a forward button)
    expect(rows.find((r) => r.id === 'special').keys).toBe('Q');
  });
  it('a hero with no moveset has no attack rows; the legend of one with a kit says its attacks and its sidearm', () => {
    expect(inputMap({}).map((r) => r.id)).toEqual(['pause']);
    const L = movesetLegend({ sidearm: 'bow' });
    for (const w of ['light', 'heavy', 'bow (hold)', 'specials', 'guard']) expect(L).toContain(w);
    expect(L).not.toContain('pause');
    expect(movesetLegend()).toContain('special');
  });
  it('the pause sheet lists a moveset\'s attacks only for a hero that has one', () => {
    const B = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, mouse: DEVICES.mouse, gamepad: DEVICES.gamepad });
    const labels = (ctx) => K.legend(SCHEMES.pilot, B, DEVICES, ctx).map((r) => r[1]);
    expect(labels({ moveset: true, sidearm: true, armed: true })).toEqual(expect.arrayContaining(['light attack', 'heavy attack', 'sidearm (hold)', 'guard']));
    expect(labels({ moveset: true, armed: true })).not.toContain('fire');
    expect(labels({ armed: true })).toContain('fire');
    expect(labels({ armed: true })).not.toContain('light attack');
  });
});
