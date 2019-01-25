/** @type {CanvasUtil} */
var ctx = null
/**
 * @typedef {{type: string, data: Object<string, any>}} Anchor
 * @typedef {{type: string, pos: string, data: Object<string, any>}} Visual
 * @typedef {{time: number, value: any, interpolate: boolean}} Timekey
 * @typedef {{name: string, isAnchor: boolean, prop: string, keys: Array<Timekey>}} Timeline
 * @typedef {{anchors: Object<string,Anchor>, visuals: Object<string,Visual>, timeline: Array<Timeline>, size: number[], name: string, length: number}} Project
 * @type {Project}
 * */
var project = null
var playing = false

function newProject() {
	B.createForm(null, [
		{
			name: "Name",
			type: "text",
			value: "New Project",
			id: "name"
		}, {
			name: "Width (px)",
			type: "number",
			value: 1920,
			id: "width"
		}, {
			name: "Height (px)",
			type: "number",
			value: 1080,
			id: "height"
		}
	], "Create").then((res) => {
		project = {
			anchors: {},
			visuals: {},
			timeline: [],
			size: [res.width, res.height],
			name: res.name,
			length: 5
		}

		B.l.project = project
		reflow()
	})


}

/**
 * @param {string} name
 */
function getPos(name) {
	if (name[0] == "[") {
		var percent = name[1] == "%"
		return name.substr(percent ? 2 : 1).split(",").map(v => parseFloat(v)).scale(percent ? project.size : [1, 1])
	} else {
		var anchor = project.anchors[name]
		if (anchor && anchor.type in anchorTypes) {
			return anchorTypes[anchor.type].getPos(anchor)
		}
	}
	return [NaN, NaN]
}

/** @type {Object<string, {make: ()=>Visual, render: (me: Visual, size : number[], pixelScale : number)=>void}>} */
var visualTypes = {
	Rect: {
		make: () => ({ type: "Rect", data: { "#pos": "[10,10", "#size": "[10,10", color: colors.white, lineWidth: 1, fill: false, pivotCenter: true } }),
		render(me, size, pixelScale) {
			var pos = getPos(me.data["#pos"])
			var meSize = getPos(me.data["#size"])
			if (me.data.pivotCenter) pos.addI(meSize.mul(-0.5))
			ctx.setColor(me.data.color)[me.data.fill ? "box" : "rect"](pos.mul(pixelScale), meSize.mul(pixelScale), me.data.lineWidth * pixelScale)
		}
	}
}
/** @type {Object<string, {make: ()=>Anchor, getPos: (me: Anchor)=>number[]}>} */
var anchorTypes = {
	Position: {
		make: () => ({ type: "Position", data: { x: 0, y: 0, useFraction: false } }),
		getPos: (me) => [me.data.x, me.data.y].scale(me.data.useFraction ? project.size : [1, 1])
	},
	RotateAround: {
		make: () => ({ type: "RotateAround", data: { "#center": "", angle: 0, offset: 20 } }),
		getPos: (me) => getPos(me.data["#center"]).add(vector.fromAngle(me.data.angle / 180 * Math.PI).mul(me.data.offset))
	}
}

function setup() {
	ctx = E.mainCanvas.toCtx()
	if (B.l.project) {
		project = B.l.project
		reflow()
	} else {
		newProject()
	}
	window.addEventListener("resize", ()=>reflow())
}

function applyAnimations() {
	if (!project) return
	var time = parseFloat(E.timeLineScrub.value) * project.length
	project.timeline.forEach(v => {
		if (v.keys.length == 0) return
		var targetObject = (v.isAnchor ? project.anchors : project.visuals)[v.name]
		if (!targetObject) return
		if (!(v.prop in targetObject.data)) return
		/** @type {Timekey[]} */
		var keys = v.keys.copy().sort((a, b) => a.time - b.time)
		var useI = 0
		for (var i = 0; i < keys.length; i++) {
			if (keys[i].time <= time) {
				useI = i
			} else break
		}
		var use = keys[useI]
		var value = use.value
		if (time > use.time && keys.length > useI + 1 && keys[useI + 1].interpolate) {
			var second = keys[useI + 1]
			var frac = (time - use.time) / (second.time - use.time)
			if (typeof second.value == "number") {
				value = use.value.lerp(second.value, frac)
			}
		}
		targetObject.data[v.prop] = value
	})
}

