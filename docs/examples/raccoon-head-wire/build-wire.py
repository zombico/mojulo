from pathlib import Path
import json, math, html, os
import numpy as np
from PIL import Image, ImageDraw
P=Path(__file__).resolve().parent
# Renders land in the gitignored spike tree; docs keeps the code, the source and one canonical SVG.
OUT=Path(os.environ.get('MOJULO_SPIKE_OUT') or P.parents[2]/'lite-template/integration/0924/spike-output/raccoon-head-wire')
def set_source(source):
 global D,V,F,G,W,N,cent,edges,feature_edges
 D=source;V=np.array(D['vertices']);F=D['faces'];G=D['groups'];W=900
 N=[];cent=[];edges={}
 for j,f in enumerate(F):
  p=V[f];n=np.cross(p[1]-p[0],p[2]-p[0]);n=n/(np.linalg.norm(n) or 1);N.append(n);cent.append(p.mean(axis=0))
  for a,b in zip(f,f[1:]+f[:1]):edges.setdefault(tuple(sorted((a,b))),[]).append(j)
 N=np.array(N);cent=np.array(cent)
 feature_edges={tuple(sorted(e)) for e in D.get('featureEdges',[])}
set_source(json.loads((P/'head-source.json').read_text()))
TARGET=[0,0,1.60];DIST=1.35
def set_framing(target,distance):
 """Camera target and distance (world units). Defaults are the raccoon's; the line rules never change."""
 global TARGET,DIST
 TARGET=list(target);DIST=distance
features={'Eyes','Nose','Eye mask','Muzzle','Ear inset'}
def project(az):
 a=math.radians(az);e=math.radians(10);target=np.array(TARGET,dtype=float);pos=target+DIST*np.array([math.cos(e)*math.sin(a),-math.cos(e)*math.cos(a),math.sin(e)])
 R=np.array([[math.cos(a),math.sin(a),0],[math.sin(e)*math.sin(a),-math.sin(e)*math.cos(a),-math.cos(e)],[-math.cos(e)*math.sin(a),math.cos(e)*math.cos(a),-math.sin(e)]])
 c=(V-pos)@R.T
 if np.any(c[:,2]<=0):raise ValueError('source behind camera; near-plane clipping not supported')
 q=np.column_stack([W/2+1400*c[:,0]/c[:,2],W/2+1400*c[:,1]/c[:,2],c[:,2]])
 return q,pos

def visible_samples(xy,z,triangles):
  p=triangles
  den=(p[:,1,1]-p[:,2,1])*(p[:,0,0]-p[:,2,0])+(p[:,2,0]-p[:,1,0])*(p[:,0,1]-p[:,2,1])
  ok=np.abs(den)>1e-12;p=p[ok];den=den[ok]
  if len(p)==0:return np.ones(len(xy),dtype=bool)
  x=xy[:,0,None];y=xy[:,1,None]
  ba=((p[:,1,1]-p[:,2,1])*(x-p[:,2,0])+(p[:,2,0]-p[:,1,0])*(y-p[:,2,1]))/den
  bb=((p[:,2,1]-p[:,0,1])*(x-p[:,2,0])+(p[:,0,0]-p[:,2,0])*(y-p[:,2,1]))/den
  bc=1-ba-bb
  with np.errstate(divide='ignore',invalid='ignore'):
   depths=1/(ba/p[:,0,2]+bb/p[:,1,2]+bc/p[:,2,2])
  nearest=np.min(np.where((ba>=-1e-8)&(bb>=-1e-8)&(bc>=-1e-8),depths,np.inf),axis=1)
  return z<=nearest+1e-5

