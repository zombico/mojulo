import { safeJson } from '../emit-util.js';

// the facts a frame's lesson is done by (its state: rules-frame.js), beside the walk's move, look, jump and sprint
const FRAME_FACTS = new Set(['boost', 'quick-boost', 'climb', 'assault-boost', 'lock']);

// In-page script: THE GUIDE (level/guide.js, a sketched map's page): the level's INTRO and THE WAY ON, a beat at a time.
// ONE THING AT A TIME, in one place at the top of the screen, by what the moment asks:
//   a beat's line said on reaching it (`says`: a meet's words, a find's item), for a few seconds
//   the intro (the pitch) as the page opens, then the arrival's keys (`introKeys`)
//   or THE LESSONS (`lessons`: how a game starts), the controls explained with the hero in hand: one key line at a
//     time, its place in the run beside it, kept until the pilot does it (moves a few metres, turns the camera, leaves
//     the ground, runs at its sprint) and has had a moment to read it, or its patience runs out; then the way on
//   at a held way (`held`) while a foe stands on the page: that it is held
//   near a beat that teaches (`keys`), or in its fight (wherever its foes have come to the hero): its keys, each a cap
//   else the way on: an arrow turned the way the beat lies from where the camera looks, its words, the metres to it
// Never two at once. A pillar of light stands where the beat is (the world's own marker, not the screen's), a place to
// go to: a FIGHT has none (its foes are what is looked at, and they move: a light on a foe is a marker on a body). A beat
// is reached within its radius (a fight once its foes about it are down); the last one reached, the way is the page's.
// Its words sit on the scene, outlined, never on a card. It reads the pilot and the cast through window.__mojCtrl (the
// controllable channel's), so it waits for it. Emitted only when the page has a guide: every other page byte-identical.
// A guide that goes ROUND (`loop`: the step it returns to after its last, a standing job's pick-up: gameworld/city-guide.js)
// one whose step is reached by being in a car (a step's `cab`), one waited on (a step's `when`: a bus var set, a task taken on the phone), and one with its own last word (`done`, in place of "the way on lies past this place": an open city's) say so; a guide
// with none of them is as it was, byte for byte. `host` (a page whose guide is drawn by mana-ui, guide-mana.js): this
// line stays down for that host as it does for the HUD grammar; unasked, not a byte.
/** A scan's ring (a step's `ring`): its edge's width (a share of its radius), its lift off the ground (m), its opacity at
 *  rest and stood in, the pulses in flight at once, each from the edge to `least` of the radius over `period` s. */
export const GUIDE_RING = Object.freeze({ color: '#ffd36b', edge: 0.025, lift: 0.6, rest: 0.35, held: 0.85, pulses: 3, period: 1.4, least: 0.12 });

