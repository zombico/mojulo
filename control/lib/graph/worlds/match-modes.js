/**
 * match-modes — game modes as an ENGINE primitive (match-modes.plan.md M3): the suit-agnostic
 * core of the arena's mode builders, promoted out of the gitignored mobile-suit pack so ANY
 * controllable world with pilotable entities can become a scored match.
 *
 * A MODE is a pure manifest → manifest transform over a MAP SOURCE (terrain + a roster of
 * `pilotable` entities). It authors the mode's OUTPUT layers on a clone:
 *
 *   entities  — the seats: every roster suit as a pilot OPTION (seat:'player') plus the mode's
 *               AI combatants (enemy / opponent / ally / ai), placed by arenaGeometry
 *   match     — the scored-bout layer (controllable/combat-match.js): killTarget, respawn ring,
 *               drop-in + fire-guard, display names, teamNames for team victory
 *   game      — the level contract: consumes (party-slice picks), produces, presets
 *   camera / shadows / spectate / ai / smoke / wreckExplodes — presentation knobs
 *
 * Content packs specialize through two hooks, NEVER by forking a builder:
 *   prelude(m) → m — a pure transform run on the map clone before seats author (the arena's
 *                    chase-cam pull-in + liveries + contrast stamp ride here)
 *   nameOf(id)     — display names for the scoreboard (default: the id, upper-cased)
 *
 * Modes ship: solo (1v1, one enemy option per roster suit), practice (solo + non-destructive
 * drill), ffa (a rival pool hunting nearest), team (BLUE allies vs RED foes, team victory),
 * watch (no pilot — solo/team/ffa bouts under a glide spectator camera).
 *
 * Invariants: deep-clone in, source untouched; deterministic (no dice); "never count suits" —
 * every builder derives its seats from the map's own pilotable roster, so a roster grows without
 * any mode edit; imports NOTHING from content packs (pack-absent checkouts stay green).
 *
 * The LIGHT storage form: lightenMatchLevel(full, mapRef) strips a built level to the mode's
 * own output + `mapRef` (terrain inheritance, map-ref.js) — the mode twin of the figures-map
 * `unitRef`. world-scene.js re-inflates at resolve.
 */

// bout lengths + team shape (defaults; every builder accepts overrides via its opts)
export const DUEL_KILLS = 3;   // a 1v1 runs to three
export const FFA_KILLS = 3;    // free-for-all, first individual to three
export const TEAM_KILLS = 6;   // first TEAM to six
export const WATCH_KILLS = 5;  // spectate bouts run a touch longer (no operator to end them early)
export const WATCH_SIDE = 3;   // spectate team battle: up to 3 picked per side (the 3 v 3 scale)
export const TEAM_ALLIES = 2;  // you + 2 wingmen …
export const TEAM_FOES = 3;    // … vs 3 enemies (a 3 v 3)
export const TEAMS = { a: 'BLUE', b: 'RED' };
export const FFA_RIVALS = 5;   // free-for-all rival pool authored per level

const clone = (v) => JSON.parse(JSON.stringify(v));
const idUpper = (id) => String(id).toUpperCase();

// ── map geometry helpers (the terrain/station geometry IS the map) ───────────────────────────
function mapBounds(m) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of m.faces || []) {
    for (const c of f.corners || []) {
      if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
      if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
    }
  }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// groundZAt(m, x, y) — the walkable surface height at (x,y) sampled from the baked faces.
function groundZAt(m, x, y) {
  let z = 0;
  for (const f of m.faces || []) {
    const cs = f.corners;
    if (!cs || cs.length < 3) continue;
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity, mnz = Infinity, mxz = -Infinity;
    for (const c of cs) {
      if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0];
      if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1];
      if (c[2] < mnz) mnz = c[2]; if (c[2] > mxz) mxz = c[2];
    }
    if (x < mnx || x > mxx || y < mny || y > mxy) continue;
    if (mxz - mnz > 26) continue;   // a wall/cliff face, not a floor
    if (mxz > z) z = mxz;
  }
  return z;
}

// liftClearOfColliders — a space spawn must not sit inside a hull.
function liftClearOfColliders(m, p) {
  for (const c of m.colliders || []) {
    const pad = 30;
    if (p[0] > c.min[0] - pad && p[0] < c.max[0] + pad
      && p[1] > c.min[1] - pad && p[1] < c.max[1] + pad
      && p[2] > c.min[2] - pad && p[2] < c.max[2] + pad) {
      p[2] = Math.round(c.max[2] + pad);
    }
  }
  return p;
}

