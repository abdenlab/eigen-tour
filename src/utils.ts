import * as d3 from "d3";
import * as math from "mathjs";
import numeric from "numeric";

export const CLEAR_COLOR = [1, 1, 1] as const;
export const CLEAR_COLOR_SMALL_MULTIPLE = [1, 1, 1] as const;
export const MIN_EPOCH = 0;
export const MAX_EPOCH = 99;
export const COLOR_FACTOR = 0.9;
export const dataset = "mnist";
export const datasetListener = [];
export const pointAlpha = 255 * 0.1;

//legend of teaser, grand tour plots
export const legendLeft = { "mnist": 70 };

export const legendRight = { "mnist": 2 };

//legend of small multiple
export const smLegendLeft = { "mnist": 45 };

export const smLegendRight = { "mnist": 2 };

export const legendTitle = { "mnist": "Name" };

//for softmax grandtour
export const buttonOffsetY = {
	"default": 245,
	"adversarial": 265,
};

//for small multiples & softmax grandtour
export const buttonColors = {
	"on": "#B3C5F4",
	"off": "#f3f3f3",
};

export function clamp(min, max, v) {
	return Math.max(max, Math.min(min, v));
}

export function mixScale(s0, s1, progress, func) {
	let range0 = s0.range();
	let range1 = s1.range();

	let domain0 = s0.domain();
	let domain1 = s1.domain();
	progress = Math.max(progress, 0);
	progress = Math.min(progress, 1);
	progress = func(progress);

	return d3.scaleLinear()
		.domain(mix(domain0, domain1, progress))
		.range(mix(range0, range1, progress));
}

export function data2canvas(points, sx, sy, sz) {
	points = points.map((row) => {
		return [sx(row[0]), sy(row[1]), sz(row[2])];
	});
	return points;
}

export function updateScale_span(
	points,
	canvas,
	sx,
	sy,
	sz,
	scaleFactor = 1.0,
	marginRight = undefined,
	marginBottom = undefined,
	marginLeft = undefined,
	marginTop = undefined,
) {
	if (marginTop === undefined) {
		marginTop = 22;
	}
	if (marginBottom === undefined) {
		marginBottom = 65;
	}
	if (marginLeft === undefined) {
		marginLeft = 32;
	}
	if (marginRight === undefined) {
		marginRight = d3.max(Object.values(legendLeft)) + 15;
	}

	let vmin = math.min(points, 0);
	let vmax = math.max(points, 0);
	let xDataRange = vmax[0] - vmin[0];
	let yDataRange = vmax[1] - vmin[1];

	let yMiddle = ((canvas.clientHeight - marginBottom) + marginTop) / 2;
	let yRadius0 = ((canvas.clientHeight - marginBottom) - marginTop) / 2;

	let xMiddle = ((canvas.clientWidth - marginRight) + marginLeft) / 2;
	let xRadius0 = ((canvas.clientWidth - marginRight) - marginLeft) / 2;

	let xRadius = Math.min(xRadius0, yRadius0 / yDataRange * xDataRange);
	let yRadius = Math.min(yRadius0, xRadius0 / xDataRange * yDataRange);

	xRadius *= scaleFactor;
	yRadius *= scaleFactor;

	sy.domain([vmin[1], vmax[1]])
		.range([yMiddle + yRadius, yMiddle - yRadius]);

	sx.domain([vmin[0], vmax[0]])
		.range([xMiddle - xRadius, xMiddle + xRadius]);

	sz.domain([vmin[2], vmax[2]])
		.range([0, 1]);
}

