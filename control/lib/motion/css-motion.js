/**
 * Motion — Regime A compiler: a mark's `animate` spec → (a) a CSS <style> of
 * @keyframes for the LIVE self-contained svg, and (b) a per-frame `bake(t)` that
 * stamps the same transform on the single render for the GIF (no geometry
 * re-render). See motion-regime-a.plan.md; proven in spike-output/regime-a/.
 *
 * Channels (group transform / opacity — addressable via `.moj-mark[data-idx]`):
 *   spin  — rotate about the mark's own centre (loops)
 *   orbit — rotate about an external `center` (loops)
 *   grow  — scaleY 0→1 from the mark's baseline (one-shot)
 *   slide — translate from an edge + fade in (one-shot; `from`:left|right|top|bottom)
 *   fade  — opacity 0→1 (one-shot)
 *   pulse — scale breathe about the centre (loops)
 * (draw-on needs per-element pathLength and lands as a fast-follow.)
 */

const clamp = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
const LOOP_CHANNELS = new Set(['spin', 'orbit', 'pulse']);
const n2 = (x) => Number(x.toFixed(2));

/** Axis-aligned bounds of a mark in user units → { x, y, w, h, cx, cy, bottom }. */
export function markBounds(m) {
  let x = 0, y = 0, w = 0, h = 0;
  switch (m.kind) {
    case 'rect': ({ x, y } = m); w = m.w || 0; h = m.h || 0; break;
    case 'circle': x = (m.cx || 0) - (m.r || 0); y = (m.cy || 0) - (m.r || 0); w = h = 2 * (m.r || 0); break;
    case 'line': x = Math.min(m.x1, m.x2); y = Math.min(m.y1, m.y2); w = Math.abs(m.x2 - m.x1); h = Math.abs(m.y2 - m.y1); break;
    case 'polyline': case 'polygon': {
      const xs = m.points.map((p) => p[0]); const ys = m.points.map((p) => p[1]);
      x = Math.min(...xs); y = Math.min(...ys); w = Math.max(...xs) - x; h = Math.max(...ys) - y; break;
    }
    case 'text': { const s = m.size || 13; w = String(m.value || '').length * s * 0.55; h = s; x = m.x; y = m.y - s; break; }
    default: break;
  }
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, bottom: y + h };
}

function defaults(spec) {
  const loop = LOOP_CHANNELS.has(spec.channel);
  return {
    duration: spec.duration ?? (loop ? (spec.channel === 'pulse' ? 1.6 : 3.2) : 1.2),
    delay: spec.delay ?? 0,
    loop: spec.loop ?? loop,
  };
}

// per-channel: returns { keyframes:{name,css}, rule(idx), bake(T) → {transform?,opacity?} }
function channel(spec, b) {
  const { duration: dur, delay } = defaults(spec);
  const { cx, cy, bottom } = b;
  switch (spec.channel) {
    case 'spin':
    case 'orbit': {
      const C = spec.center ? { x: spec.center[0], y: spec.center[1] } : { x: cx, y: cy };
      const origin = spec.center ? `${n2(C.x)}px ${n2(C.y)}px` : 'center';
      return {
        keyframes: { name: 'moj-rot', css: '@keyframes moj-rot{to{transform:rotate(360deg)}}' },
        rule: (i) => `.moj-mark[data-idx="${i}"]{transform-box:fill-box;transform-origin:${origin};animation:moj-rot ${dur}s linear infinite}`,
        bake: (T) => ({ transform: `rotate(${n2((360 * ((T / dur) % 1)))} ${n2(C.x)} ${n2(C.y)})` }),
      };
    }
    case 'grow':
      return {
        keyframes: { name: 'moj-grow', css: '@keyframes moj-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}' },
        rule: (i) => `.moj-mark[data-idx="${i}"]{transform-box:fill-box;transform-origin:bottom;animation:moj-grow ${dur}s cubic-bezier(.2,.8,.2,1) ${delay}s backwards}`,
        bake: (T) => { const s = easeOut((T - delay) / dur); return { transform: `matrix(1,0,0,${n2(s)},0,${n2(bottom * (1 - s))})` }; },
      };
    case 'fade':
      return {
        keyframes: { name: 'moj-fade', css: '@keyframes moj-fade{from{opacity:0}to{opacity:1}}' },
        rule: (i) => `.moj-mark[data-idx="${i}"]{animation:moj-fade ${dur}s ease ${delay}s backwards}`,
        bake: (T) => ({ opacity: n2(easeOut((T - delay) / dur)) }),
      };
    case 'pulse': {
      const amt = spec.amount ?? 0.08;
      return {
        keyframes: { name: 'moj-pulse', css: `@keyframes moj-pulse{0%,100%{transform:scale(1)}50%{transform:scale(${1 + amt})}}` },
        rule: (i) => `.moj-mark[data-idx="${i}"]{transform-box:fill-box;transform-origin:center;animation:moj-pulse ${dur}s ease-in-out infinite}`,
        bake: (T) => { const ph = (T / dur) % 1; const s = 1 + amt * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph)); return { transform: `matrix(${n2(s)},0,0,${n2(s)},${n2(cx * (1 - s))},${n2(cy * (1 - s))})` }; },
      };
    }
    case 'slide':
    default: {
      const d = spec.distance ?? Math.max(80, b.w || 80);
      const dir = { left: [-d, 0], right: [d, 0], top: [0, -d], bottom: [0, d] }[spec.from || 'left'];
      const name = `moj-slide-${spec.idx}`;
      return {
        keyframes: { name, css: `@keyframes ${name}{from{transform:translate(${n2(dir[0])}px,${n2(dir[1])}px);opacity:0}to{transform:translate(0,0);opacity:1}}` },
        rule: (i) => `.moj-mark[data-idx="${i}"]{animation:${name} ${dur}s cubic-bezier(.2,.8,.2,1) ${delay}s backwards}`,
        bake: (T) => { const p = easeOut((T - delay) / dur); return { transform: `translate(${n2(dir[0] * (1 - p))},${n2(dir[1] * (1 - p))})`, opacity: n2(clamp(p * 1.3)) }; },
      };
    }
  }
}

/**
 * @param {object[]} specs  [{ idx, channel, ...params }] (one per animated mark)
 * @param {object[]} marks  the slide's marks (for bounds, indexed by spec.idx)
 * @param {object} [opts]   { fps }
 * @returns {{ style:string, bake:(t:number)=>Array, frameCount:number, looping:boolean, duration:number }}
 */
export function compileMotionCss(specs, marks, { fps = 16 } = {}) {
  const built = specs.map((spec) => ({ spec, ...channel(spec, markBounds(marks[spec.idx])) }));

  const kf = new Map();
  const rules = [];
  for (const b of built) { kf.set(b.keyframes.name, b.keyframes.css); rules.push(b.rule(b.spec.idx)); }
  const style = `<style>\n${[...kf.values()].join('\n')}\n${rules.join('\n')}\n@media (prefers-reduced-motion:reduce){.moj-mark{animation:none!important}}\n</style>`;

  const looping = built.every((b) => defaults(b.spec).loop);
  const durations = built.map((b) => { const d = defaults(b.spec); return d.loop ? d.duration : d.delay + d.duration; });
  const D = looping ? Math.max(...durations) : Math.max(...durations) + 0.6; // one-shot gets a settle hold
  const frameCount = Math.max(6, Math.min(48, Math.round(D * fps)));

  const bake = (t) => built.map((b) => ({ idx: b.spec.idx, ...b.bake(t * D) }));
  return { style, bake, frameCount, looping, duration: D };
}
