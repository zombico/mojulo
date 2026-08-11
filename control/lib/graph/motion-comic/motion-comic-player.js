/**
 * motion-comic player emitter — the recipe rendered as a self-contained,
 * dependency-free HTML page (the css3d-scene discipline: no CDN, no framework,
 * opens from disk). ONE emitter serves both faces: the live route and the
 * ?download=1 single-file export — they can never drift because they are the
 * same string (motion-comic.plan.md).
 *
 * Time is the click. The client holds the story as data and computes state as
 * a pure fold `state(scene, i) = base ∘ events[0..i]`; navigation is exactly
 * four moves — next event / final page state (forward), prev event / scene
 * start (back). Transitions are presentation garnish (~0.3–0.6s CSS, instant
 * under prefers-reduced-motion); jumps and unwinds apply instantly.
 *
 * Pure function of (manifest, assets): no Date, no dice — the same inputs emit
 * byte-identical HTML. `assets` maps `${sceneId}/${placementId}` →
 * { src, pageViewBox?, zonesByPanel? }; the route resolves sketch faces into
 * data URIs so the emitted page is self-contained even when served live.
 */

import { comicWordmark } from '@/lib/graph/image-outcomes/wordmark-treatment';

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Render a `letter` delta's SFX lettering to a standalone SVG data URI at
// emit time: mojulo owns the letter SHAPES (real glyph contours from the
// vendored font shelf via the cover system's comic-wordmark treatment —
// 3D block extrude + keyline + gradient face, byte-stable, any text) and
// composites them as a Z-INDEX OVERLAY above the art. The image worker
// never letters; placement and treatment are the composer's job.
function letterSvgDataUri(letter) {
  const zone = {
    w: Math.max(120, Math.round(letter.at.w * 2)),
    h: Math.max(60, Math.round(letter.at.h * 2)),
  };
  const opts = {};
  if (letter.effect === 'xmen-90s') { opts.extrude = 14; opts.slant = 0.18; }
  else if (letter.effect === 'none') { opts.extrude = 0; }
  if (letter.fill) {
    opts.colors = { faceTop: letter.fill, faceHi: letter.fill, faceMid: letter.fill, faceHorizon: letter.fill, faceLo: letter.fill };
  }
  if (letter.shadowFill) {
    opts.colors = { ...(opts.colors || {}), block: letter.shadowFill, blockEdge: letter.shadowFill };
  }
  if (letter.stroke) {
    opts.colors = { ...(opts.colors || {}), outline: letter.stroke };
  }
  const svg = comicWordmark(letter.text, opts, zone);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

const SUBTITLE_DEFAULTS = {
  at: 'bottom',
  enter: 'fade',
  exit: 'fade',
  font: "Georgia, 'Times New Roman', serif",
  size: 20,
  color: '#ffffff',
  bg: 'rgba(0,0,0,0.62)',
};

// Map a rect in page coords onto the placement's box rect. The placement's
// SOURCE SPACE is the panel's bounds for a panel crop (the canonical grain —
// the panel is the showcase), or the whole page viewBox for a whole-page
// face; either way the art is drawn object-fit:fill into `at`, so the
// mapping is a plain scale from that source rect.
function zoneToBoxRect(zone, sourceRect, at) {
  const sx = at.w / sourceRect.w;
  const sy = at.h / sourceRect.h;
  return {
    x: at.x + (zone.x - sourceRect.x) * sx,
    y: at.y + (zone.y - sourceRect.y) * sy,
    w: zone.w * sx,
    h: zone.h * sy,
  };
}

// Deterministic default anchor for an inline say that names a placement but no
// rect: a band across the placement's upper region.
function anchorRect(at) {
  return { x: at.x + at.w * 0.08, y: at.y + at.h * 0.05, w: at.w * 0.84, h: at.h * 0.2 };
}

// A balloon that reads THROUGH a placement is anchored to it: its rect as
// fractions of the placement's rect at say time, so the player re-projects
// it through the CURRENT rect — balloons ride their panel's moves.
function balloonAnchor(id, rect, at) {
  return {
    id,
    fx: (rect.x - at.x) / at.w,
    fy: (rect.y - at.y) / at.h,
    fw: rect.w / at.w,
    fh: rect.h / at.h,
  };
}

// `live` maps placement id → { placement, asset } AT THIS POINT in the fold
// (swaps update the active art, so a say after an impact frame reads the
// impact panel's zones).
function resolveSayForClient(say, live, context) {
  const out = { carrier: say.carrier || 'speech' };
  if (say.panel !== undefined) {
    const entry = live.get(say.of);
    if (!entry) throw new Error(`${context}: say.of '${say.of}' is not a placed source`);
    const { placement, asset } = entry;
    const ref = placement.source.ref ?? placement.source.pageRef;
    if (!asset?.pageViewBox || !asset?.zonesByPanel) {
      throw new Error(`${context}: placement '${placement.id}' (${ref}) is not a sequential-art page — zone says need panels[].bubbleZones`);
    }
    const zones = asset.zonesByPanel[say.panel];
    if (!zones) throw new Error(`${context}: page '${ref}' has no panel '${say.panel}'`);
    const zone = zones[say.zone];
    if (!zone) throw new Error(`${context}: panel '${say.panel}' has no bubbleZones[${say.zone}]`);
    if (!zone.lettering) throw new Error(`${context}: panel '${say.panel}' bubbleZones[${say.zone}] carries no lettering text`);
    out.text = zone.lettering;
    const sourceRect = asset.panelBounds
      ?? { x: 0, y: 0, w: asset.pageViewBox.width, h: asset.pageViewBox.height };
    out.rect = zoneToBoxRect(zone, sourceRect, placement.at);
    out.anchor = balloonAnchor(say.of, out.rect, placement.at);
    if (/thought/i.test(zone.label || '')) out.carrier = 'thought';
    else if (/shout/i.test(zone.label || '')) out.carrier = 'shout';
    else if (/narration|caption/i.test(zone.label || '')) out.carrier = 'narration';
  } else {
    out.text = say.text;
    if (say.speaker) out.speaker = say.speaker;
    if (say.at) {
      out.rect = say.at;
    } else if (say.of) {
      const entry = live.get(say.of);
      if (!entry) throw new Error(`${context}: say.of '${say.of}' is not a placed source`);
      out.rect = anchorRect(entry.placement.at);
      out.anchor = balloonAnchor(say.of, out.rect, entry.placement.at);
    }
  }
  if (say.tail) out.tail = say.tail;
  if (say.enter) out.enter = say.enter;
  if (say.exit) out.exit = say.exit;
  if (say.style) out.style = say.style;
  return out;
}

/** Lower the normalized manifest + resolved assets into the client document. */
export function buildPlayerDoc(manifest, assets) {
  const doc = {
    title: manifest.title || 'motion comic',
    box: manifest.box,
    scenes: [],
  };
  for (const scene of manifest.scenes) {
    const mode = scene.lettering?.mode ?? manifest.lettering.mode;
    const subtitles = {
      ...SUBTITLE_DEFAULTS,
      ...(manifest.lettering.subtitles || {}),
      ...(scene.lettering?.subtitles || {}),
    };
    const live = new Map(); // id → { placement, asset } at this fold point
    const variantCounts = new Map();
    const lowerPlacement = (p) => {
      if (!p.at) {
        throw new Error(`scene '${scene.id}': placement '${p.id}' has slot but no resolved at — run resolveMotionComicLayout at mint`);
      }
      const asset = assets[`${scene.id}/${p.id}`];
      if (!asset?.src) throw new Error(`scene '${scene.id}': no resolved asset for placement '${p.id}' (${p.source.ref ?? p.source.pageRef})`);
      live.set(p.id, { placement: p, asset });
      return { id: p.id, src: asset.src, at: p.at, frame: p.frame };
    };
    const base = (scene.base || []).map(lowerPlacement);
    const events = scene.events.map((event, i) => ({
      id: event.id,
      note: event.note,
      do: event.do.map((delta, j) => {
        const context = `scene '${scene.id}' events[${i}].do[${j}]`;
        if (delta.show) {
          return { t: 'show', placement: lowerPlacement(delta.show), enter: delta.enter || 'fade' };
        }
        if (delta.hide) return { t: 'hide', id: delta.hide, exit: delta.exit || 'fade' };
        if (delta.swap) {
          const n = (variantCounts.get(delta.swap.of) || 0) + 1;
          variantCounts.set(delta.swap.of, n);
          const asset = assets[`${scene.id}/${delta.swap.of}#v${n}`];
          if (!asset?.src) throw new Error(`${context}: no resolved asset for swap variant '${delta.swap.of}#v${n}'`);
          const prev = live.get(delta.swap.of);
          live.set(delta.swap.of, { placement: { ...prev.placement, source: delta.swap.to }, asset });
          return { t: 'swap', id: delta.swap.of, src: asset.src, enter: delta.enter || 'cut' };
        }
        if (delta.move) {
          const prev = live.get(delta.move.of);
          live.set(delta.move.of, { ...prev, placement: { ...prev.placement, at: delta.move.to } });
          return { t: 'move', id: delta.move.of, to: delta.move.to, enter: delta.enter || 'ease' };
        }
        if (delta.letter) {
          const out = {
            t: 'letter',
            src: letterSvgDataUri(delta.letter),
            rect: delta.letter.at,
            rotate: delta.letter.rotate ?? -6,
            enter: delta.enter || 'slam-in',
          };
          if (delta.letter.of) {
            const entry = live.get(delta.letter.of);
            if (!entry) throw new Error(`${context}: letter.of '${delta.letter.of}' is not a placed source`);
            out.anchor = balloonAnchor(delta.letter.of, delta.letter.at, entry.placement.at);
          }
          return out;
        }
        if (delta.say) {
          const say = resolveSayForClient(delta.say, live, context);
          return { t: 'say', ...say };
        }
        if (delta.focus !== undefined) {
          return { t: 'focus', on: delta.focus === false ? false : delta.focus.on };
        }
        if (delta.hold) return { t: 'hold' };
        return { t: 'clear' };
      }),
    }));
    doc.scenes.push({ id: scene.id, note: scene.note, mode, subtitles, base, events });
  }
  return doc;
}

export function renderMotionComicHtml(manifest, { assets = {}, docTitle } = {}) {
  const doc = buildPlayerDoc(manifest, assets);
  const title = docTitle || doc.title;
  const { width, height, matte } = manifest.box;
  const json = JSON.stringify(doc).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; background: #14161a; color: #cfd3da;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden; }
  #stage { position: absolute; inset: 0 0 46px 0; display: flex;
    align-items: center; justify-content: center; touch-action: manipulation; }
  #boxwrap { position: relative; width: ${width}px; height: ${height}px;
    transform-origin: center center; flex: none; }
  #box { position: absolute; inset: 0; background: ${matte}; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.08); }
  .scene { position: absolute; inset: 0; display: none; }
  .scene.on { display: block; }
  .pl { position: absolute; display: none; z-index: 1; }
  .pl.on { display: block; }
  .pl.moving { transition: left 0.55s ease, top 0.55s ease, width 0.55s ease, height 0.55s ease; }
  @media (prefers-reduced-motion: reduce) { .pl.moving { transition: none; } }
  .lt { position: absolute; display: none; z-index: 2; pointer-events: none;
    transform: rotate(var(--rot, 0deg)); }
  .lt.on { display: block; }
  .lt img { width: 100%; height: 100%; display: block; }
  .enter-slam { animation: a-slam 0.34s cubic-bezier(0.2, 1.1, 0.35, 1) both; }
  @keyframes a-slam {
    0% { opacity: 0; transform: scale(2.6) rotate(var(--rot, 0deg)); }
    62% { opacity: 1; transform: scale(0.9) rotate(var(--rot, 0deg)); }
    100% { opacity: 1; transform: scale(1) rotate(var(--rot, 0deg)); }
  }
  @media (prefers-reduced-motion: reduce) { .enter-slam { animation: none; } }
  .pl img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; display: block; }
  .pl.f-panel { border: 3px solid #111; background: #fff; }
  .bl { position: absolute; display: none; z-index: 3; color: #111; background: #fff;
    border: 2.5px solid #111; padding: 2% 3%; overflow: visible;
    text-align: center; font-family: 'Comic Sans MS', 'Chalkboard SE', 'Segoe Print', cursive; }
  .bl .tail { position: absolute; width: 20px; height: 20px; }
  .pl.dim, .bl.dim, .lt.dim { filter: brightness(0.42) saturate(0.35); }
  .pl, .bl, .lt { transition: filter 0.35s ease; }
  @media (prefers-reduced-motion: reduce) { .pl, .bl, .lt { transition: none; } }
  .bl.on { display: flex; align-items: center; justify-content: center; }
  .bl.c-speech { border-radius: 42% / 55%; }
  .bl.c-thought { border-radius: 50%; border-style: dashed; }
  .bl.c-shout { border-radius: 4px; border-width: 4px; font-weight: 700; text-transform: uppercase; }
  .bl.c-narration { border-radius: 0; text-align: left; align-items: flex-start; justify-content: flex-start; }
  .sub { position: absolute; left: 4%; right: 4%; display: none; z-index: 4;
    text-align: center; padding: 0.35em 0.7em; border-radius: 4px;
    line-height: 1.35; white-space: pre-wrap; }
  .sub.on { display: block; }
  .enter-fade { animation: a-fade 0.4s ease-out both; }
  .enter-pop { animation: a-pop 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  .enter-slide { animation: a-slide 0.4s ease-out both; }
  .scene.enter-fade { animation: a-fade 0.45s ease-out both; }
  @keyframes a-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes a-pop { from { opacity: 0; transform: scale(0.55); } to { opacity: 1; transform: scale(1); } }
  @keyframes a-slide { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: translateX(0); } }
  @media (prefers-reduced-motion: reduce) {
    .enter-fade, .enter-pop, .enter-slide, .scene.enter-fade { animation: none; }
  }
  #bar { position: absolute; left: 0; right: 0; bottom: 0; height: 46px;
    display: flex; align-items: center; gap: 8px; padding: 0 10px;
    background: #101216; border-top: 1px solid rgba(255,255,255,0.07);
    user-select: none; -webkit-user-select: none; }
  #bar button { background: #1c2027; color: #cfd3da; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px; height: 30px; min-width: 38px; font-size: 14px; cursor: pointer; }
  #bar button:hover { background: #262b34; }
  #rail { flex: 1; display: flex; gap: 3px; height: 6px; }
  .seg { flex: 1; background: rgba(255,255,255,0.12); border-radius: 3px; overflow: hidden; }
  .seg i { display: block; height: 100%; width: 0; background: #e8c14a; }
  #pos { font-size: 11px; opacity: 0.75; min-width: 86px; text-align: right;
    font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<div id="stage">
  <div id="boxwrap"><div id="box"></div></div>
</div>
<div id="bar">
  <button id="b-start" title="Scene start (Home)">&#9198;</button>
  <button id="b-prev" title="Previous event (&#8592;)">&#9664;</button>
  <button id="b-next" title="Next event (&#8594; / space / tap)">&#9654;</button>
  <button id="b-final" title="Final page state (End)">&#9197;</button>
  <div id="rail"></div>
  <div id="pos"></div>
</div>
<script>
'use strict';
const DOC = ${json};
const BOX_W = ${width}, BOX_H = ${height};
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const box = document.getElementById('box');

// Size + typeset a balloon for a rect. The font size is SOLVED so the
// wrapped text fits the carrier by construction: chars-per-line ≈
// w/(0.62fs), lines*1.3fs ≤ fill·h. Elliptical carriers (speech/thought)
// lose their corners to the rounded shape, so they get a smaller fill.
// A balloon tail: a stroked triangle hung on the carrier's edge, aimed by
// direction — the foreshadow grammar (point at what the next click shows).
const TAILS = {
  'down':       { style: { bottom: '-15px', left: '50%' }, rot: 'translateX(-50%)' },
  'down-left':  { style: { bottom: '-13px', left: '14%' }, rot: 'rotate(24deg)' },
  'down-right': { style: { bottom: '-13px', right: '14%' }, rot: 'rotate(-24deg)' },
  'up':         { style: { top: '-15px', left: '50%' }, rot: 'translateX(-50%) rotate(180deg)' },
  'up-left':    { style: { top: '-13px', left: '14%' }, rot: 'rotate(156deg)' },
  'up-right':   { style: { top: '-13px', right: '14%' }, rot: 'rotate(-156deg)' },
  'left':       { style: { left: '-15px', top: '50%' }, rot: 'translateY(-50%) rotate(90deg)' },
  'right':      { style: { right: '-15px', top: '50%' }, rot: 'translateY(-50%) rotate(-90deg)' },
};
function tailEl(direction) {
  const spec = TAILS[direction] || TAILS['down'];
  const d = document.createElement('div');
  d.className = 'tail';
  for (const k in spec.style) d.style[k] = spec.style[k];
  d.style.transform = spec.rot;
  d.innerHTML = '<svg viewBox="0 0 20 20"><polygon points="3,1 17,1 10,18" fill="#fff" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  return d;
}

function placeBalloon(b, rect, text, carrier) {
  b.style.left = rect.x + 'px';
  b.style.top = rect.y + 'px';
  b.style.width = rect.w + 'px';
  b.style.height = rect.h + 'px';
  const fill = (carrier === 'speech' || carrier === 'thought') ? 0.58 : 0.68;
  const usable = fill * rect.w * rect.h;
  const fs = Math.max(9, Math.min(26, Math.sqrt(usable / (0.62 * 1.3 * Math.max(text.length, 1)))));
  b.style.fontSize = fs.toFixed(1) + 'px';
}
const rail = document.getElementById('rail');
const posEl = document.getElementById('pos');

// --- build the DOM pool: one .scene per scene, every placement + balloon
// pre-created hidden; navigation only toggles + animates. ---
const sceneEls = [];
DOC.scenes.forEach(function (scene, si) {
  const el = document.createElement('div');
  el.className = 'scene';
  const nodes = { pl: {}, plImgs: {}, plBase: {}, bl: {}, lt: {} };
  function variantImg(src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.draggable = false;
    return img;
  }
  function addPlacement(p) {
    if (nodes.pl[p.id]) return;
    const d = document.createElement('div');
    d.className = 'pl f-' + p.frame;
    d.style.left = p.at.x + 'px';
    d.style.top = p.at.y + 'px';
    d.style.width = p.at.w + 'px';
    d.style.height = p.at.h + 'px';
    const img = variantImg(p.src);
    d.appendChild(img);
    el.appendChild(d);
    nodes.pl[p.id] = d;
    nodes.plImgs[p.id] = [img];
    nodes.plBase[p.id] = p.at;
  }
  scene.base.forEach(addPlacement);
  scene.events.forEach(function (event, ei) {
    event.do.forEach(function (delta, di) {
      if (delta.t === 'show') addPlacement(delta.placement);
      if (delta.t === 'swap') {
        // Direct single-panel action: same rect, new art, stacked hidden
        // until the fold reaches it. The cut IS the motion.
        const img = variantImg(delta.src);
        img.style.display = 'none';
        nodes.pl[delta.id].appendChild(img);
        nodes.plImgs[delta.id].push(img);
      }
      if (delta.t === 'letter') {
        const key = ei + '.' + di;
        const d = document.createElement('div');
        d.className = 'lt';
        d.style.setProperty('--rot', delta.rotate + 'deg');
        d.style.left = delta.rect.x + 'px';
        d.style.top = delta.rect.y + 'px';
        d.style.width = delta.rect.w + 'px';
        d.style.height = delta.rect.h + 'px';
        d.appendChild(variantImg(delta.src));
        el.appendChild(d);
        nodes.lt[key] = { el: d, delta: delta };
      }
      if (delta.t === 'say' && scene.mode === 'bubbles' && delta.rect) {
        const key = ei + '.' + di;
        const b = document.createElement('div');
        b.className = 'bl c-' + delta.carrier;
        const t = (delta.speaker ? delta.speaker + ': ' : '') + delta.text;
        b.textContent = t;
        b.style.lineHeight = '1.2';
        b.style.padding = '2px 5px';
        placeBalloon(b, delta.rect, t, delta.carrier);
        if (delta.tail) b.appendChild(tailEl(delta.tail));
        el.appendChild(b);
        nodes.bl[key] = { el: b, delta: delta, text: t };
      }
    });
  });
  const sub = document.createElement('div');
  sub.className = 'sub';
  const at = scene.subtitles.at;
  if (at === 'top') sub.style.top = '4%';
  else if (at && typeof at === 'object') sub.style.top = at.y + 'px';
  else sub.style.bottom = '4%';
  sub.style.fontFamily = scene.subtitles.font;
  sub.style.fontSize = scene.subtitles.size + 'px';
  sub.style.color = scene.subtitles.color;
  sub.style.background = scene.subtitles.bg;
  el.appendChild(sub);
  nodes.sub = sub;
  box.appendChild(el);
  sceneEls.push({ el: el, nodes: nodes });

  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.appendChild(document.createElement('i'));
  rail.appendChild(seg);
});

// --- the fold: state(scene, e) = base ∘ events[0..e] ---
function stateFor(si, e) {
  const scene = DOC.scenes[si];
  const visible = {};
  const balloons = {};
  const variants = {};   // placement id → active variant index (swap count)
  const rects = {};      // placement id → moved rect (last move wins)
  const letters = {};    // SFX lettering overlays, accreting like balloons
  let focus = null;      // rack focus: the placement holding attention
  let subtitle = null;
  scene.base.forEach(function (p) { visible[p.id] = true; });
  for (let i = 0; i <= e; i++) {
    scene.events[i].do.forEach(function (delta, di) {
      if (delta.t === 'show') visible[delta.placement.id] = true;
      else if (delta.t === 'hide') delete visible[delta.id];
      else if (delta.t === 'swap') variants[delta.id] = (variants[delta.id] || 0) + 1;
      else if (delta.t === 'move') rects[delta.id] = delta.to;
      else if (delta.t === 'letter') letters[i + '.' + di] = true;
      else if (delta.t === 'focus') focus = delta.on === false ? null : delta.on;
      else if (delta.t === 'say') {
        if (scene.mode === 'bubbles' && delta.rect) balloons[i + '.' + di] = true;
        subtitle = delta;
      } else if (delta.t === 'clear') {
        for (const k in visible) delete visible[k];
        for (const k in balloons) delete balloons[k];
        for (const k in letters) delete letters[k];
        focus = null;
        subtitle = null;
      }
      // 'hold' is the authored empty click — suspended time, no state change.
    });
  }
  return { visible: visible, balloons: balloons, variants: variants, rects: rects, letters: letters, focus: focus, subtitle: subtitle };
}

let typeTimer = null;
function setSubtitle(scene, nodes, delta, animate) {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  const sub = nodes.sub;
  if (!delta || scene.mode !== 'subtitles') {
    sub.className = 'sub';
    sub.textContent = '';
    return;
  }
  const style = delta.style || {};
  sub.style.fontFamily = style.font || scene.subtitles.font;
  sub.style.fontSize = (style.size || scene.subtitles.size) + 'px';
  sub.style.color = style.color || scene.subtitles.color;
  sub.style.background = style.bg || scene.subtitles.bg;
  const text = (delta.speaker ? delta.speaker + ': ' : '') + delta.text;
  const enter = delta.enter || scene.subtitles.enter;
  sub.className = 'sub on';
  if (!animate || reduced || enter === 'cut') {
    sub.textContent = text;
  } else if (enter === 'type-on') {
    sub.textContent = '';
    let i = 0;
    typeTimer = setInterval(function () {
      i += 1;
      sub.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeTimer); typeTimer = null; }
    }, 24);
  } else {
    sub.textContent = text;
    sub.classList.add('enter-fade');
  }
}

