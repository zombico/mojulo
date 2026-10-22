// action-lab: writes the playable page, action-lab.html, one self-contained file. The kernel (feel.mjs) is inlined as
// text, so the page steps the same code the gate runs; the takes are baked for both casts (takes.mjs).
//   node scripts/spikes/action-lab/lab.mjs /abs/out/dir [--cached]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const T = await import('./takes.mjs');

const out = process.argv[2];
if (!out) { console.error('usage: node scripts/spikes/action-lab/lab.mjs /abs/out/dir'); process.exit(2); }
mkdirSync(out, { recursive: true });
const here = new URL('.', import.meta.url);
const kernel = readFileSync(new URL('feel.mjs', here), 'utf8').replace(/^export /gm, '');
const page = readFileSync(new URL('page.js', here), 'utf8');
// the bake takes a while (two casts); `--cached` reuses the last one written beside the page while the page is iterated
const cache = join(out, 'action-lab.data.json');
const DATA = process.argv.includes('--cached') && existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : { male: T.bake('male'), female: T.bake('female') };
writeFileSync(cache, JSON.stringify(DATA));

const FEEL_BUTTONS = [['realistic', 'Realistic', '1'], ['action', 'Action', '2'], ['platformer', 'Platformer', '3'], ['pinball', 'Pinball', '4']]
  .map(([id, name, k]) => `<button type="button" class="feel" data-feel="${id}" aria-pressed="false"><kbd>${k}</kbd>${name}</button>`).join('');

