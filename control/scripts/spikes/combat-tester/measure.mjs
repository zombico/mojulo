// SPIKE combat tester, phase 1: THE MEASURES. A game's weapons, movement, feel and physics, measured on the runtime the
// game ships. Each game is a recipe played its own way (its feel, its kit, its camera, its goal): the game is minted
// through the real handlers, its level resolved, and the player it gives (its rule, its weapon, its kit) and the foe it
// gives (its body) are taken from the payload. Every number below is that rule stepped on the controllable runtime at
// 60 Hz on scripted presses, as feel/reach.js measures a jump. Nothing registers; the machine gate is PASS/FAIL lines.
//
//   node scripts/spikes/combat-tester/measure.mjs [game …] [--quick '<json>'] [--json <path>] [--twice]
//   (from control/; games: see GAMES, all of them by default; --quick measures a recipe of your own)
//
// mobility   top speed, the time to reach it, the stop (from the run to rest), the counter-strafe (full one way to full
//            the other), the walk and the boost held, the jump's height and length, each beside what the feel's card
//            asked for: what the runtime does not carry is named
// lethality  each carried gun: rounds and seconds to drop the game's own foe at 5, 15 and 30 m, standing, strafing and
//            aimed, and aimed at the head; the cone the runtime fired its first round in, still, on the move,
//            aimed, and after a ten-round spray
// marks      destruction as it is seen (rupa's scars, nothing breaks): each carried gun's ten rounds at a wall 10 m off,
//            in brick, concrete, pine, sheet metal and steel: the marks' kind, size, depth and spall, and where they sit
// switching  from each carried gun to each other: press to the incoming gun's first round; each gun's reload, emptied and
//            asked for (R)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGameHandler } = await import('../../../lib/mcp/tools/design-game.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');
const { readScarsSpec } = await import('../../../lib/graph/rupa/index.js');
const { feelCard, readFeel } = await import('../../../lib/graph/gameworld/feel/lower.js');
const { POLES } = await import('../../../lib/graph/gameworld/feel/cards.js');

// ── the games: each a recipe, played its own way ─────────────────────────────────────────────────────────────────────
// (a foe each: the tester needs the game's own foe body, not a fight; first person with no hero is the walker, a hero
// is the platform rule the feel is lowered over)
export const GAMES = {
  conscription: { says: 'the contemporary FPS, as its template plays: first person, a rifle, a sidearm and a shotgun', quick: { goal: 'shoot', foes: 1, arms: ['rifle', 'handgun', 'shotgun'], camera: 'first-person', world: { id: 'ct-conscription', feel: 'conscription' } } },
  'conscription-hero': { says: 'the same with a body: the platform rule the feel is lowered over, seen from the eye', quick: { goal: 'shoot', foes: 1, hero: {}, arms: ['rifle', 'handgun', 'shotgun'], camera: 'first-person', world: { id: 'ct-conscription-hero', feel: 'conscription' } } },
  'infinity-crisis': { says: 'the arena and hero shooter: the stylized pole, its kit, its feel', quick: { goal: 'deathmatch', bots: 1, pole: 'stylized', arms: ['rifle', 'smg'], camera: 'first-person', hero: {}, world: { id: 'ct-infinity', feel: 'infinity-crisis' } } },
  'cogs-of-combat': { says: 'the third-person cover shooter: over the shoulder, heavy bodies, a rifle and a shotgun', quick: { goal: 'shoot', foes: 1, hero: {}, arms: ['rifle', 'shotgun'], camera: 'third-person', world: { id: 'ct-cogs', feel: 'cogs-of-combat' } } },
  'steel-serpents': { says: 'the military sim\'s body over the shoulder: a careful walk, a sidearm and a sniper', quick: { goal: 'shoot', foes: 1, hero: {}, arms: ['handgun', 'sniper'], camera: 'third-person', world: { id: 'ct-serpents', feel: 'steel-serpents' } } },
  'pole-realistic': { says: 'the shooter pole alone at its realistic end (no feel): its own feet and its own gun', quick: { goal: 'deathmatch', bots: 1, pole: 'realistic', arms: ['rifle'], world: { id: 'ct-pole-r' } } },
  'pole-stylized': { says: 'the shooter pole alone at its stylized end (no feel)', quick: { goal: 'deathmatch', bots: 1, pole: 'stylized', arms: ['rifle'], world: { id: 'ct-pole-s' } } },
};

