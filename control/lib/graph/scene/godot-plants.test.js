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
    { file: 'bus.gd', name: 'gte read as gt', from: 'if p.has("gte"): ok = ok and rel(v, p["gte"], ">=")', to: 'if p.has("gte"): ok = ok and rel(v, p["gte"], ">")' },
    { file: 'bus.gd', name: 'a reserved key dropped (by)', from: '"var": 1, "by": 1, "if": 1}', to: '"var": 1, "if": 1}' },
    { file: 'bus.gd', name: 'a timer a tick late', from: 'while state["_timerAcc"][key] >= period and guard < 64:', to: 'while state["_timerAcc"][key] > period and guard < 64:' },
    { file: 'bus.gd', name: 'the depth cap off by one', from: 'if depth > float(cap["depthCap"]):', to: 'if depth >= float(cap["depthCap"]):' },
    { file: 'stats.gd', name: 'a level past its max', from: 'if _nn(L.get("max")) and lv >= float(L["max"]):', to: 'if _nn(L.get("max")) and lv > float(L["max"]):' },
  ],
  combat: [
    { file: 'combat.gd', name: 'a hit not counted', from: 'tg["hits"] = int(tg.get("hits", 0)) + 1', to: 'tg["hits"] = int(tg.get("hits", 0))' },
    { file: 'combat.gd', name: 'a dry weapon reloads', from: 'if float(w["ammo"]) <= 0.0 and not Bus.truthy(w["reloading"]) and not dry(w):\n\t\tw["reloading"] = true\n\t\tw["reloadT"] = float(w["reload"])\n\t\tw["burstLeft"] = 0', to: 'if float(w["ammo"]) <= 0.0 and not Bus.truthy(w["reloading"]):\n\t\tw["reloading"] = true\n\t\tw["reloadT"] = float(w["reload"])\n\t\tw["burstLeft"] = 0' },
    { file: 'combat.gd', name: 'a reload ignores the reserve', from: 'var take: float = float(w["magazine"]) if w.get("reserve") == null else minf(float(w["magazine"]), float(w["reserve"]))', to: 'var take: float = float(w["magazine"])' },
    { file: 'cast.gd', name: 'a rearm by n ignored', from: 'w["reserve"] = float(w["reserve"]) + maxf(0.0, float(o["by"]))', to: 'w["reserve"] = float(w["reserve"])' },
    { file: 'cast.gd', name: 'a heal past hpMax', from: 'e["hp"] = minf(mx, e["hp"] + float(o["by"])) if Bus.finite(o.get("by")) else mx', to: 'e["hp"] = e["hp"] + float(o["by"]) if Bus.finite(o.get("by")) else mx' },
  ],
};

describe.skipIf(!GODOT)('every planted bug is caught by its corpus (MOJULO_GODOT)', () => {
  it('the bus and the stats (bus-conformance corpus)', async () => {
    const { runGodotBus, compare } = await import('../../../scripts/godot-bus-conformance.mjs');
    const scenarios = busCorpus({ random: 24, seed: 7 });
    for (const p of PLANTS.bus) {
      const { out } = runGodotBus(scenarios, GODOT, { mutate: [p] });
      const caught = !out || compare(scenarios, out).some((r) => !r.equal);
      expect(caught, `${p.file}: ${p.name}`).toBe(true);
    }
  }, 900000);

  it('the cast and the fight (combat-conformance corpus)', async () => {
    const { runGodotCombat, compare } = await import('../../../scripts/godot-combat-conformance.mjs');
    const opts = { random: 12, seed: 1 }, scenarios = combatCorpus(opts);
    for (const p of PLANTS.combat) {
      const { out } = runGodotCombat(scenarios, GODOT, { mutate: [p] });
      const caught = !out || compare(scenarios, out, opts).some((r) => !r.equal);
      expect(caught, `${p.file}: ${p.name}`).toBe(true);
    }
  }, 900000);
});
