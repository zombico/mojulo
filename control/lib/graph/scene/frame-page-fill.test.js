import { describe, expect, it } from 'vitest';
import { emitThreeWorld } from './scene-three.js';
import { frameEntity } from '../assault-frame/pilot.js';

// A FRAME'S LEVEL, PLAYED, fills its window (as a mission's does): a studio page's fixed height taller than the window
// would push the view's middle, where the reticle stands and a shot frames its subjects, below the window's.
const floor = { corners: [[-50, -50, 0], [50, -50, 0], [50, 50, 0], [-50, 50, 0]], fill: '#333333' };
const FILL = 'html,body{height:100%;overflow:hidden}#wrap{width:100vw;height:100vh;height:100dvh;max-width:none;aspect-ratio:auto}';

describe('a frame\'s level page', () => {
  it('fills the window when a frame is piloted; a studio page keeps its own size', () => {
    const played = emitThreeWorld({ faces: [floor], entities: [frameEntity('vanguard', { id: 'p', at: [0, 0, 0], pilot: true })], camera: { rule: 'follow', target: 'p' } });
    const still = emitThreeWorld({ faces: [floor], entities: [{ id: 'w', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'w' } });
    expect(played).toContain(FILL);
    expect(still).not.toContain(FILL);
  });
});
