/**
 * THE WORLD'S LOADER — what a person sees while a world is baked for the first time. A big map takes minutes before the
 * route has a byte to send, so a browser opening one sat on a blank tab with nothing said. The route answers such an
 * opening at once with this small page, which asks for the bake (`built=1`, the same bake under the same cache key) and,
 * with it ready, opens the world itself.
 *
 * Only for a page opened in a tab and not yet baked: a frame (a game's level, under the shell's own veil), a download, a
 * script and a bake already held are answered as ever, and the world's own page is untouched, in the browser or exported.
 * If the bake is not held when the page comes back (bigger than the cache), it opens the world asking for it directly,
 * so it can never go round.
 *
 *   wantsWorldLoader(headers, search)     → true when a request the route holds no bake for should get the loader
 *   worldLoaderHtml({ title })            → the page
 * Pure.
 */
const yes = (v) => v === '1' || v === 'true';
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function wantsWorldLoader(headers, search) {
  if (headers.get('sec-fetch-dest') !== 'document') return false;
  return !yes(search.get('download')) && !yes(search.get('built')) && !yes(search.get('nocache'));
}

export function worldLoaderHtml({ title = 'world' } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:dark}
  html,body{margin:0;height:100%;background:#0b0d10;color:#e8e6e1;font:15px/1.5 system-ui,sans-serif}
  #load{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 24px;text-align:center;opacity:0;animation:in .3s .4s forwards}
  h1{margin:0;font-size:20px;font-weight:600}
  p{margin:0;color:#9a9892;max-width:34em}
  .bar{width:220px;height:3px;border-radius:2px;background:#2a2d33;overflow:hidden}
  .bar i{display:block;height:100%;width:40%;background:#e8e6e1;animation:slide 1.2s ease-in-out infinite}
  button{font:inherit;color:inherit;background:#1b1e23;border:1px solid #2a2d33;border-radius:8px;padding:8px 16px;cursor:pointer}
  @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}
  @keyframes in{to{opacity:1}}
</style></head>
<body><div id="load"><h1>${esc(title)}</h1><div class="bar" id="bar"><i></i></div><p id="say">Building this world.</p></div>
<script>
(function () {
  var say = document.getElementById('say'), bar = document.getElementById('bar'), t0 = Date.now(), tick = 0;
  var here = new URL(location.href), built = new URL(location.href), key = 'moj-world-built:' + location.pathname + location.search;
  built.searchParams.set('built', '1');
  function get() { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function put(v) { try { if (v) sessionStorage.setItem(key, v); else sessionStorage.removeItem(key); } catch (e) { /* no storage: it opens directly */ } }
  // (back here with the bake ready: it was not held, so ask for the page itself)
  if (get()) { put(null); location.replace(built.href); return; }
  function words() {
    var s = Math.round((Date.now() - t0) / 1000);
    say.textContent = s < 8 ? 'Building this world.' : 'Building this world for the first time: ' + s + ' s. A big map can take a few minutes; after this it opens at once.';
  }
  tick = setInterval(words, 1000);
  fetch(built.href, { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 300) || ('status ' + r.status)); });
    clearInterval(tick); say.textContent = 'Opening it.';
    return r.arrayBuffer();
  }).then(function () {
    try { sessionStorage.setItem(key, '1'); } catch (e) { location.replace(built.href); return; }
    location.replace(here.href);
  }).catch(function (e) {
    clearInterval(tick); bar.style.display = 'none';
    say.textContent = 'This world could not be built: ' + e.message;
    var b = document.createElement('button'); b.textContent = 'Try again'; b.onclick = function () { location.reload(); };
    say.parentNode.appendChild(b);
  });
})();
</script></body></html>`;
}
