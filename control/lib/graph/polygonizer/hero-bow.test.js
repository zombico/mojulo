// hero-bow — the bow's shots on a real hero rig: the stance side on, the arrow from the anchor at the mouth's corner to
// the mark, the bow hand round its grip, the drawing arm by the archer's rule, the string clear of the bow arm, a draw
// the bow can take; the loose lets go and comes back to the ready.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroBow, BOW_SHOT_NAMES } from './hero-bow.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime' }) }).recipe.rig);
const allTrue = (laws) => Object.fromEntries(Object.keys(laws).map((k) => [k, true]));

describe('hero-bow', () => {
  it('the draw: every law at the anchor, the arrow on the mark, the bow riding the bow hand', () => {
    const b = heroBow('bowDraw', R);
    expect(b.checks.laws, JSON.stringify(b.checks)).toEqual(allTrue(b.checks.laws));
    expect(b.checks.arrow).toBeLessThan(1.5);
    expect(b.mounts).toHaveLength(1); expect(b.mounts[0].bone).toBe('handL');
    // the nock travels back from brace to the anchor along the arrow, and the clip ends holding at the anchor
    expect(b.drawLength).toBeGreaterThan(0.35);
    expect(b.clip.fn(1)).toEqual(b.hold);
    for (let k = 0; k <= 8; k++) expect(() => rigNodesAt(R, b.clip.fn(k / 8))).not.toThrow();
  }, 180000);
  it('the loose starts at the anchor and ends at the ready, the fingers opening on the way', () => {
    const [draw, loose] = BOW_SHOT_NAMES.map((n) => heroBow(n, R));
    expect(loose.keys[0].pose).toEqual(draw.keys.at(-1).pose);
    expect(loose.keys[1].pose.fingersR).not.toEqual(loose.keys[0].pose.fingersR);
    expect(() => heroBow('bowFoo', R)).toThrow(/bowDraw, bowLoose/);
  }, 180000);
});
