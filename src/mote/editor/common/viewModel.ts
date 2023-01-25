import * as strings from 'mote/base/common/strings';
import { Scrollable } from 'mote/base/common/scrollable';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { CursorConfiguration, CursorState, EditOperationType, IColumnSelectData, ICursorSimpleModel, PartialCursorState } from 'mote/editor/common/cursorCommon';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';
import { ITextModel, PositionAffinity } from 'mote/editor/common/model';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { IViewLineTokens } from 'mote/editor/common/tokens/lineTokens';
import BlockStore from 'mote/platform/store/common/blockStore';
import { BlockType } from 'mote/platform/store/common/record';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';

export interface IPartialViewLinesViewportData {
	/**
	 * Value to be substracted from `scrollTop` (in order to vertical offset numbers < 1MM)
	 */
	readonly bigNumbersDelta: number;
	/**
	 * The first (partially) visible line number.
	 */
	readonly startLineNumber: number;
	/**
	 * The last (partially) visible line number.
	 */
	readonly endLineNumber: number;
	/**
	 * relativeVerticalOffset[i] is the `top` position for line at `i` + `startLineNumber`.
	 */
	readonly relativeVerticalOffset: number[];
	/**
	 * The centered line in the viewport.
	 */
	readonly centeredLineNumber: number;
	/**
	 * The first completely visible line number.
	 */
	readonly completelyVisibleStartLineNumber: number;
	/**
	 * The last completely visible line number.
	 */
	readonly completelyVisibleEndLineNumber: number;
}

export interface IViewWhitespaceViewportData {
	readonly id: string;
	readonly afterLineNumber: number;
	readonly verticalOffset: number;
	readonly height: number;
}

export interface IViewModel extends ICursorSimpleModel {

	readonly model: ITextModel;

	readonly viewLayout: IViewLayout;

	readonly coordinatesConverter: ICoordinatesConverter;

	readonly cursorConfig: CursorConfiguration;

	addViewEventHandler(eventHandler: ViewEventHandler): void;
	removeViewEventHandler(eventHandler: ViewEventHandler): void;

	setHasFocus(hasFocus: boolean): void;

	getSelection(): EditorSelection;

	getPrimaryCursorState(): CursorState;
	getCursorStates(): CursorState[];
	setCursorStates(source: string | null | undefined, reason: CursorChangeReason, states: PartialCursorState[] | null): boolean;

	revealPrimaryCursor(source: string | null | undefined, revealHorizontal: boolean, minimalReveal?: boolean): void;
	revealTopMostCursor(source: string | null | undefined): void;
	revealBottomMostCursor(source: string | null | undefined): void;

	getCursorColumnSelectData(): IColumnSelectData;
	setCursorColumnSelectData(columnSelectData: IColumnSelectData): void;

	getCursorAutoClosedCharacters(): EditorRange[];

	getPrevEditOperationType(): EditOperationType;
	setPrevEditOperationType(type: EditOperationType): void;

	getLineCount(): number;
	getLineType(lineNumber: number): BlockType;
	getLineContent(lineNumber: number): string;
	getLineLength(lineNumber: number): number;

	getViewportViewLineRenderingData(visibleRange: EditorRange, lineNumber: number): ViewLineRenderingData;
	getViewLineRenderingData(lineNumber: number): ViewLineRenderingData;
}

export interface IViewLayout {

	getScrollWidth(): number;
	getScrollHeight(): number;

	getCurrentScrollLeft(): number;
	getCurrentScrollTop(): number;

	getScrollable(): Scrollable;
	getLinesViewportData(): IPartialViewLinesViewportData;

	deltaScrollNow(deltaScrollLeft: number, deltaScrollTop: number): void;

	isAfterLines(verticalOffset: number): boolean;
	getLineNumberAtVerticalOffset(verticalOffset: number): number;
	getVerticalOffsetForLineNumber(lineNumber: number, includeViewZones?: boolean): number;
}

export interface IEditorWhitespace {
	readonly id: string;
	readonly afterLineNumber: number;
	readonly height: number;
}

/**
 * An accessor that allows for whitespace to be added, removed or changed in bulk.
 */
export interface IWhitespaceChangeAccessor {
	insertWhitespace(afterLineNumber: number, ordinal: number, heightInPx: number, minWidth: number): string;
	changeOneWhitespace(id: string, newAfterLineNumber: number, newHeight: number): void;
	removeWhitespace(id: string): void;
}

export class Viewport {
	readonly _viewportBrand: void = undefined;

	readonly top: number;
	readonly left: number;
	readonly width: number;
	readonly height: number;

	constructor(top: number, left: number, width: number, height: number) {
		this.top = top | 0;
		this.left = left | 0;
		this.width = width | 0;
		this.height = height | 0;
	}
}

export interface ICoordinatesConverter {

	// View -> Model conversion and related methods
	convertViewPositionToModelPosition(viewPosition: Position): Position;
	convertViewRangeToModelRange(viewRange: EditorRange): EditorRange;

	validateViewPosition(viewPosition: Position, expectedModelPosition: Position): Position;
	validateViewRange(viewRange: EditorRange, expectedModelRange: EditorRange): EditorRange;

