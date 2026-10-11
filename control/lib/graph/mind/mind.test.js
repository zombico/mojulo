import { describe, it, expect } from 'vitest';
import { SITUATIONS, MOTIVATIONS, AGGRESSIVENESS, RANKS, SKILLS } from './vocab.js';

const SKILLS_OF = () => JSON.parse(JSON.stringify(SKILLS));
import { STRATEGIES } from './strategies.js';
import { actionsOf, capabilityOf } from './measure.js';
import { validateMind, resolveMind, resolveSkill, tuningOf } from './resolve.js';
import { PRESETS, ARENA_TIERS, faunaMind } from './presets.js';
import { composeLive } from '../worlds/controllable/compose.js';

const SWORD = { rule: { type: 'ai', meleeSeek: true, loadout: [{ name: 'sword', strike: 'melee' }] }, body: { hp: 90 } };

describe('the strategy table', () => {
  it('ends every situation on a fallback any mind can take', () => {
    expect(Object.keys(STRATEGIES)).toEqual(Object.keys(SITUATIONS));
    for (const [sit, list] of Object.entries(STRATEGIES)) {
      const last = list[list.length - 1];
      expect(last.needs ?? [], sit).toEqual([]);
      expect(last.needsAny, sit).toBeUndefined();
      expect(last.when, sit).toBeUndefined();
      expect(last.status, sit).toBe('built');
    }
  });
  it('names only known words, statuses and unique ids', () => {
    for (const [sit, list] of Object.entries(STRATEGIES)) {
      expect(new Set(list.map((s) => s.id)).size, sit).toBe(list.length);
      for (const s of list) {
        expect(['built', 'local', 'partial', 'absent'], s.id).toContain(s.status);
        for (const m of [...(s.when?.motivation || []), ...(s.unless?.motivation || [])]) expect(MOTIVATIONS, `${s.id}: ${m}`).toHaveProperty(m);
      }
    }
  });
});

describe('measuring a body', () => {
  it('reads the verbs from the rule and loadout, never from the mind', () => {
    expect(actionsOf(PRESETS['arena-max'].body)).toEqual({ melee: true, ranged: true, lob: false, area: true, dash: true, dodge: true, tackle: true, jump: false });
    expect(actionsOf(SWORD)).toMatchObject({ melee: true, ranged: false, dodge: true, tackle: true });
    expect(actionsOf({ rule: { type: 'ai', loadout: [{ strike: 'melee' }] } }).melee).toBe(false);   // holds a blade, never seeks melee
    expect(actionsOf({ rule: { type: 'ai' }, weapon: { fireClass: 'lob' } })).toMatchObject({ ranged: true, lob: true });
    expect(capabilityOf(PRESETS['practice-dummy'].body)).toMatchObject({ route: true, flier: false, hp: 60 });
    expect(capabilityOf({ rule: { type: 'ai', space: true } }).flier).toBe(true);
  });
});

