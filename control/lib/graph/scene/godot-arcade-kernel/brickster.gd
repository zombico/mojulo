extends RefCounted
# mojulo-godot arcade kernel — the brickster reducer, ported by hand from
# lib/graph/pixelizer/brickster-core.js. That file is the reference; this one
# must produce the SAME state for the same seed + action sequence, and the
# pack's probe/replay.json is the proof (the export driver runs it headless
# and compares field by field). Change the JS first, then this, then re-pin
# the fixture.
#
# The whole game is step(state, action) -> state: no clock, no scene tree, no
# randomness outside the mulberry32 stream carried IN the state. A returned
# state is either the very same Dictionary (nothing changed — compare with
# is_same) or a fresh one; arrays are never mutated in place.

const WELL_W := 10
const WELL_H := 22   # rows 0-1 hidden spawn space
const HIDDEN := 2
const PIECES := ["I", "J", "L", "O", "S", "T", "Z"]

const BASE := {
	"I": {"box": 4, "cells": [[0, 1], [1, 1], [2, 1], [3, 1]]},
	"J": {"box": 3, "cells": [[0, 0], [0, 1], [1, 1], [2, 1]]},
	"L": {"box": 3, "cells": [[2, 0], [0, 1], [1, 1], [2, 1]]},
	"O": {"box": 4, "cells": [[1, 0], [2, 0], [1, 1], [2, 1]]},
	"S": {"box": 3, "cells": [[1, 0], [2, 0], [0, 1], [1, 1]]},
	"T": {"box": 3, "cells": [[1, 0], [0, 1], [1, 1], [2, 1]]},
	"Z": {"box": 3, "cells": [[0, 0], [1, 0], [1, 1], [2, 1]]},
}

# SRS wall-kick tables, published (x, y-up) form negated to y-down.
const JLSTZ_KICKS := {
	"01": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
	"10": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
	"12": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
	"21": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
	"23": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
	"32": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
	"30": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
	"03": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
}
const I_KICKS := {
	"01": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
	"10": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
	"12": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
	"21": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
	"23": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
	"32": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
	"30": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
	"03": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
}
const NO_KICK := [[0, 0]]
const CLEAR_SCORE := [0, 100, 300, 500, 800]
const SPAWN_X := 3
const SPAWN_Y := 0
const MASK32 := 0xFFFFFFFF

static var _rotations: Dictionary = {}


## type -> four rotation states, each four [x, y] cells (CW = (x,y) -> (box-1-y, x); O never turns).
static func rotations() -> Dictionary:
	if _rotations.is_empty():
		for type in PIECES:
			var box: int = BASE[type]["box"]
			var cells: Array = BASE[type]["cells"]
			var rots: Array = [cells]
			for r in range(1, 4):
				if type == "O":
					rots.append(cells)
				else:
					var prev: Array = rots[r - 1]
					var turned: Array = []
					for c in prev:
						turned.append([box - 1 - c[1], c[0]])
					rots.append(turned)
			_rotations[type] = rots
	return _rotations


static func _kicks_for(type: String, from: int, to: int) -> Array:
	if type == "O":
		return NO_KICK
	var key := "%d%d" % [from, to]
	return I_KICKS[key] if type == "I" else JLSTZ_KICKS[key]


static func _imul(a: int, b: int) -> int:
	# Math.imul: the low 32 bits of the product. int64 wraps silently, and the
	# low 32 bits of a wrapped product are still exact.
	return (a * b) & MASK32


## mulberry32 as a pure step: rng_state -> [float 0..1, next_state]. Every
## intermediate is masked to uint32 so the bit pattern matches the JS >>> path.
static func rng_next(s: int) -> Array:
	s = (s + 0x6d2b79f5) & MASK32
	var t := s
	t = _imul(t ^ (t >> 15), t | 1)
	t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & MASK32)) & MASK32
	return [float((t ^ (t >> 14)) & MASK32) / 4294967296.0, s]


