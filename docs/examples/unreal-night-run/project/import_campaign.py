"""Import the campaign while keeping project maps outside the generated pack."""
import json, os, runpy
import unreal
root = unreal.Paths.project_dir()
if not os.environ.get('NIGHTRUN_SKIP_IMPORT'):
    runpy.run_path(os.path.join(root, 'MojuloPack', 'import_mojulo.py'), run_name='__main__')
mat = unreal.EditorAssetLibrary.load_asset('/Game/MojuloPack/Materials/M_MojuloLit')
if mat is not None:
    mat.set_editor_property('two_sided', True)
    unreal.MaterialEditingLibrary.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
editor = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
sample = unreal.get_default_object(unreal.EditorAssetLibrary.load_blueprint_class('/Game/Blueprints/GM_Sandbox'))
asset = '/Game/NightRun/BP_NightRunGameMode'
bp = unreal.EditorAssetLibrary.load_asset(asset)
cls = unreal.EditorAssetLibrary.load_blueprint_class(asset)
obj = unreal.get_default_object(cls)
for prop in ['default_pawn_class', 'player_controller_class', 'player_state_class', 'game_state_class']:
    obj.set_editor_property(prop, sample.get_editor_property(prop))
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
unreal.EditorAssetLibrary.save_loaded_asset(bp)
with open(os.path.join(root, 'MojuloPack', 'game.json')) as source:
    game = json.load(source)
report = []
for ref in ['mojulo-menu'] + [l['ref'] for l in game['levels']]:
    wrapper = '/Game/NightRun/Maps/' + ref
    imported = '/Game/MojuloPack/Maps/' + ref
    # Interior shells need triangle collision; convex hulls cannot represent rooms.
    if ref != 'mojulo-menu':
        assert levels.load_level(imported)
        seen = set()
        for actor in actors.get_all_level_actors():
            if not isinstance(actor, unreal.StaticMeshActor):
                continue
            comp = actor.static_mesh_component
            mesh = comp.static_mesh
            if mesh is None or not mesh.get_path_name().startswith('/Game/MojuloPack/'):
                continue
            comp.set_collision_profile_name('BlockAll')
            comp.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
            if mesh.get_path_name() not in seen:
                body = mesh.get_editor_property('body_setup')
                assert body is not None, 'Imported static mesh lacks BodySetup'
                body.set_editor_property('collision_trace_flag', unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
                body.set_editor_property('double_sided_geometry', True)
                unreal.EditorAssetLibrary.save_loaded_asset(mesh)
                seen.add(mesh.get_path_name())
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    if unreal.EditorAssetLibrary.does_asset_exist(wrapper):
        assert levels.load_level(wrapper)
    else:
        assert levels.new_level(wrapper)
    world = editor.get_editor_world()
    if unreal.GameplayStatics.get_streaming_level(world, imported) is None:
        assert unreal.EditorLevelUtils.add_level_to_world(world, imported, unreal.LevelStreamingAlwaysLoaded)
    assert levels.set_current_level_by_name(ref)
    assert levels.get_current_level() == world.get_world_settings().get_level(), 'Expected persistent level'
    mode = unreal.load_class(None, '/Script/MojuloKernel.MojuloMenuGameMode') if ref == 'mojulo-menu' else cls
    world.get_world_settings().set_editor_property('default_game_mode', mode)
    if ref != 'mojulo-menu':
        persistent = world.get_world_settings().get_level()
        label = 'NightRunDressing_' + ref
        existing = [a for a in actors.get_all_level_actors() if a.get_actor_label() == label and a.get_level() == persistent]
        if not existing:
            with open(os.path.join(root, 'MojuloPack', 'levels', ref, 'score.json')) as source:
                score = json.load(source)
            x, y, z = score['spawn']
            light = actors.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x*100, -y*100, z*100+240))
            light.set_actor_label(label)
            light.light_component.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
            light.light_component.set_editor_property('intensity', 150.0)
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    report.append({'ref': ref, 'map': wrapper, 'imported': imported, 'game_mode': mode.get_path_name()})
with open(os.path.join(root, 'campaign-import.json'), 'w') as output:
    json.dump(report, output, indent=2)
unreal.log('[night-run] campaign project maps ready')
