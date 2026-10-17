// PLANTED BUGS, a standing test (the Godot round's loop, layer 3). Each kernel script keeps a list of mutants: a
// flipped comparison, a dropped reserved key, an off-by-one tick, a reserve ignored. Each is applied to a temporary
// copy of the kernel and run against the corpus that holds that script equal to the web; each must make it fail. A
// plant that survives is a hole in the corpus, and a plant whose text no longer exists throws (the runner refuses
// it): rewrite it against the code as it now stands. The beat's plants live beside it (godot-beat.test.js).
import { describe, it, expect } from 'vitest';
import { corpus as busCorpus } from './bus-conformance.js';
import { corpus as combatCorpus } from './combat-conformance.js';

const GODOT = process.env.MOJULO_GODOT;

export const PLANTS = {
  bus: [
    { file: 'bus.gd', name: 'gte read as gt', from: 'if p.has("gte"): ok = ok and Js.rel(v, p["gte"], ">=")', to: 'if p.has("gte"): ok = ok and Js.rel(v, p["gte"], ">")' },
    { file: 'bus.gd', name: 'a reserved key dropped (by)', from: '"var": 1, "by": 1, "if": 1}', to: '"var": 1, "if": 1}' },
    { file: 'bus.gd', name: 'a timer a tick late', from: 'while state["_timerAcc"][key] >= period and guard < 64:', to: 'while state["_timerAcc"][key] > period and guard < 64:' },
    { file: 'bus.gd', name: 'the depth cap off by one', from: 'if depth > float(cap["depthCap"]):', to: 'if depth >= float(cap["depthCap"]):' },
    { file: 'js.gd', name: 'a glob run over line terminators, to before a final newline', from: 'rx.compile("^" + "[^\\\\n\\\\r\\\\x{2028}\\\\x{2029}]*".join(parts) + "\\\\z")', to: 'rx.compile("^" + ".*".join(parts) + "$")' },
    { file: 'js.gd', name: 'keys sorted by code points', from: 'ks.sort_custom(func(a, b): return lt(a, b))', to: 'ks.sort()' },
    { file: 'stats.gd', name: 'a level past its max', from: 'if _nn(L.get("max")) and lv >= float(L["max"]):', to: 'if _nn(L.get("max")) and lv > float(L["max"]):' },
  ],
  combat: [
    { file: 'combat.gd', name: 'a hit not counted', from: 'tg["hits"] = int(tg.get("hits", 0)) + 1', to: 'tg["hits"] = int(tg.get("hits", 0))' },
    { file: 'combat.gd', name: 'a dry weapon reloads', from: 'if float(w["ammo"]) <= 0.0 and not Js.truthy(w["reloading"]) and not dry(w):\n\t\tw["reloading"] = true\n\t\tw["reloadT"] = float(w["reload"])\n\t\tw["burstLeft"] = 0', to: 'if float(w["ammo"]) <= 0.0 and not Js.truthy(w["reloading"]):\n\t\tw["reloading"] = true\n\t\tw["reloadT"] = float(w["reload"])\n\t\tw["burstLeft"] = 0' },
    { file: 'combat.gd', name: 'a reload ignores the reserve', from: 'var take: float = float(w["magazine"]) if w.get("reserve") == null else minf(float(w["magazine"]), float(w["reserve"]))', to: 'var take: float = float(w["magazine"])' },
    { file: 'combat.gd', name: 'a round leaving spends no guard', from: '\t# a round leaving spends any protection (the web\'s combat-ranged.js)\n\tMindScript.break_guards(e)\n', to: '' },
    { file: 'combat.gd', name: 'a swing spends no guard', from: '\t\t# attacking spends any protection (the web\'s combat-melee.js)\n\t\tMindScript.break_guards(e)\n', to: '' },
    { file: 'combat.gd', name: 'no overdrive', from: ' * (1.5 if e.get("statuses")', to: ' * (1.0 if e.get("statuses")' },
    { file: 'combat.gd', name: 'a round\'s damage not kept for the hit fact', from: 'tg["lastHitDmg"] = dmg', to: 'tg["lastHitDmg"] = dmg * 0.5' },
    { file: 'cast.gd', name: 'a rearm by n ignored', from: 'w["reserve"] = float(w["reserve"]) + maxf(0.0, float(o["by"]))', to: 'w["reserve"] = float(w["reserve"])' },
    { file: 'cast.gd', name: 'a heal past hpMax', from: 'e["hp"] = minf(mx, e["hp"] + float(o["by"])) if Js.finite(o.get("by")) else mx', to: 'e["hp"] = e["hp"] + float(o["by"]) if Js.finite(o.get("by")) else mx' },
  ],
  level: [
    { file: 'game_channel.gd', name: 'an end heard after the level ended', from: 'if not ch["ended"]:\n\t\t\t\t\tch["ended"] = true', to: 'if true:\n\t\t\t\t\tch["ended"] = true' },
    { file: 'game_channel.gd', name: 'a door left by more than once', from: 'if not ch["ended"] and not ch["leaving"]:', to: 'if not ch["ended"]:' },
    { file: 'game_channel.gd', name: 'the exit not named', from: 'ch["exit"] = act["exit"]', to: 'ch["exit"] = null' },
    { file: 'game_channel.gd', name: 'an {event} left unnamed', from: 'o[k] = ev["type"]', to: 'o[k] = o[k]' },
    { file: 'game_channel.gd', name: 'a kept number unrounded', from: 'Js.js_round(n * s * 1000.0) / 1000.0', to: 'n * s' },
    { file: 'game_channel.gd', name: 'a scale of 0 taken as 0', from: 'var s := Js.to_number(k["scale"]) if Js.truthy(k.get("scale")) else 1.0', to: 'var s := Js.to_number(k["scale"]) if k.get("scale") != null else 1.0' },
    { file: 'game_channel.gd', name: 'a number\'s text kept as 0', from: 'var n := Js.to_number(vars.get(Js.js_string(k.get("var", Js.UNDEF)), Js.UNDEF))', to: 'var n := float(vars.get(Js.js_string(k.get("var", Js.UNDEF)), 0.0)) if Js.is_num(vars.get(Js.js_string(k.get("var", Js.UNDEF)))) else 0.0' },
    { file: 'game_channel.gd', name: 'the carried chapters dropped', from: 'out.append({"type": x.get("event")})', to: 'pass' },
  ],
};

