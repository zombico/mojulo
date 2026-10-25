/**
 * unreal-project.js — the Unreal Engine pack emitter (export-unreal.plan.md
 * rev 2, U0 + U1).
 *
 * Fourth engine leg beside godot-project.js and unity-project.js (both
 * built). The pack is DATA (model.glb + score.json + audio + recipe) plus the
 * import half of the instrument: import_mojulo.py, a dependency-free UE
 * Python editor script (modes: run / verify — verify writes mojulo-gate.json,
 * the gate-file pattern from Unity's Mojulo.Import.Verify), plus the
 * T-numbered operator guide (the protocol proven on the Unity leg: one step
 * per line, exact UI paths, verify-before-instruct). The runtime half — the
 * mojulo-unreal KERNEL performing the mechanics vocabulary — is the U1
 * pack-carried C++ plugin (unreal-kernel.js); game packs ship it, world
 * packs stay kernel-less (stock Third Person is the walker).
 *
 * Everything emitted is deterministic text: no dice, no timestamps, stable
 * ordering. No .meta sidecars — that is a Unity-ism; UE idempotency rides
 * deterministic asset paths + the import script rebuilding in place.
 *
 * Frame: mojulo is z-up right-handed in meters; UE is z-up LEFT-handed in
 * centimeters. The mapping P(v) = (x·100, −y·100, z·100) is PINNED (first
 * machine gate, 2026-09-03) and implemented twice on this leg — python
 * (import-time actors) and C++ (runtime mechanics, MojuloScore.cpp). The
 * two MUST stay identical.
 */
// Guide helpers are shared with the Unity + Blender legs (operator-guide.js, the D10 lift).
import { fmt, ledgerLines, greyboxSection, guideLedger, guidePreamble, screenSection } from './operator-guide.js';
import { emitUnrealKernel } from './unreal-kernel.js';

export const UNREAL_LEG_VERSION = '0.5.0';
export const UNREAL_EDITOR_TARGET = 'Unreal Engine 5 (5.4+; proven against UE 5.8.0)';

const COMPLETION_KINDS = ['reach-exit', 'survive'];

/** The honest-loss ledger for one level. World packs ship no kernel, so all
 * mechanics are a data-only row; game packs ship the C++ kernel, which
 * performs the closed vocabulary — the split mirrors Unity's
 * interpreted/unknown pair. */
