/**
 * shot-light.js — THE SHOT LIGHT: what shines in a fight, read off the world each frame as lights the page lays over a
 * baked map (scene/channels/controllable/shot-light-view.js: the side map's terrain lit by the buster, its charge and the
 * foes' weapons). The bake stays the map's light; these are added over it while they last.
 *
 *   a ROUND      in flight (state.projectiles): a buster's pellet in its level's colour, its reach by its size; a shell
 *                in its own colour (fxColor), its reach by its scale
 *   a BURST      as it goes off (state.bursts): bright, its reach by its blast, fading out over BURST_LIFE
 *   a FLASH      a body's shot (e.lastShot): at the muzzle for FLASH_LIFE, and where a hitscan round struck
 *   a BREAK      a block that broke (state.breaks: rupa's matter, a breakable's), and a body DESTROYED (e.wreck: dismantle's
 *                or a cleave's), lit as it comes apart: a flash at it fading over BREAK_LIFE, in the colour of the round
 *                that burst there then (its burst's), else warm, so what a shot destroys is lit by the shot's light
 *   the CHARGE   the pilot's buster charging (e.charging, e.chargeFrac): from its body, at its chest, growing as it fills, in the colour
 *                of the level reached, pulsing on the world's clock
 *
 * SPILL, NOT FLOOD (the shot's look, the reference's eighth principle): a light reaches a little way and gives a little,
 * in its hue saturated (S.chroma round its luminance, its brightest channel at 1), never its white core's.
 *
 * Each light { pos: [x, y, z], color: [r, g, b] (0..1, sRGB, saturated), reach (m), power }, the K strongest by power over
 * their distance to `focus` (the camera's look). Deterministic: the world's time, never a die or a clock of the page's.
 *
 *   shotLights(state, { focus?, k? }) → [light]
 *   SHOT_LIGHT   the numbers (the function carries its own copy, being run as source: a test holds them equal)
 *
 * Import-free: the page runs this exact source (toString), as it runs the controllable world's.
 */
export const SHOT_LIGHT = Object.freeze({ k: 6, burstLife: 0.35, flashLife: 0.09, pellet: [1.4, 5], shell: 0.9, burst: 1.6, flash: 2, charge: [0.8, 1.8], warm: 0xffd890, chroma: 1.6, breakLife: 0.45, broke: [2.6, 1.3], wreck: [3, 1.5] });

