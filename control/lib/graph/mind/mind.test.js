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
    expect(r.situations.idle).toEqual({ strategy: 'post', status: 'absent', why: 'guard' });
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
