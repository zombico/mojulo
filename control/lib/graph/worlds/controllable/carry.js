/**
 * carry.js — WHAT IS IN HAND, chosen from a HELD menu: one weapon equipped at a time, or none, and consumables used.
 * Opt-in on the pilot's rule:
 *
 *   rule.carry: {
 *     items?: [{ id, name?, count, heal? }],   consumables: `heal` gives that much health back (to the body's own most)
 *     holstered?: true,                        it starts with nothing in hand
 *     step?: 60,                               the look's travel a step of the menu takes (a mouse's pixels, a stick's push)
 *     locked?: '<item id>',                    THE KIT TAKEN (a holding block's: captured, its weapons gone): until the
 *                                              mission holds that item (mission.js state.ms.held), the weapon menu offers
 *                                              nothing but bare hands and nothing is in hand; the moment it is held, the
 *                                              kit is back, its first slot in hand
 *   }
 *
 *   input.equipHold   held: the WEAPON menu. Its places are nothing in hand, then each slot of the rule's loadout. While
 *                     it is held the look steps through them (`input.step`, an edge of -1 or 1, steps too) and turns
 *                     nothing; let go, the place stepped to is what is in hand. Nothing in hand: the weapon is put away
 *                     (the body's `weapon` null, so nothing draws or fires it) until another is chosen.
 *   input.itemHold    held: the ITEM menu, the consumables it still has; let go, the one stepped to is used once.
 *   While either is held the trigger and the aim are held off.
 *
 * Field ownership: e.carry ({ menu, sel, acc, holstered, counts, used, ps, rule, view, locked }), e.kitBack (when the kit came back), and the pilot's `weapon` while it is put
 * away. The page draws the menu from e.carry (scene/channels/controllable/carry-view.js).
 *
 * Wraps stepWorld (as gunplay.js does; listed after it and the aim, so it steps first and they read what it leaves).
 * Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose world has a rule
 * with `carry`, so every other page keeps every byte.
 */
export function buildCarry(E) {
  const step = E.stepWorld;
  E.carryPlaces = (e, menu) => {
    const R = e.rule.carry, C = e.carry, own = (C && C.rule) || e.rule, lo = Array.isArray(own.loadout) ? own.loadout : [];
    if (menu === 'weapon') return [{ kind: 'none', name: 'unarmed' }, ...(C && C.locked ? [] : lo.map((s, i) => ({ kind: 'weapon', slot: i, name: (s && s.name) || `weapon ${i + 1}` })))];
    return (R.items || []).map((it, i) => ({ kind: 'item', item: i, id: it.id, name: it.name || it.id, count: C ? C.counts[i] : it.count })).filter((x) => x.count > 0);
  };
  E.stepWorld = function stepWithCarry(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, R = p && p.rule && p.rule.carry;
    if (!R || !input) return step(state, input, dt, hooks);
    const C = p.carry || (p.carry = { menu: null, sel: 0, acc: 0, holstered: false, counts: (R.items || []).map((it) => it.count | 0), used: 0, ps: 0, first: !!R.holstered });
    // (it starts with nothing in hand where the rule says so)
    if (C.first) { C.first = false; C.holstered = true; C.stash = p.weapon || null; p.weapon = null; }
    // THE KIT TAKEN: nothing in hand until the item that gives it back is held; then its first slot is
    const lockedNow = !!(R.locked && !(state.ms && state.ms.held && state.ms.held[R.locked]));
    if (lockedNow && !C.holstered) { C.holstered = true; C.stash = p.weapon || null; p.weapon = null; }
    if (C.locked && !lockedNow) { C.holstered = false; p.loadoutIdx = 0; p.weapon = (p.loadoutWeapons && p.loadoutWeapons[0]) || C.stash || null; C.stash = null; p.kitBack = state.time || 0; }
    C.locked = lockedNow;
    const want = p.downed || p.gone ? null : input.equipHold ? 'weapon' : input.itemHold ? 'item' : null;
    let inp = input;
    if (want && C.menu !== want) {
      C.menu = want; C.acc = 0;
      C.sel = want === 'weapon' ? (C.holstered ? 0 : (p.loadoutIdx || 0) + 1) : 0;
    }
    if (C.menu && want === C.menu) {
      const P = E.carryPlaces(p, C.menu), n = P.length, S = R.step > 0 ? R.step : 60, edge = input.step && input.step !== C.ps ? Math.sign(input.step) : 0;
      C.acc += (input.lookDX || 0);
      let d = edge;
      while (C.acc >= S) { d++; C.acc -= S; }
      while (C.acc <= -S) { d--; C.acc += S; }
      if (n) C.sel = ((C.sel + d) % n + n) % n;
      inp = { ...input, lookDX: 0, lookDY: 0, fire: 0, aim: 0, melee: 0, cycle: 0, slot: 0 };
    } else if (C.menu && !want) {
      // let go: the place stepped to
      const P = E.carryPlaces(p, C.menu), at = P[Math.min(C.sel, P.length - 1)];
      if (at && at.kind === 'none') { if (!C.holstered) { C.holstered = true; C.stash = p.weapon || null; p.weapon = null; } }
      else if (at && at.kind === 'weapon') {
        if (C.holstered) { C.holstered = false; p.weapon = (p.loadoutWeapons && p.loadoutWeapons[p.loadoutIdx || 0]) || C.stash || null; C.stash = null; }
        if (at.slot !== (p.loadoutIdx || 0)) inp = { ...input, slot: at.slot + 1, cycle: 0 };
      } else if (at && at.kind === 'item' && C.counts[at.item] > 0) {
        const it = R.items[at.item];
        C.counts[at.item]--; C.used++;
        if (it.heal > 0 && p.body && Number.isFinite(p.body.hp)) p.body.hp = Math.min(Number.isFinite(p.hpMax) ? p.hpMax : p.body.hp + it.heal, p.body.hp + it.heal);
        p.carryUsed = { id: it.id, t: state.time || 0 };
      }
      C.menu = null;
    }
    C.ps = input.step || 0;
    // TWO READS OF ONE RULE (a body that carries both a loadout and a moveset, gameworld/combos.js): with a weapon in hand
    // its rule is read without its strings (a moveset would take the trigger from the gun), with nothing in hand without
    // its loadout and with `strike: true`, so the trigger is its strings' light beat. The whole rule is kept in C.rule.
    // A read is changed only while no aim holds the rule (aim-view.js keeps its own copy while the aim is up).
    const aiming = !!(p.av && p.av.on), full = C.rule || p.rule, both = !!(full.moveset && full.loadout), view = C.holstered ? 'fists' : 'armed';
    if (both && C.view !== view && !aiming) {
      C.rule = full; C.view = view;
      // (its `gunplay` word stays: with no loadout the gun's hands do nothing, and the page's still puts the gun away)
      if (view === 'fists') { const { loadout: _l, knife: _k, ...bare } = full; p.rule = { ...bare, strike: true }; }
      else { const { moveset: _m, weapons: _w, strike: _s, ...bare } = full; p.rule = bare; if (!p.weapon && p.loadoutWeapons) p.weapon = p.loadoutWeapons[p.loadoutIdx || 0] || null; }
    }
    // NOTHING IN HAND: nothing is aimed, reloaded or switched to by the keys (the menu alone equips); the trigger is the
    // fists' where the body has them, else nothing
    if (C.holstered) inp = { ...inp, aim: 0, reload: 0, cycle: 0, slot: 0, ...(C.view === 'fists' ? {} : { fire: 0 }) };
    return step(state, inp, dt, hooks);
  };
}
