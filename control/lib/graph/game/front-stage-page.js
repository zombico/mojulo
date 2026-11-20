/**
 * front-stage-page — the start screen's stage drawn in the shell (play-shell.js): a layer behind the shell's screens
 * holding the ground, the game's name set large in its card's box (behind the subjects when the card says), and the
 * subjects' plates (front-plates.js) in theirs; the menu stays the front's or mana-ui's, moved into the card's menu box
 * and drawn as plain words. It shows while no level is up, and enters on the card's beats each time it comes back.
 *
 * The page carries only what a baked stage gives it: a game whose front has no stage, or whose export baked none,
 * emits not a byte of this (its key absent, its sheet and code left out).
 *
 *   stageConfig(card, plates, { title })  → the page's cfg.stage: the frames, the slots' anchors, the beats, the plates'
 *                                           srcs (a slot whose plate was not baked: null)
 *   stageCss(card, { mana })              → the stage's sheet, laid after the shell's (and the front's or mana-ui's)
 *   playStageRuntime(cfg)                 the page's code (inlined with toString(), references nothing outside itself)
 *                                         → { show(on) }
 */

const pct = (n) => `${+n.toFixed(3)}%`;
const box = ([x, y, w, h]) => `left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)}`;
const ALIGN = { start: ['flex-start', 'left'], center: ['center', 'center'], end: ['flex-end', 'right'] };
// the media a phone held upright answers: its card's tall frame
const TALL = '(max-aspect-ratio: 4/5)';

export function stageConfig(card, plates, { title }) {
  const frame = (F) => ({ title: { box: F.title.box, align: F.title.align, size: F.title.size }, subjects: F.subjects });
  return {
    card: card.id,
    title: String(title || ''),
    ground: card.ground,
    behind: card.frames.wide.title.behind === true,
    frames: { wide: frame(card.frames.wide), tall: frame(card.frames.tall) },
    anchors: card.slots.map((s) => s.anchor),
    motion: card.motion.map((m) => ({ part: m.part, enter: m.enter, at: m.at })),
    plates: plates.map((p) => (p && p.src ? { src: p.src, width: p.width, height: p.height } : null)),
  };
}

