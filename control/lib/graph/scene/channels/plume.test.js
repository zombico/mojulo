// @vitest-environment jsdom
// A PLUME (plume.js): a prop's drive lit as the level's bus says ignite:<who>: its layers out of the bell along its
// axis, lit over its first moment; its burst thrown out across the ground and gone; nothing before it is lit. (A frame
// operation's prop carrying its bell to the page: gameworld/frame-plume.test.js.)
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { plumeScript, PLUME } from './plume.js';

async function page(plumes) {
  const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
  const scene = new THREE.Scene(), log = [];
  let now = 0, frames = [];
  const C = { id: 'c', transform: { pos: [10, 20, 3], heading: 0 } };
  window.__mojCtrl = { world: { byId: { c: C } } }; window.__mojBus = { state: { log } };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', 'THREE', 'scene', plumeScript(plumes))(window, document, { now: () => now }, (f) => { frames.push(f); }, THREE, scene);
  const at = (s) => { now = s * 1000; const fs = frames; frames = []; fs.forEach((f) => f()); };
  return { scene, log, at };
}
const P = { who: 'c', at: [0, 0, 38.9], r: 4.25, dir: [0, 0, 1], colour: '#8673bd' };

describe('a plume', () => {
  it('lights as the bus says ignite, out of its bell along its axis, its burst thrown out and gone', async () => {
    const G = await page([P]);
    G.at(0); G.at(0.1);
    expect(G.scene.children).toHaveLength(0);
    expect(window.__mojPlume.lit).toEqual([]);
    G.log.push({ type: 'ignite:c' });
    G.at(0.2); G.at(0.25);
    expect(window.__mojPlume.lit).toEqual(['c']);
    const [grp, burst, light] = G.scene.children;
    expect(grp.position.toArray()).toEqual([10, 20, 3 + 38.9]);
    expect(grp.children.length).toBe(PLUME.layers.length + 1);
    G.at(1.5);
    expect(grp.children[2].scale.y).toBeGreaterThan(0.85);                                  // (lit to its length)
    expect(light.intensity).toBeGreaterThan(0);
    G.at(0.2 + PLUME.burst.life + 0.5); G.at(0.2 + PLUME.burst.life + 0.6);
    expect(burst.visible).toBe(false);
  });

});
