from pathlib import Path
import importlib.util,json,subprocess,html,os
from PIL import Image,ImageDraw,ImageFont
import xml.etree.ElementTree as ET
P=Path(__file__).resolve().parent
# Renders and compiled meshes land in the gitignored spike tree; docs keeps recipe, code and tests.
OUT=Path(os.environ.get('MOJULO_SPIKE_OUT') or P.parents[2]/'lite-template/integration/0924/spike-output/raccoon-layered');OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('wire',P.parent/'raccoon-head-wire/build-wire.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
for mode in ['primary','baseline','deformed']:
 subprocess.run(['node',str(P/'compile.mjs'),mode,str(OUT)],check=True,capture_output=True)
 d=json.loads((OUT/f'{mode}.json').read_text());w.set_source(d)
 for label,az in [('quarter',150),('front',180),('profile',90),('back',0)]:
  paths=w.view(az);(OUT/f'{mode}-{label}.svg').write_text(w.svg(paths,az=az));w.png(paths).save(OUT/f'{mode}-{label}.png')
# A contact sheet of the actual SVG projection previews, not separately drawn views.
canvas=Image.new('RGB',(1800,1260),'#f7f5ef');draw=ImageDraw.Draw(canvas)
for j,mode in enumerate(['primary','baseline','deformed']):
 for row,label in enumerate(['quarter','profile']):
  canvas.paste(Image.open(OUT/f'{mode}-{label}.png').resize((600,600)),(j*600,row*630+30))
 draw.text((j*600+20,6),{'primary':'L1 / closed primary parts','baseline':'L1 + L2 + L3 / baseline','deformed':'Same attachments / skull +18%, muzzle +30%'}[mode],fill='#253744',font=ImageFont.load_default(size=20))
canvas.save(OUT/'comparison.png')
print('Rendered twelve spatial SVGs and comparison')

# Compose the generated SVGs without flattening the paths or losing metadata.
NS='{http://www.w3.org/2000/svg}'
ET.register_namespace('',NS[1:-1])
sheet=ET.Element(NS+'svg',{'viewBox':'0 0 1800 1260'})
ET.SubElement(sheet,NS+'rect',{'width':'1800','height':'1260','fill':'#f7f5ef'})
labels=['L1 / primary parts','Attached details / baseline','Skull +18%, muzzle +30%']
for j,mode in enumerate(['primary','baseline','deformed']):
 label=ET.SubElement(sheet,NS+'text',{'x':str(j*600+20),'y':'26','fill':'#253744','font-size':'22','font-family':'sans-serif'});label.text=labels[j]
 for row,name in enumerate(['quarter','profile']):
  child=ET.parse(OUT/f'{mode}-{name}.svg').getroot();child.set('x',str(j*600));child.set('y',str(row*630+30));child.set('width','600');child.set('height','600')
  for el in child.iter():
   if el.get('id'):el.set('id',mode+'-'+name+'-'+el.get('id'))
  sheet.append(child)
ET.ElementTree(sheet).write(OUT/'comparison.svg',encoding='unicode')
