import * as arrow from "apache-arrow";
import * as d3 from "d3";
import * as math from "mathjs";

import * as utils from "./utils";
import { GrandTour } from "./GrandTour";
import { TeaserOverlay, TeaserOverlayOptions } from "./TeaserOverlay";

import type { ColorRGBA, Renderer } from "./types";

interface Data {
	labels: number[];
	dataTensor: number[][][];
	dmax: number;
	ndim: number;
	npoint: number;
	nepoch: number;
	alphas: number[];
	points?: number[][];
	colors?: ColorRGBA[];
}

interface TeaserRendererOptions {
	epochs: number[];
	epochIndex: number;
	shouldAutoNextEpoch: boolean;
	shouldPlayGrandTour: boolean;
	isFullScreen: boolean;
	overlayKwargs: TeaserOverlayOptions;
	pointSize: number;
}

export class TeaserRenderer implements Renderer {
	framesPerTransition = 30;
	framesPerEpoch = 60;
	scaleTransitionProgress = 0;
	scaleTransitionDelta = 0;
	colorFactor = utils.COLOR_FACTOR;
	isFullScreen = false;
	isDataReady = false;
	shouldRender = true;
	scaleFactor = 1.0;
	s = 1.0;
	mode: "point" = "point";

	id: string;
	epochs: number[];
	epochIndex: number;
	shouldAutoNextEpoch: boolean;
	shouldPlayGrandTour: boolean;
	pointSize: number;
	pointSize0: number;
	overlay: TeaserOverlay;
	sx_span: d3.ScaleLinear<number, number, never>;
	sy_span: d3.ScaleLinear<number, number, never>;
	sz_span: d3.ScaleLinear<number, number, never>;
	sx_center: d3.ScaleLinear<number, number, never>;
	sy_center: d3.ScaleLinear<number, number, never>;
	sz_center: d3.ScaleLinear<number, number, never>;
	sx: d3.ScaleLinear<number, number, never>;
	sy: d3.ScaleLinear<number, number, never>;
	sz?: d3.ScaleLinear<number, number, never>;

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
		opts: Partial<TeaserRendererOptions> = {},
	) {
		this.id = gl.canvas.id;
		this.epochs = opts.epochs ?? [0];
		this.epochIndex = opts.epochIndex ?? this.epochs[0];
		this.shouldAutoNextEpoch = opts.shouldAutoNextEpoch ?? true;
		this.shouldPlayGrandTour = opts.shouldPlayGrandTour ?? true;
		this.pointSize = opts.pointSize ?? 6.0;
		this.pointSize0 = this.pointSize;
		this.overlay = new TeaserOverlay(this, opts.overlayKwargs);

		this.sx_span = d3.scaleLinear();
		this.sy_span = d3.scaleLinear();
		this.sz_span = d3.scaleLinear();
		this.sx_center = d3.scaleLinear();
		this.sy_center = d3.scaleLinear();
		this.sz_center = d3.scaleLinear();
		this.sx = this.sx_center;
		this.sy = this.sy_center;
	}

	setScaleFactor(s: number) {
		this.scaleFactor = s;
	}

	async initData(buffer: ArrayBuffer) {
		let table = arrow.tableFromIPC(buffer);
		let ndim = 5;
		let nepoch = 1;

		let labels = [];
		let arr = [];

		let fields = d3.range(ndim).map((i) => "E" + i);
		let labelMapping = Object.fromEntries(
			["A0", "A1", "B0", "B1", "B2"].map((name, i) => [name, i]),
		);

		for (let row of utils.iterN(table, 10)) {
			labels.push(labelMapping[row.name]);
			for (let field of fields) arr.push(row[field]);
		}

		let npoint = labels.length;
		let shape: [number, number, number] = [nepoch, npoint, ndim];
		let dataTensor = utils.reshape(new Float32Array(arr), shape);

		this.shouldRecalculateColorRect = true;
		this.isDataReady = true;

		this.dataObj = {
			labels,
			dataTensor,
			dmax: 1.05 * math.max(
				math.abs(dataTensor[dataTensor.length - 1]),
			),
			ndim,
			npoint,
			nepoch,
			alphas: d3.range(npoint + 5 * npoint).map(() => 255),
		};

		this.initGL(this.dataObj);

		if (this.isDataReady && this.isPlaying === undefined) {
			// renderer.isPlaying===undefined indicates the renderer on init
			// otherwise it is reloading other dataset
			this.isPlaying = true;
			this.play();
			this.overlay.init();
		}

		if (
			this.isDataReady &&
			(this.animId == null || this.shouldRender == false)
		) {
			this.shouldRender = true;
			// this.shouldRecalculateColorRect = true;
			this.play();
		}
	}

	setFullScreen(shouldSet: boolean) {
		this.isFullScreen = shouldSet;
		let canvas = this.gl.canvas;
		let canvasSelection = d3.select("#" + canvas.id);

		d3.select(canvas.parentNode as HTMLElement)
			.classed("fullscreen", shouldSet);

		canvasSelection.classed("fullscreen", shouldSet);

		utils.resizeCanvas(canvas);
		this.overlay.resize();
		this.gl.uniform1f(this.canvasWidthLoc!, canvas.clientWidth);
		this.gl.uniform1f(this.canvasHeightLoc!, canvas.clientHeight);
		this.gl.viewport(0, 0, canvas.width, canvas.height);
	}

	initGL(dataObj: Data) {
		let program = this.program;
		utils.resizeCanvas(this.gl.canvas);

		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		this.gl.clearColor(...utils.CLEAR_COLOR, 1.0);

		// gl.enable(gl.DEPTH_TEST);
		this.gl.enable(this.gl.BLEND);
		this.gl.disable(this.gl.DEPTH_TEST);
		this.gl.blendFuncSeparate(
			this.gl.SRC_ALPHA,
			this.gl.ONE_MINUS_SRC_ALPHA,
			this.gl.ONE,
			this.gl.ONE_MINUS_SRC_ALPHA,
		);

		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		this.gl.useProgram(program);

		this.colorBuffer = this.gl.createBuffer()!;
		this.colorLoc = this.gl.getAttribLocation(program, "a_color");

		this.positionBuffer = this.gl.createBuffer()!;
		this.positionLoc = this.gl.getAttribLocation(program, "a_position");

		this.pointSizeLoc = this.gl.getUniformLocation(program, "point_size")!;

		this.isDrawingAxisLoc = this.gl.getUniformLocation(
			program,
			"isDrawingAxis",
		)!;

		this.canvasWidthLoc = this.gl.getUniformLocation(program, "canvasWidth")!;
		this.canvasHeightLoc = this.gl.getUniformLocation(program, "canvasHeight")!;
		this.gl.uniform1f(this.canvasWidthLoc, this.gl.canvas.clientWidth);
		this.gl.uniform1f(this.canvasHeightLoc, this.gl.canvas.clientHeight);

		this.modeLoc = this.gl.getUniformLocation(program, "mode")!;
		this.gl.uniform1i(this.modeLoc, 0); // "point" mode

		this.colorFactorLoc = this.gl.getUniformLocation(program, "colorFactor")!;
		this.setColorFactor(this.colorFactor);

		if (this.gt === undefined || this.gt.ndim != dataObj.ndim) {
			this.gt = new GrandTour(dataObj.ndim);
		}
	}

	play(_t = 0) {
		let dt = 0;

		if (
			this.shouldRender &&
			(this.shouldPlayGrandTour || this.shouldAutoNextEpoch)
		) {
			if (this.shouldPlayGrandTour) {
				dt = 1 / 60;
			}

			if (this.shouldAutoNextEpoch) {
				this.s += 1;
				if (this.s % this.framesPerEpoch == 0) {
					this.nextEpoch();
				}
			} else {
				this.setEpochIndex(this.epochIndex);
			}
		}

		if (
			this.isScaleInTransition &&
			this.scaleTransitionProgress <= 1 &&
			this.scaleTransitionProgress >= 0
		) {
			this.scaleTransitionProgress += this.scaleTransitionDelta;
		}

		if (this.shouldRender) {
			this.render(dt);
			this.overlay.redrawAxis();
		}

		this.animId = requestAnimationFrame(this.play.bind(this));
	}

	setColorFactor(f: number) {
		this.colorFactor = f;
		this.gl.uniform1f(this.colorFactorLoc!, f);
	}

	setPointSize(s: number) {
		this.pointSize = s;
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
		if (!this.dataObj || !this.gt) return;

		let dataObj = this.dataObj;
		let data = this.dataObj.dataTensor[this.epochIndex];
		let labels = this.dataObj.labels;

		data = data.concat(utils.createAxisPoints(dataObj.ndim));
		let points = this.gt.project(data, dt);

		if (
			this.epochIndex > 0 &&
			(this.s % this.framesPerEpoch) < this.framesPerTransition
		) {
			let data0 = this.dataObj.dataTensor[this.epochIndex - 1];
			data0 = data0.concat(utils.createAxisPoints(dataObj.ndim));
			let points0 = this.gt.project(data0, dt / this.framesPerTransition);
			points = utils.linearInterpolate(
				points0,
				points,
				(this.s % this.framesPerEpoch) / this.framesPerTransition,
			);
		}

		utils.updateScale_center(
			points,
			this.gl.canvas,
			this.sx_center,
			this.sy_center,
			this.sz_center,
			this.scaleFactor,
			utils.legendLeft[this.overlay.getDataset()] + 15,
			65,
		);

		utils.updateScale_span(
			points,
			this.gl.canvas,
			this.sx_span,
			this.sy_span,
			this.sz_span,
			this.scaleFactor,
			utils.legendLeft[this.overlay.getDataset()] + 15,
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
		this.sz = this.sz_center;

		points = utils.data2canvas(points, this.sx, this.sy, this.sz);

		dataObj.points = points;

		let bgColors = labels.map((d) => utils.bgColors[d]);
		let colors: ColorRGBA[] = labels
			.map((d) => utils.baseColors[d])
			.concat(utils.createAxisColors(dataObj.ndim))
			.map((c, i) => [c[0], c[1], c[2], dataObj.alphas[i]]);

		dataObj.colors = colors;

		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

		this.gl.clearColor(...utils.CLEAR_COLOR, 1.0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer!);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			utils.flatten(points),
			this.gl.STATIC_DRAW,
		);
		this.gl.vertexAttribPointer(
			this.positionLoc!,
			3,
			this.gl.FLOAT,
			false,
			0,
			0,
		);
		this.gl.enableVertexAttribArray(this.positionLoc!);

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer!);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Uint8Array(utils.flatten(colors)),
			this.gl.STATIC_DRAW,
		);
		this.gl.vertexAttribPointer(
			this.colorLoc!,
			4,
			this.gl.UNSIGNED_BYTE,
			true,
			0,
			0,
		);
		this.gl.enableVertexAttribArray(this.colorLoc!);

		let c0 = bgColors.map((c) => [c[0], c[1], c[2], utils.pointAlpha]);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Uint8Array(utils.flatten(c0)),
			this.gl.STATIC_DRAW,
		);

		let c1;
		this.gl.uniform1i(this.isDrawingAxisLoc!, 0);
		this.setPointSize(this.pointSize0 * Math.sqrt(this.scaleFactor));

		this.gl.drawArrays(this.gl.POINTS, 0, dataObj.npoint);
		c1 = colors.map((c, i) => [c[0], c[1], c[2], dataObj.alphas[i]]);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Uint8Array(utils.flatten(c1)),
			this.gl.STATIC_DRAW,
		);

		this.gl.uniform1i(this.isDrawingAxisLoc!, 0);
		this.gl.drawArrays(this.gl.POINTS, 0, dataObj.npoint);

		this.gl.uniform1i(this.isDrawingAxisLoc!, 1);
		this.gl.drawArrays(this.gl.LINES, dataObj.npoint, dataObj.ndim * 2);
	}
}
