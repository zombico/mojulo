/**
 * THE FOE AUDIT — how a level's foes are drawn on its page, read off the page's own payload (the entities and the
 * figures world-scene.js packs), never off a picture. Three questions, each a law, each advice:
 *
 *   foe-bodied   every foe is a figure: never the stage's box (`mesh`), never a figure the page was not given
 *   foe-lit      every foe is drawn under the level's own key: the cast rig of the page's land (`figure.cast`) or the
 *                room's lamps (`form.room.figures`), as the hero is; a body baked under its own studio light is not
 *   foe-moves    every state its rule plays has a pose of its own: it stands (`idle`, not the rest pose), it moves
 *                (`forward`), it strikes (`swing_*`) where it swings a blow, it fires (`fire`) where it carries a gun
 *                (`throw` where its throw is its body's), it lifts (`lift`) where it throws a rock, and it winds up
 *                (`wind_*`) where the runtime holds it braced before its move (a charge's brace, a dive's telegraph;
 *                `brace`, and `dive` for a dive, where its move is posed): a blow's own wind-up is its swing clip's
 *   foe-zone     every blow thrown at a strike zone (foes/zones.js: the legs, the body, from above) passes its weapon
 *                through that zone on the hero while it can hit: its measured path (the slot's `blade`, gameworld/foe-blade.js)
 *                meets the zone's band (the legs' from the ground up: a bite at the ankles is at the legs); a foe that
 *                names no zone is not asked
 *
 *   foeAudit(payload) → null (no foe on the page) | { hero: { light } | null, foes: [<row>], laws: [{ law, ok, value }] }
 *     row  { id, figure, body: 'figure' | 'frames' | 'box' | 'none' | 'unmade', light: 'cast' | 'room' | 'baked',
 *            needs: [<state>], missing: [<state>] }
 *
 * A foe is an entity on the foes' team, or one an AI drives that can be hit. Pure: no database, no clock.
 */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

const isFoe = (e) => isObj(e) && !e.pilotable && (e.team === 'foes' || (e.rule?.type === 'ai' && e.body?.hittable === true));

function bodyOf(e, figures) {
  const B = e.body;
  if (!isObj(B) || B.type === 'none') return 'none';
  if (B.type === 'mesh') return 'box';
  if (B.type === 'figure-rig' || B.type === 'figure-frames') {
    if (!isObj(figures?.[B.figure])) return 'unmade';
    return B.type === 'figure-frames' ? 'frames' : 'figure';
  }
  return 'figure';
}

const lightOf = (fig, roomLit) => (isObj(fig) && isObj(fig.cast) ? 'cast' : roomLit ? 'room' : 'baked');

/** the states a foe's rule plays on its body (worlds/controllable/foe.js, mind.js, rock and gun alike) */
function needsOf(e) {
  const R = e.rule ?? {}, needs = ['idle', 'forward'];
  const melee = (R.loadout ?? []).filter((l) => l && l.strike === 'melee');
  if (melee.length || R.meleeSeek) needs.push('swing');
  // (a move the runtime holds braced before it goes: a charge's brace, a dive's telegraph, foe.js; a blow's wind-up is
  // played inside its swing, fauna/behavior/strike.js)
  // (one whose move is posed, `foe.poses`, braces in a state of its own and dives in another: foe.js `posed`)
  if (R.foe?.rush || R.foe?.dive) needs.push(R.foe?.poses ? 'brace' : 'wind');
  if (R.foe?.dive && R.foe?.poses) needs.push('dive');
  // (a thrower whose throw is its body's, `weapon.throw.clip`, fires in its throw: combat-ranged.js)
  const W = isObj(e.weapon) ? e.weapon : isObj(R.weapon) ? R.weapon : null;
  if (W) needs.push(W.throw?.clip ? 'throw' : 'fire');
  if (isObj(R.foe?.rock)) needs.push('lift');
  return needs;
}

