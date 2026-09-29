// hero-swing — a swing as a hero clip: the phases counted in keys (the mecha shelf's 28 : 14 : 14 : 44), law 8 (the item's
// mass and length set the class, and the class the key count), the door (a swing word needs the hand's gear; the stand is
// the ready key, the swing its own clip), every verb solvable through the mint's rig gates on both casts at every class,
// the item clear of the head and the floor, and the chop's blade up and back at the cock, forward at the strike.
import { describe, expect, it } from 'vitest';

import { SWING_WORDS, SWING_HAND, swingKeys, swingClass } from './hero-swing.js';
import { validateRig, rigNodesAt, boneFrames, layeredClip } from './station-loft-rig.js';
import { gearMounts, gearRestPoint } from './hero-gear.js';
import { heroRecord, heroPlanOf, expandLayeredManifest, planLayered, validateHeroSpec } from '../../mcp/tools/layered.js';

const ITEM = { chop: 'sword', thrust: 'sword', rising: 'sword', cleave: 'greatsword', bash: 'shield', plant: 'staff' };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const segDist = (p, a, b) => { const ab = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])); };
/** the held item's grip and far end at a keypose, and the posed head centre */
function heldAt(R, g, pose) {
  const { nodes } = rigNodesAt(R, pose); const F = boneFrames(R, R.joints, nodes)[g.boneIndex];
  const P = (q) => { const d = sub(gearRestPoint(g, q), F.restHead); return F.m.map((r, j) => F.head[j] + dot(r, d)); };
  const head = [0, 1, 2].map((k) => (nodes.headBase[k] + nodes.headTop[k]) / 2);
  return { grip: P(g.sockets.grip.origin), end: P(g.sockets.tip?.origin || g.sockets.focal?.origin), head };
}

describe('the phases and law 8', () => {
  it('the impact at 3/7 (normal), 2/6 (light), 4/8 (heavy); the window from the cock to the end of the follow', () => {
    expect(swingKeys('chop', 'normal')).toMatchObject({ strike: 0.429, window: [0.286, 0.571] });
    expect(swingKeys('chop', 'light').strike).toBe(0.333);
    expect(swingKeys('chop', 'heavy').strike).toBe(0.5);
  });
  it('the class follows the item: a dagger is light, a greatsword heavy, a heavy sword heavy', () => {
    expect(swingClass({ item: 'dagger', share: 0.22 })).toBe('light');
    expect(swingClass({ item: 'sword', share: 0.59 })).toBe('normal');
    expect(swingClass({ item: 'greatsword', share: 0.9 })).toBe('heavy');
    expect(swingClass({ item: 'sword', mass: 1.3, share: 0.59 })).toBe('heavy');
  });
});

