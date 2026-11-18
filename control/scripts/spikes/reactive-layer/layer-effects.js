/**
 * THE REACTIVE TOP LAYER, a spike — what a game's screen can be made to do from a layer of CSS over it, without the game
 * knowing: no rule changed, no frame asked for, nothing drawn into the world. Confetti (mana-ui's `effect`) was the
 * first: pieces over the picture. This asks the bigger question, whether CSS can act ON the picture, and what for.
 *
 * Four ways to reach the world's pixels from the layer (each probed in Chrome by probe.mjs):
 *   blend      an overlay mixed into what is under it (mix-blend-mode): multiply darkens (a hurt's red edge, water's
 *              blue), screen lightens (a flash, a level up's rays), color takes the overlay's hue and keeps the world's
 *              light (poison's green), difference inverts (a lightning frame)
 *   backdrop   a region's backdrop-filter: the pixels UNDER one element, filtered (blur, grayscale, contrast, invert):
 *              a scope's blur outside its circle, an x-ray lens at a point. The layer acts on part of the screen
 *   canvas     the world's own canvas element filtered and moved (filter, transform): the whole picture desaturated,
 *              shaken, punched in. And an SVG filter on it (filter: url(#…)): displacement (a shockwave's ripple, heat,
 *              water), a channel split (a hit's chromatic aberration)
 *   anchor     where: a point the game already puts on the screen (a hit, the hero, a pickup), as the HUD's anchors do
 *              (x, y 0..1): an impact's rays, a gather's motes, an iris closing on the hero, all at it
 *
 *   LAYER_EFFECTS   [{ id, family, means, ways, canvas?, overlays?: [{ css, html? }], svg? }]
 *   effectHtml(e, at) → { css, html, svg }   the layer's markup for one effect at a point (the spike's page lays it)
 *
 * A spike: nothing in mana-ui reads this. FINDINGS.md says what it would take.
 */
export const AT = Object.freeze({ x: 62, y: 56 });   // the anchored point, % of the screen: a hit, the hero, as projected

// an SVG noise texture as a CSS image (frost, grain): no file, no fetch
const NOISE = (seed, freq, a) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='${seed}'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${a} 0'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>`)}")`;
// an SVG ring as a displacement map's image, at a point (a shockwave)
const RING = (x, y) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><radialGradient id='g' cx='${x}%' cy='${y}%' r='30%'><stop offset='0.55' stop-color='rgb(128,128,128)'/><stop offset='0.75' stop-color='rgb(255,255,128)'/><stop offset='0.9' stop-color='rgb(0,0,128)'/><stop offset='1' stop-color='rgb(128,128,128)'/></radialGradient></defs><rect width='100' height='100' fill='url(%23g)'/></svg>`)}`;

