import { safeJson } from '../emit-util.js';
import { aquaPatchScript } from './aqua-glsl.js';
import { kelvinField } from '../../craft-shelf/kelvin.js';

// In-page script: the SEAWAY channel (opt-in via emitThreeWorld({ seaway }), a boat underway on live water: the
// craft shelf's `assembleCraft(id, { underway: { speed, course } })`, built by craft-shelf/seaway.js). A water sheet
// over the course is lit and shaded as water (channels/aqua-glsl.js) and moved every frame by
//   the swell   a few deep-water trains, each at its own speed ω = √(g·k)
//   the wake    the boat's own Kelvin field, steady in the boat's frame and laid along its track (a vertex's distance
//               behind the bow measured along the course, its offset across it), by stationary phase: at an angle β
//               off the track inside the wedge two wave systems arrive, their directions θ the roots of
//               tan β = tan θ / (1 + 2 tan² θ), each its wavenumber g / (U² cos² θ) and phase k·(ξ cos θ + η sin θ),
//               their height falling as the square root of the distance and peaking at the cusp; the stern's system
//               the bow's, opposite and a waterline behind it (their interference is the hull-speed hump). A fast
//               boat's seen most along its narrower apparent angle. Waves shorter than the sheet's cells fade out
//   its foam    the stern's white water down the track, the edges breaking near the boat, the bow wave on the sides
// and the boat rides the swell (heave, pitch and roll from the swell under it), banks in its turn, and throws seeded
// spray off its chines and its rooster tails on the plane. The camera follows it (the orbit keeps its offset).
// Fixed substeps off the channel clock and seeded dice, so a capture's frames are the same every time.
export function seawayChannelScript({ boat, water, wake, course, toLight = [0.4, 0.3, 0.8], follow = true }) {
  return `${aquaPatchScript()}
// --- seaway (a boat underway on live water: its swell, its wake, its foam, its spray) ---
let stepSeaway = () => {};
{
  const SW = ${safeJson({ water, wake, course, follow: !!follow })}, BOAT = ${safeJson(boat)}, SUN = ${safeJson(toLight.map((x) => +(+x).toFixed(6)))};
  const G = 9.81, W = SW.wake, U = W.speed, R = SW.course.loop, C = 2 * Math.PI * R, CX = SW.course.center[0], CY = SW.course.center[1];
  const LW = W.waterline.length, LIFT = W.regime !== 'displacement', APP = W.angle * Math.PI / 180;
  if (!scene.children.some((o) => o.isLight)) { const sun = new THREE.DirectionalLight(0xfff4e0, 2.0); sun.position.set(SUN[0] * 100, SUN[1] * 100, SUN[2] * 100); scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xcfe3f2, 0x5a6a48, 0.9); hemi.position.set(0, 0, 1); scene.add(hemi); }
  // the sheet: a grid over the course, each vertex's place along the track (its arc s) and across it (η) fixed once
  const { n, size } = SW.water, N = n * n, dx = size / (n - 1), x0 = CX - size / 2, y0 = CY - size / 2;
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3), fa = new Float32Array(N), S = new Float32Array(N), ETA = new Float32Array(N), H = new Float32Array(N);
  const tint = new THREE.Color(SW.water.color);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i, x = x0 + i * dx, y = y0 + j * dx, a = Math.atan2(y - CY, x - CX);
    pos[3 * q] = x; pos[3 * q + 1] = y; nor[3 * q + 2] = 1; col[3 * q] = tint.r; col[3 * q + 1] = tint.g; col[3 * q + 2] = tint.b;
    S[q] = ((a < 0 ? a + 2 * Math.PI : a) * R); ETA[q] = Math.hypot(x - CX, y - CY) - R;
  }
  const idx = []; for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const q = j * n + i; idx.push(q, q + 1, q + n, q + 1, q + n + 1, q + n); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aAqFoam', new THREE.BufferAttribute(fa, 1)); geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const UQ = __aqPatch(mat, SW.water.look, { sun: SUN, foamCol: [0.94, 0.97, 0.98], refract: 0.04 });
  const sea = new THREE.Mesh(geo, mat); sea.renderOrder = 1; sea.raycast = () => {}; __aqShared.meshes.push(sea); scene.add(sea);

  // the swell: deep-water trains, each at ω = √(g·k)
  const SWELL = SW.water.swell.map((w) => ({ ...w, k: 2 * Math.PI / w.length, om: Math.sqrt(G * 2 * Math.PI / w.length), dx: Math.cos(w.dir), dy: Math.sin(w.dir) }));
  const swellAt = (x, y, t) => { let h = 0, gx = 0, gy = 0; for (const w of SWELL) { const p = w.k * (w.dx * x + w.dy * y) - w.om * t + w.ph, c = Math.cos(p); h += w.amp * Math.sin(p); gx += w.amp * w.k * w.dx * c; gy += w.amp * w.k * w.dy * c; } return [h, gx, gy]; };

  // the Kelvin field of one source, ξ behind it along the track and η across, by stationary phase (craft-shelf/kelvin.js)
  const kelvinField = ${kelvinField.toString()};
  const KP = { k0: G / (U * U), a0: W.crest, reach: W.reach, lw: LW, lifted: LIFT, app: APP, cell: dx }, kelvin = (xi, eta) => kelvinField(xi, eta, KP);
  // the foam a vertex carries: the stern's white water down the track, the edges breaking near the boat, the bow wave
  const SWK = W.sternWake, BW = W.waterline.beam, half = BW / 2;
  function foamAt(xiB, eta) {
    const xs = xiB - LW, ae = Math.abs(eta);
    let f = 0;
    if (xs > -0.2 * LW && xs < SWK.length) {
      const g = Math.max(0, xs), wide = (SWK.width / 2) * (1 + 1.2 * Math.sqrt(g / SWK.length));
      f = Math.max(f, Math.exp(-((ae / wide) ** 2)) * (g < SWK.foam ? 1.2 : 1.2 * Math.exp(-(g - SWK.foam) / (0.6 * SWK.foam + 1e-6))));
    }
    // (the edges: on the wedge's apparent angle from the bow's shoulders (displacing) or the transom (lifted))
    const xe = LIFT ? xs : xiB - 0.08 * LW, ee = ae - half;
    if (xe > 0) { const off = ee - xe * Math.tan(APP), cap = LW * (LIFT ? 2.5 : 0.8 + 2 * Math.min(W.froude, 0.6)); if (xe < cap) f = Math.max(f, 0.9 * Math.exp(-((off / (0.12 * BW + 0.05 * xe)) ** 2)) * (1 - xe / cap)); }
    // (the bow wave along the sides)
    if (W.bowWave > 0.05 && xiB > 0 && xiB < 0.3 * LW && ee > -0.05 && ee < 0.15 * BW + W.bowWave) f = Math.max(f, 1.1 * (1 - xiB / (0.3 * LW)));
    return f;
  }

  // the boat: its own faces, packed (Int16 corners on its scale, Uint8 colours), its waterline at its group's z 0
  const b64u8 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const P16 = new Int16Array(b64u8(BOAT.pos).buffer), C8 = b64u8(BOAT.col), bpos = new Float32Array(P16.length), bcol = new Float32Array(C8.length);
  for (let i = 0; i < P16.length; i++) bpos[i] = P16[i] * BOAT.scale; for (let i = 0; i < C8.length; i++) bcol[i] = C8[i] / 255;
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgeo.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
  const hull = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const rig = new THREE.Group(), tilt = new THREE.Group(); tilt.add(hull); rig.add(tilt); scene.add(rig);

  // spray: seeded droplets off the chines and the rooster tails on the plane, a fixed pool
  let seed = 0x5eaa11;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const NP = LIFT ? 900 : (W.bowWave > 0.05 ? 500 : 0), sp = new Float32Array(NP * 3), sv = new Float32Array(NP * 3), sl = new Float32Array(NP);
  const spray = NP ? new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xf2f6f7, size: Math.max(0.05, 0.012 * LW), transparent: true, opacity: 0.85, depthWrite: false })) : null;
  if (spray) { for (let i = 0; i < NP; i++) sp[3 * i + 2] = -1e4; scene.add(spray); }
  let spawn = 0;
  function emit(wx, wy, wz, vx, vy, vz) { const i = spawn++ % NP; sp[3 * i] = wx; sp[3 * i + 1] = wy; sp[3 * i + 2] = wz; sv[3 * i] = vx; sv[3 * i + 1] = vy; sv[3 * i + 2] = vz; sl[i] = 1.4 + rnd(); }

  // the course: a loop, the boat counter-clockwise round it, its bow 'fore' ahead of its origin
  const FORE = W.waterline.fore, BANK = (LIFT ? 1 : -0.15) * Math.atan(U * U / (G * R)) * 0.6;
  let last = null, acc = 0, sB = 0, prevOff = null;
  const DT = 1 / 60;
  function place(t) {
    const a = sB / R, px = CX + R * Math.cos(a), py = CY + R * Math.sin(a), head = a + Math.PI / 2;
    const [h, gx, gy] = swellAt(px, py, t), fx = Math.cos(head), fy = Math.sin(head);
    rig.position.set(px, py, h); rig.rotation.set(0, 0, head - Math.PI / 2);
    // (pitch along its heading and roll across it from the swell's slope under it, and its bank in the turn)
    // (+y about the bow's axis lowers its starboard side: the swell rising to starboard lifts it, the turn to port banks
    // a lifted hull into it, a displacing hull heels a little out of it)
    tilt.rotation.set(Math.atan(gx * fx + gy * fy) * 0.8, -Math.atan(gx * fy - gy * fx) * 0.8 - BANK, 0);
    return { px, py, head, fx, fy };
  }
  stepSeaway = (tm) => {
    let dt = last == null ? 0 : (tm - last) / 1000; last = tm; if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
    acc += dt; let k = 0; while (acc >= DT && k < 6) { acc -= DT; k++; sB = (sB + U * DT) % C; }
    const t = tm / 1000, B = place(t), sBow = sB + FORE;
    // the sheet: swell and wake heights, normals from the grid, foam
    for (let q = 0; q < N; q++) {
      let xi = (sBow - S[q]) % C; if (xi < 0) xi += C;
      const x = pos[3 * q], y = pos[3 * q + 1], e = ETA[q];
      // (the stern's system: the bow's, opposite and a waterline behind it)
      const hw = kelvin(xi, e) - 0.35 * kelvin(xi - LW, e);
      H[q] = swellAt(x, y, t)[0] + hw;
      fa[q] = Math.min(1, foamAt(xi, e));
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = j * n + i, o = 3 * q; pos[o + 2] = H[q];
      const gx = ((i < n - 1 ? H[q + 1] : H[q]) - (i > 0 ? H[q - 1] : H[q])) / (2 * dx), gy = ((j < n - 1 ? H[q + n] : H[q]) - (j > 0 ? H[q - n] : H[q])) / (2 * dx);
      const inv = 1 / Math.hypot(gx, gy, 1); nor[o] = -gx * inv; nor[o + 1] = -gy * inv; nor[o + 2] = inv;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.aAqFoam.needsUpdate = true; UQ.uAqTime.value = t;
    // spray: off the chines and from the rooster tails on the plane, off the bow wave displacing
    if (spray && dt > 0) {
      const toW = (bx, by, bz) => [B.px + bx * B.fy * 1 + by * B.fx, B.py - bx * B.fx + by * B.fy, bz];
      const rate = Math.min(400, 60 + 12 * U) * dt;
      for (let r = 0; r < rate; r++) {
        if (LIFT) {
          const sx = rnd() < 0.5 ? 1 : -1, by = FORE - (0.4 + 0.4 * rnd()) * LW, p = toW(sx * (half + 0.05), by, 0.02), out = (0.25 + 0.35 * rnd()) * U * 0.25;
          emit(p[0], p[1], p[2], B.fy * sx * out - B.fx * U * 0.15, -B.fx * sx * out - B.fy * U * 0.15, (0.4 + 0.6 * rnd()) * Math.sqrt(U) * 0.9);
          for (const R0 of W.rooster || []) if (rnd() < 0.5) { const q = toW(R0.at[0], R0.at[1], 0); emit(q[0], q[1], 0.05, -B.fx * U * 0.35 + (rnd() - 0.5), -B.fy * U * 0.35 + (rnd() - 0.5), Math.sqrt(2 * G * R0.height) * (0.8 + 0.3 * rnd())); }
        } else {
          const sx = rnd() < 0.5 ? 1 : -1, by = FORE - 0.05 * LW * rnd(), p = toW(sx * (0.2 * half + 0.1), by, W.bowWave * 0.6);
          emit(p[0], p[1], p[2], B.fy * sx * U * 0.12, -B.fx * sx * U * 0.12, Math.sqrt(2 * G * W.bowWave) * (0.4 + 0.5 * rnd()));
        }
      }
      for (let i = 0; i < NP; i++) { if (sl[i] <= 0) continue; sl[i] -= dt; sv[3 * i + 2] -= G * dt; sp[3 * i] += sv[3 * i] * dt; sp[3 * i + 1] += sv[3 * i + 1] * dt; sp[3 * i + 2] += sv[3 * i + 2] * dt; if (sp[3 * i + 2] < -0.05 || sl[i] <= 0) { sl[i] = 0; sp[3 * i + 2] = -1e4; } }
      spray.geometry.attributes.position.needsUpdate = true;
    }
    // the camera follows the boat, keeping the orbit's offset
    if (SW.follow && typeof controls !== 'undefined') {
      const cur = new THREE.Vector3(B.px, B.py, 0);
      if (prevOff) { camera.position.add(cur.clone().sub(prevOff)); controls.target.add(cur.clone().sub(prevOff)); }
      prevOff = cur;
    }
  };
  window.__seaway = { boat: rig, sheet: sea, kelvin, foamAt, place: (s) => { sB = s; } };
}`;
}
