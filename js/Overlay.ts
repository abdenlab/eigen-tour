import * as d3 from "d3";
import * as utils from "./utils";
import { Legend } from "./Legend";

import type { Renderer } from "./Renderer";

export class Overlay {
	figure: d3.Selection<HTMLElement, unknown, null, undefined>;
	epochSlider: d3.Selection<HTMLInputElement, unknown, null, undefined>;
	playButton: d3.Selection<HTMLElement, unknown, null, undefined>;
	fullScreenButton: d3.Selection<HTMLElement, unknown, null, undefined>;
	grandtourButton: d3.Selection<HTMLElement, unknown, null, undefined>;
	epochIndicator: d3.Selection<SVGTextElement, unknown, null, undefined>;
	svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	anchorRadius?: number;
	annotate?: (renderer: Renderer) => void;
	legend?: Legend;
	anchors?: d3.Selection<SVGGElement, string, SVGSVGElement, unknown>;
	#dataset: string;

	constructor(public renderer: Renderer, dataset: string) {
		let canvas = renderer.gl.canvas as HTMLCanvasElement;
		this.figure = d3.select(canvas.parentNode as HTMLElement);
		let self = this;
		this.#dataset = dataset;

		this.epochSlider = this.figure
			.insert("input", ":first-child")
			.attr("type", "range")
			.attr("class", "slider epochSlider")
			.attr("min", renderer.epochs[0])
			.attr("max", renderer.epochs[renderer.epochs.length - 1])
			.attr("value", renderer.epochIndex)
			.on("input", function() {
				let value = d3.select(this).property("value");
				renderer.shouldAutoNextEpoch = false;
				renderer.setEpochIndex(parseInt(value));
				// renderer.render(0);
				self.playButton.attr("class", "tooltip play-button fa fa-play");
				self.playButton.select("span").text("Play training");
			});

		this.playButton = this.figure
			.insert("i", ":first-child")
			.attr(
				"class",
				"play-button tooltip fa " +
				(renderer.shouldAutoNextEpoch ? "fa-pause" : "fa-play"),
			)
			.on("mouseover", function() {
				d3.select(this).style("opacity", 1);
			})
			.on("mouseout", function() {
				d3.select(this).style("opacity", 0.7);
			})
			.on("click", function() {
				renderer.shouldAutoNextEpoch = !renderer.shouldAutoNextEpoch;
				if (renderer.shouldAutoNextEpoch) {
					d3.select(this).attr("class", "tooltip play-button fa fa-pause");
					d3.select(this).select("span").text("Pause training");
				} else {
					d3.select(this).attr("class", "tooltip play-button fa fa-play");
					d3.select(this).select("span").text("Play training");
				}
			});

		this.playButton.append("span")
			.attr("class", "tooltipText")
			.text("Pause training");

		if (renderer.epochs.length <= 1) {
			this.playButton.style("display", "none");
		}

		this.fullScreenButton = this.figure
			.insert("i", ":first-child")
			.attr("class", "tooltip teaser-fullscreenButton fas fa-expand-arrows-alt")
			.on("mouseover", function() {
				d3.select(this).style("opacity", 0.7);
			})
			.on("mouseout", function() {
				d3.select(this).style("opacity", renderer.isFullScreen ? 0.7 : 0.3);
			})
			.on("click", function() {
				renderer.setFullScreen(!renderer.isFullScreen);
				d3.select(this).style("opacity", renderer.isFullScreen ? 0.7 : 0.3);
			});

		this.fullScreenButton.append("span")
			.attr("class", "tooltipTextBottom")
			.text("Toggle fullscreen");

		this.grandtourButton = this.figure
			.insert("i", ":first-child")
			.attr("class", "teaser-grandtourButton tooltip fas fa-globe-americas")
			.attr("width", 32)
			.attr("height", 32)
			.style("opacity", renderer.shouldPlayGrandTour ? 0.7 : 0.3)
			.on("mouseover", function() {
				d3.select(this).style("opacity", 0.7);
			})
			.on("mouseout", function() {
				d3.select(this).style(
					"opacity",
					renderer.shouldPlayGrandTour ? 0.7 : 0.3,
				);
			});

		this.grandtourButton.append("span")
			.attr("class", "tooltipText")
			.text("Pause Grand Tour");

		this.grandtourButton
			.on("click", function() {
				renderer.shouldPlayGrandTour = !renderer.shouldPlayGrandTour;
				renderer.shouldCentralizeOrigin = renderer.shouldPlayGrandTour;

				renderer.isScaleInTransition = true;
				renderer.scaleFactor = 1.0;
				renderer.scaleTransitionProgress = renderer.shouldCentralizeOrigin
					? Math.min(1, renderer.scaleTransitionProgress)
					: Math.max(0, renderer.scaleTransitionProgress);

				let dt = 0.03;
				renderer.scaleTransitionDelta = renderer.shouldCentralizeOrigin
					? -dt
					: dt;

				if (renderer.shouldPlayGrandTour) {
					d3.select(this).select("span").text("Pause Grand Tour");
					d3.select(this).style("opacity", 0.7);
				} else {
					d3.select(this).select("span").text("Play Grand Tour");
					d3.select(this).style("opacity", 0.3);
				}
			});
		this.svg = this.figure
			.insert("svg", ":first-child")
			.attr("class", "overlay")
			.attr("width", this.width)
			.attr("height", this.height)
			.on("dblclick", function() {
				// renderer.shouldPlayGrandTour = !renderer.shouldPlayGrandTour;
			})
			.on("mousemove", () => {
				//handle unsuccessful onscreen event
				if (renderer.shouldRender == false) {
					renderer.shouldRender = true;
					if (renderer.animId === null) {
						renderer.play();
					}
				}
			});

		this.epochIndicator = this.svg.append("text")
			.attr("id", "epochIndicator")
			.attr("text-anchor", "middle")
			.text(`Epoch: ${renderer.epochIndex}/99`);

		//special treatment when showing only one peoch
		if (renderer.epochs.length <= 1) {
			this.epochSlider.style("display", "none");
			this.epochIndicator.style("display", "none");
		}
	}