describe('resolveMind', () => {
  it('names the known words when one is unknown', () => {
    expect(() => validateMind({ motivation: 'revenge', aggressiveness: 'bold' })).toThrow(/unknown motivation 'revenge' \(known: hunt, guard/);
    expect(() => validateMind({ motivation: 'hunt', aggressiveness: 'bold', rank: 'king' })).toThrow(/unknown rank 'king'/);
  });

  it('gives a minion the first strategy it qualifies for, and says why', () => {
    const r = resolveMind({ motivation: 'guard', aggressiveness: 'bold' }, SWORD);
    expect(r.situations.idle).toEqual({ strategy: 'post', status: 'built', why: 'guard' });
    expect(r.situations.strike).toMatchObject({ strategy: 'melee-commit', status: 'built' });
    expect(r.situations.lost.strategy).toBe('return-to-post');
    expect(r.switches).toEqual([]);
  });

  it('gives a duelist its whole repertoire, and the ways it switches', () => {
    const minion = resolveMind({ motivation: 'hunt', aggressiveness: 'opportunist' }, PRESETS['champion-boss'].body);
    const boss = resolveMind({ motivation: 'hunt', aggressiveness: 'opportunist', rank: 'boss' }, PRESETS['champion-boss'].body);
    expect(minion.situations.strike.strategy).toBe('counter');
    expect(boss.situations.strike.repertoire).toEqual(['counter', 'melee-commit', 'fire-burst']);
    expect(boss.switches).toEqual(['rotate', 'phase', 'adapt']);
  });

  it('falls back alone when a duelist qualifies for nothing else', () => {
    const r = resolveMind({ motivation: 'hunt', aggressiveness: 'passive', rank: 'miniboss' }, SWORD);
    expect(r.situations.strike).toMatchObject({ repertoire: ['none'], status: 'built' });
  });

  it('cannot author a mind its body cannot carry out: a hunter with no verbs does nothing', () => {
    const r = resolveMind({ motivation: 'hunt', aggressiveness: 'relentless' }, { rule: { type: 'ai', dodge: false } });
    expect(r.situations.notice.strategy).toBe('ignore');
    expect(r.situations.strike.strategy).toBe('none');
  });

  it('advises, never refuses, a boss with too little health', () => {
    const r = resolveMind({ motivation: 'hunt', aggressiveness: 'bold', rank: 'boss' }, SWORD);
    expect(r.advisories).toEqual(['a boss with 90 hp: the rank usually carries 300 or more']);
  });
});

describe('skill: a base for the class, tuned per character', () => {
  it('applies the class base, then the overrides in order', () => {
    expect(resolveSkill('regular')).toEqual({ aimWobble: 0.04, wobbleHz: 1.4, reactDelay: 0.55, burstMul: 0.75, pauseMul: 1.5 });
    expect(resolveSkill('regular', { reactDelay: 0.3 })).toMatchObject({ aimWobble: 0.04, reactDelay: 0.3 });
    expect(resolveSkill('novice', 'ace', { aimWobble: 0.01 })).toEqual({ aimWobble: 0.01, wobbleHz: 0, reactDelay: 0, burstMul: 1, pauseMul: 1 });
    expect(() => resolveSkill('regular', { courage: 1 })).toThrow(/unknown skill knob 'courage'/);
  });
});

describe('absorbing the arena', () => {
  it('splits every arena difficulty tier exactly into a skill and an aggressiveness', () => {
    const AI_DIFFICULTY = composeLive().AI_DIFFICULTY;
    expect(Object.keys(ARENA_TIERS)).toEqual(Object.keys(AI_DIFFICULTY));
    for (const [tier, axes] of Object.entries(ARENA_TIERS)) expect(tuningOf(axes), tier).toEqual(AI_DIFFICULTY[tier]);
  });

  it('resolves the arena hunter to the arena ladder: weapon rotation, reflexes, the give-up, and the counter at max only', () => {
    for (const tier of Object.keys(ARENA_TIERS)) {
      const r = resolveMind(PRESETS[`arena-${tier}`].mind, PRESETS[`arena-${tier}`].body);
      expect(r.situations.engage.repertoire, tier).toEqual(['rush', 'skirmish', 'brawl']);
      expect(r.situations.pressed.repertoire, tier).toEqual(['dodge', 'retreat']);
      expect(r.situations.lost.repertoire, tier).toEqual(['switch-tools']);
      expect(r.situations.strike.repertoire.includes('counter'), tier).toBe(tier === 'max');
    }
  });
});

describe('fauna minds from the tags they already carry', () => {
  it('sends prey running and predators hunting, with no authoring per species', () => {
    expect(faunaMind('deer').mind).toMatchObject({ motivation: 'flee', aggressiveness: 'passive' });
    expect(faunaMind('wolf').mind).toMatchObject({ motivation: 'hunt', aggressiveness: 'bold' });
    expect(faunaMind('elephant').mind.motivation).toBe('forage');
    const deer = faunaMind('deer');
    expect(resolveMind(deer.mind, deer.body).situations.notice.strategy).toBe('flee');
  });
});

describe('the vocabulary', () => {
  it('orders aggressiveness by level and gives duels only to minibosses and bosses', () => {
    expect(Object.values(AGGRESSIVENESS).map((a) => a.level)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Object.entries(RANKS).filter(([, r]) => r.duels).map(([k]) => k)).toEqual(['miniboss', 'boss']);
  });
});

describe('the engine runs the matrix (worlds/controllable/mind.js)', () => {
  const E = composeLive();
  const duel = (mind, playerHp = 100) => {
    const w = E.createWorld({
      entities: [
        { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: playerHp, radius: 1 }, transform: { pos: [40, 0, 0], heading: 0 } },
        { id: 'm', rule: { type: 'ai', speed: 8, turn: 3, standoff: 15, ...(mind ? { mind } : {}) }, weapon: { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 1, range: 200 }, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: [0, 0, 0], heading: 0 } },
      ],
    });
    return w;
  };
  const run = (w, n) => { let fired = 0; for (let i = 0; i < n; i++) { E.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); fired += w.byId.m.aiFire; } return fired; };

  it('holds the same skill and aggressiveness tables as the matrix', () => {
    expect(E.MIND_SKILL).toEqual(SKILLS_OF());
    for (const [k, a] of Object.entries(AGGRESSIVENESS)) expect(E.MIND_AGGRESSIVENESS[k], k).toEqual(a.knobs);
  });

  it('tunes one character over its class: a boss sharper than the rest', () => {
    const w = duel({ skill: 'ace', tune: { reactDelay: 0.1 } });
    w.aiTuning = E.AI_DIFFICULTY.easy;
    expect(E.mindTuning(w.byId.m, w)).toEqual({ ...E.AI_DIFFICULTY.easy, aimWobble: 0, wobbleHz: 0, reactDelay: 0.1, burstMul: 1, pauseMul: 1 });
    const plain = duel();
    plain.aiTuning = E.AI_DIFFICULTY.easy;
    expect(E.mindTuning(plain.byId.m, plain)).toBe(E.AI_DIFFICULTY.easy);   // no rule.mind: the class tier, untouched
  });

  it('a passive mind never engages; a defensive one only once hurt', () => {
    expect(run(duel({ aggressiveness: 'passive' }), 180)).toBe(0);
    const w = duel({ aggressiveness: 'defensive' });
    expect(run(w, 120)).toBe(0);
    w.byId.m.body.hp -= 10;
    expect(run(w, 180)).toBeGreaterThan(0);
  });
});

