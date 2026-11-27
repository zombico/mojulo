// The fix sites (fix-sites.js): what a level's infra requests show and press. The laws: each request's spots keyed to
// their flags, its hold and its taps, its words; none where a level has no request; the page's script parses.
import { describe, it, expect } from 'vitest';
import { fixSitesOf, fixSitesScript } from './fix-sites.js';

const REQ = { kind: 'request', id: 'fence', job: 'fence', name: 'the fence', where: 'the building site', spots: [{ at: [1, 2, 3], N: [0, -1] }, { at: [4, 2, 3], N: [0, -1] }], material: { item: 'fence-panel', name: 'stack of fence panels' }, after: 'took-fence', fix: { hold: { verb: 'lift the panel', secs: 1.5 }, tap: { verb: 'nail it', n: 4 } } };

describe('the fix sites', () => {
  it('each request\'s spots keyed to their flags, its hold, its taps, its words; none without one', () => {
    const F = fixSitesOf({ game: { mechanics: [REQ] } });
    expect(F.requests[0]).toEqual({ id: 'fence', job: 'fence', spots: [{ at: [1, 2, 3], N: [0, -1] }, { at: [4, 2, 3], N: [0, -1] }],
      vars: { took: 'flag-took-fence', picked: 'flag-picked-fence', done: 'flag-done-fence', fixed: ['flag-fixed-fence-1', 'flag-fixed-fence-2'] },
      hold: { verb: 'lift the panel', secs: 1.5 }, tap: { verb: 'nail it', n: 4 }, words: { name: 'the fence', material: 'stack of fence panels', where: 'the building site' } });
    expect(fixSitesOf({ game: { mechanics: [{ kind: 'bag', slice: 'bag' }] } })).toBe(null);
    expect(() => new Function('THREE', 'scene', 'wrap', fixSitesScript(F))).not.toThrow();
  });
});
