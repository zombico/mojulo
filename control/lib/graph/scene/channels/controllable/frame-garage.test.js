import { describe, it, expect } from 'vitest';
import { frameGarageSpec, frameGarageScript } from './frame-garage.js';

// THE HANGAR (frame-garage.js): the frame fitted before it goes out, on mana-ui over the held level. One case per
// concept: its words are mana-ui's campaign idioms and nothing else; its code is one block the page can parse.
describe('the hangar', () => {
  it('draws its slots, a slot\'s parts and the frame\'s sheet with the campaign idioms alone', () => {
    const S = frameGarageSpec();
    expect(Object.keys(S.defs).sort()).toEqual(['garage-parts', 'garage-slots', 'machine-sheet']);
    expect(S.screens.slots.props.sortie).toEqual({ emit: 'garage:sortie' });
  });

  it('is one block the page can parse, holding the level and keeping the build in the save as it goes out', () => {
    const src = frameGarageScript({ owned: ['cr-prow'] });
    expect(() => new Function(src)).not.toThrow();
    // (held on the pause sidecar the shell's pause uses; the build kept as the hangar's flags; the bay taken down)
    for (const k of ['window.__mojMenuOpen = on', 'K.flagsOfBuild(', '__frameRefit(build)', 'scene.remove(bay)']) expect(src).toContain(k);
  });
});