static func _refill_queue(queue: Array, rng_state: int) -> Array:
	queue = queue.duplicate()
	while queue.size() < 8:
		var bag: Array = PIECES.duplicate()
		var i := bag.size() - 1
		while i > 0:
			var rn := rng_next(rng_state)
			rng_state = rn[1]
			var j := int(floor(float(rn[0]) * float(i + 1)))
			var tmp = bag[i]
			bag[i] = bag[j]
			bag[j] = tmp
			i -= 1
		queue.append_array(bag)
	return [queue, rng_state]


static func cells_of(type: String, rot: int, x: int, y: int) -> Array:
	var out: Array = []
	for c in rotations()[type][rot]:
		out.append([x + c[0], y + c[1]])
	return out


static func _collides(board: Array, cells: Array) -> bool:
	for c in cells:
		var cx: int = c[0]
		var cy: int = c[1]
		if cx < 0 or cx >= WELL_W or cy < 0 or cy >= WELL_H:
			return true
		if String(board[cy])[cx] != ".":
			return true
	return false


## Guideline spawn: appear in the hidden rows, then immediately drop one row into view if free.
static func _spawn_active(board: Array, type: String) -> Dictionary:
	var blocked := _collides(board, cells_of(type, 0, SPAWN_X, SPAWN_Y))
	var y := SPAWN_Y
	if not blocked and not _collides(board, cells_of(type, 0, SPAWN_X, SPAWN_Y + 1)):
		y = SPAWN_Y + 1
	return {"active": {"type": type, "rot": 0, "x": SPAWN_X, "y": y}, "blocked": blocked}


static func _spawn(state: Dictionary) -> Dictionary:
	var rq := _refill_queue(state["queue"], state["rngState"])
	var queue: Array = rq[0]
	var sa := _spawn_active(state["board"], queue[0])
	var next := state.duplicate()
	next["queue"] = queue.slice(1)
	next["rngState"] = rq[1]
	next["active"] = sa["active"]
	next["holdUsed"] = false
	next["over"] = bool(state["over"]) or bool(sa["blocked"])
	return next


static func new_game(seed: int) -> Dictionary:
	seed = seed & MASK32
	var board: Array = []
	for _y in range(WELL_H):
		board.append(".".repeat(WELL_W))
	var state := {
		"seed": seed,
		"rngState": seed,
		"board": board,
		"queue": [],
		"active": null,
		"hold": null,
		"holdUsed": false,
		"score": 0,
		"lines": 0,
		"over": false,
	}
	return _spawn(state)


static func level_of(state: Dictionary) -> int:
	return int(state["lines"]) / 10


static func gravity_ms(state: Dictionary) -> int:
	return maxi(100, int(round(800.0 * pow(0.75, level_of(state)))))


static func _lock(state: Dictionary) -> Dictionary:
	var a: Dictionary = state["active"]
	var type: String = a["type"]
	var cells := cells_of(type, a["rot"], a["x"], a["y"])
	var board: Array = state["board"].duplicate()
	var glyph := type.to_lower()
	for c in cells:
		var row: String = board[c[1]]
		board[c[1]] = row.substr(0, c[0]) + glyph + row.substr(c[0] + 1)
	var kept: Array = []
	for row in board:
		if String(row).contains("."):
			kept.append(row)
	var cleared := WELL_H - kept.size()
	while kept.size() < WELL_H:
		kept.push_front(".".repeat(WELL_W))
	var locked_out := false
	for c in cells:
		if c[1] < HIDDEN:
			locked_out = true
	var next := state.duplicate()
	next["board"] = kept
	next["active"] = null
	next["lines"] = int(state["lines"]) + cleared
	next["score"] = int(state["score"]) + CLEAR_SCORE[cleared] * (level_of(state) + 1)
	next["over"] = bool(state["over"]) or locked_out
	return next if next["over"] else _spawn(next)


