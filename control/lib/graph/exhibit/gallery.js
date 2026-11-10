/**
 * THE GALLERY: exhibits joined as the rooms of one, the way a museum's wing is walked. A lobby names each room (its hall,
 * its title, its first caption, how many stops it has); a room is its exhibit's own World page, framed, with the way back
 * to the lobby and on to the next room. Nothing is won and nothing fails. As a KIOSK (`kiosk` on the recipe, or
 * `?kiosk=1` on the page) it waits for a visitor: left alone it goes back to the lobby and walks itself, room after room,
 * each room's tour played to its end (exhibit/tour.js says tour-end), and a touch hands it to the visitor.
 *
 *   { kind: 'gallery', title?, intro?, rooms: ['<ref>' | { ref, title? }], kiosk?: true | { idle?: seconds } }
 *
 * It stores refs only: a room is the exhibit as it is now, so improving an exhibit improves every gallery it stands in.
 * Served at /api/sketches/<ref>/gallery (each room's /world page framed); exported by export_model({ format: 'html' }) as
 * a folder that opens offline (index.html and rooms/<ref>.html). Pure: the store is handed in (`getSketch`).
 */
import { sketchRenderMode } from '../sketch/sketch-manifest.js';

export const GALLERY_KIND = 'gallery';
export const GALLERY_LIMITS = Object.freeze({ rooms: 24, title: 90, intro: 400, idleMin: 15, idleMax: 3600 });
export const KIOSK_IDLE = 90;

export const isGalleryKind = (kind) => kind === GALLERY_KIND;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const fail = (at, says) => { throw new Error(`gallery: ${at} ${says}`); };
const text = (v, at, max) => {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !v.trim()) fail(at, 'is a non-empty string');
  if (v.trim().length > max) fail(at, `is ${v.trim().length} characters; at most ${max}`);
  return v.trim();
};

/** A gallery recipe, checked: its rooms exist and each is a World an exhibit draws. Returns the stored form. */
export function galleryManifest(m, getSketch) {
  if (!isObj(m) || m.kind !== GALLERY_KIND) fail('', "is { kind: 'gallery', rooms: ['<ref>', …], title?, intro?, kiosk? }");
  const extra = Object.keys(m).filter((k) => !['kind', 'title', 'intro', 'rooms', 'kiosk'].includes(k));
  if (extra.length) fail(`'${extra[0]}'`, 'is not a gallery key (it takes title, intro, rooms, kiosk)');
  if (!Array.isArray(m.rooms) || !m.rooms.length) fail('rooms', 'is a list of one made exhibit or more (their refs)');
  if (m.rooms.length > GALLERY_LIMITS.rooms) fail('rooms', `has ${m.rooms.length}; a gallery holds at most ${GALLERY_LIMITS.rooms}`);
  const seen = new Set();
  const rooms = m.rooms.map((r, i) => {
    const at = `rooms[${i}]`;
    const room = typeof r === 'string' ? { ref: r } : r;
    if (!isObj(room) || typeof room.ref !== 'string' || !room.ref) fail(at, "is an exhibit's ref, or { ref, title? }");
    const bad = Object.keys(room).filter((k) => !['ref', 'title'].includes(k));
    if (bad.length) fail(at, `has '${bad[0]}' (a room takes ref and title)`);
    if (seen.has(room.ref)) fail(at, `repeats '${room.ref}'`);
    seen.add(room.ref);
    const sketch = getSketch(room.ref);
    if (!sketch) fail(`${at}.ref`, `names no sketch '${room.ref}'`);
    if (sketchRenderMode(sketch.manifest) !== 'world') fail(`${at}.ref`, `'${room.ref}' is a ${sketch.manifest?.kind ?? 'sketch'}, not an exhibit or a world (a room is a page the visitor stands in)`);
    const title = text(room.title, `${at}.title`, GALLERY_LIMITS.title);
    return title ? { ref: room.ref, title } : room.ref;
  });
  let kiosk;
  if (m.kiosk !== undefined && m.kiosk !== false) {
    if (m.kiosk === true) kiosk = true;
    else if (isObj(m.kiosk) && Object.keys(m.kiosk).every((k) => k === 'idle')
      && (m.kiosk.idle === undefined || (Number.isInteger(m.kiosk.idle) && m.kiosk.idle >= GALLERY_LIMITS.idleMin && m.kiosk.idle <= GALLERY_LIMITS.idleMax))) kiosk = m.kiosk.idle === undefined ? true : { idle: m.kiosk.idle };
    else fail('kiosk', `is true or { idle: seconds, ${GALLERY_LIMITS.idleMin} to ${GALLERY_LIMITS.idleMax} }`);
  }
  return {
    kind: GALLERY_KIND,
    ...(m.title !== undefined ? { title: text(m.title, 'title', GALLERY_LIMITS.title) } : {}),
    ...(m.intro !== undefined ? { intro: text(m.intro, 'intro', GALLERY_LIMITS.intro) } : {}),
    rooms,
    ...(kiosk !== undefined ? { kiosk } : {}),
  };
}