describe('the door', () => {
  it('a swing word needs the hand\'s gear, and says which', () => {
    expect(validateHeroSpec({ cast: 'male', gesture: 'chop' }).join()).toMatch(/gesture 'chop' swings the right hand's gear: add gear\.right/);
    expect(validateHeroSpec({ cast: 'male', gesture: ['relaxed', 'chop'] }).join()).toMatch(/stands alone/);
  });
  it('the stand is the ready key; the swing is its own clip, after the stand', () => {
    const p = heroPlanOf(heroRecord({ cast: 'male', gesture: 'chop', gear: { right: { item: 'dagger' } } }));
    const names = Object.keys(p.clips); expect(names.slice(0, 2)).toEqual(['gesture', 'chop']);
    expect(p.clips.chop.length).toBe(5);   // a dagger swings light
    expect(p.clips.gesture[0]).toEqual(p.clips.chop[0]);
  });
});

describe('every verb, both casts, every class', () => {
  for (const cast of ['male', 'female']) for (const word of SWING_WORDS) {
    it(`${cast} ${word}: solvable at mint, clear of the head and the floor`, () => {
      const hero = heroRecord({ cast, gesture: word, gear: { [SWING_HAND[word]]: { item: ITEM[word] } } });
      const m = expandLayeredManifest({ kind: 'layered', hero });
      expect(() => planLayered(m)).not.toThrow();
      const R = validateRig(m.recipe.rig); const [g] = gearMounts(hero, R);
      for (const cls of ['light', 'normal', 'heavy']) for (const k of swingKeys(word, cls).keys) {
        const h = heldAt(R, g, k);
        expect(segDist(h.head, h.grip, h.end), `${cls}`).toBeGreaterThan(0.12);
        expect(Math.min(h.grip[2], h.end[2]), `${cls}`).toBeGreaterThan(0);
      }
    });
  }
  it('no elbow over the head: every key of every swing and of the wave keeps each elbow within 10 cm of its shoulder line', () => {
    for (const cast of ['male', 'female']) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast }) }); const R = validateRig(m.recipe.rig);
      const poses = [...SWING_WORDS.flatMap((w) => ['light', 'normal', 'heavy'].flatMap((c) => swingKeys(w, c).keys)), ...m.recipe.clips.wave];
      for (const k of poses) { const { nodes } = rigNodesAt(R, k); for (const S of ['L', 'R']) expect(nodes[`elbow${S}`][2] - nodes[`shoulder${S}`][2], `${cast} ${S} ${JSON.stringify(k[`sh${S}`])}`).toBeLessThan(0.1); }
    }
  });
  // the downswing (the operator's sketch): the blade points back at the cock; through the strike and the follow the elbow
  // points to the ground (it sits below the line from the shoulder to the wrist)
  const elbowDown = (n, S) => { const sh = n[`shoulder${S}`], el = n[`elbow${S}`], wr = n[`wrist${S}`]; const sw = sub(wr, sh); const t = dot(sub(el, sh), sw) / dot(sw, sw); return el[2] - (sh[2] + sw[2] * t); };
  it('the thrust: the elbow points down through the strike and the follow, the blade driven forward', () => {
    const hero = heroRecord({ cast: 'male', gesture: 'thrust', gear: { right: { item: 'sword' } } });
    const R = validateRig(expandLayeredManifest({ kind: 'layered', hero }).recipe.rig); const [g] = gearMounts(hero, R);
    const { keys } = swingKeys('thrust', 'normal');
    for (const k of [keys[3], keys[4]]) { const { nodes } = rigNodesAt(R, k); expect(elbowDown(nodes, 'R')).toBeLessThan(-0.02); const h = heldAt(R, g, k); expect(h.end[1] - h.grip[1]).toBeGreaterThan(0.6); }
  });
  for (const [word, item, hands] of [['chop', 'sword', ['R']], ['cleave', 'greatsword', ['R', 'L']]]) {
    it(`the ${word}: the blade points back at the cock, the elbow${hands.length > 1 ? 's point' : ' points'} down through the strike and the follow`, () => {
      const hero = heroRecord({ cast: 'male', gesture: word, gear: { right: { item } } });
      const R = validateRig(expandLayeredManifest({ kind: 'layered', hero }).recipe.rig); const [g] = gearMounts(hero, R);
      const { keys } = swingKeys(word, 'normal');
      const cock = heldAt(R, g, keys[2]); expect(cock.end[1] - cock.grip[1]).toBeLessThan(-0.5);
      for (const k of [keys[3], keys[4]]) { const { nodes } = rigNodesAt(R, k); for (const S of hands) expect(elbowDown(nodes, S), `${S}`).toBeLessThan(-0.02); }
      const strike = heldAt(R, g, keys[3]); expect(strike.end[1] - strike.grip[1]).toBeGreaterThan(0.6);
    });
  }
  it('between the keys too: the unrolling downswing keeps the item clear of the head and above the floor', () => {
    for (const cast of ['male', 'female']) for (const [word, item] of [['chop', 'sword'], ['cleave', 'greatsword']]) {
      const hero = heroRecord({ cast, gesture: word, gear: { right: { item } } });
      const R = validateRig(expandLayeredManifest({ kind: 'layered', hero }).recipe.rig); const [g] = gearMounts(hero, R);
      for (const cls of ['normal', 'heavy']) { const clip = layeredClip(swingKeys(word, cls).keys, R);
        for (let i = 0; i < 64; i++) { const h = heldAt(R, g, clip(i / 64)); expect(segDist(h.head, h.grip, h.end), `${cast} ${word} ${cls} ${i}/64`).toBeGreaterThan(0.1); expect(Math.min(h.grip[2], h.end[2])).toBeGreaterThan(0); } }
    }
  });
});
