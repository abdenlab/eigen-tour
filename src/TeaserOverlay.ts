// @ts-check
import * as d3 from "d3";
import * as math from "mathjs";
import * as utils from "./utils";

import type { TeaserRenderer } from "./TeaserRenderer";
import { ColorRGB, Scale } from "./types";

export interface TeaserOverlayOptions {}

export class TeaserOverlay {
	selectedClasses: Set<number>;
	figure: d3.Selection<d3.BaseType, unknown, HTMLElement, any>;
	epochSlider: d3.Selection<HTMLInputElement, unknown, HTMLElement, any>;
	playButton: d3.Selection<HTMLElement, unknown, HTMLElement, any>;
	fullScreenButton: d3.Selection<HTMLElement, unknown, HTMLElement, any>;
	grandtourButton: d3.Selection<HTMLElement, unknown, HTMLElement, any>;
	svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> & {
		sc?: (color: number) => string;
		anchors?: d3.Selection<
			SVGCircleElement,
			[number, number],
			SVGSVGElement,
			unknown
		>;
		drag?: d3.DragBehavior<SVGElement, [number, number], unknown>;
	};
	epochIndicator: d3.Selection<SVGTextElement, unknown, HTMLElement, any>;

	anchorRadius?: number;
	annotate?: (renderer: TeaserRenderer) => void;

	legendBox?: d3.Selection<SVGRectElement, number, SVGSVGElement, unknown>;
	legendTitle?: d3.Selection<SVGTextElement, string, SVGSVGElement, unknown>;
	legendTitleBg?: d3.Selection<SVGRectElement, number, SVGSVGElement, unknown>;
	legendMark?: d3.Selection<
		SVGCircleElement,
		d3.RGBColor,
		SVGSVGElement,
		unknown
	>;
	legendText?: d3.Selection<SVGTextElement, string, SVGSVGElement, unknown>;

	legend_sx?: Scale;
	legend_sy?: Scale;

