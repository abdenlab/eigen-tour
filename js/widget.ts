import type { RenderProps } from "@anywidget/types";

import { Renderer } from "./Renderer";
import * as utils from "./utils";
import fs from "./shaders/teaser_fragment.glsl";
import vs from "./shaders/teaser_vertex.glsl";

import "./widget.css";

interface Model {
	data: DataView
}

const template = `<d-figure class="teaser">
	<canvas id="teaser"></canvas>
</d-figure>
`

export default {
	async render({ model, el }: RenderProps<Model>) {
		el.innerHTML = template;
		let canvas = el.querySelector("canvas")!;
		console.log("initGL");
		let { gl, program } = utils.initGL(canvas, fs, vs);
		let renderer = new Renderer(gl, program);
		renderer.overlay.fullScreenButton.style("top", "18px");
		renderer.overlay.epochSlider.style("top", "calc(100% - 28px)");
		renderer.overlay.playButton.style("top", "calc(100% - 34px)");
		renderer.overlay.grandtourButton.style("top", "calc(100% - 34px)");

		console.log("model", model);
		{
			// load the data
			let clearBanner = utils.createLoadingBanner(renderer.overlay.figure);
			console.log("loading data");
			await renderer.initData(model.get("data").buffer);
			console.log("data loaded");
			clearBanner();
		}

		function onResize() {
			renderer.setFullScreen(renderer.isFullScreen);
		}
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
		}
	}
}
