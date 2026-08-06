import { safeJson } from '../emit-util.js';

// In-page script: a world-fixed sky, in two shapes. ATMOSPHERE (default): a huge inverted
// sphere (BackSide) centred on the scene carries a z-up zenith→horizon gradient in its vertex
// colours (linearised to match the baked faces); at night (day < 0.5) a seeded THREE.Points
// field is scattered on the UPPER dome — additive, depth-tested so terrain occludes stars near
// the horizon. SPACE (`space:true`): no gradient dome (the void is the scene bg), and the
// starfield wraps the FULL sphere, always on (the planetary body in a celestial sphere).
// Either way the dome + stars live in WORLD space (not parented to the camera), so orbiting
// pans across them. The luminaries ride the dome too: a phase-carved moon at night and a warm
// sun by day, each world-positioned from its sky-still { u, h } so it stays put as the camera orbits.
export function skyDomeScript(d) {
  return `
// --- world-fixed sky dome + night stars (emitThreeWorld sky option) ---
const SKY = ${safeJson(d)};
{
  const srgbLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = Math.min(SKY.radius * 12, 3500);
  // ATMOSPHERE sky only: a gradient dome from horizon→zenith. SPACE sky skips it — the void is
  // the scene bg and stars wrap the full sphere, so there is no dome seam to orbit past.
  if (!SKY.space) {
    const geo = new THREE.SphereGeometry(R, 48, 24);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    const zen = SKY.zenith.map(srgbLin), hor = SKY.horizon.map(srgbLin);
    for (let i = 0; i < p.count; i++) {
      const t = Math.pow(Math.max(0, Math.min(1, (p.getZ(i) / R) * 1.05 + 0.06)), 0.7); // z-up: top→zenith
      col[i*3] = hor[0] + (zen[0]-hor[0])*t; col[i*3+1] = hor[1] + (zen[1]-hor[1])*t; col[i*3+2] = hor[2] + (zen[2]-hor[2])*t;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    dome.position.set(SKY.center[0], SKY.center[1], SKY.center[2]);
    dome.renderOrder = -2;
    dome.raycast = () => {};   // NEVER footing: the dome is a huge BackSide sphere; a ground probe that
    scene.add(dome);           // misses the terrain would otherwise hit its underside (~z -3460) and drop the unit into the abyss.
  }
  if (SKY.stars > 0 && (SKY.space || SKY.day < 0.5)) {
    const nightF = SKY.space ? 1 : Math.min(1, (0.5 - SKY.day) / 0.5);  // space stars are always on
    const N = Math.round((SKY.space ? 2000 : 900) * SKY.stars * nightF);
    let s = SKY.seed >>> 0 || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // SPACE: uniform over the full sphere (el ∈ [-π/2, π/2] via asin). ATMOSPHERE: upper dome, zenith-biased.
      const az = rnd() * Math.PI * 2, el = SKY.space ? Math.asin(2 * rnd() - 1) : Math.pow(rnd(), 0.6) * (Math.PI / 2);
      const rr = R * 0.985, cr = Math.cos(el);
      sp[i*3] = SKY.center[0] + rr*cr*Math.cos(az); sp[i*3+1] = SKY.center[1] + rr*cr*Math.sin(az); sp[i*3+2] = SKY.center[2] + rr*Math.sin(el);
      const b = 0.6 + 0.4 * rnd(); sc[i*3] = b; sc[i*3+1] = b; sc[i*3+2] = b * (0.9 + 0.1 * rnd());
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    stars.renderOrder = -1;
    scene.add(stars);
  }
  if (SKY.moon) {
    const M = SKY.moon;
    const el = Math.max(0.25, Math.min(0.95, M.h)) * (Math.PI / 2);   // h: horizon→zenith
    const az = -Math.PI / 2 + (M.u - 0.5) * Math.PI;                  // front sky, opposite the sun azimuth
    const rr = R * 0.97, cr = Math.cos(el);
    const dir = [cr * Math.cos(az), cr * Math.sin(az), Math.sin(el)];
    // Phase-carved moon (lit from the right) + a soft halo, painted onto a sprite texture.
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), cx = 64, cy = 64, r = 42;
    const halo = x.createRadialGradient(cx, cy, r * 0.55, cx, cy, 64);
    halo.addColorStop(0, 'rgba(226,229,240,' + (0.4 * (M.nightFactor ?? 1)).toFixed(2) + ')'); halo.addColorStop(1, 'rgba(226,229,240,0)');
    x.fillStyle = halo; x.fillRect(0, 0, 128, 128);
    const ph = Math.max(0, Math.min(1, M.phase ?? 1)), tw = r * (2 * ph - 1);
    x.fillStyle = 'rgb(234,236,245)';
    x.beginPath();
    x.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);                       // lit right limb (semicircle)
    // terminator: bulge LEFT (gibbous, tw>0) or RIGHT (crescent, tw<0) of the lit half
    x.ellipse(cx, cy, Math.abs(tw), r, 0, Math.PI / 2, -Math.PI / 2, tw < 0);
    x.fill();
    const msp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    const sz = R * 0.05 * (M.size || 1);
    msp.position.set(SKY.center[0] + dir[0] * rr, SKY.center[1] + dir[1] * rr, SKY.center[2] + dir[2] * rr);
    msp.scale.set(sz, sz, 1); msp.renderOrder = -1;
    scene.add(msp);
  }
  if (SKY.sun) {
    const S = SKY.sun;
    // Two placements: a 3D world DIR (planetary/space — pin the sun at the true light direction,
    // so it sits over the lit hemisphere as the camera orbits) or the front-sky { u, h } horizon
    // projection (room/city scenes). A star in the void reads white; a horizon sun warms low down.
    let dir, warmth;
    if (Array.isArray(S.dir)) {
      const L = Math.hypot(S.dir[0], S.dir[1], S.dir[2]) || 1;
      dir = [S.dir[0] / L, S.dir[1] / L, S.dir[2] / L];
      warmth = 0;
    } else {
      const el = Math.max(0.25, Math.min(0.95, S.h)) * (Math.PI / 2); // h: horizon→zenith
      const az = -Math.PI / 2 + (S.u - 0.5) * Math.PI;                // same projection as the moon
      const cr = Math.cos(el);
      dir = [cr * Math.cos(az), cr * Math.sin(az), Math.sin(el)];
      warmth = Math.max(0, Math.min(1, 1 - el / (Math.PI / 2)));      // low sun → sunset orange
    }
    const rr = R * 0.97;
    // Warm luminary disc + a soft glow halo (no phase carving — the sun is always full),
    // painted onto a sprite texture. Warmer toward the horizon, scaled by the glow knob.
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), cx = 64, cy = 64, r = 30;
    const cr2 = Math.round(255), cg2 = Math.round(252 - 44 * warmth), cb2 = Math.round(240 - 90 * warmth);
    const core = 'rgb(' + cr2 + ',' + cg2 + ',' + cb2 + ')';
    const halo = x.createRadialGradient(cx, cy, r * 0.5, cx, cy, 64);
    halo.addColorStop(0, 'rgba(' + cr2 + ',' + cg2 + ',' + cb2 + ',' + (0.55 * (S.glow || 1)).toFixed(2) + ')');
    halo.addColorStop(1, 'rgba(' + cr2 + ',' + cg2 + ',' + cb2 + ',0)');
    x.fillStyle = halo; x.fillRect(0, 0, 128, 128);
    x.fillStyle = core; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    const ssp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    const sz = R * 0.06 * (S.size || 1);
    ssp.position.set(SKY.center[0] + dir[0] * rr, SKY.center[1] + dir[1] * rr, SKY.center[2] + dir[2] * rr);
    ssp.scale.set(sz, sz, 1); ssp.renderOrder = -1;
    scene.add(ssp);
  }
}`;
}
