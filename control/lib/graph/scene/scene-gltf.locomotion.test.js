// The hero door's MOTION end to end (hero-motion.js): `motion` on the door → the plan's locomotion → the recipe → the
// World resolver's pack (each gait a dense clip with its seconds and ground speed `v`, the stock walk replaced) → the
// skinned GLB (the animation's `moj:speed`, the cycle at the clip's seconds). Without `motion`, the payload and the GLB
// are byte-identical to the hero without it.
import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest, validateHeroSpec } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';

const glbJson = (bytes) => { const jl = bytes.readUInt32LE(12); return JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')); };
const heroManifest = (hero) => { const h = heroRecord(hero); return { ...expandLayeredManifest({ kind: 'layered', title: 'loco', hero: h }), hero: h }; };
const resolve = async (manifest) => (await resolveWorldScene({ ref: 'sk_loco', title: 'loco', manifest })).payload;
const glb = (payload) => Buffer.from(facesToGlb(payload, { generator: 'mojulo loco', clips: '_all', skinned: true }).bytes);

describe('the hero door\'s motion', () => {
  it('refuses an unknown gait, an unknown dial and a seconds out of range, naming them', () => {
    expect(validateHeroSpec({ motion: { stroll: true } }).join(' ')).toMatch(/motion\.stroll: not a gait or a move \(have walk, jog, sprint, jump, jumpForward, jumpBack, doubleJump, runningJump, rollForward, rollSide, rollForwardLeft, rollSideLeft, walkStop, jogStop, sprintStop; the poses /);
    expect(validateHeroSpec({ motion: { walk: { stride: 0.4 } } }).join(' ')).toMatch(/motion\.walk\.stride: not a walk dial/);
    expect(validateHeroSpec({ motion: { jog: { seconds: 40 } } }).join(' ')).toMatch(/motion\.jog\.seconds/);
    expect(validateHeroSpec({ motion: { walk: { strideLength: 0.4, vault: true, seconds: 1.2 }, jog: true, sprint: { tilt: 22 } } })).toEqual([]);
    expect(validateHeroSpec({ motion: { jog: { tilt: 60 } } }).join(' ')).toMatch(/motion\.jog\.tilt: 0 … 35 degrees/);
  });

  it('packs each gait as a dense clip with its seconds and ground speed, replacing the stock walk; the GLB carries moj:speed', async () => {
    const payload = await resolve(heroManifest({ cast: 'female', head: 'anime', motion: { walk: { seconds: 1.1 }, jog: true } }));
    const clips = payload.figures.body.clips;
    expect(clips.walk.k).toBe(24); expect(clips.jog.k).toBe(24); expect(clips.idle.k).toBe(12);
    expect(clips.walk.s).toBe(1.1); expect(clips.jog.s).toBe(0.7);
    expect(clips.walk.v).toBeGreaterThan(0.3); expect(clips.jog.v).toBeGreaterThan(clips.walk.v);
    expect(clips.idle.v).toBeUndefined();
    expect(payload.figures.body.preview.clips).toContain('jog');
    const anims = glbJson(glb(payload)).animations;
    const walk = anims.find((a) => a.name === 'body:walk'), idle = anims.find((a) => a.name === 'body:idle');
    expect(walk.extras['moj:speed']).toBe(clips.walk.v);
    expect(idle.extras).toBeUndefined();
  });

  it('a hero without motion resolves and exports byte for byte as before (an empty motion too)', async () => {
    const base = await resolve(heroManifest({ cast: 'male', head: 'anime' }));
    const empty = await resolve(heroManifest({ cast: 'male', head: 'anime', motion: {} }));
    expect(JSON.stringify(empty.figures)).toBe(JSON.stringify(base.figures));
    expect(glb(empty).equals(glb(base))).toBe(true);
    expect(Object.values(base.figures.body.clips).every((c) => c.v === undefined)).toBe(true);
  });

  it('jumps pack one-shot with their air; the GLB carries moj:jump; a jump refuses dials', async () => {
    expect(validateHeroSpec({ motion: { jump: { tilt: 5 } } }).join(' ')).toMatch(/motion\.jump\.tilt: a jump takes only seconds/);
    expect(validateHeroSpec({ motion: { doubleJump: { seconds: 9 } } }).join(' ')).toMatch(/motion\.doubleJump\.seconds/);
    const payload = await resolve(heroManifest({ cast: 'female', head: 'anime', motion: { walk: true, sprint: true, jump: true, doubleJump: true, runningJump: true, rollForward: true } }));
    const clips = payload.figures.body.clips;
    expect(clips.jump.once).toBe(true); expect(clips.jump.k).toBe(34); expect(clips.jump.s).toBe(1.1);
    expect(clips.jump.air.land).toBeGreaterThan(clips.jump.air.takeoff);
    expect(clips.doubleJump.air.kick).toBeGreaterThan(0); expect(clips.walk.once).toBeUndefined();
    expect(clips.runningJump.air.speed).toBeCloseTo(clips.sprint.v, 3);   // in stride with the hero's own sprint
    const anims = glbJson(glb(payload)).animations;
    expect(anims.find((a) => a.name === 'body:jump').extras['moj:jump']).toEqual(clips.jump.air);
    expect(anims.find((a) => a.name === 'body:doubleJump').extras['moj:jump'].kick).toBe(clips.doubleJump.air.kick);
    expect(clips.rollForward.once).toBe(true); expect(clips.rollForward.roll.axis).toBe('forward');
    expect(anims.find((a) => a.name === 'body:rollForward').extras['moj:roll']).toEqual(clips.rollForward.roll);
  });

  it('the moves (a pose, a stance, a strike, and mirrors) pack one-shot at their seconds; the GLB carries moj:move; a move refuses dials, an unknown word by family', async () => {
    expect(validateHeroSpec({ motion: { jab: { tilt: 5 } } }).join(' ')).toMatch(/motion\.jab\.tilt: a strike takes only seconds \(its poses are studied; tune them in hero-strike\.js\)/);
    expect(validateHeroSpec({ motion: { heroHips: { seconds: 9 } } }).join(' ')).toMatch(/motion\.heroHips\.seconds: 0\.2 … 6 seconds/);
    expect(validateHeroSpec({ motion: { athleticLeft: true } }).join(' ')).toMatch(/motion\.athleticLeft: not a gait or a move \(have walk, .*; the poses hairToss, .*; the stances athletic, .*; the strikes jab, cross, thrust; .*a square stance/);
    const payload = await resolve(heroManifest({ cast: 'female', motion: { jab: true, heroHips: true, guardLeft: true, crossedArmsLeft: { seconds: 1.2 } } }));
    const clips = payload.figures.body.clips;
    for (const [n, family, s] of [['jab', 'strike', 0.42], ['heroHips', 'aura', 1.4], ['guardLeft', 'stance', 0.7], ['crossedArmsLeft', 'aura', 1.2]]) {
      expect(clips[n].once, n).toBe(true); expect(clips[n].s, n).toBe(s); expect(clips[n].move, n).toMatchObject({ family, hold: true });
      expect(clips[n].k, n).toBe(Math.max(24, Math.round(s * 30) + 1));
    }
    expect(clips.jab.move.hand).toBe('R'); expect(clips.jab.move.contact).toBeCloseTo(0.44 * 0.42, 4);   // the strike's contact time
    expect(clips.heroHips.move.laws).toBe(true);   // the pose's own laws (hero-aura auraChecks) held on this hero
    const anims = glbJson(glb(payload)).animations;
    expect(anims.find((a) => a.name === 'body:jab').extras['moj:move']).toEqual(clips.jab.move);
    expect(anims.find((a) => a.name === 'body:walk').extras?.['moj:move']).toBeUndefined();
  });

  it('a turned clip exports its turn: through every key of a stance and a strike the head and the jaw skin together (the seam under the chin shut)', async () => {
    const bytes = glb(await resolve(heroManifest({ cast: 'female', motion: { guard: true, jab: true } }))), j = glbJson(bytes), bin = bytes.subarray(28 + bytes.readUInt32LE(12));
    const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = { VEC3: 3, VEC4: 4, MAT4: 16, SCALAR: 1 }[a.type], o = (bv.byteOffset || 0) + (a.byteOffset || 0); return { n, count: a.count, at: (k) => Array.from({ length: n }, (_, c) => bin.readFloatLE(o + (k * n + c) * 4)) }; };
    const qm = ([x, y, z, w], t) => [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1];
    const mul = (A, B) => Array.from({ length: 16 }, (_, i) => { const c = Math.floor(i / 4), r = i % 4; let v = 0; for (let k = 0; k < 4; k++) v += A[k * 4 + r] * B[c * 4 + k]; return v; });
    const skin = j.skins[0], ibm = acc(skin.inverseBindMatrices), node = (nm) => j.nodes.findIndex((x) => x.name === nm), head = node('body:head'), jaw = node('body:jaw');
    for (const name of ['body:guard', 'body:jab']) {
      const a = j.animations.find((x) => x.name === name), ch = (ni, path) => { const c = a.channels.find((x) => x.target.node === ni && x.target.path === path); return acc(a.samplers[c.sampler].output); };
      const n = ch(head, 'rotation').count; let worst = 0;
      for (let k = 0; k < n; k++) {
        const M = (ni) => mul(qm(ch(ni, 'rotation').at(k), ch(ni, 'translation').at(k)), ibm.at(skin.joints.indexOf(ni)));
        const H = M(head), J = M(jaw); worst = Math.max(worst, ...H.map((v, i) => Math.abs(v - J[i])));
      }
      expect(worst, name).toBeLessThan(1e-3);
    }
  });

  it('a stop packs two one-shots (each braking foot) with its start phase; the GLB carries moj:stop; a stop refuses dials', async () => {
    expect(validateHeroSpec({ motion: { jogStop: { tilt: 5 } } }).join(' ')).toMatch(/motion\.jogStop\.tilt: a stop takes only seconds/);
    const payload = await resolve(heroManifest({ cast: 'male', head: 'anime', motion: { jog: true, jogStop: true } }));
    const clips = payload.figures.body.clips;
    for (const [n, lead] of [['jogStop', 'R'], ['jogStopLeft', 'L']]) {
      expect(clips[n].once).toBe(true); expect(clips[n].s).toBe(0.75); expect(clips[n].stop).toMatchObject({ from: 'jog', lead });
    }
    expect(Math.abs(clips.jogStop.stop.phase - clips.jogStopLeft.stop.phase)).toBeCloseTo(0.5, 2);
    expect(glbJson(glb(payload)).animations.find((a) => a.name === 'body:jogStopLeft').extras['moj:stop']).toEqual(clips.jogStopLeft.stop);
  });
});
