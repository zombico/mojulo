import { describe, it, expect } from 'vitest';
import { buildAdorned } from './tech-adornment.js';
import { craftTech } from './tech-crafter.js';
import { rankOf, useOf, MOTIF_IDS } from './tech-direction.js';

// every dress the kit has, on every body plan that asks the kit for a wheel or a track, through every motif and every
// person camera: the kit's proof that a dress never breaks the thing it dresses
const SETTINGS = [['timber-and-rope', 'muscle'], ['iron-and-rivet', 'steam'], ['steel-and-rubber', 'combustion'], ['alloy-and-glass', 'field']];
const BRIEFS = [['vehicle', 'vehicles', 'a battle tank'], ['vehicle', 'vehicles', 'a tracked crawler'], ['weapon', 'weapons', 'a field cannon'],
  ['vehicle', 'vehicles', 'a passenger train'], ['vehicle', 'vehicles', 'a steam locomotive'], ['vehicle', 'vehicles', 'a farm cart'], ['vehicle', 'vehicles', 'a bicycle'], ['vehicle', 'vehicles', 'a motorcycle']];

describe('the mechanism kit, swept', () => {
  it('every dress × body plan × motif × camera holds every law', () => {
    const failed = [], dresses = new Set();
    for (const [kind, list, intent] of BRIEFS) {
      const t = { ...craftTech(kind, intent).plan, intent }, rank = rankOf(list, t).rank, use = useOf(list, t).use;
      for (const [made, driven] of SETTINGS) for (const motif of MOTIF_IDS) for (const camera of ['third-person', 'first-person', 'side']) {
        const a = buildAdorned(t, { kind, direction: { motif, camera, setting: { made, driven } }, rank, use });
        for (const m of a.mechanisms) dresses.add(`${m.mechanism}/${m.dress}`);
        if (!a.held) failed.push(`${intent} ${made} ${motif} ${camera}: ${a.laws.filter((l) => !l.ok).map((l) => `${l.law} ${l.value}`).join('; ')}`);
      }
    }
    expect(failed, failed.join('\n')).toEqual([]);
    expect([...dresses].sort()).toEqual(['track/band', 'track/link', 'wheel/disc', 'wheel/flanged', 'wheel/maglev', 'wheel/pad', 'wheel/road', 'wheel/spoked', 'wheel/wire']);
  }, 600000);
});