export function updateScale_center(
	points,
	canvas,
	sx,
	sy,
	sz,
	scaleFactor = 1.0,
	marginRight = undefined,
	marginBottom = undefined,
	marginLeft = undefined,
	marginTop = undefined,
) {
	if (marginTop === undefined) {
		marginTop = 22;
	}
	if (marginBottom === undefined) {
		marginBottom = 65;
	}
	if (marginLeft === undefined) {
		marginLeft = 32;
	}
	if (marginRight === undefined) {
		marginRight = d3.max(Object.values(legendLeft)) + 15;
	}

	let vmax = math.max(math.abs(points), 0);
	let vmin = numeric.neg(vmax);

	let xDataRange = 2 * vmax[0];
	let yDataRange = 2 * vmax[1];

	let yMiddle = ((canvas.clientHeight - marginBottom) + marginTop) / 2;
	let yRadius0 = ((canvas.clientHeight - marginBottom) - marginTop) / 2;

	let xMiddle = ((canvas.clientWidth - marginRight) + marginLeft) / 2;
	let xRadius0 = ((canvas.clientWidth - marginRight) - marginLeft) / 2;

	let xRadius = Math.min(xRadius0, yRadius0 / yDataRange * xDataRange);
	let yRadius = Math.min(yRadius0, xRadius0 / xDataRange * yDataRange);

	xRadius *= scaleFactor;
	yRadius *= scaleFactor;

	sx.domain([vmin[0], vmax[0]])
		.range([xMiddle - xRadius, xMiddle + xRadius]);

	sy.domain([vmin[1], vmax[1]])
		.range([yMiddle + yRadius, yMiddle - yRadius]);

	sz.domain([vmin[2], vmax[2]])
		.range([0, 1]);
}

export function toDataURL(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.onload = function () {
		var reader = new FileReader();
		reader.onloadend = function () {
			callback(reader.result);
		};
		reader.readAsDataURL(xhr.response);
	};
	xhr.open("GET", url);
	xhr.responseType = "blob";
	xhr.send();
}

export function embed(matrix, canvas) {
	for (let i = 0; i < matrix.length; i++) {
		for (let j = 0; j < matrix[0].length; j++) {
			canvas[i][j] = matrix[i][j];
		}
	}
	return canvas;
}

// huh: https://eslint.org/docs/rules/guard-for-in
export function walkObject(obj, f) {
	for (let key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			f(key);
		}
	}
}

export function scaleRows(matrix, isRowSelected, beta1, beta0) {
	let selectedCount = numeric.sum(isRowSelected);
	let res = matrix.map((row, i) => {
		row = row.slice();
		if (isRowSelected[i]) {
			row = numeric.mul(row, beta1 / selectedCount);
		} else {
			row = numeric.mul(row, beta0 / (matrix.length - selectedCount));
		}
		return row;
	});
	return res;
}

export function setDataset(datasetName, callback0) {
	this.dataset = datasetName;
	for (let callback of datasetListener) {
		callback(datasetName);
	}
	if (callback0 !== undefined) {
		callback0();
	}
	// }
}

export function getDataset() {
	return dataset;
}

export function addDatasetListener(callback) {
	datasetListener.push(callback);
}

export function clearDatasetListener() {
	for (let i = 0; i < datasetListener.length; i++) {
		datasetListener.pop();
	}
}

export function getLabelNames(adversarial = false, dataset = undefined) {
	if (dataset === undefined) {
		dataset = getDataset();
	}
	let res;
	if (dataset == "mnist") {
		res = ["A0", "A1", "B0", "B1", "B2"];
	} else if (dataset == "fashion-mnist") {
		res = [
			"T-shirt/top",
			"Trouser",
			"Pullover",
			"Dress",
			"Coat",
			"Sandal",
			"Shirt",
			"Sneaker",
			"Bag",
			"Ankle boot",
		];
	} else if (dataset == "cifar10") {
		res = [
			"Airplane",
			"Automobile",
			"Bird",
			"Cat",
			"Deer",
			"Dog",
			"Frog",
			"Horse",
			"Ship",
			"Truck",
		];
	} else {
		throw new Error("Unrecognized dataset " + dataset);
	}
	if (adversarial) {
		res.push("adversarial");
	}
	return res;
}

export function getChromTeaserDataURL() {
	return ["data/eigs.arrow"];
}

export function getTextureURL(dataset = getDataset(), datasetType = "test") {
	return "data/softmax/" + dataset + "/input-" + datasetType + ".png";
}

export function initGL(canvasid: string, shaderPairs: [string, string][]) {
	let canvas = document.getElementById(canvasid.slice(1)) as HTMLCanvasElement;
	let gl = canvas.getContext("webgl", { premultipliedAlpha: false })!;
	let programs = [];
	for (const [fs, vs] of shaderPairs) {
		let program = initShaders(gl, fs, vs);
		programs.push(program);
	}
	return [gl, programs];
}