var lastPlayTime = Date.now()
function update() {
	var fullSize = E.mainCanvasHost.getSize()
	ctx.canvas.canvas.setSize(fullSize)
	ctx.setSize(fullSize)
	ctx.clear()

	if (!project) {
		ctx.setColor(colors.white).text(fullSize.mul(0.5), 50, "No project loaded".split("").map(v => (Math.random() < 0.01 ? "#&@?".split("").random() : v)).join(""), true)
	} else {
		if (playing) {
			let time = parseFloat(E.timeLineScrub.value) * project.length
			time += (Date.now() - lastPlayTime) / 1000
			lastPlayTime = Date.now()
			E.timeLineScrub.value = (time % project.length) / project.length
			reflowTimeline()
		}

		var aspectRatio = (project.size[0] / project.size[1]) / (fullSize[0] / fullSize[1])
		var size = [0, 0]
		if (aspectRatio < 1) {
			size = [fullSize[0] * aspectRatio, fullSize[1]]
		} else {
			size = [fullSize[0], fullSize[1] / aspectRatio]
		}
		var gradient = ctx.canvas.createLinearGradient(0, 0, size[0], 0)
		gradient.addColorStop(0, colors.voidGrey.mul(0.5).toHex());
		gradient.addColorStop(1, colors.notepad.toHex());
		ctx.setColor(gradient).box([0, 0], size)
		var sizeMul = size[0] / project.size[0]

		applyAnimations()

		project.visuals.toArray().forEach((/** @type {{value: Visual, key: string}} */ v) => {
			if (v.value.type in visualTypes) {
				var type = visualTypes[v.value.type]
				var props = type.make().data
				Object.assign(props, v.value.data)
				Object.assign(v.value.data, props)

				type.render(v.value, size, sizeMul)
			}
		})

	}
}

function reflow() {
	reflowDesc()
	reflowLists()
	reflowTimeline()
}

function reflowDesc() {
	E.projectName.innerText = project ? project.name : "nothing"
	if (project) E.projectLength.value = project.length
}

/**
 * @param {HTMLElement} parent
 * @param {string} name
 * @param {boolean} isAnchor
 */
function appendObjectProps(parent, name, isAnchor, isLinked = false) {
	if (project) {
		var targetElement = isAnchor ? project.anchors[name] : project.visuals[name]
		var header = document.createElement("div")

		header.style.padding = "4px"
		if (isLinked) header.style.borderTop = "4px solid #00ff00"

		if (targetElement) {

			var containDiv = document.createElement("div")
			containDiv.style.borderBottom = "1px solid black"

			header.style.backgroundColor = isAnchor ? "lightblue" : "lightgray"
			containDiv.appendChild(header)
			parent.appendChild(containDiv)

			var nameInp = document.createElement("input")
			nameInp.value = name
			nameInp.readOnly = isLinked
			nameInp.addEventListener("change", () => {
				if (isLinked) return
				delete (isAnchor ? project.anchors : project.visuals)[name];
				(isAnchor ? project.anchors : project.visuals)[nameInp.value] = targetElement
				selectedObject = nameInp.value
				reflowLists()
			})
			header.appendChild(nameInp)

			var propDiv = document.createElement("div")
			containDiv.appendChild(propDiv)
			propDiv.style.padding = "4px"

			var delButton = document.createElement("button")
			delButton.appendChild(document.createTextNode("-"))
			delButton.addEventListener("click", () => {
				delete (isAnchor ? project.anchors : project.visuals)[name]
				if (!isLinked) selectedObject = null
				reflowLists()
				reflowTimeline()
			})
			header.appendChild(delButton)

			if (!(targetElement.type in (isAnchor ? anchorTypes : visualTypes))) {
				var redText = document.createElement("span")
				redText.style.color = "red"
				redText.appendChild(document.createTextNode(" !def '" + targetElement.type + "', !render"))
				header.appendChild(redText)
			}

			B.formify(propDiv, targetElement.data, "", false, () => reflowLists(), true, true)

			var done = []
			targetElement.data.toArray().forEach(v => {
				if (v.key[0] == "#" && v.value[0] != "[" && done.indexOf(v.value) == -1) {
					appendObjectProps(parent, v.value, true, true)
					done.push(v.value)
				}
			})
		} else {
			header.appendChild(document.createTextNode(name))

			var createButton = document.createElement("button")
			createButton.appendChild(document.createTextNode("+"))
			createButton.addEventListener("click", () => {
				newObject(name, true)
			})
			header.appendChild(createButton)

			parent.appendChild(header)
			header.style.backgroundColor = "lightcoral"
			parent.append(header)

		}
	} else {
		var error = document.createElement("div")
		error.style.backgroundColor = "lightcoral"
		error.appendChild(document.createTextNode("No project open"))
		parent.appendChild(parent)
	}


}