describe('the mind outside the arena: a guard and prey (MX3)', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  const world = (mindEntity, playerAt) => E.createWorld({
    entities: [
      { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: playerAt, heading: 0 } },
      mindEntity,
    ],
  });
  const run = (w, n, id = 'm') => { let fired = 0; for (let i = 0; i < n; i++) { E.stepWorld(w, {}, 1 / 60, hooks); fired += w.byId[id].aiFire || 0; } return fired; };
  const guard = (pos) => ({ id: 'm', rule: { type: 'ai', speed: 6, turn: 3, standoff: 8, guardRadius: 20, mind: { motivation: 'guard', aggressiveness: 'bold' } }, weapon: { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 1, range: 200 }, body: { type: 'mesh', hittable: true, hp: 90, radius: 1 }, transform: { pos, heading: 0 } });

  it('a guard engages an intruder near its post', () => {
    expect(run(world(guard([0, 0, 0]), [15, 0, 0]), 180)).toBeGreaterThan(0);
  });

  it('a guard leaves alone what is far from its post, and walks back to the post', () => {
    const w = world(guard([0, 0, 0]), [60, 0, 0]);
    expect(run(w, 180)).toBe(0);
    expect(w.byId.m.transform.pos[0]).toBe(0);   // stayed on its post
    w.byId.m.transform.pos = [10, 6, 0];          // pushed off it
    run(w, 300);
    expect(Math.hypot(w.byId.m.transform.pos[0], w.byId.m.transform.pos[1])).toBeLessThan(1.6);
  });

  it('prey runs from a threat inside its fear radius and never fights', () => {
    const deer = { id: 'm', rule: { type: 'ai', speed: 5, turn: 4, dodge: false, fearRadius: 18, mind: { motivation: 'flee', aggressiveness: 'passive' } }, body: { type: 'mesh', hittable: true, hp: 40, radius: 1 }, transform: { pos: [0, 0, 0], heading: 0 } };
    const near = world({ ...deer }, [8, 0, 0]);
    expect(run(near, 240)).toBe(0);
    const d = 8 - near.byId.m.transform.pos[0];
    expect(near.byId.m.transform.pos[0]).toBeLessThan(-8);   // ran the other way
    expect(d).toBeGreaterThan(17.5);                          // until it was out of the fear radius (18), then stopped
    const far = world({ ...deer, transform: { pos: [0, 0, 0], heading: 0 } }, [40, 0, 0]);
    run(far, 120);
    expect(far.byId.m.transform.pos).toEqual([0, 0, 0]);       // no threat inside the radius: it stays
  });
});