export function unrealLevelLedger(score, { gameMode = false } = {}) {
  const ledger = { ...score.ledger };
  if (score.posture === 'greybox') {
    ledger.greybox_declared = ledger.greybox_declared
      ?? { note: 'operator-declared greybox handoff — surfacing losses are deferred, not defects' };
  }
  if (Array.isArray(score.textures) && score.textures.length) {
    ledger.textures_carried = {
      count: score.textures.length,
      kinds: score.textures,
      note: 'surface/atlas textures travel inside the GLB (Interchange imports them as base-colour maps — pinned at the first machine gate); the web build is the reference look',
    };
  }
  if (score.ground != null) {
    ledger.promoted_ground = { note: 'implicit runtime ground plane promoted by the importer — the collider AABBs are obstacle hulls only, never the floor' };
  }
  ledger.entity_markers = {
    note: 'entities that baked no mesh (glyph/primitive bodies — export-side gap) get placeholder markers; the web build is the reference look',
  };
  const kinds = (score.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
  if (kinds.length) {
    if (gameMode) {
      const KNOWN = ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive'];
      const known = kinds.filter((k) => KNOWN.includes(k));
      const unknown = kinds.filter((k) => !KNOWN.includes(k));
      if (known.length) {
        ledger.interpreted_mechanics = {
          count: known.length,
          kinds: [...new Set(known)],
          note: 'performed live by the MojuloKernel plugin (reach-exit / collect / hazard-damage / fail-on-death / survive)',
        };
      }
      if (unknown.length) {
        ledger.unknown_mechanics = {
          count: unknown.length,
          kinds: [...new Set(unknown)],
          note: 'outside the kernel vocabulary — ride score.json as data; re-orchestrate in-engine',
        };
      }
    } else {
      ledger.mechanics_data_only = {
        count: kinds.length,
        kinds: [...new Set(kinds)],
        note: 'declarative mechanics ride score.json as data — the game-scope MojuloKernel performs them; a world pack is an explorable arena',
      };
    }
  }
  if (gameMode && !kinds.some((k) => COMPLETION_KINDS.includes(k))) {
    ledger.no_completion_path = {
      note: 'no completion mechanic — the authored win condition lives in the runtime, which does not travel; the level is an explorable arena',
    };
  }
  if (score.cameras?.length) {
    ledger.cameras_data_only = { count: score.cameras.length, note: 'authored camera framings ride score.json as data; the walker camera is the play view' };
  }
  ledger.skipped_runtime = ledger.skipped_runtime
    ?? { note: 'game shell, AI, combat feel — re-orchestrate in-engine; reference performance is the web build' };
  return ledger;
}

/* ------------------------------------------------------------- python --- */
/* import_mojulo.py — the import half of the instrument, in UE's editor
 * scripting language. One file, stdlib + the `unreal` module only. Two modes
 * (env MOJULO_MODE): 'run' imports and builds/saves the level(s); 'verify'
 * re-opens them and writes mojulo-gate.json. Scope is detected from the pack
 * itself: a game.json beside this script = game scope (per-level maps + a
 * menu map, kernel game modes wired); no game.json = world scope (one map,
 * kernel-less — the stock Third Person character is the walker). */

function importerPy({ lit = false, figureClips = {} } = {}) {
  return `# generated by mojulo export-unreal — do not hand-edit; re-mint from recipe/
"""Mojulo pack importer (Unreal editor Python — world + game scope).

World scope (no game.json): builds one level from score.json + model.glb —
imports the GLB via Interchange, swaps every mesh onto the unlit
vertex-colour material, promotes the implicit ground plane, spawns blocking
colliders, a PlayerStart, a light rig and the soundtrack bed, then saves
Maps/mojulo-level.

Game scope (game.json present): one map per level under Maps/<ref> plus a
Maps/mojulo-menu map, every audio bed imported, and each map's GameMode
override pointed at the MojuloKernel plugin classes (AMojuloGameMode /
AMojuloMenuGameMode) — the plugin must be compiled first (guide chunk ③).

Run from the editor Output Log (Python mode):  py MojuloPack/import_mojulo.py
Headless (the machine gate):  MOJULO_MODE=run|verify with -run=pythonscript.
'verify' writes mojulo-gate.json at the project root.
"""
import json
import math
import os
import re
import struct

import unreal

PACK = os.path.dirname(os.path.abspath(__file__))
CONTENT_ROOT = '/Game/MojuloPack'
MAP_PATH = CONTENT_ROOT + '/Maps/mojulo-level'
MENU_MAP = CONTENT_ROOT + '/Maps/mojulo-menu'
MAT_ROOT = CONTENT_ROOT + '/Materials'
# LIT handoff (lit-handoff.plan.md): the GLB carries real PBR materials over an unshaded
# base, so the map's sun + sky light do the lighting through the M_MojuloLit master.
# False = the mojulo look (unlit vertex colour, light baked into the recipe).
LIT = ${lit ? 'True' : 'False'}
# A world pack's skinned figures and the GLB clip each loops at import (no kernel plays them there; Godot's figure
# scene plays the same clip): figure -> clip. Empty in a game pack, whose kernel plays its figures' clips.
FIGURE_CLIPS = ${JSON.stringify(Object.fromEntries(Object.entries(figureClips).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))))}
M = 100.0  # 1 mojulo unit = 1 meter; UE works in centimeters
START_LIFT_CM = 96.0  # the score's spawn is the walker's FEET; a PlayerStart is the capsule's centre (default half-height 88 cm + margin)
IMPORT_TAG = 'MojuloImported'


def P(v):
    """THE frame conversion, python half: mojulo z-up right-handed meters ->
    UE z-up left-handed centimeters. PINNED by the machine gate's
    frame_landmark check. MUST stay identical to MojuloScore::P in the
    kernel plugin."""
    return unreal.Vector(v[0] * M, -v[1] * M, v[2] * M)


def read_json(path):
    with open(path, 'r') as f:
        return json.load(f)


def game_manifest():
    path = os.path.join(PACK, 'game.json')
    return read_json(path) if os.path.exists(path) else None


def subsystem(cls):
    return unreal.get_editor_subsystem(cls)


def all_actors():
    return list(subsystem(unreal.EditorActorSubsystem).get_all_level_actors())


def clean_label(s):
    """Interchange sanitizes punctuation when naming actors ('entity:hero'
    -> 'entity_hero') — compare labels in sanitized space (pinned at the U1
    machine gate: the crypt hero landmark failed on the raw colon)."""
    return ''.join(c if c.isalnum() else '_' for c in s)


def find_actor_by_label(label):
    want = clean_label(label)
    for a in all_actors():
        if clean_label(a.get_actor_label()) == want:
            return a
    return None


def find_entity_actor(score, entity):
    """GLB entity wrappers are named by FIGURE (the id rides glTF extras,
    which importers do not surface as node/actor names) — figure first,
    entity:<id> fallback. Mirrors Unity's FindEntityNode."""
    figure = entity.get('figure')
    if figure:
        hit = find_actor_by_label(figure)
        if hit is not None:
            return hit
    return find_actor_by_label('entity:' + entity.get('id', ''))


def spawn(cls, location, label):
    actor = subsystem(unreal.EditorActorSubsystem).spawn_actor_from_class(cls, location, unreal.Rotator(0, 0, 0))
    actor.set_actor_label(label)
    return actor


def light_rig(score=None):
    """Sun + sky atmosphere + sky light (+ height fog when the score names a sky), all MOVABLE. Movable = no Lightmass
    build, so no 'Preview'-stamped shadows; the SkyAtmosphere gives the sky
    light a real sky to capture (without it the world is black and the sky
    light contributes nothing — the first lit eyes gate was a black-sky box
    lit by sun patches alone). The sun is LOW (pitch -35): the
    walk tier's ceiling seals a room, so the sun must come through the panes
    (blender-bake.mjs --render's finding). NOTE unreal.Rotator's Python
    constructor is (roll, pitch, yaw) — keyword args, so the pitch IS the
    pitch. Unlit packs get the same rig: the unlit master ignores it, the
    sky still fills the windows (ledger: sky_approximated).
    score.sky.preset (the recipe's declaration, unreal-demo D2): 'night' turns the sun into a
    dim cool MOON (0.5 lux, pitch -40) so the atmosphere goes dark and the score's lamp
    lights carry the scene; 'dawn' / 'dusk' set a low warm sun; 'day' keeps the default.
    Any outdoor preset also spawns an ExponentialHeightFog (dense + blue at night, thin by
    day). 'interior' (an enclosed kind — the cave) keeps the sun OUT: intensity 0, a faint sky
    light, no fog, so the score's own lights carry the level. No preset: the pre-D2 rig."""
    movable = unreal.ComponentMobility.MOVABLE
    preset = ((score or {}).get('sky') or {}).get('preset') if isinstance(score, dict) else None
    sun = spawn(unreal.DirectionalLight, unreal.Vector(0, 0, 500.0), 'MojuloSun')
    pitch = -40.0 if preset == 'night' else -12.0 if preset in ('dawn', 'dusk') else -35.0
    sun.set_actor_rotation(unreal.Rotator(roll=0.0, pitch=pitch, yaw=-30.0), False)
    try:
        sun.light_component.set_editor_property('mobility', movable)
        sun.light_component.set_editor_property('atmosphere_sun_light', True)
        if preset == 'interior':
            sun.light_component.set_editor_property('intensity', 0.0)
        elif preset == 'night':
            sun.light_component.set_editor_property('intensity', 0.5)
            sun.light_component.set_editor_property('light_color', unreal.Color(r=170, g=190, b=255, a=255))
        elif preset in ('dawn', 'dusk'):
            sun.light_component.set_editor_property('intensity', 4.0)
            sun.light_component.set_editor_property('light_color', unreal.Color(r=255, g=190, b=140, a=255))
    except Exception as e:
        unreal.log_warning('[mojulo] sun setup: ' + str(e))
    fog_comp = None
    if preset and preset != 'interior':
        try:
            fog = spawn(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0), 'MojuloFog')
            comp = fog.get_editor_property('component')
            fog_comp = comp
            comp.set_editor_property('fog_density', 0.008 if preset == 'night' else 0.004)
            comp.set_editor_property('fog_height_falloff', 0.2)
            if preset == 'night':
                comp.set_editor_property('fog_inscattering_luminance', unreal.LinearColor(0.004, 0.006, 0.014, 1.0))
            unreal.log('[mojulo] sky preset ' + str(preset) + ': sun pitch ' + str(pitch) + ', height fog')
        except Exception as e:
            unreal.log_warning('[mojulo] height fog: ' + str(e))
    # the world's weather (score.weather, weather-score.js): the state the schedule opens in, as the editor-time rig can hold
    # it: the height fog thickened by the state's factor and tinted its colour, the sun dimmed by the light the state takes
    # off. The schedule's timeline rides the score for a Blueprint to play; falls and lightning stay the web build's.
    wx = score.get('weather') if isinstance(score, dict) else None
    if isinstance(wx, dict) and preset != 'interior':
        try:
            now = wx.get('now')
            st = next((s for s in (wx.get('states') or []) if s.get('name') == now), None)
            if st:
                if fog_comp is None:
                    fog = spawn(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0), 'MojuloFog')
                    fog_comp = fog.get_editor_property('component')
                    fog_comp.set_editor_property('fog_height_falloff', 0.2)
                fog_comp.set_editor_property('fog_density', 0.004 * float(st.get('fog', 1.0)))
                c = st.get('color') or [0.7, 0.75, 0.8]
                lin = [max(0.0, float(v)) ** 2.2 for v in c[:3]]
                fog_comp.set_editor_property('fog_inscattering_luminance', unreal.LinearColor(lin[0], lin[1], lin[2], 1.0))
                off = 1.0 - min(0.7, float(st.get('dim', 0.0)) * 0.7)
                sun.light_component.set_editor_property('intensity', float(sun.light_component.get_editor_property('intensity')) * off)
                unreal.log('[mojulo] weather ' + str(now) + ': fog x' + str(st.get('fog')) + ', light x' + str(round(off, 2)))
        except Exception as e:
            unreal.log_warning('[mojulo] weather: ' + str(e))
    if preset in ('night', 'interior'):
        # auto-exposure would lift a moonlit street or a fire-lit cave to daylight; an unbound post
        # volume biases it down so dark READS as dark (the one documented default; the operator dials it)
        try:
            post = spawn(unreal.PostProcessVolume, unreal.Vector(0, 0, 0), 'MojuloPost')
            post.set_editor_property('unbound', True)
            pps = post.get_editor_property('settings')
            pps.set_editor_property('override_auto_exposure_bias', True)
            pps.set_editor_property('auto_exposure_bias', -2.0 if preset == 'night' else -1.5)
            post.set_editor_property('settings', pps)
        except Exception as e:
            unreal.log_warning('[mojulo] post volume: ' + str(e))
    try:
        spawn(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0), 'MojuloSkyAtmosphere')
    except Exception as e:
        unreal.log_warning('[mojulo] sky atmosphere: ' + str(e))
    sky = spawn(unreal.SkyLight, unreal.Vector(0, 0, 500.0), 'MojuloSkyLight')
    try:
        sky.light_component.set_editor_property('mobility', movable)
        sky.light_component.set_editor_property('real_time_capture', True)
        if preset == 'interior':
            sky.light_component.set_editor_property('intensity', 0.05)
            unreal.log('[mojulo] sky preset interior: sun off, faint sky light, no fog')
    except Exception as e:
        unreal.log_warning('[mojulo] sky light setup: ' + str(e))


def count_local_lights():
    """Point + spot lights in the level (Interchange-imported or ours); the rig's sun and
    sky light are not local lights, so they never count."""
    n = 0
    for a in all_actors():
        try:
            n += len(list(a.get_components_by_class(unreal.LocalLightComponent)))   # components, not actors: one imported actor may host several lights
        except Exception:
            pass
    return n


def settle_local_lights():
    """Every point / spot light in the level — Interchange-imported (the GLB's
    KHR_lights_punctual: pinned at the pot-light gate, Interchange brings them in
    itself) or ours — goes Movable like the rig: no Lightmass build, no 'Preview'
    stamp on their shadows."""
    for a in all_actors():
        try:
            for comp in a.get_components_by_class(unreal.LocalLightComponent):
                comp.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
        except Exception:
            pass


def ensure_pot_lights(score):
    """score.lights (recessed pot lights, lit-handoff.plan.md): the GLB carries them as
    KHR_lights_punctual. When Interchange brought none into the level, spawn them from
    the score: candela, cones in radians -> degrees, pointing DOWN (a UE spot shines along
    its +X, so pitch -90), Movable like the rig. UNPINNED: the count is the verify check."""
    lights = score.get('lights') or []
    if not lights:
        return 0
    have = count_local_lights()
    if have >= len(lights):
        settle_local_lights()
        return have
    for i, l in enumerate(lights):
        pos = l.get('position') or [0.0, 0.0, 0.0]
        cls = unreal.SpotLight if l.get('type') == 'spot' else unreal.PointLight
        actor = spawn(cls, P(pos), 'MojuloPot_' + str(i))
        actor.set_actor_rotation(unreal.Rotator(roll=0.0, pitch=-90.0, yaw=0.0), False)
        try:
            comp = actor.light_component
            comp.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
            comp.set_editor_property('intensity_units', unreal.LightUnits.CANDELAS)
            comp.set_editor_property('intensity', float(l.get('intensity', 400.0)))
            col = l.get('color') or [1.0, 1.0, 1.0]
            comp.set_editor_property('light_color', unreal.Color(r=int(col[0] * 255), g=int(col[1] * 255), b=int(col[2] * 255), a=255))
            if l.get('type') == 'spot':
                comp.set_editor_property('inner_cone_angle', math.degrees(float(l.get('innerCone', 0.5))))
                comp.set_editor_property('outer_cone_angle', math.degrees(float(l.get('outerCone', 0.8))))
        except Exception as e:
            unreal.log_warning('[mojulo] pot light ' + str(i) + ': ' + str(e))
    settle_local_lights()
    return len(lights)


def spawn_block(label, center, size_cm, visible=False):
    """A blocking box from the engine's basic cube (100 cm), scaled. Hidden in
    game by default — collision stays live when hidden."""
    actor = spawn(unreal.StaticMeshActor, center, label)
    cube = unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cube.Cube')
    mesh_comp = actor.static_mesh_component
    mesh_comp.set_static_mesh(cube)
    actor.set_actor_scale3d(unreal.Vector(size_cm.x / 100.0, size_cm.y / 100.0, size_cm.z / 100.0))
    if not visible:
        actor.set_actor_hidden_in_game(True)
    return actor


def aabb_center(b):
    return P([(b['min'][0] + b['max'][0]) * 0.5, (b['min'][1] + b['max'][1]) * 0.5, (b['min'][2] + b['max'][2]) * 0.5])


def aabb_size_cm(b):
    # Sizes are unsigned extents — no handedness flip, no axis swap (both
    # frames are z-up).
    return unreal.Vector((b['max'][0] - b['min'][0]) * M, (b['max'][1] - b['min'][1]) * M, (b['max'][2] - b['min'][2]) * M)


def hide_actor_tree(actor):
    actor.set_actor_hidden_in_game(True)
    for child in actor.get_attached_actors():
        hide_actor_tree(child)


def clear_mojulo_actors():
    """Idempotency: drop everything a previous run put in the level — helper
    actors by label prefix, imported scene actors by the tag stamped after
    import (830 -> 1570 -> 2310 actors across three gate runs pinned the
    leak: import_scene stacks a fresh copy per run)."""
    for a in all_actors():
        tagged = IMPORT_TAG in [str(t) for t in (a.tags or [])]
        if tagged or a.get_actor_label().startswith('Mojulo'):
            subsystem(unreal.EditorActorSubsystem).destroy_actor(a)


def import_glb(glb_path, content_dir):
    """Import a pack GLB as a scene: assets under content_dir, actors into
    the open level (PINNED at the first machine gate:
    InterchangeManager.import_scene works as written).

    Interchange cannot RE-import LevelSequences ('Re-import of
    ULevelSequence not supported yet', UE 5.8, editor exit 1) — so the GLB's
    asset subtree is clean-deleted first and every run is a fresh import.
    Deterministic asset paths make this idempotent-by-reconstruction; the
    Mojulo materials live outside the subtree and survive."""
    stem = os.path.splitext(os.path.basename(glb_path))[0]
    subtree = content_dir + '/' + stem
    if unreal.EditorAssetLibrary.does_directory_exist(subtree):
        unreal.EditorAssetLibrary.delete_directory(subtree)
    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    source = unreal.InterchangeManager.create_source_data(glb_path)
    params = unreal.ImportAssetParameters()
    params.is_automated = True
    manager.import_scene(content_dir, source, params)


def ensure_unlit_master():
    """The one material of the mojulo look: UNLIT, emissive = base texture x
    vertex colour (COLOR_0) — light is baked into the recipe, no scene
    lighting participates. Interchange imports the GLB with lit default-grey
    materials that ignore COLOR_0 (pinned at the first EYES gate: black in
    Lit, flat grey in Unlit), so the importer owns the look."""
    path = MAT_ROOT + '/M_MojuloUnlit'
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    unreal.EditorAssetLibrary.make_directory(MAT_ROOT)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset('M_MojuloUnlit', MAT_ROOT, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    ml = unreal.MaterialEditingLibrary
    tex = ml.create_material_expression(mat, unreal.MaterialExpressionTextureSampleParameter2D, -600, -200)
    tex.set_editor_property('parameter_name', 'BaseTex')
    white = unreal.EditorAssetLibrary.load_asset('/Engine/EngineResources/WhiteSquareTexture')
    if white is not None:
        tex.set_editor_property('texture', white)
    vc = ml.create_material_expression(mat, unreal.MaterialExpressionVertexColor, -600, 100)
    mul = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -300, -50)
    ml.connect_material_expressions(tex, 'RGB', mul, 'A')
    ml.connect_material_expressions(vc, '', mul, 'B')
    ml.connect_material_property(mul, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    ml.recompile_material(mat)
    unreal.EditorAssetLibrary.save_asset(path)
    return mat


def ensure_lit_master():
    """The LIT twin of M_MojuloUnlit: DEFAULT-LIT shading, base colour = base
    texture x vertex colour (COLOR_0), a Roughness scalar parameter (0.85 —
    a matte dielectric; instances can dial it), metallic 0. The level's
    MojuloSun + MojuloSkyLight (spawned below) are what light it."""
    path = MAT_ROOT + '/M_MojuloLit'
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    unreal.EditorAssetLibrary.make_directory(MAT_ROOT)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset('M_MojuloLit', MAT_ROOT, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_DEFAULT_LIT)
    ml = unreal.MaterialEditingLibrary
    tex = ml.create_material_expression(mat, unreal.MaterialExpressionTextureSampleParameter2D, -600, -200)
    tex.set_editor_property('parameter_name', 'BaseTex')
    white = unreal.EditorAssetLibrary.load_asset('/Engine/EngineResources/WhiteSquareTexture')
    if white is not None:
        tex.set_editor_property('texture', white)
    vc = ml.create_material_expression(mat, unreal.MaterialExpressionVertexColor, -600, 100)
    mul = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -300, -50)
    ml.connect_material_expressions(tex, 'RGB', mul, 'A')
    ml.connect_material_expressions(vc, '', mul, 'B')
    ml.connect_material_property(mul, '', unreal.MaterialProperty.MP_BASE_COLOR)
    rough = ml.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -300, 200)
    rough.set_editor_property('parameter_name', 'Roughness')
    rough.set_editor_property('default_value', 0.85)
    ml.connect_material_property(rough, '', unreal.MaterialProperty.MP_ROUGHNESS)
    ml.recompile_material(mat)
    unreal.EditorAssetLibrary.save_asset(path)
    return mat


def glb_doc(glb_path, what):
    """The GLB's JSON chunk, read straight off the file (stdlib only); None when
    unreadable — a scan, never a gate."""
    try:
        with open(glb_path, 'rb') as f:
            head = f.read(20)
            length = struct.unpack_from('<I', head, 12)[0]
            return json.loads(f.read(length))
    except Exception as e:  # noqa: BLE001 — a scan, never a gate
        unreal.log_warning('[mojulo] ' + what + ': ' + str(e))
        return None


def sticker_material_names(glb_path):
    """The GLB materials declared KHR_materials_unlit AND alphaMode BLEND: the web
    tier's stickers (contact shadows under the furniture, window panes), whose
    darkness and transparency ride COLOR_0's alpha. Names rewritten the way
    Interchange names the assets it makes from them (':' and friends -> '_').
    [] when unreadable."""
    doc = glb_doc(glb_path, 'sticker scan')
    if doc is None:
        return []
    names = []
    for m in doc.get('materials', []):
        if 'KHR_materials_unlit' in (m.get('extensions') or {}) and m.get('alphaMode') == 'BLEND':
            names.append(re.sub('[^A-Za-z0-9_-]', '_', str(m.get('name', ''))).lower())
    return [n for n in names if n]


def glb_skins(glb_path):
    """The skinned figures a GLB declares, [(figure, joints)]: scene-gltf names a
    figure's skin '<figure>:skin'. [] when unreadable or none."""
    doc = glb_doc(glb_path, 'skin scan') or {}
    out = []
    for s in doc.get('skins', []):
        name = str(s.get('name', ''))
        if name.endswith(':skin'):
            out.append((name[:-len(':skin')], len(s.get('joints') or [])))
    return out


def skeletal_components(actor):
    """The SkeletalMeshComponents in an actor's attachment tree (Interchange
    imports one actor per GLB node)."""
    found = list(actor.get_components_by_class(unreal.SkeletalMeshComponent))
    for child in actor.get_attached_actors():
        found += skeletal_components(child)
    return found


def figure_skeletal(figure):
    """A skinned figure's SkeletalMeshComponents: under its wrapper actor (named
    by figure, as the kernel finds it), else on the skeletal mesh actors
    labelled after it. UNPINNED: where Interchange spawns the actor of a
    skinned node."""
    wrapper = find_actor_by_label(figure)
    comps = skeletal_components(wrapper) if wrapper is not None else []
    if comps:
        return comps
    want = clean_label(figure)
    for a in all_actors():
        if isinstance(a, unreal.SkeletalMeshActor) and clean_label(a.get_actor_label()).startswith(want):
            comps += skeletal_components(a)
    return comps


def assets_of(content_dir, cls):
    """clean asset name -> asset path, for the assets of one class under content_dir."""
    out = {}
    for p in unreal.EditorAssetLibrary.list_assets(content_dir, recursive=True, include_folder=False):
        a = unreal.EditorAssetLibrary.load_asset(p)
        if isinstance(a, cls):
            out[clean_label(a.get_name())] = p
    return out


def find_clip(index, clip):
    """A skinned figure's clip in an AnimSequence index: its cleaned GLB name
    ('body:idle' -> 'body_idle'), else the one asset whose name contains it.
    UNPINNED: the name Interchange gives a glTF animation (the kernel's
    AnimForClip reads the same way)."""
    want = clean_label(clip)
    if want in index:
        return index[want]
    hits = sorted(k for k in index if want in k)
    return index[hits[0]] if len(hits) == 1 else None


def skeletal_bone_names(mesh):
    """A SkeletalMesh's bone names, off its skeleton's reference pose; None when
    this editor does not expose them (UNPINNED: AnimPoseExtensions)."""
    try:
        pose = unreal.AnimPoseExtensions.get_reference_pose(mesh.get_editor_property('skeleton'))
        return [str(n) for n in unreal.AnimPoseExtensions.get_bone_names(pose)]
    except Exception:  # noqa: BLE001 — a readout, never a gate
        return None


def skeletal_bone_count(mesh):
    names = skeletal_bone_names(mesh)
    return None if names is None else len(names)


def loop_figure_clips(content_dir):
    """World scope: each skinned figure (FIGURE_CLIPS) loops its clip on its
    SkeletalMeshComponent, single node, so a lone figure breathes without a
    kernel. A figure whose clip or mesh is not found stands, and says so."""
    if not FIGURE_CLIPS:
        return
    index = assets_of(content_dir, unreal.AnimSequence)
    for figure, clip in sorted(FIGURE_CLIPS.items()):
        p = find_clip(index, clip)
        comps = figure_skeletal(figure)
        if p is None or not comps:
            unreal.log_warning('[mojulo] figure ' + figure + ' stands: ' + ('no AnimSequence for ' + clip if p is None else 'no skeletal mesh actor'))
            continue
        anim = unreal.EditorAssetLibrary.load_asset(p)
        for comp in comps:
            comp.set_editor_property('animation_mode', unreal.AnimationMode.ANIMATION_SINGLE_NODE)
            comp.override_animation_data(anim, True, True, 0.0, 1.0)
        unreal.log('[mojulo] figure ' + figure + ' loops ' + anim.get_name())


def glb_humanoids(glb_path):
    """The humanoid figures a GLB declares (VRMC_vrm's humanBones), {figure: {vrm bone: node name}}: scene-gltf names a
    humanoid joint '<figure>:<vrm bone>'. {} when unreadable or none."""
    doc = glb_doc(glb_path, 'humanoid scan') or {}
    bones = ((doc.get('extensions') or {}).get('VRMC_vrm') or {}).get('humanoid', {}).get('humanBones') or {}
    nodes = doc.get('nodes') or []
    out = {}
    for vrm, ref in sorted(bones.items()):
        i = (ref or {}).get('node')
        name = str(nodes[i].get('name', '')) if isinstance(i, int) and 0 <= i < len(nodes) else ''
        if ':' in name:
            out.setdefault(name.split(':')[0], {})[vrm] = name
    return out


def turn_lone_humanoids(glb_path):
    """A humanoid figure no entity places stands in the VRM space, facing its +z: the figure's back in the world's frame
    (scene-gltf turns a placed one itself). Half a turn about up brings it to the world's facing, as Godot's figure
    scene turns it. Idempotent: the import's actors are fresh on every run."""
    doc = glb_doc(glb_path, 'facing scan') or {}
    nodes = doc.get('nodes') or []
    skins = set(f for f, _ in glb_skins(glb_path))
    for i in (doc.get('scenes') or [{}])[0].get('nodes') or []:
        n = nodes[i] if 0 <= i < len(nodes) else {}
        name = str(n.get('name', ''))
        if name in skins and 'rotation' not in n:
            actor = find_actor_by_label(name)
            if actor is not None:
                actor.add_actor_world_rotation(unreal.Rotator(roll=0.0, pitch=0.0, yaw=180.0), False, False)
                unreal.log('[mojulo] figure ' + name + ' turned to the world facing')


# THE RETARGET SEAM: one FK chain per limb over a humanoid figure's VRM bones, named as Unreal's mannequin IK rig names
# its chains, so an IK Retargeter maps the two by name. (chain, first bone, last bone): each end the first of its
# candidates the figure has; a chain whose ends it lacks is left out.
RETARGET_CHAINS = [
    ('Spine', ['spine'], ['upperChest', 'chest', 'spine']),
    ('Neck', ['neck'], ['neck']),
    ('Head', ['head'], ['head']),
    ('LeftClavicle', ['leftShoulder'], ['leftShoulder']),
    ('LeftArm', ['leftUpperArm'], ['leftHand']),
    ('RightClavicle', ['rightShoulder'], ['rightShoulder']),
    ('RightArm', ['rightUpperArm'], ['rightHand']),
    ('LeftLeg', ['leftUpperLeg'], ['leftToes', 'leftFoot']),
    ('RightLeg', ['rightUpperLeg'], ['rightToes', 'rightFoot']),
] + [(side.capitalize() + finger, [side + vrm + first for first in starts], [side + vrm + 'Distal'])
     for side in ('left', 'right')
     for finger, vrm, starts in (('Thumb', 'Thumb', ['Metacarpal', 'Proximal']), ('Index', 'Index', ['Proximal']),
                                 ('Middle', 'Middle', ['Proximal']), ('Ring', 'Ring', ['Proximal']),
                                 ('Pinky', 'Little', ['Proximal']))]
# the mannequin rig a retargeter maps from, where Unreal's templates put it (MOJULO_SOURCE_IK_RIG names another)
SOURCE_IK_RIGS = ['/Game/Characters/Mannequins/Rigs/IK_Mannequin', '/Game/Characters/Mannequins/Rigs/IK_Manny']


def retarget_chains(vrm):
    """The chains a humanoid's VRM bones make: [(chain, first vrm bone, last vrm bone)]."""
    out = []
    for chain, starts, ends in RETARGET_CHAINS:
        a = next((b for b in starts if b in vrm), None)
        z = next((b for b in ends if b in vrm), None)
        if a and z:
            out.append((chain, a, z))
    return out


def source_ik_rig():
    for p in ([os.environ['MOJULO_SOURCE_IK_RIG']] if os.environ.get('MOJULO_SOURCE_IK_RIG') else []) + SOURCE_IK_RIGS:
        if unreal.EditorAssetLibrary.does_asset_exist(p):
            rig = unreal.EditorAssetLibrary.load_asset(p)
            if isinstance(rig, unreal.IKRigDefinition):
                return rig
    return None


def asset_in_place(folder, name, cls, factory):
    """The asset at folder/name, made when missing: a re-run rebuilds it IN PLACE, so whatever the project points at it
    (an AnimBP's retargeter) survives a re-mint."""
    path = folder + '/' + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        a = unreal.EditorAssetLibrary.load_asset(path)
        if isinstance(a, cls):
            return a
        unreal.EditorAssetLibrary.delete_asset(path)
    return unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, folder, cls, factory)


def step(log, what, fn):
    """One UNPINNED editor call (the IK Rig / Retargeter Python API moved between 5.2 and 5.6): tried, its outcome logged."""
    try:
        out = fn()
        log.append(what + ' ok')
        return out if out is not None else True
    except Exception as e:  # noqa: BLE001 — every step advises, none refuses
        log.append(what + ' failed: ' + str(e))
        unreal.log_warning('[mojulo] ' + what + ': ' + str(e))
        return None


def retarget_figures(glb_path, content_dir):
    """C2: each humanoid figure the GLB declares gets an IK Rig over its skeleton (retarget root hips, RETARGET_CHAINS)
    under content_dir/Retarget, and, when the project holds a mannequin rig, an IK Retargeter from it to the figure."""
    meshes = assets_of(content_dir, unreal.SkeletalMesh)
    folder = content_dir + '/Retarget'
    for figure, vrm in sorted(glb_humanoids(glb_path).items()):
        want = clean_label(figure)
        hits = sorted(k for k in meshes if k.startswith(want))
        if not hits or 'hips' not in vrm:
            unreal.log_warning('[mojulo] retarget ' + figure + ': ' + ('no SkeletalMesh' if not hits else 'no hips'))
            continue
        mesh = unreal.EditorAssetLibrary.load_asset(meshes[hits[0]])
        names = skeletal_bone_names(mesh) or []
        by_clean = dict((clean_label(n), n) for n in names)
        bone = lambda v: by_clean.get(clean_label(vrm[v]), clean_label(vrm[v]))   # noqa: E731 — the bone a VRM name became
        log = []
        rig = asset_in_place(folder, 'IK_Mojulo_' + want, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
        ctl = unreal.IKRigController.get_controller(rig)
        step(log, 'set_skeletal_mesh', lambda: ctl.set_skeletal_mesh(mesh))
        for c in list(step(log, 'get_retarget_chains', lambda: list(ctl.get_retarget_chains())) or []):
            step(log, 'remove_retarget_chain', lambda c=c: ctl.remove_retarget_chain(c.get_editor_property('chain_name')))
        step(log, 'set_retarget_root', lambda: ctl.set_retarget_root(bone('hips')))
        made = []
        for chain, a, z in retarget_chains(vrm):
            if step(log, 'chain ' + chain, lambda chain=chain, a=a, z=z: ctl.add_retarget_chain(chain, bone(a), bone(z), '')):
                made.append(chain)
        unreal.EditorAssetLibrary.save_loaded_asset(rig)
        unreal.log('[mojulo] retarget ' + figure + ': IK Rig with ' + str(len(made)) + ' chains (' + ', '.join(made) + ')')
        source = source_ik_rig()
        if source is None:
            unreal.log('[mojulo] retarget ' + figure + ': no mannequin IK rig in the project (MOJULO_SOURCE_IK_RIG names one) — the IK Rig is the seam')
            continue
        rtg = asset_in_place(folder, 'RTG_Mojulo_' + want, unreal.IKRetargeter, unreal.IKRetargetFactory())
        rc = unreal.IKRetargeterController.get_controller(rtg)
        step(log, 'set source rig', lambda: rc.set_ik_rig(unreal.RetargetSourceOrTarget.SOURCE, source))
        step(log, 'set target rig', lambda: rc.set_ik_rig(unreal.RetargetSourceOrTarget.TARGET, rig))
        step(log, 'set target mesh', lambda: rc.set_preview_mesh(unreal.RetargetSourceOrTarget.TARGET, mesh))
        step(log, 'auto map chains', lambda: rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True))
        # the figure rests in the T, the mannequin in its A: the figure's retarget pose is aligned to the source's
        step(log, 'align target pose', lambda: rc.auto_align_all_bones(unreal.RetargetSourceOrTarget.TARGET))
        unreal.EditorAssetLibrary.save_loaded_asset(rtg)
        unreal.log('[mojulo] retarget ' + figure + ': ' + source.get_name() + ' -> ' + rig.get_name() + ' (' + '; '.join(x for x in log if 'failed' in x) + ')')


def ensure_sticker_master():
    """The stickers' own master, mode-free (lit and unlit packs alike): UNLIT +
    TRANSLUCENT, two-sided, emissive = base texture x vertex colour, opacity =
    vertex alpha x texture alpha — the web tier's contract for a
    KHR_materials_unlit BLEND material. Before this the swap put them on the
    opaque master and the contact shadows drew as solid grey slabs under every
    piece (lounge sk_lkypzdim4y, the Unreal eyes gate; the machine gate
    counted the slots and could not see it)."""
    path = MAT_ROOT + '/M_MojuloSticker'
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    unreal.EditorAssetLibrary.make_directory(MAT_ROOT)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset('M_MojuloSticker', MAT_ROOT, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    mat.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
    mat.set_editor_property('two_sided', True)
    ml = unreal.MaterialEditingLibrary
    tex = ml.create_material_expression(mat, unreal.MaterialExpressionTextureSampleParameter2D, -600, -200)
    tex.set_editor_property('parameter_name', 'BaseTex')
    white = unreal.EditorAssetLibrary.load_asset('/Engine/EngineResources/WhiteSquareTexture')
    if white is not None:
        tex.set_editor_property('texture', white)
    vc = ml.create_material_expression(mat, unreal.MaterialExpressionVertexColor, -600, 100)
    mul = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -300, -50)
    ml.connect_material_expressions(tex, 'RGB', mul, 'A')
    ml.connect_material_expressions(vc, '', mul, 'B')
    ml.connect_material_property(mul, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    op = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -300, 200)
    ml.connect_material_expressions(tex, 'A', op, 'A')
    ml.connect_material_expressions(vc, 'A', op, 'B')
    ml.connect_material_property(op, '', unreal.MaterialProperty.MP_OPACITY)
    ml.recompile_material(mat)
    unreal.EditorAssetLibrary.save_asset(path)
    return mat


def ensure_ground_material():
    """The LIT fallback ground: DEFAULT-LIT, a constant neutral base colour (BaseColor
    vector parameter, a dark warm grey), roughness 0.95 — a greybox floor to the horizon.
    Hidden, the plane showed the atmosphere's void below the horizon as BLACK."""
    path = MAT_ROOT + '/M_MojuloGround'
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    unreal.EditorAssetLibrary.make_directory(MAT_ROOT)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset('M_MojuloGround', MAT_ROOT, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_DEFAULT_LIT)
    ml = unreal.MaterialEditingLibrary
    base = ml.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -400, -100)
    base.set_editor_property('parameter_name', 'BaseColor')
    base.set_editor_property('default_value', unreal.LinearColor(0.16, 0.15, 0.14, 1.0))
    ml.connect_material_property(base, '', unreal.MaterialProperty.MP_BASE_COLOR)
    rough = ml.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -400, 150)
    rough.set_editor_property('parameter_name', 'Roughness')
    rough.set_editor_property('default_value', 0.95)
    ml.connect_material_property(rough, '', unreal.MaterialProperty.MP_ROUGHNESS)
    ml.recompile_material(mat)
    unreal.EditorAssetLibrary.save_asset(path)
    return mat


def ensure_rim_master():
    """The rim's master (shader-look phase 4): the mode master's look plus a
    fresnel edge light on emissive — RimColor x RimStrength x pow(1 -
    saturate(dot(N, V)), RimPower), the web patch's construction, the same
    five numbers the Godot kernel's rim.gdshader spends. A dedicated master:
    the plain masters never change, so a pack without score.look leaves an
    existing project byte-identical. UE builds normals at mesh build when the
    GLB ships none (unlike Godot's runtime import), so the Fresnel node's
    default pixel normal serves. UNPINNED: Fresnel input pin names."""
    name = 'M_MojuloRimLit' if LIT else 'M_MojuloRim'
    path = MAT_ROOT + '/' + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    unreal.EditorAssetLibrary.make_directory(MAT_ROOT)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset(name, MAT_ROOT, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_DEFAULT_LIT if LIT else unreal.MaterialShadingModel.MSM_UNLIT)
    ml = unreal.MaterialEditingLibrary
    tex = ml.create_material_expression(mat, unreal.MaterialExpressionTextureSampleParameter2D, -700, -200)
    tex.set_editor_property('parameter_name', 'BaseTex')
    white = unreal.EditorAssetLibrary.load_asset('/Engine/EngineResources/WhiteSquareTexture')
    if white is not None:
        tex.set_editor_property('texture', white)
    vc = ml.create_material_expression(mat, unreal.MaterialExpressionVertexColor, -700, 100)
    mul = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -400, -50)
    ml.connect_material_expressions(tex, 'RGB', mul, 'A')
    ml.connect_material_expressions(vc, '', mul, 'B')
    rim_color = ml.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -700, 300)
    rim_color.set_editor_property('parameter_name', 'RimColor')
    rim_color.set_editor_property('default_value', unreal.LinearColor(0.35, 0.62, 1.0, 1.0))
    rim_power = ml.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -700, 450)
    rim_power.set_editor_property('parameter_name', 'RimPower')
    rim_power.set_editor_property('default_value', 2.0)
    rim_strength = ml.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -700, 600)
    rim_strength.set_editor_property('parameter_name', 'RimStrength')
    rim_strength.set_editor_property('default_value', 0.0)
    fres = ml.create_material_expression(mat, unreal.MaterialExpressionFresnel, -550, 420)
    fres.set_editor_property('base_reflect_fraction', 0.0)
    ml.connect_material_expressions(rim_power, '', fres, 'ExponentIn')
    gain = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -400, 450)
    ml.connect_material_expressions(fres, '', gain, 'A')
    ml.connect_material_expressions(rim_strength, '', gain, 'B')
    edge = ml.create_material_expression(mat, unreal.MaterialExpressionMultiply, -250, 380)
    ml.connect_material_expressions(rim_color, '', edge, 'A')
    ml.connect_material_expressions(gain, '', edge, 'B')
    if LIT:
        ml.connect_material_property(mul, '', unreal.MaterialProperty.MP_BASE_COLOR)
        rough = ml.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -400, 200)
        rough.set_editor_property('parameter_name', 'Roughness')
        rough.set_editor_property('default_value', 0.85)
        ml.connect_material_property(rough, '', unreal.MaterialProperty.MP_ROUGHNESS)
        # a lit material's emissive ADDS over shading — the rim rides there untouched
        ml.connect_material_property(edge, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    else:
        add = ml.create_material_expression(mat, unreal.MaterialExpressionAdd, -100, 100)
        ml.connect_material_expressions(mul, '', add, 'A')
        ml.connect_material_expressions(edge, '', add, 'B')
        ml.connect_material_property(add, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    ml.recompile_material(mat)
    unreal.EditorAssetLibrary.save_asset(path)
    return mat


def ensure_master():
    return ensure_lit_master() if LIT else ensure_unlit_master()


def first_texture(mat_iface):
    """Best-effort: the base-colour texture Interchange put on its own
    material instance, so the swap keeps the atlas. None -> white default."""
    if mat_iface is None:
        return None
    try:
        if isinstance(mat_iface, unreal.MaterialInstance):
            for tpv in mat_iface.get_editor_property('texture_parameter_values'):
                t = tpv.get_editor_property('parameter_value')
                if t is not None:
                    return t
    except Exception:  # noqa: BLE001 — texture recovery is best-effort
        pass
    return None


def unlit_instance(master, tex, cache, prefix=None):
    key = tex.get_path_name() if tex is not None else '__white__'
    if key in cache:
        return cache[key]
    name = (prefix or ('MI_MojuloLit_' if LIT else 'MI_Mojulo_')) + (tex.get_name() if tex is not None else 'White')
    path = MAT_ROOT + '/' + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        mic = unreal.EditorAssetLibrary.load_asset(path)
    else:
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        mic = tools.create_asset(name, MAT_ROOT, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        unreal.MaterialEditingLibrary.set_material_instance_parent(mic, master)
        if tex is not None:
            unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mic, 'BaseTex', tex)
        unreal.EditorAssetLibrary.save_asset(path)
    cache[key] = mic
    return mic


def is_mojulo_material(mat_iface):
    return mat_iface is not None and mat_iface.get_path_name().startswith(MAT_ROOT)


def is_emissive_slot(mat_iface):
    """A GLB material named '<group>:emissive' (a pot-light lens): Interchange's own
    import of it carries the emissive factor + strength, which the mojulo masters
    do not — so the swap leaves it alone and the verify pass counts it as kept.
    A '<group>:crystal' slot (crystal-shine) is kept the same way: its transmission,
    ior, volume and dispersion ride Interchange's import, not the vertex-colour masters. A '<group>:metal'
    slot (metal-surfaces) too: its colour and metallic ride the material, and its vertex colour is white."""
    if mat_iface is None:
        return False
    n = mat_iface.get_name().lower()
    return 'emissive' in n or ':crystal' in n or ':metal' in n


def is_ink_slot(mat_iface):
    """The GLB material named 'toon:ink' (shader-look: the baked inverted hull +
    crease lines). Its primitives ship NO COLOR_0, and UE's VertexColor node
    defaults to WHITE without one — the vertex-colour master would draw the
    outline as a white halo. Interchange's own import of the black single-sided
    material is the right look, so the swap keeps it; the rim pass must also
    never touch it (rimming the flipped-winding shell washes the whole figure
    blue — the Godot leg's finding)."""
    if mat_iface is None:
        return False
    n = mat_iface.get_name().lower()
    return 'toon' in n and 'ink' in n


def is_sticker_slot(mat_iface, mesh, names):
    """A slot whose Interchange material, or whose one-slot mesh, carries a
    sticker material's name — the mesh name catches a re-run over a project
    whose slots already sit on a mojulo material."""
    if not names:
        return False
    if mat_iface is not None and mat_iface.get_name().lower() in names:
        return True
    return mesh.get_name().lower() in names and len(mesh.get_editor_property('static_materials')) == 1


def apply_unlit_materials(glb_path=None):
    """Swap every imported mesh slot onto the mojulo look — unlit vertex colour,
    or the lit twin when LIT — except the GLB's unlit BLEND stickers, which go
    onto the translucent sticker master. Idempotent: slots already on the right
    Mojulo material are left alone."""
    master = ensure_master()
    stickers = sticker_material_names(glb_path) if glb_path else []
    sticker_master = ensure_sticker_master() if stickers else None
    cache = {}
    sticker_cache = {}
    swapped = 0
    kept = 0
    for path in unreal.EditorAssetLibrary.list_assets(CONTENT_ROOT, recursive=True, include_folder=False):
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if isinstance(asset, unreal.StaticMesh):
            for i, slot in enumerate(asset.get_editor_property('static_materials')):
                cur = slot.get_editor_property('material_interface')
                if sticker_master is not None and is_sticker_slot(cur, asset, stickers):
                    if cur is None or not cur.get_name().startswith('MI_MojuloSticker_'):
                        asset.set_material(i, unlit_instance(sticker_master, first_texture(cur), sticker_cache, 'MI_MojuloSticker_'))
                        kept += 1
                    continue
                if is_mojulo_material(cur) or is_emissive_slot(cur) or is_ink_slot(cur):
                    continue
                asset.set_material(i, unlit_instance(master, first_texture(cur), cache))
                swapped += 1
        elif isinstance(asset, unreal.SkeletalMesh):
            try:  # SkeletalMesh has no set_material; rebuild the array in place
                slots = list(asset.get_editor_property('materials'))
                changed = False
                for i, slot in enumerate(slots):
                    cur = slot.get_editor_property('material_interface')
                    if is_mojulo_material(cur) or is_ink_slot(cur):
                        continue
                    slot.set_editor_property('material_interface', unlit_instance(master, first_texture(cur), cache))
                    slots[i] = slot
                    changed = True
                    swapped += 1
                if changed:
                    asset.set_editor_property('materials', slots)
            except Exception as e:  # noqa: BLE001 — UNPINNED property shape
                unreal.log_warning('[mojulo] skeletal material swap failed on ' + path + ': ' + str(e))
    if stickers:
        unreal.log('[mojulo] ' + str(kept) + ' sticker slots kept translucent (unlit + blend in the GLB: ' + ', '.join(stickers) + ')')
    unreal.EditorAssetLibrary.save_directory(CONTENT_ROOT, only_if_is_dirty=True)
    unreal.log('[mojulo] ' + ('lit' if LIT else 'unlit') + ' vertex-colour materials on ' + str(swapped) + ' slots')


def rim_tokens(score):
    """score.look.figures whose rim is the five finite numbers -> {token: rim},
    the token being the figure name rewritten the way Interchange rewrites GLB
    names into asset names."""
    out = {}
    for name, f in ((((score or {}).get('look') or {}).get('figures')) or {}).items():
        rim = (f or {}).get('rim')
        if isinstance(rim, list) and len(rim) == 5:
            out[re.sub('[^A-Za-z0-9_-]', '_', str(name)).lower()] = rim
    return out


def apply_rim_materials(score):
    """score.look (shader-look phase 4): the rim's five numbers land as the
    fresnel term on the named figures' base slots — one MI_MojuloRim_<figure>
    instance each, parented to the rim master. Ink and emissive slots stay
    put. Runs AFTER apply_unlit_materials, so a figure's slots move from the
    plain instance onto the rim instance. No look in the score: nothing runs,
    an existing project stays byte-identical. UNPINNED: figure meshes matched
    by name token — Interchange derives asset names from GLB node/mesh names."""
    rims = rim_tokens(score)
    if not rims:
        return
    master = ensure_rim_master()
    cache = {}

    def rim_mic(token, rim, tex):
        key = token + '|' + (tex.get_name() if tex is not None else '__white__')
        if key in cache:
            return cache[key]
        name = 'MI_MojuloRim_' + token
        path = MAT_ROOT + '/' + name
        if unreal.EditorAssetLibrary.does_asset_exist(path):
            mic = unreal.EditorAssetLibrary.load_asset(path)
        else:
            tools = unreal.AssetToolsHelpers.get_asset_tools()
            mic = tools.create_asset(name, MAT_ROOT, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
            unreal.MaterialEditingLibrary.set_material_instance_parent(mic, master)
        if tex is not None:
            unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mic, 'BaseTex', tex)
        # always restamp the five numbers — a re-export may have dialed the rim
        unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(mic, 'RimColor', unreal.LinearColor(float(rim[0]), float(rim[1]), float(rim[2]), 1.0))
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(mic, 'RimStrength', float(rim[3]))
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(mic, 'RimPower', float(rim[4]))
        unreal.EditorAssetLibrary.save_asset(path)
        cache[key] = mic
        return mic

    applied = 0
    for path in unreal.EditorAssetLibrary.list_assets(CONTENT_ROOT, recursive=True, include_folder=False):
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if not isinstance(asset, (unreal.StaticMesh, unreal.SkeletalMesh)):
            continue
        mesh_name = asset.get_name().lower()
        hit = next((t for t in sorted(rims) if t and t in mesh_name), None)
        if hit is None:
            continue
        if isinstance(asset, unreal.StaticMesh):
            for i, slot in enumerate(asset.get_editor_property('static_materials')):
                cur = slot.get_editor_property('material_interface')
                if is_ink_slot(cur) or is_emissive_slot(cur) or (cur is not None and cur.get_name() == 'MI_MojuloRim_' + hit):
                    continue
                asset.set_material(i, rim_mic(hit, rims[hit], first_texture(cur)))
                applied += 1
        else:
            try:  # SkeletalMesh has no set_material; rebuild the array in place
                slots = list(asset.get_editor_property('materials'))
                changed = False
                for i, slot in enumerate(slots):
                    cur = slot.get_editor_property('material_interface')
                    if is_ink_slot(cur) or (cur is not None and cur.get_name() == 'MI_MojuloRim_' + hit):
                        continue
                    slot.set_editor_property('material_interface', rim_mic(hit, rims[hit], first_texture(cur)))
                    slots[i] = slot
                    changed = True
                    applied += 1
                if changed:
                    asset.set_editor_property('materials', slots)
            except Exception as e:  # noqa: BLE001 — UNPINNED property shape
                unreal.log_warning('[mojulo] rim swap failed on ' + path + ': ' + str(e))
    unreal.EditorAssetLibrary.save_directory(CONTENT_ROOT, only_if_is_dirty=True)
    unreal.log('[mojulo] rim on ' + str(applied) + ' slots (' + ', '.join(sorted(rims)) + ')')


def world_settings_actor():
    world = subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    return unreal.GameplayStatics.get_actor_of_class(world, unreal.WorldSettings)


def set_game_mode(cls_path):
    """Point the open map's GameMode override at a kernel class. Returns
    False (with a warning) when the plugin is not compiled/loaded — the
    guide's ③ chunk is the fix. UNPINNED: default_game_mode property path."""
    cls = unreal.load_class(None, cls_path)
    if cls is None:
        unreal.log_warning('[mojulo] kernel class missing: ' + cls_path + ' — is the MojuloKernel plugin compiled? (guide chunk 3)')
        return False
    ws = world_settings_actor()
    if ws is None:
        unreal.log_warning('[mojulo] no WorldSettings actor found')
        return False
    ws.set_editor_property('default_game_mode', cls)
    return True


def import_audio_dir():
    """Game scope: every pack bed lands as /Game/MojuloPack/Audio/<name>."""
    audio_dir = os.path.join(PACK, 'audio')
    if not os.path.isdir(audio_dir):
        return
    tasks = []
    for name in sorted(os.listdir(audio_dir)):
        if not name.endswith('.wav'):
            continue
        task = unreal.AssetImportTask()
        task.filename = os.path.join(audio_dir, name)
        task.destination_path = CONTENT_ROOT + '/Audio'
        task.automated = True
        task.replace_existing = True
        task.save = True
        tasks.append(task)
    if tasks:
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
    for task in tasks:
        for p in list(task.imported_object_paths or []):
            wave = unreal.EditorAssetLibrary.load_asset(p)
            try:
                wave.set_editor_property('looping', True)
            except Exception:  # noqa: BLE001
                pass


def import_soundtrack(score):
    """World scope only: one bed + an AmbientSound actor (no kernel)."""
    if not score.get('soundtrack'):
        return None
    wav = os.path.join(PACK, 'audio', score['soundtrack'] + '.wav')
    if not os.path.exists(wav):
        return None
    task = unreal.AssetImportTask()
    task.filename = wav
    task.destination_path = CONTENT_ROOT + '/Audio'
    task.automated = True
    task.replace_existing = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = list(task.imported_object_paths or [])
    if not paths:
        return None
    wave = unreal.EditorAssetLibrary.load_asset(paths[0])
    wave.set_editor_property('looping', True)
    return wave


def build_level(score, glb_path, content_dir, map_path, game_mode=None, bed_wave=None):
    """One level: import + materials + ground + colliders + markers + start.
    game_mode: kernel class path for game scope; None = world scope (stock
    Third Person is the walker, entity markers spawned at import)."""
    level_editor = subsystem(unreal.LevelEditorSubsystem)
    if unreal.EditorAssetLibrary.does_asset_exist(map_path):
        level_editor.load_level(map_path)
        clear_mojulo_actors()
    else:
        level_editor.new_level(map_path)

    before = set(a.get_path_name() for a in all_actors())
    import_glb(glb_path, content_dir)
    for a in all_actors():
        if a.get_path_name() not in before:
            tags = list(a.get_editor_property('tags'))
            tags.append(IMPORT_TAG)
            a.set_editor_property('tags', tags)
    apply_unlit_materials(glb_path)
    apply_rim_materials(score)
    ensure_pot_lights(score)
    turn_lone_humanoids(glb_path)
    retarget_figures(glb_path, content_dir)
    if game_mode is None:
        loop_figure_clips(content_dir)

    # Hide the player-seat body: the operator IS the walker. The whole
    # attachment tree — Interchange imports one actor per GLB node, so
    # hiding the wrapper alone leaves the body standing (pinned at U2:
    # the "hidden" seat was visible in every U0 screenshot). The kernel
    # un-hides it at runtime when the score carries locomotion (the
    # third-person walking suit).
    if score.get('player'):
        for e in score.get('entities') or []:
            if e.get('id') == score['player']:
                seat = find_entity_actor(score, e)
                if seat is not None:
                    hide_actor_tree(seat)
                break

    # Implicit ground plane at mojulo z = ground: obstacle colliders are
    # hulls only — without this the player falls forever (the G1 finding,
    # fourth engine, same trap).
    colliders = score.get('colliders') or []
    spawn_v = score.get('spawn') or [0.0, 0.0, 0.0]
    center = P(spawn_v)
    if colliders:
        xs = [c['min'][0] for c in colliders] + [c['max'][0] for c in colliders]
        ys = [c['min'][1] for c in colliders] + [c['max'][1] for c in colliders]
        center = P([(min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0, 0.0])
    ground_z = (score.get('ground') or 0.0) * M - 50.0
    if LIT:
        # lit: the plane is VISIBLE in a neutral matte (hidden, the void below the horizon read as
        # black), its top 2 cm under mojulo z = ground so the recipe's own floor faces win the depth
        ground = spawn_block('MojuloGround', unreal.Vector(center.x, center.y, ground_z - 2.0), unreal.Vector(800.0 * M, 800.0 * M, M), visible=True)
        ground.static_mesh_component.set_material(0, ensure_ground_material())
    else:
        spawn_block('MojuloGround', unreal.Vector(center.x, center.y, ground_z), unreal.Vector(800.0 * M, 800.0 * M, M))

    for i, b in enumerate(colliders):
        spawn_block('MojuloCollider_' + str(i), aabb_center(b), aabb_size_cm(b))

    # Meshless entities get placeholder marker cubes so gameplay anchors are
    # not invisible (game scope defers pickup/hazard markers to the kernel).
    for e in score.get('entities') or []:
        if e.get('id') == score.get('player') or not e.get('translation'):
            continue
        node = find_entity_actor(score, e)
        if node is not None:
            continue
        at = P(e['translation'])
        spawn_block('MojuloEntityMarker_' + e['id'], unreal.Vector(at.x, at.y, at.z + 35.0), unreal.Vector(70.0, 70.0, 70.0), visible=True)

    # the score's spawn is the walker's FEET on the floor; lift the PlayerStart to the capsule's
    # centre or the pawn spawns buried (the verify pass expects the same lift)
    start_at = P(spawn_v)
    start_at.z += START_LIFT_CM
    start = spawn(unreal.PlayerStart, start_at, 'MojuloPlayerStart')
    start.set_actor_location(start_at, False, False)
    if score.get('yaw') is not None:
        # the seat's facing: mojulo yaw is counter-clockwise from +x seen from above; UE mirrors y
        # (P above), so the same heading is the NEGATED yaw
        start.set_actor_rotation(unreal.Rotator(roll=0.0, pitch=0.0, yaw=-float(score['yaw'])), False)

    light_rig(score)

    if bed_wave is not None:
        bed = spawn(unreal.AmbientSound, P(spawn_v), 'MojuloSoundtrack')
        bed.audio_component.set_editor_property('sound', bed_wave)

    kernel_ok = set_game_mode(game_mode) if game_mode else None

    level_editor.save_current_level()
    return kernel_ok


def build():
    game = game_manifest()
    if game is None:
        score = read_json(os.path.join(PACK, 'score.json'))
        wave = import_soundtrack(score)
        build_level(score, os.path.join(PACK, 'model.glb'), CONTENT_ROOT, MAP_PATH, bed_wave=wave)
        unreal.log("[mojulo] level '" + str(score.get('title')) + "' -> " + MAP_PATH + ' (' + str(len(score.get('colliders') or [])) + ' colliders)')
        return

    # Game scope: audio beds, one map per level, then the menu map.
    import_audio_dir()
    for spec in game.get('levels') or []:
        ref = spec['ref']
        lv_dir = os.path.join(PACK, 'levels', ref)
        score = read_json(os.path.join(lv_dir, 'score.json'))
        build_level(score, os.path.join(lv_dir, 'model.glb'), CONTENT_ROOT + '/Levels/' + ref,
                    CONTENT_ROOT + '/Maps/' + ref, game_mode='/Script/MojuloKernel.MojuloGameMode')
        unreal.log("[mojulo] level '" + str(score.get('title')) + "' -> " + CONTENT_ROOT + '/Maps/' + ref)

    level_editor = subsystem(unreal.LevelEditorSubsystem)
    if unreal.EditorAssetLibrary.does_asset_exist(MENU_MAP):
        level_editor.load_level(MENU_MAP)
    else:
        level_editor.new_level(MENU_MAP)
    set_game_mode('/Script/MojuloKernel.MojuloMenuGameMode')
    level_editor.save_current_level()
    unreal.log("[mojulo] game '" + str(game.get('title')) + "' -> " + str(len(game.get('levels') or [])) + ' levels + menu')


def verify():
    """Machine-gate assertions; writes mojulo-gate.json at the project root.
    World scope mirrors Unity's Verify(); game scope prefixes per-level
    checks '<ref>:' and adds menu_scene + kernel_wired (the Unity pair)."""
    checks = []
    failures = []

    def check(label, ok, detail=None):
        checks.append(('PASS ' if ok else 'FAIL ') + label + ((' — ' + detail) if detail else ''))
        if not ok:
            failures.append(label)

    def kernel_class_name():
        ws = world_settings_actor()
        cls = ws.get_editor_property('default_game_mode') if ws is not None else None
        return cls.get_name() if cls is not None else ''

    def verify_level(score, map_path, prefix, landmark_done):
        level_editor = subsystem(unreal.LevelEditorSubsystem)
        exists = unreal.EditorAssetLibrary.does_asset_exist(map_path)
        check(prefix + 'scene_exists', exists, map_path)
        if not exists:
            return landmark_done
        level_editor.load_level(map_path)
        actors = all_actors()
        labels = [a.get_actor_label() for a in actors]
        helpers = [l for l in labels if l.startswith('Mojulo') or l.startswith('PlayerStart')]
        check(prefix + 'world_instance', len(labels) > len(helpers), str(len(labels)) + ' actors')
        n = len([l for l in labels if l.startswith('MojuloCollider_')])
        want = len(score.get('colliders') or [])
        check(prefix + 'collider_count', n == want, str(n) + ' vs ' + str(want))
        start = find_actor_by_label('MojuloPlayerStart')
        want_spawn = P(score.get('spawn') or [0.0, 0.0, 0.0])
        want_spawn.z += START_LIFT_CM   # the importer lifts the start off the feet; expect the same
        spawn_ok = start is not None and (start.get_actor_location() - want_spawn).length() < 1.0
        check(prefix + 'spawn_marker', spawn_ok, str(start.get_actor_location()) if start else 'missing')
        check(prefix + 'ground_plane', find_actor_by_label('MojuloGround') is not None)
        want_lights = len(score.get('lights') or [])
        if want_lights:
            have_lights = count_local_lights()
            check(prefix + 'lights_carried', have_lights >= want_lights, str(have_lights) + ' local lights vs ' + str(want_lights) + ' in the score')
        if prefix:
            check(prefix + 'kernel_wired', 'MojuloGameMode' in kernel_class_name(), kernel_class_name() or 'no override')

        if not landmark_done:
            # Prefer an off-axis landmark: y is the negated axis, so only a
            # nonzero-y entity can catch a mirrored world — a y=0 landmark
            # pins x/z/scale but leaves the mirror question open. Only
            # FIRST-claimant entities qualify: the GLB gives a figure's
            # wrapper node to the first entity sharing it (later claimants
            # have no node of their own — pinned at the U3 slice, where the
            # highest-|y| z-unit pointed at another unit's wrapper).
            candidates = []
            claimed = set()
            for e in score.get('entities') or []:
                if not e.get('translation'):
                    continue
                fig = e.get('figure')
                if fig:
                    if fig in claimed:
                        continue
                    claimed.add(fig)
                candidates.append(e)
            candidates.sort(key=lambda e: -abs(e['translation'][1]))
            for e in candidates:
                node = find_entity_actor(score, e)
                if node is None:
                    continue
                want = P(e['translation'])
                d = (node.get_actor_location() - want).length()
                check('frame_landmark:' + e['id'], d < 50.0, str(node.get_actor_location()) + ' vs ' + str(want))
                return True
        return landmark_done

    def verify_materials():
        unlit_ok, unlit_total = 0, 0
        for p in unreal.EditorAssetLibrary.list_assets(CONTENT_ROOT, recursive=True, include_folder=False):
            a = unreal.EditorAssetLibrary.load_asset(p)
            if isinstance(a, unreal.StaticMesh):
                for slot in a.get_editor_property('static_materials'):
                    unlit_total += 1
                    mi = slot.get_editor_property('material_interface')
                    if is_mojulo_material(mi) or is_emissive_slot(mi) or is_ink_slot(mi):
                        unlit_ok += 1
        check('materials_unlit', unlit_total > 0 and unlit_ok == unlit_total, str(unlit_ok) + ' of ' + str(unlit_total) + ' static-mesh slots')

    def verify_rim(scores):
        """shader-look phase 4: every rim figure any score declares must hold at
        least one slot on its MI_MojuloRim_<figure> instance. No score.look
        anywhere => no check, byte-identical gate file."""
        tokens = {}
        for score in scores:
            tokens.update(rim_tokens(score))
        if not tokens:
            return
        have = set()
        slots = 0
        for p in unreal.EditorAssetLibrary.list_assets(CONTENT_ROOT, recursive=True, include_folder=False):
            a = unreal.EditorAssetLibrary.load_asset(p)
            if isinstance(a, unreal.StaticMesh):
                mats = [s.get_editor_property('material_interface') for s in a.get_editor_property('static_materials')]
            elif isinstance(a, unreal.SkeletalMesh):
                try:
                    mats = [s.get_editor_property('material_interface') for s in a.get_editor_property('materials')]
                except Exception:  # noqa: BLE001 — UNPINNED property shape
                    mats = []
            else:
                continue
            for mi in mats:
                if mi is not None and mi.get_name().startswith('MI_MojuloRim_'):
                    slots += 1
                    have.add(mi.get_name()[len('MI_MojuloRim_'):].lower())
        missing = sorted(set(tokens) - have)
        check('rim_applied', slots > 0 and not missing, str(slots) + ' rim slots' + ((' — missing: ' + ', '.join(missing)) if missing else ''))

    def verify_clips(scored):
        """U2: every locomotion clip the scores name must exist as an
        imported LevelSequence (Interchange's representation of the GLB's
        rigid-hierarchy animations — pinned at U2) with live bindings, or,
        for a skinned figure, as an AnimSequence (find_clip's name).
        Per level: 'scored' is [(score, content_dir)] and each level's clips
        are looked up in ITS OWN asset subtree — a multi-level pack holds
        one copy of a shared figure's sequences per level, and a pack-wide
        name lookup would silently vouch for one level's copy on behalf of
        all (the kernel scopes its index the same way). No locomotion
        entities => no check, byte-identical gate file."""
        missing = []
        bound, checked = 0, 0
        for score, content_dir in scored:
            clips = []
            for e in score.get('entities') or []:
                for c in (e.get('locomotion') or {}).values():
                    if c:   # a null clip (no walk cycle bound) must not reach the sort
                        clips.append(c)
            if not clips:
                continue
            names = {}
            for p in unreal.EditorAssetLibrary.list_assets(content_dir, recursive=True, include_folder=False):
                names[p.split('/')[-1].split('.')[0]] = p
            anims = assets_of(content_dir, unreal.AnimSequence)
            for clip in sorted(set(clips)):
                want = clean_label(clip)
                p = names.get(want) or find_clip(anims, clip)
                if p is None:
                    missing.append(want)
                    continue
                checked += 1
                seq = unreal.EditorAssetLibrary.load_asset(p)
                if isinstance(seq, unreal.AnimSequence):
                    bound += 1
                elif isinstance(seq, unreal.LevelSequence) and len(list(unreal.MovieSceneSequenceExtensions.get_bindings(seq))) > 0:
                    bound += 1
        if not missing and checked == 0:
            return
        ok = not missing and checked > 0 and bound == checked
        detail = str(bound) + ' of ' + str(checked) + ' locomotion clips bind'
        if missing:
            detail += ' — missing: ' + ', '.join(missing[:5])
        check('clips_bound', ok, detail)

    def verify_figures(glbs):
        """C1: each skinned figure a level's GLB declares imported as a
        SkeletalMesh in that level's subtree, its bones at least the skin's
        joints (when the editor reads them); in a world pack, the figure
        plays its FIGURE_CLIPS clip. No skinned figure => no check,
        byte-identical gate file."""
        for glb_path, content_dir, prefix in glbs:
            skins = glb_skins(glb_path)
            if not skins:
                continue
            meshes = assets_of(content_dir, unreal.SkeletalMesh)
            for figure, joints in skins:
                want = clean_label(figure)
                hits = sorted(k for k in meshes if k.startswith(want))
                if not hits:
                    check(prefix + 'figure_skinned:' + figure, False, 'no SkeletalMesh named after it under ' + content_dir)
                    continue
                mesh = unreal.EditorAssetLibrary.load_asset(meshes[hits[0]])
                bones = skeletal_bone_count(mesh)
                check(prefix + 'figure_skinned:' + figure, bones is None or bones >= joints,
                      hits[0] + ' — ' + ('bones unread' if bones is None else str(bones) + ' bones vs ' + str(joints) + ' joints'))
        for figure, clip in sorted(FIGURE_CLIPS.items()):
            playing = []
            for comp in figure_skeletal(figure):
                try:
                    anim = comp.get_editor_property('animation_data').get_editor_property('anim_to_play')
                except Exception:  # noqa: BLE001 — UNPINNED property shape
                    anim = None
                if anim is not None:
                    playing.append(anim.get_name())
            want = clean_label(clip)
            check('figure_clip:' + figure, any(want in clean_label(n) for n in playing), ', '.join(playing) or 'no clip set')

    def verify_retarget(glbs):
        """C2: each humanoid figure's IK Rig with every chain its VRM bones make; its retargeter, when the project holds
        a mannequin rig. No humanoid figure => no check, byte-identical gate file."""
        for glb_path, content_dir, prefix in glbs:
            for figure, vrm in sorted(glb_humanoids(glb_path).items()):
                want, expected = clean_label(figure), [c for c, _, _ in retarget_chains(vrm)]
                path = content_dir + '/Retarget/IK_Mojulo_' + want
                rig = unreal.EditorAssetLibrary.load_asset(path) if unreal.EditorAssetLibrary.does_asset_exist(path) else None
                have = []
                if rig is not None:
                    try:
                        have = [str(c.get_editor_property('chain_name')) for c in unreal.IKRigController.get_controller(rig).get_retarget_chains()]
                    except Exception:  # noqa: BLE001 — UNPINNED
                        have = None
                missing = [c for c in expected if have is not None and c not in have]
                check(prefix + 'retarget_rig:' + figure, rig is not None and not missing,
                      'missing ' + path if rig is None else ('chains unread' if have is None else str(len(have)) + ' chains' + (' — missing: ' + ', '.join(missing) if missing else '')))
                if source_ik_rig() is not None:
                    rtg = content_dir + '/Retarget/RTG_Mojulo_' + want
                    check(prefix + 'retargeter:' + figure, unreal.EditorAssetLibrary.does_asset_exist(rtg), rtg)

    try:
        game = game_manifest()
        landmarked = False
        if game is None:
            score = read_json(os.path.join(PACK, 'score.json'))
            landmarked = verify_level(score, MAP_PATH, '', False)
            if (score.get('entities') or []) and not landmarked:
                check('frame_landmark', False, 'no entity node found by figure or entity:<id> label')
            verify_materials()
            verify_rim([score])
            verify_clips([(score, CONTENT_ROOT)])
            verify_figures([(os.path.join(PACK, 'model.glb'), CONTENT_ROOT, '')])
            verify_retarget([(os.path.join(PACK, 'model.glb'), CONTENT_ROOT, '')])
        else:
            levels = game.get('levels') or []
            any_entities = False
            scored = []
            for spec in levels:
                ref = spec['ref']
                score = read_json(os.path.join(PACK, 'levels', ref, 'score.json'))
                scored.append((score, CONTENT_ROOT + '/Levels/' + ref))
                any_entities = any_entities or bool(score.get('entities'))
                landmarked = verify_level(score, CONTENT_ROOT + '/Maps/' + ref, ref + ':', landmarked)
            if any_entities and not landmarked:
                check('frame_landmark', False, 'no entity node found in any level by figure or entity:<id> label')
            menu_ok = unreal.EditorAssetLibrary.does_asset_exist(MENU_MAP)
            check('menu_scene', menu_ok, MENU_MAP)
            if menu_ok:
                subsystem(unreal.LevelEditorSubsystem).load_level(MENU_MAP)
                check('menu:kernel_wired', 'MojuloMenuGameMode' in kernel_class_name(), kernel_class_name() or 'no override')
            verify_materials()
            verify_rim([s for s, _ in scored])
            verify_clips(scored)
            level_glbs = [(os.path.join(PACK, 'levels', spec['ref'], 'model.glb'), CONTENT_ROOT + '/Levels/' + spec['ref'], spec['ref'] + ':') for spec in levels]
            verify_figures(level_glbs)
            verify_retarget(level_glbs)
    except Exception as e:  # noqa: BLE001 — the gate must always write its file
        check('verify_ran', False, str(e))

    ok = len(failures) == 0
    gate_path = os.path.join(unreal.Paths.project_dir(), 'mojulo-gate.json')
    with open(gate_path, 'w') as f:
        json.dump({'ok': ok, 'checks': checks}, f, indent=2)
    unreal.log('[mojulo] gate ' + ('PASS' if ok else 'FAIL') + ' (' + str(len(checks)) + ' checks)')
    if not ok:
        # A non-zero editor exit for the driver; the gate file is authoritative.
        raise RuntimeError('mojulo gate FAILED: ' + ', '.join(failures))


MODE = os.environ.get('MOJULO_MODE', 'run')
if MODE == 'verify':
    verify()
else:
    build()
`;
}

/* --------------------------------------------------------------- guide --- */

const GUIDE_PREAMBLE = (title, recipeNote) => `${guidePreamble({ title, heading: 'Unreal import guide', recipeNote, target: UNREAL_EDITOR_TARGET })}
## ① Create the project

T001 Epic Games Launcher > Unreal Engine > Library > Launch(your installed 5.x) > Games > Third Person > Blueprint > Create
T001.01 any 5.4+ editor works; proven against UE 5.8.0
T001.02 macOS prerequisite: full Xcode must be installed and opened once (license accepted) — the editor cannot compile Metal shaders without it and any rendered run exits with "Xcode Not Found"
T001.03 macOS, Xcode 26+: also run \`xcodebuild -downloadComponent MetalToolchain\` (Xcode ships without the Metal compiler; the editor dialogs "missing Metal Toolchain" until it is downloaded)

## ② Enable Python

T002 Edit > Plugins > search \`Python Editor Script Plugin\` > Enabled > Restart Now
T002.01 while there, confirm \`Interchange glTF\`(glTF importer) shows Enabled — it is on by default in 5.3+
`;

const GUIDE_COPY_WORLD = `
## ③ Copy the pack in

T003 Finder > copy this whole folder into the project root as \`MojuloPack\`, beside the \`.uproject\` (final path: \`<Project>/MojuloPack\`) — NOT into \`Content/\`; the importer writes the imported assets to \`Content/MojuloPack\` itself
`;

const GUIDE_COPY_GAME = `
## ③ Copy the pack + compile the kernel

T003 Finder > copy this whole folder into the project root as \`MojuloPack\`, beside the \`.uproject\` (final path: \`<Project>/MojuloPack\`) — NOT into \`Content/\`
T003.01 Finder > copy \`MojuloPack/MojuloKernel\` to \`<Project>/Plugins/MojuloKernel\` (create the \`Plugins\` folder if absent)
T003.02 reopen the project — Unreal asks to rebuild the MojuloKernel module: Yes (compiles once; needs Xcode on macOS / Visual Studio on Windows)
`;

const GUIDE_LEDGER = guideLedger;

/** World-pack guide (U0 shape): the stock Third Person character is the
 * walker — the importer places the PlayerStart; no kernel. */
function importGuideWorld({ title, refName, score, ledger, lit = false, figure = null }) {
  const eyes = [
    ...(figure ? [`the figure \`${figure.name}\` stands skinned (one mesh, its skeleton) and loops its \`${figure.clip}\` clip`] : []),
    lit ? 'the world mesh is LIT by MojuloSun + the sky atmosphere through M_MojuloLit — sun patches through the panes, a blue sky in the windows, no "Preview" stamp on the shadows (reference look: blender-bake.mjs --render); a score `sky` preset sets the rig (night: a dim cool moon, a dark atmosphere, height fog, the lamp lights carrying the scene) and the fallback ground is a visible matte plane, never a black void'
      : 'the world mesh renders in its baked vertex colours (reference look: the mojulo web build)',
    'you can walk the level as the template character — the floor holds (the promoted ground plane) and the obstacle colliders block',
    ...(score.soundtrack ? [`the soundtrack (\`${score.soundtrack}\`) is playing on loop`] : []),
    `scale reads right at a ${fmt(score.eye ?? 1.7)} m eye height — doors, steps, cover`,
  ].map((line, i) => `#${String(3 + i).padStart(3, '0')} ${line}`);
  return `${GUIDE_PREAMBLE(title, `\`recipe/${refName}.json\``)}${GUIDE_COPY_WORLD}
