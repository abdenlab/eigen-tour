import * as d3 from "d3";

import { TeaserRenderer } from "./TeaserRenderer";
import * as utils from "./utils";
import fs from "./shaders/teaser_fragment.glsl";
import vs from "./shaders/teaser_vertex.glsl";

let figure = document.querySelector("d-figure.teaser")!;
let canvas = figure.querySelector("canvas")!;
let { gl, program } = utils.initGL(canvas, fs, vs);

let teaser = new TeaserRenderer(gl, program, {
	epochs: d3.range(0, 1, 1),
	shouldAutoNextEpoch: true,
});

teaser.overlay.fullScreenButton.style("top", "18px");
teaser.overlay.epochSlider.style("top", "calc(100% - 28px)");
teaser.overlay.playButton.style("top", " calc(100% - 34px)");
teaser.overlay.grandtourButton.style("top", " calc(100% - 34px)");
teaser.overlay.controlOptionGroup.remove();

await utils.loadDataToRenderer([
	new URL("../data/eigs.arrow", import.meta.url).href,
], teaser);

window.addEventListener("resize", () => {
	teaser.setFullScreen(teaser.isFullScreen);
});
