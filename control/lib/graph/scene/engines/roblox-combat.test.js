// THE ROBLOX KERNEL'S FIGHT AND MINDS (roblox-kernel/cast.luau, combat.luau, nav.luau, mind.luau, group.luau) held
// EQUAL to the web's (worlds/controllable cast.js, combat-*.js, mind.js, nav.js, group.js) by the combat and mind
// corpora (combat-conformance.js, mind-conformance.js), frame by frame, under Lune (MOJULO_LUNE). Then the corpora's
// teeth: each planted bug bends a real line of one module in the copy of the kernel a run uses (never the source) and
// must make some scenario unequal. A plant runs over the scenarios that walk its path, so the web's side (the slow
// half) is stepped only there. The corpora's recorded holes (a bent line no scenario sees) are listed apart and held
// to surviving, so the day a scenario catches one it moves into the plants.
import { describe, it, expect } from 'vitest';
import { scenariosOf, compare } from './conformance.js';
import { runCorpus, kernelFiles } from './runners.js';

const LUNE = process.env.MOJULO_LUNE;
const FILES = ['js.luau', 'bus.luau', 'json.luau', 'cast.luau', 'combat.luau', 'rules.luau', 'nav.luau', 'mind.luau', 'group.luau'];

// a plant's corpus at its options, built once (the corpus steps the web for its traces)
const built = new Map();
const corpusAt = (corpus, opts) => {
  const k = `${corpus} ${JSON.stringify(opts)}`;
  if (!built.has(k)) built.set(k, scenariosOf(corpus, opts));
  return built.get(k);
};
const caught = (corpus, scenarios, opts, plant) => {
  const { out } = runCorpus('roblox', corpus, scenarios, { bin: LUNE, mutate: [{ file: plant.file, from: plant.from, to: plant.to }] });
  return !out || compare(corpus, scenarios, out, opts).some((r) => !r.equal);
};