export function loadDataWithCallback(urls, callback) {
	for (let i = 0; i < urls.length; i++) {
		loadDataBin(urls[i], (buffer, url) => {
			callback(buffer, url, i, urls.length);
		});
	}
}

function bannerAnimation(renderer) {
	let banner = renderer.overlay.banner;
	let bannerText = renderer.overlay.bannerText;
	function repeat() {
		bannerText
			.text("Loading")
			.transition()
			.duration(500)
			.text("Loading.")
			.transition()
			.duration(500)
			.text("Loading..")
			.transition()
			.duration(500)
			.text("Loading...")
			.on("end", repeat);
	}
	repeat();
}

function createBanner(renderer) {
	let overlay = renderer.overlay;
	if (overlay.figure) {
		overlay.banner = overlay.figure.selectAll(".banner")
			.data([0])
			.enter()
			.append("div")
			.attr("class", "banner");
		overlay.banner = overlay.figure.selectAll(".banner");
		overlay.bannerText = overlay.banner
			.selectAll(".bannerText")
			.data([0])
			.enter()
			.append("p")
			.attr("class", "bannerText");
		overlay.bannerText = overlay.banner.selectAll(".bannerText");
	}
}

export function loadDataToRenderer(urls, renderer, onReadyCallback) {
	if (renderer.overlay) {
		createBanner(renderer);
		bannerAnimation(renderer);
	}

	for (let i = 0; i < urls.length; i++) {
		loadDataBin(urls[i], (buffer, url) => {
			renderer.initData(buffer, url, i, urls.length, onReadyCallback);
		});
	}
	return renderer;
}

export function reshape(array, shape) {
	let res = [];
	if (shape.length == 2) {
		for (let row = 0; row < shape[0]; row++) {
			res.push([]);
			for (let col = 0; col < shape[1]; col++) {
				res[res.length - 1].push(array[shape[1] * row + col]);
			}
		}
	} else {
		let blocksize = math.prod(shape.slice(1));
		for (let i = 0; i < shape[0]; i++) {
			res.push(
				reshape(
					array.slice(i * blocksize, (i + 1) * blocksize),
					shape.slice(1),
				),
			);
		}
	}
	return res;
}

export function cacheAll(urls) {
	for (let url of urls) loadDataBin(url, () => {});
}

const cache = {};
export async function loadDataBin(url, callback) {
	if (!(url in cache)) {
		let response = await fetch(url);
		cache[url] = await response.arrayBuffer();
	}
	callback(cache[url], url);
}

export function loadDataCsv(fns, renderer) {
	let promises = fns.map((fn) => d3.text(fn));
	Promise.all(promises).then(function (dataRaw) {
		renderer.initData(dataRaw);
		renderer.play();
	});
}

export function resizeCanvas(canvas) {
	let DPR = window.devicePixelRatio;

	let displayWidth = DPR * canvas.clientWidth;
	let displayHeight = DPR * canvas.clientHeight;
	// Check if the canvas is not the same size.
	if (
		canvas.width != displayWidth ||
		canvas.height != displayHeight
	) {
		// Make the canvas the same size
		canvas.width = displayWidth;
		canvas.height = displayHeight;
	}
	canvas.style.width = canvas.clientWidth;
	canvas.style.height = canvas.clientHeight;
}

export const baseColorsHex = [...d3.schemeCategory10];
baseColorsHex.push("#444444");
baseColorsHex.push("#444444");

/**
 * @param {string} hex
 * @return {[r: number, g: number, b: number]}
 */
function hexToRgb(hex) {
	let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return [
		parseInt(result[1], 16),
		parseInt(result[2], 16),
		parseInt(result[3], 16),
	];
}

export const baseColors = baseColorsHex.map(hexToRgb);

export const bgColors = numeric.add(
	numeric.mul(baseColors, 0.6),
	0.95 * 255 * 0.4,
);

export function createAxisPoints(ndim) {
	let res = math.identity(ndim)._data;
	for (let i = ndim - 1; i >= 0; i--) {
		res.splice(i, 0, math.zeros(ndim)._data);
	}
	return res;
}