var isAnchorSelection = false
var isAnchorSelected = false
var selectedObject = null
function reflowLists() {
	B.removeChildrenOf(E.selectionList)
	B.removeChildrenOf(E.propertyList)

	E.objectsButton.style.backgroundColor = isAnchorSelection ? "lightgray" : "lightgreen"
	E.anchorsButton.style.backgroundColor = !isAnchorSelection ? "lightgray" : "lightgreen"

	E.objectsButton.blur()
	E.anchorsButton.blur()

	if (project) {
		(isAnchorSelection ? project.anchors : project.visuals).toArray().forEach((v) => {
			var button = document.createElement("button")
			var wasSelection = isAnchorSelection
			button.style.border = "none"
			button.onclick = () => {
				isAnchorSelected = wasSelection
				selectedObject = v.key
				reflowLists()
			}
			button.appendChild(document.createTextNode(v.key))
			button.style.width = "100%"
			button.style.textAlign = "left"
			button.style.backgroundColor = (wasSelection == isAnchorSelection && v.key == selectedObject) ? "lightgreen" : "lightgrey"
			E.selectionList.appendChild(button)
		})
	}

	if (project && selectedObject) {
		appendObjectProps(E.propertyList, selectedObject, isAnchorSelected)
	}
}

/** @type {{line : number, key : number}} */
var selectedKey = null

function reflowTimeline() {
	B.removeChildrenOf(E.timeline)
	B.removeChildrenOf(E.timelineNames)
	var time = parseFloat(E.timeLineScrub.value) * project.length
	project.timeline.forEach((v, i) => {
		var target = project[v.isAnchor ? "anchors" : "visuals"][v.name]
		var valid = target && v.prop in target.data

		var div = document.createElement("div")
		E.timeline.appendChild(div)
		div.style.background = "lightgrey"
		div.style.borderBottom = "1px solid black"
		div.style.height = "20px"
		div.style.overflow = "hidden"
		div.addEventListener("mousemove", (event) => {
			if (selectedKey && B.mouseDown[2]) {
				if (selectedKey.line == i) {
					v.keys[selectedKey.key].time = ((time + event.getPos()[0] / 100) * 10).floor() / 10

					reflowTimeline()
				}
			}
		})
		div.addEventListener("mouseup", (event) => {
			if (selectedKey && event.button == 2) {
				selectedKey = null
				reflowTimeline()
			}
		})
		div.addEventListener("mousedown", (event) => {
			if (event.button == 1) {
				B.formify(null, { value: target.data[v.prop], interpolate: true, time: ((time + event.getPos()[0] / 100) * 10).floor() / 10 }, "Create", false, (ret) => {
					v.keys.push(ret)
					reflowTimeline()
				}, true)
			}
		})

		div.addEventListener("contextmenu", (event)=>event.preventDefault())

		var end = document.createElement("div")
		div.appendChild(end)
		end.style.backgroundColor = "lightcoral"
		end.style.position = "absolute"
		end.style.left = Math.floor((project.length - time) * 100) + "px"
		end.style.width = Math.floor(div.getSize()[0] - (project.length - time) * 100) + "px"
		end.style.height = "20px"

		for (let i = 1; i < project.length; i++) {
			let marker = document.createElement("div")
			div.appendChild(marker)
			var frac = (i - time)
			marker.style.backgroundColor = "black"
			marker.style.position = "absolute"
			marker.style.height = "20px"
			marker.style.width = "1px"
			marker.style.left = Math.floor(frac * 100 - 1) + "px"
		}

		var name = document.createElement("div")
		E.timelineNames.appendChild(name)
		name.style.height = "20px"
		name.style.width = "100%"
		name.style.overflow = "hidden"
		name.style.borderBottom = "1px solid black"
		if (!valid) name.style.backgroundColor = "lightcoral"
		var delButton = document.createElement("button")
		name.appendChild(delButton)
		delButton.appendChild(document.createTextNode("-"))
		delButton.addEventListener("click", () => {
			project.timeline.splice(i, 1)
			reflowTimeline()
		})
		if (valid) {
			var addButton = document.createElement("button")
			name.appendChild(addButton)
			addButton.appendChild(document.createTextNode("+"))
			addButton.addEventListener("click", () => {
				B.formify(null, { value: target.data[v.prop], interpolate: true, time: 0 }, "Create", false, (ret) => {
					v.keys.push(ret)
					reflowTimeline()
				}, true)
			})
			name.appendChild(document.createTextNode(v.name + "/" + v.prop))

			v.keys.forEach((v, ii) => {
				var button = document.createElement("button")
				var frac = (v.time - time)

				div.appendChild(button)
				button.style.border = "none"
				button.style.backgroundColor = (selectedKey && selectedKey.line == i && selectedKey.key == ii) ? "#00ff00" : "green"
				button.style.position = "absolute"
				button.style.height = "20px"
				button.style.width = "10px"
				button.style.left = Math.floor(frac * 100 - 5) + "px"
				button.style.padding = "0"
				button.addEventListener("click", () => {
					B.formify(null, v, "Save", false, () => { reflowTimeline() }, true)
					var button = document.createElement("button")
					button.appendChild(document.createTextNode("Delete"))
					button.addEventListener("click", () => {
						v.keys.splice(ii, 1)
						reflowTimeline()
					})
					B.modalWindow.appendChild(button)
				})

				button.addEventListener("mousedown", (event) => {
					if (event.button == 2) {
						selectedKey = { line: i, key: ii }
						reflowTimeline()
					}
				})

				button.addEventListener("contextmenu", (event) => event.preventDefault())

			})
		}
	})
}

