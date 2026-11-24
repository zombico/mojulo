// The vista (side-map/vista.js): what stands behind a zone whose back is open. The concepts: a place names its vista and
// a zone's own word overrides it; `wall` is the plain back wall and adds nothing; a vista opens its zone's back into a
// frame and stands its things beyond it; a room (a far wall) keeps to its zone and is closed at its ends, a sky vista
// widens to fill the frame from anywhere along the zone; further back is further into the air; the same seed, the same vista.
import { describe, it, expect } from 'vitest';
import { vistaOf, VISTAS, VISTA_IDS } from './vista.js';
import { dressSideMap } from './dress.js';
import { layoutSideMap } from './layout.js';
import { assembleSideMap } from './scene.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const chain = (vista) => ({ premise: 'into the reactor plant', zones: [{ run: 'across', screens: 2, beat: 'rest', ...(vista ? { vista } : {}) }, { run: 'across', screens: 2, teach: 'basic' }, { room: [1, 1], teach: 'boss' }] });
const laid = (map, seed = 3) => { const L = layoutSideMap(map, { reach, stature: 1.67 }); return { L, D: dressSideMap(L, map, { seed }) }; };
const M = (vista) => ({ kind: 'geocube', show: 'sidemap', cube: 'city-night', seed: 2, light: 'flat', sidemap: chain(vista) });
const groups = (p) => p.faces.filter((f) => f.group?.startsWith('sidemap:vista'));
const lum = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255; };

