"""
handoff_probe.py - THE HANDOFF'S PROBE in Unreal (scene/handoff-unreal.js's gate): run after the import, headless
(`UnrealEditor-Cmd <pack>/MojuloHandoff.uproject -run=pythonscript -script=<pack>/mojulo/handoff_probe.py -nullrhi`).
It opens the developer's level (mojulo's sublevel streamed in) and prints one line, `[mojulo-handoff-probe] {json}`: what
the importer built from the handoff, to be held against handoff.json.
"""
import json
import os

import unreal

HERE = os.environ.get('MOJULO_HANDOFF') or os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'handoff.json')) as _f:
    H = json.load(_f)
_P = H.get('paths') or {}
MAP = os.environ.get('MOJULO_UNREAL_MAP') or _P.get('map') or '/Game/Level'
ROOT = os.environ.get('MOJULO_UNREAL_ROOT') or _P.get('root') or '/Game/Mojulo'
SUB = ROOT + '/Level_Mojulo'
EAL = unreal.EditorAssetLibrary


def tags(a):
    return [str(t) for t in (a.get_editor_property('tags') or [])]


def overridden(mi, name):
    """The texture an instance sets for a parameter of its master, else None (the master's default)."""
    try:
        for t in mi.get_editor_property('texture_parameter_values'):
            if str(t.get_editor_property('parameter_info').get_editor_property('name')) == name:
                return t.get_editor_property('parameter_value')
    except Exception:  # noqa: BLE001
        pass
    return None


def param(mi, kind, name):
    try:
        if kind == 'tex':
            return unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mi, name)
        if kind == 'vec':
            return unreal.MaterialEditingLibrary.get_material_instance_vector_parameter_value(mi, name)
        return unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi, name)
    except Exception:  # noqa: BLE001
        return None