export const LAYER_EFFECTS = Object.freeze([
  { id: 'hurt', family: 'harm', means: 'a hit taken: the edge flushed red, the colour drained a breath', ways: ['blend', 'canvas'],
    canvas: 'filter:saturate(.5) contrast(1.08)',
    overlays: [{ css: 'background:radial-gradient(ellipse 75% 70% at 50% 50%,transparent 38%,rgba(225,25,45,.55) 74%,rgba(150,0,20,.95));mix-blend-mode:multiply' }] },
  { id: 'impact', family: 'impact', means: 'a heavy blow landed at a point: a white flash there, rays from it, the screen knocked a few pixels', ways: ['blend', 'anchor', 'canvas'],
    canvas: 'transform:translate(9px,-6px) rotate(-.6deg) scale(1.025)',
    overlays: [
      { css: (a) => `background:radial-gradient(circle at ${a.x}% ${a.y}%,rgba(255,255,255,.95) 0 3%,rgba(255,240,200,.6) 9%,transparent 26%);mix-blend-mode:screen` },
      { css: (a) => `background:repeating-conic-gradient(from 0deg at ${a.x}% ${a.y}%,rgba(255,255,255,.85) 0 2deg,transparent 2deg 11deg);-webkit-mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 10%,#000 14% 30%,transparent 46%);mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 10%,#000 14% 30%,transparent 46%);mix-blend-mode:screen` }] },
  { id: 'chroma', family: 'impact', means: 'a glitch on a hit or a teleport: the picture\'s red, green and blue pulled apart', ways: ['canvas'],
    canvas: 'filter:url(#rl-chroma)',
    svg: '<filter id="rl-chroma" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="-7" dy="0" result="ro"/><feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="7" dy="0" result="bo"/><feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter>' },
  { id: 'shockwave', family: 'impact', means: 'a blast\'s ring through the air: the picture bent in a ring round a point', ways: ['canvas', 'anchor'],
    canvas: 'filter:url(#rl-shock)', fails: 'the ring\'s map, an image in the SVG filter (feImage), is not drawn into a filter on the canvas: nothing bends',
    svg: (a) => `<filter id="rl-shock" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${RING(a.x, a.y)}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter>` },
  { id: 'shockring', family: 'impact', means: 'the blast\'s ring as the layer can draw it: a band round the point where the picture is blurred and lit, as air bent', ways: ['backdrop', 'anchor'],
    overlays: [{ css: (a) => `backdrop-filter:blur(4px) brightness(1.3) saturate(1.4);-webkit-backdrop-filter:blur(4px) brightness(1.3) saturate(1.4);-webkit-mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 17%,#000 19.5% 22%,transparent 25%);mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 17%,#000 19.5% 22%,transparent 25%)` },
      { css: (a) => `background:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 18.5%,rgba(255,255,255,.55) 20.5%,transparent 23%);mix-blend-mode:screen` }] },
  { id: 'gather', family: 'power', means: 'a charge-up: motes drawn in from all round to the hero, the world dimmed toward them', ways: ['anchor', 'blend'],
    overlays: [{ css: (a) => `background:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 12%,rgba(20,10,40,.55) 60%);mix-blend-mode:multiply` },
      { css: 'pointer-events:none', html: (a) => Array.from({ length: 36 }, (_, i) => { const t = (i / 36) * 2 * Math.PI, d = 0.3 + 0.18 * ((i * 7) % 5) / 4, k = 0.35 + ((i * 13) % 10) / 16; return `<i style="position:absolute;left:calc(${a.x}% + ${(Math.cos(t) * d * 100 * k).toFixed(1)}vmin);top:calc(${a.y}% + ${(Math.sin(t) * d * 100 * k).toFixed(1)}vmin);width:${6 + (i % 4) * 3}px;height:${6 + (i % 4) * 3}px;border-radius:50%;background:${i % 3 ? '#9ff3ff' : '#ffffff'};box-shadow:0 0 12px 3px rgba(120,230,255,.9);transform:translate(-50%,-50%)"></i>`; }).join('') },
      { css: (a) => `background:radial-gradient(circle at ${a.x}% ${a.y}%,rgba(200,250,255,.95) 0 1.4%,rgba(110,220,255,.55) 3.5%,transparent 9%);mix-blend-mode:screen` }] },
  { id: 'blackout', family: 'state', means: 'out cold, a scene ending: an iris closing on the hero', ways: ['anchor'],
    overlays: [{ css: (a) => `background:#000;-webkit-mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 13%,#000 13.6%);mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 13%,#000 13.6%)` }] },
  { id: 'poison', family: 'status', means: 'poisoned: the world gone green, swimming', ways: ['blend', 'canvas'],
    canvas: 'filter:url(#rl-wobble)',
    svg: '<filter id="rl-wobble" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter>',
    overlays: [{ css: 'background:rgb(90,210,70);mix-blend-mode:color;opacity:.7' }, { css: 'background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(40,90,10,.7));mix-blend-mode:multiply' }] },
  { id: 'frozen', family: 'status', means: 'frozen: the colour gone cold, frost creeping in from the edge', ways: ['canvas', 'blend'],
    canvas: 'filter:saturate(.3) brightness(1.06) hue-rotate(-12deg)',
    overlays: [{ css: `background:${NOISE(3, 0.9, 1)},radial-gradient(ellipse 70% 62% at 50% 50%,transparent 50%,rgba(225,245,255,.92) 86%);background-blend-mode:multiply;-webkit-mask:radial-gradient(ellipse 72% 64% at 50% 50%,transparent 46%,#000 80%);mask:radial-gradient(ellipse 72% 64% at 50% 50%,transparent 46%,#000 80%);mix-blend-mode:screen` },
      { css: 'background:rgba(120,190,255,.35);mix-blend-mode:multiply' }] },
  { id: 'underwater', family: 'place', means: 'under water: blue-green, its light rippling', ways: ['blend', 'canvas'],
    canvas: 'filter:url(#rl-waves) blur(.6px)',
    svg: '<filter id="rl-waves" color-interpolation-filters="sRGB"><feTurbulence type="turbulence" baseFrequency="0.004 0.03" numOctaves="1" seed="9" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="14" xChannelSelector="R" yChannelSelector="B"/></filter>',
    overlays: [{ css: 'background:linear-gradient(rgba(40,170,200,.65),rgba(10,60,120,.9));mix-blend-mode:multiply' }, { css: `background:${NOISE(11, 0.02, 0.5)};mix-blend-mode:screen;opacity:.5` }] },
  { id: 'scope', family: 'focus', means: 'aiming down a scope, a focus: all but a circle blurred and dimmed', ways: ['backdrop', 'anchor'],
    overlays: [{ css: (a) => `backdrop-filter:blur(7px) saturate(.55) brightness(.7);-webkit-backdrop-filter:blur(7px) saturate(.55) brightness(.7);-webkit-mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 17%,#000 18.5%);mask:radial-gradient(circle at ${a.x}% ${a.y}%,transparent 0 17%,#000 18.5%)` }] },
  { id: 'xray', family: 'focus', means: 'a lens over one place (an x-ray, a detective\'s sense): the pixels under a circle turned to their own negative', ways: ['backdrop', 'anchor'],
    overlays: [{ css: (a) => `inset:auto;left:calc(${a.x}% - 15vmin);top:calc(${a.y}% - 15vmin);width:30vmin;height:30vmin;border-radius:50%;backdrop-filter:grayscale(1) invert(1) contrast(1.15);-webkit-backdrop-filter:grayscale(1) invert(1) contrast(1.15);box-shadow:0 0 0 3px rgba(130,255,220,.9),0 0 24px 4px rgba(130,255,220,.6)` }] },
  { id: 'slowmo', family: 'time', means: 'time slowed: the colour drained, the edge pressed in, the world held', ways: ['canvas', 'blend'],
    canvas: 'filter:saturate(.35) contrast(1.15) sepia(.15)',
    overlays: [{ css: 'background:radial-gradient(ellipse 70% 65% at 50% 50%,transparent 45%,rgba(10,20,40,.75));mix-blend-mode:multiply' }] },
  { id: 'nightvision', family: 'focus', means: 'night vision: the picture as green light, lines across it', ways: ['canvas', 'blend'],
    canvas: 'filter:grayscale(1) brightness(.95) contrast(1.5)',
    overlays: [{ css: 'background:rgb(60,255,80);mix-blend-mode:multiply' }, { css: 'background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px),radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(0,0,0,.85) 85%)' }] },
  { id: 'lightning', family: 'impact', means: 'a lightning frame: the picture flipped to its negative for an instant', ways: ['blend'],
    overlays: [{ css: 'background:#fff;mix-blend-mode:difference' }] },
  { id: 'levelup', family: 'power', means: 'a level up at the hero: rays turning out of them, the world lit', ways: ['anchor', 'blend'],
    overlays: [{ css: (a) => `background:repeating-conic-gradient(from 8deg at ${a.x}% ${a.y}%,rgba(255,230,120,.75) 0 7deg,transparent 7deg 22deg);-webkit-mask:radial-gradient(circle at ${a.x}% ${a.y}%,#000 0 8%,transparent 55%);mask:radial-gradient(circle at ${a.x}% ${a.y}%,#000 0 8%,transparent 55%);mix-blend-mode:screen` },
      { css: (a) => `background:radial-gradient(circle at ${a.x}% ${a.y}%,rgba(255,250,220,.95) 0 3%,rgba(255,220,120,.4) 12%,transparent 30%);mix-blend-mode:screen` }] },
]);

const val = (v, a) => (typeof v === 'function' ? v(a) : v);
/** One effect's layer at a point: the CSS on the canvas, the overlays' markup, the SVG filters they name. */
export function effectHtml(e, at = AT) {
  const overlays = (e.overlays ?? []).map((o) => `<div class="rl-o" style="position:absolute;inset:0;pointer-events:none;${val(o.css, at)}">${val(o.html, at) ?? ''}</div>`).join('');
  return { canvas: e.canvas ?? '', html: overlays, svg: e.svg ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${val(e.svg, at)}</svg>` : '' };
}
