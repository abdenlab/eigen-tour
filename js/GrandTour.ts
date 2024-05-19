import * as math from "mathjs";
import numeric from "./lib/numeric";
import * as utils from "./utils";


function initThetas(N: number): number[] {
	return Array.from({ length: N }, () => (Math.random() + 0.5) * Math.PI);
}

function initMatrix(ndim: number, angles: number[]): number[][] {
	let mat = math.identity(ndim) as math.Matrix;
	let matrix = mat.toArray() as number[][];
	rotateByAngles(matrix, angles);
	return	matrix;
}

function multiplyRotationMatrix(
	matrix: number[][],
	i: number,
	j: number,
	theta: number,
): void {
	if (theta == 0) {
		return;
	}
	let sin = Math.sin(theta);
	let cos = Math.cos(theta);
	let columnI = matrix.map((d) => d[i]);
	let columnJ = matrix.map((d) => d[j]);
	for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
		matrix[rowIndex][i] = columnI[rowIndex] * cos + columnJ[rowIndex] * (-sin);
		matrix[rowIndex][j] = columnI[rowIndex] * sin + columnJ[rowIndex] * cos;
	}
}

function rotateByAngles(matrix: number[][], angles: number[]): void {
	let k = -1;
	for (let i = 0; i < matrix.length; i++) {
		for (let j = 0; j < matrix.length; j++) {
			if (i !== j) {
				k++;
				multiplyRotationMatrix(matrix, i, j, angles[k]);
			}
		}
	}
}

/**
 * This function just seems to copy a matrix into the upper left corner of a
 * bigger matrix.
 *
 * @param matrix - A list of lists.
 * @param biggerMatrix - Another list of lists.
 * @returns
 */
function embed<T>(matrix: T[][], biggerMatrix: T[][]): T[][] {
	for (let i = 0; i < matrix.length; i++) {
		for (let j = 0; j < matrix[0].length; j++) {
			biggerMatrix[i][j] = matrix[i][j];
		}
	}
	return biggerMatrix;
}


export class GrandTour {
	STEPSIZE = 0.02;
	STEPSIZE_PREV?: number;

	matrix: number[][];
	thetas: number[];
	#ndim: number;

	/**
	 * Grand Tour class
	 *
	 * @param {number} ndim - number of dimensions
	 * @param {number[][]} init_matrix - initial projection matrix (optional)
	 */
	constructor(ndim: number, init_matrix?: number[][]) {
		this.#ndim = ndim;

		// Start with random angles
		this.thetas = initThetas(this.nangles);

		// Initialize the projection matrix from the random angles
		this.matrix = initMatrix(ndim, this.thetas);

		// If an initial matrix is provided, replace the current matrix
		if (init_matrix) {
			this.setMatrix(init_matrix);
		}
	}

	/**
	 * Returns the number of angles between the axes (ndim^2)
	 */
	get nangles() {
		return this.ndim * this.ndim;
	}

	/**
	 * Returns the number of axes
	 */
	get ndim() {
		return this.#ndim;
	}

	/**
	 * Sets the number of axes
	 */
	set ndim(newNdim: number) {
		if (newNdim > this.#ndim) {
			// Extend thetas with random angles.
			// Create an identity matrix with the new dimensions and fill
			// the current projection matrix into the top left corner.
			for (let i = this.nangles; i < newNdim * newNdim; i++) {
				this.thetas[i] = (Math.random() - 0.5) * 2 * Math.PI;
			}
			let eye = math.identity(newNdim) as math.Matrix;
			this.matrix = embed(this.matrix, eye.toArray() as number[][]);
		} else if (newNdim < this.#ndim) {
			// Shrink the projection matrix and re-orthonormalize it.
			this.matrix = this.matrix.slice(0, newNdim).map((row) =>
				row.slice(0, newNdim)
			);
			this.matrix = utils.orthogonalize(this.matrix);
		}

		// Update the number of dimensions
		this.#ndim = newNdim;
	}

	/**
	 * Returns the projection matrix
	 * If dt is provided, calculate new angles and rotate the matrix before
	 * returning it.
	 *
	 * @param {number} dt - time step (optional)
	 * @returns {number[][]}
	 */
	getMatrix(dt?: number) {
		if (dt !== undefined) {
			// Calculate new angles and apply them.
			let angles = this.thetas.map(
				(theta) => theta * dt * this.STEPSIZE
			);
			rotateByAngles(this.matrix, angles);
		}
		return this.matrix;
	}

	/**
	 * Sets the current rotation matrix
	 *
	 * @param {number[][]} m
	 */
	setMatrix(m: number[][]) {
		this.matrix = numeric.clone(m);
	}

	/**
	 * Project the high-dimensional data points onto a 3D projection space
	 *
	 * @param {number[][]} data - high-dimensional data points (rows)
	 * @param {number} dt - epoch time step
	 * @param {number[][]} view - view matrix (optional)
	 * @returns {number[][]} - projected data points
	 */
	project(data: number[][], dt?: number, view?: number[][]) {
		// get the current projection matrix
		let matrix = this.getMatrix(dt);

		// grab the first 3 columns of the projection matrix
		matrix = math.transpose(matrix);
		matrix = matrix.slice(0, 3);
		matrix = math.transpose(matrix);

		// apply some sort of "view" matrix if provided
		if (view !== undefined) {
			matrix = math.multiply(view, matrix) as number[][];
		}

		// apply the projection matrix to the data
		let transform = matrix.slice(0, data[0].length) as number[][];
		return math.multiply(data, transform) as number[][];
	}
}
