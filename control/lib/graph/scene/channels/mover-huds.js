/**
 * mover-huds — the per-domain HUD readout formatters for the mover channel
 * (engines, motors, machines, flight/drone/sub, collisions, cascade, energy bars),
 * evicted from the renderer (renderer-emitter.plan.md E7): they are view-domain
 * physics narration, not scene plumbing. Exported as PAGE-CODE TEXT — channels.js
 * splices this string into moverChannelScript's emitted block verbatim, so the page
 * bytes are identical to when these functions lived inline. Constraint: the text must
 * stay free of backtick and dollar-brace so it can ride inside the template literal.
 *
 * Moved from views/science/ into the channels layer (recipe-book.plan.md): the
 * mover channel's stepMovers dispatch references these formatters by name
 * (_rocketHud, _machineHud, …), so the coupling was always channel↔huds — a
 * core channel importing from the views directory was the one inverted
 * dependency in the tree. If a recipe-book kind ever needs a BESPOKE mover
 * HUD, that becomes the moment to add a contribution point (a mover carrying
 * its own formatter text) — by demonstrated need, not before.
 */

export const MOVER_HUD_JS = `// energy bars (opt-in, mechanics): KE green, PE blue, total grey — widths are value/emax. Inline-styled
// so they need no extra page CSS. Total visibly stays flat as KE↔PE trade (or sinks under friction).
function _ebars(mv, i) {
  const em = mv.emax || 1;
  const row = (lab, val, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:16px;color:' + col + '">' + lab + '</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / em))) + '%;background:' + col + '"></span></span>'
    + '<span style="width:46px;text-align:right;opacity:.78">' + val.toFixed(0) + ' J</span></div>';
  return '<div style="width:172px;margin-top:4px">'
    + row('KE', mv.ke[i], '#55e08a') + row('PE', mv.pe[i], '#5fa9e0') + row('E', mv.etotal[i], '#9aa3b5') + '</div>';
}
// force legend (opt-in, mechanics): a colour chip + label + live magnitude in newtons per force channel,
// so the moving free-body arrows are unambiguous. Colours come straight off each channel (three.js int).
function _flegend(mv, i) {
  return '<div style="width:172px;margin-top:4px">' + mv.forces.map((ch) => {
    const fv = ch.vecs[i], fn = Math.hypot(fv[0], fv[1], fv[2]);
    const col = '#' + ('000000' + ch.color.toString(16)).slice(-6);
    return '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
      + '<span style="width:9px;height:9px;border-radius:2px;flex:none;background:' + col + '"></span>'
      + '<span style="flex:1">' + ch.label + '</span>'
      + '<span style="opacity:.78">' + fn.toFixed(0) + ' N</span></div>';
  }).join('') + '</div>';
}
// collision system readout (opt-in, two-body): total momentum p (CONSTANT — the conservation headline),
// the live per-body velocities, the restitution e, and a KE bar that shrinks when an inelastic hit burns
// kinetic energy. Inline-styled like the energy bars.
function _collisionHud(mv, i) {
  const s = mv.system, kb = s.keBefore || 1, kn = s.keNow[i], lost = Math.max(0, s.keBefore - kn);
  const tag = s.e >= 0.999 ? ' · elastic' : (s.e <= 0.001 ? ' · perfectly inelastic' : '');
  const bar = '<div style="width:172px;margin-top:4px"><div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:16px;color:#55e08a">KE</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, kn / kb))) + '%;background:#55e08a"></span></span>'
    + '<span style="width:46px;text-align:right;opacity:.78">' + kn.toFixed(0) + ' J</span></div></div>';
  return '<span>p = ' + s.pTotal.toFixed(1) + ' kg·m/s · conserved</span>'
    + '<span class="v">v₁ = ' + s.vx1[i].toFixed(1) + ' m/s</span>'
    + '<span class="v">v₂ = ' + s.vx2[i].toFixed(1) + ' m/s</span>'
    + '<span>e = ' + s.e.toFixed(2) + tag + (lost > 0.5 ? ' · KE −' + lost.toFixed(0) + ' J' : '') + '</span>' + bar;
}
// cascade readout (opt-in, chain reaction): the population headline — neutrons currently alive, fissions
// so far vs the assembly total — counted live from the shared-clock lifetimes, so the operator watches the
// number GROW (supercritical) or die (subcritical). Inline-styled like the energy bars.
function _cascadeHud(c, alive, fiss, peak) {
  const total = c.nuclei || 1;
  const bar = (lab, val, max, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:64px;color:' + col + '">' + lab + '</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / max))) + '%;background:' + col + '"></span></span>'
    + '<span style="width:46px;text-align:right;opacity:.78">' + val + '</span></div>';
  return '<span>regime: ' + c.regimeLabel + '</span>'
    + '<span class="v">neutrons alive: ' + alive + '</span>'
    + '<span>' + c.note + '</span>'
    + '<div style="width:188px;margin-top:4px">'
    + bar('neutrons', alive, Math.max(1, peak), '#bcd4ff')
    + bar('fissions', fiss, total, '#e0a05a') + '</div>';
}
// comparison readout (opt-in, two-body side-by-side): names both bodies (gold A, blue B) and the time
// each takes (flight time, or pendulum period), so the race the operator is watching has its numbers.
function _compareHud(mv) {
  const c = mv.compare;
  return '<span style="color:#e0b15f">A · ' + c.labA + ' → ' + c.unitLabel + ' ' + c.ta.toFixed(2) + ' s</span>'
    + '<span style="color:#7fa8d6">B · ' + c.labB + ' → ' + c.unitLabel + ' ' + c.tb.toFixed(2) + ' s</span>'
    + '<span style="opacity:.8">' + c.note + '</span>';
}
// simple-machine WORK bars (opt-in, machines): cumulative work-in (amber) vs work-out (blue) — they track
// EQUAL in an ideal machine (force traded for distance, NOT work) — plus the friction loss (red) that opens
// the gap when η<1. Scaled to the total work-in. Inline-styled like the energy bars.
function _workbars(mv, i) {
  const m = mv.machine, wm = m.maxWork || 1, hasFric = m.efficiency < 0.999;
  const row = (lab, val, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:30px;color:' + col + '">' + lab + '</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / wm))) + '%;background:' + col + '"></span></span>'
    + '<span style="width:48px;text-align:right;opacity:.78">' + val.toFixed(0) + ' J</span></div>';
  return '<div style="width:188px;margin-top:4px">'
    + row('W_in', m.workIn[i], '#e0a05a') + row('W_out', m.workOut[i], '#5fa9e0')
    + (hasFric ? row('W_fric', m.workFriction[i], '#e0606a') : '') + '</div>';
}
// machine readout headline: mechanical advantage and the force trade (a small effort force moving a large
// load), plus the distance trade and efficiency. The work bars below show work itself is conserved.
// engine readout (steam / IC engine): the crank angle, the running speed, and the headline — a slider-crank
// converts the piston's RECIPROCATING motion into ROTARY motion; the heavy flywheel carries the crank
// through the dead-centres where the piston momentarily stops (piston speed → 0 at θ = 0° / 180°).
// flight readout (a drone TRAVERSING changing air): the current aerial condition + how the craft is
// responding (pitching into a headwind, riding a thermal, correcting a gust), plus altitude and airspeed.
function _flightHud(mv, i) {
  const f = mv.flight;
  return '<span style="color:' + (f.col[i] || '#9aa3b5') + '">condition: ' + f.condition[i] + '</span>'
    + '<span class="v">' + f.note[i] + '</span>'
    + '<span class="a">altitude ' + f.alt[i].toFixed(1) + ' m · airspeed ' + f.speed[i].toFixed(1) + ' m/s</span>'
    + '<span style="opacity:.8">the thrust vector tilts to fly the route — ΣF = ma through every gust</span>';
}
// drone readout: the WHOLE-AIRCRAFT free-body balance — total rotor lift vs weight. ΣF = ma, so it climbs
// when lift > weight, falls when lift < weight, and HOVERS (holds altitude) when they balance (Newton I).
function _droneHud(mv, i) {
  const d = mv.drone, T = d.thrust[i], W = d.weight, net = T - W;
  const state = Math.abs(net) < W * 0.02 ? 'hover · ΣF = 0' : (net > 0 ? 'climbing' : 'descending');
  return '<span style="color:#55e08a">lift ' + T.toFixed(0) + ' N vs weight ' + W.toFixed(0) + ' N</span>'
    + '<span class="v">net ' + (net >= 0 ? '+' : '') + net.toFixed(0) + ' N → ' + state + '</span>'
    + '<span class="a">' + d.rotors + ' rotors · ' + (T / d.rotors).toFixed(0) + ' N each</span>'
    + '<span style="opacity:.8">it stays up when total lift = weight (Newton II: ΣF = ma)</span>';
}
// submarine readout: the buoyancy free-body — Archimedes' buoyant force (up, fixed) vs weight (down, which
// the crew CHANGES via ballast water). Flood → W > B → dive; blow → W < B → rise; neutral → W = B → hold.
function _subHud(mv, i) {
  const s = mv.sub, B = s.buoyancy, W = s.weight[i], net = B - W;
  const state = Math.abs(net) < B * 0.02 ? 'neutral · ΣF = 0 — holds depth' : (net > 0 ? 'rising — ballast blown (W < B)' : 'diving — ballast flooded (W > B)');
  return '<span style="color:#5fd0c0">buoyancy ' + B.toFixed(0) + ' N vs weight ' + W.toFixed(0) + ' N</span>'
    + '<span class="v">net ' + (net >= 0 ? '+' : '') + net.toFixed(0) + ' N → ' + state + '</span>'
    + '<span class="a">depth ' + s.depth[i].toFixed(1) + ' m · ballast ' + (s.ballast[i] * 100).toFixed(0) + '% flooded</span>'
    + '<span style="opacity:.8">Archimedes: flood to dive, blow to rise, neutral to hover (ΣF = ma)</span>';
}
// electric-motor readout: the motor effect (a current-carrying coil in a field feels F = I L × B), the
// resulting force couple → torque → rotation, and how the commutator flips the current each half-turn so
// the torque never reverses. Static (the lesson, not a per-frame value).
function _motorHud(mv) {
  const m = mv.motor;
  if (m.type === 'ac') {   // induction motor: a rotating stator field the rotor chases but never catches (slip)
    return '<span style="color:#ffd36b">3-phase rotating magnetic field</span>'
      + '<span class="v">the rotor chases it — slip ' + m.slip + '%</span>'
      + '<span class="a">' + m.syncRpm + ' rpm field · ' + m.rotorRpm + ' rpm rotor</span>'
      + '<span style="opacity:.8">rotor current is INDUCED — no brushes, no commutator</span>';
  }
  return '<span style="color:#e0606a">motor effect: F = I L × B</span>'
    + '<span class="v">opposite forces on the two coil sides → torque</span>'
    + '<span class="a">commutator flips the current every ½ turn</span>'
    + '<span style="opacity:.8">electrical → rotational · ' + (m.note || 'brushed DC motor') + '</span>';
}
function _engineHud(mv, i) {
  const e = mv.engine, ph = e.angle[i], deg = ((ph * 180 / Math.PI) % 360 + 360) % 360;
  if (e.engine === 'inline') {   // four cylinders firing in sequence — one power stroke every half-revolution
    const gdeg = ph * 180 / Math.PI;
    const firing = e.deltas.map((d, ci) => ({ n: ci + 1, ps: ((gdeg + d) % 720 + 720) % 720 })).filter((c) => c.ps >= 360 && c.ps < 540);
    return '<span style="color:#e0606a">power stroke: cylinder ' + (firing[0] ? firing[0].n : '—') + '</span>'
      + '<span class="v">firing order ' + e.order + '</span>'
      + '<span class="a">' + e.rpm + ' rpm · 4 cylinders · even firing every 180°</span>'
      + '<span style="opacity:.8">one power stroke per ½ revolution keeps the crankshaft smooth</span>';
  }
  if (e.engine === 'four-stroke') {   // the cycle spans TWO revolutions: intake · compression · power · exhaust
    const names = ['intake', 'compression', 'power', 'exhaust'], cols = ['#5fd0c0', '#7fa8d6', '#e0606a', '#9aa3b5'];
    const s = Math.floor(((ph % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI) / Math.PI);
    const rev = ph < 2 * Math.PI ? 1 : 2;
    return '<span style="color:' + cols[s] + '">stroke: ' + names[s] + (s === 2 ? ' · BANG' : '') + '</span>'
      + '<span class="v">crank ' + deg.toFixed(0) + '° · revolution ' + rev + ' of 2</span>'
      + '<span class="a">' + e.rpm + ' rpm · 4 strokes / 2 revolutions</span>'
      + '<span style="opacity:.8">suck · squeeze · bang · blow — the cam runs at ½ crank speed</span>';
  }
  const dead = (deg < 8 || deg > 352 || Math.abs(deg - 180) < 8) ? ' · dead-centre' : '';
  return '<span>crank ' + deg.toFixed(0) + '°' + dead + '</span>'
    + '<span class="v">piston ' + mv.speed[i].toFixed(1) + ' m/s</span>'
    + '<span class="a">' + e.rpm + ' rpm · stroke ' + e.stroke.toFixed(1) + ' m</span>'
    + '<span style="opacity:.8">reciprocating ↔ rotary · flywheel carries the dead-centres</span>';
}
function _machineHud(mv) {
  const m = mv.machine;
  // compound machines: show MA MULTIPLYING through the chain (MA = MA₁ × MA₂ × … = total)
  const chain = Array.isArray(m.stages) && m.stages.length > 1
    ? m.stages.map((s) => (+s[1]).toFixed(1)).join(' × ') + ' = ' : '';
  return '<span>MA = ' + chain + m.MA_ideal.toFixed(chain ? 1 : 2) + (m.efficiency < 0.999 ? ' · actual ' + m.MA_actual.toFixed(2) : '') + '</span>'
    + '<span class="v">effort ' + m.effortForce.toFixed(0) + ' N → load ' + m.loadForce.toFixed(0) + ' N</span>'
    + '<span class="a">d_in ' + m.dIn.toFixed(1) + ' m → d_out ' + m.dOut.toFixed(1) + ' m</span>'
    + '<span style="opacity:.8">efficiency ' + (m.efficiency * 100).toFixed(0) + '% · work in = work out</span>';
}
// rocket readout (pose mover, rocket-view): the mission narration — phase, real clock, altitude,
// speed (+Mach when it matters), the DRAINING mass with thrust and the live TWR, dynamic pressure,
// and a propellant bar. All arrays are equal-dt with the path, in real SI from the integrator.
function _rocketHud(mv, i) {
  const r = mv.rocket, mach = r.mach[i];
  const bar = '<div style="display:flex;align-items:center;gap:5px;margin-top:3px;width:188px">'
    + '<span style="width:34px;color:#e0a05a">prop</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, r.prop[i]))) + '%;background:#e0a05a"></span></span>'
    + '<span style="width:38px;text-align:right;opacity:.78">' + (100 * r.prop[i]).toFixed(0) + '%</span></div>';
  return '<span style="color:#e0a05a">' + r.phase[i] + '</span>'
    + '<span class="v">T+' + r.t[i].toFixed(0) + ' s · alt ' + r.alt[i].toFixed(1) + ' km · v ' + r.speed[i].toFixed(0) + ' m/s' + (mach > 0.4 ? ' · M ' + mach.toFixed(1) : '') + '</span>'
    + '<span class="a">mass ' + (r.mass[i] / 1000).toFixed(1) + ' t · thrust ' + (r.thrust[i] / 1000).toFixed(0) + ' kN · TWR ' + r.twr[i].toFixed(2) + '</span>'
    + '<span style="opacity:.8">q ' + (r.q[i] / 1000).toFixed(1) + ' kPa · real forces, scripted guidance</span>' + bar;
}
// airplane readout (pose mover, airplane-view): the flight-deck narration — phase, clock,
// altitude, airspeed, and the WING numbers (angle of attack, C_L, live L/D) with thrust and
// the flap/gear configuration. Equal-dt with the path, real SI from the integrator.
function _planeHud(mv, i) {
  const p = mv.plane;
  return '<span style="color:#7fc8e0">' + p.phase[i] + '</span>'
    + '<span class="v">T+' + p.t[i].toFixed(0) + ' s · alt ' + p.alt[i].toFixed(0) + ' m · v ' + p.speed[i].toFixed(0) + ' m/s</span>'
    + '<span class="a">AoA ' + p.aoa[i].toFixed(1) + '° · C_L ' + p.cl[i].toFixed(2) + ' · L/D ' + p.ld[i].toFixed(1) + '</span>'
    + '<span style="opacity:.8">thrust ' + (p.thrust[i] / 1000).toFixed(0) + ' kN · ' + p.cfg[i] + ' · four forces, scripted pilot</span>';
}`;
