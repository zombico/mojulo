import { b64, safeJson } from '../../emit-util.js';
import { buildControllable } from '../../../worlds/controllable-world.js';
import { MSG_GAMEPAD as GAME_MSG_GAMEPAD, MSG_AI as GAME_MSG_AI } from '../../../game/level-contract.js';
import { hangarStepperBlock } from './hangar-menu.js';
import { projectileSmokeBlock } from './projectile-smoke.js';
import { suitShadowBlock } from './suit-shadows.js';

// In-page script: the CONTROLLABLE channel — the unified "control a thing in a world" primitive
// (controllable-world.plan.md). One model (entities = transform + rule + body; the camera is an
// entity), one input snapshot, one per-frame step — superseding the bespoke walk/over-shoulder/orbit
// controllers. The model is the SAME code as the node module controllable-world.js, emitted via
// buildControllable.toString() (single source of truth). When a camera entity is present it OWNS the
// camera (OrbitControls disabled), driven from the camera entity's transform each frame.
//
// Bodies (Phase 3): `mesh` (sphere/box, optional front marker so heading reads) and `none`. Input is
// mapped once here from keys/pointer to the normalized axes the pure rules consume. The `ground` hook
// raycasts the scene so `walk` entities follow terrain; `window.__mojCtrl` is exposed for headless
// verification (it can push input frames).

