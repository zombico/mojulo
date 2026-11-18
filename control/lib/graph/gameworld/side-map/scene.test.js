// The side map built (side-map/scene.js, the geocube's `show: 'sidemap'`) and drawn (drawing.js). The concepts: the
// same recipe makes the same bytes; every closed part has its face in its zone's family and its top a lit edge; an
// indoor zone has its back wall and an outdoor one the sky; the cube owns the hue (its stone the place's, play opposite);
// the camera stands where the side map's frame puts it; a word it does not know is refused with teaching; the drawing
// outlines and numbers every zone, rules the map in screens, and names a lost law.
import { describe, it, expect } from 'vitest';
import { assembleSideMap, sideMapOf, readSideMapScene } from './scene.js';
import { drawSideMap } from './drawing.js';

const chain = (premise = 'into the reactor plant') => ({ premise, zones: [{ run: 'across', screens: 2, beat: 'rest' }, { run: 'up', screens: 2, climb: 'chimney' }, { run: 'across', screens: 2, teach: 'basic' }, { room: [1, 1], teach: 'boss' }] });
const M = (over = {}) => ({ kind: 'geocube', show: 'sidemap', cube: 'city-night', seed: 2, sidemap: chain(), ...over });

describe('the side map built', () => {
  it('the same recipe makes the same bytes', () => {
    expect(JSON.stringify(assembleSideMap(M()))).toBe(JSON.stringify(assembleSideMap(M())));
  });
  it('every closed part has its face in its zone\'s family and its top a lit edge', () => {
    // (counted on the flat build: lit, each face is cut into cells for its light, light.test.js)
    const p = assembleSideMap(M({ light: 'flat' })), { layout } = p.sidemap;
    const fronts = p.faces.filter((f) => f.group.startsWith('sidemap:') && ['rock', 'built', 'machine', 'padded'].includes(f.group.slice(8)) && f.normal[0] === 1);
    expect(fronts.length).toBe(layout.solids.length);
    expect(p.faces.filter((f) => f.group === 'sidemap:edge' && f.normal[2] === 1)).toHaveLength(layout.solids.length);
  });
  it('an indoor zone has its back wall; an outdoor one the sky', () => {
    const inside = assembleSideMap(M({ light: 'flat' })), out = assembleSideMap(M({ sidemap: chain('up the volcano'), light: 'flat' }));
    expect(inside.faces.some((f) => f.group === 'sidemap:back')).toBe(true);
    const D = out.sidemap.dress, outdoor = D.zones.filter((z) => !z.indoor).map((z) => z.zone);
    expect(outdoor.length).toBeGreaterThan(0);
    const backs = out.faces.filter((f) => f.group === 'sidemap:back').length, sweptIn = out.sidemap.layout.swept.filter((r) => D.zones[r.zone].indoor).length;
    expect(backs).toBe(sweptIn);
  });
  it('the cube owns the hue: its stone the place\'s, play the other side of the wheel', () => {
    const a = sideMapOf(M({ cube: 'city-night' })).dress.palette, b = sideMapOf(M({ cube: 'valley-morning' })).dress.palette;
    expect(a.place).not.toBe(b.place);
    expect(a.play).not.toBe(b.play);
  });
  it('the camera stands where the side map\'s frame puts it', () => {
    const p = assembleSideMap(M()), C = p.sidemap.layout.camera, [cam] = p.cameras;
    expect(cam.worldFraming.cameraPosition[0]).toBeCloseTo(C.dist, 3);
    expect(cam.worldFraming.lookAt[2] - p.sidemap.layout.checkpoints[0].at[1]).toBeCloseTo(C.lookH, 3);
  });
  it('a word it does not know is refused with teaching', () => {
    expect(() => readSideMapScene(M({ zones: [] }))).toThrow(/not a side map's word/);
    expect(() => assembleSideMap(M({ sidemap: undefined }))).toThrow(/zone chain/);
    // (a played level's own words beside the scene's are not the scene's to read)
    expect(() => sideMapOf(M({ entities: [], camera: {} }))).not.toThrow();
  });
});

describe('the side map drawn', () => {
  it('outlines and numbers every zone, rules it in screens, and names a lost law', () => {
    const D = sideMapOf(M()), svg = drawSideMap(D);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.match(/stroke-dasharray="4 4"/g)).toHaveLength(D.layout.zones.length);
    const along = Math.floor((Math.max(...D.layout.swept.map((r) => r.s1)) - Math.min(...D.layout.swept.map((r) => r.s0))) / D.layout.screen.width + 1e-6) + 1;
    expect(svg.match(/ m · [0-9.]+ s<\/text>/g)).toHaveLength(along);
    expect(svg).toMatch(/all \d+ laws hold/);
    expect(drawSideMap({ ...D, laws: [...D.laws, { id: 'rests', holds: false, says: 'four kicks' }] })).toMatch(/rests: four kicks/);
  });
});