	get width() {
		let canvas = this.renderer.gl.canvas as HTMLCanvasElement;
		return canvas.clientWidth;
	}

	get height() {
		let canvas = this.renderer.gl.canvas as HTMLCanvasElement;
		return canvas.clientHeight;
	}

	get dataset() {
		return this.#dataset;
	}

	resize() {
		this.svg.attr("width", this.width);
		this.svg.attr("height", this.height);

		this.legend?.resize();

		this.anchorRadius = utils.clamp(
			7,
			10,
			Math.min(this.width, this.height) / 50,
		);
		this.anchors?.attr("r", this.anchorRadius);

		let sliderLeft = parseFloat(this.epochSlider.style("left"));
		let sliderWidth = parseFloat(this.epochSlider.style("width"));
		let sliderMiddle = sliderLeft + sliderWidth / 2;

		if (sliderMiddle) {
			this.epochIndicator
				.attr("x", sliderMiddle)
				.attr("y", this.height - 35);
		}

		if (this.renderer.epochs.length <= 1) {
			this.epochIndicator
				.attr("x", this.width / 2 - 10)
				.attr("y", this.height - 20);
		}
	}

	init(legendData: [string, d3.RGBColor][]) {
		this.initLegend(legendData);
		this.resize();
		this.drawAxes();
		if (this.annotate !== undefined) {
			this.annotate(this.renderer);
		}
	}

