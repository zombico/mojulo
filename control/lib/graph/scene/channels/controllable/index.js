import { b64, safeJson } from '../../emit-util.js';
import { emissionSource } from '../../../worlds/controllable/compose.js';
import { surfaceAt } from '../../../roads/surface.js';
import { commanderSource } from '../../../worlds/controllable/commander.js';
import { MSG_GAMEPAD as GAME_MSG_GAMEPAD, MSG_AI as GAME_MSG_AI, MSG_SEATS as GAME_MSG_SEATS } from '../../../game/level-contract.js';
import { hangarStepperBlock } from './hangar-menu.js';
import { projectileSmokeBlock } from './projectile-smoke.js';
import { suitShadowBlock } from './suit-shadows.js';
import { buildControlsKernel } from '../../../controls/controls-kernel.js';
import { SCHEMES } from '../../../controls/schemes.js';
import { DEVICES } from '../../../controls/devices.js';
import { buildSeatsKernel } from '../../../controls/seats-kernel.js';
import { touchLayout, touchScript } from './touch.js';
import { runnerViewScript } from './runner-view.js';
import { followPullIn } from './follow-pull-in.js';

// In-page script: the CONTROLLABLE channel — the unified "control a thing in a world" primitive
// (controllable-world.plan.md). One model (entities = transform + rule + body; the camera is an
// entity), one input snapshot, one per-frame step — superseding the bespoke walk/over-shoulder/orbit
// controllers. The model is the SAME code as the node engine, emitted via the composed builder
// sources (worlds/controllable/compose.js#emissionSource() — single source of truth, per-system
// since the S0 split, controllable-split.plan.md). When a camera entity is present it OWNS the
// camera (OrbitControls disabled), driven from the camera entity's transform each frame.
//
// Bodies (Phase 3): `mesh` (sphere/box, optional front marker so heading reads) and `none`. Input is
// mapped once here from keys/pointer to the normalized axes the pure rules consume. The `ground` hook
// raycasts the scene so `walk` entities follow terrain; `window.__mojCtrl` is exposed for headless
// verification (it can push input frames).

// figure-buffer pool: livery variants bake byte-identical part GEOMETRY (only the colour buffers
// differ) and identical pose curves, so a roster page serializes every pos/clip buffer twice —
// ~half the __FIG payload on an arena level. Emit each duplicated base64 string ONCE in __FIGPOOL
// and mark its uses `{__p:i}`; the page rehydrates the markers before any consumer runs. A figures
// map with no duplicated buffers pools nothing and the emission stays byte-identical to the
// unpooled form (the char-net contract).
function poolFigureBuffers(figures) {
  const counts = new Map();
  const scan = (v) => {
    if (typeof v === 'string') { if (v.length >= 256) counts.set(v, (counts.get(v) || 0) + 1); return; }
    if (v && typeof v === 'object') for (const k in v) scan(v[k]);
  };
  scan(figures);
  const idx = new Map();
  for (const [s, n] of counts) if (n >= 2) idx.set(s, idx.size);
  if (!idx.size) return { fig: figures, pool: [] };
  const rewrite = (v) => {
    if (typeof v === 'string') { const i = idx.get(v); return i === undefined ? v : { __p: i }; }
    if (Array.isArray(v)) return v.map(rewrite);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = rewrite(v[k]); return o; }
    return v;
  };
  return { fig: rewrite(figures), pool: [...idx.keys()] };
}

/** The page's seats (pilots.plan.md; a world's `seats: { bodies, max?, join?, drop? }`): seat 1 is the player the world
 * already has, read through its own controller once it has one; seats 2 to N each a compact read of their own controller
 * through the pilot scheme, riding the frame's input as `input.seats` (worlds/controllable/core.js). A controller sits down
 * with any press (start is the shell's pause): the first to press is seat 1. A ring in the seat's colour stands under each
 * seated body, and a strip names who is in. Emitted only for a world with seats. */
function seatsScript(seats) {
  const bodies = Array.isArray(seats.bodies) ? seats.bodies.slice(0, 3) : [];
  const max = Math.max(1, Math.min(4, seats.max ?? bodies.length + 1, bodies.length + 1));
  return `// ── SEATS (pilots.plan.md) ──
const __SK = (${buildSeatsKernel.toString()})();
let __SEATS = __SK.newSeats({ max: ${max}, join: ${safeJson(seats.join === 'lobby' ? 'lobby' : 'drop-in')} });
const __SEAT_BODY = ${safeJson(bodies)};   // seat n's body: __SEAT_BODY[n - 2]; seat 1's is the world's pilot
const __seatPrev = {};
// any press of a controller sits it down: a key, a button, a stick pushed past half
function __seatFrame() {
  const f = { keyboard: { join: Object.keys(__held).some((k) => __held[k]) } }, ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (!p || !p.connected) continue;
    f['pad:' + p.index] = { connected: true, join: p.buttons.some((b) => b && b.pressed) || p.axes.some((v) => Math.abs(v) > 0.5) };
  }
  for (const x of __SEATS.seats) if (!f[x.controller]) f[x.controller] = { connected: false };
  return f;
}
// a seat's input: its own controller through the pilot scheme (move, jump, fire, boost, kneel, tackle)
function __seatSnap(x) {
  const kb = x.controller === 'keyboard';
  let rd, g = null;
  if (kb) rd = (c) => __held[c];
  else { const ps = navigator.getGamepads ? navigator.getGamepads() : []; g = ps[+x.controller.slice(4)]; if (!g || !g.connected) return null; rd = __CTL.gamepadRead(g, __DEV); }
  const fam = kb ? 'keyboard' : 'gamepad', h = (a) => __CTL.held(__BIND, a, fam, rd);
  let mx, my;
  if (kb) { mx = __CTL.axis(__BIND, 'turnRight', 'turnLeft', 'keyboard', rd); my = __CTL.axis(__BIND, 'moveForward', 'moveBack', 'keyboard', rd); }
  else { const st = __padStick(g.axes[0] || 0, g.axes[1] || 0); mx = st[0]; my = -st[1]; }
  const P = __seatPrev[x.n] || (__seatPrev[x.n] = {}), jh = h('jump'), tk = h('tackle');
  const out = { forward: my, turn: __MOUSELOOK ? 0 : mx, strafe: __MOUSELOOK ? mx : 0, lift: (jh ? 1 : 0) - (h('kneel') ? 1 : 0), jump: jh && !P.jump ? 1 : 0, jumpHeld: jh ? 1 : 0, fire: h('fire') ? 1 : 0, boost: h('boost') ? 1 : 0, kneel: h('kneel') ? 1 : 0, tackle: tk && !P.tackle ? 1 : 0 };
  P.jump = jh; P.tackle = tk;
  return out;
}
// the strip: who is in, in their colours; an empty seat says how to sit down
const __seatEl = document.createElement('div');
__seatEl.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);display:flex;gap:6px;font:600 12px system-ui,sans-serif;pointer-events:none;z-index:5';
document.body.appendChild(__seatEl);
let __seatSaid = '';
function __seatStrip() {
  const L = __world.seatLives, lives = (n) => (L ? (__world.seatPool === 'shared' ? L.shared : L[n]) : null);
  const said = __SEATS.seats.map((x) => x.n + (x.away ? 'a' : '') + ':' + lives(x.n)).join(',') + (L && __world.seatPool === 'shared' ? '/' + L.shared : '');
  if (said === __seatSaid) return;
  __seatSaid = said;
  // the shell (game-seats): who sits where, so its pause names the seat that opened it
  if (window.parent !== window) { try { window.parent.postMessage({ moj: '${GAME_MSG_SEATS}', seats: __SEATS.seats.map((x) => ({ n: x.n, label: x.label, color: x.color, controller: x.controller, away: x.away })) }, '*'); } catch (err) { /* opaque parent */ } }
  __seatEl.textContent = '';
  for (let n = 1; n <= __SEATS.max; n++) {
    const x = __SK.seat(__SEATS, n), c = document.createElement('span'), col = __SK.SEAT_COLORS[n - 1];
    c.style.cssText = 'padding:2px 8px;border-radius:10px;border:2px solid ' + col + ';color:' + (x ? '#fff' : col) + ';background:' + (x && !x.away ? col : 'rgba(0,0,0,.45)');
    const out = __world.seatOut && __world.seatOut[n];
    c.textContent = __SK.SEAT_LABELS[n - 1] + (x ? (out ? ' out' : x.away ? ' away' : '') + (L && !out && __world.seatPool !== 'shared' ? ' \u2665' + lives(n) : '') : ' press to join');
    __seatEl.appendChild(c);
  }
  // a shared pool: one count for every seat, after the chips
  if (L && __world.seatPool === 'shared') { const c = document.createElement('span'); c.style.cssText = 'padding:2px 8px;color:#fff'; c.textContent = '\u2665' + L.shared; __seatEl.appendChild(c); }
}
__seatStrip();
// the rings: a seat's colour under its body, on the ground it stands on
const __seatRing = {};
function __seatRings() {
  for (const x of __SEATS.seats) {
    const id = x.n === 1 ? __world.pilotId : __SEAT_BODY[x.n - 2], e = id && __world.byId[id];
    if (!e) continue;
    let r = __seatRing[x.n];
    if (!r) { r = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: x.color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); r.renderOrder = 2; scene.add(r); __seatRing[x.n] = r; }
    r.visible = !x.away && !e.gone;
    r.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + 0.04);
  }
  for (const n in __seatRing) if (!__SK.seat(__SEATS, +n)) __seatRing[n].visible = false;
}
// no seat left playing (every seat out of lives): the level is lost, once
let __seatsEnded = false;
function __seatsOver() {
  if (__seatsEnded || !__world.seatsOver) return;
  __seatsEnded = true;
  if (window.__mojGame) window.__mojGame.end('fail', { pilot: __world.pilotId, seats: 'out of lives' });
}
function __withSeats(inp) {
  __SEATS = __SK.step(__SEATS, __seatFrame());
  const s1 = __SK.seat(__SEATS, 1);
  __seat1 = s1 ? s1.controller : null;
  const seats = {};
  for (const x of __SEATS.seats) if (x.n > 1 && !x.away) { const snap = __seatSnap(x); if (snap) seats[x.n] = snap; }
  __seatStrip();
  return { ...inp, seats };
}
window.__mojSeats = () => __SEATS;
window.__mojSeatRings = () => Object.keys(__seatRing).map((n) => ({ n: +n, color: '#' + __seatRing[n].material.color.getHexString(), visible: __seatRing[n].visible }));
`;
}

export function controllableChannelScript(entities, camera, figures, { exposeBodies = false, pilot = null, spectate = null, ai = null, colliders = null, breakables = null, breakPieces = null, hangar = null, match = null, shadows = null, smoke = null, wreckExplodes = null, tutorial = null, aiDifficulty = null, lock = null, commander = null, key = null, toonInk = null, driveSurface = null, touch = false, runner = null, gearGranted = false, seats = null } = {}) {
  // per-vertex specular (material-response): inject the aSpec wiring into the rig-figure
  // builder ONLY when some packed figure carries a spec buffer (a material-finished suit).
  // Absent → the emitted controllable channel is byte-identical (the char-net pin holds),
  // matching how specularChannelScript itself is gated in scene-three.js.
  // the TOUCH layer (touch.js): a game made for a screen draws a virtual pad, laid out for its pilot and camera
  const touchLayer = touch ? touchLayout(entities, camera, { runner: !!runner }) : null;
  // a level whose only minds are its fauna (era/biocube-fauna.js: each `fauna: true`, passive) has nothing to attack:
  // no AI-attack button. Any other mind ⇒ the button, byte-identical.
  const ais = (entities || []).filter((e) => e && ((e.ambientRule && e.ambientRule.type === 'ai') || (e.rule && e.rule.type === 'ai')));
  const faunaOnly = ais.length > 0 && ais.every((e) => e.fauna === true);
  const figHasSpec = Object.values(figures || {}).some((f) => f && f.rig
    && Array.isArray(f.parts) && f.parts.some((p) => p && (p.spec || p.spec8)));
  // first person (an `eye` camera with `hideTarget`): the body it rides is never drawn, or the view would sit inside
  // its own head. Absent → the emitted channel is byte-identical.
  const hideId = camera && camera.rule === 'eye' && camera.hideTarget && typeof camera.target === 'string' ? camera.target : null;
  // indexed+quantized parts present (unit rigs since the level-load perf batch) — gates the
  // __makeRigGroup q branch below so rig pages without them stay byte-identical.
  const figHasQ = Object.values(figures || {}).some((f) => f && f.rig
    && Array.isArray(f.parts) && f.parts.some((p) => p && p.q));
  // a rig body drawn at a scale of its own (`body.scale`: a hero in a world authored in other units, a city level's 3.66 m
  // to the unit): the group scales once at build. No body carries one → the emitted channel is byte-identical
  const bodyScaled = (entities || []).some((e) => e && e.body && Number.isFinite(e.body.scale) && e.body.scale > 0 && e.body.scale !== 1);
  // the gear's line (worlds/controllable/swing.js): drawn from the hand to the anchor while a body swings or zips. No
  // entity carries a gear → the emitted channel is byte-identical
  // (or one a power grants later: a map game's game.powers, scene-three.js reads its grants)
  const gearUsed = gearGranted || (entities || []).some((e) => e && e.rule && e.rule.gear);
  const gearBlock = gearUsed ? `
// ---- the gear's line (swing.js): hand to anchor while a body swings or zips ----
const __gearLines = {};
function __updateGearLines() {
  for (const e of __world.entities) {
    const S = e.swinging || (e.zipping ? { anchor: e.zipping.anchor } : null);
    let ln = __gearLines[e.id];
    if (!S) { if (ln) ln.visible = false; continue; }
    if (!ln) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf2f2f2 })); ln.frustumCulled = false; ln.raycast = function () {};
      scene.add(ln); __gearLines[e.id] = ln;
    }
    const r = e.rule, H = r.collideHeight != null ? r.collideHeight : 1.7 * (r.metre || 1), a = ln.geometry.attributes.position.array;
    a[0] = e.transform.pos[0]; a[1] = e.transform.pos[1]; a[2] = e.transform.pos[2] - (r.eye || 0) + H * 0.9;
    a[3] = S.anchor[0]; a[4] = S.anchor[1]; a[5] = S.anchor[2];
    ln.geometry.attributes.position.needsUpdate = true; ln.visible = true;
  }
}` : '';
  const gearHook = gearUsed ? `
    __updateGearLines();` : '';
  // a bone part carrying metal (a hero wearing its cube's materials, rig-bake.js `metal`): the metal channel's patch on
  // its mesh. Soup parts only (the hero's encoding); no metal part → the emitted channel is byte-identical
  const rigMetalHook = Object.values(figures || {}).some((f) => f && f.rig && Array.isArray(f.parts) && f.parts.some((p) => p && p.metal))
    ? `\n    if (part.metal && !part.q && typeof __metPatch === 'function') __metPatch(mesh, part);` : '';
  // a vehicle rig that LIVES (car-designer/racer.js `live`: steer, lean, squat, dive, bounce, a mast's wobble) —
  // the overlay below is emitted only when some figure carries one, so every other page stays byte-identical.
  const figHasLive = Object.values(figures || {}).some((f) => f && f.rig && f.live);
  // a FACED body (the realistic hero, relational-face-rig.js: `face` and its parts' `morph`): morph targets on its bone
  // meshes, driven per frame by the state's facial track, the ambient blink over the states that hold the face. No
  // faced body → the emitted channel is byte-identical.
  const figHasFace = Object.values(figures || {}).some((f) => f && f.rig && f.face && Array.isArray(f.face.targets) && Array.isArray(f.parts) && f.parts.some((p) => p && p.morph));
  // a PAINTED body (the realistic hero's skin, dermal-hero.js heroSkinPaint, packed as station-loft-rig.js `paintTex` and
  // each part's `uv`): its bone meshes drawn on the atlas (texel × the part's lit colour), as the World page draws it.
  // No painted body → the emitted channel is byte-identical.
  const figHasPaint = Object.values(figures || {}).some((f) => f && f.rig && f.paintTex && Array.isArray(f.parts) && f.parts.some((p) => p && p.uv));
  // (and one whose atlas has edges, the hero's hair cards: its material alpha tested; none ⇒ not a byte of it)
  const figHasMask = figHasPaint && Object.values(figures || {}).some((f) => f?.paintTex?.alphaMask);
  // a racer's JUICE (car-designer/juice.js: flames, puffs, smoke, dust, sparks, a landing ring at its anchors) —
  // emitted only when some figure carries one.
  const figHasJuice = Object.values(figures || {}).some((f) => f && f.rig && f.juice);
  // a body with FORMS (controllable/forms.js) and a figure baked to be both (transformation/compose.js): the transform
  // press, the clip each form plays, a flying form's attitude. Emitted only when some entity or figure carries forms.
  const hasForms = (entities || []).some((e) => e && e.forms);
  const figHasForms = Object.values(figures || {}).some((f) => f && f.rig && f.forms);
  // a car's own light in a dark mood (car-designer/supercar-figure.js: the headlamps' pool on the road, the tail lamps'
  // ribbons) — emitted only when some figure's juice carries them.
  const figHasLights = figHasJuice && Object.values(figures || {}).some((f) => f && f.rig && f.juice && (f.juice.beams || f.juice.trails));
  // spec rides two encodings: legacy float32 pairs (`spec`, vehicle/protoform rigs) and the
  // unit rigs' u8 pairs (`spec8` — [strength×255, shininess], dequantized to the same float
  // attribute here so the shared spec patch shader is unchanged).
  const rigSpecHook = figHasSpec
    ? `\n    if ((part.spec || part.spec8) && typeof __specPatch === 'function') { let sa; if (part.spec8) { const su = decodeU8(part.spec8); sa = new Float32Array(su.length); for (let i = 0; i < su.length; i += 2) { sa[i] = su[i] / 255; sa[i + 1] = su[i + 1]; } } else sa = decodeF32(part.spec); geo.setAttribute('aSpec', new THREE.BufferAttribute(sa, 2)); __specPatch(mesh); }`
    : '';
  // rim (ms-contrast.plan.md SPIKE): additive fresnel edge light — injected ONLY when a
  // packed figure carries a `rim` spec ([r,g,b,strength,power], baked by unit-rig's
  // `contrast` opt-in). Absent → the emitted channel is byte-identical (the char-net
  // pin holds), same gating pattern as figHasSpec above.
  const figHasRim = Object.values(figures || {}).some((f) => f && f.rig && Array.isArray(f.rim));
  const rigRimHook = figHasRim ? `\n    if (Array.isArray(fig.rim)) __rimPatch(mesh, fig.rim);` : '';
  // toon ink (toon-shading Phase 4b): outline every rig PART when the world's toon dial asks for
  // ink — the hull + crease lines are children of the bone mesh, so they pose with the bone and
  // every loadout / livery rebuild gets them for free. Built with the toon setup channel's
  // \`__inkBuild\` (typeof-guarded: the channel is spliced earlier in the page). Parts carry no
  // authored normals, so the geometric fallback orients each triangle away from the part centroid.
  // Gated on the emit-site cfg: a world without toon.ink emits byte-identical controllable text; `lines: false`
  // (silhouette only) leaves the part's line segments unattached, as the toon setup block does.
  const rigInkHook = toonInk ? `\n    if (typeof __inkBuild === 'function') __inkRigPart(mesh, geo, fig);` : '';
  const rigInkBlock = toonInk ? `
// toon ink on rig parts (Phase 4b): de-index the part, orient normals off its centroid, ink it.
const __INKRIG = ${safeJson(toonInk)};
function __inkFigRadius(fig) {   // the figure's scale, for a width every part agrees on
  if (fig.__inkR) return fig.__inkR;
  let r = 0;
  for (const part of fig.parts) {
    if (!part) continue;
    if (part.q && part.s) r = Math.max(r, 0.5 * Math.hypot(part.s[0] * 65535, part.s[1] * 65535, part.s[2] * 65535));
    else if (part.pos) { const p = decodeF32(part.pos); let mx = -1e9, mn = 1e9; for (let i = 2; i < p.length; i += 3) { if (p[i] > mx) mx = p[i]; if (p[i] < mn) mn = p[i]; } r = Math.max(r, (mx - mn) / 2); }
  }
  return (fig.__inkR = r || 1);
}
function __inkRigPart(mesh, geo, fig) {
  const pa = geo.getAttribute('position').array, idx = geo.index ? geo.index.array : null;
  let pos = pa;
  if (idx) { pos = new Float32Array(idx.length * 3); for (let i = 0; i < idx.length; i++) { const k = idx[i] * 3; pos[i * 3] = pa[k]; pos[i * 3 + 1] = pa[k + 1]; pos[i * 3 + 2] = pa[k + 2]; } }
  if (pos.length < 9) return;
  const r = __inkFigRadius(fig), q = Math.max(r * 1.5e-3, 1e-6);
  const width = __INKRIG.widthAbs != null ? __INKRIG.widthAbs : __INKRIG.width * r;
  const e = __inkBuild(pos, __inkGeoNormals(pos, __inkCentroid(pos)), width, __INKRIG.crease, q, __INKRIG.color);
  mesh.add(e.hull);${toonInk.lines === false ? '' : ' mesh.add(e.lines);'}
  mesh.material.polygonOffset = true; mesh.material.polygonOffsetFactor = 1; mesh.material.polygonOffsetUnits = 1; mesh.material.needsUpdate = true;
}` : '';
  const rimPatchBlock = figHasRim ? `
// rim (ms-contrast SPIKE): fresnel edge term for contrast-treated rigs. Chains AFTER any
// spec patch on the same material — both replacements preserve their include markers, so
// the two terms compose on one onBeforeCompile pass.
const __rimPatch = (m, rim) => {
  const prev = m.material.onBeforeCompile;
  m.material.onBeforeCompile = (sh) => {
    if (prev) prev(sh);
    sh.uniforms.uRim = { value: new THREE.Vector4(rim[0], rim[1], rim[2], rim[3]) };
    sh.uniforms.uRimP = { value: rim[4] };
    sh.vertexShader = 'varying vec3 vRimWp;\\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\\nvRimWp = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec4 uRim;\\nuniform float uRimP;\\nvarying vec3 vRimWp;\\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      'vec3 rN = normalize(cross(dFdx(vRimWp), dFdy(vRimWp)));\\n' +
      'vec3 rV = normalize(cameraPosition - vRimWp);\\n' +
      'if (dot(rN, rV) < 0.0) rN = -rN;\\n' +
      'float rF = pow(1.0 - max(dot(rN, rV), 0.0), uRimP);\\n' +
      'gl_FragColor.rgb += uRim.rgb * (uRim.a * rF);\\n' +
      '#include <dithering_fragment>');
  };
  m.material.needsUpdate = true;
};` : '';
  // suit contact shadows: `true` or a tuning object { r, alpha, fade, color } over the defaults
  // (r = blob radius at contact, world units; fade = the altitude where the blob dies). The
  // defaults match the static dusk spawn pools' read (r 14 · alpha 0.5 in mint-relit-variant)
  // scaled to ride under a live suit on busy terrain textures.
  const sh = shadows ? { r: 12, alpha: 0.45, fade: 55, color: [0, 0, 0], ...(typeof shadows === 'object' ? shadows : {}) } : null;
  // directional key (see suitShadowBlock): only folded in when the emit call site derived one
  // from the payload's baked light — absent, cfg and the emitted template are byte-identical.
  if (sh && key) sh.key = key;
  // figure-shaped cast shadows (`shadows.cast`): the scene-level cast-shadow channel owns the
  // whole rig — light, receiver twins, fit/follow box (channels/cast-shadows.js). Here the
  // controllable channel is only an INTEGRATION: suppress the blob (the real silhouette
  // replaces it), flag every body mesh as a caster at CONSTRUCTION (a traverse after the fact
  // loses to hangar/loadout rebuilds, and frame()-driven captures never step to restore it),
  // and steer the shadow box to the pilot each frame. Gated on the explicit cast key so every
  // existing shadows world (true / { occlude } / tuning objects) emits its byte-identical
  // blob template.
  // The live light's ACTOR shadows (`shadows.actors`, scene/live-light.js) integrate the same way; their box follows the
  // pilot, or with seats the centre of the seated pilots, grown to their spread (the group frame's centre). It is handed
  // over once as the live light's FOCUS, which the pass before every render asks: captures never step, and the box is
  // tight round the pilot from the first frame.
  const actors = !!(sh && typeof shadows === 'object' && shadows.actors);
  const cast = !!(sh && typeof shadows === 'object' && shadows.cast) || actors;
  const shadowBlock = cast ? '' : sh ? suitShadowBlock(sh) : '';
  const focusHook = actors
    ? 'if (window.__mojCast && window.__mojCast.focus) window.__mojCast.focus(() => { const __pe = (__world.pilotId && __world.byId[__world.pilotId]) || __world.entities[0], __ps = __pe && __pe.transform ? [__pe] : []; if (__world.seatOf) for (const id in __world.seatOf) { const e = __world.byId[id]; if (e && e.transform && !e.gone && e !== __pe) __ps.push(e); } if (!__ps.length) return null; const __c = [0, 0, 0]; for (const e of __ps) for (let k = 0; k < 3; k++) __c[k] += e.transform.pos[k] / __ps.length; let __r = 0; for (const e of __ps) __r = Math.max(__r, Math.hypot(e.transform.pos[0] - __c[0], e.transform.pos[1] - __c[1])); return [__c[0], __c[1], __c[2], __r]; });   // the live light\'s box follows the pilot (or the seats\' centre)\n'
    : '';
  const shadowHook = actors
    ? ''
    : cast
      ? '\n    if (window.__mojCast) { const __pe = (__world.pilotId && __world.byId[__world.pilotId]) || __world.entities[0]; if (__pe && __pe.transform) window.__mojCast.follow(__pe.transform.pos[0], __pe.transform.pos[1], __pe.transform.pos[2]); }'
      : sh ? '\n    __updateSuitShadows();' : '';
  const castHook = cast ? '\n    mesh.castShadow = true;' : '';
  // projectile smoke: `true` or a tuning object over the defaults (max = sprite pool cap ·
  // spacing = trail puff spacing in TRAVEL units · alpha = peak puff opacity · burstCount =
  // puffs per detonation · trailTint/burstTint = light propellant gray / dark detonation gray).
  const sm = smoke ? { max: 150, spacing: 5.5, alpha: 0.55, burstCount: 13, trailTint: 0x9ba1a8, burstTint: 0x565b62, ...(typeof smoke === 'object' ? smoke : {}) } : null;
  if (sm) {
    const d = typeof smoke === 'object' ? smoke.dust : undefined;
    // boost/dodge ground dust: bumped for a more prominent cloud (bigger puffs r0/r1, denser spacing,
    // wider wake, more opaque, rises a touch more). Dodge/topple keep their own r0/r1/width/alpha keys,
    // so this beefs up BOOST most; a per-world `smoke.dust` still overrides via the spread below.
    sm.dust = d === false ? false : { enabled: true, spacing: 3.6, alpha: 0.5, r0: 3.4, r1: 13, width: 11, back: 6.5, rise: 0.7, tint: 0xb8aa8f, ...(d && typeof d === 'object' ? d : {}) };
  }
  const smokeBlock = sm ? projectileSmokeBlock(sm) : '';
  const smokeHook = sm ? '\n    __updateSmoke();' : '';
  const hangarBlock = hangar ? hangarStepperBlock(hangar) : '';
  const hangarHook = hangar ? '  window.__mojHangar.sync();\n  if (inputOverride) { if (inputOverride.hangarStep) window.__mojHangar.step(inputOverride.hangarStep); if (inputOverride.liverySet != null) window.__mojHangar.livery(inputOverride.liverySet); if (inputOverride.equipSlot != null) window.__mojHangar.equip(inputOverride.equipSlot); }\n' : '';
  // COMMANDER (worlds/controllable/commander.js): a body marked `rule.commanded` is driven at strategy rate by
  // a commander port (builtin | hook | http; the world's `commander` picks it), with one HUD line showing its
  // current intent. No commanded body ⇒ both blocks are '' (byte-identical).
  const commandedIds = (entities || []).filter((e) => e && e.id && e.rule && e.rule.commanded).map((e) => e.id);
  const cmdCfg = commander && typeof commander === 'object' ? commander : {};
  const commanderBlock = commandedIds.length ? `const __mojCmd = (function () {
${commanderSource()}
  var ports = ${safeJson(commandedIds)}.map(function (id) { return createCommanderPort({ commandedId: id, foeId: ${safeJson(cmdCfg.foe || null)}, port: ${safeJson(cmdCfg.port || 'builtin')}, period: ${Number(cmdCfg.period) || 5}, url: ${safeJson(cmdCfg.url || null)}, hook: ${safeJson(cmdCfg.hook || null)} }); });
  var hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:80;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9cc4ff;background:rgba(11,18,32,.72);border:1px solid #24324a;border-radius:6px;padding:6px 10px;max-width:62vw;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  var label = document.createElement('div'); label.style.cssText = 'color:#5f7fb0;letter-spacing:1px'; label.textContent = 'COMMANDER · ' + ${safeJson(commandedIds.join(', '))} + ' · ' + ${safeJson(cmdCfg.port || 'builtin')};
  var line = document.createElement('div'); line.textContent = 'awaiting first read';
  hud.appendChild(label); hud.appendChild(line); document.body.appendChild(hud);
  return { ports: ports, step: function (w) { for (var i = 0; i < ports.length; i++) ports[i].onFrame(w); line.textContent = ports.map(function (p) { return p.currentNote(); }).join(' | '); } };
})();
window.__mojCommanderPorts = __mojCmd;   // headless verification: ports + current notes
` : '';
  const commanderStep = commandedIds.length ? '__mojCmd.step(__world);\n    ' : '';
  // FLIGHT HUD (skyscape): a body on the fly rule gets the instruments a pilot reads (airspeed in knots, height over the
  // ground and over the datum, climb, heading, the throttle) and the warnings (STALL, the map's bound). Read off the
  // piloted body's facts each frame. No flying body ⇒ '' (byte-identical).
  const flyHudBlock = (entities || []).some((e) => e && ((e.rule && e.rule.type === 'fly') || (e.forms && Object.values(e.forms).some((f) => f && f.rule && f.rule.type === 'fly')))) ? `(function () {
  var el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:16px;bottom:16px;min-width:210px;padding:8px 12px;border-radius:8px;background:rgba(8,14,22,0.5);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.22);pointer-events:none;z-index:9;font:600 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfe3ff;white-space:pre';
  document.body.appendChild(el);
  var pad = function (v, n) { v = String(v); while (v.length < n) v = ' ' + v; return v; };
  // a flight's game (the laps mechanic's land / respawn): each touchdown told to the bus with whether it sank harder
  // than the gear takes (rule.sinkMax), and its respawn carried out; a city's roofs (rule.roofs) counted as ground, so a
  // tower is hit, not flown through
  // a touchdown counts once the craft has flown (over ARM m above the ground): not the first frames' settling on the pad
  var roofs = null, wasAir = null, lastVs = 0, hooked = false, armed = false, ARM = 3;
  function roofAt(x, y) {
    for (var k = 0; k < roofs.length; k++) {
      var r = roofs[k], i = Math.floor((x - r.x0) / r.cell), j = Math.floor((y - r.y0) / r.cell);
      if (i >= 0 && j >= 0 && i < r.nx && j < r.ny) { var v = r.h[j * r.nx + i]; if (v) return r.base + v / 10; }
    }
    return null;
  }
  // space (rule.space): no ground under the craft but a roof grid's (a station's), the view out to the stars, and its
  // rocks (rule.obstacles: x, y, z, r flat) a crash when flown into
  var spaced = false, rocks = null, clearOfRocks = true;
  function rockHit(q) { for (var k = 0; k < rocks.length; k += 4) { var dx = q[0] - rocks[k], dy = q[1] - rocks[k + 1], dz = q[2] - rocks[k + 2], r = rocks[k + 3] + 2; if (dx * dx + dy * dy + dz * dz <= r * r) return true; } return false; }
  // an armed craft fires its guns on Z as well as the (pointer-locked) left mouse, its missile on the right mouse (R is
  // the scheme's); F is its boost
  var fireKeyed = false;
  function hook(p) {
    if (!fireKeyed) {
      fireKeyed = true;
      window.addEventListener('keydown', function (ev) { if (ev.code === 'KeyZ') __fireDown = true; });
      window.addEventListener('keyup', function (ev) { if (ev.code === 'KeyZ') __fireDown = false; });
      renderer.domElement.addEventListener('mousedown', function (ev) { if (ev.button === 2 && document.pointerLockElement === renderer.domElement) window.__mojAltFire = true; });
      window.addEventListener('mouseup', function (ev) { if (ev.button === 2) window.__mojAltFire = false; });
      renderer.domElement.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    }
    if (p.rule.space && !spaced) {
      spaced = true; rocks = p.rule.obstacles || null;
      __ground = function (pos) { return roofs ? roofAt(pos[0], pos[1]) : null; };   // eslint-disable-line no-func-assign
      if (camera.far < 40000) { camera.far = 40000; camera.updateProjectionMatrix(); }
    }
    if (p.rule.roofs && !roofs) {
      roofs = p.rule.roofs.map(function (r) { var b = atob(r.q), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { x0: r.x0, y0: r.y0, cell: r.cell, nx: r.nx, ny: r.ny, base: r.base, h: new Uint16Array(u.buffer) }; });
      var g0 = __ground;
      if (!p.rule.space) __ground = function (pos) { var g = g0(pos), t = roofAt(pos[0], pos[1]); return t !== null && (g === null || t > g) ? t : g; };   // eslint-disable-line no-func-assign
    }
    var B = window.__mojBus; if (hooked || !B || !B.bus) return; hooked = true;
    var prev = B.bus.processEvents;
    B.bus.processEvents = function (state, events) {
      var n0 = state.log.length, out = prev(state, events);
      for (var i = n0; i < state.log.length; i++) {
        var ev = state.log[i]; if (!ev || typeof ev.type !== 'string' || ev.type.indexOf('respawn:') !== 0) continue;
        // the point rides on the reaction that emitted it (the log keeps the type)
        var R = (state.reactions || []).find(function (r) { return r.do === 'emit' && r.type === ev.type; });
        var c = __world.byId[__world.pilotId]; if (!c || !R || !Array.isArray(R.spot)) continue;
        ev = R;
        c.transform.pos = ev.spot.slice(); c.transform.heading = ev.heading || 0; c.transform.pitch = 0; c.bank = 0;
        c.airborne = !!ev.aloft; c.stalled = false; c.airspeed = ev.aloft ? (c.rule.cruise || c.rule.launchSpeed || c.rule.stallSpeed * 1.6) : 0;
        if (c.rule.lever) c.lever = ev.aloft ? (c.rule.leverStart || 0.75) : 0;
        wasAir = !!ev.aloft; lastVs = 0; armed = !!ev.aloft;
      }
      return out;
    };
  }
  // the course's guidance (rule.course): the next gate bracketed on screen (an arrow at the edge when it is off it), a
  // gate flown past outside its ring called out, and on the way to the runway the glide-slope lights (PAPI-like: four,
  // white above the slope, red below) and the centreline
  // the missile lock's bracket: round the body the lock is building on, its ring filling, red when locked
  var lk = document.createElement('div'), LV = new THREE.Vector3();
  lk.style.cssText = 'position:absolute;pointer-events:none;z-index:9;display:none;transform:translate(-50%,-50%);font:600 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;white-space:nowrap';
  document.body.appendChild(lk);
  function lockMark(p) {
    var L = p.mlock, tg = L && __world.byId[L.target];
    if (!tg) { lk.style.display = 'none'; return; }
    var r = renderer.domElement.getBoundingClientRect(), q = tg.transform.pos;
    LV.set(q[0], q[1], q[2]).project(camera);
    if (LV.z > 1 || Math.abs(LV.x) > 1 || Math.abs(LV.y) > 1) { lk.style.display = 'none'; return; }
    var need = (p.rule.missiles && p.rule.missiles.lockTime) || 1.2, f = Math.min(1, L.t / need), col = L.locked ? '#ff4d4d' : '#9fe3ff';
    lk.style.display = ''; lk.style.left = (r.left + (LV.x + 1) / 2 * r.width) + 'px'; lk.style.top = (r.top + (1 - LV.y) / 2 * r.height) + 'px';
    lk.innerHTML = '<div style="width:44px;height:44px;margin:0 auto 2px;border:2px solid ' + col + ';border-radius:4px;transform:rotate(45deg) scale(' + (1.6 - 0.6 * f) + ')"></div><span style="color:' + col + '">' + (L.locked ? 'LOCK' : Math.round(100 * f) + '%') + '</span>';
  }
  // the weapons' line: missiles and flares left, the boost's charge, a homing round's warning
  function arms(p) {
    var m = p.rule.missiles, out = '';
    if (m) out += '\\nMSL ' + (p.missilesLeft == null ? (m.count || 4) : p.missilesLeft) + '  FLR ' + (p.flaresLeft == null ? (m.flares || 0) : p.flaresLeft) + (p.flareT > 0 ? ' <span style="color:#ffd166">FLARE</span>' : '');
    if (p.rule.boost) { var full = p.rule.boost.time || 3, e2 = p.boostE == null ? full : p.boostE, n = Math.round(8 * e2 / full); out += (m ? '  ' : '\\n') + 'BST ' + '▮'.repeat(n) + '▯'.repeat(8 - n); }
    if (p.incoming != null) out += '\\n<span style="color:#ff4d4d">INCOMING · ' + Math.round(p.incoming) + ' m</span>';
    return out;
  }
  var mk = document.createElement('div'), miss = 0, missN = 0, prevSide = null, prevNext = -1, ownNext = 0, cpVar = null, V3 = new THREE.Vector3();
  mk.style.cssText = 'position:absolute;pointer-events:none;z-index:9;display:none;font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffd166;text-align:center;transform:translate(-50%,-50%);white-space:nowrap';
  document.body.appendChild(mk);
  function nextOf(C, q) {
    var B = window.__mojBus, v = B && B.state && B.state.vars;
    if (v && cpVar === null) { cpVar = ''; for (var k in v) if (/^__cp_\\d+$/.test(k)) { cpVar = k; break; } }
    if (v && cpVar) return v[cpVar];
    // no game on the page: counted here, each gate when the craft is inside its ring
    var G = C.gates[ownNext];
    if (G && Math.hypot(q[0] - G[0], q[1] - G[1], q[2] - G[2]) <= G[3]) ownNext++;
    return ownNext;
  }
  function guide(p) {
    var C = p.rule.course; if (!C) { mk.style.display = 'none'; return ''; }
    var q = p.transform.pos, n = nextOf(C, q), G = C.gates[n], L = C.land, out = '';
    if (n !== prevNext) { prevNext = n; prevSide = null; }
    var tgt = G ? [G[0], G[1], G[2]] : L ? L.aim : null;
    if (G) {
      // flown past: the gate's plane crossed (its heading the way through) outside its ring
      var side = (q[0] - G[0]) * Math.cos(G[4]) + (q[1] - G[1]) * Math.sin(G[4]);
      if (prevSide !== null && prevSide < 0 && side >= 0 && Math.hypot(q[0] - G[0], q[1] - G[1], q[2] - G[2]) > G[3]) { miss = performance.now(); missN = n + 1; }
      prevSide = side;
    }
    if (tgt) {
      var d = Math.hypot(tgt[0] - q[0], tgt[1] - q[1], tgt[2] - q[2]), r = renderer.domElement.getBoundingClientRect();
      V3.set(tgt[0], tgt[1], tgt[2]).project(camera);
      var label = (G ? 'GATE ' + (n + 1) : 'RUNWAY') + ' ' + (d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m');
      var behind = V3.z > 1, on = !behind && Math.abs(V3.x) < 0.92 && Math.abs(V3.y) < 0.88;
      mk.style.display = '';
      if (on) {
        mk.style.left = (r.left + (V3.x + 1) / 2 * r.width) + 'px'; mk.style.top = (r.top + (1 - V3.y) / 2 * r.height) + 'px';
        mk.innerHTML = '<div style="width:34px;height:34px;margin:0 auto 3px;border:2px solid #ffd166;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>' + label;
      } else {
        // off the screen: an arrow at its edge, pointing the way to turn
        var ax = behind ? -V3.x : V3.x, ay = behind ? -V3.y : V3.y, m = Math.max(Math.abs(ax) / 0.9, Math.abs(ay) / 0.85) || 1;
        ax /= m; ay /= m;
        mk.style.left = (r.left + (ax + 1) / 2 * r.width) + 'px'; mk.style.top = (r.top + (1 - ay) / 2 * r.height) + 'px';
        mk.innerHTML = '<div style="font-size:22px;transform:rotate(' + (90 - Math.atan2(ay, ax) * 180 / Math.PI) + 'deg)">▲</div>' + label;
      }
    } else mk.style.display = 'none';
    if (performance.now() - miss < 3000) out += '\\n<span style="color:#ff6b6b">MISSED GATE ' + missN + ' · turn back</span>';
    if (!G && L) {
      // the approach: the angle over the aim point against the slope, and the side of the centreline
      var ax2 = Math.cos(L.heading), ay2 = Math.sin(L.heading), along = (q[0] - L.aim[0]) * ax2 + (q[1] - L.aim[1]) * ay2;
      var dist = Math.max(1, -along), ang = Math.atan2(q[2] - L.aim[2], dist) * 180 / Math.PI, gs = Math.atan(L.glide) * 180 / Math.PI;
      var lights = '';
      for (var i = 0; i < 4; i++) lights += '<span style="color:' + (ang > gs - 0.5 + i / 3 ? '#ffffff' : '#ff4d4d') + '">●</span>';
      var xte = (q[0] - L.aim[0]) * -ay2 + (q[1] - L.aim[1]) * ax2;
      var loc = Math.abs(xte) < 12 ? 'on the centreline' : (xte > 0 ? 'centreline ▶' : '◀ centreline') + ' ' + Math.round(Math.abs(xte)) + ' m';
      out += '\\nGS ' + lights + '  ' + (along < 0 ? loc : '');
    }
    return out;
  }
  function tick() {
    var p = __world.pilotId && __world.byId[__world.pilotId];
    if (p && p.rule && p.rule.type === 'fly') {
      hook(p);
      if (rocks && window.__mojBus && window.__mojBus.bus) {
        var hit = rockHit(p.transform.pos);
        if (hit && clearOfRocks) { var Bk = window.__mojBus; Bk.bus.processEvents(Bk.state, [{ type: 'crash', entity: p.id, why: 'rock' }]); }
        clearOfRocks = !hit;
      }
      var q0 = p.transform.pos, g0 = __ground([q0[0], q0[1], q0[2]]);
      if (p.airborne && g0 !== null && q0[2] - g0 > ARM) armed = true;
      if (wasAir === null) wasAir = !!p.airborne;
      if (p.airborne) lastVs = p.climbRate || 0;
      else if (wasAir && armed && window.__mojBus && window.__mojBus.bus) {
        armed = false;
        var sink = Math.max(0, -lastVs), B = window.__mojBus;
        // in space there is nothing to land on: a station's surface or a trench wall met is a crash
        B.bus.processEvents(B.state, [p.rule.space ? { type: 'crash', entity: p.id, why: 'surface' } : { type: 'touchdown', entity: p.id, hard: sink > (p.rule.sinkMax || 3) ? 1 : 0, sink: Math.round(sink * 10) / 10 }]);
      }
      wasAir = !!p.airborne;
      var q = p.transform.pos, g = __ground([q[0], q[1], q[2]]), agl = g === null ? null : q[2] - g;
      var brg = ((90 - p.transform.heading * 180 / Math.PI) % 360 + 360) % 360;
      var warn = p.stalled ? '\\n<span style="color:#ff6b6b">STALL</span>' : p.outOfBounds ? '\\n<span style="color:#ffb347">LEAVING THE AREA · turn back</span>' : '';
      el.style.display = '';
      el.innerHTML = 'SPD ' + pad(Math.round((p.airspeed || 0) * 1.94384), 4) + ' kt   HDG ' + pad(Math.round(brg), 3) + '\\n'
        + 'ALT ' + pad(Math.round(q[2]), 5) + ' m    AGL ' + (agl === null ? '   --' : pad(Math.round(agl), 5)) + ' m\\n'
        + 'V/S ' + pad((p.climbRate || 0).toFixed(1), 5) + ' m/s  THR ' + pad(Math.round((p.throttle || 0) * 100), 3) + '%' + warn + guide(p) + arms(p);
      lockMark(p);
    } else { el.style.display = 'none'; mk.style.display = 'none'; lk.style.display = 'none'; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
` : '';
  return `
const __CW = ${emissionSource({ ...(runner ? { runner: true } : {}), ...(entities.some((e) => e && e.rule && e.rule.hitstop) ? { hitstop: true } : {}) })};
const __world = __CW.createWorld({ entities: ${safeJson(entities)}, camera: ${safeJson(camera)}, pilot: ${safeJson(pilot)}${spectate ? ', spectate: true' : ''}${seats ? `, seats: ${safeJson(seats)}` : ''}, ai: ${safeJson(ai)}, colliders: ${safeJson(colliders)}${breakables ? `, breakables: ${safeJson(breakables)}` : ''}, match: ${safeJson(match)}${wreckExplodes ? `, wreckExplodes: ${safeJson(wreckExplodes)}` : ''}${tutorial ? `, tutorial: ${safeJson(tutorial)}` : ''}${aiDifficulty ? `, aiDifficulty: ${safeJson(aiDifficulty)}` : ''}${lock ? `, lock: ${safeJson(lock)}` : ''}${runner ? `, runner: ${safeJson(runner)}` : ''} });
${commanderBlock}${flyHudBlock}${(() => {
    const pooled = poolFigureBuffers(figures || {});
    if (!pooled.pool.length) return `const __FIG = ${safeJson(figures || {})};   // name → packed baked figure frames (pos/col b64, origin, invScale, foot)`;
    return `const __FIGPOOL = ${safeJson(pooled.pool)};   // shared packed buffers (deduped across figures — livery variants)
const __FIG = ${safeJson(pooled.fig)};   // name → packed baked figure frames (pos/col b64 or {__p:i} into __FIGPOOL)
(function __unpool(o) { for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { if (v.__p != null) o[k] = __FIGPOOL[v.__p]; else __unpool(v); } } })(__FIG);`;
  })()}
