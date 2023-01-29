import { CharCode } from 'mote/base/common/charCode';
import * as strings from 'mote/base/common/strings';
import { IViewLineContribution } from 'mote/editor/browser/editorBrowser';
import { pureTextTypes } from 'mote/editor/common/blockTypes';
import { StringBuilder } from 'mote/editor/common/core/stringBuilder';
import { IViewLineTokens } from 'mote/editor/common/tokens/lineTokens';
import { LinePart } from 'mote/editor/common/viewLayout/linePart';
import BlockStore from 'mote/platform/store/common/blockStore';

export const enum RenderWhitespace {
	None = 0,
	Boundary = 1,
	Selection = 2,
	Trailing = 3,
	All = 4
}

export class LineRange {
	/**
	 * Zero-based offset on which the range starts, inclusive.
	 */
	public readonly startOffset: number;

	/**
	 * Zero-based offset on which the range ends, inclusive.
	 */
	public readonly endOffset: number;

	constructor(startIndex: number, endIndex: number) {
		this.startOffset = startIndex;
		this.endOffset = endIndex;
	}

	public equals(otherLineRange: LineRange) {
		return this.startOffset === otherLineRange.startOffset
			&& this.endOffset === otherLineRange.endOffset;
	}
}

export class RenderLineInput {

	public readonly canUseHalfwidthRightwardsArrow: boolean;
	public readonly lineContent: string;
	public readonly continuesWithWrappedLine: boolean;
	public readonly isBasicASCII: boolean;
	public readonly containsRTL: boolean;
	public readonly fauxIndentLength: number;

	//public readonly lineDecorations: LineDecoration[];
	public readonly tabSize: number;
	public readonly startVisibleColumn: number;
	public readonly renderSpaceWidth: number;
	public readonly renderSpaceCharCode: number;
	public readonly stopRenderingLineAfter: number;
	public readonly renderWhitespace: RenderWhitespace;
	public readonly renderControlCharacters: boolean;
	public readonly fontLigatures: boolean;

	/**
	 * Defined only when renderWhitespace is 'selection'. Selections are non-overlapping,
	 * and ordered by position within the line.
	 */
	public readonly selectionsOnLine: LineRange[] | null;

	constructor(
		public readonly store: BlockStore,
		public readonly lineNumber: number,
		public readonly useMonospaceOptimizations: boolean,
		canUseHalfwidthRightwardsArrow: boolean,
		lineContent: string,
		continuesWithWrappedLine: boolean,
		isBasicASCII: boolean,
		containsRTL: boolean,
		fauxIndentLength: number,
		public readonly lineTokens: IViewLineTokens,
		//lineDecorations: LineDecoration[],
		tabSize: number,
		startVisibleColumn: number,
		public readonly spaceWidth: number,
		middotWidth: number,
		wsmiddotWidth: number,
		stopRenderingLineAfter: number,
		renderWhitespace: 'none' | 'boundary' | 'selection' | 'trailing' | 'all',
		renderControlCharacters: boolean,
		fontLigatures: boolean,
		selectionsOnLine: LineRange[] | null
	) {
		this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
		this.lineContent = lineContent;
		this.continuesWithWrappedLine = continuesWithWrappedLine;
		this.isBasicASCII = isBasicASCII;
		this.containsRTL = containsRTL;
		this.fauxIndentLength = fauxIndentLength;
		//this.lineDecorations = lineDecorations.sort(LineDecoration.compare);
		this.tabSize = tabSize;
		this.startVisibleColumn = startVisibleColumn;
		this.spaceWidth = spaceWidth;
		this.stopRenderingLineAfter = stopRenderingLineAfter;
		this.renderWhitespace = (
			renderWhitespace === 'all'
				? RenderWhitespace.All
				: renderWhitespace === 'boundary'
					? RenderWhitespace.Boundary
					: renderWhitespace === 'selection'
						? RenderWhitespace.Selection
						: renderWhitespace === 'trailing'
							? RenderWhitespace.Trailing
							: RenderWhitespace.None
		);
		this.renderControlCharacters = renderControlCharacters;
		this.fontLigatures = fontLigatures;
		this.selectionsOnLine = selectionsOnLine && selectionsOnLine.sort((a, b) => a.startOffset < b.startOffset ? -1 : 1);

		const wsmiddotDiff = Math.abs(wsmiddotWidth - spaceWidth);
		const middotDiff = Math.abs(middotWidth - spaceWidth);
		if (wsmiddotDiff < middotDiff) {
			this.renderSpaceWidth = wsmiddotWidth;
			this.renderSpaceCharCode = 0x2E31; // U+2E31 - WORD SEPARATOR MIDDLE DOT
		} else {
			this.renderSpaceWidth = middotWidth;
			this.renderSpaceCharCode = 0xB7; // U+00B7 - MIDDLE DOT
		}
	}

