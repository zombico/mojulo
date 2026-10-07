import { describe, it, expect } from 'vitest';
import { BUG_SPECIES, bugParams, buildBug } from './species.js';
import { bugSkeleton } from './skeleton.js';
import { prepareBug, gaitPose, bugGaitFrames } from './gait.js';
import { withBugMotion, bugBones, packBugRig, bugMotionGaits } from './rig.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered, resolveLayeredDials } from '../polygonizer/station-loft.js';
import { bindLayered } from '../polygonizer/station-loft-rig.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

// the foot point of a leg in a posed frame (its tarsus bone carried to the rest foot)
const footAt = (ctx, leg, f) => { const b = f.bones[leg.ids[3]], r = ctx.by[leg.ids[3]], d = r.tail.map((x, i) => x - r.head[i]);
  return [0, 1, 2].map((i) => b.head[i] + b.m[i][0] * d[0] + b.m[i][1] * d[1] + b.m[i][2] * d[2]); };

describe('bug skeleton', () => {
  it('binds every part of a bug to a bone it has, the legs to their own podomeres', () => {
    for (const id of ['honeyBee', 'gardenSpider', 'lobster', 'scorpion', 'greenCrab']) {
      const K = bugSkeleton(bugParams(id)), ids = new Set(K.bones.map((b) => b.id));
      for (const p of K.plan.segments) {
        const b = K.bind[p.name]; expect(b, `${id} ${p.name}`).toBeDefined();
        for (const x of typeof b === 'string' ? [b] : [b.bone, ...Object.values(b.blend || {}).flatMap(Object.keys)]) expect(ids.has(x), `${id} ${p.name} → ${x}`).toBe(true);
      }
      expect(K.bind.leg0FemurR).toBe('leg0FemurR'); expect(K.bind.leg1Tarsus0R).toBe('leg1TarsusR');
    }
  });

  it('gives six legs to an insect, eight to a spider, a tail chain to a scorpion, chela fingers to a lobster', () => {
    expect(bugSkeleton(bugParams('honeyBee')).legs.length).toBe(3);
    expect(bugSkeleton(bugParams('gardenSpider')).legs.length).toBe(4);
    expect(bugSkeleton(bugParams('scorpion')).bones.some((b) => b.id === 'metasoma0')).toBe(true);
    const lob = bugSkeleton(bugParams('lobster'));
    expect(lob.bones.some((b) => b.id === 'leg0DactylR')).toBe(true); expect(lob.bind.leg0DactylR).toBe('leg0DactylR');
  });

  it('compiles and skins a worked bug through the layered rig', () => {
    const B = bugParams('honeyBee'), plan = withBugMotion(buildBug(B), B, 'honeyBee', ['walk'], 8), recipe = expandPlan(plan);
    const skin = bindLayered(compileLayered(recipe, {}), recipe, bugBones(plan.motion));
    expect(skin.weights.every((w) => Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9)).toBe(true);
  });

  it('leaves the plan untouched without motion', () => {
    const B = bugParams('ladybird');
    expect(JSON.stringify(buildBug(B))).toBe(JSON.stringify(buildBug(bugParams('ladybird'))));
    expect(buildBug(B).motion).toBeUndefined();
  });
});