describe.skipIf(!GODOT)('every planted bug is caught by its corpus (MOJULO_GODOT)', () => {
  it('the bus and the stats (bus-conformance corpus)', async () => {
    const { runCorpus } = await import('./engines/runners.js');
    const { compare } = await import('./engines/conformance.js');
    const scenarios = busCorpus({ random: 24, seed: 7 });
    for (const p of PLANTS.bus) {
      const { out } = runCorpus('godot', 'bus', scenarios, { bin: GODOT, mutate: [p] });
      const caught = !out || compare('bus', scenarios, out).some((r) => !r.equal);
      expect(caught, `${p.file}: ${p.name}`).toBe(true);
    }
  }, 900000);

  it('the game channel (level corpus)', async () => {
    const { runCorpus } = await import('./engines/runners.js');
    const { compare, scenariosOf } = await import('./engines/conformance.js');
    const scenarios = scenariosOf('level', { random: 0 });
    for (const p of PLANTS.level) {
      const { out } = runCorpus('godot', 'level', scenarios, { bin: GODOT, mutate: [p] });
      const caught = !out || compare('level', scenarios, out).some((r) => !r.equal);
      expect(caught, `${p.file}: ${p.name}`).toBe(true);
    }
  }, 900000);

  it('the cast and the fight (combat-conformance corpus)', async () => {
    const { runCorpus } = await import('./engines/runners.js');
    const { compare } = await import('./engines/conformance.js');
    const opts = { random: 12, seed: 1 }, scenarios = combatCorpus(opts);
    for (const p of PLANTS.combat) {
      const { out } = runCorpus('godot', 'combat', scenarios, { bin: GODOT, mutate: [p] });
      const caught = !out || compare('combat', scenarios, out, opts).some((r) => !r.equal);
      expect(caught, `${p.file}: ${p.name}`).toBe(true);
    }
  }, 900000);
});
