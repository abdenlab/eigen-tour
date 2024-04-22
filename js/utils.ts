import * as d3 from "d3";
import * as math from "mathjs";

import type { Scale } from "./types";
import numeric from "./lib/numeric";

export const CLEAR_COLOR = d3.rgb(0, 0, 0, 0);
export let dataset = "mnist";
export const pointAlpha = 255 * 0.1;

//legend of teaser, grand tour plots
export const legendLeft = { "mnist": 70 };

export const legendRight = { "mnist": 2 };

export const legendTitle = { "mnist": "Name" };

export function clamp(min: number, max: number, v: number) {
	return Math.max(max, Math.min(min, v));
}

export function mixScale(
	s0: Scale,
	s1: Scale,
	progress: number,
	func: (t: number) => number,
) {
	let range0 = s0.range();
	let range1 = s1.range();

	let domain0 = s0.domain();
	let domain1 = s1.domain();
	progress = Math.max(progress, 0);
	progress = Math.min(progress, 1);
	progress = func(progress);

	return d3.scaleLinear()
		.domain(linearInterpolate(domain0, domain1, progress))
		.range(linearInterpolate(range0, range1, progress));
}

export function data2canvas(
	points: number[][],
	sx: Scale,
	sy: Scale,
	sz: Scale,
) {
	points = points.map((row) => {
		return [sx(row[0]), sy(row[1]), sz(row[2])];
	});
	return points;
}

