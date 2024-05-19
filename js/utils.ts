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

type Matrix = number[][] & { matrix?: true };

// TODO: fail when shape isn't tuple... Right now returns `number`.
type NestedArray<T, Shape extends readonly number[]> = Shape extends
	[infer _, ...infer Rest]
	? Rest extends number[] ? NestedArray<T, Rest>[] : never
	: T;


/**
 * Clamp a value between min and max.
 *
 * @param {number} min
 * @param {number} max
 * @param {number} v
 * @returns {number}
 */
export function clamp(min: number, max: number, v: number) {
	return Math.max(max, Math.min(min, v));
}

/**
 * Zip two arrays together.
 */
export function zip<A, B>(a: A[], b: B[]): [A, B][] {
	let out: [A, B][] = [];
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		out.push([a[i], b[i]]);
	}
	return out;
}

/**
 * Subsample an iterable by a factor of n.
 *
 * @param it
 * @param n
 */
export function* iterN<T>(it: Iterable<T>, n: number) {
	let i = 0;
	for (let x of it) {
		if (i % n === 0) yield x;
		i++;
	}
}

export const baseColors = d3.schemeCategory10.map((c) => d3.rgb(c)!);

export const bgColors = numeric.add(
	numeric.mul(baseColors.map((c) => [c.r, c.g, c.b]), 0.6),
	0.95 * 255 * 0.4,
).map((c: [number, number, number]) => d3.rgb(...c as [number, number, number]));

export function modifyColors(colorList: d3.RGBColor[]) {
	// scale down each RGB channel by 0.6,
	// then add 95% of the full gamut to the remainder of each channel
	return numeric.add(
		numeric.mul(colorList.map((c) => [c.r, c.g, c.b]), 0.6),
		0.95 * 255 * 0.4,
	);
}

/**
 * Interpolates between data1 and data2 by progress p.
 *
 * @param {T} data1
 * @param {T} data2
 * @param {number} p - Progress between 0 and 1.
 * @returns {T} - The interpolated data.
 */
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

/**
 * Interpolates a scale between s0 and s1 by progress (between 0 and 1).
 * Both the domain and range of each scale are interpolated linearly.
 *
 * @param {Scale} s0 - The first scale.
 * @param {Scale} s1 - The second scale.
 * @param {number} progress - The progress of the mix.
 * @param {(t: number) => number} func - A function to update the progress.
 * @returns {Scale} - The mixed scale.
 */
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

	// Clamp progress to [0, 1]
	progress = Math.max(progress, 0);
	progress = Math.min(progress, 1);

	// Update progress with function
	progress = func(progress);

	return d3.scaleLinear()
		.domain(linearInterpolate(domain0, domain1, progress))
		.range(linearInterpolate(range0, range1, progress));
}

/**
 * Transforms the data points from data space to canvas space.
 *
 * @param {points} number[][] - List of x,y,z points in data space.
 * @param {Scale} sx
 * @param {Scale} sy
 * @param {Scale} sz
 * @returns {number[][]} - Transformed points in canvas space.
 */
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

/**
 * Update the scales sx, sy, sz in-place to fit the points on the canvas.
 *
 * @param {number[][]} points - List of x,y,z points in data space.
 * @param {HTMLCanvasElement} canvas
 * @param {d3.ScaleLinear} sx
 * @param {d3.ScaleLinear} sy
 * @param {d3.ScaleLinear} sz
 * @param {number} scaleFactor - Scale the x and y radii by this factor.
 * @param {number | undefined} marginRight
 * @param {number} marginBottom
 * @param {number} marginLeft
 * @param {number} marginTop
 */
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
): void {
	if (marginRight === undefined) {
		marginRight = d3.max(Object.values(legendLeft))! + 15;
	}

	// Find the signed min and max values of the x, y, and z coordinates.
	// Calculate the span of x and y in data space.
	let vmin = math.min(points, 0);
	let vmax = math.max(points, 0);
	let xDataRange = vmax[0] - vmin[0];
	let yDataRange = vmax[1] - vmin[1];

	// Find the midpoints and radii of the x and y axes in canvas space.
	let yMiddle = ((canvas.clientHeight - marginBottom) + marginTop) / 2;
	let yRadius0 = ((canvas.clientHeight - marginBottom) - marginTop) / 2;
	let xMiddle = ((canvas.clientWidth - marginRight) + marginLeft) / 2;
	let xRadius0 = ((canvas.clientWidth - marginRight) - marginLeft) / 2;
	let xRadius = Math.min(xRadius0, yRadius0 / yDataRange * xDataRange);
	let yRadius = Math.min(yRadius0, xRadius0 / xDataRange * yDataRange);

	// Rescale the radii
	xRadius *= scaleFactor;
	yRadius *= scaleFactor;

	// Update the scales
	sy.domain([vmin[1], vmax[1]])
		.range([yMiddle + yRadius, yMiddle - yRadius]);

	sx.domain([vmin[0], vmax[0]])
		.range([xMiddle - xRadius, xMiddle + xRadius]);

	sz.domain([vmin[2], vmax[2]])
		.range([0, 1]);
}