export function controllableChannelScript(entities, camera, figures, { exposeBodies = false, pilot = null, spectate = null, ai = null, colliders = null, hangar = null, match = null, shadows = null, smoke = null, wreckExplodes = null, key = null } = {}) {
  // per-vertex specular (material-response): inject the aSpec wiring into the rig-figure
  // builder ONLY when some packed figure carries a spec buffer (a material-finished suit).
  // Absent → the emitted controllable channel is byte-identical (the char-net pin holds),
  // matching how specularChannelScript itself is gated in scene-three.js.
  const figHasSpec = Object.values(figures || {}).some((f) => f && f.rig
    && Array.isArray(f.parts) && f.parts.some((p) => p && p.spec));
  const rigSpecHook = figHasSpec
    ? `\n    if (part.spec && typeof __specPatch === 'function') { geo.setAttribute('aSpec', new THREE.BufferAttribute(decodeF32(part.spec), 2)); __specPatch(mesh); }`
    : '';
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
  const cast = !!(sh && typeof shadows === 'object' && shadows.cast);
  const shadowBlock = cast ? '' : sh ? suitShadowBlock(sh) : '';
  const shadowHook = cast
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
  return `
const __CW = (${buildControllable.toString()})();
const __world = __CW.createWorld({ entities: ${safeJson(entities)}, camera: ${safeJson(camera)}, pilot: ${safeJson(pilot)}${spectate ? ', spectate: true' : ''}, ai: ${safeJson(ai)}, colliders: ${safeJson(colliders)}, match: ${safeJson(match)}${wreckExplodes ? `, wreckExplodes: ${safeJson(wreckExplodes)}` : ''} });
const __FIG = ${safeJson(figures || {})};   // name → packed baked figure frames (pos/col b64, origin, invScale, foot)
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
}
// build one figure-rig group (rigid parts, one mesh per bone) for a baked fig — shared by the
// single-figure body below and the loadout variant builder (weapon switching).
function __makeRigGroup(fig, b) {
  const group = new THREE.Group();
  const boneMeshes = fig.bones.map((bn, bi) => {
    const part = fig.parts[bi];
    if (!part) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));
    // rig-part colour is packed as normalized uint8 (rig-bake b64u8, 4× smaller than float32) →
    // read it back as a NORMALIZED uint8 attribute so the GPU dequantizes ÷255 to the same [0,1].
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${rigSpecHook}${castHook}
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;   // matrices mutate per frame
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
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
  }
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
function __syncRigEntity(e, m, rig, dt) {
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
    m.rotation.set(0, 0, yawA);
  }
  const fig = rig.fig;
  const mode = e.moving ? e.locomotion : 'idle';
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
  for (let bi = 0; bi < fig.bones.length; bi++) {
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
    // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
    const rh = fig.bones[bi].head;
    __rigH.set(rh[0], rh[1], rh[2]).applyQuaternion(__rigQA);
    __rigV.set(__rigPA[0] - __rigH.x, __rigPA[1] - __rigH.y, __rigPA[2] - __rigH.z);
    mesh.matrix.compose(__rigV, __rigQA, __RIG_ONE);
  }
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
  if (!m.visible && !m.userData.hangarHidden) m.visible = true;
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
    m.rotation.set(0, 0, e.transform.heading);   // yaw about +Z (z-up)
  }
}
// WALL PULL-IN (camera-tuning.plan.md): a chase cam behind a wall-backed suit ends up INSIDE the
// wall, filling the screen. Cast from the framed subject (lookAt, ~suit chest) toward the eased eye
// and, if a WORLD surface blocks the view, clamp the rendered eye to just in front of it so the suit
// stays visible. View-only (never touches sim state); mirrors __ground's mesh-only / skip-own-body
// filter, so it collides on level geometry but never on suit bodies.
const __camRay = new THREE.Raycaster();
let __camCd = 1;   // current eye distance as a fraction of the full follow distance (1 = no pull-in)
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
      const skin = 3;   // stand-off so the near plane never poked through the blocking wall
      const target = Math.max(0.15, Math.min(1, (hitD - skin) / full));
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
}
// ground hook: nearest scene surface straight below (excluding entity bodies), for walk entities.
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
// input: keys → normalized axes, mouse → look deltas (consumed each frame).
const __held = {};
window.addEventListener('keydown', (e) => { __held[e.code] = true; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
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
  __canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && document.pointerLockElement === __canvas) __fireDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) __fireDown = false; });
} else {
  // default: hold-to-look drag (walk / glide / orbit worlds keep the cursor visible).
  __canvas.addEventListener('pointerdown', () => { __drag = true; });
  window.addEventListener('pointerup', () => { __drag = false; });
  __canvas.addEventListener('pointermove', (e) => { if (__drag) { __lookDX += e.movementX || 0; __lookDY += e.movementY || 0; } });
}
const __ax = (a, b) => (__held[a] ? 1 : 0) - (__held[b] ? 1 : 0);
// gamepad (standard-mapping): polled once per input read and MERGED into the same normalized
// snapshot the keyboard/mouse build — the engine never learns which device spoke. Keyboard wins
// an axis it is actively pressing; pad buttons OR into the shared held/edge chains so dodge
// double-tap (LT), semi-auto fire and every press-edge action reuse the one __prev* discipline.
// Mapping: left stick = move (strafe in look worlds, turn otherwise) · right stick = look/aim ·
// RT fire · LT boost (double-tap = dodge) · A jump-ascend · B/LB kneel-descend · Y (PS △) tackle ·
// D-pad ↑ switch suit · select = AI toggle. RB is the WEAPON button: a quick tap cycles, a HOLD
// raises the selector overlay, and face buttons chord while it is down — RB+X (PS □) = the main
// ranged weapon, RB+Y (PS △) = the main melee, RB+B/A = the remaining slots in shelf order (a
// chord suppresses the face button's solo action). Start is the SHELL's (pause) — the world
// ignores it. Prefs arrive over the game-gamepad sidecar; a shell-less world plays the defaults.
let __padOn = true, __padIdx = -1, __padSeen = false;
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
let __wcPrevRB = false, __wcDownT = 0, __wcChorded = false, __wcOpen = false, __wcPrevFace = 0, __wcEl = null, __wcSony = false, __wcCur = -1;
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
  const gl = __wcSony ? { 0: '\\u2715', 1: '\\u25EF', 2: '\\u25A1', 3: '\\u25B3' } : { 0: 'A', 1: 'B', 2: 'X', 3: 'Y' };
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
function __pollPad() {
  if (!__padOn || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  let g = (__padIdx >= 0 && pads[__padIdx] && pads[__padIdx].connected) ? pads[__padIdx] : null;
  if (!g) { for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; __padIdx = i; break; } }
  if (!g) { __wcHide(); __wcPrevRB = false; return null; }
  __padSeen = true;
  // 'Wireless Controller' alone is the DualShock id; Xbox pads say 'Xbox Wireless Controller' —
  // the ambiguous term only reads Sony when the Xbox marks are absent.
  __wcSony = /054c|sony|dual\\s?shock|dual\\s?sense/i.test(g.id || '') || (/wireless controller/i.test(g.id || '') && !/xbox|045e/i.test(g.id || ''));
  const b = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const [mx, my] = __padStick(g.axes[0] || 0, g.axes[1] || 0);
  const [lx, ly] = __padStick(g.axes[2] || 0, g.axes[3] || 0);
  // RB state machine: press starts the tap/hold clock; the hold raises the selector; face-button
  // press EDGES while RB is down chord a slot (and mark the press so release doesn't also cycle);
  // a chordless release inside the tap window is the cycle.
  const rb = b(5);
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
    fire: b(7), boost: b(6),
    tackle: b(3) && !rb,                       // Y / PS triangle (operator, 2026-08-03) — silent inside an RB chord
    kneel: b(4) || (b(1) && !rb),              // LB or B / PS circle — descend in space, kneel on ground
    jump: b(0) && !rb,                         // A / PS cross — ascend in space
    cycle, slot,                               // RB tap / RB chord (the selector)
    swap: b(12), ai: b(8),                     // D-pad up = switch suit · select = AI toggle
  };
}
let __prevJump = false;             // for the jump PRESS edge (platform rule) vs held (variable height)
let __prevCycle = false, __prevSlot = 0;   // weapon-cycling press edges (R / 1-5)
let __prevSwap = false;                    // suit-switcher press edge (T)
let __prevTackle = false;                  // tackle press edge (Shift) — platform rule, opt-in r.tackle
let __prevAi = false;                      // AI-attack toggle press edge (G / HUD button)
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
  const __pad = __pollPad();   // null when no controller (or prefs turned it off)
  const sp = !!__held['Space'] || !!(__pad && __pad.jump);
  const jump = sp && !__prevJump ? 1 : 0;   // rising edge: a discrete press, not a held axis
  __prevJump = sp;
  // weapon cycling (platform rule, opt-in loadout): R press edge cycles, digit press edge selects
  const cy = !!__held['KeyR'] || !!(__pad && __pad.cycle);
  const cycle = cy && !__prevCycle ? 1 : 0;
  __prevCycle = cy;
  let slotNow = (__pad && __pad.slot) || 0;
  for (let d = 1; d <= 5; d++) if (__held['Digit' + d]) { slotNow = d; break; }
  const slot = slotNow && slotNow !== __prevSlot ? slotNow : 0;
  __prevSlot = slotNow;
  // suit switcher (pilotable entities): T press edge transfers the pilot
  const sw = !!__held['KeyT'] || !!(__pad && __pad.swap);
  const swap = sw && !__prevSwap ? 1 : 0;
  __prevSwap = sw;
  // TACKLE (platform rule, opt-in r.tackle): Shift press edge fires the invincible offensive dash.
  // A press EDGE (not held) — one tackle per key-down, like the suit-switcher / jump edges.
  const tk = !!(__held['ShiftLeft'] || __held['ShiftRight']) || !!(__pad && __pad.tackle);
  const tackle = tk && !__prevTackle ? 1 : 0;
  __prevTackle = tk;
  // AI attack toggle (worlds with ai ambients): G press edge OR the HUD button OR the shell's
  // requested state (pause-menu switch — inject edges until aiEnabled converges), one shared edge
  const __aiCur = __world.aiEnabled !== false;
  if (__aiWant != null && __aiWant === __aiCur) __aiWant = null;   // converged — stand down
  const ai = !!__held['KeyG'] || __aiBtnPress || !!(__pad && __pad.ai) || (__aiWant != null && __aiWant !== __aiCur);
  const aiToggle = ai && !__prevAi ? 1 : 0;
  __prevAi = ai;
  __aiBtnPress = false;
  // pad right stick → the SAME look accumulators the mouse feeds, per-frame at lookScale px
  // equivalents; signs follow each mouse branch's convention (mouselook negates so stick-right
  // looks right, drag worlds keep the drag sign). Stick look never needs pointer capture — a
  // match is fully playable without a single mouse click.
  if (__pad && (__pad.lookX || __pad.lookY)) {
    const __ps = __padCfg.lookScale, __py = __padCfg.invertY ? -1 : 1;
    if (__MOUSELOOK) { __lookDX -= __pad.lookX * __ps; __lookDY -= __pad.lookY * __ps * __py; }
    else { __lookDX += __pad.lookX * __ps; __lookDY += __pad.lookY * __ps * __py; }
  }
  // keyboard wins an axis it is actively pressing; otherwise the pad's analog float flows
  // through (the rules multiply by accel/speed, so magnitude = walk-to-run travel).
  const __pmx = __pad ? __pad.moveX : 0, __pmy = __pad ? __pad.moveY : 0;
  const inp = {
    forward: __ax('KeyW', 'KeyS') || __ax('ArrowUp', 'ArrowDown') || __pmy,
    // look worlds steer with the stick/mouse — left stick X strafes (matching how A/D fold
    // into sideIn there); tank-turn worlds keep left stick X as the turn axis.
    turn: __ax('KeyD', 'KeyA') || __ax('ArrowRight', 'ArrowLeft') || (__MOUSELOOK ? 0 : __pmx),
    strafe: __ax('KeyE', 'KeyQ') || (__MOUSELOOK ? __pmx : 0),
    lift: __ax('Space', 'ShiftLeft') || __ax('Space', 'ShiftRight') || (__pad ? (__pad.jump ? 1 : 0) - (__pad.kneel ? 1 : 0) : 0),
    jump, jumpHeld: sp ? 1 : 0,
    boost: __held['KeyF'] || (__pad && __pad.boost) ? 1 : 0,   // thrusters (platform rule): held = boost locomotion
    kneel: __held['KeyX'] || (__pad && __pad.kneel) ? 1 : 0,   // one-knee hold (platform rule, opt-in kneel:true) / space descend
    fire: __fireDown || (__pad && __pad.fire) ? 1 : 0,         // left mouse or RT (weapon subsystem): held = fire request
    cycle, slot,                     // weapon cycling (platform rule, opt-in loadout)
    swap,                            // suit switcher (T): transfer the pilot between pilotable suits
    tackle,                          // tackle (Shift): the platform rule's invincible offensive dash (opt-in r.tackle)
    aiToggle,                        // AI attack switch (G): ai-ambient suits stand down / wake up
    lookDX: __lookDX, lookDY: __lookDY,
  };
  __lookDX = 0; __lookDY = 0;
  return inp;
}
// active whenever there are entities to step; the camera is OWNED only if a camera entity exists
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
  window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyV' && !ev.repeat) __rvFlip(); });
  hud.appendChild(__rvBtn);
}
// AI ATTACK toggle (worlds with ai-ambient suits): a HUD button twin of the G key. The click only
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
// SPECTATOR RIG (ai-battle-spectator.plan.md): a no-pilot ALL-AI battle the operator WATCHES. The
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
    if (ev.code === 'Tab') { ev.preventDefault(); if (!ev.repeat) __specCycle(); }
    else if (ev.code === 'KeyF' && !ev.repeat) { __specLocked = !__specLocked; if (__specLocked) __specFollow(); else __specFree(); __specSync(); }
  });
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
  } else if (W.cooldownT > 0) {
    const __cdMax = W.burstLeft > 0 ? (1 / (W.burstRof || 8)) : (W.auto ? (1 / (W.rof || 10)) : (W.cooldown || 0.5));
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
    __wep.ammoTxt.textContent = W.ammo + ' / ' + W.magazine;
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
// top-middle whose fill tracks the piloted suit's boost/boostMax. Built ONLY when some entity
// carries a gauge (rule.boostMax, or pilotRule.boostMax on an unpiloted pilotable suit). The fill
// dims + reddens while the gauge is empty-locked (the "spent" read), ambers when low.
let __bg = null;
const __boostMaxOf = (e) => (e.rule && e.rule.boostMax > 0 ? e.rule.boostMax
  : (e.pilotRule && e.pilotRule.boostMax > 0 ? e.pilotRule.boostMax : 0));
const __boostEnt = __world.entities.find((e) => __boostMaxOf(e) > 0);
if (__boostEnt && !__world.spectate) {   // SPECTATE: boost is a pilot resource — no gauge when nobody flies
  const __bgWrap = document.createElement('div');
  __bgWrap.style.cssText = 'position:absolute;left:50%;top:16px;transform:translateX(-50%);width:240px;height:7px;border-radius:4px;background:rgba(10,18,28,0.32);box-shadow:inset 0 0 0 1px rgba(160,200,232,0.22);overflow:hidden;pointer-events:none;z-index:9';
  const __bgFill = document.createElement('div');
  __bgFill.style.cssText = 'height:100%;width:100%;background:#7fd4ff;opacity:0.72';
  __bgWrap.appendChild(__bgFill);
  wrap.appendChild(__bgWrap);
  // the OVERHEAT tell: while the gauge is locked (drained, or dumped by a dodge), thrust is dead —
  // a small red caption under the bar reads it out. Hidden whenever the thruster is live.
  const __bgLabel = document.createElement('div');
  __bgLabel.textContent = 'OVERHEAT';
  __bgLabel.style.cssText = 'position:absolute;left:50%;top:27px;transform:translateX(-50%);font:700 10px system-ui,sans-serif;letter-spacing:.14em;color:#ff6b6b;text-shadow:0 1px 3px rgba(0,0,0,.6);display:none;pointer-events:none;z-index:9';
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
// the PILOTED suit each frame (T swaps it). Absent otherwise (byte-identical).
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
    if (!e || e === pilot) { r.el.style.display = 'none'; continue; }
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
function __fxMat(c) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }); }
function __spawnShotFx(shot, from, col, sz) {
  if (!shot || !from || !shot.to) return;
  const a = from, b = shot.to, born = __world.time;
  const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]);
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  line.raycast = function () {}; scene.add(line);
  __fx.push({ obj: line, born: born, ttl: 0.09, kind: 'tracer' });
  const mf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), __fxMat(col));
  mf.position.set(a[0], a[1], a[2]); mf.scale.setScalar(sz * 0.5); mf.raycast = function () {}; scene.add(mf);
  __fx.push({ obj: mf, born: born, ttl: 0.08, kind: 'flash', base: sz * 0.5 });
  if (shot.mode === 'core' || shot.mode === 'assist') {
    const im = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    im.position.set(b[0], b[1], b[2]); im.scale.setScalar(sz * 0.4); im.raycast = function () {}; scene.add(im);
    __fx.push({ obj: im, born: born, ttl: 0.16, kind: 'impact', base: sz });
  }
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
      __spawnShotFx(fent.lastShot, from, col, sz);
      // DUAL WIELD (muzzleDual): the second gun fires SIMULTANEOUSLY — mirror the muzzle across the
      // body's sagittal plane (normal = the right vector) so the off-hand pistol flashes at its own tip.
      if (from && rec.w.muzzleDual) {
        const __tp = fent.transform.pos, __hh = fent.transform.heading || 0;
        const __rx = Math.sin(__hh), __ry = -Math.cos(__hh);
        const __lat = (from[0] - __tp[0]) * __rx + (from[1] - __tp[1]) * __ry;
        __spawnShotFx(fent.lastShot, [from[0] - 2 * __lat * __rx, from[1] - 2 * __lat * __ry, from[2]], col, sz);
      }
      rec.shots = s;
    }
  }
  for (let i = __fx.length - 1; i >= 0; i--) {
    const f = __fx[i], age = (__world.time - f.born) / f.ttl;
    if (age >= 1) { scene.remove(f.obj); f.obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); __fx.splice(i, 1); continue; }
    if (f.kind === 'tracer') f.obj.material.opacity = 0.9 * (1 - age);
    else if (f.kind === 'flash') { f.obj.material.opacity = 1 - age; f.obj.scale.setScalar(f.base * (1 + age * 0.6)); }
    else if (f.kind === 'impact') { f.obj.material.opacity = 1 - age; f.obj.scale.setScalar(f.base * (0.3 + age * 1.4)); }
    // R14 burst: an expanding shell that carries its OWN base + dim (so it is not coupled to the
    // active hitscan weapon's __fxSz like the shot flash is). dim caps peak opacity — the wide
    // splash shell is translucent (a fireball), the small inner flash near-opaque.
    else if (f.kind === 'burst') { f.obj.material.opacity = (f.dim != null ? f.dim : 1) * (1 - age); f.obj.scale.setScalar(f.base * (0.3 + age * 1.0)); }
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
for (const e of __world.entities) __syncEntity(e);${shadowBlock}${smokeBlock}${hangarBlock}
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
  if (__world.spectate) return;   // no picks in a spectate bout — the whole cast fights; never despawn a seat
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
  // pilot slice (handled above); seat:'ai' is a spectate cast (never touched — spectate returns early).
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
stepControllable = (dt, inputOverride) => {
${hangarHook}  __msHookParams();
  if (dt > 0) {
    __CW.stepWorld(__world, inputOverride || __readInput(), dt, { ground: __ground });
    for (const e of __world.entities) __syncEntity(e, dt);
    __updateFx();
    __updateProjectiles();
    __updateClashes();
    __updateThrusters(dt);${shadowHook}${smokeHook}
  }
  if (__ctrlOwnsCamera) __driveCamera(dt);
  __updateWepHud();   // after the camera is positioned, so the reticle projects onto the current frame
  __updateBoostHud();
  __updateRadar();
  __updateHpHud();
  __updateEnemyHp();
  __updateMatchHud();
};
window.__mojCtrl = { world: __world,${exposeBodies ? ' bodies: __bodies,' : ''} step: (dt, input) => stepControllable(dt, input) };`;
}
