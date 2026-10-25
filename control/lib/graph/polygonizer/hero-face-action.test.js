// hero-face-action — the face acting an action, on its beats: the shout or the clench on the contact, the hup on the
// take-off, the lids squashed on the touch-down, a blow's wince or grit on its impact, the eyes on the target through a
// strike, drawings on twos with the eyes only at their knots, a one-shot back on the authored face and a guard on its
// held one; seeded takes that differ.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroStrike, STRIKE_NAMES } from './hero-strike.js';
import { heroJump } from './hero-jump.js';
import { heroGuard } from './hero-grip.js';
import { heroReact } from './hero-react.js';
import { FACE_FPS, FACE_TARGETS } from './anime-face-rig.js';
import { actionFace, actionBeats, actionFaceTrack, onKnots, FACE_SAMPLES, MIN_HOLD } from './hero-face-action.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime' }) }).recipe.rig);
const SEEDS = Array.from({ length: 24 }, (_, i) => i);
const NEUTRAL = { blink: 0, smile: 0, open: 0, brow: 0 };
const same = (a, b) => ['blink', 'smile', 'open', 'brow'].every((k) => a[k] === b[k]);
const mouthBrow = (f) => `${f.smile}|${f.open}|${f.brow}`;
const STRIKES_R = Object.fromEntries(STRIKE_NAMES.filter((n) => !n.endsWith('Left')).map((n) => [n, heroStrike(n, R)]));
const JUMPS_R = Object.fromEntries(['jump', 'jumpBack', 'doubleJump', 'rollForward'].map((n) => [n, heroJump(n, R)]));
const GUARDS_R = { chudan: heroGuard('chudan', R), challenge: heroGuard('challenge', R) };
const frameOf = (s) => Math.round(s * FACE_FPS);

/** the laws every take keeps */
function common(x, { oneShot = true, authored = NEUTRAL } = {}) {
  expect(x.faces).toHaveLength(x.frames);
  expect(onKnots(x), 'every eye drawn at a knot').toBe(true);
  for (const f of x.faces) { expect(f.smile).toBeGreaterThanOrEqual(0); expect(f.smile).toBeLessThanOrEqual(1); expect(f.open).toBeGreaterThanOrEqual(0); expect(f.open).toBeLessThanOrEqual(1); expect(Math.abs(f.brow)).toBeLessThanOrEqual(1); }
  expect(same(x.faces[0], { ...NEUTRAL, ...authored }), 'starts on the authored face').toBe(true);
  if (oneShot) expect(same(x.faces.at(-1), { ...NEUTRAL, ...authored }), 'a one-shot ends back on it').toBe(true);
  // the mouth and the brows change on twos (frame 0 is the face the clip takes over)
  const changes = x.faces.map((f, i) => (i > 0 && mouthBrow(f) !== mouthBrow(x.faces[i - 1]) ? i : -1)).filter((i) => i > 0);
  for (let i = 1; i < changes.length; i++) expect(changes[i] - changes[i - 1], `${x.name} ${x.sample} seed ${x.seed}: a drawing held under two frames`).toBeGreaterThanOrEqual(MIN_HOLD);
  // the drawings are where the face changes
  for (const d of x.drawings) expect(d.frame === 0 || !same(x.faces[d.frame], x.faces[d.frame - 1])).toBe(true);
}
/** the anchor drawn at a beat is on screen at it, having started at most `early` frames before it */
const onBeat = (x, beat, early = 2) => {
  const d = x.drawings.findLast((o) => o.beat === beat), F = frameOf(x.beats[beat]);
  expect(d, `${x.name} ${x.sample} seed ${x.seed}: no ${beat} drawing`).toBeTruthy();
  expect(F - d.frame).toBeGreaterThanOrEqual(0); expect(F - d.frame).toBeLessThanOrEqual(early);
  expect(mouthBrow(x.faces[Math.min(F, x.frames - 1)]), `${beat} on screen at its beat`).toBe(mouthBrow(d.face));
};

