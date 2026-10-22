// animation-games viewer: every part of the spike on one review page, a tab each — its player, its filmstrips and its
// machine gate as it ran — so the eyes gate can be done in one place.
//   node scripts/spikes/animation-games/viewer.mjs /absolute/out/dir [cast=male]
// writes index.html (the page's body, for the artifact host: no doctype or head of its own) beside every player and a
// PNG of every filmstrip. A new part is a row in PARTS.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const control = join(here, '../../..');
const sharp = createRequire(join(control, 'package.json'))('sharp');
const out = process.argv[2]; if (!out) { console.error('usage: viewer.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });

const PARTS = [
  { id: 'takes', name: 'Takes', script: 'preview.mjs', verify: 'verify.mjs', player: 'animation-games.html',
    strips: [['filmstrip-jab.svg', 'jab → hit high'], ['filmstrip-cross.svg', 'cross → hit body'], ['filmstrip-jump.svg', 'standing jump'], ['filmstrip-jumpForward.svg', 'forward jump']],
    says: 'One take from the hero library (a strike, a jump, a hit reaction) in each flavor. The contact pose is the same pose in all four; time, the wind-up, holds, squash, smears and the force handed on differ.' },
  { id: 'motion', name: 'Run and jump', script: 'motion-preview.mjs', verify: 'motion-verify.mjs', player: 'motion.html',
    strips: [['motion-strobe.svg', 'chronophotograph: the body 10 times a second where it is']],
    says: 'A run-up from a jog, the running jump, the landing and a run-out, the body travelling. Speed build-up, the stride against the ground, the arc and the landing differ; the clip\'s take-off and landing frames are the flight\'s ends in every flavor. Pinball flies a tucked spin.' },
  { id: 'weapon', name: 'Weapons', script: 'weapon-preview.mjs', verify: 'weapon-verify.mjs', player: 'weapon.html',
    strips: [['weapon-chop-sword.svg', 'chop with a sword'], ['weapon-chop-greatsword.svg', 'chop with a greatsword'], ['weapon-chop-dagger.svg', 'chop with a dagger'], ['weapon-cleave-greatsword.svg', 'two-handed cleave with a greatsword'], ['weapon-thrust-sword.svg', 'thrust with a sword']],
    says: 'A strike with a held weapon (the hero library\'s swings: chop, thrust, rising, the two-handed cleave) at each item class. The realistic register is the rig\'s own swing; the others show the weight more (action: a charged heavy blade, a trail, a freeze that grows with the weapon) or less (platformer: one snappy swing). At contact the blade\'s tip is in the same place in every register.' },
  { id: 'combo', name: 'Combos', script: 'combo-preview.mjs', verify: 'combo-verify.mjs', player: 'combo.html',
    strips: [['combo-fist5.svg', 'fists, 5 hits: the stun each hit leaves, and whether the next lands inside it'], ['combo-sword5.svg', 'sword, 5 hits'], ['combo-fist3.svg', 'fists, 3 hits'], ['combo-sword3.svg', 'sword, 3 hits']],
    says: 'Strings of 3 and 5 hits (fists and a sword) and HITSTUN: a hit leaves the victim unable to act for a while, and the next hit links only if it lands inside that stun; after it the victim blocks. Realistic stuns for the body\'s reaction time (a jab string sits on its edge, a sword is too slow); action authors a stun that decays hit by hit and ends on a launching finisher; platformer has none (mercy invincibility instead); pinball\'s first hit sends the victim out of reach.' },
  { id: 'collision', name: 'Collisions', script: 'collision-preview.mjs', verify: 'collision-verify.mjs', player: 'collision.html',
    strips: [['collision-run-wall.svg', 'run into a wall'], ['collision-run-unit.svg', 'run into a body'], ['collision-walk-wall.svg', 'walk into a wall'], ['collision-walk-unit.svg', 'walk into a body'],
      ['collision-walls-run.svg', 'run into a wall, by its property'], ['collision-walls-walk.svg', 'walk into a wall, by its property'], ['collision-bouncy-tuned.svg', 'run into a bouncy wall, tuned']],
    says: 'Walking or running into a wall or a standing body of the same mass. The flavor decides what the impact does: the speed each body leaves with, how much of the change it shows, and which rung of one shared ladder it reaches (walk in place, flinch, stagger, down, launched, bonk or boop, spin). A non-realistic wall carries a property: bouncy (tunable), treadmill (the gait goes on in place) or sticky (walk up it, or climb it hand over hand). No trunk passes the wall or the other body.' },
];

const node = (args) => execFileSync(process.execPath, args, { cwd: control, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const commit = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: control, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();

const parts = [];
for (const P of PARTS) {
  node([join(here, P.script), out, cast]);
  let log; try { log = node([join(here, P.verify), cast]); } catch (e) { log = String(e.stdout ?? '') + String(e.stderr ?? ''); }
  const lines = log.split('\n').filter((l) => /^(PASS|FAIL|note) {2}/.test(l)).map((l) => { const [, kind, rest] = l.match(/^(PASS|FAIL|note) {2}(.*)$/); const i = rest.search(/ {2}[[{]/); return { kind, says: i < 0 ? rest : rest.slice(0, i), measured: i < 0 ? '' : rest.slice(i + 2) }; });
  const strips = [];
  for (const [svg, label] of P.strips) {
    const png = svg.replace(/\.svg$/, '.png');
    if (existsSync(join(out, svg))) { await sharp(readFileSync(join(out, svg)), { density: 96 }).png({ compressionLevel: 9 }).toFile(join(out, png)); strips.push({ png, label }); }
  }
  parts.push({ ...P, lines, strips });
  console.log(`${P.id}: ${lines.filter((l) => l.kind === 'PASS').length} held, ${lines.filter((l) => l.kind === 'FAIL').length} failed, ${strips.length} strips`);
}

const FLAVORS = [['realistic', 'the body on earth'], ['action', 'force made visible'], ['platformer', 'movement first'], ['pinball', 'speed']];
const gate = (p) => { const held = p.lines.filter((l) => l.kind === 'PASS').length, failed = p.lines.filter((l) => l.kind === 'FAIL').length; return { held, failed, of: held + failed }; };
const html = `<title>Animation Flavors</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;700&family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* layout: a review console — a header strip, tabs per part, then the part's player full width, its filmstrips, its gate */
:root{
  --bg:#f6f7f9; --panel:#ffffff; --fg:#1b1f27; --mut:#5d6573; --line:#dde1e8; --accent:#b8660b; --held:#1f7a4d; --fail:#b42318;
  --realistic:#3f6fd8; --action:#d6452f; --platformer:#23935c; --pinball:#9545cf;
  --display:'Familjen Grotesk',ui-sans-serif,system-ui,sans-serif; --body:'Atkinson Hyperlegible',ui-sans-serif,system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#13161b;--panel:#1b1f26;--fg:#e8eaee;--mut:#9aa3b2;--line:#2c323c;--accent:#e39a3b;--held:#4cc38a;--fail:#f97066;--realistic:#7a9cf0;--action:#f07a63;--platformer:#4fc489;--pinball:#bb84ea;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#13161b;--panel:#1b1f26;--fg:#e8eaee;--mut:#9aa3b2;--line:#2c323c;--accent:#e39a3b;--held:#4cc38a;--fail:#f97066;--realistic:#7a9cf0;--action:#f07a63;--platformer:#4fc489;--pinball:#bb84ea;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.5 var(--body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 48px}
.wrap{max-width:1240px;margin:0 auto;display:grid;gap:20px}
header{display:grid;gap:8px}
h1{font:700 28px/1.1 var(--display);margin:0;letter-spacing:-.01em;text-wrap:balance}
.meta{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--mut);font-size:13px}
.meta code{font:12px var(--mono)}
.legend{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:3px 10px 3px 8px;border:1px solid var(--line);border-radius:999px;background:var(--panel)}
.chip i{width:10px;height:10px;border-radius:2px;display:inline-block}
.chip span{color:var(--mut)}
nav{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--line)}
nav button{font:600 14px var(--display);letter-spacing:.01em;color:var(--mut);background:none;border:0;border-bottom:2px solid transparent;padding:10px 14px;cursor:pointer;display:flex;gap:8px;align-items:center}
nav button[aria-selected="true"]{color:var(--fg);border-bottom-color:var(--accent)}
nav button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pill{font:600 11px var(--mono);padding:1px 6px;border-radius:999px;background:color-mix(in srgb,var(--held) 15%,transparent);color:var(--held)}
.pill.bad{background:color-mix(in srgb,var(--fail) 15%,transparent);color:var(--fail)}
section{display:grid;gap:16px}
.lede{max-width:72ch;margin:0;color:var(--fg)}
.gates{display:flex;flex-wrap:wrap;gap:10px;font-size:13px}
.gate{padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);display:flex;gap:8px;align-items:baseline}
.gate b{font-family:var(--display)}
.gate.eyes b{color:var(--accent)}
.frame{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}
.frame iframe{display:block;width:100%;height:720px;border:0;background:var(--panel)}
.frame .bar{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border-top:1px solid var(--line);font-size:12px;color:var(--mut)}
.frame .bar a{color:var(--accent)}
h2{font:700 16px var(--display);margin:4px 0 0}
.strip{display:grid;gap:6px}
.strip figcaption{font-size:13px;color:var(--mut)}
.strip .scroll{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:#fff}
.strip img{display:block;max-width:none;height:auto}
ol.checks{list-style:none;margin:0;padding:0;display:grid;gap:2px;font-size:14px}
ol.checks li{display:grid;grid-template-columns:3.2em 1fr;gap:8px;padding:6px 8px;border-radius:4px}
ol.checks li:nth-child(odd){background:color-mix(in srgb,var(--line) 35%,transparent)}
ol.checks .k{font:600 11px var(--mono);padding-top:3px}
ol.checks .k.PASS{color:var(--held)} ol.checks .k.FAIL{color:var(--fail)} ol.checks .k.note{color:var(--mut)}
ol.checks details{min-width:0} ol.checks summary{cursor:pointer}
ol.checks pre{font:12px/1.45 var(--mono);white-space:pre-wrap;word-break:break-word;margin:4px 0 0;color:var(--mut)}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<div class="wrap">
  <header>
    <h1>Animation Flavors</h1>
    <div class="meta"><span>spike <code>1021-animation-games</code></span><span>built from <code>${esc(commit)}</code> on <code>1018-consolidated</code></span><span>cast <code>${esc(cast)}</code> · 60 fps · z-up metres</span></div>
    <div class="legend">${FLAVORS.map(([f, s]) => `<span class="chip"><i style="background:var(--${f})"></i>${f} <span>${s}</span></span>`).join('')}</div>
  </header>
  <nav role="tablist">${parts.map((p, i) => { const g = gate(p); return `<button role="tab" id="tab-${p.id}" aria-controls="${p.id}" aria-selected="${i === 0}">${esc(p.name)}<span class="pill${g.failed ? ' bad' : ''}">${g.held}/${g.of}</span></button>`; }).join('')}</nav>
  ${parts.map((p, i) => { const g = gate(p); return `<section id="${p.id}" role="tabpanel" aria-labelledby="tab-${p.id}"${i ? ' hidden' : ''}>
    <p class="lede">${esc(p.says)}</p>
    <div class="gates"><span class="gate"><b>Machine gate</b> ${g.failed ? `${g.failed} failed of ${g.of}` : `all ${g.of} held`}</span><span class="gate eyes"><b>Eyes gate</b> open: nobody has looked yet</span></div>
    <div class="frame"><iframe title="${esc(p.name)} player" data-src="${p.player}"${i === 0 ? ` src="${p.player}"` : ''} loading="lazy"></iframe><div class="bar"><span>The player: four panes on one clock, each from the side and from a ¾ overhead camera, a ¼-speed switch.</span><a href="${p.player}" target="_blank" rel="noopener">Open on its own</a></div></div>
    ${p.strips.map((s) => `<figure class="strip" style="margin:0"><figcaption>${esc(s.label)}</figcaption><div class="scroll"><img src="${s.png}" alt="${esc(s.label)} filmstrip" loading="lazy"></div></figure>`).join('\n    ')}
    <h2>What the machine gate measured</h2>
    <ol class="checks">${p.lines.map((l) => `<li><span class="k ${l.kind}">${l.kind}</span>${l.measured ? `<details><summary>${esc(l.says)}</summary><pre>${esc(l.measured)}</pre></details>` : `<span>${esc(l.says)}</span>`}</li>`).join('')}</ol>
  </section>`; }).join('\n  ')}
</div>
<script>
const tabs=[...document.querySelectorAll('nav [role=tab]')];
function show(id){
  if(!document.getElementById(id))return;
  for(const t of tabs){const on=t.getAttribute('aria-controls')===id;t.setAttribute('aria-selected',on);const s=document.getElementById(t.getAttribute('aria-controls'));s.hidden=!on;if(on){const f=s.querySelector('iframe');if(!f.getAttribute('src'))f.src=f.dataset.src;}}
}
tabs.forEach(t=>t.addEventListener('click',()=>{show(t.getAttribute('aria-controls'));try{history.replaceState(null,'','#'+t.getAttribute('aria-controls'));}catch(e){}}));
const want=(location.hash||'').slice(1);if(want)show(want);
// a player says how tall it is; its frame takes that height
addEventListener('message',(e)=>{const h=e.data&&e.data.spikeHeight;if(!h)return;for(const f of document.querySelectorAll('iframe'))if(f.contentWindow===e.source)f.style.height=Math.min(4000,Math.max(300,h+8))+'px';});
</script>
`;
writeFileSync(join(out, 'index.html'), html);
console.log(`wrote ${join(out, 'index.html')}`);
