import type { RenderProps } from "@anywidget/types";

import { Renderer } from "./Renderer";
import * as utils from "./utils";
import fs from "./shaders/teaser_fragment.glsl";
import vs from "./shaders/teaser_vertex.glsl";

import "./widget.css";

interface Model {
	data: DataView;
	axis_fields: string[];
	label_field: string;
	label_colors: string[];
}

const TEMPLATE = `<d-figure class="teaser">
	<canvas id="teaser"></canvas>
</d-figure>
`

export default {
	async render({ model, el }: RenderProps<Model>) {
		el.innerHTML = TEMPLATE;
		let canvas = el.querySelector("canvas")!;

		// Compile the fragment and vertex shaders
		console.log("initGL");
		let { gl, program } = utils.initGL(canvas, fs, vs);
		
		// Create the renderer
		console.log("Create renderer");
		let renderer = new Renderer(gl, program, "mnist");
		renderer.overlay.fullScreenButton.style("top", "18px");
		renderer.overlay.epochSlider.style("top", "calc(100% - 28px)");
		renderer.overlay.playButton.style("top", "calc(100% - 34px)");
		renderer.overlay.grandtourButton.style("top", "calc(100% - 34px)");

		// Load the data
		{
			let clearBanner = utils.createLoadingBanner(renderer.overlay.figure);
			console.log("Loading data...");
			await renderer.initData(
				model.get("data").buffer, 
				model.get("axis_fields"),
				model.get("label_field"), 
				model.get("label_colors"),
			);
			console.log("Data loaded");
			clearBanner();
		}

		function onResize() {
			renderer.setFullScreen(renderer.isFullScreen);
		}
		window.addEventListener("resize", onResize);

		// Return a cleanup function
		return () => {
			window.removeEventListener("resize", onResize);
		}
	}
}
