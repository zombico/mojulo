import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';
import { resolveSignage } from '@/lib/signage-chrome';

const wall = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888888' };

describe('emitThreeWorld signage channel', () => {
  it('is byte-identical when no signage is supplied', () => {
    const a = emitThreeWorld({ faces: [wall] });
    const b = emitThreeWorld({ faces: [wall], signs: [] });
    expect(a).toBe(b);
    expect(a).not.toMatch(/mojSigns/);
    expect(a).not.toMatch(/stepSigns = function/); // the channel body is NOT emitted
    expect(a).toMatch(/let stepSigns = \(\) => \{\};/); // inert stub IS present (loop calls it)
  });

  it('emits the overlay layer, CSS, channel body, and per-frame projection when signs are present', () => {
    const signs = resolveSignage(
      [
        { variant: 'popup', body: ['hello', 'world'], anchor: { object: 'tower-3' }, id: 's1' },
        { variant: 'toast', text: '+100', anchor: { slot: 'top' }, after: 0.5, ttl: 2, id: 't1' },
      ],
      { palette: { mood: 'night', bg: '#0b1018', lamps: [{ color: '#ffd9a0' }] } },
    );
    const html = emitThreeWorld({ faces: [wall], signs });
    expect(html).toMatch(/id="mojSigns"/);
    expect(html).toMatch(/\.moj-sign\{/);
    expect(html).toMatch(/signMeshCenter/); // object anchors resolve via render-group name
    expect(html).toMatch(/\.project\(camera\)/); // billboarded per frame
    expect(html).toMatch(/dataset\.signId/); // sign divs built at runtime carry their id
    expect(html).not.toMatch(/\$\{signageBlock\}/); // template interpolated, not left literal
    expect(html).toMatch(/"id":"s1"/);
  });

  it('wires stepSigns into the per-frame step', () => {
    const signs = resolveSignage([{ variant: 'tooltip', text: 'x', anchor: { world: [1, 2, 3] }, id: 'w1' }], {
      palette: { mood: 'flat' },
    });
    const html = emitThreeWorld({ faces: [wall], signs });
    expect(html).toMatch(/stepSigns\(t\);/); // called inside __mojStep
    expect(html).toMatch(/stepSigns = function/); // channel body defines it
  });
});