	private sameSelection(otherSelections: LineRange[] | null): boolean {
		if (this.selectionsOnLine === null) {
			return otherSelections === null;
		}

		if (otherSelections === null) {
			return false;
		}

		if (otherSelections.length !== this.selectionsOnLine.length) {
			return false;
		}

		for (let i = 0; i < this.selectionsOnLine.length; i++) {
			if (!this.selectionsOnLine[i].equals(otherSelections[i])) {
				return false;
			}
		}

		return true;
	}

	public equals(other: RenderLineInput): boolean {
		return (
			this.useMonospaceOptimizations === other.useMonospaceOptimizations
			&& this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow
			&& this.lineContent === other.lineContent
			&& this.continuesWithWrappedLine === other.continuesWithWrappedLine
			&& this.isBasicASCII === other.isBasicASCII
			&& this.containsRTL === other.containsRTL
			&& this.fauxIndentLength === other.fauxIndentLength
			&& this.tabSize === other.tabSize
			&& this.startVisibleColumn === other.startVisibleColumn
			&& this.spaceWidth === other.spaceWidth
			&& this.renderSpaceWidth === other.renderSpaceWidth
			&& this.renderSpaceCharCode === other.renderSpaceCharCode
			&& this.stopRenderingLineAfter === other.stopRenderingLineAfter
			&& this.renderWhitespace === other.renderWhitespace
			&& this.renderControlCharacters === other.renderControlCharacters
			&& this.fontLigatures === other.fontLigatures
			//&& LineDecoration.equalsArr(this.lineDecorations, other.lineDecorations)
			//&& this.lineTokens.equals(other.lineTokens)
			&& this.sameSelection(other.selectionsOnLine)
		);
	}
}

const enum CharacterMappingConstants {
	PART_INDEX_MASK = 0b11111111111111110000000000000000,
	CHAR_INDEX_MASK = 0b00000000000000001111111111111111,

	CHAR_INDEX_OFFSET = 0,
	PART_INDEX_OFFSET = 16
}

export class DomPosition {
	constructor(
		public readonly partIndex: number,
		public readonly charIndex: number
	) { }
}

/**
 * Provides a both direction mapping between a line's character and its rendered position.
 */
export class CharacterMapping {

	private static getPartIndex(partData: number): number {
		return (partData & CharacterMappingConstants.PART_INDEX_MASK) >>> CharacterMappingConstants.PART_INDEX_OFFSET;
	}

	private static getCharIndex(partData: number): number {
		return (partData & CharacterMappingConstants.CHAR_INDEX_MASK) >>> CharacterMappingConstants.CHAR_INDEX_OFFSET;
	}

	public readonly length: number;
	private readonly _data: Uint32Array;
	private readonly _horizontalOffset: Uint32Array;

	constructor(length: number, partCount: number) {
		this.length = length;
		this._data = new Uint32Array(this.length);
		this._horizontalOffset = new Uint32Array(this.length);
	}

	public setColumnInfo(column: number, partIndex: number, charIndex: number, horizontalOffset: number): void {
		const partData = (
			(partIndex << CharacterMappingConstants.PART_INDEX_OFFSET)
			| (charIndex << CharacterMappingConstants.CHAR_INDEX_OFFSET)
		) >>> 0;
		this._data[column - 1] = partData;
		this._horizontalOffset[column - 1] = horizontalOffset;
	}

	public getHorizontalOffset(column: number): number {
		if (this._horizontalOffset.length === 0) {
			// No characters on this line
			return 0;
		}
		return this._horizontalOffset[column - 1];
	}

	private charOffsetToPartData(charOffset: number): number {
		if (this.length === 0) {
			return 0;
		}
		if (charOffset < 0) {
			return this._data[0];
		}
		if (charOffset >= this.length) {
			return this._data[this.length - 1];
		}
		return this._data[charOffset];
	}

	public getDomPosition(column: number): DomPosition {
		const partData = this.charOffsetToPartData(column - 1);
		const partIndex = CharacterMapping.getPartIndex(partData);
		const charIndex = CharacterMapping.getCharIndex(partData);
		return new DomPosition(partIndex, charIndex);
	}