describe('the Roblox kernel\'s fight and minds are equal to the web (MOJULO_LUNE)', () => {
  it('names the modules the combat and mind corpora copy, none missing', () => {
    expect(kernelFiles('roblox', 'combat')).toEqual({ files: FILES, missing: [] });
    expect(kernelFiles('roblox', 'mind')).toEqual({ files: FILES, missing: [] });
  });

  for (const corpus of ['combat', 'mind']) {
    it.skipIf(!LUNE)(`the ${corpus} corpus runs equal to the web, frame by frame: the default corpus and a seeded one (MOJULO_LUNE)`, () => {
      for (const opts of [{}, { random: 12, seed: 5 }]) {
        const scenarios = scenariosOf(corpus, opts);
        const { out, errors } = runCorpus('roblox', corpus, scenarios, { bin: LUNE });
        expect(errors, JSON.stringify(opts)).toEqual([]);
        const rows = compare(corpus, scenarios, out, opts);
        expect(rows.filter((r) => !r.equal), JSON.stringify(opts)).toEqual([]);
        expect(rows.length).toBe(scenarios.length);
        expect(rows.reduce((n, r) => n + r.frames, 0)).toBeGreaterThan(5000);
      }
    }, 900000);
  }

  // a corpus is only as good as what it catches: each plant is a real line of a module, bent, and the scenarios that
  // walk its path (the default corpus, unless the plant names its options)
  const SEED3 = { random: 40, seed: 3 };
  const PLANTS = [
    // the fight (combat.luau)
    { corpus: 'combat', ids: ['swing-reach-cone'], file: 'combat.luau', name: 'a hit not counted', from: 'tg.hits = (tg.hits or 0) + 1', to: 'tg.hits = (tg.hits or 0)' },
    { corpus: 'combat', ids: ['reserve-and-rearm'], file: 'combat.luau', name: 'a reload ignoring the reserve', from: 'local take = nz(w.reserve) == nil and w.magazine or minf(w.magazine, w.reserve)', to: 'local take = w.magazine' },
    { corpus: 'combat', ids: ['rifle'], file: 'combat.luau', name: 'a round that passes through cover', from: 'if mode ~= nil and sightBlocked(from, hitAt, self.colliders) then', to: 'if false then' },
    { corpus: 'mind', ids: ['random-3-28'], opts: SEED3, file: 'combat.luau', name: 'a round\'s cover traced to the feet, not to where it enters the egg', from: 'local hitAt = (isDict(tg.egg) and mode == "core")', to: 'local hitAt = (false)' },
    { corpus: 'combat', ids: ['combo'], file: 'combat.luau', name: 'a combo follow-up in the same direction', from: 'local comboClick = depth > 0 and (e.comboT or 0.0) > 0.0 and dir ~= e.lastSwingDir', to: 'local comboClick = depth > 0 and (e.comboT or 0.0) > 0.0' },
    { corpus: 'combat', ids: ['guard-and-overdrive'], file: 'combat.luau', name: 'no overdrive', from: 'e.statuses:get("overdrive") ~= nil) and 1.5 or 1)', to: 'e.statuses:get("overdrive") ~= nil) and 1 or 1)' },
    { corpus: 'combat', ids: ['guard-and-overdrive'], file: 'combat.luau', name: 'a round leaving spends no guard', from: '\t-- a round leaving spends any protection (the web\'s combat-ranged.js)\n\tbreakGuards(e)\n', to: '' },
    { corpus: 'combat', ids: ['guard-spent-by-a-swing'], file: 'combat.luau', name: 'a swing spends no guard', from: '\t\t-- attacking spends any protection (the web\'s combat-melee.js)\n\t\tbreakGuards(e)\n', to: '' },
    { corpus: 'combat', ids: ['rifle'], file: 'cast.luau', name: 'a round\'s hit fact without what it dealt', from: 'if js.finite(e.lastHitDmg) and e.lastHitDmgN == cur.h then', to: 'if false then' },
    { corpus: 'combat', ids: ['swept'], file: 'combat.luau', name: 'a lob round\'s flight not swept', from: 'local n = math.min(24, math.max(1, ceil(seg / stepLen)))', to: 'local n = 1' },
    { corpus: 'combat', ids: ['death-blast'], file: 'combat.luau', name: 'no death blast', from: 'if truthy(e.gone) or not truthy(e.downed) or truthy(e.deathBurstDone) then', to: 'if true then' },
    { corpus: 'combat', ids: ['burst-charge-heat'], file: 'combat.luau', name: 'a heat lock that never lifts', from: 'w.energyLock = false', to: 'w.energyLock = true' },
    { corpus: 'combat', ids: ['burst-charge-heat'], file: 'combat.luau', name: 'a burst a round short', from: 'w.burstLeft = w.burstLeft - 1.0', to: 'w.burstLeft = w.burstLeft - 2.0' },
    { corpus: 'combat', ids: ['topple-and-rise'], file: 'combat.luau', name: 'a getup without its flat hold', from: 'local hold = fin(e.downPause) and e.downPause or 2.0', to: 'local hold = 0.0' },
    { corpus: 'combat', ids: ['topple-and-rise'], file: 'combat.luau', name: 'a getup that rises without its wake guard', from: 'if rose and orf(e.wakeGuard, 0.0) > 0.0 then', to: 'if false then' },
    { corpus: 'combat', ids: ['rifle'], file: 'combat.luau', name: 'a shield that never breaks', from: 'if tg.shieldHp <= 0.0 then', to: 'if false then' },
    { corpus: 'mind', ids: ['roll-after-stagger'], file: 'combat.luau', name: 'no recovery edge', from: '\t\te.reactionEnded = true', to: '\t\te.reactionEnded = false' },
    // the cast (cast.luau)
    { corpus: 'combat', ids: ['reserve-and-rearm'], file: 'cast.luau', name: 'a heal past hpMax', from: 'e.hp = minf(mx, fin(o.by) and e.hp + o.by or mx)', to: 'e.hp = fin(o.by) and e.hp + o.by or mx' },
    { corpus: 'combat', ids: ['reserve-and-rearm'], file: 'cast.luau', name: 'a rearm by n that fills the magazine, not the reserve', from: 'if nz(w.reserve) ~= nil and fin(o.by) then', to: 'if false then' },
    { corpus: 'combat', ids: ['falls'], file: 'cast.luau', name: 'a hit fact one short', from: 'for _ = p.h or 0, cur.h - 1 do', to: 'for _ = (p.h or 0) + 1, cur.h - 1 do' },
    { corpus: 'combat', ids: ['beams'], file: 'cast.luau', name: 'a beam that lands at once', from: 'local hit = st.time + best', to: 'local hit = st.time' },
    { corpus: 'combat', ids: ['explosions'], file: 'cast.luau', name: 'an explosion chain\'s dice changed', from: 'sin(j * 12.9898 + k * 78.233 + 5.1)', to: 'sin(j * 12.9898 + k * 78.233 + 5.2)' },
    { corpus: 'combat', ids: ['explosions'], file: 'cast.luau', name: 'a moment kept forever', from: 'if t < (x["until"] ~= nil and x["until"] or x.t0 + 3.0) then', to: 'if true then' },
    { corpus: 'combat', ids: ['away-and-back'], file: 'cast.luau', name: 'a body sent away still hittable', from: '\t\t\te.moving = false\n\t\t\te.hittable = false', to: '\t\t\te.moving = false' },
    { corpus: 'combat', ids: ['away-and-back'], file: 'cast.luau', name: 'a spawn that does not make it whole', from: '\t\t\t\te.hp = e.hpMax\n', to: '' },
    // the paths (nav.luau)
    { corpus: 'mind', ids: ['path-round-the-wall'], file: 'nav.luau', name: 'corners cut', from: 'if di ~= 0 and dj ~= 0 and (block[j * nx + ni + 1] ~= 0 or block[nj * nx + i + 1] ~= 0) then', to: 'if false then' },
    { corpus: 'mind', ids: ['random-1-4'], file: 'nav.luau', name: 'a path that skips a node', from: '\t\ta = b\n', to: '\t\ta = b + 1\n' },
    { corpus: 'mind', ids: ['path-round-the-wall'], file: 'nav.luau', name: 'no string pull', from: 'while b > a + 1 and not lineOpen(g, cells[a], cells[b]) do', to: 'while b > a + 1 do' },
    { corpus: 'mind', ids: ['path-round-the-wall'], file: 'nav.luau', name: 'a wall not inflated by the body', from: 'if (cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < r * r then', to: 'if (cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < r * r * 0.25 then' },
    { corpus: 'mind', ids: ['cover-hurt'], file: 'nav.luau', name: 'a heuristic that overestimates', from: 'return math.max(dx, dy) + (SQRT2 - 1.0) * math.min(dx, dy)', to: 'return 3 * (math.max(dx, dy) + (SQRT2 - 1.0) * math.min(dx, dy))' },
    // the minds (mind.luau)
    { corpus: 'mind', ids: ['territorial-warn', 'group-herd'], file: 'mind.luau', name: 'a mind\'s dice changed', from: 'h = imul32(bit32.bxor(h, u), 16777619)', to: 'h = imul32(bit32.bxor(h, u), 16777617)' },
    { corpus: 'mind', ids: ['cover-hurt'], file: 'mind.luau', name: 'a sightline that ignores walls', from: 'if isList(world.colliders) and sightBlocked({ e.pos[1], e.pos[2], e.pos[3] + eyeH(e) }', to: 'if false and sightBlocked({ e.pos[1], e.pos[2], e.pos[3] + eyeH(e) }' },
    { corpus: 'mind', ids: ['sight-cone'], file: 'mind.luau', name: 'a turn past its cap', from: 'local mt = nn(r, "turn", 1.8) * dt', to: 'local mt = nn(r, "turn", 1.8) * dt * 1.05' },
    { corpus: 'mind', ids: ['sight-cone'], file: 'mind.luau', name: 'a sighting counted twice', from: 'e.sightings = (e.sightings or 0) + 1', to: 'e.sightings = (e.sightings or 0) + 2' },
    { corpus: 'mind', ids: ['cover-reload'], file: 'mind.luau', name: 'cover searched on the wrong ring', from: 'ring * 0.26', to: 'ring * 0.3' },
    { corpus: 'mind', ids: ['stand-and-fight'], file: 'mind.luau', name: 'the trigger\'s cadence', from: 'fmod(e.aiClock, cycle) <= burstOn', to: 'fmod(e.aiClock, cycle) < burstOn * 0.9' },
    { corpus: 'mind', ids: ['random-1-4'], file: 'mind.luau', name: 'no reaction delay', from: '\telse\n\t\te.aiClock = (isDict(dif) and truthy(dif.reactDelay)) and -dif.reactDelay or 0.0', to: '\telse\n\t\te.aiClock = 0.0' },
    { corpus: 'mind', ids: ['sentry-tower'], file: 'mind.luau', name: 'a sentry holding its trigger', from: 'e.sentryPull = onAim and not truthy(e.sentryPull)', to: 'e.sentryPull = onAim' },
    { corpus: 'mind', ids: ['blade-commit'], file: 'mind.luau', name: 'no downswing', from: '"back", true, false)', to: '"neutral", true, false)' },
    { corpus: 'mind', ids: ['roll-after-stagger'], file: 'mind.luau', name: 'a roll the wrong way', from: 'rollOff(e, r, dif, { -uy * sd, ux * sd }, rt)', to: 'rollOff(e, r, dif, { uy * sd, -ux * sd }, rt)' },
    { corpus: 'mind', ids: ['respawn-forgets'], file: 'cast.luau', name: 'a respawned mind remembers its last sighting', from: '\t\t\t\te.lastSeen = nil\n', to: '' },
    { corpus: 'mind', ids: ['sight-memory-search'], file: 'mind.luau', name: 'the search\'s sweep', from: 'sin(e.searchT * 2.1) * 1.4', to: 'sin(e.searchT * 2.0) * 1.4' },
    { corpus: 'mind', ids: ['sight-memory-search'], file: 'mind.luau', name: 'a search that never ends', from: 'if e.searchT > nn(r, "searchTime", 3.0) then', to: 'if false then' },
    { corpus: 'mind', ids: ['guard-post'], file: 'mind.luau', name: 'a lookout that does not scan', from: 'sin((now * TAU) / nn(r, "scanPeriod", 6.0))', to: 'cos((now * TAU) / nn(r, "scanPeriod", 6.0))' },
    { corpus: 'mind', ids: ['guard-post'], file: 'mind.luau', name: 'a post never reached', from: 'if hyp(dx, dy) <= arrive then', to: 'if true then' },
    { corpus: 'mind', ids: ['boss-phases'], file: 'mind.luau', name: 'a shift beat cut short', from: 'e.phaseShiftT = ps[e.mindPhase + 1].shift', to: 'e.phaseShiftT = ps[e.mindPhase + 1].shift * 0.5' },
    { corpus: 'mind', ids: ['territorial-warn'], file: 'mind.luau', name: 'the warning skipped', from: 'if e.warnT < nn(r, "warnTime", 1.2) then', to: 'if e.warnT < 0.0 then' },
    { corpus: 'mind', ids: ['stand-and-fight'], file: 'mind.luau', name: 'the aim at the feet', from: 'return fin(egg.cz) and egg.cz or nn(egg, "c", 0.0)', to: 'return 0.0' },
    { corpus: 'mind', ids: ['loadout-rotation'], file: 'mind.luau', name: 'a loadout that never rotates', from: 'e.aiRangedPick = (e.aiRangedPick + 1) % #ranged', to: 'e.aiRangedPick = e.aiRangedPick' },
    { corpus: 'mind', ids: ['random-3-5'], opts: SEED3, file: 'mind.luau', name: 'a forager that never grazes', from: 'if bd < 2.0 then', to: 'if bd < 0.0 then' },
    { corpus: 'mind', ids: ['boost-juke'], file: 'mind.luau', name: 'a boost juke on the wrong side', from: 'e.aiJukeSide = nn(e, "aiJukeSide", 0) == 1 and -1 or 1', to: 'e.aiJukeSide = nn(e, "aiJukeSide", 0) == 1 and 1 or -1' },
    { corpus: 'mind', ids: ['space-seek'], file: 'mind.luau', name: 'a space mind held to the floor', from: '\t\t\te.pos[3] += uz * stp\n', to: '' },
    { corpus: 'mind', ids: ['counter-charge'], file: 'mind.luau', name: 'a counter-charge that never fires', from: 'if isDict(dif) and truthy(dif.tackleGuard) and nn(e, "tackleCdT", 0.0) <= 0.0', to: 'if false and nn(e, "tackleCdT", 0.0) <= 0.0' },
    { corpus: 'mind', ids: ['temper-defensive'], file: 'mind.luau', name: 'a defensive mind that fights unhurt', from: 'if temper == "passive" or (temper == "defensive" and not', to: 'if temper == "passive" or (false and not' },
    // the groups (group.luau)
    { corpus: 'mind', ids: ['group-squad'], file: 'group.luau', name: 'a group\'s order reversed', from: 'table.sort(members, function(a, b) return js.lt(a.id, b.id) end)', to: 'table.sort(members, function(a, b) return js.lt(b.id, a.id) end)' },
    { corpus: 'mind', ids: ['group-pack-hunt'], file: 'group.luau', name: 'a token too many', from: 'for i = 1, math.min(Kn, #order) do', to: 'for i = 1, math.min(Kn + 1, #order) do' },
    { corpus: 'mind', ids: ['group-pack-hunt'], file: 'group.luau', name: 'a fan spread too wide', from: 'nf(p, "arc", 1.6)', to: 'nf(p, "arc", 1.7)' },
    { corpus: 'mind', ids: ['group-squad'], file: 'group.luau', name: 'sight not shared', from: 'if focus ~= nil and cfg.shareSight ~= false then', to: 'if false then' },
    { corpus: 'mind', ids: ['group-herd'], file: 'group.luau', name: 'a herd that does not take alarm', from: 'if t ~= nil and hyp(t.pos[1] - m.pos[1], t.pos[2] - m.pos[2]) < nf(m.rule, "fearRadius", 18.0) then', to: 'if false then' },
    { corpus: 'mind', ids: ['group-squad'], file: 'group.luau', name: 'a plan that never moves to its next stage', from: 'if go then', to: 'if false then' },
  ];
  it.skipIf(!LUNE)('every planted bug in the cast, the fight, the paths, the minds and the groups is caught (MOJULO_LUNE)', () => {
    for (const p of PLANTS) {
      const opts = p.opts || {};
      const scenarios = corpusAt(p.corpus, opts).filter((sc) => p.ids.includes(sc.id));
      expect(scenarios.length, p.name).toBe(p.ids.length);
      expect(caught(p.corpus, scenarios, opts, p), p.name).toBe(true);
    }
  }, 900000);

  // THE HOLES: real lines bent that no scenario of either default corpus sees (two of the plants above are holes at the
  // default seed too, caught only by a seeded scenario). Each is a scenario the corpora lack.
  const HOLES = [
    // no hit on a shielded body comes from outside its arc
    { file: 'combat.luau', name: 'a shield\'s arc a quarter of its width', from: 'cos(orf(tg.shieldArc, PI * 0.6) / 2.0)', to: 'cos(orf(tg.shieldArc, PI * 0.6) / 8.0)' },
    // topple-and-rise ends before its wake guard lifts
    { file: 'combat.luau', name: 'a wake guard that never lifts', from: 'e.wakeGuardT = e.wakeGuard', to: 'e.wakeGuardT = 0' },
    // no spawn op carries a guard, and no walk op is ever queued
    { file: 'cast.luau', name: 'a spawn guard that never lifts', from: 'e.invincible = e.wakeGuardT > 0.0', to: 'e.invincible = true' },
    { file: 'cast.luau', name: 'a walk that never arrives', from: 'if d <= R.reach then', to: 'if false then' },
    // sight-memory-search forgets by its search ending, never by its memory span
    { file: 'mind.luau', name: 'memory that never forgets', from: 'if type(ls) ~= "table" or now - ls.t > nn(r, "memorySpan", 8.0) then', to: 'if type(ls) ~= "table" then' },
  ];
  it.skipIf(!LUNE)('the recorded holes still survive both default corpora: when a scenario catches one, move it to the plants (MOJULO_LUNE)', () => {
    for (const corpus of ['combat', 'mind']) {
      const scenarios = corpusAt(corpus, {});
      for (const h of HOLES) expect(caught(corpus, scenarios, {}, h), `${h.name} (${corpus})`).toBe(false);
    }
  }, 900000);
});