export function createAxisColors(ndim) {
	return d3.range(ndim * 2).map(
		(_, i) => baseColors[Math.floor(i / 2) % baseColors.length],
	);
}

export function linearInterpolate(data1, data2, p) {
	// let res = math.zeros(data1.length, data1[0].length)._data;
	// for (let i=0; i<data1.length; i++) {
	//   for (let j=0; j<data1[0].length; j++) {
	//     res[i][j] = data1[i][j]*(1-p) + data2[i][j]*(p);
	//   }
	// }
	let a = math.multiply(data1, 1 - p);
	let b = math.multiply(data2, p);
	let res = math.add(a, b);
	return res;
}

export function mix(data1, data2, p) {
	return linearInterpolate(data1, data2, p);
}

export function orthogonalize(matrix, priorityRowIndex = 0) {
	// make row vectors in matrix pairwise orthogonal;

	function proj(u, v) {
		// @ts-expect-error
		return numeric.mul(numeric.dot(u, v) / numeric.dot(u, u), u);
	}

	function normalize(v, unitlength = 1) {
		if (numeric.norm2(v) <= 0) {
			return v;
		} else {
			return numeric.div(v, numeric.norm2(v) / unitlength);
		}
	}

	// Gram–Schmidt orthogonalization
	let priorityRow = matrix[priorityRowIndex];
	let firstRow = matrix[0];
	matrix[0] = priorityRow;
	matrix[priorityRowIndex] = firstRow;

	matrix[0] = normalize(matrix[0]);
	for (let i = 1; i < matrix.length; i++) {
		for (let j = 0; j < i; j++) {
			matrix[i] = numeric.sub(matrix[i], proj(matrix[j], matrix[i]));
		}
		matrix[i] = normalize(matrix[i]);
	}
	let tempRow = matrix[0];
	matrix[0] = matrix[priorityRowIndex];
	matrix[priorityRowIndex] = tempRow;
	return matrix;
}

export function point2rect(points, npoint, sideLength, yUp = false) {
	let res = [];

	//points
	for (let i = 0; i < npoint; i++) {
		let x = points[i][0];
		let y = points[i][1];
		let z = points[i][2];

		let ul, ur, ll, lr;

		if (yUp) {
			ul = [x - sideLength / 2, y + sideLength / 2, z]; // upper left
			ur = [x + sideLength / 2, y + sideLength / 2, z]; // upper right
			ll = [x - sideLength / 2, y - sideLength / 2, z]; // lower left
			lr = [x + sideLength / 2, y - sideLength / 2, z]; // lower right
		} else {
			// points in canvas coordinate (so downward means y-coord increase)
			ul = [x - sideLength / 2, y - sideLength / 2, z]; // upper left
			ur = [x + sideLength / 2, y - sideLength / 2, z]; // upper right
			ll = [x - sideLength / 2, y + sideLength / 2, z]; // lower left
			lr = [x + sideLength / 2, y + sideLength / 2, z]; // lower right
		}
		res.push(ur, ul, ll, ur, ll, lr);
	}

	//axis
	for (let i = npoint; i < points.length; i++) {
		res.push(points[i]);
	}
	return res;
}

export function color2rect(colors, npoint, ndim) {
	let pointColors = colors.slice(0, npoint)
		.map((c) => [c, c, c, c, c, c])
		.reduce((a, b) => a.concat(b), []);
	let axisColors = colors.slice(npoint, npoint + 2 * ndim);
	return pointColors.concat(axisColors);
}

export function getTextureCoord(
	i,
	nRow = 10,
	nCol = 100,
	isAdversarial = false,
	epoch = 99,
	nepoch = 100,
) {
	let nRow0 = nRow;
	let npoint;
	if (isAdversarial) {
		npoint = nRow * nCol;
		nRow = nRow + nepoch;
	}

	let ul, ur, ll, lr;
	let numPerRow = nCol;
	let numPerCol = nRow;
	let dx = 1 / numPerRow;
	let dy = 1 / numPerCol;
	if (isAdversarial && i >= npoint - 89) { // hardcoded: last 89 are adversarial examples
		ul = [
			dx * ((i - (npoint - 89)) % numPerRow),
			dy * Math.floor(nRow0 + epoch),
		];
	} else {
		ul = [dx * (i % numPerRow), dy * Math.floor(i / numPerRow)];
	}
	ur = ul.slice();
	ur[0] += dx;
	ll = ul.slice();
	ll[1] += dy;
	lr = ul.slice();
	lr[0] += dx;
	lr[1] += dy;

	return [ur, ul, ll, ur, ll, lr];
}

