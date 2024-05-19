import * as arrow from "apache-arrow";
import * as d3 from "d3";
import * as math from "mathjs";
import * as utils from "./utils";
import { GrandTour } from "./GrandTour";
import { Overlay } from "./Overlay";

import type { ColorRGBA } from "./types";

interface Data {
	labels: number[];
	dataTensor: number[][][];
	dmax: number;
	ndim: number;
	dimLabels: string[];
	npoint: number;
	nepoch: number;
	alphas: number[];
	points?: number[][];
	colors?: ColorRGBA[];
	hexColors: string[];
}

interface RendererOptions {
	epochs: number[];
	epochIndex: number;
	shouldAutoNextEpoch: boolean;
	shouldPlayGrandTour: boolean;
	isFullScreen: boolean;
	pointSize: number;
}

export class Renderer {
	framesPerTransition = 30;
	framesPerEpoch = 60;
	scaleTransitionProgress = 0;
	scaleTransitionDelta = 0;
	colorFactor = 0.9;
	isFullScreen = false;
	shouldRender = true;
	scaleFactor = 1.0;
	n_frames = 1;

	id: string;
	epochs: number[];
	epochIndex: number;
	shouldAutoNextEpoch: boolean;
	shouldPlayGrandTour: boolean;
	#pointSize: number;
	pointSize0: number;
	overlay: Overlay;
	sx_span: d3.ScaleLinear<number, number, never>;
	sy_span: d3.ScaleLinear<number, number, never>;
	sz_span: d3.ScaleLinear<number, number, never>;
	sx_center: d3.ScaleLinear<number, number, never>;
	sy_center: d3.ScaleLinear<number, number, never>;
	sz_center: d3.ScaleLinear<number, number, never>;
	sx: d3.ScaleLinear<number, number, never>;
	sy: d3.ScaleLinear<number, number, never>;
	sz: d3.ScaleLinear<number, number, never>;

	dataObj?: Data;
	shouldRecalculateColorRect?: boolean;
	isPlaying?: boolean;
	animId?: number;
	isScaleInTransition?: boolean;
	isDragging?: boolean;
	shouldPlayGrandTourPrev?: boolean;

	colorBuffer?: WebGLBuffer;
	colorLoc?: number;
	positionBuffer?: WebGLBuffer;
	positionLoc?: number;
	textureCoordBuffer?: WebGLBuffer;
	textureCoordLoc?: number;
	pointSizeLoc?: WebGLUniformLocation;
	isDrawingAxisLoc?: WebGLUniformLocation;
	canvasWidthLoc?: WebGLUniformLocation;
	canvasHeightLoc?: WebGLUniformLocation;
	modeLoc?: WebGLUniformLocation;
	colorFactorLoc?: WebGLUniformLocation;
	gt?: GrandTour;
	shouldCentralizeOrigin?: boolean;

	constructor(
		public gl: WebGLRenderingContext,
		public program: WebGLProgram,
		dataset: string,
		opts: Partial<RendererOptions> = {},
	) {
		let canvas = gl.canvas as HTMLCanvasElement;
		this.id = canvas.id;
		this.epochs = opts.epochs ?? [0];
		this.epochIndex = opts.epochIndex ?? this.epochs[0];
		this.shouldAutoNextEpoch = opts.shouldAutoNextEpoch ?? true;
		this.shouldPlayGrandTour = opts.shouldPlayGrandTour ?? true;
		this.pointSize0 = this.#pointSize = opts.pointSize ?? 6.0;
		this.overlay = new Overlay(this, dataset);

		this.sx_span = d3.scaleLinear();
		this.sy_span = d3.scaleLinear();
		this.sz_span = d3.scaleLinear();
		this.sx_center = d3.scaleLinear();
		this.sy_center = d3.scaleLinear();
		this.sz_center = d3.scaleLinear();
		this.sx = this.sx_center;
		this.sy = this.sy_center;
		this.sz = this.sz_center;
	}