const __bodies = {};
// figure-frames body: re-expand baked frames (Uint16 corners + Uint8 colour) into raw Float32
// position arrays, feet planted at the body's local z=0 (FOOT subtracted) — packFigureFrames'
// compact encoding. The body owns ONE live BufferGeometry; each sync writes an INTERPOLATED pose
// into it (frame-pair lerp within a clip + crossfade between locomotion modes — renderer-ladder
// P2 rung 1, math from __CW.gaitFramePair/advanceGaitMix) instead of snapping whole geometries.
// Fixed topology across a figure's frames is the packing invariant that makes the lerp valid;
// a figure whose clips disagree on face count falls back to legacy frame-snapping.
const __FTRI = [0, 1, 2, 0, 2, 3];
function __figBytes(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function __decodeFigFrame(posB64, colB64, origin, inv, foot) {
  const q = new Uint16Array(__figBytes(posB64).buffer), col8 = __figBytes(colB64), nFace = col8.length / 3;
  const pos = new Float32Array(nFace * 6 * 3), col = new Float32Array(nFace * 6 * 3);
  let o = 0;
  for (let f = 0; f < nFace; f++) {
    const cb = f * 4 * 3, r = col8[f*3]/255, g = col8[f*3+1]/255, b = col8[f*3+2]/255;
    for (let t = 0; t < 6; t++) { const k = __FTRI[t] * 3;
      pos[o] = origin[0] + q[cb+k]*inv - foot[0]; pos[o+1] = origin[1] + q[cb+k+1]*inv - foot[1]; pos[o+2] = origin[2] + q[cb+k+2]*inv - foot[2];
      col[o] = r; col[o+1] = g; col[o+2] = b; o += 3; }
  }
  return { pos, col };
}${rimPatchBlock}${rigInkBlock}
// build one figure-rig group (rigid parts, one mesh per bone) for a baked fig — shared by the
// single-figure body below and the loadout variant builder (weapon switching). Two part
// encodings: unit rigs pack INDEXED + QUANTIZED (part.q: uint16 grid positions dequantized by
// origin o + per-axis step s, triangles as an index — uint32 when n tops 65535; rig-bake
// packRigMesh); vehicle/protoform rigs still pack legacy float32 triangle soup (part.pos).
// The q branch is emitted only when some figure carries it (figHasQ, same gating pattern as
// figHasSpec) so a page without unit rigs stays byte-identical.${figHasQ ? `
function __decodeU16(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Uint16Array(u.buffer); }
function __decodeU32(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Uint32Array(u.buffer); }` : ''}
${figHasFace ? `function __rigU32(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Uint32Array(u.buffer); }
// the face's targets on one bone mesh: its corners at the neutral face, each target's offsets (as the GLB writes them)
function __mq(m) { const b = atob(m.q), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const q = new Int16Array(u.buffer), f = new Float32Array(q.length); for (let i = 0; i < q.length; i++) f[i] = q[i] * m.s; return f; }   // the page's 16-bit rows
function __rigMorph(fig, part, geo) {
  const T = fig.face.targets.length, W = (1 + T) * 3, I = __rigU32(part.morph.i), D = part.morph.q ? __mq(part.morph) : decodeF32(part.morph.d);
  const pos = geo.getAttribute('position').array, tg = Array.from({ length: T }, () => new Float32Array(pos.length));
  for (let k = 0; k < I.length; k++) {
    const v = I[k] * 3, o = k * W;
    for (let c = 0; c < 3; c++) { pos[v + c] -= D[o + c]; for (let t = 0; t < T; t++) tg[t][v + c] = D[o + 3 + t * 3 + c]; }
  }
  geo.morphAttributes.position = tg.map((a) => new THREE.BufferAttribute(a, 3));
  geo.morphTargetsRelative = true;
}
// a facial track's weights at a time (each drawn frame held to the next), then the state's on every faced bone mesh
function __rigTrack(tr, at) { if (!tr || !tr.t || !tr.t.length) return null; let i = 0; while (i + 1 < tr.t.length && tr.t[i + 1] <= at) i++; return tr.w[i]; }
function __rigFace(rig, clipName, phase) {
  const F = rig.fig.face, tr = F.tracks && F.tracks[clipName];
  // (the ambient blink on the world's own clock, as a live vehicle's shiver is)
  const now = __world.time || 0;
  const over = F.ambient && (!tr || (F.ambientOver || []).includes(clipName));
  const w = over ? __rigTrack(F.ambient, now % F.ambient.seconds) : __rigTrack(tr, phase * tr.t[tr.t.length - 1]);
  const ws = w || F.weights; if (!ws) return;
  for (const mesh of rig.boneMeshes) if (mesh && mesh.morphTargetInfluences) for (let t = 0; t < ws.length; t++) mesh.morphTargetInfluences[t] = ws[t];
}
` : ''}${figHasPaint ? `// the painted body's atlas, once per figure (shared by every entity wearing it)
function __rigTex(fig) { if (!fig.__tex) { fig.__tex = new THREE.TextureLoader().load(fig.paintTex.url); fig.__tex.colorSpace = THREE.SRGBColorSpace; } return fig.__tex; }
` : ''}function __makeRigGroup(fig, b) {
  const group = new THREE.Group();
  const boneMeshes = fig.bones.map((bn, bi) => {
    const part = fig.parts[bi];
    if (!part) return null;
    const geo = new THREE.BufferGeometry();${figHasQ ? `
    if (part.q) {
      const q = __decodeU16(part.q), o = part.o, s = part.s, p = new Float32Array(part.n * 3);
      for (let i = 0; i < p.length; i += 3) { p[i] = o[0] + q[i] * s[0]; p[i + 1] = o[1] + q[i + 1] * s[1]; p[i + 2] = o[2] + q[i + 2] * s[2]; }
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      geo.setIndex(new THREE.BufferAttribute(part.n > 65535 ? __decodeU32(part.idx) : __decodeU16(part.idx), 1));
    } else geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));` : `
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));`}
    // rig-part colour is packed as normalized uint8 (rig-bake b64u8, 4× smaller than float32) →
    // read it back as a NORMALIZED uint8 attribute so the GPU dequantizes ÷255 to the same [0,1].
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));${figHasPaint ? `
    const map = fig.paintTex && part.uv && !part.q ? __rigTex(fig) : null;
    if (map) geo.setAttribute('uv', new THREE.BufferAttribute(decodeF32(part.uv), 2));` : ''}${figHasFace ? `
    if (fig.face && part.morph && !part.q) __rigMorph(fig, part, geo);` : ''}
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide${figHasPaint ? (figHasMask ? ', ...(map ? { map, ...(fig.paintTex.alphaMask ? { alphaTest: 0.4 } : {}) } : {})' : ', ...(map ? { map } : {})') : ''} }));${figHasFace ? `
    if (geo.morphAttributes.position) mesh.updateMorphTargets();` : ''}${rigSpecHook}${rigMetalHook}${rigRimHook}${rigInkHook}${castHook}
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;   // matrices mutate per frame
    group.add(mesh);
    return mesh;
  });
  scene.add(group);${bodyScaled ? `
  if (b.scale > 0) group.scale.setScalar(b.scale);` : ''}
  group.userData.rigFig = { fig, boneMeshes, mix: {}, blendTime: b.blendTime, lookA: 0,
    yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2, headTrack: b.headTrack || null };
  // muzzle locator: an empty child of the weapon bone mesh at the muzzle's bone-local rest point,
  // so its world position IS the live weapon tip (rides every clip). Shot fx originate here.
  if (fig.muzzle) {
    const mbi = fig.bones.findIndex((bn) => bn.id === fig.muzzle.bone);
    if (mbi >= 0 && boneMeshes[mbi]) {
      const loc = new THREE.Object3D();
      loc.position.set(fig.muzzle.local[0], fig.muzzle.local[1], fig.muzzle.local[2]);
      boneMeshes[mbi].add(loc);
      group.userData.rigFig.muzzle = loc;
    }
  }
  // thruster jets (nozzle jet fx — any figure declaring nozzles: boosting mechs,
  // jetpacks, rockets): one additive flame per declared nozzle
  // (fig.thrusters, baked in unit-rig.js). Each flame is a child of a nozzle
  // LOCATOR that is itself a child of the bone mesh, so it rides the posed bone
  // and leans with the body through every clip — no per-frame world math. Hidden
  // until the entity thrusts; __updateThrusters scales/fades them by e.thrust.
  // Two nested open cones (cool outer + hot inner) point out along the exhaust
  // dir, base at the nozzle mouth, PLUS a radial fan of flat triangular blue shards
  // that flare out past the cone tip (the anime boost-flare read). Non-raycasting so a
  // jet never reads as footing. __updateThrusters fades cones + shards by e.thrust.
  if (Array.isArray(fig.thrusters) && fig.thrusters.length) {
    const jets = [];
    const __jUp = new THREE.Vector3(0, 1, 0);
    // a ring of flat triangular shards around the exhaust axis (+Y), each rooted on the cone
    // rim and shooting out PAST the flame tip — deterministic per-shard length variation (no dice,
    // so muted capture stays byte-identical). One additive-blue mesh per jet, faded with thrust.
    const __shardFan = (rad, len) => {
      const M = 8, pos = new Float32Array(M * 9);
      for (let s = 0; s < M; s++) {
        const a = (s / M) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), tc = -sn, ts = c;
        const grow = 1 + 0.5 * ((s % 3) / 2);                    // per-shard length: 1.0 / 1.25 / 1.5
        const rimR = rad * (1.02 + 0.16 * (s % 2)), bw = rad * 0.18;
        const bx = c * rimR, bz = sn * rimR, tipR = rimR * 1.45, tipY = len * (1.15 + 0.7 * (grow - 1));
        const o = s * 9;
        pos[o] = bx + tc * bw; pos[o + 1] = 0; pos[o + 2] = bz + ts * bw;       // base A (on the cone rim)
        pos[o + 3] = bx - tc * bw; pos[o + 4] = 0; pos[o + 5] = bz - ts * bw;   // base B (on the cone rim)
        pos[o + 6] = c * tipR; pos[o + 7] = tipY; pos[o + 8] = sn * tipR;       // tip (splayed out + past the flame)
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fc4ff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      mesh.raycast = function () {}; mesh.frustumCulled = false;
      return mesh;
    };
    for (const th of fig.thrusters) {
      const bi = fig.bones.findIndex((bn) => bn.id === th.bone);
      if (bi < 0 || !boneMeshes[bi]) continue;
      const loc = new THREE.Object3D();
      loc.position.set(th.local[0], th.local[1], th.local[2]);
      boneMeshes[bi].add(loc);
      const holder = new THREE.Object3D();
      holder.quaternion.setFromUnitVectors(__jUp, new THREE.Vector3(th.dir[0], th.dir[1], th.dir[2]).normalize());
      holder.visible = false;
      loc.add(holder);
      const len = th.len || th.size * 4, rad = th.size;
      const coneG = new THREE.ConeGeometry(rad, len, 10, 1, true);
      coneG.translate(0, len / 2, 0);
      const core = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fd0ff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      core.raycast = function () {}; core.frustumCulled = false;
      holder.add(core);
      const innG = new THREE.ConeGeometry(rad * 0.5, len * 0.62, 8, 1, true);
      innG.translate(0, len * 0.31, 0);
      const inner = new THREE.Mesh(innG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf6ff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      inner.raycast = function () {}; inner.frustumCulled = false;
      holder.add(inner);
      const shards = __shardFan(rad, len);
      holder.add(shards);
      jets.push({ holder, core, inner, shards, kind: th.kind, baseQ: holder.quaternion.clone() });
    }
    if (jets.length) group.userData.rigFig.jets = jets;
  }${figHasJuice ? `
  if (fig.juice) __rjBuild(fig, group, boneMeshes);` : ''}
  return group;
}
function __makeBody(e) {
  const b = e.body || {};
  // LOADOUT body (weapon cycling): the platform rule's loadout lists one baked figure per weapon
  // config — build a rig group for EACH up front, show only the active one; a switch (R / 1-N)
  // changes e.body.figure and the sync swaps visibility. Variant meshes never raycast (a hidden
  // sibling body must not read as footing to the ground probe, nor an active one as a target).
  // An UNPILOTED pilotable suit runs its ambient rule at build time, so its loadout lives on
  // pilotRule — check both, or its weapons could never swap after a T take-over.
  const lo = (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length ? e.rule.loadout : null)
    || (e.pilotRule && Array.isArray(e.pilotRule.loadout) && e.pilotRule.loadout.length ? e.pilotRule.loadout : null);
  if (lo && (b.type === 'figure-rig' || b.type === 'figure-frames')) {
    const variants = {};
    const buildVariant = (fname) => {
      if (!fname || variants[fname] || !(__FIG[fname] && __FIG[fname].rig)) return;
      const g = __makeRigGroup(__FIG[fname], b);
      for (const bm of g.userData.rigFig.boneMeshes) { if (bm) bm.raycast = function () {}; }
      g.visible = fname === b.figure;
      g.userData.loadout = { variants: null, figName: fname };
      variants[fname] = g;
    };
    for (const cfg of lo) buildVariant(cfg && cfg.figure);
    // LIVERY variants (livery-ingame.plan.md): pre-build each livery's baked body so a setup-screen
    // livery pick has a warm mesh to reveal — __applyMatchParams sets body.figure + loadout figures to
    // the chosen livery, the sync's variant-swap shows it, and __applyWeaponShow re-applies the weapon.
    if (Array.isArray(e.liveries)) for (const lv of e.liveries) buildVariant(lv && lv.figure);
    for (const k in variants) variants[k].userData.loadout.variants = variants;
    return variants[b.figure] || variants[lo[0].figure] || null;
  }
  // figure-rig body (renderer-ladder P2 rung 2): rigid PARTS bound once at rest + per-clip pose
  // CURVES ([qx,qy,qz,qw,hx,hy,hz] per bone per key). One THREE.Mesh per bone; each sync slerps
  // the bracketing keys and sets one matrix per bone — no vertex writes, no frame stacks.
  if ((b.type === 'figure-rig' || b.type === 'figure-frames') && __FIG[b.figure] && __FIG[b.figure].rig) {
    return __makeRigGroup(__FIG[b.figure], b);
  }
  if (b.type === 'figure-frames' && __FIG[b.figure]) {
    const fig = __FIG[b.figure];
    const clips = {};   // clip name → array of per-frame { pos, col } (one clip per locomotion mode)
    for (const cn in fig.clips) { const cd = fig.clips[cn]; clips[cn] = cd.pos.map((p, i) => __decodeFigFrame(p, cd.col[i], cd.origin, cd.invScale, cd.foot)); }
    const first = clips.forward || clips[Object.keys(clips)[0]];
    const len = first[0].pos.length;
    // lerp only when the pack said the clip's face ordering is frame-stable AND every frame
    // shares the live buffer's size; otherwise the sync falls back to frame snapping.
    // body.lerp:false forces the legacy flipbook path (authoring/debug A-B knob).
    let lerpable = b.lerp !== false;
    for (const cn in fig.clips) { if (fig.clips[cn].lerp === false) lerpable = false; }
    for (const cn in clips) for (const fr of clips[cn]) { if (fr.pos.length !== len) lerpable = false; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(first[0].pos.slice(), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(first[0].col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${castHook}
    mesh.frustumCulled = false;   // positions mutate per frame; skip stale-bound culling
    const group = new THREE.Group(); group.add(mesh); scene.add(group);
    group.userData.fig = { clips, mesh, lerpable, mix: {}, blendTime: b.blendTime, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2 };   // figure faces +y → forward
    return group;
  }
  // POLYGOMER body (platformer.plan.md P2): a dreamed manji-tree baked server-side to b64 pos/col.
  // A static mesh (no gait — it animates by squash/stretch in __syncEntity). Round Kirby-style hero.
  if (b.type === 'polygomer' && __FIG[b.figure] && __FIG[b.figure].polygomer) {
    const P = __FIG[b.figure];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(P.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeF32(P.col), 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${castHook}
    mesh.frustumCulled = false;
    mesh.userData.polygomer = true;   // → the squash/stretch + facing branch in __syncEntity
    scene.add(mesh);
    return mesh;
  }
  if (b.type !== 'mesh') return null;
  const geo = b.shape === 'box' ? new THREE.BoxGeometry((b.size||[1,1,1])[0], (b.size||[1,1,1])[1], (b.size||[1,1,1])[2]) : new THREE.SphereGeometry(b.radius || 0.5, 24, 16);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(b.color != null ? b.color : 0xff7a59) }));${castHook}
  if (b.marker !== false) {   // a dark nub on local +X so heading/yaw is visible
    const s = (b.radius || ((b.size||[1])[0]) || 1) * 0.22;
    const nub = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), new THREE.MeshBasicMaterial({ color: 0x10141c }));
    nub.position.set((b.radius || ((b.size||[1,1])[0] / 2) || 0.6) * 1.05, 0, 0);
    mesh.add(nub);
  }
  scene.add(mesh);
  return mesh;
}
// graceful clip degrade: the directional side-dash clips (boost_left / boost_right) fall back
// to the older symmetric boost_side, and the directional SWINGS (swing_forward/left/right/back)
// fall back to swing_neutral, on bodies baked before those splits — then both to forward.
// A NAMED swing set (a melee slot's swingSet, e.g. whip_<dir>) degrades the same way: first
// to its own <set>_neutral, then to the classic swing_neutral.
function __clipLookup(clips, name) {
  if (!name) return null;
  const dir = /_(neutral|forward|left|right|back)$/.test(name) ? name.slice(0, name.lastIndexOf('_')) : null;
  const alt = (name === 'boost_left' || name === 'boost_right') ? clips.boost_side
    : (name.indexOf('swing_') === 0) ? clips.swing_neutral
    : dir ? (clips[dir + '_neutral'] || clips.swing_neutral) : null;
  return clips[name] || alt || null;
}
// resolve a locomotion MODE to (clip, phase): 'idle' holds the current clip's frame 0.
function __figClipOf(fig, e, mode) {
  const name = mode === 'idle' ? e.locomotion : mode;
  return __clipLookup(fig.clips, name) || fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
}
// accumulate a clip pose (frame-pair lerp) into out with weight w.
function __figAccum(out, clip, phase, statik, w) {
  const pair = statik ? { i0: 0, i1: 0, t: 0 } : __CW.gaitFramePair(clip.length, phase);
  const a = clip[pair.i0].pos, b = clip[pair.i1].pos, t = pair.t;
  for (let i = 0; i < out.length; i++) out[i] += (a[i] + (b[i] - a[i]) * t) * w;
}
// one bone's [q, head] from a rig clip at a phase (frame-pair nlerp over the sparse keys);
// statik (idle) = the rest pose: identity rotation, rest head.
function __rigBone(fig, clipName, phase, statik, bi, outQ, outP) {
  const bone = fig.bones[bi];
  const clip = __clipLookup(fig.clips, clipName) || fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
  if (statik || !clip) { outQ.set(0, 0, 0, 1); outP[0] = bone.head[0]; outP[1] = bone.head[1]; outP[2] = bone.head[2]; return; }
  const nb = fig.bones.length, K = clip.k, B = clip.b;
  // ONE-SHOT clips (clip.once — stagger/topple/getup, baked 0..1 inclusive) CLAMP at the final
  // key instead of wrapping: the cyclic tail segment used to interpolate the near-stand getup
  // back toward key 0 (flat on the ground) — the "sits down again" glitch — and a downed wreck
  // held at phase 1 sampled the upright hit pose. Loops keep the wrap (it closes the cycle).
  let i0, i1, t;
  if (clip.once) {
    const kf = Math.min(1, Math.max(0, phase)) * (K - 1);
    i0 = Math.min(K - 1, Math.floor(kf)); i1 = Math.min(K - 1, i0 + 1); t = kf - i0;
  } else {
    const kf = (((phase % 1) + 1) % 1) * K;
    i0 = Math.floor(kf) % K; i1 = (i0 + 1) % K; t = kf - Math.floor(kf);
  }
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const s = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (s * B[o1] - B[o0]) * t, B[o0 + 1] + (s * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (s * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (s * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
}
const __rigQA = new THREE.Quaternion(), __rigQB = new THREE.Quaternion(), __rigQL = new THREE.Quaternion();
const __rigPA = [0, 0, 0], __rigPB = [0, 0, 0];
const __rigV = new THREE.Vector3(), __rigH = new THREE.Vector3(), __rigT = new THREE.Vector3();
const __RIG_Z = new THREE.Vector3(0, 0, 1), __RIG_ONE = new THREE.Vector3(1, 1, 1);
const __rigQT = new THREE.Quaternion(), __rigQZ = new THREE.Quaternion();
const __rigAxis = new THREE.Vector3(), __rigPivot = new THREE.Vector3();
// look-pitch aim scratch: rotate the weapon arm about the shoulder to follow vertical look.
const __RIG_X = new THREE.Vector3(1, 0, 0), __apQ = new THREE.Quaternion(), __apH = new THREE.Vector3();
// PER-SLOT ARM OVERLAY (R17): read one overlay bone's [q, head] from an armOverlays curve (same
// frame-pair nlerp as __rigBone, but indexed by the overlay's own small bone list). Returns false
// when the clip has no overlay (swing/dodge/knockdown) so the caller keeps the base arm.
function __rigOverlay(ov, clipName, phase, j, outQ, outP) {
  const clip = ov.clips[clipName];
  if (!clip) return false;
  const nb = ov.bones.length, K = clip.k, B = clip.b;
  const kf = (((phase % 1) + 1) % 1) * K;
  const i0 = Math.floor(kf) % K, i1 = (i0 + 1) % K, t = kf - Math.floor(kf);
  const o0 = (i0 * nb + j) * 7, o1 = (i1 * nb + j) * 7;
  const s = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (s * B[o1] - B[o0]) * t, B[o0 + 1] + (s * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (s * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (s * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
  return true;
}
${figHasJuice ? `// A RACER'S JUICE (car-designer/juice.js): each row a trigger over the facts, read each frame (a compiled tree, never
// code), at the anchors the machine has. Flames are additive cones on their anchor (they ride the body); puffs, smoke,
// dust and sparks are pooled sprites in the world; a landing is a ring on the ground. Jitter from a seeded LCG.
let __rjSeed = 12345;
const __rjRnd = () => { __rjSeed = (Math.imul(__rjSeed, 1103515245) + 12345) >>> 0; return __rjSeed / 4294967296; };
const __rjUp = new THREE.Vector3(0, 1, 0), __rjV = new THREE.Vector3(), __rjD = new THREE.Vector3(), __rjQ = new THREE.Quaternion();
let __rjTex = null, __rjParts = [], __rjRings = [];
function __rjTexture() {
  if (__rjTex) return __rjTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); __rjTex = new THREE.CanvasTexture(c); return __rjTex;
}
function __rjWhen(n, F) {
  switch (n[0]) {
    case 'or': return __rjWhen(n[1], F) || __rjWhen(n[2], F);
    case 'and': return __rjWhen(n[1], F) && __rjWhen(n[2], F);
    case 'not': return !__rjWhen(n[1], F);
    case 'mul': return __rjWhen(n[1], F) * __rjWhen(n[2], F);
    case 'abs': return Math.abs(__rjWhen(n[1], F));
    case 'num': return n[1];
    case 'fact': return F[n[1]] || 0;
    case 'cmp': { const a = __rjWhen(n[2], F), b = __rjWhen(n[3], F); return n[1] === '<' ? a < b : n[1] === '>' ? a > b : n[1] === '<=' ? a <= b : n[1] === '>=' ? a >= b : n[1] === '==' ? a === b : a !== b; }
  }
  return 0;
}
const __rjMatch = (at, kind) => at === kind || (at.indexOf('.') < 0 && kind.split('.')[0] === at);
function __rjBuild(fig, group, boneMeshes) {
  const J = fig.juice, anchors = J.anchors.map((a) => {
    const loc = new THREE.Object3D(); loc.position.set(a.at[0], a.at[1], a.at[2]);
    const bi = a.bone ? fig.bones.findIndex((b) => b.id === a.bone) : -1;
    (bi >= 0 && boneMeshes[bi] ? boneMeshes[bi] : group).add(loc);
    return { kind: a.kind, loc, dir: new THREE.Vector3(a.dir[0], a.dir[1], a.dir[2]).normalize() };
  });
  const flames = [];
  for (const row of J.rows) if (row.look === 'flame') for (const a of anchors) if (__rjMatch(row.at, a.kind)) {
    const holder = new THREE.Object3D(); holder.quaternion.setFromUnitVectors(__rjUp, a.dir); holder.visible = false; a.loc.add(holder);
    const len = row.size * J.D * 1.6, rad = Math.max(0.03, row.size * J.D * 0.32), cols = row.colours;
    const mk = (r, l, col, o) => { const g = new THREE.ConeGeometry(r, l, 10, 1, true); g.translate(0, l / 2, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.raycast = function () {}; m.frustumCulled = false; m.userData.o = o; holder.add(m); return m; };
    const outer = mk(rad, len, cols[cols.length - 1], 0.75), inner = mk(rad * 0.55, len * 0.6, cols[0], 0.95);
    flames.push({ row, holder, outer, inner, amt: 0 });
  }
  // R4's status: every bone mesh's material tinted by uniforms chained after any patch it has (multiply, mix toward a
  // colour, add a glow); the slots the machine has (head and brake lamps, the accent: its hero piece) are bone meshes
  const st = boneMeshes.map((m) => {
    if (!m) return null;
    const u = { uTint: { value: new THREE.Vector3(1, 1, 1) }, uMix: { value: 0 }, uMixCol: { value: new THREE.Color(1, 1, 1) }, uAdd: { value: new THREE.Vector3() } };
    const prev = m.material.onBeforeCompile;
    m.material.onBeforeCompile = (sh) => {
      if (prev) prev(sh);
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = 'uniform vec3 uTint;\\nuniform float uMix;\\nuniform vec3 uMixCol;\\nuniform vec3 uAdd;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb * uTint, uMixCol, uMix) + uAdd;\\n#include <dithering_fragment>');
    };
    m.material.needsUpdate = true;
    return u;
  });
  const boneOf = (id) => fig.bones.findIndex((b) => b.id === id), slot = {};
  for (const [k, id] of Object.entries(J.slots || {})) { const i = boneOf(id); if (i >= 0 && st[i]) slot[k] = [st[i]]; }
  slot.all = st.filter(Boolean);
  const halos = [];
  for (const row of J.status || []) if (row.halo) for (const sl of row.slots) for (const a of anchors) if (a.kind === sl) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: __rjTexture(), color: new THREE.Color(row.colours[row.colours.length - 1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s0 = J.D * 0.55 * row.halo; spr.scale.set(s0, s0, s0); spr.raycast = function () {}; a.loc.add(spr); halos.push({ row, spr });
  }
  let bubble = null;
  if ((J.status || []).some((r) => r.look === 'bubble')) {
    const body = anchors.find((a) => a.kind === 'body'), rad = J.D * 1.9;
    bubble = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 16), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uA: { value: 0 } },
      // (the page draws with a logarithmic depth buffer: a shader of its own carries the log-depth chunks, as fire's do)
      vertexShader: '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec3 vN; varying vec3 vV; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;\\n#include <logdepthbuf_vertex>\\n}',
      fragmentShader: '#include <logdepthbuf_pars_fragment>\\nuniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vV; void main() {\\n#include <logdepthbuf_fragment>\\n float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uCol * (0.18 + 1.4 * f), uA * (0.25 + 0.9 * f)); }' }));
    bubble.raycast = function () {}; bubble.visible = false; bubble.position.z = rad * 0.45; (body ? body.loc : group).add(bubble);
  }
  group.userData.rigFig.rj = { J, anchors, flames, acc: {}, alive: {}, skidT: 0, st, slot, halos, bubble, on: {}, flashT: {}, prevV: 0, accel: 0, impactCD: 0, wasBoost: false, group, fired: {}, screen: 0 };${figHasLights ? `
  if (J.beams || J.trails) __rjLightsBuild(group.userData.rigFig.rj, fig, group, boneMeshes);` : ''}
}${figHasLights ? `
// A CAR'S OWN LIGHT: the headlamps' pool on the road ahead (a soft cone in the machine's frame, so it follows the
// heading and not the body's lean, drawn additively a hair over the road), and from each tail lamp a ribbon the car
// leaves behind (world points, the newest at the lamp, each fading as it ages, turned to face the camera).
const __rlBeamV = '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\\n#include <logdepthbuf_vertex>\\n}';
const __rlBeamF = '#include <logdepthbuf_pars_fragment>\\nuniform vec3 uCol; uniform float uA, uSp; varying vec2 vUv; void main() {\\n#include <logdepthbuf_fragment>\\n float v = vUv.y, u = vUv.x * 2.0 - 1.0, w = 0.3 + 0.7 * v, c = uSp * (1.0 - v);\\n float lobes = exp(-pow((u - c) / (0.34 * w), 2.0)) + exp(-pow((u + c) / (0.34 * w), 2.0));\\n float k = smoothstep(0.0, 0.3, v) * pow(1.0 - v, 1.2) * min(1.0, lobes) * 1.6;\\n gl_FragColor = vec4(uCol * k * uA, 1.0); }';
function __rjLightsBuild(rj, fig, group, boneMeshes) {
  const J = rj.J, L = { beam: null, trails: [] };
  if (J.beams) {
    const B = J.beams, g = new THREE.PlaneGeometry(B.width, B.len); g.translate(0, B.from + B.len / 2, 0.06);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(B.colour) }, uA: { value: 0 }, uSp: { value: B.spread } }, vertexShader: __rlBeamV, fragmentShader: __rlBeamF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.raycast = function () {}; m.frustumCulled = false; m.renderOrder = 0.9; group.add(m); L.beam = { m, B };
  }
  if (J.trails) for (const at of J.trails.at) {
    const bi = J.trails.bone ? fig.bones.findIndex((b) => b.id === J.trails.bone) : -1, loc = new THREE.Object3D();
    loc.position.set(at[0], at[1], at[2]); (bi >= 0 && boneMeshes[bi] ? boneMeshes[bi] : group).add(loc);
    const N = J.trails.points, pos = new Float32Array(N * 6), col = new Float32Array(N * 6), idx = [];
    for (let i = 0; i + 1 < N; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.raycast = function () {}; m.frustumCulled = false; scene.add(m);
    L.trails.push({ loc, m, pts: [], c: new THREE.Color(J.trails.colour) });
  }
  rj.lights = L;
}
const __rlP = new THREE.Vector3(), __rlS = new THREE.Vector3(), __rlT = new THREE.Vector3(), __rlE = new THREE.Vector3();
function __rjLightsTick(rj, e, F, d) {
  const L = rj.lights, t = __world.time || 0;
  if (L.beam) L.beam.m.material.uniforms.uA.value = L.beam.B.amount * (0.85 + 0.15 * Math.min(1, F.speed / 30));
  const T = rj.J.trails;
  for (const tr of L.trails) {
    tr.loc.getWorldPosition(__rlP);
    const last = tr.pts[0];
    if (F.speed > T.minSpeed && (!last || __rlP.distanceToSquared(last.p) > 0.04)) { tr.pts.unshift({ p: __rlP.clone(), t }); if (tr.pts.length > T.points) tr.pts.pop(); }
    while (tr.pts.length && t - tr.pts[tr.pts.length - 1].t > T.life) tr.pts.pop();
    const pos = tr.m.geometry.attributes.position.array, col = tr.m.geometry.attributes.color.array, n = tr.pts.length;
    const A = T.amount * (F.braking ? T.brake : 1);
    for (let i = 0; i < T.points; i++) {
      const q = tr.pts[Math.min(i, n - 1)], o = i * 6;
      if (!q || n < 2) { for (let k = 0; k < 6; k++) { pos[o + k] = 0; col[o + k] = 0; } continue; }
      const a = tr.pts[Math.max(0, Math.min(i, n - 1) - 1)].p, b = tr.pts[Math.min(n - 1, Math.min(i, n - 1) + 1)].p;
      const age = i < n ? Math.max(0, 1 - (t - q.t) / T.life) : 0, hw = (T.width / 2) * (0.25 + 0.75 * age);   // (narrowing as it ages)
      __rlT.subVectors(b, a); __rlE.subVectors(camera.position, q.p); __rlS.crossVectors(__rlT, __rlE);
      const sl = __rlS.length(); if (sl > 1e-6) __rlS.multiplyScalar(hw / sl); else __rlS.set(0, 0, hw);
      pos[o] = q.p.x + __rlS.x; pos[o + 1] = q.p.y + __rlS.y; pos[o + 2] = q.p.z + __rlS.z;
      pos[o + 3] = q.p.x - __rlS.x; pos[o + 4] = q.p.y - __rlS.y; pos[o + 5] = q.p.z - __rlS.z;
      const f = A * age * age;
      col[o] = col[o + 3] = tr.c.r * f; col[o + 1] = col[o + 4] = tr.c.g * f; col[o + 2] = col[o + 5] = tr.c.b * f;
    }
    tr.m.geometry.attributes.position.needsUpdate = true; tr.m.geometry.attributes.color.needsUpdate = true;
  }
}` : ''}
let __rjStarTex = null, __rjStars = [], __rjStreaks = [], __rjShocks = [], __rjScreen = null;
function __rjStarTexture() {
  if (__rjStarTex) return __rjStarTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 29, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a)); } g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  __rjStarTex = new THREE.CanvasTexture(c); return __rjStarTex;
}
function __rjStar(col, size) {
  let s = __rjStars.find((q) => !q.on);
  if (!s) { if (__rjStars.length >= 160) return null; const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: __rjStarTexture(), transparent: true, depthWrite: false, depthTest: false })); spr.renderOrder = 10; spr.raycast = function () {}; scene.add(spr); s = { spr }; __rjStars.push(s); }
  s.on = true; s.age = 0; s.spr.material.color.set(col); s.spr.visible = true; s.size = size; return s;
}
function __rjStreak(rj, e, row) {
  let k = __rjStreaks.find((q) => !q.on);
  if (!k) { if (__rjStreaks.length >= 240) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.raycast = function () {}; scene.add(m); k = { m }; __rjStreaks.push(k); }
  const D = rj.J.D, h = e.transform.heading, f = [Math.cos(h), Math.sin(h)], sd = [-f[1], f[0]], side = __rjRnd() < 0.5 ? -1 : 1, top = __rjRnd() < 0.3;
  const off = top ? (__rjRnd() - 0.5) * D * 1.6 : side * D * (1.1 + __rjRnd() * 1.2), up = top ? D * (1.6 + __rjRnd() * 0.8) : D * (0.2 + __rjRnd() * 1.4), ahead = D * (__rjRnd() * 2 - 0.6);
  const p = e.transform.pos, gz = p[2] - ((e.rule && e.rule.eye) || 0);
  k.m.position.set(p[0] + f[0] * ahead + sd[0] * off, p[1] + f[1] * ahead + sd[1] * off, gz + up);
  k.m.rotation.set(top ? 0 : Math.PI / 2, 0, h, 'ZYX'); k.len = row.size * D * (0.6 + __rjRnd() * 0.8); k.wid = D * 0.035;
  k.m.material.color.set(row.colours[0]); k.on = true; k.age = 0; k.life = row.life * (0.7 + __rjRnd() * 0.6); k.m.visible = true; k.rj = rj; k.key = row.id;
  rj.alive[row.id] = (rj.alive[row.id] || 0) + 1;
}
// one ring, behind the machine at the middle of its anchors (two stacks throw one shock), thin and faint
function __rjShock(rj, as, e, row) {
  if (!as.length) return;
  let k = __rjShocks.find((q) => !q.on);
  if (!k) { const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.raycast = function () {}; scene.add(m); k = { m }; __rjShocks.push(k); }
  k.m.position.set(0, 0, 0); for (const a of as) { a.loc.getWorldPosition(__rjV); k.m.position.addScaledVector(__rjV, 1 / as.length); }
  k.m.position.x -= Math.cos(e.transform.heading) * rj.J.D * 0.3; k.m.position.y -= Math.sin(e.transform.heading) * rj.J.D * 0.3;
  k.m.rotation.set(0, Math.PI / 2, e.transform.heading, 'ZYX');
  k.m.material.color.set(row.colours[0]); k.on = true; k.age = 0; k.life = row.life; k.size = row.size * rj.J.D; k.m.visible = true;
}
function __rjScreenLines(amt, row) {
  if (!__rjScreen) {
    const host = document.getElementById('wrap') || document.body, c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:5';
    host.appendChild(c); __rjScreen = { c, g: c.getContext('2d'), amt: 0 };
  }
  const S = __rjScreen; S.amt += (amt - S.amt) * 0.25;
  const c = S.c, w = c.clientWidth || 1, h = c.clientHeight || 1; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  S.g.clearRect(0, 0, w, h); if (S.amt < 0.03) return;
  const cx = w / 2, cy = h * 0.46, n = Math.round((row ? row.count : 40) * S.amt);
  S.g.strokeStyle = row ? row.colours[0] : '#ffffff';
  for (let i = 0; i < n; i++) {
    const t = __rjRnd() * Math.PI * 2, R = Math.hypot(w, h) * 0.55, x0 = cx + Math.cos(t) * R, y0 = cy + Math.sin(t) * R * 0.8, k = 0.18 + __rjRnd() * 0.32;
    S.g.globalAlpha = (0.25 + __rjRnd() * 0.55) * S.amt; S.g.lineWidth = 1 + __rjRnd() * 3;
    S.g.beginPath(); S.g.moveTo(x0, y0); S.g.lineTo(x0 + (cx - x0) * k, y0 + (cy - y0) * k); S.g.stroke();
  }
  S.g.globalAlpha = 1;
}
function __rjSpawn(rj, row, a, e, F, tier) {
  const key = row.id; if ((rj.alive[key] || 0) >= row.budget) return;
  let p = __rjParts.find((q) => !q.on);
  if (!p) { if (__rjParts.length >= 900) return; const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: __rjTexture(), transparent: true, depthWrite: false })); spr.raycast = function () {}; scene.add(spr); p = { spr }; __rjParts.push(p); }
  a.loc.getWorldPosition(__rjV); a.loc.getWorldQuaternion(__rjQ); __rjD.copy(a.dir).applyQuaternion(__rjQ);
  const D = rj.J.D, r = () => __rjRnd() - 0.5, look = row.look, spark = look === 'spark' || look === 'trail';
  const fx = Math.cos(e.transform.heading), fy = Math.sin(e.transform.heading), v = e.speed || 0;
  p.on = true; p.rj = rj; p.key = key; p.age = 0; p.life = (row.life || 0.6) * (0.8 + 0.4 * __rjRnd());
  p.spr.position.set(__rjV.x + r() * D * 0.1, __rjV.y + r() * D * 0.1, __rjV.z + (look === 'puff' ? 0 : 0.02));
  p.grav = spark && look === 'spark' ? -9 : 0;
  if (look === 'puff') p.vel = [__rjD.x * 0.6 + r() * 0.3 + fx * v, __rjD.y * 0.6 + r() * 0.3 + fy * v, 0.5 + __rjD.z * 0.6];
  else if (look === 'smoke') p.vel = [r() * 0.8 + fx * v * 0.3, r() * 0.8 + fy * v * 0.3, 0.6 + __rjRnd() * 0.5];
  else if (look === 'dust') p.vel = [r() * 1.6 + fx * v * 0.2, r() * 1.6 + fy * v * 0.2, 0.8 + __rjRnd() * 0.8];
  else if (look === 'spark') p.vel = [r() * 3 + fx * v * 0.4, r() * 3 + fy * v * 0.4, 1.2 + __rjRnd() * 2.4];
  else p.vel = [0, 0, 0];
  const cols = row.colours, c0 = cols[Math.min(cols.length - 1, tier)], c1 = row.tierBy ? c0 : cols[cols.length - 1];
  p.c0 = new THREE.Color(c0); p.c1 = new THREE.Color(c1);
  p.s0 = row.size * D * (spark ? 1 : 0.8); p.s1 = spark ? p.s0 * 0.3 : p.s0 * 2.6;
  p.o0 = spark ? 1 : look === 'puff' ? 0.75 : 0.6;
  p.spr.material.blending = spark ? THREE.AdditiveBlending : THREE.NormalBlending; p.spr.material.needsUpdate = true;
  p.spr.visible = true; rj.alive[key] = (rj.alive[key] || 0) + 1;
}
function __rjRing(rj, row, e) {
  let g = __rjRings.find((q) => !q.on);
  if (!g) { const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 28), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.raycast = function () {}; scene.add(m); g = { m }; __rjRings.push(g); }
  g.on = true; g.age = 0; g.life = row.life || 0.4; g.size = row.size * rj.J.D; g.m.position.set(e.transform.pos[0], e.transform.pos[1], (e.transform.pos[2] - ((e.rule && e.rule.eye) || 0)) + 0.03);
  g.m.material.color.set(row.colours[0]); g.m.visible = true;
}
// the status rows on the slots' uniforms: reset, then each row on (a glow adds, a tint multiplies, the rest mix toward
// a colour, the strongest wins); a lamp's halo with its glow; the shield's bubble
const __rjC = new THREE.Color();
function __rjStatus(rj, F, d, t) {
  for (const u of rj.st) if (u) { u.uTint.value.set(1, 1, 1); u.uMix.value = 0; u.uAdd.value.set(0, 0, 0); }
  for (const h of rj.halos) h.spr.material.opacity = 0;
  for (const row of rj.J.status || []) {
    const on = !!__rjWhen(row.when, F), was = rj.on[row.id]; rj.on[row.id] = on;
    if (row.look === 'flash') { if (on && !was) rj.flashT[row.id] = row.duration || 0.12; rj.flashT[row.id] = Math.max(0, (rj.flashT[row.id] || 0) - d); }
    const live = row.look === 'flash' ? (rj.flashT[row.id] || 0) > 0 : on;
    if (row.look === 'bubble') { if (rj.bubble) { rj.bubble.visible = live; rj.bubble.material.uniforms.uCol.value.set(row.colours[0]); rj.bubble.material.uniforms.uA.value = (row.amount || 0.8) * (0.85 + 0.15 * Math.sin(t * 6)); } continue; }
    if (!live) continue;
    const by = row.by ? F[row.by] || 0 : 1, A = row.amount != null ? row.amount : 1;
    let mix = 0, glow = 0, tint = null;
    if (row.look === 'glow') { __rjC.set(row.colours[row.colours.length - 1]); glow = A; }
    else if (row.look === 'fill') { const full = by >= 0.999; __rjC.set(full ? row.colours[row.colours.length - 1] : row.colours[0]); mix = full ? 0.45 + 0.35 * Math.sin(t * 14) : 0.6 * Math.min(1, by); }
    else if (row.look === 'tier') { const i = Math.max(0, (row.tierAt || [0]).filter((x) => by >= x).length - 1); __rjC.set(row.colours[Math.min(row.colours.length - 1, i)]); mix = A; glow = A * 0.5; }
    else if (row.look === 'flash') { __rjC.set(row.colours[0]); mix = A * ((rj.flashT[row.id] || 0) / (row.duration || 0.12)); }
    else if (row.look === 'tint') { if (row.flicker && __rjRnd() < row.flicker * 0.15) continue; __rjC.set(row.colours[0]); tint = A * Math.min(1, by); }
    else if (row.look === 'cycle') { __rjC.set(row.colours[Math.floor(t * (row.rate || 8)) % row.colours.length]); mix = A; }
    else if (row.look === 'pulse') { __rjC.set(row.colours[0]); mix = A * (0.5 + 0.5 * Math.sin(t * (row.rate || 2) * Math.PI * 2)); }
    for (const sl of row.slots) for (const u of rj.slot[sl] || []) {
      if (tint != null) u.uTint.value.set(u.uTint.value.x * (1 - tint + tint * __rjC.r), u.uTint.value.y * (1 - tint + tint * __rjC.g), u.uTint.value.z * (1 - tint + tint * __rjC.b));
      if (mix > u.uMix.value) { u.uMix.value = mix; u.uMixCol.value.copy(__rjC); }
      if (glow) u.uAdd.value.set(u.uAdd.value.x + __rjC.r * glow * 0.5, u.uAdd.value.y + __rjC.g * glow * 0.5, u.uAdd.value.z + __rjC.b * glow * 0.5);
    }
    if (glow) for (const h of rj.halos) if (h.row === row) h.spr.material.opacity = Math.min(1, glow);
  }
}
// the big effects: stars from a bump, stars round the head, motion lines at speed, a boost's shock, speed lines on
// the pilot's screen
function __rjFx(rj, e, F, d) {
  for (const row of rj.J.fx || []) {
    const on = !!__rjWhen(row.when, F), key = 'fx:' + row.id, was = rj.on[key]; rj.on[key] = on;
    if (row.look === 'screen') { if (__world.pilotId === e.id || (!__world.pilotId && e.pilotable)) { __rjScreenLines(on ? (row.by ? F[row.by] || 0 : 1) : 0, row); rj.screen = __rjScreen ? __rjScreen.amt : 0; } continue; }
    if (row.look === 'streak') { if (!on || (rj.alive[row.id] || 0) >= row.budget) continue; rj.acc[key] = (rj.acc[key] || 0) + row.rate * d; while (rj.acc[key] >= 1) { rj.acc[key] -= 1; __rjStreak(rj, e, row); } continue; }
    if (!on || was) continue;   // the rest fire on the rising edge
    rj.fired[row.id] = (rj.fired[row.id] || 0) + 1;
    const a = rj.anchors.find((x) => x.kind === row.at || x.kind.split('.')[0] === row.at); if (!a) continue;
    if (row.look === 'shock') { __rjShock(rj, rj.anchors.filter((b) => b.kind === row.at), e, row); continue; }
    a.loc.getWorldPosition(__rjV);
    for (let i = 0; i < (row.count || 5); i++) {
      const s = __rjStar(row.colours[i % row.colours.length], row.size * rj.J.D * (0.75 + __rjRnd() * 0.5)); if (!s) break;
      s.life = row.life * (0.85 + __rjRnd() * 0.3); s.spin = (__rjRnd() - 0.5) * 14;
      if (row.look === 'orbit') { s.orbit = { a: a, ph: (i / (row.count || 4)) * Math.PI * 2, r: rj.J.D * 0.55 }; s.vel = null; }
      else { const th = __rjRnd() * Math.PI * 2, sp = 2.2 + __rjRnd() * 2.2; s.orbit = null; s.vel = [Math.cos(th) * sp, Math.sin(th) * sp, 1.5 + __rjRnd() * 2.5]; s.spr.position.copy(__rjV); }
    }
  }
}
function __rjPools(d) {
  for (const s of __rjStars) {
    if (!s.on) continue;
    s.age += d; const u = s.age / s.life;
    if (u >= 1) { s.on = false; s.spr.visible = false; continue; }
    if (s.orbit) { s.orbit.a.loc.getWorldPosition(__rjV); const ph = s.orbit.ph + s.age * 7; s.spr.position.set(__rjV.x + Math.cos(ph) * s.orbit.r, __rjV.y + Math.sin(ph) * s.orbit.r, __rjV.z + s.orbit.r * 0.6 + 0.06 * Math.sin(ph * 2)); }
    else { s.vel[2] -= 6 * d; s.spr.position.x += s.vel[0] * d; s.spr.position.y += s.vel[1] * d; s.spr.position.z += s.vel[2] * d; }
    const pop = u < 0.15 ? u / 0.15 * 1.25 : 1.25 - 0.45 * (u - 0.15), sz = s.size * pop; s.spr.scale.set(sz, sz, sz);
    s.spr.material.rotation += s.spin * d; s.spr.material.opacity = u > 0.7 ? (1 - u) / 0.3 : 1;
  }
  for (const k of __rjStreaks) {
    if (!k.on) continue;
    k.age += d; const u = k.age / k.life;
    if (u >= 1) { k.on = false; k.m.visible = false; k.rj.alive[k.key]--; continue; }
    k.m.scale.set(k.len * (0.4 + 0.6 * Math.min(1, u * 3)), k.wid, 1); k.m.material.opacity = 0.75 * (1 - u);
  }
  for (const k of __rjShocks) {
    if (!k.on) continue;
    k.age += d; const u = k.age / k.life;
    if (u >= 1) { k.on = false; k.m.visible = false; continue; }
    const s = k.size * (0.2 + 0.8 * Math.sqrt(u)); k.m.scale.set(s, s, s); k.m.material.opacity = 0.5 * (1 - u) * (1 - u);
  }
}
function __updateRacerJuice(dt) {
  const d = Math.min(0.05, dt || 0), t = __world.time || 0;
  for (const e of __world.entities) {
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig, rj = rf && rf.rj;
    if (!rj) continue;
    rj.skidT = e.skidding ? rj.skidT + d : 0;
    const R = e.rule || {}, vv = e.speed || 0, corner = (vv * vv * Math.abs(Math.tan(e.steerAngle || 0))) / Math.max(0.3, R.wheelbase || 1) / (Math.max(0.2, R.grip || 1) * 9.81);
    rj.cornerT = corner > 0.6 ? (rj.cornerT || 0) + d : 0;
    const hp = e.hp != null && e.hpMax ? 1 - e.hp / e.hpMax : (e.damage || 0);
    // R4's facts: the speed's change (smoothed), a bump (more speed lost in an instant than any brake: an edge, with a
    // cooldown), a boost's first frame, the share of the top speed, a surge (a boost, or a hard pull)
    const acc = d > 0 ? (Math.abs(vv) - rj.prevV) / d : 0; rj.prevV = Math.abs(vv); rj.accel += (acc - rj.accel) * Math.min(1, d * 8);
    rj.impactCD = Math.max(0, rj.impactCD - d);
    const impact = acc < -28 && rj.impactCD === 0 ? 1 : 0; if (impact) rj.impactCD = 0.6;
    const boosting = e.boosting || (e.boostT || 0) > 0 ? 1 : 0, boostStart = boosting && !rj.wasBoost ? 1 : 0; rj.wasBoost = !!boosting;
    const topShare = Math.abs(vv) / Math.max(6, R.topSpeed || 13), surge = boosting ? 1 : Math.max(0, Math.min(1, (rj.accel - 4) / 6));
    const F = { speed: Math.abs(e.speed || 0), throttle: e.throttle || 0, braking: e.braking ? 1 : 0, steer: e.steerAngle || 0, skidding: e.skidding ? 1 : 0, skidTime: rj.skidT, corner, cornerTime: rj.cornerT, landed: e.landed ? 1 : 0, boosting, boostStart, accel: rj.accel, topShare, surge, impact, hit: e.hit || e.hitStart ? 1 : 0, charge: e.boostCharge != null ? e.boostCharge : (e.charge || 0), shield: e.shield ? 1 : 0, invulnerable: e.invulnerable || e.star ? 1 : 0, item: e.item ? 1 : 0, offroad: ${driveSurface ? `(__surface(e.transform.pos) || { mu: 1 }).mu < 0.85 ? 1 : 0` : '0'}, damage: hp };
    for (const row of rj.J.rows) {
      const on = !!__rjWhen(row.when, F);
      if (row.look === 'flame') continue;
      if (row.look === 'ring') { if (on) __rjRing(rj, row, e); continue; }
      if (!on) continue;
      const tier = row.tierBy ? Math.max(0, row.tierAt.filter((x) => F[row.tierBy] >= x).length - 1) : 0;
      for (const a of rj.anchors) {
        if (!__rjMatch(row.at, a.kind)) continue;
        const k = row.id + '|' + a.kind + a.loc.id; rj.acc[k] = (rj.acc[k] || 0) + (row.look === 'trail' ? 30 : (row.rate || 10)) * d;
        while (rj.acc[k] >= 1) { rj.acc[k] -= 1; __rjSpawn(rj, row, a, e, F, tier); }
      }
    }
    for (const f of rj.flames) {
      const want = __rjWhen(f.row.when, F) ? 1 : 0; f.amt += (want - f.amt) * Math.min(1, d * 18);
      if (f.amt < 0.02) { if (f.holder.visible) f.holder.visible = false; continue; }
      f.holder.visible = true;
      const fl = 1 - (f.row.flicker || 0.2) + (f.row.flicker || 0.2) * (0.5 + 0.5 * Math.sin(t * 47 + f.holder.id));
      f.holder.scale.set(0.6 + 0.4 * f.amt, f.amt * fl, 0.6 + 0.4 * f.amt);
      f.outer.material.opacity = f.outer.userData.o * f.amt; f.inner.material.opacity = f.inner.userData.o * f.amt;
    }
    __rjStatus(rj, F, d, t);
    __rjFx(rj, e, F, d);${figHasLights ? `
    if (rj.lights) __rjLightsTick(rj, e, F, d);` : ''}
  }
  for (const p of __rjParts) {
    if (!p.on) continue;
    p.age += d; const u = p.age / p.life;
    if (u >= 1) { p.on = false; p.spr.visible = false; p.rj.alive[p.key]--; continue; }
    p.vel[2] += p.grav * d; const drag = Math.max(0, 1 - d * 2.2); p.vel[0] *= drag; p.vel[1] *= drag;
    p.spr.position.x += p.vel[0] * d; p.spr.position.y += p.vel[1] * d; p.spr.position.z = Math.max(0.02, p.spr.position.z + p.vel[2] * d);
    const s = p.s0 + (p.s1 - p.s0) * u; p.spr.scale.set(s, s, s);
    p.spr.material.color.copy(p.c0).lerp(p.c1, u); p.spr.material.opacity = p.o0 * (1 - u) * (1 - u * 0.3);
  }
  for (const g of __rjRings) {
    if (!g.on) continue;
    g.age += d; const u = g.age / g.life;
    if (u >= 1) { g.on = false; g.m.visible = false; continue; }
    const s = g.size * (0.35 + 0.65 * Math.sqrt(u)); g.m.scale.set(s, s, s); g.m.material.opacity = 0.85 * (1 - u);
  }
  __rjPools(d);
}
` : ''}${figHasLive ? `// THE LIVE VEHICLE (car-designer/racer.js \`live\`): the drive rule's facts, exaggerated, as bone overlays. Springs
// per rig (rig.lv): the lean out of a turn, the pitch (a squat on the throttle, a dive on the brake), the bounce of a
// landing (a damped spring), an engine's idle shiver; the front wheels' steer, the steering wheel's turn, a mast's
// whip and a propeller's spin. → per bone: 'steer' | 'body' | 'wheel' | 'mast' and the frame's quaternions.
const __lvQ = new THREE.Quaternion(), __lvQB = new THREE.Quaternion(), __lvQP = new THREE.Quaternion(), __lvQS = new THREE.Quaternion(), __lvQW = new THREE.Quaternion(), __lvQM = new THREE.Quaternion(), __lvH = new THREE.Vector3();
const __LV_X = new THREE.Vector3(1, 0, 0), __LV_Y = new THREE.Vector3(0, 1, 0), __LV_Z = new THREE.Vector3(0, 0, 1);
function __rigLive(e, rig, dt) {
  const L = rig.fig.live, G = L.gains, d = Math.min(0.05, dt || 0);
  if (!rig.lv) { rig.lv = { lean: 0, pitch: 0, bz: 0, vz: 0, spin: 0, whip: 0, role: {} }; rig.fig.bones.forEach((b, i) => { if (L.steer.includes(b.id)) rig.lv.role[i] = 'steer'; else if (b.id === L.wheel) rig.lv.role[i] = 'wheel'; else if (b.id === L.mast) rig.lv.role[i] = 'mast'; else if (L.body.bones.includes(b.id)) rig.lv.role[i] = 'body'; }); }
  const S = rig.lv, v = e.speed || 0, st = e.steerAngle || 0, k = (r) => Math.min(1, d * r);
  const steer = Math.max(-G.steerMax, Math.min(G.steerMax, st * G.steer));
  S.lean += (Math.max(-G.leanMax, Math.min(G.leanMax, st * Math.abs(v) * G.lean)) - S.lean) * k(6);
  S.pitch += ((e.throttle || 0) * G.squat * (v >= 0 ? 1 : -1) - (e.braking ? G.dive : 0) - S.pitch) * k(5);
  if (e.landed) S.vz -= G.bounce * 4;
  S.vz += (-140 * S.bz - 11 * S.vz) * d; S.bz += S.vz * d;
  S.spin += d * (5 + Math.abs(v) * 1.6);
  S.whip += (Math.min(G.wobbleMax, Math.abs(v) * G.wobble) + (e.braking ? -0.15 : 0) - S.whip) * k(4);
  const shiver = (e.throttle || 0) > 0.05 || Math.abs(v) < 0.5 ? 0.004 * Math.sin((__world.time || 0) * 52) : 0;
  __lvQS.setFromAxisAngle(__LV_Z, steer);
  __lvQW.setFromAxisAngle(__LV_Y, -steer * 2.2);
  __lvQB.setFromAxisAngle(__LV_Y, S.lean); __lvQP.setFromAxisAngle(__LV_X, S.pitch); __lvQB.multiply(__lvQP);
  __lvQM.setFromAxisAngle(__LV_X, S.whip + 0.05 * Math.sin((__world.time || 0) * 9) * Math.min(1, Math.abs(v) / 8));
  if (L.spin) { __lvQ.setFromAxisAngle(__LV_Z, S.spin); __lvQM.multiply(__lvQ); }
  return { role: S.role, steer: __lvQS, wheel: __lvQW, body: __lvQB, mast: __lvQM, pivot: L.body.pivot, dz: Math.max(-0.2, S.bz) + shiver };
}
` : ''}${figHasForms ? `// A BODY IN TWO FORMS (transformation/compose.js): the base form plays the plain clips; another form plays its own
// (\`vehicle:drive\`), holding its rest (\`vehicle:idle\`) for any it has none of; the transformation's clips
// (\`transform:vehicle\`) play as named.
function __formMode(fig, e, mode) {
  if (mode.indexOf(':') >= 0 && fig.clips[mode]) return mode;
  const f = e.form || fig.forms.base;
  if (f === fig.forms.base) return mode;
  const k = f + ':' + mode;
  return fig.clips[k] ? k : f + ':idle';
}
` : ''}function __syncRigEntity(e, m, rig, dt) {
  const yawA = e.transform.heading + rig.yaw;
  if (e.tumble && e.tumble.angle) {
    // ACROBATIC DODGE tumble: spin the WHOLE body a full turn about a world
    // horizontal axis (forward roll / backflip / barrel-roll) or vertical
    // (spin). Pivot about the body CENTER, not the feet, so it tumbles in place
    // instead of cartwheeling on the soles: q = R_tumble · R_yaw, and the group
    // origin is shifted so the point at local height c maps back to feet+c.
    __rigAxis.set(e.tumble.axis[0], e.tumble.axis[1], e.tumble.axis[2]);
    if (__rigAxis.lengthSq() < 1e-9) __rigAxis.set(0, 0, 1);
    __rigAxis.normalize();
    __rigQT.setFromAxisAngle(__rigAxis, e.tumble.angle);
    __rigQZ.setFromAxisAngle(__RIG_Z, yawA);
    m.quaternion.copy(__rigQT).multiply(__rigQZ);
    const c = (rig.fig.figH || 1) * 0.42;
    __rigPivot.set(0, 0, c).applyQuaternion(__rigQT);
    m.position.set(e.transform.pos[0] - __rigPivot.x, e.transform.pos[1] - __rigPivot.y, e.transform.pos[2] + c - __rigPivot.z);
  } else {
    ${figHasForms ? `if (e.tilt && rig.fig.forms) m.rotation.set(e.tilt.pitch || 0, e.tilt.roll || 0, yawA, 'ZYX');   // a flying form's attitude
    else ` : ''}m.rotation.set(0, 0, yawA);
  }
  const fig = rig.fig;
  ${figHasForms ? 'let' : 'const'} mode = e.moving ? e.locomotion : 'idle';${figHasForms ? `
  if (fig.forms) mode = __formMode(fig, e, mode);` : ''}
  const mix = __CW.advanceGaitMix(rig.mix, mode, e.gaitPhase, dt || 0, rig.blendTime);
  const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
  // head-look-at overlay (renderer-convergence step 2, procedural rung): ease the head bone's
  // yaw toward a tracked entity, clamped to a natural range — a runtime joint override no
  // frame stack can express.
  let lookWant = 0;
  if (rig.headTrack) {
    const tgt = (__world.entities || []).find((x) => x.id === rig.headTrack);
    if (tgt) {
      m.updateMatrixWorld();
      __rigT.set(tgt.transform.pos[0], tgt.transform.pos[1], tgt.transform.pos[2]);
      m.worldToLocal(__rigT);                                   // figure-local: forward = +y
      const a = Math.atan2(-__rigT.x, __rigT.y);
      lookWant = Math.max(-1.0, Math.min(1.0, a));
    }
  }
  rig.lookA += (lookWant - rig.lookA) * Math.min(1, (dt || 0) * 6);
  // A bake may carry an explicit 'idle' clip (an armed unit's standing hold —
  // unit-rig.js aim lock); standing still then plays it instead of snapping to
  // the raw rest pose. Bakes without one keep the statik rest, byte-identical.
  const hasIdle = !!fig.clips.idle;
  // per-slot arm overlay (R17): the active loadout slot can pose the right arm differently (the
  // bazooka's over-shoulder launch). Resolve the overlay for the shown weapon tag; the loop below
  // overrides upperArmR/forearmR/weapon_<tag> from it on the aim-locked clips it covers.
  let ov = null, ovClip = null;
  if (fig.armOverlays) {
    const lo = __entLoadout(e);
    const cfg = lo && lo[e.loadoutIdx || 0];
    // show may be a LIST [active, ...racked cosmetic tags] — the ACTIVE weapon is the first
    // entry; only it can carry an arm overlay (racked copies are display-only).
    const show0 = cfg && cfg.show;
    const show = Array.isArray(show0) ? show0[0] : show0;
    // a weapon tag selects its own overlay (over-shoulder bazooka); a slot that flags restHand
    // (a body-fired empty hand — head vulcan / torso beam) selects the __rest overlay so the freed
    // RIGHT arm settles into the ready guard instead of holding an invisible weapon. Opt-in per
    // slot: a hand-fired empty slot (wrist gatling / finger vulcan) keeps its arm POINTED, so it
    // must NOT set restHand.
    const overlayTag = show && fig.armOverlays[show] ? show : (cfg && cfg.restHand && fig.armOverlays.__rest ? '__rest' : null);
    if (overlayTag) {
      ov = fig.armOverlays[overlayTag];
      ovClip = mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode;
    }
  }
  // LOOK-PITCH AIM (vertical): the body yaws to face the aim, but the arm holds a FIXED pitch — so
  // looking up/down never raised the weapon (only the fire ray followed pitch). Rotate the right arm
  // (upperArmR + forearmR + the active weapon bone) about the SHOULDER by the look pitch so the barrel
  // points where you aim. Ranged slots only; skipped while a swing / dodge / reaction owns the arm;
  // clamped so the arm never folds through the body. The over-shoulder overlay (above) sets the base
  // arm; this rotates that whole arm about the shoulder, so the launcher elevates rigidly.
  let apAng = 0, apSet = null, apPivot = null;
  {
    const lo = __entLoadout(e);
    const cfg = lo && lo[e.loadoutIdx || 0];
    const pitch = e.transform.pitch || 0;
    const owned = e.swingT != null || e.dodgeT != null || e.staggerT != null;
    // piloted suit only (a vacated suit keeps its last look pitch — don't let it hold a stale elevation)
    const piloted = !__world.pilotId || e.id === __world.pilotId;
    // R19 fix: a show:'none' slot (head vulcan / torso beam) fires from the BODY, not the hand — keep
    // the arm DOWN (skip the look-pitch raise) since there is no held weapon to point.
    // the ACTIVE tag when show is a [active, ...racked] list — racked copies never aim
    const showP = Array.isArray(cfg && cfg.show) ? cfg.show[0] : (cfg && cfg.show);
    if (piloted && cfg && cfg.weapon && !cfg.strike && showP !== 'none' && !owned && Math.abs(pitch) > 1e-3) {
      if (!fig.__armIdx) {
        fig.__armIdx = { up: fig.bones.findIndex((b) => b.id === 'upperArmR'), fo: fig.bones.findIndex((b) => b.id === 'forearmR'), hand: fig.bones.findIndex((b) => b.id === 'handR'), wtag: {} };
        fig.bones.forEach((b, i) => { if (b.id.indexOf('weapon_') === 0) fig.__armIdx.wtag[b.id.slice(7)] = i; });
      }
      if (fig.__armIdx.up >= 0 && fig.__armIdx.fo >= 0) {
        apAng = Math.max(-0.95, Math.min(0.95, pitch));   // ~±54° of arm elevation
        const wi = (showP && showP !== 'none') ? (fig.__armIdx.wtag[showP] ?? -1) : -1;
        // the FIST orbits the shoulder with the forearm (else it stays at the level 'middle' pose
        // while the arm + weapon elevate — the hand detaches from the wrist). −1 (hand-less) is inert.
        apSet = { up: fig.__armIdx.up, fo: fig.__armIdx.fo, w: wi, hand: fig.__armIdx.hand };
        __apQ.setFromAxisAngle(__RIG_X, apAng);   // +y forward → tips toward +z (up) for pitch>0
      }
    }
  }
${figHasLive ? `  const LV = fig.live ? __rigLive(e, rig, dt) : null;
` : ''}  for (let bi = 0; bi < fig.bones.length; bi++) {
    const mesh = rig.boneMeshes[bi];
    if (!mesh) continue;
    __rigBone(fig, mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode, mix.phase, mix.mode === 'idle' && !hasIdle, bi, __rigQA, __rigPA);
    if (mix.prevMode) {
      __rigBone(fig, mix.prevMode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.prevMode, mix.prevPhase, mix.prevMode === 'idle' && !hasIdle, bi, __rigQB, __rigPB);
      __rigQA.slerp(__rigQB, 1 - w);
      __rigPA[0] += (__rigPB[0] - __rigPA[0]) * (1 - w);
      __rigPA[1] += (__rigPB[1] - __rigPA[1]) * (1 - w);
      __rigPA[2] += (__rigPB[2] - __rigPA[2]) * (1 - w);
    }
    if (fig.bones[bi].id === 'head' && Math.abs(rig.lookA) > 1e-4) {
      __rigQL.setFromAxisAngle(__RIG_Z, rig.lookA);
      __rigQA.premultiply(__rigQL);
    }
    // per-slot arm overlay: on the covered arm bones, REPLACE the base [q, head] with the
    // alternate-aim curve (over-shoulder bazooka). The weapon bone rides forearmR, so it follows.
    if (ov) { const j = ov.bones.indexOf(bi); if (j >= 0) __rigOverlay(ov, ovClip, mix.phase, j, __rigQA, __rigPA); }
    // look-pitch aim: rotate the arm about the shoulder. upperArmR (its head IS the shoulder) captures
    // the pivot + rotates in place; forearmR + the weapon bone orbit their heads about that pivot. Bone
    // order guarantees upperArmR is seen first, so apPivot is set before the others.
    if (apSet) {
      if (bi === apSet.up) { apPivot = [__rigPA[0], __rigPA[1], __rigPA[2]]; __rigQA.premultiply(__apQ); }
      else if (apPivot && (bi === apSet.fo || bi === apSet.w || bi === apSet.hand)) {
        __apH.set(__rigPA[0] - apPivot[0], __rigPA[1] - apPivot[1], __rigPA[2] - apPivot[2]).applyQuaternion(__apQ);
        __rigPA[0] = apPivot[0] + __apH.x; __rigPA[1] = apPivot[1] + __apH.y; __rigPA[2] = apPivot[2] + __apH.z;
        __rigQA.premultiply(__apQ);
      }
    }
${figHasLive ? `    // the live vehicle: a front wheel yaws about its hub; the steering wheel turns and a mast whips about their own heads,
    // then they, and the body, lean, pitch and bounce about the wheelbase's middle
    if (LV && LV.role[bi]) {
      const role = LV.role[bi];
      if (role === 'steer') __rigQA.premultiply(LV.steer);
      else {
        if (role === 'wheel') __rigQA.premultiply(LV.wheel);
        else if (role === 'mast') __rigQA.premultiply(LV.mast);
        const P = LV.pivot;
        __lvH.set(__rigPA[0] - P[0], __rigPA[1] - P[1], __rigPA[2] - P[2]).applyQuaternion(LV.body);
        __rigPA[0] = P[0] + __lvH.x; __rigPA[1] = P[1] + __lvH.y; __rigPA[2] = P[2] + __lvH.z + LV.dz;
        __rigQA.premultiply(LV.body);
      }
    }
