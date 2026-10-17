extends RefCounted
# mojulo-godot kernel — the LEVEL'S GAME CHANNEL, the page's (scene/channels/game.js) ported: the contract's `on` read over
# the bus log's delta. The first pattern that matches an event, in the order the contract wrote them, maps it: an emit is
# gathered for the outcome (its '{event}' values named by the event), an end ends the level (with its exit, when it
# names one), a door leaves the level by it, once; nothing is gathered once the level has ended. At start, the session's
# carried chapters and the level it arrived from are the first frame's events. Pure: kernel/level.gd applies what it
# says (the outcome, the door) to the scene. Held equal by the level corpus (scripts/conformance.mjs --corpus level).
#
#   const GameChannel := preload("res://kernel/game_channel.gd")
#   var ch := GameChannel.create(contract, params)
#   GameChannel.start(ch) → [event]          GameChannel.entry(ch) → the door entered by, or null
#   GameChannel.hear(ch, log, from)          the log's events from index `from`
#   GameChannel.envelope(ch, vars) → { result, events, exit?, stats? } once ended, else null
#   GameChannel.kept(ch, vars) → the kept numbers (contract.keep) as the envelope carries them, or null
#   GameChannel.door(ch) → { door, events } once a door was taken, else null

const Js := preload("res://kernel/js.gd")


static func create(contract, params) -> Dictionary:
	return {
		"contract": contract if contract is Dictionary else {},
		"params": params if params is Dictionary else {},
		"events": [], "ended": false, "leaving": false, "result": null, "exit": null, "door": null,
	}


static func start(ch: Dictionary) -> Array:
	var c: Dictionary = ch["contract"]
	var p: Dictionary = ch["params"]
	var out: Array = []
	var chapters = c.get("chapters")
	if chapters is Dictionary:
		var s = p.get(Js.js_string(chapters.get("slice", Js.UNDEF)))
		var flags: Dictionary = s["flags"] if s is Dictionary and s.get("flags") is Dictionary else {}
		for x in (chapters.get("carried") if chapters.get("carried") is Array else []):
			if x is Dictionary and Js.truthy(flags.get(Js.js_string(x.get("key", Js.UNDEF)))):
				out.append({"type": x.get("event")})
	var arrive = p.get("arrive")
	if arrive is String and c.get("arrive") is Array and (c["arrive"] as Array).has(arrive):
		out.append({"type": "arrive:" + arrive})
	return out


static func entry(ch: Dictionary):
	var e = ch["params"].get("__entry")
	if not (e is Dictionary):
		return null
	for d in (ch["contract"].get("doors") if ch["contract"].get("doors") is Array else []):
		if d is Dictionary and Js.strict_eq(d.get("id", Js.UNDEF), e.get("door", Js.UNDEF)):
			return d
	return null


static func hear(ch: Dictionary, log: Array, from: int) -> void:
	var on = ch["contract"].get("on")
	if not (on is Dictionary):
		return
	for i in range(from, log.size()):
		var ev = log[i]
		if not (ev is Dictionary) or not Js.truthy(ev.get("type")):
			continue   # the cap and noop markers carry no type
		for pat in on:
			if not Js.glob(ev["type"], pat):
				continue
			var act = on[pat]
			if act is Dictionary and Js.truthy(act.get("emit")):
				if not ch["ended"]:
					var o = (act["emit"] as Dictionary).duplicate(true) if act["emit"] is Dictionary else act["emit"]
					if o is Dictionary:
						for k in o:
							if o[k] is String and o[k] == "{event}":
								o[k] = ev["type"]
					ch["events"].append(o)
			elif act is Dictionary and Js.truthy(act.get("end")):
				if not ch["ended"]:
					ch["ended"] = true
					ch["result"] = act["end"]
					if act.get("exit") is String and act["exit"] != "":
						ch["exit"] = act["exit"]
			elif act is Dictionary and Js.truthy(act.get("door")):
				if not ch["ended"] and not ch["leaving"]:
					ch["leaving"] = true
					ch["door"] = act["door"]
			break


static func ended(ch: Dictionary):
	return ch["result"]


# the kept numbers (contract.keep) off the vars, as the page rounds them; null when the contract keeps none
static func kept(ch: Dictionary, vars: Dictionary):
	var keep = ch["contract"].get("keep")
	if not (keep is Array) or keep.is_empty():
		return null
	var out: Array = []
	for k in keep:
		var n := Js.to_number(vars.get(Js.js_string(k.get("var", Js.UNDEF)), Js.UNDEF))
		if is_nan(n) or n == 0.0:
			n = 0.0
		var s := Js.to_number(k["scale"]) if Js.truthy(k.get("scale")) else 1.0
		var row := {"label": k.get("label"), "value": Js.js_round(n * s * 1000.0) / 1000.0, "best": k.get("best")}
		if Js.truthy(k.get("unit")):
			row["unit"] = k["unit"]
		out.append(row)
	return out


static func envelope(ch: Dictionary, vars: Dictionary):
	if not Js.truthy(ch["result"]):
		return null
	var env := {"result": ch["result"], "events": (ch["events"] as Array).duplicate(true)}
	if ch["exit"] != null:
		env["exit"] = ch["exit"]
	var k = kept(ch, vars)
	if k != null:
		env["stats"] = {"kept": k}
	return env


static func door(ch: Dictionary):
	if not Js.truthy(ch["door"]):
		return null
	return {"door": ch["door"], "events": (ch["events"] as Array).duplicate()}
