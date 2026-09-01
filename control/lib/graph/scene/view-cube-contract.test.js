import { describe, expect, it } from 'vitest';

import {
  MSG_FOCUS,
  MSG_VIEW,
  MSG_VIEW_READY,
  STATIC_GROUP,
  VIEW_DIRS,
  VIEW_PRESETS,
  focusMessage,
  isViewReadyMessage,
  selectableGroups,
  viewMessage,
} from './view-cube-contract.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_PAUSE, MSG_CONTROLS } from '../game/level-contract.js';

describe('view-cube contract', () => {
  it('every preset in the strip has a direction', () => {
    for (const v of VIEW_PRESETS) {
      expect(VIEW_DIRS[v], v).toBeDefined();
      expect(VIEW_DIRS[v]).toHaveLength(3);
      expect(VIEW_DIRS[v].some((c) => c !== 0), `${v} must not be the zero vector`).toBe(true);
    }
  });

  it('¾ leads the strip — it is the best single reading', () => {
    expect(VIEW_PRESETS[0]).toBe('threeQuarter');
  });

  it('no direction is parallel to the z-up axis (OrbitControls basis would degenerate)', () => {
    for (const [name, [x, y]] of Object.entries(VIEW_DIRS)) {
      expect(x !== 0 || y !== 0, `${name} is parallel to camera.up`).toBe(true);
    }
  });

  it('round-trips the wire shape', () => {
    expect(viewMessage('front')).toEqual({ moj: MSG_VIEW, view: 'front' });
    expect(isViewReadyMessage({ moj: MSG_VIEW_READY })).toBe(true);
    expect(isViewReadyMessage({ moj: MSG_VIEW })).toBe(false);
    expect(isViewReadyMessage(null)).toBe(false);
    expect(isViewReadyMessage(undefined)).toBe(false);
  });

  it('focus round-trips, and null clears', () => {
    expect(focusMessage('shell:northWall')).toEqual({ moj: MSG_FOCUS, group: 'shell:northWall' });
    expect(focusMessage(null)).toEqual({ moj: MSG_FOCUS, group: null });
    expect(focusMessage(undefined)).toEqual({ moj: MSG_FOCUS, group: null });
  });

  it('selectableGroups drops static, keeps order, and tolerates junk', () => {
    expect(selectableGroups({ groups: [STATIC_GROUP, 'shell:northWall', 'repeat:0'] }))
      .toEqual(['shell:northWall', 'repeat:0']);
    expect(selectableGroups({ groups: [STATIC_GROUP] })).toEqual([]);
    expect(selectableGroups({})).toEqual([]);
    expect(selectableGroups(null)).toEqual([]);
    expect(selectableGroups({ groups: [null, 42, '', 'ok'] })).toEqual(['ok']);
  });

  it('never collides with the game shell dialect on the same wire', () => {
    const game = [MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_PAUSE, MSG_CONTROLS];
    expect(game).not.toContain(MSG_VIEW);
    expect(game).not.toContain(MSG_VIEW_READY);
    expect(game).not.toContain(MSG_FOCUS);
  });
});