## ④ Run the importer

T004 Window > Output Log > command bar dropdown(currently \`Cmd\`) > \`Python\` > run: \`py MojuloPack/import_mojulo.py\`
T004.01 Output Log — confirm one line: \`[mojulo] level '${title}' -> /Game/MojuloPack/Maps/mojulo-level\`

## ⑤ Open and play — the eyes gate

T005 Content Browser > Content > MojuloPack > Maps > \`mojulo-level\` — open
T006 Toolbar > [Play] — judge with your own eyes:
${eyes.join('\n')}

${greyboxSection(score.posture === 'greybox')}## What travelled, what didn't

${GUIDE_LEDGER(ledger)}
`;
}

/** Game-pack guide (U1 shape): menu-first eyes gate, the kernel walker. */
// the screen it is made for, in Unreal: play-in-editor at its frame, and a mobile build at its orientation
const unrealScreen = (S) => {
  const k = Math.min(1280 / S.aspect[0], 800 / S.aspect[1]), w = Math.round(S.aspect[0] * k), h = Math.round(S.aspect[1] * k);
  return `T007 Edit > Editor Preferences > Level Editor > Play > Game Viewport Settings > New Viewport Resolution > ${w} × ${h}
T007.01 Toolbar > [Play] dropdown > \`New Editor Window (PIE)\` — the level plays in the frame
T007.02 Edit > Project Settings > Platforms > iOS / Android > Orientation > ${S.orientation === 'portrait' ? 'portrait only' : 'landscape only'}`;
};

