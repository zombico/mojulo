import { safeJson } from '../emit-util.js';

// In-page MARKS channel: a pointer at a world point — the strength sensor's weak spot, or any authored mark.
// Only the rings animate: two rings ripple out from the point (billboarded, drawn through the solid). The part,
// the arrow (in from outside along `dir`) and the label at its tail stay still; the label only follows the
// camera so it stays pinned to the arrow. Each mark = { at:[x,y,z], dir:[x,y,z] (unit, outward), size, color:'#rrggbb', label? }, in the
// scene's own units. Everything is a function of `t` (no clock, no dice), so ?t= stills and bakes are
// deterministic. Assigns the module-scoped `stepMarks`. Absent marks ⇒ this block is not emitted
// (byte-identical). Nothing here is a face, so no mesh export (GLB, STL, 3MF, USD) ever carries it.
export function marksChannelScript(marks) {
  return `
// --- marks channel (an animated pointer; the part stays still) ---
{
  const __mkList = ${safeJson(marks)};
  const __mkLayer = document.createElement('div');
  __mkLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  wrap.appendChild(__mkLayer);
  const __mkV = new THREE.Vector3();
  const __mk = __mkList.map((m) => {
    const col = new THREE.Color(m.color);
    const at = new THREE.Vector3(m.at[0], m.at[1], m.at[2]);
    const dir = new THREE.Vector3(m.dir[0], m.dir[1], m.dir[2]).normalize();
    const over = (o, ord) => { o.renderOrder = 990 + ord; o.traverse((c) => { if (c.material) { c.material.depthTest = false; c.material.depthWrite = false; c.material.transparent = true; } c.renderOrder = 990 + ord; }); scene.add(o); return o; };
    const ring = () => over(new THREE.Mesh(new THREE.RingGeometry(m.size * 0.42, m.size * 0.5, 48), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })), 1);
    const rings = [ring(), ring()];
    const dot = over(new THREE.Mesh(new THREE.SphereGeometry(m.size * 0.11, 16, 12), new THREE.MeshBasicMaterial({ color: col })), 2);
    dot.position.copy(at);
    // the arrow and its label are fixed: no motion but the rings'
    const tail = at.clone().addScaledVector(dir, m.size * 2.7);
    const arrow = over(new THREE.ArrowHelper(dir.clone().negate(), tail, m.size * 2.2, col.getHex(), m.size * 0.6, m.size * 0.36), 3);
    let el = null;
    if (m.label) {
      el = document.createElement('div');
      el.textContent = m.label;
      el.style.cssText = 'position:absolute;transform:translate(-50%,-100%) translateY(-6px);white-space:nowrap;font:600 12px/1.3 system-ui,sans-serif;padding:4px 8px;border-radius:6px;color:#fff;background:rgba(14,16,20,.82);border:1px solid ' + m.color + ';box-shadow:0 0 0 1px rgba(0,0,0,.25)';
      __mkLayer.appendChild(el);
    }
    return { m, at, tail, rings, el };
  });
  stepMarks = (t) => {
    const s = (t || 0) / 1000;
    for (const k of __mk) {
      const period = k.m.period || 1.6;
      k.rings.forEach((r, i) => {
        const f = ((s / period) + i * 0.5) % 1;
        r.position.copy(k.at); r.quaternion.copy(camera.quaternion);
        const sc = 0.4 + 2.1 * f; r.scale.set(sc, sc, sc);
        r.material.opacity = 0.9 * (1 - f) * (1 - f);
      });
      if (k.el) {
        __mkV.copy(k.tail).project(camera);
        if (__mkV.z > 1) { k.el.style.display = 'none'; continue; }
        k.el.style.display = '';
        // kept inside the view: the label slides along the edge rather than running off it
        const W = wrap.clientWidth, H = wrap.clientHeight, half = k.el.offsetWidth / 2 + 8;
        k.el.style.left = Math.min(W - half, Math.max(half, (__mkV.x * 0.5 + 0.5) * W)) + 'px';
        k.el.style.top = Math.min(H - 8, Math.max(k.el.offsetHeight + 14, (-__mkV.y * 0.5 + 0.5) * H)) + 'px';
      }
    }
  };
  window.__mojMarks = { count: __mk.length };
}`;
}

/** Normalize authored or derived marks; drops malformed entries. `size` and `dir` must already be resolved. */
export function normalizeMarks(list) {
  if (!Array.isArray(list)) return [];
  const hex = /^#[0-9a-f]{6}$/i;
  const v3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  return list.filter((m) => m && v3(m.at) && v3(m.dir) && Number.isFinite(m.size) && m.size > 0).map((m) => ({
    at: m.at, dir: m.dir, size: m.size, color: hex.test(m.color) ? m.color : '#f5a524',
    ...(typeof m.label === 'string' && m.label ? { label: m.label.slice(0, 160) } : {}),
    ...(Number.isFinite(m.period) && m.period > 0.2 ? { period: m.period } : {}),
  }));
}