	public getColumn(domPosition: DomPosition, partLength: number): number {
		const charOffset = this.partDataToCharOffset(domPosition.partIndex, partLength, domPosition.charIndex);
		return charOffset + 1;
	}

	private partDataToCharOffset(partIndex: number, partLength: number, charIndex: number): number {
		if (this.length === 0) {
			return 0;
		}

		const searchEntry = (
			(partIndex << CharacterMappingConstants.PART_INDEX_OFFSET)
			| (charIndex << CharacterMappingConstants.CHAR_INDEX_OFFSET)
		) >>> 0;

		let min = 0;
		let max = this.length - 1;
		while (min + 1 < max) {
			const mid = ((min + max) >>> 1);
			const midEntry = this._data[mid];
			if (midEntry === searchEntry) {
				return mid;
			} else if (midEntry > searchEntry) {
				max = mid;
			} else {
				min = mid;
			}
		}

		if (min === max) {
			return min;
		}

		const minEntry = this._data[min];
		const maxEntry = this._data[max];

		if (minEntry === searchEntry) {
			return min;
		}
		if (maxEntry === searchEntry) {
			return max;
		}

		const minPartIndex = CharacterMapping.getPartIndex(minEntry);
		const minCharIndex = CharacterMapping.getCharIndex(minEntry);

		const maxPartIndex = CharacterMapping.getPartIndex(maxEntry);
		let maxCharIndex: number;

		if (minPartIndex !== maxPartIndex) {
			// sitting between parts
			maxCharIndex = partLength;
		} else {
			maxCharIndex = CharacterMapping.getCharIndex(maxEntry);
		}

		const minEntryDistance = charIndex - minCharIndex;
		const maxEntryDistance = maxCharIndex - charIndex;

		if (minEntryDistance <= maxEntryDistance) {
			return min;
		}
		return max;
	}

	public inflate() {
		const result: [number, number, number][] = [];
		for (let i = 0; i < this.length; i++) {
			const partData = this._data[i];
			const partIndex = CharacterMapping.getPartIndex(partData);
			const charIndex = CharacterMapping.getCharIndex(partData);
			const visibleColumn = this._horizontalOffset[i];
			result.push([partIndex, charIndex, visibleColumn]);
		}
		return result;
	}
}

export const enum ForeignElementType {
	None = 0,
	Before = 1,
	After = 2
}

export class RenderLineOutput {
	_renderLineOutputBrand: void = undefined;

	readonly characterMapping: CharacterMapping;
	readonly containsRTL: boolean;
	readonly containsForeignElements: ForeignElementType;

	constructor(characterMapping: CharacterMapping, containsRTL: boolean, containsForeignElements: ForeignElementType) {
		this.characterMapping = characterMapping;
		this.containsRTL = containsRTL;
		this.containsForeignElements = containsForeignElements;
	}
}

class ResolvedRenderLineInput {
	constructor(
		public readonly fontIsMonospace: boolean,
		public readonly canUseHalfwidthRightwardsArrow: boolean,
		public readonly lineContent: string,
		public readonly len: number,
		public readonly isOverflowing: boolean,
		public readonly overflowingCharCount: number,
		public readonly parts: LinePart[],
		public readonly containsForeignElements: ForeignElementType,
		public readonly fauxIndentLength: number,
		public readonly tabSize: number,
		public readonly startVisibleColumn: number,
		public readonly containsRTL: boolean,
		public readonly spaceWidth: number,
		public readonly renderSpaceCharCode: number,
		public readonly renderWhitespace: RenderWhitespace,
		public readonly renderControlCharacters: boolean,
	) {
		//
	}
}