function importGuideGame({ title, levels, ledger, posture, lit = false, screen = null }) {
  const eyes = [
    'the menu lists every level; gated levels show [locked] until their gate level is [done]',
    'Enter starts the selected level — the kernel walker spawns at the score spawn (WASD + mouse, Space jumps, M returns to the menu)',
    lit ? 'each level is LIT by MojuloSun + the sky atmosphere through M_MojuloLit (reference look: blender-bake.mjs --render); a level whose score names a `sky` preset gets that rig (night: moon, dark atmosphere, fog, lamp lights) and a visible matte fallback ground'
      : 'each level renders in its baked vertex colours (reference look: the mojulo web build)',
    'entities with travel clips are ANIMATED — ambient figures loop their idle; when the score carries player locomotion, the suit is visible in third person and its walk cycle plays while you move',
    'reaching an exit shows LEVEL COMPLETE and returns to the menu with the level marked [done]',
    'level soundtracks and the menu bed play on loop where the game carries music',
  ].map((line, i) => `#${String(3 + i).padStart(3, '0')} ${line}`);
  return `${GUIDE_PREAMBLE(title, '`recipe/game.json` + `recipe/<level>.json`')}${GUIDE_COPY_GAME}
## ④ Run the importer

T004 Window > Output Log > command bar dropdown(currently \`Cmd\`) > \`Python\` > run: \`py MojuloPack/import_mojulo.py\`
T004.01 Output Log — confirm the last line: \`[mojulo] game '${title}' -> ${levels.length} levels + menu\`

## ⑤ Open and play — the eyes gate

T005 Content Browser > Content > MojuloPack > Maps > \`mojulo-menu\` — open
T006 Toolbar > [Play] — menu first, then play a level start to finish:
${eyes.join('\n')}

${screenSection(screen, unrealScreen)}## Optional project character

Set \`MojuloPawnClass\` in your project's \`Config/DefaultGame.ini\` under
\`[/Script/MojuloKernel.MojuloGameMode]\` to your pawn's generated class path
(for a Blueprint, its path ends in \`_C\`). Restart the play session after editing.
The pawn must be concrete and spawnable; invalid paths retain the default pawn.
The kernel logs \`pawn_class\` and \`kernel_walker\` when the player is possessed.

The character uses the imported PlayerStart and keeps its own input, dimensions,
movement and camera. Its collision body drives pickups, hazards and exits.
Ambient imported figures still animate; the imported player figure is hidden.
Without this setting, the existing Mojulo walker and suit-follow behavior remain.
A character's controls, animation assets and collision fit must be tested in the
receiving project; selecting a class does not establish traversal compatibility.

For project-owned persistent levels, set \`MapRoot=/Game/MyProject/Maps\` in the
\`[Mojulo]\` section of \`Config/DefaultGame.ini\`. Name each wrapper map after
its level ref, and load the corresponding generated map as an always-loaded sublevel.
The menu opens the wrapper when it exists, otherwise the generated map.

\`-MojuloAutoWalk -MojuloShot=10\` sends held W input to a foreign pawn's
player controller and logs actual horizontal displacement at the shot. Its project
input mapping must bind W; this is a movement probe, not a traversal-completion gate.
Add \`-MojuloAutoJump=<seconds>\` to tap Space at that time (the project must bind it):
the log names where the jump began and, at the shot, where the pawn stands, so a
gap the recipe narrowed can be checked by the pawn's height at the shot. The score's
\`yaw\` (from the recipe's \`walk.yaw\`) turns the PlayerStart so held W heads where
the level intends.

${greyboxSection(posture === 'greybox')}## What travelled, what didn't

${GUIDE_LEDGER(ledger)}
`;
}

