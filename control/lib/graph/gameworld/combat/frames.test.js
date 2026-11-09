import { describe, it, expect } from 'vitest';
import { frameBase, frameOf, validateFrame, FRAME_MOUNTS } from './frames.js';
import { WEAPON_ROUNDS, ORDNANCE } from './ordnance.js';
import { MECHA_ARCHETYPES } from '../../mecha-shelf/index.js';
import { MECHA_BACKPACKS } from '../../mecha-shelf/mecha-backpacks.js';
import { VEHICLES, handlesOf } from '../../vehicle-registry/roster.js';
import { assembleFrame } from '../../mecha-shelf/index.js';
import { gaitStances } from '../../mecha-shelf/mecha-gait.js';
import { lowerAssemblerBuild } from '../../worlds/workbench-assembler.js';

// THE FRAMES ON THE RANGE (frames.js): a mecha shelf frame as the range's base. One case per way a frame comes armed,
// chosen from the shelf in code, the lightest of each: its own gun backpack as built, a gun backpack it takes, or none
// (a mount fitted on its roof); and a transforming walker's tank form.
const guns = (pack) => !!pack && MECHA_BACKPACKS[pack].takes.some((w) => WEAPON_ROUNDS[w]);
const rowOf = (a) => Object.keys(VEHICLES).find((id) => (handlesOf(id).mecha ?? []).includes(a));
const lightest = (f) => Object.keys(MECHA_ARCHETYPES).filter(f).sort((a, b) => MECHA_ARCHETYPES[a].mass - MECHA_ARCHETYPES[b].mass)[0];
const BUILT = lightest((a) => guns(MECHA_ARCHETYPES[a].backpack));
const TAKES = lightest((a) => !guns(MECHA_ARCHETYPES[a].backpack) && (MECHA_ARCHETYPES[a].backpacks ?? []).some(guns));
const BARE = lightest((a) => !guns(MECHA_ARCHETYPES[a].backpack) && !(MECHA_ARCHETYPES[a].backpacks ?? []).some(guns));
const word = (a) => VEHICLES[rowOf(a)].label;

