import { describe, it, expect } from 'vitest';
import { validateArtillery, layArtillery, artilleryOf, artilleryReadout, vehicleBase } from './artillery.js';
import { VEHICLES, handlesOf } from '../../vehicle-registry/roster.js';
import { MILITARY_CLASSES } from '../../car-designer/road-military.js';
import { ORDNANCE, ORDNANCE_NAMES, DIRECT_BANDS, INDIRECT_BANDS } from './ordnance.js';
import { MOUNTS, MOUNT_NAMES } from './mount.js';
import { STANDS } from './terminal.js';

// THE ARTILLERY RANGE (artillery.js): a gun's mount, rounds and base laid on the range. The layout (each stand at each
// band, no near row hiding a far one, the far field only for a shell fired high), the gun (its turret, its rounds by key,
// the sight's marks from the round's own flight) and the spec's refusals. One direct round keeps the measures short.
const direct = ORDNANCE_NAMES.find((n) => !ORDNANCE[n].indirect), high = ORDNANCE_NAMES.find((n) => ORDNANCE[n].indirect);
const flat = MOUNT_NAMES.find((n) => MOUNTS[n].mount.elevation.max < 45), steep = MOUNT_NAMES.find((n) => MOUNTS[n].mount.elevation.max >= 45);
const walls = STANDS.filter((s) => s.thickness !== undefined);

