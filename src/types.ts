import type { BaseType, ScaleContinuousNumeric, Selection } from "d3";

export type Point = [number, number, number];

export type Scale = ScaleContinuousNumeric<number, number, never>;

export type ColorRGB = [number, number, number];

export type ColorRGBA = [number, number, number, number];

export interface Renderer {
	gl: WebGLRenderingContext;
	render(dt: number): void;
	play(t?: number): void;
	pause(): void;
	initData(
		buffer: ArrayBuffer,
		url?: string,
		i?: number,
		length?: number,
	): Promise<void>;
	overlay: {
		figure: Selection<BaseType, unknown, BaseType, unknown>;
	};
}
