import { Renderer } from "./Renderer";
import * as utils from "./utils";
import fs from "./shaders/teaser_fragment.glsl";
import vs from "./shaders/teaser_vertex.glsl";

async function main() {
	let canvas = document.querySelector("canvas")!;
	let { gl, program } = utils.initGL(canvas, fs, vs);
	let renderer = new Renderer(gl, program);

	renderer.overlay.fullScreenButton.style("top", "18px");
	renderer.overlay.epochSlider.style("top", "calc(100% - 28px)");
	renderer.overlay.playButton.style("top", "calc(100% - 34px)");
	renderer.overlay.grandtourButton.style("top", "calc(100% - 34px)");

	{
		let clearBanner = utils.createLoadingBanner(renderer.overlay.figure);
		let res = await fetch(new URL("../data/eigs.arrow", import.meta.url))
		await renderer.initData(await res.arrayBuffer());
		clearBanner();
	}

	window.addEventListener("resize", () => {
		renderer.setFullScreen(renderer.isFullScreen);
	});
}

main();