/** The sheet: the layer, its parts placed by the card's frames, the menu moved into its box, the beats. */
export function stageCss(card, { mana = false } = {}) {
  const W = card.frames.wide, T = card.frames.tall;
  const beat = Object.fromEntries(card.motion.map((m) => [m.part, m]));
  const anim = (part) => { const m = beat[part]; return m ? `animation:st-${m.enter === 'letters' || m.enter === 'stagger' ? 'rise' : m.enter} .7s cubic-bezier(.2,.8,.2,1) ${m.at}ms both` : ''; };
  // the ground's light falls behind the first subject, wherever the frame puts it
  const parts = (F) => [
    `#stage{--st-gx:${pct(F.subjects[0][0] + F.subjects[0][2] / 2)}}`,
    `#stage .st-title{${box(F.title.box)};justify-content:${ALIGN[F.title.align][0]};text-align:${ALIGN[F.title.align][1]}}`,
    ...F.subjects.map((b, i) => `#stage .st-subj[data-i="${i}"]{${box(b)}}`),
    mana
      ? `body[data-screen=title] #mana .mana-screen>.mana-stack,body[data-screen=attract] #mana .mana-screen>.mana-stack{position:absolute;${box(F.menu.box)};height:auto;max-width:none;align-items:${ALIGN[F.menu.align][0]};text-align:${ALIGN[F.menu.align][1]}}`
      : `#front .fx-col{${box(F.menu.box).split(';').map((d) => `${d}!important`).join(';')};height:auto!important;max-width:none!important;right:auto!important;bottom:auto!important;transform:none!important;align-items:${ALIGN[F.menu.align][0]}!important;text-align:${ALIGN[F.menu.align][1]}!important}`,
  ];
  const letters = beat.title && beat.title.enter === 'letters';
  return [
    '#stage{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none;background:var(--bg)}',
    '#stage.on{display:block}',
    card.ground === 'theme'
      ? `#stage .st-ground{position:absolute;inset:0;background:radial-gradient(ellipse 60% 75% at var(--st-gx) 62%,color-mix(in srgb,var(--accent) 26%,var(--bg)) 0%,var(--bg) 70%),linear-gradient(115deg,transparent 54%,color-mix(in srgb,var(--accent2) 14%,transparent) 54% 61%,transparent 61%);${anim('ground')}}`
      : `#stage .st-ground{position:absolute;inset:0;background:var(--bg);${anim('ground')}}`,
    `#stage .st-title{position:absolute;display:flex;align-items:center;z-index:${card.frames.wide.title.behind ? 1 : 3};margin:0;font-weight:900;text-transform:uppercase;letter-spacing:-.02em;line-height:.86;color:var(--ink);white-space:nowrap${letters ? '' : `;${anim('title')}`}}`,
    '#stage .st-title .st-line{display:block}',
    letters ? `#stage .st-title i{display:inline-block;font-style:normal;animation:st-rise .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(${beat.title.at}ms + var(--n) * 38ms)}` : '',
    `#stage .st-subj{position:absolute;z-index:2;${anim('subject')}}`,
    '#stage .st-subj img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom}',
    '#stage .st-subj[data-anchor=center] img{object-position:center center}',
    ...parts(W),
    `@media ${TALL}{${parts(T).join('')}}`,
    // the name is the stage's, so the screen's own copy is hidden (still read aloud); the menu as plain words
    mana
      ? 'body:is([data-screen=title],[data-screen=attract]) #mana .mana-screen [data-role=display]{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}body:is([data-screen=title],[data-screen=attract]) #mana .mana-screen>.mana-image[data-ratio=backdrop]{display:none}body:is([data-screen=title],[data-screen=attract]) #mana .mana-screen::after,body:is([data-screen=title],[data-screen=attract]) #mana .mana-screen::before{background:none}body:is([data-screen=title],[data-screen=attract]) #mana .mana-screen .mana-window{background:none!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
      : `#front{background:transparent}#front h1.fx-title{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}#front .fx-menu{gap:2px;min-width:0}#front .fx-menu button{background:none;border:0;box-shadow:none;backdrop-filter:none;border-radius:0;padding:6px 0;text-align:inherit;font-size:clamp(17px,2.2vw,24px);letter-spacing:.06em;text-transform:uppercase;color:color-mix(in srgb,var(--ink) 72%,transparent)}#front .fx-menu button:hover,#front .fx-menu button.on{color:var(--accent);box-shadow:none}#front .fx-menu button.on::before{content:"";display:inline-block;width:.9em;height:2px;margin:0 .45em .3em 0;vertical-align:middle;background:var(--accent)}#front .fx-tag{font-size:clamp(14px,1.6vw,18px);letter-spacing:.08em}`,
    beat.menu ? (mana ? '' : `#front .fx-col{${anim('menu')}}${beat.menu.enter === 'stagger' ? [1, 2, 3, 4, 5, 6].map((n) => `#front .fx-menu button:nth-child(${n}){animation:st-rise .6s cubic-bezier(.2,.8,.2,1) ${beat.menu.at + n * 70}ms both}`).join('') : ''}`) : '',
    '@keyframes st-fade{from{opacity:0}}',
    '@keyframes st-rise{from{opacity:0;transform:translateY(14%)}}',
    '@keyframes st-slide{from{opacity:0;transform:translateX(-6%)}}',
    '@keyframes st-slam{from{opacity:0;transform:scale(1.25)}}',
    '@keyframes st-wipe{from{clip-path:inset(0 100% 0 0)}}',
    // a player who turns motion down: everything fades, at once
    '@media (prefers-reduced-motion:reduce){#stage *,#stage .st-title i,#front .fx-col,#front .fx-menu button{animation:st-fade .25s ease both!important;animation-delay:0s!important}}',
  ].filter(Boolean).join('\n  ');
}

/**
 * The page's stage: built once, shown while no level is up, its entrance played again each time it is shown. The name
 * is fitted to its box (one line, or two split at the space nearest its middle when long), letter by letter when its
 * beat says.
 */
export function playStageRuntime(cfg) {
  const S = cfg.stage, root = document.createElement('div');
  root.id = 'stage';
  root.setAttribute('aria-hidden', 'true');
  const ground = document.createElement('div');
  ground.className = 'st-ground';
  root.appendChild(ground);
  const title = document.createElement('h2');
  title.className = 'st-title';
  const letters = S.motion.some((m) => m.part === 'title' && m.enter === 'letters');
  const words = S.title.toUpperCase();
  const split = (() => {
    if (words.length < 14 || words.indexOf(' ') < 0) return [words];
    let best = -1;
    for (let i = 0; i < words.length; i++) if (words[i] === ' ' && (best < 0 || Math.abs(i - words.length / 2) < Math.abs(best - words.length / 2))) best = i;
    return [words.slice(0, best), words.slice(best + 1)];
  })();
  let n = 0;
  const inner = document.createElement('span');
  for (const line of split) {
    const L = document.createElement('span');
    L.className = 'st-line';
    if (letters) for (const ch of line) { const i = document.createElement('i'); i.textContent = ch === ' ' ? ' ' : ch; i.style.setProperty('--n', String(n++)); L.appendChild(i); }
    else L.textContent = line;
    inner.appendChild(L);
  }
  title.appendChild(inner);
  root.appendChild(title);
  S.plates.forEach((p, i) => {
    if (!p) return;
    const d = document.createElement('div');
    d.className = 'st-subj';
    d.dataset.i = String(i);
    d.dataset.anchor = S.anchors[i] || 'bottom';
    const img = document.createElement('img');
    img.src = p.src; img.alt = ''; img.decoding = 'async';
    d.appendChild(img);
    root.appendChild(d);
  });
  document.body.insertBefore(root, document.body.firstChild);

  // the name as large as its box holds: measured at 100px, scaled to the box's width and its height (a large title
  // three quarters of what a huge one takes)
  function fit() {
    if (!root.classList.contains('on')) return;
    const tall = !!(window.matchMedia && window.matchMedia('(max-aspect-ratio: 4/5)').matches), F = tall ? S.frames.tall : S.frames.wide;
    const bw = (F.title.box[2] / 100) * window.innerWidth, bh = (F.title.box[3] / 100) * window.innerHeight;
    inner.style.fontSize = '100px';
    const w = inner.scrollWidth || 1, h = inner.scrollHeight || 1;
    const k = Math.min(bw / w, bh / h) * (F.title.size === 'large' ? 0.75 : 1);
    inner.style.fontSize = Math.max(18, Math.floor(100 * k)) + 'px';
  }
  window.addEventListener('resize', fit);
  let shown = false;
  return {
    show(on) {
      if (on === shown) return;
      shown = on;
      root.classList.toggle('on', on);
      if (!on) return;
      // the entrance again: the animations restarted by taking them off for one frame
      root.style.animation = 'none';
      for (const e of root.querySelectorAll('*')) e.style.animation = 'none';
      void root.offsetWidth;
      root.style.animation = '';
      for (const e of root.querySelectorAll('*')) e.style.animation = '';
      fit();
    },
  };
}
