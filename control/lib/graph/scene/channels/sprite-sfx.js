import { safeJson } from '../emit-util.js';
import { SPRITE_VERBS } from '../../game/glyph-sfx-sprites.js';

// In-page SPRITE SFX channel (game-ui-language.plan.md §V, geometry sfx backend). Each layer =
// { verb, cc:[x,y,z], color:[r,g,b], rate, size, params }. One additive camera-facing sprite per
// emission BEAD; each frame the verb's path fn (from glyph-sfx-sprites.js, stringified here so the
// module stays the one source of truth) is evaluated at ph = t/1000 × rate and written to each
// sprite's position/scale/opacity. Assigns the module-scoped `stepSpriteSfx`, which __mojStep calls
// every frame (deterministic in every mode, like fx — so it renders in bakes/audits too). Absent
// sfx ⇒ this block is not emitted (byte-identical). Cost is O(beads) per frame — no fullscreen march.
export function spriteSfxChannelScript(layers) {
  const verbSrc = Object.entries(SPRITE_VERBS).map(([k, v]) => `${JSON.stringify(k)}: ${v.beads.toString()}`).join(',\n    ');
  const defs = Object.fromEntries(Object.entries(SPRITE_VERBS).map(([k, v]) => [k, v.defaults]));
  return `
// --- sprite sfx channel (game UI language §V: geometry sfx backend) ---
{
  const TAU = 6.283185307179586;
  const frac = (x) => x - Math.floor(x);
  const hsh = (a, b) => frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
  const __sfxVerb = {
    ${verbSrc}
  };
  const __sfxDef = ${safeJson(defs)};
  const __sfxLayers = ${safeJson(layers)};
  const __sfxTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(0.6, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
  const __sfxPools = __sfxLayers.map((L) => {
    const p = Object.assign({}, __sfxDef[L.verb], L.params || {});
    const n = __sfxVerb[L.verb](L.cc, 0, p).length;
    const sprs = [];
    for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({ map: __sfxTex, color: new THREE.Color(L.color[0], L.color[1], L.color[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }); const s = new THREE.Sprite(m); s.visible = false; scene.add(s); sprs.push(s); }
    return { L, p, sprs };
  });
  stepSpriteSfx = (tMs) => {
    const ph = (tMs || 0) / 1000;
    for (const pool of __sfxPools) {
      const bs = __sfxVerb[pool.L.verb](pool.L.cc, ph * (pool.L.rate || 1), pool.p);
      for (let i = 0; i < pool.sprs.length; i++) {
        const b = bs[i], s = pool.sprs[i];
        if (!b || b.w < 0.05) { s.visible = false; continue; }
        s.visible = true; s.position.set(b.p[0], b.p[1], b.p[2]);
        const sz = (pool.L.size || 0.6) * (0.35 + 0.65 * Math.min(1, b.w));
        s.scale.set(sz, sz, 1); s.material.opacity = Math.min(1, 0.35 + 0.65 * b.w);
      }
    }
  };
}`;
}