// arenaGeometry(m, space, frac) → seating helpers for a map. `ring` scatters seats evenly around a
// circle at radius R; `arcSeat` spreads n seats across an 0.8π arc centred on `base` (so a team's
// members sit together on one side); `facing` aims a seat at the arena heart.
export function arenaGeometry(m, space, frac) {
  // a map may pin its PLAYABLE bounds + flat ground (`m.arena`) when its baked `faces`
  // carry big non-walkable geometry (e.g. an O'Neill sky shell) that would otherwise blow
  // up mapBounds/groundZAt and fling seats to the horizon or the sky.
  const hint = m.arena;
  const B = hint ? { x0: hint.cx - hint.half, x1: hint.cx + hint.half, y0: hint.cy - hint.half, y1: hint.cy + hint.half, cx: hint.cx, cy: hint.cy } : mapBounds(m);
  const groundAt = (x, y) => (hint && hint.flatZ != null ? hint.flatZ : groundZAt(m, x, y));
  const pilot0 = (m.entities || []).find((e) => e.pilotable);
  const usable = Math.max(260, Math.min((B.x1 - B.x0) / 2, (B.y1 - B.y0) / 2) - 140);
  const R = Math.round(usable * frac);
  const zBase = space ? Math.round((pilot0?.transform?.pos?.[2]) || 96) : 0;
  const place = (a, i) => {
    const x = Math.round(B.cx + Math.cos(a) * R), y = Math.round(B.cy + Math.sin(a) * R);
    if (!space) return [x, y, Math.round(groundAt(x, y))];
    const z = zBase + Math.round(((i % 3) - 1) * R * 0.35);
    return liftClearOfColliders(m, [x, y, z]);
  };
  const facing = (at) => Math.atan2(B.cy - at[1], B.cx - at[0]);   // toward the arena heart
  // A map may carry an explicit AI spawn POOL (`m.arenaSpawns` — curated clear [x,y,z] positions) for
  // when the generic ring would misfire: an ENCLOSED map, where a circle at one z drops seats in
  // walls / below the floor / mid-air. When present, seat from the pool (team = split it into two sides).
  const pool = Array.isArray(m.arenaSpawns) && m.arenaSpawns.length ? m.arenaSpawns : null;
  if (pool) {
    const half = Math.ceil(pool.length / 2);
    return {
      B, R, zBase, facing, groundAt,
      ring: (i) => pool[((i % pool.length) + pool.length) % pool.length].slice(),
      arcSeat: (i, n, base) => (base === 0 ? pool[i % half] : pool[half + (i % Math.max(1, pool.length - half))]).slice(),
    };
  }
  const ring = (i, n) => place((i / n) * Math.PI * 2 + Math.PI / n, i);
  const arcSeat = (i, n, base) => {
    const spread = Math.PI * 0.8;
    const a = base - spread / 2 + (n > 1 ? (i / (n - 1)) : 0.5) * spread;
    return place(a, i);
  };
  return { B, R, zBase, ring, arcSeat, facing, groundAt };
}

// seatRule(srcSuit, {space, aiSource, target}) — an AI combatant's brain, built from its suit's own
// ai ambient (or a donor's, for seats whose proving ground keeps clock ambients), plus boost/juke,
// melee-seek, the solid footprint, and a target policy: undefined = hunt the pilot (a solo enemy),
// 'all' = free-for-all, 'enemy' = team-aware (allies are skipped). Policies land in ai targeting
// (the engine's target branch; the arena's ms-ai.js is the reference consumer).
export function seatRule(srcSuit, { space, aiSource, target }) {
  let rule = clone(srcSuit.ambient || {});
  if (rule.type !== 'ai' && aiSource) {
    const donor = (aiSource.entities || []).find((x) => x.id === srcSuit.id && x.ambient && x.ambient.type === 'ai');
    if (donor) rule = clone(donor.ambient);
  }
  if (rule.type !== 'ai') rule = { type: 'ai', speed: 30, turn: 2.5, standoff: 200, burst: 1.2, pause: 1.2 };
  if (srcSuit.rule && Array.isArray(srcSuit.rule.loadout)) rule.loadout = clone(srcSuit.rule.loadout);
  if (srcSuit.rule?.collideRadius != null) rule.collideRadius = srcSuit.rule.collideRadius;
  if (srcSuit.rule?.collideHeight != null) rule.collideHeight = srcSuit.rule.collideHeight;
  if (space) rule.space = true;         // 3D seek in the void
  if (target) rule.target = target;
  rule.boost = true;
  rule.boostSpeed = Math.round((rule.speed || 30) * 2.2);
  rule.boostBurst = 2.2; rule.boostRest = 1.4; rule.jukePeriod = 0.8;
  rule.meleeSeek = true;   // space too: the engine's melee-seek closes in 3D and the blade connects in 3D
  return rule;
}

