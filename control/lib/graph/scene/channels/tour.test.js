// The tour on the World page: absent, it adds nothing; present, it carries its stops, fills the window, and a capture is
// seated without easing. A world's recipe reaches it through world-scene, checked against what the world draws.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';
import { tourScript } from './tour.js';
import { readTour, tourGroups } from '../../exhibit/tour.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';

const face = (group, x) => ({ group, color: '#88aacc', poly: [[x, 0, 0], [x + 1, 0, 0], [x + 1, 1, 0], [x, 1, 0]] });
const base = {
  faces: [face('dam', 0), face('turbine', 2)],
  cameras: [{ name: 'wide', pos: [0, -8, 4], target: [1, 0, 0], vfov: 45 }],
  title: 'tour fixture',
};
const tour = readTour({ title: 'T', stops: [{ caption: 'one', camera: 'wide' }, { caption: 'two', camera: { frame: 'turbine' }, highlight: 'turbine' }] },
  { cameras: base.cameras, groups: tourGroups(base) });

describe('the tour on the page', () => {
  it('absent, adds not a byte', () => {
    const plain = emitThreeWorld(base);
    expect(emitThreeWorld({ ...base, tour: null })).toBe(plain);
    expect(emitThreeWorld({ ...base, tour: { stops: [] } })).toBe(plain);
    expect(plain).not.toMatch(/__mojTour|moj-tour/);
  });

  it('present, carries its stops and its handle, and fills the window', () => {
    const html = emitThreeWorld({ ...base, tour });
    expect(html).toContain('window.__mojTour');
    expect(html).toContain(JSON.stringify(tour.stops[1].highlight));
    expect(html).toMatch(/a TOUR \(exhibit\/tour\.js\) is an exhibit[\s\S]*#wrap\{width:100vw;height:100vh;height:100dvh/);
    // an exhibit is not the editor: its canvas can clear to nothing over the exhibit's own ground, and the construction
    // tools give way to the crumbs
    expect(html).toMatch(/new THREE\.WebGLRenderer\(\{[^)]*alpha: true/);
    expect(html).toContain("wireBtn.style.display = 'none'");
    expect(emitThreeWorld(base)).not.toMatch(/new THREE\.WebGLRenderer\(\{[^)]*alpha: true/);
  });

  it('a capture is seated, never flown, and never a kiosk; a viewer is flown unless they ask for less motion', () => {
    expect(tourScript(tour, { capture: true })).toContain('const calm = true ||');
    expect(tourScript(tour, { capture: true })).toContain('const kiosk = false;');
    expect(tourScript(tour)).toContain('const calm = false ||');
    expect(tourScript(tour)).toContain("const kiosk = kq != null && kq !== '0';");
  });

  it('talks to a gallery\'s frame only through its own parent, and gives an audit its view', () => {
    const js = tourScript(tour);
    expect(js).toMatch(/e\.source !== window\.parent/);
    for (const m of ['tour-ready', 'tour-touch', 'tour-end', 'tour-play', 'tour-stop', 'tour-go']) expect(js).toContain(`'${m}'`);
    expect(js).toMatch(/window\.__mojTour = \{[\s\S]*view \};/);
  });
});

describe('a world recipe\'s tour', () => {
  it('rides any world: read against what it draws, on the payload for the page', async () => {
    const manifest = { kind: 'cellular-view', tour: { stops: [{ caption: 'The cell.', camera: 'angle' }, { caption: 'Power.', camera: 'top', highlight: 'org:mitochondria' }] } };
    const { payload } = await resolveWorldScene({ ref: 't', title: 't', manifest });
    expect(payload.tour.stops.map((s) => s.camera)).toEqual([{ cam: 0 }, { cam: 2 }]);
    expect(payload.tour.stops[1].highlight).toEqual(['org:mitochondria']);
    const { payload: plain } = await resolveWorldScene({ ref: 't', title: 't', manifest: { kind: 'cellular-view' } });
    expect(plain.tour).toBeUndefined();
  });

  it('is refused naming what the world has', async () => {
    const manifest = { kind: 'cellular-view', tour: { stops: [{ caption: 'x', camera: 'angle', highlight: 'org:chloroplast' }] } };
    await expect(resolveWorldScene({ ref: 't', title: 't', manifest })).rejects.toThrow(/names no group 'org:chloroplast' of this world \(its groups: .*org:mitochondria/);
  });
});
