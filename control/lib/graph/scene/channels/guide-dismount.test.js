// Getting down from the horse on the guide (level/map-sketch.js TEACH `dismount`, an approach that is ridden onto:
// gameworld/world-map.js approachLevel): the lesson kept up while the pilot is a horse with its rider up, done once the
// rider is down and the pilot again; a guide with no such lesson emits none of it. Run against a stub page.
import { describe, expect, it } from 'vitest';
import { guideScript } from './guide.js';
import { TEACH } from '../../level/map-sketch.js';

function page(guide) {
  const el = () => ({ className: '', innerHTML: '', textContent: '', style: {}, appendChild() {} });
  let now = 0, frame = null;
  const hero = { id: 'hero', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'platform', speed: 4 } };
  const horse = { id: 'grey', mount: { reach: 2.6 }, riderId: 'hero', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'ride' } };
  const W = { pilotId: 'grey', byId: { hero, grey: horse }, entities: [hero, horse] };
  const win = { __mojCtrl: { world: W } };
  const doc = { createElement: el, head: { appendChild() {} }, body: el() };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', '__inputQueue', guideScript(guide))(win, doc, { now: () => now }, (f) => { frame = f; }, []);
  const step = (dt = 0.05, n = 1) => { for (let i = 0; i < n; i++) { now += dt * 1000; const f = frame; frame = null; f(); } };
  return { W, hero, horse, step, at: () => win.__mojGuide.lesson() };
}
const lesson = (v) => ({ keys: TEACH[v].keys, fact: TEACH[v].fact });

describe('the dismount lesson', () => {
  it('is kept up while she rides, and done once she is down', () => {
    const G = page({ steps: [], lessons: [lesson('dismount'), lesson('move')] });
    G.step(0.05, 80);
    expect(G.at()).toBe(0);
    G.horse.riderId = null; G.W.pilotId = 'hero';
    G.step(0.05, 40);
    expect(G.at()).toBe(1);
  });

  it('a guide with no dismount lesson carries none of it', () => {
    expect(guideScript({ steps: [], lessons: [lesson('move')] })).not.toContain("'dismount'");
    expect(guideScript({ steps: [], lessons: [lesson('dismount')] })).toContain("'dismount'");
  });
});
