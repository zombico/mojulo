import { printWaveManji } from '../../../lib/graph/polygonizer/wave-manji.js';
import { buildParticleVacuum } from './kernel.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const template=printWaveManji({singularity:{x:0,y:0,z:0},script:'mandala',params:{N:3,radius:0.15,lobeDepth:0.035},samples:24}).polylines.map(l=>l.map(p=>[p.x,p.y,p.z]));
const particles=Array.from({length:147},(_,i)=>({id:`p-${i}`,anchor:[(i%7-3)*0.7,(Math.floor(i/7)%7-3)*0.7,(Math.floor(i/49)-1)*0.8]}));
const output=resolve(process.argv[2]||'scripts/spikes/particle-vacuum/preview.html');
const html=`<!doctype html><meta charset="utf-8"><title>Particle vacuum · Mojulo spike</title>
<style>body{margin:0;background:#0b1220;color:#dee8f5;font:15px system-ui}main{max-width:1100px;margin:28px auto;padding:0 20px}h1{font-size:28px}p{color:#a9bace;line-height:1.6}canvas{width:100%;height:540px;background:#101d2f;border:1px solid #314158;border-radius:12px}button,input{margin:8px}button{background:#253e59;color:white;padding:9px;border:1px solid #53708f;border-radius:7px}label{display:inline-block}#stats{font-family:monospace;color:#70dec6}</style>
<main><h1>Particle vacuum</h1><p>A level-local carrier experiment. Each form comes from Mojulo’s wave-manji printer. In stasis its phase and position are frozen. Contact wakes nearby carriers; their impulse decays and they settle into a new frozen form.</p>
<button id="play">Pause</button><button id="contact">Contact at probe</button><button id="reset">Reset</button>
<label>Probe X <input id="probe" type="range" min="-3" max="3" step="0.1" value="0"></label>
<label>Contact radius <input id="radius" type="range" min="0.3" max="4" step="0.1" value="1.8"></label>
<label>Time <input id="seek" type="range" min="0" max="20" step="0.01" value="0"></label><span id="time"></span>
<canvas id="view" width="1100" height="540"></canvas><p id="stats"></p>
<p>Drag to orbit. Cyan = frozen; amber = active; pink circle = contact probe. Reset clears events. Seeking replays the same event log.</p>
<p>Computational metaphor, not quantum mechanics, fluid dynamics, or collision detection. Contacts are authored spatial events. Level physics, schemas, and engine export integration are deferred.</p></main>
<script>
const kernel=(${buildParticleVacuum.toString()})(${JSON.stringify(template)}),particles=${JSON.stringify(particles)};
let events=[],time=0,playing=true,last=null,yaw=0.65,pitch=0.5,drag=null,counter=0;
const $=id=>document.getElementById(id),ctx=$('view').getContext('2d');
function project(p){const a=p[0]*Math.cos(yaw)-p[1]*Math.sin(yaw),b=p[0]*Math.sin(yaw)+p[1]*Math.cos(yaw);return [550+a*87,280+(b*Math.sin(pitch)-p[2]*Math.cos(pitch))*87]}
function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function draw(){ctx.clearRect(0,0,1100,540);for(let i=-4;i<=4;i++){line([[i,-4,-1.3],[i,4,-1.3]],'#20334b');line([[-4,i,-1.3],[4,i,-1.3]],'#20334b')}
const states=kernel.sample(particles,events,time);states.forEach(p=>p.polylines.forEach(l=>line(l,p.active?'#ffbe66':'#5fc7d7')));
const x=+$('probe').value,r=+$('radius').value;line(Array.from({length:65},(_,i)=>[x+r*Math.cos(i*Math.PI/32),r*Math.sin(i*Math.PI/32),0]),'#ec81b0',2);
$('time').textContent=time.toFixed(2)+' s';$('seek').value=time;$('stats').textContent=states.filter(p=>p.active).length+' active / '+states.length+' carriers · '+events.length+' contacts · '+states.filter(p=>p.contacts).length+' carriers touched'}
$('contact').onclick=()=>{events.push({id:'contact-'+String(++counter).padStart(6,'0'),time,center:[+$('probe').value,0,0],radius:+$('radius').value,impulse:[1.7,0,0.5]});draw()};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play'};
$('reset').onclick=()=>{events=[];counter=0;time=0;draw()};$('seek').oninput=()=>{time=+$('seek').value;playing=false;$('play').textContent='Play';draw()};
$('probe').oninput=$('radius').oninput=draw;
$('view').onpointerdown=e=>{drag=[e.clientX,e.clientY];$('view').setPointerCapture(e.pointerId)};
$('view').onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*0.01;pitch=Math.max(-1.3,Math.min(1.3,pitch+(e.clientY-drag[1])*0.01));drag=[e.clientX,e.clientY];draw()};$('view').onpointerup=()=>drag=null;
function frame(now){if(playing&&last!==null)time=Math.min(20,time+(now-last)/1000);last=now;draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
</script>`;
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,html);console.log(output);
