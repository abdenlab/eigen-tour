import * as d3 from "d3";

import { TeaserRenderer } from './TeaserRenderer';
import * as utils from './utils';

import fs from './shaders/teaser_fragment.glsl';
import vs from './shaders/teaser_vertex.glsl';

const teaserFigure = document.querySelector("d-figure.teaser")!;
let teaser: typeof TeaserRenderer;
let allViews: typeof teaser[] = [];

let c = utils.CLEAR_COLOR.map(d => d * 255);
// @ts-expect-error
d3.selectAll('.flex-item').style('background', d3.rgb(...c))

teaserFigure.addEventListener("ready", function() {
  console.log('teaserFigure ready');
  let epochs = d3.range(0, 1, 1);
  let urls = utils.getChromTeaserDataURL();
  let { gl, program } = utils.initGL("#teaser", fs, vs);

  teaser = new TeaserRenderer(gl, program, {
    epochs: epochs,
    shouldAutoNextEpoch: true
  });

  allViews.push(teaser);

  teaser.overlay.fullScreenButton.style('top', '18px');
  teaser.overlay.epochSlider.style('top', 'calc(100% - 28px)');
  teaser.overlay.playButton.style('top', ' calc(100% - 34px)');
  teaser.overlay.grandtourButton.style('top', ' calc(100% - 34px)');

  // teaser.overlay.fullScreenButton.remove();
  teaser.overlay.modeOption.remove();
  teaser.overlay.datasetOption.remove();
  teaser.overlay.zoomSliderDiv.remove();
  // teaser.overlay.grandtourButton.remove();

  teaser = utils.loadDataToRenderer(urls, teaser);

  window.addEventListener('resize', ()=>{
    teaser.setFullScreen(teaser.isFullScreen);
  });

});

teaserFigure.addEventListener("onscreen", function() {
  console.log('teaser onscreen');
  if(teaser && teaser.play){
    teaser.shouldRender = true;
    teaser.play();
  }
  for(let view of allViews){
    if(view !== teaser && view.pause){
      view.pause();
    }
  }
});

teaserFigure.addEventListener("offscreen", function() {
  if(teaser && teaser.pause){
    teaser.pause();
  }
});
