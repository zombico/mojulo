"""Reimport the pack and assert project dressing survives with the same identity."""
import json, os, runpy
import unreal
root = unreal.Paths.project_dir()
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

def snapshot():
    assert levels.load_level('/Game/NightRun/L_Lounge')
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    all_actors = actors.get_all_level_actors()
    lights = [a for a in all_actors if a.get_actor_label() == 'NightRunDressingLight']
    assert len(lights) == 1, 'Expected one persistent dressing light'
    light = lights[0]
    pos = light.get_actor_location()
    assert light.get_level() == world.get_world_settings().get_level()
    assert unreal.GameplayStatics.get_streaming_level(world, '/Game/MojuloPack/Maps/mojulo-level')
    meshes = [a for a in all_actors if isinstance(a, unreal.StaticMeshActor)]
    starts = [a for a in all_actors if isinstance(a, unreal.PlayerStart)]
    assert meshes and starts, 'Imported mesh and PlayerStart must be loaded'
    return {'dressing': {'path': light.get_path_name(), 'guid': light.get_editor_property('actor_guid').to_string(), 'position': [pos.x, pos.y, pos.z], 'intensity': light.light_component.get_editor_property('intensity')}, 'mesh_actors': len(meshes), 'player_starts': len(starts), 'game_mode': world.get_world_settings().get_editor_property('default_game_mode').get_path_name()}

before = snapshot()
runpy.run_path(os.path.join(root, 'MojuloPack', 'import_mojulo.py'), run_name='__main__')
# Inspect immediately after import, before setup can recreate any dressing.
after = snapshot()
assert before == after, json.dumps({'before': before, 'after': after})
with open(os.path.join(root, 'reimport-verification.json'), 'w') as output:
    json.dump({'passed': True, 'scope': 'Same-pack reimport preserves persistent dressing and map wiring; geometry-change proof remains pending.', 'before': before, 'after': after}, output, indent=2)
unreal.log('[night-run] reimport preservation verified')