/* ------------------------------------------------------------ emitters --- */

// The skinned figures a pack carries (unreal-pack.js: a rigged layered figure ships as one skinned mesh): what
// Interchange makes of them and what plays their clips. No skinned figure ⇒ no section, byte-identical.
const SKINNED_IMPORT = 'Interchange imports it as a SkeletalMesh on its own Skeleton and each clip as an AnimSequence';
// the retarget seam a humanoid figure's import makes (import_mojulo.py retarget_figures), said once for both scopes
const RETARGET_NOTE = (folder) => `The importer makes \`IK_Mojulo_<figure>\` under \`${folder}/Retarget\`: an IK Rig over the skeleton, its root the
hips and one chain per limb named as Unreal's mannequin rig names its chains. When the project holds the mannequin's rig
(the Third Person template's \`IK_Mannequin\`, or the one \`MOJULO_SOURCE_IK_RIG\` names) it makes \`RTG_Mojulo_<figure>\`
too, an IK Retargeter from it to the figure, so the project's animation (motion matching, any mannequin clip) plays on
the figure. A re-import rebuilds both in place, so what the project points at them survives a re-mint.
`;
const charactersSection = ({ figure = null, levels = [] }) => {
  if (figure) {
    return `## Characters

\`${figure.name}\` ships skinned: one mesh on a ${figure.joints}-joint skeleton and its clips (${figure.clips.map((c) => `\`${c}\``).join(', ')}).
${SKINNED_IMPORT}; the
importer loops \`${figure.clip}\` on it (single node), since a world pack has no kernel.
${figure.humanoid ? `Its skeleton is the engine skeleton: the joints carry VRM names (\`${figure.humanoid.slice(0, 3).join('`, `')}\`, …) and rest in
the T-pose.

${RETARGET_NOTE('Content/MojuloPack')}` : ''}
`;
  }
  const skinned = levels.filter((l) => l.skinned?.length);
  if (!skinned.length) return '';
  const humanoid = skinned.some((l) => l.humanoid?.length);
  return `## Characters

