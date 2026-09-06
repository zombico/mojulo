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
import { fmt, ledgerLines, greyboxSection, guideLedger, guidePreamble } from './operator-guide.js';
import { emitUnrealKernel } from './unreal-kernel.js';

export const UNREAL_LEG_VERSION = '0.4.1';
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

function importerPy({ lit = false } = {}) {
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
import os

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
M = 100.0  # 1 mojulo unit = 1 meter; UE works in centimeters
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


def unlit_instance(master, tex, cache):
    key = tex.get_path_name() if tex is not None else '__white__'
    if key in cache:
        return cache[key]
    name = ('MI_MojuloLit_' if LIT else 'MI_Mojulo_') + (tex.get_name() if tex is not None else 'White')
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


def apply_unlit_materials():
    """Swap every imported mesh slot onto the mojulo look — unlit vertex colour,
    or the lit twin when LIT. Idempotent: slots already on a Mojulo material
    are left alone."""
    master = ensure_master()
    cache = {}
    swapped = 0
    for path in unreal.EditorAssetLibrary.list_assets(CONTENT_ROOT, recursive=True, include_folder=False):
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if isinstance(asset, unreal.StaticMesh):
            for i, slot in enumerate(asset.get_editor_property('static_materials')):
                cur = slot.get_editor_property('material_interface')
                if is_mojulo_material(cur):
                    continue
                asset.set_material(i, unlit_instance(master, first_texture(cur), cache))
                swapped += 1
        elif isinstance(asset, unreal.SkeletalMesh):
            try:  # SkeletalMesh has no set_material; rebuild the array in place
                slots = list(asset.get_editor_property('materials'))
                changed = False
                for i, slot in enumerate(slots):
                    cur = slot.get_editor_property('material_interface')
                    if is_mojulo_material(cur):
                        continue
                    slot.set_editor_property('material_interface', unlit_instance(master, first_texture(cur), cache))
                    slots[i] = slot
                    changed = True
                    swapped += 1
                if changed:
                    asset.set_editor_property('materials', slots)
            except Exception as e:  # noqa: BLE001 — UNPINNED property shape
                unreal.log_warning('[mojulo] skeletal material swap failed on ' + path + ': ' + str(e))
    unreal.EditorAssetLibrary.save_directory(CONTENT_ROOT, only_if_is_dirty=True)
    unreal.log('[mojulo] ' + ('lit' if LIT else 'unlit') + ' vertex-colour materials on ' + str(swapped) + ' slots')


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
    apply_unlit_materials()

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

    start = spawn(unreal.PlayerStart, P(spawn_v), 'MojuloPlayerStart')
    start.set_actor_location(P(spawn_v), False, False)

    spawn(unreal.DirectionalLight, unreal.Vector(0, 0, 500.0), 'MojuloSun').set_actor_rotation(unreal.Rotator(-50.0, -30.0, 0.0), False)
    spawn(unreal.SkyLight, unreal.Vector(0, 0, 500.0), 'MojuloSkyLight')

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
        spawn_ok = start is not None and (start.get_actor_location() - want_spawn).length() < 1.0
        check(prefix + 'spawn_marker', spawn_ok, str(start.get_actor_location()) if start else 'missing')
        check(prefix + 'ground_plane', find_actor_by_label('MojuloGround') is not None)
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
                    if is_mojulo_material(slot.get_editor_property('material_interface')):
                        unlit_ok += 1
        check('materials_unlit', unlit_total > 0 and unlit_ok == unlit_total, str(unlit_ok) + ' of ' + str(unlit_total) + ' static-mesh slots')

    def verify_clips(scored):
        """U2: every locomotion clip the scores name must exist as an
        imported LevelSequence (Interchange's representation of the GLB's
        rigid-hierarchy animations — pinned at U2) with live bindings.
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
                    clips.append(c)
            if not clips:
                continue
            names = {}
            for p in unreal.EditorAssetLibrary.list_assets(content_dir, recursive=True, include_folder=False):
                names[p.split('/')[-1].split('.')[0]] = p
            for clip in sorted(set(clips)):
                want = clean_label(clip)
                p = names.get(want)
                if p is None:
                    missing.append(want)
                    continue
                checked += 1
                seq = unreal.EditorAssetLibrary.load_asset(p)
                if isinstance(seq, unreal.LevelSequence) and len(list(unreal.MovieSceneSequenceExtensions.get_bindings(seq))) > 0:
                    bound += 1
        if not missing and checked == 0:
            return
        ok = not missing and checked > 0 and bound == checked
        detail = str(bound) + ' of ' + str(checked) + ' locomotion sequences bind'
        if missing:
            detail += ' — missing: ' + ', '.join(missing[:5])
        check('clips_bound', ok, detail)

    try:
        game = game_manifest()
        landmarked = False
        if game is None:
            score = read_json(os.path.join(PACK, 'score.json'))
            landmarked = verify_level(score, MAP_PATH, '', False)
            if (score.get('entities') or []) and not landmarked:
                check('frame_landmark', False, 'no entity node found by figure or entity:<id> label')
            verify_materials()
            verify_clips([(score, CONTENT_ROOT)])
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
            verify_clips(scored)
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
function importGuideWorld({ title, refName, score, ledger, lit = false }) {
  const eyes = [
    'the world mesh renders in its baked vertex colours (reference look: the mojulo web build)',
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
function importGuideGame({ title, levels, ledger, posture, lit = false }) {
  const eyes = [
    'the menu lists every level; gated levels show [locked] until their gate level is [done]',
    'Enter starts the selected level — the kernel walker spawns at the score spawn (WASD + mouse, Space jumps, M returns to the menu)',
    'each level renders in its baked vertex colours (reference look: the mojulo web build)',
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

${greyboxSection(posture === 'greybox')}## What travelled, what didn't

${GUIDE_LEDGER(ledger)}
`;
}

/* ------------------------------------------------------------ emitters --- */

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
export function emitUnrealProject({ ref, score, manifestHash, audioFile = null, remint = null, lit = false }) {
  const title = score.title ?? ref;
  const ledger = unrealLevelLedger(score);
  const files = [
    { file: 'import_mojulo.py', text: importerPy({ lit }) },
    { file: 'IMPORT-GUIDE.md', text: importGuideWorld({ title, refName: ref, score, ledger }) },
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
${greyboxSection(score.posture === 'greybox')}## What travelled, what didn't

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
    { file: 'IMPORT-GUIDE.md', text: importGuideGame({ title, levels, ledger, posture: manifest.posture }) },
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
${greyboxSection(manifest.posture === 'greybox')}## What travelled, what didn't

${ledgerLines(ledger)}

### Per level

${levels.map((lv) => `**${lv.score.title ?? lv.ref}** (\`${lv.ref}\`)\n${ledgerLines(perLevel[lv.ref])}`).join('\n\n')}
`,
    },
  ];
  return { files, ledger };
}
