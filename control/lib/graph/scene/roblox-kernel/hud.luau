--!strict
-- mojulo-roblox kernel — the level's HUD as WORDS (the score's hud rows, game/hud-widgets.js): each readout a line in its
-- slot (text, counter, bar and clock alike written out: "Time 1:05", "Lap 2/3", "HP 80/100"), each banner and toast a
-- moment said when its bus event is heard (its {event.<field>} and {<var>} filled as the page's hudSubst fills them), each
-- legend a line at the bottom for its time. The page's look (bars, the register's motion, the guide's style) and a
-- part's gate (ui-<id>, phase) are not drawn. Pure Luau, no host API: the presenter draws what it returns.
--
--   hud.create(rows)                 → H
--   hud.lines(H, vars, t)            → [{ slot, text }]   the readouts, then the legends still showing at t seconds
--   hud.moments(H, log, from, vars)  → [{ text, ttl }]   the banners and toasts the log's events after `from` fire

return function(K)
local js = K.js
local get, truthy = js.get, js.truthy

local hud = {}

function hud.create(rows: any): any
	local H = { readouts = {}, moments = {}, legends = {} }
	for _, r in ipairs(js.isArr(rows) and rows or {}) do
		if not js.isObj(r) then
			continue
		end
		local kind = get(r, "kind")
		if kind == "readout" and type(get(r, "var")) == "string" then
			table.insert(H.readouts, r)
		elseif (kind == "banner" or kind == "toast") and type(get(r, "on")) == "string" then
			table.insert(H.moments, r)
		elseif kind == "legend" and type(get(r, "text")) == "string" then
			table.insert(H.legends, r)
		end
	end
	return H
end

-- the page's hudSubst: {event.<field>} from the firing event, {<var>} from the vars (left as written when unset)
local function subst(text: string, vars: any, ev: any): string
	return (string.gsub(text, "{([^{}]*)}", function(key: string)
		if string.sub(key, 1, 6) == "event." then
			local v = ev and get(ev, string.sub(key, 7)) or nil
			return (v ~= nil and not js.isNullish(v)) and js.str(v) or ""
		end
		if key == "delta" or key == "value" then
			return ""
		end
		local v = get(vars, key)
		return (v ~= nil and not js.isNullish(v)) and js.str(v) or ("{" .. key .. "}")
	end))
end

local function number(v: any): string
	local n = js.toNumber(v)
	if n ~= n then
		return js.str(v)
	end
	return js.numStr(js.round(n * 100) / 100)
end

function hud.lines(H: any, vars: any, t: number): { any }
	local out = {}
	for _, r in ipairs(H.readouts) do
		local v = get(vars, r.var)
		if v == nil or js.isNullish(v) then
			continue
		end
		local label = truthy(get(r, "label")) and (js.str(r.label) .. " ") or ""
		local as = get(r, "as")
		local text
		if as == "clock" then
			local s = math.max(0, math.floor(js.toNumber(v)))
			text = string.format("%s%d:%02d", label, s // 60, s % 60)
		elseif (as == "counter" or as == "bar") and js.finite(get(r, "max")) then
			text = label .. number(v) .. "/" .. number(r.max)
		else
			text = label .. (js.isNum(v) and number(v) or js.str(v))
		end
		table.insert(out, { slot = truthy(get(r, "slot")) and js.str(r.slot) or "top-left", text = text })
	end
	for _, r in ipairs(H.legends) do
		local ttl = get(r, "ttl")
		if not js.finite(ttl) or t < ttl then
			table.insert(out, { slot = truthy(get(r, "slot")) and js.str(r.slot) or "bottom", text = subst(r.text, vars, nil) })
		end
	end
	return out
end

function hud.moments(H: any, log: { any }, from: number, vars: any): { any }
	local out = {}
	for i = from + 1, #log do
		local ev = log[i]
		if not js.isObj(ev) or type(get(ev, "type")) ~= "string" then
			continue
		end
		for _, r in ipairs(H.moments) do
			if js.glob(ev.type, r.on) then
				local ttl = get(r, "ttl")
				table.insert(out, { text = subst(truthy(get(r, "text")) and js.str(r.text) or ev.type, vars, ev), ttl = js.finite(ttl) and ttl or (r.kind == "toast" and 0.8 or 2) })
			end
		end
	end
	return out
end

return hud
end