const html = `<meta charset="utf-8">
<title>Action Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;500&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: a training room. The stage takes the width, the frame bar runs under it, the readouts stack beside it (below it on a phone). */
:root {
  color-scheme: dark;
  --bg: #12161d; --panel: #1a1f28; --floor: #1d2530; --grid: #2c3644; --block: #2f3a4a; --blockTop: #3b4859;
  --ink: #eef1f5; --dim: #8e9aab; --line: #2a3240;
  --hero: #5fd0c8; --dummy: #e8a35a; --shadow: #000000;
  --startup: #3fbf6b; --active: #e5484d; --recovery: #4a86e8; --stop: #f4f1de; --stun: #f08a4b; --air: #3a4658;
  --inv: #b18cff; --gather: #e6c84f; --guard: #9aa6b8; --mercy: #6b5a8c; --spark: #fff3b0; --smear: #5fd0c8;
  --good: #3fbf6b; --bad: #e5484d;
  --display: 'Barlow Semi Condensed', 'Arial Narrow', system-ui, sans-serif;
  --body: 'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
html, body { height: 100%; }
body { background: var(--bg); color: var(--ink); font: 15px/1.45 var(--body); }
.wrap { min-height: 100%; display: grid; grid-template-rows: auto 1fr; gap: 12px; padding-block: 12px 20px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); box-sizing: border-box; }
header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
h1 { margin: 0; font: 700 26px/1 var(--display); letter-spacing: 0.02em; text-transform: uppercase; }
h1 span { color: var(--hero); }
.feels { display: flex; flex-wrap: wrap; gap: 6px; }
button { font: 600 14px/1 var(--display); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; cursor: pointer; }
button:hover { border-color: var(--dim); }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--hero); outline-offset: 2px; }
button[aria-pressed="true"] { background: var(--hero); color: var(--bg); border-color: var(--hero); }
button:disabled { opacity: 0.4; cursor: default; }
kbd { font: 500 11px/1 var(--mono); margin-right: 6px; opacity: 0.7; }
.tools { display: flex; flex-wrap: wrap; gap: 6px; }
#says { flex-basis: 100%; margin: 0; color: var(--dim); font-size: 14px; }
main { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; min-height: 0; }
.stagebox { display: grid; grid-template-rows: auto auto; gap: 8px; min-width: 0; align-self: start; position: sticky; top: calc(env(safe-area-inset-top, 0px) + 8px); }
.canvaswrap { position: relative; height: clamp(320px, 66vh, 760px); border-radius: 10px; overflow: hidden; background: var(--bg); border: 1px solid var(--line); }
#stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.keys { position: absolute; left: 12px; bottom: 10px; right: 12px; margin: 0; color: var(--dim); font: 500 12px/1.5 var(--mono); pointer-events: none; }
.bar { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; }
#strip { width: 100%; height: 54px; display: block; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--dim); font: 500 11px/1 var(--mono); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
aside { display: grid; gap: 10px; align-content: start; min-width: 0; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: grid; gap: 8px; min-width: 0; }
.card h2 { margin: 0; font: 700 13px/1 var(--display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
.last { display: flex; align-items: baseline; gap: 12px; }
#lastBig { font: 700 44px/1 var(--display); font-variant-numeric: tabular-nums; color: var(--hero); min-width: 2.6ch; }
#lastWhat { color: var(--ink); font-size: 14px; }
.inputs { display: flex; align-items: center; gap: 12px; }
.btns { display: flex; gap: 5px; }
.btns span { font: 500 11px/1 var(--mono); padding: 6px 7px; border-radius: 5px; border: 1px solid var(--line); color: var(--dim); }
.btns span.on { background: var(--ink); color: var(--bg); }
#padname { color: var(--dim); font-size: 12px; }
#st { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; margin: 0; font: 500 12px/1.3 var(--mono); font-variant-numeric: tabular-nums; }
#st div { display: flex; justify-content: space-between; gap: 6px; min-width: 0; }
#st dt { color: var(--dim); } #st dd { margin: 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#log { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 13px; max-height: 230px; overflow-y: auto; }
#log li { display: flex; gap: 8px; } #log .f { font: 500 11px/1.6 var(--mono); color: var(--dim); min-width: 4ch; text-align: right; font-variant-numeric: tabular-nums; }
#log .t-dropped, #log .t-whiff { color: var(--stun); } #log .t-hit { color: var(--spark); } #log .t-evaded { color: var(--inv); } #log .empty { color: var(--dim); }
.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; font: 500 12px/1.3 var(--mono); font-variant-numeric: tabular-nums; width: 100%; }
th { font: 600 11px/1.2 var(--display); text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); text-align: right; padding: 3px 4px; }
td { text-align: right; padding: 3px 4px; border-top: 1px solid var(--line); white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
.c-startup { color: var(--startup); } .c-active { color: var(--active); } .c-recovery { color: var(--recovery); } .good { color: var(--good); } .bad { color: var(--bad); }
#jd { margin: 0; color: var(--dim); font-size: 12px; }
#dials { display: grid; gap: 4px; }
.dgroup { font: 700 11px/1 var(--display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); margin-top: 6px; }
.dial { display: grid; grid-template-columns: 7.5em minmax(0, 1fr) 6.5em; align-items: center; gap: 8px; font-size: 13px; }
.dial input { width: 100%; accent-color: var(--hero); }
.dial output { font: 500 12px/1 var(--mono); text-align: right; font-variant-numeric: tabular-nums; }
.recrow { display: flex; flex-wrap: wrap; gap: 6px; }
#recState { color: var(--dim); font-size: 13px; margin: 0; }
textarea { width: 100%; box-sizing: border-box; min-height: 80px; background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: 500 11px/1.4 var(--mono); }
.note { color: var(--dim); font-size: 12px; margin: 0; }
#touchpad { position: absolute; inset: auto 0 0 0; height: 46%; pointer-events: none; }
#tstick { position: absolute; left: max(14px, env(safe-area-inset-left, 0px)); bottom: 14px; width: 120px; height: 120px; border-radius: 50%; border: 2px solid var(--line); pointer-events: auto; touch-action: none; }
#tknob { position: absolute; left: 40px; top: 40px; width: 40px; height: 40px; border-radius: 50%; background: var(--ink); opacity: 0.5; }
.tbtns { position: absolute; right: max(14px, env(safe-area-inset-right, 0px)); bottom: 14px; display: grid; grid-template-columns: repeat(2, 56px); gap: 10px; pointer-events: auto; }
.tbtns button { height: 56px; border-radius: 50%; padding: 0; font-size: 12px; touch-action: none; }
.tbtns button.on { background: var(--ink); color: var(--bg); }
@media (max-width: 700px), (pointer: coarse) { .keys { display: none; } }
@media (max-width: 900px) { main { grid-template-columns: minmax(0, 1fr); } .stagebox { position: static; } .canvaswrap { height: 58vh; } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
</style>
<div class="wrap">
  <header>
    <h1>Action <span>Lab</span></h1>
    <div class="feels" role="group" aria-label="Feel">${FEEL_BUTTONS}</div>
    <div class="tools">
      <button type="button" id="cast" title="C: the same card on the other body">Male body</button>
      <button type="button" id="spar" aria-pressed="false" title="T: the dummy throws a telegraphed jab when you are close">Spar</button>
      <button type="button" id="guard" aria-pressed="true" title="G: a free dummy that saw a hit coming guards the next">Guard</button>
      <button type="button" id="critter" aria-pressed="false" title="H: a short dummy (0.8 m) every feel can jump on">Critter</button>
      <button type="button" id="view" title="V">¾ view</button>
      <button type="button" id="pause" title="P or Esc">Pause</button>
      <button type="button" id="stepbtn" title=". (paused): one frame">Step</button>
      <button type="button" id="reset" title="R">Reset</button>
    </div>
    <p id="says"></p>
  </header>
  <main>
    <div class="stagebox">
      <div class="canvaswrap">
        <canvas id="stage" aria-label="The arena: your hero, a training dummy, a low block, a ledge and a wall"></canvas>
        <p class="keys">WASD move · Shift sprint · Space jump (hold: higher) · J attack · K dodge · 1–4 feel · T spar · H critter · P pause · . step</p>
        <div id="touchpad" hidden>
          <div id="tstick"><div id="tknob"></div></div>
          <div class="tbtns"><button type="button" data-tbtn="DODGE">Dodge</button><button type="button" data-tbtn="ATTACK">Hit</button><button type="button" data-tbtn="SPRINT">Run</button><button type="button" data-tbtn="JUMP">Jump</button></div>
        </div>
      </div>
      <div class="bar">
        <canvas id="strip" aria-label="The last two seconds, frame by frame: the hero above, the dummy below, presses as marks"></canvas>
        <div class="legend"><span><i style="background:var(--startup)"></i>startup</span><span><i style="background:var(--active)"></i>active</span><span><i style="background:var(--recovery)"></i>recovery</span><span><i style="background:var(--stop)"></i>hitstop</span><span><i style="background:var(--stun)"></i>stun</span><span><i style="background:var(--gather)"></i>gather</span><span><i style="background:var(--air)"></i>air</span><span><i style="background:var(--inv)"></i>invincible</span><span><i style="background:var(--guard)"></i>guard</span><span><i style="background:var(--mercy)"></i>mercy</span><span>▲ press (orange: dropped)</span></div>
      </div>
    </div>
    <aside>
      <section class="card"><h2>Last press</h2><div class="last"><div id="lastBig">–</div><div id="lastWhat">Press jump or attack.</div></div></section>
      <section class="card"><h2>Input</h2>
        <div class="inputs"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--line)" stroke-width="2"></circle><circle id="knob" cx="20" cy="20" r="5" fill="var(--hero)"></circle></svg>
        <div class="btns"><span id="bJ">JUMP</span><span id="bA">HIT</span><span id="bD">DODGE</span><span id="bS">RUN</span></div></div>
        <span id="padname"></span>
        <dl id="st"></dl>
      </section>
      <section class="card"><h2>What happened</h2><ul id="log"></ul></section>
      <section class="card"><h2>Frame data</h2><div class="tablewrap"><table id="fd"></table></div><p id="jd"></p>
        <p class="note">Read off the same card the kernel plays. Link: the stun left when the next move connects at its earliest cancel.</p></section>
      <section class="card"><h2>Dials</h2><div id="dials"></div><div class="recrow"><button type="button" id="defaults">Card defaults</button></div>
        <p class="note">Dials edit this feel's card live. The clips were fitted to the defaults, so a moved startup warps the clip about its contact frame.</p></section>
      <section class="card"><h2>Recorder</h2>
        <div class="recrow"><button type="button" id="rec">Record</button><button type="button" id="replay">Replay</button><button type="button" id="copy">Copy run</button><button type="button" id="showfx">Paste a run</button><button type="button" id="load" hidden>Load</button></div>
        <p id="recState"></p><textarea id="fixture" hidden spellcheck="false" aria-label="A recorded run as JSON"></textarea>
        <p class="note">A recorded run is a gate fixture: saved in fixtures/, verify.mjs replays it.</p></section>
    </aside>
  </main>
</div>
<script>const DATA = ${JSON.stringify(DATA)};</script>
<script type="module">
${kernel}
{
${page}
}
</script>
`;
writeFileSync(join(out, 'action-lab.html'), html);
console.log(`wrote ${join(out, 'action-lab.html')} (${(html.length / 1024).toFixed(0)} KB)`);
