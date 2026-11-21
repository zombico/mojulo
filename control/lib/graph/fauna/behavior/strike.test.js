// strike — the blow a beast deals, built from its own posed body: a body on legs crouches (the telegraph) and springs
// forward out of it, a legless one rears into its coil and darts; both come home to the stand. The hit lands where the
// clip shows the blow, and an animal without the strike builds as it always did.
import { describe, it, expect } from 'vitest';
import { strikesOf, strikeFrames, strikeTiming, strikeSeconds, strikeWindow, STRIKE_TIMING, STRIKE_WAYS, WAY_TIMING, strikeWaysOf } from './strike.js';
import { withMotion, packFaunaRig } from '../rig.js';
import { speciesPlan } from '../species.js';
import { motionSpec } from '../../../mcp/tools/animal.js';

const snout = (f) => f.bones.head.tail;
const BRUTE = { startup: 48, active: 8, recovery: 36 };

describe('a beast deals a blow', () => {
  it('on legs or legless on the ground it can strike; a swimmer cannot yet', () => {
    expect(strikesOf('wolf')).toEqual(['strike']);
    expect(strikesOf('snake')).toEqual(['strike']);
    expect(strikesOf('salmon')).toEqual([]);
    expect(() => strikeFrames('salmon')).toThrow(/cannot strike/);
  });

  it('its timing is the attack\'s, and the blow\'s window is its active frames', () => {
    expect(strikeTiming()).toEqual(STRIKE_TIMING);
    expect(strikeSeconds(BRUTE)).toBeCloseTo(92 / 60, 3);
    expect(strikeWindow(BRUTE)).toEqual([0.5217, 0.6087]);
    expect(() => strikeTiming({ startup: 0 })).toThrow(/whole frames/);
  });

  it('a body on legs crouches and draws back, head down, then springs forward of its stand; it comes home', () => {
    const F = strikeFrames('wolf', BRUTE, 93), [from, to] = strikeWindow(BRUTE), at = (u) => F[Math.round(u * 92)];
    expect(JSON.stringify(F[0])).toBe(JSON.stringify(F.at(-1)));
    const windup = at(from - 0.01), blow = at((from + to) / 2);
    expect(snout(windup)[2]).toBeLessThan(snout(F[0])[2]);   // gathered low: the telegraph
    expect(snout(windup)[1]).toBeLessThan(snout(F[0])[1]);   // drawn back: the anticipation
    expect(snout(blow)[1]).toBeGreaterThan(snout(F[0])[1] + 0.1);   // thrown at the mark
    expect(JSON.stringify(strikeFrames('wolf', BRUTE, 93))).toBe(JSON.stringify(F));   // deterministic
  });

  it('a legless body rears into its coil and darts the way its head points', () => {
    const F = strikeFrames('snake', undefined, 55), [from, to] = strikeWindow(), at = (u) => F[Math.round(u * 54)];
    const windup = at(from - 0.01), blow = at((from + to) / 2);
    expect(snout(windup)[2]).toBeGreaterThan(snout(F[0])[2]);   // reared
    expect(Math.hypot(snout(blow)[0] - snout(windup)[0], snout(blow)[1] - snout(windup)[1])).toBeGreaterThan(0.05);   // darted
  });

  it('an animal\'s motion takes it, as a word or at its attack\'s timing; absent, the rig is untouched', () => {
    expect(motionSpec('wolf', ['walk', 'strike'])).toMatchObject({ gaits: ['walk'], strike: true });
    expect(motionSpec('wolf', { strike: BRUTE })).toMatchObject({ gaits: [], strike: BRUTE });
    expect(motionSpec('wolf', ['walk'])).not.toHaveProperty('strike');
    expect(() => motionSpec('salmon', 'strike')).toThrow(/cannot strike/);
    expect(() => motionSpec('wolf', { strike: { wind: 3 } })).toThrow(/startup/);
    const plain = withMotion(speciesPlan('wolf'), 'wolf', ['walk']), armed = withMotion(speciesPlan('wolf'), 'wolf', ['walk'], 24, { strike: BRUTE });
    expect(plain.motion).not.toHaveProperty('strike');
    expect(armed.motion.strike).toEqual(BRUTE);
    expect({ ...armed.motion, strike: undefined }).toEqual({ ...plain.motion, strike: undefined });
  });
});

