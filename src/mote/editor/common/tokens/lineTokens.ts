export interface IViewLineTokens {
	getCount(): number;
	getLineContent(): string;
	getEndOffset(tokenIndex: number): number;
	getClassName(tokenIndex: number): string;
}

export class LineTokens implements IViewLineTokens {
	_lineTokensBrand: void = undefined;


	private readonly _tokensCount: number;

	constructor(
		private readonly _tokens: Uint32Array,
		private readonly text: string,
	) {
		this._tokensCount = (this._tokens.length >>> 1);
	}

	public getLineContent(): string {
		return this.text;
	}

	public getCount(): number {
		return this._tokensCount;
	}

	public getStartOffset(tokenIndex: number): number {
		if (tokenIndex > 0) {
			return this._tokens[(tokenIndex - 1) << 1];
		}
		return 0;
	}

	/**
	 * Find the token containing offset `offset`.
	 * @param offset The search offset
	 * @return The index of the token containing the offset.
	 */
	public findTokenIndexAtOffset(offset: number): number {
		return LineTokens.findIndexInTokensArray(this._tokens, offset);
	}

	public inflate(): IViewLineTokens {
		return this;
	}

	public sliceAndInflate(startOffset: number, endOffset: number, deltaOffset: number): IViewLineTokens {
		return new SliceLineTokens(this, startOffset, endOffset, deltaOffset);
	}

	public static findIndexInTokensArray(tokens: Uint32Array, desiredIndex: number): number {
		if (tokens.length <= 2) {
			return 0;
		}

		let low = 0;
		let high = (tokens.length >>> 1) - 1;

		while (low < high) {

			const mid = low + Math.floor((high - low) / 2);
			const endOffset = tokens[(mid << 1)];

			if (endOffset === desiredIndex) {
				return mid + 1;
			} else if (endOffset < desiredIndex) {
				low = mid + 1;
			} else if (endOffset > desiredIndex) {
				high = mid;
			}
		}

		return low;
	}

	/**
	 * @pure
	 * @param insertTokens Must be sorted by offset.
	*/
	public withInserted(insertTokens: { offset: number; text: string; tokenMetadata: number }[]): LineTokens {
		if (insertTokens.length === 0) {
			return this;
		}

		let nextOriginalTokenIdx = 0;
		let nextInsertTokenIdx = 0;
		let text = '';
		const newTokens = new Array<number>();

		let originalEndOffset = 0;
		while (true) {
			const nextOriginalTokenEndOffset = nextOriginalTokenIdx < this._tokensCount ? this._tokens[nextOriginalTokenIdx << 1] : -1;
			const nextInsertToken = nextInsertTokenIdx < insertTokens.length ? insertTokens[nextInsertTokenIdx] : null;

			if (nextOriginalTokenEndOffset !== -1 && (nextInsertToken === null || nextOriginalTokenEndOffset <= nextInsertToken.offset)) {
				// original token ends before next insert token
				text += this.text.substring(originalEndOffset, nextOriginalTokenEndOffset);
				const metadata = this._tokens[(nextOriginalTokenIdx << 1) + 1];
				newTokens.push(text.length, metadata);
				nextOriginalTokenIdx++;
				originalEndOffset = nextOriginalTokenEndOffset;

			} else if (nextInsertToken) {
				if (nextInsertToken.offset > originalEndOffset) {
					// insert token is in the middle of the next token.
					text += this.text.substring(originalEndOffset, nextInsertToken.offset);
					const metadata = this._tokens[(nextOriginalTokenIdx << 1) + 1];
					newTokens.push(text.length, metadata);
					originalEndOffset = nextInsertToken.offset;
				}

				text += nextInsertToken.text;
				newTokens.push(text.length, nextInsertToken.tokenMetadata);
				nextInsertTokenIdx++;
			} else {
				break;
			}
		}

		return new LineTokens(new Uint32Array(newTokens), text, this._languageIdCodec);
	}
}

class SliceLineTokens implements IViewLineTokens {

	private readonly _source: LineTokens;
	private readonly _startOffset: number;
	private readonly _endOffset: number;
	private readonly _deltaOffset: number;

	private readonly _firstTokenIndex: number;
	private readonly _tokensCount: number;

	constructor(source: LineTokens, startOffset: number, endOffset: number, deltaOffset: number) {
		this._source = source;
		this._startOffset = startOffset;
		this._endOffset = endOffset;
		this._deltaOffset = deltaOffset;
		this._firstTokenIndex = source.findTokenIndexAtOffset(startOffset);

		this._tokensCount = 0;
		for (let i = this._firstTokenIndex, len = source.getCount(); i < len; i++) {
			const tokenStartOffset = source.getStartOffset(i);
			if (tokenStartOffset >= endOffset) {
				break;
			}
			this._tokensCount++;
		}
	}

	public getMetadata(tokenIndex: number): number {
		throw new Error();
		//return this._source.getMetadata(this._firstTokenIndex + tokenIndex);
	}

	public getLanguageId(tokenIndex: number): string {
		throw new Error();
		//return this._source.getLanguageId(this._firstTokenIndex + tokenIndex);
	}

	public getLineContent(): string {
		return this._source.getLineContent().substring(this._startOffset, this._endOffset);
	}

	public equals(other: IViewLineTokens): boolean {
		if (other instanceof SliceLineTokens) {
			return (
				this._startOffset === other._startOffset
				&& this._endOffset === other._endOffset
				&& this._deltaOffset === other._deltaOffset
				&& this._source.slicedEquals(other._source, this._firstTokenIndex, this._tokensCount)
			);
		}
		return false;
	}

	public getCount(): number {
		return this._tokensCount;
	}

	public getForeground(tokenIndex: number): ColorId {
		return this._source.getForeground(this._firstTokenIndex + tokenIndex);
	}

	public getEndOffset(tokenIndex: number): number {
		const tokenEndOffset = this._source.getEndOffset(this._firstTokenIndex + tokenIndex);
		return Math.min(this._endOffset, tokenEndOffset) - this._startOffset + this._deltaOffset;
	}

	public getClassName(tokenIndex: number): string {
		return this._source.getClassName(this._firstTokenIndex + tokenIndex);
	}

	public getInlineStyle(tokenIndex: number, colorMap: string[]): string {
		return this._source.getInlineStyle(this._firstTokenIndex + tokenIndex, colorMap);
	}

	public getPresentation(tokenIndex: number): ITokenPresentation {
		return this._source.getPresentation(this._firstTokenIndex + tokenIndex);
	}

	public findTokenIndexAtOffset(offset: number): number {
		return this._source.findTokenIndexAtOffset(offset + this._startOffset - this._deltaOffset) - this._firstTokenIndex;
	}
}
