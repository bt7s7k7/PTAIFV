visualTypes.Rect = {
	make: () => ({ type: "Rect", data: { "#pos": "[10,10", "#size": "[10,10", color: colors.white, lineWidth: 1, fill: false, pivotCenter: true, sizeMul: 1 } }),
	render(me, size, pixelScale) {
		var pos = getPos(me.data["#pos"])
		var meSize = getPos(me.data["#size"])
		if (me.data.pivotCenter) pos.addI(meSize.mul(-0.5))
		ctx.setColor(me.data.color)[me.data.fill ? "box" : "rect"](pos.mul(pixelScale), meSize.mul(pixelScale).mul(me.data.sizeMul), me.data.lineWidth * pixelScale)
	}
}

visualTypes.Circle = {
	make: () => ({ type: "Circle", data: { "#pos": "[10,10", "#size": "[10,10", color: colors.white, lineWidth: 1, fill: false, radiusMul: 1} }),
	render(me, size, pixelScale) {
		var pos = getPos(me.data["#pos"])
		var meSize = getPos(me.data["#size"])
		ctx.setColor(me.data.color)[me.data.fill ? "ellipse" : "strokeEllipse"](pos.mul(pixelScale), meSize.mul(pixelScale).mul(me.data.radiusMul), [0, Math.PI * 2], me.data.lineWidth * pixelScale)
	}
}

visualTypes.Line = {
	make: () => ({ type: "Line", data: { "#from": "", "#to": "", color: colors.white, lineWidth: 1 } }),
	render(me, size, pixelScale) {
		if (me.data.lineWidth == 0) return
		var pos1 = getPos(me.data["#from"]).mul(pixelScale)
		var pos2 = getPos(me.data["#to"]).mul(pixelScale)
		ctx.setColor(me.data.color).line(pos1, pos2, me.data.lineWidth)
	}
}

visualTypes.Text = {
	make: () => ({ type: "Text", data: { "#pos": "", text: "New Text", height: 20, length: -1, center: true, font: "Verdana", color: colors.white, opacity: 1 } }),
	render(me, size, pixelScale) {
		var pos = getPos(me.data["#pos"]).mul(pixelScale)
		var height = me.data.height * pixelScale
		//ctx.canvas.globalAlpha = me.data.opacity
		ctx.setColor([...me.data.color, me.data.opacity * 255]).text(pos, height, JSON.parse("\"" + me.data.text + "\"").substr(0, me.data.length >= 0 ? me.data.length : Infinity), me.data.center, me.data.font)
		//ctx.canvas.globalAlpha = 1
	}
}

anchorTypes.Position = {
	make: () => ({ type: "Position", data: { x: 0, y: 0, useFraction: false } }),
	getPos: (me) => [me.data.x, me.data.y].scale(me.data.useFraction ? project.size : [1, 1])
}

anchorTypes.Radius = {
	make: () => ({ type: "Radius", data: { radius: 0 } }),
	getPos: (me) => [me.data.radius, me.data.radius]
}

anchorTypes.RotateAround = {
	make: () => ({ type: "RotateAround", data: { "#center": "", angle: 0, offset: 20 } }),
		getPos: (me) => getPos(me.data["#center"]).add(vector.fromAngle(me.data.angle / 180 * Math.PI).mul(me.data.offset))
}

anchorTypes.Offset = {
	make: () => ({ type: "Offset", data: { "#origin": "", x: 0, y: 0 } }),
	getPos: (me) => getPos(me.data["#origin"]).add([me.data.x, me.data.y])
}

anchorTypes.Lerp = {
	make: () => ({ type: "Lerp", data: { "#from": "", "#to": "", frac: 0 } }),
	getPos: (me) => getPos(me.data["#from"]).lerp(getPos(me.data["#to"]), me.data.frac)
}