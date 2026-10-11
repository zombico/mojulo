/**
 * PROGRESSION CHECK — can a player reach every level of a game? Pure and advisory: it reads a game manifest's level
 * list and gates (game-manifest.js) and each level's contract, and names every level that could never open, and why.
 * It refuses nothing; a caller stamps what it says.
 *
 *   checkProgression(manifest, contracts?) → { ok, reachable: [ref], locked: [{ ref, why }], unproven: [{ ref, why }] }
 *     manifest   { store?: { slices: [{ name, kind }] }, levels: [{ ref, gate? }] }
 *     contracts  { [ref]: { produces?: { events: [{ type, slice }] }, on?: { [busEvent]: { emit } } } }: each level's
 *                game block, what it may write and what its bus maps to
 *
 * Reachability is a fixpoint from the levels with no gate:
 *   { completed: ref }   opens once `ref` is reachable (finishing a level needs reaching it)
 *   { flag, slice? }     opens once a reachable level may `setFlag` on that slice (the first flags slice when the gate
 *                        names none). SET: its `on` maps a bus event to that very flag (a cue's `emit` fires it).
 *                        ALLOWED: its `produces` permits setFlag there, but no `on` names the key (only the level's
 *                        own code could emit it)
 * LOCKED: it never opens: a gate on a level the game does not hold, on itself or a cycle, or on a flag that no
 * reachable level may set. UNPROVEN: a flag gate opened only by an ALLOWED level, never a SET one.
 * `ok` is true when nothing is locked; unproven gates are reported beside it.
 */

const allowsFlagOn = (c, slice) => ((c && c.produces && c.produces.events) || []).some((e) => e && e.type === 'setFlag' && e.slice === slice);
const setsFlag = (c, slice, key) => Object.values((c && c.on) || {}).some((a) => a && a.emit && a.emit.type === 'setFlag' && a.emit.slice === slice && a.emit.key === key);

export function checkProgression(manifest, contracts = {}) {
  const levels = (manifest && manifest.levels) || [];
  const refs = new Set(levels.map((lv) => lv.ref));
  const flagsSlice = (((manifest && manifest.store && manifest.store.slices) || []).find((s) => s.kind === 'flags') || {}).name;
  const reachable = new Set(), opener = new Map();

  // open what can open, until nothing more does
  for (let grew = true; grew; ) {
    grew = false;
    for (const lv of levels) {
      if (reachable.has(lv.ref)) continue;
      const g = lv.gate;
      let open = !g;
      if (g && g.completed !== undefined) open = g.completed !== lv.ref && reachable.has(g.completed);
      if (g && g.flag !== undefined) {
        const slice = g.slice || flagsSlice;
        const from = slice ? [...reachable] : [];
        const sets = from.find((r) => setsFlag(contracts[r], slice, g.flag)), allows = from.find((r) => allowsFlagOn(contracts[r], slice));
        if (sets) open = true;
        else if (allows) { open = true; opener.set(lv.ref, allows); }
      }
      if (open) { reachable.add(lv.ref); grew = true; }
    }
  }

  const locked = [], unproven = [];
  for (const lv of levels) {
    const g = lv.gate;
    if (!reachable.has(lv.ref)) {
      let why;
      if (g.completed !== undefined) {
        why = g.completed === lv.ref ? 'its gate waits on finishing itself'
          : !refs.has(g.completed) ? `its gate waits on '${g.completed}', a level the game does not hold`
          : `its gate waits on '${g.completed}', which is never reachable (a cycle, or a locked level before it)`;
      } else {
        const slice = g.slice || flagsSlice;
        why = !slice ? `its gate waits on flag '${g.flag}', but the store has no flags slice`
          : `its gate waits on flag '${g.flag}', and no reachable level's contract may set a flag on '${slice}'`;
      }
      locked.push({ ref: lv.ref, why });
    } else if (opener.has(lv.ref)) {
      unproven.push({ ref: lv.ref, why: `flag '${g.flag}' is allowed by '${opener.get(lv.ref)}''s contract, but no level's game.on sets it` });
    }
  }
  return { ok: !locked.length, reachable: levels.map((lv) => lv.ref).filter((r) => reachable.has(r)), locked, unproven };
}