// a match layer (shared): first to killTarget, respawn ring, drop-in + fire-guard, names. teamNames
// present ⇒ the engine wins the bout by team.
export function matchLayer(ring, names, { space, killTarget, teamNames = null }) {
  const m = {
    killTarget, respawnDelay: 3,
    dropHeight: space ? 0 : 100, dropSpeed: 60,
    fireGuard: true, fireGuardMax: 5,
    spawns: Array.from({ length: 8 }, (_, i) => ring(i, 8)),
    names,
  };
  if (teamNames) m.teamNames = teamNames;
  return m;
}

const PRODUCES_CAREER = { results: ['success', 'fail'], events: [{ type: 'promote', slice: 'career', max: 1 }] };
const PRODUCES_WATCH = { results: ['success'], events: [] };
const PRODUCES_PRACTICE = { results: ['success', 'abort'], events: [] };   // a drill stakes no career; the operator leaves via the pause menu

// cast-shadow config for a GROUND level: silhouettes on, plus any `shadowNoCast` groups the source
// map declared (enclosed interiors whose roof/ceiling must receive-but-never-cast — else it blankets
// the floor in the sun's shadow and no silhouette reads; see channels/cast-shadows.js).
function shadowsFor(m) {
  const s = { cast: true };
  if (Array.isArray(m.shadowNoCast) && m.shadowNoCast.length) s.noCastGroups = m.shadowNoCast.slice();
  return s;
}

// ── PLAYER levels ────────────────────────────────────────────────────────────────────────────
// Generic prep: clone the map, set the level dressing, run the pack prelude, tag every roster
// suit as a pilot OPTION. `prelude` runs on the clone AFTER the dressing (camera/figures live
// there for the arena's pull-in + livery + contrast treatments) and BEFORE seats derive, so a
// prelude that repaints figures flows into the AI seats' body clones.
function prepPlayer(src, title, { team = null, space = false, prelude = null } = {}) {
  let m = clone(src);
  m.title = title;
  delete m.note;
  m.ai = undefined;               // LIVE from load (a proving ground may pin 'off')
  m.wreckExplodes = true;         // fall → boom → gone → respawn
  m.smoke = true;
  // cast shadows: figure-shaped silhouettes on GROUND maps, keyed to the map's baked sun. Space
  // maps keep their source behavior (no floor to catch a shadow).
  if (!space) m.shadows = shadowsFor(m);
  if (prelude) m = prelude(m);
  const suits = m.entities.filter((e) => e.pilotable);
  if (!suits.length) throw new Error('source world has no pilotable suits');
  for (const e of suits) { e.seat = 'player'; if (team) e.team = team; }   // every suit is a pilot OPTION
  return { m, suits };
}

// SOLO DUEL — you + ONE chosen enemy suit (1 v 1). Authors an enemy seat per roster suit; the launcher
// keeps the picked one. The enemy hunts the pilot (default target).
export function buildSolo(src, { ref, title, space, aiSource, prelude, nameOf = idUpper, killTarget = DUEL_KILLS }) {
  const { m, suits } = prepPlayer(src, title, { space, prelude });
  const g = arenaGeometry(m, space, space ? 1.0 : 0.4);
  const names = {};
  for (const e of suits) names[e.id] = nameOf(e.id);
  const enemies = [];
  suits.forEach((suit, i) => {
    const id = 'en_' + suit.id;
    const at = g.ring(i, suits.length);
    enemies.push({ id, seat: 'enemy', transform: { pos: at, heading: g.facing(at) }, rule: seatRule(suit, { space, aiSource, target: undefined }), body: clone(suit.body) });
    names[id] = nameOf(suit.id);
  });
  m.entities = [...suits, ...enemies];
  m.match = matchLayer(g.ring, names, { space, killTarget });
  const pilot = m.pilot || suits[0].id;
  m.game = {
    levelRef: ref,
    consumes: [
      { slice: 'suits', pick: { max: 1 } },
      { slice: 'duel_enemy', pick: { max: 1 } },
    ],
    produces: PRODUCES_CAREER,
    presets: { default: { suits: { roster: { [pilot]: {} } }, duel_enemy: { roster: { [enemies[0].id]: {} } } } },
  };
  return m;
}

