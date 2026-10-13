import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { assembleCityScene } from './scene.js';
import { resolveGrammar } from './grammars.js';

const recipe = (rec = {}) => ({ kind: 'city', ...inferCity({ seed: 3, grammar: 'paris', board: { cols: 6, rows: 5 }, ...rec }).recipe });
const panes = (s, group = 'city:night-window') => s.faces.filter((f) => f.group === group);

describe('the city at night: its windows and signs lit', () => {
  const night = assembleCityScene(recipe({ look: 'gothic-night' }));
  it('by day, nothing: no pane, no sign tagged', () => {
    const day = assembleCityScene(recipe({ look: 'island-noon' }));
    expect(day.faces.some((f) => /city:night|city:neon/.test(f.group || '') || f.neon)).toBe(false);
    expect(assembleCityScene(recipe()).faces.some((f) => f.neon || /city:night/.test(f.group || ''))).toBe(false);
  });
  it('lights about the grammar\'s share of windows, in its palette, and the shop fronts along their ground storey', () => {
    const lit = panes(night), G = resolveGrammar('paris');
    expect(lit.length).toBeGreaterThan(200);
    // a lit room is a palette colour dimmed at most to 0.78, never shaded by the moon: its red channel within that of one
    const reds = G.night.palette.map((h) => parseInt(h.slice(1, 3), 16));
    for (const f of lit) expect(reds.some((r) => { const v = parseInt(f.fill.slice(1, 3), 16); return v <= r + 1 && v >= r * 0.78 - 1; })).toBe(true);
    expect(panes(night, 'city:night-shop').length).toBeGreaterThan(5);
  });
  it('lays each pane on its wall\'s window grid, between the recessed glass and the mullions', () => {
    const walls = night.faces.filter((f) => f.card);
    for (const p of panes(night).slice(0, 40)) {
      const n = p.normal, q = p.corners[0];
      const wall = walls.find((w) => {
        const c = w.corners, d = (n[0] * (c[0][0] - q[0]) + n[1] * (c[0][1] - q[1]) + n[2] * (c[0][2] - q[2]));
        return d > 0 && d < 0.3 && Math.min(c[0][2], c[2][2]) <= q[2] + 1e-6 && Math.max(c[0][2], c[2][2]) >= q[2] - 1e-6;
      });
      expect(wall).toBeTruthy();
    }
  });
  it('rolls each lot\'s windows on its own dice: a lot by hand leaves another\'s lit as they were', () => {
    const d = designCity(recipe({ look: 'gothic-night' })), lot = d.lots.find((l) => l.use !== 'parking' && l.floors > 3);
    const other = assembleCityScene(recipe({ look: 'gothic-night', lots: { [lot.id]: { storeys: lot.floors + 4 } } }));
    const mine = (s) => panes(s).filter((f) => f.lot !== lot.id).map((f) => JSON.stringify(f)).sort();
    expect(mine(night).length).toBeGreaterThan(100);
    expect(mine(other)).toEqual(mine(night));
  });
  it('burns a sprawl\'s blade signs in their own colours', () => {
    const s = assembleCityScene(recipe({ grammar: 'neon-sprawl', look: 'gothic-night' }));
    const neon = s.faces.filter((f) => f.group === 'city:neon');
    expect(neon.length).toBeGreaterThan(10);
    expect(neon.every((f) => f.neon && f.noInk)).toBe(true);
  });
  it('takes its share and palette from the grammar, held to the schema', () => {
    const none = assembleCityScene(recipe({ look: 'gothic-night', grammar: { from: 'paris', night: { windows: 0, shops: 0 } } }));
    expect(panes(none).length + panes(none, 'city:night-shop').length).toBe(0);
    expect(() => readCityPlan({ grammar: { from: 'paris', night: { windows: 2 } } })).toThrow(/night.windows is a number 0–1/);
    expect(() => readCityPlan({ grammar: { from: 'paris', night: { palette: ['amber'] } } })).toThrow(/night.palette is a list of '#rrggbb'/);
  });
});