const HAS = {
  idle: (c) => !!c.idle,
  forward: (c) => !!c.forward,
  swing: (c) => Object.keys(c).some((k) => k.startsWith('swing_')),
  wind: (c) => Object.keys(c).some((k) => k.startsWith('wind_')),
  fire: (c) => !!c.fire,
  throw: (c) => !!c.throw,
  brace: (c) => !!c.brace,
  dive: (c) => !!c.dive,
  lift: (c) => !!c.lift,
};

const tally = (rows, f) => rows.reduce((m, r) => { const k = f(r); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const says = (m) => Object.entries(m).map(([k, n]) => `${n} ${k}`).join(', ');

export function foeAudit(payload) {
  const P = isObj(payload) ? payload : {}, ents = Array.isArray(P.entities) ? P.entities : [], figures = isObj(P.figures) ? P.figures : {};
  const foes = ents.filter(isFoe);
  if (!foes.length) return null;
  const roomLit = !!P.form?.room?.figures;
  const H = ents.find((e) => isObj(e) && e.pilotable);
  const hero = H ? { light: lightOf(figures[H.body?.figure], roomLit) } : null;
  const rows = foes.map((e) => {
    const fig = figures[e.body?.figure], body = bodyOf(e, figures), clips = isObj(fig?.clips) ? fig.clips : {};
    const needs = needsOf(e), missing = body === 'figure' || body === 'frames' ? needs.filter((s) => !HAS[s](clips)) : needs;
    const zs = (e.rule?.loadout ?? []).find((l) => l && l.zone);
    const zone = zs ? { id: zs.zone.id, band: zs.zone.band, ...(zs.blade ? { blade: [zs.blade.low, zs.blade.high], meets: zs.blade.low <= zs.zone.band[1] && zs.blade.high >= (zs.zone.id === 'legs' ? 0 : zs.zone.band[0]) } : {}) } : null;
    return { id: e.id, figure: e.body?.figure ?? null, body, light: body === 'box' ? 'baked' : lightOf(fig, roomLit), needs, missing, ...(zone ? { zone } : {}) };
  });
  const unbodied = rows.filter((r) => r.body !== 'figure' && r.body !== 'frames');
  const unlit = rows.filter((r) => r.light === 'baked');
  const still = rows.filter((r) => r.missing.length);
  const zoned = rows.filter((r) => r.zone), off = zoned.filter((r) => r.zone.meets === false), unmeasured = zoned.filter((r) => r.zone.meets === undefined);
  const gaps = tally(still.flatMap((r) => r.missing.map((s) => ({ s }))), (x) => x.s);
  const laws = [
    { law: 'foe-bodied', ok: !unbodied.length, value: unbodied.length ? `${unbodied.length} of ${rows.length} foes are not figures (${says(tally(unbodied, (r) => r.body))}): each stands as a body, a stand-in where its own is not made` : `all ${rows.length} foes are figures` },
    { law: 'foe-lit', ok: !unlit.length, value: unlit.length ? `${unlit.length} of ${rows.length} foes are drawn under their own baked light, not the level's${hero ? ` (the hero: ${hero.light})` : ''}` : `all ${rows.length} foes are drawn under the level's light${hero ? ` (the hero: ${hero.light})` : ''}` },
    ...(zoned.length ? [{ law: 'foe-zone', ok: !off.length && !unmeasured.length, value: off.length ? `${off.length} of ${zoned.length} zoned foes swing their weapon past their zone (${off.map((r) => `${r.figure}: the ${r.zone.id}, ${r.zone.band.join('-')} m, its weapon ${r.zone.blade.join('-')} m`).filter((v, i, a) => a.indexOf(v) === i).join('; ')})` : unmeasured.length ? `${unmeasured.length} of ${zoned.length} zoned foes carry no measured weapon (its swing baked without a tip)` : `every zoned foe's weapon passes through its zone on the hero` }] : []),
    { law: 'foe-moves', ok: !still.length, value: still.length ? `${still.length} of ${rows.length} foes lack a pose for a state they play: ${Object.entries(gaps).map(([s, n]) => `${s} (${n})`).join(', ')}` : `every foe has a pose for each state it plays` },
  ];
  return { hero, foes: rows, laws };
}