A level's rigged figure ships skinned (one mesh, its skeleton, its clips).
${SKINNED_IMPORT}; the
kernel plays them on the mesh: the player's suit swaps idle and walk as it moves, the others loop their idle.

${skinned.map((l) => `- \`${l.ref}\`: ${l.skinned.map((n) => `\`${n}\`${l.humanoid?.includes(n) ? ' (humanoid)' : ''}`).join(', ')}`).join('\n')}
${humanoid ? `
A humanoid figure's skeleton is the engine skeleton: VRM-named joints at the T-pose rest. ${RETARGET_NOTE('Content/MojuloPack/Levels/<level>')}` : ''}
`;
};

const readmeProvenance = ({ ref, manifestHash, remint }) => `## Provenance

- source ref: \`${ref}\`
- manifest sha256/16: \`${manifestHash}\`
- unreal leg: v${UNREAL_LEG_VERSION}, target ${UNREAL_EDITOR_TARGET}, importer Interchange glTF
- units: 1 mojulo unit = 1 meter → UE centimeters (×100 in the importer); frame z-up → z-up left-handed, P(v) = (x·100, −y·100, z·100), gate-pinned, implemented in \`import_mojulo.py\` and \`MojuloScore.cpp\` (must stay identical)
- re-mint: \`${remint ?? `node scripts/export-unreal.mjs --ref ${ref}`}\` (from mojulo's \`control/\`)
`;

