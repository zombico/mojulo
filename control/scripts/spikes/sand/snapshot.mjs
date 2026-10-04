import {buildSand} from './kernel.mjs';
import {seedHopper} from './scene.mjs';
import {writeFileSync,mkdirSync}from 'node:fs';
import{resolve,dirname}from 'node:path';
const s=buildSand(),gate=seedHopper(s);
function settle(){for(let i=0;i<3000;i++)if(!s.step().active)return;throw Error('not settled')}
settle();const held=s.cells.slice();for(const[x,y]of gate)s.set(x,y,0);settle();const released=s.cells.slice();
function panel(cells,offset,title){let svg=`<g transform="translate(${offset},110)"><text x="0" y="-25" fill="#e7c58a" font-size="22">${title}</text><rect width="720" height="480" rx="8" fill="#151f2a"/>`;for(let y=0;y<120;y++){for(let x=0;x<180;){const v=cells[y*180+x];let end=x+1;while(end<180&&cells[y*180+end]===v)end++;if(v)svg+=`<rect x="${x*4}" y="${y*4}" width="${(end-x)*4}" height="4" fill="${v===1?'#e1bc7f':'#596d7f'}"/>`;x=end}}return svg+'</g>'}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1520" height="670"><rect width="1520" height="670" fill="#10151c"/><g font-family="sans-serif"><text x="28" y="42" fill="#eef0e8" font-size="28">Sleeping sand — the same grains, before and after opening the gate</text>${panel(held,28,'Closed gate · supported pile')}${panel(released,772,'Open gate · discharged heap')}<text x="28" y="635" fill="#aeb7c0" font-size="17">${s.stats().grains} grains conserved · both final states asleep · gravity, sliding μ 0.58 (30°), static μs 0.67 (34°) · 2D occupancy approximation</text></g></svg>`;
const output=resolve(process.argv[2]||'scripts/spikes/sand/snapshot.svg');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,svg);console.log(output);
