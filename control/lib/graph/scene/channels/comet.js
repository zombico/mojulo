import { safeJson } from '../emit-util.js';

// In-page script: the COMET channel. A comet rides its equal-dt Kepler `path` like a tracer, but it
// also grows a coma + two tails whose geometry is recomputed EVERY FRAME relative to the Sun: the ion
// tail is straight anti-solar (normalize(pos − sun)), the dust tail bends from anti-solar toward the
// trailing orbital direction (−velocity) so it curves and lags. Both bloom near perihelion and shrink
// to nothing near aphelion via `activity` (0 at aphelion → 1 at perihelion). All sprites are additive
// glows (same idiom as the tracer channel); a faint orbit track line + a Sun glow + a real-units
// readout round it out. Purely additive — only emitted when the caller passes a non-empty `comets`.
export function cometChannelScript(comets) {
  return `
const COMETS = ${safeJson(comets)};
function cometTex(rgb, soft) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); const c = rgb.join(',');
  g.addColorStop(0, 'rgba(255,255,255,' + (soft ? 0.85 : 1) + ')'); g.addColorStop(0.25, 'rgba(' + c + ',0.85)');
  g.addColorStop(0.6, 'rgba(' + c + ',0.30)'); g.addColorStop(1, 'rgba(' + c + ',0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill(); return new THREE.CanvasTexture(cv);
}
function cometSprite(tex, op, sz) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
  // decorative glow — opt out of raycasts (ground probes and picks alike; see __ground's E8 note).
  s.raycast = () => {};
  s.scale.set(sz, sz, 1); s.renderOrder = 3; scene.add(s); return s;
}
function cometAt(path, u) {
  const uu = ((u % 1) + 1) % 1; const f = uu * (path.length - 1); const i = Math.floor(f), a = f - i;
  const p0 = path[i], p1 = path[Math.min(i + 1, path.length - 1)];
  return [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
}
const _csub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _clen = (a) => Math.hypot(a[0], a[1], a[2]) || 1e-6;
const _cnorm = (a) => { const L = _clen(a); return [a[0] / L, a[1] / L, a[2] / L]; };
const _clerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cometRigs = COMETS.map((cm) => {
  const sun = cm.sun || [0, 0, 0];
  if (cm.track !== false) {
    const tg = new THREE.BufferGeometry().setFromPoints(cm.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const ln = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: cm.trackColor != null ? cm.trackColor : 0x39507a, transparent: true, opacity: 0.5 }));
    // decorative track — opt out of raycasts (see __ground's E8 note; Line's default threshold is fat).
    ln.raycast = () => {};
    ln.renderOrder = 1; scene.add(ln);
  }
  const sg = cometSprite(cometTex(cm.sunColor || [255, 210, 110], true), 0.95, cm.sunSize || 3);
  sg.position.set(sun[0], sun[1], sun[2]);
  const nuc = cometSprite(cometTex((cm.nucleus && cm.nucleus.color) || [240, 240, 220], false), 1, (cm.nucleus && cm.nucleus.size) || 0.6);
  const coma = cometSprite(cometTex((cm.coma && cm.coma.color) || [170, 215, 255], true), 0.4, 1);
  const ion = cm.ion || {}; const ionN = Math.max(0, Math.floor(ion.count != null ? ion.count : 22));
  const ionTex = cometTex(ion.color || [120, 180, 255], true);
  const ionSprites = Array.from({ length: ionN }, (_, i) => cometSprite(ionTex, 0, (ion.width || 0.5) * (1 - 0.4 * i / (ionN + 1))));
  const dust = cm.dust || {}; const dustN = Math.max(0, Math.floor(dust.count != null ? dust.count : 18));
  const dustTex = cometTex(dust.color || [240, 210, 150], true);
  const dustSprites = Array.from({ length: dustN }, (_, i) => cometSprite(dustTex, 0, (dust.width || 0.7) * (1 + 0.6 * i / (dustN + 1))));
  let ro = null;
  if (cm.readout !== false) { ro = document.createElement('div'); ro.className = 'moj-readout'; wrap.appendChild(ro); }
  return { cm, sun, nuc, coma, ion, ionSprites, dust, dustSprites, ro };
});
stepComets = (t) => {
  const sec = t / 1000;
  for (const rig of cometRigs) {
    const cm = rig.cm; const u = sec / cm.period;
    const pos = cometAt(cm.path, u); const ahead = cometAt(cm.path, u + 0.003);
    const velDir = _cnorm(_csub(ahead, pos));
    const radial = _csub(pos, rig.sun); const r = _clen(radial); const anti = _cnorm(radial);
    const span = Math.max(1e-6, cm.rAphe - cm.rPeri);
    const rn = Math.max(0, Math.min(1, (r - cm.rPeri) / span));
    const activity = Math.pow(1 - rn, cm.sharp || 2.2);
    rig.nuc.position.set(pos[0], pos[1], pos[2]);
    rig.coma.position.set(pos[0], pos[1], pos[2]);
    const comaSz = ((cm.nucleus && cm.nucleus.size) || 0.6) + ((cm.coma && cm.coma.size) || 2.0) * activity;
    rig.coma.scale.set(comaSz, comaSz, 1); rig.coma.material.opacity = 0.12 + 0.5 * activity;
    const ionLen = (rig.ion.maxLen || 10) * activity; const ionN = rig.ionSprites.length;
    rig.ionSprites.forEach((sp, i) => {
      const f = (i + 1) / ionN;
      sp.position.set(pos[0] + anti[0] * ionLen * f, pos[1] + anti[1] * ionLen * f, pos[2] + anti[2] * ionLen * f);
      sp.material.opacity = 0.6 * (1 - i / (ionN + 1)) * Math.min(1, activity * 1.4);
    });
    const dustLen = (rig.dust.maxLen || 7) * activity; const dustN = rig.dustSprites.length; const curve = rig.dust.curve != null ? rig.dust.curve : 0.6;
    rig.dustSprites.forEach((sp, i) => {
      const f = (i + 1) / dustN; const dir = _cnorm(_clerp(anti, [-velDir[0], -velDir[1], -velDir[2]], curve * f));
      sp.position.set(pos[0] + dir[0] * dustLen * f, pos[1] + dir[1] * dustLen * f, pos[2] + dir[2] * dustLen * f);
      sp.material.opacity = 0.5 * (1 - i / (dustN + 1)) * Math.min(1, activity * 1.4);
    });
    if (rig.ro) {
      const idx = Math.round((((u % 1) + 1) % 1) * (cm.dist.length - 1));
      rig.ro.innerHTML = '<b>' + (cm.name || 'comet') + '</b>'
        + '<span>r = ' + cm.dist[idx].toFixed(2) + ' ' + (cm.distUnit || 'AU') + '</span>'
        + '<span class="v">v = ' + cm.speed[idx].toFixed(1) + ' ' + (cm.speedUnit || 'km/s') + '</span>'
        + '<span class="a">tail → away from Sun</span>';
    }
  }
};`;
}
