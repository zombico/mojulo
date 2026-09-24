"""seed-recipe.py — how recipe.json was authored ONCE from the imported wire head: parts by group,
explicit point/face keys, symmetric pin faces chosen by mirror correspondence, local offsets in each
pin frame, and the two brow creases as shared skull edges. Re-running it must reproduce recipe.json
byte for byte; it is the authoring record, not part of the render path."""
import json,math,hashlib
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent;R=P.parents[2]
d=json.loads((R/'docs/examples/raccoon-head-wire/head-source.json').read_text());V=np.array(d['vertices']);parts={}
for i,(f,g) in enumerate(zip(d['faces'],d['groups'])):
 if g in ['Face planes','Eye mask','Skull']:name='skull'
 elif g=='Muzzle':name='muzzle'
 elif g=='Nose':name='nose'
 else:name={'Eyes':'eye','Ears':'ear','Ear inset':'ear-inset'}[g]+('.R' if V[f].mean(axis=0)[0]>0 else '.L')
 part=parts.setdefault(name,{'points':{},'faces':{},'groups':{},'closure':'open' if g=='Ear inset' else 'closed'})
 for j in f:part['points'][f'{name}/point-{j:03}']=d['vertices'][j]
 fid=f'{name}/face-{i:03}';part['faces'][fid]=[f'{name}/point-{j:03}' for j in f];part['groups'][fid]=g
original=json.loads(json.dumps(parts))
# Imported point and face IDs are explicit keys, never rebuilt from array order.
for name in sorted(parts,key=lambda k: (k.endswith('.L'),k)):
 part=parts[name]
 if name in ['skull','muzzle']:part['layer']=1;continue
 part['layer']=3 if name.startswith('ear-inset') else 2
 parent='muzzle' if name=='nose' else 'ear.'+name[-1] if name.startswith('ear-inset') else 'skull'
 target=original[parent];center=np.mean(list(part['points'].values()),axis=0)
 candidates=list(target['faces'])
 if name.startswith('ear.'):
  candidates=[k for k in candidates if target['groups'][k]=='Face planes']
 if name=='nose':
  candidates=[k for k,f in target['faces'].items() if all(any(np.linalg.norm(np.array(target['points'][b])-np.array([-target['points'][a][0],target['points'][a][1],target['points'][a][2]]))<1e-7 for b in f) for a in f)]
 if name.endswith('.L'):
  rp=parts[name[:-1]+'R']['pin'];right=original[rp['parent']]
  expected=[np.array([-right['points'][k][0],right['points'][k][1],right['points'][k][2]]) for k in right['faces'][rp['face']]]
  candidates=[k for k,f in target['faces'].items() if all(any(np.linalg.norm(np.array(target['points'][v])-p)<1e-7 for v in f) for p in expected)]
 assert candidates,name
 fid=min(candidates,key=lambda k:np.linalg.norm(np.mean([target['points'][x] for x in target['faces'][k]],axis=0)-center))
 face=target['faces'][fid];edge=face[:2];hand=1
 if name.endswith('.L'):
  edge=[min(face,key=lambda j:np.linalg.norm(np.array(target['points'][j])-np.array([-right['points'][k][0],right['points'][k][1],right['points'][k][2]]))) for k in rp['tangentEdge']];hand=-1
 p=np.array([target['points'][x] for x in face]);n=np.cross(p[1]-p[0],p[2]-p[0]);n/=np.linalg.norm(n);t=np.array(target['points'][edge[1]])-target['points'][edge[0]];t/=np.linalg.norm(t);b=np.cross(n,t)*hand;o=p.mean(axis=0)
 part['pin']={'id':name+'/surface-pin','parent':parent,'face':fid,'weights':[1/3]*3,'tangentEdge':edge,'handedness':hand}
 part['offsets']={k:[float(np.dot(np.array(v)-o,a)) for a in [t,b,n]] for k,v in part.pop('points').items()}
# Shared L1 edges at the upper mask boundary, explicitly authored by coordinates.
creases={}
for side in [-1,1]:
 pts=[[side*.23*.34,.36*.34,.35*.34+1.53],[side*.65*.34,.25*.34,-.06*.34+1.53]]
 ids=[min(parts['skull']['points'],key=lambda k:np.linalg.norm(np.array(parts['skull']['points'][k])-p)) for p in pts]
 creases['brow.'+('R' if side>0 else 'L')]={'parent':'skull','edge':ids,'closure':'open-line'}
# Declare exact open boundaries, not merely a boundary edge count.
for part in parts.values():
 if part['closure']=='open':
  edges={}
  for f in part['faces'].values():
   for a,b in zip(f,f[1:]+f[:1]):edges.setdefault(tuple(sorted([a,b])),0);edges[tuple(sorted([a,b]))]+=1
  part['boundary']=[list(e) for e,n in edges.items() if n==1]
recipe={'schema':'layered-surface-pin-study-v1','frame':{'up':'+z','front':'+y','scale':'same as wire-head reference'},'identity':'Explicit imported point/face keys; reordering allowed, deletions fail pins. No implicit nearest rebinding.','symmetry':{'plane':'x=0','paired':['eye','ear','ear-inset'],'policy':'symmetric reference fixture and symmetric shape controls; arbitrary asymmetry overrides not implemented'},'parts':parts,'creases':creases,'source':{'path':'../raccoon-head-wire/head-source.json','sha256':hashlib.sha256((R/'docs/examples/raccoon-head-wire/head-source.json').read_bytes()).hexdigest(),'method':'Imported once; named pins and local offsets authored against frozen topology; compiler performs no nearest search.'}}
(P/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
print([(k,v.get('pin',{}).get('face')) for k,v in parts.items()])