	drawAxes() {
		let { svg, renderer } = this;
		if (!renderer.dataObj) {
			throw Error("dataObj must be defined");

		}

		this.anchors = svg.selectAll(".anchor")
			.data(renderer.dataObj.dimLabels)
			.enter()
			.append("g")
			.attr("class", "anchor")
			.attr(
				"transform",
				() => `translate(${this.renderer.sx(0)}, ${this.renderer.sy(0)})`,
			);

		this.anchors
			.append("circle")
			.attr("r", this.anchorRadius!)
			.attr("opacity", 0.2)
			.attr("stroke", "white")
			.style("cursor", "pointer");

		this.anchors
			.append("text")
			.attr("text-anchor", "middle")
			.attr("fill", "black")
			// .attr("x", "black")
			.text((label) => label);

		let self = this;
		let drag = d3.drag<SVGGElement, string, unknown>()
			.on("start", () => {
				renderer.shouldPlayGrandTourPrev = renderer.shouldPlayGrandTour;
				renderer.shouldPlayGrandTour = false;
				renderer.isDragging = true;
			})
			.on("drag", function(event) {
				if (!renderer.gt) return;
				let dx = renderer.sx.invert(event.dx) - renderer.sx.invert(0);
				let dy = renderer.sy.invert(event.dy) - renderer.sy.invert(0);
				let matrix = renderer.gt.getMatrix();
				let i = self.anchors!.nodes().indexOf(this);
				matrix[i][0] += dx;
				matrix[i][1] += dy;
				matrix = utils.orthogonalize(matrix, i);
				renderer.gt.setMatrix(matrix);
				self.redrawAxis();
			})
			.on("end", function() {
				renderer.isDragging = false;
				renderer.shouldPlayGrandTour = renderer.shouldPlayGrandTourPrev ??
					false;
				delete renderer.shouldPlayGrandTourPrev;
			});

		this.anchors
			.on("mouseover", () => {
				if (!renderer.gt) return;
				renderer.gt.STEPSIZE_PREV = renderer.gt.STEPSIZE;
				renderer.gt.STEPSIZE = renderer.gt.STEPSIZE * 0.2;
			})
			.on("mouseout", () => {
				if (renderer.gt?.STEPSIZE_PREV === undefined) return;
				renderer.gt.STEPSIZE = renderer.gt.STEPSIZE_PREV;
				delete renderer.gt.STEPSIZE_PREV;
			})
			.call(drag);
	}

	redrawAxis() {
		if (this.renderer.gt === undefined) return;
		let { ndim = 10 } = this.renderer.dataObj ?? {};
		let identity = Array.from({ length: ndim }, (_, i) => {
			return Array.from({ length: ndim }, (_, j) => i === j ? 1 : 0)
		})
		let handlePos = this.renderer.gt.project(identity);
		this.anchors
			?.attr("transform", (_, i) => {
				let [x, y] = handlePos[i];
				return `translate(${this.renderer.sx(x)}, ${this.renderer.sy(y)})`;
			});
	}

	initLegend(legendData: [string, d3.RGBColor][]) {
		this.legend = new Legend(legendData, {
			root: this.svg,
			title: utils.legendTitle[this.dataset as keyof typeof utils.legendTitle],
			margin: {
				left: utils.legendLeft[this.dataset as keyof typeof utils.legendLeft],
				right: utils.legendRight[this.dataset as keyof typeof utils.legendRight],
			},
		});
		this.legend.on("select", (classes) => {
			if (!this.renderer.dataObj) return;
			let { npoint, labels, alphas } = this.renderer.dataObj;
			for (let i = 0; i < npoint; i++) {
				alphas[i] = classes.has(labels[i]) ? 255 : 0;
			}
		});
		this.legend.on("mouseout", (classes) => {
			if (!this.renderer.dataObj) return;
			let { npoint, labels, alphas } = this.renderer.dataObj;
			if (classes.size === 0) {
				for (let i = 0; i < npoint; i++) {
					alphas[i] = 255;
				}
				return;
			}
			for (let i = 0; i < npoint; i++) {
				alphas[i] = classes.has(labels[i]) ? 255 : 0;
			}
		});
	}
}