export function shotLights(state, opts) {
  const S = { k: 6, burstLife: 0.35, flashLife: 0.09, pellet: [1.4, 5], shell: 0.9, burst: 1.6, flash: 2, charge: [0.8, 1.8], warm: 0xffd890, chroma: 1.6, breakLife: 0.45, broke: [2.6, 1.3], wreck: [3, 1.5] };
  const o = opts || {}, K = o.k || S.k, focus = o.focus || null, t = state && state.time ? state.time : 0, out = [];
  if (!state) return out;
  // (its colour the hue saturated, the body's: a shot's white core is its own, never what it throws on the world)
  const rgb = (c) => {
    const n = typeof c === 'number' ? c : S.warm, v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const w = v.map((x) => Math.max(0, y + (x - y) * S.chroma)), m = Math.max(w[0], w[1], w[2], 1e-6);
    return w.map((x) => Math.round((x / m) * 1000) / 1000);
  };
  const add = (pos, color, reach, power) => { if (pos && reach > 0 && power > 1e-3) out.push({ pos: [pos[0], pos[1], pos[2]], color: rgb(color), reach, power }); };
  // the rounds in flight
  for (const p of state.projectiles || []) {
    if (p.pellet) { const sz = p.fxScale != null ? p.fxScale : p.projRadius || 0.08; add(p.pos, p.fxColor, S.pellet[0] + S.pellet[1] * sz, 0.35 + 1.2 * sz); }
    else add(p.pos, p.fxColor, S.shell * Math.max(1.5, p.fxScale != null ? p.fxScale : 3), 0.5);
  }
  // the bursts as they go off, fading
  for (const b of state.bursts || []) {
    const age = t - (b.t != null ? b.t : -1e9);
    if (age < 0 || age > S.burstLife) continue;
    const f = 1 - age / S.burstLife;
    add(b.pos, b.fxColor, S.burst * Math.max(1.2, b.fxRadius || b.radius || (b.fxScale != null ? b.fxScale * 0.5 : 1.5)), 1.1 * f * f);
  }
  // what broke and what was destroyed, lit as it comes apart, in the colour of the round that burst there then
  const tint = (at, when) => { let c = null, best = 1e9; for (const b of state.bursts || []) { const d = Math.hypot(b.pos[0] - at[0], b.pos[1] - at[1], b.pos[2] - at[2]); if (Math.abs((b.t != null ? b.t : -1e9) - when) <= 0.1 && d <= 3 && d < best && b.fxColor != null) { best = d; c = b.fxColor; } } return c != null ? c : S.warm; };
  for (const br of state.breaks || []) {
    const age = t - (br.t != null ? br.t : -1e9);
    if (age < 0 || age > S.breakLife || !br.at || br.how === 'restore') continue;
    const f = 1 - age / S.breakLife;
    add(br.at, tint(br.at, br.t), S.broke[0], S.broke[1] * f * f);
  }
  for (const e of state.entities || []) {
    const W = e && e.wreck, age = W ? t - (W.t0 || 0) : -1;
    if (!W || age < 0 || age > S.breakLife || !e.transform) continue;
    const f = 1 - age / S.breakLife, at = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + ((e.rule && e.rule.collideHeight) || 1.6) * 0.5];
    add(at, tint(at, W.t0 || 0), S.wreck[0], S.wreck[1] * f * f);
  }
  // each body's shot: its muzzle's flash, and where a hitscan round struck; the pilot's charge at its chest
  for (const e of state.entities || []) {
    if (!e || e.gone) continue;
    const B = e.rule && e.rule.buster, L = e.lastShot;
    if (L && L.from && t - L.t >= 0 && t - L.t < S.flashLife) {
      const f = 1 - (t - L.t) / S.flashLife, lv = B ? (L.charged ? B.levels[B.levels.length - 1] : B.tap) : null;
      add(L.from, lv && lv.color != null ? lv.color : S.warm, S.flash * (L.charged ? 1.5 : 1), 0.8 * f);
      if (L.to) add(L.to, S.warm, S.flash, 0.6 * f);
    }
    if (B && e.charging && e.busterOn && (e.chargeFrac || 0) > 0) {
      const fr = Math.min(1, e.chargeFrac), lv = e.chargeLevel ? B.levels[e.chargeLevel - 1] : B.tap, tr = e.transform, r = e.rule;
      const pulse = 0.8 + 0.2 * Math.sin(t * (e.chargeLevel ? 36 : 18));
      // (from the body itself, at its chest: the charge is over the whole body, and it lights what is round it; the body's
      // own glow is its cel's, index.js uToonCharge)
      if (tr && tr.pos) add([tr.pos[0], tr.pos[1], tr.pos[2] + (r.collideHeight || 1.7) * (B.chest || 0.7) - (r.eye || 0)], lv && lv.color != null ? lv.color : S.warm, S.charge[0] + S.charge[1] * fr, (0.15 + 0.45 * fr) * pulse);
    }
  }
  // the K that matter most where the camera looks: power over distance (a far light is a light the frame does not see)
  if (out.length > K) {
    const score = (l) => (focus ? l.power / (1 + Math.hypot(l.pos[0] - focus[0], l.pos[1] - focus[1], l.pos[2] - focus[2]) / Math.max(1, l.reach)) : l.power);
    out.sort((a, b) => score(b) - score(a));
    out.length = K;
  }
  return out;
}
