import { describe, it, expect } from 'vitest';
import { BEHAVIORS, SUPPORT, HEAD, TAIL, LOOP } from './index.js';
import { POSED, posable, poseBehavior, behaviorFrames, prepare } from './pose.js';
import { FAMILY_SPECIES } from '../families.js';
import { faunaSkeleton } from '../skeleton.js';
import { capabilitiesOf } from './capabilities.js';

// The posing contract: a posed behavior is a real pose of the species' own bones, on the ground it stands on.
const ids = Object.keys(FAMILY_SPECIES);
const len = (b) => Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
const tip = (f) => f.bones.head.tail;

describe('behavior pose: the posed words', () => {
  it('every posed word is a mechanism word', () => {
    const vocab = { support: SUPPORT, head: HEAD, tail: TAIL, loop: LOOP };
    for (const [k, words] of Object.entries(POSED)) for (const w of words) expect(vocab[k][w], `${k} '${w}'`).toBeDefined();
  });

  it('an unposed strategy says which words it is waiting for', () => {
    const p = posable('kangaroo', 'eat');   // crouch-graze: the tripod support is not posed yet
    expect(p.ok).toBe(false);
    expect(p.missing.join()).toMatch(/tripod/);
    expect(() => poseBehavior('kangaroo', 'eat')).toThrow(/not posed yet/);
  });
});

describe('behavior pose: every posable behavior is a real pose', () => {
  it('finite, every bone its own length, nothing on land through the ground', () => {
    let n = 0;
    for (const id of ids) {
      const rest = Object.fromEntries(faunaSkeleton(id).bones.map((b) => [b.id, b]));
      const swims = capabilitiesOf(id).swimmer;
      for (const b of Object.keys(BEHAVIORS)) {
        if (!posable(id, b).ok) continue;
        n++;
        for (const f of behaviorFrames(id, b, 3)) for (const [bid, q] of Object.entries(f.bones)) {
          expect([...q.head, ...q.tail].every(Number.isFinite), `${id}.${b}.${bid}`).toBe(true);
          expect(Math.abs(len(q) - len(rest[bid])), `${id}.${b}.${bid} keeps its length`).toBeLessThan(1e-6);
          if (!swims) expect(Math.min(q.head[2], q.tail[2]), `${id}.${b}.${bid} above ground`).toBeGreaterThan(-0.01);
        }
      }
    }
    expect(n).toBeGreaterThan(200);
  }, 120_000);

  it('deterministic', () => {
    expect(JSON.stringify(behaviorFrames('sheep', 'eat', 4))).toBe(JSON.stringify(behaviorFrames('sheep', 'eat', 4)));
  });
});