const FPS = 60, DT = 1 / FPS, E = composeLive();
export const BANDS = [5, 15, 30], MATTERS = ['brick', 'concrete', 'pine', 'sheet-metal', 'steel'];
const r2 = (v) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 100) / 100), r3 = (v) => Math.round(v * 1000) / 1000;
const flat = { ground: () => 0 };
const copy = (o) => JSON.parse(JSON.stringify(o));

// ── the game, minted: its pilot and its foe ──────────────────────────────────────────────────────────────────────────
export async function mint(name, quick) {
  const ref = `ct-${name}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
  const out = await designGameHandler({ quick, ref });
  if (out?.ok === false) throw new Error(`${name}: ${JSON.stringify(out).slice(0, 400)}`);
  const row = SketchRepository.getByRef(`${ref}-level-run-0`);
  if (!row) throw new Error(`${name}: no level run`);
  const { payload } = await resolveWorldScene(row);
  const pilot = payload.entities.find((e) => e.pilotable) ?? payload.entities.find((e) => e.id === 'player' || e.id === 'hero');
  const foe = payload.entities.find((e) => e !== pilot && e.body?.hittable && Number.isFinite(e.body?.hp));
  if (!pilot) throw new Error(`${name}: no pilot in the level`);
  return { pilot, foe, camera: payload.camera ?? null, payload };
}

// the pilot alone on a floor, its feet on it (a walker rides its eye over the floor; a body stands on it)
// (a pilot that rides its eye over the floor, a hero-less walker or platform body, stands at its eye: `rule.eye`)
const footZ = (rule) => rule.eye ?? (rule.type === 'walk' ? 1.7 : 0);
function soloWorld(pilot, extra = {}) {
  const p = { ...copy(pilot), id: 'p', pilotable: true, transform: { pos: [0, 0, footZ(pilot.rule)], heading: 0, pitch: 0 } };
  const w = E.createWorld({ entities: [p, ...(extra.entities ?? [])], colliders: extra.colliders ?? [], ...(extra.breakables ? { breakables: extra.breakables } : {}), ...(extra.rupa ? { rupa: extra.rupa } : {}) });
  for (let i = 0; i < 10; i++) E.stepWorld(w, {}, DT, flat);
  return { w, e: w.byId.p };
}
// the trigger as a player works it: an automatic held down, anything else pulled again and again (a press every other
// frame: each pull an edge, so a semi fires as fast as its cooldown lets it)
const trigger = (weapon, f) => (weapon.auto ? true : f % 2 === 0);
// THE PULL: a player pulls the climb back down. Each step, the aim is lowered by what the round's kick rose (and given back
// as it recovers), so a round leaves where the crosshair is and only the cone and the sway are between it and the mark;
// the climb itself is measured on its own (cones: `climb10`)
const DEG = Math.PI / 180;
function stepPulled(w, e, input) {
  const k0 = e.weapon?.kickNow ?? 0;
  E.stepWorld(w, input, DT, flat);
  e.transform.pitch -= ((e.weapon?.kickNow ?? 0) - k0) * DEG;
}
const hspeed = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) / DT;

// ── mobility ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function run(pilot, input, frames) {
  const { w, e } = soloWorld(pilot), v = [];
  for (let f = 0; f < frames; f++) { const p0 = [...e.transform.pos]; E.stepWorld(w, typeof input === 'function' ? input(f) : input, DT, flat); v.push(hspeed(p0, e.transform.pos)); }
  return { v, w, e };
}
function mobility(pilot) {
  const R = pilot.rule, M = {};
  // the run: forward held 2 s, then let go 2 s
  const { w, e } = soloWorld(pilot), v = [];
  let x0 = null, stopped = null;
  for (let f = 0; f < 240; f++) {
    const p0 = [...e.transform.pos], go = f < 120;
    if (f === 120) x0 = [...e.transform.pos];
    E.stepWorld(w, go ? { forward: 1 } : {}, DT, flat);
    v.push(hspeed(p0, e.transform.pos));
    if (!go && stopped === null && v[f] < 0.05) stopped = { frames: f - 120 + 1, metres: Math.hypot(e.transform.pos[0] - x0[0], e.transform.pos[1] - x0[1]) };
  }
  const top = Math.max(...v.slice(0, 120));
  M.top = r2(top);
  M.toTop = r3((v.findIndex((s) => s >= 0.95 * top) + 1) * DT);
  M.stop = stopped ? { s: r3(stopped.frames * DT), m: r2(stopped.metres) } : { s: '>2', m: null };
  // the counter-strafe: right held 1 s, then left: the time from full right to full left
  const S = run(pilot, (f) => ({ strafe: f < 60 ? 1 : -1 }), 150);
  const side = Math.max(...S.v.slice(0, 60));
  if (side < 0.05) M.strafe = null;
  else {
    // lateral velocity, signed, from the positions' y (heading 0: the body's left is +y, so the sign of the step is enough)
    const { w: w2, e: e2 } = soloWorld(pilot), vy = [];
    for (let f = 0; f < 150; f++) { const y0 = e2.transform.pos[1]; E.stepWorld(w2, { strafe: f < 60 ? 1 : -1 }, DT, flat); vy.push((e2.transform.pos[1] - y0) / DT); }
    const s0 = Math.sign(vy[59]) || 1, full = Math.abs(vy[59]);
    const k = vy.slice(60).findIndex((s) => Math.sign(s) === -s0 && Math.abs(s) >= 0.95 * full);
    M.strafe = { speed: r2(side), reverse: k < 0 ? '>1.5' : r3((k + 1) * DT) };
  }
  // the walk (held) and the boost (held): what each does to the run
  const walk = Math.max(...run(pilot, { forward: 1, walk: true }, 120).v);
  M.walk = Math.abs(walk - top) < 0.02 ? null : r2(walk);
  const boost = Math.max(...run(pilot, { forward: 1, boost: true }, 120).v);
  M.boost = Math.abs(boost - top) < 0.05 ? null : r2(boost);
  // the jump, out of the run, held: followed past its landing height (the floor falls away once it leaves), so the
  // arc says both how long it is (back at the take-off's height) and how far it CATCHES a lip a step lower (the rule
  // steps onto any top within its step of the feet, in the air too: a ledge is reached at the jump's height plus the
  // step, and a gap at the arc's reach a step down)
  if (R.type === 'platform' || R.jumpSpeed) {
    const stepH = R.step ?? 0.35, z0 = footZ(R);
    let open = false; const fall = { ground: () => (open ? -1e4 : 0) };
    const { w: w3, e: e3 } = soloWorld(pilot); let off = null, high = 0; const arc = [];
    for (let f = 0; f < 90; f++) E.stepWorld(w3, { forward: 1 }, DT, flat);
    for (let f = 0; f < 400; f++) {
      E.stepWorld(w3, { forward: 1, jump: f === 0, jumpHeld: true }, DT, fall);
      const z = e3.transform.pos[2] - z0;
      if (!off && z > 1e-4) { off = { x: e3.transform.pos[0] - e3.vel[0] * DT, f }; open = true; }
      if (off) { high = Math.max(high, z); arc.push([e3.transform.pos[0] - off.x, z]); if (z < -stepH - 0.2) break; }
    }
    // where the arc comes down through `up` (above the take-off; negative below)
    const at = (up) => { const k = arc.findIndex((q, i) => i > 0 && q[1] < up && arc[i - 1][1] >= up && arc.slice(0, i).some((p) => p[1] > up)); if (k < 1) return null; const [x0, z1] = arc[k - 1], [x1, z2] = arc[k]; return r2(x0 + ((x1 - x0) * (z1 - up)) / (z1 - z2)); };
    M.jump = off ? { height: r2(high), long: at(0), catch: at(-stepH), reach: r2(high + stepH), commit: r3(off.f * DT) } : null;
  } else M.jump = null;
  return M;
}

// what the game asked for: its feel's card (and its template's view and needs), else nothing
function asked(quick) {
  const feel = quick.world?.feel;
  if (!feel) return null;
  const F = readFeel(feel), card = feelCard(feel), P = POLES[F.pole];
  return { template: P?.name, after: P?.after, view: P?.view?.camera, ground: card.ground, jump: card.jump?.height, dodge: card.dodge?.kind ?? null, needs: P?.needs ?? [] };
}

// ── lethality ────────────────────────────────────────────────────────────────────────────────────────────────────────
// the foe stood at `d` m down the line of fire, its feet set so the line meets its body (`at` 'body': the chest) or its
// head; tracked across as the shooter strafes (the aim is perfect: what misses is the cone's)
const EGG = { a: 0.35, c: 0.9 };
function duel(pilot, slot, foe, d, { moving = false, aim = false, at = 'body', seconds = 15 } = {}) {
  const P = copy(pilot); P.rule.loadout = [copy(slot)]; P.weapon = copy(slot.weapon);
  const egg = foe?.body?.egg ?? { ...EGG, cz: EGG.c }, hp = foe?.body?.hp ?? 100;
  const eye = footZ(P.rule) + (P.weapon.eye ?? 0);
  const cz = Number.isFinite(egg.cz) ? egg.cz : egg.c, line = at === 'head' ? cz + egg.c * 0.75 : cz + egg.c * 0.3;
  // (a body needs its type, or the world stands it as none: the foe's own, else a plain figure)
  const dummy = { id: 'dummy', body: { type: foe?.body?.type ?? 'figure-rig', hittable: true, hp, radius: 0.5, egg: { ...egg } }, transform: { pos: [d, 0, eye - line], heading: Math.PI } };
  const { w, e } = soloWorld(P, { entities: [dummy] }), T = w.byId.dummy;
  // (aimed: the sights raised first, a second's lead, so the duel times the gun and not the arm's aim time, its own number)
  if (aim) for (let k = 0; k < FPS; k++) E.stepWorld(w, { aim: true }, DT, flat);
  let first = null, f = 0;
  const max = seconds * FPS;
  for (; f < max && T.body.hp > 0; f++) {
    const strafe = moving ? (Math.floor(f / 24) % 2 ? -1 : 1) : 0;
    stepPulled(w, e, { fire: trigger(P.weapon, f), ...(aim ? { aim: true } : {}), ...(strafe ? { strafe } : {}) });
    T.transform.pos[1] = e.transform.pos[1];
    if (first === null && e.weapon.shots > 0) first = f;
  }
  const shots = e.weapon.shots ?? 0;
  return T.body.hp > 0 ? { rounds: `>${shots}`, s: `>${seconds}` } : { rounds: shots, s: r2((f - (first ?? 0)) * DT) };
}
// the cone the runtime fired the first round in (degrees), and after ten rounds held
function cones(pilot, slot) {
  const P = copy(pilot); P.rule.loadout = [copy(slot)]; P.weapon = copy(slot.weapon);
  const fire = (lead, input, n) => {
    const { w, e } = soloWorld(P, { colliders: [{ min: [40, -50, -10], max: [41, 50, 50] }] });
    for (let f = 0; f < lead; f++) E.stepWorld(w, input(f, false), DT, flat);
    const out = [];
    for (let f = 0; f < 600 && out.length < n; f++) { const s0 = e.weapon.shots, k0 = e.weapon.kickNow ?? 0; E.stepWorld(w, input(f, true), DT, flat); if (e.weapon.shots > s0) out.push({ cone: e.weapon.lastCone ?? 0, climb: k0 }); }
    return out;
  };
  const t = (f, go) => go && trigger(P.weapon, f);
  const still = fire(30, (f, go) => ({ fire: t(f, go) }), 10);
  const moving = fire(30, (f, go) => ({ strafe: 1, fire: t(f, go) }), 1);
  const aimed = fire(60, (f, go) => ({ aim: true, fire: t(f, go) }), 1);
  // (the climb: the kick the round left on top of the aim, unpulled; the 10th round's is a spray's)
  return { first: r2(still[0]?.cone), moving: r2(moving[0]?.cone), aimed: r2(aimed[0]?.cone), spray10: still.length >= 10 ? r2(still[9].cone) : null, climb10: still.length >= 10 ? r2(still[9].climb) : null };
}

// ── destruction, as it is seen ───────────────────────────────────────────────────────────────────────────────────────
// The depiction, not the physics (the operator, 1108: "a visual depiction of destruction with reasonable plausibility"):
// rupa's SCARS on a wall that never breaks (`rupa.scars`, readScarsSpec: the wall's matter). Ten rounds at a wall 10 m off,
// each pulled; what marks they leave (a chip, a dent), how big, how deep, what spalls off, and whether each mark sits
// where its round stopped. The plausibility is the laws below: a mark for every round that met the wall, its kind the
// matter's (metal dents, the rest chips), a softer matter marked wider, a heavier round marking more.
function marks(pilot, slot, matter, { d = 10, rounds = 10 } = {}) {
  const P = copy(pilot); P.rule.loadout = [copy(slot)]; P.weapon = { ...copy(slot.weapon), magazine: 999, reserve: 0 };
  const wall = { min: [d, -2, 0], max: [d + 0.25, 2, 3], of: 'wall' };
  const { w, e } = soloWorld(P, { colliders: [wall], rupa: { scars: readScarsSpec({ wall: matter, ground: 'loam' }) } });
  const ends = [];
  for (let f = 0; f < 60 * FPS && ends.length < rounds; f++) {
    const s0 = e.weapon.shots;
    stepPulled(w, e, { fire: trigger(P.weapon, f) }); e.weapon.ammo = 999;
    if (e.weapon.shots > s0 && e.lastShot?.mode === 'miss' && e.lastShot.to && Math.abs(e.lastShot.to[0] - d) < 0.01) ends.push(e.lastShot.to);
  }
  const M = w.rupa?.scars?.marks ?? [];
  const placed = M.filter((m) => ends.some((q) => Math.hypot(q[0] - m.at[0], q[1] - m.at[1], q[2] - m.at[2]) < 0.01)).length;
  const mean = (k) => (M.length ? M.reduce((a, m) => a + (m[k] ?? 0), 0) / M.length : null);
  return {
    met: ends.length, marks: M.length, placed, kinds: [...new Set(M.map((m) => m.kind))],
    cm: r2(mean('radius') * 100), mm: r2(mean('depth') * 1000), spall: r2(M.length ? M.reduce((a, m) => a + (m.debris?.pieces?.length ?? m.debris?.length ?? 0), 0) / M.length : null),
  };
}

// ── switching and reloading ──────────────────────────────────────────────────────────────────────────────────────────
// the whole kit in hand, as the game ships it: from each gun to each other one, the time from the switch's press to the
// incoming gun's first round (the trigger worked the whole while, so nothing is lost to a late press); and each gun's
// reload: emptied, the time from its last round to its first again (the reload by itself), and three rounds in, the
// reload asked for (R) and the time to its next round
function untilShot(w, e, idx, input, most = 10 * FPS) {
  for (let f = 0; f < most; f++) { const s0 = e.weapon.shots; stepPulled(w, e, input(f)); if ((e.loadoutIdx || 0) === idx && e.weapon.shots > s0) return f; }
  return null;
}
function switching(pilot) {
  const lo = pilot.rule.loadout ?? [];
  if (lo.length < 2) return null;
  const pairs = {};
  for (let i = 0; i < lo.length; i++) for (let j = 0; j < lo.length; j++) {
    if (i === j || lo[i].weapon?.fireClass === 'lob' || lo[j].weapon?.fireClass === 'lob') continue;
    const { w, e } = soloWorld(pilot, { colliders: [{ min: [40, -50, -10], max: [41, 50, 50] }] });
    // in hand: slot i, settled (any switch it took is over)
    for (let f = 0; f < 3 * FPS; f++) E.stepWorld(w, f === 0 ? { slot: i + 1 } : {}, DT, flat);
    const f = untilShot(w, e, j, (k) => ({ ...(k === 0 ? { slot: j + 1 } : {}), fire: trigger(e.weapon, k) }));
    pairs[`${lo[i].name}→${lo[j].name}`] = { s: f == null ? '>10' : r3((f + 1) * DT), asked: r3(lo[j].switchReady ?? (lo[j].gunplay?.swap ? lo[j].gunplay.swap.out + lo[j].gunplay.swap.in : 0)) };
  }
  return pairs;
}
function reloading(pilot, slot) {
  const P = copy(pilot); P.rule.loadout = [copy(slot)]; P.weapon = copy(slot.weapon);
  const mag = P.weapon.magazine ?? 30, out = { asked: P.weapon.reload ?? null };
  // emptied: the gap from the magazine's last round to the next magazine's first
  { const { w, e } = soloWorld(P, { colliders: [{ min: [40, -50, -10], max: [41, 50, 50] }] }); let last = null;
    for (let f = 0; f < 30 * FPS; f++) { const s0 = e.weapon.shots; stepPulled(w, e, { fire: trigger(e.weapon, f) }); if (e.weapon.shots > s0) { if (e.weapon.shots === mag) last = f; if (e.weapon.shots === mag + 1) { out.empty = r3((f - last) * DT); break; } } } }
  // asked for: three rounds, R, then the gap to the next round
  { const { w, e } = soloWorld(P, { colliders: [{ min: [40, -50, -10], max: [41, 50, 50] }] }); let at = null;
    for (let f = 0; f < 30 * FPS; f++) {
      const s0 = e.weapon.shots, press = at === null && e.weapon.shots >= Math.min(3, mag - 1);
      if (press) at = f;
      stepPulled(w, e, press ? { reload: true } : { fire: at === null || f > at ? trigger(e.weapon, f) : false });
      if (at !== null && f > at && e.weapon.shots > s0) { out.asked3 = r3((f - at) * DT); out.refilled = e.weapon.ammo + 1 === mag; break; }
    } }
  return out;
}

// ── a game, measured ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function measureGame(name, G, minted = null) {
  const { pilot, foe } = minted ?? await mint(name, G.quick);
  const R = pilot.rule, slots = R.loadout?.length ? R.loadout : [{ name: 'gun', weapon: pilot.weapon }];
  const out = { game: name, says: G.says, rule: R.type ?? 'platform', camera: G.quick.camera ?? null, asked: asked(G.quick), foe: foe ? { hp: foe.body.hp } : null, mobility: mobility(pilot), slots: {} };
  for (const s of slots) {
    if (!s.weapon || s.weapon.fireClass === 'lob') { out.slots[s.name] = { skipped: s.weapon ? 'a travelling round (lob): its own measure, later' : 'no weapon' }; continue; }
    const ttk = {};
    for (const d of BANDS) ttk[d] = { still: duel(pilot, s, foe, d), moving: duel(pilot, s, foe, d, { moving: true }), aimed: duel(pilot, s, foe, d, { aim: true }), head: duel(pilot, s, foe, d, { at: 'head', aim: true }) };
    const walls = Object.fromEntries(MATTERS.map((m) => [m, marks(pilot, s, m)]));
    out.slots[s.name] = { dmg: s.weapon.damage, rof: s.weapon.rof ?? null, cooldown: s.weapon.cooldown ?? null, headshot: s.weapon.headshot ?? null, cone: cones(pilot, s), reload: reloading(pilot, s), ttk, walls };
  }
  out.switching = switching(pilot);
  return out;
}

// ── the gate: what a game asked for against what it does ─────────────────────────────────────────────────────────────
export function laws(m) {
  const L = [], law = (name, ok, info) => L.push({ name, ok: !!ok, ...(info !== undefined ? { info } : {}) });
  const A = m.asked, M = m.mobility;
  if (A) {
    law('the run is the card\'s', Math.abs(M.top - A.ground.run) <= 0.1, { card: A.ground.run, runtime: M.top });
    if (A.ground.accel) law('the run builds as the card says (time to it within 25%)', Math.abs(M.toTop - A.ground.run / A.ground.accel) <= 0.25 * (A.ground.run / A.ground.accel) + 2 * DT, { card: r3(A.ground.run / A.ground.accel), runtime: M.toTop });
    law('the sprint is carried', A.ground.sprint <= A.ground.run || (M.boost != null && Math.abs(M.boost - A.ground.sprint) <= 0.3), { card: A.ground.sprint, runtime: M.boost });
    law('the walk is the card\'s', A.ground.walk == null || (M.walk != null && Math.abs(M.walk - A.ground.walk) <= 0.1), { card: A.ground.walk, runtime: M.walk });
    if (A.jump) law('the jump is carried', M.jump && Math.abs(M.jump.height - A.jump) <= 0.1, { card: A.jump, runtime: M.jump?.height ?? null });
  }
  if (M.boost != null && M.boost > 2 * M.top) law('no person boosts at a mech\'s multiple', false, { run: M.top, boost: M.boost });
  law('a stop is finite (from the run to rest inside 2 s)', typeof M.stop.s === 'number');
  for (const [k, s] of Object.entries(m.slots)) {
    if (s.skipped) continue;
    law(`${k}: the cone widens on the move`, s.cone.moving > s.cone.first, s.cone);
    law(`${k}: the cone tightens aimed`, s.cone.aimed < s.cone.first, s.cone);
    if (s.rof) law(`${k}: a held spray blooms (the 10th round's cone wider than the first's)`, s.cone.spray10 > s.cone.first, s.cone);
    if (s.rof) law(`${k}: a held spray climbs (the 10th round leaves above the aim)`, s.cone.climb10 > 0.05, s.cone);
    const t = s.ttk[15];
    // (both aimed: a head is aimed for)
    // (a body dropped by one round leaves the head nothing to beat: it is enough that the head is no slower)
    if (s.headshot) law(`${k}: at 15 m, aimed, the head drops faster than the body`, typeof t.head.rounds === 'number' && typeof t.aimed.rounds === 'number' && (t.aimed.rounds > 1 ? t.head.rounds < t.aimed.rounds : t.head.rounds <= 1), { body: t.aimed.rounds, head: t.head.rounds });
  }
  const guns = Object.entries(m.slots).filter(([, s]) => !s.skipped);
  for (const [k, s] of guns) {
    const W = s.walls;
    law(`${k}: every round that met a wall left its mark there`, MATTERS.every((mt) => W[mt].met > 0 && W[mt].placed === W[mt].met), Object.fromEntries(MATTERS.map((mt) => [mt, `${W[mt].placed}/${W[mt].met}`])));
    law(`${k}: metal dents, masonry and wood chip`, ['steel', 'sheet-metal'].every((mt) => W[mt].kinds.join() === 'dent') && ['brick', 'concrete', 'pine'].every((mt) => W[mt].kinds.join() === 'chip'), Object.fromEntries(MATTERS.map((mt) => [mt, W[mt].kinds.join()])));
    law(`${k}: the softer wall takes the wider mark (brick over concrete over steel)`, W.brick.cm > W.concrete.cm && W.concrete.cm > W.steel.cm, Object.fromEntries(MATTERS.map((mt) => [mt, W[mt].cm])));
    if (s.reload.asked != null) {
      law(`${k}: an empty magazine reloads in the gun's time`, s.reload.empty != null && Math.abs(s.reload.empty - s.reload.asked) <= 0.1 + (s.cooldown ?? 1 / (s.rof || 10)), { asked: s.reload.asked, runtime: s.reload.empty });
      law(`${k}: a reload asked for (R) is carried, and refills`, s.reload.asked3 != null && Math.abs(s.reload.asked3 - s.reload.asked) <= 0.1 && s.reload.refilled, { asked: s.reload.asked, runtime: s.reload.asked3 ?? null, refilled: s.reload.refilled ?? null });
    }
  }
  if (guns.length > 1) {
    const by = (mt) => guns.map(([, s]) => s.walls[mt].cm);
    law('a heavier round leaves a bigger mark (the guns\' marks differ)', MATTERS.some((mt) => new Set(by(mt)).size > 1), Object.fromEntries(guns.map(([k, s]) => [k, { dmg: s.dmg, brickCm: s.walls.brick.cm }])));
  }
  if (m.switching) {
    for (const [pair, v] of Object.entries(m.switching)) law(`switch ${pair} in the arm's own time (stow and draw)`, typeof v.s === 'number' && Math.abs(v.s - v.asked) <= 0.1, v);
    const into = (k) => Object.entries(m.switching).filter(([p]) => p.endsWith(`→${k}`)).map(([, v]) => v.s).find((v) => typeof v === 'number');
    const side = guns.find(([k]) => /handgun|revolver/.test(k)), long = guns.find(([k]) => /rifle|sniper|marksman|shotgun/.test(k));
    if (side && long) law('a sidearm is drawn faster than a long gun', into(side[0]) < into(long[0]), { [side[0]]: into(side[0]), [long[0]]: into(long[0]) });
  }
  return L;
}