` : ''}    // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
    const rh = fig.bones[bi].head;
    __rigH.set(rh[0], rh[1], rh[2]).applyQuaternion(__rigQA);
    __rigV.set(__rigPA[0] - __rigH.x, __rigPA[1] - __rigH.y, __rigPA[2] - __rigH.z);
    mesh.matrix.compose(__rigV, __rigQA, __RIG_ONE);
  }${figHasFace ? `
  if (fig.face) __rigFace(rig, mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode, mix.phase);` : ''}
  // i-frame SHIMMER: while INVINCIBLE the whole rig flickers translucent — the
  // classic i-frame read. Both the acrobatic dodge and the getup rise set
  // e.invincible, so both shimmer; the topple FALL (not invincible) does not.
  // Restore full opacity when it ends.
  if (e.invincible) {
    const o = 0.45 + 0.35 * Math.sin(__world.time * 40);
    for (const bm of rig.boneMeshes) { if (bm) { bm.material.transparent = true; bm.material.opacity = o; } }
    rig.__shimmered = true;
  } else if (rig.__shimmered) {
    for (const bm of rig.boneMeshes) { if (bm) { bm.material.opacity = 1; bm.material.transparent = false; } }
    rig.__shimmered = false;
  }
}
// CONSOLIDATED weapon toggle (R15): a loadout slot may name a show tag instead of a per-weapon
// figure. The baked body carries a weapon_TAG bone per weapon (unit-rig splits them off, each
// riding forearmR); here we show ONLY the active slot's weapon bone — a weapon-only switch on ONE
// body, no figure-group swap. A loadout without show tags is untouched.
function __applyWeaponShow(e, rigFig) {
  const lo = __entLoadout(e);
  if (!lo) return;
  const cfg = lo[e.loadoutIdx || 0];
  const show = cfg && cfg.show;
  if (!show) return;
  // show is one tag OR a list [active, ...racked] — the drawn weapon plus any cosmetic
  // stowed copies visible on this slot (a saber racked on the back while the rifle is out).
  let tags = Array.isArray(show) ? show : [show];
  // STRIKE FORM (geof heat rod): a melee slot may carry strikeShow — extra weapon tags
  // shown ONLY while a swing is live, keyed by the swing direction (last _segment of the
  // playing clip name), with 'default' as the fallback. The whip lash EXTENDS out of the
  // retracted handle when a strike fires and slides back in when the clip ends; 'forward'
  // shows the straight rope-dart form instead of the curved lash. Slots without strikeShow
  // are untouched. (This comment stays backtick-free — the block is emitted inside a
  // template literal.)
  if (cfg.strikeShow && e.swingT != null) {
    const clip = typeof e.swingClip === 'string' ? e.swingClip : '';
    const dir = clip.slice(clip.lastIndexOf('_') + 1);
    const form = cfg.strikeShow[dir] || cfg.strikeShow.default;
    if (form) tags = tags.concat(form);
  }
  const key = tags.join('+');
  if (!rigFig.__wBones) {   // cache the weapon-bone meshes by tag once
    rigFig.__wBones = {};
    rigFig.fig.bones.forEach((bn, i) => { if (bn.id.indexOf('weapon_') === 0) rigFig.__wBones[bn.id.slice(7)] = rigFig.boneMeshes[i]; });
  }
  if (rigFig.__wShown === key) return;   // only touch visibility on an actual change
  rigFig.__wShown = key;
  for (const tag in rigFig.__wBones) { const mesh = rigFig.__wBones[tag]; if (mesh) mesh.visible = tags.indexOf(tag) !== -1; }
}
// R19: DESTRUCTIBLE SHIELD — when the engine flags e.shieldBroken, DROP the synthetic shield bone
// mesh (unit-rig split it off forearmL) and pop a one-shot shatter fx at its world position. Edge-run
// (only when the mesh is first hidden), so it fires once per break. Bodies with no shield are untouched.
// The reverse edge re-shows it: respawnEntity reforges the shield (shieldBroken back to false), so a
// fresh life spawns in carrying its shield again instead of fighting the rest of the match bare.
function __applyShieldBreak(e, rigFig) {
  if (rigFig.__shieldMesh === undefined) {   // cache once (null when the body has no shield bone)
    const si = rigFig.fig.bones.findIndex((b) => b.id === 'shield');
    rigFig.__shieldMesh = si >= 0 ? rigFig.boneMeshes[si] : null;
  }
  const mesh = rigFig.__shieldMesh;
  if (!mesh) return;
  if (!e.shieldBroken && !mesh.visible) { mesh.visible = true; return; }   // respawn reforged it
  if (e.shieldBroken && mesh.visible) {
    mesh.visible = false;
    const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), __fxMat(0xffd27a));
    shell.position.copy(wp); shell.raycast = function () {}; scene.add(shell);
    __fx.push({ obj: shell, born: __world.time, ttl: 0.35, kind: 'burst', base: 2.4, dim: 0.7 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    flash.position.copy(wp); flash.raycast = function () {}; scene.add(flash);
    __fx.push({ obj: flash, born: __world.time, ttl: 0.14, kind: 'burst', base: 1.5, dim: 1 });
  }
}
function __syncEntity(e, dt) {
  let m = __bodies[e.id]; if (!m) return;
  if (e.gone) { if (m.visible) m.visible = false; return; }   // wreck finisher: the body detonated and is gone
  // loadout swap: the rule changed e.body.figure — show that variant's group from here on. The
  // gait-mix state carries over so the new body continues the crossfade instead of snapping.
  const ld = m.userData && m.userData.loadout;
  if (ld && e.body.figure !== ld.figName && ld.variants[e.body.figure]) {
    const nm = ld.variants[e.body.figure];
    m.visible = false;
    nm.visible = true;
    if (nm.userData.rigFig && m.userData.rigFig) nm.userData.rigFig.mix = m.userData.rigFig.mix;
    __bodies[e.id] = nm;
    m = nm;
  }
  // wreck finisher: a respawn cleared the vanish — re-show the body. NOT while the hangar
  // menu holds this body hidden (userData.hangarHidden, __showActive): this unconditional
  // per-frame re-show is what superposed every suit at the origin after the respawn work.
  if (!m.visible && !m.userData.hangarHidden${hideId ? ` && e.id !== ${JSON.stringify(hideId)}` : ''}) m.visible = true;${hideId ? `
  if (e.id === ${JSON.stringify(hideId)}) m.visible = false;   // first person: the eye rides inside this body` : ''}
  m.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
  // hit flash: a hittable target (invincible) whitens for a beat when a shot lands, then restores.
  if (e.body && e.body.hittable && m.material) {
    const lit = e.hitFlash >= 0 && (__world.time - e.hitFlash) < 0.15;
    if (lit && !m.__flashed) { m.material.color.set(0xffffff); m.__flashed = true; }
    else if (!lit && m.__flashed) { m.material.color.set(e.body.color != null ? e.body.color : 0xff7a59); m.__flashed = false; }
  }
  // POLYGOMER body (platformer.plan.md P2): a rig-less baked mesh. Face it along heading (its authored
  // front is +y, so yaw −90° maps +y → forward) and give it its only animation — SQUASH & STRETCH,
  // driven off the platform rule's grounded/jump/land edges: stretch tall rising, squash flat on land.
  if (m.userData && m.userData.polygomer) {
    const yaw = e.body && e.body.yawOffset != null ? e.body.yawOffset : -Math.PI / 2;
    m.rotation.set(0, 0, e.transform.heading + yaw);
    let sxy = 1, sz = 1;
    if (!e.grounded) { const t = Math.max(-1, Math.min(1, (e.vel ? e.vel[2] : 0) / 9)); sz = 1 + 0.16 * t; sxy = 1 - 0.10 * t; }
    if (e.landed) m.userData.landT = 0.18;
    const lt = m.userData.landT || 0;
    if (lt > 0) { const k = lt / 0.18; sz *= 1 - 0.30 * k; sxy *= 1 + 0.22 * k; m.userData.landT = Math.max(0, lt - (dt || 0)); }
    m.scale.set(sxy, sxy, sz);
    return;
  }
  const rigFig = m.userData && m.userData.rigFig;
  if (rigFig) { __applyWeaponShow(e, rigFig); __syncRigEntity(e, m, rigFig, dt); __applyShieldBreak(e, rigFig); return; }
  const fig = m.userData && m.userData.fig;
  if (fig) {
    m.rotation.set(0, 0, e.transform.heading + fig.yaw);
    if (!fig.lerpable) {   // mismatched clip topologies → legacy frame snapping
      const clip = __figClipOf(fig, e, e.moving ? e.locomotion : 'idle');
      const N = clip.length, ph = ((e.gaitPhase % 1) + 1) % 1;
      const frame = e.moving ? (Math.floor(ph * N) % N) : 0;
      const attr = fig.mesh.geometry.getAttribute('position');
      if (attr.array.length === clip[frame].pos.length) {
        attr.array.set(clip[frame].pos); attr.needsUpdate = true;
        const cattr = fig.mesh.geometry.getAttribute('color');
        cattr.array.set(clip[frame].col); cattr.needsUpdate = true;
      } else {   // face count differs from the live buffer → rebuild attributes for this frame
        fig.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(clip[frame].pos.slice(), 3));
        fig.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(clip[frame].col, 3));
      }
      return;
    }
    const mode = e.moving ? e.locomotion : 'idle';
    const mix = __CW.advanceGaitMix(fig.mix, mode, e.gaitPhase, dt || 0, fig.blendTime);
    const attr = fig.mesh.geometry.getAttribute('position');
    const out = attr.array;
    out.fill(0);
    // smoothstep the crossfade so mode switches ease in/out instead of ramping linearly
    const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
    __figAccum(out, __figClipOf(fig, e, mix.mode), mix.phase, mix.mode === 'idle', w);
    if (mix.prevMode) __figAccum(out, __figClipOf(fig, e, mix.prevMode), mix.prevPhase, mix.prevMode === 'idle', 1 - w);
    attr.needsUpdate = true;
  } else {
    // vehicle attitude (fly): e.tilt banks/pitches the mesh about its own axes — 'ZYX' applies
    // roll (body x), then pitch (body y, negated so nose-up pitches up), then the yaw.
    // Absent → the flat yaw-only read, byte-identical.
    if (e.tilt) m.rotation.set(e.tilt.roll || 0, -(e.tilt.pitch || 0), e.transform.heading, 'ZYX');
    else if (e.castDown) {   // felled by the cast: it lies along its heading, on the ground its feet were on
      m.rotation.set(0, Math.PI / 2, e.transform.heading, 'ZYX');
      m.position.z = e.transform.pos[2] - ((e.rule && e.rule.eye) || 0) + (Array.isArray(e.body.size) ? e.body.size[0] / 2 : (e.body.radius || 0));
    }
    else m.rotation.set(0, 0, e.transform.heading);   // yaw about +Z (z-up)
  }
}
// WALL PULL-IN (camera-tuning.plan.md): a chase cam behind a wall-backed suit ends up INSIDE the
// wall, filling the screen. Cast from the framed subject (lookAt, ~suit chest) toward the eased eye
// and, if a WORLD surface blocks the view, clamp the rendered eye to just in front of it so the suit
// stays visible. View-only (never touches sim state); mirrors __ground's mesh-only / skip-own-body
// filter, so it collides on level geometry but never on suit bodies.
const __camRay = new THREE.Raycaster();
let __camCd = 1;   // current eye distance as a fraction of the full follow distance (1 = no pull-in)
const __followPullIn = ${followPullIn.toString()};
function __driveCamera(dt) {
  const c = __world.camera; if (!c) return;
  const p = c.transform.pos;
  let look = c.lookAt;
  if (!look) { const h = c.transform.heading, pi = c.transform.pitch || 0; look = [p[0] + Math.cos(pi) * Math.cos(h), p[1] + Math.cos(pi) * Math.sin(h), p[2] + Math.sin(pi)]; }
  let px = p[0], py = p[1], pz = p[2];
  if (c.rule && c.rule.type === 'follow') {
    const dx = p[0] - look[0], dy = p[1] - look[1], dz = p[2] - look[2];
    const full = Math.hypot(dx, dy, dz);
    if (full > 1e-3) {
      const ux = dx / full, uy = dy / full, uz = dz / full;
      __camRay.set(new THREE.Vector3(look[0], look[1], look[2]), new THREE.Vector3(ux, uy, uz));
      __camRay.far = full; __camRay.camera = camera;   // sprite-safe traverse (see __ground's E8 note)
      const own = __bodySet();
      let hitD = full;
      for (const hit of __camRay.intersectObjects(scene.children, true)) {
        const ho = hit.object;
        if (!ho.isMesh || (ho.material && ho.material.depthTest === false)) continue;   // meshes only; skip overlay quads (fog/effects)
        let o = ho, isOwn = false; while (o) { if (own.includes(o)) { isOwn = true; break; } o = o.parent; }
        if (isOwn) continue;   // never pull in on an entity body (suits) — world geometry only
        hitD = hit.distance; break;   // nearest world surface between subject and eye
      }
      // the stand-off and the floor are the subject's own (follow-pull-in.js): its far side across the ground from the
      // look point (its collide volume, capsule or body radius), its capsule height, and the near plane kept off it
      const tg = __world.byId[c.rule.target], tb = (tg && tg.body) || {};
      const lead = tg ? Math.hypot(look[0] - tg.transform.pos[0], look[1] - tg.transform.pos[1]) : 0;
      const rad = (tg && tg.collideVol && tg.collideVol.a) || (tg && tg.rule && tg.rule.collideRadius) || (tb.egg ? tb.egg.a : tb.radius) || 0;
      const target = __followPullIn(full, hitD, lead, Math.hypot(ux, uy), rad, (tg && tg.rule && tg.rule.collideHeight) || 0, camera.near);
      // pull IN instantly (never flash the wall); ease OUT so leaving cover doesn't snap the framing.
      if (target < __camCd) __camCd = target;
      else __camCd += (target - __camCd) * (1 - Math.exp(-6 * (dt || 0)));
      px = look[0] + ux * full * __camCd;
      py = look[1] + uy * full * __camCd;
      pz = look[2] + uz * full * __camCd;
    }
  }
  camera.position.set(px, py, pz);
  camera.lookAt(look[0], look[1], look[2]);
  if (c.roll) camera.rotateZ(-c.roll);   // a follow camera banking with its target (rollFollow): about the view axis
}
${driveSurface ? `// surface hook (roads/surface.js): what a car's tyres are on, for the vehicle classes' rule
const __surfaceT = ${safeJson(driveSurface)};
const __surfaceAt = ${surfaceAt.toString()};
const __surface = (p) => __surfaceAt(__surfaceT, p);
` : ''}// ground hook: nearest scene surface straight below (excluding entity bodies), for walk entities.
const __groundRay = new THREE.Raycaster();
const __bodySet = () => Object.values(__bodies);
function __ground(pos) {
  // Probe straight down FROM the passed origin — the CALLER chooses the height. The walk rule passes
  // its eye position (finds the floor below it); the platform rule passes feet+step (so it lands on the
  // surface under the FEET and ignores platforms whose tops sit above them — you jump onto a ledge, you
  // do not warp up into it by walking into its base). (Was pos.z+20, which grabbed any overhead surface.)
  __groundRay.set(new THREE.Vector3(pos[0], pos[1], pos[2] + 0.05), new THREE.Vector3(0, 0, -1));
  // decoration safety (E8): only MESHES are footing. THREE.Sprite.raycast dereferences
  // raycaster.camera — without it, ONE glow sprite anywhere in the scene (a tracer/comet head)
  // kills the first ground probe of a walk/platform entity; and THREE.Line raycasts with a fat
  // default threshold, so an orbit/track line reads as a floor 0.6 units up. Set the camera so
  // the traverse survives whatever channels add, and skip every non-mesh hit.
  __groundRay.camera = camera;
  const own = __bodySet();
  const hits = __groundRay.intersectObjects(scene.children, true);
  for (const hit of hits) { if (!hit.object.isMesh) continue; let o = hit.object; while (o) { if (own.includes(o)) break; o = o.parent; } if (!o) return hit.point.z; }
  return null;
}
// input: keys → normalized axes, mouse → look deltas (consumed each frame). Which key, pad button or
// mouse button serves an action is the pilot scheme's (controls/schemes.js), read through the controls
// kernel per device family (controls/devices.js); __BIND is the live table, so a remap replaces it and
// nothing below changes. This page drives the keyboard, mouse and standard-mapping gamepad families.
const __CTL = (${buildControlsKernel.toString()})();
const __SCHEME = ${safeJson(SCHEMES.pilot)};
const __DEV = ${safeJson({ keyboard: DEVICES.keyboard, mouse: DEVICES.mouse, gamepad: DEVICES.gamepad })};
let __BIND = __CTL.resolve(__SCHEME, __DEV);
const __held = {};
${seats ? `// SEATS: seat 1 reads the keyboard only while the keyboard is its controller (or nobody has sat down yet)
let __seat1 = null;
const __kbRead = (c) => (__seat1 && __seat1 !== 'keyboard' ? false : __held[c]);` : 'const __kbRead = (c) => __held[c];'}
const __k = (id) => __CTL.held(__BIND, id, 'keyboard', __kbRead);
const __mb = (id, e) => __CTL.is(__BIND, id, 'mouse', Object.keys(__DEV.mouse.buttons).find((n) => __DEV.mouse.buttons[n] === e.button));
let __usePad = false;   // the device the player last used (a prompt names its key): a key press says keyboard, pad activity the pad
window.addEventListener('keydown', (e) => { __held[e.code] = true; __usePad = false; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { __held[e.code] = false; });
let __lookDX = 0, __lookDY = 0, __drag = false, __fireDown = false;
const __canvas = renderer.domElement;
const __MOUSELOOK = ${!!(camera && (camera.turnMode === 'look' || camera.mouseLook))};   // FPS look camera?
if (__MOUSELOOK) {
  // pointer-lock FPS look: click once to capture the mouse, then RAW moves steer (no drag to hold).
  // both axes NEGATED so the view AGREES with the hand: swipe left looks left, push up looks up.
  __canvas.addEventListener('click', () => { if (document.pointerLockElement !== __canvas) __canvas.requestPointerLock(); });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === __canvas) { __lookDX -= e.movementX || 0; __lookDY -= e.movementY || 0; } });
  // FIRE = left mouse, but ONLY once the pointer is captured (the first click captures the mouse and
  // does not fire). The weapon subsystem gates ROF / semi-edge / reload, so this is a raw held flag.
  __canvas.addEventListener('mousedown', (e) => { if (__mb('fire', e) && document.pointerLockElement === __canvas) __fireDown = true; });
  window.addEventListener('mouseup', (e) => { if (__mb('fire', e)) __fireDown = false; });
} else {
  // default: hold-to-look drag (walk / glide / orbit worlds keep the cursor visible).
  __canvas.addEventListener('pointerdown', () => { __drag = true; });
  window.addEventListener('pointerup', () => { __drag = false; });
  __canvas.addEventListener('pointermove', (e) => { if (__drag) { __lookDX += e.movementX || 0; __lookDY += e.movementY || 0; } });
}
${lock ? `// TARGET LOCK (lock.js): middle mouse is the lock press beside C and pad R3 — a held flag the
// input read turns into an edge. preventDefault keeps the browser's autoscroll off the canvas.
let __midDown = false;
__canvas.addEventListener('mousedown', (e) => { if (__mb('lock', e)) { e.preventDefault(); __midDown = true; } });
window.addEventListener('mouseup', (e) => { if (__mb('lock', e)) __midDown = false; });
` : ''}const __kx = (pos, neg) => __CTL.axis(__BIND, pos, neg, 'keyboard', __kbRead);
// gamepad (standard-mapping): polled once per input read and MERGED into the same normalized
// snapshot the keyboard/mouse build — the engine never learns which device spoke. Keyboard wins
// an axis it is actively pressing; pad buttons OR into the shared held/edge chains so dodge
// double-tap (LT), semi-auto fire and every press-edge action reuse the one __prev* discipline.
// Mapping: left stick = move (strafe in look worlds, turn otherwise) · right stick = look/aim ·
// RT fire · LT boost (double-tap = dodge) · A jump-ascend · B/LB kneel-descend · Y (PS △) tackle ·
// D-pad ↑ switch suit · D-pad ↓ reverse view (a chase camera) · select = AI toggle. RB is the WEAPON button: a quick tap cycles, a HOLD
// raises the selector overlay, and face buttons chord while it is down — RB+X (PS □) = the main
// ranged weapon, RB+Y (PS △) = the main melee, RB+B/A = the remaining slots in shelf order (a
// chord suppresses the face button's solo action). Start is the SHELL's (pause) — the world
// ignores it. Prefs arrive over the game-gamepad sidecar; a shell-less world plays the defaults.
let __padOn = true, __padIdx = -1, __padSeen = false;
// the pad a camera or watch control reads outside the pilot's poll: the one the pilot holds, else the first connected
const __padNow = () => { if (!__padOn || !navigator.getGamepads) return null; const ps = navigator.getGamepads(); if (__padIdx >= 0 && ps[__padIdx] && ps[__padIdx].connected) return ps[__padIdx]; for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) return ps[i]; return null; };
const __padCfg = { deadZone: 0.15, lookScale: 18, invertY: false };   // lookScale: px-equivalent per frame at full deflection
window.__mojPad = { active: () => __padOn && __padSeen, cfg: __padCfg };   // read by the pause legend (__controlRows)
window.addEventListener('gamepadconnected', (e) => { __padSeen = true; __padIdx = e.gamepad.index; });
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.moj !== '${GAME_MSG_GAMEPAD}') return;
  if (typeof d.on === 'boolean') { __padOn = d.on; if (!d.on) __wcHide(); }
  if (Number.isFinite(d.deadZone)) __padCfg.deadZone = Math.max(0, Math.min(0.6, d.deadZone));
  if (Number.isFinite(d.lookScale)) __padCfg.lookScale = Math.max(1, Math.min(80, d.lookScale));
  if (typeof d.invertY === 'boolean') __padCfg.invertY = d.invertY;
});
const __padStick = (x, y) => {   // radial dead zone, rescaled so travel starts at zero past it
  const m = Math.hypot(x, y);
  if (m < __padCfg.deadZone) return [0, 0];
  const s = Math.min(1, (m - __padCfg.deadZone) / (1 - __padCfg.deadZone)) / m;
  return [x * s, y * s];
};
// ---- RB weapon selector: the chord map assigns loadout slots to face buttons — the MAIN
// ranged weapon always rides X (PS square) and the MAIN melee always rides Y (PS triangle)
// (operator, 2026-08-03); leftover slots fill B then A in shelf order. Recomputed per open,
// so a suit switch (new loadout) re-deals the buttons.
let __wcPrevRB = false, __wcDownT = 0, __wcChorded = false, __wcOpen = false, __wcPrevFace = 0, __wcEl = null, __padLayout = 'xbox', __wcCur = -1;
const __WC_HOLD = 260;   // ms — under it a release is a tap (cycle), past it the selector raises
const __wcEnt = () => (__world.pilotId && __world.byId[__world.pilotId]) || null;
function __wcMap() {
  const ent = __wcEnt();
  const lo = ent && __entLoadout(ent);
  if (!lo) return null;
  const map = {}, used = [];
  const firstRanged = lo.findIndex((c) => c && c.weapon);
  const firstMelee = lo.findIndex((c) => c && c.strike);
  if (firstRanged >= 0) { map[2] = firstRanged; used.push(firstRanged); }         // X / PS square
  if (firstMelee >= 0 && used.indexOf(firstMelee) < 0) { map[3] = firstMelee; used.push(firstMelee); }   // Y / PS triangle
  const rest = [];
  for (let i = 0; i < lo.length; i++) if (lo[i] && used.indexOf(i) < 0) rest.push(i);
  const restBtns = [1, 0];   // B / PS circle, then A / PS cross
  for (let k = 0; k < rest.length && k < restBtns.length; k++) map[restBtns[k]] = rest[k];
  return map;
}
function __wcRender() {
  const ent = __wcEnt();
  const lo = ent && __entLoadout(ent);
  const m = __wcMap();
  if (!lo || !m) { __wcHide(); return; }
  if (!__wcEl) {
    __wcEl = document.createElement('div');
    __wcEl.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;display:flex;flex-direction:column;gap:6px;min-width:240px;padding:14px 18px;background:rgba(8,13,24,.88);border:1px solid #2a3b58;border-radius:12px;font:600 13px system-ui,sans-serif;color:#cfe3ff;pointer-events:none;backdrop-filter:blur(2px)';
    (typeof wrap !== 'undefined' ? wrap : document.body).appendChild(__wcEl);
  }
  const gl = {};   // the face glyphs in this pad's own layout (positions 0-3: south, east, west, north)
  __DEV.gamepad.faces.forEach((f, i) => { gl[i] = __CTL.label(__DEV, 'gamepad', f, __padLayout); });
  const cur = ent.loadoutIdx || 0;
  let html = '<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8fa5c8;margin-bottom:4px">weapons \\u2014 hold RB \\u00b7 tap a button</div>';
  for (const bi of [2, 3, 1, 0]) {   // main weapon, main melee, then the leftovers
    if (m[bi] == null) continue;
    const cfg = lo[m[bi]] || {};
    const on = m[bi] === cur;
    const nm = cfg.name || (cfg.strike ? 'MELEE' : 'RANGED');
    const tag = bi === 2 ? 'main weapon' : bi === 3 ? 'main melee' : '';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:7px;'
      + (on ? 'background:rgba(95,176,255,.16);border:1px solid #5fb0ff' : 'border:1px solid transparent') + '">'
      + '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid #4a5f82;border-radius:50%;font-size:12px;color:' + (on ? '#9cd2ff' : '#8fa5c8') + '">' + gl[bi] + '</span>'
      + '<span style="flex:1;letter-spacing:.06em;color:' + (on ? '#e8f4ff' : '#cfe3ff') + '">' + nm + '</span>'
      + (tag ? '<span style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6f87ab">' + tag + '</span>' : '')
      + '</div>';
  }
  __wcEl.innerHTML = html;
  __wcEl.style.display = 'flex';
  __wcCur = cur;
}
function __wcHide() { __wcOpen = false; __wcCur = -1; if (__wcEl) __wcEl.style.display = 'none'; }
window.__mojWcHide = __wcHide;   // the pause sidecar closes the selector when the shell freezes the sim
${touchLayer ? `${touchScript(touchLayer)}` : ''}function __pollPad() {
${seats ? `  // SEATS: seat 1 reads only its own pad (none when the keyboard is its controller), never another seat's
  if (__seat1 === 'keyboard') return null;
  if (__seat1) { __padIdx = +__seat1.slice(4); const __sp = navigator.getGamepads ? navigator.getGamepads()[__padIdx] : null; if (!__sp || !__sp.connected) return null; }
` : ''}${touchLayer ? `  // the screen's virtual pad (touch.js) when no real one is connected: read through the same bindings, never counted
  // as a pad the player plugged in (the legend, the prompts and the printed layout stay the keyboard's)
  const __tp = __touchPad();
  if ((!__padOn || !navigator.getGamepads) && !__tp) return null;
  const pads = __padOn && navigator.getGamepads ? navigator.getGamepads() : [];
  let g = (__padIdx >= 0 && pads[__padIdx] && pads[__padIdx].connected) ? pads[__padIdx] : null;
  if (!g) { for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; __padIdx = i; break; } }
  if (!g && __tp) g = __tp;
  if (!g) { __wcHide(); __wcPrevRB = false; return null; }
  const __virt = g === __tp;
  if (!__virt) __padSeen = true;
  // the pad's printed layout (Xbox, PlayStation, Nintendo): the glyphs it shows, and where confirm / cancel sit
  const __lay = __virt ? __padLayout : __CTL.padLayout(g.id);` : `  if (!__padOn || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  let g = (__padIdx >= 0 && pads[__padIdx] && pads[__padIdx].connected) ? pads[__padIdx] : null;
  if (!g) { for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; __padIdx = i; break; } }
  if (!g) { __wcHide(); __wcPrevRB = false; return null; }
  __padSeen = true;
  // the pad's printed layout (Xbox, PlayStation, Nintendo): the glyphs it shows, and where confirm / cancel sit
  const __lay = __CTL.padLayout(g.id);`}
  if (__lay !== __padLayout) { __padLayout = __lay; __BIND = __CTL.resolve(__SCHEME, __DEV, null, { layout: __lay }); }
  const b = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const __gr = __CTL.gamepadRead(g, __DEV), __ga = __CTL.gamepadRead(g, __DEV, true);
  const pb = (id, quiet) => __CTL.held(__BIND, id, 'gamepad', __gr, quiet ? __DEV.gamepad.faces : null);   // quiet: a held RB silences the face buttons (they chord)
  const [mx, my] = __padStick(g.axes[0] || 0, g.axes[1] || 0);
  const [lx, ly] = __padStick(g.axes[2] || 0, g.axes[3] || 0);
  if (${touchLayer ? '!__virt && (' : ''}mx || my || lx || ly || g.buttons.some((x) => x && x.pressed)${touchLayer ? ')' : ''}) __usePad = true;
  // RB state machine: press starts the tap/hold clock; the hold raises the selector; face-button
  // press EDGES while RB is down chord a slot (and mark the press so release doesn't also cycle);
  // a chordless release inside the tap window is the cycle.
  const rb = pb('cycleWeapon');
  const now = performance.now();
  let cycle = false, slot = 0;
  if (rb && !__wcPrevRB) { __wcDownT = now; __wcChorded = false; }
  if (rb && !__wcOpen && now - __wcDownT >= __WC_HOLD) { __wcOpen = true; __wcRender(); }
  const face = (b(0) ? 1 : 0) | (b(1) ? 2 : 0) | (b(2) ? 4 : 0) | (b(3) ? 8 : 0);
  if (rb) {
    for (const bi of [2, 3, 1, 0]) {
      if ((face & (1 << bi)) && !(__wcPrevFace & (1 << bi))) {
        const m = __wcMap();
        if (m && m[bi] != null) { slot = m[bi] + 1; __wcChorded = true; if (!__wcOpen) { __wcOpen = true; } }
        break;
      }
    }
  }
  if (!rb && __wcPrevRB) {
    if (!__wcChorded && now - __wcDownT < __WC_HOLD) cycle = true;
    __wcHide();
  }
  if (__wcOpen && (slot || (__wcEnt() && (__wcEnt().loadoutIdx || 0) !== __wcCur))) __wcRender();   // live highlight tracks the engine's slot
  __wcPrevRB = rb; __wcPrevFace = face;
  return {
    moveX: mx, moveY: -my,                     // stick up = forward
    lookX: lx, lookY: ly,
    fire: pb('fire'), boost: pb('boost'),
    // analog trigger VALUES — the vehicle rules (drive/fly) read RT/LT as throttle/brake, the
    // console-driving standard; suits keep the pressed reads above untouched.
    rt: __CTL.value(__BIND, 'fire', 'gamepad', __ga), lt: __CTL.value(__BIND, 'boost', 'gamepad', __ga),
    tackle: pb('tackle', rb),                  // Y / PS triangle (operator, 2026-08-03) — silent inside an RB chord
    kneel: pb('kneel', rb),                    // LB or B / PS circle — descend in space, kneel on ground
    jump: pb('jump', rb),                      // A / PS cross — ascend in space
    cycle, slot,                               // RB tap / RB chord (the selector)
    swap: pb('swapSuit'), ai: pb('aiToggle'),  // D-pad up = switch suit · select = AI toggle
    lock: pb('lock'),                          // R3 (right stick click) = target lock (lock.js)${hasForms ? `
    transform: pb('transform'),                // L3 (left stick click) = transform (forms.js)` : ''}
    interact: pb('interact', rb),              // X / PS square — use / talk where the figure stands in reach (silent inside an RB chord)
  };
}
// the pause legend for the piloted entity (scene-three's __controlRows asks): the scheme's rows,
// read off the live bindings and filtered by what this world has, so it teaches only the keys it answers to.
function __ctlLegend(pil) {
${touchLayer ? `  if (__touchOn()) return __touchRows();   // the screen's pad (touch.js): its thumbs, not the keys
` : ''}  const r = pil.rule || pil.pilotRule || {};
  const W = __world, lo = (e) => (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length) || (e.pilotRule && Array.isArray(e.pilotRule.loadout) && e.pilotRule.loadout.length);
  return __CTL.legend(__SCHEME, __BIND, __DEV, {
    space: r.space === true, kneel: r.kneel === true, tackle: !!r.tackle, vehicle: r.type === 'drive' || r.type === 'fly',
    mouselook: __MOUSELOOK, armed: W.entities.some((e) => e.weapon || lo(e)), lock: ${!!lock},
    suits: W.entities.filter((e) => e.pilotable).length > 1,
    ai: W.entities.some((e) => (e.ambientRule && e.ambientRule.type === 'ai') || (e.rule && e.rule.type === 'ai')),
    follow: !!(W.camera && W.camera.rule && W.camera.rule.type === 'follow'),
    interact: !!window.__mojUses,   // the world has somewhere to use (the events channel says)${hasForms ? `
    forms: true,                    // a body that transforms (forms.js)` : ''}
    active: { gamepad: __padOn && __padSeen }, layout: __padLayout,
  });
}
let __prevJump = false;             // for the jump PRESS edge (platform rule) vs held (variable height)
let __prevInteract = false, __interactN = 0;   // interact press edges, counted for the events channel (a use where the figure stands)
let __prevCycle = false, __prevSlot = 0;   // weapon-cycling press edges (R / 1-5)
let __prevSwap = false;                    // suit-switcher press edge (T)
let __prevTackle = false;                  // tackle press edge (Shift) — platform rule, opt-in r.tackle
let __prevAi = false;                      // AI-attack toggle press edge (G / HUD button)
let __prevLock = false;                    // target-lock press edge (C / middle mouse / R3) — lock.js${hasForms ? `
let __prevTransform = false;               // transform press edge (B / L3) — forms.js` : ''}
let __aiBtnPress = false;                  // HUD button click injects one toggle edge
// shell AI switch (practice mode): the pause menu posts a DESIRED state over the game-ai sidecar;
// the world converges through the same input edge the G key uses (one deterministic path — the
// engine flips aiEnabled in stepWorld), injecting edges until live state matches the request.
let __aiWant = null;
window.addEventListener('message', (e) => {
  const d = e.data;
  if (d && d.moj === '${GAME_MSG_AI}' && typeof d.on === 'boolean') __aiWant = d.on;
});
function __readInput() {
  // a menu is up (events channel): the figure takes nothing — not a key held as it opened, not the pad, not the look.
  // The edges read as held, so the key that picked doesn't jump or interact again when the menu goes.
  if (window.__mojMenuOpen) { __lookDX = 0; __lookDY = 0; __fireDown = false; __prevJump = true; __prevInteract = true; return { ...__CW.ZERO_INPUT }; }
  const __pad = __pollPad();   // null when no controller (or prefs turned it off)
  // INTERACT (use / talk) press edge: counted; the events channel sends use-<place> when the figure stands in reach
  const it = __k('interact') || !!(__pad && __pad.interact);
  if (it && !__prevInteract) __interactN++;
  __prevInteract = it;
  const sp = __k('jump') || !!(__pad && __pad.jump);
  const jump = sp && !__prevJump ? 1 : 0;   // rising edge: a discrete press, not a held axis
  __prevJump = sp;
  // weapon cycling (platform rule, opt-in loadout): R press edge cycles, digit press edge selects
  const cy = __k('cycleWeapon') || !!(__pad && __pad.cycle);
  const cycle = cy && !__prevCycle ? 1 : 0;
  __prevCycle = cy;
  let slotNow = (__pad && __pad.slot) || 0;
  for (let d = 1; d <= 5; d++) if (__k('weapon' + d)) { slotNow = d; break; }
  const slot = slotNow && slotNow !== __prevSlot ? slotNow : 0;
  __prevSlot = slotNow;
  // suit switcher (pilotable entities): T press edge transfers the pilot
  const sw = __k('swapSuit') || !!(__pad && __pad.swap);
  const swap = sw && !__prevSwap ? 1 : 0;
  __prevSwap = sw;
  // TACKLE (platform rule, opt-in r.tackle): Shift press edge fires the invincible offensive dash.
  // A press EDGE (not held) — one tackle per key-down, like the suit-switcher / jump edges.
  const tk = __k('tackle') || !!(__pad && __pad.tackle);
  const tackle = tk && !__prevTackle ? 1 : 0;
  __prevTackle = tk;
  // AI attack toggle (worlds with ai ambients): G press edge OR the HUD button OR the shell's
  // requested state (pause-menu switch — inject edges until aiEnabled converges), one shared edge
  const __aiCur = __world.aiEnabled !== false;
  if (__aiWant != null && __aiWant === __aiCur) __aiWant = null;   // converged — stand down
  const ai = __k('aiToggle') || __aiBtnPress || !!(__pad && __pad.ai) || (__aiWant != null && __aiWant !== __aiCur);
  const aiToggle = ai && !__prevAi ? 1 : 0;
  __prevAi = ai;
  __aiBtnPress = false;
  // TARGET LOCK press edge (lock.js): C / middle mouse / pad R3 — acquire, cycle, release
  const lk = ${lock ? "__k('lock') || __midDown || !!(__pad && __pad.lock)" : 'false'};
  const lock = lk && !__prevLock ? 1 : 0;
  __prevLock = lk;${hasForms ? `
  // TRANSFORM press edge (forms.js): B / pad L3 turns the pilot into its next form
  const tf = __k('transform') || !!(__pad && __pad.transform);
  const transform = tf && !__prevTransform ? 1 : 0;
  __prevTransform = tf;` : ''}
  // pad right stick → the SAME look accumulators the mouse feeds, per-frame at lookScale px
  // equivalents; signs follow each mouse branch's convention (mouselook negates so stick-right
  // looks right, drag worlds keep the drag sign). Stick look never needs pointer capture — a
  // match is fully playable without a single mouse click.
  if (__pad && (__pad.lookX || __pad.lookY)) {
    const __ps = __padCfg.lookScale, __py = __padCfg.invertY ? -1 : 1;
    if (__MOUSELOOK) { __lookDX -= __pad.lookX * __ps; __lookDY -= __pad.lookY * __ps * __py; }
    else { __lookDX += __pad.lookX * __ps; __lookDY += __pad.lookY * __ps * __py; }
  }
  // look keys (unbound by default: the mouse looks) steer the same accumulators at the pad's full-deflection rate,
  // so a remap gives a keyboard-only player the camera
  const __klx = __kx('lookRight', 'lookLeft'), __kly = __kx('lookDown', 'lookUp');
  if (__klx || __kly) {
    const __ks = __padCfg.lookScale;
    if (__MOUSELOOK) { __lookDX -= __klx * __ks; __lookDY -= __kly * __ks; }
    else { __lookDX += __klx * __ks; __lookDY += __kly * __ks; }
  }
  // keyboard wins an axis it is actively pressing; otherwise the pad's analog float flows
  // through (the rules multiply by accel/speed, so magnitude = walk-to-run travel).
  const __pmx = __pad ? __pad.moveX : 0, __pmy = __pad ? __pad.moveY : 0;
  // VEHICLE PILOT (drive / fly): the pad's ANALOG triggers become throttle (RT) and brake (LT) —
  // the console-driving standard — with the stick as fallback; RT stops firing and LT stops
  // boosting while a vehicle is piloted (F is reserved there anyway). Keyed off the LIVE piloted
  // entity's rule each frame, so T in-and-out of a car swaps the scheme with the seat.
  const __vp = __world.pilotId && __world.byId[__world.pilotId];
  const __veh = !!(__vp && __vp.rule && (__vp.rule.type === 'drive' || __vp.rule.type === 'fly'));
  const inp = {
    forward: __kx('moveForward', 'moveBack')
      || (__veh && __pad && (__pad.rt > 0.02 || __pad.lt > 0.02) ? __pad.rt - __pad.lt : __pmy),
    // look worlds steer with the stick/mouse — left stick X strafes (matching how A/D fold
    // into sideIn there); tank-turn worlds keep left stick X as the turn axis.
    turn: __kx('turnRight', 'turnLeft') || (__MOUSELOOK ? 0 : __pmx),
    // in reach (window.__mojReach, the events channel's) the interact controls interact and don't strafe
    strafe: (window.__mojReach ? __CTL.value(__BIND, 'strafeRight', 'keyboard', __kbRead, __BIND.bind.keyboard.interact) - __CTL.value(__BIND, 'strafeLeft', 'keyboard', __kbRead, __BIND.bind.keyboard.interact) : __kx('strafeRight', 'strafeLeft')) || (__MOUSELOOK ? __pmx : 0),
    lift: __kx('jump', 'descend') || (__pad ? (__pad.jump ? 1 : 0) - (__pad.kneel ? 1 : 0) : 0),
    jump, jumpHeld: sp ? 1 : 0,
    boost: __k('boost') || (__pad && __pad.boost && !__veh) ? 1 : 0,   // thrusters (platform rule): held = boost locomotion
    kneel: __k('kneel') || (__pad && __pad.kneel) ? 1 : 0,   // one-knee hold (platform rule, opt-in kneel:true) / space descend
    fire: __fireDown || (__pad && __pad.fire && !__veh) ? 1 : 0,   // left mouse or RT (weapon subsystem; RT is throttle in a vehicle)
    cycle, slot,                     // weapon cycling (platform rule, opt-in loadout)
    swap,                            // suit switcher (T): transfer the pilot between pilotable suits
    tackle,                          // tackle (Shift): the platform rule's invincible offensive dash (opt-in r.tackle)
    aiToggle,                        // AI attack switch (G): ai-ambient suits stand down / wake up
    lock,                            // target lock (C): lock.js acquires / cycles / releases on the edge${hasForms ? `
    transform,                       // transform (B): a body with forms turns into its next one (forms.js)` : ''}
    missile: __k('missile') || window.__mojAltFire ? 1 : 0,   // a craft's missile (R, or the right mouse, pointer-locked: the flight block's)
    flare: __k('flare') ? 1 : 0,     // a craft's flare (X)
    lookDX: __lookDX, lookDY: __lookDY,
  };
  __lookDX = 0; __lookDY = 0;
  return inp;
}
${seats ? seatsScript(seats) : ''}// active whenever there are entities to step; the camera is OWNED only if a camera entity exists
// (otherwise OrbitControls keeps the view — e.g. a clock-driven figure turntable orbited by hand).
__ctrlActive = __world.entities.length > 0;
if (__world.camera) { controls.enabled = false; __ctrlOwnsCamera = true; }
// reverse view (follow cameras only): swing the chase camera around to the FRONT of the target —
// WASD keeps driving it exactly as before, you just see the unit face-on (the suit-detail view).
// Flips the follow rule's live \`reverse\` flag; the rule eases the swing as an orbit. HUD button + V.
if (__world.camera && __world.camera.rule.type === 'follow') {
  const __rvBtn = document.createElement('button');
  __rvBtn.textContent = 'reverse view';
  const __rvFlip = () => { const r = __world.camera.rule; r.reverse = !r.reverse; __rvBtn.classList.toggle('on', !!r.reverse); };
  __rvBtn.classList.toggle('on', !!__world.camera.rule.reverse);
  __rvBtn.onclick = __rvFlip;
  window.addEventListener('keydown', (ev) => { if (__CTL.is(__BIND, 'reverseView', 'keyboard', ev.code) && !ev.repeat) __rvFlip(); });
  // the pad's reverse view (its binding: D-pad down), on the press edge, polled with the frame
  let __rvPadWas = false;
  (function __rvPad() { requestAnimationFrame(__rvPad); const g = __padNow(); const on = !!g && __CTL.held(__BIND, 'reverseView', 'gamepad', __CTL.gamepadRead(g, __DEV)); if (on && !__rvPadWas) __rvFlip(); __rvPadWas = on; })();
  hud.appendChild(__rvBtn);
}
${faunaOnly ? '' : `// AI ATTACK toggle (worlds with ai-ambient suits): a HUD button twin of the G key. The click only
// INJECTS the shared input edge — the engine flips world.aiEnabled in stepWorld, so live play and
// capture replay go through the one deterministic path; a tiny watcher mirrors the live state onto
// the button label (G presses update it too).
if (__world.entities.some((e) => (e.ambientRule && e.ambientRule.type === 'ai') || (e.rule && e.rule.type === 'ai'))) {
  const __aiBtn = document.createElement('button');
  __aiBtn.onclick = () => { __aiBtnPress = true; };
  hud.appendChild(__aiBtn);
  (function __aiBtnSync() {
    requestAnimationFrame(__aiBtnSync);
    const on = __world.aiEnabled !== false;
    const want = on ? 'AI attack: ON' : 'AI attack: OFF';
    if (__aiBtn.textContent !== want) { __aiBtn.textContent = want; __aiBtn.classList.toggle('on', on); }
  })();
}
`}// SPECTATOR RIG (ai-battle-spectator.plan.md): a no-pilot ALL-AI battle the operator WATCHES. The
// camera is a glide FREE-FLY drone (WASD + mouse) by default; F toggles a LOCKED chase-cam on a
// chosen fighter; TAB cycles which fighter is watched (retargets the chase / snaps the drone behind
// the new pick). __specCast/__specWatchEnt sit at this scope (hoisted) so the radar + HP HUD can
// centre on the watched fighter. All gated on __world.spectate — a piloted world builds none of it.
let __specWatch = 0, __specLocked = false;
function __specCast() {
  const out = [];
  for (let __si = 0; __si < __world.entities.length; __si++) {
    const __se = __world.entities[__si];
    if (!__se.isCamera && __se.body && __se.body.hittable && Number.isFinite(__se.hpMax)) out.push(__se);
  }
  return out;
}
function __specWatchEnt() {
  if (!__world.spectate) return null;
  const c = __specCast(); if (!c.length) return null;
  if (__specWatch >= c.length) __specWatch = 0;
  return c[__specWatch];
}
if (__world.spectate && __world.camera) {
  const __specCam = __world.camera;
  const __specNameOf = (id) => (__world.match && __world.match.names && __world.match.names[id]) || id;
  // LOCK the chase-cam onto the watched fighter: flip the camera rule to 'follow' and point it — the
  // camera rule carries BOTH glide + follow tunables, so stepWorld's RULES[type] dispatch does the rest.
  const __specFollow = () => {
    const c = __specWatchEnt(); if (!c) return;
    __specCam.rule.type = 'follow';
    __specCam.rule.target = c.id;
    __specCam.lookAt = null;
  };
  // SNAP the free-fly drone to a vantage behind the watched fighter, looking at it (Tab in free mode).
  const __specSnap = () => {
    const c = __specWatchEnt(); if (!c) return;
    const tp = c.transform.pos, th = c.transform.heading || 0;
    const dist = __specCam.rule.dist || 60, height = __specCam.rule.height || 24;
    const px = tp[0] - Math.cos(th) * dist, py = tp[1] - Math.sin(th) * dist, pz = tp[2] + height;
    __specCam.transform.pos = [px, py, pz];
    const dx = tp[0] - px, dy = tp[1] - py, dz = (tp[2] + height * 0.4) - pz, len = Math.hypot(dx, dy, dz) || 1;
    __specCam.transform.heading = Math.atan2(dy, dx);
    __specCam.transform.pitch = Math.asin(Math.max(-1, Math.min(1, dz / len)));
    __specCam.vel = [0, 0, 0];
    __specCam.lookAt = null;
  };
  // hand control back to the glide FREE-FLY without a snap: seed heading/pitch from the current look.
  const __specFree = () => {
    const look = __specCam.lookAt, p = __specCam.transform.pos;
    if (look) {
      const dx = look[0] - p[0], dy = look[1] - p[1], dz = look[2] - p[2], len = Math.hypot(dx, dy, dz) || 1;
      __specCam.transform.heading = Math.atan2(dy, dx);
      __specCam.transform.pitch = Math.asin(Math.max(-1, Math.min(1, dz / len)));
    }
    __specCam.lookAt = null;
    __specCam.vel = [0, 0, 0];
    __specCam.rule.type = 'glide';
  };
  const __specApply = () => { if (__specLocked) __specFollow(); else __specSnap(); };
  const __specHud = document.createElement('div');
  __specHud.style.cssText = 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:7px 16px;border-radius:8px;background:rgba(8,14,22,0.5);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.22);pointer-events:none;z-index:10;font:600 12px system-ui,sans-serif;color:#cfe3ff;text-align:center;white-space:nowrap';
  wrap.appendChild(__specHud);
  const __specSync = () => {
    const c = __specWatchEnt();
    const nm = c ? __specNameOf(c.id) : '\\u2014';
    __specHud.innerHTML = '<span style="color:#8fb4d8;letter-spacing:.14em;font-size:10px">SPECTATING</span> &nbsp; <b>' + nm + '</b> &nbsp;<span style="opacity:.6;font-size:10px">' + (__specLocked ? '\\u25c9 LOCKED' : '\\u25c7 FREE-FLY') + ' \\u00b7 TAB next \\u00b7 F ' + (__specLocked ? 'free-cam' : 'lock') + '</span>';
  };
  const __specCycle = () => {
    const c = __specCast(); if (!c.length) return;
    let i = __specWatch, tries = 0;
    do { i = (i + 1) % c.length; tries++; } while (c[i] && c[i].downed && tries < c.length);   // prefer a living fighter
    __specWatch = i;
    __specApply();
    __specSync();
  };
  window.addEventListener('keydown', (ev) => {
    if (__CTL.is(__BIND, 'spectateNext', 'keyboard', ev.code)) { ev.preventDefault(); if (!ev.repeat) __specCycle(); }
    else if (__CTL.is(__BIND, 'spectateLock', 'keyboard', ev.code) && !ev.repeat) { __specLocked = !__specLocked; if (__specLocked) __specFollow(); else __specFree(); __specSync(); }
  });
  // the pad's (its bindings: RB or D-pad right the next fighter, A the lock), on the press edges, polled with the frame
  const __specPadWas = { next: false, lock: false };
  (function __specPad() {
    requestAnimationFrame(__specPad);
    const g = __padNow(), rd = g && __CTL.gamepadRead(g, __DEV);
    const next = !!g && __CTL.held(__BIND, 'spectateNext', 'gamepad', rd), lock = !!g && __CTL.held(__BIND, 'spectateLock', 'gamepad', rd);
    if (next && !__specPadWas.next) __specCycle();
    if (lock && !__specPadWas.lock) { __specLocked = !__specLocked; if (__specLocked) __specFollow(); else __specFree(); __specSync(); }
    __specPadWas.next = next; __specPadWas.lock = lock;
  })();
  __specSync();
}
// weapon HUD (mobile-suit R6-C): a reticle (core + assist + readiness status, sized from the camera
// fov), an ammo/resource readout, and a lower-right reload/resource bar — built ONLY when a controlled
// entity carries a weapon. The reticle core flashes on a hit (green core / cyan assist / red miss);
// the engine owns all state.
let __wep = null;
// armed = carries a live weapon, OR a loadout with a ranged slot (weapon cycling: the ranged
// slot may not be the active one right now, but the HUD must exist for when it is). A pilotable
// suit's loadout lives on pilotRule while it stands unpiloted — check both.
const __entLoadout = (e) => (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length ? e.rule.loadout : null)
  || (e.pilotRule && Array.isArray(e.pilotRule.loadout) && e.pilotRule.loadout.length ? e.pilotRule.loadout : null);