describe('hero-face-action', () => {
  for (const [name, a] of Object.entries(STRIKES_R)) {
    it(`${name}: the shout or the clench on the contact, the eyes on the target, back on the face`, () => {
      const L = frameOf(a.contact.t);
      for (const seed of SEEDS) {
        const x = actionFace(a, { seed }); common(x); onBeat(x, 'contact');
        const lo = frameOf(actionBeats(a).beats.load), hi = frameOf(actionBeats(a).beats.follow);
        for (let f = lo; f <= hi; f++) expect(x.faces[f].blink, `${name} seed ${seed} frame ${f}: an eye shut through the strike`).toBeLessThanOrEqual(0.5);
        expect(x.faces[L].brow, 'the brows are set at the contact (a flinch\'s too)').toBeGreaterThan(0.3);
      }
    });
  }
  it('a jump says its hup on the take-off and squashes its lids on the touch-down; a double jump pushes again', () => {
    for (const [name, a] of Object.entries(JUMPS_R)) for (const seed of SEEDS) {
      const x = actionFace(a, { seed, name }); common(x);
      if (x.family === 'roll') { onBeat(x, 'end', 2); continue; }
      onBeat(x, 'takeoff'); onBeat(x, 'land', 1);
      if (x.sample !== 'joy') expect(x.faces[frameOf(x.beats.land)].blink, 'the lids squash on the touch-down').toBe(0.5);
      if (name === 'doubleJump' && x.sample === 'effort') { onBeat(x, 'kick'); expect(x.faces[frameOf(x.beats.kick)].open).toBeGreaterThan(0.5); }
    }
  });
  it('a roll that tucks shuts its eyes through the tumble and opens them coming up', () => {
    const a = JUMPS_R.rollForward, x = actionFace(a, { seed: 0, sample: 'tuck', name: 'rollForward' });
    const b = actionBeats(a, { name: 'rollForward' }).beats;
    const shut = x.drawings.find((d) => d.beat === 'start' && d.frame > 0).frame, up = x.drawings.findLast((d) => d.beat === 'end').frame;
    expect(shut).toBeLessThanOrEqual(frameOf(b.start)); expect(up).toBeLessThanOrEqual(frameOf(b.end));
    for (let f = shut; f < up - 2; f++) expect(x.faces[f].blink).toBe(1);   // then the half lid and 0.20, opening
    expect(x.faces[up].blink).toBeLessThan(0.5);
  });
  it('a blow taken answers its impact a frame after it lands, the lids squeezed to the half lid at most, and gives back', () => {
    for (const name of ['hitHigh', 'stagger']) {
      const { act } = heroReact(name, R), hit = frameOf(act.action.beats.impact), back = frameOf(act.action.beats.hold);
      for (const seed of SEEDS) {
        const x = actionFace(act.action, { seed }); common(x);
        const d = x.drawings.find((o) => o.beat === 'impact');
        expect(d.frame - hit, `${name} seed ${seed}: the face after the blow`).toBeGreaterThanOrEqual(0); expect(d.frame - hit).toBeLessThanOrEqual(1);
        expect(Math.abs(d.face.brow), 'the brows answer it').toBeGreaterThan(0.4);
        for (let f = 0; f <= back; f++) expect(x.faces[f].blink, 'the eyes stay on the threat').toBeLessThanOrEqual(0.5);
      }
    }
  });
  it('a guard is taken up with its face and holds it; the regime leans the take (a weightless guard smirks more)', () => {
    for (const [name, a] of Object.entries(GUARDS_R)) for (const seed of SEEDS) {
      const x = actionFace(a, { seed }); common(x, { oneShot: false });
      expect(same(x.hold, NEUTRAL), `${name} seed ${seed}: the guard holds a face of its own`).toBe(false);
      expect(x.hold.blink, 'its eyes open on the held guard').toBeLessThan(0.5);
    }
    const count = (a, s) => SEEDS.filter((seed) => actionFace(a, { seed }).sample === s).length;
    expect(count(GUARDS_R.challenge, 'smirk')).toBeGreaterThan(count(GUARDS_R.chudan, 'smirk'));
  });
  it('takes differ: the seed picks among the samples and shifts their frames and channels; the same seed is the same take', () => {
    const a = STRIKES_R.cross, takes = SEEDS.map((seed) => actionFace(a, { seed }));
    expect(new Set(takes.map((x) => x.sample)).size).toBeGreaterThanOrEqual(3);
    const kiai = SEEDS.map((seed) => actionFace(a, { seed, sample: 'kiai' }));
    expect(new Set(kiai.map((x) => JSON.stringify(x.drawings))).size).toBeGreaterThan(SEEDS.length / 2);
    expect(actionFace(a, { seed: 7 })).toEqual(actionFace(a, { seed: 7 }));
    expect(actionFace(heroStrike('crossLeft', R), { seed: 7 }).drawings, 'a mirrored strike, the same face').toEqual(takes[7].drawings);
  });
  it('after a take, its sample is less likely again', () => {
    const a = STRIKES_R.cross, seeds = Array.from({ length: 200 }, (_, i) => i);
    const free = seeds.filter((seed) => actionFace(a, { seed }).sample === 'kiai').length;
    const again = seeds.filter((seed) => actionFace(a, { seed, after: 'kiai' }).sample === 'kiai').length;
    expect(again).toBeLessThan(free / 2);
  });
  it('the hero\'s own face is where a one-shot starts and ends', () => {
    const authored = { blink: 0.12, smile: 0.3, open: 0, brow: -0.1 };
    for (const seed of SEEDS.slice(0, 6)) common(actionFace(STRIKES_R.jab, { seed, authored }), { authored });
  });
  it('writes the face track: a key per drawing half a frame early, the weights in the targets, a last key at the end', () => {
    const x = actionFace(STRIKES_R.thrust, { seed: 3 }), T = actionFaceTrack(x);
    expect(T.t[0]).toBe(0); expect(T.t.at(-1)).toBe(x.seconds);
    for (let i = 1; i < T.t.length; i++) expect(T.t[i]).toBeGreaterThan(T.t[i - 1]);
    expect(T.w.every((w) => w.length === FACE_TARGETS.length)).toBe(true);
    expect(T.t).toHaveLength(x.drawings.length + 1);
  });
  it('names its samples; refuses an unknown sample or a thing that is not an action', () => {
    expect(Object.keys(FACE_SAMPLES)).toEqual(['strike', 'jump', 'react', 'roll', 'guard']);
    expect(() => actionFace(STRIKES_R.jab, { sample: 'yawn' })).toThrow(/no strike sample/);
    expect(() => actionFace({ seconds: 1 })).toThrow(/an action is/);
    const own = actionFace({ family: 'strike', seconds: 0.6, beats: { load: 0.1, contact: 0.3, follow: 0.36, end: 0.6 } }, { seed: 2 });
    common(own); onBeat(own, 'contact');
  });
});
