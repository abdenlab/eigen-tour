import { Renderer } from "./Renderer";
import * as utils from "./utils";
import fs from "./shaders/teaser_fragment.glsl";
import vs from "./shaders/teaser_vertex.glsl";

import "./widget.css";

async function main() {
	let canvas = document.querySelector("canvas")!;
	let { gl, program } = utils.initGL(canvas, fs, vs);
	let renderer = new Renderer(gl, program, "mnist");

	renderer.overlay.fullScreenButton.style("top", "18px");
	renderer.overlay.epochSlider.style("top", "calc(100% - 28px)");
	renderer.overlay.playButton.style("top", "calc(100% - 34px)");
	renderer.overlay.grandtourButton.style("top", "calc(100% - 34px)");

	{
		let clearBanner = utils.createLoadingBanner(renderer.overlay.figure);
		let res = await fetch(new URL("./eigs.arrow", import.meta.url))
		await renderer.initData(
            await res.arrayBuffer(),
            ["E1", "E2", "E3", "E4", "E5", "E6"],
            "name",
            {"A1": "#e23838", "A2": "#ffb900", "B0": "#5ebd3e", "B1": "#009cdf", "B4": "#973999"},
        );
		clearBanner();
	}

	window.addEventListener("resize", () => {
		renderer.setFullScreen(renderer.isFullScreen);
	});
}

main();