const __armed = __world.entities.find((e) => e.weapon
  || (__entLoadout(e) || []).some((c) => c && c.weapon));
// SPECTATE: no pilot aims a weapon — the reticle + ammo panel are pilot HUDs, so skip building them
// (the watched fighter's own fire fx still render; only the operator's crosshair is gone).
if (__armed && !__world.spectate) {
  const __lo = __entLoadout(__armed);
  const W = __armed.weapon
    || __CW.normalizeEntity({ weapon: __lo.find((c) => c && c.weapon).weapon }, 0).weapon;
  const __H = renderer.domElement.clientHeight || 780;
  const __tanF = Math.tan((camera.fov || 60) * Math.PI / 360) || 1;
  const __ringPx = (deg) => (__H / 2) * Math.tan(deg * Math.PI / 180) / __tanF;
  // the reticle svg for a weapon config — rebuilt when a loadout switch changes W. __rstat is the
  // act-readiness ring: switch startup + shot cooldown live around the reticle, and vanish when ready.
  const __retInner = (w) => {
    const coreR = Math.max(6, __ringPx(w.coreAngle));
    const assistR = Math.max(coreR + 6, __ringPx(w.assistAngle));
    const statusR = assistR + 7;
    const chargeR = Math.max(3, coreR * 0.72);
    const chargedR = coreR + 4;
    const svgSize = Math.ceil(statusR * 2 + 10), cxy = svgSize / 2;
    let svg = '<svg width="' + svgSize + '" height="' + svgSize + '" viewBox="0 0 ' + svgSize + ' ' + svgSize + '">';
    if (w.fireClass === 'area') svg += '<circle cx="' + cxy + '" cy="' + cxy + '" r="' + assistR.toFixed(1) + '" fill="none" stroke="#7fd4ff" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 5"/>';
    svg += '<circle id="__rstat" cx="' + cxy + '" cy="' + cxy + '" r="' + statusR.toFixed(1) + '" fill="none" stroke="#ffb066" stroke-opacity="0.95" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 ' + cxy + ' ' + cxy + ')" style="display:none"/>';
    svg += '<circle id="__rchgReady" cx="' + cxy + '" cy="' + cxy + '" r="' + chargedR.toFixed(1) + '" fill="none" stroke="#8fffa8" stroke-opacity="0.98" stroke-width="2.5" style="display:none"/>';
    svg += '<circle id="__rcore" cx="' + cxy + '" cy="' + cxy + '" r="' + coreR.toFixed(1) + '" fill="none" stroke="#e8f4ff" stroke-opacity="0.85" stroke-width="1.5"/>';
    svg += '<circle id="__rcharge" cx="' + cxy + '" cy="' + cxy + '" r="' + chargeR.toFixed(1) + '" data-r="' + chargeR.toFixed(1) + '" fill="none" stroke="#8fffa8" stroke-opacity="0.9" stroke-width="2" style="display:none"/>';
    svg += '<circle id="__rdot" cx="' + cxy + '" cy="' + cxy + '" r="1.5" fill="#e8f4ff"/></svg>';
    return svg;
  };
  const __ret = document.createElement('div');
  __ret.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:9';
  __ret.innerHTML = __retInner(W);
  wrap.appendChild(__ret);
  const __rl = 22, __circ = 2 * Math.PI * __rl;
  // weapon-type ICONS (simple monochrome SVG): the loadout slot names one via its icon key;
  // ranged/melee generics are the fallback. Guns read wide, melee tall — each fits the 42px box.
  // (No backticks in this comment on purpose — it lives inside an emitted template literal.)
  const __WICONS = {
    rifle: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="3" y="10" width="31" height="4" fill="#cfe3ff"/><rect x="5" y="13" width="6" height="8" fill="#cfe3ff"/><rect x="14" y="6" width="11" height="3" fill="#9fc2e8"/><rect x="31" y="8" width="7" height="2" fill="#cfe3ff"/></svg>',
    mg: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="3" y="9" width="31" height="4" fill="#cfe3ff"/><circle cx="15" cy="17" r="5" fill="none" stroke="#cfe3ff" stroke-width="2"/><rect x="5" y="12" width="5" height="8" fill="#cfe3ff"/><rect x="31" y="10" width="7" height="2" fill="#cfe3ff"/></svg>',
    saber: '<svg viewBox="0 0 24 40" width="22" height="37"><rect x="10" y="2" width="4" height="23" rx="2" fill="#8fd0ff"/><rect x="8" y="25" width="8" height="3" fill="#cfe3ff"/><rect x="10" y="28" width="4" height="10" fill="#7f9bc4"/></svg>',
    axe: '<svg viewBox="0 0 24 40" width="22" height="37"><rect x="10" y="4" width="3" height="33" fill="#7f9bc4"/><path d="M13 6 L21 9 L21 17 L13 19 Z" fill="#cfe3ff"/></svg>',
    bazooka: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="4" y="7" width="28" height="9" rx="2" fill="#cfe3ff"/><path d="M2 6 L4 8 L4 15 L2 17 Z" fill="#9fc2e8"/><path d="M32 8 L38 11 L32 14 Z" fill="#ffb066"/><rect x="12" y="16" width="5" height="6" fill="#9fc2e8"/></svg>',
    grenade: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="6" y="8" width="18" height="7" rx="2" fill="#cfe3ff"/><circle cx="12" cy="17" r="4" fill="none" stroke="#cfe3ff" stroke-width="2"/><path d="M24 9 L30 6 L34 8 L29 15 Z" fill="#ffb066"/></svg>',
  };
  const __iconFor = (cfg) => (cfg && __WICONS[cfg.icon]) || (cfg && cfg.strike ? __WICONS.saber : __WICONS.rifle);
  // the status panel lives LOWER-RIGHT (above the sound toggle): equipped-weapon icon + name +
  // ammo/resource + the reload/resource ring. Ranged startup/cooldown lives on the reticle.
  const __panel = document.createElement('div');
  __panel.style.cssText = 'position:absolute;right:12px;bottom:54px;display:flex;align-items:center;gap:11px;padding:8px 12px;background:rgba(11,18,32,.62);border:1px solid #24324a;border-radius:9px;font:600 14px system-ui,sans-serif;color:#e8f4ff;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none;z-index:9';
  __panel.innerHTML =
      '<div id="__wepIcon" style="display:flex;align-items:center;justify-content:center;width:42px;height:40px">' + __iconFor(__lo ? __lo[0] : null) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:2px;min-width:62px">'
    +   '<span id="__wepName" style="letter-spacing:.07em;font-size:11px;color:#9fc2e8"></span>'
    +   '<span id="__ammoTxt" style="font-size:15px"></span>'
    + '</div>'
    + '<svg id="__rlRing" width="46" height="46" viewBox="0 0 52 52" style="display:none">'
    +   '<circle cx="26" cy="26" r="' + __rl + '" fill="none" stroke="#26303f" stroke-width="4"/>'
    +   '<circle id="__rlArc" cx="26" cy="26" r="' + __rl + '" fill="none" stroke="#7fd4ff" stroke-width="4" stroke-linecap="round" transform="rotate(-90 26 26)" stroke-dasharray="' + __circ.toFixed(1) + '" stroke-dashoffset="' + __circ.toFixed(1) + '"/></svg>';
  wrap.appendChild(__panel);
  __wep = { e: __armed, W, lo: __lo, retInner: __retInner, ret: __ret, core: __ret.querySelector('#__rcore'),
    dot: __ret.querySelector('#__rdot'), stat: __ret.querySelector('#__rstat'), charge: __ret.querySelector('#__rcharge'), charged: __ret.querySelector('#__rchgReady'), ray: new THREE.Raycaster(), rayO: new THREE.Vector3(), rayD: new THREE.Vector3(),
    iconFor: __iconFor, iconEl: __panel.querySelector('#__wepIcon'), iconKey: null,
    name: __panel.querySelector('#__wepName'), ammoTxt: __panel.querySelector('#__ammoTxt'),
    rlRing: __panel.querySelector('#__rlRing'), rlArc: __panel.querySelector('#__rlArc'), circ: __circ, aimV: new THREE.Vector3() };
}
function __retStatus(frac, color) {
  if (!__wep || !__wep.stat) return;
  const f = Math.max(0, Math.min(1, frac || 0));
  if (f <= 0) { __wep.stat.style.display = 'none'; return; }
  __wep.stat.style.display = '';
  __wep.stat.setAttribute('stroke', color || '#ffb066');
  __wep.stat.setAttribute('stroke-dashoffset', (100 * (1 - f)).toFixed(1));
}
function __retReady() {
  if (__wep && __wep.stat) __wep.stat.style.display = 'none';
}
function __retCharge(W) {
  if (!__wep || !__wep.charge || !__wep.charged) return;
  if (W && W.charging && !W.chargeReady) {
    const base = Number(__wep.charge.getAttribute('data-r')) || 6;
    const frac = Math.max(0, Math.min(1, W.chargeFrac || 0));
    __wep.charge.style.display = '';
    __wep.charge.setAttribute('r', Math.max(0.1, base * (1 - frac)).toFixed(2));
    __wep.charged.style.display = 'none';
  } else if (W && W.charging && W.chargeReady) {
    __wep.charge.style.display = 'none';
    __wep.charged.style.display = '';
  } else {
    __wep.charge.style.display = 'none';
    __wep.charged.style.display = 'none';
  }
}
function __updateWepHud() {
  if (!__wep) return;
  // the HUD tracks the PILOTED suit when a suit switcher is present (T swaps __world.pilotId),
  // else the armed entity it was built for.
  const ent = (__world.pilotId && __world.byId[__world.pilotId]) || __wep.e;
  const now = __world.time, tr = ent.transform;
  // loadout: show the ACTIVE slot's name; a melee slot has no weapon — reticle + ammo hide,
  // the name readout is the tell that a saber/axe is up.
  const lo = __entLoadout(ent);
  const cfg = lo ? (lo[ent.loadoutIdx || 0] || {}) : null;
  if (__wep.name) __wep.name.textContent = cfg ? (cfg.name || (cfg.strike ? 'MELEE' : 'RANGED')) : '';
  // swap the equipped-weapon ICON on a slot change (keyed so it re-renders only when it actually changes)
  if (__wep.iconEl) {
    const ikey = cfg ? (cfg.icon || (cfg.strike ? 'melee' : 'ranged')) : 'none';
    if (ikey !== __wep.iconKey) { __wep.iconEl.innerHTML = cfg ? __wep.iconFor(cfg) : ''; __wep.iconKey = ikey; }
  }
  const W = ent.weapon;
  if (!W) {
    // MELEE slot: no ammo, no reticle — but the same ring shows the swing COOLDOWN (swingT 0->1
    // fills the ring; empty = ready to strike again). While the R20.4 COMBO WINDOW is live the
    // status reads 'COMBO' with a go-green ring DRAINING as the window closes — the tell that a
    // timed follow-up is available (S+click inside it = the knockdown). READY otherwise.
    __wep.ret.style.display = 'none';
    __retReady();
    __retCharge(null);
    if (ent.swingT != null) {
      __wep.ammoTxt.textContent = '';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#ffb066');   // cooldown = warm (distinct from the cyan reload)
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - Math.max(0, Math.min(1, ent.swingT)))).toFixed(1));
    } else if (ent.readyT > 0) {
      // SWITCH READY-TIME (2026-07-28): a freshly-drawn weapon can't act yet — warm ring drains to READY.
      __wep.ammoTxt.textContent = '';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#ffb066');
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - Math.max(0, Math.min(1, ent.readyT / (ent.readyMax || 1))))).toFixed(1));
    } else if (ent.comboT > 0) {
      __wep.ammoTxt.textContent = 'COMBO';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#8fffa8');   // combo window = go-green
      const cw = (cfg && cfg.comboWindow) || 0.8;
      const frac = Math.max(0, Math.min(1, ent.comboT / cw));
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - frac)).toFixed(1));
    } else if (ent.strikeCdT > 0 && cfg && cfg.strikeCooldown > 0) {
      // R20.5 melee cooldown: the fist is spent — warm ring drains toward READY (the combo
      // state above outranks it: while the window is live you CAN press, cooldown or not).
      // The divisor is the ACTUAL armed span (strikeCdMax) so the 2.5s post-combo lockout
      // (2026-07-28) drains over 2.5s, not the base strikeCooldown.
      __wep.ammoTxt.textContent = '';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#ffb066');
      const frac = Math.max(0, Math.min(1, ent.strikeCdT / (ent.strikeCdMax || cfg.strikeCooldown)));
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - frac)).toFixed(1));
    } else {
      __wep.ammoTxt.textContent = 'READY';
      __wep.rlRing.style.display = 'none';
    }
    return;
  }
  if (W !== __wep.W) {   // switched to a different ranged slot: resize the rings to its cones
    __wep.ret.innerHTML = __wep.retInner(W);
    __wep.core = __wep.ret.querySelector('#__rcore');
    __wep.dot = __wep.ret.querySelector('#__rdot');
    __wep.stat = __wep.ret.querySelector('#__rstat');
    __wep.charge = __wep.ret.querySelector('#__rcharge');
    __wep.charged = __wep.ret.querySelector('#__rchgReady');
    __wep.W = W;
  }
  // reticle: project the WORLD aim point (eye + aimDir·reticleDist) to screen, so the crosshair sits
  // over where the gun points OUT IN FRONT of the suit — not fixed at screen center. Tracks yaw+pitch.
  const hh = tr.heading, pp = tr.pitch || 0, cpp = Math.cos(pp);
  const rd = W.reticleDist || 80;
  camera.updateMatrixWorld();
  __wep.aimV.set(
    tr.pos[0] + cpp * Math.cos(hh) * rd,
    tr.pos[1] + cpp * Math.sin(hh) * rd,
    tr.pos[2] + (W.eye || 0) + Math.sin(pp) * rd
  ).project(camera);
  const cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
  if (__wep.aimV.z < 1) {
    __wep.ret.style.display = '';
    __wep.ret.style.left = ((__wep.aimV.x * 0.5 + 0.5) * cw) + 'px';
    __wep.ret.style.top = ((-__wep.aimV.y * 0.5 + 0.5) * ch) + 'px';
  } else __wep.ret.style.display = 'none';   // aim point behind the camera
  if (ent.readyT > 0) {
    __retStatus(Math.max(0, Math.min(1, ent.readyT / (ent.readyMax || 1))), '#ffb066');
  } else if (W.cooldownT > 0 && !W.auto) {
    // semi/lob only — an AUTO weapon's between-round gap IS its fire rate (operator, 2026-08-10):
    // a 16/s gatling flashed this ring at rof, pure noise. Autos skip straight to ready.
    const __cdMax = W.burstLeft > 0 ? (1 / (W.burstRof || 8)) : (W.cooldown || 0.5);
    __retStatus(Math.max(0, Math.min(1, W.cooldownT / __cdMax)), '#ffb066');
  } else {
    __retReady();
  }
  __retCharge(W);
  if (W.energyMax > 0) {
    const efrac = Math.max(0, Math.min(1, (W.energy == null ? W.energyMax : W.energy) / W.energyMax));
    __wep.ammoTxt.textContent = W.energyLock ? 'OVERHEAT' : (Math.round(efrac * 100) + '%');
    __wep.rlRing.style.display = '';
    __wep.rlArc.setAttribute('stroke', W.energyLock ? '#ff6b6b' : (efrac < 0.25 ? '#ffb347' : '#7fd4ff'));
    __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - efrac)).toFixed(1));
  } else if (W.reloading) {
    __wep.ammoTxt.textContent = 'RELOADING';
    __wep.rlRing.style.display = '';
    __wep.rlArc.setAttribute('stroke', '#7fd4ff');   // reload = cyan (reset — a melee slot tints it warm)
    const frac = Math.max(0, Math.min(1, 1 - W.reloadT / (W.reload || 1)));
    __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - frac)).toFixed(1));
  } else {
    // a weapon with a reserve reads its spare rounds too (+n), and EMPTY when both are out
    __wep.ammoTxt.textContent = W.reserve === 0 && W.ammo <= 0 ? 'EMPTY' : W.ammo + ' / ' + W.magazine + (W.reserve != null ? '  +' + W.reserve : '');
    __wep.rlRing.style.display = 'none';
  }
  // TARGET ACQUIRED: the rings + dot burn RED while the aim would LAND — the renderer-side
  // mirror of stepWeapon's adjudication (in-range + inside the weapon's cone widened by the
  // target's angular size + a clear sightline; the egg test rides the collide egg's angular
  // approximation, same as the floating enemy-HP 'targeting' read). Invincible targets (dodge
  // i-frames / spawn shield) read WHITE — the tell is honest: red means the shot counts.
  const lock = __aimLocked(ent, W, tr);
  const ls = ent.lastShot;
  let col = lock ? '#ff5a4d' : '#e8f4ff';
  if (ls && now - ls.t < 0.12) col = ls.mode === 'core' ? '#8fffa8' : ls.mode === 'assist' ? '#7fd4ff' : '#ff6b6b';
  __wep.core.setAttribute('stroke', col);
  if (__wep.dot) __wep.dot.setAttribute('fill', lock ? '#ff5a4d' : '#e8f4ff');
}
function __aimLocked(ent, W, tr) {
  const pp = tr.pitch || 0, cp = Math.cos(pp);
  const ax = cp * Math.cos(tr.heading), ay = cp * Math.sin(tr.heading), az = Math.sin(pp);
  const eye = [tr.pos[0], tr.pos[1], tr.pos[2] + (W.eye || 0)];
  const aim = [ax, ay, az];
  const coreR = (W.coreAngle || 1.5) * Math.PI / 180;
  const assistR = (W.assistAngle || W.coreAngle || 1.5) * Math.PI / 180;
  const range = W.range || 400;
  const own = __bodySet();
  for (const tg of __world.entities) {
    if (tg === ent || tg.invincible || !(tg.body && tg.body.hittable)) continue;
    // stepWeapon's own adjudication, verbatim: v to the FEET pos, range gate on |v|, then the
    // ray-vs-egg intersection for suits (__CW.hitEgg — the exact engine function, so the HUD is
    // never more forgiving than the shot) with the area assist ring beside it; legacy spheres
    // keep the angular cone widened by their subtend.
    const dx = tg.transform.pos[0] - eye[0], dy = tg.transform.pos[1] - eye[1], dz = tg.transform.pos[2] - eye[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3 || d > range) continue;
    let would = false;
    if (tg.body.egg) {
      const te = __CW.hitEgg(eye, aim, tg);
      if (te != null && te <= range) would = true;
      else if (W.fireClass === 'area') {
        const ang = Math.acos(Math.max(-1, Math.min(1, (ax * dx + ay * dy + az * dz) / d)));
        would = ang <= assistR + Math.atan(tg.body.egg.a / d);
      }
    } else {
      const ang = Math.acos(Math.max(-1, Math.min(1, (ax * dx + ay * dy + az * dz) / d)));
      const subtend = Math.atan((tg.body.radius || 0.5) / d);
      would = ang <= coreR + subtend || (W.fireClass === 'area' && ang <= assistR + subtend);
    }
    if (!would) continue;
    const latR = tg.body.egg ? tg.body.egg.a : (tg.body.radius || 1);
    // sightline: probed lazily — only for a would-be hit (engine posture), so a clean lane costs
    // one ray per frame at most. Entity bodies are excluded (cover blocks shots, suits do not).
    __wep.rayO.set(eye[0], eye[1], eye[2]); __wep.rayD.set(dx / d, dy / d, dz / d);
    __wep.ray.set(__wep.rayO, __wep.rayD);
    __wep.ray.far = Math.max(0, d - latR);
    __wep.ray.camera = camera;   // sprite-safe traverse (see __ground's E8 note)
    let blocked = false;
    for (const h of __wep.ray.intersectObjects(scene.children, true)) {
      if (!h.object.isMesh) continue;
      let o = h.object; while (o) { if (own.includes(o)) break; o = o.parent; }
      if (!o) { blocked = true; break; }
    }
    __wep.ray.far = Infinity;
    if (!blocked) return true;
  }
  return false;
}
// BOOST GAUGE HUD (mobile-suit boost resource): a translucent minimalist horizontal bar pinned
// bottom-middle whose fill tracks the piloted suit's boost/boostMax (moved off the top 2026-08-13 —
// the top-center band is reserved for announcements: Mobile Suit Destroyed, match calls). Built
// ONLY when some entity carries a gauge (rule.boostMax, or pilotRule.boostMax on an unpiloted
// pilotable suit). The fill dims + reddens while the gauge is empty-locked (the "spent" read),
// ambers when low. Bottom-center is free in piloted mode: the bottom spectate HUD and this gauge
// are mutually exclusive (no gauge in spectate), and the weapon/HP cards keep to the right edge.
let __bg = null;
const __boostMaxOf = (e) => (e.rule && e.rule.boostMax > 0 ? e.rule.boostMax
  : (e.pilotRule && e.pilotRule.boostMax > 0 ? e.pilotRule.boostMax : 0));
