import { arrayInsert } from 'mote/base/common/arrays';

export class PrefixSumComputer {

}


export class ConstantTimePrefixSumComputer {
	private _values: number[];
	private _isValid: boolean;
	private _validEndIndex: number;

	/**
	 * _prefixSum[i] = SUM(values[j]), 0 <= j <= i
	 */
	private _prefixSum: number[];

	/**
	 * _indexBySum[sum] = idx => _prefixSum[idx - 1] <= sum < _prefixSum[idx]
	*/
	private _indexBySum: number[];

	constructor(values: number[]) {
		this._values = values;
		this._isValid = false;
		this._validEndIndex = -1;
		this._prefixSum = [];
		this._indexBySum = [];
	}

	/**
	 * @returns SUM(0 <= j < values.length, values[j])
	 */
	public getTotalSum(): number {
		this._ensureValid();
		return this._indexBySum.length;
	}

	/**
	 * Returns the sum of the first `count` many items.
	 * @returns `SUM(0 <= j < count, values[j])`.
	 */
	public getPrefixSum(count: number): number {
		this._ensureValid();
		if (count === 0) {
			return 0;
		}
		return this._prefixSum[count - 1];
	}

	/**
	 * @returns `result`, such that `getPrefixSum(result.index) + result.remainder = sum`
	 */
	public getIndexOf(sum: number): PrefixSumIndexOfResult {
		this._ensureValid();
		const idx = this._indexBySum[sum];
		const viewLinesAbove = idx > 0 ? this._prefixSum[idx - 1] : 0;
		return new PrefixSumIndexOfResult(idx, sum - viewLinesAbove);
	}

	public removeValues(start: number, deleteCount: number): void {
		this._values.splice(start, deleteCount);
		this._invalidate(start);
	}

	public insertValues(insertIndex: number, insertArr: number[]): void {
		this._values = arrayInsert(this._values, insertIndex, insertArr);
		this._invalidate(insertIndex);
	}


	private _invalidate(index: number): void {
		this._isValid = false;
		this._validEndIndex = Math.min(this._validEndIndex, index - 1);
	}

	private _ensureValid(): void {
		if (this._isValid) {
			return;
		}

		for (let i = this._validEndIndex + 1, len = this._values.length; i < len; i++) {
			const value = this._values[i];
			const sumAbove = i > 0 ? this._prefixSum[i - 1] : 0;

			this._prefixSum[i] = sumAbove + value;
			for (let j = 0; j < value; j++) {
				this._indexBySum[sumAbove + j] = i;
			}
		}

		// trim things
		this._prefixSum.length = this._values.length;
		this._indexBySum.length = this._prefixSum[this._prefixSum.length - 1];

		// mark as valid
		this._isValid = true;
		this._validEndIndex = this._values.length - 1;
	}

	public setValue(index: number, value: number): void {
		if (this._values[index] === value) {
			// no change
			return;
		}
		this._values[index] = value;
		this._invalidate(index);
	}
}

export class PrefixSumIndexOfResult {
	_prefixSumIndexOfResultBrand: void = undefined;

	constructor(
		public readonly index: number,
		public readonly remainder: number
	) {
		this.index = index;
		this.remainder = remainder;
	}
}