// PRACTICE MODE — the Solo Duel flow with `match.practice`: nothing is destroyed (a killing blow
// topples + refills — engine noDestroy), the bout never ends, and the pause menu grows the AI
// attack on/off switch. Opens PASSIVE (ai:'off' seats the enemy standing down). No career.
export function buildPractice(src, lv) {
  const m = buildSolo(src, lv);
  m.match.practice = true;
  m.ai = 'off';
  m.game.produces = PRODUCES_PRACTICE;
  return m;
}

// FREE FOR ALL — you + N random rivals, everyone hunts the nearest (target:'all').
export function buildFfa(src, { ref, title, space, aiSource, prelude, nameOf = idUpper, killTarget = FFA_KILLS, rivals = FFA_RIVALS }) {
  const { m, suits } = prepPlayer(src, title, { space, prelude });
  const g = arenaGeometry(m, space, space ? 1.2 : 0.8);
  const cycle = suits.filter((e) => e.id !== (m.pilot || suits[0].id)).concat(suits.filter((e) => e.id === (m.pilot || suits[0].id)));
  const names = {};
  for (const e of suits) names[e.id] = nameOf(e.id);
  const pool = [];
  for (let i = 0; i < rivals; i++) {
    const suit = cycle[i % cycle.length];
    const id = 'opp_' + (i + 1);
    const at = g.ring(i, rivals);
    pool.push({ id, seat: 'opponent', transform: { pos: at, heading: g.facing(at) }, rule: seatRule(suit, { space, aiSource, target: 'all' }), body: clone(suit.body) });
    names[id] = nameOf(suit.id) + ' ' + (i + 1);
  }
  m.entities = [...suits, ...pool];
  m.match = matchLayer(g.ring, names, { space, killTarget });
  const pilot = m.pilot || suits[0].id;
  m.game = {
    levelRef: ref,
    consumes: [
      { slice: 'suits', pick: { max: 1 } },
      { slice: 'ffa_rivals', pick: { max: rivals } },
    ],
    produces: PRODUCES_CAREER,
    presets: { default: { suits: { roster: { [pilot]: {} } }, ffa_rivals: { roster: { opp_1: {}, opp_2: {} } } } },
  };
  return m;
}

// TEAM BATTLE — you (team a) + random wingmen vs random team-b enemies. Authors an ally pool + a foe
// pool (one per roster suit); the launcher draws allies + foes at random. Allies never target or
// damage allies (engine team layer); the first team to killTarget wins.
export function buildTeam(src, { ref, title, space, aiSource, prelude, nameOf = idUpper, killTarget = TEAM_KILLS, teamNames = TEAMS, allyCount = TEAM_ALLIES, foeCount = TEAM_FOES }) {
  const { m, suits } = prepPlayer(src, title, { team: 'a', space, prelude });   // every pilot option flies for team a
  const g = arenaGeometry(m, space, space ? 1.0 : 0.6);
  const names = {};
  for (const e of suits) names[e.id] = nameOf(e.id);
  const allies = [], foes = [];
  suits.forEach((suit, i) => {
    const aid = 'al_' + suit.id, at = g.arcSeat(i, suits.length, 0);              // team a on one side
    allies.push({ id: aid, seat: 'ally', team: 'a', transform: { pos: at, heading: g.facing(at) }, rule: seatRule(suit, { space, aiSource, target: 'enemy' }), body: clone(suit.body) });
    names[aid] = nameOf(suit.id);
    const fid = 'fo_' + suit.id, ft = g.arcSeat(i, suits.length, Math.PI);        // team b opposite
    foes.push({ id: fid, seat: 'enemy', team: 'b', transform: { pos: ft, heading: g.facing(ft) }, rule: seatRule(suit, { space, aiSource, target: 'enemy' }), body: clone(suit.body) });
    names[fid] = nameOf(suit.id);
  });
  m.entities = [...suits, ...allies, ...foes];
  m.match = matchLayer(g.ring, names, { space, killTarget, teamNames });
  const pilot = m.pilot || suits[0].id;
  const someAllies = {}; allies.slice(0, allyCount).forEach((e) => (someAllies[e.id] = {}));
  const someFoes = {}; foes.slice(0, foeCount).forEach((e) => (someFoes[e.id] = {}));
  m.game = {
    levelRef: ref,
    consumes: [
      { slice: 'suits', pick: { max: 1 } },
      { slice: 'team_allies', pick: { max: allies.length } },
      { slice: 'team_foes', pick: { max: foes.length } },
    ],
    produces: PRODUCES_CAREER,
    presets: { default: { suits: { roster: { [pilot]: {} } }, team_allies: { roster: someAllies }, team_foes: { roster: someFoes } } },
  };
  return m;
}

