import { describe, it, expect } from 'vitest';
import { FIRE_KINDS, validateFire, resolveFire, fireKernel, firePageChannel } from './fire.js';
import { fireChannelScript } from '../scene/channels/fire.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { assembleDungeonScene } from '../architecture/dungeon-designer.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const DUNGEON = {
  chambers: [
    { id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 },
    { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 },
  ],
  tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }],
};
const one = (kind, extra = {}) => resolveFire({ sources: [{ kind, at: [0, 0, 1], ...extra }] });
const wind = (u) => () => [u, 0, 0];
const tipOff = (f) => { const n = f.pts.length; return [f.pts[n - 3] - f.pts[0], f.pts[n - 2] - f.pts[1], f.pts[n - 1] - f.pts[2]]; };

describe('fire: the recipe', () => {
  it('validates: true, sources, and teaching messages for what is wrong', () => {
    expect(validateFire(true)).toEqual([]);
    expect(validateFire(undefined)).toEqual([]);
    expect(validateFire({ sources: [{ kind: 'campfire', at: [1, 2] }, { kind: 'torch', at: [0, 0, 2], size: 1.5, phi: 0.5 }], embers: false })).toEqual([]);
    const e = validateFire({ sources: [{ kind: 'bonfire', at: [1] }, { kind: 'torch', at: [0, 0], size: 9, phi: 2 }], smoke: 'yes', heat: 1 });
    expect(e.join('\n')).toMatch(/kind must be one of candle, torch, brazier, campfire/);
    expect(e.join('\n')).toMatch(/at must be \[x, y\]/);
    expect(e.join('\n')).toMatch(/size must be a number from 0.25 to 4/);
    expect(e.join('\n')).toMatch(/phi must be from 0/);
    expect(e.join('\n')).toMatch(/fire.smoke must be true or false/);
    expect(e.join('\n')).toMatch(/fire.heat is not a fire option/);
    expect(validateFire(5)).toHaveLength(1);
  });

  it('resolves placed sources first, explicit ones after; a 2D at stands at z 0; a campfire sits on its logs', () => {
    const r = resolveFire({ sources: [{ kind: 'campfire', at: [3, 4] }] }, [{ kind: 'torch', at: [0, 0, 2], baked: true }]);
    expect(r.sources.map((s) => s.kind)).toEqual(['torch', 'campfire']);
    expect(r.sources[0].baked).toBe(true);
    expect(r.sources[1].at).toEqual([3, 4, FIRE_KINDS.campfire.seat]);
    expect(resolveFire({ sources: [{ kind: 'torch', at: [1, 1] }] }, [{ kind: 'torch', at: [1, 1, 9] }], { explicit: false }).sources).toHaveLength(1);
    expect(resolveFire(true, [])).toBeNull();
    expect(resolveFire(false)).toBeNull();
  });
});

describe('fire: the kernel', () => {
  it('is deterministic and seekable: a fire at a time does not depend on what was asked before', () => {
    const F = one('campfire'), a = fireKernel(F, wind(1.5)), b = fireKernel(F, wind(1.5));
    const x = JSON.stringify(a.flames(0, 3.7)), y = (b.flames(0, 9.1), b.embers(0, 1), JSON.stringify(b.flames(0, 3.7)));
    expect(x).toBe(y);
    expect(JSON.stringify(a.embers(0, 2.2))).toBe(JSON.stringify(b.embers(0, 2.2)));
    expect(JSON.stringify(a.smoke(0, 2.2))).toBe(JSON.stringify(b.smoke(0, 2.2)));
  });

  it('a candle in still air stands straight up; φ = 0 is still air in any wind', () => {
    const c = fireKernel(one('candle'), null).flames(0, 1.3)[0], d = tipOff(c);
    expect(Math.hypot(d[0], d[1])).toBe(0);
    expect(d[2]).toBeGreaterThan(0.03);
    const still = fireKernel(one('torch'), null), calm = fireKernel(one('torch', { phi: 0 }), wind(4));
    expect(JSON.stringify(calm.flames(0, 2.5))).toBe(JSON.stringify(still.flames(0, 2.5)));
    expect(JSON.stringify(calm.embers(0, 2.5))).toBe(JSON.stringify(still.embers(0, 2.5)));
  });

  it('leans downwind, further as the air quickens (mean over time)', () => {
    const lean = [0.5, 1.5, 3].map((u) => {
      const K = fireKernel(one('torch'), wind(u)); let dx = 0, dz = 0;
      for (let i = 0; i < 40; i++) for (const f of K.flames(0, i * 0.05)) { const d = tipOff(f); dx += d[0]; dz += d[2]; }
      return Math.atan2(dx, dz);
    });
    expect(lean[0]).toBeGreaterThan(0.05);
    expect(lean[1]).toBeGreaterThan(lean[0]);
    expect(lean[2]).toBeGreaterThan(lean[1]);
  });

  it('a turbulent fire puffs at about 1.5/√D; a candle does not', () => {
    for (const kind of ['torch', 'campfire']) {
      const K = fireKernel(one(kind), null), f0 = 1.5 / Math.sqrt(FIRE_KINDS[kind].D), dt = 1 / 200, n = 2000, x = [];
      for (let i = 0; i < n; i++) x.push(K.light(0, i * dt) - 1);
      const power = (f) => { let re = 0, im = 0; x.forEach((v, i) => { re += v * Math.cos(2 * Math.PI * f * i * dt); im += v * Math.sin(2 * Math.PI * f * i * dt); }); return re * re + im * im; };
      const scan = []; for (let f = 0.5; f < 3 * f0; f += 0.05) scan.push([f, power(f)]);
      const peak = scan.reduce((a, b) => (b[1] > a[1] ? b : a));
      expect(Math.abs(peak[0] - f0) / f0).toBeLessThan(0.1);
    }
    const c = fireKernel(one('candle'), null); let mx = 0; for (let i = 0; i < 400; i++) mx = Math.max(mx, Math.abs(c.light(0, i / 100) - 1));
    expect(mx).toBeLessThan(0.05);
  });

  it('embers rise from the bed and smoke from the flame tops; both drift with the air', () => {
    const K = fireKernel(one('campfire'), wind(2)), still = fireKernel(one('campfire'), null);
    let up = 0, n = 0, dx = 0, dx0 = 0;
    for (let i = 0; i < 50; i++) { const e = K.embers(0, i * 0.1), e0 = still.embers(0, i * 0.1); for (let o = 0; o < e.length; o += 7) { up += e[o + 2] - 1; dx += e[o]; n++; } for (let o = 0; o < e0.length; o += 7) dx0 += e0[o]; }
    expect(n).toBeGreaterThan(100);
    expect(up / n).toBeGreaterThan(0.2);
    expect(dx).toBeGreaterThan(dx0);
    const s = K.smoke(0, 6);
    expect(s.length / 5).toBeGreaterThan(20);
    for (let o = 0; o < s.length; o += 5) expect(s[o + 2]).toBeGreaterThan(1);
  });
});

