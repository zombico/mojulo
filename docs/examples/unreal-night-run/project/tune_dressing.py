"""Project-side dressing: the cave's persistent light is a warm ember fill, not a white lamp at the spawn."""
import unreal
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert levels.load_level('/Game/NightRun/Maps/night-run-cave')
for a in actors.get_all_level_actors():
    if a.get_actor_label() == 'NightRunDressing_night-run-cave':
        a.light_component.set_editor_property('intensity', 40.0)
        a.light_component.set_editor_property('light_color', unreal.Color(r=255, g=170, b=110, a=255))
        unreal.log('[night-run] cave dressing light tuned: warm, 40')
unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
