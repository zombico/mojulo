"""
import_handoff.py - THE ENGINE HANDOFF IN UNREAL (mojulo's scene/handoff.js, written by scene/handoff-unreal.js).

  headless:  UnrealEditor-Cmd <pack>/MojuloHandoff.uproject -run=pythonscript -script=<pack>/mojulo/import_handoff.py
             -unattended -nosplash -AllowCommandletRendering -RenderOffscreen
  in the editor: Output Log > Python > py <pack>/mojulo/import_handoff.py
  another project: MOJULO_HANDOFF=<pack>/mojulo, and MOJULO_UNREAL_MAP / MOJULO_UNREAL_ROOT for where it builds

It builds the level in the project from mojulo/handoff.json and mojulo/level.glb:
  - mojulo's content lives under /Game/Mojulo/ and is replaced whole on every import: its assets (/Game/Mojulo/Assets)
    deleted and imported again, its sublevel (/Game/Mojulo/Level_Mojulo) emptied and built again in place, so what points
    at it holds. The developer's persistent level (/Game/Level) is made the first time, streaming mojulo's sublevel in
    (always loaded), and never touched after but to stream it in again: whatever the developer adds to it stays.
  - imports level.glb with Interchange (glTF's y-up to Unreal's z-up; mojulo's frame lands as Unreal's x, -y, z in cm),
    through its own copies of Interchange's glTF pipelines: the glTF's normals kept, no lightmap UVs, and no Nanite (on a
    renderer without it a Nanite mesh draws its reduced fallback: the trail's cliff at 4,926 of 189,606 triangles, cracks
    between the land's parts): the meshes, instances sharing their meshes, the rigged figures with their clips, the
    cameras, the room's lamps
  - every mesh slot takes a material instance of mojulo's lit master (M_MojuloLit, or M_MojuloLitTranslucent for a glTF
    BLEND): base colour = its texture x its factor x the vertex colour where every primitive on it carries COLOR_0 (a
    static switch: glTF's COLOR_0 is linear, and the VertexColor node reads it back as written, measured in 5.8; a mesh
    without one draws black through it), its normal map (as Unreal reads one: the green flipped), roughness and
    metal from its metal-rough map, occlusion from its own; a dressed face's or a bark's height map bound as a bump
    offset at 0 (at the relief's own depth it reads as nothing over the normal map; a developer raises HeightRatio)
  - the layered ground (`terrain`): every part it names takes M_MojuloTerrain, the page's fragment as HLSL in a Custom
    node (handoff_terrain.hlsl), its layers stacked into Texture2DArrays (a layer a slice), the corners' weights the
    GLB's TEXCOORD_2 and _3, the dice, mask and cover as written
  - the sea (`sea`): its plane takes M_MojuloSea (handoff_sea.hlsl): translucent, faded toward the shore by its depth
    map, the level's sky in its reflection; it casts no shadow, and writes the custom depth the haze reads
  - collision: every static mesh blocks, by its own triangles (complex as simple), but the instanced sets (stones,
    plants) and what is see-through (a decal, a pane, the sea)
  - the environment, measured in Unreal 5.8 against the page's out = base x light: the sun a DirectionalLight of the
    record's intensity in lux (pi x the solve's level lights a white Lambert surface to the level); the lamps (form:lamp:*)
    PointLights of their glTF intensity in candela, inverse-squared to their range (three's window is Unreal's), no
    shadow; the ambient a SkyLight over a white sky (white.hdr) at the solve's ambient (its intensity the colour's
    largest channel, its colour the rest), nothing else lighting (no Lumen, no reflections, no occlusion); the sky a dome
    (handoff_sky.hlsl); the page's tone (Khronos PBR Neutral, exposure 1) and its exp-squared haze (by the view's depth,
    toward the hex over the encoded picture, the sky clear) in one post-process material replacing the tonemapper
    (handoff_tone.hlsl; measured in 5.8: what a material there writes is the picture), on an unbound PostProcessVolume,
    exposure fixed, no bloom, vignette, grain or occlusion
  - a CameraActor at each of the level's camera markers (MojuloCamera_<name>), looking where it looks
  - every marker and seat a TargetPoint (folders Mojulo/Markers, Mojulo/Seats), its record in its tags ('mojulo:{json}')
"""
import json
import math
import os
import struct
import sys
import traceback

import unreal


def _here():
    p = os.environ.get('MOJULO_HANDOFF')
    if p:
        return os.path.abspath(p)
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        raise SystemExit('import_handoff.py: cannot find mojulo/ - set MOJULO_HANDOFF=<the pack>/mojulo')


HERE = _here()


def rel(p):
    return os.path.join(HERE, p)


def log(*a):
    unreal.log('[mojulo-handoff] ' + ' '.join(str(x) for x in a))


def warn(*a):
    unreal.log_warning('[mojulo-handoff] ' + ' '.join(str(x) for x in a))


def fail(msg):
    # (the gate looks for this mark in the log)
    unreal.log_error('[mojulo-handoff] ERROR ' + str(msg))


with open(rel('handoff.json')) as _f:
    H = json.load(_f)
_P = H.get('paths') or {}
MAP = os.environ.get('MOJULO_UNREAL_MAP') or _P.get('map') or '/Game/Level'
ROOT = os.environ.get('MOJULO_UNREAL_ROOT') or _P.get('root') or '/Game/Mojulo'
SUB = ROOT + '/Level_Mojulo'
ASSETS = ROOT + '/Assets'
GLB_DIR = ASSETS + '/Glb'
MAT_DIR = ASSETS + '/Materials'
TEX_DIR = ASSETS + '/Textures'
TAG = 'mojulo'
CM = 100.0

EAL = unreal.EditorAssetLibrary
ML = unreal.MaterialEditingLibrary
TOOLS = unreal.AssetToolsHelpers.get_asset_tools()


def sub(cls):
    return unreal.get_editor_subsystem(cls)


def actors():
    return list(sub(unreal.EditorActorSubsystem).get_all_level_actors())


def world():
    return sub(unreal.UnrealEditorSubsystem).get_editor_world()


def clean(s):
    """Interchange's names: punctuation to '_' (an actor 'entity:hero' is 'entity_hero')."""
    return ''.join(c if c.isalnum() else '_' for c in str(s))


def ue(p):
    """mojulo's frame (z-up, right-handed, metres) as Unreal's (z-up, left-handed, cm): x, -y, z."""
    return unreal.Vector(float(p[0]) * CM, -float(p[1]) * CM, float(p[2]) * CM)


def ue_dir(d):
    return unreal.Vector(float(d[0]), -float(d[1]), float(d[2]))


def lin(c):
    return unreal.LinearColor(float(c[0]), float(c[1]), float(c[2]), 1.0)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = str(h).lstrip('#')
    return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]


def hex_linear(h):
    h = str(h).lstrip('#')
    return [srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)]


def tag(a, *more):
    tags = [str(t) for t in (a.get_editor_property('tags') or [])]
    for t in (TAG,) + more:
        if t not in tags:
            tags.append(t)
    a.set_editor_property('tags', tags)


def has_tag(a, t):
    return t in [str(x) for x in (a.get_editor_property('tags') or [])]