describe('the frames on the range', () => {
  it('a frame with its own guns fires from its mounts: each side a ring and a cradle bone, each weapon its rounds from its own trunnion', () => {
    const F = frameBase({ frame: word(BUILT) });
    expect(F.armed).toBe(true);
    expect(F.stance).toBe(MECHA_ARCHETYPES[BUILT].stances.brace ? 'brace' : 'stand');
    const ids = F.figure.bones.map((b) => b.id);
    for (const s of Object.keys(F.weapons)) for (const b of ['turret', 'gun']) expect(ids).toContain(`${b}${s.toUpperCase()}`);
    expect(F.rounds.map((r) => r.ordnance)).toEqual(Object.values(F.weapons).flatMap((w) => WEAPON_ROUNDS[w] ?? []));
    // (each round's mount on its own side, its trunnion the gun bone's head: [forward, right, up] of vehicle [y, x, z])
    for (const r of F.rounds) {
      const g = F.figure.bones.find((b) => b.id === `gun${r.mountSide.toUpperCase()}`).head;
      expect([r.at[0], r.at[1]]).toEqual([g[1], g[0]]);
      expect(r.barrel).toBeGreaterThan(0.3);
      expect(ORDNANCE[r.ordnance]).toBeTruthy();
    }
    expect(new Set(F.rounds.map((r) => r.mountSide)).size).toBe(Object.values(F.weapons).filter((w) => WEAPON_ROUNDS[w]).length);
  }, 30000);

  it('a frame that takes a gun backpack is given it; a frame with none is fitted a mount on its roof', () => {
    const T = frameBase({ frame: word(TAKES) });
    expect(T.armed).toBe(true);
    expect(T.rounds.length).toBeGreaterThan(0);
    const B = frameBase({ frame: word(BARE) });
    expect(B.armed).toBe(false);
    expect(B.weapons).toEqual({ r: 'autocannon' });
    // (on its roof: the ring at the frame's centreline, the gun at its top)
    const ring = B.figure.bones.find((b) => b.id === 'turretR').head;
    expect(Math.abs(ring[0])).toBeLessThan(0.01);
    expect(B.height - ring[2]).toBeLessThan(0.6);
    expect(B.mountClass).toBe('pack');
  }, 30000);

  it('a transforming walker in its tank form stands its mounts lower than braced', () => {
    const T = lightest((a) => MECHA_ARCHETYPES[a].stances?.roll && guns(MECHA_ARCHETYPES[a].backpack));
    const braced = frameBase({ frame: word(T) }), rolled = frameBase({ frame: word(T), stance: 'roll' });
    expect(rolled.stance).toBe('roll');
    expect(rolled.rounds[0].at[2]).toBeLessThan(braced.rounds[0].at[2]);
  }, 30000);

  it('walks: a forward clip of its gait\'s keys, each body where the IK puts it at that key; in its tank form it stands', () => {
    const F = frameBase({ frame: word(BARE) }), clip = F.figure.clips.forward, nb = F.figure.bones.length;
    expect(F.gait.archetype).toBe(BARE);
    expect(clip.k).toBe(gaitStances(F.gait).length);
    // (a leg's lowest body at a key: the rest mesh carried by its bone lands where the key's own assembly puts it)
    const K = Math.floor(clip.k / 3), body = Object.values(MECHA_ARCHETYPES[BARE].legs)[0].foot;
    const rest = lowerAssemblerBuild(assembleFrame(BARE, { pose: F.stance }).manifest), key = lowerAssemblerBuild(assembleFrame(BARE, { pose: gaitStances(F.gait)[K], laws: false }).manifest);
    const p0 = rest.placements.find((p) => p.id === body), pk = key.placements.find((p) => p.id === body), bi = F.figure.bones.findIndex((b) => b.id === body);
    const [qx, qy, qz, qw, hx, hy, hz] = clip.b.slice((K * nb + bi) * 7, (K * nb + bi) * 7 + 7), rh = F.figure.bones[bi].head, v = rest.faces[p0.faceStart].corners[0];
    const d = [v[0] - rh[0], v[1] - rh[1], v[2] - rh[2]], u = [qy * d[2] - qz * d[1], qz * d[0] - qx * d[2], qx * d[1] - qy * d[0]];
    const got = [0, 1, 2].map((i) => [hx, hy, hz][i] + d[i] + 2 * (qw * u[i] + [qy * u[2] - qz * u[1], qz * u[0] - qx * u[2], qx * u[1] - qy * u[0]][i]));
    const want = key.faces[pk.faceStart].corners[0];
    expect(Math.hypot(...got.map((g, i) => g - want[i]))).toBeLessThan(2e-3);
    const T = Object.keys(MECHA_ARCHETYPES).find((a) => MECHA_ARCHETYPES[a].stances?.roll);
    expect(frameBase({ frame: word(T), stance: 'roll' }).gait).toBeUndefined();
  }, 60000);

  it('refuses what is not a frame, a stance it has not, a word it does not take', () => {
    expect(validateFrame({ frame: 'no such machine at all' }).join()).toMatch(/not a vehicle of the library/);
    expect(validateFrame({ frame: 'sedan' }).join()).toMatch(/no frame of the mecha shelf/);
    expect(validateFrame({ frame: word(BARE), stance: 'cartwheel' }).join()).toMatch(/stands/);
    expect(validateFrame({ frame: word(BARE), paint: 'red' }).join()).toMatch(/base.paint/);
    expect(frameOf(word(BARE)).archetype).toBe(BARE);
    // (a howitzer's mount reaches the indirect arc; a backpack's does not need to)
    expect(FRAME_MOUNTS.siege.mount.elevation.max).toBeGreaterThanOrEqual(45);
  });
});
