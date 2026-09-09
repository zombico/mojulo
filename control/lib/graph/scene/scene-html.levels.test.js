import { describe, expect, it } from 'vitest';

import { renderSceneHtml } from './scene-html.js';

// The STILL path for a floorplan `levels[]` stack (paris-t4-stack): scene-html routes it through
// renderHouseToHtml, so the baked still shows the stack, not a seed-generated single floor.
describe('scene-html — floorplan levels[] bakes through the house renderer', () => {
  const room = (glyph) => [{ x: 0, y: 0, w: 30, h: 20, glyph }];
  const stack = {
    kind: 'floorplan', title: 'stack', width: 30, height: 20, view: 'cutaway',
    levels: [
      { index: 0, height: 12, rooms: room('L'), doors: [] },
      { index: 1, height: 8, rooms: room('B'), doors: [] },
    ],
  };
  const single = { kind: 'floorplan', title: 'one', width: 30, height: 20, view: 'cutaway', rooms: room('L'), doors: [] };

  it('renders a stack taller than one floor, and explode changes the framing', () => {
    const flush = renderSceneHtml({ manifest: stack });
    const apart = renderSceneHtml({ manifest: { ...stack, explode: 6 } });
    const one = renderSceneHtml({ manifest: single });
    expect(typeof flush).toBe('string');
    expect(flush.length).toBeGreaterThan(one.length);   // two storeys of walls, not one
    expect(apart).not.toEqual(flush);                    // pulled-apart storeys reframe the still
  });
});
