/**
 * THE DAMAGE RING — where the fire is coming from. Each hit the pilot takes marks a ring round the aim at its attacker's
 * bearing from where the pilot faces: the top of the ring is ahead, the bottom behind, the sides its sides. A mark
 * stands for a moment of the scene's own clock (begun again by another hit from the same one), follows its attacker
 * while it stands, and turns with the pilot, so turning until the mark is at the top faces the shooter. A hit nobody
 * dealt (a hazard's, a blast's) marks nothing: there is no bearing to show.
 *
 * One concept, read the same way wherever it is drawn: the pilot's own count of hits taken and who dealt the last (the
 * runtime's, worlds/controllable: `hits`, `lastHitBy`).
 *   - a mission draws it on mana-ui (mission-mana.js: the damage-direction idiom, in its HUD);
 *   - a level whose HUD is the page's own (a quick shooter's trail, a deathmatch) draws it through the page's damage ring
 *     channel (scene/channels/damage-ring.js), opt-in on a world's `damageRing`; absent, nothing is added.
 *
 *   RING                       its numbers: how long a mark stands (s), how many at once
 *   hitBearing(pos, heading, from) → degrees clockwise from where a body faces to where a hit came from (0 ahead, 90 its
 *                                right, 180 behind, 270 its left), to the whole degree
 *   ringTracker(cfg, bearing)  → { step(W, me) → [{ bearing, fade }] } the marks standing this frame, the newest first, each
 *                                with the share of its life it has left (page
 *                                code: inlined with toString(), it references nothing outside itself)
 *   readDamageRing(v, at)      a world's `damageRing` as written: true | { life?, most? } → { life, most }; throws, teaching
 *   damageRingSource(cfg)      → the block the page's channel splices: the ring drawn in the page's own DOM
 *
 * The page's side only: it imports nothing (the scene's emitter reads it through its channel).
 */
export const RING = Object.freeze({ life: 1.6, most: 6 });

/** Where a hit came from, as the ring marks it: degrees clockwise from where the body faces (its heading, radians,
 * counter-clockwise from +x) to the place it came from, 0 to 359. */
export function hitBearing(pos, heading, from) {
  const rel = Math.atan2(from[1] - pos[1], from[0] - pos[0]) - (heading || 0);
  return ((Math.round((-rel * 180) / Math.PI) % 360) + 360) % 360;
}

/** The ring's state, stepped off the scene: who has hit the pilot lately (by id: where it stood, when). */
export function ringTracker(cfg, bearing) {
  const by = {};
  let hits0 = null;
  return {
    step(W, me) {
      if (!W || !me || !me.transform) return [];
      const h = me.hits || 0, t = W.time || 0;
      if (hits0 == null) hits0 = h;
      if (h > hits0) {
        const id = me.lastHitBy == null ? null : String(me.lastHitBy), who = id != null && W.byId ? W.byId[id] : null;
        if (who && who !== me && who.transform) by[id] = { at: who.transform.pos.slice(), t };
      }
      hits0 = h;
      const live = [];
      for (const id of Object.keys(by)) {
        const r = by[id];
        if (t - r.t > cfg.life || t < r.t) { delete by[id]; continue; }
        // (where it stands now while it still stands, so the mark follows it; where it stood when it has gone)
        const who = W.byId ? W.byId[id] : null;
        if (who && who.transform && !who.dormant) r.at = who.transform.pos.slice();
        live.push({ t: r.t, bearing: bearing(me.transform.pos, me.transform.heading, r.at) });
      }
      live.sort((a, b) => b.t - a.t);
      // (and how much of its life it has left, 0..1 in tenths: a mark fades as it ages)
      return live.slice(0, cfg.most).map((x) => ({ bearing: x.bearing, fade: Math.round(Math.max(0, 1 - (t - x.t) / cfg.life) * 10) / 10 }));
    },
  };
}

/** A world's `damageRing`, read. */
export function readDamageRing(v, at = 'damageRing') {
  if (v === true) return { life: RING.life, most: RING.most };
  const no = (m) => { throw new Error(`${at}${m}`); };
  if (!v || typeof v !== 'object' || Array.isArray(v)) no(' is true, or { life?, most? }: the damage ring (where a hit came from, on a ring round the aim)');
  for (const k of Object.keys(v)) if (k !== 'life' && k !== 'most') no(`.${k} is not a damage ring setting (life, most)`);
  if (v.life !== undefined && !(Number.isFinite(v.life) && v.life >= 0.3 && v.life <= 6)) no('.life is the seconds a mark stands, 0.3 to 6');
  if (v.most !== undefined && !(Number.isInteger(v.most) && v.most >= 1 && v.most <= 12)) no('.most is how many marks at once, 1 to 12');
  return { life: v.life ?? RING.life, most: v.most ?? RING.most };
}

// the page's code for a level whose HUD is the page's own: the ring as a few bars in a fixed square round the aim, each
// lying along the ring where its hit came from (the same place and turn mana-ui's ring gives a mark)
function ringDom(cfg) {
  const T = __drTracker(cfg, __drBearing), root = document.createElement('div');
  root.id = '__damageRing';
  root.style.cssText = 'position:fixed;left:50%;top:50%;width:min(46vh,46vw);height:min(46vh,46vw);transform:translate(-50%,-50%);pointer-events:none;z-index:11';
  document.body.appendChild(root);
  let shown = '';
  const st = { hits: [] };
  (function frame() {
    const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.entities.find((e) => e.pilotable);
    if (W && me) {
      st.hits = T.step(W, me);
      // (a mark is redrawn when it has moved five degrees)
      const now = st.hits.map((x) => Math.round(x.bearing / 5)).join(',');
      if (now !== shown) {
        shown = now;
        while (root.firstChild) root.removeChild(root.firstChild);
        for (const x of st.hits) {
          const t = (x.bearing * Math.PI) / 180, m = document.createElement('i');
          m.style.cssText = 'position:absolute;width:26%;height:3.2%;border-radius:999px;background:var(--moj-harm,#e0533f);box-shadow:0 0 14px 2px var(--moj-harm,#e0533f);opacity:.92;left:' + (50 + 45 * Math.sin(t)).toFixed(2) + '%;top:' + (50 - 45 * Math.cos(t)).toFixed(2) + '%;transform:translate(-50%,-50%) rotate(' + Math.round(x.bearing) + 'deg)';
          root.appendChild(m);
        }
      }
    }
    requestAnimationFrame(frame);
  })();
  // for a headless driver
  window.__mojDamageRing = st;
}

/** The block the page's damage ring channel splices: the tracker, the bearing and the ring's DOM, in a scope of its own. */
export function damageRingSource(cfg) {
  const C = readDamageRing(cfg === undefined ? true : cfg);
  return `{
const __drBearing = ${hitBearing.toString()};
const __drTracker = ${ringTracker.toString()};
(${ringDom.toString()})(${JSON.stringify(C)});
}`;
}