describe('a duelist switches: boss health phases and adapting (MX6)', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  const gun = { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 1, range: 200 };
  const world = (mind, hp = 300) => E.createWorld({
    entities: [
      { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: [40, 0, 0], heading: 0 } },
      { id: 'm', rule: { type: 'ai', speed: 6, turn: 3, standoff: 20, mind }, weapon: { ...gun }, body: { type: 'mesh', hittable: true, hp, radius: 1 }, transform: { pos: [0, 0, 0], heading: 0 } },
    ],
  });
  const step = (w, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(w, {}, 1 / 60, hooks); };

  it('a boss crosses its default phases once each: bolder, then relentless and closing to the blade', () => {
    const w = world({ rank: 'boss', aggressiveness: 'bold' }), m = w.byId.m;
    step(w, 30);
    expect(m.mindPhase).toBeUndefined();
    m.body.hp = 190;   // under 2/3 of 300
    step(w);
    expect(m.mindPhase).toBe(0);
    expect(m.invincible).toBe(true);                 // the shift beat: planted and untouchable
    expect(m.locomotion).toBe('phase_shift');
    expect(E.mindTuning(m, w)).toMatchObject(E.MIND_AGGRESSIVENESS.opportunist);
    step(w, 70);
    expect(m.phaseShiftT).toBeNull();
    expect(m.invincible).toBe(false);
    m.body.hp = 90;    // under 1/3
    step(w);
    expect(m.mindPhase).toBe(1);
    expect(m.rule.meleeSeek).toBe(true);
    expect(E.mindTuning(m, w)).toMatchObject(E.MIND_AGGRESSIVENESS.relentless);
    m.body.hp = 300;   // a heal never un-phases
    step(w, 120);
    expect(m.mindPhase).toBe(1);
    expect(m.phaseShifts).toBe(2);
  });

  it('a big drop crosses every phase it passes in one beat; authored phases carry skill, tune and rule', () => {
    const w = world({ rank: 'miniboss', phases: [
      { below: 0.8, skill: 'novice' },
      { below: 0.5, skill: 'ace', tune: { reactDelay: 0.05 }, rule: { standoff: 60 }, shift: 0 },
    ] }, 100);
    const m = w.byId.m;
    m.body.hp = 40;
    step(w);
    expect(m.mindPhase).toBe(1);
    expect(m.phaseShiftT ?? null).toBeNull();        // shift 0: no beat
    expect(m.rule.standoff).toBe(60);
    expect(E.mindTuning(m, w)).toMatchObject({ ...E.MIND_SKILL.ace, reactDelay: 0.05 });
  });

  it('no phases without a boss or authored phases; a passive boss wakes when its phase turns it bold', () => {
    const minion = world({ rank: 'minion' }, 100);
    minion.byId.m.body.hp = 10; step(minion, 10);
    expect(minion.byId.m.mindPhase).toBeUndefined();
    const sleeper = world({ rank: 'boss', aggressiveness: 'passive' });
    let fired = 0;
    for (let i = 0; i < 120; i++) { step(sleeper); fired += sleeper.byId.m.aiFire; }
    expect(fired).toBe(0);
    sleeper.byId.m.body.hp = 150;
    for (let i = 0; i < 240; i++) { step(sleeper); fired += sleeper.byId.m.aiFire; }
    expect(sleeper.byId.m.mindPhase).toBe(0);
    expect(fired).toBeGreaterThan(0);
  });

  it('adapting benches the mode that lost the trade for one window, then forgives it', () => {
    const w = world({ rank: 'boss', aggressiveness: 'bold', phases: [] }), m = w.byId.m;
    for (let i = 0; i < 60 * 6 + 2; i++) { step(w); m.body.hp -= 0.05; w.byId.p.body.hp = 100; }   // shooting, punished, landing nothing
    expect(m.adapt.benched).toBe('ranged');
    expect(m.adapt.log).toEqual(['ranged']);
    for (let i = 0; i < 60 * 6 + 2; i++) step(w);   // an even window: nothing benched
    expect(m.adapt.benched).toBeNull();
    const mini = world({ rank: 'miniboss' });
    step(mini, 30);
    expect(mini.byId.m.adapt).toBeUndefined();       // a miniboss adapts only when asked
    const asked = world({ rank: 'miniboss', adapt: true });
    step(asked, 30);
    expect(asked.byId.m.adapt).toBeDefined();
  });
});