export function updateScaleSpan(
	points: number[][],
	canvas: HTMLCanvasElement,
	sx: d3.ScaleLinear<number, number, never>,
	sy: d3.ScaleLinear<number, number, never>,
	sz: d3.ScaleLinear<number, number, never>,
	scaleFactor = 1.0,
	marginRight?: number,
	marginBottom = 65,
	marginLeft = 32,
	marginTop = 22,
) {
	if (marginRight === undefined) {
		marginRight = d3.max(Object.values(legendLeft))! + 15;
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

export function updateScaleCenter(
	points: number[][],
	canvas: HTMLCanvasElement,
	sx: Scale,
	sy: Scale,
	sz: Scale,
	scaleFactor = 1.0,
	marginRight?: number,
	marginBottom?: number,
	marginLeft?: number,
	marginTop?: number,
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
		marginRight = d3.max(Object.values(legendLeft))! + 15;
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

export function embed<T>(matrix: T[][], canvas: T[][]) {
	for (let i = 0; i < matrix.length; i++) {
		for (let j = 0; j < matrix[0].length; j++) {
			canvas[i][j] = matrix[i][j];
		}
	}
	return canvas;
}

export function getDataset() {
	return dataset;
}

export function getLabelNames(_adversarial = false, dataset?: string) {
	if (dataset === undefined) {
		dataset = getDataset();
	}
	let res;
	if (dataset == "mnist") {
		res = ["A0", "A1", "B0", "B1", "B2"];
	} else {
		throw new Error("Unrecognized dataset " + dataset);
	}
	return res;
}

export function initGL(canvas: HTMLCanvasElement, fs: string, vs: string) {
	let gl = canvas.getContext("webgl", { premultipliedAlpha: false })!;
	let program = createProgram(gl, fs, vs);
	return { gl, program };
}

export function createLoadingBanner(sel: d3.Selection<any, any, any, any>) {
	let banner = sel.selectAll(".banner")
		.data([0])
		.enter()
		.append("div")
		.attr("class", "banner");

	let bannerText = banner
		.selectAll(".bannerText")
		.data([0])
		.enter()
		.append("p")
		.attr("class", "bannerText");

	// render loop
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

	return () => {
		banner.remove();
	};
}

// TODO: fail when shape isn't tuple... Right now returns `number`.
type NestedArray<T, Shape extends readonly number[]> = Shape extends
	[infer _, ...infer Rest]
	? Rest extends number[] ? NestedArray<T, Rest>[] : never
	: T;

export function reshape<Item, Shape extends readonly number[]>(
	array: ArrayLike<Item>,
	shape: Shape,
): NestedArray<Item, Shape> {
	let res = [];
	if (shape.length == 2) {
		for (let row = 0; row < shape[0]; row++) {
			res.push([]);
			for (let col = 0; col < shape[1]; col++) {
				// @ts-expect-error
				res[res.length - 1].push(array[shape[1] * row + col]);
			}
		}
	} else {
		let blocksize = math.prod(shape.slice(1));
		for (let i = 0; i < shape[0]; i++) {
			res.push(
				reshape(
					// @ts-expect-error
					array.slice(i * blocksize, (i + 1) * blocksize),
					shape.slice(1),
				),
			);
		}
	}
	return res as any;
}

export function resizeCanvas(canvas: HTMLCanvasElement) {
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
	canvas.style.width = String(canvas.clientWidth);
	canvas.style.height = String(canvas.clientHeight);
}

export const baseColors = d3.schemeCategory10.map((c) => d3.rgb(c)!);

export const bgColors = numeric.add(
	numeric.mul(baseColors.map((c) => [c.r, c.g, c.b]), 0.6),
	0.95 * 255 * 0.4,
).map((c) => d3.rgb(...c as [number, number, number]));

export function createAxisPoints(ndim: number) {
	let res = (math.identity(ndim) as math.Matrix).toArray();
	for (let i = ndim - 1; i >= 0; i--) {
		let zeros = (math.zeros(ndim) as math.Matrix).toArray() as number[];
		res.splice(i, 0, zeros);
	}
	return res as number[][];
}

export function createAxisColors(ndim: number) {
	const gray = d3.rgb(150, 150, 150);
	return Array.from({ length: ndim * 2 }, () => gray);
}

export function linearInterpolate<T extends math.MathType>(
	data1: T,
	data2: T,
	p: number,
) {
	let a = math.multiply(data1, 1 - p) as T;
	let b = math.multiply(data2, p) as T;
	let res = math.add(a, b);
	return res;
}

export function orthogonalize<M extends number[][] | number[][][]>(
	matrix: M,
	priorityRowIndex = 0,
): M {
	// make row vectors in matrix pairwise orthogonal;

	function proj(u: M[number], v: M[number]): M[number] {
		// @ts-expect-error
		return numeric.mul(numeric.dot(u, v) / numeric.dot(u, u), u);
	}

	function normalize(v: M[number], unitlength = 1): M[number] {
		if (numeric.norm2(v) <= 0) {
			return v;
		} else {
			// @ts-expect-error
			return numeric.div(v, numeric.norm2(v) / unitlength);
		}
	}

	// Gram–Schmidt orthogonalization
	let priorityRow = matrix[priorityRowIndex];
	let firstRow = matrix[0] as M[number];
	matrix[0] = priorityRow;
	matrix[priorityRowIndex] = firstRow;

	matrix[0] = normalize(matrix[0]);
	for (let i = 1; i < matrix.length; i++) {
		for (let j = 0; j < i; j++) {
			// @ts-expect-error
			matrix[i] = numeric.sub(matrix[i], proj(matrix[j], matrix[i]));
		}
		matrix[i] = normalize(matrix[i]);
	}
	let tempRow = matrix[0];
	matrix[0] = matrix[priorityRowIndex];
	matrix[priorityRowIndex] = tempRow;
	return matrix;
}

export function* iterN<T>(it: Iterable<T>, n: number) {
	let i = 0;
	for (let x of it) {
		if (i % n === 0) yield x;
		i++;
	}
}

function compileShader(
	gl: WebGLRenderingContext,
	shaderScript: string,
	type: number,
) {
	let shader = gl.createShader(type)!;
	gl.shaderSource(shader, shaderScript);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		throw new Error("Shader failed to compile");
	}
	return shader;
}

export function createProgram(
	gl: WebGLRenderingContext,
	fs: string,
	vs: string,
) {
	let fragmentShader = compileShader(gl, fs, gl.FRAGMENT_SHADER);
	let vertexShader = compileShader(gl, vs, gl.VERTEX_SHADER);
	let program = gl.createProgram()!;
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	return program;
}

type Matrix = number[][] & { matrix?: true };

export function transpose(m: Matrix) {
	if (!m.matrix) {
		throw new Error("transpose(): trying to transpose a non-matrix");
	}

	var result = [] as unknown as Matrix;
	for (var i = 0; i < m.length; ++i) {
		result.push([]);
		for (var j = 0; j < m[i].length; ++j) {
			result[i].push(m[j][i]);
		}
	}

	result.matrix = true;

	return result;
}

export function flatten(v: Matrix) {
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
			// @ts-expect-error
			floats[i] = v[i];
		}
	}

	return floats;
}

export function zip<A, B>(a: A[], b: B[]): [A, B][] {
	let out: [A, B][] = [];
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		out.push([a[i], b[i]]);
	}
	return out;
}

export function loadScript(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let script = document.createElement("script");
		script.type = "text/javascript";
		script.src = url;
		script.onload = () => resolve();
		script.onerror = (err) => reject(err);
		document.head.appendChild(script);
	});
}