describe('the side map\'s vistas', () => {
  it('a place names its vista, and a zone\'s own word overrides it', () => {
    const { D } = laid(chain());
    expect(D.zones.some((z) => z.vista)).toBe(true);
    const own = laid(chain('peaks')).D;
    expect(own.zones[0].vista).toBe('peaks');
    expect(() => laid(chain('jungle'))).toThrow(/vista/);
  });

  it('`wall` is the plain back wall: no vista, nothing added', () => {
    const { D } = laid(chain('wall'));
    expect(D.zones[0].vista).toBeUndefined();
    const map = chain('wall'); map.zones.forEach((z) => { z.vista = 'wall'; });
    expect(groups(assembleSideMap({ ...M(), sidemap: map }))).toHaveLength(0);
  });

  it('a vista opens its zone\'s back into a frame and stands beyond it', () => {
    const closed = assembleSideMap({ ...M(), sidemap: { ...chain(), zones: chain().zones.map((z) => ({ ...z, vista: 'wall' })) } });
    const open = assembleSideMap(M('yard'));
    expect(groups(open).length).toBeGreaterThan(0);
    const backArea = (p) => p.faces.filter((f) => f.group === 'sidemap:back').reduce((a, f) => { const s = f.corners.map((c) => c[1]), z = f.corners.map((c) => c[2]); return a + (Math.max(...s) - Math.min(...s)) * (Math.max(...z) - Math.min(...z)); }, 0);
    expect(backArea(open)).toBeLessThan(backArea(closed));
    expect(groups(open).every((f) => f.corners.every((c) => c[0] <= -3))).toBe(true);
  });

  it('a room keeps to its zone; a sky vista widens to fill the frame', () => {
    for (const id of VISTA_IDS.filter((v) => VISTAS[v])) {
      const { L, D } = laid(chain(id)), [V] = vistaOf(L, D, { seed: 3 }), Z = L.zones[0];
      expect(V.boxes.length).toBeGreaterThan(0);
      const s0 = Math.min(...V.boxes.map((b) => b.s0)), s1 = Math.max(...V.boxes.map((b) => b.s1));
      if (VISTAS[id].far) {
        expect(V.far.s0).toBe(Z.rect[0]); expect(V.far.s1).toBe(Z.rect[1]);
        expect(s0).toBeGreaterThanOrEqual(Z.rect[0]); expect(s1).toBeLessThanOrEqual(Z.rect[1]);
      } else {
        expect(s0).toBeLessThan(Z.rect[0]); expect(s1).toBeGreaterThan(Z.rect[1]);
      }
    }
  });

  it('further back is further into the air', () => {
    const { L, D } = laid(chain('skyline')), [V] = vistaOf(L, D, { seed: 3, horizon: '#ffffff' });
    const at = (x) => V.boxes.filter((b) => b.x1 === x && !b.lit).map((b) => lum(b.fill));
    const xs = [...new Set(V.boxes.filter((b) => !b.lit).map((b) => b.x1))].sort((a, b) => a - b), far = at(xs[0]), near = at(xs[xs.length - 1]);
    expect(Math.min(...far)).toBeGreaterThan(Math.max(...near));
  });

  // (docs/side-scroll-backgrounds.md) a vista is a place still running, on dice of its own so its layers stand where they stood
  it('stands a sky vista against a dusk in bands, blinks its beacons, steams its stacks and lights a hall\'s clerestory', () => {
    const sky = laid(chain('skyline')), [V] = vistaOf(sky.L, sky.D, { seed: 3 });
    const glow = V.boxes.filter((b) => b.group === 'sidemap:vista-glow');
    expect(glow.length).toBeGreaterThan(2);
    // (behind every layer, and lighter than the far layer it stands behind: the silhouettes read dark against it)
    expect(Math.max(...glow.map((b) => b.x1))).toBeLessThan(Math.min(...V.boxes.filter((b) => !b.group).map((b) => b.x0)));
    expect(V.boxes.some((b) => b.group === 'sidemap:vista-beacon')).toBe(true);
    const yard = laid(chain('yard')), [Y] = vistaOf(yard.L, yard.D, { seed: 3 });
    expect(Y.boxes.some((b) => b.group === 'sidemap:vista-steam')).toBe(true);
    const hall = laid(chain('hall')), [Hl] = vistaOf(hall.L, hall.D, { seed: 3 });
    expect(Hl.boxes.filter((b) => b.lit && b.x0 === Hl.far.x1).length).toBeGreaterThan(1);
    expect(Hl.boxes.some((b) => b.group === 'sidemap:vista-glow')).toBe(false);
    // (the page moves them)
    const page = assembleSideMap(M('skyline'));
    expect(Object.keys(page.ambient.groups)).toContain('sidemap:vista-beacon');
  });

  it('lays the future\'s domed arcologies and its traffic, and turns the reactor\'s wheel and ring about its hub, opposite ways', () => {
    const fut = laid(chain('future')), [F] = vistaOf(fut.L, fut.D, { seed: 3 });
    // (domes drawn as shapes, lit glass inside them; a skyway's train and craft that the page moves)
    expect(F.boxes.filter((b) => b.poly && b.group === 'sidemap:vista-dome').length).toBeGreaterThan(2);
    for (const g of ['sidemap:vista-train', 'sidemap:vista-traffic']) expect(F.boxes.some((b) => b.group === g), g).toBe(true);
    const re = laid(chain('reactor')), [R] = vistaOf(re.L, re.D, { seed: 3 }), Z = re.L.zones[0];
    const spins = Object.values(R.motion).map((m) => m.spin);
    expect(spins).toHaveLength(2);
    expect(Math.sign(spins[0].rate)).toBe(-Math.sign(spins[1].rate));
    // (its hub the zone's middle, the wheel inside the zone)
    for (const sp of spins) expect(sp.at[0]).toBeCloseTo((Z.rect[0] + Z.rect[1]) / 2, 3);
    const wheel = R.boxes.filter((b) => b.group === Object.keys(R.motion)[0]);
    expect(Math.min(...wheel.map((b) => b.s0))).toBeGreaterThanOrEqual(Z.rect[0] - 1e-3);
    expect(Math.max(...wheel.map((b) => b.s1))).toBeLessThanOrEqual(Z.rect[1] + 1e-3);
    // (the page spins them)
    const page = assembleSideMap(M('reactor'));
    expect(Object.values(page.ambient.groups).filter((g) => g.spin).length % 2).toBe(0);
    expect(Object.values(page.ambient.groups).filter((g) => g.spin).length).toBeGreaterThanOrEqual(2);
  });

  it('the same seed, the same vista', () => {
    const a = laid(chain('hall')), b = laid(chain('hall'));
    expect(JSON.stringify(vistaOf(a.L, a.D, { seed: 5 }))).toBe(JSON.stringify(vistaOf(b.L, b.D, { seed: 5 })));
    expect(JSON.stringify(vistaOf(a.L, a.D, { seed: 5 }))).not.toBe(JSON.stringify(vistaOf(a.L, a.D, { seed: 6 })));
  });
});
