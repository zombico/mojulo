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
});
