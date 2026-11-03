import { describe, it, expect } from 'vitest';
import { controllableChannelScript, scarsViewScript } from './index.js';
import { readScarsSpec } from '../../../rupa/index.js';

const hero = [{ id: 'hero', kind: 'walker', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} }];
const page = (rupa) => controllableChannelScript(hero, null, {}, rupa ? { rupa } : {});

describe('scars on the page: painted only when the world is scarred', () => {
  it('a page without scars keeps its bytes; a scarred one paints its marks each step and wakes the runtime', () => {
    expect(page(null)).not.toContain('__updateScars');
    expect(page({})).not.toContain('__updateScars');   // matter alone, no blocks: no physics on the page either
    const html = page({ scars: readScarsSpec(true) });
    expect(html).toContain('__updateScars(dt);');
    expect(html).toContain(scarsViewScript());
    expect(html).toContain('"scars"');
  });

  it('the view script parses', () => {
    expect(() => new Function('THREE', 'scene', '__world', '__clashRng', 'document', scarsViewScript())).not.toThrow();
  });
});
