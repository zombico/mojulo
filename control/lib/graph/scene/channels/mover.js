import { MOVER_HUD_JS } from './mover-huds.js';
import { safeJson } from '../emit-util.js';

// In-page script: the MOVER channel. Where the tracer moves a glowing additive SPRITE, a mover
// translates a SOLID render-group (a body mesh) along its `path` polyline — the Newtonian-motion
// channel (mechanics-view). The path is sampled at EQUAL TIME STEPS by the planner, so walking it at
// a constant parameter rate makes the body visibly accelerate (no time-warp logic here). Optional
// per-frame velocity / acceleration arrows (plain ArrowHelpers, no glow) + a numeric readout are
// driven off finite-differenced kinematics the planner ships in each mover. `loop:false` clamps at
// the end, holds, then replays (one-shot arcs); `loop:true` wraps (periodic, e.g. a pendulum). A
// `tether` point draws a line from a fixed anchor to the body each frame (the pendulum string).
// Only emitted when the caller passes a non-empty `movers`.
export function moverChannelScript(movers) {
  return `
const MOVERS = ${safeJson(movers)};
function moverAt(path, u) {
  const f = Math.max(0, Math.min(1, u)) * (path.length - 1); const i = Math.floor(f), a = f - i;
  const p0 = path[i], p1 = path[Math.min(i + 1, path.length - 1)];
  return [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
}
function moverU(mv, sec) {
  if (mv.loop) return ((sec / mv.period) % 1 + 1) % 1;
  const cycle = mv.period + (mv.hold || 0); const ph = sec % cycle;   // one-shot: play, hold at end, replay
  return ph < mv.period ? ph / mv.period : 1;
}
// CASCADE lifetimes: a mover may instead carry an absolute lifetime { t0, t1 } on a single SHARED scene
// clock (the chain-reaction timeline, where bodies appear and vanish at staggered times). _LIFE_T is that
// timeline's loop length — the latest t1 plus a tail hold — so the whole cascade replays in step. A
// lifetime mover is hidden outside its window; with \`vanish\` it disappears at t1 (a neutron absorbed),
// otherwise it freezes at its path end (a fragment come to rest, staying on screen as the reaction runs).
const _LIFE_T = (() => { let m = 0, any = false; for (const mv of MOVERS) { if (mv.t1 != null) { any = true; if (mv.t1 > m) m = mv.t1; } } return any ? m + 1.4 : 0; })();
function moverLifeU(mv, s) { return Math.max(0, Math.min(1, (s - mv.t0) / Math.max(1e-3, mv.t1 - mv.t0))); }
const _VEL_COL = 0x55e08a, _ACC_COL = 0xff6b4a, _TETHER_COL = 0x8e9bb6;
${MOVER_HUD_JS}
const moverRigs = MOVERS.map((mv) => {
  const mesh = meshes[mv.group] || null;
  let vel = null, acc = null, tether = null, forces = null;
  if (mv.vectors) {
    vel = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), mv.arrowLen, _VEL_COL, mv.arrowLen * 0.26, mv.arrowLen * 0.16);
    acc = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), mv.arrowLen, _ACC_COL, mv.arrowLen * 0.26, mv.arrowLen * 0.16);
    vel.renderOrder = acc.renderOrder = 3; scene.add(vel); scene.add(acc);
  }
  if (mv.forces) {   // one ArrowHelper per force channel (the moving free-body diagram)
    forces = mv.forces.map((ch) => {
      const ar = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), mv.arrowLen, ch.color, mv.arrowLen * 0.26, mv.arrowLen * 0.16);
      ar.renderOrder = 3; scene.add(ar); return ar;
    });
  }
  if (mv.tether) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mv.tether[0], mv.tether[1], mv.tether[2]), new THREE.Vector3()]);
    tether = new THREE.Line(g, new THREE.LineBasicMaterial({ color: _TETHER_COL })); scene.add(tether);
  }
  if (mv.track) {   // draw the trajectory itself as a faint static rail (orbit ellipses, etc.)
    const tg = new THREE.BufferGeometry().setFromPoints(mv.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    scene.add(new THREE.Line(tg, new THREE.LineBasicMaterial({ color: mv.trackColor || 0x42577f, transparent: true, opacity: 0.5 })));
  }
  return { mv, mesh, base: mv.basePos, vel, acc, tether, forces };
});
let _readout = null;
if (moverRigs.length && (moverRigs[0].mv.vectors || moverRigs[0].mv.forces || moverRigs[0].mv.system || moverRigs[0].mv.compare || moverRigs[0].mv.cascade || moverRigs[0].mv.machine || moverRigs[0].mv.engine || moverRigs[0].mv.motor || moverRigs[0].mv.drone || moverRigs[0].mv.flight || moverRigs[0].mv.sub || moverRigs[0].mv.rocket || moverRigs[0].mv.plane)) {   // hidden only when all off
  _readout = document.createElement('div'); _readout.className = 'moj-readout'; wrap.appendChild(_readout);
}
const _v3 = new THREE.Vector3(), _spinAxis = new THREE.Vector3(), _xUnit = new THREE.Vector3(1, 0, 0);
stepMovers = (t) => {
  const sec = t / 1000;
  for (const rig of moverRigs) {
    const mv = rig.mv;
    // CASCADE carrier: a meshless mover that only drives the population readout, counting live from the
    // shared-clock lifetimes (neutrons alive now, fissions fired so far). Always first; never vanishes.
    if (mv.cascade) {
      if (_readout && rig === moverRigs[0]) {
        const s = _LIFE_T > 0 ? (sec % _LIFE_T) : sec;
        let alive = 0, fiss = 0;
        for (const m2 of MOVERS) {
          if (m2.kindTag === 'neutron') { if (s >= m2.t0 && s <= m2.t1) alive++; }
          else if (m2.kindTag === 'fission') { if (s >= m2.t0) fiss++; }
        }
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _cascadeHud(mv.cascade, alive, fiss, mv.cascade.peak || 1);
      }
      continue;
    }
    // spin mode: rotate the render group about an axis through its pivot (a windmill rotor). The group
    // geometry is authored centred on the pivot; we place it at the pivot and spin it about the axis.
    if (mv.spin) {
      // optional lift: a per-sample vertical offset on the (loop-period) clock, so a propeller can SPIN
      // and RISE with its craft at once (a drone rotor climbing while the body translates the same lift).
      let lz = 0;
      if (mv.lift) { const u = moverU(mv, sec), n = mv.lift.length; lz = mv.lift[Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))))]; }
      if (rig.mesh) {
        rig.mesh.position.set(mv.pivot[0] - rig.base[0], mv.pivot[1] - rig.base[1], mv.pivot[2] + lz - rig.base[2]);
        rig.mesh.quaternion.setFromAxisAngle(_spinAxis.set(mv.spin.axis[0], mv.spin.axis[1], mv.spin.axis[2]).normalize(), mv.spin.omega * sec);
      }
      continue;
    }
    // TURN mode: PHASE-DRIVEN rotation about an axis through 'center' — the angle is read from a per-sample
    // array on the SAME play→hold→replay cycle the translating movers use, so a lever beam tilts, a screw
    // thread turns and a wheel spins exactly in step with their load (unlike spin's constant ω). The group
    // geometry is authored RELATIVE to 'center' (corner − center), so placing it at center + rotating about
    // the axis pivots it in place.
    if (mv.turn) {
      const u = moverU(mv, sec), i = Math.max(0, Math.min(mv.turn.angles.length - 1, Math.round(u * (mv.turn.angles.length - 1))));
      if (rig.mesh) {
        rig.mesh.position.set(mv.turn.center[0] - rig.base[0], mv.turn.center[1] - rig.base[1], mv.turn.center[2] - rig.base[2]);
        rig.mesh.quaternion.setFromAxisAngle(_spinAxis.set(mv.turn.axis[0], mv.turn.axis[1], mv.turn.axis[2]).normalize(), mv.turn.angles[i]);
      }
      // an electric motor's armature is a turn mover — drive its (static) readout from here
      if (_readout && rig === moverRigs[0] && mv.motor) _readout.innerHTML = '<b>' + mv.label + '</b>' + _motorHud(mv);
      continue;
    }
    // FILL mode: a tank's CONTENTS scaling vertically from the tank floor — a ballast tank flooding (frac→1)
    // and blowing (frac→0). Geometry authored from the floor up (z in [0, height]); scale.z = the fill
    // fraction anchored at the base height, plus an optional lift so the tank can ride a moving vehicle.
    if (mv.fill) {
      const u = moverU(mv, sec), n = mv.fill.frac.length, i = Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))));
      let lz = 0; if (mv.lift) { const j = Math.max(0, Math.min(mv.lift.length - 1, Math.round(u * (mv.lift.length - 1)))); lz = mv.lift[j]; }
      if (rig.mesh) {
        rig.mesh.position.set(-rig.base[0], -rig.base[1], mv.fill.base + lz - rig.base[2]);
        rig.mesh.scale.set(1, 1, Math.max(0.001, mv.fill.frac[i]));
      }
      continue;
    }
    // LINK mode: a rigid bar spanning two INDEPENDENTLY MOVING endpoints (a connecting rod between an
    // orbiting crank pin and a reciprocating piston). The bar geometry is authored as a UNIT segment along
    // +x from the origin; each frame we place it at A, aim +x at B, and scale x to |B−A| so it spans the gap.
    if (mv.link) {
      const u = moverU(mv, sec), n = mv.from.length, i = Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))));
      const A = mv.from[i], B = mv.to[i];
      const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], len = Math.hypot(dx, dy, dz) || 1e-6;
      if (rig.mesh) {
        rig.mesh.position.set(A[0] - rig.base[0], A[1] - rig.base[1], A[2] - rig.base[2]);
        rig.mesh.quaternion.setFromUnitVectors(_xUnit, _v3.set(dx / len, dy / len, dz / len));
        rig.mesh.scale.set(len, 1, 1);
      }
      continue;
    }
    // POSE mode: a rigid body that TRANSLATES along a path AND TILTS (per-sample orientation) at once — an
    // aircraft banking/pitching as it flies a route. Geometry authored relative to the body centre; each
    // frame we place it at path(u) and rotate it by the sampled tilt angle about its axis.
    if (mv.pose) {
      const u = moverU(mv, sec), n = mv.path.length, i = Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))));
      const p = moverAt(mv.path, u);
      if (rig.mesh) {
        rig.mesh.position.set(p[0] - rig.base[0], p[1] - rig.base[1], p[2] - rig.base[2]);
        rig.mesh.quaternion.setFromAxisAngle(_spinAxis.set(mv.tilt.axis[0], mv.tilt.axis[1], mv.tilt.axis[2]).normalize(), mv.tilt.angles[i]);
      }
      if (_readout && rig === moverRigs[0] && (mv.flight || mv.rocket || mv.plane)) _readout.innerHTML = '<b>' + mv.label + '</b>' + (mv.rocket ? _rocketHud(mv, i) : mv.plane ? _planeHud(mv, i) : _flightHud(mv, i));
      continue;
    }
    // PULSE mode: a scale-pop synced to a PHASE of the loop period — a combustion flash that fires once per
    // cycle at the power stroke (unlike the cascade 'flash', which keys off the absolute lifetime clock).
    if (mv.pulse) {
      const u = moverU(mv, sec), dd = ((u - mv.pulse.phase) % 1 + 1) % 1, d = Math.min(dd, 1 - dd), on = d < mv.pulse.width;
      if (rig.mesh) {
        rig.mesh.visible = on;
        if (on) {
          rig.mesh.position.set(mv.pulse.at[0] - rig.base[0], mv.pulse.at[1] - rig.base[1], mv.pulse.at[2] - rig.base[2]);
          rig.mesh.scale.setScalar(Math.max(0.001, (mv.pulse.size || 1) * (1 - d / mv.pulse.width)));
        }
      }
      continue;
    }
    // FLASH: a brief scale-pop at a fixed point (a fission burst). Geometry authored centred on the
    // origin, so we place it at mv.at and pulse its scale 0→size→0 across [t0,t1]; hidden otherwise.
    if (mv.flash) {
      const s = _LIFE_T > 0 ? (sec % _LIFE_T) : sec;
      const on = s >= mv.t0 && s <= mv.t1;
      if (rig.mesh) {
        rig.mesh.visible = on;
        if (on) {
          const a = (s - mv.t0) / Math.max(1e-3, mv.t1 - mv.t0);
          const sc = Math.max(0.001, Math.sin(Math.PI * a) * (mv.flash.size || 1));
          rig.mesh.position.set(mv.at[0] - rig.base[0], mv.at[1] - rig.base[1], mv.at[2] - rig.base[2]);
          rig.mesh.scale.setScalar(sc);
        }
      }
      continue;
    }
    const N = mv.path.length;
    // LIFETIME mover (cascade): visible only within its [t0,t1] window on the shared clock; walks its
    // segment over that window. Otherwise the legacy period/loop walk (mechanics, orbit) is unchanged.
    let u;
    if (mv.t1 != null) {
      const s = _LIFE_T > 0 ? (sec % _LIFE_T) : sec;
      const vis = s >= mv.t0 && (mv.vanish ? s <= mv.t1 : true);
      if (rig.mesh) rig.mesh.visible = vis;
      if (!vis) continue;
      u = moverLifeU(mv, s);
    } else {
      u = moverU(mv, sec);
    }
    const i = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
    const p = moverAt(mv.path, u);
    if (rig.mesh) rig.mesh.position.set(p[0] - rig.base[0], p[1] - rig.base[1], p[2] - rig.base[2]);
    if (rig.tether) { const a = rig.tether.geometry.attributes.position; a.setXYZ(1, p[0], p[1], p[2]); a.needsUpdate = true; }
    if (mv.vectors) {
      const vd = mv.vdir[i], av = mv.avec[i];
      const vlen = Math.max(0.01, mv.arrowLen * (mv.speed[i] / mv.maxSpeed));
      rig.vel.position.set(p[0], p[1], p[2]);
      rig.vel.setDirection(_v3.set(vd[0], vd[1], vd[2]).normalize());
      rig.vel.setLength(vlen, vlen * 0.26, vlen * 0.16);
      const an = Math.hypot(av[0], av[1], av[2]) || 1, alen = Math.max(0.01, mv.arrowLen * (mv.accel[i] / mv.maxAccel));
      rig.acc.position.set(p[0], p[1], p[2]);
      rig.acc.setDirection(_v3.set(av[0] / an, av[1] / an, av[2] / an));
      rig.acc.setLength(alen, alen * 0.26, alen * 0.16);
    }
    if (mv.forces && rig.forces) {   // moving free-body diagram: each force arrow scaled vs maxForce
      for (let c = 0; c < mv.forces.length; c++) {
        const fv = mv.forces[c].vecs[i], fn = Math.hypot(fv[0], fv[1], fv[2]), ar = rig.forces[c];
        if (fn < 1e-6) { ar.visible = false; continue; }
        ar.visible = true;
        const flen = Math.max(0.01, mv.arrowLen * (fn / mv.maxForce));
        ar.position.set(p[0], p[1], p[2]);
        ar.setDirection(_v3.set(fv[0] / fn, fv[1] / fn, fv[2] / fn));
        ar.setLength(flen, flen * 0.26, flen * 0.16);
      }
    }
    if (_readout && rig === moverRigs[0]) {
      if (mv.compare) {   // two-body side-by-side comparison: a dual readout (both bodies + their times)
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _compareHud(mv);
      } else if (mv.machine) {   // simple machine: a mechanical-advantage headline + the conservation-of-work bars
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _machineHud(mv) + _workbars(mv, i);
      } else if (mv.engine) {   // reciprocating engine: crank angle + the reciprocating↔rotary conversion story
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _engineHud(mv, i);
      } else if (mv.drone) {   // multirotor aircraft: the whole-craft lift-vs-weight balance (ΣF = ma)
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _droneHud(mv, i);
      } else if (mv.sub) {   // submarine: the buoyancy-vs-weight balance (ballast controls weight)
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _subHud(mv, i);
      } else if (mv.system) {   // two-body collision: a system (momentum / KE) readout, not single-body kinematics
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _collisionHud(mv, i);
      } else {
        // backward-compatible readout: mechanics shows t + g; orbit-view passes dist/footer/units → r + period.
        const ad = mv.accelDecimals != null ? mv.accelDecimals : 1;
        _readout.innerHTML = '<b>' + mv.label + '</b>'
          + (mv.dist ? '<span>r = ' + mv.dist[i].toFixed(2) + ' ' + (mv.distUnit || '') + '</span>'
            : '<span>t = ' + (u * mv.duration).toFixed(2) + ' s</span>')
          + '<span class="v">v = ' + mv.speed[i].toFixed(1) + ' ' + (mv.speedUnit || 'm/s') + '</span>'
          + '<span class="a">a = ' + mv.accel[i].toFixed(ad) + ' ' + (mv.accelUnit || 'm/s²') + '</span>'
          + '<span>' + (mv.footer || ('g = ' + mv.g.toFixed(1) + ' m/s²')) + '</span>'
          + (mv.energy ? _ebars(mv, i) : '')
          + (mv.forces ? _flegend(mv, i) : '');
      }
    }
  }
};`;
}
