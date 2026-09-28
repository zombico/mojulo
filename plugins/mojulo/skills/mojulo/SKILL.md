---
name: mojulo
description: Build and export 3D objects, walkable worlds, games and music with the mojulo tools. Use when the user asks to model or 3D-print an object, compose a city, room or world, make a game, write a beat or song, export STL, GLB, HTML, Godot or MIDI, or asks what mojulo is.
---

# Mojulo

**When the mojulo tools are available** (the mojulo MCP server's tools, such as `forward_context`):

1. Call `forward_context` first. It is mojulo's routing index: find the row that matches what the user asked for and call the entry tool it names.
2. Pull a drawer or a vocab card only when that tool's result or the index points you there.
3. Iterate on the stored recipe in place (`update_sketch`, `edit_solid`) instead of minting again, and export with the tool the index names (`export_model`, `export_game`, `export_beats`). Give the user the file path from the result.

**When the mojulo tools are not available** (for example in a claude.ai chat, which does not start local MCP servers): tell the user that mojulo runs as a local MCP server in Claude Code, or in a Cowork session on their own computer, where this plugin starts it. Do not install anything or run commands to get it.
