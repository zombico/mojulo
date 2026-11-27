import { describe, it, expect } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { infiltrationRoom } from './infiltration-room.js';
import { STUNT_CLIPS } from '../playscape/player.js';

// THE LEDGE IN THE INFILTRATION YARD: Steel Serpents' operative hangs from a lip, shimmies along it and pulls up over it
// on the dive's button (its jump is the dive's), in the ledge's own poses
const G = { id: 'steel-serpents', name: 'Steel Serpents', feel: 'steel-serpents' };
const CW = composeLive();
CW.RULES.__faceWall = (e) => { e.camYaw = Math.PI / 2; };
// a block 10 m long, its south face at y = 0, its top 3.2 m up
const BLOCK = { min: [0, 0, 0], max: [10, 4, 3.2] };
const ground = { ground: (p) => (p[0] >= 0 && p[0] <= 10 && p[1] >= 0 && p[1] <= 4 && p[2] >= 2.6 ? 3.2 : 0) };

function hung(room) {
  const h0 = room.manifest.entities.find((e) => e.id === 'hero');
  const w = CW.createWorld({ entities: [{ ...h0, transform: { pos: [5, -0.5, 2.5], heading: Math.PI / 2 } }], camera: { rule: '__faceWall' }, colliders: [BLOCK] });
  w.pilotId = 'hero';
  const step = (n, inp = {}) => { for (let i = 0; i < n; i++) CW.stepWorld(w, inp, 1 / 60, ground); };
  return { w, h: w.byId.hero, step };
}

describe('the infiltration yard: the ledge', () => {
  it('the operative takes a lip; the stand-in hangs, shimmies and pulls up in the ledge\'s poses', () => {
    const room = infiltrationRoom(G, {});
    expect(room.manifest.entities.find((e) => e.id === 'hero').rule.ledge).toBe(true);
    const F = room.manifest.figures.hero;
    expect(F.clips).toMatchObject({ hang: 'hang', shimmy: 'shimmy', mantle: 'pullUp' });
    for (const k of ['hang', 'shimmy', 'pullUp']) expect(F.hero.clips[k]).toEqual(STUNT_CLIPS[k]);
  });

  it('a made hero minted without them plays its jump\'s flight; minted with them (stunt), its own', () => {
    const bare = infiltrationRoom(G, { refs: { hero: 'h-1' } }).manifest.figures.hero.clips;
    expect(bare.hang).not.toBe('hang');
    const own = infiltrationRoom(G, { refs: { hero: 'h-1' }, stunt: true }).manifest.figures.hero.clips;
    expect(own).toMatchObject({ hang: 'hang', shimmy: 'shimmy', mantle: 'pullUp' });
    // (its own climb, named, wins over the pull up)
    expect(infiltrationRoom(G, { refs: { hero: 'h-1' }, stunt: true, climb: 'myClimb' }).manifest.figures.hero.clips.mantle).toBe('myClimb');
  });

  it('caught from a fall, shimmied along by the stick, pulled up over on the dive\'s button, no dive taken', () => {
    const { h, step } = hung(infiltrationRoom(G, {}));
    step(40);
    expect(h.ledge).toBeTruthy();
    expect(h.locomotion).toBe('hang');
    const x0 = h.transform.pos[0];
    step(30, { strafe: 1 });
    expect(h.locomotion).toBe('shimmy');
    expect(h.transform.pos[0]).toBeGreaterThan(x0 + 0.3);
    step(2, { dive: 1 });
    expect(h.dodgeT ?? null).toBeNull();
    step(50);
    expect(h.ledge ?? null).toBeNull();
    expect(h.transform.pos[1]).toBeGreaterThan(0);                 // (over the lip, onto the top)
    expect(h.transform.pos[2]).toBeGreaterThan(3);
  });
});