/**
 * emitUnrealProject — a standalone world pack (U0): importer + guide +
 * README. The assembler (unreal-pack.js) ships model.glb, score.json,
 * recipe/, audio/, portability.json. No kernel — the stock Third Person
 * character is the walker.
 */
export function emitUnrealProject({ ref, score, manifestHash, audioFile = null, remint = null, lit = false, figure = null }) {
  const title = score.title ?? ref;
  const ledger = unrealLevelLedger(score);
  const files = [
    { file: 'import_mojulo.py', text: importerPy({ lit, figureClips: figure ? { [figure.name]: `${figure.name}:${figure.clip}` } : {} }) },
    { file: 'IMPORT-GUIDE.md', text: importGuideWorld({ title, refName: ref, score, ledger, lit, figure }) },
    {
      file: 'README.md',
      text: `# ${title} — Unreal handoff

A generated Unreal pack (mojulo \`export-unreal\`, leg v${UNREAL_LEG_VERSION}). The world's truth
lives in \`recipe/\` — this whole folder is a derived artifact; re-mint it from
the recipe rather than hand-editing. The pack is DATA (\`score.json\`, the GLB${audioFile ? ', audio' : ''})
realized by \`import_mojulo.py\` inside a stock ${UNREAL_EDITOR_TARGET} Third Person
project — follow \`IMPORT-GUIDE.md\`; the web build is the reference performance.
The mechanics vocabulary is data-only in a world pack (the MojuloKernel plugin
ships with game packs).

${readmeProvenance({ ref, manifestHash, remint })}
${charactersSection({ figure })}${greyboxSection(score.posture === 'greybox')}## What travelled, what didn't

${ledgerLines(ledger)}
`,
    },
  ];
  return { files, ledger };
}