	async initData(
		buffer: ArrayBuffer,
		axisFields: string[],
		labelField: string,
		labelColors?: Object,
		pointAlpha: number = 255,
	) {
		// Load the table
		let table = arrow.tableFromIPC(buffer);
		let ndim = axisFields.length;

		// Categories and colors
		let labelColumn = table.getChild(labelField);
		let categories: string[] = labelColumn ? Array.from(new Set(labelColumn.toArray())) : [];
		categories = categories.sort();
		let cat_to_int = Object.fromEntries(categories.map((name, i) => [name, i]));

		let hexColors;
		if (labelColors) {
			categories = Object.keys(labelColors);
			hexColors = Object.values(labelColors);
		} else {
			hexColors = d3.schemeCategory10.slice();
		}
		let rgbColors = hexColors.map((c) => d3.rgb(c)!);
		let legendData = utils.zip(categories, rgbColors);

		// Point data
		let labels = [];
		let coords = [];
		for (let row of utils.iterN(table, 10)) {
			labels.push(cat_to_int[row[labelField]]);
			for (let field of axisFields) coords.push(row[field]);
		}
		let nepoch = 1;
		let n_points = labels.length;
		let shape: [number, number, number] = [nepoch, n_points, ndim];
		let dataTensor = utils.reshape(new Float32Array(coords), shape);

		// Store the data
		this.dataObj = {
			labels,
			dataTensor,
			dmax: 1.05 * math.max(
				math.abs(dataTensor[dataTensor.length - 1]),
			),
			dimLabels: axisFields,
			ndim,
			npoint: n_points,
			nepoch,
			alphas: Array.from({ length: n_points + ndim * n_points }, () => pointAlpha),
			hexColors
		};

		// Initialize the display and overlay
		this.shouldRecalculateColorRect = true;
		this.initGL(this.dataObj);

		// Start the rendering loop
		if (this.isPlaying === undefined) {
			// renderer.isPlaying===undefined indicates the renderer on init
			// otherwise it is reloading other dataset
			this.isPlaying = true;
			this.play();
			this.overlay.init(legendData);
		}
		if (
			(this.animId == null || this.shouldRender == false)
		) {
			this.shouldRender = true;
			// this.shouldRecalculateColorRect = true;
			this.play();
		}
	}

	setFullScreen(shouldSet: boolean) {
		this.isFullScreen = shouldSet;
		let canvas = this.gl.canvas as HTMLCanvasElement;

		d3.select(canvas.parentNode as HTMLElement)
			.classed("fullscreen", shouldSet);

		d3.select(canvas).classed("fullscreen", shouldSet);

		utils.resizeCanvas(canvas);
		this.overlay.resize();
		this.gl.uniform1f(this.canvasWidthLoc!, canvas.clientWidth);
		this.gl.uniform1f(this.canvasHeightLoc!, canvas.clientHeight);
		this.gl.viewport(0, 0, canvas.width, canvas.height);
	}

