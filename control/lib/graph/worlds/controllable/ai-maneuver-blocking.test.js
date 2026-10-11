import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// AI MANEUVER SOLIDITY (mind.js dodge/tackle playbacks). The seek path always resolved
// `world.colliders`, but the dodge-roll and tackle-charge playbacks returned early WITHOUT a
// blocking pass — at tackle speed a 16-unit wall (the depot's interior divide) crossed in a
// frame or two and the eject released the suit on the far side: the NEWTYPE body-check phased
// through walls, and rolls tunnelled through pillars. Both playbacks now block like the pilot's
// dash phase (rules-platform resolves after every horizontal write).
//
// Box dims mirror the Depot map (sk_ms_hangar_arena): the interior divide X[992,1008] and a
// 34² pillar X[343,377] Y[283,317].

const DT = 1 / 60;
const body = { hp: 1000, radius: 8, collideRadius: 3.5, collideHeight: 22 };
const aiRule = {
  type: 'ai', speed: 10, boostSpeed: 34, turn: 2.4, standoff: 60, eye: 0,
  collideRadius: 3.5, collideHeight: 22,
};

function world(aiPos, colliders) {
  return createWorld({
    entities: [
      { id: 'target', pilotable: true, rule: { type: 'static' }, ambient: { type: 'static' }, body, transform: { pos: [2000, 2000, 0], heading: 0 } },
      { id: 'ai', rule: { ...aiRule }, body, transform: { pos: aiPos, heading: 0 } },
    ],
    camera: { rule: 'follow', target: 'target', dist: 30, height: 14 },
    colliders,
  });
}
const ai = (state) => state.entities.find((e) => e.id === 'ai');

describe('AI maneuver solidity (depot walls/pillars)', () => {
  it('a tackle charge STOPS at the interior wall instead of phasing through', () => {
    const wall = { min: [992, 0, 0], max: [1008, 450, 150] };
    const state = world([975, 200, 0], [wall]);
    const e = ai(state);
    e.tackleT = 0.01; e.tackleDir = [1, 0]; e.tackleHits = {}; e.invincible = true;
    let maxX = -Infinity;
    for (let i = 0; i < 180; i++) {           // the full 2s charge and beyond
      stepWorld(state, {}, DT, { ground: () => 0 });
      maxX = Math.max(maxX, e.transform.pos[0]);
    }
    expect(maxX).toBeLessThanOrEqual(992 - 3.4);   // pinned at the near face (radius 3.5)
    expect(e.transform.pos[0]).toBeLessThan(992);  // never released on the far side
  });

  it('a tackle angled into the wall SLIDES along the face (still blocked)', () => {
    const wall = { min: [992, 0, 0], max: [1008, 450, 150] };
    const state = world([975, 200, 0], [wall]);
    const e = ai(state);
    const n = Math.hypot(1, 0.4);
    e.tackleT = 0.01; e.tackleDir = [1 / n, 0.4 / n]; e.tackleHits = {}; e.invincible = true;
    for (let i = 0; i < 180; i++) stepWorld(state, {}, DT, { ground: () => 0 });
    expect(e.transform.pos[0]).toBeLessThan(992);      // held off the wall…
    expect(e.transform.pos[1]).toBeGreaterThan(210);   // …while the Y component kept sliding
  });

  it('an arena-speed dodge roll cannot phase through the 16-unit interior wall', () => {
    // arena suits run speed ~30 → dodgeSpeed 78 → ~27 units of roll travel: from contact with the
    // wall the unblocked roll crossed the midline and the post-roll eject released it on the FAR
    // side. Blocked mid-roll it stays pinned on the near face.
    const wall = { min: [992, 0, 0], max: [1008, 450, 150] };
    const state = world([988, 200, 0], [wall]);
    const e = ai(state);
    e.rule.speed = 30;
    e.dodgeT = 0.01; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = 1;
    e.dodgeDir = [1, 0]; e.dodgeSpent = false; e.invincible = true;
    for (let i = 0; i < 120; i++) stepWorld(state, {}, DT, { ground: () => 0 });
    expect(e.transform.pos[0]).toBeLessThan(992);
  });

  it('a dodge roll cannot tunnel through a depot pillar', () => {
    const pillar = { min: [343, 283, 0], max: [377, 317, 150] };
    const state = world([330, 300, 0], [pillar]);
    const e = ai(state);
    e.dodgeT = 0.01; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = 1;
    e.dodgeDir = [1, 0]; e.dodgeSpent = false; e.invincible = true;
    for (let i = 0; i < 120; i++) stepWorld(state, {}, DT, { ground: () => 0 });
    expect(e.transform.pos[0]).toBeLessThan(343);   // stopped at the pillar's near face
  });

  it('a roll clear of any box moves exactly as before (blocking is a no-op)', () => {
    const pillar = { min: [343, 283, 0], max: [377, 317, 150] };
    const clear = world([100, 100, 0], [pillar]);
    const bare = world([100, 100, 0], undefined);
    for (const state of [clear, bare]) {
      const e = ai(state);
      e.dodgeT = 0.01; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = 1;
      e.dodgeDir = [1, 0]; e.dodgeSpent = false; e.invincible = true;
      for (let i = 0; i < 40; i++) stepWorld(state, {}, DT, { ground: () => 0 });
    }
    expect(ai(clear).transform.pos[0]).toBeCloseTo(ai(bare).transform.pos[0], 10);
  });
});