static func _try_shift(state: Dictionary, dx: int, dy: int) -> Variant:
	var a: Dictionary = state["active"]
	if _collides(state["board"], cells_of(a["type"], a["rot"], a["x"] + dx, a["y"] + dy)):
		return null
	var next := state.duplicate()
	next["active"] = {"type": a["type"], "rot": a["rot"], "x": a["x"] + dx, "y": a["y"] + dy}
	return next


static func _try_rotate(state: Dictionary, dir: int) -> Dictionary:
	var a: Dictionary = state["active"]
	var type: String = a["type"]
	var rot: int = a["rot"]
	var to := (rot + dir + 4) % 4
	for k in _kicks_for(type, rot, to):
		if not _collides(state["board"], cells_of(type, to, a["x"] + k[0], a["y"] + k[1])):
			var next := state.duplicate()
			next["active"] = {"type": type, "rot": to, "x": a["x"] + k[0], "y": a["y"] + k[1]}
			return next
	return state  # rotation refused, no state change


## Where the active piece would rest — the ghost row offset.
static func drop_distance(state: Dictionary) -> int:
	var a: Dictionary = state["active"]
	var d := 0
	while not _collides(state["board"], cells_of(a["type"], a["rot"], a["x"], a["y"] + d + 1)):
		d += 1
	return d


## The reducer. Actions: left/right/cw/ccw/softDrop/hardDrop/hold/tick/restart.
## Unknown actions and actions after game over (except restart) return the
## state unchanged (the same Dictionary — test with is_same).
static func step(state: Dictionary, action: String) -> Dictionary:
	if action == "restart":
		return new_game((int(state["seed"]) + 1) & MASK32)
	if bool(state["over"]) or state["active"] == null:
		return state
	match action:
		"left":
			var moved = _try_shift(state, -1, 0)
			return moved if moved != null else state
		"right":
			var moved = _try_shift(state, 1, 0)
			return moved if moved != null else state
		"cw":
			return _try_rotate(state, 1)
		"ccw":
			return _try_rotate(state, -1)
		"tick":
			var moved = _try_shift(state, 0, 1)
			return moved if moved != null else _lock(state)
		"softDrop":
			var moved = _try_shift(state, 0, 1)
			if moved == null:
				return _lock(state)
			moved["score"] = int(moved["score"]) + 1
			return moved
		"hardDrop":
			var d := drop_distance(state)
			var a: Dictionary = state["active"]
			var dropped := state.duplicate()
			dropped["score"] = int(state["score"]) + 2 * d
			dropped["active"] = {"type": a["type"], "rot": a["rot"], "x": a["x"], "y": a["y"] + d}
			return _lock(dropped)
		"hold":
			if bool(state["holdUsed"]):
				return state
			var held = state["hold"]
			var stashed := state.duplicate()
			stashed["hold"] = state["active"]["type"]
			if held == null:
				var spawned := _spawn(stashed)
				spawned["holdUsed"] = true
				return spawned
			var sa := _spawn_active(state["board"], held)
			stashed["active"] = sa["active"]
			stashed["holdUsed"] = true
			stashed["over"] = bool(state["over"]) or bool(sa["blocked"])
			return stashed
	return state


## The replay digest: the fields the export driver compares against the JS
## reducer's run of the same script (probe/replay.json.expected). Keys and
## formatting are the contract; brickster-replay.js prints the same shape.
static func digest(state: Dictionary) -> Dictionary:
	var a = state["active"]
	return {
		"board": "|".join(PackedStringArray(state["board"])),
		"score": int(state["score"]),
		"lines": int(state["lines"]),
		"hold": "-" if state["hold"] == null else String(state["hold"]),
		"queue": "".join(PackedStringArray(state["queue"])),
		"active": "-" if a == null else "%s:%d:%d:%d" % [a["type"], a["rot"], a["x"], a["y"]],
		"over": "true" if bool(state["over"]) else "false",
	}
