import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { readCastEffect, lowerCastEffect } from '../../playscape/ui/cast.js';

// A BODY CARRIED (glide.js): a cue's glide moves a body along straight lines through the air, its height with it, each
// leg eased, and holds it at the last point, saying arrive at each as a walk does. The concept on one pod lowered from
// overhead onto the ground; a skipped scene lands it; and a page that never glides carries none of it.
const E = composeLive();
const hooks = { ground: () => 0 };
const world = () => E.createWorld({ entities: [{ id: 'pod', rule: { type: 'walk', speed: 0, eye: 0 }, transform: { pos: [0, 0, 60], heading: 0 } }] });
const run = (w, s, at = () => {}) => { for (let i = 0; i < Math.round(s * 60); i++) { E.stepWorld(w, {}, 1 / 60, hooks); at(w.byId.pod, i); } };

describe('a body carried', () => {
  it('is lowered along its line over the seconds it was given, eased, and holds where it was set down', () => {
    const w = world(), e = w.byId.pod, zs = [];
    E.castOps(w, [{ op: 'glide', who: 'pod', points: [[0, 0, 20], [10, 0, 2]], names: ['hover', 'pad'], seconds: 6, face: 90 }]);
    run(w, 7, (p) => zs.push(p.transform.pos[2]));
    expect(e.transform.pos).toEqual([10, 0, 2]);                       // (no ground snap: it stands where it was set)
    expect(e.arrivals).toBe(2);
    expect(e.arrivedAt).toBe('pad');
    expect(e.glide).toBe(null);
    expect(e.transform.heading).toBeCloseTo(Math.PI / 2, 6);
    // (eased: slow off the top, fast in the middle of the leg, slow onto the hover)
    const v = (i) => zs[i] - zs[i + 1];
    expect(v(1)).toBeLessThan(v(100) / 4);
    // (the whole way in its seconds: the first leg is 40 m of the 60.6 the pod goes, so the hover at 3.96 s)
    const hoverAt = zs.findIndex((z) => z <= 20 + 1e-9);
    expect(hoverAt / 60).toBeGreaterThan(3.85);
    expect(hoverAt / 60).toBeLessThan(4.05);
  });

  it('a point with no height keeps the height it has; a skipped scene lands it at once', () => {
    const w = world(), e = w.byId.pod;
    E.castOps(w, [{ op: 'glide', who: 'pod', points: [[30, 0, null]], speed: 5 }]);
    run(w, 1);
    expect(e.transform.pos[2]).toBe(60);
    expect(e.transform.pos[0]).toBeGreaterThan(0);
    E.castOps(w, [{ op: 'finish' }]);
    expect(e.transform.pos).toEqual([30, 0, 60]);
    expect(e.arrivals).toBe(1);
  });

  it('is read from a cue as a place\'s height, and opt-in on the page', () => {
    const t = readCastEffect('glide', { glide: { who: 'pod', to: ['pad', [4, 5]], seconds: 3 } }, 'cue');
    const frag = { reactions: [] };
    lowerCastEffect(t, 'go', frag, [{ id: 'pad', at: [1, 2, 7] }]);
    expect(frag.reactions[0]).toMatchObject({ do: 'ctrl', op: 'glide', who: 'pod', points: [[1, 2, 7], [4, 5, null]], names: ['pad', '1'], seconds: 3 });
    expect(() => readCastEffect('glide', { glide: { who: 'pod', to: [0, 0], seconds: 2, speed: 3 } }, 'cue')).toThrow(/not both/);
    expect(emissionSource()).not.toContain("registerBodyOwner('glide'");
    expect(emissionSource({ glide: true })).toContain("registerBodyOwner('glide'");
  });
});
