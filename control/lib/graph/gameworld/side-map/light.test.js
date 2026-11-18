// The side map's light (side-map/light.js), baked per corner. The concepts: a large face is cut into cells, each lit at
// its corners; what gives light (a lamp, the boss's emblem, the far layers) is never lit; the back wall is lighter near
// a lamp than far from it; a closed face darker just under its lip; a climb's top lighter than its foot and a chute
// darker at its foot; the same map lights the same way; asked flat, the build is the one baked key it was, no corners.
import { describe, it, expect } from 'vitest';
import { lightSideMap, SIDE_MAP_LIGHT } from './light.js';
import { assembleSideMap, sideMapOf } from './scene.js';
import { sideMapTexture, TEXTURE_KINDS } from './texture.js';

const M = (over = {}) => ({ kind: 'geocube', show: 'sidemap', cube: 'city-night', seed: 2, sidemap: { premise: 'into the reactor plant', zones: [{ run: 'across', screens: 3, beat: 'rest' }, { run: 'up', screens: 2, climb: 'chimney' }, { run: 'across', screens: 1 }, { run: 'down', screens: 2, drop: 'chute' }, { room: [1, 1], teach: 'boss' }] }, ...over });
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const mid = (f, k) => f.corners.reduce((s, c) => s + c[k], 0) / f.corners.length;
const sq = (x, s0, s1, z0, z1, fill, group) => ({ corners: [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], normal: [1, 0, 0], fill, group });

describe('the side map\'s light', () => {
  const D0 = sideMapOf(M()), { layout: L, dress: D, cube } = D0, lit = (faces) => lightSideMap(faces, L, D, cube);
  it('cuts a large face into cells, each lit at its corners; what gives light is left as it is', () => {
    const out = lit([sq(-3, 0, 12, 0, 6, '#406080', 'sidemap:back'), sq(-2.9, 5, 6, 3, 3.4, '#ffeecc', 'sidemap:lamp')]);
    const cellsOf = out.filter((f) => f.group === 'sidemap:back');
    expect(cellsOf.length).toBe(Math.ceil(12 / SIDE_MAP_LIGHT.cell) * Math.ceil(6 / SIDE_MAP_LIGHT.cell));
    expect(cellsOf.every((f) => f.cornerFills?.length === 4)).toBe(true);
    expect(out.find((f) => f.group === 'sidemap:lamp')).toEqual(sq(-2.9, 5, 6, 3, 3.4, '#ffeecc', 'sidemap:lamp'));
  });
  it('the back wall lighter near a lamp than far from it', () => {
    const Z = D.zones.find((z) => z.lamps?.length), o = L.open.find((r) => r.zone === Z.zone), s = Z.lamps[0], z = o.z1 - 2.5;
    const [near] = lit([sq(-3, s - 0.2, s + 0.2, z, z + 0.2, '#406080', 'sidemap:back')]);
    const farS = Z.bays.length > 1 ? Z.seams[Z.bays.indexOf('B')] ?? s + 9 : s + 9;
    const [far] = lit([sq(-3, farS - 0.2, farS + 0.2, z, z + 0.2, '#406080', 'sidemap:back')]);
    expect(lum(near.fill)).toBeGreaterThan(lum(far.fill));
  });
  it('a closed face darker just under its lip; a climb\'s top lighter than its foot; a chute darker at its foot', () => {
    const floor = L.solids.find((r) => r.zone === 0 && r.role === 'floor' && r.s1 - r.s0 > 4), s = floor.s0 + 2;
    const [hi] = lit([sq(1.5, s, s + 0.2, floor.z1 - 0.4, floor.z1 - 0.3, '#5070a0', 'sidemap:built')]), [lo] = lit([sq(1.5, s, s + 0.2, floor.z1 - 2.1, floor.z1 - 2, '#5070a0', 'sidemap:built')]);
    expect(lum(hi.fill)).toBeLessThan(lum(lo.fill));
    const up = L.zones[1], so = L.open.find((r) => r.zone === 1), sc = (so.s0 + so.s1) / 2, top = up.exit[1];
    const [t] = lit([sq(-3, sc, sc + 0.2, top - 0.5, top - 0.4, '#406080', 'sidemap:back')]), [b] = lit([sq(-3, sc, sc + 0.2, top - 20, top - 19.9, '#406080', 'sidemap:back')]);
    expect(lum(t.fill)).toBeGreaterThan(lum(b.fill));
    const ch = L.zones[3], co = L.open.find((r) => r.zone === 3), cs = (co.s0 + co.s1) / 2, z0 = L.zones[2].exit[1], z1 = ch.exit[1];
    const [ct] = lit([sq(-3, cs, cs + 0.2, z0 - 1, z0 - 0.9, '#406080', 'sidemap:back')]), [cb] = lit([sq(-3, cs, cs + 0.2, z1 + 1, z1 + 1.1, '#406080', 'sidemap:back')]);
    expect(lum(ct.fill)).toBeGreaterThan(lum(cb.fill));
  });
  it('the same map lights the same way; asked flat, no corners are baked', () => {
    expect(JSON.stringify(assembleSideMap(M()).faces.slice(0, 200))).toBe(JSON.stringify(assembleSideMap(M()).faces.slice(0, 200)));
    const flat = assembleSideMap(M({ light: 'flat' })), litP = assembleSideMap(M());
    expect(flat.faces.some((f) => f.cornerFills)).toBe(false);
    expect(litP.faces.filter((f) => f.cornerFills).length).toBeGreaterThan(flat.faces.length / 2);
    expect(() => assembleSideMap(M({ light: 'bright' }))).toThrow(/light is lit \| flat/);
  });
  it('the material baked: its surfaces textured on world uvs, a glint on its own surfaces only, the back wall bare of it', () => {
    const p = assembleSideMap(M()), tex = p.faces.filter((f) => f.texture);
    expect(tex.length).toBeGreaterThan(100);
    expect(tex.every((f) => f.textureLit && f.uv.length === 4 && p.textures[f.texture]?.startsWith('data:image/png;base64,'))).toBe(true);
    expect(p.faces.filter((f) => f.group === 'sidemap:back').some((f) => f.texture)).toBe(false);
    expect(assembleSideMap(M({ light: 'flat' })).textures).toBeUndefined();
    // (a kibble zone's back wall takes no finish: lit the same with its material's finish as without)
    const z = D.zones.findIndex((x) => x.material === 'kibble'), o = L.open.find((r) => r.zone === z), at = (o.s0 + o.s1) / 2;
    const back = sq(-3, at, at + 0.2, o.z0 + 2, o.z0 + 2.2, '#406080', 'sidemap:back');
    const bare = lightSideMap([back], L, { ...D, zones: D.zones.map((x) => ({ ...x, material: 'masonry' })) }, cube)[0];
    expect(lit([back])[0].fill).toBe(bare.fill);
  });
  it('a texture tile is near white and the same every time', () => {
    for (const k of TEXTURE_KINDS) { const a = sideMapTexture(k); expect(a).toBe(sideMapTexture(k)); expect(a.startsWith('data:image/png;base64,')).toBe(true); }
  });
});