// THE WAYS AT A FOE: a party battle's beast does not deal one blow over and over. Beside the lunge it snaps (quick,
// barely gathered), mauls (reared up and brought down, the heavy one) and roars (up tall, the head high, held, no
// reach), each a clip of its own name at its own timing; a legless body has no maul; the lunge is as it always was.
describe('a beast\'s ways at a foe', () => {
  const ways = ['strike', 'snap', 'maul', 'roar', 'channel'];
  it('a body on legs has every way, a legless one no maul, one that cannot strike none', () => {
    expect(STRIKE_WAYS).toEqual(ways);
    expect(strikeWaysOf('wolf')).toEqual(ways);
    expect(strikeWaysOf('snake')).toEqual(['strike', 'snap', 'roar', 'channel']);
    expect(strikeWaysOf('salmon')).toEqual([]);
    expect(() => strikeFrames('snake', undefined, 24, 'maul')).toThrow(/has no maul/);
    expect(() => strikeFrames('wolf', undefined, 24, 'kick')).toThrow(/no way 'kick'/);
  });

  it('each way its own pose and pace: the snap quick and short, the maul reared high then low and far, the roar up and held', () => {
    expect(strikeSeconds(undefined, 'snap')).toBeLessThan(strikeSeconds());
    expect(strikeSeconds(undefined, 'maul')).toBeGreaterThan(strikeSeconds());
    const go = (w) => { const F = strikeFrames('wolf', undefined, 93, w), [a, b] = strikeWindow(undefined, w), at = (u) => F[Math.round(u * 92)]; return { F, wind: snout(at(a - 0.01)), blow: snout(at((a + b) / 2)), stand: snout(F[0]) }; };
    const lunge = go('strike'), snap = go('snap'), maul = go('maul'), roar = go('roar'), channel = go('channel');
    // (the channel: hunkered low, the head down and still, no reach, held longest)
    expect(channel.blow[2]).toBeLessThan(channel.stand[2] - 0.2);
    expect(channel.blow[1]).toBeLessThanOrEqual(channel.stand[1]);
    expect(strikeSeconds(undefined, 'channel')).toBeGreaterThan(strikeSeconds(undefined, 'roar'));
    for (const W of [snap, maul, roar, channel]) expect(JSON.stringify(W.F[0])).toBe(JSON.stringify(W.F.at(-1)));
    expect(snap.blow[1] - snap.stand[1]).toBeGreaterThan(0.1);
    expect(snap.blow[1] - snap.stand[1]).toBeLessThan(lunge.blow[1] - lunge.stand[1]);
    expect(maul.wind[2]).toBeGreaterThan(maul.stand[2] + 0.2);   // reared
    expect(maul.blow[2]).toBeLessThan(maul.stand[2]);   // brought down
    expect(maul.blow[1] - maul.stand[1]).toBeGreaterThan(0.1);
    expect(roar.blow[2]).toBeGreaterThan(roar.stand[2]);   // head up
    expect(Math.abs(roar.blow[1] - roar.stand[1])).toBeLessThan(0.1);   // no reach
    expect(strikeWindow(undefined, 'roar')[1] - strikeWindow(undefined, 'roar')[0]).toBeGreaterThan(0.5);   // held
    // (the lunge is the strike as it always was)
    expect(JSON.stringify(strikeFrames('wolf', BRUTE, 24, 'strike'))).toBe(JSON.stringify(strikeFrames('wolf', BRUTE, 24)));
  });

  it('an animal\'s motion takes them, as words or at their timing, each a clip of its name; absent, the rig is untouched', () => {
    expect(motionSpec('wolf', ['strike', 'snap', 'roar'])).toMatchObject({ gaits: [], strike: true, strikes: { snap: true, roar: true } });
    expect(motionSpec('wolf', { strikes: { maul: { startup: 50 } } }).strikes.maul).toEqual({ ...WAY_TIMING.maul, startup: 50 });
    expect(() => motionSpec('snake', { strikes: { maul: true } })).toThrow(/has no maul/);
    expect(() => motionSpec('wolf', { strikes: { kick: true } })).toThrow(/no way 'kick'/);
    const plain = withMotion(speciesPlan('wolf'), 'wolf', ['walk'], 24, { strike: true }), more = withMotion(speciesPlan('wolf'), 'wolf', ['walk'], 24, { strike: true, strikes: { snap: true, maul: true } });
    expect(plain.motion).not.toHaveProperty('strikes');
    expect(more.motion.strikes).toEqual({ snap: true, maul: true });
    expect({ ...more.motion, strikes: undefined }).toEqual({ ...plain.motion, strikes: undefined });
    expect(() => withMotion(speciesPlan('snake'), 'snake', [], 24, { strike: true, strikes: { maul: true } })).toThrow(/has no maul/);
  });
});
