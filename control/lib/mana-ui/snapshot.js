/**
 * MANA-UI's SNAPSHOT — what a mounted view looks like this instant, as an image another surface can draw: a headset's
 * panel (scene/channels/xr.js), a texture, an engine's preview. It is the DOM backend's own drawing, not a second one:
 * the view's elements and the sheet they were drawn under, rendered by the browser itself into an SVG image
 * (a foreignObject), so the layout, the theme, the focus's words, the pseudo-elements and the motion carry over by
 * construction. Nothing is restyled on the way.
 *
 * MOTION BAKED AT THIS INSTANT: whatever an animation or a transition is moving under the view (the Web Animations API
 * sees the sheet's own, the keyframes say which properties) is written into the copy at the value it holds now, and
 * nothing in the copy animates; an animation already over draws as it ended. So a snapshot taken each frame plays the
 * view's motion as the screen plays it, on any renderer.
 *
 * A data: URL, never a blob: Chromium does not taint a canvas a data: SVG with a foreignObject is drawn into (a WebGL
 * texture takes it), and does taint one from a blob:. Safari taints both: a headset on Safari draws nothing from it.
 *
 * SINGLE SOURCE OF TRUTH, the kernel's discipline: everything lives inside `buildManaSnapshot()`, which references
 * nothing outside itself, so a page runs the same code by emitting `manaSnapshotSource()`.
 *
 *   svgOf(root, css, { w?, h?, crop? })  → the SVG text: `root` (a mounted view's .mana-root) copied with its mount's
 *                                         classes around it (the sheet's scope), `css` (the sheet it was drawn under),
 *                                         the motion frozen; w × h its size (the root's own by default); crop: a
 *                                         { x, y, w, h } of it alone (an anchor's box)
 *   frozenRules(root)                   → the CSS that bakes the root's moving properties into a copy marked by `data-snap`
 *                                         (exported for its test: the copy's marks are set by svgOf)
 *   imageOf(svg)                        → a Promise of an <img> that has decoded it (a data: URL)
 */
export function buildManaSnapshot() {
  const ns = 'http://www.w3.org/1999/xhtml';
  const ms = (t) => (typeof t === 'number' && isFinite(t) ? Math.round(t * 100) / 100 : 0);

  // the elements under a root, the root first, in document order (the copy walks the same order)
  const walk = (root) => [root, ...root.querySelectorAll('*')];

  /**
   * What bakes the root's motion into a copy whose elements carry `data-snap="<index in walk order>"`: for each element
   * (or ::before / ::after) an animation or a transition is moving, every property it moves at the value it holds this
   * instant (the keyframes say which; the computed style says what). Nothing in the copy animates (the sheet's tail
   * holds it still), so it is this frame however long the image takes to decode, on any renderer.
   * → { rules: [css], marks: Set of indices }
   */
  const kebab = (p) => p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const META = new Set(['offset', 'computedOffset', 'easing', 'composite']);
  function frozenRules(root) {
    const els = walk(root), index = new Map(els.map((e, i) => [e, i])), by = new Map(), rules = [], marks = new Set();
    const anims = root.getAnimations ? root.getAnimations({ subtree: true }) : [];
    for (const a of anims) {
      const fx = a.effect, t = fx && fx.target;
      if (!t || !index.has(t)) continue;
      const pseudo = fx.pseudoElement || '', key = `${index.get(t)}|${pseudo}`;
      const G = by.get(key) || by.set(key, { t, pseudo, i: index.get(t), props: new Set() }).get(key);
      // (a transition moves its one property; an animation those its keyframes name)
      if (a.transitionProperty) G.props.add(a.transitionProperty);
      else if (fx.getKeyframes) for (const k of fx.getKeyframes()) for (const p in k) if (!META.has(p)) G.props.add(kebab(p));
    }
    const view = root.ownerDocument && root.ownerDocument.defaultView;
    for (const { t, pseudo, i, props } of by.values()) {
      const cs = view ? view.getComputedStyle(t, pseudo || null) : null;
      if (!cs) continue;
      const decl = [];
      for (const p of props) { const v = cs.getPropertyValue(p); if (v) decl.push(`${p}:${v}!important`); }
      if (decl.length) { rules.push(`[data-snap="${i}"]${pseudo}{${decl.join(';')}}`); marks.add(i); }
    }
    return { rules, marks };
  }

  // what holds the copy still: nothing in it animates or transitions (what was moving is baked at its instant above)
  const STILL = '*,*::before,*::after{animation:none!important;transition:none!important}';

  function svgOf(root, css, o) {
    const opts = o || {}, doc = root.ownerDocument, r = root.getBoundingClientRect();
    const W = Math.max(1, Math.round(opts.w || r.width)), H = Math.max(1, Math.round(opts.h || r.height));
    const { rules, marks } = frozenRules(root);
    const copy = root.cloneNode(true), mine = walk(copy);
    for (const i of marks) if (mine[i]) mine[i].setAttribute('data-snap', String(i));
    // (the root is laid out in the image's box, not the window's; the mount's classes around it, so the sheet's scope holds)
    copy.setAttribute('data-snap-root', '');
    const mount = root.parentElement, wrap = doc.createElementNS(ns, 'div');
    if (mount && mount.getAttribute('class')) wrap.setAttribute('class', mount.getAttribute('class'));
    wrap.setAttribute('style', `position:relative;width:${W}px;height:${H}px;overflow:hidden;transform:none;animation:none`);
    const style = doc.createElementNS(ns, 'style');
    style.textContent = `${css || ''}\n${STILL}\n[data-snap-root]{position:absolute!important;left:0!important;top:0!important;width:${W}px!important;height:${H}px!important}\n${rules.join('\n')}`;
    wrap.appendChild(style);
    wrap.appendChild(copy);
    const c = opts.crop, vb = c ? `${ms(c.x)} ${ms(c.y)} ${Math.max(1, ms(c.w))} ${Math.max(1, ms(c.h))}` : `0 0 ${W} ${H}`;
    const sw = c ? Math.max(1, Math.round(c.w)) : W, sh = c ? Math.max(1, Math.round(c.h)) : H;
    const body = new XMLSerializer().serializeToString(wrap);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="${vb}"><foreignObject x="0" y="0" width="${W}" height="${H}">${body}</foreignObject></svg>`;
  }

  function imageOf(svg) {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return (img.decode ? img.decode() : new Promise((ok, no) => { img.onload = ok; img.onerror = no; })).then(() => img);
  }

  return { svgOf, frozenRules, imageOf, STILL };
}

export const manaSnapshot = buildManaSnapshot();
/** The snapshot as page source: an expression a page assigns (`const snap = ${manaSnapshotSource()};`). */
export const manaSnapshotSource = () => `(${buildManaSnapshot.toString()})()`;