/**
 * The page's rooms, read from the store as they are now: each room's title (the gallery's, else its tour's, else its
 * sketch's), its label (`describe(sketch)`: an exhibit's hall id, say), its tour's stop count and first caption.
 */
export function galleryRooms(m, getSketch, { describe = () => null } = {}) {
  return (m.rooms || []).map((r) => {
    const room = typeof r === 'string' ? { ref: r } : r;
    const sketch = getSketch(room.ref);
    const tour = sketch?.manifest?.tour;
    const stops = Array.isArray(tour?.stops) ? tour.stops : [];
    return {
      ref: room.ref,
      title: room.title || tour?.title || sketch?.title || room.ref,
      label: (sketch && describe(sketch)) || null,
      stops: stops.length,
      lead: stops[0]?.caption || null,
    };
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * The gallery page: one self-contained HTML document (no script or style from anywhere else). `src(room)` is where a
 * room's page is (the /world route served, rooms/<ref>.html exported); the page adds ?gallery=1 (and &kiosk=1 as a kiosk).
 */
export function galleryHtml({ title, intro, rooms, kiosk }, { src }) {
  const idle = kiosk ? (kiosk === true ? KIOSK_IDLE : kiosk.idle) : 0;
  const ROOMS = rooms.map((r) => ({ ...r, src: src(r) }));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title || 'Gallery')}</title>
<style>
  :root{color-scheme:dark;--ink:#eef2f8;--mute:rgba(238,242,248,.62);--line:rgba(255,255,255,.14);--card:rgba(255,255,255,.045);--ground:#0a0d14}
  html,body{margin:0;height:100%;background:var(--ground);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
  body{background:radial-gradient(ellipse 80% 60% at 50% 0%,#1a2236 0%,var(--ground) 70%) fixed}
  .lobby{min-height:100%;box-sizing:border-box;padding:clamp(28px,6vw,72px) 16px 48px;display:flex;flex-direction:column;align-items:center}
  .lobby h1{margin:0;font:600 clamp(28px,4.4vw,48px)/1.12 Georgia,'Times New Roman',serif;letter-spacing:.2px;text-align:center;max-width:900px}
  .lobby .in{margin:14px 0 0;max-width:640px;text-align:center;color:var(--mute);font-size:17px}
  .lobby .kk{margin-top:10px;font:600 11px/1 system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase;color:var(--mute)}
  .rooms{list-style:none;margin:clamp(24px,5vw,48px) 0 0;padding:0;display:grid;gap:16px;width:min(1080px,100%);grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
  .room{display:flex;flex-direction:column;gap:8px;text-align:left;font:inherit;color:inherit;cursor:pointer;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;min-height:150px;transition:background .2s,border-color .2s,transform .2s}
  .room:hover,.room:focus-visible{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3);transform:translateY(-2px);outline:none}
  .room .n{font:600 11px/1 ui-monospace,Menlo,monospace;color:var(--mute);letter-spacing:.5px}
  .room .h{font:600 11px/1 system-ui,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#9cc4ff}
  .room .t{font:600 20px/1.25 Georgia,'Times New Roman',serif}
  .room .l{color:var(--mute);font-size:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .room .s{margin-top:auto;font-size:12px;color:var(--mute)}
  .stage{position:fixed;inset:0;display:none;background:#000}
  .stage.on{display:block}
  .stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
  .bar{position:absolute;left:12px;right:12px;top:10px;display:flex;align-items:center;gap:8px;pointer-events:none;z-index:2}
  .bar button{pointer-events:auto;font:600 13px/1 system-ui,sans-serif;color:var(--ink);background:rgba(12,16,24,.62);border:1px solid var(--line);border-radius:999px;padding:9px 14px;cursor:pointer;backdrop-filter:blur(6px)}
  .bar button:focus-visible{outline:2px solid #9cc4ff;outline-offset:2px}
  .bar .rt{pointer-events:none;font:600 12px/1.3 system-ui,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:rgba(238,242,248,.8);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;flex:1}
  .bar .nx{margin-left:auto}
  html.kiosk .room{min-height:180px}html.kiosk .room .t{font-size:24px}html.kiosk .bar button{font-size:16px;padding:12px 18px}
  html.kiosk,html.kiosk *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .cue{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);padding:9px 20px;border-radius:999px;background:rgba(12,16,24,.62);border:1px solid var(--line);font:600 15px/1 system-ui,sans-serif;letter-spacing:1px;opacity:0;transition:opacity .6s;pointer-events:none;z-index:3}
  .cue.on{opacity:1;animation:cue 2.6s ease-in-out infinite}@keyframes cue{50%{opacity:.45}}
  @media (prefers-reduced-motion:reduce){.room{transition:none}.cue.on{animation:none}}
</style></head><body>
<main class="lobby" id="lobby">
  <h1>${esc(title || 'Gallery')}</h1>
  ${intro ? `<p class="in">${esc(intro)}</p>` : ''}
  <div class="kk">${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}</div>
  <ul class="rooms" id="rooms"></ul>
</main>
<section class="stage" id="stage" aria-live="polite">
  <iframe id="frame" title="room" allow="fullscreen"></iframe>
  <div class="bar"><button id="back" aria-label="back to the gallery">‹ Gallery</button><span class="rt" id="rt"></span><button class="nx" id="next">Next room ›</button></div>
</section>
<div class="cue" id="cue">Touch to explore</div>
<script>
(function () {
  const ROOMS = ${json(ROOMS)};
  const IDLE = ${idle} * 1000 || (/[?&]kiosk=(?!0)/.test(location.search) ? ${KIOSK_IDLE * 1000} : 0);
  const KIOSK = IDLE > 0;
  if (KIOSK) { document.documentElement.classList.add('kiosk'); document.addEventListener('contextmenu', (e) => e.preventDefault()); }
  const $ = (id) => document.getElementById(id);
  const list = $('rooms'), stage = $('stage'), frame = $('frame'), rt = $('rt'), cue = $('cue');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  ROOMS.forEach((r, i) => {
    const li = el('li'), b = el('button', 'room');
    b.append(el('span', 'n', String(i + 1).padStart(2, '0')));
    if (r.label) b.append(el('span', 'h', r.label));
    b.append(el('span', 't', r.title));
    if (r.lead) b.append(el('span', 'l', r.lead));
    b.append(el('span', 's', r.stops ? r.stops + (r.stops === 1 ? ' stop' : ' stops') : 'free to explore'));
    b.onclick = () => enter(i);
    li.append(b); list.append(li);
  });
  let at = -1, attract = false, timer = 0, idleTimer = 0;
  function enter(i) {
    if (!(i >= 0 && i < ROOMS.length)) return;
    at = i; const r = ROOMS[i];
    const sep = r.src.includes('?') ? '&' : '?';
    frame.src = r.src + sep + 'gallery=1' + (KIOSK ? '&kiosk=1' : '');
    frame.title = r.title; rt.textContent = (i + 1) + ' / ' + ROOMS.length + '  ·  ' + r.title;
    $('next').textContent = i < ROOMS.length - 1 ? 'Next room ›' : 'Back to the start ›';
    stage.classList.add('on'); document.title = r.title;
    try { history.replaceState(null, '', '#' + encodeURIComponent(r.ref)); } catch (err) { /* file:// */ }
  }
  function lobby() {
    at = -1; stage.classList.remove('on'); frame.removeAttribute('src'); document.title = ${json(title || 'Gallery')};
    try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* file:// */ }
  }
  $('back').onclick = lobby;
  $('next').onclick = () => enter(at < ROOMS.length - 1 ? at + 1 : 0);
  // the attract loop: the lobby a moment, then each room's tour played to its end, room after room
  const tell = (m) => { try { frame.contentWindow.postMessage(m, '*'); } catch (err) { /* not loaded */ } };
  function walk(i) {
    clearTimeout(timer); if (!attract) return;
    enter(i); cue.classList.remove('on');   // a room has its own cue
    // a room with no tour is shown for a while; a toured one says when its tour is done
    if (!ROOMS[i].stops) timer = setTimeout(() => walk((i + 1) % ROOMS.length), 20000);
  }
  function startAttract() { attract = true; cue.classList.add('on'); lobby(); timer = setTimeout(() => walk(0), 4000); }
  function stopAttract() { if (!attract) return; attract = false; clearTimeout(timer); cue.classList.remove('on'); tell({ moj: 'tour-stop' }); }
  function rest() { clearTimeout(idleTimer); if (KIOSK) idleTimer = setTimeout(startAttract, IDLE); }
  function touched() { stopAttract(); rest(); }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, touched, { passive: true, capture: true }));
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== frame.contentWindow || !d || typeof d.moj !== 'string') return;
    if (d.moj === 'tour-touch') touched();
    else if (d.moj === 'tour-ready' && attract) tell({ moj: 'tour-play', from: 0 });
    else if (d.moj === 'tour-end' && attract) walk((at + 1) % ROOMS.length);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && at >= 0) lobby(); });
  const want = decodeURIComponent(location.hash.slice(1));
  const open = ROOMS.findIndex((r) => r.ref === want);
  if (open >= 0) enter(open);
  rest();
  window.__mojGallery = { get at() { return at; }, count: ROOMS.length, enter, lobby, get attract() { return attract; }, startAttract, stopAttract };
})();
</script>
</body></html>
`;
}