// --- navigation: pos = { s, e } with e ∈ [-1 .. events.length-1] ---
let pos = { s: 0, e: -1 };

function applyState(animateEventIndex) {
  const si = pos.s;
  const scene = DOC.scenes[si];
  const nodes = sceneEls[si].nodes;
  const state = stateFor(si, pos.e);
  sceneEls.forEach(function (s, i) { s.el.classList.toggle('on', i === si); });
  for (const id in nodes.pl) {
    nodes.pl[id].className = nodes.pl[id].className.replace(/ ?enter-\\w+/g, '');
    nodes.plImgs[id].forEach(function (img) { img.className = ''; });
  }
  for (const key in nodes.bl) nodes.bl[key].el.className = nodes.bl[key].el.className.replace(/ ?enter-\\w+/g, '');
  for (const key in nodes.lt) nodes.lt[key].el.className = nodes.lt[key].el.className.replace(/ ?enter-\\w+/g, '');
  // Which placements ease this step (a forward step whose event moves them).
  const easing = {};
  if (animateEventIndex === pos.e && animateEventIndex >= 0 && !reduced) {
    scene.events[animateEventIndex].do.forEach(function (delta) {
      if (delta.t === 'move' && delta.enter === 'ease') easing[delta.id] = true;
    });
  }
  for (const id in nodes.pl) {
    const d = nodes.pl[id];
    d.classList.toggle('on', !!state.visible[id]);
    // Rack focus: everything but the focused placement (and overlays
    // anchored to it) dims — attention pulled without a camera move.
    d.classList.toggle('dim', !!state.focus && id !== state.focus);
    d.classList.toggle('moving', !!easing[id]);
    const rect = state.rects[id] || nodes.plBase[id];
    d.style.left = rect.x + 'px';
    d.style.top = rect.y + 'px';
    d.style.width = rect.w + 'px';
    d.style.height = rect.h + 'px';
    const active = Math.min(state.variants[id] || 0, nodes.plImgs[id].length - 1);
    nodes.plImgs[id].forEach(function (img, i) { img.style.display = i === active ? 'block' : 'none'; });
  }
  for (const key in nodes.bl) {
    const entry = nodes.bl[key];
    entry.el.classList.toggle('on', !!state.balloons[key]);
    entry.el.classList.toggle('dim', !!state.focus && entry.delta.anchor?.id !== state.focus);
    // Anchored balloons ride their panel: re-project through its CURRENT rect.
    const anchor = entry.delta.anchor;
    if (state.balloons[key] && anchor) {
      const pr = state.rects[anchor.id] || nodes.plBase[anchor.id];
      if (pr) {
        placeBalloon(entry.el, {
          x: pr.x + anchor.fx * pr.w,
          y: pr.y + anchor.fy * pr.h,
          w: anchor.fw * pr.w,
          h: anchor.fh * pr.h,
        }, entry.text, entry.delta.carrier);
      }
    }
  }
  for (const key in nodes.lt) {
    const entry = nodes.lt[key];
    entry.el.classList.toggle('on', !!state.letters[key]);
    entry.el.classList.toggle('dim', !!state.focus && entry.delta.anchor?.id !== state.focus);
    const anchor = entry.delta.anchor;
    if (state.letters[key] && anchor) {
      const pr = state.rects[anchor.id] || nodes.plBase[anchor.id];
      if (pr) {
        entry.el.style.left = (pr.x + anchor.fx * pr.w) + 'px';
        entry.el.style.top = (pr.y + anchor.fy * pr.h) + 'px';
        entry.el.style.width = (anchor.fw * pr.w) + 'px';
        entry.el.style.height = (anchor.fh * pr.h) + 'px';
      }
    }
  }
  setSubtitle(scene, nodes, state.subtitle, animateEventIndex === pos.e);
  if (animateEventIndex === pos.e && animateEventIndex >= 0 && !reduced) {
    scene.events[animateEventIndex].do.forEach(function (delta, di) {
      if (delta.t === 'show' && delta.enter !== 'none') {
        nodes.pl[delta.placement.id].classList.add('enter-' + delta.enter);
      }
      if (delta.t === 'swap' && delta.enter === 'fade') {
        const imgs = nodes.plImgs[delta.id];
        const active = Math.min(stateFor(si, pos.e).variants[delta.id] || 0, imgs.length - 1);
        imgs[active].className = 'enter-fade';
      }
      if (delta.t === 'letter' && delta.enter !== 'none') {
        const lt = nodes.lt[animateEventIndex + '.' + di];
        if (lt) lt.el.classList.add(delta.enter === 'slam-in' ? 'enter-slam' : 'enter-' + delta.enter);
      }
      if (delta.t === 'say' && scene.mode === 'bubbles' && delta.rect && delta.enter !== 'none') {
        const b = nodes.bl[animateEventIndex + '.' + di];
        if (b) b.el.classList.add('enter-' + (delta.enter || 'pop'));
      }
    });
  }
  // rail + position readout + deep link
  DOC.scenes.forEach(function (s, i) {
    const fill = rail.children[i].firstChild;
    const total = s.events.length;
    if (i < si) fill.style.width = '100%';
    else if (i > si) fill.style.width = '0%';
    else fill.style.width = (total ? ((pos.e + 1) / total) * 100 : 100) + '%';
  });
  posEl.textContent = 'scene ' + (si + 1) + '/' + DOC.scenes.length + ' · step ' + (pos.e + 1) + '/' + scene.events.length;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('s', String(si));
    url.searchParams.set('e', String(pos.e));
    window.history.replaceState(null, '', url);
  } catch (err) { /* file:// without history access is fine */ }
}