// ── SPECTATE levels — NO pilot; a glide free-fly cam (F chase-toggle, Tab cycle). mode: 'solo'
// (fighter A vs fighter B), 'team' (a vs b), 'ffa' (the cast). Every candidate seat is authored
// into the level and the launch params despawn the unpicked (the spectate branch of the
// game-params seam), so the /world standalone preset keeps a playable default bout. ─────────────
function spectatorCamera(m, g, space) {
  const suits = m.entities.filter((e) => e.pilotable || e.seat === 'ai');
  const h = suits[0]?.rule?.collideHeight || 24;
  const gz = space ? g.zBase : g.groundAt(g.B.cx, g.B.cy);
  const camPos = space
    ? [g.B.cx, Math.round(g.B.cy - g.R * 1.1), Math.round(gz + g.R * 0.5)]
    : [g.B.cx, Math.round(g.B.cy - g.R * 0.9), Math.round(gz + g.R * 0.7)];
  const dcx = g.B.cx - camPos[0], dcy = g.B.cy - camPos[1], dcz = gz - camPos[2], dcl = Math.hypot(dcx, dcy, dcz) || 1;
  return {
    rule: 'glide', mouseLook: true,
    transform: { pos: camPos, heading: Math.atan2(dcy, dcx), pitch: Math.asin(Math.max(-1, Math.min(1, dcz / dcl))) },
    lookSens: 0.0025,
    accel: space ? 900 : 700, damping: 5, maxSpeed: space ? 620 : 460,
    dist: Math.round(h * 3.2), height: Math.round(h * 1.5), lead: Math.round(h * 0.5), lookH: Math.round(h * 0.7), lerp: 8,
  };
}

export function buildWatch(src, { ref, title, space, aiSource, mode, prelude, nameOf = idUpper, killTarget = WATCH_KILLS, side = WATCH_SIDE, teamNames = TEAMS }) {
  let m = clone(src);
  m.title = title;
  delete m.note;
  delete m.pilot;
  m.ai = undefined;
  m.wreckExplodes = true;
  m.smoke = true;
  m.spectate = true;
  if (!space) m.shadows = shadowsFor(m);   // ground maps: silhouettes (see prepPlayer)
  if (prelude) m = prelude(m);             // watch levels wear the same pack treatment
  const roster = m.entities.filter((e) => e.pilotable);
  if (!roster.length) throw new Error('source world has no pilotable suits');
  const g = arenaGeometry(m, space, mode === 'solo' ? (space ? 0.6 : 0.3) : (space ? 0.9 : 0.4));
  const names = {};
  const teams = mode === 'team' ? teamNames : null;
  // a non-pilotable AI clone of a roster suit (the watch sibling of buildSolo's en_ seats — a clone
  // rail per side lets any suit face any suit, mirror matches included)
  const aiSeat = (suit, id, at, { team = null, target }) => {
    const s = { id, seat: 'ai', transform: { pos: at, heading: g.facing(at) }, rule: seatRule(suit, { space, aiSource, target }), body: clone(suit.body) };
    if (team) s.team = team;
    names[id] = nameOf(suit.id);
    return s;
  };
  let consumes, presets;
  if (mode === 'solo') {
    const a = roster.map((suit, i) => aiSeat(suit, 'wa_' + suit.id, g.arcSeat(i, roster.length, 0), { target: 'all' }));
    const b = roster.map((suit, i) => aiSeat(suit, 'wb_' + suit.id, g.arcSeat(i, roster.length, Math.PI), { target: 'all' }));
    m.entities = [...a, ...b];
    consumes = [{ slice: 'watch_a', pick: { max: 1 } }, { slice: 'watch_b', pick: { max: 1 } }];
    // default bout = a fixed pairing (suit 0 vs suit 1), never a mirror match
    presets = { default: { watch_a: { roster: { [a[0].id]: {} } }, watch_b: { roster: { [b[Math.min(1, b.length - 1)].id]: {} } } } };
  } else if (mode === 'team') {
    const blue = roster.map((suit, i) => aiSeat(suit, 'bl_' + suit.id, g.arcSeat(i, roster.length, 0), { team: 'a', target: 'enemy' }));
    const red = roster.map((suit, i) => aiSeat(suit, 'rd_' + suit.id, g.arcSeat(i, roster.length, Math.PI), { team: 'b', target: 'enemy' }));
    m.entities = [...blue, ...red];
    consumes = [{ slice: 'watch_blue', pick: { max: side } }, { slice: 'watch_red', pick: { max: side } }];
    // default sides = an alternating draw (a 0,2,4… / b 1,3,5…), capped at `side`
    const bluePick = {}, redPick = {};
    roster.forEach((s, i) => {
      const bucket = i % 2 === 0 ? bluePick : redPick;
      if (Object.keys(bucket).length < side) bucket[(i % 2 === 0 ? 'bl_' : 'rd_') + s.id] = {};
    });
    presets = { default: { watch_blue: { roster: bluePick }, watch_red: { roster: redPick } } };
  } else {   // ffa — the roster itself is the cast; the pick trims it
    roster.forEach((e, i) => {
      e.seat = 'ai';
      const at = g.ring(i, roster.length);
      e.transform = { pos: at, heading: g.facing(at) };
      names[e.id] = nameOf(e.id);
      e.ambient = seatRule(e, { space, aiSource, target: 'all' });
    });
    m.entities = roster;
    const all = {};
    for (const e of roster) all[e.id] = {};
    consumes = [{ slice: 'watch_cast', pick: { max: roster.length } }];
    presets = { default: { watch_cast: { roster: all } } };
  }
  m.camera = spectatorCamera(m, g, space);
  m.match = matchLayer(g.ring, names, { space, killTarget, teamNames: teams });
  // `spectate: true` on the contract keeps the shell's difficulty card off these setups (an
  // all-AI bout is never detuned — the engine ignores params.difficulty in spectate too).
  m.game = { levelRef: ref, spectate: true, consumes, produces: PRODUCES_WATCH, presets };
  return m;
}

