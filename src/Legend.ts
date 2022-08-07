import * as d3 from "d3";
import EventEmitter from "eventemitter3";
import * as utils from "./utils";

import type { ColorRGB } from "./types";

let clearColor = d3.rgb(
	...utils.CLEAR_COLOR.map((d) => d * 255) as ColorRGB,
);

interface LegendEvents {
	select: [classes: Set<number>];
	mouseout: [classes: Set<number>];
}

export class Legend extends EventEmitter<LegendEvents> {
	#root: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	#selected: Set<number>;
	#margin: { left: number; right: number };
	#labels: string[];
	#titleData: string;
	#mark: d3.Selection<
		SVGCircleElement,
		d3.RGBColor,
		SVGSVGElement,
		unknown
	>;
	#box: d3.Selection<SVGRectElement, number, SVGSVGElement, unknown>;
	#text: d3.Selection<SVGTextElement, string, SVGSVGElement, unknown>;
	#title: d3.Selection<SVGTextElement, string, SVGSVGElement, unknown>;
	#titleBg: d3.Selection<SVGRectElement, number, SVGSVGElement, unknown>;

	constructor(
		root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		opts: {
			title: string;
			colors: ColorRGB[];
			labels: string[];
			margin: { left: number; right: number };
		},
	) {
		super();
		this.#root = root;
		this.#selected = new Set();
		this.#margin = opts.margin;
		this.#labels = opts.labels;
		this.#titleData = opts.title;

		this.#box = root.selectAll(".legendBox")
			.data([0])
			.enter()
			.append("rect")
			.attr("class", "legendBox")
			.attr("fill", clearColor.formatRgb())
			.attr("stroke", "#c1c1c1")
			.attr("stroke-width", 1);

		this.#titleBg = root.selectAll(".legendTitleBg")
			.data([0])
			.enter()
			.append("rect")
			.attr("class", "legendTitleBg")
			.attr("fill", clearColor.formatRgb());

		this.#title = root.selectAll(".legendTitle")
			.data([opts.title])
			.enter()
			.append("text")
			.attr("class", "legendTitle")
			.attr("alignment-baseline", "middle")
			.attr("text-anchor", "middle")
			.text((d) => d);

		let self = this;

		this.#mark = root.selectAll(".legendMark")
			.data(opts.colors.map((c) => d3.rgb(...c)))
			.enter()
			.append("circle")
			.attr("class", "legendMark");

		const mouseout = () => {
			this.#mark.attr(
				"opacity",
				(_, i) => this.#selected.size == 0 || this.#selected.has(i) ? 1.0 : 0.1,
			);
			this.emit("mouseout", this.#selected);
		};

		this.#mark
			.attr("fill", (color) => color.formatRgb())
			.on("mouseover", function () {
				const e = self.#mark!.nodes();
				const i = e.indexOf(this);
				if (!self.#selected.has(i)) {
					self.#selected.add(i);
				}
				self.emit("select", self.#selected);
			})
			.on("mouseout", mouseout)
			.on("click", function () {
				const e = self.#mark!.nodes();
				const i = e.indexOf(this);
				if (self.#selected.has(i)) {
					self.#selected.delete(i);
				} else {
					self.#selected.add(i);
				}
				self.emit("select", self.#selected);
			});

		this.#text = root.selectAll(".legendText")
			.data(opts.labels)
			.enter()
			.append("text")
			.attr("class", "legendText");

		this.#text
			.attr("alignment-baseline", "middle")
			.attr("fill", "#333")
			.text((label) => label)
			.on("mouseover", function () {
				const e = self.#text!.nodes();
				const i = e.indexOf(this);
				if (!self.#selected.has(i)) {
					self.#selected.add(i);
				}
				self.emit("select", self.#selected);
			})
			.on("mouseout", mouseout)
			.on("click", function () {
				const e = self.#text!.nodes();
				const i = e.indexOf(this);
				if (self.#selected.has(i)) {
					self.#selected.delete(i);
				} else {
					self.#selected.add(i);
				}
				self.emit("select", self.#selected);
				self.#mark.attr(
					"opacity",
					(_, i) => self.#selected.has(i) ? 1.0 : 0.1,
				);
			});
	}

	resize() {
		let width = +this.#root.node()!.clientWidth;
		let marginTop = 20;
		let padding = 8;

		let sx = d3.scaleLinear()
			.domain([0, 1])
			.range([width - this.#margin.left, width - this.#margin.right]);

		let sy = d3.scaleLinear()
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

		let r = (sy(1) - sy(0)) / 4;

		this.#mark
			.attr("cx", sx(0.001) + 2.5 * r)
			.attr("cy", (_, i) => sy(i + 0.5))
			.attr("r", r);

		this.#text
			.attr("x", sx(0.0) + 2.5 * r + 2.5 * r)
			.attr("y", (_, i) => sy!(i + 0.5));

		this.#box
			?.attr("x", sx.range()[0])
			.attr("y", sy(-1))
			.attr("width", sx.range()[1] - sx.range()[0])
			.attr("height", sy(this.#labels.length + 1) - sy(-1))
			.attr("rx", r);

		this.#title
			.attr("x", sx(0.5))
			.attr("y", sy(-1))
			.text(this.#titleData);

		{
			let rectData = this.#title?.node()!.getBBox();
			let padding = 2;
			this.#titleBg
				.attr("x", rectData.x - padding)
				.attr("y", rectData.y - padding)
				.attr("width", rectData.width + 2 * padding)
				.attr("height", rectData.height + 2 * padding)
				.attr("opacity", this.#titleData ? 1 : 0);
		}
	}

	clearSelected() {
		this.#selected.clear();
	}
}
