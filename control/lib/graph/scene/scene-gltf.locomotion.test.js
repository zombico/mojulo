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
    expect(validateHeroSpec({ motion: { stroll: true } }).join(' ')).toMatch(/motion\.stroll: not a gait \(have walk, jog, sprint, jump, jumpForward, jumpBack, doubleJump, runningJump, rollForward, rollSide, rollForwardLeft, rollSideLeft\)/);
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
});
