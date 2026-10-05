import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {sampleWaveField} from '../../../lib/graph/polygonizer/wave-field.js';
import {buildWaveSand}from './kernel.mjs';
import{makeWaveGround,waveHeights}from './terrain.mjs';
const data=makeWaveGround(),ground=waveHeights(data,1.4),sum=s=>s.mass.reduce((a,b)=>a+b,0);
function settle(s){for(let t=0;t<10000;t++)if(!s.step().active)return t+1;throw Error('not settled')}
function make(g){const s=buildWaveSand({n:data.n,spacing:data.spacing,ground:g});for(let y=9;y<=23;y++)for(let x=9;x<=23;x++)s.deposit(x,y,24);return s}
const phase=0.73, amplitude=1.8, derived=waveHeights(data,amplitude,phase);
const direct=sampleWaveField({...data.spec,waves:[{amplitude,cycles:{u:1,v:0},phase},{amplitude:0.65*amplitude,cycles:{u:0,v:1},phase:phase+0.9}]},null,data.corners).gridPoints;
for(let y=0;y<33;y++)for(let x=0;x<33;x++)assert(Math.abs(derived[y*33+x]-direct[x][y].z)<1e-12);
const s=make(ground),total=sum(s);settle(s);assert.equal(sum(s),total);assert.equal(s.stats().total,total);assert.equal(s.step().checked,0);
const snap=s.snapshot();for(let i=0;i<s.mass.length;i++){assert.equal(snap.top[i],ground[i]+s.mass[i]*s.grainHeight);if(!s.mass[i])continue;for(const j of [i%33>0?i-1:-1,i%33<32?i+1:-1,i>=33?i-33:-1,i<1056?i+33:-1])if(j>=0)assert(snap.top[i]-snap.top[j]<=s.repose*s.spacing+s.grainHeight+1e-8)}
const flat=make(waveHeights(data,0));settle(flat);assert.notDeepEqual(Array.from(s.mass),Array.from(flat.mass));
const before=s.mass.slice();s.setGround(waveHeights(data,1.4,Math.PI));assert(s.stats().active>0);settle(s);assert.equal(sum(s),total);assert.notDeepEqual(s.mass,before);
const repeat=make(ground);settle(repeat);assert.deepEqual(repeat.mass,Uint32Array.from(snap.mass));
assert.throws(()=>s.setGround([NaN]));
const timed=make(ground);const start=performance.now();const ticks=settle(timed);const elapsed=performance.now()-start;
console.log(JSON.stringify({passed:['basis reconstruction matches actual wave-field sampler','mass conservation','zero settled grain checks','height equals ground plus sand depth','repose equilibrium','waveform changes sand distribution','phase deformation wakes and redistributes sand','deterministic replay','finite terrain validation'],benchmark:{grid:'33×33',massUnits:total,ticks,totalMs:+elapsed.toFixed(2),meanMsPerTick:+(elapsed/ticks).toFixed(4)},scope:'quasi-static 2.5D layer rendered in 3D; Node solver only'},null,2));