describe('a mind sees, and remembers (MX7)', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  const gun = { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 0, range: 200 };
  // a wall north-east of the hunter: (30, 0) is in plain view, (30, 30) is behind it
  const WALL = [{ min: [10, 5, 0], max: [14, 40, 30] }];
  const world = (perception, playerAt = [30, 0, 0], heading = 0) => E.createWorld({
    colliders: WALL,
    entities: [
      { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: playerAt, heading: 0 } },
      { id: 'm', rule: { type: 'ai', speed: 8, turn: 4, standoff: 12, collideRadius: 1, collideHeight: 20, eye: 0, mind: { motivation: 'hunt', aggressiveness: 'bold', ...(perception ? { perception } : {}) } }, weapon: { ...gun }, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: [0, 0, 0], heading } },
    ],
  });
  const run = (w, n) => { let fired = 0; for (let i = 0; i < n; i++) { E.stepWorld(w, {}, 1 / 60, hooks); fired += w.byId.m.aiFire || 0; } return fired; };

  it('the facing cone hides a target behind it; without perception the mind knows anyway', () => {
    const blind = world('sight', [-30, 0, 0]);
    expect(run(blind, 120)).toBe(0);
    expect(blind.byId.m.transform.pos).toEqual([0, 0, 0]);
    const knows = world(null, [-30, 0, 0]);
    expect(run(knows, 180)).toBeGreaterThan(0);
  });

  it('sight alone forgets at once; memory walks to the last-seen spot and finds the target again', () => {
    for (const perception of ['sight', 'memory']) {
      const w = world(perception);
      expect(run(w, 30)).toBeGreaterThan(0);              // seen and engaged
      w.byId.p.transform.pos = [30, 30, 0];               // ducks behind the wall
      const at = w.byId.m.transform.pos.slice();
      const fired = run(w, 60 * 6);
      if (perception === 'sight') {
        expect(fired).toBe(0);
        expect(Math.hypot(w.byId.m.transform.pos[0] - at[0], w.byId.m.transform.pos[1] - at[1])).toBeLessThan(0.5);
      } else {
        expect(w.byId.m.transform.pos[0]).toBeGreaterThan(20);   // went to where it last saw the target
        expect(fired).toBeGreaterThan(0);                          // and, from there, saw it again
      }
    }
  });

  it('memory searches the last-seen spot, then gives up', () => {
    const w = world('memory');
    run(w, 30);
    w.byId.p.transform.pos = [600, 600, 0];   // gone, out of range
    let searched = false;
    for (let i = 0; i < 60 * 10; i++) { E.stepWorld(w, {}, 1 / 60, hooks); if (w.byId.m.locomotion === 'search') searched = true; }
    const m = w.byId.m;
    expect(searched).toBe(true);
    expect(m.lastSeen).toBeNull();
    expect(Math.hypot(m.transform.pos[0] - 30, m.transform.pos[1])).toBeLessThan(3);
    expect(m.moving).toBe(false);
  });
});

