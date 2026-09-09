"""Project side, run once: a Blueprint game mode derived from the kernel's MojuloGameMode that
borrows the Game Animation Sample's pawn, controller and state classes (GM_Sandbox). Mojulo's
mechanics run; Epic's character walks. Re-exporting the pack never touches this asset."""
import unreal
sample = unreal.get_default_object(unreal.EditorAssetLibrary.load_blueprint_class('/Game/Blueprints/GM_Sandbox'))
factory = unreal.BlueprintFactory()
factory.set_editor_property('parent_class', unreal.load_class(None, '/Script/MojuloKernel.MojuloGameMode'))
asset = '/Game/NightRun/BP_NightRunGameMode'
bp = unreal.EditorAssetLibrary.load_asset(asset) if unreal.EditorAssetLibrary.does_asset_exist(asset) else None
if bp is None:
    bp = unreal.AssetToolsHelpers.get_asset_tools().create_asset('BP_NightRunGameMode', '/Game/NightRun', unreal.Blueprint, factory)
cls = unreal.EditorAssetLibrary.load_blueprint_class(asset)
obj = unreal.get_default_object(cls)
for prop in ['default_pawn_class', 'player_controller_class', 'player_state_class', 'game_state_class']:
    obj.set_editor_property(prop, sample.get_editor_property(prop))
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
unreal.EditorAssetLibrary.save_loaded_asset(bp)
unreal.log('[night-run] BP_NightRunGameMode ready (MojuloGameMode + GASP pawn/controller)')
