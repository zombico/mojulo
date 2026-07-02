import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';

// a unit quad on a plane, optionally grouped/normalled like a shell wall
const wall = (group, normal) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888888', group, normal });

describe('emitThreeWorld render groups', () => {
  it('collapses ungrouped faces into a single static group (city/figure path unchanged)', () => {
    const html = emitThreeWorld({ faces: [wall(undefined, undefined), wall(undefined, undefined)] });
    expect(html).toContain('"name":"static"');
    expect(html).not.toContain('"hideable":true'); // nothing toggleable
  });

  it('splits a shell wall into its own hideable group', () => {
    const html = emitThreeWorld({ faces: [wall('shell:leftWall', [1, 0, 0]), wall(undefined, undefined)] });
    expect(html).toContain('"name":"shell:leftWall"');
    expect(html).toContain('"hideable":true');
    expect(html).toContain('updateCutaway'); // runtime auto-hide wired in
  });

  it('never marks the floor hideable (you always stand on it)', () => {
    const html = emitThreeWorld({ faces: [wall('shell:floor', [0, 0, 1])] });
    expect(html).toContain('"name":"shell:floor"');
    expect(html).not.toContain('"hideable":true');
  });

  it('treats a grouped wall WITHOUT a normal as non-hideable (can\'t compute camera side)', () => {
    const html = emitThreeWorld({ faces: [wall('shell:leftWall', undefined)] });
    expect(html).toContain('"name":"shell:leftWall"');
    expect(html).not.toContain('"hideable":true');
  });
});

describe('emitThreeWorld mover lifetimes + flash (cascade enabler)', () => {
  // a small sphere-ish group the mover can drive, keyed by group name.
  const blob = (group) => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#cccccc', group });

  // a throwaway 3-element timeline on the shared clock: a neutron (born → absorbed → vanishes), a
  // fragment (born → recoils → stays), and a fission flash (a brief scale-pop) in between.
  const TIMELINE = {
    faces: [blob('neutron'), blob('fragment'), blob('flash')],
    movers: [
      { group: 'neutron', path: [[0, 0, 0], [10, 0, 0]], basePos: [0, 0, 0], t0: 1.0, t1: 2.5, vanish: true },
      { group: 'fragment', path: [[0, 0, 0], [-3, 0, 0]], basePos: [0, 0, 0], t0: 2.5, t1: 3.2 },
      { group: 'flash', at: [0, 0, 0], basePos: [0, 0, 0], t0: 2.4, t1: 2.7, flash: { size: 4 } },
    ],
  };

  it('emits the shared-clock lifetime machinery (_LIFE_T + moverLifeU)', () => {
    const html = emitThreeWorld(TIMELINE);
    expect(html).toContain('const _LIFE_T');
    expect(html).toContain('function moverLifeU');
    expect(html).toContain('mv.vanish ? s <= mv.t1 : true');   // vanish vs freeze-at-end gating
  });

  it('keeps a flash mover (no multi-point path) in the channel instead of filtering it out', () => {
    const html = emitThreeWorld(TIMELINE);
    expect(html).toContain('"flash":{"size":4}');
    expect(html).toContain('if (mv.flash)');                    // the scale-pop branch is present
  });

  it('the shared loop length is the latest t1 plus a tail hold (cascade replays in step)', () => {
    const html = emitThreeWorld(TIMELINE);
    // _LIFE_T is computed in-page from MOVERS; the three lifetimes (max t1 = 3.2) all serialize through.
    expect(html).toContain('"t1":3.2');
    expect(html).toContain('"t0":1');
  });

  it('legacy period movers are untouched — no lifetime fields, classic loop walk', () => {
    const html = emitThreeWorld({
      faces: [blob('body')],
      movers: [{ group: 'body', path: [[0, 0, 0], [5, 0, 5]], basePos: [0, 0, 0], period: 3, loop: true }],
    });
    expect(html).toContain('function moverU');     // legacy phase fn still there
    expect(html).not.toContain('"t1":');           // this mover carries no lifetime
  });
});

describe('emitThreeWorld wireframe mode', () => {
  it('always ships the wireframe HUD toggle + lazy edge builder (every World)', () => {
    const html = emitThreeWorld({ faces: [wall(undefined, undefined)] });
    expect(html).toContain("wireBtn.textContent = 'wireframe'");
    expect(html).toContain('EdgesGeometry');
    expect(html).toContain('const WIREFRAME0 = false;'); // off by default
  });

  it('opens in wireframe when wireframe:true (deep-link / baked still)', () => {
    const html = emitThreeWorld({ faces: [wall(undefined, undefined)], wireframe: true });
    expect(html).toContain('const WIREFRAME0 = true;');
    expect(html).toContain('if (WIREFRAME0) setWireframe(true);');
  });
});
