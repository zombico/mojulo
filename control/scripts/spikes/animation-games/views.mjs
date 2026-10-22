// animation-games views: the two cameras every player draws with, as page code (a string the players inline).
//   side   travel (+y) to the right, up (+z) up: an orthographic camera on the body's right
//   ¾      the same camera swung 35° round behind the body and raised 30° (a third-person game's): ahead is up and to
//          the right, the floor a grid of metres, so depth and the side-to-side read
// proj(view, x, y, z) → [u, v] metres on the screen (v up); drawGrid(ctx, view, toScreen, y0, y1, x0, x1, colour) draws the
// floor's metre lines; drawQuad(ctx, view, toScreen, pts, fill) a flat face (a wall) through its corners.
export const VIEW_JS = `
const VIEWS=['side','three'],VIEW_NAME={side:'side',three:'¾ overhead'};
const AZ=-35*Math.PI/180,EL=30*Math.PI/180,CA=Math.cos(AZ),SA=Math.sin(AZ),CE=Math.cos(EL),SE=Math.sin(EL);
function proj(view,x,y,z){if(view==='side')return [y,z];const u=-x*SA+y*CA,toward=x*CA+y*SA;return [u,z*CE-toward*SE];}
function drawGrid(ctx,view,S,y0,y1,x0,x1,col){if(view!=='three')return;ctx.strokeStyle=col;ctx.lineWidth=1;ctx.globalAlpha=.35;
 for(let y=Math.ceil(y0);y<=y1;y++){const a=S(proj(view,x0,y,0)),b=S(proj(view,x1,y,0));ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
 for(let x=Math.ceil(x0);x<=x1;x++){const a=S(proj(view,x,y0,0)),b=S(proj(view,x,y1,0));ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}ctx.globalAlpha=1;}
function drawQuad(ctx,view,S,pts,fill){ctx.fillStyle=fill;ctx.beginPath();pts.forEach((p,i)=>{const q=S(proj(view,p[0],p[1],p[2]));i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.fill();}
function drawSticks(ctx,view,S,s,col,w){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';for(let j=0;j<s.length;j+=6){const a=S(proj(view,s[j],s[j+1],s[j+2])),b=S(proj(view,s[j+3],s[j+4],s[j+5]));ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}
`;