describe('bug gaits', () => {
  it('moves by its order and its parts: a bee walks and flies, a ladybird with no flight wings only walks, a crab goes sideways', () => {
    expect(bugMotionGaits(bugParams('honeyBee'), 'honeyBee')).toEqual(['walk', 'fly']);
    expect(bugMotionGaits(bugParams('ladybird'), 'ladybird')).toEqual(['walk']);
    expect(bugMotionGaits(bugParams('greenCrab'), 'greenCrab')).toEqual(['sideways', 'walk']);
    expect(bugMotionGaits(bugParams('lobster'), 'lobster')).toContain('tailFlip');
  });

  it('walks an insect on an alternating tripod: the fore and hind legs of one side with the middle of the other', () => {
    const ctx = prepareBug(bugParams('cockroach'), 'cockroach'), g = ctx.gaits.walk;
    const stance = (key, t) => { const leg = ctx.legs.find((l) => l.key === key), F = gaitPose(ctx, 'walk', t).feet[key]; return Math.abs(F[2] - leg.rest.foot[2]) < 1e-12; };
    for (const t of [0.1, 0.3, 0.6, 0.85]) {
      expect(stance('0R', t)).toBe(stance('2R', t)); expect(stance('0R', t)).toBe(stance('1L', t)); expect(stance('0R', t)).not.toBe(stance('0L', t));
    }
    expect(g.w).toBe(0.5);
  });

  it('keeps a planted foot where its target is, and every foot above the ground, for every worked bug', () => {
    for (const id of Object.keys(BUG_SPECIES)) {
      const ctx = prepareBug(bugParams(id), id);
      for (const gait of Object.keys(ctx.gaits)) {
        const frames = bugGaitFrames(ctx, gait, 12);
        for (const f of frames) for (const p of Object.values(f.bones)) expect([...p.m.flat(), ...p.head].every(Number.isFinite), `${id} ${gait}`).toBe(true);
        for (const leg of ctx.legs.filter((l) => l.ground)) for (const f of frames) {
          const p = footAt(ctx, leg, f); expect(p[2], `${id} ${gait} ${leg.key}`).toBeGreaterThan(-0.005 * ctx.L);
          if (ctx.gaits[gait].pattern !== 'metachronal') continue;
          const tg = gaitPose(ctx, gait, f.t).feet[leg.key];
          expect(Math.hypot(p[0] - tg[0], p[1] - tg[1], p[2] - tg[2]) / ctx.L, `${id} ${gait} ${leg.key} @${f.t}`).toBeLessThan(0.05);
        }
      }
    }
  }, 120000);

  it('beats the wings in flight and raises a wing case clear', () => {
    const ctx = prepareBug(bugParams('honeyBee'), 'honeyBee'), a = bugGaitFrames(ctx, 'fly', 4);
    const tip = (f) => f.bones.wingForeR.head[2] + f.bones.wingForeR.m[2][0];
    expect(Math.abs(tip(a[1]) - tip(a[3]))).toBeGreaterThan(0.1);
  });
});

describe('bug motion in the World', () => {
  it('plays a minted bug\'s gaits as the figure\'s clips', async () => {
    const B = bugParams('gardenSpider'), plan = withBugMotion(buildBug(B), B, 'gardenSpider', ['walk'], 8), recipe = expandPlan(plan);
    const m = { kind: 'layered', recipe, plan, dials: resolveLayeredDials(recipe.dials || {}, {}), units: 'm' };
    const { payload } = await resolveWorldScene({ ref: 's', title: 's', manifest: m });
    expect(Object.keys(payload.figures.body.clips)).toEqual(['walk']);
    expect(payload.figures.body.clips.walk.b.every(Number.isFinite)).toBe(true);
  });

  it('refuses a gait the bug does not have', () => {
    const B = bugParams('ladybird');
    expect(() => withBugMotion(buildBug(B), B, 'ladybird', ['fly'])).toThrow(/no gait 'fly'.*walk/);
  });
});