describe('behavior pose: the principles read on the bodies', () => {
  it('a grazer gets its muzzle to the grass, lowering its shoulders when the neck is short', () => {
    for (const id of ['sheep', 'horse', 'dairyCow']) {
      const f = poseBehavior(id, 'eat', 0), h = prepare(id).h;
      expect(tip(f)[2], `${id} muzzle`).toBeLessThan(0.03 * h);
    }
  });

  it('a lying body rests its belly on the ground; a dozing horse hangs its head', () => {
    const sheep = prepare('sheep'), lying = poseBehavior('sheep', 'relax', 0);   // cud
    expect(lying.bones.spine1.head[2]).toBeLessThan(sheep.byId.spine1.head[2] - 0.8 * sheep.belly);
    const horse = prepare('horse'), doze = poseBehavior('horse', 'relax', 0);    // doze-standing
    expect(tip(doze)[2]).toBeLessThan(0.6 * horse.byId[horse.limbs.RF[0]].head[2]);
    // the cocked hind leg is off its planted spot; the others stand where they stood
    const rest = faunaSkeleton('horse').bones.find((b) => b.id === horse.limbs.LH.at(-1)).tail;
    expect(Math.abs(doze.bones[horse.limbs.LH.at(-1)].tail[1] - rest[1])).toBeGreaterThan(0.02);
  });

  it('a perching bird stands on one foot, the other drawn up', () => {
    const c = prepare('vulture'), f = poseBehavior('vulture', 'relax', 0);
    const foot = (k) => Math.min(...c.limbs[k].map((b) => f.bones[b].tail[2]));
    expect(foot('RH')).toBeLessThan(0.02);
    expect(foot('LH')).toBeGreaterThan(0.1 * c.h);
  });

  it('a snake lies coiled on the ground; a cobra rears its front third', () => {
    const coil = poseBehavior('snake', 'relax', 0), girth = prepare('snake').girth;
    const spine = Object.entries(coil.bones).filter(([k]) => /^spine\d+$/.test(k));
    expect(Math.max(...spine.map(([, b]) => b.head[2]))).toBeLessThan(girth);
    const xs = spine.map(([, b]) => b.head[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(4 * girth);   // laid round, not straight
    const hood = poseBehavior('kingCobra', 'alert', 0);
    expect(hood.bones.head.head[2]).toBeGreaterThan(5 * prepare('kingCobra').girth);
  });

  it('sitting up: the rump on the ground, the trunk up, the hind feet flat in front; rearing stands tall', () => {
    for (const id of ['raccoon', 'squirrel', 'brownBear', 'chimpanzee', 'giantPanda']) {
      const c = prepare(id), f = poseBehavior(id, 'relax', 0);   // sit-up
      const sp = c.spine.map((b) => f.bones[b.id]), rump = Math.min(...sp.map((b) => b.head[2]), ...c.tail.slice(0, 1).map((b) => f.bones[b.id].head[2]));   // the tail's root is the rump too
      expect(rump, `${id} rump down`).toBeLessThan(0.03 * c.h);
      const a = sp[0].head, z = sp.at(-1).tail;
      expect(Math.atan2(z[2] - a[2], z[1] - a[1]), `${id} trunk up`).toBeGreaterThan(0.8);
      expect(Math.max(...c.limbs.RH.map((b) => f.bones[b].tail[2])) > 0, `${id}`).toBe(true);
    }
    const c = prepare('raccoon'), rear = poseBehavior('raccoon', 'alert', 0);
    expect(rear.bones.head.head[2]).toBeGreaterThan(1.5 * c.h);
  });

  it('eating from the hands: the hands come up to the mouth', () => {
    for (const id of ['raccoon', 'giantPanda', 'chimpanzee']) {
      const c = prepare(id), f = poseBehavior(id, 'eat', 0), m = tip(f);
      for (const k of ['RF', 'LF']) {
        const hand = f.bones[c.limbs[k][2]].head, arm = c.limbs[k].slice(0, 2).reduce((s, b) => s + len(c.byId[b]), 0);
        expect(Math.hypot(hand[0] - m[0], hand[1] - m[1], hand[2] - m[2]), `${id} ${k}`).toBeLessThan(0.6 * arm);
      }
    }
  });

  it('lying on the side: the trunk rolled onto its left flank and down, the legs out to the right', () => {
    for (const id of ['lion', 'pig', 'brownBear']) {
      const c = prepare(id), f = poseBehavior(id, 'sleep', 0);   // side-sleep
      const hip = (k) => f.bones[c.limbs[k][0]].head;
      expect(hip('RH')[2] - hip('LH')[2], `${id} right hip over left`).toBeGreaterThan(0.5 * Math.abs(c.byId[c.limbs.RH[0]].head[0]));
      expect(f.bones.spine1.head[2], `${id} down`).toBeLessThan(c.girth);
      for (const k of ['RF', 'RH']) expect(f.bones[c.limbs[k].at(-1)].tail[0], `${id} ${k} out to the side`).toBeGreaterThan(hip('RH')[0]);
    }
  });

  it('a crouch sinks the hips on planted feet', () => {
    for (const id of ['houseCat', 'wolf', 'rabbit']) {
      const c = prepare(id), f = poseBehavior(id, 'alert', 0);   // fix, freeze
      const rest = c.byId[c.limbs.RH[0]].head[2];
      expect(f.bones[c.limbs.RH[0]].head[2], id).toBeLessThan(0.8 * rest);
      const foot = c.limbs.RH.at(-1);
      expect(Math.abs(f.bones[foot].tail[1] - c.byId[foot].tail[1]), `${id} foot planted`).toBeLessThan(1e-6);
    }
  });

  it('gnawing: a lying predator works the meal between its paws, the head moving', () => {
    const fr = behaviorFrames('wolf', 'eat', 8), h = prepare('wolf').h;
    expect(posable('wolf', 'eat').strategy).toBe('gnaw');
    expect(Math.min(...fr.map((f) => tip(f)[2]))).toBeLessThan(0.15 * h);
    const xs = fr.map((f) => tip(f)[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.005);
  });

  it('a variant poses another way from the repertoire', () => {
    const curl = poseBehavior('raccoon', 'relax', 0, { variant: 'curl' }), sit = poseBehavior('raccoon', 'relax', 0);
    expect(curl.bones.head.head[2]).toBeLessThan(sit.bones.head.head[2] / 2);
  });

  it('swimming on is the species\' own swim', () => {
    expect(posable('greatWhiteShark', 'relax').strategy).toBe('cruise');
    expect(behaviorFrames('greatWhiteShark', 'relax', 4).length).toBe(4);
  });
});
