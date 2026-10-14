// The historic city's scene: the solver's plan (./solver/) through the emitters. The plan's own concepts are tested
// beside the solver; here, what the emitters make of it.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planHistoricCity, assembleHistoricCityScene, assembleHistoricWorld, HISTORIC_CULTURES } from './historic-city.js';
import { PATTERNS } from './patterns.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x, (k, v) => (typeof v === 'function' ? undefined : v))).digest('hex');

describe('historic city: the scene', () => {
  it('a culture is built only from patterns in the shared vocabulary', () => {
    for (const k of Object.values(HISTORIC_CULTURES)) for (const id of k.patterns) expect(PATTERNS[id], id).toBeTruthy();
  });
  it('plans through the solver, deterministically', () => {
    expect(hash(planHistoricCity({ culture: 'sumer', seed: 7 }))).toBe(hash(planHistoricCity({ culture: 'sumer', seed: 7 })));
  });
  it('assembles a scene of lit masses in scene units, with an aerial, the approach and the plan\'s own views', () => {
    const s = assembleHistoricCityScene({ culture: 'sumer', seed: 7, shade: false });
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.stats.culture).toBe('sumer');
    const names = s.cameras.map((c) => c.name);
    for (const n of ['aerial', 'approach', 'monument']) expect(names).toContain(n);
  });
  it('opens on the view asked for', () => {
    const s = assembleHistoricCityScene({ culture: 'sumer', seed: 7, shade: false, view: 'monument' });
    expect(s.cameras[0].name).toBe('monument');
  });
  it('the World page carries its textures and the style card\'s sky; a monument built outside a kit stands as instances', () => {
    const id = Object.keys(HISTORIC_CULTURES).find((c) => planHistoricCity({ culture: c }).repeats);
    const w = assembleHistoricWorld({ culture: id });
    expect(Object.keys(w.textures).length).toBeGreaterThan(0);
    expect(w.repeats.length).toBeGreaterThan(0);
    expect(w.repeats.every((r) => r.template.length > 0 && r.transforms.length > 0)).toBe(true);
  });
});
