import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../controllable-world.js';

// A DODGE UNDER WORLD OR CAMERA MOVEMENT (combat-hit.js beginDodge `moveH`): the stick is where the body goes, so the
// roll goes along it, the body turned to face it; S held is a roll toward the camera, never a backflip away from it.
const hero = (move) => ({ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, dodge: true, dodgeDur: 0.4, dodgeCooldown: 0, ...move }, transform: { pos: [0, 0, 0], heading: Math.PI / 2 } });
const roll = (move, stick) => {
  const w = createWorld({ entities: [hero(move)] }), e = w.byId.p, hooks = { ground: () => 0 };
  for (let i = 0; i < 4; i++) stepWorld(w, {}, 1 / 60, hooks);
  // (the stick pushed, then F tapped twice inside the window)
  for (let i = 0; i < 6; i++) stepWorld(w, { ...stick, boost: i === 0 || i === 2 ? 1 : 0 }, 1 / 60, hooks);
  return { e, at: e.transform.pos.slice() };
};

describe('the dodge under world movement', () => {
  it('rolls the way the stick points, the body turned to face it', () => {
    const { e } = roll({ move: 'world', moveYaw: Math.PI / 2 }, { forward: -1 });
    expect(e.dodgeT).not.toBeNull();
    expect(e.dodgeKind).toBe('fwd');
    expect(e.dodgeDir[1]).toBeLessThan(-0.99);   // south: toward the screen's bottom
    expect(Math.sin(e.transform.heading)).toBeLessThan(-0.99);
  });
  it('a body that moves on its own heading still backflips on S', () => {
    const { e } = roll({}, { forward: -1 });
    expect(e.dodgeKind).toBe('back');
  });
});