describe('fire: in worlds', () => {
  it('the page script parses; an emitted world carries it only when asked (absent ⇒ zero bytes)', () => {
    const cfg = firePageChannel(one('torch'), { day: 0.5 });
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', `${fireChannelScript(cfg)};return stepFire;`)).not.toThrow();
    const base = { faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#806040' }], cameras: [], inline: true };
    const plain = emitThreeWorld(base);
    expect(emitThreeWorld({ ...base, fire: null })).toBe(plain);
    expect(plain).not.toMatch(/fire \(opt-in/);
    const lit = emitThreeWorld({ ...base, fire: cfg });
    expect(lit).toMatch(/--- fire \(opt-in `fire`\) ---/);
    expect(lit).toMatch(/stepFire\(t\);/);
  });

  it('a dungeon with fire: its chambers get braziers and its tunnels wall torches, already in the bake; without, unchanged', () => {
    const plain = assembleDungeonScene(DUNGEON);
    expect(plain.fireSources).toBeUndefined();
    expect(JSON.stringify(assembleDungeonScene({ ...DUNGEON, fire: undefined }))).toBe(JSON.stringify(plain));
    const lit = assembleDungeonScene({ ...DUNGEON, fire: true });
    expect(lit.fireSources.map((s) => s.kind)).toEqual(['brazier', 'brazier', 'torch', 'torch']);
    expect(lit.fireSources.every((s) => s.baked)).toBe(true);
    // the live flames replace the baked fixture blobs
    expect(lit.faces.filter((f) => f.glow).length).toBe(0);
    expect(plain.faces.filter((f) => f.glow).length).toBeGreaterThan(0);
  });

  it('the world route resolves fire for a dungeon and for a terrain (sources set on the ground, leaning in its wind)', async () => {
    const d = await resolveWorldScene({ ref: 'sk_fire_dungeon', title: 'fire', manifest: { kind: 'dungeon', ...DUNGEON, fire: true } });
    expect(d.payload.fire.sources).toHaveLength(4);
    expect(d.payload.fireSources).toBeUndefined();
    const world = { features: [{ feature: 'river' }], climate: 'temperate', seed: 'campfire' };
    const t = await resolveWorldScene({ ref: 'sk_fire_terrain', title: 'fire', manifest: { kind: 'terrain', world, grass: { kinds: ['meadow'] }, wind: { speed: 3 }, fire: { sources: [{ kind: 'campfire', at: [100, 200] }] } } }, { live: true });
    const s = t.payload.fire.sources[0];
    expect(t.payload.fire.terrainAir).toBe(true);
    expect(t.payload.fire.day).toBe(1);
    expect(Math.abs(s.at[2] - FIRE_KINDS.campfire.seat)).toBeGreaterThan(0.5);   // on the ground, not at sea level
    await expect(resolveWorldScene({ ref: 'sk_fire_bad', title: 'x', manifest: { kind: 'dungeon', ...DUNGEON, fire: { sources: [{ kind: 'pyre', at: [0, 0] }] } } })).rejects.toThrow(/kind must be one of/);
  });
});
