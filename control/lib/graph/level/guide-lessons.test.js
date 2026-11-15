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
  // (the page's three.js and its scene, as much as the guide's pillar asks of them: what stands in the scene is counted)
  const stood = [], Mesh = function () { this.rotation = {}; this.position = { set: (...p) => { this.at = p; } }; };
  const THREE = { Mesh, Vector3: function () {}, CylinderGeometry: function () {}, MeshBasicMaterial: function () {}, DoubleSide: 2 }, scene = { add: (o) => stood.push(o), remove: (o) => stood.splice(stood.indexOf(o), 1) };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', 'setTimeout', 'THREE', 'scene', guideScript(guide))(window, { body: el(), head: el(), createElement: el }, { now: () => clock.t }, (f) => frames.push(f), () => {}, THREE, scene);
  // (seconds of frames, the pilot changed a little each frame by `each`)
  const run = (seconds, each = () => {}) => { for (let i = 0; i < Math.round(seconds * 30); i++) { clock.t += 1000 / 30; each(hero, 1 / 30); frames.shift()(); } };
  return { hero, run, guide: window.__mojGuide, world: window.__mojCtrl.world, stood };
}

describe('the guide\'s lessons', () => {
  it('the opening page explains the body\'s controls, each with the fact the page watches for; no other page does', () => {
    const D = guideAt(A);
    expect(D.lessons).toEqual(['move', 'look', 'jump', 'sprint'].map((v) => ({ keys: TEACH[v].keys, fact: TEACH[v].fact })));
    expect(D.introKeys).toBeUndefined();
    // (then the enemy trail, each fight's own keys where it stands, and the way out held)
    expect(D.steps.map((s) => [s.id, s.fight ?? false, s.keys ?? null])).toEqual([['lone', true, [TEACH.strike.keys]], ['pair', true, [TEACH.lock.keys, TEACH.dodge.keys]]]);
    // (each fight won by its falls: the lone one's, then the pair's with it)
    expect(D.steps.map((s) => s.downs)).toEqual([1, 3]);
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
  it('a fight is followed where it is fought: its keys when its foes come to the hero, won by its falls, a later fight not until it comes', () => {
    const D = guideAt(A), P = page(D), W = P.world, mark = D.steps[0].at;
    const foe = (id, at, more = {}) => ({ id, team: 'foes', hp: 8, transform: { pos: [...at], heading: 0 }, ...more });
    const lone = foe('foe-grunt-1', mark), pair = [foe('foe-grunt-2', mark, { dormant: true }), foe('foe-grunt-3', mark, { dormant: true })];
    W.entities.push(lone, ...pair);
    // the lessons stand while the trail is far off, and give way when a foe comes within a few strides
    P.run(1);
    expect(P.guide.showing()).toBe('keys');
    expect(P.guide.lesson()).toBe(0);
    lone.transform.pos = [6, 0, 0];
    P.run(0.2);
    expect(P.guide.lesson()).toBe(P.guide.lessons);
    // the fight has come to the hero, far from its mark: its keys are up
    expect(Math.hypot(mark[0], mark[1])).toBeGreaterThan(30);
    expect([P.guide.step(), P.guide.showing()]).toEqual([0, 'keys']);
    // it falls: the fight is won where it was fought; the pair asleep at the mark are not a fight yet
    lone.downed = true;
    P.run(0.2);
    expect(P.guide.step()).toBe(1);
    expect(P.guide.showing()).not.toBe('keys');
    // they come, and fall: the trail is done
    for (const f of pair) { f.dormant = false; f.transform.pos = [5, 1, 0]; }
    P.run(0.2);
    expect([P.guide.step(), P.guide.showing()]).toEqual([1, 'keys']);
    pair[0].downed = true;
    P.run(0.2);
    expect(P.guide.step()).toBe(1);
    pair[1].hp = 0;
    P.run(0.2);
    expect(P.guide.step()).toBe(2);
  });
  it('a pillar of light stands at a place to go to, never on a fight: its foes are what is looked at', () => {
    // (the opening's steps are its two fights: nothing stands in the scene; a page whose next step is a place has one)
    const fights = page(guideAt(A));
    fights.run(1);
    expect(fights.stood).toHaveLength(0);
    const D = guideAt([B, C]), k = D.steps.findIndex((s) => !s.fight);
    expect(k).toBeGreaterThanOrEqual(0);
    const place = page({ ...D, steps: D.steps.slice(k) });
    place.run(1);
    expect(place.stood).toHaveLength(1);
    expect(place.stood[0].at.slice(0, 2)).toEqual(D.steps[k].at.slice(0, 2));
  });
});
