// THE CAST RIG ON A BODY (a figure's `cast`, color-theorist/cast-rig.js): a figure that carries the rig is drawn with the
// cast material (../cast-rig.js) by whichever builder draws it, its normals the lit read's or its mesh's own; a bank
// with no such figure carries none of it.
import { describe, it, expect } from 'vitest';
import { controllableChannelScript } from './index.js';
import { castRig } from '../../../color-theorist/cast-rig.js';
import { castRigInput } from '../cast-rig.js';
import { readGeocube } from '../../../era/geocube.js';

const f32 = (a) => Buffer.from(Float32Array.from(a).buffer).toString('base64');
const u8 = (a) => Buffer.from(Uint8Array.from(a).buffer).toString('base64');
const SOUP = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const COL = [200, 120, 40, 7, 64, 255, 0, 33, 180, 7, 64, 255, 90, 90, 90, 0, 33, 180];
const clip = { k: 2, b: [0, 0, 0, 1, 0.1, 0.2, 1.5, 0, 0, 0, 1, 0.1, 0.2, 1.5] };
const part = (extra = {}) => ({ pos: f32(SOUP), col: u8(COL), faces: 2, jnt: u8(Array(24).fill(0)), wgt: f32(Array(24).fill(0.25)), ...extra });
const CAST = { ...castRigInput(castRig(readGeocube('island-noon'))), surface: 'form' };
const fig = (extra = {}, p = part()) => ({ rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [p], clips: { idle: clip }, figH: 1.7, ...extra });
const ent = [{ id: 'hero', pilotable: true, body: { type: 'figure-rig', figure: 'p' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];

describe('a figure under the cast rig', () => {
  it('a bank with no rig carries none of the kit; one figure with it brings the kit and its material', () => {
    const plain = controllableChannelScript(ent, null, { p: fig() });
    expect(plain).not.toContain('castKit');
    expect(plain).not.toContain('__castMat');
    const lit = controllableChannelScript(ent, null, { p: fig({ cast: CAST }) });
    expect(lit).toContain('const castKit = ');
    expect(lit).toContain('function __castMat(fig, o)');
    // (the page carries the rig on the figure, as it was solved)
    expect(lit).toContain(JSON.stringify(CAST.key.linear));
  });

  it('is drawn with it by the merged builder (its mesh\'s own normals) and by the per-bone builder (the lit read\'s, else its own)', () => {
    // (a plain rigid rig: one skinned mesh)
    const merged = controllableChannelScript(ent, null, { p: fig({ cast: CAST }) });
    expect(merged).toContain('fig.cast ? (geo.computeVertexNormals(), __castMat(fig,');
    // (a part that carries its normals stays in the float soup, drawn on its own bone)
    const nrm = controllableChannelScript(ent, null, { p: fig({ cast: CAST }, part({ nrm: f32(Array(18).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0))) })) });
    expect(nrm).toContain("if (part.nrm) geo.setAttribute('normal'");
    expect(nrm).toContain('fig.cast ? __castMat(fig,');
    // (no baked rim over a body the rig rims)
    const rimmed = controllableChannelScript(ent, null, { p: fig({ cast: CAST, rim: [1, 1, 1, 0.4, 3] }) });
    expect(rimmed).toContain('if (Array.isArray(fig.rim) && !fig.cast) __rimPatch(mesh, fig.rim);');
    expect(controllableChannelScript(ent, null, { p: fig({ rim: [1, 1, 1, 0.4, 3] }) })).toContain('if (Array.isArray(fig.rim)) __rimPatch(mesh, fig.rim);');
  });
});

describe('a vehicle\'s form body under the cast rig', () => {
  // (a body in the form render: a figure's `form` and a part's; the page's script is read, never run)
  const F = { sky: { zenith: [80, 140, 220], horizon: [200, 220, 240], ground: [90, 80, 70] }, key: [1, 0.95, 0.85], keyIntensity: 2.6, ambient: 0.55, materials: { paint: { roughness: 0.3 } } };
  const car = { c: { rig: true, form: F, bones: [{ id: 'body', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [{ pos: f32(SOUP), col: u8(COL), faces: 2, form: { q: 'AA==', nrm: 'AA==', col: 'AA==', idx: 'AA==', n: 1, o: [0, 0, 0], s: [1, 1, 1], groups: [[0, 3, 0]], mats: ['paint'] } }], clips: { forward: clip } } };
  const drive = [{ id: 'car', pilotable: true, body: { type: 'figure-rig', figure: 'c' }, rule: { type: 'drive' }, transform: { pos: [0, 0, 0], heading: 0 } }];

  it('its sky over its ground is the body\'s own: no sky light joins the scene, on any page', () => {
    for (const opts of [{}, { formLand: true }]) {
      const js = controllableChannelScript(drive, null, car, opts);
      expect(js).toContain('const castKit = ');
      expect(js).toContain('castKit.patch(m, __formRig(F)');
      expect(js).not.toContain('new THREE.HemisphereLight');
      expect(js.match(/const castKit = /g).length).toBe(1);
    }
  });

  it('on a form page it asks for no light and no curve of its own: the land\'s sun lights it, the renderer tones it', () => {
    const land = controllableChannelScript(drive, null, car, { formLand: true }), paint = controllableChannelScript(drive, null, car);
    const lights = (js) => js.slice(js.indexOf('function __formLights(F)'), js.indexOf('// how much of the sky each slot throws back'));
    expect(lights(land)).not.toContain('DirectionalLight');
    expect(lights(land)).not.toContain('setTimeout');
    expect(land).toContain('m.userData.cast = true;');
    // (over a painted world: the page's casters take the key, and the body tones itself)
    expect(lights(paint)).toContain('l.intensity = F.keyIntensity / casters.length');
    expect(paint).toContain('2.51 * x + 0.03');
    expect(paint).not.toContain('m.userData.cast = true;');
  });

  it('a cast figure beside it shares the one kit', () => {
    const both = controllableChannelScript([...drive, ent[0]], null, { ...car, p: fig({ cast: CAST }) });
    expect(both.match(/const castKit = /g).length).toBe(1);
    expect(both).toContain('function __castMat(fig, o)');
  });

  // THE LIGHT OF WHERE A BODY STANDS (`place`: a land's buildings' rooms and floods): each body its own set of the
  // rig's uniforms, eased each frame toward its place's light; a page with no place carries none of it
  it('a page with places lights each body by where it stands; without, the figure\'s one rig as it was', () => {
    const PLACE = { rooms: [{ min: [0, 0, 0], max: [4, 4, 3], sky: [1, 1, 1], ground: [0.4, 0.4, 0.4] }] };
    const lit = controllableChannelScript(ent, null, { p: fig({ cast: CAST }) }), placed = controllableChannelScript(ent, null, { p: fig({ cast: CAST }) }, { place: PLACE });
    expect(lit).not.toContain('__placeStep');
    expect(lit).not.toContain('__castNow');
    expect(placed).toContain('function __placeStep(dt)');
    expect(placed).toContain('__placeStep(dt);');
    expect(placed).toContain(JSON.stringify(PLACE));
    expect(() => new Function(placed.replace(/\bimport\b/g, '__imp'))).not.toThrow();
  });
});