describe('the artillery range', () => {
  it('lays each stand at each direct band, a near row never across the line of sight to a far one', () => {
    const L = layArtillery();
    for (const d of DIRECT_BANDS) expect(L.stands.filter((s) => s.band === d).map((s) => s.stand)).toEqual(walls.map((s) => s.id));
    // (the bearing span of each band's row: the rows' spans do not overlap)
    const span = (d) => { const S = L.stands.filter((s) => s.band === d); return [Math.min(...S.map((s) => Math.atan2(s.min[1], s.min[0]))), Math.max(...S.map((s) => Math.atan2(s.max[1], s.min[0])))]; };
    const spans = DIRECT_BANDS.map(span).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThan(spans[i - 1][1]);
    // (a sloped plate laid back: its colliders a stair under its face, its line-of-sight thickness its thickness / cos)
    const sl = L.stands.find((s) => s.angle);
    expect(sl.max[0] - sl.min[0]).toBeGreaterThan(sl.thickness / Math.cos(sl.angle * Math.PI / 180));
    expect(L.stands.some((s) => s.face === 'top')).toBe(false);
    const far = layArtillery({ indirect: true });
    expect(far.stands.filter((s) => s.face === 'top').map((s) => s.band).every((b) => INDIRECT_BANDS.includes(b) && b > DIRECT_BANDS.at(-1))).toBe(true);
  });

  it('refuses what cannot be laid: an unknown round or mount, a shell fired high from a gun that cannot elevate for it', () => {
    expect(validateArtillery({})).toEqual([]);
    expect(validateArtillery({ mount: steep, ordnance: [high] })).toEqual([]);
    expect(validateArtillery({ mount: flat, ordnance: [high] }).join()).toMatch(/elevates past 45/);
    expect(validateArtillery({ ordnance: ['nuke'] }).join()).toMatch(/not a round/);
    expect(validateArtillery({ mount: 'catapult' }).join()).toMatch(/mount: one of/);
    expect(validateArtillery({ base: 'boat' }).join()).toMatch(/base/);
    expect(validateArtillery({ sounds: { shot: 'no such sound at all' } }).join()).toMatch(/not a sound/);
    expect(() => artilleryOf({ ordnance: [] })).toThrow(/artillery range/);
    // (a base from the library: a word it knows, a field vehicle; a road car carries no turret)
    expect(validateArtillery({ base: { vehicle: 'no such machine at all' } }).join()).toMatch(/not a vehicle of the library/);
    expect(validateArtillery({ base: { vehicle: 'sedan' } }).join()).toMatch(/no field vehicle/);
    expect(validateArtillery({ base: { vehicle: 'light tank', paint: 'red' } }).join()).toMatch(/base.paint/);
  });

  it('a vehicle of the library as the base: its own figure with its gun on a bone, driven on its class, the mount where its gun is', () => {
    // (the library's turreted field vehicle, and one without a turret: found in the roster, not named)
    const field = Object.keys(VEHICLES).filter((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k]));
    const tank = field.find((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k] === 'lightTank'));
    const V = vehicleBase({ vehicle: tank });
    expect(V.figure.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['turret', 'gun']));
    const gun = V.figure.bones.find((b) => b.id === 'gun').head;
    // (vehicle space +y forward, +x right; the mount's place forward, right, up)
    expect(V.turret.mount.at).toEqual([gun[1], gun[0], gun[2]]);
    expect(V.turret.gun.barrel).toBeGreaterThan(1.5);
    expect(V.rule.type).toBe('drive');
  }, 30000);

  it('a field vehicle with no turret is fitted a weapon station where it has a ring for one, and a wheeled one steers', () => {
    // (one tracked and one wheeled, found in the roster: the carrier with its mount ring, an eight-wheeler)
    const field = Object.keys(VEHICLES).filter((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k] && !/^(lightTank)$/.test(k) && MILITARY_CLASSES[k] !== 'airside' && !k.startsWith('airside')));
    const kind = (id) => MILITARY_CLASSES[(handlesOf(id).physics ?? []).find((k) => MILITARY_CLASSES[k])];
    const tracked = vehicleBase({ vehicle: field.find((id) => kind(id) === 'trackedCarrier') });
    expect(tracked.station).toBe(true);
    expect(tracked.figure.bones.map((b) => b.id).slice(-2)).toEqual(['turret', 'gun']);
    expect(tracked.turret.mount.stabilized).toBe(true);
    expect(tracked.turret.mount.traverse.min).toBeUndefined();
    expect(tracked.rounds).toEqual(['apds30', 'he30']);
    expect(tracked.figure.steer).toBeUndefined();
    const eight = vehicleBase({ vehicle: field.find((id) => kind(id) === 'carrier') });
    // (an eight-wheeler steers its front two axles, both sides, the second less far ahead of the fixed axles' line)
    const S = eight.figure.steer;
    expect(S.wheels).toHaveLength(4);
    expect(new Set(S.wheels.map((w) => Math.sign(w.x)))).toEqual(new Set([1, -1]));
    expect(Math.min(...S.wheels.map((w) => w.y))).toBeGreaterThan(0);
    expect(eight.rule.type).toBe('drive');
  }, 30000);

  it('the gun: its turret on its base, its rounds by key, the sight\'s marks from its flight, heard to the far field', () => {
    const A = artilleryOf({ mount: flat, ordnance: [direct], base: 'hull' }), P = A.minted.pilot, T = P.turret;
    expect(P.rule.type).toBe('walk');
    expect(T.mount.traverse.rate).toBe(MOUNTS[flat].mount.traverse.rate);
    expect(T.rounds.map((r) => r.ordnance)).toEqual([direct]);
    expect(P.weapon).toEqual(T.rounds[0]);
    // (a mark for each band, each under the bore's line, the farthest the lowest: near, the sight's height over the
    // target's centre and the drop share the mark, so the near marks need not fall in order)
    const marks = T.range.table[direct];
    expect(marks.map((m) => m[0])).toEqual([...DIRECT_BANDS]);
    for (const m of marks) expect(m[1]).toBeGreaterThan(0);
    expect(marks.at(-1)[1]).toBe(Math.max(...marks.map((m) => m[1])));
    expect(T.range.stands.length).toBe(walls.length * DIRECT_BANDS.length);
    expect(Object.keys(T.range.ordnance)).toEqual([direct]);
    expect(A.laws.filter((l) => !l.ok)).toEqual([]);
    expect(A.minted.payload.audio.mix.reach).toBeGreaterThan(INDIRECT_BANDS.at(-1));
    expect(T.rounds[0].sfx.shot.length).toBeGreaterThan(0);
    expect(artilleryReadout(A).at(-1)).toMatch(/hold/);
    // (quiet: no sound at all; a fixed base stands)
    const Q = artilleryOf({ mount: flat, ordnance: [direct], quiet: true });
    expect(Q.minted.payload.audio).toBeUndefined();
    expect(Q.minted.pilot.rule.type).toBe('static');
  }, 30000);
});