def spawn(cls, at, label, folder, rot=None):
    a = sub(unreal.EditorActorSubsystem).spawn_actor_from_class(cls, at if at is not None else unreal.Vector(0, 0, 0), rot or unreal.Rotator(0, 0, 0))
    a.set_actor_label(label)
    a.set_folder_path(folder)
    tag(a)
    return a


def glb_json(path):
    with open(path, 'rb') as f:
        head = f.read(20)
        n = struct.unpack('<I', head[12:16])[0]
        return json.loads(f.read(n).decode('utf8'))


# ---- the sublevel, emptied; the assets, deleted ----------------------------------------------------------------------

def open_sublevel():
    les = sub(unreal.LevelEditorSubsystem)
    if EAL.does_asset_exist(SUB):
        if not les.load_level(SUB):
            raise RuntimeError('cannot open ' + SUB)
        n = 0
        for a in actors():
            # (the sublevel is mojulo's whole: everything in it was built by a previous import, but the level's own
            # settings and default brush; a volume is a brush too, and mojulo's)
            if isinstance(a, unreal.WorldSettings) or a.get_class() == unreal.Brush.static_class():
                continue
            sub(unreal.EditorActorSubsystem).destroy_actor(a)
            n += 1
        log('emptied', SUB, '-', n, 'actors of a previous import')
    else:
        if not les.new_level(SUB, False):
            raise RuntimeError('cannot make ' + SUB)
        log('made', SUB)
    # (its assets hold no map: deleted whole, imported again; Interchange cannot reimport a LevelSequence)
    if EAL.does_directory_exist(ASSETS):
        EAL.delete_directory(ASSETS)
    EAL.make_directory(ASSETS)


# ---- the import ------------------------------------------------------------------------------------------------------

def import_glb():
    before = set(a.get_path_name() for a in actors())
    mgr = unreal.InterchangeManager.get_interchange_manager_scripted()
    src = unreal.InterchangeManager.create_source_data(rel('level.glb'))
    prm = unreal.ImportAssetParameters()
    prm.is_automated = True
    pipes = pipelines()
    if pipes:
        prm.set_editor_property('override_pipelines', pipes)
    mgr.import_scene(GLB_DIR, src, prm)
    new = [a for a in actors() if a.get_path_name() not in before]
    for a in new:
        tag(a, 'mojulo:glb')
        a.set_folder_path('Mojulo/Level')
    return new


def pipelines():
    """Interchange's glTF scene pipelines, copied into mojulo's assets and set as the handoff needs: the glTF's own normals
    (never recomputed), every triangle kept (the relief's cut leaves thin ones), no lightmap UVs generated (the level is
    lit by movable lights), no Nanite (every triangle drawn as written)."""
    out = []
    for src in ('/Interchange/Pipelines/DefaultGLTFSceneAssetsPipeline', '/Interchange/Pipelines/DefaultGLTFPipeline', '/Interchange/Pipelines/DefaultSceneLevelPipeline'):
        name = 'P_Mojulo' + src.rsplit('/', 1)[-1]
        dst = ASSETS + '/Pipelines/' + name
        try:
            # (by the object: an engine plugin's content is not in a commandlet's asset registry)
            p = TOOLS.duplicate_asset(name, ASSETS + '/Pipelines', unreal.load_asset(src + '.' + src.rsplit('/', 1)[-1]))
            if p is None:
                raise RuntimeError('could not copy ' + src)
            if isinstance(p, unreal.InterchangeGenericAssetsPipeline):
                cm = p.get_editor_property('common_meshes_properties')
                cm.set_editor_property('recompute_normals', False)
                cm.set_editor_property('remove_degenerates', False)
                mp = p.get_editor_property('mesh_pipeline')
                mp.set_editor_property('generate_lightmap_u_vs', False)
                # (no Nanite: where the renderer has none, a Nanite mesh draws its reduced fallback, measured in 5.8 on
                # an M1: the trail's relief-cut cliff at 4,926 of its 189,606 triangles, cracks between the land's
                # parts showing the sea through)
                mp.set_editor_property('build_nanite', False)
            EAL.save_loaded_asset(p)
            out.append(unreal.SoftObjectPath(dst + '.' + name))
        except Exception as e:  # noqa: BLE001 - Interchange's own defaults then
            warn('pipeline', src, e)
            return []
    return out


