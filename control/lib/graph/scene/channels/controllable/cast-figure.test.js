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