/**
 * emitUnrealGame — a game pack (U1): importer + the MojuloKernel C++ plugin
 * + guide + README. The assembler ships game.json, per-level
 * levels/<ref>/{model.glb,score.json}, audio beds, recipes, portability.
 */
export function emitUnrealGame({ ref, manifest, levels, manifestHash, remint = null, lit = false }) {
  const title = manifest.title ?? ref;
  const perLevel = {};
  for (const lv of levels) perLevel[lv.ref] = unrealLevelLedger(lv.score, { gameMode: true });
  const ledger = {
    ...(manifest.posture === 'greybox' || levels.some((l) => l.score.posture === 'greybox')
      ? { greybox_declared: { note: 'operator-declared greybox handoff — surfacing losses are deferred, not defects' } } : {}),
    skipped_store: { note: "store slices beyond completion (character stats, inventory persistence) do not travel — the kernel keeps completion only" },
    skipped_shell: { note: "the web game shell (setup screens, difficulty, HUD theme) does not travel; the kernel menu is the game's front door" },
    gate_approximated: { note: 'level gates travel as completed-ref checks in the kernel menu — richer gate logic does not' },
    levels: perLevel,
  };
  const files = [
    { file: 'import_mojulo.py', text: importerPy({ lit }) },
    ...emitUnrealKernel(),
    { file: 'IMPORT-GUIDE.md', text: importGuideGame({ title, levels, ledger, posture: manifest.posture, lit, screen: manifest.screen ?? null }) },
    {
      file: 'README.md',
      text: `# ${title} — Unreal handoff (game)

A generated Unreal game pack (mojulo \`export-unreal\`, leg v${UNREAL_LEG_VERSION}). The game's
truth lives in \`recipe/\` — this whole folder is a derived artifact; re-mint it
from the recipes rather than hand-editing. The pack is DATA (\`game.json\`,
per-level \`levels/<ref>/\` scores + GLBs, audio beds) realized by
\`import_mojulo.py\`, and PERFORMED by the \`MojuloKernel/\` C++ plugin — copied
to \`<Project>/Plugins/\` and compiled by the project itself (deterministic
source, no prebuilt binaries; the kernel-language decision of U1). Follow
\`IMPORT-GUIDE.md\`; the web build is the reference performance.

The kernel performs the closed mechanics vocabulary (reach-exit / collect /
hazard-damage / fail-on-death / survive), the first-person walker, the canvas
HUD and menu, music beds, and completion progression
(\`Saved/mojulo.completed\`). Combat AI, weapon logic, and the store shell stay
home — re-orchestrate in-engine.

${readmeProvenance({ ref, manifestHash, remint: remint ?? `node scripts/export-unreal.mjs --ref ${ref}` })}
${charactersSection({ levels })}${greyboxSection(manifest.posture === 'greybox')}## What travelled, what didn't

${ledgerLines(ledger)}

### Per level

${levels.map((lv) => `**${lv.score.title ?? lv.ref}** (\`${lv.ref}\`)\n${ledgerLines(perLevel[lv.ref])}`).join('\n\n')}
`,
    },
  ];
  return { files, ledger };
}