describe('idle motion: wander, graze, escort, warn (MX8)', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  const gun = { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 0, range: 200 };
  const body = (hp = 60) => ({ type: 'mesh', hittable: true, hp, radius: 1 });
  const player = (pos) => ({ id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: body(100), transform: { pos, heading: 0 } });
  const steps = (w, n, each) => { for (let i = 0; i < n; i++) { E.stepWorld(w, {}, 1 / 60, hooks); if (each) each(i); } };

  it('a wanderer roams within its radius of home, pausing, the same way every run', () => {
    const make = () => E.createWorld({ entities: [player([500, 500, 0]),
      { id: 'm', rule: { type: 'ai', speed: 4, turn: 4, wanderRadius: 10, mind: { motivation: 'wander', aggressiveness: 'passive' } }, body: body(), transform: { pos: [0, 0, 0], heading: 0 } }] });
    const w = make(), b = make();
    let far = 0, paused = 0;
    steps(w, 60 * 30, () => { const p = w.byId.m.transform.pos; far = Math.max(far, Math.hypot(p[0], p[1])); if (!w.byId.m.moving) paused++; });
    steps(b, 60 * 30);
    expect(far).toBeGreaterThan(3);          // it went somewhere
    expect(far).toBeLessThan(10 + 1);        // and stayed home
    expect(paused).toBeGreaterThan(60);      // with pauses between legs
    expect(b.byId.m.transform.pos).toEqual(w.byId.m.transform.pos);
  });

  it('a forager walks to food and grazes there; with no food it drifts and grazes in place', () => {
    const w = E.createWorld({ entities: [player([500, 500, 0]),
      { id: 'grass', food: true, rule: { type: 'static' }, transform: { pos: [12, 0, 0] } },
      { id: 'm', rule: { type: 'ai', speed: 3, turn: 4, mind: { motivation: 'forage', aggressiveness: 'passive' } }, body: body(), transform: { pos: [0, 0, 0], heading: 0 } }] });
    let grazedAt = null;
    steps(w, 60 * 12, () => { if (!grazedAt && w.byId.m.locomotion === 'graze') grazedAt = w.byId.m.transform.pos.slice(); });
    expect(grazedAt).not.toBeNull();
    expect(Math.hypot(grazedAt[0] - 12, grazedAt[1])).toBeLessThan(3);
    const bare = E.createWorld({ entities: [player([500, 500, 0]),
      { id: 'm', rule: { type: 'ai', speed: 3, turn: 4, mind: { motivation: 'forage', aggressiveness: 'passive' } }, body: body(), transform: { pos: [0, 0, 0], heading: 0 } }] });
    let grazed = 0;
    steps(bare, 60 * 20, () => { if (bare.byId.m.locomotion === 'graze') grazed++; });
    expect(grazed).toBeGreaterThan(60);
  });

  it('an escort keeps to its ward and fights only what comes near the ward', () => {
    const w = E.createWorld({ entities: [player([0, 0, 0]),
      { id: 'm', rule: { type: 'ai', speed: 8, turn: 4, standoff: 6, followDist: 6, guardRadius: 20, mind: { motivation: 'escort', aggressiveness: 'bold' } }, weapon: { ...gun }, body: body(), transform: { pos: [3, 0, 0], heading: 0 } },
      { id: 'x', team: 'raiders', rule: { type: 'walk', speed: 0 }, body: body(), transform: { pos: [80, 0, 0], heading: 0 } }] });
    let fired = 0;
    steps(w, 60 * 3, () => { fired += w.byId.m.aiFire || 0; });
    expect(fired).toBe(0);                                  // the raider is far from the ward: not its business
    w.byId.p.transform.pos = [-30, 0, 0];                    // the ward walks off
    steps(w, 60 * 6);
    const m = w.byId.m.transform.pos;
    expect(Math.hypot(m[0] + 30, m[1])).toBeLessThan(7);    // the escort followed, to within followDist
    w.byId.x.transform.pos = [-40, 6, 0];                    // the raider comes near the ward
    steps(w, 60 * 4, () => { fired += w.byId.m.aiFire || 0; });
    expect(fired).toBeGreaterThan(0);
  });

  it('a territorial mind warns an intruder first, then attacks; outside its territory it leaves them be', () => {
    const make = (at) => E.createWorld({ entities: [player(at),
      { id: 'm', rule: { type: 'ai', speed: 6, turn: 4, standoff: 6, territory: 16, warnTime: 1.2, mind: { motivation: 'territorial', aggressiveness: 'bold' } }, weapon: { ...gun }, body: body(), transform: { pos: [0, 0, 0], heading: 0 } }] });
    const w = make([10, 0, 0]);
    let warned = 0, firstShot = null;
    steps(w, 60 * 4, (i) => { if (w.byId.m.locomotion === 'warn') warned++; if (firstShot == null && w.byId.m.aiFire) firstShot = i; });
    expect(warned).toBeGreaterThan(60);
    expect(firstShot).toBeGreaterThan(60);                  // no shot during the warning
    const out = make([40, 0, 0]);
    let fired = 0;
    steps(out, 60 * 4, () => { fired += out.byId.m.aiFire || 0; });
    expect(fired).toBe(0);
    expect(Math.hypot(out.byId.m.transform.pos[0], out.byId.m.transform.pos[1])).toBeLessThan(13);   // it stays home
  });
});