export function guideScript(guide, { host = false } = {}) {
  // (a scan's ring: emitted only where a step asks for one)
  const rings = Array.isArray(guide.steps) && guide.steps.some((x) => x && x.ring);
  // (a frame's lessons, gameworld/frame-goal.js FRAME_LESSONS: their facts read off the frame's own state, and a lesson
  // that waits for its task, `when`; a guide with neither is as it was, byte for byte)
  const L0 = Array.isArray(guide.lessons) ? guide.lessons : [];
  const frameFacts = L0.some((l) => FRAME_FACTS.has(l.fact) || /^fire-/.test(l.fact || '')), waits = L0.some((l) => l.when);
  // (STRICT: a lesson waits for the pilot to do it, however long, and no count of them is shown: a level that teaches
  // its controls as it is played, the player getting each right before the next; absent, a lesson is let go after its
  // patience and numbered, as it was)
  const strict = guide.strict === true;
  return `
// --- the guide: the level's intro and the way on, one thing at a time (level/guide.js) ---
(function () {
  const GD = ${safeJson(guide)};${rings ? ` const GR = ${JSON.stringify(GUIDE_RING)};` : ''}
  const host = (typeof wrap !== 'undefined' && wrap) || document.body;
  const sheet = document.createElement('style');
  sheet.textContent = '.moj-gd{position:absolute;left:50%;top:22px;transform:translateX(-50%);pointer-events:none;z-index:14;max-width:min(640px,86%);text-align:center;color:#fbf6e9;text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 10px rgba(0,0,0,.6);transition:opacity .35s ease;font:600 17px/1.35 system-ui,sans-serif;letter-spacing:.3px}'
    + '.moj-gd.off{opacity:0}.moj-gd .ar{display:inline-block;margin-right:10px;color:#f2c75c;transition:transform .08s linear}.moj-gd .m{margin-left:10px;opacity:.75;font-weight:500;font-size:14px}'
    + '.moj-gd.intro{top:28%;font:500 22px/1.45 Georgia,serif;letter-spacing:.2px}.moj-gd.say{top:auto;bottom:24%;font:500 18px/1.45 Georgia,serif}'
    + '.moj-gd .cap{display:inline-block;min-width:1.6em;margin:0 4px;padding:2px 7px;border:1.5px solid rgba(251,246,233,.9);border-bottom-width:3px;border-radius:5px;font:700 14px/1.2 ui-monospace,Menlo,monospace;background:rgba(10,8,6,.35);text-shadow:none}'
    + '.moj-gd .kw{margin:0 14px 0 4px;letter-spacing:1px;text-transform:uppercase;font-size:14px}';
  document.head.appendChild(sheet);
  const slot = document.createElement('div'); slot.className = 'moj-gd off'; host.appendChild(slot);${Number.isFinite(guide.top) ? `
  // (its line lower down, \`top\`: under a standing line of the level's own, the objectives')
  slot.style.top = '${Math.round(guide.top)}px';` : ''}
  // (what is up, and its text: redrawn only when it changes)
  let shown = '', mode = '';
  // (what it says, as data: a HUD that has its own card lane draws it, hud-grammar.js, and this line stays down)
  const V = { mode: '', text: '', keys: [], goal: null };
  function put(m, html, text, keys) {
    V.mode = m; V.text = text || ''; V.keys = keys || [];
    if (window.__mojHudGrammar${host ? ' || window.__mojGuideHost' : ''}) { if (shown !== '') { shown = ''; slot.className = 'moj-gd off'; slot.innerHTML = ''; } return; }
    if (m === mode && html === shown) return; mode = m; shown = html; slot.className = 'moj-gd ' + m + (html ? '' : ' off'); slot.innerHTML = html;
  }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // (a key line, 'F F  dodge · …': the keys before the double space as caps, the rest the words)
  const capped = (line) => { const i = line.indexOf('  '); if (i < 0) return '<span class="kw">' + esc(line) + '</span>'; return line.slice(0, i).split(' ').map((k) => '<span class="cap">' + esc(k) + '</span>').join('') + '<span class="kw">' + esc(line.slice(i + 2)) + '</span>'; };
  const LS = GD.lessons && GD.lessons.length ? GD.lessons : null, after = LS ? 'lessons' : GD.introKeys && GD.introKeys.length ? 'keys0' : 'play';
  // (a lesson: read for LESSON.read seconds at least, done by its fact, let go after LESSON.patience)
  const LESSON = { read: 1.4, patience: 14, plain: 5, move: 3, look: 0.9, sprint: 0.6 };
  let li = 0, ls = null;
  let k = 0, pillar = null, ringOn = null, up = false, phase = GD.intro ? 'intro' : after, sayText = '', sayUntil = 0;
  const T3 = typeof THREE !== 'undefined' ? THREE : null, S3 = typeof scene !== 'undefined' ? scene : null;
  function plant() {
    if (!T3 || !S3) return;
    if (pillar) { S3.remove(pillar); pillar = null; }${rings ? `
    if (ringOn) { S3.remove(ringOn.g); ringOn = null; }` : ''}
    const s = GD.steps[k]; if (!s || s.fight) return;${rings ? `
    // (a place held to be read, a scan's, \`ring\`: its ring on the ground, and while it is stood in, rings pulsing in from
    // it toward its middle, one after another, until its clock is run: GUIDE_RING)
    if (s.ring) {
      const g = new T3.Group(), mk = (w, o) => { const m = new T3.Mesh(new T3.RingGeometry(1 - w, 1, 96), new T3.MeshBasicMaterial({ color: GR.color, transparent: true, opacity: o, depthWrite: false, depthTest: false, side: T3.DoubleSide })); m.renderOrder = 3; m.raycast = function () {}; g.add(m); return m; };
      const edge = mk(GR.edge, GR.rest), pulses = Array.from({ length: GR.pulses }, () => mk(GR.edge * 1.6, 0));
      g.position.set(s.at[0], s.at[1], s.at[2] + GR.lift); g.scale.setScalar(s.radius); S3.add(g);
      ringOn = { g, edge, pulses };
    }` : ''}
    pillar = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 60, 12, 1, true), new T3.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.28, depthWrite: false, side: T3.DoubleSide }));
    pillar.rotation.x = Math.PI / 2; pillar.position.set(s.at[0], s.at[1], s.at[2] + 30); pillar.raycast = function () {};
    S3.add(pillar);
  }
  // (the opening's seconds counted from when the world is up, not from the page's parse)
  function begin() { up = true; plant(); if (phase === 'intro') setTimeout(() => { phase = after; if (phase === 'keys0') setTimeout(() => { phase = 'play'; }, 5000); }, 6500); else if (phase === 'keys0') setTimeout(() => { phase = 'play'; }, 5000); }
  // (a lesson watched: what the pilot has done since it came up, read off its own state and the camera's)
  function lesson(p, now) {
    const L = LS[li], x = p.transform.pos[0], y = p.transform.pos[1];
    let yaw = p.transform.heading;
    if (view && typeof camera !== 'undefined') { camera.getWorldDirection(view); yaw = Math.atan2(view.y, view.x); }
    if (!ls) ls = { t0: now, last: now, x, y, yaw, moved: 0, turned: 0, fast: 0, air: false };
    const dt = Math.min(0.1, (now - ls.last) / 1000), step = Math.hypot(x - ls.x, y - ls.y), run = (p.rule && (p.rule.boostSpeed || p.rule.sprintSpeed)) || 0, walk = (p.rule && p.rule.speed) || 4;
    ls.moved += step; ls.turned += Math.abs(Math.atan2(Math.sin(yaw - ls.yaw), Math.cos(yaw - ls.yaw)));
    if (dt > 0 && (p.sprinting || p.boosting || step / dt > (run > walk ? (run + walk) / 2 : walk * 1.15))) ls.fast += dt;
    if (p.grounded === false && p.vel && p.vel[2] > 0.5) ls.air = true;
    ls.last = now; ls.x = x; ls.y = y; ls.yaw = yaw;
    const age = (now - ls.t0) / 1000;
${frameFacts ? `    // (a frame's: its boost held a moment, a quick boost or a charge begun, the climb held, the sight locked, a slot's
    // rounds gone; its jump off the ground by its own state)
    if (!ls.shots) ls.shots = Object.fromEntries(Object.entries((p.rule && p.rule.slots) || {}).map(([k, w]) => [k, (w && w.st && w.st.shots) || 0]));
    if (p.boosting) ls.boost = (ls.boost || 0) + dt;
    if (p.ascending) ls.climb = (ls.climb || 0) + dt;
    if (p.airborne && p.v && p.v[2] > 0.5) ls.air = true;
    const fired = (k) => { const w = p.rule && p.rule.slots && p.rule.slots[k]; return !!(w && w.st && (w.st.shots || 0) > (ls.shots[k] || 0)); };
    const frameDone = L.fact === 'boost' ? (ls.boost || 0) >= 0.6 : L.fact === 'quick-boost' ? (p.qbT || 0) > 0 : L.fact === 'climb' ? (ls.climb || 0) >= 0.5
      : L.fact === 'assault-boost' ? !!p.ab : L.fact === 'lock' ? !!p.locked : /^fire-/.test(L.fact || '') ? fired(L.fact.slice(5)) : null;
` : ''}    const done = ${frameFacts ? 'frameDone !== null ? frameDone : ' : ''}L.fact === 'move' ? ls.moved >= LESSON.move : L.fact === 'look' ? ls.turned >= LESSON.look : L.fact === 'jump' ? ls.air : L.fact === 'sprint' ? ls.fast >= LESSON.sprint : age >= LESSON.plain;
    // (strict: the lesson done is said on the level's bus, \`lesson:<fact>\`, so an objective can wait for it: game/objectives.js \`act\`)
    if ((done && age >= LESSON.read)${strict ? '' : ' || age >= LESSON.patience'}) { ${strict ? "if (done && L.fact) { try { __inputQueue.push({ type: 'lesson:' + L.fact }); } catch (err) { /* (no bus on the page) */ } } " : ''}li++; ls = null; if (li >= LS.length) phase = 'play'; }
  }
  const standing = (e) => e.team === 'foes' && !e.gone && !e.dormant && !e.downed && !(e.hp <= 0);
  // (a foe fallen: what a fight that counts its falls is won by; one asleep or sent away has not fallen)
  const fell = (e) => e.team === 'foes' && !e.dormant && (e.downed || e.hp <= 0 || (e.body && e.body.hp <= 0));
  const view = T3 ? new T3.Vector3() : null;
  function tick() {
    const W = window.__mojCtrl && window.__mojCtrl.world;
    if (W) {
      if (!up) begin();
      const p = (W.pilotId && W.byId[W.pilotId]) || W.entities.find((e) => e.pilotable), s = GD.steps[k];
      let dx = 0, dy = 0, d = Infinity, near = false;
      if (p && s) {
        dx = s.at[0] - p.transform.pos[0]; dy = s.at[1] - p.transform.pos[1]; d = Math.hypot(dx, dy);
        near = s.fight ? W.entities.some((e) => standing(e) && Math.hypot(e.transform.pos[0] - s.at[0], e.transform.pos[1] - s.at[1]) < s.radius) : false;
        // (a fight that counts its falls is won by them, wherever it was fought; any other beat by reaching it)
        const won = ${guide.steps.some((x) => x && x.cab) ? 's.cab ? !!(p.mount && p.mount.cab) : ' : ''}${guide.steps.some((x) => x && x.when) ? (guide.steps.some((x) => x && x.when && typeof x.when === 'object') ? 's.when ? !!(window.__mojBus && (typeof s.when === \'object\' ? window.__mojBus.state.vars[s.when.var] >= s.when.gte : window.__mojBus.state.vars[s.when] >= 1)) : ' : 's.when ? !!(window.__mojBus && window.__mojBus.state.vars[s.when] >= 1) : ') : ''}s.downs ? W.entities.filter(fell).length >= s.downs : d < s.radius && !near;
        if (won) { if (s.says) { sayText = s.says; sayUntil = performance.now() + 4500; } k++;${Number.isInteger(guide.loop) ? ' if (k >= GD.steps.length) k = GD.loop;' : ''} plant(); }
      }
      const now = performance.now(), cur = GD.steps[k];${guide.steps.some((x) => x && x.from) ? `
      // (a step held back until its task begins, \`from\`: neither its way nor its pillar shown before)
      const gated = !!(cur && cur.from && !(window.__mojBus && window.__mojBus.state.vars[cur.from.var] >= cur.from.gte));
      if (pillar) pillar.visible = !gated;` : ''}${rings ? `
      if (ringOn && cur) {
        const shown = ${guide.steps.some((x) => x && x.from) ? '!gated' : 'true'}, inside = shown && p && Math.hypot(cur.at[0] - p.transform.pos[0], cur.at[1] - p.transform.pos[1]) < cur.radius;
        ringOn.g.visible = shown; ringOn.edge.material.opacity = inside ? GR.held : GR.rest;
        ringOn.pulses.forEach(function (m, i) {
          const u = (((now / 1000) / GR.period) + i / GR.pulses) % 1;
          m.scale.setScalar(1 - (1 - GR.least) * u); m.material.opacity = inside ? GR.held * (1 - u) * Math.min(1, u * 6) : 0;
        });
      }` : ''}
      // (the lessons give way to a fight: a foe come within a few strides is the trail begun, its own keys the ones to show)
      if (phase === 'lessons' && p && W.entities.some((e) => standing(e) && Math.hypot(e.transform.pos[0] - p.transform.pos[0], e.transform.pos[1] - p.transform.pos[1]) < 10)) { li = LS.length; ls = null; phase = 'play'; }
${waits ? `      // (a lesson that waits for its task, \`when\`: the objectives' task in hand; until then nothing of it shows)
      const waitsNow = () => phase === 'lessons' && !!LS[li] && !!LS[li].when && !(window.__mojBus && window.__mojBus.state.vars[LS[li].when.var] >= LS[li].when.gte);
      if (phase === 'lessons' && p && !waitsNow()) lesson(p, now);
      // (read again once a lesson may have passed: the next may wait; while one waits the way on is shown, not hidden)
      const waiting = waitsNow();` : `      if (phase === 'lessons' && p) lesson(p, now);`}
      const atHeld = p && GD.held && GD.held.some((h) => Math.hypot(h[0] - p.transform.pos[0], h[1] - p.transform.pos[1]) < 5) && W.entities.some(standing);
      // ONE THING: the line just said, the opening, a held way, a lesson at hand, else the way on
      V.goal = cur ? { say: cur.say, at: cur.at, d: Math.round(d) } : null;
      if (now < sayUntil) put('say', esc(sayText), sayText);
      else if (phase === 'intro') put('intro', esc(GD.intro), GD.intro);
      else if (phase === 'lessons'${waits ? ' && !waiting' : ''}) put('keys', ${strict ? '' : `'<span class="m" style="margin:0 12px 0 0">' + (li + 1) + ' / ' + LS.length + '</span>' + `}capped(LS[li].keys), '', [LS[li].keys]);
      else if (phase === 'keys0') put('keys', GD.introKeys.map(capped).join(''), '', GD.introKeys);
      else if (atHeld) put('held', 'The way on is held while foes stand here', 'The way on is held while foes stand here');
      // (a lesson at hand: near its place, or its fight come to the hero: a foe standing within a few strides)
      else if (cur && cur.keys && cur.keys.length && p && (d < Math.max(cur.radius * 2, 18) || (cur.fight && W.entities.some((e) => standing(e) && Math.hypot(e.transform.pos[0] - p.transform.pos[0], e.transform.pos[1] - p.transform.pos[1]) < 14)))) put('keys', cur.keys.map(capped).join(''), '', cur.keys);
${guide.steps.some((x) => x && x.from) ? "      else if (gated) put('way', '', '');\n" : ''}      else if (!cur) put('way', ${typeof guide.done === 'string' ? 'esc(GD.done), GD.done' : "'The way on lies past this place', 'The way on lies past this place'"});
      else if (p) {
        let yaw = p.transform.heading;
        if (view && typeof camera !== 'undefined') { camera.getWorldDirection(view); yaw = Math.atan2(view.y, view.x); }
        put('way', '<span class="ar" style="transform:rotate(' + (-(Math.atan2(dy, dx) - yaw)).toFixed(2) + 'rad)">▲</span>' + esc(cur.say) + '<span class="m">' + Math.round(d) + ' m</span>', cur.say);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__mojGuide = { view: () => V, step: () => k, steps: GD.steps.length, held: GD.held || [], showing: () => mode, lesson: () => (phase === 'lessons' ? li : LS ? LS.length : 0), lessons: LS ? LS.length : 0 };
})();
`;
}
