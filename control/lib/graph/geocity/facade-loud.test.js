// AN EVOKED FACADE DRAWN LOUD: a wall's window card made geometry, each window off square, framed, its night kept.
import { describe, it, expect } from 'vitest';
import { loudFacade, loudWindowsOk } from './facade-loud.js';
import { buildFacadeCard } from '../architecture/facade-card.js';
import { offSquare, OFF_SQUARE } from '../era/exaggerate.js';

// one wall, 12 m along x and 9 m up, facing -y; three storeys of four bays
const wall = [[0, 0, 0], [12, 0, 0], [12, 0, 9], [0, 0, 9]];
const card = buildFacadeCard({ material: 'brick', glass: '#a0522d', frame: '#333333', rhythm: 'punched' }, 3, 4);

describe('a loud facade: its card\'s windows as geometry', () => {
  const L = loudFacade(wall, card, { hue: '#7fd0f5', ink: '#ff3d8b', k: 0.16, seed: 7 });
  it('draws a window for each of its grid\'s cells, each off square at three corners or more', () => {
    expect(L.windows.length).toBe(12);
    expect(loudWindowsOk(L.windows)).toBe(true);
    for (const w of L.windows) expect(offSquare(w)).toBeGreaterThanOrEqual(OFF_SQUARE);
  });
  it('lays its wall, then each window\'s glass and its frame\'s four sides proud of it, on the wall\'s own plane', () => {
    expect(L.faces.length).toBe(1 + 12 * 5);
    expect(L.faces[0].part).toBe('wall');
    const out = (q) => -Math.max(...q.corners.map((c) => c[1]));
    for (const q of L.faces.filter((f) => f.part === 'glass')) expect(out(q)).toBeGreaterThan(0);
    for (const q of L.faces.filter((f) => f.part === 'frame')) { expect(q.fill).not.toBe(L.faces[0].fill); expect(out(q)).toBeGreaterThan(0.05); }
    // (no window leaves its wall)
    for (const q of L.faces) for (const [x, , z] of q.corners) { expect(x).toBeGreaterThanOrEqual(-1e-6); expect(x).toBeLessThanOrEqual(12 + 1e-6); expect(z).toBeGreaterThanOrEqual(-1e-6); expect(z).toBeLessThanOrEqual(9 + 1e-6); }
  });
  it('is its seed\'s alone: the same wall the same windows, another seed others', () => {
    expect(loudFacade(wall, card, { hue: '#7fd0f5', ink: '#ff3d8b', k: 0.16, seed: 7 })).toEqual(L);
    expect(loudFacade(wall, card, { hue: '#7fd0f5', ink: '#ff3d8b', k: 0.16, seed: 8 }).windows).not.toEqual(L.windows);
  });
  it('burns a lit room in the window its pane covers, unshaded, the rest glass', () => {
    const N = loudFacade(wall, card, { k: 0.16, seed: 7, lights: [[0, 0.5, 0, 0.4, '#ffd27a', 'city:night-window']] });
    const lit = N.faces.filter((f) => f.group === 'city:night-window');
    expect(lit.length).toBe(2);
    for (const f of lit) { expect(f.fill).toBe('#ffd27a'); expect(f.noInk).toBe(true); }
  });
  it('leaves a card with no window grid (a metal rainscreen) a card', () => {
    expect(loudFacade(wall, buildFacadeCard({ material: 'metal', rhythm: 'banded' }, 3, 4), { seed: 1 })).toBe(null);
  });
});
