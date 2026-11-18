/**
 * THE LENS'S FEED — what the HUD host hands mana-ui's lens each frame (a spec's `lens`, mana-ui/kernel.js `strike`): the
 * foes just struck, each at its place on the screen. Pure and import-free: the page embeds its source as it is.
 *
 *   lensStep(L, W, now, project, { hold?, most? }) → rows [{ id, n, x, y, r, power }]
 *     L        its memory across frames: { seen: { id: hits }, hp: { id: hp }, live: { id: { n, t0, power } } } (lensMemory)
 *     W        the controllable world (window.__mojCtrl.world): its entities, its pilot, its tempo
 *     project  (entity) → { x, y, r } on the screen (0..1, y down; r the body's radius as a share of the screen's height)
 *              or null (behind the camera, off the screen): the page's, on its own camera
 *     hold     seconds a strike is drawn after its hit (the strike's own `seconds`)
 *
 * What it answers, and what it leaves to the world (they never overlap):
 *   a foe's hit counted once (its `hits` going up: the runtime stamps it on every melee, ranged, sweep and beam hit),
 *   its power from the hit's damage against its health (`lastHitDmg` where the hit says, else its health's drop),
 *   followed on the screen while its strike plays. Never the pilot or the pilot's side (their hurt is the HUD's peril
 *   edge and damage ring), and nothing while a world moment plays (a tempo look: its own full-screen flash, invert,
 *   zoom and shake answer that hit): the lens stands down rather than double it.
 */
export function lensMemory() { return { seen: {}, hp: {}, live: {} }; }

export function lensStep(L, W, now, project, { hold = 0.42, most = 6 } = {}) {
  if (!W || !Array.isArray(W.entities)) return [];
  const pilot = W.byId && W.pilotId ? W.byId[W.pilotId] : null, side = pilot && pilot.team ? pilot.team : null;
  const moment = !!(W.tempo && W.tempo.playing);
  for (const e of W.entities) {
    if (!e || !e.transform || e.gone || e.id === W.pilotId || (side && e.team === side)) continue;
    const n = e.hits || 0, was = L.seen[e.id], hp = e.body && Number.isFinite(e.body.hp) ? e.body.hp : Number.isFinite(e.hp) ? e.hp : null, before = L.hp[e.id];
    L.seen[e.id] = n;
    if (hp !== null) L.hp[e.id] = hp;
    if (was === undefined || n <= was || moment) continue;
    const max = e.hpMax || (e.body && e.body.hpMax) || null;
    const dmg = Number.isFinite(e.lastHitDmg) && e.lastHitDmgN === n ? e.lastHitDmg : hp !== null && before !== undefined ? before - hp : null;
    const power = dmg !== null && max ? Math.max(0.3, Math.min(1, 0.3 + (2.5 * dmg) / max)) : 0.6;
    L.live[e.id] = { n, t0: now, power: Math.round(power * 100) / 100 };
  }
  const rows = [];
  for (const id in L.live) {
    const h = L.live[id], e = W.byId ? W.byId[id] : null;
    if (!e || e.gone || now - h.t0 > hold) { delete L.live[id]; continue; }
    const p = project(e);
    if (!p || p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1) continue;
    // (to the thousandth: a foe standing still asks the HUD for no new frame)
    const q = (v) => Math.round(v * 1000) / 1000;
    rows.push({ id, n: h.n, x: q(p.x), y: q(p.y), r: q(p.r), power: h.power });
  }
  return rows.slice(Math.max(0, rows.length - most));
}