def view(az):
 q,pos=project(az)
 triangles=np.array([q[[f[0],f[k],f[k+1]]] for f in F for k in range(1,len(f)-1)])
 facing=np.sum(N*(pos-cent),axis=1);paths=[]
 for (a,b),fs in edges.items():
  groups={G[i] for i in fs};boundary=len(fs)==1;crease=boundary or any(abs(np.dot(N[fs[0]],N[j]))<math.cos(math.radians(7)) for j in fs[1:]);silhouette=boundary or (min(facing[fs])<0<max(facing[fs]));feature=bool(groups&features) or (a,b) in feature_edges
  if not (crease or len(groups)>1 or silhouette or (a,b) in feature_edges):continue
  typ='outline' if silhouette else 'feature' if feature else 'plane';pa,pb=q[a],q[b];length=np.linalg.norm(pa[:2]-pb[:2]);steps=max(2,int(length*2)+1);t=np.linspace(0,1,steps);xy=pa[:2]+t[:,None]*(pb[:2]-pa[:2]);z=1/((1-t)/pa[2]+t/pb[2])
  # Evaluate triangle depths at the exact projected edge samples, avoiding
  # silhouette cracks caused by comparing against neighboring raster pixels.
  seen=visible_samples(xy,z,triangles)
  start=0
  for j in range(1,steps+1):
   if j==steps or seen[j]!=seen[start]:
    end=j-1
    if end>start and np.linalg.norm(xy[end]-xy[start])>.7:paths.append({'edge':[int(a),int(b)],'type':typ,'visible':bool(seen[start]),'screenT':[float(t[start]),float(t[end])],'xyzT':[float((t[k]/pb[2])/((1-t[k])/pa[2]+t[k]/pb[2])) for k in [start,end]],'xy':[xy[start].tolist(),xy[end].tolist()]})
    start=j
 return paths
styles={'outline':('#253744',2.7),'feature':('#344b59',2.0),'plane':('#82939c',1.05)}
def svg(paths,hidden=False,az=150):
 s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><title>Detailed raccoon head — spatial wire drawing</title><metadata id="spatial-source">'+html.escape(json.dumps(D,separators=(',',':')))+'</metadata><rect width="900" height="900" fill="#f7f5ef"/>']
 s.append('<metadata id="projection">'+html.escape(json.dumps({'azimuthDegrees':az,'elevationDegrees':10,'target':TARGET,'distance':DIST,'focalPixels':1400,'principal':[450,450],'viewBox':[0,0,900,900],'basis':'physical right=forward cross world-up; SVG y down','visibility':'half-pixel samples; perspective-correct triangle depth; tolerance 1e-5 world units','hiddenEdges':hidden},sort_keys=True))+'</metadata>')
 for j,p in enumerate(sorted(paths,key=lambda p:(p['visible'],['plane','feature','outline'].index(p['type'])))):
  if not p['visible'] and not hidden:continue
  col,width=styles[p['type']] if p['visible'] else ('#c7cccd',.8);(x,y),(u,v)=p['xy'];dash='' if p['visible'] else ' stroke-dasharray="3 5"'
  point_ids=' data-point-ids="'+html.escape(' '.join(D['pointIds'][i] for i in p['edge']),quote=True)+'"' if 'pointIds' in D else ''
  s.append(f'<path{point_ids} id="edge-{p["edge"][0]}-{p["edge"][1]}-run-{j}" data-spatial-edge="{p["edge"][0]} {p["edge"][1]}" data-visible="{str(p["visible"]).lower()}" data-source-t="{p["xyzT"][0]:.10f} {p["xyzT"][1]:.10f}" data-edge-role="{p["type"]}" d="M{x:.3f},{y:.3f} L{u:.3f},{v:.3f}" fill="none" stroke="{col}" stroke-width="{width}" stroke-linecap="round"{dash}/>')
 return ''.join(s)+'</svg>'
def png(paths):
 im=Image.new('RGB',(W*2,W*2),'#f7f5ef');d=ImageDraw.Draw(im)
 for p in sorted(paths,key=lambda p:['plane','feature','outline'].index(p['type'])):
  if not p['visible']:continue
  col,width=styles[p['type']];d.line([tuple(v*2 for v in xy) for xy in p['xy']],fill=col,width=max(1,round(width*2)))
 return im.resize((W,W),Image.Resampling.LANCZOS)
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--turntable',action='store_true');args=parser.parse_args()
 OUT.mkdir(parents=True,exist_ok=True);frames=[]
 for i in range(48 if args.turntable else 0):
  paths=view(150+i*360/48);frames.append(png(paths).resize((600,600),Image.Resampling.LANCZOS))
 for name,az in [('three-quarter',150),('front',180),('profile',90),('back',0)]:
  paths=view(az);(OUT/f'head-{name}.svg').write_text(svg(paths,az=az));png(paths).save(OUT/f'head-{name}.png')
  if name=='three-quarter':(OUT/'head-construction.svg').write_text(svg(paths,True,az=az));(P/'head-three-quarter.svg').write_text(svg(paths,az=az))
 if frames:frames[0].save(OUT/'head-wire-turntable.gif',save_all=True,append_images=frames[1:],duration=100,loop=0)
 print('Generated',len(frames),'turntable frames and 5 vector drawings; head edges:',len(edges))
