import { describe, it, expect } from 'vitest';
import { FIRE_KINDS, FIRE_COLORANTS, validateFire, resolveFire, fireKernel, firePageChannel, fireLightColor } from './fire.js';
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
    const f = validateFire({ sources: [{ kind: 'fireball', at: [0, 0, 1] }, { kind: 'torch', at: [0, 0, 1], path: { from: [0, 0, 0], to: [1, 0, 0] } }, { kind: 'torch', at: [0, 0, 1], life: { kindle: -1, soon: 1 }, flares: { every: 0.2 } }], spread: [{ at: [0, 0], rate: 3, extent: 1 }, { at: 'here' }] }).join('\n');
    expect(f).toMatch(/path must be \{ from/);
    expect(f).toMatch(/path is for a fireball/);
    expect(f).toMatch(/life.kindle must be seconds/);
    expect(f).toMatch(/life.soon is not a life stage/);
    expect(f).toMatch(/flares must be \{ every: seconds ≥ 1/);
    expect(f).toMatch(/spread\[0\].rate must be 0.01–0.5/);
    expect(f).toMatch(/spread\[0\].extent must be 5–500/);
    expect(f).toMatch(/spread\[1\].at must be/);
    expect(validateFire({ spread: [{ at: [1, 2], start: 3 }], sources: [{ kind: 'fireball', path: { from: [0, 0, 1], to: [5, 0, 1], arc: 2 } }] })).toEqual([]);
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

describe('fire: colour, as fireworks are coloured', () => {
  it('takes a colorant, a mix, or a hex; refuses anything else with the list of salts', () => {
    expect(validateFire({ color: 'strontium', sources: [{ kind: 'torch', at: [0, 0], color: { copper: 1, barium: 0.5 }, soot: 0.3, smokeColor: '#30c060' }, { kind: 'brazier', at: [1, 1], color: '#8a2be2' }] })).toEqual([]);
    const e = validateFire({ color: 'neon', sources: [{ kind: 'torch', at: [0, 0], color: { copper: -1 }, soot: 3, smokeColor: 'green' }, { kind: 'torch', at: [0, 0], color: { radium: 1 } }] }).join('\n');
    expect(e).toMatch(/fire.color must be a colorant \(sodium, strontium, lithium, calcium, barium, boron, copper, potassium\)/);
    expect(e).toMatch(/color.copper must be a weight/);
    expect(e).toMatch(/soot must be from 0/);
    expect(e).toMatch(/smokeColor must be '#rrggbb'/);
    expect(e).toMatch(/color.radium is not a colorant/);
  });

  it('a coloured flame burns clean: its lines replace most of the soot, and its light takes their hue', () => {
    const r = resolveFire({ color: 'barium', sources: [{ kind: 'brazier', at: [0, 0, 1] }, { kind: 'brazier', at: [1, 0, 1], color: 'copper', soot: 0.5 }, { kind: 'brazier', at: [2, 0, 1], color: '#ff00ff' }] });
    const [g, b, m] = r.sources;
    expect(g.line).toEqual(FIRE_COLORANTS.barium.map((v) => +(v / Math.max(...FIRE_COLORANTS.barium)).toFixed(4)));
    expect(g.soot).toBeLessThan(FIRE_KINDS.brazier.soot * 0.2);
    expect(b.soot).toBeCloseTo(FIRE_KINDS.brazier.soot * 0.5, 6);
    expect(m.line).toEqual([1, 0, 1]);
    const green = fireLightColor('barium'), plain = fireLightColor(undefined);
    expect(green[1]).toBeGreaterThan(green[0]);
    expect(plain[0]).toBeGreaterThan(plain[1]);
    expect(resolveFire({ sources: [{ kind: 'torch', at: [0, 0, 1] }] }).sources[0].line).toBeUndefined();
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

describe('fire: intensity — kindling, flares, dying back, the bellows', () => {
  const fire = (extra, air = null) => fireKernel(resolveFire({ sources: [{ kind: 'brazier', at: [0, 0, 1], ...extra }] }), air);
  it('kindles from nothing, dies back to nothing, and the light follows', () => {
    const K = fire({ life: { start: 1, kindle: 4, out: 20, die: 5 } });
    expect(K.intensity(0, 0.5)).toBe(0);
    const up = [1.5, 2.5, 4, 6, 10].map((t) => K.intensity(0, t));
    expect(up.every((v, i) => i === 0 || v > up[i - 1])).toBe(true);
    expect(up[4]).toBeGreaterThan(0.95);
    expect(K.intensity(0, 30)).toBeLessThan(0.01);
    expect(K.flames(0, 30).every((f) => f === null)).toBe(true);
    expect(K.light(0, 0.5)).toBe(0);
  });
  it('a flare jumps and settles within a couple of seconds; its flames grow with it', () => {
    const K = fire({ flares: { every: 5, strength: 2 } }); let peak = 0, at = 0;
    for (let t = 0; t < 10; t += 0.01) { const k = K.intensity(0, t); if (k > peak) { peak = k; at = t; } }
    expect(peak).toBeGreaterThan(2.5);
    expect(K.intensity(0, at + 3)).toBeLessThan(1.1);
    // the fire's own puffing swings a flame ±30% from instant to instant: compare the means over a fifth of a second
    const tall = (t0) => { let a = 0, n = 0; for (let t = t0; t < t0 + 0.2; t += 0.01) for (const f of K.flames(0, t)) { a += f.L; n++; } return a / n; };
    expect(tall(at)).toBeGreaterThan(1.3 * tall(at + 3));
  });
  it('the wind feeds a fire it does not blow out, a little and up to a point', () => {
    const still = fire({}).intensity(0, 3), breeze = fire({}, wind(3)).intensity(0, 3), gale = fire({}, wind(30)).intensity(0, 3);
    expect(breeze).toBeGreaterThan(still);
    expect(gale).toBeLessThan(1.5);
  });
});

describe('fire: fireballs', () => {
  const ball = (path = {}) => resolveFire({ sources: [{ kind: 'fireball', path: { from: [0, 0, 2], to: [12, 0, 2], speed: 12, every: 3, delay: 0.5, ...path } }] });
  it('flies from → to on its schedule, and is nowhere between casts', () => {
    const K = fireKernel(ball(), null);
    expect(K.centre(0, 0.4)).toBeNull();
    expect(K.centre(0, 0.5)[0]).toBeCloseTo(0, 6);
    expect(K.centre(0, 1.0)[0]).toBeCloseTo(6, 6);
    expect(K.centre(0, 1.5)[0]).toBeCloseTo(12, 6);
    expect(K.centre(0, 2.6)).toBeNull();
    expect(K.flames(0, 2.6).every((f) => f === null)).toBe(true);
    expect(K.centre(0, 3.5)[0]).toBeCloseTo(0, 6);
  });
  it('trails its tail behind it (the streakline of where it was), and an arc lifts the middle of its flight', () => {
    const K = fireKernel(ball(), null), f = K.flames(0, 1.1)[0], n = f.pts.length;
    expect(f.pts[0]).toBeGreaterThan(f.pts[n - 3] + 0.5);   // head ahead (+x), tail behind
    expect(fireKernel(ball({ arc: 3 }), null).centre(0, 1.0)[2]).toBeCloseTo(5, 6);
  });
  it('bursts where it lands: a swell, a flash, and a shell of sparks', () => {
    const K = fireKernel(ball(), null);
    expect(K.intensity(0, 1.52)).toBeGreaterThan(2);
    const sparks = K.embers(0, 1.6); let out = 0;
    for (let o = 0; o < sparks.length; o += 7) if (Math.hypot(sparks[o] - 12, sparks[o + 1], sparks[o + 2] - 2) > 0.3) out++;
    expect(out).toBeGreaterThan(15);
    expect(Math.max(...K.flames(0, 1.6).map((g) => g.rad[0]))).toBeGreaterThan(2 * Math.max(...K.flames(0, 1.0).map((g) => g.rad[0])));
  });
});

describe('fire: grass fires', () => {
  const grass = (speed, extra = {}, world) => { const r = resolveFire({ spread: [{ at: [0, 0, 0], start: 0, ...extra }] }); r.wind = { speed, dir: 0 }; return fireKernel(r, null, world); };
  it('in still air spreads as a circle; in wind as an ellipse whose head runs downwind and back creeps upwind', () => {
    const calm = grass(0).burn(0, 20);
    expect(calm[2]).toBeCloseTo(calm[3], 6);
    const w = grass(5).burn(0, 20), head = w[0] + w[2], back = w[0] - w[2];
    expect(head).toBeGreaterThan(15);
    expect(back).toBeLessThan(0);
    expect(head / -back).toBeGreaterThan(5);
    expect(w[2] / w[3]).toBeGreaterThan(grass(2).burn(0, 20)[2] / grass(2).burn(0, 20)[3]);
  });
  it('the head burns tallest (Byram), and the fire burns out once its head has run its extent', () => {
    const K = grass(5, { extent: 30 }), f = K.flames(0, 15).filter(Boolean);
    expect(f[0].L).toBeGreaterThan(3 * Math.min(...f.map((g) => g.L)));   // flamelet 0 stands at the head
    expect(K.burn(0, 60)[2]).toBeCloseTo(K.burn(0, 80)[2], 6);   // the front stops where its head ran its extent
    expect(K.intensity(0, 80)).toBeLessThan(0.05);
  });
  it('stops at water: no flames where the ground will not burn', () => {
    const wet = grass(5, {}, { groundAt: () => 0, burnable: (x) => x < 3 });
    const f = wet.flames(0, 15);
    expect(f[0]).toBeNull();             // the head is in the water
    expect(f.some(Boolean)).toBe(true);  // the back still burns
  });
});

describe('fire: in worlds', () => {
  it('the page script parses; an emitted world carries it only when asked (absent ⇒ zero bytes)', () => {
    const cfg = firePageChannel(resolveFire({ sources: [{ kind: 'torch', at: [0, 0, 1], flares: { every: 3 } }, { kind: 'fireball', path: { from: [0, 0, 1], to: [9, 0, 1] } }], spread: [{ at: [4, 4] }] }), { day: 0.5, terrainAir: true });
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

  it('a dungeon lit by coloured fire bakes the fire\'s own hue into its walls; uncoloured, its bake is unchanged', () => {
    const plain = assembleDungeonScene({ ...DUNGEON, fire: true }), green = assembleDungeonScene({ ...DUNGEON, fire: { color: 'barium' } });
    expect(JSON.stringify(assembleDungeonScene({ ...DUNGEON, fire: {} }).faces)).toBe(JSON.stringify(plain.faces));
    expect(JSON.stringify(green.faces)).not.toBe(JSON.stringify(plain.faces));
    const page = fireChannelScript(firePageChannel(resolveFire({ color: 'barium' }, green.fireSources)));
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', `${page};return stepFire;`)).not.toThrow();
    expect(page).toMatch(/"line":\[0\.32,1,0\.08\]/);
  });

  it('the world route resolves fire for a dungeon and for a terrain (sources set on the ground, leaning in its wind)', async () => {
    const d = await resolveWorldScene({ ref: 'sk_fire_dungeon', title: 'fire', manifest: { kind: 'dungeon', ...DUNGEON, fire: true } });
    expect(d.payload.fire.sources).toHaveLength(4);
    expect(d.payload.fireSources).toBeUndefined();
    const world = { features: [{ feature: 'river' }], climate: 'temperate', seed: 'campfire' };
    const t = await resolveWorldScene({ ref: 'sk_fire_terrain', title: 'fire', manifest: { kind: 'terrain', world, grass: { kinds: ['meadow'] }, wind: { speed: 3 }, fire: { sources: [{ kind: 'campfire', at: [100, 200] }] } } }, { live: true });
    const s = t.payload.fire.sources[0];
    const t2 = await resolveWorldScene({ ref: 'sk_fire_terrain2', title: 'fire', manifest: { kind: 'terrain', world, grass: { kinds: ['meadow'] }, wind: { speed: 3 }, fire: { spread: [{ at: [100, 200] }] } } }, { live: true });
    expect(t2.payload.fire.spread[0].at[2]).toBeCloseTo(s.at[2] - FIRE_KINDS.campfire.seat, 4);
    expect(t.payload.fire.terrainAir).toBe(true);
    expect(t.payload.fire.day).toBe(1);
    expect(Math.abs(s.at[2] - FIRE_KINDS.campfire.seat)).toBeGreaterThan(0.5);   // on the ground, not at sea level
    await expect(resolveWorldScene({ ref: 'sk_fire_bad', title: 'x', manifest: { kind: 'dungeon', ...DUNGEON, fire: { sources: [{ kind: 'pyre', at: [0, 0] }] } } })).rejects.toThrow(/kind must be one of/);
  }, 120000);   // a live terrain world is a heavy resolve
});