	get #clearColor() {
		return this.gl.getParameter(this.gl.COLOR_CLEAR_VALUE) as [
			number,
			number,
			number,
			number,
		];
	}

	initGL(dataObj: Data) {
		let canvas = this.gl.canvas as HTMLCanvasElement;
		utils.resizeCanvas(canvas);

		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		this.gl.clearColor(...this.#clearColor);

		this.gl.enable(this.gl.BLEND);
		this.gl.disable(this.gl.DEPTH_TEST);
		this.gl.blendFuncSeparate(
			this.gl.SRC_ALPHA,
			this.gl.ONE_MINUS_SRC_ALPHA,
			this.gl.ONE,
			this.gl.ONE_MINUS_SRC_ALPHA,
		);

		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		this.gl.useProgram(this.program);

		this.colorBuffer = this.gl.createBuffer()!;
		this.colorLoc = this.gl.getAttribLocation(this.program, "a_color");

		this.positionBuffer = this.gl.createBuffer()!;
		this.positionLoc = this.gl.getAttribLocation(this.program, "a_position");

		this.pointSizeLoc = this.gl.getUniformLocation(this.program, "point_size")!;

		this.isDrawingAxisLoc = this.gl.getUniformLocation(
			this.program,
			"isDrawingAxis",
		)!;

		this.canvasWidthLoc = this.gl.getUniformLocation(
			this.program,
			"canvasWidth",
		)!;
		this.canvasHeightLoc = this.gl.getUniformLocation(
			this.program,
			"canvasHeight",
		)!;
		this.gl.uniform1f(this.canvasWidthLoc, canvas.clientWidth);
		this.gl.uniform1f(this.canvasHeightLoc, canvas.clientHeight);

		this.modeLoc = this.gl.getUniformLocation(this.program, "mode")!;
		this.gl.uniform1i(this.modeLoc, 0); // "point" mode

		this.colorFactorLoc = this.gl.getUniformLocation(
			this.program,
			"colorFactor",
		)!;
		this.setColorFactor(this.colorFactor);

		if (this.gt === undefined || this.gt.ndim != dataObj.ndim) {
			this.gt = new GrandTour(dataObj.ndim);
		}
	}

	/**
	 * Sets up a recursive rendering loop via requestAnimationFrame
	 *
	 * @param _t - this doesn't seem to be used
	 */
	play(_t = 0): void {
		// If we are playing the grand tour, make a time step.
		// If we have played enough frames, update the "epoch" too.
		let dt = 0;
		if (
			this.shouldRender &&
			(this.shouldPlayGrandTour || this.shouldAutoNextEpoch)
		) {
			if (this.shouldPlayGrandTour) {
				dt = 1 / 60;
			}

			if (this.shouldAutoNextEpoch) {
				this.n_frames += 1;
				if (this.n_frames % this.framesPerEpoch == 0) {
					this.nextEpoch();
				}
			} else {
				this.setEpochIndex(this.epochIndex);
			}
		}

		// If we are in a scale transition, update the progress
		if (
			this.isScaleInTransition &&
			this.scaleTransitionProgress <= 1 &&
			this.scaleTransitionProgress >= 0
		) {
			this.scaleTransitionProgress += this.scaleTransitionDelta;
		}

		// Render the current frame
		if (this.shouldRender) {
			this.render(dt);
			this.overlay.redrawAxis();
		}

		// Request the next frame
		this.animId = requestAnimationFrame(this.play.bind(this));
	}

	setColorFactor(f: number) {
		this.colorFactor = f;
		this.gl.uniform1f(this.colorFactorLoc!, f);
	}

	get pointSize() {
		return this.#pointSize;
	}

	set pointSize(s: number) {
		this.#pointSize = s;
		this.gl.uniform1f(this.pointSizeLoc!, s * window.devicePixelRatio);
	}

	pause() {
		if (this.animId) {
			cancelAnimationFrame(this.animId);
			this.animId = undefined;
		}
		this.shouldRender = false;
		console.log("paused");
	}

	setEpochIndex(i: number) {
		this.epochIndex = i;
		this.overlay.epochSlider.property("value", i);
		if (!this.dataObj) return;
		this.overlay.svg.select("#epochIndicator")
			.text(`Epoch: ${this.epochIndex}/${(this.dataObj.nepoch - 1)}`);
	}

	playFromEpoch(epoch: number) {
		this.shouldAutoNextEpoch = true;
		this.setEpochIndex(epoch);
		this.overlay.playButton.attr("class", "tooltip play-button fa fa-pause");
	}

	nextEpoch() {
		if (this.epochs.length == 1) {
			return;
		}

		if (this.epochIndex < this.epochs.length - 1) {
			this.setEpochIndex(this.epochIndex + 1);
		} else {
			this.setEpochIndex(this.epochs[0]);
		}
	}

	prevEpoch() {
		if (this.epochs.length == 1) {
			return;
		}
		if (this.epochIndex > 0) {
			this.setEpochIndex(this.epochIndex - 1);
		} else {
			this.setEpochIndex(this.epochs.length - 1);
		}
	}

	render(dt: number) {
		if (!this.dataObj || !this.gt || !this.gl) return;

		let canvas = this.gl.canvas as HTMLCanvasElement;
		let dataObj = this.dataObj;
		let data = this.dataObj.dataTensor[this.epochIndex];
		let labels = this.dataObj.labels;
		let points = this.gt.project(data, dt);

		let axisData = utils.createAxisPoints(dataObj.ndim);
		let axisPoints = this.gt.project(axisData, dt);
		points = points.concat(axisPoints);

		if (
			this.epochIndex > 0 &&
			(this.n_frames % this.framesPerEpoch) < this.framesPerTransition
		) {
			let data0 = this.dataObj.dataTensor[this.epochIndex - 1];
			data0 = data0.concat(utils.createAxisPoints(dataObj.ndim));
			let points0 = this.gt.project(data0, dt / this.framesPerTransition);
			points = utils.linearInterpolate(
				points0,
				points,
				(this.n_frames % this.framesPerEpoch) / this.framesPerTransition,
			);
		}

		utils.updateScaleCenter(
			points,
			canvas,
			this.sx_center,
			this.sy_center,
			this.sz_center,
			this.scaleFactor,
			utils.legendLeft[this.overlay.dataset as keyof typeof utils.legendLeft] + 15,
			65,
		);

		utils.updateScaleSpan(
			points,
			canvas,
			this.sx_span,
			this.sy_span,
			this.sz_span,
			this.scaleFactor,
			utils.legendLeft[this.overlay.dataset as keyof typeof utils.legendLeft] + 15,
			65,
		);

		let transition;
		if (this.scaleTransitionDelta > 0) {
			transition = (t: number) => Math.pow(t, 0.5);
		} else {
			transition = (t: number) => 1 - Math.pow(1 - t, 0.5);
		}

		this.sx = utils.mixScale(
			this.sx_center,
			this.sx_span,
			this.scaleTransitionProgress,
			transition,
		);

		this.sy = utils.mixScale(
			this.sy_center,
			this.sy_span,
			this.scaleTransitionProgress,
			transition,
		);

		points = utils.data2canvas(points, this.sx, this.sy, this.sz);

		dataObj.points = points;

		let rgbColors = dataObj.hexColors.map((c) => d3.rgb(c)!);
		// let modifiedColors = utils.modifyColors(rgbColors);
		let colors: ColorRGBA[] = labels
			.map((i) => rgbColors[i])
			.concat(utils.createAxisColors(dataObj.ndim))
			.map((c, i) => [c.r, c.g, c.b, dataObj.alphas[i]]);

		dataObj.colors = colors;

		// Do the rendering
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

		// Clear the canvas
		this.gl.clearColor(...this.#clearColor);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

		// Fill the point position buffer and bind it
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer!);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			utils.flatten(points),
			this.gl.STATIC_DRAW,
		);
		this.gl.vertexAttribPointer(this.positionLoc!, 3, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.positionLoc!);

		// Fill the point color buffer and bind it
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer!);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Uint8Array(colors.flat()),
			this.gl.STATIC_DRAW,
		);
		this.gl.vertexAttribPointer(this.colorLoc!, 4, this.gl.UNSIGNED_BYTE, true, 0, 0);
		this.gl.enableVertexAttribArray(this.colorLoc!);

		// Scale the point size and draw the points with the modified colors
		// this.gl.bufferData(
		// 	this.gl.ARRAY_BUFFER,
		// 	new Uint8Array(
		// 		modifiedColors.map((c: { r: number; g: number; b: number; }) => [c.r, c.g, c.b, utils.pointAlpha]).flat(),
		// 	),
		// 	this.gl.STATIC_DRAW,
		// );
		// this.gl.uniform1i(this.isDrawingAxisLoc!, 0);
		this.pointSize = this.pointSize0 * Math.sqrt(this.scaleFactor); // see setter
		// this.gl.drawArrays(this.gl.POINTS, 0, dataObj.npoint);

		// Draw the points with the original colors
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Uint8Array(
				colors.map((c, i) => [c[0], c[1], c[2], dataObj.alphas[i]]).flat(),
			),
			this.gl.STATIC_DRAW,
		);
		this.gl.uniform1i(this.isDrawingAxisLoc!, 0);
		this.gl.drawArrays(this.gl.POINTS, 0, dataObj.npoint);


		// Draw the axes (from the remaining points)
		this.gl.uniform1i(this.isDrawingAxisLoc!, 1);
		this.gl.drawArrays(this.gl.LINES, dataObj.npoint, dataObj.ndim * 2);
	}
}