def import_texture(path, name, srgb=True, compression=None, nearest=False, clamp=False, mips=True):
    t = unreal.AssetImportTask()
    for k, v in (('filename', path), ('destination_path', TEX_DIR), ('destination_name', name), ('automated', True), ('replace_existing', True), ('save', False)):
        t.set_editor_property(k, v)
    TOOLS.import_asset_tasks([t])
    tx = EAL.load_asset(TEX_DIR + '/' + name)
    if tx is None:
        fail('texture ' + path + ' did not import')
        return None
    if isinstance(tx, unreal.Texture2D):
        tx.set_editor_property('srgb', bool(srgb))
        if compression is not None:
            tx.set_editor_property('compression_settings', compression)
        if nearest:
            tx.set_editor_property('filter', unreal.TextureFilter.TF_NEAREST)
        if clamp:
            tx.set_editor_property('address_x', unreal.TextureAddress.TA_CLAMP)
            tx.set_editor_property('address_y', unreal.TextureAddress.TA_CLAMP)
        if not mips:
            tx.set_editor_property('mip_gen_settings', unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
    return tx


# ---- the masters ------------------------------------------------------------------------------------------------------

def new_material(name):
    m = TOOLS.create_asset(name, MAT_DIR, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property('two_sided', True)
    return m


def expr(m, cls, x, y, **props):
    e = ML.create_material_expression(m, cls, x, y)
    for k, v in props.items():
        e.set_editor_property(k, v)
    return e


def tex_param(m, name, x, y, default, sampler=None):
    e = expr(m, unreal.MaterialExpressionTextureSampleParameter2D, x, y, parameter_name=name)
    if sampler is not None:
        e.set_editor_property('sampler_type', sampler)
    d = engine_texture(default)
    if d is not None:
        e.set_editor_property('texture', d)
    return e


def engine_texture(paths):
    """The first of an engine texture's names this Unreal has (they move between versions)."""
    for p in ([paths] if isinstance(paths, str) else paths):
        try:
            a = unreal.load_asset(p + '.' + p.rsplit('/', 1)[-1])
        except Exception:  # noqa: BLE001
            a = None
        if isinstance(a, unreal.Texture):
            return a
    fail('no engine texture at ' + str(paths))
    return None


def vec_param(m, name, x, y, v):
    return expr(m, unreal.MaterialExpressionVectorParameter, x, y, parameter_name=name, default_value=unreal.LinearColor(*v))


def scalar_param(m, name, x, y, v):
    return expr(m, unreal.MaterialExpressionScalarParameter, x, y, parameter_name=name, default_value=float(v))


WHITE = '/Engine/EngineResources/WhiteSquareTexture'
# (a see-through surface lit per pixel as an opaque one is: 'Surface ForwardShading' in the editor, named by version)
SURFACE_LIGHTING = next((getattr(unreal.TranslucencyLightingMode, n) for n in ('TLM_SURFACE_PER_PIXEL_LIGHTING', 'TLM_SURFACE_FORWARD_SHADING', 'TLM_SURFACE')
                         if hasattr(unreal.TranslucencyLightingMode, n)), None)
FLAT = ('/Engine/EngineMaterials/FlatNormal', '/Engine/EngineMaterials/DefaultNormal')


def lit_master(translucent):
    """glTF's metal-rough material on Unreal's default lit: base = texture x factor x vertex colour."""
    name = 'M_MojuloLitTranslucent' if translucent else 'M_MojuloLit'
    m = new_material(name)
    if translucent:
        m.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
        m.set_editor_property('translucency_lighting_mode', SURFACE_LIGHTING)
    # (the height, off: a bump offset at HeightRatio 0 over the samplers' UVs)
    ht = expr(m, unreal.MaterialExpressionTextureObjectParameter, -1700, 300, parameter_name='HeightTex')
    w = engine_texture(WHITE)
    if w is not None:
        ht.set_editor_property('texture', w)
    hr = scalar_param(m, 'HeightRatio', -1700, 450, 0.0)
    hs = expr(m, unreal.MaterialExpressionTextureSample, -1450, 300)
    ML.connect_material_expressions(ht, '', hs, 'Tex')
    bo = expr(m, unreal.MaterialExpressionBumpOffset, -1200, 300)
    ML.connect_material_expressions(hs, 'R', bo, 'Height')
    ML.connect_material_expressions(hr, '', bo, 'HeightRatioInput')
    base = tex_param(m, 'BaseTex', -900, -400, WHITE)
    nrm = tex_param(m, 'NormalTex', -900, 0, FLAT, unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    orm = tex_param(m, 'OrmTex', -900, 300, WHITE, unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    occ = tex_param(m, 'OcclusionTex', -900, 600, WHITE, unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    emi = tex_param(m, 'EmissiveTex', -900, 900, WHITE)
    for s in (base, nrm, orm, occ, emi):
        ML.connect_material_expressions(bo, '', s, 'UVs')
    bf = vec_param(m, 'BaseFactor', -900, -650, (1, 1, 1, 1))
    vc0 = expr(m, unreal.MaterialExpressionVertexColor, -1100, -800)
    # (a mesh with no COLOR_0 draws black through Unreal's VertexColor, seen in 5.8, even weighed out: the vertex colour
    # is switched in only where every primitive on the material carries one, a static switch)
    one = expr(m, unreal.MaterialExpressionConstant3Vector, -1100, -900, constant=unreal.LinearColor(1, 1, 1, 1))
    vc = expr(m, unreal.MaterialExpressionStaticSwitchParameter, -900, -800, parameter_name='UseVertexColour', default_value=True)
    ML.connect_material_expressions(vc0, '', vc, 'True')
    ML.connect_material_expressions(one, '', vc, 'False')
    m1 = expr(m, unreal.MaterialExpressionMultiply, -600, -500)
    ML.connect_material_expressions(base, 'RGB', m1, 'A')
    ML.connect_material_expressions(bf, '', m1, 'B')
    m2 = expr(m, unreal.MaterialExpressionMultiply, -400, -500)
    ML.connect_material_expressions(m1, '', m2, 'A')
    ML.connect_material_expressions(vc, '', m2, 'B')
    ML.connect_material_property(m2, '', unreal.MaterialProperty.MP_BASE_COLOR)
    ML.connect_material_property(nrm, 'RGB', unreal.MaterialProperty.MP_NORMAL)
    rf = scalar_param(m, 'RoughnessFactor', -600, 200, 1.0)
    mf = scalar_param(m, 'MetallicFactor', -600, 400, 0.0)
    r = expr(m, unreal.MaterialExpressionMultiply, -400, 200)
    ML.connect_material_expressions(orm, 'G', r, 'A')
    ML.connect_material_expressions(rf, '', r, 'B')
    ML.connect_material_property(r, '', unreal.MaterialProperty.MP_ROUGHNESS)
    mm = expr(m, unreal.MaterialExpressionMultiply, -400, 400)
    ML.connect_material_expressions(orm, 'B', mm, 'A')
    ML.connect_material_expressions(mf, '', mm, 'B')
    ML.connect_material_property(mm, '', unreal.MaterialProperty.MP_METALLIC)
    ML.connect_material_property(occ, 'R', unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
    ef = vec_param(m, 'EmissiveFactor', -600, 900, (0, 0, 0, 1))
    em = expr(m, unreal.MaterialExpressionMultiply, -400, 900)
    ML.connect_material_expressions(emi, 'RGB', em, 'A')
    ML.connect_material_expressions(ef, '', em, 'B')
    ML.connect_material_property(em, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    if translucent:
        a1 = expr(m, unreal.MaterialExpressionMultiply, -600, -200)
        ML.connect_material_expressions(base, 'A', a1, 'A')
        ML.connect_material_expressions(bf, 'A', a1, 'B')
        a2 = expr(m, unreal.MaterialExpressionMultiply, -400, -200)
        ML.connect_material_expressions(a1, '', a2, 'A')
        va = expr(m, unreal.MaterialExpressionStaticSwitchParameter, -700, -300, parameter_name='UseVertexColour', default_value=True)
        ML.connect_material_expressions(vc0, 'A', va, 'True')
        ML.connect_material_expressions(expr(m, unreal.MaterialExpressionConstant, -900, -300, r=1.0), '', va, 'False')
        ML.connect_material_expressions(va, '', a2, 'B')
        ML.connect_material_property(a2, '', unreal.MaterialProperty.MP_OPACITY)
    ML.recompile_material(m)
    return m


def custom(m, code, inputs, x, y, out_type=unreal.CustomMaterialOutputType.CMOT_FLOAT3, outputs=(), desc='mojulo'):
    """A Custom node over `code` (a file of the pack), its inputs [(name, expression, output)]: wired in order."""
    cu = expr(m, unreal.MaterialExpressionCustom, x, y)
    cu.set_editor_property('description', desc)
    cu.set_editor_property('output_type', out_type)
    with open(rel(code)) as f:
        cu.set_editor_property('code', f.read())
    ins = []
    for name, _, _ in inputs:
        ci = unreal.CustomInput()
        ci.set_editor_property('input_name', name)
        ins.append(ci)
    cu.set_editor_property('inputs', ins)
    if outputs:
        outs = []
        for name, t in outputs:
            co = unreal.CustomOutput()
            co.set_editor_property('output_name', name)
            co.set_editor_property('output_type', t)
            outs.append(co)
        cu.set_editor_property('additional_outputs', outs)
    for name, e, out in inputs:
        if not ML.connect_material_expressions(e, out, cu, name):
            fail('%s: could not wire %s (%s) into its Custom node' % (code, name, out or 'its output'))
    return cu


def tex_object(m, name, x, y, default=WHITE):
    e = expr(m, unreal.MaterialExpressionTextureObjectParameter, x, y, parameter_name=name)
    d = engine_texture(default)
    if d is not None:
        e.set_editor_property('texture', d)
    return e


def terrain_master(arrays):
    """The layered ground: the page's fragment (handoff_terrain.hlsl) in a Custom node; a world-space normal."""
    m = new_material('M_MojuloTerrain')
    m.set_editor_property('tangent_space_normal', False)
    wp = expr(m, unreal.MaterialExpressionWorldPosition, -1600, -600)
    nv = expr(m, unreal.MaterialExpressionVertexNormalWS, -1600, -500)
    cam = expr(m, unreal.MaterialExpressionCameraPositionWS, -1600, -400)
    s01 = expr(m, unreal.MaterialExpressionTextureCoordinate, -1600, -300, coordinate_index=2)
    s23 = expr(m, unreal.MaterialExpressionTextureCoordinate, -1600, -200, coordinate_index=3)
    col = expr(m, unreal.MaterialExpressionVertexColor, -1600, -100)
    face = expr(m, unreal.MaterialExpressionTwoSidedSign, -1600, -450)
    ins = [('P', wp, ''), ('N', nv, ''), ('Face', face, ''), ('Cam', cam, ''), ('S01', s01, ''), ('S23', s23, ''), ('Col', col, '')]
    y = 0
    for k, n in (('base', 'TBase'), ('normal', 'TNorm'), ('orm', 'TOrm')):
        e = expr(m, unreal.MaterialExpressionTextureObjectParameter, -1600, y, parameter_name=n)
        e.set_editor_property('texture', arrays[k])
        ins.append((n, e, ''))
        y += 100
    for n in ('TDice', 'TPath', 'TGrass'):
        ins.append((n, tex_object(m, n, -1600, y), ''))
        y += 100
    for n in ('TileA', 'TileB', 'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'PathOM', 'PathZ', 'Flags', 'GrassOM', 'Wet', 'Dress', 'Patch',
              'GpCell', 'GpDepth', 'Gp', 'PathBase', 'StoneBase', 'ClayBase', 'UnderBase'):
        ins.append((n, vec_param(m, n, -1600, y, (0, 0, 0, 0)), 'RGBA'))
        y += 100
    F1, F3 = unreal.CustomMaterialOutputType.CMOT_FLOAT1, unreal.CustomMaterialOutputType.CMOT_FLOAT3
    cu = custom(m, 'handoff_terrain.hlsl', ins, -900, 0, F3, (('Rough', F1), ('Nrm', F3)), 'the layered ground (handoff_terrain.hlsl)')
    ML.connect_material_property(cu, '', unreal.MaterialProperty.MP_BASE_COLOR)
    ML.connect_material_property(cu, 'Rough', unreal.MaterialProperty.MP_ROUGHNESS)
    ML.connect_material_property(cu, 'Nrm', unreal.MaterialProperty.MP_NORMAL)
    ML.recompile_material(m)
    return m


def sea_master():
    m = new_material('M_MojuloSea')
    m.set_editor_property('two_sided', False)
    for prop in ('allow_translucent_custom_depth_writes', 'allow_custom_depth_writes'):
        try:
            m.set_editor_property(prop, True)
            break
        except Exception:  # noqa: BLE001 - named by version
            continue
    m.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
    m.set_editor_property('translucency_lighting_mode', SURFACE_LIGHTING)
    ins = [('P', expr(m, unreal.MaterialExpressionWorldPosition, -1200, -300), ''), ('Cam', expr(m, unreal.MaterialExpressionCameraPositionWS, -1200, -200), ''),
           ('TDepth', tex_object(m, 'TDepth', -1200, -100), ''), ('DOM', vec_param(m, 'DOM', -1200, 0, (0, 0, 1, 1)), 'RGBA'),
           ('DMaxOp', vec_param(m, 'DMaxOp', -1200, 100, (1, 0.9, 0, 0)), 'RGBA'), ('Zen', vec_param(m, 'Zenith', -1200, 200, (0.4, 0.55, 0.8, 1)), 'RGBA'),
           ('Hor', vec_param(m, 'Horizon', -1200, 300, (0.7, 0.8, 0.9, 1)), 'RGBA')]
    cu = custom(m, 'handoff_sea.hlsl', ins, -700, 0, unreal.CustomMaterialOutputType.CMOT_FLOAT3, (('Alpha', unreal.CustomMaterialOutputType.CMOT_FLOAT1),), 'the sea (handoff_sea.hlsl)')
    ML.connect_material_property(vec_param(m, 'Base', -400, -300, (0, 0.29, 0.45, 1)), '', unreal.MaterialProperty.MP_BASE_COLOR)
    ML.connect_material_property(scalar_param(m, 'Roughness', -400, -200, 0.06), '', unreal.MaterialProperty.MP_ROUGHNESS)
    ML.connect_material_property(scalar_param(m, 'Specular', -400, -100, 0.0), '', unreal.MaterialProperty.MP_SPECULAR)
    ML.connect_material_property(cu, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    ML.connect_material_property(cu, 'Alpha', unreal.MaterialProperty.MP_OPACITY)
    ML.recompile_material(m)
    return m


def sky_master():
    m = new_material('M_MojuloSky')
    m.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    ins = [('P', expr(m, unreal.MaterialExpressionWorldPosition, -900, -200), ''), ('Cam', expr(m, unreal.MaterialExpressionCameraPositionWS, -900, -100), ''),
           ('Zen', vec_param(m, 'Zenith', -900, 0, (0.4, 0.55, 0.8, 1)), 'RGBA'), ('Hor', vec_param(m, 'Horizon', -900, 100, (0.7, 0.8, 0.9, 1)), 'RGBA')]
    cu = custom(m, 'handoff_sky.hlsl', ins, -500, 0, desc='the sky dome (handoff_sky.hlsl)')
    ML.connect_material_property(cu, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    ML.recompile_material(m)
    return m


def tone_master():
    m = TOOLS.create_asset('PP_MojuloTone', MAT_DIR, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property('material_domain', unreal.MaterialDomain.MD_POST_PROCESS)
    m.set_editor_property('blendable_location', unreal.BlendableLocation.BL_REPLACING_TONEMAPPER)
    c = expr(m, unreal.MaterialExpressionSceneTexture, -900, -200, scene_texture_id=unreal.SceneTextureId.PPI_POST_PROCESS_INPUT0)
    d = expr(m, unreal.MaterialExpressionSceneTexture, -900, -50, scene_texture_id=unreal.SceneTextureId.PPI_SCENE_DEPTH)
    cd = expr(m, unreal.MaterialExpressionSceneTexture, -900, 25, scene_texture_id=unreal.SceneTextureId.PPI_CUSTOM_DEPTH)
    ins = [('C', c, 'Color'), ('D', d, 'Color'), ('CD', cd, 'Color'), ('Haze', vec_param(m, 'Haze', -900, 100, (0.8, 0.85, 0.9, 1)), 'RGBA'), ('HazeK', vec_param(m, 'HazeK', -900, 200, (0, 1e6, 0, 0)), 'RGBA')]
    cu = custom(m, 'handoff_tone.hlsl', ins, -500, 0, desc='the page\'s tone and haze (handoff_tone.hlsl)')
    ML.connect_material_property(cu, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    ML.recompile_material(m)
    return m


def instance(parent, name):
    mi = TOOLS.create_asset(name, MAT_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    ML.set_material_instance_parent(mi, parent)
    return mi


def set_vec(mi, name, v):
    v = list(v) + [0.0] * (4 - len(v))
    ML.set_material_instance_vector_parameter_value(mi, name, unreal.LinearColor(float(v[0]), float(v[1]), float(v[2]), float(v[3])))


def set_scalar(mi, name, v):
    ML.set_material_instance_scalar_parameter_value(mi, name, float(v))


def set_tex(mi, name, t):
    if t is not None:
        ML.set_material_instance_texture_parameter_value(mi, name, t)


# ---- the materials -----------------------------------------------------------------------------------------------------

def textures_of(mat):
    """The textures Interchange put on its own material for a glTF material, by its parameters' names."""
    out = {}
    try:
        if isinstance(mat, unreal.MaterialInstance):
            for tpv in mat.get_editor_property('texture_parameter_values'):
                t = tpv.get_editor_property('parameter_value')
                if t is None:
                    continue
                n = str(tpv.get_editor_property('parameter_info').get_editor_property('name')).lower()
                k = 'normal' if 'normal' in n else 'occlusion' if 'occlusion' in n else 'orm' if ('rough' in n or 'metal' in n) else 'emissive' if 'emissive' in n else 'base' if ('base' in n or 'albedo' in n or 'diffuse' in n) else None
                if k and k not in out:
                    out[k] = t
    except Exception as e:  # noqa: BLE001 - a readout
        warn('textures of', mat.get_name(), e)
    return out


def as_normal_map(t):
    try:
        t.set_editor_property('srgb', False)
        t.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_NORMALMAP)
        t.set_editor_property('flip_green_channel', True)
    except Exception as e:  # noqa: BLE001
        warn('normal map settings', e)
    return t


def as_linear(t):
    try:
        t.set_editor_property('srgb', False)
        t.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_MASKS)
    except Exception as e:  # noqa: BLE001
        warn('linear map settings', e)
    return t


class Mats:
    def __init__(self, glb):
        self.glb = glb
        self.by_clean = {}
        for m in glb.get('materials', []):
            self.by_clean.setdefault(clean(m.get('name', '')), m)
        # (a material takes the vertex colour where every primitive drawn with it carries COLOR_0)
        self.coloured = {}
        mats = glb.get('materials', [])
        for mesh in glb.get('meshes', []):
            for p in mesh.get('primitives', []):
                k = p.get('material')
                if isinstance(k, int) and k < len(mats):
                    key = clean(mats[k].get('name', ''))
                    self.coloured[key] = self.coloured.get(key, True) and 'COLOR_0' in p.get('attributes', {})
        self.lit = lit_master(False)
        self.translucent = None
        self.cache = {}
        self.terrain = None
        self.sea = None
        self.heights = {}
        self.stats = {'slots': 0, 'lit': 0, 'translucent': 0, 'normal': 0, 'orm': 0, 'height': 0, 'terrain': 0, 'sea': 0, 'unmatched': 0}
        self.see_through = set()
        self.terrain_names = set(clean(n) for n in (H.get('terrain') or {}).get('parts', []))
        self.sea_name = clean((H.get('sea') or {}).get('part', '')) if H.get('sea') else None
        self.height_specs = {clean(k): v for k, v in (H.get('materials') or {}).items()}

    def height_tex(self, spec):
        f = spec.get('height')
        if f in self.heights:
            return self.heights[f]
        t = import_texture(rel(f), 'TH_' + clean(os.path.splitext(os.path.basename(f))[0]), srgb=False, compression=unreal.TextureCompressionSettings.TC_GRAYSCALE)
        self.heights[f] = t
        return t

    def for_slot(self, cur):
        """The instance a slot takes for the material Interchange gave it (by the glTF material's name)."""
        key = clean(cur.get_name()) if cur is not None else ''
        if key in self.cache:
            return self.cache[key]
        self.stats['slots'] += 0
        if self.terrain is not None and key in self.terrain_names:
            self.cache[key] = self.terrain
            return self.terrain
        if self.sea is not None and key == self.sea_name:
            self.cache[key] = self.sea
            return self.sea
        g = self.by_clean.get(key)
        if g is None:
            self.stats['unmatched'] += 1
            g = {}
        pbr = g.get('pbrMetallicRoughness', {})
        blend = g.get('alphaMode') == 'BLEND'
        if blend and self.translucent is None:
            self.translucent = lit_master(True)
        mi = instance(self.translucent if blend else self.lit, 'MI_' + (key or 'Default'))
        tex = textures_of(cur)
        set_vec(mi, 'BaseFactor', pbr.get('baseColorFactor', [1, 1, 1, 1]))
        ML.set_material_instance_static_switch_parameter_value(mi, 'UseVertexColour', bool(self.coloured.get(key, False)))
        if self.coloured.get(key, False):
            self.stats['vertex_colour'] = self.stats.get('vertex_colour', 0) + 1
        set_scalar(mi, 'RoughnessFactor', pbr.get('roughnessFactor', 1.0))
        set_scalar(mi, 'MetallicFactor', pbr.get('metallicFactor', 1.0))
        set_vec(mi, 'EmissiveFactor', list(g.get('emissiveFactor', [0, 0, 0])) + [1])
        if 'base' in tex:
            set_tex(mi, 'BaseTex', tex['base'])
        if 'normal' in tex and g.get('normalTexture'):
            set_tex(mi, 'NormalTex', as_normal_map(tex['normal']))
            self.stats['normal'] += 1
        if 'orm' in tex and pbr.get('metallicRoughnessTexture'):
            set_tex(mi, 'OrmTex', as_linear(tex['orm']))
            self.stats['orm'] += 1
        if g.get('occlusionTexture'):
            occ = tex.get('occlusion') or tex.get('orm')
            if occ is not None:
                set_tex(mi, 'OcclusionTex', as_linear(occ))
        if 'emissive' in tex and g.get('emissiveTexture'):
            set_tex(mi, 'EmissiveTex', tex['emissive'])
        spec = self.height_specs.get(key)
        if isinstance(spec, dict) and spec.get('height'):
            t = self.height_tex(spec)
            if t is not None:
                set_tex(mi, 'HeightTex', t)
                set_scalar(mi, 'HeightRatio', 0.0)
                self.stats['height'] += 1
        if blend:
            self.see_through.add(mi.get_name())
            self.stats['translucent'] += 1
        else:
            self.stats['lit'] += 1
        EAL.save_loaded_asset(mi)
        self.cache[key] = mi
        return mi


def no_nanite():
    """Every imported static mesh drawn as written: a mesh Interchange built with Nanite is built again without it."""
    n = 0
    for p in EAL.list_assets(GLB_DIR, recursive=True, include_folder=False):
        a = EAL.load_asset(p)
        if not isinstance(a, unreal.StaticMesh):
            continue
        try:
            ns = a.get_editor_property('nanite_settings')
            if ns.get_editor_property('enabled'):
                ns.set_editor_property('enabled', False)
                a.set_editor_property('nanite_settings', ns)
                n += 1
        except Exception as e:  # noqa: BLE001 - a property this Unreal names otherwise
            warn('nanite', a.get_name(), e)
    return n


def apply_materials(M):
    n = 0
    for p in EAL.list_assets(GLB_DIR, recursive=True, include_folder=False):
        a = EAL.load_asset(p)
        if isinstance(a, unreal.StaticMesh):
            for i, slot in enumerate(a.get_editor_property('static_materials')):
                a.set_material(i, M.for_slot(slot.get_editor_property('material_interface')))
                n += 1
        elif isinstance(a, unreal.SkeletalMesh):
            slots = list(a.get_editor_property('materials'))
            for i, slot in enumerate(slots):
                slot.set_editor_property('material_interface', M.for_slot(slot.get_editor_property('material_interface')))
                slots[i] = slot
                n += 1
            a.set_editor_property('materials', slots)
    M.stats['slots'] = n
    return n


# ---- the layered ground and the sea ------------------------------------------------------------------------------------

def texture_array(name, files, srgb, compression):
    texs = []
    for i, f in enumerate(files):
        t = import_texture(rel(f), '%s_%d' % (name, i), srgb=srgb, compression=compression)
        texs.append(t)
    a = TOOLS.create_asset(name, TEX_DIR, unreal.Texture2DArray, unreal.Texture2DArrayFactory())
    a.set_editor_property('srgb', bool(srgb))
    a.set_editor_property('compression_settings', compression)
    a.set_editor_property('source_textures', texs)
    EAL.save_loaded_asset(a)
    return a


def v4(a, d=(0.0, 0.0, 0.0, 0.0)):
    if not isinstance(a, (list, tuple)):
        return list(d)
    a = [float(x) for x in a] + list(d)[len(a):]
    return a[:4]


def terrain(T):
    L = T.get('layers', {})
    if not all(k in L for k in ('base', 'normal', 'orm')):
        fail('the terrain\'s layers are missing')
        return None
    raw = unreal.TextureCompressionSettings.TC_VECTOR_DISPLACEMENTMAP
    arrays = {'base': texture_array('TA_MojuloTerrainBase', L['base'], True, unreal.TextureCompressionSettings.TC_DEFAULT),
              'normal': texture_array('TA_MojuloTerrainNormal', L['normal'], False, raw),
              'orm': texture_array('TA_MojuloTerrainOrm', L['orm'], False, raw)}
    m = terrain_master(arrays)
    mi = instance(m, 'MI_MojuloTerrain')
    R, I = T.get('read', {}), T.get('images', {})
    tile = [float(t) for t in R.get('tile', [])] + [1.0] * 7
    set_vec(mi, 'TileA', tile[0:4])
    set_vec(mi, 'TileB', tile[4:7] + [1.0])
    for i, mean in enumerate((R.get('mean') or [])[:7]):
        set_vec(mi, 'M%d' % i, v4(mean, (1, 1, 1, 0)))
    for i in range(len(R.get('mean') or []), 7):
        set_vec(mi, 'M%d' % i, (1, 1, 1, 0))
    B = R.get('bases') or {}
    for k, n in (('path', 'PathBase'), ('clay', 'ClayBase'), ('stone', 'StoneBase'), ('under', 'UnderBase')):
        if B.get(k) is not None:
            set_vec(mi, n, v4(B[k]))
    D = R.get('dress') if isinstance(R.get('dress'), dict) else {}
    flags = [float(D.get('clay', 0.0) or 0.0), 1.0 if R.get('green') else 0.0, 0.0, float(R.get('moss', 0.0) or 0.0)]
    set_vec(mi, 'Dress', [float(D.get('rubble', 0.0) or 0.0), float(D.get('dust', 0.0) or 0.0), float(D.get('reach', 0.0) or 0.0), 0.0])
    set_vec(mi, 'Patch', v4(D.get('patches', [0, 0, 0])))
    W = R.get('wet') if isinstance(R.get('wet'), dict) else None
    set_vec(mi, 'Wet', [-1e9 if not W or W.get('z') is None else float(W['z']), float((W or {}).get('band', 1.0)), float((W or {}).get('tone', 1.0)), float((W or {}).get('rough', 1.0))])
    if I.get('dice'):
        set_tex(mi, 'TDice', import_texture(rel(I['dice']), 'T_MojuloDice', srgb=False, compression=raw, nearest=True))
    P = R.get('path') if isinstance(R.get('path'), dict) else None
    path_on = 0.0
    if P and I.get('path'):
        set_tex(mi, 'TPath', import_texture(rel(I['path']), 'T_MojuloPath', srgb=False, compression=raw, clamp=True, mips=False))
        set_vec(mi, 'PathOM', v4(P['origin'][:2] + P['metres'][:2]))
        path_on = 1.0
    set_vec(mi, 'PathZ', [float((P or {}).get('z', [0, 1])[0]), float((P or {}).get('z', [0, 1])[1]), path_on, float(D.get('sdIn', 1.5) or 1.5)])
    G = R.get('grass') if isinstance(R.get('grass'), dict) else None
    if G and I.get('grass'):
        set_tex(mi, 'TGrass', import_texture(rel(I['grass']), 'T_MojuloGrass', srgb=False, compression=raw, clamp=True, mips=False))
        set_vec(mi, 'GrassOM', v4(G['origin'][:2] + G['metres'][:2]))
        flags[2] = 1.0
    else:
        set_vec(mi, 'GrassOM', (0, 0, 1, 1))
    set_vec(mi, 'Flags', flags)
    X = R.get('parallax') if isinstance(R.get('parallax'), dict) else None
    if X:
        set_vec(mi, 'GpCell', [float(X['pebbles']['cell']), float(X['cracks']['cell']), float(X['plates']['cell']), 0.0])
        set_vec(mi, 'GpDepth', [float(X['pebbles']['depth']), float(X['cracks']['depth']), float(X['plates']['depth']), 0.0])
        set_vec(mi, 'Gp', [float(X['dry']), float(X['stretch']), float(X['near']), 0.0])
    else:
        set_vec(mi, 'GpCell', (0.09, 0.34, 0.75, 0))
        set_vec(mi, 'GpDepth', (0.03, 0.035, 0.06, 0))
        set_vec(mi, 'Gp', (9.0, 7.0, 30.0, 0))
    EAL.save_loaded_asset(mi)
    return mi


def sea(S, env, glb):
    m = sea_master()
    mi = instance(m, 'MI_MojuloSea')
    R = S.get('read', {})
    if S.get('image'):
        set_tex(mi, 'TDepth', import_texture(rel(S['image']), 'T_MojuloSeaDepth', srgb=False, compression=unreal.TextureCompressionSettings.TC_VECTOR_DISPLACEMENTMAP, clamp=True, mips=False))
    set_vec(mi, 'DOM', v4(list(R.get('origin', [0, 0]))[:2] + list(R.get('metres', [1, 1]))[:2]))
    set_vec(mi, 'DMaxOp', [float(R.get('max', 1.0) or 1.0), float(R.get('opacity', 0.9) or 0.9), 0.0, 0.0])
    zen, hor = sky_colours(env)
    set_vec(mi, 'Zenith', zen + [1.0])
    set_vec(mi, 'Horizon', hor + [1.0])
    g = next((x for x in glb.get('materials', []) if clean(x.get('name', '')) == clean(S.get('part', 'form:sea'))), {})
    pbr = g.get('pbrMetallicRoughness', {})
    set_vec(mi, 'Base', list(pbr.get('baseColorFactor', [0.0, 0.29, 0.45, 1]))[:3] + [1.0])
    set_scalar(mi, 'Roughness', pbr.get('roughnessFactor', 0.06))
    EAL.save_loaded_asset(mi)
    return mi


def sky_colours(env):
    sky = env.get('sky') if isinstance(env.get('sky'), dict) else {}
    bg = env.get('background') or '#c8d4e0'
    return hex_linear(sky.get('zenith', bg)), hex_linear(sky.get('horizon', bg))


# ---- collision ------------------------------------------------------------------------------------------------------

def collision(new, M):
    instanced = tuple(clean(p) for p in H.get('instanced', []))
    blocks = still = 0
    done = set()
    for a in new:
        for c in a.get_components_by_class(unreal.StaticMeshComponent):
            mesh = c.get_editor_property('static_mesh')
            if mesh is None:
                continue
            label = a.get_actor_label()
            see = any((c.get_material(i) is not None and (c.get_material(i).get_name() in M.see_through or c.get_material(i) == M.sea)) for i in range(c.get_num_materials()))
            if label.startswith(instanced) or see:
                c.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
                c.set_collision_profile_name('NoCollision')
                still += 1
                continue
            if mesh.get_path_name() not in done:
                bs = mesh.get_editor_property('body_setup')
                if bs is not None:
                    bs.set_editor_property('collision_trace_flag', unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
                done.add(mesh.get_path_name())
            c.set_collision_profile_name('BlockAll')
            c.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
            blocks += 1
    return blocks, still


# ---- the lights --------------------------------------------------------------------------------------------------

def lamps(new, glb):
    """The GLB's point lights (KHR_lights_punctual) at the page's strength: Unreal's candela is the glTF intensity
    (measured: 10 cd two metres over a white Lambert plane lights it 0.795 = 10 / (pi 4), as three's lamp does), its
    reach the light's range under Unreal's inverse-squared window (three's own), no shadow (a lamp stands inside its
    fitting)."""
    nodes = {clean(n.get('name', '')): n for n in glb.get('nodes', [])}
    lights = glb.get('extensions', {}).get('KHR_lights_punctual', {}).get('lights', [])
    n, total = 0, 0.0
    for a in new:
        for c in a.get_components_by_class(unreal.PointLightComponent):
            nd = nodes.get(a.get_actor_label()) or nodes.get(clean(a.get_actor_label()))
            k = (nd or {}).get('extensions', {}).get('KHR_lights_punctual', {}).get('light')
            li = lights[k] if isinstance(k, int) and k < len(lights) else None
            c.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
            if li is None:
                continue
            c.set_editor_property('intensity_units', unreal.LightUnits.CANDELAS)
            c.set_editor_property('intensity', float(li.get('intensity', 1.0)))
            c.set_editor_property('use_inverse_squared_falloff', True)
            if li.get('range'):
                c.set_editor_property('attenuation_radius', float(li['range']) * CM)
            if li.get('color'):
                c.set_light_color(lin(li['color']))
            if str((nd or {}).get('name', '')).startswith('light:form:lamp:'):
                c.set_editor_property('cast_shadows', False)
            tag(a, 'mojulo:lamp')
            n += 1
            total += float(li.get('intensity', 1.0))
    return n, total


def environment(env):
    out = {}
    folder = 'Mojulo/Environment'
    s = env.get('sun')
    if isinstance(s, dict):
        d = ue_dir(s['direction'])
        rot = unreal.MathLibrary.make_rot_from_x(unreal.Vector(-d.x, -d.y, -d.z))
        sun = spawn(unreal.DirectionalLight, unreal.Vector(0, 0, 1000), 'MojuloSun', folder, rot)
        lc = sun.light_component
        lc.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
        # (lux: pi x the solve's level lights a white Lambert surface to the level, measured in 5.8)
        lc.set_editor_property('intensity', float(s.get('intensity', math.pi)))
        lc.set_light_color(lin(s.get('color', [1, 1, 1])))
        lc.set_editor_property('cast_shadows', True)
        try:
            lc.set_editor_property('atmosphere_sun_light', False)
        except Exception:  # noqa: BLE001
            pass
        tag(sun, 'mojulo:sun', *(['mojulo:default'] if s.get('default') else []))
        out['sun'] = sun
    # (the ambient: the solve's, else the background the level shows, as Blender's World lights with it)
    amb = env.get('ambient')
    if not (isinstance(amb, list) and len(amb) >= 3):
        zen, hor = sky_colours(env)
        amb = hor if env.get('sky') else hex_linear(env.get('background') or '#c8d4e0')
        out['ambient_from'] = 'sky' if env.get('sky') else 'background'
    else:
        out['ambient_from'] = 'solve'
    t = unreal.AssetImportTask()
    for k, v in (('filename', rel('white.hdr')), ('destination_path', TEX_DIR), ('destination_name', 'T_MojuloWhiteSky'), ('automated', True), ('replace_existing', True), ('save', False)):
        t.set_editor_property(k, v)
    TOOLS.import_asset_tasks([t])
    cube = EAL.load_asset(TEX_DIR + '/T_MojuloWhiteSky')
    sl = spawn(unreal.SkyLight, unreal.Vector(0, 0, 500), 'MojuloAmbient', folder)
    slc = sl.light_component
    slc.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
    slc.set_editor_property('source_type', unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    slc.set_editor_property('cubemap', cube)
    slc.set_editor_property('lower_hemisphere_is_black', False)
    slc.set_editor_property('real_time_capture', False)
    m = max(float(amb[0]), float(amb[1]), float(amb[2]), 1e-6)
    # (a white sky at intensity k lights a white Lambert surface to k, measured in 5.8)
    slc.set_editor_property('intensity', m)
    slc.set_light_color(lin([float(amb[0]) / m, float(amb[1]) / m, float(amb[2]) / m]))
    tag(sl, 'mojulo:ambient')
    out['ambient'] = [float(a) for a in amb[:3]]
    # (the dome: the page's sky, or its background, around everything)
    zen, hor = sky_colours(env)
    sky = spawn(unreal.StaticMeshActor, unreal.Vector(0, 0, 0), 'MojuloSky', folder)
    smc = sky.static_mesh_component
    smc.set_static_mesh(EAL.load_asset('/Engine/BasicShapes/Sphere.Sphere'))
    sky.set_actor_scale3d(unreal.Vector(SKY_R / 50.0, SKY_R / 50.0, SKY_R / 50.0))
    smi = instance(sky_master(), 'MI_MojuloSky')
    set_vec(smi, 'Zenith', zen + [1.0])
    set_vec(smi, 'Horizon', hor + [1.0])
    EAL.save_loaded_asset(smi)
    smc.set_material(0, smi)
    smc.set_editor_property('cast_shadow', False)
    smc.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    smc.set_collision_profile_name('NoCollision')
    tag(sky, 'mojulo:sky')
    # (the page's tone and haze: one post-process material in place of the tonemapper, exposure fixed at 1)
    pv = spawn(unreal.PostProcessVolume, unreal.Vector(0, 0, 0), 'MojuloTone', folder)
    pv.set_editor_property('unbound', True)
    tmi = instance(tone_master(), 'MI_MojuloTone')
    hz = env.get('haze') if isinstance(env.get('haze'), dict) else None
    # (the haze lands as its own colour over the encoded picture: measured against the page, its far sea is the hex itself)
    set_vec(tmi, 'Haze', list(hex_rgb(hz.get('color', '#c8d4e0'))) + [1.0] if hz else [0.8, 0.85, 0.9, 1.0])
    set_vec(tmi, 'HazeK', [float(hz.get('density', 0.0) or 0.0) if hz else 0.0, SKY_R * 0.5, 0.0, 0.0])
    EAL.save_loaded_asset(tmi)
    st = pv.get_editor_property('settings')
    st.set_editor_property('weighted_blendables', unreal.WeightedBlendables([unreal.WeightedBlendable(1.0, tmi)]))
    for k, v in (('auto_exposure_method', unreal.AutoExposureMethod.AEM_MANUAL), ('auto_exposure_bias', 0.0), ('auto_exposure_apply_physical_camera_exposure', False),
                 ('bloom_intensity', 0.0), ('vignette_intensity', 0.0), ('ambient_occlusion_intensity', 0.0), ('motion_blur_amount', 0.0),
                 ('lens_flare_intensity', 0.0), ('film_grain_intensity', 0.0), ('scene_fringe_intensity', 0.0)):
        try:
            st.set_editor_property('override_' + k, True)
            st.set_editor_property(k, v)
        except Exception as e:  # noqa: BLE001 - a property this Unreal names otherwise
            warn('post-process', k, e)
    pv.set_editor_property('settings', st)
    tag(pv, 'mojulo:tone')
    out['haze'] = hz
    return out


SKY_R = 2.0e6   # cm: the dome's radius (20 km); the haze leaves anything past half of it clear


# ---- the cameras, markers and seats -----------------------------------------------------------------------------------

def stand_camera(name, at, look, yfov, aspect=16.0 / 9.0):
    p, q = ue(at), ue(look)
    rot = unreal.MathLibrary.find_look_at_rotation(p, q)
    c = spawn(unreal.CameraActor, p, name, 'Mojulo/Cameras', rot)
    cc = c.camera_component
    v = float(yfov) if yfov else math.radians(50.0)
    cc.set_editor_property('field_of_view', math.degrees(2.0 * math.atan(math.tan(v / 2.0) * aspect)))
    cc.set_editor_property('aspect_ratio', aspect)
    cc.set_editor_property('constrain_aspect_ratio', False)
    tag(c, 'mojulo:camera')
    return c


def cameras(level):
    out = []
    for m in level.get('markers', []):
        if m.get('kind') == 'camera' and m.get('at') is not None:
            nm = str(m.get('name', 'camera'))[len('camera:'):] if str(m.get('name', '')).startswith('camera:') else str(m.get('name'))
            out.append(stand_camera('MojuloCamera_' + clean(nm), m['at'], m.get('look') or [0, 0, 0], m.get('yfov')))
    if not out:
        spawn_m = next((m for m in level.get('markers', []) if m.get('kind') == 'spawn' and m.get('at') is not None), None)
        look = spawn_m['at'] if spawn_m else [0, 0, 0]
        out.append(stand_camera('MojuloCamera', [look[0], look[1] - 8, look[2] + 5], look, None))
    return out


def record_tag(r):
    return 'mojulo:' + json.dumps(r, sort_keys=True, separators=(',', ':'))


def markers(level):
    n = 0
    for m in level.get('markers', []):
        a = spawn(unreal.TargetPoint, ue(m['at']) if m.get('at') is not None else None, str(m.get('name', 'marker')), 'Mojulo/Markers')
        tag(a, 'mojulo:marker', 'kind:' + str(m.get('kind', 'marker')), record_tag(m))
        n += 1
    seats = level.get('seats')
    s = 0
    if isinstance(seats, dict):
        root = spawn(unreal.TargetPoint, None, 'MojuloSeats', 'Mojulo/Seats')
        tag(root, 'mojulo:seats', record_tag({k: seats.get(k) for k in ('screen', 'lives', 'pool', 'join', 'drop')}))
        for r in seats.get('rows', []):
            a = spawn(unreal.TargetPoint, ue(r['spawn']) if r.get('spawn') is not None else None, 'Seat_' + str(r.get('label', r.get('n'))), 'Mojulo/Seats')
            tag(a, 'mojulo:seat', record_tag(r))
            s += 1
    return n, s


# ---- the developer's level ------------------------------------------------------------------------------------------

def streamed(w):
    for lv in unreal.EditorLevelUtils.get_levels(w):
        if lv.get_outermost().get_name() == SUB:
            return True
    return False


def persistent():
    les = sub(unreal.LevelEditorSubsystem)
    made = False
    if EAL.does_asset_exist(MAP):
        if not les.load_level(MAP):
            raise RuntimeError('cannot open ' + MAP)
    else:
        if not les.new_level(MAP, False):
            raise RuntimeError('cannot make ' + MAP)
        made = True
    w = world()
    added = False
    if not streamed(w):
        unreal.EditorLevelUtils.add_level_to_world(w, SUB, unreal.LevelStreamingAlwaysLoaded)
        added = True
    if made or added:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log('the developer\'s level', MAP, '- made' if made else '- kept', '; mojulo\'s sublevel streamed in' if added else '')
    return made, added


# ---- the build ---------------------------------------------------------------------------------------------------------

def build():
    glb = glb_json(rel('level.glb'))
    level = H.get('level') if isinstance(H.get('level'), dict) else None
    env = (level or {}).get('environment', {}) if level else {}
    open_sublevel()
    new = import_glb()
    M = Mats(glb)
    if isinstance(H.get('terrain'), dict):
        M.terrain = terrain(H['terrain'])
    if isinstance(H.get('sea'), dict):
        M.sea = sea(H['sea'], env, glb)
    nanite = no_nanite()
    slots = apply_materials(M)
    blocks, still = collision(new, M)
    for a in new:
        for c in a.get_components_by_class(unreal.StaticMeshComponent):
            if M.sea is not None and any(c.get_material(i) == M.sea for i in range(c.get_num_materials())):
                c.set_editor_property('cast_shadow', False)
                # (the sea is see-through and writes no depth: its depth goes to the custom depth, which the tone's
                # haze reads, so the sea is hazed by its own distance as the page's is)
                c.set_editor_property('render_custom_depth', True)
    nl, li = lamps(new, glb)
    E = environment(env) if level else {}
    nm = ns = 0
    if level:
        cameras(level)
        nm, ns = markers(level)
    info = spawn(unreal.TargetPoint, None, 'MojuloLevel', 'Mojulo', None)
    tag(info, 'mojulo:level', 'handoff:' + str(H.get('version', '')), 'ref:' + str((level or {}).get('ref')))
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    EAL.save_directory(ROOT, only_if_is_dirty=False, recursive=True)
    log('built', H.get('version'), 'in', SUB, '-', len(new), 'imported actors,', nanite, 'meshes built without Nanite,', slots, 'slots', json.dumps(M.stats, sort_keys=True), ';',
        blocks, 'blocking,', still, 'without collision;', nl, 'lamps;', nm, 'markers,', ns, 'seats; ambient from', E.get('ambient_from'))
    if level:
        persistent()


def main():
    try:
        build()
    except Exception as e:  # noqa: BLE001 - the gate reads the mark
        traceback.print_exc()
        fail('the build stopped: %s' % e)
        raise


main()