def main():
    out = {'ok': True, 'unreal': unreal.SystemLibrary.get_engine_version(), 'handoff': None, 'level': False, 'map': MAP, 'streamed': False,
           'materials': 0, 'lit': 0, 'translucent': 0, 'vertex_colour': 0, 'normal': 0, 'orm': 0, 'height': 0, 'other_materials': 0,
           'markers': 0, 'seats': 0, 'marker_records': 0, 'sun': False, 'sun_lux': None, 'sun_default': False, 'points': 0, 'lamps': 0, 'point_cd': 0.0,
           'ambient': None, 'sky': False, 'tone': False, 'haze': None, 'cameras': 0, 'skeletal': 0, 'anims': 0, 'entity_meshes': 0,
           'terrain': 0, 'terrain_layers': 0, 'terrain_path': False, 'sea': 0, 'sea_depth': False, 'sea_shadow': None,
           'blocking': 0, 'no_collision': 0, 'objects': 0, 'developer': 0, 'actors': 0}
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not EAL.does_asset_exist(MAP) or not les.load_level(MAP):
        out['ok'] = False
        out['error'] = 'no level at ' + MAP
        print('[mojulo-handoff-probe] ' + json.dumps(out, sort_keys=True))
        return
    w = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    out['streamed'] = any(lv.get_outermost().get_name() == SUB for lv in unreal.EditorLevelUtils.get_levels(w))
    seen_mi = set()
    for a in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
        out['actors'] += 1
        t = tags(a)
        lvl = a.get_level().get_outermost().get_name() if a.get_level() else ''
        if lvl != SUB:
            if not isinstance(a, unreal.WorldSettings) and a.get_class() != unreal.Brush.static_class():
                out['developer'] += 1
            continue
        if 'mojulo' in t:
            out['objects'] += 1
        rec = next((x for x in t if x.startswith('mojulo:{')), None)
        if rec:
            try:
                json.loads(rec[len('mojulo:'):])
                out['marker_records'] += 1
            except Exception:  # noqa: BLE001
                pass
        if 'mojulo:marker' in t:
            out['markers'] += 1
        if 'mojulo:seat' in t:
            out['seats'] += 1
        if 'mojulo:level' in t:
            out['handoff'] = next((x[len('handoff:'):] for x in t if x.startswith('handoff:')), None)
            out['level'] = True
        if 'mojulo:camera' in t:
            out['cameras'] += 1
        if isinstance(a, unreal.DirectionalLight) and 'mojulo:sun' in t:
            out['sun'] = True
            out['sun_lux'] = round(a.light_component.get_editor_property('intensity'), 5)
            out['sun_default'] = 'mojulo:default' in t
            out['sun_shadow'] = bool(a.light_component.get_editor_property('cast_shadows'))
        if isinstance(a, unreal.SkyLight) and 'mojulo:ambient' in t:
            c = a.light_component
            k = c.get_editor_property('intensity')
            lc = c.get_editor_property('light_color')
            lin = unreal.LinearColor(lc.r / 255.0, lc.g / 255.0, lc.b / 255.0, 1.0)
            f = [((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in (lin.r, lin.g, lin.b)]
            out['ambient'] = [round(k * x, 4) for x in f]
            out['ambient_cubemap'] = c.get_editor_property('cubemap') is not None
        if 'mojulo:sky' in t:
            out['sky'] = True
        if isinstance(a, unreal.PostProcessVolume) and 'mojulo:tone' in t:
            st = a.get_editor_property('settings')
            bl = st.get_editor_property('weighted_blendables').get_editor_property('array')
            mi = bl[0].get_editor_property('object') if bl else None
            out['tone'] = mi is not None and mi.get_name() == 'MI_MojuloTone'
            out['exposure_manual'] = st.get_editor_property('auto_exposure_method') == unreal.AutoExposureMethod.AEM_MANUAL
            if mi is not None:
                hk = param(mi, 'vec', 'HazeK')
                out['haze'] = round(hk.r, 6) if hk is not None and hk.r > 0 else None
        for c in a.get_components_by_class(unreal.PointLightComponent):
            out['points'] += 1
            out['lamps'] += 0 if c.get_editor_property('cast_shadows') else 1
            out['point_cd'] = round(out['point_cd'] + c.get_editor_property('intensity'), 4)
        if isinstance(a, unreal.SkeletalMeshActor):
            out['skeletal'] += 1
        for c in a.get_components_by_class(unreal.StaticMeshComponent):
            if c.get_editor_property('static_mesh') is None or 'mojulo:sky' in t:
                continue
            if a.get_actor_label().startswith('entity_'):
                out['entity_meshes'] += 1
            if c.get_collision_enabled() == unreal.CollisionEnabled.NO_COLLISION:
                out['no_collision'] += 1
            else:
                out['blocking'] += 1
            for i in range(c.get_num_materials()):
                m = c.get_material(i)
                if m is None:
                    continue
                n = m.get_name()
                if n == 'MI_MojuloTerrain':
                    out['terrain'] += 1
                elif n == 'MI_MojuloSea':
                    out['sea'] += 1
                    out['sea_shadow'] = bool(c.get_editor_property('cast_shadow'))
                    out['sea_depth'] = overridden(m, 'TDepth') is not None
                if n in seen_mi:
                    continue
                seen_mi.add(n)
        for c in a.get_components_by_class(unreal.SkeletalMeshComponent):
            sk = None
            for prop in ('skeletal_mesh_asset', 'skeletal_mesh'):
                try:
                    sk = c.get_editor_property(prop)
                    break
                except Exception:  # noqa: BLE001 - the name this Unreal gives it
                    continue
            if sk is None:
                continue
            for s in sk.get_editor_property('materials'):
                m = s.get_editor_property('material_interface')
                if m is not None:
                    seen_mi.add(m.get_name())
    for n in sorted(seen_mi):
        p = ROOT + '/Assets/Materials/' + n
        m = EAL.load_asset(p) if EAL.does_asset_exist(p) else None
        out['materials'] += 1
        if m is None or not isinstance(m, unreal.MaterialInstance):
            out['other_materials'] += 1
            continue
        parent = m.get_editor_property('parent')
        pn = parent.get_name() if parent else ''
        if pn in ('M_MojuloLit', 'M_MojuloLitTranslucent'):
            out['lit' if pn == 'M_MojuloLit' else 'translucent'] += 1
            # (the lit masters take the vertex colour as base where the mesh carries one)
            try:
                uvc = unreal.MaterialEditingLibrary.get_material_instance_static_switch_parameter_value(m, 'UseVertexColour')
            except Exception:  # noqa: BLE001
                uvc = None
            if uvc:
                out['vertex_colour'] += 1
            if overridden(m, 'NormalTex') is not None:
                out['normal'] += 1
            if overridden(m, 'OrmTex') is not None:
                out['orm'] += 1
            if overridden(m, 'HeightTex') is not None:
                out['height'] += 1
                out['height_ratio'] = param(m, 'scalar', 'HeightRatio')
        elif n == 'MI_MojuloTerrain':
            arr = overridden(m, 'TBase') or param(m, 'tex', 'TBase')
            try:
                out['terrain_layers'] = len(arr.get_editor_property('source_textures')) if arr is not None else 0
            except Exception:  # noqa: BLE001
                out['terrain_layers'] = None
            tp = overridden(m, 'TPath')
            out['terrain_path'] = tp is not None and tp.get_name() == 'T_MojuloPath'
    out['anims'] = len([p for p in EAL.list_assets(ROOT + '/Assets', recursive=True, include_folder=False) if isinstance(EAL.load_asset(p), unreal.AnimSequence)])
    print('[mojulo-handoff-probe] ' + json.dumps(out, sort_keys=True))
    unreal.log('[mojulo-handoff-probe] ' + json.dumps(out, sort_keys=True))


main()
