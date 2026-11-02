"""
handoff_probe.py - THE HANDOFF'S PROBE in Blender (scene/handoff-blender.js's gate): run on the saved level.blend after
the import (`blender -b level.blend --python mojulo/handoff_probe.py`). It prints one line, `[mojulo-handoff-probe] {json}`:
what the importer built from the handoff, to be held against handoff.json.
"""
import bpy
import json

TAG = 'mojulo_handoff'


def base_name(n):
    if len(n) > 4 and n[-4] == '.' and n[-3:].isdigit():
        return n[:-4]
    return n


def coll_count(name):
    c = bpy.data.collections.get(name)
    return len(c.objects) if c is not None else 0


def main():
    sc = bpy.context.scene
    out = {'ok': True, 'blender': bpy.app.version_string, 'handoff': sc.get('mojulo_handoff', ''), 'level': bool(sc.get('mojulo_level')),
           'materials': 0, 'principled': 0, 'vertex_colour': 0, 'normal': 0, 'orm': 0, 'height': 0, 'haze': 0,
           'markers': coll_count('Mojulo Markers'), 'seats': coll_count('Mojulo Seats'), 'marker_records': 0,
           'world': False, 'sky': False, 'ambient': None, 'sun': False, 'sun_strength': None, 'sun_default': False, 'points': 0, 'lamps': 0, 'point_energy': 0.0,
           'camera': None, 'armatures': 0, 'actions': len([a for a in bpy.data.actions if a.get(TAG)]), 'skinned': 0, 'entity_meshes': 0,
           'terrain': 0, 'terrain_splat': 0, 'terrain_layers': 0, 'terrain_path': False, 'sea': 0, 'sea_depth': False, 'sea_shadow': None,
           'view_transform': sc.view_settings.view_transform, 'engine': sc.render.engine, 'objects': 0, 'artist': 0, 'fire': None}
    for m in bpy.data.materials:
        if not m.get(TAG) or not m.node_tree:
            continue
        nodes = m.node_tree.nodes
        out['materials'] += 1
        if any(n.type == 'BSDF_PRINCIPLED' for n in nodes):
            out['principled'] += 1
        if any(n.type == 'VERTEX_COLOR' for n in nodes):
            out['vertex_colour'] += 1
        if any(n.type == 'NORMAL_MAP' and n.outputs[0].links for n in nodes):
            out['normal'] += 1
        if any(n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'Non-Color' and n.name != 'mojulo:height' for n in nodes) and any(n.type == 'SEPARATE_COLOR' for n in nodes):
            out['orm'] += 1
        if any(n.name == 'mojulo:height' and n.image for n in nodes):
            out['height'] += 1
        if any(n.type == 'GROUP' and n.node_tree and n.node_tree.name.startswith('mojulo:haze') for n in nodes):
            out['haze'] += 1
    tg = next((g for g in bpy.data.node_groups if g.get(TAG) and base_name(g.name) == 'mojulo:terrain'), None)
    if tg is not None:
        imgs = [n.image for n in tg.nodes if n.type == 'TEX_IMAGE' and n.image]
        out['terrain_layers'] = len(set(i.name for i in imgs if base_name(i.name).startswith('base_')))
        out['terrain_path'] = any(base_name(i.name) == 'path.png' for i in imgs)
        out['terrain_nodes'] = len(tg.nodes)
    for o in bpy.data.objects:
        if o.get(TAG):
            out['objects'] += 1
        else:
            out['artist'] += 1
            continue
        if o.type == 'MESH':
            names = [base_name(m.name) for m in o.data.materials if m]
            if 'mojulo:terrain' in names:
                out['terrain'] += 1
                if '_SPLAT' in o.data.attributes:
                    out['terrain_splat'] += 1
            if 'mojulo:sea' in names:
                out['sea'] += 1
                out['sea_shadow'] = o.visible_shadow
                sm = next(m for m in o.data.materials if m and base_name(m.name) == 'mojulo:sea')
                out['sea_depth'] = any(n.type == 'TEX_IMAGE' and n.image for n in sm.node_tree.nodes)
            if any(md.type == 'ARMATURE' for md in o.modifiers):
                out['skinned'] += 1
            if o.name.startswith('entity:'):
                out['entity_meshes'] += 1
        if o.type == 'ARMATURE':
            out['armatures'] += 1
        if o.type == 'LIGHT' and o.data.type == 'SUN' and base_name(o.name) == 'mojulo:sun':
            out['sun'] = True
            out['sun_strength'] = round(o.data.energy, 5)
            out['sun_default'] = bool(o.get('mojulo_default', False))
        if o.type == 'LIGHT' and o.data.type in ('POINT', 'SPOT'):
            out['points'] += 1
            out['lamps'] += 0 if o.data.use_shadow else 1
            out['point_energy'] = round(out['point_energy'] + o.data.energy, 4)
        if o.get('mojulo'):
            try:
                json.loads(o['mojulo'])
                out['marker_records'] += 1
            except Exception:
                pass
    w = sc.world
    if w is not None and w.get(TAG):
        out['world'] = True
        out['sky'] = bool(w.get('mojulo_sky', False))
        out['ambient'] = list(w['mojulo_ambient']) if w.get('mojulo_ambient') else None
    if sc.camera is not None:
        out['camera'] = sc.camera.name
    fc = bpy.data.collections.get('mojulo-fire')
    if fc is not None:
        out['fire'] = {'objects': len(fc.all_objects), 'volumes': sum(1 for o in fc.all_objects if o.type == 'VOLUME'), 'lights': sum(1 for o in fc.all_objects if o.type == 'LIGHT')}
    print('[mojulo-handoff-probe] ' + json.dumps(out, sort_keys=True))


main()