export function loadTexture(gl, url) {
	function isPowerOf2(x) {
		// @ts-expect-error
		return x & (x - 1) == 0;
	}

	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);

	let level = 0;
	let internalFormat = gl.RGBA;
	let width = 1;
	let height = 1;
	let border = 0;
	let srcFormat = gl.RGBA;
	let srcType = gl.UNSIGNED_BYTE;
	let pixel = new Uint8Array([0, 0, 255, 255]);

	gl.texImage2D(
		gl.TEXTURE_2D,
		level,
		internalFormat,
		width,
		height,
		border,
		srcFormat,
		srcType,
		pixel,
	);

	let image = new Image();
	image.onload = function () {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			level,
			internalFormat,
			srcFormat,
			srcType,
			image,
		);
		if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
			gl.generateMipmap(gl.TEXTURE_2D);
		} else {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		}
	};
	image.src = url;
	return texture;
}

export function setTeaser(
	renderer,
	datasetname,
	epochIndex,
	classes,
	shouldAutoNextEpoch = true,
	timeout = 0,
	callback = undefined,
) {
	setDataset(datasetname, () => {
		renderer.setEpochIndex(epochIndex);
		if (classes.length > 0) {
			renderer.overlay.selectedClasses = new Set(classes);
			renderer.overlay.onSelectLegend(classes);
		} else {
			renderer.overlay.selectedClasses = new Set();
			renderer.overlay.restoreAlpha();
		}

		renderer.shouldAutoNextEpoch = shouldAutoNextEpoch;
		d3.select(renderer.overlay.svg.node().parentElement)
			.select(".play-button")
			.attr("class", () => {
				if (renderer.shouldAutoNextEpoch) {
					return "tooltip play-button fa fa-pause";
				} else {
					return "tooltip play-button fa fa-play";
				}
			});
		if (callback) {
			callback();
		}
	});
}

export function* iterN<T>(it: Iterable<T>, n: number) {
	let i = 0;
	for (let x of it) {
		if (i % n === 0) yield x;
		i++;
	}
}

function getShader(gl: WebGLRenderingContext, shaderScript: string, type: number) {
	var shader = gl.createShader(type)!;
	gl.shaderSource(shader, shaderScript);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		throw new Error("Shader failed to compile");
	}
	return shader;
}

export function initShaders(gl: WebGLRenderingContext, fs: string, vs: string) {
	var fragmentShader = getShader(gl, fs, gl.FRAGMENT_SHADER);
	var vertexShader = getShader(gl, vs, gl.VERTEX_SHADER);
	var program = gl.createProgram()!;
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	return program;
}

export function transpose(m) {
	if (!m.matrix) {
		return "transpose(): trying to transpose a non-matrix";
	}

	var result = [];
	for (var i = 0; i < m.length; ++i) {
		result.push([]);
		for (var j = 0; j < m[i].length; ++j) {
			result[i].push(m[j][i]);
		}
	}

	result.matrix = true;

	return result;
}

export function flatten(v) {
	if (v.matrix === true) {
		v = transpose(v);
	}

	var n = v.length;
	var elemsAreArrays = false;

	if (Array.isArray(v[0])) {
		elemsAreArrays = true;
		n *= v[0].length;
	}

	var floats = new Float32Array(n);

	if (elemsAreArrays) {
		var idx = 0;
		for (var i = 0; i < v.length; ++i) {
			for (var j = 0; j < v[i].length; ++j) {
				floats[idx++] = v[i][j];
			}
		}
	} else {
		for (var i = 0; i < v.length; ++i) {
			floats[i] = v[i];
		}
	}

	return floats;
}