	// Model -> View conversion and related methods
	convertModelPositionToViewPosition(modelPosition: Position, affinity?: PositionAffinity): Position;
}

export class ViewLineData {
	_viewLineDataBrand: void = undefined;

	public type: BlockType = 'text';

	/**
	 * The content at this view line.
	 */
	public readonly content: string;
	/**
	 * Does this line continue with a wrapped line?
	 */
	public readonly continuesWithWrappedLine: boolean;
	/**
	 * The minimum allowed column at this view line.
	 */
	public readonly minColumn: number;
	/**
	 * The maximum allowed column at this view line.
	 */
	public readonly maxColumn: number;
	/**
	 * The visible column at the start of the line (after the fauxIndent).
	 */
	public readonly startVisibleColumn: number;

	public modelLineNumber!: number;
	/**
	 * The tokens at this view line.
	 */
	public readonly tokens: IViewLineTokens;

	/**
	 * Additional inline decorations for this line.
	*/
	//public readonly inlineDecorations: readonly SingleLineInlineDecoration[] | null;

	constructor(
		content: string,
		continuesWithWrappedLine: boolean,
		minColumn: number,
		maxColumn: number,
		startVisibleColumn: number,
		tokens: IViewLineTokens,
		//inlineDecorations: readonly SingleLineInlineDecoration[] | null
	) {
		this.content = content;
		this.continuesWithWrappedLine = continuesWithWrappedLine;
		this.minColumn = minColumn;
		this.maxColumn = maxColumn;
		this.startVisibleColumn = startVisibleColumn;
		this.tokens = tokens;
		//this.inlineDecorations = inlineDecorations;
	}
}

export class ViewLineRenderingData {
	/**
	 * The minimum allowed column at this view line.
	 */
	public readonly minColumn: number;
	/**
	 * The maximum allowed column at this view line.
	 */
	public readonly maxColumn: number;
	/**
	 * The content at this view line.
	 */
	public readonly content: string;
	/**
	 * Does this line continue with a wrapped line?
	 */
	public readonly continuesWithWrappedLine: boolean;
	/**
	 * Describes if `content` contains RTL characters.
	 */
	public readonly containsRTL: boolean;
	/**
	 * Describes if `content` contains non basic ASCII chars.
	 */
	public readonly isBasicASCII: boolean;
	/**
	 * The tokens at this view line.
	 */
	//public readonly tokens: IViewLineTokens;
	/**
	 * Inline decorations at this view line.
	 */
	//public readonly inlineDecorations: InlineDecoration[];
	/**
	 * The tab size for this view model.
	 */
	public readonly tabSize: number;
	/**
	 * The visible column at the start of the line (after the fauxIndent)
	 */
	public readonly startVisibleColumn: number;

	constructor(
		minColumn: number,
		maxColumn: number,
		content: string,
		continuesWithWrappedLine: boolean,
		mightContainRTL: boolean,
		mightContainNonBasicASCII: boolean,
		//tokens: IViewLineTokens,
		//inlineDecorations: InlineDecoration[],
		tabSize: number,
		startVisibleColumn: number,
		public readonly store: BlockStore,
	) {
		this.minColumn = minColumn;
		this.maxColumn = maxColumn;
		this.content = content;
		this.continuesWithWrappedLine = continuesWithWrappedLine;

		this.isBasicASCII = ViewLineRenderingData.isBasicASCII(content, mightContainNonBasicASCII);
		this.containsRTL = ViewLineRenderingData.containsRTL(content, this.isBasicASCII, mightContainRTL);

		//this.tokens = tokens;
		//this.inlineDecorations = inlineDecorations;
		this.tabSize = tabSize;
		this.startVisibleColumn = startVisibleColumn;
	}

	public static isBasicASCII(lineContent: string, mightContainNonBasicASCII: boolean): boolean {
		if (mightContainNonBasicASCII) {
			return strings.isBasicASCII(lineContent);
		}
		return true;
	}

	public static containsRTL(lineContent: string, isBasicASCII: boolean, mightContainRTL: boolean): boolean {
		if (!isBasicASCII && mightContainRTL) {
			return strings.containsRTL(lineContent);
		}
		return false;
	}
}

export const enum InlineDecorationType {
	Regular = 0,
	Before = 1,
	After = 2,
	RegularAffectingLetterSpacing = 3
}

export class InlineDecoration {
	constructor(
		public readonly range: EditorRange,
		public readonly inlineClassName: string,
		public readonly type: InlineDecorationType
	) {
	}
}

export class SingleLineInlineDecoration {
	constructor(
		public readonly startOffset: number,
		public readonly endOffset: number,
		public readonly inlineClassName: string,
		public readonly inlineClassNameAffectsLetterSpacing: boolean
	) {
	}

	toInlineDecoration(lineNumber: number): InlineDecoration {
		return new InlineDecoration(
			new EditorRange(lineNumber, this.startOffset + 1, lineNumber, this.endOffset + 1),
			this.inlineClassName,
			this.inlineClassNameAffectsLetterSpacing ? InlineDecorationType.RegularAffectingLetterSpacing : InlineDecorationType.Regular
		);
	}
}
