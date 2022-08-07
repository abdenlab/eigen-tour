import * as math from "mathjs";
import numeric from "numeric";
import * as utils from "./utils";

function initThetas(N: number) {
	return Array.from({ length: N }, () => (Math.random() + 0.5) * Math.PI);
}

export class GrandTour {
	STEPSIZE = 0.02;
	matrix: number[][];

	STEPSIZE_PREV?: number;
	angles?: number[];
	thetas: number[];
	#ndim: number;

	constructor(ndim: number, init_matrix?: number[][]) {
		this.#ndim = ndim;
		this.thetas = initThetas(this.N);
		this.matrix = this.getMatrix(0);
		if (init_matrix) {
			this.setMatrix(init_matrix);
		}
	}

	get N() {
		return this.ndim * this.ndim;
	}

	get ndim() {
		return this.#ndim;
	}

	set ndim(newNdim: number) {
		if (newNdim > this.#ndim) {
			for (let i = this.N; i < newNdim * newNdim; i++) {
				this.thetas[i] = (Math.random() - 0.5) * 2 * Math.PI;
			}
			this.matrix = utils.embed(
				this.matrix,
				(math.identity(newNdim) as math.Matrix).toArray() as number[][],
			);
		} else if (newNdim < this.ndim) {
			this.matrix = this.matrix.slice(0, newNdim).map((row) =>
				row.slice(0, newNdim)
			);
			this.matrix = utils.orthogonalize(this.matrix);
		}
		this.#ndim = newNdim;
	}

	getMatrix(dt?: number) {
		if (dt !== undefined) {
			if (this.angles === undefined) {
				// torus method
				// this.angles = this.thetas.map(theta=>0);
				//
				// another implementation similar to torus method
				this.angles = this.thetas;
				let mat = math.identity(this.ndim) as math.Matrix;
				this.matrix = mat.toArray() as number[][];
			} else {
				// torus method
				// this.angles = this.angles.map(
				//  (a,i) => a+dt*this.STEPSIZE*this.thetas[i]);
				//
				// another implementation similar to torus method
				this.angles = this.thetas.map((theta) => theta * dt * this.STEPSIZE);
			}
			// torus method
			// this.matrix = math.identity(this.ndim)._data;
			let k = -1;
			for (let i = 0; i < this.ndim; i++) {
				for (let j = 0; j < this.ndim; j++) {
					if (i !== j && (true || i <= 3 || j <= 3)) {
						k++;
						this.matrix = this.multiplyRotationMatrix(
							this.matrix,
							i,
							j,
							this.angles[k],
						);
					}
				}
			}
		}
		return this.matrix;
	}

	setMatrix(m: number[][]) {
		this.matrix = numeric.clone(m);
	}

	getRotationMatrix(dim0: number, dim1: number, theta: number) {
		let m = math.identity(this.ndim) as math.Matrix;
		let res = m.toArray() as number[][];
		res[dim0][dim0] = Math.cos(theta);
		res[dim0][dim1] = Math.sin(theta);
		res[dim1][dim0] = -Math.sin(theta);
		res[dim1][dim1] = Math.cos(theta);
		return res;
	}

	multiplyRotationMatrix(
		matrix: number[][],
		i: number,
		j: number,
		theta: number,
	) {
		if (theta == 0) {
			return matrix;
		}
		let sin = Math.sin(theta);
		let cos = Math.cos(theta);
		// var res = matrix.map(d=>d.slice());
		let columnI = matrix.map((d) => d[i]);
		let columnJ = matrix.map((d) => d[j]);
		for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
			matrix[rowIndex][i] = columnI[rowIndex] * cos +
				columnJ[rowIndex] * (-sin);
			matrix[rowIndex][j] = columnI[rowIndex] * sin + columnJ[rowIndex] * cos;
		}
		return matrix;
	}

	get3dRotationMatrix(t: number) {
		let theta = 0.0 * t;
		let cos = Math.cos(theta);
		let sin = Math.sin(theta);
		return [
			[cos, 0, sin] as const,
			[0, 1, 0] as const,
			[-sin, 0, cos] as const,
		] as const;
	}

	project(data: number[][], dt?: number, view?: number[][]) {
		let matrix = this.getMatrix(dt);
		matrix = math.transpose(matrix);
		matrix = matrix.slice(0, 3);
		matrix = math.transpose(matrix);
		if (view !== undefined) {
			matrix = math.multiply(view, matrix) as number[][];
		}
		return math.multiply(data, matrix.slice(0, data[0].length)) as number[][];
	}
}