function nextEvent() {
  const scene = DOC.scenes[pos.s];
  if (pos.e < scene.events.length - 1) { pos.e += 1; applyState(pos.e); }
  else if (pos.s < DOC.scenes.length - 1) {
    pos = { s: pos.s + 1, e: -1 };
    applyState(-2);
    if (!reduced) sceneEls[pos.s].el.classList.add('enter-fade');
  }
}
function finalState() { pos.e = DOC.scenes[pos.s].events.length - 1; applyState(-2); }
function prevEvent() {
  if (pos.e > -1) { pos.e -= 1; applyState(-2); }
  else if (pos.s > 0) { pos = { s: pos.s - 1, e: DOC.scenes[pos.s - 1].events.length - 1 }; applyState(-2); }
}
function sceneStart() {
  if (pos.e > -1) { pos.e = -1; applyState(-2); }
  else if (pos.s > 0) { pos = { s: pos.s - 1, e: -1 }; applyState(-2); }
}

document.getElementById('b-next').addEventListener('click', nextEvent);
document.getElementById('b-final').addEventListener('click', finalState);
document.getElementById('b-prev').addEventListener('click', prevEvent);
document.getElementById('b-start').addEventListener('click', sceneStart);
document.getElementById('stage').addEventListener('click', function (ev) {
  if (ev.clientX < window.innerWidth * 0.28) prevEvent();
  else nextEvent();
});
window.addEventListener('keydown', function (ev) {
  if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); nextEvent(); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prevEvent(); }
  else if (ev.key === 'End') { ev.preventDefault(); finalState(); }
  else if (ev.key === 'Home') { ev.preventDefault(); sceneStart(); }
});

// --- letterbox the BOX (matte included) into the window; the box is the
// determinism boundary, the device is not. ---
function fit() {
  const stage = document.getElementById('stage');
  const scale = Math.min(stage.clientWidth / BOX_W, stage.clientHeight / BOX_H) * 0.97;
  document.getElementById('boxwrap').style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', fit);
fit();

// --- deep link: ?s=<index|scene id>&e=<int> renders that exact fold ---
(function () {
  try {
    const params = new URL(window.location.href).searchParams;
    const sRaw = params.get('s');
    const eRaw = params.get('e');
    if (sRaw !== null) {
      let si = DOC.scenes.findIndex(function (s) { return s.id === sRaw; });
      if (si < 0) si = parseInt(sRaw, 10);
      if (Number.isInteger(si) && si >= 0 && si < DOC.scenes.length) pos.s = si;
    }
    if (eRaw !== null) {
      const e = parseInt(eRaw, 10);
      if (Number.isInteger(e)) pos.e = Math.max(-1, Math.min(e, DOC.scenes[pos.s].events.length - 1));
    }
  } catch (err) { /* malformed params → start of story */ }
  applyState(-2);
})();
</script>
</body>
</html>
`;
}
