// THE GUIDE'S LESSONS: how a game starts (gameworld/world-map.js): an arrival that teaches several is the controls
// explained with the hero in hand, one at a time, each until the pilot does it. The reader (guide.js) and the page
// (scene/channels/guide.js), the page's script run on a stub of what it reads.
import { describe, it, expect } from 'vitest';
import { guideOf } from './guide.js';
import { readGrid } from './grid.js';
import { zoneOf } from './zones.js';
import { TEACH } from './map-sketch.js';
import { worldMapLevel } from '../gameworld/world-map.js';
import { guideScript } from '../scene/channels/guide.js';

const { level } = worldMapLevel({ n: 3 }), g = level.glyphs;
const G = readGrid({ tile: g.tile, plan: g.plan, segments: g.segments }), [A, B, C] = g.plan.route;
const guideAt = (segs) => guideOf({ sketch: g.sketch }, G, zoneOf(G, segs, { seed: 5 }), { seed: 5 });

// the page's script on a stub: a pilot the test moves, a clock the test turns, frames stepped by hand
function page(guide) {
  const hero = { id: 'hero', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 }, rule: { speed: 4, boostSpeed: 8 }, grounded: true, vel: [0, 0, 0] };
  const el = () => ({ className: '', innerHTML: '', textContent: '', appendChild() {} }), frames = [];
  const window = { __mojCtrl: { world: { pilotId: 'hero', byId: { hero }, entities: [hero] } } }, clock = { t: 0 };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', 'setTimeout', guideScript(guide))(window, { body: el(), head: el(), createElement: el }, { now: () => clock.t }, (f) => frames.push(f), () => {});
  // (seconds of frames, the pilot changed a little each frame by `each`)
  const run = (seconds, each = () => {}) => { for (let i = 0; i < Math.round(seconds * 30); i++) { clock.t += 1000 / 30; each(hero, 1 / 30); frames.shift()(); } };
  return { hero, run, guide: window.__mojGuide };
}

describe('the guide\'s lessons', () => {
  it('the opening page explains the body\'s controls, each with the fact the page watches for; no other page does', () => {
    const D = guideAt(A);
    expect(D.lessons).toEqual(['move', 'look', 'jump', 'sprint'].map((v) => ({ keys: TEACH[v].keys, fact: TEACH[v].fact })));
    expect(D.introKeys).toBeUndefined();
    // (then the enemy trail, each fight's own keys where it stands, and the way out held)
    expect(D.steps.map((s) => [s.id, s.fight ?? false, s.keys ?? null])).toEqual([['lone', true, [TEACH.strike.keys]], ['pair', true, [TEACH.lock.keys, TEACH.dodge.keys]]]);
    expect(D.held.length).toBeGreaterThan(0);
    const next = guideAt([B, C]);
    expect(next.lessons).toBeUndefined();
    expect(next.introKeys).toBeUndefined();
  });

  it('each lesson stays until the pilot does it: moving, turning, leaving the ground, running at its sprint', () => {
    const P = page(guideAt(A));
    expect(P.guide.lessons).toBe(4);
    // standing still, the first lesson stays up
    P.run(3);
    expect([P.guide.lesson(), P.guide.showing()]).toEqual([0, 'keys']);
    // walked a few metres: the next
    P.run(1.5, (h, dt) => { h.transform.pos[0] += 4 * dt; });
    expect(P.guide.lesson()).toBe(1);
    // the walk does not pass the look; turning does
    P.run(2, (h, dt) => { h.transform.pos[0] += 4 * dt; });
    expect(P.guide.lesson()).toBe(1);
    P.run(2, (h, dt) => { h.transform.heading += 0.8 * dt; });
    expect(P.guide.lesson()).toBe(2);
    // off the ground
    P.run(2);
    expect(P.guide.lesson()).toBe(2);
    P.run(1.5, (h) => { h.grounded = false; h.vel[2] = 3; });
    P.hero.grounded = true; P.hero.vel[2] = 0;
    expect(P.guide.lesson()).toBe(3);
    // a walk is not a sprint; the sprint's speed is
    P.run(2, (h, dt) => { h.transform.pos[0] += 4 * dt; });
    expect(P.guide.lesson()).toBe(3);
    P.run(2, (h, dt) => { h.transform.pos[0] += 8 * dt; });
    // done: the way on is shown
    expect(P.guide.lesson()).toBe(4);
    P.run(0.2);
    expect(P.guide.showing()).not.toBe('keys');
  });

  it('a lesson nobody does lets go when its patience runs out, so the way on is never withheld', () => {
    const P = page(guideAt(A));
    P.run(10);
    expect(P.guide.lesson()).toBe(0);
    P.run(60);
    expect(P.guide.lesson()).toBe(4);
  });

  it('a guide with no lessons runs as it did: nothing to wait on', () => {
    const P = page(guideAt([B, C]));
    expect(P.guide.lessons).toBe(0);
    expect(P.guide.lesson()).toBe(0);
    P.run(1);
    expect(P.guide.showing()).not.toBe('keys');
  });
});