describe('a behaviour pose ends with the behaviour (MX8 eyes-pass fix)', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  it('warn, search and a boss shift hand the clip back when they end', () => {
    const w = E.createWorld({ entities: [
      { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: [10, 0, 0], heading: 0 } },
      { id: 'm', rule: { type: 'ai', speed: 0, turn: 4, standoff: 6, territory: 16, warnTime: 0.5, mind: { motivation: 'territorial', aggressiveness: 'bold', rank: 'boss' } }, weapon: { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 0, range: 200 }, body: { type: 'mesh', hittable: true, hp: 300, radius: 1 }, transform: { pos: [0, 0, 0], heading: 0 } },
    ] });
    const m = w.byId.m;
    for (let i = 0; i < 10; i++) E.stepWorld(w, {}, 1 / 60, hooks);
    expect(m.locomotion).toBe('warn');
    for (let i = 0; i < 60; i++) E.stepWorld(w, {}, 1 / 60, hooks);
    expect(m.locomotion).not.toBe('warn');
    m.body.hp = 150;
    E.stepWorld(w, {}, 1 / 60, hooks);
    expect(m.locomotion).toBe('phase_shift');
    for (let i = 0; i < 90; i++) E.stepWorld(w, {}, 1 / 60, hooks);
    expect(m.locomotion).not.toBe('phase_shift');
  });
});

describe('predators hunt (MX9)', () => {
  const E = composeLive();
  const hooks = { ground: () => 0 };
  const animal = (id, species, pos, extra = {}) => {
    const f = faunaMind(species);
    return { id, ...(f.body.team ? { team: f.body.team } : {}), rule: { ...f.body.rule, mind: f.mind, collideRadius: 0.6, eye: 0, ...extra }, body: { type: 'mesh', hittable: true, hp: 60, radius: 0.6 }, transform: { pos, heading: 0 } };
  };
  const steps = (w, n) => { for (let i = 0; i < n; i++) E.stepWorld(w, {}, 1 / 60, hooks); };

  it('a predator mind carries a bite sized by its species, and its species as its team', () => {
    const wolf = faunaMind('wolf'), tiger = faunaMind('tiger');
    expect(actionsOf({ rule: { ...wolf.body.rule, mind: wolf.mind } }).melee).toBe(true);
    expect(wolf.body.team).toBe('wolf');
    expect(tiger.body.rule.loadout[0].strikeDamage).toBeGreaterThan(wolf.body.rule.loadout[0].strikeDamage);
    expect(faunaMind('deer').body.rule.loadout).toBeUndefined();
    const r = resolveMind(wolf.mind, { rule: { ...wolf.body.rule, mind: wolf.mind } });
    expect(r.situations.engage.strategy).not.toBe('stand');
  });

  it('a wolf chases a deer down and bites it; the deer runs from the wolf with no player near', () => {
    const w = E.createWorld({ entities: [
      { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: [500, 500, 0], heading: 0 } },
      animal('wolf', 'wolf', [0, 0, 0], { speed: 14, turn: 5 }),
      animal('deer', 'deer', [12, 0, 0], { speed: 6, fearRadius: 18 }),
    ] });
    steps(w, 30);
    expect(w.byId.deer.transform.pos[0]).toBeGreaterThan(12);   // ran away from the wolf
    steps(w, 60 * 10);
    expect(w.byId.deer.body.hp).toBeLessThan(60);                // caught and bitten
    expect(w.byId.p.body.hp).toBe(100);
  });

  it('a pack never bites itself', () => {
    const w = E.createWorld({ entities: [
      { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { type: 'mesh', hittable: true, hp: 100, radius: 1 }, transform: { pos: [500, 500, 0], heading: 0 } },
      animal('w1', 'wolf', [0, 0, 0]), animal('w2', 'wolf', [2, 0, 0]), animal('w3', 'wolf', [0, 2, 0]),
    ] });
    steps(w, 60 * 5);
    for (const id of ['w1', 'w2', 'w3']) expect(w.byId[id].body.hp).toBe(60);
  });
});