/**
 * Update the scales sx, sy, sz in-place to fit the points on the canvas
 * such that the center of the data is at the center of the canvas.
 *
 * @param {number[][]} points - List of x,y,z points in data space.
 * @param {HTMLCanvasElement} canvas
 * @param {Scale} sx
 * @param {Scale} sy
 * @param {Scale} sz
 * @param {number} scaleFactor
 * @param {number | undefined} marginRight
 * @param {number | undefined} marginBottom
 * @param {number | undefined} marginLeft
 * @param {number | undefined} marginTop
 */
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

	// Find the symmetric spans of the x, y coordinates in data space
	// such that the origin is in the center of the canvas.
	let vmax = math.max(math.abs(points), 0);
	let vmin = numeric.neg(vmax);

	// Find the midpoints and radii of the x and y axes in canvas space.
	let xDataRange = 2 * vmax[0];
	let yDataRange = 2 * vmax[1];
	let yMiddle = ((canvas.clientHeight - marginBottom) + marginTop) / 2;
	let yRadius0 = ((canvas.clientHeight - marginBottom) - marginTop) / 2;
	let xMiddle = ((canvas.clientWidth - marginRight) + marginLeft) / 2;
	let xRadius0 = ((canvas.clientWidth - marginRight) - marginLeft) / 2;
	let xRadius = Math.min(xRadius0, yRadius0 / yDataRange * xDataRange);
	let yRadius = Math.min(yRadius0, xRadius0 / xDataRange * yDataRange);

	// Rescale the radii
	xRadius *= scaleFactor;
	yRadius *= scaleFactor;

	// Update the scales
	sx.domain([vmin[0], vmax[0]])
		.range([xMiddle - xRadius, xMiddle + xRadius]);

	sy.domain([vmin[1], vmax[1]])
		.range([yMiddle + yRadius, yMiddle - yRadius]);

	sz.domain([vmin[2], vmax[2]])
		.range([0, 1]);
}

/**
 * Resize the canvas to match the physical display pixels.
 *
 * Notes:
 * - `canvas.width` and `canvas.height` give the drawing coordinate system of
 *  the canvas in abstract "pixels". This differs from both CSS pixels and
 *  physical pixels. We want to set the canvas grid to match the physical pixels
 *  of the display.
 * - `canvas.style.width` and `canvas.style.height` are the CSS dimensions of
 *  the canvas, excluding padding, in CSS pixels or other units (writable).
 * - `canvas.clientWidth` and `canvas.clientHeight` are the CSS dimensions of
 *  the canvas, including padding, in CSS pixels (readonly).
 *
 * @param {HTMLCanvasElement} canvas
 */
export function resizeCanvas(canvas: HTMLCanvasElement) {
	// Ratio of physical pixels to CSS pixels for the device
	let DPR = window.devicePixelRatio;

	// Get the width and height of the canvas in physical pixels
	let displayWidth = DPR * canvas.clientWidth;
	let displayHeight = DPR * canvas.clientHeight;

	// If the canvas grid is not the same size, make it the same size
	if (
		canvas.width != displayWidth || canvas.height != displayHeight
	) {
		canvas.width = displayWidth;
		canvas.height = displayHeight;
	}

	// Set the CSS width and height to clientWidth and clientHeight
	// Not sure why we need to do this -- should be the same if padding is 0
	// Maybe just to sync the units?
	canvas.style.width = String(canvas.clientWidth);
	canvas.style.height = String(canvas.clientHeight);
}

/**
 * Create a list of origin + unit point vectors for each axis.
 *
 * @param {number} ndim - Number of axes.
 * @returns {number[][]}
 */
export function createAxisPoints(ndim: number) {
	// Make a (ndim, ndim) identity matrix
	let res = (math.identity(ndim) as math.Matrix).toArray();

	// Insert a row of zeros before each identity row
	for (let i = ndim - 1; i >= 0; i--) {
		let zeros = (math.zeros(ndim) as math.Matrix).toArray() as number[];
		res.splice(i, 0, zeros);
	}

	// Return as points
	return res as number[][];
}

/**
 * Map each axis point to the color gray.
 *
 * @param {number} ndim - Number of axes.
 * @returns {d3.RGBColor[]}
 */
export function createAxisColors(ndim: number) {
	const gray = d3.rgb(150, 150, 150);
	return Array.from({ length: ndim * 2 }, () => gray);
}

/**
 * Transpose a matrix.
 *
 * @param {Matrix} m - A "matrix" (a list of lists with a property .matrix=true).
 * @returns {Matrix}
 */
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

/**
 * Flatten a matrix into a Float32Array.
 *
 * @param {Matrix} v - A matrix.
 * @returns {Float32Array}
 */
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

/**
 * Generic function to reshape a flat array into a nested array (tensor).
 *
 * @param {ArrayLike} array - has a length property.
 * @param {number[]} shape - a shape tuple.
 * @returns
 */
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

/**
 * Gram-Schmidt orthogonalization.
 * Makes the row vectors in the matrix pairwise orthogonal.
 *
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function orthogonalize<M extends number[][] | number[][][]>(
	matrix: M,
	priorityRowIndex = 0,
): M {
	function proj(u: M[number], v: M[number]): M[number] {
		return numeric.mul(numeric.dot(u, v) / numeric.dot(u, u), u);
	}

	function normalize(v: M[number], unitlength = 1): M[number] {
		if (numeric.norm2(v) <= 0) {
			return v;
		} else {
			return numeric.div(v, numeric.norm2(v) / unitlength);
		}
	}

	let priorityRow = matrix[priorityRowIndex];
	let firstRow = matrix[0] as M[number];
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



// GL crap

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