// ── the generic mode registry (match-modes.plan.md M4) ─────────────────────────────────────────
// mode id → builder, no pack content: default names (id upper-cased), no prelude. This is the
// dispatch the compose_world `match` channel mints through; a content pack that wants treatments
// builds its own registry over the same builders (mobile-suit/arena-modes.js is the reference).
export const MATCH_MODES = {
  solo: buildSolo,
  practice: buildPractice,
  ffa: buildFfa,
  team: buildTeam,
  watch_solo: (src, o) => buildWatch(src, { ...o, mode: 'solo' }),
  watch_team: (src, o) => buildWatch(src, { ...o, mode: 'team' }),
  watch_ffa: (src, o) => buildWatch(src, { ...o, mode: 'ffa' }),
};

// composeMatchLevel — one mode over one map source. opts: { ref, title, space?, aiSource?,
// prelude?, nameOf?, killTarget?, rivals?, teamNames?, allyCount?, foeCount?, side? }.
export function composeMatchLevel(modeId, src, opts) {
  const build = MATCH_MODES[modeId];
  if (!build) throw new Error(`unknown match mode '${modeId}' — one of: ${Object.keys(MATCH_MODES).join(', ')}`);
  return build(src, opts);
}

// ── lightenMatchLevel — shed the inherited terrain (the mode twin of the figures `unitRef`) ────
// A built level manifest is ~99% its map clone (faces/colliders/lighting). This strips the level
// down to the MODE'S OWN OUTPUT plus a `mapRef`; world-scene.js re-inflates at resolve time by
// spreading the stored map under these keys (level wins; a null value is a TOMBSTONE deleting the
// inherited key — how a mode suppresses the map's pinned `ai:'off'` or its `pilot`).
const LEVEL_OWN_KEYS = [
  'kind', 'title', 'entities', 'figures', 'match', 'game', 'camera', 'shadows',
  'pilot', 'ai', 'spectate', 'smoke', 'wreckExplodes', 'tutorial', 'aiDifficulty',
];

export function lightenMatchLevel(full, mapRef) {
  const m = { kind: full.kind, mapRef };
  for (const k of LEVEL_OWN_KEYS) if (full[k] !== undefined) m[k] = full[k];
  // tombstones — keys the builders explicitly clear off the map clone:
  if (full.ai === undefined) m.ai = null;        // player/watch: LIVE from load (a map may pin 'off')
  if (full.pilot === undefined) m.pilot = null;  // watch: no pilot seat
  m.note = null;                                 // every builder drops the map's note
  return m;
}
