import { describe, it, expect } from 'vitest';
import { controllableChannelScript, distortViewScript } from './index.js';
import { blockMatter, PLASTIC_IDS } from '../../../rupa/matter.js';

const hero = [{ id: 'hero', kind: 'walker', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} }];
const blocks = (matter) => [{ id: 'b', min: [0, 0, 0], max: [1, 1, 1], hp: 1, ...blockMatter({ min: [0, 0, 0], max: [1, 1, 1] }, matter) }];
const page = (matter, rupa = {}) => controllableChannelScript(hero, null, {}, { breakables: blocks(matter), breakPieces: {}, ...(rupa ? { rupa } : {}) });

describe('distortion on the page: drawn only where matter can take it', () => {
  it('a page whose blocks have no yield keeps its bytes; one with a plastic block draws its dents', () => {
    expect(page('brick')).not.toContain('__updateDents');
    const html = page(PLASTIC_IDS[0]);
    expect(html).toContain('__updateDents();');
    expect(html).toContain(distortViewScript());
    expect(html).toContain("br.how !== 'strip' && br.how !== 'cut'");   // a stripped plate falls whole, a cut block parts
    expect(page(PLASTIC_IDS[0], null)).not.toContain('__updateDents');   // and never without the physics
  });

  it('the view script parses, and a cuttable block that is not plastic draws its cuts too', () => {
    expect(() => new Function('THREE', 'scene', 'meshes', '__world', '__breakPieces', distortViewScript())).not.toThrow();
    expect(page('timber')).toContain('__updateDents();');
  });
});