function resolveRenderLineInput(input: RenderLineInput): ResolvedRenderLineInput {
	const lineContent = input.lineContent;

	let isOverflowing: boolean;
	let overflowingCharCount: number;
	let len: number;

	if (input.stopRenderingLineAfter !== -1 && input.stopRenderingLineAfter < lineContent.length) {
		isOverflowing = true;
		overflowingCharCount = lineContent.length - input.stopRenderingLineAfter;
		len = input.stopRenderingLineAfter;
	} else {
		isOverflowing = false;
		overflowingCharCount = 0;
		len = lineContent.length;
	}

	let tokens = transformAndRemoveOverflowing(lineContent, input.containsRTL, input.lineTokens, input.fauxIndentLength, len);
	if (input.renderControlCharacters && !input.isBasicASCII) {
		// Calling `extractControlCharacters` before adding (possibly empty) line parts
		// for inline decorations. `extractControlCharacters` removes empty line parts.
		//tokens = extractControlCharacters(lineContent, tokens);
	}
	if (input.renderWhitespace === RenderWhitespace.All ||
		input.renderWhitespace === RenderWhitespace.Boundary ||
		(input.renderWhitespace === RenderWhitespace.Selection && !!input.selectionsOnLine) ||
		(input.renderWhitespace === RenderWhitespace.Trailing && !input.continuesWithWrappedLine)
	) {
		//tokens = _applyRenderWhitespace(input, lineContent, len, tokens);
	}
	let containsForeignElements = ForeignElementType.None;
	/*
	if (input.lineDecorations.length > 0) {
		for (let i = 0, len = input.lineDecorations.length; i < len; i++) {
			const lineDecoration = input.lineDecorations[i];
			if (lineDecoration.type === InlineDecorationType.RegularAffectingLetterSpacing) {
				// Pretend there are foreign elements... although not 100% accurate.
				containsForeignElements |= ForeignElementType.Before;
			} else if (lineDecoration.type === InlineDecorationType.Before) {
				containsForeignElements |= ForeignElementType.Before;
			} else if (lineDecoration.type === InlineDecorationType.After) {
				containsForeignElements |= ForeignElementType.After;
			}
		}
		tokens = _applyInlineDecorations(lineContent, len, tokens, input.lineDecorations);
	}
	*/
	if (!input.containsRTL) {
		// We can never split RTL text, as it ruins the rendering
		//tokens = splitLargeTokens(lineContent, tokens, !input.isBasicASCII || input.fontLigatures);
	}

	//console.log(input.lineTokens);

	return new ResolvedRenderLineInput(
		input.useMonospaceOptimizations,
		input.canUseHalfwidthRightwardsArrow,
		lineContent,
		len,
		isOverflowing,
		overflowingCharCount,
		tokens,
		containsForeignElements,
		input.fauxIndentLength,
		input.tabSize,
		input.startVisibleColumn,
		input.containsRTL,
		input.spaceWidth,
		input.renderSpaceCharCode,
		input.renderWhitespace,
		input.renderControlCharacters
	);
}

/**
 * In the rendering phase, characters are always looped until token.endIndex.
 * Ensure that all tokens end before `len` and the last one ends precisely at `len`.
 */
function transformAndRemoveOverflowing(lineContent: string, lineContainsRTL: boolean, tokens: IViewLineTokens, fauxIndentLength: number, len: number): LinePart[] {
	const result: LinePart[] = [];
	let resultLen = 0;

	// The faux indent part of the line should have no token type
	if (fauxIndentLength > 0) {
		result[resultLen++] = new LinePart(fauxIndentLength, '', 0, false);
	}
	let startOffset = fauxIndentLength;
	for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
		const endIndex = tokens.getEndOffset(tokenIndex);
		if (endIndex <= fauxIndentLength) {
			// The faux indent part of the line should have no token type
			continue;
		}
		const type = tokens.getClassName(tokenIndex);
		if (endIndex >= len) {
			const tokenContainsRTL = (lineContainsRTL ? strings.containsRTL(lineContent.substring(startOffset, len)) : false);
			result[resultLen++] = new LinePart(len, type, 0, tokenContainsRTL);
			break;
		}
		const tokenContainsRTL = (lineContainsRTL ? strings.containsRTL(lineContent.substring(startOffset, endIndex)) : false);
		result[resultLen++] = new LinePart(endIndex, type, 0, tokenContainsRTL);
		startOffset = endIndex;
	}

	return result;
}