describe('bug behaviors', () => {
  it('chooses each behavior by what the bug is built with', async () => {
    const { bugRepertoire } = await import('./behavior.js');
    const say = (id) => Object.fromEntries(Object.entries(bugRepertoire(prepareBug(bugParams(id), id))).map(([w, r]) => [w, r.strategy]));
    expect(say('lobster')).toMatchObject({ alert: 'claws-up', eat: 'claw-feed' });
    expect(say('scorpion').alert).toBe('claws-up');
    expect(say('prayingMantis').alert).toBe('strike-ready');
    expect(say('gardenSpider').alert).toBe('forelegs-up');
    expect(say('honeyBee')).toMatchObject({ alert: 'wings-up', eat: 'chew' });
    expect(say('monarch').eat).toBe('sip');
    expect(say('ladybird')).toMatchObject({ relax: 'groom', alert: 'stilt', sleep: 'tuck' });
  });

  it('poses every behavior of every worked bug finite, the planted feet held', async () => {
    const { bugBehaviorFrames } = await import('./rig.js');
    for (const id of Object.keys(BUG_SPECIES)) {
      const ctx = prepareBug(bugParams(id), id);
      for (const w of ['relax', 'alert', 'eat', 'sleep']) for (const f of bugBehaviorFrames(ctx, w, 6)) for (const p of Object.values(f.bones)) expect([...p.m.flat(), ...p.head].every(Number.isFinite), `${id} ${w}`).toBe(true);
    }
  }, 120000);

  it('packs behaviors beside the gaits for the World', async () => {
    const B = bugParams('scorpion'), plan = withBugMotion(buildBug(B), B, 'scorpion', ['walk'], 6, { behaviors: ['alert'] }), recipe = expandPlan(plan);
    const m = { kind: 'layered', recipe, plan, dials: resolveLayeredDials(recipe.dials || {}, {}), units: 'm' };
    const { payload } = await resolveWorldScene({ ref: 's', title: 's', manifest: m });
    expect(Object.keys(payload.figures.body.clips)).toEqual(['walk', 'alert']);
  });
});

describe('wingbeat', () => {
  it('beats at the real rate where a screen can show it, blurs past it, and takes an ask', async () => {
    const { wingbeat, bugGaitSeconds, WINGBEAT_CAP } = await import('./gait.js');
    const bee = prepareBug(bugParams('honeyBee'), 'honeyBee'), monarch = prepareBug(bugParams('monarch'), 'monarch');
    expect(wingbeat(monarch, 'fly')).toEqual({ mode: 'beat', hz: 10, real: 10 });
    expect(wingbeat(bee, 'fly')).toEqual({ mode: 'blur', hz: WINGBEAT_CAP, real: 230 });
    expect(wingbeat(bee, 'fly', 'beat')).toMatchObject({ mode: 'beat', hz: WINGBEAT_CAP });
    expect(wingbeat(monarch, 'fly', 'blur').mode).toBe('blur');
    expect(wingbeat(bee, 'fly', 6)).toMatchObject({ mode: 'beat', hz: 6 });
    expect(bugGaitSeconds(monarch, 'fly')).toBeCloseTo(0.1, 6);
    expect(() => wingbeat(bee, 'fly', 'fast')).toThrow(/auto \| beat \| blur/);
  });

  it('packs a blurred flight\'s fans as World overlays and hides the beating wings while it plays', () => {
    const B = bugParams('honeyBee'), plan = withBugMotion(buildBug(B), B, 'honeyBee', ['walk', 'fly'], 6), recipe = expandPlan(plan);
    const mesh = compileLayered(recipe, {}), R = bugBones(plan.motion), pack = packBugRig(mesh, bindLayered(mesh, recipe, R), plan.motion);
    expect(pack.overlays.length).toBe(4); expect(pack.overlays.every((o) => o.clips[0] === 'fly' && o.alpha > 0 && o.alpha < 1)).toBe(true);
    expect(pack.clips.fly.hide.map((i) => R.bones[i].id).sort()).toEqual(['wingForeL', 'wingForeR', 'wingHindL', 'wingHindR']);
    expect(pack.clips.walk.hide).toBeUndefined();
    const beat = { ...plan.motion, wingbeat: 'beat' }, p2 = packBugRig(mesh, bindLayered(mesh, recipe, R), beat);
    expect(p2.overlays).toBeUndefined(); expect(p2.clips.fly.hide).toBeUndefined();
  });

  it('a butterfly beats its wings by default (no overlay)', () => {
    const B = bugParams('monarch'), plan = withBugMotion(buildBug(B), B, 'monarch', ['fly'], 6), recipe = expandPlan(plan);
    const mesh = compileLayered(recipe, {}), R = bugBones(plan.motion);
    expect(packBugRig(mesh, bindLayered(mesh, recipe, R), plan.motion).overlays).toBeUndefined();
  });
});
