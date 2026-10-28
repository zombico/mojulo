// The status channel on LAYER-0 foes (docs/foes.md): a look is laid on the body a foe is drawn as now, so a mode swapped
// in wears it as the one before did, and a rig body's bone meshes are given the normals a coat needs; a page with no
// layer-0 foe carries none of it, byte for byte.
import { describe, it, expect } from 'vitest';
import { statusScript } from './status-channel.js';
import { LOOKS } from '../../playscape/elements/elements.js';

const looks = { blaze: LOOKS.blaze };

describe('a status look on a layer-0 foe', () => {
  it('is rebuilt on the body the foe wears when that body changes (a mode swapped in)', () => {
    const on = statusScript(looks, [], { layer0: true });
    expect(on).toMatch(/if \(D\.body !== \(window\.__mojCtrl\.bodies && window\.__mojCtrl\.bodies\[e\.id\]\)\) \{ __elDrop\(D\); D = __elLive\[key\] = __elMake\(e, is, st\); \}/);
    expect(on).toMatch(/meshes: \[\], body \}/);
  });
  it('gives a rig body\'s bone meshes their normals, once, before a coat is laid', () => {
    expect(statusScript(looks, [], { layer0: true })).toMatch(/if \(body && body\.userData && body\.userData\.rigFig\) body\.traverse[^\n]*__elNormals\(o\.geometry\)/);
  });
  it('a page with no layer-0 foe is the channel as it was', () => {
    const off = statusScript(looks, []);
    expect(off).not.toMatch(/__elNormals|D\.body !==/);
    expect(off).toMatch(/const D = __elLive\[key\] \|\| \(__elLive\[key\] = __elMake\(e, is, st\)\);/);
  });
});
