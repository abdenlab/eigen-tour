import { Renderer } from "./Renderer";
import * as utils from "./utils";
import fs from "./shaders/teaser_fragment.glsl";
import vs from "./shaders/teaser_vertex.glsl";

async function main() {
	let canvas = document.querySelector("canvas")!;
	let { gl, program } = utils.initGL(canvas, fs, vs);
	let teaser = new Renderer(gl, program);

	teaser.overlay.fullScreenButton.style("top", "18px");
	teaser.overlay.epochSlider.style("top", "calc(100% - 28px)");
	teaser.overlay.playButton.style("top", "calc(100% - 34px)");
	teaser.overlay.grandtourButton.style("top", "calc(100% - 34px)");

	await utils.loadDataToRenderer([
		new URL("../data/eigs.arrow", import.meta.url).href,
	], teaser);

	window.addEventListener("resize", () => {
		teaser.setFullScreen(teaser.isFullScreen);
	});
}

main();
