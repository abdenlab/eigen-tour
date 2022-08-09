import * as d3 from "d3";
import { createNanoEvents, Emitter } from "nanoevents";
import * as utils from "./utils";

interface Margin {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

type LegendDatum = [label: string, color: d3.Color];

interface LegendEvents {
	select: (classes: Set<number>) => void;
	mouseout: (classes: Set<number>) => void;
}

export class Legend {
	#data: LegendDatum[];
	#margin: Margin;
	#selected: Set<number>;
	#emitter: Emitter<LegendEvents>;
	#root: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	#mark: d3.Selection<SVGCircleElement, LegendDatum, SVGSVGElement, unknown>;
	#box: d3.Selection<SVGRectElement, number, SVGSVGElement, unknown>;
	#text: d3.Selection<SVGTextElement, LegendDatum, SVGSVGElement, unknown>;
	#title?: d3.Selection<SVGTextElement, string, SVGSVGElement, unknown>;
	#titleBg?: d3.Selection<SVGRectElement, number, SVGSVGElement, unknown>;

	constructor(
		data: LegendDatum[],
		root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		options: { title?: string; margin?: Partial<Margin> },
	) {
		this.#emitter = createNanoEvents<LegendEvents>();
		this.#data = data;
		this.#root = root;
		this.#selected = new Set();
		this.#margin = { top: 20, bottom: 0, left: 0, right: 0, ...options.margin };

		this.#box = root.selectAll(".legendBox")
			.data([0])
			.enter()
			.append("rect")
			.attr("class", "legendBox")
			.attr("fill", utils.CLEAR_COLOR.formatRgb())
			.attr("stroke", "#c1c1c1")
			.attr("stroke-width", 1);

		let self = this;

		this.#mark = root.selectAll(".legendMark")
			.data(this.#data)
			.enter()
			.append("circle")
			.attr("class", "legendMark");

		const mouseout = () => {
			this.#mark.attr(
				"opacity",
				(_, i) =>
					this.#selected.size === 0 || this.#selected.has(i) ? 1.0 : 0.1,
			);
			this.#emitter.emit("mouseout", this.#selected);
		};

		this.#mark
			.attr("fill", (d) => d[1].formatRgb())
			.on("mouseover", function () {
				const e = self.#mark!.nodes();
				const i = e.indexOf(this);
				if (!self.#selected.has(i)) {
					self.#selected.add(i);
				}
				self.#emitter.emit("select", self.#selected);
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
				self.#emitter.emit("select", self.#selected);
			});

		this.#text = root.selectAll(".legendText")
			.data(this.#data)
			.enter()
			.append("text")
			.attr("class", "legendText");

		this.#text
			.attr("text-anchor", "start")
			.attr("fill", "#333")
			.text((d) => d[0])
			.on("mouseover", function () {
				const e = self.#text!.nodes();
				const i = e.indexOf(this);
				if (!self.#selected.has(i)) {
					self.#selected.add(i);
				}
				self.#emitter.emit("select", self.#selected);
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
				self.#emitter.emit("select", self.#selected);
				self.#mark.attr(
					"opacity",
					(_, i) => self.#selected.has(i) ? 1.0 : 0.1,
				);
			});

		if (options.title && options.title !== "") {
			this.#titleBg = root.selectAll(".legendTitleBg")
				.data([0])
				.enter()
				.append("rect")
				.attr("class", "legendTitleBg")
				.attr("fill", utils.CLEAR_COLOR.formatRgb());

			this.#title = root.selectAll(".legendTitle")
				.data([options.title])
				.enter()
				.append("text")
				.attr("class", "legendTitle")
				.attr("alignment-baseline", "middle")
				.attr("text-anchor", "middle")
				.text((d) => d);
		}
	}

	resize() {
		let width = this.#root.node()!.clientWidth;
		let padding = 8;

		let sx = d3.scaleLinear()
			.domain([0, 1])
			.range([width - this.#margin.left, width - this.#margin.right]);

		let sy = d3.scaleLinear()
			.domain([-1, 0, this.#data.length, this.#data.length + 1])
			.range([
				this.#margin.top - padding,
				this.#margin.top,
				this.#margin.top + 170,
				this.#margin.top + 170 + padding,
			]);

		let r = (sy(1) - sy(0)) / 4;

		this.#mark
			.attr("cx", sx(0.001) + 2.5 * r)
			.attr("cy", (_, i) => sy(i + 0.5))
			.attr("r", r);

		this.#text
			.attr("x", sx(0.0) + 2.5 * r + 2.5 * r)
			.attr("y", (_, i) => sy(i + 0.7));

		this.#box
			.attr("x", sx.range()[0])
			.attr("y", sy(-1))
			.attr("width", sx.range()[1] - sx.range()[0])
			.attr("height", sy(this.#data.length + 1) - sy(-1))
			.attr("rx", r);

		if (this.#title && this.#titleBg) {
			this.#title
				.attr("x", sx(0.5))
				.attr("y", sy(-1));

			let rectData = this.#title.node()!.getBBox();
			let padding = 2;
			this.#titleBg
				.attr("x", rectData.x - padding)
				.attr("y", rectData.y - padding)
				.attr("width", rectData.width + 2 * padding)
				.attr("height", rectData.height + 2 * padding);
		}
	}

	on<E extends keyof LegendEvents>(event: E, callback: LegendEvents[E]) {
		return this.#emitter.on(event, callback);
	}
}