export function renderViewLine(input: RenderLineInput, viewBlock: IViewLineContribution, sb: StringBuilder): RenderLineOutput {

	if (input.lineContent.length === 0) {
		// completely empty line
		sb.appendString('<span><span></span></span>');
		return new RenderLineOutput(
			new CharacterMapping(0, 0),
			false,
			ForeignElementType.None
		);
	}

	const store = input.store;

	const resolvedInput = resolveRenderLineInput(input);
	const len = resolvedInput.len;
	const containsRTL = resolvedInput.containsRTL;
	const containsForeignElements = resolvedInput.containsForeignElements;
	const lineContent = resolvedInput.lineContent;
	const fauxIndentLength = resolvedInput.fauxIndentLength;
	const startVisibleColumn = resolvedInput.startVisibleColumn;
	const parts = resolvedInput.parts;

	//console.log(resolvedInput.parts);

	const characterMapping = new CharacterMapping(len + 1, 0);
	let lastCharacterMappingDefined = false;

	let charIndex = 0;
	let visibleColumn = startVisibleColumn;
	let charOffsetInPart = 0; // the character offset in the current part
	let charHorizontalOffset = 0; // the character horizontal position in terms of chars relative to line start

	let partDisplacement = 0;

	if (containsRTL) {
		sb.appendString('<span dir="ltr">');
	} else {
		sb.appendString('<span>');
	}

	if (pureTextTypes.has(store.getType() || '')) {
		for (let partIndex = 0, tokensLen = parts.length; partIndex < tokensLen; partIndex++) {
			const part = parts[partIndex];
			const partEndIndex = part.endIndex;
			const partType = part.type;
			const partContainsRTL = part.containsRTL;
			const partRendersWhitespace = false;
			const partRendersWhitespaceWithWidth = false;
			const partIsEmptyAndHasPseudoAfter = (charIndex === partEndIndex && part.isPseudoAfter());

			charOffsetInPart = 0;

			sb.appendString('<span ');
			if (partContainsRTL) {
				sb.appendString('style="unicode-bidi:isolate" ');
			}
			sb.appendString('class="');
			sb.appendString(partRendersWhitespaceWithWidth ? 'mtkz' : partType);
			sb.appendASCIICharCode(CharCode.DoubleQuote);

			if (partRendersWhitespace) {

			} else {
				sb.appendASCIICharCode(CharCode.GreaterThan);

				for (; charIndex < partEndIndex; charIndex++) {
					characterMapping.setColumnInfo(charIndex + 1, partIndex - partDisplacement, charOffsetInPart, charHorizontalOffset);
					partDisplacement = 0;
					const charCode = lineContent.charCodeAt(charIndex);

					const producedCharacters = 1;
					let charWidth = 1;

					switch (charCode) {
						case CharCode.Space:
							sb.appendCharCode(0xA0); // &nbsp;
							break;

						case CharCode.LessThan:
							sb.appendString('&lt;');
							break;

						case CharCode.GreaterThan:
							sb.appendString('&gt;');
							break;

						case CharCode.Ampersand:
							sb.appendString('&amp;');
							break;
						default: {
							if (strings.isFullWidthCharacter(charCode)) {
								charWidth++;
							}
							sb.appendCharCode(charCode);
						}
					}

					charOffsetInPart += producedCharacters;
					charHorizontalOffset += charWidth;
					if (charIndex >= fauxIndentLength) {
						visibleColumn += charWidth;
					}
				}
			}

			if (partIsEmptyAndHasPseudoAfter) {
				partDisplacement++;
			} else {
				partDisplacement = 0;
			}

			if (charIndex >= len && !lastCharacterMappingDefined && part.isPseudoAfter()) {
				lastCharacterMappingDefined = true;
				characterMapping.setColumnInfo(charIndex + 1, partIndex, charOffsetInPart, charHorizontalOffset);
			}

			sb.appendString('</span>');
		}

		if (!lastCharacterMappingDefined) {
			// When getting client rects for the last character, we will position the
			// text range at the end of the span, insteaf of at the beginning of next span
			characterMapping.setColumnInfo(len + 1, parts.length - 1, charOffsetInPart, charHorizontalOffset);
		}

		sb.appendString('</span>');

		return new RenderLineOutput(characterMapping, containsRTL, containsForeignElements);
	}

	const partIndex = 0;

	for (; charIndex < resolvedInput.len; charIndex++) {
		characterMapping.setColumnInfo(charIndex + 1, partIndex - partDisplacement, charOffsetInPart, charHorizontalOffset);

		const charCode = lineContent.charCodeAt(charIndex);

		const producedCharacters: number = 1;
		let charWidth: number = 1;

		if (strings.isFullWidthCharacter(charCode)) {
			charWidth++;
		}

		charOffsetInPart += producedCharacters;
		charHorizontalOffset += charWidth;
		if (charIndex >= fauxIndentLength) {
			visibleColumn += charWidth;
		}
	}

	if (charIndex >= len && !lastCharacterMappingDefined) {
		lastCharacterMappingDefined = true;
		characterMapping.setColumnInfo(charIndex + 1, partIndex, charOffsetInPart, charHorizontalOffset);
	}

	const line = viewBlock.render(store);
	sb.appendString(line);

	sb.appendString('</span>');

	return new RenderLineOutput(characterMapping, containsRTL, containsForeignElements);
}
