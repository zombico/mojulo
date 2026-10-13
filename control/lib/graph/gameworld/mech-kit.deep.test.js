import { describe, it, expect } from 'vitest';
import { buildAdorned } from './tech-adornment.js';
import { craftTech } from './tech-crafter.js';
import { rankOf, useOf, MOTIF_IDS } from './tech-direction.js';

// every dress the kit has, on every body plan that asks the kit for a wheel or a track: the kit's proof that a dress
// never breaks the thing it dresses. A dress is picked by the brief and its setting, so every brief meets every
// setting; motif and person camera are walked across those pairs, so every motif meets every camera once at least.
const SETTINGS = [['timber-and-rope', 'muscle'], ['iron-and-rivet', 'steam'], ['steel-and-rubber', 'combustion'], ['alloy-and-glass', 'field']];
const BRIEFS = [['vehicle', 'vehicles', 'a battle tank'], ['vehicle', 'vehicles', 'a tracked crawler'], ['weapon', 'weapons', 'a field cannon'],
  ['vehicle', 'vehicles', 'a passenger train'], ['vehicle', 'vehicles', 'a steam locomotive'], ['vehicle', 'vehicles', 'a farm cart'], ['vehicle', 'vehicles', 'a bicycle'], ['vehicle', 'vehicles', 'a motorcycle']];
const CAMERAS = ['third-person', 'first-person', 'side'];

describe('the mechanism kit, swept', () => {
  const dresses = new Set(), pairs = new Set();
  BRIEFS.forEach(([kind, list, intent], i) => {
    it(`${intent}: every setting's dress holds every law`, () => {
      const t = { ...craftTech(kind, intent).plan, intent }, rank = rankOf(list, t).rank, use = useOf(list, t).use, failed = [];
      SETTINGS.forEach(([made, driven], s) => {
        const k = i * SETTINGS.length + s, camera = CAMERAS[k % CAMERAS.length], motif = MOTIF_IDS[Math.floor(k / CAMERAS.length) % MOTIF_IDS.length];
        pairs.add(`${motif}/${camera}`);
        const a = buildAdorned(t, { kind, direction: { motif, camera, setting: { made, driven } }, rank, use });
        for (const m of a.mechanisms) dresses.add(`${m.mechanism}/${m.dress}`);
        if (!a.held) failed.push(`${intent} ${made} ${motif} ${camera}: ${a.laws.filter((l) => !l.ok).map((l) => `${l.law} ${l.value}`).join('; ')}`);
      });
      expect(failed, failed.join('\n')).toEqual([]);
    });
  });

  it('between them, the briefs wear every dress the kit has, every motif seen through every camera', () => {
    expect(pairs.size).toBe(MOTIF_IDS.length * CAMERAS.length);
    expect([...dresses].sort()).toEqual(['track/band', 'track/link', 'wheel/disc', 'wheel/flanged', 'wheel/maglev', 'wheel/pad', 'wheel/road', 'wheel/spoked', 'wheel/wire']);
  });
});