function download() {
	var json = JSON.stringify(project)
	B.saveFile(json, project.name + ".json", "application/json")
}

function upload() {
	B.loadFile("application/json", false).then(([file]) => {
		var reader = new FileReader();
		reader.onload = () => {
			var projectF = JSON.parse(reader.result)
			project = projectF
			reflow()

		}
		reader.readAsText(file)


	})
}

function newObject(name = "New Object", isAnchor = isAnchorSelection) {
	var source = (isAnchor ? anchorTypes : visualTypes)
	B.createForm(null, [
		{ name: "Name", type: "text", value: name, id: "name" },
		{ name: "Type", type: "selection", options: source.toArray().map(v => v.key), id: "type" }
	], "Create", true).then((ret) => {
		project[(isAnchor ? "anchors" : "visuals")][ret.name] = source[ret.type].make()
		reflowLists()
	})
}

function newAnim() {
	var window = B.createModalWindow()
	var visualButton = document.createElement("button")
	var isAnchor = false
	visualButton.appendChild(document.createTextNode("Visual"))
	visualButton.addEventListener("click", () => {
		window.delete()
		next()
	})
	window.appendChild(visualButton)
	window.appendChild(document.createTextNode(" or "))
	var anchorButton = document.createElement("button")
	anchorButton.appendChild(document.createTextNode("Anchor"))
	window.appendChild(anchorButton)
	anchorButton.addEventListener("click", () => {
		window.delete()
		isAnchor = true
		next()
	})
	window.appendChild(document.createTextNode("?"))
	window.appendChild(document.createElement("br"))
	window.appendChild(document.createElement("br"))
	window.appendChild(document.createElement("button").setAttributes({ onclick: () => window.delete() }, "Cancel"))

	var next = () => {
		var window = B.createModalWindow()
		var containDiv = document.createElement("div")
		var name = ""
		var object = null
		window.appendChild(containDiv)
		containDiv.style.border = "1px solid black"
		containDiv.style.height = "500px"
		containDiv.style.width = "200px"
		containDiv.style.overflow = "auto"
		containDiv.style.resize = "vertical"

		project[isAnchor ? "anchors" : "visuals"].toArray().forEach((v) => {
			var button = document.createElement("button")
			containDiv.appendChild(button)
			button.style.width = "100%"
			button.style.border = "none"
			button.appendChild(document.createTextNode(v.key))
			button.addEventListener("click", () => {
				name = v.key
				object = v.value
				window.delete()
				next()
			})
		})

		window.appendChild(document.createElement("br"))
		window.appendChild(document.createElement("button").setAttributes({ onclick: () => window.delete() }, "Cancel"))

		var next = () => {
			var window = B.createModalWindow()
			var containDiv = document.createElement("div")
			window.appendChild(containDiv)
			containDiv.style.border = "1px solid black"
			containDiv.style.height = "500px"
			containDiv.style.overflow = "auto"
			containDiv.style.resize = "vertical"
			containDiv.style.width = "200px"

			object.data.toArray().forEach((v) => {
				var button = document.createElement("button")
				containDiv.appendChild(button)
				button.style.width = "100%"
				button.style.border = "none"
				button.appendChild(document.createTextNode(v.key))
				button.addEventListener("click", () => {
					project.timeline.push({ name: name, prop: v.key, keys: [], isAnchor: isAnchor })
					reflowTimeline()
					window.delete()
				})
			})

			window.appendChild(document.createElement("br"))
			window.appendChild(document.createElement("button").setAttributes({ onclick: () => window.delete() }, "Cancel"))
		}
	}

}