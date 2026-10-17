-- mojulo — the player's side: the keys a level listens for, sent to the server's bus by the names the web page gives
-- them (its KeyboardEvent.key: a letter in lower case, a digit, ' ', Enter, Escape, the arrows), and the words the
-- server says (a level's title, its outcome) shown a moment at the top of the screen, and the level's HUD as words: its
-- readouts in their slots, its banners and toasts a moment in the centre. The left mouse button is the fight's fire
-- (held and let go, as the page's mouse), and a scene's line of dialogue shows in a box at the bottom while it plays.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remotes = ReplicatedStorage:WaitForChild("MojuloRemotes")
local keyRemote = remotes:WaitForChild("Key") :: RemoteEvent
local sayRemote = remotes:WaitForChild("Say") :: RemoteEvent
local hudRemote = remotes:WaitForChild("Hud") :: RemoteEvent
local fireRemote = remotes:WaitForChild("Fire") :: RemoteEvent

local NAMES = {
	Space = " ", Return = "Enter", Escape = "Escape", Tab = "Tab", Backspace = "Backspace",
	Up = "ArrowUp", Down = "ArrowDown", Left = "ArrowLeft", Right = "ArrowRight",
	Zero = "0", One = "1", Two = "2", Three = "3", Four = "4", Five = "5", Six = "6", Seven = "7", Eight = "8", Nine = "9",
}
local function keyOf(code: Enum.KeyCode): string?
	local n = code.Name
	if NAMES[n] then
		return NAMES[n]
	end
	if #n == 1 and string.match(n, "%a") then
		return string.lower(n)
	end
	return nil
end

UserInputService.InputBegan:Connect(function(input: InputObject, processed: boolean)
	if processed then
		return
	end
	if input.UserInputType == Enum.UserInputType.MouseButton1 then
		fireRemote:FireServer(true)
		return
	end
	if input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	local key = keyOf(input.KeyCode)
	if key then
		keyRemote:FireServer(key)
	end
end)

UserInputService.InputEnded:Connect(function(input: InputObject)
	if input.UserInputType == Enum.UserInputType.MouseButton1 then
		fireRemote:FireServer(false)
	end
end)

local gui = Instance.new("ScreenGui")
gui.Name = "Mojulo"
gui.ResetOnSpawn = false
local label = Instance.new("TextLabel")
label.AnchorPoint = Vector2.new(0.5, 0)
label.Position = UDim2.new(0.5, 0, 0, 24)
label.Size = UDim2.new(0, 520, 0, 44)
label.BackgroundColor3 = Color3.fromRGB(12, 16, 26)
label.BackgroundTransparency = 0.15
label.TextColor3 = Color3.fromRGB(223, 232, 248)
label.TextSize = 20
label.Font = Enum.Font.GothamMedium
label.Visible = false
label.Parent = gui
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local shown = 0
sayRemote.OnClientEvent:Connect(function(text: string)
	shown += 1
	local mine = shown
	label.Text = text
	label.Visible = true
	task.delay(3, function()
		if shown == mine then
			label.Visible = false
		end
	end)
end)

-- ── the HUD: a column of lines in each slot, the moments under the centre ───────────────────────────────────────────
local SLOTS = {
	["top-left"] = { Vector2.new(0, 0), UDim2.new(0, 16, 0, 16), Enum.HorizontalAlignment.Left },
	["top"] = { Vector2.new(0.5, 0), UDim2.new(0.5, 0, 0, 80), Enum.HorizontalAlignment.Center },
	["top-right"] = { Vector2.new(1, 0), UDim2.new(1, -16, 0, 16), Enum.HorizontalAlignment.Right },
	["center"] = { Vector2.new(0.5, 0.5), UDim2.new(0.5, 0, 0.4, 0), Enum.HorizontalAlignment.Center },
	["bottom-left"] = { Vector2.new(0, 1), UDim2.new(0, 16, 1, -16), Enum.HorizontalAlignment.Left },
	["bottom"] = { Vector2.new(0.5, 1), UDim2.new(0.5, 0, 1, -24), Enum.HorizontalAlignment.Center },
	["bottom-right"] = { Vector2.new(1, 1), UDim2.new(1, -16, 1, -16), Enum.HorizontalAlignment.Right },
}
local columns = {}
for name, s in SLOTS do
	local f = Instance.new("Frame")
	f.Name = name
	f.AnchorPoint = s[1]
	f.Position = s[2]
	f.Size = UDim2.new(0, 360, 0, 200)
	f.BackgroundTransparency = 1
	local list = Instance.new("UIListLayout")
	list.HorizontalAlignment = s[3]
	list.VerticalAlignment = s[1].Y == 1 and Enum.VerticalAlignment.Bottom or Enum.VerticalAlignment.Top
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Parent = f
	f.Parent = gui
	columns[name] = f
end
local function line(parent: Instance, text: string, order: number): TextLabel
	local l = Instance.new("TextLabel")
	l.AutomaticSize = Enum.AutomaticSize.X
	l.Size = UDim2.new(0, 0, 0, 26)
	l.BackgroundColor3 = Color3.fromRGB(12, 16, 26)
	l.BackgroundTransparency = 0.3
	l.TextColor3 = Color3.fromRGB(223, 232, 248)
	l.TextSize = 17
	l.Font = Enum.Font.GothamMedium
	l.Text = " " .. text .. " "
	l.LayoutOrder = order
	l.Parent = parent
	return l
end

-- the scene's text box: its line as it types on, at the bottom; empty, hidden
local sceneBox = Instance.new("TextLabel")
sceneBox.AnchorPoint = Vector2.new(0.5, 1)
sceneBox.Position = UDim2.new(0.5, 0, 1, -40)
sceneBox.Size = UDim2.new(0, 720, 0, 64)
sceneBox.BackgroundColor3 = Color3.fromRGB(12, 16, 26)
sceneBox.BackgroundTransparency = 0.1
sceneBox.TextColor3 = Color3.fromRGB(223, 232, 248)
sceneBox.TextSize = 20
sceneBox.TextWrapped = true
sceneBox.Font = Enum.Font.GothamMedium
sceneBox.Visible = false
sceneBox.Parent = gui

hudRemote.OnClientEvent:Connect(function(what: string, payload)
	if what == "scene" then
		sceneBox.Text = type(payload) == "string" and payload or ""
		sceneBox.Visible = sceneBox.Text ~= ""
	elseif what == "lines" then
		for _, f in columns do
			for _, c in f:GetChildren() do
				if c:IsA("TextLabel") and c:GetAttribute("moment") ~= true then
					c:Destroy()
				end
			end
		end
		for i, l in ipairs(payload) do
			line(columns[l.slot] or columns["top-left"], l.text, i)
		end
	elseif what == "moment" then
		local l = line(columns["center"], payload.text, 1000)
		l:SetAttribute("moment", true)
		task.delay(math.max(payload.ttl or 1, 0.8), function()
			l:Destroy()
		end)
	end
end)
