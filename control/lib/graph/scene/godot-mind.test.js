// THE MIND IN GODOT (III-f): bodies on the web's `ai` rule decide in the kernel (kernel/mind.gd, since 0.26.0) as the
// web's mind decides (worlds/controllable/mind.js), path round walls on the web's grid (kernel/nav.gd, nav.js), and fire
// and swing with the kernel's fight (kernel/combat.gd). The corpus (mind-conformance.js) holds them equal frame by
// frame at five seeds; the cover law (worlds/controllable/cover.test.js) is its first scenarios; every planted bug is
// caught.
import { describe, it, expect } from 'vitest';
import { corpus, runMinds, scenarioById, SCENARIOS } from './mind-conformance.js';
import { extractMinds } from './mind-score.js';
import { extractBus } from './engine-score.js';
import { runCorpus } from './engines/runners.js';
import { compare } from './engines/conformance.js';

const GODOT = process.env.MOJULO_GODOT;
const at = (sc, i) => JSON.parse(runMinds(scenarioById(sc)).snaps[i]);

describe('the mind in Godot', () => {
  it('bus.json carries the minds: each body\'s rule, the minds\' weapons and loadouts, where each was placed, the tier and the switch', () => {
    const sc = scenarioById('loadout-rotation');
    const payload = { entities: sc.entities, events: {}, aiDifficulty: 'easy', ai: 'off' };
    const m = extractMinds(payload, 'p');
    expect(Object.keys(m.minds)).toEqual(['l']);
    expect(m.minds.l.loadoutWeapons).toHaveLength(2);
    expect(m.minds.l.spawn.pos).toEqual([0, 0, 0]);
    expect(m.rules.p.type).toBe('platform');
    expect(m.tier.aimWobble).toBeGreaterThan(0);
    expect(m.off).toBe(true);
    const bus = extractBus(payload);
    expect(bus.minds).toEqual(m);
    // a walking pilot among armed minds still carries the fight the minds need
    const walker = { entities: [{ ...sc.entities[0], rule: { type: 'walk', speed: 4 } }, sc.entities[1]], events: {} };
    expect(extractBus(walker).combat.bodies).toHaveProperty('p');
    expect(extractMinds({ entities: [sc.entities[0]] }, 'p')).toBe(null);
  });

  it('the corpus does what it says: cover taken and left, a search, a path, the blade, the roll, the loadout, a phase', () => {
    expect(at('cover-hurt', 30).minds.g.cover).not.toBe(null);
    expect(SCENARIOS.length).toBeGreaterThan(20);
    const seen = (id, pick) => runMinds(scenarioById(id)).snaps.some((s) => pick(JSON.parse(s)));
    expect(seen('cover-hurt', (o) => o.minds.g.cover === null && o.minds.g.seen > 2)).toBe(true);
    expect(seen('sight-memory-search', (o) => o.minds.s.loco === 'search')).toBe(true);
    expect(seen('path-round-the-wall', (o) => o.minds.h.path > 1)).toBe(true);
    expect(seen('blade-commit', (o) => o.minds.k.loco === 'swing_back')).toBe(true);
    expect(seen('roll-after-stagger', (o) => o.minds.r.loco === 'dodge_sideroll')).toBe(true);
    expect(seen('loadout-rotation', (o) => o.minds.l.slot === 1)).toBe(true);
    expect(seen('boss-phases', (o) => o.minds.boss.phase === 1)).toBe(true);
    expect(seen('sentry-tower', (o) => o.bodies.p.hits > 0)).toBe(true);
  });

  it.skipIf(!GODOT)('kernel/mind.gd and nav.gd are equal to the web\'s, frame by frame, at the five seeds (MOJULO_GODOT)', () => {
    for (const seed of [1, 2, 3, 11, 12]) {
      const sc = corpus({ seed });
      const { out, errors } = runCorpus('godot', 'mind', sc, { bin: GODOT });
      expect(errors, `seed ${seed}`).toEqual([]);
      const rows = compare('mind', sc, out, { seed });
      expect(rows.filter((r) => !r.equal), `seed ${seed}`).toEqual([]);
      expect(rows.length).toBe(sc.length);
    }
  }, 1800000);

  const PLANTS = [
    { file: 'mind.gd', name: 'a turn past its cap', from: 'var mt := nf(r, "turn", 1.8) * dt', to: 'var mt := nf(r, "turn", 1.8) * dt * 1.05' },
    { file: 'mind.gd', name: 'a sighting counted twice', from: 'e["sightings"] = int(nn(e, "sightings", 0)) + 1', to: 'e["sightings"] = int(nn(e, "sightings", 0)) + 2' },
    { file: 'mind.gd', name: 'cover searched on the wrong ring', from: 'float(ring) * 0.26', to: 'float(ring) * 0.3' },
    { file: 'mind.gd', name: 'the trigger\'s cadence', from: 'fmod(float(e["aiClock"]), cycle) <= burst_on', to: 'fmod(float(e["aiClock"]), cycle) < burst_on * 0.9' },
    { file: 'mind.gd', name: 'no reaction delay', from: '	else:\n		e["aiClock"] = -float(dif["reactDelay"])', to: '	else:\n		e["aiClock"] = 0.0 * float(dif["reactDelay"])' },
    { file: 'mind.gd', name: 'a sentry holding its trigger', from: 'e["sentryPull"] = on_aim and not Js.truthy(e.get("sentryPull"))', to: 'e["sentryPull"] = on_aim' },
    { file: 'mind.gd', name: 'no downswing', from: '"back", true, false)', to: '"neutral", true, false)' },
    { file: 'mind.gd', name: 'a roll the wrong way', from: 'roll_off(e, r, dif, [-uy * sd, ux * sd], rt)', to: 'roll_off(e, r, dif, [uy * sd, -ux * sd], rt)' },
    { file: 'mind.gd', name: 'the search\'s sweep', from: 'sin(float(e["searchT"]) * 2.1) * 1.4', to: 'sin(float(e["searchT"]) * 2.0) * 1.4' },
    { file: 'mind.gd', name: 'a wanderer\'s dice', from: 'h = Js.imul(h, 16777619)', to: 'h = Js.imul(h, 16777617)' },
    { file: 'mind.gd', name: 'a lookout that does not scan', from: 'sin((now * TAU_) / nf(r, "scanPeriod", 6.0))', to: 'cos((now * TAU_) / nf(r, "scanPeriod", 6.0))' },
    { file: 'mind.gd', name: 'a shift beat cut short', from: 'e["phaseShiftT"] = float(ps[e["mindPhase"]]["shift"])', to: 'e["phaseShiftT"] = float(ps[e["mindPhase"]]["shift"]) * 0.5' },
    { file: 'mind.gd', name: 'the warning skipped', from: 'if float(e["warnT"]) < nf(r, "warnTime", 1.2):', to: 'if float(e["warnT"]) < 0.0:' },
    { file: 'mind.gd', name: 'the aim at the feet', from: 'return float(egg["cz"]) if Js.finite(egg.get("cz")) else float(egg.get("c", 0.0))', to: 'return 0.0' },
    { file: 'nav.gd', name: 'corners cut', from: 'if di != 0 and dj != 0 and (block[j * nx + ni] != 0 or block[nj * nx + i] != 0):', to: 'if false:' },
    { file: 'nav.gd', name: 'no string pull', from: 'while b > a + 1 and not _line_open(g, cells[a], cells[b]):', to: 'while b > a + 1:' },
    { file: 'combat.gd', name: 'a lob fired mid-thrust', from: 'if Js.truthy(e.get("boosting")) and not can_boost_fire:', to: 'if false:' },
    { file: 'combat.gd', name: 'no recovery edge', from: '		e["reactionEnded"] = true', to: '		e["reactionEnded"] = false' },
    { file: 'group.gd', name: 'a token too many', from: 'for i in mini(K, order.size()):', to: 'for i in mini(K + 1, order.size()):' },
    { file: 'group.gd', name: 'a fan spread too wide', from: '_nf(p, "arc", 1.6)', to: '_nf(p, "arc", 1.7)' },
    { file: 'group.gd', name: 'a herd that will not scatter', from: 'g["alarm"] = threat["id"] if threat != null else null', to: 'g["alarm"] = null\n\tthreat = null' },
    { file: 'group.gd', name: 'slots dealt in the wrong order', from: 'members.sort_custom(func(a, b): return String(a["id"]) < String(b["id"]))', to: 'members.sort_custom(func(a, b): return String(a["id"]) > String(b["id"]))' },
    { file: 'combat.gd', name: 'a counter that only rocks', from: 'arm_reaction(victim, "topple", true)', to: 'arm_reaction(victim, "stagger", true)' },
    { file: 'cast.gd', name: 'a respawned mind remembers its last sighting', from: 'e["lastSeen"] = null; e["searchT"] = null;', to: 'e["searchT"] = null;' },
    { file: 'cast.gd', name: 'a sighting the bus never hears', from: 'if cur["n"] > int(p.get("n", 0)):', to: 'if false:' },
    { file: 'combat.gd', name: 'a stowed gun that does not reload', from: '			if lw is Dictionary:\n				tick_weapon(lw, dt)', to: '			if lw is Dictionary and is_same(lw, e["weapon"]):\n				tick_weapon(lw, dt)' },
  ];
  // a hitscan's cover is traced to where the ray enters the egg (combat-ranged.js), not to the body's centre: the seeded
  // scenario that told the two apart (the Roblox port found it; Godot traced to the centre until 0.29.0)
  it.skipIf(!GODOT)('a shot whose ray enters the egg above a low wall hits as the web\'s does (MOJULO_GODOT)', () => {
    const opts = { random: 40, seed: 3 }, scenarios = corpus(opts).filter((s) => s.id === 'random-3-28');
    expect(scenarios).toHaveLength(1);
    const { out, errors } = runCorpus('godot', 'mind', scenarios, { bin: GODOT });
    expect(errors).toEqual([]);
    expect(compare('mind', scenarios, out, opts).filter((r) => !r.equal)).toEqual([]);
  }, 600000);

  it.skipIf(!GODOT)('every planted bug in the mind, the paths and the fight is caught (MOJULO_GODOT)', () => {
    const c = corpus();
    for (const p of PLANTS) {
      const { out } = runCorpus('godot', 'mind', c, { bin: GODOT, mutate: [{ file: p.file, from: p.from, to: p.to }] });
      expect(compare('mind', c, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 3600000);
});
