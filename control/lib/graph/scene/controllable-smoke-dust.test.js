import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';

const floor = () => ({
  corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]],
  fill: '#333333',
});

const entity = {
  id: 'suit',
  transform: { pos: [0, 0, 0], heading: 0 },
  rule: { type: 'platform', eye: 0, boostSpeed: 20 },
  body: { type: 'mesh', radius: 1 },
};

describe('controllable ground dust smoke', () => {
  it('emits boost, dodge, and topple dust paths only when smoke is enabled', () => {
    const plain = emitThreeWorld({ faces: [floor()], entities: [entity], camera: { rule: 'follow', target: 'suit' } });
    expect(plain).not.toContain('__smkDust');

    const smoky = emitThreeWorld({ faces: [floor()], entities: [entity], camera: { rule: 'follow', target: 'suit' }, smoke: true });
    expect(smoky).toContain('__smkDust');
    expect(smoky).toContain('BOOST/DODGE/TOPPLE DUST');
    expect(smoky).toContain('__smkTopple');
    expect(smoky).toContain('TOPPLE DUST');
    expect(smoky).toContain('p.smokeTrail === false');
    expect(smoky).toContain("':dodge'");
    expect(smoky).toContain('e.rule && e.rule.space');
  });
});