	constructor(
		public renderer: TeaserRenderer,
		_opts: Partial<TeaserOverlayOptions> = {},
	) {
		this.selectedClasses = new Set();
		this.renderer = renderer;

		let figure = d3.select("d-figure." + renderer.gl.canvas.id);
		this.figure = figure;

		let self = this;
		this.epochSlider = figure
			.insert("input", ":first-child")
			.attr("type", "range")
			.attr("class", "slider epochSlider")
			.attr("min", renderer.epochs[0])
			.attr("max", renderer.epochs[renderer.epochs.length - 1])
			.attr("value", renderer.epochIndex)
			.on("input", function () {
				let value = d3.select(this).property("value");
				renderer.shouldAutoNextEpoch = false;
				renderer.setEpochIndex(parseInt(value));
				// renderer.render(0);
				self.playButton.attr("class", "tooltip play-button fa fa-play");
				self.playButton.select("span").text("Play training");
			});

		this.playButton = figure
			.insert("i", ":first-child")
			.attr(
				"class",
				"play-button tooltip fa " +
					(renderer.shouldAutoNextEpoch ? "fa-pause" : "fa-play"),
			)
			.on("mouseover", function () {
				d3.select(this).style("opacity", 1);
			})
			.on("mouseout", function () {
				d3.select(this).style("opacity", 0.7);
			})
			.on("click", function () {
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

		this.fullScreenButton = figure
			.insert("i", ":first-child")
			.attr("class", "tooltip teaser-fullscreenButton fas fa-expand-arrows-alt")
			.on("mouseover", function () {
				d3.select(this).style("opacity", 0.7);
			})
			.on("mouseout", function () {
				d3.select(this).style("opacity", renderer.isFullScreen ? 0.7 : 0.3);
			})
			.on("click", function () {
				renderer.setFullScreen(!renderer.isFullScreen);
				d3.select(this).style("opacity", renderer.isFullScreen ? 0.7 : 0.3);
			});

		this.fullScreenButton.append("span")
			.attr("class", "tooltipTextBottom")
			.text("Toggle fullscreen");

		this.grandtourButton = figure
			.insert("i", ":first-child")
			.attr("class", "teaser-grandtourButton tooltip fas fa-globe-americas")
			.attr("width", 32)
			.attr("height", 32)
			.style("opacity", renderer.shouldPlayGrandTour ? 0.7 : 0.3)
			.on("mouseover", function () {
				d3.select(this).style("opacity", 0.7);
			})
			.on("mouseout", function () {
				d3.select(this).style(
					"opacity",
					renderer.shouldPlayGrandTour ? 0.7 : 0.3,
				);
			});

		this.grandtourButton.append("span")
			.attr("class", "tooltipText")
			.text("Pause Grand Tour");

		this.grandtourButton
			.on("click", function () {
				renderer.shouldPlayGrandTour = !renderer.shouldPlayGrandTour;
				renderer.shouldCentralizeOrigin = renderer.shouldPlayGrandTour;

				renderer.isScaleInTransition = true;
				renderer.setScaleFactor(1.0);
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

		this.svg = figure
			.insert("svg", ":first-child")
			.attr("class", "overlay")
			.attr("width", this.width)
			.attr("height", this.height)
			.on("dblclick", function () {
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

	get canvas() {
		return this.renderer.gl.canvas;
	}

	get width() {
		return this.canvas.clientWidth;
	}

	get height() {
		return this.canvas.clientHeight;
	}

	getDataset() {
		return utils.getDataset() as keyof typeof utils.legendTitle;
	}

	updateArchorRadius(mode: string) {
		if (mode == "point") {
			this.anchorRadius = utils.clamp(
				7,
				10,
				Math.min(this.width, this.height) / 50,
			);
		} else {
			this.anchorRadius = utils.clamp(
				7,
				15,
				Math.min(this.width, this.height) / 30,
			);
		}
		this.svg.selectAll(".anchor")
			.attr("r", this.anchorRadius);
	}

	resize() {
		let width = this.renderer.gl.canvas.clientWidth;
		let height = this.renderer.gl.canvas.clientHeight;
		this.svg.attr("width", width);
		this.svg.attr("height", height);
		this.initLegendScale();
		this.updateArchorRadius(this.renderer.mode);
		this.repositionAll();
	}

	repositionAll() {
		let width = +this.svg.attr("width");
		let height = +this.svg.attr("height");

		let sliderLeft = parseFloat(this.epochSlider.style("left"));
		let sliderWidth = parseFloat(this.epochSlider.style("width"));
		let sliderMiddle = sliderLeft + sliderWidth / 2;

		this.epochIndicator
			.attr("x", sliderMiddle)
			.attr("y", height - 35);

		if (this.renderer.epochs.length <= 1) {
			this.epochIndicator
				.attr("x", width / 2 - 10)
				.attr("y", height - 20);
		}

		if (!(this.legend_sx && this.legend_sy)) return;

		let r = (this.legend_sy(1) - this.legend_sy(0)) / 4;

		this.legendMark
			?.attr("cx", this.legend_sx(0.001) + 2.5 * r)
			.attr("cy", (_, i) => this.legend_sy!(i + 0.5))
			.attr("r", r);

		this.legendText
			?.attr("x", +this.legend_sx(0.0) + 2.5 * r + 2.5 * r)
			.attr("y", (_, i) => this.legend_sy!(i + 0.5));

		this.legendBox
			?.attr("x", this.legend_sx.range()[0])
			.attr("y", this.legend_sy(-1))
			.attr("width", this.legend_sx.range()[1] - this.legend_sx.range()[0])
			.attr(
				"height",
				this.legend_sy(utils.getLabelNames().length + 1) - this.legend_sy(-1),
			)
			.attr("rx", r);

		if (this.legendTitle !== undefined) {
			this.legendTitle
				.attr("x", this.legend_sx(0.5))
				.attr("y", this.legend_sy(-1))
				.text(utils.legendTitle[this.getDataset()] || "");

			let rectData = this.legendTitle.node()!.getBBox();
			let padding = 2;
			this.legendTitleBg!
				.attr("x", rectData.x - padding)
				.attr("y", rectData.y - padding)
				.attr("width", rectData.width + 2 * padding)
				.attr("height", rectData.height + 2 * padding)
				.attr("opacity", utils.legendTitle[this.getDataset()] ? 1 : 0);
		}
	}

	init() {
		let labels = utils.getLabelNames(false, this.getDataset());
		let colors = utils.baseColors.slice(0, labels.length);
		this.initLegend(colors, labels);
		this.resize();
		this.initAxisHandle();
		if (this.annotate !== undefined) {
			this.annotate(this.renderer);
		}
	}

	initAxisHandle() {
		this.svg.sc = d3.interpolateGreys;
		this.drawAxes();
	}

	drawAxes() {
		let svg = this.svg;
		let ndim = this.renderer.dataObj?.ndim || 10;
		let renderer = this.renderer;

		let mat = math.zeros(ndim, ndim);
		let coordinates = (mat as unknown as { _data: [number, number][] })._data;

		let anchors = svg.selectAll(".anchor")
			.data(coordinates)
			.enter()
			.append("circle")
			.attr("class", "anchor")
			.attr("opacity", 0.2);

		anchors
			.attr("cx", ([x, _]) => this.renderer.sx(x))
			.attr("cy", ([_, y]) => this.renderer.sy(y))
			.attr("r", this.anchorRadius!)
			.attr("stroke", () => "white")
			.style("cursor", "pointer");

		svg.anchors = anchors;

		let self = this;
		let drag = d3.drag<SVGCircleElement, [number, number], unknown>()
			.on("start", () => {
				renderer.shouldPlayGrandTourPrev = renderer.shouldPlayGrandTour;
				renderer.shouldPlayGrandTour = false;
				renderer.isDragging = true;
			})
			.on("drag", function (event) {
				if (!renderer.gt) return;
				let dx = renderer.sx.invert(event.dx) - renderer.sx.invert(0);
				let dy = renderer.sy.invert(event.dy) - renderer.sy.invert(0);
				let matrix = renderer.gt.getMatrix();
				let i = anchors.nodes().indexOf(this);
				matrix[i][0] += dx;
				matrix[i][1] += dy;
				matrix = utils.orthogonalize(matrix, i);
				renderer.gt.setMatrix(matrix);
				self.redrawAxis();
			})
			.on("end", function () {
				renderer.isDragging = false;
				renderer.shouldPlayGrandTour = renderer.shouldPlayGrandTourPrev ??
					false;
				renderer.shouldPlayGrandTourPrev = undefined;
			});

		anchors
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
		let m = math.identity(this.renderer.dataObj?.ndim ?? 10);
		let points = (m as unknown as { _data: number[][] })._data;
		let handlePos = this.renderer.gt.project(points);
		this.svg.selectAll(".anchor")
			.attr("cx", (_, i) => this.renderer.sx(handlePos[i][0]))
			.attr("cy", (_, i) => this.renderer.sy(handlePos[i][1]));
	}

	initLegendScale() {
		let width = +this.svg.attr("width");
		let marginTop = 20;
		let padding = 8;

		let legendLeft = width - utils.legendLeft[this.getDataset()];
		let legendRight = width - utils.legendRight[this.getDataset()];

		this.legend_sx = d3.scaleLinear()
			.domain([0, 1])
			.range([legendLeft, legendRight]);
		this.legend_sy = d3.scaleLinear()
			.domain([
				-1,
				0,
				utils.getLabelNames().length,
				utils.getLabelNames().length + 1,
			])
			.range([
				marginTop - padding,
				marginTop,
				marginTop + 170,
				marginTop + 170 + padding,
			]);
	}

	initLegend(colors: ColorRGB[], labels: string[]) {
		this.initLegendScale();

		let clearColor = d3.rgb(
			...utils.CLEAR_COLOR.map((d) => d * 255) as ColorRGB,
		);

		if (this.legendBox === undefined) {
			this.legendBox = this.svg.selectAll(".legendBox")
				.data([0])
				.enter()
				.append("rect")
				.attr("class", "legendBox")
				.attr("fill", clearColor.formatRgb())
				.attr("stroke", "#c1c1c1")
				.attr("stroke-width", 1);
		}

		let legendTitleText =
			utils.legendTitle[this.getDataset() as keyof typeof utils.legendTitle];
		if (
			this.legendTitle === undefined && legendTitleText !== undefined
		) {
			this.legendTitleBg = this.svg.selectAll(".legendTitleBg")
				.data([0])
				.enter()
				.append("rect")
				.attr("class", "legendTitleBg")
				.attr("fill", clearColor.formatRgb());

			this.legendTitle = this.svg.selectAll(".legendTitle")
				.data([legendTitleText])
				.enter()
				.append("text")
				.attr("class", "legendTitle")
				.attr("alignment-baseline", "middle")
				.attr("text-anchor", "middle")
				.text((d) => d);
		}

		let self = this;

		this.legendMark = this.svg.selectAll(".legendMark")
			.data(colors.map((c) => d3.rgb(...c)))
			.enter()
			.append("circle")
			.attr("class", "legendMark");

		this.legendMark
			.attr("fill", (color) => color.formatRgb())
			.on("mouseover", function () {
				const e = self.legendMark!.nodes();
				const i = e.indexOf(this);

				let classes = new Set(self.selectedClasses);
				if (!classes.has(i)) {
					classes.add(i);
				}
				self.onSelectLegend(classes);
			})
			.on("mouseout", () => this.restoreAlpha())
			.on("click", function () {
				const e = self.legendMark!.nodes();
				const i = e.indexOf(this);

				if (self.selectedClasses.has(i)) {
					self.selectedClasses.delete(i);
				} else {
					self.selectedClasses.add(i);
				}
				self.onSelectLegend(self.selectedClasses);
				if (self.selectedClasses.size == self.renderer.dataObj?.ndim) {
					self.selectedClasses = new Set();
				}
			});

		this.legendText = this.svg.selectAll(".legendText")
			.data(labels)
			.enter()
			.append("text")
			.attr("class", "legendText");

		this.legendText
			.attr("alignment-baseline", "middle")
			.attr("fill", "#333")
			.text((label) => label)
			.on("mouseover", function () {
				const e = self.legendText!.nodes();
				const i = e.indexOf(this);
				let classes = new Set(self.selectedClasses);
				if (!classes.has(i)) {
					classes.add(i);
				}
				self.onSelectLegend(classes);
			})
			.on("mouseout", () => this.restoreAlpha())
			.on("click", function () {
				const e = self.legendText!.nodes();
				const i = e.indexOf(this);

				if (self.selectedClasses.has(i)) {
					self.selectedClasses.delete(i);
				} else {
					self.selectedClasses.add(i);
				}
				self.onSelectLegend(self.selectedClasses);

				if (self.selectedClasses.size == self.renderer.dataObj?.ndim) {
					self.selectedClasses = new Set();
				}
			});
	}

	onSelectLegend(labelClasses: number | number[] | Set<number>) {
		if (!this.renderer.dataObj) return;

		if (typeof labelClasses === "number") {
			labelClasses = [labelClasses];
		}
		let labelSet = new Set(labelClasses);

		for (let i = 0; i < this.renderer.dataObj.npoint; i++) {
			if (labelSet.has(this.renderer.dataObj.labels[i])) {
				this.renderer.dataObj.alphas[i] = 255;
			} else {
				this.renderer.dataObj.alphas[i] = 0;
			}
		}

		this.legendMark?.attr("opacity", (_, j) => labelSet.has(j) ? 1.0 : 0.1);
	}

	restoreAlpha() {
		if (!this.renderer.dataObj) return;
		let labelClasses = new Set(this.selectedClasses);
		if (labelClasses.size == 0) {
			for (let i = 0; i < this.renderer.dataObj.npoint; i++) {
				this.renderer.dataObj.alphas[i] = 255;
			}
		} else {
			for (let i = 0; i < this.renderer.dataObj.npoint; i++) {
				if (labelClasses.has(this.renderer.dataObj.labels[i])) {
					this.renderer.dataObj.alphas[i] = 255;
				} else {
					this.renderer.dataObj.alphas[i] = 0;
				}
			}
		}

		this.legendMark?.attr("opacity", (_, i) => {
			if (labelClasses.size == 0) {
				return 1.0;
			} else {
				return labelClasses.has(i) ? 1.0 : 0.1;
			}
		});
	}
}