// ── the readout ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function print(m, L) {
  const A = m.asked, M = m.mobility;
  console.log(`\n━━ ${m.game}: ${m.says}`);
  console.log(`   rule ${m.rule} · camera ${m.camera ?? 'the goal\'s'} · foe hp ${m.foe?.hp ?? '–'}${A ? ` · template ${A.template} (after ${A.after}, viewer ${A.view})` : ''}`);
  console.log(`   mobility  run ${M.top} m/s in ${M.toTop} s · stop ${M.stop.s} s over ${M.stop.m} m · strafe ${M.strafe ? `${M.strafe.speed} m/s, reversed in ${M.strafe.reverse} s` : 'none'} · walk ${M.walk ?? '–'} · boost ${M.boost ?? '–'} · jump ${M.jump ? `${M.jump.height} m high (a ledge of ${M.jump.reach} m with the step), ${M.jump.long} m long (${M.jump.catch} m to a lip a step down), ${M.jump.commit} s to leave` : 'none'}`);
  if (A) console.log(`   the card  walk ${A.ground.walk} · run ${A.ground.run} · sprint ${A.ground.sprint} · accel ${A.ground.accel} · decel ${A.ground.decel} · jump ${A.jump} m · dodge ${A.dodge ?? '–'}${A.needs.length ? `\n   needs     ${A.needs.join('; ')}` : ''}`);
  for (const [k, s] of Object.entries(m.slots)) {
    if (s.skipped) { console.log(`   ${k}: ${s.skipped}`); continue; }
    console.log(`   ${k}  dmg ${s.dmg} · ${s.rof ? `${s.rof}/s` : `every ${s.cooldown} s`}${s.headshot ? ` · head ×${s.headshot}` : ''} · cone ${s.cone.first}° still, ${s.cone.moving}° moving, ${s.cone.aimed}° aimed, ${s.cone.spray10 ?? '–'}° at the 10th · climb ${s.cone.climb10 ?? '–'}° under the 10th`);
    for (const d of BANDS) { const t = s.ttk[d]; console.log(`      ${String(d).padStart(2)} m  still ${t.still.rounds} rds ${t.still.s} s · moving ${t.moving.rounds} rds ${t.moving.s} s · aimed ${t.aimed.rounds} rds ${t.aimed.s} s · aimed at the head ${t.head.rounds} rds ${t.head.s} s`); }
    console.log(`      reload ${s.reload.asked} s asked · emptied ${s.reload.empty ?? '–'} s · on R ${s.reload.asked3 ?? '–'} s`);
    console.log(`      marks (ten rounds at a wall 10 m off)  ${MATTERS.map((mt) => { const W = s.walls[mt]; return `${mt} ${W.kinds.join('/') || 'none'} ${W.cm} cm ${W.mm} mm, ${W.spall} spalls`; }).join(' · ')}`);
  }
  if (m.switching) console.log(`   switching  ${Object.entries(m.switching).map(([k, v]) => `${k} ${v.s} s (asked ${v.asked})`).join(' · ')}`);
  for (const l of L) console.log(`   ${l.ok ? 'PASS' : 'FAIL'} ${l.name}${l.info !== undefined ? `  ${JSON.stringify(l.info)}` : ''}`);
}

// ── the command line (when run, not imported: gym.mjs imports the measures) ───────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
async function main() {
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const jsonOut = opt('--json'), quickArg = opt('--quick'), twice = flag('--twice');
const chosen = quickArg ? { mine: { says: 'a recipe of your own', quick: JSON.parse(quickArg) } } : Object.fromEntries((args.length ? args : Object.keys(GAMES)).map((k) => { if (!GAMES[k]) throw new Error(`no game '${k}' (${Object.keys(GAMES).join(', ')})`); return [k, GAMES[k]]; }));
const all = [];
for (const [name, G] of Object.entries(chosen)) {
  try {
    const m = await measureGame(name, G), L = laws(m);
    print(m, L);
    if (twice) { const again = await measureGame(`${name}`, G); console.log(`   ${JSON.stringify(again) === JSON.stringify(m) ? 'PASS' : 'FAIL'} deterministic: measured twice, byte-equal`); }
    all.push({ ...m, laws: L });
  } catch (err) { console.log(`\n━━ ${name}: could not be measured: ${err.message}`); all.push({ game: name, error: err.message }); }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
process.exit(0);
}