const __boostEnt = __world.entities.find((e) => __boostMaxOf(e) > 0);
if (__boostEnt && !__world.spectate) {   // SPECTATE: boost is a pilot resource — no gauge when nobody flies
  const __bgWrap = document.createElement('div');
  __bgWrap.style.cssText = 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:240px;height:7px;border-radius:4px;background:rgba(10,18,28,0.32);box-shadow:inset 0 0 0 1px rgba(160,200,232,0.22);overflow:hidden;pointer-events:none;z-index:9';
  const __bgFill = document.createElement('div');
  __bgFill.style.cssText = 'height:100%;width:100%;background:#7fd4ff;opacity:0.72';
  __bgWrap.appendChild(__bgFill);
  wrap.appendChild(__bgWrap);
  // the OVERHEAT tell: while the gauge is locked (drained, or dumped by a dodge), thrust is dead —
  // a small red caption just above the bar reads it out (inboard of the screen edge, mirroring
  // the old under-the-bar placement at top). Hidden whenever the thruster is live.
  const __bgLabel = document.createElement('div');
  __bgLabel.textContent = 'OVERHEAT';
  __bgLabel.style.cssText = 'position:absolute;left:50%;bottom:27px;transform:translateX(-50%);font:700 10px system-ui,sans-serif;letter-spacing:.14em;color:#ff6b6b;text-shadow:0 1px 3px rgba(0,0,0,.6);display:none;pointer-events:none;z-index:9';
  wrap.appendChild(__bgLabel);
  __bg = { wrap: __bgWrap, fill: __bgFill, label: __bgLabel };
}
// R19 SHIELD pip — REMOVED (operator, 2026-08-06): the shield's HP is no longer read out as a
// HUD bar. The shield still reads visually — the prop on the arm, the shatter fx on break, and
// the break-stagger — which is the whole tell now.
// RADAR HUD (mobile-suit): a top-down circular minimap pinned upper-right. Blips are the OTHER
// hittable entities relative to the piloted suit, HEADING-RELATIVE (the suit's forward is UP). Always
// top-down (ignores pitch), so it reads the same in ground and space. Vertical is encoded by the blip
// STYLE: an enemy ABOVE the suit is a THICK ring, one BELOW is a DOTTED ring, one roughly level is a
// filled dot. Rival SUITS (pilotable) are red; plain targets are blue. Built only for a controllable
// world that has a controlled shooter (pilot / armed) + at least one hittable other; re-resolves to
${lock ? `// TARGET LOCK bracket (lock.js): a diamond projected over the locked target's body centre with a
// LOCK caption; hidden when nothing is locked or the target sits behind the camera. Opt-in bytes.
const __lockEl = document.createElement('div');
__lockEl.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:9;display:none';
__lockEl.innerHTML = '<div style="width:40px;height:40px;margin:-20px 0 0 -20px;border:2px solid #ffe000;border-radius:5px;transform:rotate(45deg);box-shadow:0 0 14px rgba(255,224,0,.55),inset 0 0 8px rgba(255,224,0,.25)"></div>'
  + '<div style="position:absolute;left:26px;top:-8px;font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:2px;color:#ffe000;text-shadow:0 0 8px rgba(255,224,0,.7)">LOCK</div>';
wrap.appendChild(__lockEl);
const __lockV = new THREE.Vector3();
function __updateLock() {
  const L = __world.lock, tg = L && L.target ? __world.byId[L.target] : null;
  if (!tg) { __lockEl.style.display = 'none'; return; }
  const p = tg.transform.pos, lift = tg.body && tg.body.egg ? (tg.body.egg.b || 0) : ((tg.body && tg.body.radius) || 0);
  camera.updateMatrixWorld();
  __lockV.set(p[0], p[1], p[2] + lift).project(camera);
  if (__lockV.z >= 1) { __lockEl.style.display = 'none'; return; }
  const cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
  __lockEl.style.display = '';
  __lockEl.style.left = ((__lockV.x * 0.5 + 0.5) * cw) + 'px';
  __lockEl.style.top = ((-__lockV.y * 0.5 + 0.5) * ch) + 'px';
}
` : ''}// the PILOTED suit each frame (T swaps it). Absent otherwise (byte-identical).
let __radar = null;
const __radarSelf = () => __world.spectate ? __specWatchEnt() : ((__world.pilotId && __world.byId[__world.pilotId]) || __armed || null);
if (__radarSelf() && __world.entities.some((e) => e.body && e.body.hittable && e !== __radarSelf())) {
  const RSZ = 132;
  const __rWrap = document.createElement('div');
  __rWrap.style.cssText = 'position:absolute;right:16px;top:16px;width:' + RSZ + 'px;height:' + RSZ + 'px;border-radius:50%;background:rgba(8,14,22,0.42);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.28),0 2px 10px rgba(0,0,0,0.42);pointer-events:none;z-index:9;overflow:hidden';
  const __rCv = document.createElement('canvas');
  __rCv.width = RSZ * 2; __rCv.height = RSZ * 2; __rCv.style.cssText = 'width:100%;height:100%';
  __rWrap.appendChild(__rCv); wrap.appendChild(__rWrap);
  __radar = { ctx: __rCv.getContext('2d'), sz: RSZ * 2, range: 620, band: 10 };
}
function __updateRadar() {
  if (!__radar) return;
  const x = __radar.ctx, S = __radar.sz, C = S / 2, rad = C - 11;
  x.clearRect(0, 0, S, S); x.setLineDash([]);
  x.strokeStyle = 'rgba(120,200,255,0.22)'; x.lineWidth = 2;
  x.beginPath(); x.arc(C, C, rad, 0, 7); x.stroke();
  x.beginPath(); x.arc(C, C, rad * 0.5, 0, 7); x.stroke();
  x.strokeStyle = 'rgba(120,200,255,0.12)'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(C, C - rad); x.lineTo(C, C + rad); x.moveTo(C - rad, C); x.lineTo(C + rad, C); x.stroke();
  const self = __radarSelf();
  if (self) {
    const sp = self.transform.pos, h = self.transform.heading;
    const fwx = Math.cos(h), fwy = Math.sin(h), rgx = Math.sin(h), rgy = -Math.cos(h);   // forward + right basis
    const scale = rad / __radar.range, band = __radar.band;
    for (const e of __world.entities) {
      if (e === self || e.isCamera || !(e.body && e.body.hittable)) continue;
      const dx = e.transform.pos[0] - sp[0], dy = e.transform.pos[1] - sp[1], dz = e.transform.pos[2] - sp[2];
      const u = dx * fwx + dy * fwy, rr = dx * rgx + dy * rgy;   // forward-up, right
      let px = rr * scale, py = -u * scale;
      const d = Math.hypot(px, py); if (d > rad) { px = px / d * rad; py = py / d * rad; }   // clamp off-radar blips to the rim
      // TEAM battle: same-faction suits read as ALLIES (green), other-faction as enemies (red). Enemy
      // seats are not pilotable, so team mode keys off the TEAM, not the pilotable heuristic; plain
      // targets stay blue. Absent teams → the classic pilotable=red read (byte-identical).
      const __teamOn = __world.match && __world.match.teamMode;
      const ally = __teamOn && self.team && e.team && e.team === self.team;
      const enemy = __teamOn ? (!ally && !!e.team && e.team !== self.team) : !!e.pilotable;
      const bx = C + px, by = C + py, col = ally ? '#5fe08a' : (enemy ? '#ff5a5a' : '#7fd4ff');
      x.strokeStyle = col; x.fillStyle = col; x.setLineDash([]);
      if (dz > band) { x.lineWidth = enemy ? 3.4 : 2.6; x.beginPath(); x.arc(bx, by, enemy ? 6 : 5, 0, 7); x.stroke(); }          // ABOVE → thick ring
      else if (dz < -band) { x.setLineDash([3, 3]); x.lineWidth = 2; x.beginPath(); x.arc(bx, by, enemy ? 6 : 5, 0, 7); x.stroke(); x.setLineDash([]); }   // BELOW → dotted ring
      else { x.beginPath(); x.arc(bx, by, enemy ? 4.6 : 3.8, 0, 7); x.fill(); }                                                   // LEVEL → filled dot
    }
  }
  x.fillStyle = '#eaf4ff'; x.beginPath(); x.moveTo(C, C - 7); x.lineTo(C - 5, C + 5); x.lineTo(C + 5, C + 5); x.closePath(); x.fill();   // the pilot (forward = up)
}
// HEALTH BAR HUD (mobile-suit): the PILOTED suit's hp/hpMax, lower-right (stacked above the weapon
// panel). Built when some entity carries hp; re-resolves to world.pilotId each frame — damage carries
// across a T switch, so piloting a suit that was shot as the enemy shows its reduced HP. Green →
// amber → red as it drops. Absent when no entity has hp (byte-identical).
let __hp = null;
const __hpMaxOf = (e) => (e && Number.isFinite(e.hpMax) && e.hpMax > 0 ? e.hpMax : 0);
if (__world.entities.some((e) => __hpMaxOf(e) > 0)) {
  const __hpWrap = document.createElement('div');
  __hpWrap.style.cssText = 'position:absolute;right:12px;bottom:100px;width:196px;padding:6px 11px 8px;background:rgba(11,18,32,.62);border:1px solid #24324a;border-radius:9px;pointer-events:none;z-index:9';
  const __hpTop = document.createElement('div');
  __hpTop.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;font:700 10px system-ui,sans-serif;letter-spacing:.14em;color:#cfe0f2;text-shadow:0 1px 3px rgba(0,0,0,.6)';
  const __hpLbl = document.createElement('span'); __hpLbl.textContent = 'HP';
  const __hpNum = document.createElement('span'); __hpNum.style.cssText = 'font:600 12px system-ui,sans-serif;letter-spacing:0;color:#e8f4ff';
  __hpTop.appendChild(__hpLbl); __hpTop.appendChild(__hpNum);
  const __hpTrack = document.createElement('div');
  __hpTrack.style.cssText = 'height:9px;border-radius:5px;background:rgba(10,18,28,0.55);box-shadow:inset 0 0 0 1px rgba(160,200,232,0.18);overflow:hidden';
  const __hpFill = document.createElement('div');
  __hpFill.style.cssText = 'height:100%;width:100%;background:#5fe08a;opacity:0.9';
  __hpTrack.appendChild(__hpFill);
  __hpWrap.appendChild(__hpTop); __hpWrap.appendChild(__hpTrack);
  wrap.appendChild(__hpWrap);
  __hp = { wrap: __hpWrap, fill: __hpFill, num: __hpNum };
}
function __updateHpHud() {
  if (!__hp) return;
  // SPECTATE: the bar tracks the WATCHED fighter (Tab cycles it); piloted worlds track the pilot.
  const ent = __world.spectate ? __specWatchEnt() : ((__world.pilotId && __world.byId[__world.pilotId]) || null);
  const max = __hpMaxOf(ent);
  if (max <= 0) { __hp.wrap.style.display = 'none'; return; }
  __hp.wrap.style.display = '';
  const cur = ent.body && Number.isFinite(ent.body.hp) ? Math.max(0, ent.body.hp) : max;
  const frac = Math.max(0, Math.min(1, cur / max));
  __hp.fill.style.width = (frac * 100).toFixed(1) + '%';
  __hp.fill.style.background = frac < 0.25 ? '#ff5a5a' : (frac < 0.55 ? '#ffb347' : '#5fe08a');
  __hp.num.textContent = Math.ceil(cur) + ' / ' + max;
}
// ENEMY HP BARS: a floating red hp bar above any hp-bearing enemy the piloted suit is TARGETING (the
// aim ray is on it, within its angular size) or ENGAGING (hit within the last ~4s). World-space,
// projected to screen each frame; the red fill shrinks as you chip its hp. One bar per hp-bearing
// entity (the piloted suit's own is hidden — its hp is the lower-right bar). Absent when nothing has hp.
const __ehp = [];
for (const e of __world.entities) {
  if (!(e.body && Number.isFinite(e.hpMax) && e.hpMax > 0)) continue;
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;width:56px;height:6px;transform:translate(-50%,-50%);border-radius:3px;background:rgba(8,12,20,0.6);box-shadow:inset 0 0 0 1px rgba(255,120,120,0.55),0 1px 3px rgba(0,0,0,0.5);overflow:hidden;pointer-events:none;z-index:8;display:none';
  const fl = document.createElement('div'); fl.style.cssText = 'height:100%;width:100%;background:#ff5a5a';
  el.appendChild(fl); wrap.appendChild(el);
  __ehp.push({ id: e.id, el: el, fill: fl });
}
const __ehpV = __ehp.length ? new THREE.Vector3() : null;
function __updateEnemyHp() {
  if (!__ehp.length) return;
  const pilot = (__world.pilotId && __world.byId[__world.pilotId]) || null;
  const __teamOn = __world.match && __world.match.teamMode;   // TEAM: allies get a green, always-on bar
  const __selfTeam = pilot && pilot.team;
  const now = __world.time, cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
  let aim = null, eye = null;
  if (pilot) {
    const ph = pilot.transform.heading, pp = pilot.transform.pitch || 0, cp = Math.cos(pp);
    aim = [cp * Math.cos(ph), cp * Math.sin(ph), Math.sin(pp)];   // the fire ray direction
    const ez = pilot.weapon ? (pilot.weapon.eye || 0) : (pilot.collideVol ? pilot.collideVol.cz : 12);
    eye = [pilot.transform.pos[0], pilot.transform.pos[1], pilot.transform.pos[2] + ez];
  }
  camera.updateMatrixWorld();
  for (const r of __ehp) {
    const e = __world.byId[r.id];
    // gone covers both the vanished wreck (finisher) and a DORMANT tutorial seat parked at its
    // authored pose — neither should float a bar over empty air.
    if (!e || e === pilot || e.gone) { r.el.style.display = 'none'; continue; }
    // TEAM: an ALLY bar is always shown (green) so you can track your wing's health; an enemy bar keeps
    // the engage/target gate — ENGAGING (recently hit) OR TARGETING (aim ray within its angular size).
    const ally = __teamOn && __selfTeam && e.team && e.team === __selfTeam;
    let show = ally ? !e.downed : (e.hitFlash >= 0 && (now - e.hitFlash) < 4);
    if (!show && !ally && aim) {
      const dx = e.transform.pos[0] - eye[0], dy = e.transform.pos[1] - eye[1];
      const dz = (e.transform.pos[2] + (e.collideVol ? e.collideVol.cz : 12)) - eye[2];
      const d = Math.hypot(dx, dy, dz) || 1e-6, dot = (aim[0] * dx + aim[1] * dy + aim[2] * dz) / d;
      const latR = e.collideVol ? e.collideVol.a : (e.body.radius || 1);
      if (dot > 0 && Math.acos(Math.max(-1, Math.min(1, dot))) <= 0.07 + Math.atan(latR / d)) show = true;
    }
    if (!show) { r.el.style.display = 'none'; continue; }
    // project the enemy's HEAD (above the collide egg / hit radius) to screen
    const topZ = e.transform.pos[2] + (e.collideVol ? e.collideVol.c * 2.1 : (e.body.radius ? e.body.radius * 1.5 : 22));
    __ehpV.set(e.transform.pos[0], e.transform.pos[1], topZ).project(camera);
    if (__ehpV.z >= 1) { r.el.style.display = 'none'; continue; }   // behind the camera
    r.el.style.display = '';
    r.el.style.left = ((__ehpV.x * 0.5 + 0.5) * cw) + 'px';
    r.el.style.top = ((-__ehpV.y * 0.5 + 0.5) * ch) + 'px';
    const cur = Number.isFinite(e.body.hp) ? Math.max(0, e.body.hp) : e.hpMax;
    const frac = Math.max(0, Math.min(1, cur / e.hpMax));
    r.fill.style.width = (frac * 100).toFixed(1) + '%';
    r.fill.style.background = ally ? '#5fe08a' : (frac < 0.3 ? '#ff2e2e' : '#ff5a5a');
    r.el.style.boxShadow = ally ? 'inset 0 0 0 1px rgba(120,255,160,0.62),0 1px 3px rgba(0,0,0,0.5)' : 'inset 0 0 0 1px rgba(255,120,120,0.55),0 1px 3px rgba(0,0,0,0.5)';
  }
}
function __updateBoostHud() {
  if (!__bg) return;
  const ent = (__world.pilotId && __world.byId[__world.pilotId]) || __boostEnt;
  const max = __boostMaxOf(ent);
  if (max <= 0) { __bg.wrap.style.display = 'none'; __bg.label.style.display = 'none'; return; }
  __bg.wrap.style.display = '';
  const cur = ent.boost == null ? max : ent.boost;   // unpiloted-never-ran suits read full
  const frac = Math.max(0, Math.min(1, cur / max));
  const overheat = !!ent.boostLock;
  // OVERHEAT read (rev3): while the bar is overheat-locked, boost AND dodge are both dead —
  // the RED fill + the OVERHEAT caption now span the whole ~7.5s climb back to FULL (the
  // engine unlocks only at a full bar). Unlocked = both usable → the classic cyan, with the
  // low-fuel amber warning that a little more thrust would tip it into the outage.
  __bg.fill.style.width = (frac * 100).toFixed(1) + '%';
  __bg.fill.style.background = overheat ? '#ff6b6b' : (frac < 0.25 ? '#ffb347' : '#7fd4ff');
  __bg.fill.style.opacity = overheat ? '0.5' : '0.72';
  __bg.label.style.display = overheat ? '' : 'none';
}
// muzzle-flash + tracer + impact effects: on each new shot (weapon.shots increments) spawn transient
// additive meshes at the engine-provided from/to and fade them over their ttl. Non-pickable (raycast
// disabled) so they never confuse the ground probe. Colour + size come from the weapon's fx config.
// R20: tracked PER SHOOTER (a map keyed by entity id), not just the piloted suit — an AI-driven
// vacated suit fires back now, and its tracers/flash/impacts must be visible too. Each fx record
// carries its own base size, so two shooters' effects never share scale state.
const __fxSeen = {};   // entity id -> { w, shots } — the weapon + shot count each shooter's fx track
const __fx = [];
const __muzzleV = new THREE.Vector3();
const __beamUpY = new THREE.Vector3(0, 1, 0);   // the cylinder's own axis (+Y), rotated onto the travel dir
const __beamDir = new THREE.Vector3();
const __impUpZ = new THREE.Vector3(0, 0, 1);    // +Z → shot dir, for orienting the impact ring/star
function __fxMat(c) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }); }
// richer HIT feedback (2026-08-13, operator "add more impact frames so we can see we're hitting"): a
// landed rifle/vulcan shot pops a CLUSTER at the impact point — a bright core FLASH, an expanding shock
// RING facing back up the shot, and a radial SPARK STAR in the plane perpendicular to the shot — so a
// hit reads visually, not just as a dropping number. Deferred to the bolt's arrival, and seeded
// ONLY by geometry (no Math.random → capture stays byte-identical). Sized by the weapon's fxScale, so a
// vulcan round sparks small and a rifle bolt hits big.
function __spawnImpactFx(b, col, sz, dir, at) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
  flash.position.set(b[0], b[1], b[2]); flash.scale.setScalar(sz * 0.42); flash.raycast = function () {}; flash.visible = false; scene.add(flash);
  __fx.push({ obj: flash, born: at, ttl: 0.13, kind: 'impact', base: sz * 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 6, 20), __fxMat(col));
  ring.position.set(b[0], b[1], b[2]);
  ring.quaternion.setFromUnitVectors(__impUpZ, __beamDir.set(-dir[0], -dir[1], -dir[2]));   // face back up the shot
  ring.raycast = function () {}; ring.visible = false; scene.add(ring);
  __fx.push({ obj: ring, born: at, ttl: 0.2, kind: 'shock', base: sz * 0.32 });
  const N = 7, pts = [];
  for (let k = 0; k < N; k++) { const ang = k * (Math.PI * 2 / N); pts.push(0, 0, 0, Math.cos(ang), Math.sin(ang), 0); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const star = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  star.position.set(b[0], b[1], b[2]);
  star.quaternion.setFromUnitVectors(__impUpZ, __beamDir.set(dir[0], dir[1], dir[2]));   // star plane ⟂ the shot
  star.raycast = function () {}; star.visible = false; scene.add(star);
  __fx.push({ obj: star, born: at, ttl: 0.16, kind: 'shard', base: sz * 0.9 });
}
function __spawnShotFx(shot, from, col, sz, range) {
  if (!shot || !from || !shot.to) return;
  const a = from, b = shot.to, born = __world.time;
  // TRAVELLING BOLT (2026-08-13): a hitscan shot (beam rifle / beam MG / vulcan — the engine resolves
  // the hit instantly) is drawn as a thin ELONGATED ROD that FLIES from the muzzle to the target over a
  // brief beat, instead of the old instant full-length tracer line (which read as "just a flash"). The
  // rod is a slim cylinder aligned to the travel direction — NO spherical bead (operator "less ball,
  // more rod, no circular effect"). The travel time scales with how far the shot reached vs the weapon's
  // RANGE, so it is world-scale independent — a full-range shot takes ~beamMaxT, a point-blank one
  // ~beamMinT. Each weapon's fxColor tints the rod (cyan beams, amber tracers), so it reads as
  // beam-vs-round by colour. The bazooka never reaches here (to:null; the projectile channel owns it).
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.05) return;   // degenerate (muzzle == target): no bolt, and no zero-vector orientation
  const beamMinT = 0.045, beamMaxT = 0.26;
  const rng = (range && range > 0) ? range : dist;
  const travelT = Math.max(beamMinT, Math.min(beamMaxT, beamMaxT * dist / rng));
  const dir = [dx / dist, dy / dist, dz / dist];
  // length scales with the WEAPON (fxScale), NOT the shot distance — so a small head vulcan fires a
  // small bolt (a distance-driven length made vulcan rounds long streaks; operator 2026-08-13). Capped
  // at half the gap so a point-blank shot stays short. Rifle ≈ sz·1.6, vulcan ≈ sz·1.6 of a small sz.
  const rodLen = Math.min(dist * 0.5, sz * 1.6);
  const rodRad = Math.max(0.2, sz * 0.1);                                 // slim — a rod, not a ball
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(rodRad, rodRad, rodLen, 6, 1), __fxMat(col));
  rod.quaternion.setFromUnitVectors(__beamUpY, __beamDir.set(dir[0], dir[1], dir[2]));   // +Y → travel dir (fixed for a straight shot)
  rod.raycast = function () {}; scene.add(rod);
  __fx.push({ obj: rod, born: born, ttl: travelT, kind: 'beam', p0: a.slice(), p1: b.slice(), dir: dir, len: rodLen, dist: dist });
  const mf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), __fxMat(col));
  mf.position.set(a[0], a[1], a[2]); mf.scale.setScalar(sz * 0.5); mf.raycast = function () {}; scene.add(mf);
  __fx.push({ obj: mf, born: born, ttl: 0.08, kind: 'flash', base: sz * 0.5 });
  // the impact CLUSTER is DEFERRED to the bolt's arrival (born + travelT), so the hit lands WHEN the
  // bolt reaches the target instead of at fire time (each piece stays invisible until then, age < 0 guard).
  if (shot.mode === 'core' || shot.mode === 'assist') __spawnImpactFx(b, col, sz, dir, born + travelT);
}
function __updateFx() {
  // EVERY armed entity's shots spawn fx (the pilot, a fixed armed entity, an AI fire-back suit).
  for (const fent of __world.entities) {
    if (!fent.weapon && !__fxSeen[fent.id]) continue;
    // a loadout switch (or a T pilot transfer) swaps the live weapon reference (or nulls it on a
    // melee slot): re-sync this shooter's fx state so shot counting + tint follow its active gun.
    const rec = __fxSeen[fent.id] || (__fxSeen[fent.id] = { w: fent.weapon, shots: fent.weapon ? (fent.weapon.shots || 0) : 0 });
    if (fent.weapon !== rec.w) { rec.w = fent.weapon; rec.shots = rec.w ? (rec.w.shots || 0) : 0; }
    if (!rec.w) continue;
    const s = rec.w.shots || 0;
    if (s > rec.shots) {
      const col = rec.w.fxColor != null ? rec.w.fxColor : 0xffcc66;
      const sz = rec.w.fxScale != null ? rec.w.fxScale : 3;
      // origin = the live weapon-tip locator (rides the arm) when present, else the engine's from.
      // R19 fix: a show:'none' slot (head vulcan / torso beam) fires from the BODY muzzle, NOT the
      // hand — keep the engine's from (head/chest muzzleOffset) instead of the arm locator.
      let from = fent.lastShot && fent.lastShot.from;
      const __flo = __entLoadout(fent), __fcfg = __flo && __flo[fent.loadoutIdx || 0];
      // show may be a [active, ...racked] list — the ACTIVE (first) tag decides body-vs-hand muzzle
      const __fshow = __fcfg && (Array.isArray(__fcfg.show) ? __fcfg.show[0] : __fcfg.show);
      const bodyMuzzle = __fshow === 'none';
      const body = __bodies[fent.id], rf = body && body.userData && body.userData.rigFig;
      if (rf && rf.muzzle && !bodyMuzzle) { rf.muzzle.getWorldPosition(__muzzleV); from = [__muzzleV.x, __muzzleV.y, __muzzleV.z]; }
      __spawnShotFx(fent.lastShot, from, col, sz, rec.w.range);
      // DUAL WIELD (muzzleDual): the second gun fires SIMULTANEOUSLY — mirror the muzzle across the
      // body's sagittal plane (normal = the right vector) so the off-hand pistol flashes at its own tip.
      if (from && rec.w.muzzleDual) {
        const __tp = fent.transform.pos, __hh = fent.transform.heading || 0;
        const __rx = Math.sin(__hh), __ry = -Math.cos(__hh);
        const __lat = (from[0] - __tp[0]) * __rx + (from[1] - __tp[1]) * __ry;
        __spawnShotFx(fent.lastShot, [from[0] - 2 * __lat * __rx, from[1] - 2 * __lat * __ry, from[2]], col, sz, rec.w.range);
      }
      rec.shots = s;
    }
  }
  for (let i = __fx.length - 1; i >= 0; i--) {
    const f = __fx[i], age = (__world.time - f.born) / f.ttl;
    if (age >= 1) { scene.remove(f.obj); f.obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); __fx.splice(i, 1); continue; }
    if (age < 0) { f.obj.visible = false; continue; }   // DEFERRED fx (a beam's impact) waits for its born time
    if (!f.obj.visible) f.obj.visible = true;
    if (f.kind === 'beam') {
      // the ROD EMERGES from the muzzle and flies forward: the leading tip travels p0→p1, and the rod's
      // tail is CLAMPED at the muzzle (never extends behind p0) — so a bolt spawns AT the gun tip, not
      // trailing out the back (operator 2026-08-13, head vulcan). It grows to full length as it clears
      // the muzzle, then travels rigid. Orientation is fixed (straight shot); centre + length update.
      const leadDist = f.dist * age;                    // the leading tip's distance from the muzzle
      const effLen = Math.min(f.len, leadDist);         // visible length: 0 at the muzzle → full once clear
      const c = leadDist - effLen * 0.5;                // rod centre, measured from the muzzle along dir
      f.obj.position.set(f.p0[0] + f.dir[0] * c, f.p0[1] + f.dir[1] * c, f.p0[2] + f.dir[2] * c);
      f.obj.scale.set(1, f.len > 0 ? effLen / f.len : 1, 1);   // shrink the cylinder to its un-clipped length
      const fade = age > 0.8 ? (1 - (age - 0.8) / 0.2) : 1;   // a brief guttering as it lands
      f.obj.material.opacity = 0.9 * fade;
    }
    else if (f.kind === 'flash') { f.obj.material.opacity = 1 - age; f.obj.scale.setScalar(f.base * (1 + age * 0.6)); }
    else if (f.kind === 'impact') { f.obj.material.opacity = 1 - age; f.obj.scale.setScalar(f.base * (0.3 + age * 1.4)); }
    // impact CLUSTER (rifle/vulcan hit): a shock RING expands + fades; a radial SPARK STAR flies out + snaps out.
    else if (f.kind === 'shock') { f.obj.material.opacity = 0.9 * (1 - age); f.obj.scale.setScalar(f.base * (0.3 + age * 1.7)); }
    else if (f.kind === 'shard') { f.obj.material.opacity = 0.95 * (1 - age * age); f.obj.scale.setScalar(f.base * (0.25 + age * 1.25)); }
    // R14 burst: an expanding shell that carries its OWN base + dim (so it is not coupled to the
    // active hitscan weapon's __fxSz like the shot flash is). dim caps peak opacity — the wide
    // splash shell is translucent (a fireball), the small inner flash near-opaque.
    else if (f.kind === 'burst') { f.obj.material.opacity = (f.dim != null ? f.dim : 1) * (1 - age); f.obj.scale.setScalar(f.base * (0.3 + age * 1.0)); }
    // suit-death fragment shower: each point flies out along its own velocity and arcs down under
    // gravity, resting on the ground (z=0), fading out (quicker at the end).
    else if (f.kind === 'debris') {
      const t = age * f.ttl, ap = f.obj.geometry.attributes.position;
      for (let k = 0; k < f.vels.length; k++) {
        const v = f.vels[k];
        let z = f.p0[2] + v[2] * t - 0.5 * f.grav * t * t;
        if (z < 0) z = 0;
        ap.setXYZ(k, f.p0[0] + v[0] * t, f.p0[1] + v[1] * t, z);
      }
      ap.needsUpdate = true;
      f.obj.material.opacity = 1 - age * age;
    }
    // spark (melee clash): a glowing mote + line tail on an analytic ballistic arc — head at
    // age·ttl seconds of flight, tail trailing 45ms behind, both floor-clamped, fading linearly.
    else if (f.kind === 'spark') {
      const tt = age * f.ttl, t2 = Math.max(0, tt - 0.045);
      const hx = f.p0[0] + f.vel[0] * tt, hy = f.p0[1] + f.vel[1] * tt, hz = Math.max(0, f.p0[2] + f.vel[2] * tt - 0.5 * f.grav * tt * tt);
      const ln = f.obj.children[0], bead = f.obj.children[1];
      const ap = ln.geometry.attributes.position;
      ap.setXYZ(0, f.p0[0] + f.vel[0] * t2, f.p0[1] + f.vel[1] * t2, Math.max(0, f.p0[2] + f.vel[2] * t2 - 0.5 * f.grav * t2 * t2));
      ap.setXYZ(1, hx, hy, hz);
      ap.needsUpdate = true;
      bead.position.set(hx, hy, hz);
      bead.scale.setScalar(f.bsz * (1 - age * 0.55));   // the mote gutters as it cools
      ln.material.opacity = 0.95 * (1 - age);
      bead.material.opacity = 0.95 * (1 - age);
    }
  }
}
// CHARGE RING (2026-08-13, operator): a world-space energy ring at the rifle MUZZLE that appears while a
// charge weapon spins up — it CONVERGES (shrinks) and brightens as the charge fills, then BLINKS once
// fully charged (the "ready" tell). This is the in-world twin of the screen-space reticle charge SVG
// (__retCharge). One ring per entity, built lazily and shown only while that entity's active weapon is
// charging (so a semi-firing AI never shows one). Faces along the barrel aim, so it reads as an aperture
// glowing at the gun tip. Pure presentation — reads the live weapon's charge state, writes nothing.
const __chgRings = {};   // entity id -> { ring: Mesh }
const __chgUpZ = new THREE.Vector3(0, 0, 1);   // the torus's hole-axis (+Z), rotated onto the aim dir
const __chgDir = new THREE.Vector3();
function __updateChargeRings() {
  for (const e of __world.entities) {
    const w = e.weapon;
    let rec = __chgRings[e.id];
    if (!(w && w.charging === true)) { if (rec) rec.ring.visible = false; continue; }
    const sz = (w.fxScale != null ? w.fxScale : 3);
    const col = (w.fxColor != null ? w.fxColor : 0x66e0ff);
    // muzzle world point: the held rifle's weapon-tip locator when present, else the body muzzle offset.
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig, tr = e.transform;
    let mp;
    if (rf && rf.muzzle) { rf.muzzle.getWorldPosition(__muzzleV); mp = [__muzzleV.x, __muzzleV.y, __muzzleV.z]; }
    else { const mo = w.muzzleOffset || { f: sz, u: sz }, hf = Math.cos(tr.heading), hs = Math.sin(tr.heading);
      mp = [tr.pos[0] + hf * (mo.f || 0), tr.pos[1] + hs * (mo.f || 0), tr.pos[2] + (mo.u || 0)]; }
    if (!rec) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.raycast = function () {}; scene.add(ring);
      rec = __chgRings[e.id] = { ring };
    }
    rec.ring.material.color.set(col);
    rec.ring.visible = true;
    rec.ring.position.set(mp[0], mp[1], mp[2]);
    // face along the barrel aim (ring normal = the aim forward, same convention as the radar)
    const pp = tr.pitch || 0, cp = Math.cos(pp);
    rec.ring.quaternion.setFromUnitVectors(__chgUpZ, __chgDir.set(cp * Math.cos(tr.heading), cp * Math.sin(tr.heading), Math.sin(pp)));
    const frac = Math.max(0, Math.min(1, w.chargeFrac || 0));
    // small — a tight ring right at the muzzle TIP (operator 2026-08-13: "a lot smaller"). ~0.12·fxScale.
    const baseR = Math.max(0.35, sz * 0.12);
    if (w.chargeReady) {
      rec.ring.scale.setScalar(baseR);
      rec.ring.material.opacity = (Math.sin(__world.time * 22) > 0) ? 1.0 : 0.12;   // BLINK when charged
    } else {
      rec.ring.scale.setScalar(baseR * (1.4 - 0.4 * frac));   // converges as it fills (stays tight)
      rec.ring.material.opacity = 0.25 + 0.6 * frac;          // and brightens
    }
  }
}
// R14 projectile channel: MIRROR the in-flight rounds the engine integrates in __world.projectiles,
// and pop an expanding shell when the engine records a burst in __world.bursts. The engine owns all
// motion + hit adjudication (deterministic); this only reflects positions and spawns transient fx —
// a muzzle flash on a round's birth, a glowing round while it flies, an expanding shell on its burst.
const __projMeshes = {};    // projectile id -> { g } group tracking one live round
let __burstSeen = -1;       // highest burst seq drawn (the engine's monotonic burstSeq)
const __projUpY = new THREE.Vector3(0, 1, 0);   // the cone axis (apex +Y) rotated onto each round's velocity
const __projDir = new THREE.Vector3();
function __updateProjectiles() {
  const ps = __world.projectiles || [];
  const live = {};
  for (const p of ps) {
    live[p.id] = true;
    let rec = __projMeshes[p.id];
    if (!rec) {
      const col = p.fxColor != null ? p.fxColor : 0xffcc66, sz = p.fxScale != null ? p.fxScale : 3;
      // the round is a POINTED SHELL (a hot nose-cone, not a beachball): a long thin cone whose TIP
      // leads along the velocity, wrapped in a translucent glow cone. Oriented per-frame to its heading.
      const len = sz * 0.6, rad = sz * 0.12;
      const glow = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.9, len * 1.5, 12), __fxMat(col));
      const core = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 12), __fxMat(0xffffff));
      glow.raycast = function () {}; core.raycast = function () {};
      const g = new THREE.Group(); g.add(glow); g.add(core); scene.add(g);
      rec = __projMeshes[p.id] = { g: g };
      // muzzle flash at the launch point (own base + dim, decoupled from __fxSz)
      const mf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), __fxMat(col));
      mf.position.set(p.pos[0], p.pos[1], p.pos[2]); mf.raycast = function () {}; scene.add(mf);
      __fx.push({ obj: mf, born: __world.time, ttl: 0.1, kind: 'burst', base: sz * 0.4, dim: 0.9 });
    }
    rec.g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    // point the nose along the round's velocity (cone apex is +Y → rotate +Y onto the travel direction)
    if (p.vel) { const vl = Math.hypot(p.vel[0], p.vel[1], p.vel[2]); if (vl > 1e-4) rec.g.quaternion.setFromUnitVectors(__projUpY, __projDir.set(p.vel[0] / vl, p.vel[1] / vl, p.vel[2] / vl)); }
  }
  for (const id in __projMeshes) {   // drop rounds that burst/expired this frame
    if (live[id]) continue;
    const rec = __projMeshes[id];
    scene.remove(rec.g);
    rec.g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    delete __projMeshes[id];
  }
  const bs = __world.bursts || [];   // spawn an expanding shell for any burst not yet drawn
  for (const b of bs) {
    if (b.seq <= __burstSeen) continue;
    __burstSeen = b.seq;
    const col = b.fxColor != null ? b.fxColor : 0xffcc66;
    // the shell peaks at the TRUE splash reach (b.radius) — honest to the gameplay AoE — but stays
    // TRANSLUCENT (dim 0.5) so it reads as a fireball, not a screen-filling wash. A small, brighter
    // white flash marks the detonation point. A record may carry fxRadius (the DEATH BURST, R34.1):
    // the spectacle outsizes the shove — safe, because the stagger is adjudicated the frame the
    // record spawns, so the bigger shell never overstates a circle anyone could still dodge.
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), __fxMat(col));
    shell.position.set(b.pos[0], b.pos[1], b.pos[2]); shell.raycast = function () {}; scene.add(shell);
    __fx.push({ obj: shell, born: __world.time, ttl: 0.4, kind: 'burst', base: (b.fxRadius || b.radius || 0) * 0.9, dim: 0.5 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    flash.position.set(b.pos[0], b.pos[1], b.pos[2]); flash.raycast = function () {}; scene.add(flash);
    __fx.push({ obj: flash, born: __world.time, ttl: 0.16, kind: 'burst', base: (b.fxScale != null ? b.fxScale : 3) * 0.5, dim: 1 });
    // SUIT-DEATH fragment shower (operator 2026-08-13): a suit blows APART into many pieces flung out
    // and up, arcing down under gravity to rest on the ground — so the death reads as an explosion of
    // debris ahead of the smoke, not just one ball flash. Deterministic (golden-angle directions +
    // modulo speeds, no Math.random), so capture stays byte-identical. Only death bursts carry the flag.
    if (b.debris) {
      const N = 28, base = (b.fxScale != null ? b.fxScale : 6), col2 = b.fxColor != null ? b.fxColor : 0xffa03c;
      const positions = new Float32Array(N * 3), vels = [];
      for (let k = 0; k < N; k++) {
        const yy = 1 - (k + 0.5) / N * 1.6;                 // 1 .. -0.6 — mostly the upper hemisphere
        const rr = Math.sqrt(Math.max(0, 1 - yy * yy)), phi = k * 2.399963;   // golden-angle spiral
        const spd = base * (1.4 + ((k * 13) % 11) / 11 * 1.3);
        vels.push([Math.cos(phi) * rr * spd, Math.sin(phi) * rr * spd, yy * spd + base * 0.9]);   // outward + upward bias
        positions[k * 3] = b.pos[0]; positions[k * 3 + 1] = b.pos[1]; positions[k * 3 + 2] = b.pos[2];
      }
      const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const dmat = new THREE.PointsMaterial({ color: new THREE.Color(col2), size: Math.max(0.5, base * 0.16), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const pts = new THREE.Points(dgeo, dmat); pts.raycast = function () {}; scene.add(pts);
      __fx.push({ obj: pts, born: __world.time, ttl: 0.75, kind: 'debris', p0: b.pos.slice(), vels: vels, grav: base * 4.5 });
    }
  }
}
// melee CLASH sparks (melee-clash-fx): when a swing CONNECTS, the engine records a clash in
// __world.clashes (stepMelee stamps the contact point on the target's hull at blade height,
// seq-keyed like bursts). Edge-detect the seq and pop a spark shower: a small white core flash
// + a fan of short additive STREAKS thrown from the contact point, each flying an analytic
// ballistic arc (position re-derived from age every frame — no integration state, so a dropped
// frame never bends it) and fading over its ttl. Scatter is SEEDED per clash (mulberry32 over
// the seq — never Math.random, so a replay scatters identically), biased UP and BACK toward the
// attacker (c.dir) so the spray reads as the blade shearing off the armor. Colour/size ride the
// strike config's strikeFx via the record's fxColor/fxScale (null → the hot white-gold default).
let __clashSeen = -1;
function __clashRng(a) { a = a >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a spark is a glowing MOTE (an additive radial sprite — a 1px WebGL line alone vanishes at
// mecha scale) dragging a short line tail; the shared head texture is built once.
const __sparkTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
function __updateClashes() {
  const cs = __world.clashes || [];
  for (const c of cs) {
    if (c.seq <= __clashSeen) continue;
    __clashSeen = c.seq;
    const col = c.fxColor != null ? c.fxColor : 0xffd98c;
    const sz = c.fxScale != null ? c.fxScale : 3;
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    flash.position.set(c.pos[0], c.pos[1], c.pos[2]); flash.raycast = function () {}; scene.add(flash);
    __fx.push({ obj: flash, born: __world.time, ttl: 0.12, kind: 'burst', base: sz * 0.55, dim: 1 });
    const rnd = __clashRng(0x5eed ^ Math.imul(c.seq + 1, 2654435761));
    const baseA = c.dir ? Math.atan2(c.dir[1], c.dir[0]) : rnd() * 6.283;
    // 2026-07-28 impact pump: a denser default shower (26), and the record may pin its own
    // count (c.n — the CLASH-EVENT lock pushes 40 for the opening burst); no dir field means
    // the fan is a full seeded ring (the blade-lock case: sparks jet out all around the cross).
    const n = Math.min(48, Math.max(4, c.n != null ? c.n : 26));
    for (let i = 0; i < n; i++) {
      // azimuth fans ~±135° around the attacker-facing normal (wide enough to clear both
      // silhouettes); speed/lift/life vary per spark — fast, so the shower reads OUTSIDE the
      // duel gap instead of dying between the hulls. ~1 in 5 is a slow EMBER that hangs and
      // rains (longer ttl, harder gravity) — the impact's afterglow.
      const az = baseA + (rnd() - 0.5) * (c.dir ? 4.7 : 6.283);
      const ember = rnd() < 0.2;
      const sp = sz * (ember ? 3 + rnd() * 4 : 6 + rnd() * 11);
      const up = sp * (0.35 + rnd() * (ember ? 1.6 : 1.1));
      const hot = rnd() < 0.35 ? 0xffffff : col;
      const grp = new THREE.Group();
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2])]);
      const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(hot), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: __sparkTex, color: new THREE.Color(hot), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const bsz = sz * (0.24 + rnd() * 0.26);
      bead.scale.setScalar(bsz); bead.position.set(c.pos[0], c.pos[1], c.pos[2]);
      ln.raycast = function () {}; bead.raycast = function () {}; ln.frustumCulled = false; bead.frustumCulled = false;
      grp.add(ln); grp.add(bead); scene.add(grp);
      __fx.push({ obj: grp, born: __world.time, ttl: (ember ? 0.4 + rnd() * 0.35 : 0.26 + rnd() * 0.34), kind: 'spark', p0: c.pos.slice(), vel: [Math.cos(az) * sp, Math.sin(az) * sp, up], grav: sz * (ember ? 42 : 30), bsz: bsz });
    }
  }
}
// thruster jets: ease each rig's flame toward its entity's e.thrust (the platform
// rule flags it on boost) and scale/fade the nozzle cones — a flare-up on boost, a
// fade-out on release, with a per-jet flicker so the plume trembles.
const __jetZ = new THREE.Vector3(0, 0, 1);
const __jetQ = new THREE.Quaternion();
function __updateThrusters(dt) {
  for (const e of __world.entities) {
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig;
    if (!rf || !rf.jets) continue;
    const want = Math.max(0, Math.min(1, e.thrust || 0));
    rf.thrustAmt = (rf.thrustAmt || 0) + (want - (rf.thrustAmt || 0)) * Math.min(1, (dt || 0) * 16);
    const amt = rf.thrustAmt;
    // thrust VECTORING: the engine's e.thrustYaw is the dash direction as a body-frame yaw
    // (0 = forward, + = right); the BACKPACK jets swivel so the exhaust blows OPPOSITE the
    // dash (left dash → flames out to the right). Eased as a heading vector (cos/sin) so a
    // back dash (±π) never lerps the long way around; foot jets keep firing straight down.
    const ty = e.thrustYaw || 0;
    const k = Math.min(1, (dt || 0) * 10);
    rf.jetVX = (rf.jetVX == null ? 1 : rf.jetVX) + (Math.cos(ty) - (rf.jetVX == null ? 1 : rf.jetVX)) * k;
    rf.jetVY = (rf.jetVY || 0) + (Math.sin(ty) - (rf.jetVY || 0)) * k;
    const jyaw = Math.atan2(rf.jetVY, rf.jetVX);
    for (let i = 0; i < rf.jets.length; i++) {
      const j = rf.jets[i];
      if (amt < 0.02) { if (j.holder.visible) j.holder.visible = false; continue; }
      j.holder.visible = true;
      if (j.kind === 'backpack') {
        __jetQ.setFromAxisAngle(__jetZ, -jyaw);
        j.holder.quaternion.copy(__jetQ).multiply(j.baseQ);
      }
      const fl = 0.82 + 0.18 * Math.sin(__world.time * 46 + i * 1.7);
      j.holder.scale.set(0.65 + 0.35 * amt, amt * fl, 0.65 + 0.35 * amt);
      j.core.material.opacity = 0.7 * amt;
      j.inner.material.opacity = 0.9 * amt;
      // shards shimmer faster than the cones for a livelier energy read (render-only; sim untouched).
      if (j.shards) j.shards.material.opacity = 0.6 * amt * (0.65 + 0.35 * Math.sin(__world.time * 58 + i * 2.7));
    }
  }
}
for (const e of __world.entities) { const m = __makeBody(e); if (m) __bodies[e.id] = m; }
for (const e of __world.entities) __syncEntity(e);${shadowBlock}${smokeBlock}${hangarBlock}${gearBlock}
// ---- MATCH layer (mobile-suit-arena.plan.md M1b/M3): scoreboard + kill feed + result + game seam ----
// Built only when the world runs a match; matchless worlds emit the same bytes they always did
// (the block below is inert without __world.match). The scoreboard is the top-left kill tally per
// contender; the feed shows the last few kills; the result banner freezes over the tableau when a
// contender reaches killTarget, and — when a hosting game shell is present — the ONE outcome
// envelope leaves through window.__mojGame (emit + end), success iff the piloted suit won.
let __ms = null;
const __msName = (id) => (__world.match && __world.match.names && __world.match.names[id]) || id;
// TEAM read (arena-menu-reframe): a team battle colours the scoreboard + banner by faction so
// allies and enemies read at a glance. teamMode / teamNames / teamKills ride the engine match layer;
// absent (a duel or FFA) every team line below is a no-op and the HUD emits byte-identically.
const __msTeamName = (t) => (__world.match && __world.match.teamNames && __world.match.teamNames[t]) || (t ? String(t).toUpperCase() : '');
const __msMyTeam = () => ((__world.pilotId && __world.byId[__world.pilotId]) ? __world.byId[__world.pilotId].team : null);
function __msTeamColor(team) {
  const m = __world.match;
  if (!m || !m.teamMode || !team) return null;
  const teams = Object.keys(m.teamKills || {});
  const mine = __msMyTeam();
  if (mine) return team === mine ? '#7fe0a8' : ['#ff8f8f', '#ff9d6b', '#e6b3ff'][teams.filter((t) => t !== mine).indexOf(team) % 3];
  return ['#7fd4ff', '#ff9d6b', '#a8e6a1', '#e6b3ff'][teams.indexOf(team) % 4];   // spectate: no pilot seat, colour by team order
}
if (__world.match) {
  const __msWrap = document.createElement('div');
  __msWrap.style.cssText = 'position:absolute;left:16px;top:16px;min-width:150px;padding:8px 12px;border-radius:8px;background:rgba(8,14,22,0.42);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.22);pointer-events:none;z-index:9;font:600 12px system-ui,sans-serif;color:#cfe3ff';
  const __msTitle = document.createElement('div');
  __msTitle.textContent = __world.match.practice ? 'PRACTICE' : ('FIRST TO ' + __world.match.killTarget);
  __msTitle.style.cssText = 'font-size:9px;letter-spacing:.18em;color:#8fb4d8;margin-bottom:5px';
  __msWrap.appendChild(__msTitle);
  const __msTeams = document.createElement('div');   // TEAM tally line (BLUE n \\u00b7 RED n) — shown only in a team bout
  __msTeams.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.04em;margin-bottom:5px;display:none';
  __msWrap.appendChild(__msTeams);
  const __msRows = document.createElement('div');
  __msWrap.appendChild(__msRows);
  const __msFeed = document.createElement('div');
  __msFeed.style.cssText = 'margin-top:6px;font:500 10px system-ui,sans-serif;color:#9fb8d4;opacity:0.85';
  __msWrap.appendChild(__msFeed);
  wrap.appendChild(__msWrap);
  const __msBanner = document.createElement('div');
  __msBanner.style.cssText = 'position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);padding:16px 34px;border-radius:12px;background:rgba(10,16,26,0.88);box-shadow:0 0 0 1px rgba(140,210,255,0.35),0 6px 28px rgba(0,0,0,0.55);text-align:center;display:none;pointer-events:none;z-index:12;font:700 15px system-ui,sans-serif;color:#eaf4ff;letter-spacing:.06em';
  wrap.appendChild(__msBanner);
  __ms = { rows: __msRows, teams: __msTeams, feed: __msFeed, banner: __msBanner, rowEls: {}, sig: '', ended: false };
}
// FAULT CONTAINMENT: the match HUD + params seam are additive layers over the sim — an error in
// either reports ONCE and disables that layer (scoreboard goes dark / picks stay unapplied) while
// the world keeps stepping and rendering. A bug here must never freeze the page's step loop.
function __updateMatchHud() {
  if (__ms && __ms.dead) return;
  try { __updateMatchHudInner(); } catch (err) {
    if (__ms) __ms.dead = true;
    console.error('match HUD disabled after error:', err);
  }
}
function __updateMatchHudInner() {
  const m = __world.match;
  if (!m || !__ms) return;
  const ids = Object.keys(m.kills);
  const sig = ids.join(',');
  if (sig !== __ms.sig) {   // contender set changed (params despawned a seat) — rebuild the rows
    __ms.sig = sig; __ms.rowEls = {}; __ms.rows.textContent = '';
    for (let i = 0; i < ids.length; i++) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:14px;line-height:1.55';
      const nm = document.createElement('span'); nm.textContent = __msName(ids[i]);
      const ct = document.createElement('span');
      row.appendChild(nm); row.appendChild(ct); __ms.rows.appendChild(row);
      __ms.rowEls[ids[i]] = { nm: nm, ct: ct };
    }
  }
  // the HIGHLIGHTED contender: the pilot normally; the WATCHED fighter when spectating (Tab moves it).
  const __hi = __world.spectate ? ((__specWatchEnt() || {}).id) : __world.pilotId;
  for (let i = 0; i < ids.length; i++) {
    const r = __ms.rowEls[ids[i]];
    if (!r) continue;
    r.ct.textContent = String(m.kills[ids[i]]);
    const me = ids[i] === __hi;
    // TEAM bout: the row wears its faction colour (allies vs enemies); a duel/FFA keeps the
    // pilot-highlight read. The highlighted contender is emphasised with weight in either mode.
    const tc = m.teamMode ? __msTeamColor(__world.byId[ids[i]] && __world.byId[ids[i]].team) : null;
    const col = tc || (me ? '#7fd4ff' : '#cfe3ff');
    r.nm.style.color = col;
    r.nm.style.fontWeight = me ? '800' : '600';
    r.ct.style.color = m.teamMode ? col : (m.kills[ids[i]] >= m.killTarget ? '#ffd166' : (me ? '#7fd4ff' : '#cfe3ff'));
  }
  // TEAM tally line: each faction's kill total in its own colour (BLUE 3 \\u00b7 RED 2), live.
  if (m.teamMode && m.teamKills) {
    const tks = Object.keys(m.teamKills);
    let th = '';
    for (let i = 0; i < tks.length; i++) th += (th ? '<span style="color:#5f7690"> \\u00b7 </span>' : '') + '<span style="color:' + (__msTeamColor(tks[i]) || '#cfe3ff') + '">' + __msTeamName(tks[i]) + ' ' + m.teamKills[tks[i]] + '</span>';
    __ms.teams.innerHTML = th;
    __ms.teams.style.display = '';
  }
  const fl = m.feed.slice(-3);
  let ft = '';
  for (let i = 0; i < fl.length; i++) ft += (ft ? '\\n' : '') + __msName(fl[i].killer) + ' \\u2715 ' + __msName(fl[i].victim);
  __ms.feed.style.whiteSpace = 'pre';
  __ms.feed.textContent = ft;
  if (m.over && !__ms.ended) {
    __ms.ended = true;
    if (__world.spectate) {
      // NO pilot — the operator watched. A neutral banner (nobody "won" or "lost"); the spectate
      // level's contract declares no promote event, so no career is staked. end() closes the bout.
      // A team-battle spectate names the winning FACTION; a solo/FFA spectate names the pilot.
      const __wtxt = m.teamMode ? (__msTeamName(m.winnerTeam) + ' TEAM WINS') : (__msName(m.winner) + ' WINS');
      const __wcol = m.teamMode ? (__msTeamColor(m.winnerTeam) || '#7fe0a8') : '#7fe0a8';
      __ms.banner.innerHTML = '<div style="font-size:22px;letter-spacing:.12em;color:' + __wcol + '">' + __wtxt + '</div><div style="margin-top:6px;font:600 12px system-ui,sans-serif;color:#bcd2ea">takes the match \\u2014 ' + m.killTarget + ' kills</div>';
      __ms.banner.style.display = '';
      if (window.__mojGame) {
        try {
          const wids = Object.keys(m.kills), wrows = [];
          for (let i = 0; i < wids.length; i++) {
            const s = (m.stats && m.stats[wids[i]]) || {};
            wrows.push({ id: wids[i], name: __msName(wids[i]), team: (__world.byId[wids[i]] && __world.byId[wids[i]].team) || null, kills: m.kills[wids[i]] || 0,
              deaths: s.deaths || 0, dmg: Math.round(s.dmg || 0), shots: s.shots || 0, hits: s.hits || 0 });
          }
          wrows.sort(function (a, b) { return (b.kills - a.kills) || (a.deaths - b.deaths) || (b.dmg - a.dmg); });
          window.__mojGame.end('success', { spectated: true, winner: m.winner, winnerTeam: m.winnerTeam || null, teamNames: m.teamNames || null, rows: wrows });
        } catch (err) { console.error('match outcome', err); }
      }
      return;
    }
    // TEAM bout: win iff the pilot's own faction took it; the sub-line names the winning TEAM.
    const won = m.teamMode ? (m.winnerTeam != null && m.winnerTeam === __msMyTeam()) : (m.winner === __world.pilotId);
    const __sub = m.teamMode ? (__msTeamName(m.winnerTeam) + ' TEAM takes the match \\u2014 ' + m.killTarget + ' kills') : (__msName(m.winner) + ' takes the match \\u2014 ' + m.killTarget + ' kills');
    __ms.banner.innerHTML = '<div style="font-size:22px;letter-spacing:.12em;color:' + (won ? '#7fe0a8' : '#ff8f8f') + '">' + (won ? 'VICTORY' : 'DEFEAT') + '</div><div style="margin-top:6px;font:600 12px system-ui,sans-serif;color:#bcd2ea">' + __sub + '</div>';
    __ms.banner.style.display = '';
    if (window.__mojGame) {
      // the ONE outcome envelope, spoken in the store's typed-event vocabulary: a promote event
      // on whatever progression slice the level's contract declares (contract-driven — the match
      // layer never hardcodes slice names), then end(). Success iff the piloted suit won.
      try {
        const c = window.__mojGame.contract || {};
        const evs = (c.produces && c.produces.events) || [];
        for (let i = 0; i < evs.length; i++) {
          if (evs[i].type === 'promote') {
            window.__mojGame.emit({ type: 'promote', slice: evs[i].slice, ref: c.levelRef, result: won ? 'success' : 'fail' });
            break;
          }
        }
        // the SCORE-SCREEN payload: one row per contender (kills / deaths / hull damage /
        // rounds fired / rounds on target), ranked, riding the envelope beside the store events.
        const ids = Object.keys(m.kills);
        const rows = [];
        for (let i = 0; i < ids.length; i++) {
          const s = (m.stats && m.stats[ids[i]]) || {};
          rows.push({ id: ids[i], name: __msName(ids[i]), team: (__world.byId[ids[i]] && __world.byId[ids[i]].team) || null, kills: m.kills[ids[i]] || 0,
            deaths: s.deaths || 0, dmg: Math.round(s.dmg || 0), shots: s.shots || 0, hits: s.hits || 0 });
        }
        rows.sort(function (a, b) { return (b.kills - a.kills) || (a.deaths - b.deaths) || (b.dmg - a.dmg); });
        window.__mojGame.end(won ? 'success' : 'fail', { pilot: __world.pilotId, winnerTeam: m.teamMode ? (m.winnerTeam || null) : null, teamNames: m.teamMode ? (m.teamNames || null) : null, rows: rows });
      } catch (err) { console.error('match outcome', err); }
    }
  }
}
// ---- TUTORIAL objective HUD + terminal (tutorial-mode.plan.md T1): the director's face ----
// Built only when the world runs a tutorial script (state.tutorial — worlds without one emit the
// same inert function). The card (top-center) shows the active step's prompt + progress; when the
// script completes the banner freezes over the tableau and the ONE outcome envelope leaves through
// window.__mojGame — the same promote/end discipline as the match layer, the director being the
// terminal here (tutorial levels run no match). Fault-contained like the match HUD.
let __tut = null;
if (__world.tutorial) {
  const __tutWrap = document.createElement('div');
  __tutWrap.style.cssText = 'position:absolute;left:50%;top:16px;transform:translateX(-50%);max-width:520px;padding:9px 18px 10px;border-radius:10px;background:rgba(8,14,22,0.55);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.25);pointer-events:none;z-index:9;text-align:center';
  const __tutEyebrow = document.createElement('div');
  __tutEyebrow.style.cssText = 'font:700 9px system-ui,sans-serif;letter-spacing:.22em;color:#8fb4d8;margin-bottom:4px';
  const __tutPrompt = document.createElement('div');
  __tutPrompt.style.cssText = 'font:700 14px system-ui,sans-serif;letter-spacing:.05em;color:#eaf4ff;text-shadow:0 1px 3px rgba(0,0,0,.6)';
  const __tutProg = document.createElement('div');
  __tutProg.style.cssText = 'font:600 11px system-ui,sans-serif;color:#7fd4ff;margin-top:3px;display:none';
  __tutWrap.appendChild(__tutEyebrow); __tutWrap.appendChild(__tutPrompt); __tutWrap.appendChild(__tutProg);
  wrap.appendChild(__tutWrap);
  const __tutBanner = document.createElement('div');
  __tutBanner.style.cssText = 'position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);padding:16px 34px;border-radius:12px;background:rgba(10,16,26,0.88);box-shadow:0 0 0 1px rgba(140,210,255,0.35),0 6px 28px rgba(0,0,0,0.55);text-align:center;display:none;pointer-events:none;z-index:12;font:700 15px system-ui,sans-serif;color:#eaf4ff;letter-spacing:.06em';
  wrap.appendChild(__tutBanner);
  __tut = { wrap: __tutWrap, eyebrow: __tutEyebrow, prompt: __tutPrompt, prog: __tutProg, banner: __tutBanner, ended: false, dead: false };
}
function __updateTutorialHud() {
  if (!__tut || __tut.dead) return;
  try { __updateTutorialHudInner(); } catch (err) {
    __tut.dead = true;
    console.error('tutorial HUD disabled after error:', err);
  }
}
function __updateTutorialHudInner() {
  const T = __world.tutorial;
  if (!T || T.dead) { if (__tut) __tut.wrap.style.display = 'none'; return; }
  if (T.over) {
    if (__tut.ended) return;
    __tut.ended = true;
    __tut.wrap.style.display = 'none';
    const won = T.result === 'success';
    __tut.banner.innerHTML = '<div style="font-size:22px;letter-spacing:.12em;color:' + (won ? '#7fe0a8' : '#ff8f8f') + '">' + (won ? 'TUTORIAL COMPLETE' : 'SUIT LOST') + '</div><div style="margin-top:6px;font:600 12px system-ui,sans-serif;color:#bcd2ea">' + (won ? T.steps.length + ' objectives cleared' : 'restart the level to try again') + '</div>';
    __tut.banner.style.display = '';
    if (window.__mojGame) {
      try {
        const c = window.__mojGame.contract || {};
        const evs = (c.produces && c.produces.events) || [];
        for (let i = 0; i < evs.length; i++) {
          if (evs[i].type === 'promote') {
            window.__mojGame.emit({ type: 'promote', slice: evs[i].slice, ref: c.levelRef, result: won ? 'success' : 'fail' });
            break;
          }
        }
        window.__mojGame.end(won ? 'success' : 'fail', { pilot: __world.pilotId, tutorial: { steps: T.steps.length, cleared: won ? T.steps.length : T.idx } });
      } catch (err) { console.error('tutorial outcome', err); }
    }
    return;
  }
  const s = T.steps[T.idx];
  if (!s) { __tut.wrap.style.display = 'none'; return; }
  __tut.wrap.style.display = '';
  __tut.eyebrow.textContent = 'TUTORIAL \\u00b7 ' + (T.idx + 1) + ' / ' + T.steps.length;
  __tut.prompt.textContent = s.prompt;
  // the advance flash: a brief bright ring when a step clears, so progress is felt without reading.
  const fresh = T.flash >= 0 && (__world.time - T.flash) < 0.6;
  __tut.wrap.style.boxShadow = fresh ? 'inset 0 0 0 2px rgba(127,224,168,0.85)' : 'inset 0 0 0 1px rgba(120,200,255,0.25)';
  if (s.goal.count > 1) {
    __tut.prog.style.display = '';
    __tut.prog.textContent = Math.min(Math.floor(T.count), Math.ceil(s.goal.count)) + ' / ' + Math.ceil(s.goal.count);
  } else __tut.prog.style.display = 'none';
}
// game-params seam (arena M3): a hosting shell's launcher picks arrive as __mojGame params —
// the chosen suit takes the pilot seat (other seat:'player' options despawn), and only the
// picked seat:'opponent' entities stay in the arena. Standalone opens fall back to the level's
// presets.default (the game channel already does that), so /world stays playable.
function __msDespawn(id) {
  const e = __world.byId[id];
  if (!e) return;
  const i = __world.entities.indexOf(e);
  if (i >= 0) __world.entities.splice(i, 1);
  delete __world.byId[id];
  if (__world.match && __world.match.kills) delete __world.match.kills[id];
  if (__world.match && __world.match.stats) delete __world.match.stats[id];
  const b = __bodies[id];
  if (b) { scene.remove(b); delete __bodies[id]; }
}
function __applyMatchParams(params) {
  if (__world.spectate) {
    // SPECTATE PICKS (2026-08-09): the level authors every candidate seat:'ai' fighter; the shell's
    // watch picks name who fights and the unpicked cast leaves before the bout. Only roster slices
    // are read — no pilot, difficulty or livery here (an all-AI show is never detuned). An absent or
    // empty pick keeps the whole cast, so a pickless watch level plays exactly as before.
    if (!params || typeof params !== 'object') return;
    const keep = {};
    let anyPicked = false;
    for (const k in params) {
      const v = params[k];
      const ids = v && typeof v === 'object' && v.roster && typeof v.roster === 'object' ? Object.keys(v.roster) : null;
      if (ids && ids.length) { anyPicked = true; for (let i = 0; i < ids.length; i++) keep[ids[i]] = true; }
    }
    if (!anyPicked) return;
    for (let i = __world.entities.length - 1; i >= 0; i--) {
      const e = __world.entities[i];
      if (e.seat === 'ai' && !keep[e.id]) __msDespawn(e.id);
    }
    return;
  }
  if (!params || typeof params !== 'object') return;
  // DIFFICULTY (arena difficulty select): the shell's pick rides beside the slice params as a
  // plain string naming an engine tuning tier ('easy' | 'medium' | 'max'); unknown or absent →
  // null = the max brain. Spectate returned above — an all-AI show is never detuned.
  if (typeof params.difficulty === 'string' && __CW.AI_DIFFICULTY) __world.aiTuning = __CW.AI_DIFFICULTY[params.difficulty] || null;
  const idOf = (v) => (v && typeof v === 'object' ? (v.id || v.name || '') : String(v == null ? '' : v));
  // the game shell passes a picked party slice as { roster: { <id>: {...} } } — the ids are the keys.
  const rosterIds = (v) => (v && typeof v === 'object' && v.roster && typeof v.roster === 'object' ? Object.keys(v.roster) : null);
  const want = params.pilot != null ? idOf(params.pilot)
    : ((rosterIds(params.suits) || [])[0]
      || (Array.isArray(params.roster) && params.roster.length ? idOf(params.roster[0]) : null));
  if (want && __world.byId[want] && __world.byId[want].pilotable && __world.pilotId !== want) {
    const cur = __world.byId[__world.pilotId];
    if (cur) { cur.rule = cur.ambientRule; cur.moving = false; }
    const nxt = __world.byId[want];
    nxt.rule = nxt.pilotRule;
    __world.pilotId = want;
    if (__world.camera && __world.camera.rule && cur && __world.camera.rule.target === cur.id) __world.camera.rule.target = want;
  }
  // LIVERY (livery-ingame.plan.md): the shell carries the picked wear on the roster entry
  // (roster[<id>].livery). Paint the piloted suit by swapping its figure + loadout figures to the
  // chosen livery's pre-built variant; the sync reveals it and __applyWeaponShow re-applies the weapon.
  const __pilotE = __world.byId[__world.pilotId];
  if (__pilotE && Array.isArray(__pilotE.liveries)) {
    let __wear = null;
    for (const k in params) { const r = params[k] && params[k].roster; if (r && r[__world.pilotId] && r[__world.pilotId].livery) { __wear = r[__world.pilotId].livery; break; } }
    const __lv = __wear && __pilotE.liveries.find((l) => l.id === __wear);
    if (__lv && __lv.figure) {
      __pilotE.body.figure = __lv.figure;
      for (const slot of ((__pilotE.rule && __pilotE.rule.loadout) || [])) slot.figure = __lv.figure;
      for (const slot of ((__pilotE.pilotRule && __pilotE.pilotRule.loadout) || [])) slot.figure = __lv.figure;
    }
  }
  for (let i = __world.entities.length - 1; i >= 0; i--) {   // unpicked PLAYER options leave the arena
    const e = __world.entities[i];
    if (e.seat === 'player' && e.id !== __world.pilotId) __msDespawn(e.id);
  }
  // COMBATANT seats (opponent / enemy / ally): keep the picked ids drawn from EVERY non-pilot party
  // slice the shell passed (opponents for FFA, duel_enemy for a solo pick, team_allies + team_foes for
  // a team bout), despawn the rest. Generalises the old opponents-only despawn — a mode declares its
  // own combatant slices and this seam honours them all without hardcoding names. seat:'player' is the
  // pilot slice (handled above); seat:'ai' is a spectate cast (handled by the spectate branch above).
  const __combatantSeat = { opponent: 1, enemy: 1, ally: 1 };
  const keep = {};
  let anyPicked = false;
  if (Array.isArray(params.seats)) { anyPicked = true; for (let i = 0; i < params.seats.length; i++) keep[idOf(params.seats[i])] = true; }
  for (const k in params) {
    if (k === 'suits' || k === 'pilot' || k === 'seats') continue;
    const ids = rosterIds(params[k]) || (Array.isArray(params[k]) ? params[k].map(idOf) : null);
    if (ids) { anyPicked = true; for (let i = 0; i < ids.length; i++) keep[ids[i]] = true; }
  }
  if (anyPicked) {
    for (let i = __world.entities.length - 1; i >= 0; i--) {
      const e = __world.entities[i];
      if (__combatantSeat[e.seat] && !keep[e.id]) __msDespawn(e.id);
    }
  }
}
// the game channel block is emitted AFTER this one, so the hook is lazy: the first step (live rAF
// or capture tick) finds __mojGame and registers; onStart replays immediately if params already
// arrived (the standalone presets.default fallback starts synchronously at page load).
let __msParamsHooked = false;
function __msHookParams() {
  if (__msParamsHooked || !window.__mojGame) return;
  __msParamsHooked = true;
  window.__mojGame.onStart(function (p) {
    try { __applyMatchParams(p); } catch (err) { console.error('match params not applied:', err); }
  });
}
if (__ctrlOwnsCamera) __driveCamera();
${breakables ? `// breakability: a block that broke (the runtime's state.breaks) leaves the scene: its render group (break:<id>) hides,
// a flash and a ring cover the swap, and its pre-cut pieces (playscape/destruct/breakability.js piecesOf: the cut of
// how it broke) take its place, parting the cut's way (impact bursts from the blow, a blade slips the halves apart,
// anime holds the beat first), falling, tumbling and settling on the floor it stood on, then sinking away. Seeded by
// the break's seq and stepped on sim dt, so a capture stays byte-identical.
const __breakPieces = ${safeJson(breakPieces || {})};
const __pieces = [];
let __breaksSeen = 0;
const __PART = { impact: { speed: 3.2, up: 2.2, blow: 1.6, hold: 0 }, blade: { speed: 0.9, up: 0.6, blow: 0.9, hold: 0.06 }, laser: { speed: 0.3, up: 0.2, blow: 0.2, hold: 0.25 }, anime: { speed: 1.2, up: 0.5, blow: 0.7, hold: 0.42 } };
const __pieceLight = [0.35, -0.55, 0.76];
function __spawnBreak(br) {
  const blk = (__world.breakables || []).find((q) => q.id === br.id);
  const ext = blk ? Math.max(blk.max[0] - blk.min[0], blk.max[1] - blk.min[1], blk.max[2] - blk.min[2]) : 1;
  const floor = blk ? blk.min[2] : 0;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
  flash.position.set(br.at[0], br.at[1], br.at[2]); flash.raycast = function () {}; scene.add(flash);
  __fx.push({ obj: flash, born: __world.time, ttl: 0.16, kind: 'burst', base: ext * 0.7, dim: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 24), __fxMat(0xffe2b0));
  ring.position.set(br.at[0], br.at[1], floor + 0.05); ring.raycast = function () {}; scene.add(ring);
  __fx.push({ obj: ring, born: __world.time, ttl: 0.3, kind: 'shock', base: ext * 0.8 });
  const show = __breakPieces[br.id], set = show && show.pieces[show.cuts[br.how] || 'chip'];
  if (!set) return;
  const by = br.by && __world.entities.find((e) => e.id === br.by);
  let bx = 0, byy = 0;
  if (by) { bx = br.at[0] - by.transform.pos[0]; byy = br.at[1] - by.transform.pos[1]; const l = Math.hypot(bx, byy) || 1; bx /= l; byy /= l; }
  const P = __PART[set.style] || __PART.impact, rnd = __clashRng(0xb4ea ^ Math.imul(br.seq + 1, 2654435761));
  // a textured thing breaks into its own texture (box-projected, about a repeat per 1.2 units, the inside shaded
  // darker); an untextured one into its colour
  const own = meshes['break:' + br.id], tm = own && own.userData.tex && own.userData.tex[0], map = tm && tm.material.map;
  const skin = new THREE.Color(show.fill).multiplyScalar(show.tex && !map ? 0.72 : 1), inside = skin.clone().multiplyScalar(0.62);
  for (const k of set.chunks) {
    const pos = [], col = [], uv = [];
    let lo = 0, r = 0;
    for (const f of k.faces) {
      const a = f.pts[0], b = f.pts[1], c = f.pts[2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1;
      const lit = (map ? 0.95 : 0.55) + (map ? 0.3 : 0.45) * Math.max(0, (nx * __pieceLight[0] + ny * __pieceLight[1] + nz * __pieceLight[2]) / nl);   // a texture is lit already
      const base = f.cut ? inside : skin;
      const ax = Math.abs(nx) >= Math.abs(ny) && Math.abs(nx) >= Math.abs(nz) ? 0 : Math.abs(ny) >= Math.abs(nz) ? 1 : 2, ua = ax === 0 ? 1 : 0, va = ax === 2 ? 1 : 2;
      for (let i = 1; i < f.pts.length - 1; i++) for (const p of [f.pts[0], f.pts[i], f.pts[i + 1]]) { pos.push(p[0], p[1], p[2]); col.push(base.r * lit, base.g * lit, base.b * lit); uv.push((p[ua] + k.at[ua]) / 1.2, (p[va] + k.at[va]) / 1.2); }
      for (const p of f.pts) { lo = Math.max(lo, -p[2]); r = Math.max(r, Math.hypot(p[0], p[1])); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (map) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(map ? { map } : {}) }));
    m.position.set(k.at[0], k.at[1], k.at[2]); m.raycast = function () {}; scene.add(m);
    let ox = k.at[0] - br.at[0], oy = k.at[1] - br.at[1], oz = k.at[2] - br.at[2]; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
    const sp = P.speed * (0.7 + 0.6 * rnd());
    __pieces.push({ m, born: __world.time, hold: P.hold, rest: floor + lo, r: r * 0.6,
      v: [ox * sp + bx * P.blow, oy * sp + byy * P.blow, Math.max(0, oz) * sp + P.up * (0.6 + 0.8 * rnd())],
      w: [(rnd() - 0.5) * 9 * P.speed / 3.2, (rnd() - 0.5) * 9 * P.speed / 3.2, (rnd() - 0.5) * 4], settled: false });
  }
}
function __pieceBlocked(x, y, z, r) {
  for (const c of (__world.colliders || [])) if (x > c.min[0] - r && x < c.max[0] + r && y > c.min[1] - r && y < c.max[1] + r && z > c.min[2] && z < c.max[2]) return true;
  return false;
}
function __updateBreaks(dt) {
  const B = __world.breaks || [];
  for (; __breaksSeen < B.length; __breaksSeen++) {
    const br = B[__breaksSeen], m = meshes['break:' + br.id];
    if (m) { m.visible = false; for (const tm of (m.userData.tex || [])) tm.visible = false; }
    if (br.how !== 'restore') __spawnBreak(br);   // a restored break (an aftermath carried in) is simply gone
  }
  for (let i = __pieces.length - 1; i >= 0; i--) {
    const q = __pieces[i], age = __world.time - q.born;
    if (age > 4) { scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); __pieces.splice(i, 1); continue; }
    if (age < q.hold) continue;   // the cut is drawn before anything parts
    if (age > 3.2) { q.m.position.z -= dt * 0.25; continue; }   // sink away through the floor
    if (q.settled) continue;
    q.v[2] -= 9.8 * dt;
    // the walls hold them: each horizontal step that would put a piece inside a collider bounces back off it instead
    const x1 = q.m.position.x + q.v[0] * dt, y1 = q.m.position.y + q.v[1] * dt, z = q.m.position.z;
    if (__pieceBlocked(x1, q.m.position.y, z, q.r)) q.v[0] *= -0.3; else q.m.position.x = x1;
    if (__pieceBlocked(q.m.position.x, y1, z, q.r)) q.v[1] *= -0.3; else q.m.position.y = y1;
    q.m.position.z += q.v[2] * dt;
    q.m.rotation.x += q.w[0] * dt; q.m.rotation.y += q.w[1] * dt; q.m.rotation.z += q.w[2] * dt;
    if (q.m.position.z <= q.rest && q.v[2] < 0) {   // land: bounce a little, drag along the floor, stop when slow
      q.m.position.z = q.rest; q.v[2] *= -0.25; q.v[0] *= 0.55; q.v[1] *= 0.55; q.w[0] *= 0.5; q.w[1] *= 0.5; q.w[2] *= 0.5;
      if (Math.abs(q.v[2]) < 0.4 && Math.hypot(q.v[0], q.v[1]) < 0.3) q.settled = true;
    }
  }
}
` : ''}${runner ? runnerViewScript(runner) : ''}${focusHook}stepControllable = (dt, inputOverride) => {
${hangarHook}  __msHookParams();
  if (dt > 0 && !window.__mojFreeze) {   // a menu up freezes the world (interact-channel)
    ${commanderStep}__CW.stepWorld(__world, inputOverride || ${seats ? '__withSeats(__readInput())' : '__readInput()'}, dt, { ground: __ground${driveSurface ? ', surface: __surface' : ''} });
    for (const e of __world.entities) __syncEntity(e, dt);${seats ? `
    __seatRings();
    __seatStrip();
    __seatsOver();` : ''}
    __updateFx();
    __updateChargeRings();
    __updateProjectiles();
    __updateClashes();
    __updateThrusters(dt);${figHasJuice ? `
    __updateRacerJuice(dt);` : ''}${shadowHook}${smokeHook}${gearHook}${breakables ? `
    __updateBreaks(dt);` : ''}${runner ? `
    __updateRunner(dt);` : ''}
  }
  if (__ctrlOwnsCamera) __driveCamera(dt);
  __updateWepHud();   // after the camera is positioned, so the reticle projects onto the current frame
  __updateBoostHud();
  __updateRadar();${lock ? '\n  __updateLock();' : ''}
  __updateHpHud();
  __updateEnemyHp();
  __updateMatchHud();
  __updateTutorialHud();
};
window.__mojCtrl = { world: __world,${exposeBodies ? ' bodies: __bodies,' : ''}${breakables ? ' restore: (id) => __CW.restoreBlock(__world, id),' : ''} step: (dt, input) => stepControllable(dt, input), cast: (ops) => __CW.castOps(__world, ops), facts: (prev) => __CW.castFacts(__world, prev), interacts: () => __interactN, label: (id) => { const f = __padOn && __padSeen && __usePad ? 'gamepad' : 'keyboard', c = (__BIND.bind[f][id] || [])[0]; return c ? __CTL.label(__DEV, f, c, __padLayout) : ''; } };`;
}
