extends RefCounted
# mojulo-godot kernel — the quest journal (since 0.23.0): a level's quests (quests.js questProgram, carried in bus.json
# `quests`) over the bus's flags (the vars flag-<name>), ported from quests.js questView and questNews (the code the page
# ships) and held equal by the scenes conformance corpus.
#
#   view(program, vars)  → [{ id, name, state: 'on' | 'done', steps: [{ text, done }] }]  the begun quests; a step shows
#                          once those before it are done
#   news(program, flags) → [{ kind: 'begun' | 'step' | 'done', name, text? }]           for flags set just now

const Bus := preload("res://kernel/bus.gd")
const Js := preload("res://kernel/js.gd")


static func view(program, vars) -> Array:
	var on := func(f) -> bool: return vars is Dictionary and Js.truthy(vars.get("flag-" + String(f)))
	var out := []
	for q in (program if program is Array else []):
		if Js.truthy(q.get("starts")) and not on.call(q["starts"]):
			continue
		var steps := []
		for s in q["steps"]:
			var d: bool = on.call(s["flag"])
			steps.append({"text": s["text"], "done": d})
			if not d:
				break
		var all_done := true
		for s in steps:
			all_done = all_done and s["done"]
		out.append({"id": q["id"], "name": q["name"], "state": "done" if all_done and steps.size() == (q["steps"] as Array).size() else "on", "steps": steps})
	return out


static func news(program, flags) -> Array:
	var out := []
	for f in (flags if flags is Array else []):
		for q in (program if program is Array else []):
			if Js.strict_eq(q.get("starts"), f):
				out.append({"kind": "begun", "name": q["name"]})
			var j := -1
			for k in (q["steps"] as Array).size():
				if Js.strict_eq(q["steps"][k]["flag"], f):
					j = k
					break
			if j >= 0:
				if j == (q["steps"] as Array).size() - 1:
					out.append({"kind": "done", "name": q["name"]})
				else:
					out.append({"kind": "step", "name": q["name"], "text": q["steps"][j]["text"]})
	return out
