import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from '../scene-three.js';
import { rigPreviewChannelScript } from './rig-preview.js';

// a minimal packed rig figure (rig-bake / packLayeredRig shape): one bone, one part, one two-key clip
const fig = { rig: true, bones: [{ id: 'root', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [{ pos: 'AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', col: 'AAAAAAAAAAAAAAAA', faces: 1 }], clips: { bob: { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1] } }, figH: 1 };
const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]], fill: '#888', group: 'body' }];
const base = { faces, cameras: [{ position: [3, -3, 2], target: [0, 0, 0.5] }], title: 't' };

describe('rig preview channel', () => {
  it('is emitted only for a packed figure carrying `preview`; a page without one is byte-identical to a page without figures', () => {
    const plain = emitThreeWorld({ ...base });
    const bankOnly = emitThreeWorld({ ...base, figures: { body: fig } });
    expect(bankOnly).toBe(plain);
    const previewed = emitThreeWorld({ ...base, figures: { body: { ...fig, preview: { clips: ['bob'], hide: 'body', period: 2 } } } });
    expect(previewed).not.toBe(plain);
    expect(previewed).toContain('rig preview channel'); expect(previewed).toContain('stepRigPreview(t);'); expect(previewed).toContain('window.__mojRigPreview');
    expect(previewed).toContain('"figure":"body"'); expect(previewed).toContain('"hide":"body"');
    expect(previewed.split('"clips":{"bob"').length - 1).toBe(1);   // the bank carries the figure once
    expect(previewed).not.toContain('"preview":');   // the bank entry sheds its preview key
  });
  it('the block builds the rig, hides the embodied group, honours ?clip=, and composes one matrix per bone', () => {
    const js = rigPreviewChannelScript([{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }], { body: fig });
    for (const needle of ['__rpBuild(fig)', "get('clip')", 'userData.g === pv.hide', 'mesh.matrix.compose(__rpv, __rpq, __rpONE)', "createElement('select')", 'rest (the solid)']) expect(js).toContain(needle);
    expect(rigPreviewChannelScript([{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }], { body: fig })).toBe(js);
  });
  it('rim (shader-look phase 4): a rim-less bank emits zero rim bytes; a rim figure gets the fresnel patch on its parts', () => {
    const pv = [{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }];
    const plain = rigPreviewChannelScript(pv, { body: fig });
    expect(plain).not.toContain('__rpRim');
    expect(plain).not.toContain('uRim');
    const rimmed = rigPreviewChannelScript(pv, { body: { ...fig, rim: [0.4, 0.6, 1, 0.5, 3] } });
    for (const needle of ['__rpRim = (m, rim)', 'uniforms.uRim', 'uRimP', 'dithering_fragment', '__rpRim(mesh, fig.rim)']) expect(rimmed).toContain(needle);
    // the world page: a layered figure whose payload carries rim emits the patch; without, byte-identical
    const withRim = emitThreeWorld({ ...base, figures: { body: { ...fig, rim: [0.4, 0.6, 1, 0.5, 3], preview: { clips: ['bob'], hide: 'body', period: 2 } } } });
    expect(withRim).toContain('__rpRim');
  });
  it('ink: only a preview carrying `ink` on a page drawing the toon ink outlines its parts and hides the static outline', () => {
    const pv = [{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }];
    const plain = rigPreviewChannelScript(pv, { body: fig });
    expect(rigPreviewChannelScript(pv, { body: fig }, { toonInk: null })).toBe(plain);
    for (const needle of ['__rpInk', '__RPINK', '__mojInk']) expect(plain).not.toContain(needle);
    const cfg = { color: '#101015', width: 0.008, widthAbs: 0.0024, crease: 35, lines: false };
    const inked = rigPreviewChannelScript([{ ...pv[0], ink: true }], { body: fig }, { toonInk: cfg });
    for (const needle of ['function __rpInk(mesh, part, fig)', 'part.inkFaces * 9', '__inkGeoNormals(pos)', "if (fig.__rpInk && typeof __inkBuild === 'function') __rpInk(mesh, part, fig);", 'window.__mojInk.reg[pv.hide]', 'hidden.push(e.hull, e.lines)']) expect(inked).toContain(needle);
    expect(inked).not.toContain('mesh.add(e.lines)');   // silhouette only
    expect(rigPreviewChannelScript([{ ...pv[0], ink: true }], { body: fig }, { toonInk: { ...cfg, lines: undefined } })).toContain('mesh.add(e.hull); mesh.add(e.lines);');
    // the world page: the ink block needs both the preview's `ink` and the page's toon ink
    const figs = (ink) => ({ body: { ...fig, preview: { clips: ['bob'], hide: 'body', period: 2, ...(ink ? { ink: true } : {}) } } });
    expect(emitThreeWorld({ ...base, figures: figs(true), toon: { ink: { lines: false, widthAbs: 0.0024 } } })).toContain('__rpInk(mesh, part, fig);');
    expect(emitThreeWorld({ ...base, figures: figs(false), toon: { ink: true } })).not.toContain('__rpInk');
    expect(emitThreeWorld({ ...base, figures: figs(true) })).not.toContain('__rpInk');
  });
  it('stand: a preview whose static solid is the figure standing in its gesture opens on the solid; any other keeps its text', () => {
    const pv = [{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }];
    const plain = rigPreviewChannelScript(pv, { body: fig });
    expect(plain).not.toContain('pv.solid'); expect(plain).toContain("(__rpParam === 'rest' ? null : names[0] || null)"); expect(plain).toContain("n === 'rest' ? 'rest (the solid)' : 'clip: ' + n");
    const stand = rigPreviewChannelScript([{ ...pv[0], solid: 'stand' }], { body: fig });
    expect(stand).toContain("(__rpParam === 'rest' || pv.solid === 'stand' ? null : names[0] || null)");
    expect(stand).toContain("n === 'rest' ? (pv.solid === 'stand' ? 'stand (the solid)' : 'rest (the solid)') : 'clip: ' + n");
    // nothing else moves: the two interpolations and the preview's own field are the whole difference
    expect(stand.replace(',"solid":"stand"', '').replace(" || pv.solid === 'stand'", '').replace("(pv.solid === 'stand' ? 'stand (the solid)' : 'rest (the solid)')", "'rest (the solid)'")).toBe(plain);
  });
  it('draw layers: only a page drawing them builds the layered parts, the per-layer outlines and the `<hide>:*` hiding', () => {
    const pv = [{ figure: 'body', clips: ['bob'], hide: 'body', period: 2, ink: true }];
    const cfg = { color: '#101015', width: 0.008, widthAbs: 0.0024, crease: 35, lines: false };
    for (const opts of [{}, { toonInk: cfg }]) expect(rigPreviewChannelScript(pv, { body: fig }, { ...opts, layers: false })).toBe(rigPreviewChannelScript(pv, { body: fig }, opts));
    const plain = rigPreviewChannelScript(pv, { body: fig }, { toonInk: cfg });
    for (const needle of ['__rpLayer', '__layerFill', '__layerHull', "startsWith(pv.hide + ':')"]) expect(plain).not.toContain(needle);
    const layered = rigPreviewChannelScript(pv, { body: fig }, { toonInk: cfg, layers: true });
    for (const needle of ['function __rpLayer(mesh, part, fig)', '__rpLayer(mesh, part, fig);', "if (typeof __layerFill !== 'function') return;", '__layerFill(mesh.material, null);',
      'g.setDrawRange(a * 3, (b - a) * 3);', "span(R.through[0], R.through[1], 'through');", 'mesh.geometry.setDrawRange(0, Math.min(n, R.hair ? R.hair[0] : n, R.veil ? R.veil[0] : n) * 3);',
      'if (layer && __layerHull(e.hullMat, layer)) e.hull.renderOrder = 3;', "String(o.userData.g).startsWith(pv.hide + ':')", "if (k === pv.hide || k.startsWith(pv.hide + ':'))"]) expect(layered).toContain(needle);
    // the layered parts run after the rim and the ink (their children clone the part's material), and carry the rim themselves
    expect(layered.indexOf('__rpInk(mesh, part, fig);')).toBeLessThan(layered.indexOf('__rpLayer(mesh, part, fig);'));
    expect(rigPreviewChannelScript(pv, { body: { ...fig, rim: [0.4, 0.6, 1, 0.5, 3] } }, { layers: true })).toContain('if (Array.isArray(fig.rim)) __rpRim(c, fig.rim);');
    expect(rigPreviewChannelScript(pv, { body: fig }, { layers: true })).not.toContain('__rpRim(c, fig.rim)');
    // the world page: a previewed part carrying `ranges` alone makes the page draw the layers (the stencil buffer, the
    // layers block, the hair rule from its hair span); without ranges or a static layer, nothing of it
    const ranged = { ...fig, parts: [{ ...fig.parts[0], inkFaces: 1, ranges: { hair: [0, 1] } }], preview: { clips: ['bob'], hide: 'body', period: 2 } };
    const page = emitThreeWorld({ ...base, figures: { body: ranged } });
    for (const needle of ['stencil: true', '--- draw layers', '"hair":true', '__rpLayer(mesh, part, fig);']) expect(page).toContain(needle);
    const bare = emitThreeWorld({ ...base, figures: { body: { ...fig, preview: { clips: ['bob'], hide: 'body', period: 2 } } } });
    for (const needle of ['stencil', '--- draw layers', '__rpLayer']) expect(bare).not.toContain(needle);
  });
  it('timing: a bank clip carrying its designed duration `s` plays one cycle over it; without one, the phase line and the page as before', () => {
    const pv = [{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }];
    const plain = rigPreviewChannelScript(pv, { body: fig });
    expect(plain).toContain('const phase = (sec / r.period) % 1;'); expect(plain).not.toContain('clip.s');
    const timedFig = { ...fig, clips: { bob: { ...fig.clips.bob, s: 4 } } };
    const timed = rigPreviewChannelScript(pv, { body: timedFig });
    expect(timed).toContain('const phase = (sec / (clip.s > 0 ? clip.s : r.period)) % 1;');
    // nothing else moves: the phase line and the bank's own `s` are the whole difference
    expect(timed.replace('(clip.s > 0 ? clip.s : r.period)', 'r.period').replace(',"s":4', '')).toBe(plain);
    const page = (f) => emitThreeWorld({ ...base, figures: { body: { ...f, preview: { clips: ['bob'], hide: 'body', period: 3 } } } });
    expect(page(timedFig)).toContain('(clip.s > 0 ? clip.s : r.period)'); expect(page(fig)).not.toContain('clip.s');
  });
});
