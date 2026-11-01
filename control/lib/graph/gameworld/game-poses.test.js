// game-poses: how a game's people stand when shown. The concepts: a cover strikes a showcase pose the rail and the role
// pick (the seed choosing, stably); a live demo stands the rail's stand and plays its own idle in place of the form's one
// loop; a showcase word is a stand the door takes, held at its hit; no rail leaves a live demo as it is.
import { describe, it, expect } from 'vitest';
import { gamePose, COVER_POSES, LIVE_POSES, POSE_ROLES } from './game-poses.js';
import { isShowcase, showcaseStand, validateGesture, validateHeroClips, standPose } from '../polygonizer/hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';

const mint = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm(spec)) }).recipe;

describe('the pose rails', () => {
  it('names only showcase poses on a cover, and picks one stably by the seed', () => {
    for (const C of Object.values(COVER_POSES)) for (const r of POSE_ROLES) for (const w of C[r]) expect(isShowcase(w), w).toBe(true);
    expect(gamePose('comic', 'cover', { seed: 7 })).toEqual(gamePose('comic', 'cover', { seed: 7 }));
    const seen = new Set(Array.from({ length: 12 }, (_, s) => gamePose('comic', 'cover', { seed: s }).gesture));
    expect(seen.size).toBeGreaterThan(1);
    expect(COVER_POSES.comic.hero).toContain(gamePose('comic', 'cover').gesture);
    expect(gamePose(null, 'cover').gesture).toBeTruthy();
    expect(() => gamePose('comic', 'turnaround')).toThrow(/not a context/);
  });
  it('stands a live demo in the rail\'s stand with its own idle, words the door takes; no rail leaves it as it is', () => {
    expect(gamePose(null, 'live')).toMatchObject({ gesture: null });
    for (const rail of Object.keys(LIVE_POSES)) {
      const P = gamePose(rail, 'live', { cast: 'female' });
      expect(validateGesture(P.gesture), rail).toEqual([]);
      expect(validateHeroClips(P.clips), rail).toEqual([]);
      expect(P.clips.idle.length).toBeGreaterThan(1);
      // (the idle moves: no two neighbouring keys the same)
      expect(JSON.stringify(P.clips.idle[0])).not.toBe(JSON.stringify(P.clips.idle[1]));
    }
  });
  it('plays the rail\'s idle in place of the form\'s, from the rail\'s stand, on the minted hero', () => {
    const P = gamePose('muscular', 'live', { cast: 'male' });
    const r = mint({ cast: 'male', head: 'anime', gesture: P.gesture, clips: P.clips });
    const plain = mint({ cast: 'male', head: 'anime' });
    expect(r.clips.idle).not.toEqual(plain.clips.idle);
    expect(r.clips.idle.length).toBe(P.clips.idle.length);
    const R = validateRig(r.rig);
    for (const k of r.clips.idle) expect(() => rigNodesAt(R, k)).not.toThrow();
  }, 60000);
  it('takes a showcase word as the stand, held at its hit and solved on the rig', () => {
    expect(validateGesture('heroHips')).toEqual([]);
    expect(validateGesture(['relaxed', 'heroHips'])[0]).toMatch(/stands alone/);
    const r = mint({ cast: 'female', head: 'anime', gesture: 'heroHips' });
    const R = validateRig(r.rig);
    expect(standPose(r, R)).toBeNull();
    const pose = showcaseStand({ gesture: 'heroHips' }, R);
    const { nodes } = rigNodesAt(R, pose), rest = rigNodesAt(R, {}).nodes;
    // (the hands come up to the hips: each wrist nearer its hip than at rest)
    const d = (n, a, b) => Math.hypot(n[a][0] - n[b][0], n[a][1] - n[b][1], n[a][2] - n[b][2]);
    for (const S of ['L', 'R']) expect(d(nodes, `wrist${S}`, `hip${S}`)).toBeLessThan(d(rest, `wrist${S}`, `hip${S}`));
    expect(showcaseStand({ gesture: 'relaxed' }, R)).toBeNull();
  }, 60000);
});
